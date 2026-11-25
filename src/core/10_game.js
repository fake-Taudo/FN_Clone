// =====================================================================
// Game: state creation, tick orchestration, scanner, rebirth
// =====================================================================
const Game = {
  createMeta(baseSeed) {
    return {
      baseSeed: (baseSeed === undefined ? RNG.newSeed() : baseSeed) >>> 0,
      rebirths: 0, rp: 0, rpTotal: 0, bonusRp: 0, shop: {}, maxPlanet: 1,
      codex: { state: new Uint8Array(91), mined: new Float64Array(91), best: new Float64Array(91) },
      ach: new Set(),
      totalEarned: 0,
      tutorial: { done: false, step: 0 },
      introSeen: false,
      stats: Game.newStats(),
      earnHistory: []
    };
  },
  newStats() {
    return { playTime: 0, minedByTier: new Array(8).fill(0), sold: 0, refined: 0, satisfied: 0, research: 0, contracts: 0, extractorsBuilt: 0, bestRunEarned: 0, bestIncome: 0, offlineEarned: 0, scans: 0, runs: [] };
  },
  planetSeed(meta, k) { return RNG.hash(meta.baseSeed, k, 0x5eed); },

  create(meta, k, opts = {}) {
    const seed = opts.seed !== undefined ? opts.seed : Game.planetSeed(meta, k);
    const world = World.create(seed, k, { luckLevel: meta.shop.luck || 0 });
    const L = CONFIG.landing;
    const g = {
      meta, stats: meta.stats, world,
      buildings: new Map(), occ: new Map(), bchunk: new Map(), depUse: new Map(),
      nextId: 1, order: [], lists: {}, mods: null,
      topologyDirty: true, modsDirty: false,
      events: [], tick: 0,
      rnd: RNG.mulberry32(RNG.hash(seed, meta.rebirths, Date.now() & 0xffff)),
      undo: [], redo: [],
      incomeAcc: 0, incomeBuf: new Float64Array(30), incomePos: 0, incomeTimer: 0, income: 0,
      input: { x: 0, y: 0, sprint: false },
      lastCell: null, warnTimer: 0, notified: new Map()
    };
    const sh = id => meta.shop[id] || 0;
    const kitLvl = sh('kit');
    g.run = {
      planet: k, seed,
      money: CONFIG.startMoney + 400 * (Math.pow(2, sh('capital')) - 1),
      earned: 0, time: 0,
      player: { x: L.x + 0.5, y: L.y + 0.5, vx: 0, vy: 0, face: 1, moving: false },
      home: { x: L.x + 0.5, y: L.y + 0.5 },
      counts: {},
      research: { done: new Set(), active: null },
      custTier: Math.min(2, sh('startTier')),
      demand: {
        d: new Float64Array(91).fill(1), s: new Float64Array(91).fill(1),
        hist: new Float32Array(91 * CONFIG.historyLength).fill(1), histPos: 0, histCount: 0,
        timer: CONFIG.demandInterval, histTimer: CONFIG.historyInterval
      },
      events: [], eventTimer: 120 + (seed % 120),
      contracts: [], contractTimer: 60, contractSeq: 0,
      produced: new Set(), salesLog: [], tips: [], pins: [],
      scanCd: 0, scanPing: null, probeCd: 0, probeTarget: null,
      kits: {
        extractor: kitLvl >= 1 ? (kitLvl >= 2 ? 2 : 1) : 0, bazaar: kitLvl >= 1 ? 1 : 0, belt: kitLvl >= 1 ? (kitLvl >= 3 ? 100 : 40) : 0,
        silo: kitLvl >= 2 ? 1 : 0, refinery1: kitLvl >= 2 ? 1 : 0, lab: kitLvl >= 3 ? 1 : 0
      },
      minedRun: new Array(8).fill(0), soldRun: 0,
      startShown: false
    };
    Progression.computeMods(g);
    World.discover(world, L.x, L.y, CONFIG.viewDiscoverRadius + 6);
    for (const d of World.reveal(world, L.x, L.y, CONFIG.startRadius)) Progression.seeDeposit(g, d);
    return g;
  },

  // ---------------- topology ----------------
  recompute(g) {
    g.topologyDirty = false;
    g.topoVersion = (g.topoVersion || 0) + 1;
    const lists = { extractor: [], silo: [], refinery: [], seller: [], lab: [], terminal: [] };
    for (const b of g.buildings.values()) {
      if (b.type === 'extractor') lists.extractor.push(b);
      else if (b.type === 'silo') lists.silo.push(b);
      else if (REFINERY_LEVEL[b.type]) lists.refinery.push(b);
      else if (SELLER_TIER[b.type] !== undefined) { lists.seller.push(b); if (b.type === 'terminal') lists.terminal.push(b); }
      else if (b.type === 'lab') lists.lab.push(b);
    }
    g.lists = lists;
    for (const b of lists.extractor) {
      b.outs = Logistics.extractorOuts(g, b);
      let cluster = 0, servo = 0;
      const src = [];
      for (const o of Grid.neighbors(g, b)) {
        if (o.type === 'extractor' && o.res === b.res) cluster++;
        if (o.type === 'servo') servo = Math.max(servo, CONFIG.servoBonus * (1 + 0.2 * (o.level - 1)));
      }
      const cb = Math.min(CONFIG.clusterBonusMax, cluster * CONFIG.clusterBonus);
      if (cb > 0) src.push({ name: 'Extraktor-Cluster (' + cluster + ')', v: cb });
      if (servo > 0) src.push({ name: 'Servo-Hub', v: servo });
      b.bonus = cb + servo; b.bonusSrc = src;
      b.rate = Economy.extractRate(g, b);
    }
    for (const b of lists.refinery) {
      const coolers = [], src = [];
      let servo = 0, silo = false;
      for (const o of Grid.neighbors(g, b)) {
        if (o.type === 'cooler') coolers.push(CONFIG.coolerBonus * (1 + 0.2 * (o.level - 1)));
        if (o.type === 'servo') servo = Math.max(servo, CONFIG.servoBonus * (1 + 0.2 * (o.level - 1)));
        if (o.type === 'silo') silo = true;
      }
      coolers.sort((a, c) => c - a);
      const cool = coolers.slice(0, CONFIG.coolerMax).reduce((a, c) => a + c, 0);
      if (cool > 0) src.push({ name: 'Kühlturm (' + Math.min(coolers.length, CONFIG.coolerMax) + ')', v: cool });
      if (servo > 0) src.push({ name: 'Servo-Hub', v: servo });
      if (silo) src.push({ name: 'Lager (Materialnähe)', v: CONFIG.siloRefineryBonus });
      b.bonus = cool + servo + (silo ? CONFIG.siloRefineryBonus : 0); b.bonusSrc = src;
      b.port = Grid.frontPort(b);
      b.rate = Economy.refineRate(g, b);
    }
    for (const b of lists.silo) b.port = Grid.frontPort(b);
    for (const b of lists.seller) {
      b.ramps = [...Grid.neighbors(g, b)].filter(o => o.type === 'silo');
      b.bonusSrc = b.ramps.length ? [{ name: 'Verladerampe (Lager angrenzend)', v: CONFIG.rampBonus }] : [];
      if (b.type === 'bazaar') {
        const R = CONFIG.pathRadius;
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        let n = 0; const ends = [];
        for (let y = Math.floor(cy - R * 2); y <= cy + R * 2; y++) for (let x = Math.floor(cx - R * 2); x <= cx + R * 2; x++) {
          const o = Grid.at(g, x, y);
          if (!o || o.type !== 'path') continue;
          const d2 = U.dist2(x + 0.5, y + 0.5, cx, cy);
          if (d2 <= R * R) n++;
          let nb = 0;
          for (let d = 0; d < 4; d++) { const q = Grid.at(g, x + U.DX[d], y + U.DY[d]); if (q && q.type === 'path') nb++; }
          if (nb <= 1 && d2 > 9) ends.push([x, y]);
        }
        b.pathTiles = n; b.pathEnds = ends;
        if (n > 0) b.bonusSrc.push({ name: 'Alien-Wege (' + n + ' Felder) Kunden', v: Math.min(CONFIG.pathBonusMax, n * CONFIG.pathBonusPerTile) });
      }
    }
    Logistics.chargerBoost(g);
    Logistics.computeOrder(g);
  },

  // ---------------- main tick ----------------
  tick(g) {
    const dt = 1 / CONFIG.tickRate;
    const run = g.run;
    g.tick++;
    run.time += dt;
    g.stats.playTime += dt;
    if (g.modsDirty) { g.modsDirty = false; Progression.computeMods(g); g.topologyDirty = true; }
    if (g.topologyDirty) Game.recompute(g);
    Game.movePlayer(g, dt);
    const order = g.order;
    for (let i = 0; i < order.length; i++) Logistics.tickNode(g, order[i]);
    const L = g.lists;
    for (let i = 0; i < L.extractor.length; i++) Economy.tickExtractor(g, L.extractor[i]);
    for (let i = 0; i < L.silo.length; i++) Economy.tickSilo(g, L.silo[i]);
    for (let i = 0; i < L.refinery.length; i++) Economy.tickRefinery(g, L.refinery[i]);
    for (let i = 0; i < L.seller.length; i++) Economy.tickSeller(g, L.seller[i]);
    Economy.tickDemand(g, dt);
    Economy.tickContracts(g, dt);
    Progression.tickResearch(g, dt);
    Game.tickMisc(g, dt);
  },

  tickMisc(g, dt) {
    const run = g.run;
    if (run.scanCd > 0) run.scanCd = Math.max(0, run.scanCd - dt);
    if (run.probeCd > 0) run.probeCd = Math.max(0, run.probeCd - dt);
    if (run.scanPing) { run.scanPing.t += dt; if (run.scanPing.t > 2.5) run.scanPing = null; }
    // tips
    for (let i = run.tips.length - 1; i >= 0; i--) {
      const tp = run.tips[i];
      tp.life -= dt;
      const near = U.dist2(tp.x, tp.y, run.player.x, run.player.y) < 2.5;
      if (near || g.run.research.done.has('autocollect')) { Game.collectTip(g, i); continue; }
      if (tp.life <= 0) run.tips.splice(i, 1);
    }
    // income moving average (per second buckets over 30 s)
    g.incomeTimer += dt;
    if (g.incomeTimer >= 1) {
      g.incomeTimer -= 1;
      g.incomeBuf[g.incomePos] = g.incomeAcc;
      g.incomePos = (g.incomePos + 1) % g.incomeBuf.length;
      g.incomeAcc = 0;
      let s = 0; for (let i = 0; i < g.incomeBuf.length; i++) s += g.incomeBuf[i];
      g.income = s / Math.min(g.incomeBuf.length, Math.max(1, Math.floor(run.time)));
      if (g.income > g.stats.bestIncome) g.stats.bestIncome = g.income;
    }
    if (g.tick % 20 === 0) {
      Progression.checkTiers(g);
      Progression.checkAchievements(g);
      Game.updateWarnings(g);
      if (run.earned > g.stats.bestRunEarned) g.stats.bestRunEarned = run.earned;
    }
    if (g.tick % (CONFIG.tickRate * 60) === 0) {
      const h = g.meta.earnHistory;
      h.push([Math.round(g.stats.playTime), g.meta.totalEarned]);
      if (h.length > 720) h.splice(0, h.length - 720);
    }
  },

  collectTip(g, i) {
    const tp = g.run.tips[i];
    if (!tp) return 0;
    g.run.tips.splice(i, 1);
    Economy.earn(g, tp.value);
    g.events.push({ type: 'tip', tp });
    return tp.value;
  },

  movePlayer(g, dt) {
    const p = g.run.player, inp = g.input;
    let ix = inp.x, iy = inp.y;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    const speed = g.mods.walk * (inp.sprint ? CONFIG.sprintFactor : 1);
    const tx = ix * speed, ty = iy * speed;
    const k = Math.min(1, dt * 10);
    p.vx += (tx - p.vx) * k; p.vy += (ty - p.vy) * k;
    if (Math.abs(p.vx) < 0.01 && len === 0) p.vx = 0;
    if (Math.abs(p.vy) < 0.01 && len === 0) p.vy = 0;
    p.px = p.x; p.py = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = U.clamp(p.x, -2e6, 2e6); p.y = U.clamp(p.y, -2e6, 2e6);
    p.moving = Math.hypot(p.vx, p.vy) > 0.3;
    if (Math.abs(p.vx) > 0.2) p.face = p.vx > 0 ? 1 : -1;
    const cell = Math.floor(p.x / 4) + ',' + Math.floor(p.y / 4);
    if (cell !== g.lastCell) {
      g.lastCell = cell;
      World.discover(g.world, p.x, p.y, CONFIG.viewDiscoverRadius);
      for (const d of World.reveal(g.world, p.x, p.y, CONFIG.viewDiscoverRadius)) {
        Progression.seeDeposit(g, d);
        g.events.push({ type: 'depositSeen', d });
      }
    }
  },

  updateWarnings(g) {
    const alerts = g.run.research.done.has('alerts');
    for (const b of g.lists.extractor) {
      b.warn = b.outs && !b.outs.length ? 'nocon' : b.blocked > 2 ? 'blocked' : null;
      if (b.warn === 'blocked') Game.notifyOnce(g, b, 'blocked');
    }
    for (const b of g.lists.silo) {
      const cap = Economy.siloCap(g, b);
      b.warn = b.total >= cap ? 'full' : alerts && b.total >= cap * 0.9 ? 'nearfull' : null;
      if (b.warn) Game.notifyOnce(g, b, b.warn);
    }
    for (const b of g.lists.refinery) b.warn = b.wrongTick && g.tick - b.wrongTick < 40 ? 'wrong' : null;
    for (const b of g.lists.seller) {
      if (b.type === 'terminal') { b.warn = g.run.contracts.length && b.shelfTotal === 0 ? 'empty' : null; continue; }
      const waiting = b.customers.some(c => c.state === 'wait' && c.t > 6 && c.wishes.some(w => w.got < w.qty));
      b.warn = waiting && b.shelfTotal === 0 && !(b.ramps && b.ramps.some(s => s.total > 0)) ? 'empty' : null;
    }
  },
  notifyOnce(g, b, kind) {
    const key = b.id + kind;
    const last = g.notified.get(key);
    if (last !== undefined && g.run.time - last < 90) return;
    g.notified.set(key, g.run.time);
    g.events.push({ type: 'warn', b, kind });
  },

  // ---------------- scanner & probe ----------------
  scan(g) {
    const run = g.run;
    if (run.scanCd > 0) return null;
    const p = run.player;
    const r = g.mods.scanRadius;
    run.scanCd = g.mods.scanCd;
    run.scanPing = { x: p.x, y: p.y, t: 0, r };
    g.stats.scans++;
    World.discover(g.world, p.x, p.y, r);
    const found = World.reveal(g.world, p.x, p.y, r);
    for (const d of found) Progression.seeDeposit(g, d);
    g.events.push({ type: 'scan', found });
    return found;
  },
  probe(g) {
    const run = g.run;
    if (!run.research.done.has('probe') || run.probeCd > 0) return null;
    const p = run.player;
    const S = CONFIG.chunkSize;
    const pcx = Math.floor(p.x / S), pcy = Math.floor(p.y / S);
    let best = null, bestD = Infinity;
    for (let r = 0; r <= 10 && !best; r++) {
      for (let cy = pcy - r; cy <= pcy + r; cy++) for (let cx = pcx - r; cx <= pcx + r; cx++) {
        if (Math.max(Math.abs(cx - pcx), Math.abs(cy - pcy)) !== r) continue;
        for (const d of World.chunkDeposits(g.world, cx, cy)) {
          if (d.tier < 3 || g.world.known.has(d.id)) continue;
          const dd = U.dist2(d.x, d.y, p.x, p.y);
          if (dd < bestD) { bestD = dd; best = d; }
        }
      }
    }
    run.probeCd = 300;
    if (best) {
      g.world.known.add(best.id);
      Progression.seeDeposit(g, best);
      World.discover(g.world, best.x, best.y, 6);
      run.probeTarget = { x: best.x, y: best.y, id: best.id };
    }
    g.events.push({ type: 'probe', d: best });
    return best;
  },

  // ---------------- rebirth ----------------
  rebirth(g, targetPlanet) {
    const p = Progression.rebirthPoints(g);
    if (p <= 0) return null;
    const meta = g.meta;
    const gained = p + meta.bonusRp;
    meta.bonusRp = 0;
    meta.rp += gained;
    meta.rpTotal += gained;
    meta.rebirths++;
    meta.maxPlanet = Math.max(meta.maxPlanet, g.run.planet + 1);
    meta.stats.runs.push({ planet: g.run.planet, earned: g.run.earned, time: g.run.time, points: gained });
    if (meta.stats.runs.length > 50) meta.stats.runs.shift();
    const target = U.clamp(targetPlanet || meta.maxPlanet, 1, meta.maxPlanet);
    const g2 = Game.create(meta, target);
    Progression.checkAchievements(g2);
    return { game: g2, gained };
  },

  // Runs many ticks quickly (debug time-lapse / catch-up). Returns ticks done.
  advance(g, ticks) {
    for (let i = 0; i < ticks; i++) Game.tick(g);
    return ticks;
  }
};
