// =====================================================================
// Depth sorting (y-sort by foot line), x-ray for the player behind tall
// buildings, and customer walking paths around hitboxes (A* on tiles,
// alien paths preferred). Purely visual: customer timing and income are
// untouched; if no path exists the customer simply appears at the stall.
// =====================================================================
const Sorter = {
  // custom buildings: flat base drawn in the ground pass, tall parts sorted separately
  TALL: {
    caravan: (W, H) => [[0, 0, W, 0.34, 0.34], [0, 0.3, 0.32, H - 0.2, H - 0.2], [W - 0.32, 0.3, W, H - 0.2, H - 0.2], [0.4, 0.4, 1.6, 2.6, 2.6], [W - 1.6, 0.4, W - 0.4, 2.6, 2.6], [W / 2 - 0.45, 0, W / 2 + 0.45, 1.2, 1.2]],
    shuttlepad: (W, H) => [[W - 1.1, 0, W - 0.3, 0.7, 0.7], [0.4, 0, 1.1, 0.7, 0.7]],
    port: (W, H) => [[W / 2 - 0.7, 0, W / 2 + 0.7, 1.08, 1.08], [0.4, 0, 2.9, 0.92, 0.92], [W - 2.9, 0, W - 0.4, 0.92, 0.92], [0.3, H - 3.5, 0.8, H - 0.6, H - 0.6], [W - 0.8, H - 3.5, W - 0.3, H - 0.6, H - 0.6]],
    dock: (W, H) => [[0.25, 0, 1.95, 1.35, 1.35], [W - 1.5, 0, W - 0.5, 1.48, 1.48], [0.15, 1.8, 1.55, 7.82, 7.82], [W - 1.6, 1.8, W - 0.2, 7.82, 7.82], [0.6, 4.5, W - 0.6, 7.9, 7.9]]
  },
  isSplit(b) { return !!Sorter.TALL[b.type]; },
  footY(b) {
    if (b.type === 'bazaar') return b.y + b.h - 0.45;
    return b.y + b.h;
  },
  // draws a clipped column of the building sprite (one tall part) for sorting
  drawPart(ctx, g, b, part) {
    const x = b.x - Render.ox, y = b.y - Render.oy;
    const top = (BuildingArt.TOP[b.type] || 1) + 0.5;
    ctx.save();
    ctx.beginPath(); ctx.rect(x + part[0] - 0.05, y - top, part[2] - part[0] + 0.1, part[3] + top + 0.05); ctx.clip();
    Draw.building(ctx, g, b, x, y, true);
    ctx.restore();
  },
  // x-ray state
  xr: 0,
  xrCanvas: null,
  begin(ctx) {
    const c = Render.canvas;
    let o = Sorter.xrCanvas;
    if (!o || o.width !== c.width || o.height !== c.height) { o = Sorter.xrCanvas = document.createElement('canvas'); o.width = c.width; o.height = c.height; }
    const x = o.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, o.width, o.height);
    x.setTransform(ctx.getTransform());
    return x;
  },
  // soft hole (40-55 % opacity) around the player in the occluder layer, then composite
  end(ctx, x, px, py) {
    const S = Render.S;
    const m = ctx.getTransform();
    const sx = px * m.a + m.e, sy = (py - 0.55) * m.d + m.f, R = 1.5 * S;
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'destination-out';
    const k = Sorter.xr;
    const gr = x.createRadialGradient(sx, sy, R * 0.25, sx, sy, R);
    gr.addColorStop(0, 'rgba(0,0,0,' + (0.55 * k).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(sx - R, sy - R, R * 2, R * 2);
    x.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(Sorter.xrCanvas, 0, 0); ctx.restore();
  },
  // does a later-drawn sprite cover the player's body?
  covers(item, px, py) {
    if (item.kind === 'lander') return px > item.x - 1.3 && px < item.x + 1.3 && py < item.key && py > item.y - 2.6;
    if (item.kind !== 'b' && item.kind !== 'part') return false;
    const b = item.b;
    if (item.kind === 'part') { const p = item.part; return px > b.x + p[0] - 0.2 && px < b.x + p[2] + 0.2 && py < b.y + p[4] && py > b.y - 3; }
    const top = (BuildingArt.TOP[b.type] || 1) * 0.9;
    return px > b.x - 0.1 && px < b.x + b.w + 0.1 && py < Sorter.footY(b) && py > b.y - top;
  }
};

const Paths = {
  blocked(g, tx, ty) {
    const id = g.occ.get(U.tileKey(tx, ty));
    if (id === undefined) return false;
    const b = g.buildings.get(id);
    if (!b || Collide.mode(b.type) === 'none') return false;
    const cx = tx + 0.5, cy = ty + 0.5;
    for (const r of Collide.boxes(b)) if (cx > r[0] && cx < r[2] && cy > r[1] && cy < r[3]) return true;
    return false;
  },
  // A* on tiles; alien paths cost less. Returns a list of points or null.
  find(g, sx, sy, ex, ey) {
    const x0 = Math.floor(Math.min(sx, ex)) - 6, y0 = Math.floor(Math.min(sy, ey)) - 6;
    const W = Math.floor(Math.max(sx, ex)) + 7 - x0, H = Math.floor(Math.max(sy, ey)) + 7 - y0;
    if (W * H > 9000) return null;
    const idx = (x, y) => (y - y0) * W + (x - x0);
    const gS = new Float32Array(W * H).fill(1e9), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
    const stx = Math.floor(sx), sty = Math.floor(sy), etx = Math.floor(ex), ety = Math.floor(ey);
    const open = [[stx, sty, 0]];
    gS[idx(stx, sty)] = 0;
    let found = false, iter = 0;
    while (open.length && iter++ < 4000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][2] < open[bi][2]) bi = i;
      const [cx, cy] = open[bi]; open.splice(bi, 1);
      const ci = idx(cx, cy);
      if (closed[ci]) continue;
      closed[ci] = 1;
      if (cx === etx && cy === ety) { found = true; break; }
      for (let d = 0; d < 4; d++) {
        const nx = cx + U.DX[d], ny = cy + U.DY[d];
        if (nx < x0 || ny < y0 || nx >= x0 + W || ny >= y0 + H) continue;
        const ni = idx(nx, ny);
        if (closed[ni]) continue;
        if (!(nx === etx && ny === ety) && Paths.blocked(g, nx, ny)) continue;
        const o = Grid.at(g, nx, ny);
        const cost = o && o.type === 'path' ? 0.45 : 1;
        const ng = gS[ci] + cost;
        if (ng < gS[ni]) { gS[ni] = ng; from[ni] = ci; open.push([nx, ny, ng + (Math.abs(nx - etx) + Math.abs(ny - ety)) * 0.45]); }
      }
    }
    if (!found) return null;
    const pts = [];
    for (let i = idx(etx, ety); i >= 0; i = from[i]) pts.push([x0 + (i % W) + 0.5, y0 + Math.floor(i / W) + 0.5]);
    pts.reverse();
    pts[0] = [sx, sy]; pts.push([ex, ey]);
    // smooth corners a little
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) out.push([(pts[i - 1][0] + pts[i][0] * 2 + pts[i + 1][0]) / 4, (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4]);
    out.push(pts[pts.length - 1]);
    let L = 0; const cum = [0];
    for (let i = 1; i < out.length; i++) { L += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]); cum.push(L); }
    return { pts: out, cum, L };
  },
  at(path, k, out) {
    const d = k * path.L, c = path.cum, p = path.pts;
    let i = 1; while (i < c.length - 1 && c[i] < d) i++;
    const t = (d - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]);
    out[0] = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t; out[1] = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
    out[2] = p[i][0] - p[i - 1][0];
    return out;
  }
};
