// =====================================================================
// Offline: expected-value simulation in coarse steps (no randomness, average prices)
// =====================================================================
const Offline = {
  // Follows an output into the transport network; returns [{node, frac, path:[transport nodes]}].
  trace(g, tx, ty, dir, visited, depth = 0) {
    if (depth > 4000) return [];
    const b = Grid.at(g, tx, ty);
    if (!b) return [];
    const key = b.id * 4 + dir;
    if (visited.has(key)) return [];
    visited.add(key);
    const cont = (nb, nx, ny, nd) => Offline.trace(g, nx, ny, nd, visited, depth + 1).map(r => ({ node: r.node, frac: r.frac, path: [nb].concat(r.path) }));
    switch (b.type) {
      case 'belt':
        if (dir === ((b.rot + 2) & 3)) return [];
        return cont(b, b.x + U.DX[b.rot], b.y + U.DY[b.rot], b.rot);
      case 'merger':
        if (dir === ((b.rot + 2) & 3)) return [];
        return cont(b, b.x + U.DX[b.rot], b.y + U.DY[b.rot], b.rot);
      case 'crossing':
        return cont(b, b.x + U.DX[dir], b.y + U.DY[dir], dir);
      case 'bridge':
        if (dir !== b.rot || tx !== b.x || ty !== b.y) return [];
        return cont(b, b.x + U.DX[b.rot] * b.len, b.y + U.DY[b.rot] * b.len, b.rot);
      case 'splitter': case 'fsplitter': case 'osplitter': {
        if (dir !== b.rot) return [];
        const outs = [b.rot, (b.rot + 3) & 3, (b.rot + 1) & 3].map(d => cont(b, b.x + U.DX[d], b.y + U.DY[d], d)).filter(r => r.length);
        if (!outs.length) return [];
        if (b.type === 'osplitter') return outs[0];
        const res = [];
        for (const o of outs) for (const r of o) res.push({ node: r.node, frac: r.frac / outs.length, path: r.path });
        return res;
      }
      case 'silo': return [{ node: b, frac: 1, path: [] }];
      case 'terminal': return [];
      default:
        if (REFINERY_LEVEL[b.type] || SELLER_TIER[b.type] !== undefined) return [{ node: b, frac: 1, path: [] }];
        return [];
    }
  },

  nodeCap(g, b) {
    if (b.type === 'belt') return CONFIG.belt.throughput[b.grade] * g.mods.beltSpeed * b.boost;
    return 40;
  },

  // Builds flow routes for all producers.
  build(g) {
    if (g.topologyDirty) Game.recompute(g);
    const routes = new Map(); // building id -> [{node, frac, scale}]
    const load = new Map();
    const addRoutes = (src, list, rate) => {
      routes.set(src.id, list.map(r => ({ node: r.node, frac: r.frac, path: r.path, scale: 1 })));
      for (const r of list) for (const n of r.path) load.set(n.id, (load.get(n.id) || 0) + rate * r.frac);
    };
    for (const b of g.lists.extractor) {
      let list = [];
      const seen = new Set();
      for (const o of (b.outs || [])) {
        const ds = o.slice(0, 2).join(',');
        if (seen.has(ds)) continue; seen.add(ds);
        list = list.concat(Offline.trace(g, o[0], o[1], o[2], new Set()));
      }
      // split evenly between all reachable outputs
      const n = list.length;
      list.forEach(r => { r.frac = r.frac / Math.max(1, (b.outs || []).length > 0 ? 1 : 1); });
      const total = list.reduce((a, r) => a + r.frac, 0) || 1;
      list.forEach(r => { r.frac /= total; });
      if (n) addRoutes(b, list, b.rate);
    }
    for (const b of g.lists.refinery) if (b.port) addRoutes(b, Offline.trace(g, b.port[0], b.port[1], b.rot, new Set()), b.rate);
    for (const b of g.lists.silo) if (b.port && b.outEnabled) addRoutes(b, Offline.trace(g, b.port[0], b.port[1], b.rot, new Set()), 10);
    // proportional capacity scaling for shared belts
    for (const list of routes.values()) for (const r of list) {
      let s = 1;
      for (const n of r.path) { const l = load.get(n.id) || 0; if (l > 0) s = Math.min(s, Offline.nodeCap(g, n) / l); }
      r.scale = Math.min(1, s);
      r.cap = r.path.length ? Math.min(...r.path.map(n => Offline.nodeCap(g, n))) : 40;
    }
    return routes;
  },

  sellerDemandRate(g, b) {
    const t = SELLER_TIER[b.type];
    const c = CONFIG.customers[t];
    const interval = (c.interval[0] + c.interval[1]) / 2 / Economy.arrivalMult(g, b);
    const qty = (c.qty[0] + c.qty[1]) / 2;
    return Math.min(Economy.serviceRate(g, b), qty / interval * 0.85);
  },

  simulate(g, seconds) {
    seconds = U.clamp(U.safe(seconds), 0, CONFIG.offlineMax);
    const rep = { seconds, earned: 0, mined: new Array(8).fill(0), sold: 0, storageLimited: false, blockedShare: 0 };
    if (seconds <= 0) return rep;
    const routes = Offline.build(g);
    const step = CONFIG.offlineStep;
    const steps = Math.min(480, Math.ceil(seconds / step));
    const dtStep = seconds / steps;
    const sellers = g.lists.seller.filter(b => b.type !== 'terminal');
    const sellerRate = new Map(sellers.map(b => [b.id, Offline.sellerDemandRate(g, b)]));
    const refRate = new Map(g.lists.refinery.map(b => [b.id, b.rate]));
    const mult = g.mods.sales * g.mods.offline * (1 + CONFIG.satisfiedBonus * 0.6);
    const sellCap = new Map(), refCap = new Map();
    let wanted = 0, got = 0;

    const sell = (b, key, amt) => {
      const cap = sellCap.get(b.id) || 0;
      const take = Math.min(cap, amt);
      if (take <= 0) return 0;
      sellCap.set(b.id, cap - take);
      const res = key >> 2, ref = key & 3;
      const rev = U.safe(Economy.itemValue(res, ref) * take * CONFIG.customers[SELLER_TIER[b.type]].factor * mult);
      rep.earned += rev; rep.sold += take;
      return take;
    };
    const deliverRoutes = (list, key, amt, depth) => {
      let acc = 0;
      for (const r of list) acc += deliver(r.node, key, amt * r.frac * r.scale, depth);
      return acc;
    };
    const deliver = (node, key, amt, depth) => {
      if (amt <= 0 || depth > 6) return 0;
      if (node.type === 'silo') {
        const space = Economy.siloCap(g, node) - node.total;
        const take = Math.max(0, Math.min(space, amt));
        if (take < amt) rep.storageLimited = true;
        if (take > 0) Economy.siloAdd(node, key, take);
        return take;
      }
      if (REFINERY_LEVEL[node.type]) {
        if ((key & 3) !== REFINERY_LEVEL[node.type] - 1) return 0;
        const cap = refCap.get(node.id) || 0;
        const take = Math.min(cap, amt);
        if (take <= 0) return 0;
        const out = routes.get(node.id) || [];
        const passed = deliverRoutes(out, key + 1, take, depth + 1);
        refCap.set(node.id, cap - passed);
        if (passed > 0) g.stats.refined += passed;
        return passed;
      }
      if (SELLER_TIER[node.type] !== undefined) return sell(node, key, amt);
      return 0;
    };

    for (let s = 0; s < steps; s++) {
      for (const b of sellers) sellCap.set(b.id, sellerRate.get(b.id) * dtStep);
      for (const b of g.lists.refinery) refCap.set(b.id, refRate.get(b.id) * dtStep);
      // 1) extractors push into their chains
      for (const b of g.lists.extractor) {
        const list = routes.get(b.id);
        const amt = b.rate * dtStep;
        wanted += amt;
        if (!list) continue;
        const acc = deliverRoutes(list, b.res * 4, amt, 0);
        got += acc;
        rep.mined[b.tier] += acc;
        g.meta.codex.mined[b.res] += acc;
      }
      // 2) silo outputs
      for (const b of g.lists.silo) {
        const list = routes.get(b.id);
        if (!list || !list.length || b.total <= 0) continue;
        const cap = Math.min(b.total, (list[0].cap || 10) * dtStep);
        const keys = [...b.store.entries()].filter(([k]) => !b.outFilter || Logistics.matches(b.outFilter, { res: k >> 2, ref: k & 3 }));
        const sum = keys.reduce((a, e) => a + e[1], 0);
        if (sum <= 0) continue;
        for (const [k, c] of keys) {
          const want = cap * c / sum;
          const acc = deliverRoutes(list, k, want, 0);
          Economy.siloTake(b, k, acc);
        }
      }
      // 3) loading ramps: sellers pull from adjacent silos
      for (const b of sellers) {
        if (!b.ramps || !b.ramps.length) continue;
        for (const silo of b.ramps) {
          let cap = sellCap.get(b.id) || 0;
          if (cap <= 0 || silo.total <= 0) break;
          const entries = [...silo.store.entries()];
          const sum = entries.reduce((a, e) => a + e[1], 0);
          for (const [k, c] of entries) {
            const want = Math.min(c, cap * c / sum);
            const taken = sell(b, k, want);
            Economy.siloTake(silo, k, taken);
          }
          cap = sellCap.get(b.id) || 0;
        }
      }
    }
    // silo stores may hold fractional amounts now: round down
    for (const b of g.lists.silo) {
      for (const [k, c] of [...b.store.entries()]) { const f = Math.floor(c); if (f <= 0) b.store.delete(k); else b.store.set(k, f); }
      b.total = 0; for (const c of b.store.values()) b.total += c;
    }
    rep.blockedShare = wanted > 0 ? 1 - got / wanted : 0;
    for (let t = 0; t < 8; t++) g.stats.minedByTier[t] += rep.mined[t];
    rep.earned = U.safe(rep.earned);
    return rep;
  },

  apply(g, rep) {
    Economy.earn(g, rep.earned);
    g.incomeAcc = 0;
    g.stats.offlineEarned += rep.earned;
    g.stats.sold += rep.sold;
    Progression.checkTiers(g);
    if (rep.earned > 0) Progression.unlock(g, 'offline');
  }
};
