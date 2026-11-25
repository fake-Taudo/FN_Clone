// =====================================================================
// Bot: headless greedy player used for the balancing report.
// It plays the real simulation: builds extractor lines (optionally with a
// refinery chain) routed by BFS into a hub of silos surrounded by sellers,
// and always buys the action with the best revenue gain per cost.
// =====================================================================
const Bot = {
  SELLERS: ['bazaar', 'caravan', 'shuttlepad', 'port', 'dock', 'terminal'],
  REF_TYPES: ['refinery1', 'refinery2', 'refinery3'],
  RESEARCH_PLAN: ['drill1', 'haggle1', 'traffic1', 'shelf1', 'belt2', 'ref2', 'silo2', 'patience', 'drill2', 'haggle2', 'service', 'traffic2', 'cooler', 'ref3', 'refSpeed', 'belt3', 'servo', 'marketing', 'drill3', 'silo3', 'haggle3', 'beltSpeed', 'contracts', 'belt4'],

  HUMAN_DELAY: 20, // seconds a human needs per build decision (menus, aiming, checking)
  create(opts = {}) {
    const seed = opts.seed !== undefined ? opts.seed : 1234;
    const meta = opts.meta || Game.createMeta(seed);
    const g = Game.create(meta, opts.planet || 1);
    g.rnd = RNG.mulberry32(RNG.hash(seed, 77));
    const L = CONFIG.landing;
    return { g, meta, hub: { x: L.x, y: L.y + 3 }, silos: [], sellers: [], lines: [], badDeps: new Set(), busyUntil: 0, log: [], marks: {}, exploreR: 20, exploreA: 0, lastScan: -999, lab: null, opts };
  },
  mark(B, key) { if (B.marks[key] === undefined) { B.marks[key] = B.g.run.time; B.log.push([Math.round(B.g.run.time), key]); } },

  // ---------------- geometry ----------------
  free(g, x, y) { return !g.occ.has(U.tileKey(x, y)); },
  fits(g, type, x, y, rot) { return Grid.occTiles(type, x, y, rot).every(t => Bot.free(g, t[0], t[1])); },
  route(g, starts, target, limit = 150000) {
    const tr = Grid.rect(target);
    const goal = new Map();
    for (const p of Grid.perimeter(target)) goal.set(U.tileKey(p[0], p[1]), (p[2] + 2) & 3);
    const minX = Math.min(tr.x, ...starts.map(s => s[0])) - 24, maxX = Math.max(tr.x + tr.w, ...starts.map(s => s[0])) + 24;
    const minY = Math.min(tr.y, ...starts.map(s => s[1])) - 24, maxY = Math.max(tr.y + tr.h, ...starts.map(s => s[1])) + 24;
    const prev = new Map(), q = [];
    for (const s of starts) { const k = U.tileKey(s[0], s[1]); if (!Bot.free(g, s[0], s[1]) || prev.has(k)) continue; prev.set(k, -1); q.push(s); }
    for (let qi = 0; qi < q.length && qi < limit; qi++) {
      const [x, y] = q[qi];
      const k = U.tileKey(x, y);
      if (goal.has(k)) {
        const path = [];
        let cur = k;
        while (cur !== -1) { path.push([U.keyX(cur), U.keyY(cur)]); cur = prev.get(cur); }
        path.reverse();
        return { path, lastDir: goal.get(k) };
      }
      for (let d = 0; d < 4; d++) {
        const nx = x + U.DX[d], ny = y + U.DY[d];
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
        const nk = U.tileKey(nx, ny);
        if (prev.has(nk) || !Bot.free(g, nx, ny)) continue;
        prev.set(nk, k); q.push([nx, ny]);
      }
    }
    return null;
  },
  beltSpecs(path, lastDir, grade) {
    return path.map((p, i) => {
      let rot = lastDir;
      if (i < path.length - 1) { const dx = path[i + 1][0] - p[0], dy = path[i + 1][1] - p[1]; rot = dx > 0 ? 0 : dx < 0 ? 2 : dy > 0 ? 1 : 3; }
      return { type: 'belt', x: p[0], y: p[1], rot, grade };
    });
  },
  beltCost(g, n, grade) {
    let c = 0; const base = DATA.BELT_GRADES[grade].cost; const n0 = g.run.counts.belt || 0;
    for (let i = 0; i < n; i++) c += base * Math.pow(CONFIG.beltCostGrowth, n0 + i);
    return c;
  },
  spiralSpot(g, cx, cy, type, rot, pred, maxR = 40) {
    for (let r = 0; r <= maxR; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy;
      if (Bot.fits(g, type, x, y, rot) && (!pred || pred(x, y))) return { x, y };
    }
    return null;
  },
  touches(a, bx, by, bw, bh) {
    const r = Grid.rect(a);
    const ox = Math.min(r.x + r.w, bx + bw) - Math.max(r.x, bx);
    const oy = Math.min(r.y + r.h, by + bh) - Math.max(r.y, by);
    return (ox > 0 && (by + bh === r.y || r.y + r.h === by)) || (oy > 0 && (bx + bw === r.x || r.x + r.w === bx));
  },
  inRect(x, y, r) { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; },

  // ---------------- economic model ----------------
  sellerCapOf(g, type, level, b) {
    const t = SELLER_TIER[type];
    if (t === 5) return 0;
    const c = CONFIG.customers[t];
    const am = b ? Economy.arrivalMult(g, b) : g.mods.arrival * Math.pow(1.1, level - 1);
    const iv = (c.interval[0] + c.interval[1]) / 2 / am;
    const svc = CONFIG.serviceRate[t] * Math.pow(1.3, level - 1) * g.mods.service * 1.2;
    return Math.min(svc, (c.qty[0] + c.qty[1]) / 2 / iv) * 0.9;
  },
  model(B) {
    const g = B.g;
    let P = 0, V = 0, C = 0, CF = 0;
    for (const L of B.lines) { P += L.rate; V += L.rate * L.val; }
    for (const b of B.sellers) { const c = Bot.sellerCapOf(g, b.type, b.level, b); C += c; CF += c * CONFIG.customers[SELLER_TIER[b.type]].factor; }
    return { P, V, C, F: C > 0 ? CF / C : 1 };
  },
  revenue(m) { return m.P <= 0 ? 0 : Math.min(1, m.C / m.P) * m.V * m.F; },
  refRate(g, k, level = 1) { return CONFIG.refineRate[k] * Math.pow(1.25, level - 1) * g.mods.refine; },
  lineRate(g, L) {
    let r = L.ex.rate;
    for (const rf of L.refs) r = Math.min(r, rf.rate);
    const grade = L.beltIds.length ? Math.min(...L.beltIds.map(id => { const b = g.buildings.get(id); return b ? b.grade : 3; })) : 3;
    return Math.min(r, CONFIG.belt.throughput[grade] * g.mods.beltSpeed);
  },
  maxRefine(g) { return g.run.research.done.has('ref3') ? 3 : g.run.research.done.has('ref2') ? 2 : 1; },

  // ---------------- hub ----------------
  ensureHub(B) {
    const g = B.g;
    if (!B.sellers.length) {
      const b = Grid.place(g, { type: 'bazaar', x: B.hub.x, y: B.hub.y, rot: 0 }, { ignoreRadius: true });
      if (b) { B.sellers.push(b); Bot.mark(B, 'firstBazaar'); return true; }
      return false;
    }
    if (!B.silos.length) {
      if (g.run.money < Grid.cost(g, 'silo')) return B.lines.length > 0; // save up for the hub silo
      const s = B.sellers[0];
      const spot = Bot.spiralSpot(g, s.x, s.y + s.h, 'silo', 0, (x, y) => Bot.touches(s, x, y, 3, 3), 6);
      if (spot) { const b = Grid.place(g, { type: 'silo', x: spot.x, y: spot.y, rot: 0 }, { ignoreRadius: true }); if (b) { b.outEnabled = false; B.silos.push(b); return true; } }
    }
    return false;
  },
  targetFor(B) {
    if (B.silos.length) return B.silos.reduce((a, s) => (s.total / Economy.siloCap(B.g, s)) < (a.total / Economy.siloCap(B.g, a)) ? s : a, B.silos[0]);
    return B.sellers[0];
  },

  // ---------------- candidates ----------------
  bestDeposit(B, budget = Infinity) {
    const g = B.g;
    const target = Bot.targetFor(B);
    if (!target) return null;
    let best = null;
    const k = Bot.maxRefine(g);
    for (const id of g.world.known) {
      if (B.badDeps.has(id)) continue;
      const d = World.depositById(g.world, id);
      if (!d || Grid.depositFree(g, d) <= 0) continue;
      const dist = Math.hypot(d.x - target.x, d.y - target.y);
      const val = DATA.RESOURCES[d.res].value * CONFIG.refineFactor[k];
      const cost = Grid.cost(g, 'extractor', { tier: d.tier }) + Bot.beltCost(g, Math.ceil(dist * 1.1), 0);
      if (cost > budget) continue;
      const score = Math.min(CONFIG.extractRate[d.tier], 0.5) * val / (cost + dist * 2);
      if (!best || score > best.score) best = { d, dist, score };
    }
    return best;
  },
  candidates(B) {
    const g = B.g;
    const m = Bot.model(B);
    const R0 = Bot.revenue(m);
    const out = [];
    const add = (cost, m2, act, label) => { const gain = Bot.revenue(m2) - R0; if (gain > 1e-9 && isFinite(cost)) out.push({ cost, gain, ratio: gain / cost, act, label }); };
    // new lines: evaluate every known free deposit with every refine depth, keep the best few
    if (B.silos.length || !B.lines.length) {
      const target = Bot.targetFor(B);
      const lineCands = [];
      const maxK = B.silos.length ? Bot.maxRefine(g) : 0;
      for (const id of g.world.known) {
        if (B.badDeps.has(id)) continue;
        const d = World.depositById(g.world, id);
        if (!d || Grid.depositFree(g, d) <= 0) continue;
        const dist = Math.hypot(d.x - target.x, d.y - target.y);
        const exRate = CONFIG.extractRate[d.tier] * g.mods.extract;
        const baseCost = Grid.cost(g, 'extractor', { tier: d.tier }) + Bot.beltCost(g, Math.ceil(dist * 1.3), 0) + dist * 1.5;
        for (let k = 0; k <= maxK; k++) {
          let rate = Math.min(exRate, CONFIG.belt.throughput[0] * g.mods.beltSpeed), cost = baseCost;
          for (let j = 0; j < k; j++) { rate = Math.min(rate, Bot.refRate(g, j)); cost += Grid.cost(g, Bot.REF_TYPES[j]); }
          const val = DATA.RESOURCES[d.res].value * CONFIG.refineFactor[k];
          const gain = Bot.revenue({ P: m.P + rate, V: m.V + rate * val, C: m.C, F: m.F }) - R0;
          if (gain > 0) lineCands.push({ d, k, cost, gain });
        }
      }
      lineCands.sort((a, b) => b.gain / b.cost - a.gain / a.cost);
      for (const lc of lineCands.slice(0, 3)) out.push({ cost: lc.cost, gain: lc.gain, ratio: lc.gain / lc.cost, act: () => Bot.buildLine(B, lc.d, lc.k), label: 'line' + lc.k });
    }
    // upgrade the bottleneck of a line
    for (const L of B.lines) {
      const comps = [{ b: L.ex, r: L.ex.rate }].concat(L.refs.map(rf => ({ b: rf, r: rf.rate })));
      const grade = Math.min(...L.beltIds.map(id => (g.buildings.get(id) || { grade: 3 }).grade));
      const beltR = CONFIG.belt.throughput[grade] * g.mods.beltSpeed;
      comps.sort((a, c) => a.r - c.r);
      const lo = comps[0];
      if (beltR < lo.r * 0.999) {
        const next = DATA.BELT_GRADES[grade + 1];
        if (!next || (next.research && !g.run.research.done.has(next.research))) continue;
        const n = L.beltIds.length;
        const cost = n * (next.cost - DATA.BELT_GRADES[grade].cost * 0.5);
        const nr = Math.min(lo.r, CONFIG.belt.throughput[grade + 1] * g.mods.beltSpeed);
        add(cost, { P: m.P - L.rate + nr, V: m.V + (nr - L.rate) * L.val, C: m.C, F: m.F }, () => Bot.upgradeBelts(B, L), 'belts');
        continue;
      }
      if (Grid.upgradeBlock(g, lo.b)) continue;
      const cost = Grid.upgradeCost(g, lo.b);
      const mult = lo.b.type === 'extractor' ? CONFIG.extractorLevelSpeed : 1.25;
      const second = comps.length > 1 ? comps[1].r : Infinity;
      const nr = Math.min(lo.r * mult, second, beltR);
      add(cost, { P: m.P - L.rate + nr, V: m.V + (nr - L.rate) * L.val, C: m.C, F: m.F }, () => { Grid.upgrade(g, lo.b); g.topologyDirty = true; }, 'up-' + lo.b.type);
    }
    // sellers
    if (B.silos.length) {
      for (let t = Math.min(4, g.run.custTier); t >= Math.max(0, g.run.custTier - 2); t--) {
        const type = Bot.SELLERS[t];
        const n = g.run.counts[type] || 0, k = CONFIG.crowding[t] || 0;
        const base = Bot.sellerCapOf(g, type, 1, null);
        const c = (n + 1) * base / (1 + k * n) - (n > 0 ? n * base / (1 + k * (n - 1)) : 0);
        const f = CONFIG.customers[t].factor;
        const C2 = m.C + c;
        add(Grid.cost(g, type), { P: m.P, V: m.V, C: C2, F: (m.F * m.C + f * c) / C2 }, () => Bot.addSeller(B, type), 'seller' + t);
      }
      for (const s of B.sellers) {
        if (SELLER_TIER[s.type] === 5 || Grid.upgradeBlock(g, s)) continue;
        const c0 = Bot.sellerCapOf(g, s.type, s.level, s), c1 = c0 * 1.1;
        add(Grid.upgradeCost(g, s), { P: m.P, V: m.V, C: m.C + c1 - c0, F: m.F }, () => { Grid.upgrade(g, s); }, 'up-seller');
      }
    }
    return { out, m, R0 };
  },

  // ---------------- actions ----------------
  buildLine(B, d, k) {
    const g = B.g;
    const target = Bot.targetFor(B);
    const cands = [];
    for (const t of d.tiles) for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 1; dx++) cands.push([t[0] + dx, t[1] + dy]);
    cands.sort((a, b) => U.dist2(a[0], a[1], target.x, target.y) - U.dist2(b[0], b[1], target.x, target.y));
    const tried = new Set();
    let attempts = 0;
    for (const c of cands) {
      const key = c[0] + ',' + c[1];
      if (tried.has(key)) continue; tried.add(key);
      const spec = { type: 'extractor', x: c[0], y: c[1], rot: 0 };
      const chk = Grid.canPlace(g, spec, { ignoreRadius: true, ignoreMoney: true });
      if (!chk.ok || chk.dep.id !== d.id) continue;
      if (++attempts > 6) break;
      const ghosts = [];
      const occupy = (type, x, y, rot) => { const b = Grid.make(g, { type, x, y, rot, id: -100 - ghosts.length }); Grid.register(g, b); ghosts.push(b); return b; };
      const cleanup = () => { for (const gb of ghosts) Grid.unregister(g, gb); g.nextId = 1; for (const id of g.buildings.keys()) if (id >= g.nextId) g.nextId = id + 1; };
      const exG = occupy('extractor', c[0], c[1], 0);
      // refinery chain
      const chain = [];
      let prevRect = { x: c[0], y: c[1], w: 2, h: 2 }, prevPort = null, ok = true;
      for (let j = 0; j < k && ok; j++) {
        let found = null;
        const positions = [];
        if (j === 0) { for (let oy = -3; oy <= 2; oy++) for (let ox = -3; ox <= 2; ox++) positions.push([c[0] + ox, c[1] + oy]); }
        else { for (let oy = -2; oy <= 0; oy++) for (let ox = -2; ox <= 0; ox++) positions.push([prevPort[0] + ox, prevPort[1] + oy]); }
        positions.sort((a, b) => U.dist2(a[0], a[1], target.x, target.y) - U.dist2(b[0], b[1], target.x, target.y));
        for (const p of positions) {
          for (let rot = 0; rot < 4 && !found; rot++) {
            if (!Bot.fits(g, 'refinery1', p[0], p[1], rot)) continue;
            const rect = { x: p[0], y: p[1], w: 3, h: 3 };
            if (j === 0 && !Bot.touches(exG, p[0], p[1], 3, 3)) continue;
            if (j > 0 && !Bot.inRect(prevPort[0], prevPort[1], rect)) continue;
            const port = Grid.frontPort({ x: p[0], y: p[1], w: 3, h: 3, rot });
            if (!Bot.free(g, port[0], port[1]) || Bot.inRect(port[0], port[1], prevRect)) continue;
            found = { x: p[0], y: p[1], rot, port, rect };
          }
          if (found) break;
        }
        if (!found) { ok = false; break; }
        occupy('refinery1', found.x, found.y, found.rot);
        chain.push(found); prevRect = found.rect; prevPort = found.port;
      }
      if (!ok) { cleanup(); continue; }
      const starts = chain.length ? [prevPort] : Grid.perimeter(exG).map(p => [p[0], p[1]]);
      const r = Bot.route(g, starts, target);
      cleanup();
      if (!r) continue;
      const belts = Bot.beltSpecs(r.path, r.lastDir, 0);
      const total = Grid.cost(g, 'extractor', { tier: d.tier }) + Bot.beltCost(g, belts.length, 0) + chain.reduce((a, ch, j) => a + Grid.cost(g, Bot.REF_TYPES[j]), 0);
      if (total > g.run.money) return { wait: total };
      const ex = Grid.place(g, spec, { ignoreRadius: true });
      if (!ex) return null;
      const refs = chain.map((ch, j) => Grid.place(g, { type: Bot.REF_TYPES[j], x: ch.x, y: ch.y, rot: ch.rot }, { ignoreRadius: true, ignoreMoney: true }));
      if (refs.length) {
        let mask = 0;
        for (const p of Grid.perimeter(ex)) if (Bot.inRect(p[0], p[1], chain[0].rect)) mask |= 1 << p[2];
        ex.outMask = mask || 15;
        Bot.mark(B, 'firstRefinery');
      }
      const res = Actions.placeMany(g, belts, { ignoreRadius: true });
      g.topologyDirty = true; Game.recompute(g);
      const L = { ex, refs, beltIds: res.placed.map(b => b.id), rate: 0, val: DATA.RESOURCES[d.res].value * CONFIG.refineFactor[refs.length], res: d.res };
      L.rate = Bot.lineRate(g, L);
      B.lines.push(L);
      Bot.mark(B, 'firstExtractor');
      B.busyUntil = g.run.time + Bot.HUMAN_DELAY * 2 + Math.hypot(d.x - B.hub.x, d.y - B.hub.y) * 2 / g.mods.walk + belts.length * 0.3;
      return { ok: true };
    }
    B.badDeps.add(d.id);
    return null;
  },
  upgradeBelts(B, L) {
    const g = B.g;
    for (const id of L.beltIds) { const b = g.buildings.get(id); if (b) Grid.upgrade(g, b); }
    g.topologyDirty = true;
  },
  addSeller(B, type) {
    const g = B.g;
    const sz = Grid.size(type, 0);
    for (const s of B.silos) {
      const spot = Bot.spiralSpot(g, s.x - sz.w, s.y - sz.h, type, 0, (x, y) => Bot.touches(s, x, y, sz.w, sz.h), 12);
      if (spot) {
        const b = Grid.place(g, { type, x: spot.x, y: spot.y, rot: 0 }, { ignoreRadius: true });
        if (b) {
          B.sellers.push(b);
          if (type === 'bazaar') Bot.layPath(B, b);
          return true;
        }
      }
    }
    // no room left: open a new hub silo next to the existing hub
    const last = B.silos[B.silos.length - 1];
    if (g.run.money >= Grid.cost(g, 'silo')) {
      const spot = Bot.spiralSpot(g, last.x + 14, last.y, 'silo', 0, null, 30);
      if (spot) { const b = Grid.place(g, { type: 'silo', x: spot.x, y: spot.y, rot: 0 }, { ignoreRadius: true }); if (b) { b.outEnabled = false; B.silos.push(b); } }
    }
    return false;
  },
  layPath(B, b) {
    const g = B.g;
    const specs = [];
    for (let d = 0; d < 4 && specs.length < 8; d++) {
      let x = b.x + (d === 0 ? b.w : d === 2 ? -1 : 1), y = b.y + (d === 1 ? b.h : d === 3 ? -1 : 0);
      for (let i = 0; i < 8 && specs.length < 8; i++) {
        if (!Bot.free(g, x, y)) break;
        specs.push({ type: 'path', x, y, rot: 0 });
        x += U.DX[d]; y += U.DY[d];
      }
    }
    if (specs.length) Actions.placeMany(g, specs, { ignoreRadius: true });
  },
  terminal(B) {
    const g = B.g;
    if (g.run.custTier < 5 || (g.lists.terminal || []).length) return false;
    const cost = Grid.cost(g, 'terminal');
    if (cost > g.run.money * 0.7) return false;
    for (const s of B.silos) {
      const spot = Bot.spiralSpot(g, s.x - 7, s.y - 7, 'terminal', 0, (x, y) => Bot.touches(s, x, y, 7, 7), 16);
      if (spot) { const b = Grid.place(g, { type: 'terminal', x: spot.x, y: spot.y, rot: 0 }, { ignoreRadius: true }); if (b) { B.sellers.push(b); return true; } }
    }
    return false;
  },
  research(B) {
    const g = B.g;
    if (!B.lab) {
      if (g.run.earned < 3000 || g.run.money < Grid.cost(g, 'lab') + 300) return false;
      const spot = Bot.spiralSpot(g, B.hub.x - 12, B.hub.y - 10, 'lab', 0, null, 30);
      if (!spot) return false;
      B.lab = Grid.place(g, { type: 'lab', x: spot.x, y: spot.y, rot: 0 }, { ignoreRadius: true });
      return !!B.lab;
    }
    if (g.run.research.active) return false;
    for (const id of Bot.RESEARCH_PLAN) {
      const r = DATA.RESEARCH_BY_ID[id];
      if (Progression.researchState(g, r) !== 'available') continue;
      if (Progression.researchCost(g, r) > g.run.money * 0.4) return false;
      return !Progression.startResearch(g, id);
    }
    return false;
  },
  explore(B) {
    const g = B.g;
    if (g.run.time - B.lastScan < 30) return;
    B.lastScan = g.run.time;
    B.exploreA += 1.1;
    B.exploreR = Math.min(400, B.exploreR + 4);
    const x = B.hub.x + Math.cos(B.exploreA) * B.exploreR, y = B.hub.y + Math.sin(B.exploreA) * B.exploreR;
    World.discover(g.world, x, y, g.mods.scanRadius);
    World.reveal(g.world, x, y, g.mods.scanRadius);
  },

  decide(B) {
    const g = B.g;
    if (g.run.time < B.busyUntil || g.run.time < 8) return;
    for (const L of B.lines) { L.rate = Bot.lineRate(g, L); }
    if (Bot.ensureHub(B)) return;
    Bot.explore(B);
    if (Bot.research(B)) { B.busyUntil = g.run.time + 4; return; }
    if (Bot.terminal(B)) return;
    if (!B.lines.length) {
      const dep = Bot.bestDeposit(B, g.run.money);
      if (dep) Bot.buildLine(B, dep.d, 0);
      return;
    }
    if (!B.silos.length) return;
    const { out, R0 } = Bot.candidates(B);
    if (!out.length) return;
    out.sort((a, b) => b.ratio - a.ratio);
    const best = out[0];
    const income = Math.max(0.1, R0 * g.mods.sales);
    let pick = null;
    if (best.cost <= g.run.money) pick = best;
    else if ((best.cost - g.run.money) / income > 300) pick = out.find(o => o.cost <= g.run.money);
    if (!pick) return;
    const r = pick.act();
    if (pick.label.startsWith('line') && !(r && r.ok)) return;
    B.busyUntil = Math.max(B.busyUntil, g.run.time + Bot.HUMAN_DELAY);
  },

  *runIter(opts = {}) {
    const B = Bot.create(opts);
    const g = B.g;
    const maxT = (opts.maxHours || 6) * 3600;
    const th = Progression.threshold(g.run.planet);
    let lastHour = 0, lastEarned = 0;
    const hourly = [];
    while (g.run.time < maxT) {
      for (let i = 0; i < CONFIG.tickRate; i++) Game.tick(g);
      g.events.length = 0;
      if ((g.tick / CONFIG.tickRate) % 2 === 0) Bot.decide(B);
      if (g.run.earned > 0) Bot.mark(B, 'firstSale');
      for (let t = 1; t <= g.run.custTier; t++) Bot.mark(B, 'tier' + (t + 1));
      if (g.run.earned >= th) { Bot.mark(B, 'rebirth'); if (!opts.continueAfterRebirth) break; }
      if (g.run.time - lastHour >= 3600) { lastHour += 3600; hourly.push(g.run.earned - lastEarned); lastEarned = g.run.earned; }
      if (g.tick % (CONFIG.tickRate * 60) === 0) {
        if (opts.trace && g.tick % (CONFIG.tickRate * 600) === 0) {
          const sellers = {}; for (const b of g.lists.seller) sellers[b.type] = (sellers[b.type] || 0) + 1;
          const m = Bot.model(B);
          opts.trace(Fmt.time(g.run.time) + ' earned ' + Fmt.num(g.run.earned) + ' inc ' + Fmt.num(g.income) + '/s money ' + Fmt.num(g.run.money) + ' lines ' + B.lines.length + ' P ' + Fmt.num(m.P) + ' C ' + Fmt.num(m.C) + ' F ' + Fmt.num(m.F) + ' tier ' + (g.run.custTier + 1) + ' ' + JSON.stringify(sellers) + ' ref ' + (g.lists.refinery || []).length + ' res ' + g.run.research.done.size + ' b ' + g.buildings.size);
        }
        yield { time: g.run.time, earned: g.run.earned };
      }
    }
    return { marks: B.marks, log: B.log, hourly, time: g.run.time, earned: g.run.earned, buildings: g.buildings.size, lines: B.lines.length, sellers: B.sellers.length, planet: g.run.planet, game: g, bot: B };
  },
  run(opts) { const it = Bot.runIter(opts); let r = it.next(); while (!r.done) r = it.next(); return r.value; },
  format(rep) {
    const m = rep.marks;
    const f = k => m[k] !== undefined ? Fmt.time(m[k]) : '–';
    return [
      'Balancing-Report (Planet ' + rep.planet + ', greedy Bot)',
      'Erster Extraktor:      ' + f('firstExtractor'),
      'Erster Verkauf:        ' + f('firstSale'),
      'Erste Raffinerie:      ' + f('firstRefinery'),
      'Kundenstufe 2:         ' + f('tier2'),
      'Kundenstufe 3:         ' + f('tier3'),
      'Kundenstufe 4:         ' + f('tier4'),
      'Kundenstufe 5:         ' + f('tier5'),
      'Kundenstufe 6:         ' + f('tier6'),
      'Rebirth möglich:       ' + f('rebirth'),
      'Erlös gesamt:          ' + Fmt.money(rep.earned) + ' in ' + Fmt.time(rep.time),
      'Erlös pro Stunde:      ' + rep.hourly.map(v => Fmt.num(v)).join(' / '),
      'Gebäude ' + rep.buildings + ', Linien ' + rep.lines + ', Verkaufsgebäude ' + rep.sellers
    ].join('\n');
  }
};
