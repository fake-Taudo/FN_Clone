// =====================================================================
// Art: central art direction (light, palettes, tones, materials, easing,
// 2.5D primitives, LRU sprite cache). Everything visual builds on this.
// =====================================================================
const Art = {
  // Global light from the top left (screen space, normalised)
  LX: -0.62, LY: -0.78,
  V: 0.55,            // vertical projection: 1 tile of height = 0.55 tiles upwards on screen
  SHADOW: [0.55, 0.38], // cast shadow direction per tile of height (towards bottom right)

  // Global building palette: [light, base, shadow]
  PAL: {
    orange:   ['#ffb46e', '#f0842f', '#a9521d'],
    rust:     ['#c98a62', '#9a5a3a', '#5e3322'],
    steel:    ['#b6c8da', '#7891ab', '#46596e'],
    teal:     ['#7ae6d6', '#26aa9b', '#13665e'],
    brass:    ['#f6d98f', '#c99d48', '#80612a'],
    anth:     ['#636a79', '#3d4350', '#23272f'],
    warn:     ['#ff8f80', '#e0473a', '#8a2520'],
    concrete: ['#d3ccbf', '#a69e91', '#6f685e'],
    white:    ['#fbfcfe', '#dce1ea', '#a2aab8'],
    gold:     ['#fff0b0', '#f2c14b', '#a3761b'],
    glass:    ['#e6f8ff', '#8fd3f0', '#3f86ab'],
    cloth1:   ['#ff9ab8', '#e0507e', '#8f2a4d'],
    cloth2:   ['#ffe08a', '#f0b43a', '#9a6a14'],
    violet:   ['#c8a0ff', '#8a5ad6', '#4f2f8a'],
    green:    ['#a6f08a', '#4fc25a', '#2a7232']
  },

  tones(hex) {
    return { hi: Col.shade(hex, 0.32), base: hex, lo: Col.shade(hex, -0.32), edge: Col.shade(hex, -0.62), rim: Col.shade(hex, 0.55) };
  },
  pal(name) { const p = Art.PAL[name]; return { hi: p[0], base: p[1], lo: p[2], edge: Col.shade(p[2], -0.45), rim: Col.shade(p[0], 0.4) }; },

  // ---------------- easing ----------------
  ease: {
    linear: t => t,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) * 0.6 + 1,
    // damped spring step 0..1 -> overshoots slightly and settles
    spring: t => 1 - Math.exp(-6 * t) * Math.cos(9 * t)
  },
  clamp01: t => t < 0 ? 0 : t > 1 ? 1 : t,
  // deterministic per-object phase 0..1 so that equal machines never run in sync
  phase(id) { return (RNG.hash(id | 0, 911) % 10000) / 10000; },

  // ---------------- canvas + LRU cache ----------------
  canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; },
  cache: new Map(),
  cacheBytes: 0,
  budget() { return App.touch ? 48e6 : 110e6; },
  tick: 0, // advanced once per frame; hits only stamp the entry (no Map re-ordering on the hot path)
  cached(key, make) {
    let e = Art.cache.get(key);
    if (e) { e.t = Art.tick; return e.v; }
    const v = make();
    const c = v && (v.canvas || v);
    const bytes = c && c.width ? c.width * c.height * 4 : 1000;
    e = { v, bytes, t: Art.tick };
    Art.cache.set(key, e);
    Art.cacheBytes += bytes;
    if (Art.cacheBytes > Art.budget()) {
      const arr = [...Art.cache.entries()].sort((a, b) => a[1].t - b[1].t);
      for (const [k, old] of arr) {
        if (Art.cacheBytes <= Art.budget() * 0.8 || old.t >= Art.tick) break;
        Art.cache.delete(k); Art.cacheBytes -= old.bytes;
      }
    }
    return v;
  },
  clearPlanet() {
    for (const [k, e] of Art.cache) if (k.startsWith('P|')) { Art.cache.delete(k); Art.cacheBytes -= e.bytes; }
  },
  // pick a cache resolution (device px per tile) for a requested scale
  bucket(px, maxB = 128) {
    const B = [12, 16, 24, 32, 48, 64, 96, 128, 192];
    for (const b of B) if (b >= px * 0.92) return Math.min(b, maxB);
    return maxB;
  },

  // ---------------- 2.5D primitives (tile units) ----------------
  // Box on the ground rect (x, y, w, d) with height H. Draws front + top faces.
  box(ctx, x, y, w, d, H, t, o = {}) {
    const hv = H * Art.V;
    const r = o.r || 0;
    // front face
    if (hv > 0.005) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, t.base); g.addColorStop(1, t.lo);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y + d - hv - r); ctx.lineTo(x + w, y + d - hv - r); ctx.lineTo(x + w, y + d - r);
      ctx.quadraticCurveTo(x + w, y + d, x + w - r, y + d); ctx.lineTo(x + r, y + d); ctx.quadraticCurveTo(x, y + d, x, y + d - r);
      ctx.closePath(); ctx.fill();
      // bottom contact darkening
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y + d - Math.min(0.06, hv * 0.3), w, Math.min(0.06, hv * 0.3));
    }
    // top face
    const ty = y - hv;
    const g2 = ctx.createLinearGradient(x, ty, x + w * 0.6, ty + d);
    g2.addColorStop(0, o.topHi || t.hi); g2.addColorStop(1, o.top || t.base);
    ctx.fillStyle = g2;
    Art.rrect(ctx, x, ty, w, d, r); ctx.fill();
    // rim light (top + left) and dark edge (bottom + right)
    const lw = o.lw || 0.035;
    ctx.lineWidth = lw;
    ctx.strokeStyle = Col.rgba(t.rim, 0.75);
    ctx.beginPath(); ctx.moveTo(x + r, ty + lw); ctx.lineTo(x + w - r, ty + lw); ctx.moveTo(x + lw, ty + r); ctx.lineTo(x + lw, ty + d - r); ctx.stroke();
    // outline
    ctx.strokeStyle = t.edge; ctx.lineWidth = o.outline || 0.045;
    ctx.beginPath();
    Art.rrectPath(ctx, x, ty, w, d, r);
    if (hv > 0.005) { ctx.moveTo(x, ty + d - r); ctx.lineTo(x, y + d - r); ctx.moveTo(x + w, ty + d - r); ctx.lineTo(x + w, y + d - r); ctx.moveTo(x + r, y + d); ctx.lineTo(x + w - r, y + d); }
    ctx.stroke();
    return { x, y: ty, w, h: d };
  },
  // Vertical cylinder standing on the ground ellipse centred at (cx, cy).
  cyl(ctx, cx, cy, rx, ry, H, t, o = {}) {
    const hv = H * Art.V;
    const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, t.hi); g.addColorStop(0.35, t.base); g.addColorStop(1, t.lo);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy - hv); ctx.lineTo(cx - rx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, cy - hv);
    ctx.closePath(); ctx.fill();
    // bands
    if (o.bands) { ctx.strokeStyle = Col.rgba(t.lo, 0.7); ctx.lineWidth = 0.03; for (let i = 1; i <= o.bands; i++) { const yy = cy - hv * i / (o.bands + 1); ctx.beginPath(); ctx.ellipse(cx, yy, rx, ry, 0, 0, Math.PI); ctx.stroke(); } }
    // top
    const tg = ctx.createLinearGradient(cx - rx, cy - hv - ry, cx + rx, cy - hv + ry);
    tg.addColorStop(0, o.topHi || t.rim); tg.addColorStop(1, o.top || t.base);
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.ellipse(cx, cy - hv, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = t.edge; ctx.lineWidth = o.outline || 0.045;
    ctx.beginPath(); ctx.ellipse(cx, cy - hv, rx, ry, 0, 0, Math.PI * 2);
    ctx.moveTo(cx - rx, cy - hv); ctx.lineTo(cx - rx, cy); ctx.moveTo(cx + rx, cy - hv); ctx.lineTo(cx + rx, cy);
    ctx.moveTo(cx + rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
    ctx.stroke();
    // specular stripe
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(cx - rx * 0.62, cy - hv + ry * 0.2, rx * 0.12, hv);
    return { top: cy - hv };
  },
  dome(ctx, cx, cy, rx, ry, H, t) {
    const hv = H * Art.V;
    const g = ctx.createRadialGradient(cx - rx * 0.35, cy - hv * 0.7, rx * 0.05, cx, cy - hv * 0.3, rx * 1.1);
    g.addColorStop(0, t.rim); g.addColorStop(0.45, t.base); g.addColorStop(1, t.lo);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); ctx.bezierCurveTo(cx - rx, cy - hv * 1.2, cx + rx, cy - hv * 1.2, cx + rx, cy);
    ctx.fill();
    ctx.strokeStyle = t.edge; ctx.lineWidth = 0.045; ctx.stroke();
  },
  rrectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  },
  rrect(ctx, x, y, w, h, r) { ctx.beginPath(); Art.rrectPath(ctx, x, y, w, h, r); },
  // contact shadow (ambient occlusion) under an object
  contact(ctx, x, y, w, d, a = 0.35) {
    const g = ctx.createRadialGradient(x + w / 2, y + d / 2, Math.min(w, d) * 0.3, x + w / 2, y + d / 2, Math.max(w, d) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - w * 0.15, y - d * 0.15, w * 1.3, d * 1.3);
  },
  rivets(ctx, pts, r = 0.035, t = Art.pal('steel')) {
    for (const [x, y] of pts) {
      ctx.fillStyle = t.lo; ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.3, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = t.hi; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  },
  hazard(ctx, x, y, w, h) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#f2c230'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#26231f';
    for (let i = -h * 2; i < w + h; i += 0.2) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.lineTo(x + i + h + 0.1, y); ctx.lineTo(x + i + 0.1, y + h); ctx.fill(); }
    ctx.restore();
  },
  pipe(ctx, pts, w, t) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = t.edge; ctx.lineWidth = w + 0.05; Art.polyline(ctx, pts); ctx.stroke();
    ctx.strokeStyle = t.base; ctx.lineWidth = w; Art.polyline(ctx, pts); ctx.stroke();
    ctx.strokeStyle = Col.rgba(t.rim, 0.6); ctx.lineWidth = w * 0.3; ctx.save(); ctx.translate(-w * 0.18, -w * 0.18); Art.polyline(ctx, pts); ctx.stroke(); ctx.restore();
  },
  polyline(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); },
  poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); },
  light(ctx, x, y, r, color, a = 1) {
    ctx.fillStyle = Col.rgba(color, 0.35 * a); ctx.beginPath(); ctx.arc(x, y, r * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
  },
  window(ctx, x, y, w, h, lit, color = '#ffd88a') {
    ctx.fillStyle = lit ? color : '#20262f'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = lit ? 'rgba(255,255,255,.45)' : 'rgba(140,170,200,.35)'; ctx.fillRect(x, y, w * 0.35, h);
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 0.025; ctx.strokeRect(x, y, w, h);
  },

  // ---------------- facet helpers for organic shapes ----------------
  // Polygon split into triangles from a centre; each facet lit by its normal.
  facets(ctx, pts, cx, cy, t, o = {}) {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
      const len = Math.hypot(mx, my) || 1;
      const dot = (mx / len) * Art.LX + (my / len) * Art.LY; // -1..1 (1 = facing the light)
      const k = dot > 0.35 ? t.hi : dot > -0.25 ? t.base : t.lo;
      ctx.fillStyle = o.flat ? t.base : k;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill();
      if (!o.flat) { ctx.strokeStyle = k; ctx.lineWidth = 0.01; ctx.stroke(); }
    }
    if (o.outline !== false) { ctx.strokeStyle = o.edge || t.edge; ctx.lineWidth = o.lw || 0.08; ctx.lineJoin = 'round'; Art.poly(ctx, pts); ctx.stroke(); }
  },
  // Irregular round polygon around (cx, cy).
  blobPts(rnd, cx, cy, rx, ry, n = 8, jag = 0.25, rot = 0) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * Math.PI * 2 + (rnd() - 0.5) * 0.4;
      const k = 1 - jag / 2 + rnd() * jag;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  },
  smoothPath(ctx, pts) {
    const n = pts.length;
    ctx.beginPath();
    const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    ctx.closePath();
  },
  glint(ctx, x, y, s, color = '#ffffff', a = 1) {
    ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fill();
    ctx.restore();
  }
};
