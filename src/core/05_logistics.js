// =====================================================================
// Logistics: items, belts, splitters, mergers, crossings, bridges
// =====================================================================
const Items = {
  pool: [],
  live: 0,
  make(res, ref) {
    const it = Items.pool.length ? Items.pool.pop() : { res: 0, ref: 0, p: 0, pp: 0, from: 0 };
    it.res = res; it.ref = ref; it.p = 0; it.pp = 0; it.from = 0; it._born = 0; // _born: render-only spawn marker
    Items.live++;
    return it;
  },
  free(it) { Items.live--; if (Items.pool.length < 20000) Items.pool.push(it); },
  key: it => it.res * 4 + it.ref
};

const Logistics = {
  spacing(grade) { return CONFIG.belt.speed[grade] / CONFIG.belt.throughput[grade]; },
  beltStep(g, b) { return CONFIG.belt.speed[b.grade] * g.mods.beltSpeed * b.boost / CONFIG.tickRate; },

  // Can a building at tile (tx,ty) take an item moving in direction dir? (no side effects)
  wouldAccept(g, b, dir, it, tx, ty) {
    switch (b.type) {
      case 'belt': {
        if (dir === ((b.rot + 2) & 3)) return false;
        const sp = Logistics.spacing(b.grade);
        return b.items.length === 0 || b.items[0].p >= sp;
      }
      case 'splitter': case 'fsplitter': case 'osplitter':
        return dir === b.rot && b.buf.length < 2;
      case 'merger': {
        if (dir === ((b.rot + 2) & 3)) return false;
        // fair round robin: every waiting input registers itself; free space goes to the
        // next waiting input after the one served last (otherwise the update order of the
        // belts decides and one or two inputs starve the others)
        const req = b.req || (b.req = [-9, -9, -9, -9]);
        req[dir] = g.tick;
        if (b.buf.length >= 2) return false;
        for (let k = 1; k <= 4; k++) {
          const d = (b.lastSide + k + 4) & 3;
          if (d === ((b.rot + 2) & 3)) continue;
          if (d === dir) return true;
          if (g.tick - req[d] <= 1) return false;
        }
        return true;
      }
      case 'crossing': { const l = b.lanes[dir]; return !l || l.length < 2; }
      case 'bridge': {
        if (dir !== b.rot || tx !== b.x || ty !== b.y) return false;
        const q = b.queue; return q.length === 0 || q[q.length - 1].t >= 0.34;
      }
      case 'silo': return b.total < Economy.siloCap(g, b);
      default:
        if (REFINERY_LEVEL[b.type]) {
          if (it.ref !== REFINERY_LEVEL[b.type] - 1) { b.wrongTick = g.tick; return false; }
          return b.inBuf.length < CONFIG.refineBuffer;
        }
        if (SELLER_TIER[b.type] !== undefined) return Economy.sellerAccepts(g, b, it);
        return false;
    }
  },

  // Tries to move item into the tile; returns true when the item now belongs to the target.
  insert(g, tx, ty, dir, it, carry = 0) {
    const id = g.occ.get(U.tileKey(tx, ty));
    if (id === undefined) return false;
    const b = g.buildings.get(id);
    if (!Logistics.wouldAccept(g, b, dir, it, tx, ty)) return false;
    switch (b.type) {
      case 'belt': {
        const sp = Logistics.spacing(b.grade);
        const c = carry > 0 ? Math.min(carry, 0.5) : 0;
        it.p = b.items.length ? Math.min(c, b.items[0].p - sp) : c;
        it.pp = it.p - Logistics.beltStep(g, b);
        it.from = dir;
        b.items.unshift(it);
        return true;
      }
      case 'splitter': case 'fsplitter': case 'osplitter': case 'merger':
        it.from = dir; b.buf.push(it);
        if (b.type === 'merger') b.lastSide = dir;
        return true;
      case 'crossing':
        if (!b.lanes[dir]) b.lanes[dir] = [];
        it.from = dir; b.lanes[dir].push(it); return true;
      case 'bridge':
        b.queue.push({ it, t: 0 }); return true;
      case 'silo':
        Economy.siloAdd(b, Items.key(it), 1); Items.free(it); return true;
      default:
        if (REFINERY_LEVEL[b.type]) { b.inBuf.push(it); return true; }
        if (SELLER_TIER[b.type] !== undefined) { Economy.sellerTake(g, b, it); return true; }
        return false;
    }
  },

  // ---------------- per-tick update of transport nodes ----------------
  tickBelt(g, b) {
    const items = b.items;
    const n = items.length;
    if (!n) return;
    const step = Logistics.beltStep(g, b);
    const sp = Logistics.spacing(b.grade);
    // transfer the front item if it reached the end
    const front = items[n - 1];
    if (front.p >= 1) {
      const tx = b.x + U.DX[b.rot], ty = b.y + U.DY[b.rot];
      if (Logistics.insert(g, tx, ty, b.rot, front, front.p - 1)) { items.pop(); }
    }
    const m = items.length;
    for (let i = m - 1; i >= 0; i--) {
      const it = items[i];
      it.pp = it.p;
      const limit = i === m - 1 ? 1 : items[i + 1].p - sp;
      const np = it.p + step < limit ? it.p + step : limit;
      if (np > it.p) it.p = np;
    }
  },

  splitOutputs(b, it) {
    const f = b.rot, l = (b.rot + 3) & 3, r = (b.rot + 1) & 3;
    if (b.type === 'fsplitter') {
      if (Logistics.matches(b.filter, it)) return [f];
      return b.rr & 1 ? [r, l] : [l, r];
    }
    if (b.type === 'osplitter') return b.rr & 1 ? [f, r, l] : [f, l, r];
    const order = [f, l, r];
    const s = b.rr % 3;
    return [order[s], order[(s + 1) % 3], order[(s + 2) % 3]];
  },
  matches(filter, it) {
    if (!filter) return true;
    if (filter.kind === 'res') return it.res === filter.res;
    if (filter.kind === 'tier') return DATA.RESOURCES[it.res].tier === filter.tier;
    if (filter.kind === 'ref') return it.ref === filter.ref;
    return true;
  },
  tickNode(g, b) {
    switch (b.type) {
      case 'belt': Logistics.tickBelt(g, b); return;
      case 'splitter': case 'fsplitter': case 'osplitter': {
        for (let k = 0; k < 2 && b.buf.length; k++) {
          const it = b.buf[0];
          const outs = Logistics.splitOutputs(b, it);
          let done = false;
          for (const d of outs) {
            if (Logistics.insert(g, b.x + U.DX[d], b.y + U.DY[d], d, it)) { done = true; break; }
          }
          if (!done) break;
          b.buf.shift();
          b.rr++;
        }
        return;
      }
      case 'merger': {
        for (let k = 0; k < 2 && b.buf.length; k++) {
          if (Logistics.insert(g, b.x + U.DX[b.rot], b.y + U.DY[b.rot], b.rot, b.buf[0])) b.buf.shift();
          else break;
        }
        return;
      }
      case 'crossing': {
        for (let d = 0; d < 4; d++) {
          const lane = b.lanes[d];
          if (!lane) continue;
          for (let k = 0; k < 2 && lane.length; k++) {
            if (Logistics.insert(g, b.x + U.DX[d], b.y + U.DY[d], d, lane[0])) lane.shift(); else break;
          }
        }
        return;
      }
      case 'bridge': {
        const q = b.queue;
        if (!q.length) return;
        const step = 6 * g.mods.beltSpeed / CONFIG.tickRate;
        const front = q[0];
        if (front.t >= b.len - 1) {
          const ex = b.x + U.DX[b.rot] * b.len, ey = b.y + U.DY[b.rot] * b.len;
          if (Logistics.insert(g, ex, ey, b.rot, front.it)) q.shift();
        }
        for (let i = 0; i < q.length; i++) {
          const lim = i === 0 ? b.len - 1 : q[i - 1].t - 0.34;
          q[i].pt = q[i].t;
          q[i].t = Math.min(q[i].t + step, lim);
        }
        return;
      }
    }
  },

  // ---------------- topology ----------------
  downstream(g, b) {
    const out = [];
    const add = (x, y) => { const o = Grid.at(g, x, y); if (o && o !== b && TRANSPORT[o.type]) out.push(o); };
    switch (b.type) {
      case 'belt': case 'merger': add(b.x + U.DX[b.rot], b.y + U.DY[b.rot]); break;
      case 'splitter': case 'fsplitter': case 'osplitter':
        for (const d of [b.rot, (b.rot + 1) & 3, (b.rot + 3) & 3]) add(b.x + U.DX[d], b.y + U.DY[d]);
        break;
      case 'crossing': for (let d = 0; d < 4; d++) add(b.x + U.DX[d], b.y + U.DY[d]); break;
      case 'bridge': add(b.x + U.DX[b.rot] * b.len, b.y + U.DY[b.rot] * b.len); break;
    }
    return out;
  },

  computeOrder(g) {
    const nodes = [];
    for (const b of g.buildings.values()) if (TRANSPORT[b.type]) nodes.push(b);
    const up = new Map();
    const downCount = new Map();
    for (const b of nodes) { up.set(b.id, []); }
    for (const b of nodes) {
      const ds = Logistics.downstream(g, b);
      downCount.set(b.id, ds.length);
      for (const d of ds) up.get(d.id).push(b);
    }
    const order = [];
    const seen = new Set();
    const queue = [];
    for (const b of nodes) if (downCount.get(b.id) === 0) { queue.push(b); seen.add(b.id); }
    for (let qi = 0; qi < queue.length; qi++) {
      const b = queue[qi];
      order.push(b);
      for (const u of up.get(b.id)) if (!seen.has(u.id)) { seen.add(u.id); queue.push(u); }
    }
    // cycles / leftovers
    for (const b of nodes) if (!seen.has(b.id)) {
      // walk downstream-first within the cycle
      const stack = [b];
      while (stack.length) {
        const c = stack.pop();
        if (seen.has(c.id)) continue;
        seen.add(c.id); order.push(c);
        for (const u of up.get(c.id)) if (!seen.has(u.id)) stack.push(u);
      }
    }
    g.order = order;
  },

  // Belt chain that a charger touches: walk downstream and upstream through belts.
  chargerBoost(g) {
    for (const b of g.buildings.values()) if (b.type === 'belt') b.boost = 1;
    for (const c of g.buildings.values()) {
      if (c.type !== 'charger') continue;
      const mult = 1 + CONFIG.chargerBonus * (1 + 0.2 * (c.level - 1));
      const start = [...Grid.neighbors(g, c)].filter(o => o.type === 'belt');
      const visited = new Set();
      const stack = start.slice();
      let guard = 0;
      while (stack.length && guard++ < 1500) {
        const b = stack.pop();
        if (visited.has(b.id)) continue;
        visited.add(b.id);
        b.boost = Math.max(b.boost, mult);
        const f = Grid.at(g, b.x + U.DX[b.rot], b.y + U.DY[b.rot]);
        if (f && f.type === 'belt' && !visited.has(f.id)) stack.push(f);
        for (let d = 0; d < 4; d++) {
          if (d === b.rot) continue;
          const o = Grid.at(g, b.x + U.DX[d], b.y + U.DY[d]);
          if (o && o.type === 'belt' && !visited.has(o.id) && o.x + U.DX[o.rot] === b.x && o.y + U.DY[o.rot] === b.y) stack.push(o);
        }
      }
    }
  },

  // Output targets of an extractor (perimeter tiles filtered by mask, only where something could accept).
  extractorOuts(g, b) {
    const outs = [];
    for (const p of Grid.perimeter(b)) {
      if (!(b.outMask & (1 << p[2]))) continue;
      const o = Grid.at(g, p[0], p[1]);
      if (!o) continue;
      if (o.type === 'belt' && o.rot === ((p[2] + 2) & 3)) continue;
      if (o.type === 'belt' || o.type === 'merger' || o.type === 'silo' || o.type === 'crossing' || REFINERY_LEVEL[o.type] || SELLER_TIER[o.type] !== undefined ||
        ((o.type === 'splitter' || o.type === 'fsplitter' || o.type === 'osplitter' || o.type === 'bridge') && o.rot === p[2])) outs.push(p);
    }
    return outs;
  }
};
