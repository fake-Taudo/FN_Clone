// =====================================================================
// Collide: building hitboxes and player collision (movement only; never
// touches the economy, customers rates or offline calculation).
// Conveyor belts and all flat transport parts are always walkable.
// Hitboxes are rectangles in world tiles; the player is a circle that
// slides along walls (vector push-out per sub-step, no tunnelling).
// =====================================================================
const Collide = {
  // customer side of a bazaar follows its rotation
  SIDE: [[0, 1], [-1, 0], [0, -1], [1, 0]],
  mode(type) { return (CONFIG.collision && CONFIG.collision[type]) || 'none'; },
  // rectangles [x0, y0, x1, y1] (world) for one building, cached on the building
  boxes(b) {
    const key = b.x + ',' + b.y + ',' + b.rot + ',' + b.w + ',' + b.h;
    if (b._hbk === key) return b._hb;
    const m = Collide.mode(b.type);
    let R = [];
    const X = b.x, Y = b.y, W = b.w, H = b.h, I = 0.1;
    if (m === 'footprint') R = [[X + I, Y + I, X + W - I, Y + H - I]];
    else if (m === 'custom') {
      const rel = Collide.custom(b);
      R = rel.map(r => [X + r[0], Y + r[1], X + r[2], Y + r[3]]);
    }
    b._hb = R; b._hbk = key;
    return R;
  },
  custom(b) {
    const W = b.w, H = b.h;
    switch (b.type) {
      case 'bazaar': {
        // solid stall body (counter, back wall, roof posts) without the customer strip
        const s = Collide.SIDE[b.rot & 3], strip = 0.7, I = 0.1;
        let x0 = I, y0 = I, x1 = W - I, y1 = H - I;
        if (s[1] === 1) y1 = H - strip; else if (s[1] === -1) y0 = strip; else if (s[0] === 1) x1 = W - strip; else x0 = strip;
        return [[x0, y0, x1, y1]];
      }
      case 'caravan': return [[0.08, 0.04, W - 0.08, 0.32], [0.08, 0.32, 0.3, H - 0.2], [W - 0.3, 0.32, W - 0.08, H - 0.2], [0.55, 1.75, 1.45, 2.55], [W - 1.45, 1.75, W - 0.55, 2.55], [W / 2 - 0.35, 0.8, W / 2 + 0.35, 1.2]];
      case 'shuttlepad': return [[W - 1.05, 0.15, W - 0.35, 0.68], [0.45, 0.33, 1.05, 0.68]];
      case 'port': return [[W / 2 - 0.45, 0.28, W / 2 + 0.45, 1.05], [0.45, 0.35, 2.85, 0.9], [W - 2.85, 0.35, W - 0.45, 0.9], [0.46, H - 0.84, 0.64, H - 0.62], [W - 0.64, H - 0.84, W - 0.46, H - 0.62]];
      case 'dock': return [[0.3, 0.35, 1.9, 1.32], [W - 1.45, 1.0, W - 0.55, 1.45], [0.2, 2.4, 1.5, 7.8], [W - 1.55, 2.4, W - 0.25, 7.8], [0.95, 7.55, 1.15, 7.85], [W - 1.15, 7.55, W - 0.95, 7.85]];
      default: return [[0.1, 0.1, W - 0.1, H - 0.1]];
    }
  },
  // where customers stand: centre of the free strip
  stripPoint(b, slot) {
    const s = Collide.SIDE[b.rot & 3];
    if (s[1] === 1) return [b.x + 0.6 + (slot % 3) * ((b.w - 1.2) / 2), b.y + b.h - 0.32];
    if (s[1] === -1) return [b.x + 0.6 + (slot % 3) * ((b.w - 1.2) / 2), b.y + 0.32];
    if (s[0] === 1) return [b.x + b.w - 0.32, b.y + 0.6 + (slot % 3) * ((b.h - 1.2) / 2)];
    return [b.x + 0.32, b.y + 0.6 + (slot % 3) * ((b.h - 1.2) / 2)];
  },
  extra: [], // additional rectangles (e.g. the intro lander's hull)
  near(g, x, y, r, out) {
    out.length = 0;
    const seen = Collide._seen || (Collide._seen = new Set());
    seen.clear();
    const R = Math.ceil(r + 1);
    for (let ty = Math.floor(y) - R; ty <= Math.floor(y) + R; ty++) for (let tx = Math.floor(x) - R; tx <= Math.floor(x) + R; tx++) {
      const id = g.occ.get(U.tileKey(tx, ty));
      if (id === undefined || seen.has(id)) continue;
      seen.add(id);
      const b = g.buildings.get(id);
      if (!b || Collide.mode(b.type) === 'none') continue;
      for (const rc of Collide.boxes(b)) out.push(rc);
    }
    for (const rc of Collide.extra) if (rc[0] < x + R && rc[2] > x - R && rc[1] < y + R && rc[3] > y - R) out.push(rc);
    return out;
  },
  // push a circle out of rectangles; returns penetration depth handled
  resolve(rects, p, r) {
    let depth = 0;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const rc of rects) {
        const cx = Math.max(rc[0], Math.min(p.x, rc[2])), cy = Math.max(rc[1], Math.min(p.y, rc[3]));
        let dx = p.x - cx, dy = p.y - cy, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.y += dy * k; depth = Math.max(depth, r - d); }
        else {
          // centre inside: leave through the nearest edge
          const l = p.x - rc[0], rr = rc[2] - p.x, t = p.y - rc[1], bb = rc[3] - p.y, m = Math.min(l, rr, t, bb);
          if (m === l) p.x = rc[0] - r; else if (m === rr) p.x = rc[2] + r; else if (m === t) p.y = rc[1] - r; else p.y = rc[3] + r;
          depth = Math.max(depth, m + r);
        }
        moved = true;
      }
      if (!moved) break;
    }
    return depth;
  },
  blockedAt(g, x, y, r) {
    const rects = Collide.near(g, x, y, r, Collide._tmp || (Collide._tmp = []));
    for (const rc of rects) { const cx = Math.max(rc[0], Math.min(x, rc[2])), cy = Math.max(rc[1], Math.min(y, rc[3])); if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true; }
    return false;
  },
  // nearest free point (spiral search), used for the stuck rescue and placing on the player
  freePoint(g, x, y, r) {
    for (let d = 0; d <= 16; d += 0.5) {
      const n = Math.max(1, Math.round(d * 8));
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!Collide.blockedAt(g, px, py, r)) return [px, py]; }
    }
    return [x, y];
  },
  // movement with sub-steps; also handles push-out after placing and soft landing zones
  move(g, p, dx, dy, dt) {
    const rover = g.run.research.done.has('rover') && p.moving;
    const r = rover ? 0.45 : 0.28;
    const rects = Collide._r || (Collide._r = []);
    // a rescue glide ignores collisions until it arrives
    if (p.rescue) {
      const ex = p.rescue[0] - p.x, ey = p.rescue[1] - p.y, d = Math.hypot(ex, ey), sp = 7 * dt;
      if (d <= sp) { p.x = p.rescue[0]; p.y = p.rescue[1]; p.rescue = null; } else { p.x += ex / d * sp; p.y += ey / d * sp; }
      return;
    }
    const len = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(len / 0.12));
    for (let i = 0; i < n; i++) {
      p.x += dx / n; p.y += dy / n;
      Collide.near(g, p.x, p.y, r, rects);
      if (rects.length) {
        const before = [p.x, p.y];
        const depth = Collide.resolve(rects, p, r);
        // a building placed on top of the player: push out gently (max ~0.3 s), never block placing
        if (depth > 0.2) {
          const fp = Collide.freePoint(g, before[0], before[1], r);
          p.x = before[0]; p.y = before[1];
          p.rescue = fp; p.rescueSoft = true;
          return;
        }
      }
    }
    // soft no-stand zones while a ship touches down
    for (const z of Collide.zones) {
      if (p.x > z[0] - r && p.x < z[2] + r && p.y > z[1] - r && p.y < z[3] + r) {
        const cx = (z[0] + z[2]) / 2, cy = (z[1] + z[3]) / 2, ex = p.x - cx, ey = p.y - cy, d = Math.hypot(ex, ey) || 1;
        p.x += ex / d * 3 * dt; p.y += ey / d * 3 * dt;
        if (!g._hornAt || g.run.time - g._hornAt > 2) { g._hornAt = g.run.time; g.events.push({ type: 'landingZone' }); }
      }
    }
  },
  zones: [],
  updateZones(g) {
    Collide.zones.length = 0;
    for (const b of g.lists.seller || []) {
      if (!b.customers || SELLER_TIER[b.type] < 2) continue;
      for (const c of b.customers) {
        if (c.state !== 'in' || c.arrive - c.t > 2.2) continue;
        const c0 = b.type === 'port' ? (c.slot % 2 ? [b.x + 5.05, b.y + 3.9] : [b.x + 1.95, b.y + 3.9]) : [b.x + b.w / 2, b.y + b.h / 2 + 0.2];
        const half = b.type === 'dock' ? 2.1 : 1.4;
        Collide.zones.push([c0[0] - half, c0[1] - half, c0[0] + half, c0[1] + half]);
      }
    }
  }
};
