// =====================================================================
// Save: serialisation, versioning, migration, export/import
// =====================================================================
const Save = {
  KEY: 'aresOutpost.save',
  BACKUP: 'aresOutpost.backup',
  SETTINGS: 'aresOutpost.settings',

  mapToArr: m => [...m.entries()].map(([k, v]) => [k, Math.round(v * 1000) / 1000]),

  toObject(g, extra = {}) {
    const m = g.meta, r = g.run;
    const bl = [];
    for (const b of g.buildings.values()) {
      const o = { i: b.id, t: b.type, x: b.x, y: b.y, r: b.rot, l: b.level, p: Math.round(b.paid * 100) / 100 };
      if (b.type === 'belt') { o.g = b.grade; if (b.items.length) o.it = b.items.map(it => Items.key(it)); }
      if (b.type === 'bridge') { o.n = b.len; if (b.queue.length) o.it = b.queue.map(q => Items.key(q.it)); }
      if (b.filter) o.f = b.filter;
      if (b.type === 'extractor') { o.d = b.dep; o.rs = b.res; o.tr = b.tier; o.om = b.outMask; if (b.buf.length) o.it = b.buf.map(it => Items.key(it)); }
      if (b.buf && b.type !== 'extractor' && b.buf.length) o.it = b.buf.map(it => Items.key(it));
      if (b.type === 'silo') { o.st = Save.mapToArr(b.store); o.of = b.outFilter; o.oe = b.outEnabled; }
      if (b.shelf && b.shelf.size) o.sh = Save.mapToArr(b.shelf);
      if (b.inBuf) { const keys = b.inBuf.concat(b.outBuf).map(it => Items.key(it)); if (b.cur) keys.push(Items.key(b.cur)); if (keys.length) o.it = keys; }
      bl.push(o);
    }
    return {
      version: SAVE_VERSION,
      game: GAME_TITLE,
      savedAt: Date.now(),
      lastSeen: extra.lastSeen || Date.now(),
      meta: {
        baseSeed: m.baseSeed, rebirths: m.rebirths, rp: m.rp, rpTotal: m.rpTotal, bonusRp: m.bonusRp,
        shop: m.shop, maxPlanet: m.maxPlanet,
        codex: { state: Array.from(m.codex.state), mined: Array.from(m.codex.mined, v => Math.round(v)), best: Array.from(m.codex.best, v => Math.round(v * 100) / 100) },
        ach: [...m.ach], totalEarned: m.totalEarned, tutorial: m.tutorial, introSeen: m.introSeen,
        stats: m.stats, earnHistory: m.earnHistory
      },
      run: {
        planet: r.planet, seed: r.seed, money: r.money, earned: r.earned, time: r.time,
        player: { x: r.player.x, y: r.player.y }, home: r.home, counts: r.counts,
        research: { done: [...r.research.done], active: r.research.active },
        custTier: r.custTier,
        demand: { d: Array.from(r.demand.d, v => Math.round(v * 1000) / 1000), s: Array.from(r.demand.s, v => Math.round(v * 1000) / 1000) },
        events: r.events, eventTimer: r.eventTimer, contracts: r.contracts, contractTimer: r.contractTimer, contractSeq: r.contractSeq,
        produced: [...r.produced], salesLog: r.salesLog, tips: r.tips, pins: r.pins,
        scanCd: r.scanCd, probeCd: r.probeCd, probeTarget: r.probeTarget, kits: r.kits,
        minedRun: r.minedRun, soldRun: r.soldRun, startShown: r.startShown
      },
      world: { disc: [...g.world.discovered.entries()], known: [...g.world.known] },
      buildings: bl,
      undoDepth: 0,
      camera: extra.camera || null
    };
  },

  // Version migrations: each takes an object of version v and returns version v+1.
  migrations: {
    1: o => { o.run.pins = o.run.pins || []; o.version = 2; return o; },
    2: o => { o.run.kits = o.run.kits || {}; o.meta.bonusRp = o.meta.bonusRp || 0; o.version = 3; return o; }
  },
  migrate(o) {
    if (!o || typeof o !== 'object') throw new Error('Kein Spielstand');
    if (typeof o.version !== 'number') throw new Error('Version fehlt');
    if (o.version > SAVE_VERSION) throw new Error('Spielstand ist neuer als das Spiel');
    while (o.version < SAVE_VERSION) {
      const f = Save.migrations[o.version];
      if (!f) throw new Error('Keine Migration für Version ' + o.version);
      o = f(o);
    }
    return o;
  },

  fromObject(o) {
    o = Save.migrate(o);
    if (!o.meta || !o.run || !Array.isArray(o.buildings)) throw new Error('Unvollständiger Spielstand');
    const mm = o.meta;
    const meta = Game.createMeta(mm.baseSeed);
    meta.rebirths = mm.rebirths | 0; meta.rp = +mm.rp || 0; meta.rpTotal = +mm.rpTotal || 0; meta.bonusRp = +mm.bonusRp || 0;
    meta.shop = Object.assign({}, mm.shop); meta.maxPlanet = Math.max(1, mm.maxPlanet | 0);
    if (mm.codex) {
      for (let i = 0; i < 91; i++) {
        meta.codex.state[i] = mm.codex.state[i] | 0;
        meta.codex.mined[i] = +mm.codex.mined[i] || 0;
        meta.codex.best[i] = +mm.codex.best[i] || 0;
      }
    }
    meta.ach = new Set(mm.ach || []);
    meta.totalEarned = U.safe(+mm.totalEarned || 0);
    meta.tutorial = mm.tutorial || { done: false, step: 0 };
    meta.introSeen = !!mm.introSeen;
    meta.stats = Object.assign(Game.newStats(), mm.stats || {});
    if (!Array.isArray(meta.stats.minedByTier) || meta.stats.minedByTier.length !== 8) meta.stats.minedByTier = new Array(8).fill(0);
    meta.earnHistory = Array.isArray(mm.earnHistory) ? mm.earnHistory : [];

    const r = o.run;
    const g = Game.create(meta, Math.max(1, r.planet | 0), { seed: r.seed >>> 0 });
    const run = g.run;
    run.money = U.safe(+r.money || 0); run.earned = U.safe(+r.earned || 0); run.time = +r.time || 0;
    run.player.x = +r.player.x || run.player.x; run.player.y = +r.player.y || run.player.y;
    if (r.home) run.home = r.home;
    run.counts = r.counts || {};
    run.research.done = new Set(r.research ? r.research.done : []);
    run.research.active = r.research && r.research.active && DATA.RESEARCH_BY_ID[r.research.active.id] ? r.research.active : null;
    run.custTier = U.clamp(r.custTier | 0, 0, 5);
    if (r.demand) for (let i = 0; i < 91; i++) { run.demand.d[i] = U.clamp(+r.demand.d[i] || 1, 0.5, 2); run.demand.s[i] = U.clamp(+r.demand.s[i] || 1, 0.4, 1); }
    run.events = (r.events || []).filter(e => e && typeof e.res === 'number');
    run.eventTimer = +r.eventTimer || 200;
    run.contracts = r.contracts || []; run.contractTimer = +r.contractTimer || 60; run.contractSeq = r.contractSeq | 0;
    run.produced = new Set(r.produced || []);
    run.salesLog = r.salesLog || []; run.tips = r.tips || []; run.pins = r.pins || [];
    run.scanCd = +r.scanCd || 0; run.probeCd = +r.probeCd || 0; run.probeTarget = r.probeTarget || null;
    run.kits = Object.assign({}, r.kits || {});
    run.minedRun = Array.isArray(r.minedRun) ? r.minedRun : new Array(8).fill(0);
    run.soldRun = +r.soldRun || 0; run.startShown = !!r.startShown;
    if (o.world) {
      g.world.discovered = new Map(o.world.disc || []);
      g.world.known = new Set(o.world.known || []);
    }
    Progression.computeMods(g);
    // buildings
    const counts = {};
    for (const s of o.buildings) {
      if (!DATA.BUILDINGS[s.t]) continue;
      const spec = { id: s.i, type: s.t, x: s.x, y: s.y, rot: s.r & 3, level: s.l || 1, paid: +s.p || 0, grade: s.g || 0, len: s.n, filter: s.f || null,
        dep: s.d, res: s.rs, tier: s.tr, outMask: s.om, outFilter: s.of || null, outEnabled: s.oe !== false };
      if (Grid.occTiles(spec.type, spec.x, spec.y, spec.rot, spec.len).some(t => g.occ.has(U.tileKey(t[0], t[1])))) continue;
      if (spec.type === 'extractor') {
        const d = World.depositById(g.world, spec.dep);
        if (!d) continue;
        spec.res = d.res; spec.tier = d.tier;
      }
      const b = Grid.make(g, spec);
      Grid.register(g, b);
      const ck = Grid.countKey(b.type, b.tier);
      counts[ck] = (counts[ck] || 0) + 1;
      const items = (s.it || []).filter(k => k >= 0 && k < 364).map(k => Items.make(k >> 2, k & 3));
      if (b.type === 'belt') {
        const sp = Logistics.spacing(b.grade);
        const keep = items.slice(0, Math.floor(1 / sp + 1e-9) + 1);
        keep.forEach((it, i) => { it.p = Math.max(0, 1 - (keep.length - 1 - i) * sp); it.pp = it.p; it.from = b.rot; });
        items.slice(keep.length).forEach(it => Items.free(it));
        b.items = keep;
      } else if (b.type === 'bridge') {
        b.queue = items.map((it, i) => ({ it, t: Math.max(0, b.len - 1 - i * 0.4) })).filter(q => q.t >= 0);
      } else if (b.type === 'extractor' || b.buf) {
        b.buf = items.slice(0, CONFIG.maxItemsPerBuffer);
      } else if (b.inBuf) {
        for (const it of items) { if (it.ref === REFINERY_LEVEL[b.type] - 1 && b.inBuf.length < CONFIG.refineBuffer) b.inBuf.push(it); else if (b.outBuf.length < 4) b.outBuf.push(it); else Items.free(it); }
      }
      if (b.type === 'silo' && s.st) for (const [k, c] of s.st) if (c > 0) Economy.siloAdd(b, k | 0, Math.floor(c));
      if (b.shelf && s.sh) for (const [k, c] of s.sh) if (c > 0) { b.shelf.set(k | 0, Math.floor(c)); b.shelfTotal += Math.floor(c); }
    }
    // counts drive cost growth: trust the rebuilt state
    run.counts = counts;
    g.topologyDirty = true;
    Game.recompute(g);
    return { game: g, lastSeen: +o.lastSeen || Date.now(), camera: o.camera || null };
  },

  serialize(g, extra) { return JSON.stringify(Save.toObject(g, extra)); },
  exportString(g, extra) { return 'AO1:' + Codec.pack(Save.serialize(g, extra)); },
  parseImport(text) {
    text = (text || '').trim();
    if (!text) throw new Error('Leerer Text');
    let json;
    if (text.startsWith('AO1:')) json = Codec.unpack(text.slice(4));
    else if (text.startsWith('{')) json = text;
    else throw new Error('Unbekanntes Format');
    const obj = JSON.parse(json);
    // validate by building a full game from it without touching the current one
    const loaded = Save.fromObject(JSON.parse(json));
    return { obj, loaded };
  },

  // localStorage wrappers (all failures are reported, never thrown)
  storage() {
    try { if (typeof localStorage === 'undefined') return null; const k = '__ao_test'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { return null; }
  },
  write(g, extra) {
    const ls = Save.storage();
    if (!ls) return { ok: false, err: 'Speicher nicht verfügbar' };
    try {
      const data = Save.serialize(g, extra);
      const prev = ls.getItem(Save.KEY);
      if (prev) { try { ls.setItem(Save.BACKUP, prev); } catch (e) { /* backup is optional */ } }
      ls.setItem(Save.KEY, data);
      return { ok: true, size: data.length };
    } catch (e) {
      return { ok: false, err: 'Speicher voll oder gesperrt' };
    }
  },
  read(key = Save.KEY) {
    const ls = Save.storage();
    if (!ls) return null;
    try { const s = ls.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  },
  load() {
    for (const key of [Save.KEY, Save.BACKUP]) {
      const o = Save.read(key);
      if (!o) continue;
      try { return Object.assign(Save.fromObject(o), { fromBackup: key === Save.BACKUP }); } catch (e) { /* try backup */ }
    }
    return null;
  },
  writeRaw(obj) {
    const ls = Save.storage();
    if (!ls) return false;
    try {
      const prev = ls.getItem(Save.KEY);
      if (prev) ls.setItem(Save.BACKUP, prev);
      ls.setItem(Save.KEY, JSON.stringify(obj));
      return true;
    } catch (e) { return false; }
  },
  wipe() {
    const ls = Save.storage();
    if (!ls) return;
    try { ls.removeItem(Save.KEY); ls.removeItem(Save.BACKUP); } catch (e) { /* ignore */ }
  }
};
