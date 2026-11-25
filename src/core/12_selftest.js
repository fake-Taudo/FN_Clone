// =====================================================================
// SelfTest: determinism, distribution, save roundtrip, offline bounds, NaN guard
// =====================================================================
const SelfTest = {
  run() {
    const out = [];
    const test = (name, f) => {
      try { const r = f(); out.push({ name, ok: r === true || (r && r.ok), info: r && r.info }); }
      catch (e) { out.push({ name, ok: false, info: 'Ausnahme: ' + e.message }); }
    };
    test('Chunk-Generierung deterministisch', () => {
      const a = World.create(987654, 1), b = World.create(987654, 1);
      for (let i = 0; i < 200; i++) {
        const cx = (i * 37) % 61 - 30, cy = (i * 91) % 53 - 26;
        const da = JSON.stringify(World.genChunkDeposits(a, cx, cy).map(d => [d.x, d.y, d.res, d.tiles]));
        const db = JSON.stringify(World.genChunkDeposits(b, cx, cy).map(d => [d.x, d.y, d.res, d.tiles]));
        if (da !== db) return { ok: false, info: 'Chunk ' + cx + '/' + cy + ' unterschiedlich' };
      }
      const t1 = World.terrain(a, 1234.5, -987.25), t2 = World.terrain(b, 1234.5, -987.25);
      return { ok: t1.e === t2.e && JSON.stringify(a.start) === JSON.stringify(b.start), info: '200 Chunks + Terrain + Glücksstart identisch' };
    });
    test('Weit entfernte Koordinaten (±1.000.000) stabil', () => {
      const w = World.create(42, 1);
      const d = World.genChunkDeposits(w, 31000, -31000);
      const t = World.terrain(w, 999999.5, -999999.5);
      return { ok: isFinite(t.e) && Array.isArray(d), info: 'Terrain ' + t.e.toFixed(3) };
    });
    test('Seltenheitsverteilung (100.000 Vorkommen, ±10 %)', () => {
      const w = World.create(13579, 1);
      const counts = new Array(8).fill(0);
      let n = 0;
      for (let cx = 2000; n < 100000; cx++) for (let cy = -150; cy < 150 && n < 100000; cy++) for (const d of World.genChunkDeposits(w, cx, cy)) { counts[d.tier]++; n++; }
      const tot = CONFIG.tierWeights.reduce((a, b) => a + b, 0);
      const dev = counts.map((c, t) => Math.abs(c / n / (CONFIG.tierWeights[t] / tot) - 1));
      const worst = Math.max(...dev);
      return { ok: worst <= 0.10, info: 'max. Abweichung ' + (worst * 100).toFixed(1) + ' % · ' + counts.map(c => (c / n * 100).toFixed(1)).join('/') };
    });
    test('91 Rohstoffe, Verteilung 25/20/16/12/8/5/3/2, Namen eindeutig', () => {
      const per = DATA.BY_TIER.map(a => a.length).join('/');
      const uniq = new Set(DATA.RESOURCES.map(r => r.name)).size;
      return { ok: DATA.RESOURCES.length === 91 && per === '25/20/16/12/8/5/3/2' && uniq === 91, info: per + ' · ' + uniq + ' eindeutige Namen' };
    });
    test('Glücksstart immer spielbar', () => {
      const luck = [0, 0, 0, 0];
      for (let s = 1; s <= 600; s++) {
        const w = World.create(s * 7919, 1);
        luck[w.start.luck]++;
        if (!w.start.deposits.some(d => d.tier === 0)) return { ok: false, info: 'Seed ' + s + ' ohne gewöhnliches Vorkommen' };
        const L = CONFIG.landing;
        if (!w.start.deposits.every(d => Math.hypot(d.x - L.x, d.y - L.y) <= CONFIG.startRadius)) return { ok: false, info: 'Vorkommen außerhalb des Startradius' };
      }
      return { ok: true, info: 'Verteilung ' + luck.map(c => (c / 6).toFixed(0) + ' %').join(' / ') };
    });
    let g;
    test('Bauen, Logistik und Verkauf', () => {
      g = SelfTest.sampleGame();
      for (let i = 0; i < 20 * 180; i++) Game.tick(g);
      return { ok: g.run.earned > 0, info: Fmt.money(g.run.earned) + ' nach 3 Minuten' };
    });
    test('Speichern/Laden verlustfrei', () => {
      const s1 = Save.serialize(g);
      const back = Save.fromObject(JSON.parse(s1)).game;
      const s2 = Save.serialize(back);
      const a = JSON.parse(s1), b = JSON.parse(s2);
      delete a.savedAt; delete b.savedAt; delete a.lastSeen; delete b.lastSeen;
      const same = JSON.stringify(a) === JSON.stringify(b);
      const exp = Save.parseImport(Save.exportString(g));
      return { ok: same && exp.loaded.game.buildings.size === g.buildings.size, info: g.buildings.size + ' Gebäude, ' + (s1.length / 1024).toFixed(1) + ' KB' };
    });
    test('Offline monoton und auf 8 h begrenzt', () => {
      const s = Save.serialize(g);
      const res = [600, 3600, 4 * 3600, 8 * 3600, 20 * 3600].map(sec => Offline.simulate(Save.fromObject(JSON.parse(s)).game, sec));
      let mono = true;
      for (let i = 1; i < res.length; i++) if (res[i].earned + 1e-6 < res[i - 1].earned) mono = false;
      const capped = res[4].seconds === CONFIG.offlineMax && Math.abs(res[4].earned - res[3].earned) < 1e-6;
      return { ok: mono && capped && res.every(r => isFinite(r.earned)), info: res.map(r => Fmt.num(r.earned)).join(' ≤ ') };
    });
    test('Offline-Berechnung schnell (2.000 Gebäude)', () => {
      const big = SelfTest.bigGame(2000);
      const t0 = Date.now();
      const r = Offline.simulate(big, 8 * 3600);
      const ms = Date.now() - t0;
      return { ok: ms < 300 && isFinite(r.earned), info: ms + ' ms für ' + big.buildings.size + ' Gebäude' };
    });
    test('Keine NaN/Infinity in der Wirtschaft', () => {
      const vals = [g.run.money, g.run.earned, g.meta.totalEarned, g.income, ...g.run.demand.d, ...g.run.demand.s, g.mods.sales];
      const huge = Fmt.num(1e308) + Fmt.num(Infinity) + Fmt.num(NaN);
      return { ok: vals.every(v => isFinite(v)) && !/NaN|Infinity/.test(huge), info: 'Formatierung: ' + Fmt.num(1e45) + ', ' + Fmt.num(NaN) };
    });
    test('Undo/Redo', () => {
      const g2 = SelfTest.sampleGame();
      const n0 = g2.buildings.size, m0 = g2.run.money;
      Actions.placeMany(g2, [{ type: 'belt', x: 40, y: 40, rot: 0 }, { type: 'belt', x: 41, y: 40, rot: 0 }], { ignoreRadius: true });
      const n1 = g2.buildings.size;
      Actions.undo(g2);
      const n2 = g2.buildings.size, m2 = g2.run.money;
      Actions.redo(g2);
      return { ok: n1 === n0 + 2 && n2 === n0 && Math.abs(m2 - m0) < 1e-6 && g2.buildings.size === n1, info: n0 + ' → ' + n1 + ' → ' + n2 + ' → ' + g2.buildings.size };
    });
    return out;
  },

  // Small working setup next to the first common start deposit.
  sampleGame(seed = 4242) {
    const meta = Game.createMeta(seed);
    const g = Game.create(meta, 1);
    g.run.money = 5000;
    const d = g.world.start.deposits.find(x => x.tier === 0);
    let ex = null;
    for (let dy = -2; dy <= 1 && !ex; dy++) for (let dx = -2; dx <= 1 && !ex; dx++) ex = Grid.place(g, { type: 'extractor', x: d.x + dx, y: d.y + dy, rot: 0 }, { ignoreRadius: true });
    if (!ex) return g;
    const bx = ex.x + 2;
    let len = 0;
    for (let i = 0; i < 12; i++) { if (Grid.place(g, { type: 'belt', x: bx + i, y: ex.y, rot: 0 }, { ignoreRadius: true })) len++; else break; }
    Grid.place(g, { type: 'bazaar', x: bx + len, y: ex.y - 1, rot: 0 }, { ignoreRadius: true });
    Grid.place(g, { type: 'silo', x: bx + len, y: ex.y + 1, rot: 0 }, { ignoreRadius: true });
    return g;
  },
  // Synthetic large factory for performance tests.
  bigGame(n) {
    const meta = Game.createMeta(99);
    const g = Game.create(meta, 1);
    g.run.money = 1e15;
    let placed = 0, row = 0;
    const deps = [];
    for (let cx = 3; deps.length < 300 && cx < 40; cx++) for (let cy = -10; cy < 10; cy++) for (const d of World.chunkDeposits(g.world, cx, cy)) deps.push(d);
    for (const d of deps) {
      if (placed >= n) break;
      const ex = Grid.place(g, { type: 'extractor', x: d.x, y: d.y, rot: 0 }, { ignoreRadius: true });
      if (!ex) continue;
      placed++;
      for (let i = 0; i < 4; i++) if (Grid.place(g, { type: 'belt', x: ex.x + 2 + i, y: ex.y, rot: 0 }, { ignoreRadius: true })) placed++;
      if (Grid.place(g, { type: 'silo', x: ex.x + 6, y: ex.y - 1, rot: 0 }, { ignoreRadius: true })) placed++;
      row++;
    }
    let y = -400;
    while (placed < n) { for (let x = 0; x < 40 && placed < n; x++) if (Grid.place(g, { type: 'belt', x: -300 + x, y, rot: 0 }, { ignoreRadius: true })) placed++; y++; }
    Game.recompute(g);
    return g;
  }
};
