// =====================================================================
// Bot: headless greedy player used for the balancing report.
// Builds real buildings with the real simulation: extractor lines (optionally
// with refineries) routed by BFS into a hub of silos surrounded by sellers.
// =====================================================================
const Bot = {
  SELLERS: ['bazaar', 'caravan', 'shuttlepad', 'port', 'dock', 'terminal'],
  RESEARCH_PLAN: ['drill1', 'haggle1', 'belt2', 'shelf1', 'traffic1', 'silo2', 'ref2', 'drill2', 'haggle2', 'service', 'patience', 'cooler', 'traffic2', 'servo', 'ref3', 'refSpeed', 'belt3', 'silo3', 'drill3', 'haggle3', 'beltSpeed', 'contracts', 'belt4'],

  create(opts = {}) {
    const meta = opts.meta || Game.createMeta(opts.seed !== undefined ? opts.seed : 1234);
    const g = Game.create(meta, opts.planet || 1);
    const L = CONFIG.landing;
    return {
      g, meta,
      hub: { x: L.x, y: L.y + 3 },
      silos: [], sellers: [], lines: [],
      busyUntil: 0,
      log: [], marks: {},
      exploreR: 20, exploreA: 0, lastScan: -999,
      lab: null,
      opts
    };
  },

  mark(B, key) {
    if (B.marks[key] === undefined) { B.marks[key] = B.g.run.time; B.log.push([Math.round(B.g.run.time), key]); }
  },

  // ---------------- geometry helpers ----------------
  free(g, x, y) { return !g.occ.has(U.tileKey(x, y)); },
  fits(g, type, x, y, rot) {
    return Grid.occTiles(type, x, y, rot).every(t => Bot.free(g, t[0], t[1]) && !Bot.reserved(g, t[0], t[1]));
  },
  reserved(g, x, y) { return false; },
  // BFS over free tiles from start tiles to any tile adjacent to the target building. Returns tile path.
  route(g, starts, target, limit = 30000) {
    const tr = Grid.rect(target);
    const goal = new Map();
    for (const p of Grid.perimeter(target)) goal.set(U.tileKey(p[0], p[1]), (p[2] + 2) & 3); // dir pointing into target
    const minX = Math.min(tr.x, ...starts.map(s => s[0])) - 14, maxX = Math.max(tr.x + tr.w, ...starts.map(s => s[0])) + 14;
    const minY = Math.min(tr.y, ...starts.map(s => s[1])) - 14, maxY = Math.max(tr.y + tr.h, ...starts.map(s => s[1])) + 14;
    const prev = new Map();
    const q = [];
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
        prev.set(nk, k);
        q.push([nx, ny]);
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
    // rectangles a and b share an edge (adjacent, not overlapping)
    const r = Grid.rect(a);
    const ox = Math.min(r.x + r.w, bx + bw) - Math.max(r.x, bx);
    const oy = Math.min(r.y + r.h, by + bh) - Math.max(r.y, by);
    return (ox > 0 && (by + bh === r.y || r.y + r.h === by)) || (oy > 0 && (bx + bw === r.x || r.x + r.w === bx));
  },

  // ---------------- economy estimates ----------------
  sellCapacity(B) {
    const g = B.g;
    let s = 0;
    for (const b of g.lists.seller || []) {
      const t = SELLER_TIER[b.type];
      if (t === 5) { s += g.run.contracts.length ? 12 : 0; continue; }
      const c = CONFIG.customers[t];
      const iv = (c.interval[0] + c.interval[1]) / 2 / Economy.arrivalMult(g, b);
      s += Math.min(Economy.serviceRate(g, b), (c.qty[0] + c.qty[1]) / 2 / iv);
    }
    return s;
  },
  production(B) {
    let s = 0;
    for (const L of B.lines) s += L.rate;
    return s;
  },
  lineRate(g, L) {
    const ex = L.ex;
    let r = ex.rate;
    for (const rf of L.refs) r = Math.min(r, rf.rate);
    const tp = CONFIG.belt.throughput[L.grade] * g.mods.beltSpeed;
    return Math.min(r, tp);
  },
  avgFactor(B) {
    const g = B.g;
    let best = 1;
    for (const b of g.lists.seller || []) best = Math.max(best, CONFIG.customers[SELLER_TIER[b.type]].factor);
    return (1 + best) / 2;
  },

  // ---------------- actions ----------------
  ensureHub(B) {
    const g = B.g;
    if (!B.sellers.length) {
      const b = Grid.place(g, { type: 'bazaar', x: B.hub.x, y: B.hub.y, rot: 0 }, { ignoreRadius: true });
      if (b) { B.sellers.push(b); Bot.mark(B, 'firstBazaar'); return true; }
      return false;
    }
    if (!B.silos.length && g.run.money >= Grid.cost(g, 'silo') + 20) {
      const s = B.sellers[0];
      const spot = Bot.spiralSpot(g, s.x, s.y + s.h, 'silo', 0, (x, y) => Bot.touches(s, x, y, 3, 3), 6);
      if (spot) {
        const b = Grid.place(g, { type: 'silo', x: spot.x, y: spot.y, rot: 0 }, { ignoreRadius: true });
        if (b) { b.outEnabled = false; B.silos.push(b); return true; }
      }
    }
    return false;
  },
  targetFor(B) {
    // the hub silo (or the first seller before a silo exists)
    if (B.silos.length) return B.silos.reduce((a, s) => (s.total / Economy.siloCap(B.g, s)) < (a.total / Economy.siloCap(B.g, a)) ? s : a, B.silos[0]);
    return B.sellers[0];
  },

  // Plans a new extraction line at the best known free deposit.
  planLine(B) {
    const g = B.g;
    const target = Bot.targetFor(B);
    if (!target) return null;
    const hx = target.x + 1, hy = target.y + 1;
    let best = null;
    for (const id of g.world.known) {
      const d = World.depositById(g.world, id);
      if (!d || Grid.depositFree(g, d) <= 0) continue;
      const dist = Math.hypot(d.x - hx, d.y - hy);
      const exCost = Grid.cost(g, 'extractor', { tier: d.tier });
      const beltC = Bot.beltCost(g, Math.ceil(dist * 1.2), B.grade || 0);
      const val = CONFIG.extractRate[d.tier] * DATA.RESOURCES[d.res].value * (B.useRefine && d.tier >= 1 ? 2 : 1);
      const score = val / (exCost + beltC + dist * 0.8);
      if (!best || score > best.score) best = { d, dist, cost: exCost + beltC, val, score };
    }
    return best;
  },
  buildLine(B, plan) {
    const g = B.g;
    const d = plan.d;
    const target = Bot.targetFor(B);
    // extractor spot: try positions touching the deposit, prefer the side towards the hub
    const cands = [];
    for (const t of d.tiles) for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 1; dx++) cands.push([t[0] + dx, t[1] + dy]);
    cands.sort((a, b) => U.dist2(a[0], a[1], target.x, target.y) - U.dist2(b[0], b[1], target.x, target.y));
    const tried = new Set();
    const refine = B.useRefine && d.tier >= 1 && g.run.money > plan.cost + 600;
    for (const c of cands) {
      const k = c[0] + ',' + c[1];
      if (tried.has(k)) continue; tried.add(k);
      const spec = { type: 'extractor', x: c[0], y: c[1], rot: 0 };
      const chk = Grid.canPlace(g, spec, { ignoreRadius: true, ignoreMoney: true });
      if (!chk.ok || chk.dep.id !== d.id) continue;
      // optional refinery adjacent to the extractor
      let src = null, ref = null;
      const exRect = { x: c[0], y: c[1], w: 2, h: 2 };
      if (refine) {
        for (let rot = 0; rot < 4 && !ref; rot++) {
          const offs = [[2, -1], [-3, -1], [-1, 2], [-1, -3], [2, 0], [-3, 0], [0, 2], [0, -3]];
          for (const o of offs) {
            const rx = c[0] + o[0], ry = c[1] + o[1];
            if (!Bot.touches(exRect, rx, ry, 3, 3)) continue;
            const ok = Grid.occTiles('refinery1', rx, ry, rot).every(t => Bot.free(g, t[0], t[1]) && !(t[0] >= c[0] && t[0] < c[0] + 2 && t[1] >= c[1] && t[1] < c[1] + 2));
            if (!ok) continue;
            const pb = { x: rx, y: ry, w: 3, h: 3, rot };
            const port = Grid.frontPort(pb);
            if (port[0] >= c[0] && port[0] < c[0] + 2 && port[1] >= c[1] && port[1] < c[1] + 2) continue;
            if (!Bot.free(g, port[0], port[1])) continue;
            ref = { x: rx, y: ry, rot, port };
            break;
          }
        }
        if (!ref) continue;
      }
      // reserve: temporarily register footprint to route around it
      const ghostIds = [];
      const occupy = (type, x, y, rot) => { const b = Grid.make(g, { type, x, y, rot, id: -100 - ghostIds.length }); Grid.register(g, b); ghostIds.push(b); return b; };
      const exG = occupy('extractor', c[0], c[1], 0);
      let starts;
      if (ref) { occupy('refinery1', ref.x, ref.y, ref.rot); starts = [ref.port]; }
      else starts = Grid.perimeter(exG).map(p => [p[0], p[1]]);
      const r = Bot.route(g, starts, target);
      for (const gb of ghostIds) Grid.unregister(g, gb);
      g.nextId = Math.max(1, ...[...g.buildings.keys()].map(id => id + 1));
      if (!r) continue;
      const belts = Bot.beltSpecs(r.path, r.lastDir, B.grade || 0);
      const total = Grid.cost(g, 'extractor', { tier: d.tier }) + Bot.beltCost(g, belts.length, B.grade || 0) + (ref ? Grid.cost(g, 'refinery1') : 0);
      if (total > g.run.money) return { wait: total };
      const ex = Grid.place(g, spec, { ignoreRadius: true });
      if (!ex) return null;
      let rf = null;
      if (ref) {
        rf = Grid.place(g, { type: 'refinery1', x: ref.x, y: ref.y, rot: ref.rot }, { ignoreRadius: true });
        // extractor outputs only into the refinery
        let mask = 0;
        for (const p of Grid.perimeter(ex)) if (p[0] >= ref.x && p[0] < ref.x + 3 && p[1] >= ref.y && p[1] < ref.y + 3) mask |= 1 << p[2];
        ex.outMask = mask || 15;
        Bot.mark(B, 'firstRefinery');
      }
      Actions.placeMany(g, belts, { ignoreRadius: true });
      const L = { ex, refs: rf ? [rf] : [], grade: B.grade || 0, belts: belts.length, rate: 0, tier: d.tier, dist: plan.dist };
      g.topologyDirty = true; Game.recompute(g);
      L.rate = Bot.lineRate(g, L);
      B.lines.push(L);
      Bot.mark(B, 'firstExtractor');
      B.busyUntil = g.run.time + 6 + plan.dist * 2 / g.mods.walk;
      return { ok: true };
    }
    return null;
  },
  addSeller(B) {
    const g = B.g;
    const tier = Math.min(g.run.custTier, 4);
    // choose the best affordable seller tier (higher tiers are much more valuable)
    for (let t = tier; t >= 0; t--) {
      const type = Bot.SELLERS[t];
      const cost = Grid.cost(g, type);
      if (cost > g.run.money) continue;
      for (const s of B.silos) {
        const sz = Grid.size(type, 0);
        const spot = Bot.spiralSpot(g, s.x - sz.w, s.y - sz.h, type, 0, (x, y) => Bot.touches(s, x, y, sz.w, sz.h), 12);
        if (spot) {
          const b = Grid.place(g, { type, x: spot.x, y: spot.y, rot: 0 }, { ignoreRadius: true });
          if (b) { B.sellers.push(b); B.busyUntil = g.run.time + 5; return true; }
        }
      }
      // no room around silos: place a new silo next to the hub and try again later
      if (B.silos.length && g.run.money > Grid.cost(g, 'silo') + cost) {
        const last = B.silos[B.silos.length - 1];
        const spot = Bot.spiralSpot(g, last.x, last.y + 12, 'silo', 0, null, 30);
        if (spot) { const b = Grid.place(g, { type: 'silo', x: spot.x, y: spot.y, rot: 0 }, { ignoreRadius: true }); if (b) { b.outEnabled = false; B.silos.push(b); return true; } }
      }
      return false;
    }
    return false;
  },
  terminal(B) {
    const g = B.g;
    if (g.run.custTier < 5 || (g.lists.terminal || []).length) return false;
    const cost = Grid.cost(g, 'terminal');
    if (cost > g.run.money * 0.6) return false;
    for (const s of B.silos) {
      const spot = Bot.spiralSpot(g, s.x - 7, s.y - 7, 'terminal', 0, (x, y) => Bot.touches(s, x, y, 7, 7), 14);
      if (spot) { const b = Grid.place(g, { type: 'terminal', x: spot.x, y: spot.y, rot: 0 }, { ignoreRadius: true }); if (b) { B.sellers.push(b); return true; } }
    }
    return false;
  },
  research(B) {
    const g = B.g;
    if (!B.lab) {
      if (g.run.money < 2500 || g.run.earned < 4000) return false;
      const spot = Bot.spiralSpot(g, B.hub.x - 10, B.hub.y - 10, 'lab', 0, null, 30);
      if (!spot) return false;
      B.lab = Grid.place(g, { type: 'lab', x: spot.x, y: spot.y, rot: 0 }, { ignoreRadius: true });
      return !!B.lab;
    }
    if (g.run.research.active) return false;
    for (const id of Bot.RESEARCH_PLAN) {
      const r = DATA.RESEARCH_BY_ID[id];
      if (Progression.researchState(g, r) !== 'available') continue;
      if (Progression.researchCost(g, r) > g.run.money * 0.5) return false;
      if (!Progression.startResearch(g, id)) { if (id === 'ref2' || id === 'ref3') B.useRefine = true; return true; }
      return false;
    }
    return false;
  },
  upgrades(B) {
    const g = B.g;
    // cheapest beneficial upgrade among extractors (when selling is not the bottleneck), refineries and sellers
    let best = null;
    const prod = Bot.production(B), cap = Bot.sellCapacity(B);
    const sellBound = prod > cap * 0.9;
    const cand = [];
    if (!sellBound) for (const L of B.lines) {
      const ex = L.ex;
      if (Grid.upgradeBlock(g, ex)) continue;
      const bottleneck = L.refs.length && L.refs.some(r => r.rate < ex.rate * 1.02) ? L.refs.reduce((a, r) => r.rate < a.rate ? r : a, L.refs[0]) : ex;
      if (Grid.upgradeBlock(g, bottleneck)) continue;
      const c = Grid.upgradeCost(g, bottleneck);
      const gain = L.rate * 0.3 * DATA.RESOURCES[ex.res].value * (L.refs.length ? 2 : 1);
      cand.push({ b: bottleneck, c, score: gain / c });
    }
    if (sellBound) for (const s of B.sellers) {
      if (Grid.upgradeBlock(g, s)) continue;
      const c = Grid.upgradeCost(g, s);
      cand.push({ b: s, c, score: 1 / c });
    }
    for (const c of cand) if (c.c <= g.run.money && (!best || c.score > best.score)) best = c;
    if (best) { Grid.upgrade(g, best.b); g.topologyDirty = true; B.busyUntil = g.run.time + 3; return true; }
    return false;
  },
  explore(B) {
    const g = B.g;
    if (g.run.time - B.lastScan < 25) return;
    B.lastScan = g.run.time;
    // walk a widening spiral around the hub and scan
    B.exploreA += 1.1;
    B.exploreR = Math.min(600, B.exploreR + 6);
    const x = B.hub.x + Math.cos(B.exploreA) * B.exploreR, y = B.hub.y + Math.sin(B.exploreA) * B.exploreR;
    World.discover(g.world, x, y, g.mods.scanRadius);
    World.reveal(g.world, x, y, g.mods.scanRadius);
  },

  decide(B) {
    const g = B.g;
    if (g.run.time < B.busyUntil) return;
    if (g.run.time < 8) return; // landing, looking around
    if (Bot.ensureHub(B)) return;
    for (const L of B.lines) L.rate = Bot.lineRate(g, L);
    Bot.explore(B);
    if (Bot.research(B)) return;
    if (Bot.terminal(B)) return;
    const prod = Bot.production(B), cap = Bot.sellCapacity(B);
    if (!B.lines.length || prod < cap * 0.8) {
      const plan = Bot.planLine(B);
      if (plan) {
        if (plan.cost <= g.run.money) { const r = Bot.buildLine(B, plan); if (r && r.ok) return; }
        else if (B.lines.length) { if (Bot.upgrades(B)) return; }
        return;
      }
    } else {
      if (Bot.addSeller(B)) return;
    }
    Bot.upgrades(B);
  },

  // Generator: yields progress snapshots, returns the final report.
  *runIter(opts = {}) {
    const B = Bot.create(opts);
    const g = B.g;
    const maxT = (opts.maxHours || 6) * 3600;
    const th = Progression.threshold(g.run.planet);
    let lastHour = 0;
    const hourly = [];
    let lastEarned = 0;
    while (g.run.time < maxT) {
      for (let i = 0; i < CONFIG.tickRate; i++) Game.tick(g);
      g.events.length = 0;
      if ((g.tick / CONFIG.tickRate) % 2 === 0) Bot.decide(B);
      if (g.run.earned > 0) Bot.mark(B, 'firstSale');
      for (let t = 1; t <= g.run.custTier; t++) Bot.mark(B, 'tier' + (t + 1));
      if (g.run.earned >= th) { Bot.mark(B, 'rebirth'); if (!opts.continueAfterRebirth) break; }
      if (g.run.time - lastHour >= 3600) { lastHour += 3600; hourly.push(g.run.earned - lastEarned); lastEarned = g.run.earned; }
      if (g.tick % (CONFIG.tickRate * 60) === 0) yield { time: g.run.time, earned: g.run.earned };
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
