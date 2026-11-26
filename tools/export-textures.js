// Exports every procedural texture of index.html as PNG files.
// Usage: node tools/export-textures.js <outDir>   (needs Playwright + Chromium)
// File names match the earlier export (texturen/...), written to texturen-neu/...
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'exports';
const HTML = 'file://' + path.join(__dirname, '..', 'index.html');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message, e.stack));
  await page.goto(HTML);
  await page.waitForTimeout(300);
  await page.click('#btn-new'); await page.waitForTimeout(200);
  const skip = await page.$('.fx-skip'); if (skip) await skip.click();
  await page.waitForTimeout(500);
  await page.evaluate(() => { const A = window.__AO__; A.UI.closeModal(); A.App.running = false; });
  const files = await page.evaluate(() => {
    const A = window.__AO__;
    const { Draw, FX, Render, DATA, Grid, World, Game, App, ItemArt, BuildingArt, BeltArt, CharArt, DepositArt, FxLib, PlanetArt, Art, TerrainCore, RockArt, LanderArt, CONFIG } = A;
    const out = [];
    const R0 = 'texturen-neu/';
    const slug = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
    const save = (name, c) => out.push([R0 + name, c.toDataURL('image/png')]);
    const noRandom = f => { const r = Math.random; Math.random = () => 1; try { return f(); } finally { Math.random = r; } };
    App.cam.zoom = 64; App.view.dpr = 1; Draw.tm = 0.3; Draw.dt = 0;
    const g = App.g;
    const fakeG = Object.assign({}, g, { topoVersion: -7, run: Object.assign({}, g.run, { research: { active: null, done: new Set() }, contracts: [{}, {}] }), mods: g.mods });
    // ---- items: 91 resources x 4 refinement levels (+ LOD sizes) ----
    for (const R of DATA.RESOURCES) for (let ref = 0; ref < 4; ref++) {
      const c = canvas(128, 128);
      c.getContext('2d').drawImage(ItemArt.sprite(R.id, ref, 128), 0, 0);
      save('items/' + String(R.id).padStart(2, '0') + '_' + slug(R.name) + '_' + ['roh', 'veredelt', 'hochveredelt', 'perfekt'][ref] + '.png', c);
    }
    for (const sz of [16, 24, 48]) {
      const n = DATA.RESOURCES.length, cols = 13, c = canvas(cols * (sz + 4), Math.ceil(n / cols) * (sz + 4)), x = c.getContext('2d');
      x.fillStyle = '#3a3036'; x.fillRect(0, 0, c.width, c.height);
      DATA.RESOURCES.forEach((R, i) => x.drawImage(ItemArt.sprite(R.id, 0, ItemArt.sizeFor(sz)), (i % cols) * (sz + 4) + 2, Math.floor(i / cols) * (sz + 4) + 2, sz, sz));
      save('items/_lod_' + sz + 'px_alle-roh.png', c);
    }
    // ---- buildings at several levels / rotations ----
    const PX = 64;
    const drawB = (type, opts) => {
      const rot = opts.rot || 0;
      const sz = Grid.size(type, rot, 3);
      const w = type === 'bridge' ? 3 : sz.w, h = type === 'bridge' ? 1 : sz.h;
      const pad = 0.45, top = type === 'bridge' ? 1.6 : (BuildingArt.TOP[type] || 1) + 0.3;
      const c = canvas((w + pad * 2) * PX, (h + top + pad) * PX), x = c.getContext('2d');
      x.setTransform(PX, 0, 0, PX, pad * PX, top * PX);
      const b = { id: -9, type, x: 0, y: 0, rot, w, h, level: opts.level || 1, grade: opts.grade || 0, items: [], buf: [], inBuf: [], outBuf: [], shelf: new Map(), store: new Map(), total: opts.fill || 0, customers: [], res: opts.res !== undefined ? opts.res : 0, tier: opts.res !== undefined ? DATA.RESOURCES[opts.res].tier : 0, outMask: 15, boost: 1, len: 3, queue: [], outEnabled: true, _sv: -7, shape: opts.shape || 0, made: 1, cur: opts.cur || null, prog: 0.6, warn: null, filter: opts.filter || null, _spin: 1, _ang: 0.4, _heat: opts.cur ? 1 : 0 };
      if (opts.fill) b.store.set((opts.res || 0) * 4, opts.fill);
      if (opts.shelf) for (const k of opts.shelf) b.shelf.set(k, 5);
      Render.ox = 0; Render.oy = 0;
      noRandom(() => {
        if (type === 'bridge') Draw.bridge(x, fakeG, b, 0);
        else if (type === 'belt') Draw.belt(x, fakeG, b, 0, 0);
        else Draw.building(x, fakeG, b, 0, 0);
      });
      return c;
    };
    const upgradable = t => !Grid.isDeco(t) && !Grid.isTransport(t);
    for (const type of DATA.BUILDING_ORDER) {
      const name = slug(DATA.BUILDINGS[type].name);
      if (type === 'belt') {
        for (let gr = 0; gr < 4; gr++) {
          const gn = slug(DATA.BELT_GRADES[gr].name);
          save('gebaeude/belt_' + gr + '_' + gn + '_gerade.png', drawB('belt', { grade: gr }));
          save('gebaeude/belt_' + gr + '_' + gn + '_kurve-links.png', drawB('belt', { grade: gr, shape: 1 }));
          save('gebaeude/belt_' + gr + '_' + gn + '_kurve-rechts.png', drawB('belt', { grade: gr, shape: 2 }));
          // end caps, T inlet and animation frames
          const ppt = 64;
          const mk = (shape, rot, mask, fr) => { const c = canvas(PX * 1.2, PX * 1.2); c.getContext('2d').drawImage(BeltArt.sprite(gr, shape, rot, mask, fr, ppt), 0, 0, PX * 1.2, PX * 1.2); return c; };
          save('gebaeude/belt_' + gr + '_' + gn + '_endkappen.png', mk(0, 0, 0, 0));
          save('gebaeude/belt_' + gr + '_' + gn + '_t-einmuendung.png', mk(0, 0, 7, 0));
          const F = [8, 8, 12, 12][gr], strip = canvas(F * PX * 1.2, PX * 1.2), sx = strip.getContext('2d');
          for (let f = 0; f < F; f++) sx.drawImage(BeltArt.sprite(gr, 0, 0, 3, f, ppt), f * PX * 1.2, 0, PX * 1.2, PX * 1.2);
          save('gebaeude/belt_' + gr + '_' + gn + '_animation-' + F + 'frames.png', strip);
        }
        continue;
      }
      const shelf = Grid.isSeller(type) ? [4, 12, 52, 64, 100, 120] : null;
      const levels = upgradable(type) ? [1, 4, 7, 10] : (Grid.isDeco(type) ? [1, 2, 3] : [1]);
      for (const lv of levels) {
        const opts = { level: lv, res: type === 'extractor' ? [0, 26, 50, 63, 76][Math.min(4, Math.floor(lv / 2.5))] : 70, shelf, fill: type === 'silo' ? 400 : 0, cur: Grid.isRefinery(type) ? { res: 56, ref: 0 } : null, filter: type === 'fsplitter' ? { kind: 'res', res: 30 } : null };
        save('gebaeude/' + type + '_' + name + (levels.length > 1 ? '_stufe' + lv : '') + '.png', drawB(type, opts));
      }
      if (['splitter', 'merger', 'fsplitter', 'osplitter', 'silo', 'refinery1'].includes(type)) for (let r = 1; r < 4; r++) save('gebaeude/' + type + '_' + name + '_rot' + (r * 90) + '.png', drawB(type, { rot: r, res: 70 }));
    }
    for (let t = 0; t < 8; t++) save('gebaeude/extractor_seltenheit-' + t + '_' + slug(DATA.TIERS[t].name) + '.png', drawB('extractor', { res: DATA.BY_TIER[t][0] }));
    // ---- characters ----
    const charC = (w, h, f, ay = 0.8) => { const c = canvas(w * PX, h * PX), x = c.getContext('2d'); x.setTransform(PX, 0, 0, PX, w * PX / 2, h * PX * ay); noRandom(() => f(x)); return c; };
    const skins = Draw.planetSkins();
    const poses = ['laufend', 'stehend', 'freude', 'ungeduldig', 'enttaeuscht'];
    for (let s = 0; s < 6; s++) {
      const sp = A.ALIEN_SPECIES ? A.ALIEN_SPECIES[s] : 'art' + s;
      const spr = (pose, f) => { const c = canvas(1.4 * PX, 1.7 * PX); c.getContext('2d').drawImage(CharArt.alienSprite(s, skins[s], pose, f, PX), 0, 0); return c; };
      save('figuren/alien_skin' + (s + 1) + '_stehend.png', spr(1, 0));
      save('figuren/alien_skin' + (s + 1) + '_laufend.png', spr(0, 1));
      for (let p = 0; p < 5; p++) {
        const nf = p === 0 ? 6 : 4, strip = canvas(nf * 1.4 * PX, 1.7 * PX), x = strip.getContext('2d');
        for (let f = 0; f < nf; f++) x.drawImage(CharArt.alienSprite(s, skins[s], p, f, PX), f * 1.4 * PX, 0);
        save('figuren/alien_' + (s + 1) + '-' + slug(sp) + '_' + poses[p] + '_' + nf + 'frames.png', strip);
      }
    }
    const pl = g.run.player, saveP = { ...pl }, done = g.run.research.done, inp = g.input || (g.input = {});
    const astro = (dir, frame, opts = {}) => charC(1.6, 1.6, x => {
      pl.moving = dir !== 'idle'; pl.face = opts.face || 1;
      pl.vx = dir === 'side' ? 3 * pl.face : 0; pl.vy = dir === 'front' ? 3 : dir === 'back' ? -3 : 0;
      inp.sprint = !!opts.sprint; CharArt.walk = frame / 8; CharArt.idle = opts.idle || 0;
      CharArt.astronaut(x, g, 0, 0, opts.tm || 0, 0);
    }, 0.85);
    save('figuren/astronaut_stehend.png', astro('idle', 0));
    save('figuren/astronaut_laufend.png', astro('side', 2));
    save('figuren/astronaut_laufend_links.png', astro('side', 6, { face: -1 }));
    save('figuren/astronaut_winkend.png', astro('idle', 0, { idle: 4, tm: 0.1 }));
    save('figuren/astronaut_sprint-jetpack.png', astro('side', 3, { sprint: true, tm: 0.05 }));
    for (const dir of ['front', 'back', 'side']) {
      const strip = canvas(8 * 1.6 * PX, 1.6 * PX), x = strip.getContext('2d');
      for (let f = 0; f < 8; f++) x.drawImage(astro(dir, f), f * 1.6 * PX, 0);
      save('figuren/astronaut_lauf-' + ({ front: 'vorne', back: 'hinten', side: 'seite' })[dir] + '_8frames.png', strip);
    }
    done.add('rover'); pl.moving = true; pl.vx = 3; pl.face = 1;
    save('figuren/astronaut_rover.png', charC(2.4, 1.8, x => CharArt.astronaut(x, g, 0, 0, 0, 0)));
    done.delete('rover'); Object.assign(pl, saveP); inp.sprint = false;
    save('figuren/karawane.png', charC(6, 2.2, x => CharArt.caravan(x, 2.2, -0.1, { skin: 2 }, 0, 0, false)));
    const shipNames = { 2: 'shuttle', 3: 'handelsschiff', 4: 'frachter' };
    for (const t of [2, 3, 4]) {
      const sz = [0, 0, 3, 4.4, 7][t];
      save('figuren/' + shipNames[t] + '_gelandet.png', charC(sz, sz, x => CharArt.ship(x, 0, 0, { tier: t, state: 'wait', t: 2, buying: 0.2, _wx: 0, _wy: 0 }, 0, null), 0.55));
      save('figuren/' + shipNames[t] + '_im-anflug.png', charC(sz * 1.6, sz * 2.2, x => CharArt.ship(x, 0, 0, { tier: t, state: 'in', t: 1.2, arrive: 4, _wx: 0, _wy: 0 }, 0, null), 0.85));
      // landing sequence: 6 phases
      const seq = canvas(6 * sz * PX, sz * 1.8 * PX), sx = seq.getContext('2d');
      [0.1, 0.45, 0.7, 0.9, 1.0].forEach((k, i) => { const c = charC(sz, sz * 1.8, x => CharArt.ship(x, 0, 0, { tier: t, state: 'in', t: k * 4, arrive: 4, _wx: 0, _wy: 0 }, 0, null), 0.85); sx.drawImage(c, i * sz * PX, 0); });
      sx.drawImage(charC(sz, sz * 1.8, x => CharArt.ship(x, 0, 0, { tier: t, state: 'wait', t: 2, buying: 0.2, _wx: 0, _wy: 0 }, 0, null), 0.85), 5 * sz * PX, 0);
      save('figuren/' + shipNames[t] + '_landesequenz.png', seq);
    }
    save('figuren/sprechblase.png', charC(3, 2, x => CharArt.bubble(x, 0, -0.6, { wishes: [{ res: 30, ref: 1, qty: 12, got: 4 }], t: 10, patience: 40, buying: 0.3, _bubAt: 1 }, 0), 0.6));
    // ---- animation frame sampling ----
    {
      const strip = (n, w, h, f, oy = h - 0.6) => { const c = canvas(n * w * PX, h * PX), x = c.getContext('2d'); for (let i = 0; i < n; i++) { x.setTransform(PX, 0, 0, PX, (i * w + 0.5) * PX, oy * PX); f(x, i); } return c; };
      const mkB = (type, extra) => Object.assign({ id: 90001, type, x: 0, y: 0, rot: 0, w: 2, h: 2, level: 1, buf: [], res: 26, tier: 1, made: 1, warn: null, customers: [], shelf: new Map(), store: new Map(), total: 0 }, extra || {});
      // extractor: off -> spin-up (0.6 s) -> running
      const ex = mkB('extractor', { _spin: 0, _ang: 0 });
      save('animation/extraktor_anlauf_7frames.png', strip(7, 3, 3.6, (x, i) => { Render.ox = 0; Render.oy = 0; Draw.dt = i === 0 ? 0 : 0.1; noRandom(() => Draw.building(x, fakeG, ex, 0, 0)); }, 1.4));
      // placement pop-in (0.9 -> 1.06 -> 1.0 in 220 ms)
      const sl = mkB('silo', { w: 3, h: 3, outEnabled: true });
      save('animation/platzieren_pop_6frames.png', strip(6, 4, 5.2, (x, i) => { Render.ox = 0; Render.oy = 0; Draw.dt = 0; sl._pop = App.now - i * 44 - 1; noRandom(() => Draw.building(x, fakeG, sl, 0, 0)); }, 2.0));
      // upgrade crossfade (stage 3 -> 4, 250 ms) with glow pulse
      const rf = mkB('refinery1', { w: 3, h: 3, inBuf: [], outBuf: [], cur: null, prog: 0, level: 4, _lv: 4 });
      save('animation/ausbau_ueberblendung_6frames.png', strip(6, 4, 5, (x, i) => { Render.ox = 0; Render.oy = 0; Draw.dt = 0; rf._xf = { from: 0, at: App.now - i * 50 }; rf._up = App.now - i * 50; noRandom(() => Draw.building(x, fakeG, rf, 0, 0)); }, 1.8));
      // sale: coin fountain
      Render.particles.length = 0;
      const saveRand = Math.random; let seed = 7; Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      Render.coinBurst(0, 0, 14);
      Math.random = saveRand;
      save('animation/verkauf_muenzfontaene_6frames.png', strip(6, 3, 3, (x, i) => { if (i) for (let k = 0; k < 3; k++) Render.updateParticles(0.04); Render.ox = -1; Render.oy = -1.6; x.translate(0, -1.2); Render.drawParticles(x); }));
      Render.particles.length = 0;
    }
    // ---- effects ----
    for (let t = 0; t < 8; t++) { const c = canvas(128, 128); c.getContext('2d').drawImage(FxLib.tinted('soft', 0, DATA.TIERS[t].color), 0, 0, 128, 128); save('effekte/glow_' + t + '_' + slug(DATA.TIERS[t].name) + '.png', c); }
    for (const [n, col] of [['muenze', '#ffd24a'], ['scanner', '#7fd3ff'], ['triebwerk', '#ffb04a']]) { const c = canvas(128, 128); c.getContext('2d').drawImage(FxLib.tinted('soft', 0, col), 0, 0, 128, 128); save('effekte/glow_' + n + '.png', c); }
    for (const [n, vars] of Object.entries(FxLib.VARIANTS || {})) for (let v = 0; v < vars; v++) {
      const s = FxLib.get(n, v), c = canvas(s.width, s.height), x = c.getContext('2d');
      x.fillStyle = '#20232a'; x.fillRect(0, 0, c.width, c.height); x.drawImage(s, 0, 0);
      save('effekte/fx_' + n + (vars > 1 ? '_' + v : '') + '.png', c);
    }
    // ---- planets ----
    const meta = g.meta;
    for (const k of [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 15]) {
      const pg = Game.create(meta, k);
      const P = pg.world.planet;
      Render.setPlanet(P, pg.world.seed);
      const pn = 'planet' + String(k).padStart(2, '0') + '_' + slug(P.name);
      // baked terrain (same pipeline as the game: height field, craters, dunes, materials, lighting)
      const TP = TerrainCore.params(P, pg.world.seed); TP.landing = [CONFIG.landing.x, CONFIG.landing.y];
      const toCanvas = r => { const cc = canvas(r.w, r.h); cc.getContext('2d').putImageData(new ImageData(r.rgba, r.w, r.h), 0, 0); return cc; };
      const depsOf = (cx, cy) => { const S = CONFIG.chunkSize; return World.depositsInRect(pg.world, cx * S - 5, cy * S - 5, (cx + 1) * S + 5, (cy + 1) * S + 5).map(d => { let sx = 0, sy = 0; for (const t of d.tiles) { sx += t[0] + 0.5; sy += t[1] + 0.5; } return { x: sx / d.tiles.length, y: sy / d.tiles.length, r: 0.7 + Math.sqrt(d.tiles.length) * 0.55, tier: d.tier, col: DATA.RESOURCES[d.res].color }; }); };
      save('planeten/' + pn + '_gelaende-chunk.png', toCanvas(TerrainCore.bake({ cx: 3, cy: 2, S: 32, res: 20, P: TP, deps: depsOf(3, 2) })));
      const T = 16, N = 64;
      const c = canvas(N * T, N * T), x = c.getContext('2d');
      const cx0 = 2, cy0 = 1;
      Render.ox = cx0 * 32; Render.oy = cy0 * 32;
      App.cam.zoom = 16;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const r = TerrainCore.bake({ cx: cx0 + i, cy: cy0 + j, S: 32, res: T, P: TP, deps: depsOf(cx0 + i, cy0 + j) });
        x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(toCanvas(r), i * 32 * T, j * 32 * T);
        x.setTransform(T, 0, 0, T, -Render.ox * T, -Render.oy * T);
        for (const pr of r.props) RockArt.draw(x, pr, 0, 0, T);
      }
      x.setTransform(T, 0, 0, T, 0, 0);
      const vr = { x0: cx0 * 32, y0: cy0 * 32, x1: cx0 * 32 + N, y1: cy0 * 32 + N };
      const deps = World.depositsInRect(pg.world, vr.x0, vr.y0, vr.x1, vr.y1);
      for (const d of deps) { const s = DepositArt.sprite(d, 16); x.drawImage(s.canvas, s.ox - Render.ox, s.oy - Render.oy, s.w, s.h); }
      noRandom(() => { for (const d of deps) DepositArt.dynamic(x, d, 0.5, 0, 16); });
      save('planeten/' + pn + '_gelaende-mit-deko.png', c);
      const d = canvas(512, 512);
      if (PlanetArt) PlanetArt.draw(d.getContext('2d'), 256, 256, 220, P, 0.3); else FX.drawPlanet(d.getContext('2d'), 256, 256, 220, P, 0);
      save('planeten/' + pn + '_kugel.png', d);
    }
    Render.setPlanet(g.world.planet, g.world.seed);
    // ---- supply lander ARES-01 (intro and landmark) ----
    { const c = canvas(768, 640), x = c.getContext('2d'); x.setTransform(128, 0, 0, 128, 384, 435); LanderArt.top(x, { legs: 1, hatch: 1, wings: 1, soot: 0.8, tm: 0, lights: false }); save('lander/versorgungslander_draufsicht.png', c); }
    { const c = canvas(768, 640), x = c.getContext('2d'); x.setTransform(128, 0, 0, 128, 384, 400); LanderArt.plumeTop(x, 1.8, 1, 0.4); LanderArt.top(x, { legs: 0.4, hatch: 0, wings: 0, soot: 0.8, heat: 1, tm: 0 }); save('lander/versorgungslander_anflug.png', c); }
    { const c = canvas(640, 640), x = c.getContext('2d'); x.fillStyle = '#07050b'; x.fillRect(0, 0, 640, 640); x.setTransform(300, 0, 0, 300, 320, 380); LanderArt.profile(x, { legs: 0, wings: 1, tm: 0 }); save('lander/versorgungslander_profil_orbit.png', c); }
    { const c = canvas(640, 640), x = c.getContext('2d'); x.fillStyle = '#07050b'; x.fillRect(0, 0, 640, 640); x.setTransform(240, 0, 0, 240, 320, 330); x.rotate(-0.6); LanderArt.plasma(x, 1, 0.3, 'back'); LanderArt.profile(x, { legs: 0, wings: 0, soot: 0.6, tm: 0.3 }); LanderArt.plasma(x, 1, 0.3, 'front'); save('lander/versorgungslander_eintritt.png', c); }
    { const s = LanderArt.scorch(64); const c = canvas(s.S, s.S); c.getContext('2d').fillStyle = '#a87a5a'; c.getContext('2d').fillRect(0, 0, s.S, s.S); c.getContext('2d').drawImage(s.canvas, 0, 0); save('lander/brandfleck_mit_beinabdruecken.png', c); }
    App.cam.zoom = 64;
    // ---- deposits for each rarity tier ----
    for (let t = 0; t < 8; t++) {
      let dep = null;
      for (let cx = 5; !dep && cx < 400; cx++) for (let cy = 0; cy < 3 && !dep; cy++) for (const dd of World.chunkDeposits(g.world, cx, cy)) if (dd.tier === t && dd.tiles.length >= 3) { dep = dd; break; }
      if (!dep) continue;
      const s = DepositArt.sprite(dep, PX);
      const c = canvas(s.w * PX, s.h * PX), x = c.getContext('2d');
      x.fillStyle = Render.palette.ground[1]; x.fillRect(0, 0, c.width, c.height);
      x.setTransform(PX, 0, 0, PX, 0, 0);
      x.drawImage(s.canvas, 0, 0, s.w, s.h);
      Render.ox = s.ox; Render.oy = s.oy;
      noRandom(() => DepositArt.dynamic(x, dep, 0.6, 0.6, 64));
      save('vorkommen/vorkommen_' + t + '_' + slug(DATA.TIERS[t].name) + '_' + slug(DATA.RESOURCES[dep.res].name) + '.png', c);
    }
    // ---- decorations ----
    for (const [kind, n] of [['crater', 6], ['rock', 12], ['pebbles', 4], ['dune', 3], ['pool', 1], ['shard', 1], ['floe', 1], ['frost', 1], ['lava', 1], ['ash', 1], ['plant', 4], ['shroom', 1], ['crystal', 1], ['stars', 1], ['gring', 1], ['arc', 1], ['panel', 2], ['beamline', 1]]) {
      for (let v = 0; v < n; v++) {
        const s = A.DecorArt.sprite(kind, v, PX), c = canvas(s.canvas.width, s.canvas.height), x = c.getContext('2d');
        x.fillStyle = Render.palette.ground[1]; x.fillRect(0, 0, c.width, c.height); x.drawImage(s.canvas, 0, 0);
        save('deko/deko_' + kind + (n > 1 ? '_' + v : '') + '.png', c);
      }
    }
    return out;
  });
  for (const [name, url] of files) {
    const p = path.join(OUT, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log('wrote', files.length, 'textures');
  await browser.close();
})();
