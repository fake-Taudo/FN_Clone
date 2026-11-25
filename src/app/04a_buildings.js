// =====================================================================
// BuildingArt: 2.5D building bodies (cached sprites per type / visual
// tier / rotation / resolution) plus cheap animated overlays per frame.
// Visual tiers: L1-3 = 0 (raw, riveted), L4-6 = 1 (clean steel, hazard
// marks), L7-9 = 2 (anthracite + brass, extra modules), L10 = 3 (white +
// gold, glowing trims). Light from top left, cast shadows are batched.
// =====================================================================
const VT = lvl => lvl >= 10 ? 3 : lvl >= 7 ? 2 : lvl >= 4 ? 1 : 0;
const BA_E = 0.077; // height of the foundation plate on screen

const BuildingArt = {
  // tiles above the footprint that a sprite needs (tall parts)
  TOP: { extractor: 1.7, splitter: 0.6, merger: 0.6, crossing: 0.6, fsplitter: 0.7, osplitter: 0.7, silo: 2.6, refinery1: 1.9, refinery2: 2.2, refinery3: 2.4, cooler: 2.2, servo: 0.9, charger: 1.6, lab: 2.4, bazaar: 1.4, caravan: 1.5, shuttlepad: 1.0, port: 3.0, dock: 3.2, terminal: 3.4, lamp: 2.0, flag: 1.8, plant: 1.2, beacon: 2.4, fence: 0.7, path: 0.2 },
  PAD: 0.3,
  T(hex) { return Art.tones(hex); },
  mat(vt) {
    return BuildingArt._mat[vt] || (BuildingArt._mat[vt] = [
      { frame: Art.tones('#8a8580'), trim: Art.pal('rust'), plate: Art.pal('concrete'), glow: null, dirt: 0.55 },
      { frame: Art.pal('steel'), trim: Art.pal('steel'), plate: Art.pal('concrete'), glow: null, dirt: 0.18 },
      { frame: Art.pal('anth'), trim: Art.pal('brass'), plate: Art.tones('#8d929c'), glow: '#7fe8ff', dirt: 0 },
      { frame: Art.pal('white'), trim: Art.pal('gold'), plate: Art.tones('#c9cdd6'), glow: '#7fe8ff', dirt: 0 }
    ][vt]);
  },
  _mat: [],
  ppt(W) { return Art.bucket(Render.ppt(), W >= 7 ? 96 : 128); },
  sprite(type, vt, rot, W, H, ppt, extra = '') {
    return Art.cached('B|' + type + '|' + vt + '|' + rot + '|' + W + 'x' + H + '|' + ppt + '|' + extra, () => BuildingArt.render(type, vt, rot, W, H, ppt, extra));
  },
  render(type, vt, rot, W, H, ppt, extra) {
    const pad = BuildingArt.PAD, top = BuildingArt.TOP[type] || 1;
    const cw = W + pad * 2, ch = H + top + pad;
    const c = Art.canvas(cw * ppt, ch * ppt), x = c.getContext('2d');
    x.scale(ppt, ppt); x.translate(pad, top);
    x.lineJoin = 'round'; x.lineCap = 'round';
    const rnd = RNG.mulberry32(RNG.hash(RNG.hashString(type), vt * 7 + rot, W * 31 + H));
    const paint = BuildingArt.P[type] || BuildingArt.P.generic;
    paint(x, W, H, vt, rot, extra, rnd, type);
    return { canvas: c, ox: -pad, oy: -top, w: cw, h: ch };
  },
  // draws the static body of a building at x,y (relative tile coords)
  drawBody(ctx, b, x, y, vt, extra, alpha = 1) {
    const s = BuildingArt.sprite(b.type, vt, BuildingArt.rotKey(b), b.w, b.h, BuildingArt.ppt(b.w), extra);
    if (alpha < 1) { const a = ctx.globalAlpha; ctx.globalAlpha = a * alpha; ctx.drawImage(s.canvas, x + s.ox, y + s.oy, s.w, s.h); ctx.globalAlpha = a; }
    else ctx.drawImage(s.canvas, x + s.ox, y + s.oy, s.w, s.h);
  },
  ROT_FREE: { extractor: 1, cooler: 1, servo: 1, charger: 1, lab: 1, caravan: 1, shuttlepad: 1, port: 1, dock: 1, terminal: 1, lamp: 1, flag: 1, plant: 1, beacon: 1, path: 1, fence: 1 },
  rotKey(b) { return BuildingArt.ROT_FREE[b.type] ? 0 : b.rot; },

  // ---------------- shared painting helpers ----------------
  foundation(x, W, H, vt, rnd, inset = 0.05) {
    const m = BuildingArt.mat(vt);
    Art.contact(x, 0, 0, W, H, 0.42);
    Art.box(x, inset, inset, W - inset * 2, H - inset * 2, 0.14, m.plate, { r: 0.1 });
    const ty = inset - BA_E, x0 = inset, x1 = W - inset, y1 = H - inset - BA_E;
    if (vt === 0 && rnd) for (let i = 0; i < 3 + W; i++) { x.fillStyle = 'rgba(70,45,30,.16)'; x.beginPath(); x.ellipse(x0 + rnd() * (x1 - x0), ty + rnd() * (y1 - ty), 0.1 + rnd() * 0.25, 0.06 + rnd() * 0.12, rnd() * 3, 0, Math.PI * 2); x.fill(); }
    if (vt >= 2) { x.strokeStyle = 'rgba(0,0,0,.14)'; x.lineWidth = 0.02; x.beginPath(); for (let i = 1; i < W * 2; i++) { x.moveTo(x0 + i * 0.5, ty + 0.06); x.lineTo(x0 + i * 0.5, y1 - 0.06); } x.stroke(); }
    if (vt >= 1) Art.hazard(x, x0 + 0.1, y1 - 0.15, x1 - x0 - 0.2, 0.09);
    if (vt === 3) { x.strokeStyle = 'rgba(127,232,255,.9)'; x.lineWidth = 0.035; x.beginPath(); x.moveTo(x0 + 0.12, y1 + 0.03); x.lineTo(x1 - 0.12, y1 + 0.03); x.stroke(); }
    Art.rivets(x, [[x0 + 0.1, ty + 0.1], [x1 - 0.1, ty + 0.1], [x0 + 0.1, y1 - 0.06], [x1 - 0.1, y1 - 0.06]], 0.03, m.frame);
  },
  vent(x, x0, y0, w, h) {
    x.fillStyle = '#1c2026'; Art.rrect(x, x0, y0, w, h, 0.03); x.fill();
    x.strokeStyle = 'rgba(150,160,175,.55)'; x.lineWidth = 0.02; x.beginPath();
    for (let yy = y0 + 0.05; yy < y0 + h - 0.02; yy += 0.06) { x.moveTo(x0 + 0.03, yy); x.lineTo(x0 + w - 0.03, yy); }
    x.stroke();
  },
  glass(x, x0, y0, w, h, r = 0.05, tint = '#1a2a38') {
    x.fillStyle = tint; Art.rrect(x, x0, y0, w, h, r); x.fill();
    x.save(); Art.rrect(x, x0, y0, w, h, r); x.clip();
    x.fillStyle = 'rgba(200,235,255,.22)'; x.beginPath(); x.moveTo(x0, y0 + h * 0.6); x.lineTo(x0 + w * 0.45, y0); x.lineTo(x0 + w * 0.7, y0); x.lineTo(x0, y0 + h * 1.1); x.fill();
    x.restore();
    x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 0.025; Art.rrect(x, x0, y0, w, h, r); x.stroke();
  },
  rust(x, rnd, x0, y0, w, h, n) {
    for (let i = 0; i < n; i++) { x.fillStyle = 'rgba(120,60,30,.28)'; x.beginPath(); x.ellipse(x0 + rnd() * w, y0 + rnd() * h, 0.04 + rnd() * 0.08, 0.03 + rnd() * 0.06, rnd() * 3, 0, Math.PI * 2); x.fill(); }
  },
  seams(x, x0, y0, w, h, n, a = 0.22) {
    x.strokeStyle = 'rgba(0,0,0,' + a + ')'; x.lineWidth = 0.018; x.beginPath();
    for (let i = 1; i < n; i++) { x.moveTo(x0 + w * i / n, y0 + 0.02); x.lineTo(x0 + w * i / n, y0 + h - 0.02); }
    x.stroke();
  },
  chute(x, W, H, rot, t, vt) {
    // output chute on the front side (rotation), standing on the plate
    const cx = W / 2, cy = H / 2;
    const dx = U.DX[rot], dy = U.DY[rot];
    const px = cx + dx * (W / 2 - 0.32), py = cy + dy * (H / 2 - 0.32);
    Art.box(x, px - 0.26, py - 0.2 - BA_E, 0.52, 0.42, 0.32, t, { r: 0.05 });
    x.fillStyle = '#15181d'; Art.rrect(x, px - 0.16, py - 0.2 - BA_E - 0.32 * Art.V + 0.07, 0.32, 0.26, 0.04); x.fill();
    if (vt >= 1) { x.fillStyle = '#f2c230'; x.fillRect(px - 0.26, py - 0.2 - BA_E + 0.42 - 0.05, 0.52, 0.04); }
  },
  sphere(x, cx, cy, r, t) {
    const g = x.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.05, cx, cy, r);
    g.addColorStop(0, t.rim); g.addColorStop(0.45, t.base); g.addColorStop(1, t.lo);
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.strokeStyle = t.edge; x.lineWidth = 0.04; x.stroke();
  },
  mast(x, x0, yb, h, w, t) {
    // thin vertical pole standing at ground point (x0, yb), h tiles tall (already projected)
    x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(x0, yb, w * 1.4, w * 0.6, 0, 0, Math.PI * 2); x.fill();
    const g = x.createLinearGradient(x0 - w, 0, x0 + w, 0); g.addColorStop(0, t.hi); g.addColorStop(0.5, t.base); g.addColorStop(1, t.lo);
    x.fillStyle = g; x.fillRect(x0 - w / 2, yb - h, w, h);
    x.strokeStyle = t.edge; x.lineWidth = 0.02; x.strokeRect(x0 - w / 2, yb - h, w, h);
  },

  // ---------------- geometry shared with the animated overlays ----------------
  GEO: {
    extractor(vt) {
      const V = Art.V, hh = 0.85 + vt * 0.12, y0 = 0.18 - BA_E, d = 0.72;
      const ty = y0 - hh * V, fy0 = y0 + d - hh * V, fy1 = y0 + d;
      return { hh, y0, d, ty, fy0, fy1, win: [0.24, fy0 + 0.07, 0.46, fy1 - fy0 - 0.15], pit: [1.0, 1.36], lamp: [1.66, ty + 0.15], mast: 1.0 + vt * 0.12 };
    },
    silo(vt) {
      const V = Art.V, cx = 1.5, cy = 1.95 - BA_E, rx = 1.12, ry = 0.54, H = 2.3 + vt * 0.22, hv = H * V;
      return { cx, cy, rx, ry, H, hv, top: cy - hv, win: [cx - 0.13, cy - hv + ry + 0.14, 0.26, hv - 0.42] };
    },
    refinery(lvl, vt) {
      const V = Art.V, hallY = 0.95 - BA_E, hallD = 1.85, hallH = 0.85 + vt * 0.06;
      const ty = hallY - hallH * V;
      const chim = lvl === 1 ? [[2.35, 0.62, 2.2]] : lvl === 2 ? [[2.4, 0.6, 2.5]] : [[2.3, 0.42, 2.7], [2.62, 0.7, 2.4], [0.42, 0.55, 2.5]];
      return { hallY, hallD, hallH, ty, sky: [0.72, ty + 0.4, 1.56, 0.95], chim: chim.map(c => [c[0], c[1] - c[2] * V]) };
    },
    cooler(vt) { const V = Art.V, H = 2.1 + vt * 0.2; return { cx: 1.0, cy: 1.38 - BA_E, H, hv: H * V, rt: 0.6 }; },
    servo() { return { cx: 1.0, cy: 1.0 - BA_E - 0.45 * Art.V + 0.02 }; },
    charger(vt) { const V = Art.V, coils = [[0.5, 0.7], [1.5, 0.7], [1.0, 1.45]]; const ch = 1.0 + vt * 0.1; return { coils: coils.map(c => [c[0], c[1] - BA_E - 0.35 * V - ch * V]), rod: [1.0, 1.05 - BA_E - 0.35 * V - (1.5 + vt * 0.15) * V], ch }; },
    lab(vt) { const V = Art.V, by = 1.55 - BA_E, bh = 1.0 + vt * 0.08, ty = by - bh * V; return { by, bh, ty, dish: [3.05, ty + 0.25 - 0.9], holo: [1.4, ty + 0.2 - 1.3], win: [0.55, by + 2.1 - bh * V + 0.12] }; },
    dockGantryY: 7.75,
    pads(type, W) {
      if (type === 'port') return [[1.95, 3.9], [5.05, 3.9]];
      return [[W / 2, W / 2 + 0.2]];
    }
  },

  // ---------------- painters (tile coords, footprint at 0,0..W,H) ----------------
  P: {
    generic(x, W, H, vt, rot, extra, rnd, type) {
      BuildingArt.foundation(x, W, H, vt, rnd);
      const def = DATA.BUILDINGS[type] || { color: '#888888' };
      Art.box(x, 0.2, 0.2 - BA_E, W - 0.4, H - 0.4, 0.6, Art.tones(def.color), { r: 0.08 });
    },

    extractor(x, W, H, vt, rot, extra, rnd) {
      const G = BuildingArt.GEO.extractor(vt), m = BuildingArt.mat(vt), V = Art.V;
      BuildingArt.foundation(x, W, H, vt, rnd);
      const body = vt === 3 ? Art.pal('white') : vt === 0 ? Art.tones('#c86a2a') : Art.pal('orange');
      const acc = vt === 3 ? Art.pal('orange') : m.trim;
      // exhaust stack behind the housing (tier 2+)
      if (vt >= 2) { Art.cyl(x, 1.55, G.y0 + 0.2, 0.1, 0.05, G.hh + 0.55, m.frame, { bands: 2 }); x.fillStyle = '#111'; x.beginPath(); x.ellipse(1.55, G.y0 + 0.2 - (G.hh + 0.55) * V, 0.07, 0.035, 0, 0, Math.PI * 2); x.fill(); }
      // housing
      Art.box(x, 0.14, G.y0, 1.72, G.d, G.hh, body, { r: 0.06 });
      // roof: vent, hatch, panels
      BuildingArt.vent(x, 0.3, G.ty + 0.12, 0.46, 0.26);
      x.fillStyle = Col.rgba(body.lo, 0.5); Art.rrect(x, 0.9, G.ty + 0.1, 0.5, 0.36, 0.04); x.fill();
      Art.rivets(x, [[0.95, G.ty + 0.15], [1.35, G.ty + 0.15], [0.95, G.ty + 0.41], [1.35, G.ty + 0.41]], 0.022, acc);
      if (vt === 3) { x.fillStyle = '#2a3a5a'; Art.rrect(x, 0.9, G.ty + 0.1, 0.5, 0.36, 0.04); x.fill(); x.strokeStyle = '#7fb0ff'; x.lineWidth = 0.015; x.beginPath(); for (let i = 1; i < 4; i++) { x.moveTo(0.9 + i * 0.125, G.ty + 0.1); x.lineTo(0.9 + i * 0.125, G.ty + 0.46); } x.stroke(); }
      // front face: resource window (left), vents (right), stripe
      BuildingArt.glass(x, G.win[0] - 0.03, G.win[1] - 0.03, G.win[2] + 0.06, G.win[3] + 0.06, 0.05, Col.shade(body.edge, -0.2));
      BuildingArt.glass(x, G.win[0], G.win[1], G.win[2], G.win[3], 0.04, '#121c26');
      BuildingArt.vent(x, 1.3, G.fy0 + 0.1, 0.42, G.fy1 - G.fy0 - 0.2);
      x.fillStyle = Col.rgba(acc.base, 0.9); x.fillRect(0.14, G.fy0 + 0.02, 1.72, 0.045);
      if (vt === 0) BuildingArt.rust(x, rnd, 0.16, G.ty, 1.68, G.fy1 - G.ty, 9);
      // side pipe to the front (tier 1+)
      if (vt >= 1) Art.pipe(x, [[1.86, G.fy1 - 0.15], [1.86, 1.5], [1.6, 1.62]], 0.07, m.trim);
      // drill pit with collar
      const [px, py] = G.pit;
      x.fillStyle = '#0b0c0f'; x.beginPath(); x.ellipse(px, py, 0.46, 0.28, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = m.frame.lo; x.lineWidth = 0.09; x.beginPath(); x.ellipse(px, py, 0.5, 0.31, 0, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = Col.rgba(m.frame.rim, 0.85); x.lineWidth = 0.03; x.beginPath(); x.ellipse(px, py - 0.015, 0.5, 0.31, 0, Math.PI * 0.95, Math.PI * 1.9); x.stroke();
      const rv = []; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; rv.push([px + Math.cos(a) * 0.5, py + Math.sin(a) * 0.31]); }
      Art.rivets(x, rv, 0.022, acc);
      // derrick (A-frame) over the pit
      const ay = py - G.mast, legs = m.frame;
      x.lineCap = 'round';
      for (const [lx, w] of [[0.74, 0.07], [1.26, 0.07]]) { x.strokeStyle = legs.edge; x.lineWidth = w + 0.04; x.beginPath(); x.moveTo(lx, py + 0.04); x.lineTo(px, ay); x.stroke(); x.strokeStyle = lx < 1 ? legs.hi : legs.lo; x.lineWidth = w; x.stroke(); }
      x.strokeStyle = legs.base; x.lineWidth = 0.03; x.beginPath();
      for (let k = 1; k < 4; k++) { const t0 = k / 4, t1 = (k + 1) / 4; const yA = py + (ay - py) * t0, yB = py + (ay - py) * Math.min(1, t1); const wA = 0.26 * (1 - t0), wB = 0.26 * (1 - Math.min(1, t1)); x.moveTo(px - wA, yA); x.lineTo(px + wB, yB); x.moveTo(px + wA, yA); x.lineTo(px - wB, yB); }
      x.stroke();
      Art.box(x, px - 0.12, ay - 0.06, 0.24, 0.12, 0.14, acc, { r: 0.02 });
      x.strokeStyle = '#2a2a2a'; x.lineWidth = 0.025; x.beginPath(); x.moveTo(px, ay); x.lineTo(px, py - 0.05); x.stroke();
      // antenna (tier 3)
      if (vt === 3) { x.strokeStyle = '#d8dde6'; x.lineWidth = 0.025; x.beginPath(); x.moveTo(1.75, G.ty + 0.2); x.lineTo(1.75, G.ty - 0.45); x.stroke(); }
      // status lamp socket
      Art.cyl(x, G.lamp[0], G.lamp[1] + 0.04, 0.07, 0.035, 0.1, m.frame);
    },

    splitter: (x, W, H, vt, rot, extra) => BuildingArt.node(x, 'splitter', vt, rot),
    merger: (x, W, H, vt, rot, extra) => BuildingArt.node(x, 'merger', vt, rot),
    crossing: (x, W, H, vt, rot, extra) => BuildingArt.node(x, 'crossing', vt, rot),
    fsplitter: (x, W, H, vt, rot, extra) => BuildingArt.node(x, 'fsplitter', vt, rot),
    osplitter: (x, W, H, vt, rot, extra) => BuildingArt.node(x, 'osplitter', vt, rot),

    silo(x, W, H, vt, rot, extra, rnd) {
      const G = BuildingArt.GEO.silo(vt), m = BuildingArt.mat(vt), V = Art.V;
      BuildingArt.foundation(x, W, H, vt, rnd);
      const tank = vt === 3 ? Art.pal('white') : vt === 2 ? Art.tones('#5d6b7c') : vt === 1 ? Art.pal('steel') : Art.tones('#8492a0');
      // back pump / secondary tank
      if (vt >= 2) Art.cyl(x, 0.45, 0.62 - BA_E, 0.26, 0.13, 1.4, m.frame, { bands: 1 });
      if (rot === 3) BuildingArt.chute(x, W, H, rot, m.trim, vt);
      // legs under the tank
      Art.cyl(x, G.cx, G.cy, G.rx, G.ry, G.H, tank, { bands: 3 });
      // top cone roof
      const ty = G.top;
      const cg = x.createLinearGradient(G.cx - G.rx, ty, G.cx + G.rx, ty);
      cg.addColorStop(0, tank.rim); cg.addColorStop(0.5, tank.base); cg.addColorStop(1, tank.lo);
      x.fillStyle = cg; x.beginPath(); x.ellipse(G.cx, ty, G.rx, G.ry, 0, 0, Math.PI); x.lineTo(G.cx, ty - 0.55); x.closePath(); x.fill();
      x.strokeStyle = tank.edge; x.lineWidth = 0.04; x.stroke();
      x.fillStyle = Col.rgba(tank.rim, 0.5); x.beginPath(); x.moveTo(G.cx, ty - 0.55); x.lineTo(G.cx - G.rx * 0.8, ty + 0.05); x.lineTo(G.cx - G.rx * 0.45, ty + 0.1); x.closePath(); x.fill();
      // top hatch
      Art.cyl(x, G.cx, ty - 0.42, 0.2, 0.1, 0.12, m.trim);
      // bands colour (tier 2+ brass, tier 3 gold)
      if (vt >= 2) { x.strokeStyle = m.trim.base; x.lineWidth = 0.06; for (const k of [0.25, 0.75]) { x.beginPath(); x.ellipse(G.cx, G.cy - G.hv * k, G.rx, G.ry, 0, 0.05, Math.PI - 0.05); x.stroke(); } }
      if (vt === 3) { x.strokeStyle = 'rgba(127,232,255,.95)'; x.lineWidth = 0.035; x.beginPath(); x.ellipse(G.cx, G.cy - G.hv * 0.5, G.rx, G.ry, 0, 0.05, Math.PI - 0.05); x.stroke(); }
      if (vt === 0) BuildingArt.rust(x, rnd, G.cx - G.rx, G.top, G.rx * 2, G.hv + G.ry, 12);
      // ladder (right)
      const lx = G.cx + G.rx * 0.72;
      x.strokeStyle = m.frame.edge; x.lineWidth = 0.03; x.beginPath();
      x.moveTo(lx - 0.07, G.cy + G.ry * 0.62); x.lineTo(lx - 0.07, G.top + G.ry * 0.7); x.moveTo(lx + 0.07, G.cy + G.ry * 0.62); x.lineTo(lx + 0.07, G.top + G.ry * 0.7);
      for (let yy = G.top + G.ry * 0.8; yy < G.cy + G.ry * 0.55; yy += 0.12) { x.moveTo(lx - 0.07, yy); x.lineTo(lx + 0.07, yy); }
      x.stroke();
      // level window frame
      const [wx, wy, ww, wh] = G.win;
      x.fillStyle = m.frame.edge; Art.rrect(x, wx - 0.05, wy - 0.05, ww + 0.1, wh + 0.1, 0.06); x.fill();
      x.fillStyle = '#0f151c'; Art.rrect(x, wx, wy, ww, wh, 0.05); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 0.015; x.beginPath(); for (let i = 1; i < 4; i++) { x.moveTo(wx, wy + wh * i / 4); x.lineTo(wx + 0.06, wy + wh * i / 4); } x.stroke();
      if (rot !== 3) BuildingArt.chute(x, W, H, rot, m.trim, vt);
      // inlet pipes on top (tier 1+)
      if (vt >= 1) Art.pipe(x, [[G.cx - 0.6, ty - 0.05], [G.cx - 0.6, ty - 0.32], [G.cx - 0.2, ty - 0.4]], 0.06, m.frame);
    },

    refinery1(x, W, H, vt, rot, extra, rnd) { BuildingArt.refinery(x, W, H, vt, rot, rnd, 1); },
    refinery2(x, W, H, vt, rot, extra, rnd) { BuildingArt.refinery(x, W, H, vt, rot, rnd, 2); },
    refinery3(x, W, H, vt, rot, extra, rnd) { BuildingArt.refinery(x, W, H, vt, rot, rnd, 3); },

    cooler(x, W, H, vt, rot, extra, rnd) {
      const G = BuildingArt.GEO.cooler(vt), m = BuildingArt.mat(vt);
      BuildingArt.foundation(x, W, H, vt, rnd);
      const t = vt === 3 ? Art.pal('white') : Art.tones(vt === 0 ? '#b8c4c8' : '#cfdde2');
      const { cx, cy, hv } = G;
      const rb = 0.78, rw = 0.5, rt = G.rt, ry = 0.3;
      // hyperboloid shell
      const g = x.createLinearGradient(cx - rb, 0, cx + rb, 0);
      g.addColorStop(0, t.rim); g.addColorStop(0.35, t.base); g.addColorStop(1, t.lo);
      x.fillStyle = g; x.beginPath();
      x.moveTo(cx - rb, cy); x.quadraticCurveTo(cx - rw * 0.9, cy - hv * 0.55, cx - rt, cy - hv);
      x.lineTo(cx + rt, cy - hv); x.quadraticCurveTo(cx + rw * 0.9, cy - hv * 0.55, cx + rb, cy);
      x.ellipse(cx, cy, rb, ry, 0, 0, Math.PI); x.closePath(); x.fill();
      x.strokeStyle = t.edge; x.lineWidth = 0.04; x.stroke();
      // warning band near the top (tier 1+) and vertical ribs
      x.save(); x.clip();
      x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 0.02; x.beginPath(); for (let i = -3; i <= 3; i++) { x.moveTo(cx + i * 0.22, cy + 0.3); x.lineTo(cx + i * 0.17, cy - hv); } x.stroke();
      if (vt >= 1) { for (let i = 0; i < 10; i++) { x.fillStyle = i % 2 ? '#f2f2f2' : '#e0473a'; x.fillRect(cx - 0.8 + i * 0.16, cy - hv + 0.05, 0.16, 0.12); } }
      if (vt === 0) BuildingArt.rust(x, rnd, cx - rb, cy - hv, rb * 2, hv, 8);
      x.restore();
      // opening
      x.fillStyle = t.lo; x.beginPath(); x.ellipse(cx, cy - hv, rt, ry * 0.8, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#0d1418'; x.beginPath(); x.ellipse(cx, cy - hv + 0.02, rt - 0.07, ry * 0.8 - 0.05, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = t.edge; x.lineWidth = 0.035; x.beginPath(); x.ellipse(cx, cy - hv, rt, ry * 0.8, 0, 0, Math.PI * 2); x.stroke();
      // pump house + pipe
      Art.box(x, 1.25, 1.42 - BA_E, 0.6, 0.42, 0.45, m.frame, { r: 0.04 });
      Art.pipe(x, [[1.55, 1.42 - BA_E - 0.2], [1.55, 1.1], [1.3, 1.0]], 0.07, m.trim);
      if (vt >= 2) Art.cyl(x, 0.35, 0.5 - BA_E, 0.18, 0.09, 0.8, m.trim, { bands: 1 });
    },

    servo(x, W, H, vt, rot, extra, rnd) {
      const m = BuildingArt.mat(vt);
      BuildingArt.foundation(x, W, H, vt, rnd);
      const t = vt === 3 ? Art.pal('white') : vt >= 2 ? Art.pal('anth') : Art.tones('#6a5c48');
      Art.box(x, 0.14, 0.16 - BA_E, 1.72, 1.66, 0.45, t, { r: 0.1 });
      const ty = 0.16 - BA_E - 0.45 * Art.V;
      // gear well
      x.fillStyle = '#121418'; x.beginPath(); x.ellipse(1.0, ty + 0.83, 0.72, 0.6, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = m.trim.base; x.lineWidth = 0.05; x.beginPath(); x.ellipse(1.0, ty + 0.83, 0.75, 0.63, 0, 0, Math.PI * 2); x.stroke();
      // pistons at the corners
      for (const [px, py] of [[0.32, 0.34], [1.68, 0.34], [0.32, 1.62], [1.68, 1.62]]) Art.cyl(x, px, py - BA_E, 0.1, 0.05, 0.75 + vt * 0.08, m.trim, { bands: 1 });
      if (vt === 0) BuildingArt.rust(x, rnd, 0.2, ty, 1.6, 1.8, 8);
    },

    charger(x, W, H, vt, rot, extra, rnd) {
      const G = BuildingArt.GEO.charger(vt), m = BuildingArt.mat(vt), V = Art.V;
      BuildingArt.foundation(x, W, H, vt, rnd);
      const base = vt === 3 ? Art.pal('white') : Art.tones(vt >= 2 ? '#2c3a30' : '#3c5034');
      Art.box(x, 0.16, 0.16 - BA_E, 1.68, 1.68, 0.35, base, { r: 0.1 });
      const top = 0.16 - BA_E - 0.35 * V;
      // central rod
      const rodTop = G.rod[1];
      BuildingArt.mast(x, 1.0, 1.05 - BA_E - 0.35 * V, (1.05 - BA_E - 0.35 * V) - rodTop, 0.07, m.frame);
      BuildingArt.sphere(x, 1.0, rodTop, 0.13, Art.tones('#c8f0b0'));
      // coils
      const copper = Art.tones('#c87a3a');
      for (let i = 0; i < 3; i++) {
        const [cxp, cyp] = [[0.5, 0.7], [1.5, 0.7], [1.0, 1.45]][i];
        Art.cyl(x, cxp, cyp - BA_E - 0.35 * V, 0.2, 0.1, G.ch, Art.tones('#5a6470'));
        x.strokeStyle = copper.base; x.lineWidth = 0.035;
        for (let k = 1; k < 7; k++) { const yy = cyp - BA_E - 0.35 * V - G.ch * V * k / 7; x.beginPath(); x.ellipse(cxp, yy, 0.2, 0.1, 0, 0, Math.PI); x.stroke(); }
        BuildingArt.sphere(x, G.coils[i][0], G.coils[i][1] - 0.05, 0.09, Art.tones('#d8dde6'));
      }
      x.fillStyle = Col.rgba('#9bf06a', 0.8); x.fillRect(0.3, top + 1.45, 1.4, 0.04);
    },

    lab(x, W, H, vt, rot, extra, rnd) {
      const G = BuildingArt.GEO.lab(vt), m = BuildingArt.mat(vt), V = Art.V;
      BuildingArt.foundation(x, W, H, vt, rnd);
      const wall = vt === 3 ? Art.pal('white') : Art.tones(vt === 0 ? '#8a94aa' : '#a8b4c8');
      // annex greenhouse (tier 2+)
      if (vt >= 2) { Art.box(x, 0.3, 0.3 - BA_E, 1.1, 0.9, 0.5, Art.tones('#6a8a7a'), { r: 0.05 }); x.fillStyle = 'rgba(160,230,200,.45)'; Art.rrect(x, 0.36, 0.3 - BA_E - 0.5 * V + 0.06, 0.98, 0.78, 0.05); x.fill(); }
      // main hall
      Art.box(x, 0.3, G.by, 3.4, 2.1, G.bh, wall, { r: 0.08 });
      const fy0 = G.by + 2.1 - G.bh * V;
      for (let i = 0; i < 6; i++) Art.window(x, 0.55 + i * 0.5, fy0 + 0.12, 0.3, 0.26, false);
      x.fillStyle = Col.rgba(m.trim.base, 0.9); x.fillRect(0.3, fy0 + 0.02, 3.4, 0.05);
      // door
      x.fillStyle = '#2a3140'; x.fillRect(3.2, fy0 + 0.1, 0.32, G.bh * V - 0.1);
      // observatory dome on the roof
      const dt = vt === 3 ? Art.pal('white') : Art.tones('#e6edf8');
      Art.cyl(x, 1.4, G.ty + 1.15, 0.85, 0.45, 0.25, Art.tones('#8a96b0'));
      const dcy = G.ty + 1.15 - 0.25 * V, dtop = dcy - 1.5 * V * 0.9;
      Art.dome(x, 1.4, dcy, 0.85, 0.45, 1.5, dt);
      // observation slit following the dome curvature, telescope peeking out
      x.save(); x.beginPath(); x.ellipse(1.4, dcy, 0.85, 0.45, 0, 0, Math.PI); x.bezierCurveTo(1.4 - 0.85, dcy - 1.5 * V * 1.2, 1.4 + 0.85, dcy - 1.5 * V * 1.2, 1.4 + 0.85, dcy); x.clip();
      const sg = x.createLinearGradient(1.25, 0, 1.55, 0); sg.addColorStop(0, '#0e141e'); sg.addColorStop(0.5, '#243044'); sg.addColorStop(1, '#0e141e');
      x.fillStyle = sg; x.beginPath(); x.moveTo(1.27, dcy + 0.45); x.quadraticCurveTo(1.2, dtop + 0.3, 1.33, dtop - 0.1); x.lineTo(1.5, dtop - 0.1); x.quadraticCurveTo(1.62, dtop + 0.3, 1.55, dcy + 0.45); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 0.02; x.stroke();
      x.restore();
      x.save(); x.translate(1.41, dtop + 0.32); x.rotate(-0.5);
      Art.box(x, -0.08, -0.32, 0.16, 0.42, 0.12, Art.pal('steel'), { r: 0.04, lw: 0.02 });
      x.fillStyle = '#7fd3ff'; x.beginPath(); x.ellipse(0, -0.38, 0.07, 0.035, 0, 0, Math.PI * 2); x.fill();
      x.restore();
      for (let i = 0; i < 5; i++) { const a = Math.PI * (0.15 + i * 0.175); x.strokeStyle = 'rgba(80,90,110,.35)'; x.lineWidth = 0.015; x.beginPath(); x.moveTo(1.4 + Math.cos(a) * 0.85, dcy + Math.sin(a) * 0.45); x.quadraticCurveTo(1.4 + Math.cos(a) * 0.6, dcy - 0.55, 1.4, dtop + 0.05); x.stroke(); }
      // roof units
      BuildingArt.vent(x, 2.5, G.ty + 1.25, 0.6, 0.35);
      // dish mast
      BuildingArt.mast(x, G.dish[0], G.ty + 0.9, 0.95, 0.08, m.frame);
      if (vt >= 1) { x.strokeStyle = '#d8dde6'; x.lineWidth = 0.025; x.beginPath(); x.moveTo(2.4, G.ty + 0.5); x.lineTo(2.4, G.ty - 0.25); x.moveTo(2.3, G.ty - 0.05); x.lineTo(2.5, G.ty - 0.05); x.stroke(); }
      if (vt === 0) BuildingArt.rust(x, rnd, 0.3, G.ty, 3.4, 2.6, 10);
    },

    bazaar(x, W, H, vt, rot, extra, rnd) {
      const m = BuildingArt.mat(vt), V = Art.V;
      Art.contact(x, 0, 0, W, H, 0.4);
      // wooden deck
      const wood = Art.tones(vt >= 2 ? '#9a6a3a' : '#7a5232');
      Art.box(x, 0.06, 0.06, W - 0.12, H - 0.12, 0.12, wood, { r: 0.06 });
      x.strokeStyle = 'rgba(40,20,10,.35)'; x.lineWidth = 0.02; x.beginPath(); for (let yy = 0.2; yy < H - 0.1; yy += 0.22) { x.moveTo(0.1, yy - BA_E); x.lineTo(W - 0.1, yy - BA_E); } x.stroke();
      // crates opposite the customer side, counter on the customer side (follows rotation)
      const side = rot & 3; // 0 south, 1 west, 2 north, 3 east
      const crate = Art.tones('#b0824a');
      const ct = Art.tones(vt === 3 ? '#e8d0a0' : '#8a5a32');
      const crateRow = (y0) => { for (let i = 0; i < Math.floor(W * 1.3); i++) { const cx = 0.25 + i * 0.62 + (rnd() - 0.5) * 0.1; if (cx > W - 0.6) break; Art.box(x, cx, y0 - BA_E, 0.48, 0.4, 0.45 + rnd() * 0.15, crate, { r: 0.03 }); x.strokeStyle = 'rgba(60,30,10,.5)'; x.lineWidth = 0.02; x.beginPath(); x.moveTo(cx + 0.04, y0 - BA_E - 0.2); x.lineTo(cx + 0.44, y0 - BA_E + 0.36 - 0.3); x.stroke(); } };
      const crateCol = (x0) => { for (let i = 0; i < Math.floor(H * 1.3); i++) { const cy = 0.3 + i * 0.62; if (cy > H - 0.6) break; Art.box(x, x0, cy - BA_E, 0.42, 0.45, 0.45 + rnd() * 0.15, crate, { r: 0.03 }); } };
      if (side === 0) { crateRow(0.22); Art.box(x, 0.18, H - 0.72 - BA_E, W - 0.36, 0.42, 0.55, ct, { r: 0.04 }); }
      else if (side === 2) { Art.box(x, 0.18, 0.14 - BA_E, W - 0.36, 0.42, 0.55, ct, { r: 0.04 }); crateRow(H - 0.72); }
      else if (side === 1) { crateCol(W - 0.62); Art.box(x, 0.14, 0.3 - BA_E, 0.42, H - 0.6, 0.55, ct, { r: 0.04 }); }
      else { crateCol(0.2); Art.box(x, W - 0.56, 0.3 - BA_E, 0.42, H - 0.6, 0.55, ct, { r: 0.04 }); }
      // awning (tilted cloth roof with stripes and scalloped edge)
      const c1 = vt === 0 ? '#e0703a' : vt === 1 ? '#d84fa0' : vt === 2 ? '#3a8ad8' : '#8a3ad8';
      const c2 = vt === 3 ? '#f6d98f' : '#fff3d6';
      const ax0 = -0.05, ax1 = W + 0.05, ayB = -0.75, ayF = H * 0.52 - 0.6;
      // poles
      for (const px of [0.14, W - 0.14]) BuildingArt.mast(x, px, H - 0.3 - BA_E, (H - 0.3 - BA_E) - ayF, 0.06, Art.tones('#6a4a2a'));
      x.save();
      x.beginPath(); x.moveTo(ax0 + 0.1, ayB); x.lineTo(ax1 - 0.1, ayB); x.lineTo(ax1, ayF); x.lineTo(ax0, ayF); x.closePath(); x.clip();
      const n = Math.max(4, Math.round(W * 3));
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n;
        x.fillStyle = i % 2 ? c2 : c1;
        x.beginPath(); x.moveTo(ax0 + 0.1 + (ax1 - ax0 - 0.2) * u0, ayB); x.lineTo(ax0 + 0.1 + (ax1 - ax0 - 0.2) * u1, ayB); x.lineTo(ax0 + (ax1 - ax0) * u1, ayF); x.lineTo(ax0 + (ax1 - ax0) * u0, ayF); x.closePath(); x.fill();
      }
      const sg = x.createLinearGradient(0, ayB, 0, ayF); sg.addColorStop(0, 'rgba(255,255,255,.22)'); sg.addColorStop(1, 'rgba(0,0,0,.18)');
      x.fillStyle = sg; x.fillRect(ax0, ayB, ax1 - ax0, ayF - ayB);
      x.restore();
      // scalloped edge
      for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; x.fillStyle = i % 2 ? c2 : c1; x.beginPath(); x.arc(ax0 + (ax1 - ax0) * u, ayF, (ax1 - ax0) / n / 2, 0, Math.PI); x.fill(); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 0.02; x.stroke(); }
      x.strokeStyle = Col.shade(c1, -0.5); x.lineWidth = 0.03; x.beginPath(); x.moveTo(ax0 + 0.1, ayB); x.lineTo(ax1 - 0.1, ayB); x.lineTo(ax1, ayF); x.moveTo(ax0 + 0.1, ayB); x.lineTo(ax0, ayF); x.stroke();
      if (vt >= 2) { x.fillStyle = m.trim.base; x.fillRect(ax0, ayF - 0.04, ax1 - ax0, 0.05); }
      // string of light bulbs (sockets; glow is animated)
      x.strokeStyle = '#2a2a2a'; x.lineWidth = 0.015; x.beginPath(); x.moveTo(0.14, ayF + 0.15); x.quadraticCurveTo(W / 2, ayF + 0.4, W - 0.14, ayF + 0.15); x.stroke();
    },

    caravan(x, W, H, vt, rot, extra, rnd) {
      const m = BuildingArt.mat(vt), V = Art.V;
      Art.contact(x, 0, 0, W, H, 0.4);
      const sand = Art.tones(vt === 3 ? '#e8dcc0' : '#d4b88a');
      Art.box(x, 0.05, 0.05, W - 0.1, H - 0.1, 0.08, sand, { r: 0.12 });
      // paving pattern
      x.strokeStyle = 'rgba(120,90,50,.25)'; x.lineWidth = 0.02; x.beginPath();
      for (let i = 1; i < W * 2; i++) { x.moveTo(0.1 + i * 0.5, 0.1); x.lineTo(0.1 + i * 0.5, H - 0.15); }
      for (let i = 1; i < H * 2; i++) { x.moveTo(0.1, 0.05 + i * 0.5); x.lineTo(W - 0.1, 0.05 + i * 0.5); }
      x.stroke();
      // low adobe walls (back and sides, gate at the front)
      const wall = Art.tones(vt >= 2 ? '#c89a6a' : '#b07a4a');
      Art.box(x, 0.08, 0.08 - 0.044, W - 0.16, 0.22, 0.4, wall, { r: 0.05 });
      Art.box(x, 0.08, 0.3 - 0.044, 0.22, H - 0.45, 0.4, wall, { r: 0.05 });
      Art.box(x, W - 0.3, 0.3 - 0.044, 0.22, H - 0.45, 0.4, wall, { r: 0.05 });
      // well (back centre)
      Art.cyl(x, W / 2, 1.0, 0.35, 0.18, 0.32, Art.tones('#9a8a7a'));
      x.fillStyle = '#1a3a5a'; x.beginPath(); x.ellipse(W / 2, 1.0 - 0.32 * V, 0.25, 0.12, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#5a3a1a'; x.lineWidth = 0.04; x.beginPath(); x.moveTo(W / 2 - 0.3, 1.0 - 0.18); x.lineTo(W / 2 - 0.3, 1.0 - 0.75); x.lineTo(W / 2 + 0.3, 1.0 - 0.75); x.lineTo(W / 2 + 0.3, 1.0 - 0.18); x.stroke();
      // tents
      const cols = vt === 3 ? [['#f6d98f', '#8a3ad8'], ['#ffffff', '#3a8ad8']] : [['#e05a3a', '#f6e0b0'], ['#3a9ad8', '#f6e0b0']];
      for (let i = 0; i < 2; i++) {
        const tx = i ? W - 1.55 : 0.45, ty = 1.35, tw = 1.1, td = 1.4, th = 1.0 + vt * 0.08;
        BuildingArt.tent(x, tx, ty, tw, td, th, cols[i][0], cols[i][1]);
      }
      // barrels and sacks
      const barrel = Art.tones('#7a5232');
      for (const [bx, by] of [[0.55, 3.15], [0.85, 3.3], [W - 0.7, 3.2]]) Art.cyl(x, bx, by, 0.14, 0.07, 0.32, barrel, { bands: 2 });
      // display table (front centre)
      Art.box(x, W / 2 - 0.75, H - 1.05, 1.5, 0.5, 0.35, Art.tones('#8a5a32'), { r: 0.04 });
      // pennant poles
      for (const px of [0.2, W - 0.2]) BuildingArt.mast(x, px, 0.2, 1.25, 0.05, Art.tones('#6a4a2a'));
    },

    shuttlepad(x, W, H, vt, rot, extra, rnd) {
      const m = BuildingArt.mat(vt), V = Art.V;
      Art.contact(x, 0, 0, W, H, 0.45);
      const pad = Art.tones(vt === 3 ? '#9aa2b0' : vt >= 1 ? '#5c636e' : '#575a5e');
      Art.box(x, 0.12, 0.12, W - 0.24, H - 0.24, 0.2, pad, { r: 0.12 });
      const ty = 0.12 - 0.11, x0 = 0.12, x1 = W - 0.12, y1 = H - 0.12 - 0.11;
      // panel seams
      x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 0.02; x.beginPath();
      for (let i = 1; i < W; i++) { x.moveTo(x0 + i, ty + 0.05); x.lineTo(x0 + i, y1 - 0.05); x.moveTo(x0 + 0.05, ty + i); x.lineTo(x1 - 0.05, ty + i); }
      x.stroke();
      if (vt === 0) for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(20,20,20,.18)'; x.beginPath(); x.ellipse(x0 + rnd() * (x1 - x0), ty + rnd() * (y1 - ty), 0.2 + rnd() * 0.4, 0.1 + rnd() * 0.2, rnd() * 3, 0, Math.PI * 2); x.fill(); }
      // hazard border
      Art.hazard(x, x0 + 0.08, ty + 0.08, x1 - x0 - 0.16, 0.16);
      Art.hazard(x, x0 + 0.08, y1 - 0.24, x1 - x0 - 0.16, 0.16);
      x.save(); x.translate(x0 + 0.24, ty + 0.08); x.rotate(Math.PI / 2); Art.hazard(x, 0, -0.0, y1 - ty - 0.16, 0.16); x.restore();
      x.save(); x.translate(x1 - 0.08, ty + 0.08); x.rotate(Math.PI / 2); Art.hazard(x, 0, 0, y1 - ty - 0.16, 0.16); x.restore();
      // touchdown square with corner chevrons (no letters)
      const cx = W / 2, cy = (ty + y1) / 2, s = 1.15;
      x.strokeStyle = 'rgba(245,245,240,.9)'; x.lineWidth = 0.09; x.strokeRect(cx - s, cy - s, s * 2, s * 2);
      x.lineWidth = 0.04; x.strokeRect(cx - s * 0.55, cy - s * 0.55, s * 1.1, s * 1.1);
      x.fillStyle = vt === 3 ? '#f2c14b' : '#f2c230';
      for (let k = 0; k < 4; k++) {
        x.save(); x.translate(cx, cy); x.rotate(k * Math.PI / 2);
        x.beginPath(); x.moveTo(-0.25, -s - 0.45); x.lineTo(0, -s - 0.15); x.lineTo(0.25, -s - 0.45); x.lineTo(0.16, -s - 0.5); x.lineTo(0, -s - 0.3); x.lineTo(-0.16, -s - 0.5); x.closePath(); x.fill();
        x.restore();
      }
      // corner light housings
      for (const [lx, ly] of [[x0 + 0.3, ty + 0.3], [x1 - 0.3, ty + 0.3], [x0 + 0.3, y1 - 0.3], [x1 - 0.3, y1 - 0.3]]) { x.fillStyle = '#22252b'; x.beginPath(); x.arc(lx, ly, 0.13, 0, Math.PI * 2); x.fill(); }
      // control kiosk (back right corner) and fuel tank (back left)
      Art.box(x, W - 1.05, 0.25 - 0.11, 0.7, 0.5, 0.75, m.frame, { r: 0.04 });
      BuildingArt.glass(x, W - 0.98, 0.25 - 0.11 - 0.75 * V + 0.47, 0.56, 0.16, 0.02, '#3a6a8a');
      Art.cyl(x, 0.75, 0.62 - 0.11, 0.3, 0.15, 0.55, vt >= 2 ? m.trim : Art.tones('#d8dde6'), { bands: 1 });
    },

    port(x, W, H, vt, rot, extra, rnd) {
      const m = BuildingArt.mat(vt), V = Art.V;
      BuildingArt.foundation(x, W, H, vt, rnd, 0.08);
      // containers row at the back
      const ccols = ['#d8503a', '#3a7ad8', '#e0b03a', '#3aa86a', '#8a5ad8'];
      for (let i = 0; i < 5; i++) { if (i === 2) continue; const t = Art.tones(ccols[(i + vt) % 5]); Art.box(x, 0.45 + i * 1.25, 0.35 - BA_E, 1.05, 0.55, 0.55, t, { r: 0.02 }); BuildingArt.seams(x, 0.45 + i * 1.25, 0.35 - BA_E - 0.3 + 0.55, 1.05, 0.3, 6, 0.25); }
      // two landing pads
      for (const [pcx, pcy] of BuildingArt.GEO.pads('port', W)) BuildingArt.octPad(x, pcx, pcy, 1.38, vt);
      // control tower (back centre)
      const tw = 0.9, tx = W / 2 - tw / 2, tyy = 1.05 - BA_E, th = 2.6 + vt * 0.25;
      Art.box(x, tx, tyy, tw, 0.8, th, m.frame, { r: 0.05 });
      const capY = tyy - th * V;
      Art.box(x, tx - 0.22, capY + 0.05, tw + 0.44, 0.9, 0.5, vt === 3 ? Art.pal('white') : Art.pal('steel'), { r: 0.06 });
      BuildingArt.glass(x, tx - 0.18, capY + 0.05 + 0.9 - 0.5 * V + 0.05, tw + 0.36, 0.5 * V - 0.1, 0.03, '#3a7aa8');
      x.strokeStyle = '#d8dde6'; x.lineWidth = 0.03; x.beginPath(); x.moveTo(W / 2, capY + 0.1); x.lineTo(W / 2, capY - 0.7); x.stroke();
      // crane masts (jibs are animated)
      for (const cxm of [0.55, W - 0.55]) BuildingArt.mast(x, cxm, H - 0.7 - BA_E, 2.1, 0.14, Art.pal('cloth2'));
      if (vt >= 2) Art.cyl(x, W - 1.4, 1.45 - BA_E, 0.35, 0.18, 0.9, m.trim, { bands: 2 });
    },

    dock(x, W, H, vt, rot, extra, rnd) {
      const m = BuildingArt.mat(vt), V = Art.V;
      BuildingArt.foundation(x, W, H, vt, rnd, 0.08);
      // landing bay
      const bx0 = 1.7, by0 = 2.2, bw = W - 3.4, bh = H - 3.2;
      x.fillStyle = vt === 3 ? '#4a5260' : '#2c3038'; Art.rrect(x, bx0, by0 - BA_E, bw, bh, 0.2); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 0.02; x.beginPath(); for (let i = 1; i < bw; i++) { x.moveTo(bx0 + i, by0 - BA_E + 0.1); x.lineTo(bx0 + i, by0 - BA_E + bh - 0.1); } x.stroke();
      Art.hazard(x, bx0, by0 - BA_E, bw, 0.14); Art.hazard(x, bx0, by0 - BA_E + bh - 0.14, bw, 0.14);
      // big landing target in the bay
      const bcx = bx0 + bw / 2, bcy = by0 - BA_E + bh / 2;
      x.strokeStyle = 'rgba(242,194,48,.9)'; x.lineWidth = 0.1; x.beginPath(); x.ellipse(bcx, bcy, bw * 0.36, bh * 0.36, 0, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = 'rgba(245,245,240,.6)'; x.lineWidth = 0.05; x.beginPath(); x.moveTo(bcx - bw * 0.45, bcy); x.lineTo(bcx + bw * 0.45, bcy); x.moveTo(bcx, bcy - bh * 0.45); x.lineTo(bcx, bcy + bh * 0.45); x.stroke();
      for (let k = 0; k < 4; k++) { x.save(); x.translate(bcx, bcy); x.rotate(k * Math.PI / 2); x.fillStyle = 'rgba(242,194,48,.85)'; x.beginPath(); x.moveTo(-0.3, -bh * 0.44); x.lineTo(0, -bh * 0.3); x.lineTo(0.3, -bh * 0.44); x.closePath(); x.fill(); x.restore(); }
      // landing guide lights sockets
      for (let i = 0; i < 6; i++) { for (const sx of [bx0 + 0.3, bx0 + bw - 0.3]) { x.fillStyle = '#1a1c20'; x.beginPath(); x.arc(sx, by0 - BA_E + 0.5 + i * (bh - 1) / 5, 0.07, 0, Math.PI * 2); x.fill(); } }
      // container stacks left and right
      const ccols = ['#d8503a', '#3a7ad8', '#e0b03a', '#3aa86a', '#8a5ad8', '#d87a3a'];
      for (let side = 0; side < 2; side++) for (let i = 0; i < 4; i++) for (let s = 0; s < 1 + ((i + side + vt) % 3 === 0 ? 1 : 0) + (vt >= 2 ? 1 : 0); s++) {
        const t = Art.tones(ccols[(i * 2 + side + s) % 6]);
        const cx0 = side ? W - 1.55 : 0.2, cy0 = 2.4 + i * 1.35;
        Art.box(x, cx0, cy0 - BA_E - s * 0.5 * V * 1.2, 1.3, 0.55, 0.5, t, { r: 0.02 });
      }
      // fuel tanks (back right) and office (back left)
      Art.cyl(x, W - 1.0, 1.25 - BA_E, 0.45, 0.22, 1.2, vt >= 2 ? m.trim : Art.tones('#d8dde6'), { bands: 2 });
      Art.box(x, 0.3, 0.35 - BA_E, 1.6, 1.0, 1.0, m.frame, { r: 0.05 });
      for (let i = 0; i < 3; i++) Art.window(x, 0.45 + i * 0.5, 0.35 - BA_E + 1.0 - 1.0 * V + 0.12, 0.3, 0.25, false);
      // gantry: legs and beam across the bay (trolley animated)
      const gy = BuildingArt.GEO.dockGantryY, gh = 3.0 + vt * 0.2, beamY = gy - BA_E - gh * V;
      const gt = vt === 3 ? Art.pal('white') : Art.pal('cloth2');
      for (const lx of [1.05, W - 1.05]) BuildingArt.mast(x, lx, gy - BA_E, gh * V, 0.18, gt);
      Art.box(x, 0.85, beamY - 0.02, W - 1.7, 0.28, 0.3, gt, { r: 0.02 });
      x.strokeStyle = Col.rgba(gt.edge, 0.7); x.lineWidth = 0.025; x.beginPath(); for (let i = 0; i < 16; i++) { const xx = 1.0 + i * (W - 2) / 16; x.moveTo(xx, beamY - 0.16); x.lineTo(xx + (W - 2) / 32, beamY + 0.1); x.lineTo(xx + (W - 2) / 16, beamY - 0.16); } x.stroke();
    },

    terminal(x, W, H, vt, rot, extra, rnd) {
      const m = BuildingArt.mat(vt), V = Art.V;
      BuildingArt.foundation(x, W, H, vt, rnd, 0.08);
      const wall = vt === 3 ? Art.pal('white') : Art.tones(vt === 0 ? '#6a5a7a' : '#7a6a92');
      // admin block (back left) with window rows
      Art.box(x, 0.4, 0.5 - BA_E, 2.8, 1.6, 1.4, wall, { r: 0.08 });
      const fy0 = 0.5 - BA_E + 1.6 - 1.4 * V;
      for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) Art.window(x, 0.6 + i * 0.52, fy0 + 0.1 + r * 0.34, 0.32, 0.22, false, '#ffb8e0');
      x.fillStyle = '#ff5fa8'; x.fillRect(0.4, fy0 + 0.02, 2.8, 0.05);
      // dish tower (back right)
      const dx = W - 1.6, dy = 1.7 - BA_E;
      Art.box(x, dx - 0.45, dy - 0.5, 0.9, 0.9, 1.8, m.frame, { r: 0.05 });
      const dtop = dy - 0.5 - 1.8 * V;
      BuildingArt.dish(x, dx, dtop - 0.35, 1.05, vt);
      // holo pedestal (front centre)
      const hx = W / 2, hy = H - 2.2;
      Art.cyl(x, hx, hy - BA_E, 1.1, 0.55, 0.25, Art.tones('#3e2850'));
      Art.cyl(x, hx, hy - BA_E - 0.25 * V, 0.75, 0.38, 0.2, Art.tones('#5a3a70'));
      x.fillStyle = '#ff9fd0'; x.beginPath(); x.ellipse(hx, hy - BA_E - 0.45 * V, 0.55, 0.27, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#2a1a34'; x.beginPath(); x.ellipse(hx, hy - BA_E - 0.45 * V, 0.45, 0.21, 0, 0, Math.PI * 2); x.fill();
      // pillars with lights
      for (const [px, py] of [[1.0, H - 0.8], [W - 1.0, H - 0.8], [0.6, 2.9], [W - 0.6, 2.9]]) { Art.cyl(x, px, py - BA_E, 0.14, 0.07, 0.9, wall); }
    },

    path(x, W, H, vt, rot, extra, rnd) {
      const mask = +extra || 0;
      const col = vt >= 1 ? '#c9b48a' : DATA.BUILDINGS.path.color;
      const bed = Col.shade(col, -0.35);
      x.fillStyle = Col.rgba(bed, 0.85);
      Art.rrect(x, 0.1, 0.1, 0.8, 0.8, 0.22); x.fill();
      if (mask & 1) x.fillRect(0.5, 0.1, 0.5, 0.8);
      if (mask & 4) x.fillRect(0, 0.1, 0.5, 0.8);
      if (mask & 2) x.fillRect(0.1, 0.5, 0.8, 0.5);
      if (mask & 8) x.fillRect(0.1, 0, 0.8, 0.5);
      const t = Art.tones(col);
      const stones = [];
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) stones.push([0.16 + i * 0.24 + (j % 2) * 0.06, 0.16 + j * 0.24]);
      const ext = []; if (mask & 1) ext.push([0.88, 0.28], [0.88, 0.52]); if (mask & 4) ext.push([-0.02, 0.4], [-0.02, 0.64]); if (mask & 2) ext.push([0.3, 0.88], [0.55, 0.88]); if (mask & 8) ext.push([0.42, -0.02], [0.2, -0.02]);
      for (const [sx, sy] of stones.concat(ext)) {
        const w = 0.18 + rnd() * 0.04, h = 0.17 + rnd() * 0.03, k = (rnd() - 0.5) * 0.18;
        x.fillStyle = 'rgba(0,0,0,.25)'; Art.rrect(x, sx + 0.015, sy + 0.025, w, h, 0.05); x.fill();
        const g = x.createLinearGradient(sx, sy, sx + w, sy + h); g.addColorStop(0, Col.shade(t.hi, k)); g.addColorStop(1, Col.shade(t.base, k));
        x.fillStyle = g; Art.rrect(x, sx, sy, w, h, 0.05); x.fill();
        if (vt >= 1 && rnd() < 0.3) { x.fillStyle = 'rgba(255,255,255,.18)'; Art.rrect(x, sx + 0.03, sy + 0.03, w * 0.4, h * 0.3, 0.02); x.fill(); }
      }
    },

    fence(x, W, H, vt, rot, extra, rnd) {
      const mask = +extra || 0, V = Art.V;
      const t = vt >= 1 ? Art.pal('white') : Art.tones(DATA.BUILDINGS.fence.color);
      const rail = (x0, y0, x1, y1) => {
        for (const hh of [0.42, 0.22]) {
          const o = hh * V;
          x.strokeStyle = t.edge; x.lineWidth = 0.07; x.beginPath(); x.moveTo(x0, y0 - o); x.lineTo(x1, y1 - o); x.stroke();
          x.strokeStyle = t.base; x.lineWidth = 0.04; x.stroke();
          x.strokeStyle = Col.rgba(t.rim, 0.8); x.lineWidth = 0.015; x.beginPath(); x.moveTo(x0, y0 - o - 0.012); x.lineTo(x1, y1 - o - 0.012); x.stroke();
        }
      };
      // shadow line on the ground
      x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 0.08; x.beginPath();
      if (mask & 1) { x.moveTo(0.55, 0.62); x.lineTo(1.05, 0.62); } if (mask & 4) { x.moveTo(-0.05, 0.62); x.lineTo(0.55, 0.62); }
      if (mask & 2) { x.moveTo(0.6, 0.6); x.lineTo(0.6, 1.05); } if (mask & 8) { x.moveTo(0.6, -0.05); x.lineTo(0.6, 0.6); }
      x.stroke();
      if (mask & 8) rail(0.5, 0, 0.5, 0.55);
      if (mask & 4) rail(0, 0.55, 0.5, 0.55);
      // post
      Art.box(x, 0.42, 0.48, 0.16, 0.12, 0.62, t, { r: 0.02, lw: 0.02 });
      if (mask & 1) rail(0.5, 0.55, 1, 0.55);
      if (mask & 2) rail(0.5, 0.55, 0.5, 1.05);
      if (!mask) { Art.box(x, 0.2, 0.5, 0.6, 0.06, 0.05, t); }
    },

    lamp(x, W, H, vt, rot, extra, rnd) {
      const V = Art.V, lv = +extra || 1;
      Art.cyl(x, 0.5, 0.72, 0.2, 0.1, 0.12, Art.pal('anth'));
      const pole = Art.pal('anth');
      BuildingArt.mast(x, 0.5, 0.72 - 0.07, 1.5, 0.07, pole);
      const hy = 0.72 - 1.57;
      // arm + lantern head
      x.strokeStyle = pole.base; x.lineWidth = 0.05; x.beginPath(); x.moveTo(0.5, hy + 0.12); x.quadraticCurveTo(0.5, hy - 0.02, 0.7, hy + 0.02); x.stroke();
      const heads = lv >= 2 ? [[0.72, hy + 0.08], [0.28, hy + 0.08]] : [[0.72, hy + 0.08]];
      if (lv >= 2) { x.beginPath(); x.moveTo(0.5, hy + 0.12); x.quadraticCurveTo(0.5, hy - 0.02, 0.3, hy + 0.02); x.stroke(); }
      for (const [lx, ly] of heads) {
        if (lv >= 3) { BuildingArt.sphere(x, lx, ly + 0.02, 0.13, Art.tones('#e8f6ff')); x.fillStyle = '#2a2f38'; x.fillRect(lx - 0.07, ly - 0.14, 0.14, 0.05); continue; }
        x.fillStyle = '#2a2f38'; x.beginPath(); x.moveTo(lx - 0.17, ly); x.lineTo(lx + 0.17, ly); x.lineTo(lx + 0.1, ly - 0.14); x.lineTo(lx - 0.1, ly - 0.14); x.closePath(); x.fill();
        x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(lx - 0.09, ly - 0.12, 0.05, 0.1);
        x.fillStyle = lv >= 2 ? '#d8f0ff' : '#ffe8a8'; x.beginPath(); x.ellipse(lx, ly + 0.035, 0.13, 0.06, 0, 0, Math.PI * 2); x.fill();
      }
    },

    flag(x, W, H, vt, rot, extra, rnd) {
      Art.cyl(x, 0.35, 0.78, 0.18, 0.09, 0.14, Art.pal('concrete'));
      BuildingArt.mast(x, 0.35, 0.78 - 0.08, 1.55, 0.05, Art.pal('white'));
      BuildingArt.sphere(x, 0.35, 0.78 - 1.65, 0.05, Art.pal('gold'));
    },

    plant(x, W, H, vt, rot, extra, rnd) {
      const lv = +extra || 1, V = Art.V;
      Art.cyl(x, 0.5, 0.62, 0.56, 0.3, 0.12, Art.pal('anth'));
      const cy = 0.62 - 0.12 * V;
      x.fillStyle = '#4a3a2a'; x.beginPath(); x.ellipse(0.5, cy, 0.5, 0.26, 0, 0, Math.PI * 2); x.fill();
      const col = DATA.BUILDINGS.plant.color;
      for (let i = 0; i < 3 + lv * 2; i++) {
        const a = rnd() * Math.PI * 2, r = rnd() * 0.3, px = 0.5 + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.5, h = 0.2 + rnd() * 0.3;
        x.strokeStyle = Col.shade(col, -0.3); x.lineWidth = 0.04; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + (rnd() - 0.5) * 0.2, py - h * 0.6, px + (rnd() - 0.5) * 0.15, py - h); x.stroke();
        x.fillStyle = i % 3 === 0 && lv >= 2 ? '#ff8ad8' : col; x.beginPath(); x.ellipse(px, py - h, 0.07, 0.05, rnd() * 3, 0, Math.PI * 2); x.fill();
      }
      // glass dome
      const g = x.createRadialGradient(0.36, cy - 0.45, 0.02, 0.5, cy - 0.2, 0.6);
      g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.4, 'rgba(190,240,255,.18)'); g.addColorStop(1, 'rgba(120,200,240,.3)');
      x.fillStyle = g; x.beginPath(); x.ellipse(0.5, cy, 0.52, 0.27, 0, 0, Math.PI); x.bezierCurveTo(0.5 - 0.52, cy - 0.9, 0.5 + 0.52, cy - 0.9, 0.5 + 0.52, cy); x.fill();
      x.strokeStyle = 'rgba(210,245,255,.85)'; x.lineWidth = 0.025; x.stroke();
      x.strokeStyle = 'rgba(210,245,255,.35)'; x.lineWidth = 0.015; x.beginPath(); x.moveTo(0.5, cy - 0.67); x.quadraticCurveTo(0.3, cy - 0.5, 0.18, cy + 0.15); x.moveTo(0.5, cy - 0.67); x.quadraticCurveTo(0.7, cy - 0.5, 0.82, cy + 0.15); x.stroke();
    },

    beacon(x, W, H, vt, rot, extra, rnd) {
      const V = Art.V, t = Art.pal('steel');
      Art.cyl(x, 0.5, 0.78, 0.3, 0.15, 0.15, Art.pal('anth'));
      // lattice tower
      const by = 0.78 - 0.08, ty = by - 1.65;
      x.strokeStyle = t.edge; x.lineWidth = 0.06; x.beginPath(); x.moveTo(0.32, by); x.lineTo(0.44, ty); x.moveTo(0.68, by); x.lineTo(0.56, ty); x.stroke();
      x.strokeStyle = t.base; x.lineWidth = 0.035; x.stroke();
      x.lineWidth = 0.02; x.beginPath(); for (let i = 0; i < 6; i++) { const y0 = by - i * 0.27, y1 = y0 - 0.27; const w0 = 0.18 - i * 0.02, w1 = w0 - 0.02; x.moveTo(0.5 - w0, y0); x.lineTo(0.5 + w1, y1); x.moveTo(0.5 + w0, y0); x.lineTo(0.5 - w1, y1); } x.stroke();
      // lamp housing
      Art.cyl(x, 0.5, ty + 0.05, 0.14, 0.07, 0.12, Art.pal('anth'));
      x.fillStyle = 'rgba(200,250,255,.7)'; x.beginPath(); x.ellipse(0.5, ty - 0.1, 0.11, 0.06, 0, 0, Math.PI * 2); x.fill();
      Art.cyl(x, 0.5, ty - 0.14, 0.13, 0.065, 0.06, Art.pal('anth'));
    }
  },

  node(x, type, vt, rot) {
    const V = Art.V;
    // belt plate under the node
    x.fillStyle = '#23262c'; Art.rrect(x, 0.04, 0.06, 0.92, 0.9, 0.08); x.fill();
    const col = DATA.BUILDINGS[type].color;
    const t = Art.tones(col);
    Art.box(x, 0.12, 0.16, 0.76, 0.72, 0.38, t, { r: 0.08 });
    const ty = 0.16 - 0.38 * V, cx = 0.5, cy = ty + 0.36;
    x.fillStyle = Col.rgba(t.edge, 0.55); Art.rrect(x, 0.2, ty + 0.07, 0.6, 0.58, 0.06); x.fill();
    const white = 'rgba(255,255,255,.92)';
    const arrow = (d, s, c) => { x.save(); x.translate(cx + U.DX[d] * 0.17, cy + U.DY[d] * 0.15); x.rotate(d * Math.PI / 2); x.beginPath(); x.moveTo(s, 0); x.lineTo(-s * 0.6, -s * 0.75); x.lineTo(-s * 0.25, 0); x.lineTo(-s * 0.6, s * 0.75); x.closePath(); x.fillStyle = c; x.fill(); x.restore(); };
    if (type === 'crossing') {
      x.fillStyle = white; x.fillRect(cx - 0.05, ty + 0.12, 0.1, 0.48); x.fillRect(0.26, cy - 0.05, 0.48, 0.1);
      x.fillStyle = Col.rgba(t.edge, 0.9); x.beginPath(); x.arc(cx, cy, 0.07, 0, Math.PI * 2); x.fill();
    } else if (type === 'merger') {
      arrow(rot, 0.13, white);
      for (const d of [(rot + 1) & 3, (rot + 2) & 3, (rot + 3) & 3]) { x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.arc(cx + U.DX[d] * 0.2, cy + U.DY[d] * 0.18, 0.04, 0, Math.PI * 2); x.fill(); }
    } else {
      arrow(rot, 0.12, white);
      const side = type === 'osplitter' ? 'rgba(255,255,255,.45)' : white;
      arrow((rot + 3) & 3, 0.1, side); arrow((rot + 1) & 3, 0.1, side);
      if (type === 'fsplitter') { x.fillStyle = '#10161c'; x.beginPath(); x.arc(cx, cy, 0.1, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#bff4ff'; x.lineWidth = 0.02; x.stroke(); }
    }
    Art.rivets(x, [[0.17, ty + 0.05], [0.83, ty + 0.05]], 0.02, Art.pal('steel'));
  },

  refinery(x, W, H, vt, rot, rnd, lvl) {
    const G = BuildingArt.GEO.refinery(lvl, vt), m = BuildingArt.mat(vt), V = Art.V;
    BuildingArt.foundation(x, W, H, vt, rnd);
    const def = DATA.BUILDINGS['refinery' + lvl];
    const hall = vt === 3 ? Art.pal('white') : Art.tones(Col.mix(def.color, '#2a3a40', vt === 0 ? 0.45 : 0.25));
    const accent = Art.tones(def.color);
    if (rot === 3) BuildingArt.chute(x, W, H, rot, m.trim, vt);
    // back structures (drawn before the hall)
    if (lvl === 1) {
      Art.cyl(x, 0.95, 0.8 - BA_E, 0.55, 0.28, 1.5, vt === 3 ? Art.pal('gold') : Art.tones('#b8826a'), { bands: 2 });
      x.fillStyle = '#ff9a4a'; x.beginPath(); x.ellipse(0.95, 0.8 - BA_E - 1.5 * V, 0.3, 0.14, 0, 0, Math.PI * 2); x.fill();
    } else if (lvl === 2) {
      Art.cyl(x, 0.65, 0.62 - BA_E, 0.28, 0.14, 2.3, accent, { bands: 4 });
      Art.cyl(x, 1.35, 0.66 - BA_E, 0.24, 0.12, 1.9, m.frame, { bands: 3 });
      Art.pipe(x, [[0.65, 0.62 - BA_E - 2.0 * V], [1.0, 0.5 - BA_E - 2.0 * V], [1.35, 0.66 - BA_E - 1.6 * V]], 0.06, m.trim);
      Art.pipe(x, [[0.9, 0.62 - BA_E - 0.9 * V], [1.15, 0.66 - BA_E - 0.9 * V]], 0.06, m.trim);
    } else {
      const sy = 0.78 - BA_E - 0.6;
      Art.cyl(x, 1.35, 0.78 - BA_E, 0.5, 0.25, 0.4, m.frame);
      BuildingArt.sphere(x, 1.35, sy - 0.1, 0.62, vt === 3 ? Art.pal('white') : Art.tones('#5a6aa8'));
      x.strokeStyle = '#1a1f30'; x.lineWidth = 0.06; x.beginPath(); x.ellipse(1.35, sy - 0.1, 0.62, 0.2, 0, 0, Math.PI); x.stroke();
      x.strokeStyle = 'rgba(160,180,255,.9)'; x.lineWidth = 0.03; x.beginPath(); x.ellipse(1.35, sy - 0.1, 0.62, 0.2, 0, 0.1, Math.PI - 0.1); x.stroke();
    }
    for (const [cx, cyb, ch] of lvl === 1 ? [[2.35, 0.62, 2.2]] : lvl === 2 ? [[2.4, 0.6, 2.5]] : [[2.3, 0.42, 2.7], [2.62, 0.7, 2.4], [0.42, 0.55, 2.5]]) {
      Art.cyl(x, cx, cyb - BA_E, lvl === 3 ? 0.11 : 0.16, lvl === 3 ? 0.055 : 0.08, ch, vt >= 2 ? m.frame : Art.tones('#4a4f58'), { bands: lvl === 3 ? 3 : 2 });
      x.fillStyle = '#0b0c0f'; x.beginPath(); x.ellipse(cx, cyb - BA_E - ch * V, lvl === 3 ? 0.08 : 0.12, lvl === 3 ? 0.04 : 0.06, 0, 0, Math.PI * 2); x.fill();
      if (vt >= 1) { x.fillStyle = '#e0473a'; x.fillRect(cx - (lvl === 3 ? 0.11 : 0.16), cyb - BA_E - ch * V + 0.06, lvl === 3 ? 0.22 : 0.32, 0.05); }
    }
    // hall
    Art.box(x, 0.2, G.hallY, 2.6, G.hallD, G.hallH, hall, { r: 0.08 });
    const fy0 = G.hallY + G.hallD - G.hallH * V;
    // input hoppers on the sides
    for (const sx of [0.2, 2.8]) { x.fillStyle = m.frame.lo; x.beginPath(); x.moveTo(sx - 0.18, fy0 - 0.4); x.lineTo(sx + 0.18, fy0 - 0.4); x.lineTo(sx + 0.08, fy0 - 0.1); x.lineTo(sx - 0.08, fy0 - 0.1); x.closePath(); x.fill(); x.strokeStyle = m.frame.edge; x.lineWidth = 0.025; x.stroke(); }
    // skylight frame (glow animated)
    const [sx, sy, sw, sh] = G.sky;
    x.fillStyle = Col.shade(hall.lo, -0.2); Art.rrect(x, sx - 0.06, sy - 0.06, sw + 0.12, sh + 0.12, 0.1); x.fill();
    x.fillStyle = '#0c1416'; Art.rrect(x, sx, sy, sw, sh, 0.08); x.fill();
    x.strokeStyle = Col.rgba(m.frame.base, 0.9); x.lineWidth = 0.03; x.beginPath(); for (let i = 1; i < 4; i++) { x.moveTo(sx + sw * i / 4, sy); x.lineTo(sx + sw * i / 4, sy + sh); } x.stroke();
    // front face stripes and vents
    x.fillStyle = accent.base; x.fillRect(0.2, fy0 + 0.03, 2.6, 0.06);
    if (lvl >= 2) x.fillRect(0.2, fy0 + 0.12, 2.6, 0.03);
    if (lvl === 3) { x.fillStyle = '#a8b8ff'; x.fillRect(0.2, fy0 + 0.19, 2.6, 0.02); }
    BuildingArt.vent(x, 0.35, fy0 + 0.17, 0.5, G.hallH * V - 0.25);
    BuildingArt.vent(x, 2.15, fy0 + 0.17, 0.5, G.hallH * V - 0.25);
    // tier marks: roof vents / solar / gold trims
    if (vt >= 1) { BuildingArt.vent(x, 0.4, G.ty + 0.15, 0.24, 0.2); BuildingArt.vent(x, 2.36, G.ty + 0.15, 0.24, 0.2); }
    if (vt >= 2) Art.pipe(x, [[0.3, G.ty + 1.55], [2.7, G.ty + 1.55]], 0.06, m.trim);
    if (vt === 0) BuildingArt.rust(x, rnd, 0.2, G.ty, 2.6, G.hallD + G.hallH * V, 10);
    // stamp a small level badge plate: number of rings = refinery level
    for (let i = 0; i < lvl; i++) { x.fillStyle = accent.hi; x.beginPath(); x.arc(1.3 + i * 0.2, fy0 + G.hallH * V * 0.55, 0.05, 0, Math.PI * 2); x.fill(); x.strokeStyle = accent.edge; x.lineWidth = 0.02; x.stroke(); }
    if (rot !== 3) BuildingArt.chute(x, W, H, rot, m.trim, vt);
  },

  tent(x, tx, ty, tw, td, th, c1, c2) {
    // conical tent: striped segments lit by their facing, entrance flap at the front
    const V = Art.V, cx = tx + tw / 2, cy = ty + td * 0.62, rx = tw * 0.62, ry = td * 0.34, hv = th * V * 1.6;
    const t1 = Art.tones(c1), t2 = Art.tones(c2);
    x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(cx + 0.2, cy + 0.08, rx * 1.1, ry * 1.1, 0, 0, Math.PI * 2); x.fill();
    const n = 12, ax = cx, ay = cy - hv;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      const am = (a0 + a1) / 2;
      if (Math.sin(am) < -0.05) continue; // back half hidden
      const lit = Math.cos(am) * Art.LX + Math.sin(am) * 0.3 * Art.LY;
      const t = i % 2 ? t2 : t1;
      x.fillStyle = lit > 0.25 ? t.hi : lit > -0.25 ? t.base : t.lo;
      x.beginPath(); x.moveTo(ax, ay); x.lineTo(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry); x.lineTo(cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry); x.closePath(); x.fill();
    }
    // back silhouette for the upper part
    x.fillStyle = t1.lo; x.beginPath(); x.moveTo(ax, ay); x.lineTo(cx - rx, cy); x.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2); x.closePath();
    x.globalCompositeOperation = 'destination-over'; x.fill(); x.globalCompositeOperation = 'source-over';
    // entrance flap
    x.fillStyle = '#2a1a10'; x.beginPath(); x.moveTo(cx - 0.02, cy + ry * 0.98); x.lineTo(ax + 0.04, ay + hv * 0.45); x.lineTo(cx + 0.2, cy + ry * 0.92); x.closePath(); x.fill();
    x.fillStyle = t2.hi; x.beginPath(); x.moveTo(ax + 0.04, ay + hv * 0.45); x.lineTo(cx + 0.2, cy + ry * 0.92); x.lineTo(cx + 0.32, cy + ry * 0.85); x.closePath(); x.fill();
    x.strokeStyle = t1.edge; x.lineWidth = 0.03; x.beginPath(); x.moveTo(cx - rx, cy); x.lineTo(ax, ay); x.lineTo(cx + rx, cy); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); x.stroke();
    // pole tip with a small pennant
    x.strokeStyle = '#5a3a1a'; x.lineWidth = 0.04; x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax, ay - 0.25); x.stroke();
    x.fillStyle = t2.base; x.beginPath(); x.moveTo(ax, ay - 0.25); x.lineTo(ax + 0.22, ay - 0.2); x.lineTo(ax, ay - 0.14); x.closePath(); x.fill();
  },

  octPad(x, cx, cy, r, vt) {
    const pts = []; for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9]); }
    x.fillStyle = 'rgba(0,0,0,.3)'; x.save(); x.translate(0.06, 0.1); Art.poly(x, pts); x.fill(); x.restore();
    const t = Art.tones(vt === 3 ? '#a8b0bc' : '#5a606a');
    const g = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g.addColorStop(0, t.hi); g.addColorStop(1, t.lo);
    x.fillStyle = g; Art.poly(x, pts); x.fill(); x.strokeStyle = t.edge; x.lineWidth = 0.05; x.stroke();
    x.strokeStyle = '#f2c230'; x.lineWidth = 0.08; x.beginPath(); x.ellipse(cx, cy, r * 0.72, r * 0.65, 0, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(245,245,240,.85)'; x.lineWidth = 0.05; x.beginPath(); x.moveTo(cx - r * 0.35, cy); x.lineTo(cx + r * 0.35, cy); x.moveTo(cx, cy - r * 0.32); x.lineTo(cx, cy + r * 0.32); x.stroke();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.fillStyle = '#1c1e22'; x.beginPath(); x.arc(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.77, 0.06, 0, Math.PI * 2); x.fill(); }
  },

  dish(x, cx, cy, r, vt) {
    x.save(); x.translate(cx, cy); x.rotate(-0.5);
    const g = x.createLinearGradient(-r, -r * 0.5, r, r * 0.5); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#9aa4b8');
    x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#5a6478'; x.lineWidth = 0.04; x.stroke();
    x.fillStyle = 'rgba(80,90,110,.35)'; x.beginPath(); x.ellipse(r * 0.12, r * 0.06, r * 0.7, r * 0.36, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#6a7488'; x.lineWidth = 0.03; x.beginPath(); x.moveTo(-r * 0.6, -r * 0.3); x.lineTo(0, -r * 0.9); x.lineTo(r * 0.6, -r * 0.3); x.stroke();
    x.fillStyle = vt === 3 ? '#f2c14b' : '#ff5fa8'; x.beginPath(); x.arc(0, -r * 0.9, 0.07, 0, Math.PI * 2); x.fill();
    x.restore();
  },

  // ---------------- small animated part sprites ----------------
  bitSprite(vt, ppt) {
    return Art.cached('B|bit|' + vt + '|' + ppt, () => {
      const S = Math.ceil(ppt * 1.1), c = Art.canvas(S, S), x = c.getContext('2d');
      x.translate(S / 2, S / 2); x.scale(S / 1.1, S / 1.1);
      const steel = vt === 3 ? Art.pal('gold') : Art.pal('steel');
      x.fillStyle = '#2a2d33'; x.beginPath(); x.arc(0, 0, 0.44, 0, Math.PI * 2); x.fill();
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; x.fillStyle = vt >= 2 ? '#f2c14b' : '#c9ced6'; x.beginPath(); x.moveTo(Math.cos(a) * 0.38, Math.sin(a) * 0.38); x.lineTo(Math.cos(a + 0.18) * 0.5, Math.sin(a + 0.18) * 0.5); x.lineTo(Math.cos(a + 0.3) * 0.38, Math.sin(a + 0.3) * 0.38); x.fill(); }
      for (let i = 0; i < 3; i++) {
        x.rotate(Math.PI * 2 / 3);
        x.fillStyle = steel.hi; x.beginPath(); x.moveTo(0.06, 0); x.quadraticCurveTo(0.25, -0.2, 0.42, -0.1); x.lineTo(0.42, 0.06); x.quadraticCurveTo(0.22, -0.02, 0.06, 0.1); x.closePath(); x.fill();
        x.strokeStyle = steel.edge; x.lineWidth = 0.02; x.stroke();
      }
      x.fillStyle = steel.base; x.beginPath(); x.arc(0, 0, 0.12, 0, Math.PI * 2); x.fill(); x.strokeStyle = steel.edge; x.lineWidth = 0.025; x.stroke();
      return c;
    });
  },
  gearSprite(vt, ppt) {
    return Art.cached('B|gear|' + vt + '|' + ppt, () => {
      const S = Math.ceil(ppt * 1.5), c = Art.canvas(S, S), x = c.getContext('2d');
      x.translate(S / 2, S / 2); x.scale(S / 1.5, S / 1.5);
      const t = vt === 3 ? Art.pal('gold') : Art.pal('brass');
      x.beginPath();
      for (let i = 0; i < 20; i++) { const a0 = i * Math.PI / 10, a1 = a0 + Math.PI / 20; x.lineTo(Math.cos(a0) * 0.72, Math.sin(a0) * 0.72); x.lineTo(Math.cos(a0 + 0.04) * 0.6, Math.sin(a0 + 0.04) * 0.6); x.lineTo(Math.cos(a1 + 0.06) * 0.6, Math.sin(a1 + 0.06) * 0.6); x.lineTo(Math.cos(a1 + 0.1) * 0.72, Math.sin(a1 + 0.1) * 0.72); }
      x.closePath();
      const g = x.createLinearGradient(-0.7, -0.7, 0.7, 0.7); g.addColorStop(0, t.hi); g.addColorStop(1, t.lo);
      x.fillStyle = g; x.fill(); x.strokeStyle = t.edge; x.lineWidth = 0.03; x.stroke();
      x.fillStyle = Col.rgba(t.lo, 0.9);
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; x.beginPath(); x.ellipse(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.11, 0.08, a, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#2a2d33'; x.beginPath(); x.arc(0, 0, 0.14, 0, Math.PI * 2); x.fill();
      x.fillStyle = t.hi; x.beginPath(); x.arc(0, 0, 0.07, 0, Math.PI * 2); x.fill();
      return c;
    });
  },
  dishSprite(ppt) {
    return Art.cached('B|dish|' + ppt, () => {
      const S = Math.ceil(ppt * 1.2), c = Art.canvas(S, S), x = c.getContext('2d');
      x.translate(S / 2, S / 2); x.scale(S / 1.2, S / 1.2);
      const g = x.createLinearGradient(-0.5, -0.3, 0.5, 0.3); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#a0aabb');
      x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 0.5, 0.3, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#5a6478'; x.lineWidth = 0.03; x.stroke();
      x.fillStyle = 'rgba(80,90,110,.3)'; x.beginPath(); x.ellipse(0.05, 0.04, 0.36, 0.2, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#6a7488'; x.lineWidth = 0.02; x.beginPath(); x.moveTo(-0.3, -0.15); x.lineTo(0, -0.45); x.lineTo(0.3, -0.15); x.stroke();
      x.fillStyle = '#ff6a6a'; x.beginPath(); x.arc(0, -0.45, 0.04, 0, Math.PI * 2); x.fill();
      return c;
    });
  },

  // ---------------- cast shadows ----------------
  SH: {},
  shadowBoxes(type, W, H, vt) {
    const k = type + W + 'x' + H + vt;
    let s = BuildingArt.SH[k];
    if (s) return s;
    const V = Art.V;
    switch (type) {
      case 'extractor': s = [[0.14, 0.18, 1.72, 0.72, 0.85 + vt * 0.12], [0.85, 1.2, 0.3, 0.2, 1.0 + vt * 0.12]]; break;
      case 'silo': s = [[0.45, 1.1, 2.1, 1.0, 2.6 + vt * 0.2]]; break;
      case 'refinery1': case 'refinery2': case 'refinery3': s = [[0.2, 0.95, 2.6, 1.85, 0.9], [0.5, 0.4, 1.2, 0.5, 2.0], [2.2, 0.5, 0.3, 0.2, 2.4]]; break;
      case 'cooler': s = [[0.35, 1.0, 1.3, 0.7, 2.2 + vt * 0.2]]; break;
      case 'servo': s = [[0.14, 0.16, 1.72, 1.66, 0.55]]; break;
      case 'charger': s = [[0.16, 0.16, 1.68, 1.68, 0.35], [0.4, 0.6, 1.2, 0.9, 1.3]]; break;
      case 'lab': s = [[0.3, 1.55, 3.4, 2.1, 1.0], [0.6, 0.9, 1.6, 0.9, 2.0]]; break;
      case 'bazaar': s = [[0.1, 0.1, W - 0.2, H * 0.6, 1.3]]; break;
      case 'caravan': s = [[0.1, 0.1, W - 0.2, 0.25, 0.4], [0.45, 1.35, 1.1, 1.4, 1.0], [W - 1.55, 1.35, 1.1, 1.4, 1.0]]; break;
      case 'shuttlepad': s = [[0.12, 0.12, W - 0.24, H - 0.24, 0.2], [W - 1.05, 0.15, 0.7, 0.5, 0.75]]; break;
      case 'port': s = [[W / 2 - 0.45, 0.25, 0.9, 0.8, 3.0], [0.45, 0.35, W - 0.9, 0.55, 0.55], [0.48, H - 0.8, 0.14, 0.14, 3.6], [W - 0.62, H - 0.8, 0.14, 0.14, 3.6]]; break;
      case 'dock': s = [[0.3, 0.35, 1.6, 1.0, 1.0], [0.9, 7.45, 0.3, 0.3, 3.2], [W - 1.2, 7.45, 0.3, 0.3, 3.2], [0.2, 2.4, 1.3, 5.4, 1.0], [W - 1.55, 2.4, 1.3, 5.4, 1.0]]; break;
      case 'terminal': s = [[0.4, 0.5, 2.8, 1.6, 1.4], [W - 2.05, 0.9, 0.9, 0.9, 2.6]]; break;
      case 'lamp': s = [[0.46, 0.66, 0.08, 0.08, 2.7]]; break;
      case 'flag': s = [[0.32, 0.68, 0.06, 0.06, 2.9]]; break;
      case 'beacon': s = [[0.4, 0.7, 0.2, 0.1, 3.0]]; break;
      case 'plant': s = [[0.1, 0.4, 0.8, 0.4, 0.9]]; break;
      case 'fence': s = [[0.42, 0.48, 0.16, 0.12, 0.6]]; break;
      case 'splitter': case 'merger': case 'crossing': case 'fsplitter': case 'osplitter': s = [[0.12, 0.16, 0.76, 0.72, 0.38]]; break;
      case 'path': case 'belt': case 'bridge': s = []; break;
      default: s = [[0.1, 0.1, W - 0.2, H - 0.2, 0.6]];
    }
    BuildingArt.SH[k] = s;
    return s;
  },
  // adds cast-shadow hexagons of all buildings to one path; filled once
  castShadows(ctx, g, vis) {
    const sun = Render.sun(g);
    if (sun.a < 0.02) return;
    const sx = sun.dx * Art.V * 1.5, sy = sun.dy * Art.V * 1.5;
    ctx.beginPath();
    let any = false;
    for (const b of vis) {
      if (b.type === 'belt' || b.type === 'path' || b.type === 'bridge') continue;
      const boxes = BuildingArt.shadowBoxes(b.type, b.w, b.h, VT(b.level));
      const bx = b.x - Render.ox, by = b.y - Render.oy;
      for (const [x0, y0, w, h, hh] of boxes) {
        const X = bx + x0, Y = by + y0, ox = sx * hh, oy = sy * hh;
        ctx.moveTo(X, Y); ctx.lineTo(X + w, Y); ctx.lineTo(X + w + ox, Y + oy); ctx.lineTo(X + w + ox, Y + h + oy); ctx.lineTo(X + ox, Y + h + oy); ctx.lineTo(X, Y + h); ctx.closePath();
        any = true;
      }
    }
    if (!any) return;
    ctx.fillStyle = 'rgba(10,8,20,' + sun.a.toFixed(3) + ')';
    ctx.fill('nonzero');
  },

  // ---------------- night lights (emissive points, relative to the footprint) ----------------
  LT: {},
  lights(b) {
    const vt = VT(b.level), k = b.type + vt + b.w + 'x' + b.h + (b.type === 'lamp' ? b.level : '');
    let L = BuildingArt.LT[k];
    if (L) return L;
    const V = Art.V;
    switch (b.type) {
      case 'extractor': { const G = BuildingArt.GEO.extractor(vt); L = [[G.win[0] + G.win[2] / 2, G.win[1] + G.win[3] / 2, 1.4, '#ffb070'], [1.0, 1.36, 1.6, '#ff9a4a']]; break; }
      case 'silo': { const G = BuildingArt.GEO.silo(vt); L = [[G.cx, G.win[1] + G.win[3] / 2, 1.6, '#9fd8ff'], [G.cx, G.top - 0.5, 1.0, '#ffffff']]; break; }
      case 'refinery1': case 'refinery2': case 'refinery3': { const G = BuildingArt.GEO.refinery(REFINERY_LEVEL[b.type], vt); L = [[G.sky[0] + G.sky[2] / 2, G.sky[1] + G.sky[3] / 2, 3.2, DATA.BUILDINGS[b.type].color]]; break; }
      case 'cooler': L = [[1.0, 1.38 - BA_E - (2.1 + vt * 0.2) * V, 1.4, '#bfe8ff']]; break;
      case 'servo': L = [[1.0, 0.8, 1.6, '#ffd27a']]; break;
      case 'charger': { const G = BuildingArt.GEO.charger(vt); L = [[G.rod[0], G.rod[1], 2.4, '#9bf06a']]; break; }
      case 'lab': { const G = BuildingArt.GEO.lab(vt); L = [[2.0, G.by + 2.1 - G.bh * V + 0.25, 4.2, '#ffe0a8'], [G.dish[0], G.dish[1], 1.2, '#ff6a6a']]; break; }
      case 'bazaar': L = [[b.w / 2, b.h * 0.52 - 0.3, 3.4, '#ffcf7a']]; break;
      case 'caravan': L = [[b.w / 2, 1.0, 2.6, '#ffb070'], [b.w / 2, b.h - 0.8, 3.2, '#ffcf7a']]; break;
      case 'shuttlepad': L = [[0.42, 0.31, 1.5, '#ff6a5a'], [b.w - 0.42, 0.31, 1.5, '#ff6a5a'], [0.42, b.h - 0.53, 1.5, '#ff6a5a'], [b.w - 0.42, b.h - 0.53, 1.5, '#ff6a5a'], [b.w / 2, b.h / 2, 4.5, '#9fd8ff']]; break;
      case 'port': L = [[1.95, 3.9, 4, '#9fd8ff'], [5.05, 3.9, 4, '#9fd8ff'], [3.5, 1.05 - BA_E - (2.6 + vt * 0.25) * V + 0.4, 2.4, '#bfe8ff']]; break;
      case 'dock': L = [[b.w / 2, b.h / 2 + 0.6, 7, '#ffd0a0'], [1.1, 1.0, 2, '#ffe0a8']]; break;
      case 'terminal': L = [[b.w / 2, b.h - 2.2 - 0.9, 4.5, '#ff9fd0'], [1.8, 1.3, 3.5, '#ffb8e0']]; break;
      case 'lamp': L = b.level >= 2 ? [[0.72, -0.8, 3.2, '#d8f0ff'], [0.28, -0.8, 3.2, '#d8f0ff']] : [[0.72, -0.8, 3.0 + b.level * 0.4, '#ffe28a']]; break;
      case 'beacon': L = [[0.5, -1.0, 2.6, '#7fe0ff']]; break;
      case 'plant': L = [[0.5, 0.3, 1.4, '#a0ffb0']]; break;
      default: L = [];
    }
    BuildingArt.LT[k] = L;
    return L;
  },

  // ---------------- status badges (instead of warning triangles) ----------------
  badge(ctx, b, tm) {
    const x = b.x + b.w - 0.15 - Render.ox, y0 = b.y - Render.oy - (BuildingArt.TOP[b.type] || 1) * 0.45;
    const s = Math.max(0.2, 9 / App.cam.zoom);
    const y = y0 + Math.sin(tm * 3 + b.id) * s * 0.12;
    const red = b.warn === 'full' || b.warn === 'empty' || b.warn === 'nocon';
    const col = red ? '#ff5a5a' : '#ffc24d';
    const pulse = 1 + Math.max(0, Math.sin(tm * 5 + b.id)) * 0.08;
    ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(s * 0.08, s * 0.12, s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a1214'; ctx.lineWidth = s * 0.14; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(-s * 0.3, -s * 0.35, s * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a1214'; ctx.fillStyle = '#1a1214'; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
    const w = b.warn;
    ctx.beginPath();
    if (w === 'full' || w === 'nearfull') { const n = w === 'full' ? 3 : 2; for (let i = 0; i < n; i++) { const yy = s * 0.35 - i * s * 0.32; ctx.moveTo(-s * 0.42, yy); ctx.lineTo(s * 0.42, yy); } ctx.stroke(); }
    else if (w === 'empty') { ctx.lineWidth = s * 0.12; ctx.strokeRect(-s * 0.42, -s * 0.3, s * 0.84, s * 0.66); ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.3); ctx.lineTo(0, -s * 0.05); ctx.lineTo(s * 0.42, -s * 0.3); ctx.stroke(); }
    else if (w === 'nocon') { ctx.lineWidth = s * 0.13; ctx.beginPath(); ctx.arc(-s * 0.28, s * 0.08, s * 0.22, Math.PI * 0.3, Math.PI * 1.7); ctx.stroke(); ctx.beginPath(); ctx.arc(s * 0.28, -s * 0.08, s * 0.22, Math.PI * 1.3, Math.PI * 0.7); ctx.stroke(); }
    else if (w === 'blocked') { ctx.fillRect(-s * 0.36, -s * 0.42, s * 0.24, s * 0.84); ctx.fillRect(s * 0.12, -s * 0.42, s * 0.24, s * 0.84); }
    else if (w === 'wrong') { ctx.moveTo(-s * 0.35, -s * 0.35); ctx.lineTo(s * 0.35, s * 0.35); ctx.moveTo(s * 0.35, -s * 0.35); ctx.lineTo(-s * 0.35, s * 0.35); ctx.stroke(); }
    else { ctx.moveTo(0, -s * 0.45); ctx.lineTo(0, s * 0.1); ctx.stroke(); ctx.beginPath(); ctx.arc(0, s * 0.42, s * 0.1, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
};
