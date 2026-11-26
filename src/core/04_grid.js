// =====================================================================
// Grid / Buildings: placement, ports, rotation, costs, upgrades, undo
// =====================================================================
const TRANSPORT = { belt: 1, splitter: 1, merger: 1, crossing: 1, bridge: 1, fsplitter: 1, osplitter: 1 };
const SELLER_TIER = { bazaar: 0, caravan: 1, shuttlepad: 2, port: 3, dock: 4, terminal: 5 };
const REFINERY_LEVEL = { refinery1: 1, refinery2: 2, refinery3: 3 };
const BOOSTER = { cooler: 1, servo: 1, charger: 1 };

const Grid = {
  isTransport: t => TRANSPORT[t] === 1,
  isSeller: t => SELLER_TIER[t] !== undefined,
  isRefinery: t => REFINERY_LEVEL[t] !== undefined,
  isDeco: t => DATA.BUILDINGS[t] && DATA.BUILDINGS[t].cat === 'deco',

  size(type, rot, len) {
    const d = DATA.BUILDINGS[type];
    let w = d.w, h = d.h;
    if (type === 'bridge') { w = len || 2; h = 1; }
    return (rot & 1) ? { w: h, h: w } : { w, h };
  },

  // Tiles a building occupies (bridges only occupy their two ends).
  occTiles(type, x, y, rot, len) {
    const s = Grid.size(type, rot, len);
    if (type === 'bridge') {
      const L = len || 2;
      const ex = x + U.DX[rot] * (L - 1), ey = y + U.DY[rot] * (L - 1);
      return [[x, y], [ex, ey]];
    }
    const out = [];
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) out.push([x + i, y + j]);
    return out;
  },

  // For a bridge, x/y is the entrance tile; footprint rect for rendering spans both ends.
  rect(b) {
    if (b.type === 'bridge') {
      const ex = b.x + U.DX[b.rot] * (b.len - 1), ey = b.y + U.DY[b.rot] * (b.len - 1);
      return { x: Math.min(b.x, ex), y: Math.min(b.y, ey), w: Math.abs(ex - b.x) + 1, h: Math.abs(ey - b.y) + 1 };
    }
    return { x: b.x, y: b.y, w: b.w, h: b.h };
  },

  at(g, x, y) {
    const id = g.occ.get(U.tileKey(x, y));
    return id === undefined ? null : g.buildings.get(id);
  },

  // Front-centre output port: returns [tx, ty] of the tile in front of the building.
  frontPort(b) {
    const r = b.rot;
    if (r === 0) return [b.x + b.w, b.y + (b.h >> 1)];
    if (r === 1) return [b.x + (b.w >> 1), b.y + b.h];
    if (r === 2) return [b.x - 1, b.y + (b.h >> 1)];
    return [b.x + (b.w >> 1), b.y - 1];
  },

  // All tiles directly outside the footprint with the outward direction.
  perimeter(b) {
    const out = [];
    for (let j = 0; j < b.h; j++) { out.push([b.x + b.w, b.y + j, 0]); out.push([b.x - 1, b.y + j, 2]); }
    for (let i = 0; i < b.w; i++) { out.push([b.x + i, b.y + b.h, 1]); out.push([b.x + i, b.y - 1, 3]); }
    return out;
  },

  neighbors(g, b) {
    const set = new Set();
    for (const p of Grid.perimeter(b)) {
      const o = Grid.at(g, p[0], p[1]);
      if (o && o !== b) set.add(o);
    }
    return set;
  },

  // ---------------- costs ----------------
  countKey(type, tier) { return type === 'extractor' ? 'extractor' + tier : type; },
  baseCost(type, opt = {}) {
    if (type === 'extractor') return CONFIG.extractorBaseCost * Math.pow(CONFIG.extractorCostTierFactor, opt.tier || 0);
    if (type === 'belt') return DATA.BELT_GRADES[opt.grade || 0].cost;
    return DATA.BUILDINGS[type].cost;
  },
  cost(g, type, opt = {}) {
    const base = Grid.baseCost(type, opt);
    if (type === 'belt') return base * Math.pow(CONFIG.beltCostGrowth, g.run.counts.belt || 0);
    if (Grid.isDeco(type)) return base;
    if (type === 'bridge') return base * Math.pow(CONFIG.costGrowth, g.run.counts.bridge || 0);
    const n = g.run.counts[Grid.countKey(type, opt.tier)] || 0;
    return base * Math.pow(CONFIG.costGrowth, n);
  },
  maxLevel(g, b) {
    if (b.type === 'extractor') return Math.min(10, g.mods.extCap);
    if (b.type === 'belt') return 4;
    if (Grid.isTransport(b.type) || Grid.isDeco(b.type)) return 3;
    return CONFIG.maxBuildingLevel;
  },
  upgradeCost(g, b) {
    if (b.type === 'belt') {
      const next = b.grade + 1;
      if (next > 3) return Infinity;
      return DATA.BELT_GRADES[next].cost - DATA.BELT_GRADES[b.grade].cost * 0.5;
    }
    const base = Grid.baseCost(b.type, { tier: b.tier });
    if (b.type === 'extractor') return base * Math.pow(CONFIG.extractorLevelCost, b.level);
    if (Grid.isDeco(b.type)) return base * 2 * b.level;
    return Math.max(10, base) * Math.pow(CONFIG.buildingLevelCost, b.level);
  },
  upgradeBlock(g, b) {
    if (b.type === 'belt') {
      if (b.grade >= 3) return 'Höchste Güteklasse erreicht';
      const r = DATA.BELT_GRADES[b.grade + 1].research;
      if (r && !g.run.research.done.has(r)) return 'Forschung nötig: ' + DATA.RESEARCH_BY_ID[r].name;
      return null;
    }
    if (b.level >= Grid.maxLevel(g, b)) return b.type === 'extractor' && b.level < 10 ? 'Obergrenze (Rebirth-Shop erhöht sie)' : 'Höchste Stufe erreicht';
    return null;
  },

  // ---------------- placement checks ----------------
  touchingDeposits(g, x, y, w, h) {
    const found = [];
    const list = World.depositsInRect(g.world, x - 4, y - 4, x + w + 4, y + h + 4);
    for (const d of list) {
      for (const t of d.tiles) {
        if (t[0] >= x - 1 && t[0] <= x + w && t[1] >= y - 1 && t[1] <= y + h) { found.push(d); break; }
      }
    }
    return found;
  },
  depositFree(g, d) { return d.slots - (g.depUse.get(d.id) || 0); },

  unlockReason(g, type, grade) {
    const def = DATA.BUILDINGS[type];
    if (type === 'belt') {
      const r = DATA.BELT_GRADES[grade || 0].research;
      if (r && !g.run.research.done.has(r)) return 'Forschung nötig: ' + DATA.RESEARCH_BY_ID[r].name;
      return null;
    }
    if (def.research && !g.run.research.done.has(def.research)) return 'Forschung nötig: ' + DATA.RESEARCH_BY_ID[def.research].name;
    if (def.tier !== undefined && def.tier > g.run.custTier) return 'Kundenstufe ' + (def.tier + 1) + ' nötig';
    return null;
  },

  canPlace(g, spec, opts = {}) {
    const type = spec.type;
    const def = DATA.BUILDINGS[type];
    if (!def) return { ok: false, reason: 'Unbekannt' };
    const lock = Grid.unlockReason(g, type, spec.grade);
    if (lock) return { ok: false, reason: lock };
    const len = spec.len || 2;
    const s = Grid.size(type, spec.rot, len);
    const tiles = Grid.occTiles(type, spec.x, spec.y, spec.rot, len);
    for (const t of tiles) {
      const id = g.occ.get(U.tileKey(t[0], t[1]));
      if (id !== undefined && !(opts.ignore && opts.ignore.has(id))) return { ok: false, reason: 'Blockiert' };
    }
    const LD = g.run.lander;
    if (LD) for (const t of tiles) if (t[0] >= LD.x - 1 && t[0] < LD.x + 1 && t[1] >= LD.y - 1 && t[1] < LD.y + 1) return { ok: false, reason: 'Versorgungslander' };
    if (type === 'bridge') {
      if (len < 2 || len > 6) return { ok: false, reason: 'Brücke: 1 bis 4 Felder Abstand' };
    }
    if (!opts.ignoreRadius) {
      const R = g.mods.buildRadius;
      const cxm = spec.x + s.w / 2, cym = spec.y + s.h / 2;
      if (U.dist2(cxm, cym, g.run.player.x, g.run.player.y) > R * R) return { ok: false, reason: 'Zu weit weg' };
    }
    let dep = null, tier = 0;
    if (type === 'extractor') {
      const deps = Grid.touchingDeposits(g, spec.x, spec.y, s.w, s.h).filter(d => Grid.depositFree(g, d) > 0 || (opts.ignoreDep === d.id));
      if (!deps.length) {
        const any = Grid.touchingDeposits(g, spec.x, spec.y, s.w, s.h);
        return { ok: false, reason: any.length ? 'Vorkommen ausgelastet' : 'Kein Vorkommen angrenzend' };
      }
      deps.sort((a, b) => b.tier - a.tier);
      dep = deps[0]; tier = dep.tier;
    }
    let cost = opts.free ? 0 : Grid.cost(g, type, { tier, grade: spec.grade });
    if (!opts.free && g.run.kits[type] > 0) cost = 0;
    if (!opts.free && type === 'belt' && g.run.kits.belt > 0) cost = 0;
    if (!opts.ignoreMoney && cost > g.run.money + 1e-9) return { ok: false, reason: 'Zu teuer', cost, dep, tier };
    return { ok: true, cost, dep, tier };
  },

  // ---------------- create / remove ----------------
  make(g, spec) {
    const type = spec.type;
    const s = Grid.size(type, spec.rot, spec.len);
    const b = {
      id: spec.id !== undefined ? spec.id : g.nextId++,
      type, x: spec.x, y: spec.y, rot: spec.rot & 3, w: s.w, h: s.h,
      level: spec.level || 1, paid: spec.paid || 0,
      warn: null, bonus: 0, bonusSrc: null
    };
    if (b.id >= g.nextId) g.nextId = b.id + 1;
    switch (type) {
      case 'extractor':
        b.dep = spec.dep; b.res = spec.res; b.tier = spec.tier; b.acc = 0; b.buf = []; b.rr = 0;
        b.outMask = spec.outMask !== undefined ? spec.outMask : 15; b.blocked = 0; b.made = 0;
        break;
      case 'belt': b.grade = spec.grade || 0; b.items = []; b.boost = 1; break;
      case 'splitter': case 'fsplitter': case 'osplitter': case 'merger':
        b.buf = []; b.rr = 0; b.filter = spec.filter || null; b.lastSide = -1; b.attempt = 0; b.prevAttempt = 0; break;
      case 'crossing': b.lanes = [null, null, null, null]; break;
      case 'bridge': b.len = spec.len || 2; b.queue = []; break;
      case 'silo': b.store = new Map(); b.total = 0; b.rr = 0; b.outFilter = spec.outFilter || null; b.outEnabled = spec.outEnabled !== undefined ? spec.outEnabled : true; break;
      case 'lab': break;
      default:
        if (Grid.isRefinery(type)) { b.inBuf = []; b.outBuf = []; b.prog = 0; b.cur = null; b.made = 0; }
        if (Grid.isSeller(type)) { b.shelf = new Map(); b.shelfTotal = 0; b.customers = []; b.timer = 2 + Math.random() * 3; b.sold = 0; b.ramps = []; b.pathTiles = 0; b.history = []; }
    }
    if (type === 'bridge') { b.w = s.w; b.h = s.h; }
    return b;
  },

  register(g, b) {
    g.buildings.set(b.id, b);
    for (const t of Grid.occTiles(b.type, b.x, b.y, b.rot, b.len)) g.occ.set(U.tileKey(t[0], t[1]), b.id);
    const r = Grid.rect(b);
    const S = CONFIG.chunkSize;
    for (let cy = Math.floor(r.y / S); cy <= Math.floor((r.y + r.h - 1) / S); cy++)
      for (let cx = Math.floor(r.x / S); cx <= Math.floor((r.x + r.w - 1) / S); cx++) {
        const k = U.chunkKey(cx, cy);
        let set = g.bchunk.get(k); if (!set) { set = new Set(); g.bchunk.set(k, set); }
        set.add(b.id);
      }
    if (b.type === 'extractor' && b.dep !== undefined) g.depUse.set(b.dep, (g.depUse.get(b.dep) || 0) + 1);
    g.topologyDirty = true;
  },

  unregister(g, b) {
    g.buildings.delete(b.id);
    for (const t of Grid.occTiles(b.type, b.x, b.y, b.rot, b.len)) {
      const k = U.tileKey(t[0], t[1]);
      if (g.occ.get(k) === b.id) g.occ.delete(k);
    }
    const r = Grid.rect(b);
    const S = CONFIG.chunkSize;
    for (let cy = Math.floor(r.y / S); cy <= Math.floor((r.y + r.h - 1) / S); cy++)
      for (let cx = Math.floor(r.x / S); cx <= Math.floor((r.x + r.w - 1) / S); cx++) {
        const set = g.bchunk.get(U.chunkKey(cx, cy));
        if (set) { set.delete(b.id); if (!set.size) g.bchunk.delete(U.chunkKey(cx, cy)); }
      }
    if (b.type === 'extractor' && b.dep !== undefined) {
      const n = (g.depUse.get(b.dep) || 1) - 1;
      if (n <= 0) g.depUse.delete(b.dep); else g.depUse.set(b.dep, n);
    }
    g.topologyDirty = true;
  },

  // Places a building, pays for it. Returns the building or null.
  place(g, spec, opts = {}) {
    const chk = Grid.canPlace(g, spec, opts);
    if (!chk.ok) return null;
    const full = Object.assign({}, spec);
    if (spec.type === 'extractor') { full.dep = chk.dep.id; full.res = chk.dep.res; full.tier = chk.dep.tier; }
    const b = Grid.make(g, full);
    const fromKit = !opts.free && (g.run.kits[spec.type] || 0) > 0;
    if (fromKit) g.run.kits[spec.type]--;
    g.run.money -= chk.cost;
    b.paid = chk.cost;
    Grid.register(g, b);
    g.run.counts[Grid.countKey(b.type, b.tier)] = (g.run.counts[Grid.countKey(b.type, b.tier)] || 0) + 1;
    if (b.type === 'extractor') g.stats.extractorsBuilt = (g.stats.extractorsBuilt || 0) + 1;
    g.events.push({ type: 'built', b });
    return b;
  },

  // Removes a building; refund fraction of what was paid. Items inside are lost.
  remove(g, b, refundRate = CONFIG.refundRate) {
    if (!g.buildings.has(b.id)) return 0;
    Grid.releaseItems(g, b);
    Grid.unregister(g, b);
    const k = Grid.countKey(b.type, b.tier);
    g.run.counts[k] = Math.max(0, (g.run.counts[k] || 0) - 1);
    const refund = b.paid * refundRate;
    g.run.money += refund;
    g.events.push({ type: 'removed', b });
    return refund;
  },

  releaseItems(g, b) {
    const rel = it => { if (it) Items.free(it); };
    if (b.items) b.items.forEach(rel);
    if (b.buf) b.buf.forEach(rel);
    if (b.inBuf) b.inBuf.forEach(rel);
    if (b.outBuf) b.outBuf.forEach(rel);
    if (b.queue) b.queue.forEach(q => rel(q.it));
    if (b.lanes) b.lanes.forEach(rel);
    if (b.cur) rel(b.cur);
    if (b.customers) b.customers.length = 0;
  },

  upgrade(g, b) {
    if (Grid.upgradeBlock(g, b)) return false;
    const c = Grid.upgradeCost(g, b);
    if (c > g.run.money) return false;
    g.run.money -= c;
    b.paid += c;
    if (b.type === 'belt') b.grade++;
    else b.level++;
    g.topologyDirty = true;
    return true;
  },

  moveFee(g, b) { return Grid.baseCost(b.type, { tier: b.tier, grade: b.grade }) * CONFIG.moveFeeRate; },

  // Moves/rotates a building to a new position. Keeps state, charges the move fee.
  move(g, b, nx, ny, nrot, opts = {}) {
    const spec = { type: b.type, x: nx, y: ny, rot: nrot, len: b.len, grade: b.grade };
    const ignore = new Set([b.id]);
    const chk = Grid.canPlace(g, spec, { ignore, ignoreMoney: true, ignoreDep: b.dep, ignoreRadius: opts.ignoreRadius });
    if (!chk.ok) return chk.reason;
    const fee = opts.free ? 0 : Grid.moveFee(g, b);
    if (fee > g.run.money) return 'Zu teuer';
    if (b.type === 'extractor') {
      // Re-evaluate deposit (may switch to another touching deposit).
      Grid.unregister(g, b);
      const deps = Grid.touchingDeposits(g, nx, ny, Grid.size(b.type, nrot).w, Grid.size(b.type, nrot).h).filter(d => Grid.depositFree(g, d) > 0);
      if (!deps.length) { Grid.register(g, b); return 'Kein freies Vorkommen'; }
      deps.sort((a, c) => c.tier - a.tier);
      const d = deps[0];
      if (d.tier !== b.tier) {
        g.run.counts[Grid.countKey('extractor', b.tier)]--;
        g.run.counts[Grid.countKey('extractor', d.tier)] = (g.run.counts[Grid.countKey('extractor', d.tier)] || 0) + 1;
      }
      b.dep = d.id; b.res = d.res; b.tier = d.tier;
    } else {
      Grid.unregister(g, b);
    }
    const s = Grid.size(b.type, nrot, b.len);
    b.x = nx; b.y = ny; b.rot = nrot; b.w = s.w; b.h = s.h;
    Grid.register(g, b);
    g.run.money -= fee;
    return null;
  },

  // Fast rotate in place (free for 1x1, fee otherwise).
  rotate(g, b) {
    if (b.type === 'bridge') return 'Brücken lassen sich nicht drehen';
    const nr = (b.rot + 1) & 3;
    const free = b.w === 1 && b.h === 1;
    return Grid.move(g, b, b.x, b.y, nr, { free, ignoreRadius: true });
  },

  // ---------------- serialisation helpers ----------------
  toSpec(b) {
    const s = { type: b.type, x: b.x, y: b.y, rot: b.rot, level: b.level, paid: b.paid };
    if (b.type === 'belt') s.grade = b.grade;
    if (b.type === 'bridge') s.len = b.len;
    if (b.filter) s.filter = b.filter;
    if (b.type === 'extractor') { s.dep = b.dep; s.res = b.res; s.tier = b.tier; s.outMask = b.outMask; }
    if (b.type === 'silo') { s.outFilter = b.outFilter; s.outEnabled = b.outEnabled; }
    return s;
  }
};

// ---------------------------------------------------------------------
// Undo / redo of build actions
// ---------------------------------------------------------------------
const Actions = {
  push(g, act) {
    g.undo.push(act);
    const lim = g.mods.undoLimit;
    while (g.undo.length > lim) g.undo.shift();
    g.redo.length = 0;
  },
  // Place several specs as one action.
  placeMany(g, specs, opts = {}) {
    const placed = [];
    let spent = 0, fail = null;
    for (const s of specs) {
      const before = g.run.money;
      const b = Grid.place(g, s, opts);
      if (b) { placed.push(b); spent += before - g.run.money; }
      else if (!fail) fail = Grid.canPlace(g, s, opts).reason;
    }
    if (placed.length) Actions.push(g, { kind: 'place', specs: placed.map(b => Object.assign(Grid.toSpec(b), { id: b.id })), paid: placed.map(b => b.paid) });
    return { placed, spent, fail };
  },
  removeMany(g, list) {
    const specs = [];
    let refund = 0;
    for (const b of list) {
      const spec = Object.assign(Grid.toSpec(b), { id: b.id });
      const r = Grid.remove(g, b);
      spec.refund = r;
      refund += r;
      specs.push(spec);
    }
    if (specs.length) Actions.push(g, { kind: 'remove', specs });
    return refund;
  },
  record(g, act) { Actions.push(g, act); },

  apply(g, act, dir) {
    // dir = -1 undo, +1 redo
    if (act.kind === 'place') {
      if (dir < 0) {
        for (const s of act.specs) {
          const b = g.buildings.get(s.id);
          if (b) { Grid.releaseItems(g, b); Grid.unregister(g, b); g.run.money += b.paid; const k = Grid.countKey(b.type, b.tier); g.run.counts[k] = Math.max(0, (g.run.counts[k] || 0) - 1); }
        }
        return null;
      }
      const total = act.specs.reduce((a, s) => a + s.paid, 0);
      if (total > g.run.money) return 'Zu wenig ' + CURRENCY_SHORT + ' für Wiederholen';
      for (const s of act.specs) {
        if (Grid.occTiles(s.type, s.x, s.y, s.rot, s.len).some(t => g.occ.has(U.tileKey(t[0], t[1])))) continue;
        const b = Grid.make(g, s); b.paid = s.paid; Grid.register(g, b); g.run.money -= s.paid;
        const k = Grid.countKey(b.type, b.tier); g.run.counts[k] = (g.run.counts[k] || 0) + 1;
      }
      return null;
    }
    if (act.kind === 'remove') {
      if (dir < 0) {
        const cost = act.specs.reduce((a, s) => a + s.refund, 0);
        if (cost > g.run.money + 1e-9) return 'Zu wenig ' + CURRENCY_SHORT + ' zum Wiederherstellen';
        for (const s of act.specs) {
          if (Grid.occTiles(s.type, s.x, s.y, s.rot, s.len).some(t => g.occ.has(U.tileKey(t[0], t[1])))) continue;
          if (s.type === 'extractor') { const d = World.depositById(g.world, s.dep); if (!d || Grid.depositFree(g, d) <= 0) continue; }
          const b = Grid.make(g, s); Grid.register(g, b); g.run.money -= s.refund;
          const k = Grid.countKey(b.type, b.tier); g.run.counts[k] = (g.run.counts[k] || 0) + 1;
        }
        return null;
      }
      for (const s of act.specs) { const b = g.buildings.get(s.id); if (b) Grid.remove(g, b); }
      return null;
    }
    if (act.kind === 'move') {
      const b = g.buildings.get(act.id);
      if (!b) return 'Gebäude existiert nicht mehr';
      const to = dir < 0 ? act.from : act.to;
      const err = Grid.move(g, b, to.x, to.y, to.rot, { free: true, ignoreRadius: true });
      if (err) return err;
      g.run.money += dir < 0 ? act.fee : -act.fee;
      return null;
    }
    if (act.kind === 'upgrade') {
      const b = g.buildings.get(act.id);
      if (!b) return 'Gebäude existiert nicht mehr';
      if (dir < 0) {
        if (b.type === 'belt') b.grade--; else b.level--;
        g.run.money += act.cost; b.paid -= act.cost;
      } else {
        if (act.cost > g.run.money) return 'Zu teuer';
        if (b.type === 'belt') b.grade++; else b.level++;
        g.run.money -= act.cost; b.paid += act.cost;
      }
      g.topologyDirty = true;
      return null;
    }
    return null;
  },
  undo(g) {
    const act = g.undo.pop();
    if (!act) return 'Nichts rückgängig zu machen';
    const err = Actions.apply(g, act, -1);
    if (err) { g.undo.push(act); return err; }
    g.redo.push(act);
    return null;
  },
  redo(g) {
    const act = g.redo.pop();
    if (!act) return 'Nichts zu wiederholen';
    const err = Actions.apply(g, act, 1);
    if (err) { g.redo.push(act); return err; }
    g.undo.push(act);
    return null;
  }
};
