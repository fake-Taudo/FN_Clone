// =====================================================================
// TerrainCore: deterministic height-field terrain (pure, DOM free, runs
// in a Web Worker built from this object's source). World-space noise
// only, so chunks are seamless. Own RNG streams (seed + purpose + cell);
// the world/deposit RNG is never touched.
//   relief (macro / meso / micro) -> craters stamped in age order ->
//   dunes -> materials -> hillshade + soft shadows + AO -> pixel detail
// =====================================================================
const TerrainCore = {
  GT: null,
  init() {
    if (TerrainCore.GT) return;
    const g = new Float32Array(512);
    for (let i = 0; i < 256; i++) { const a = i / 256 * Math.PI * 2 + 0.37; g[i * 2] = Math.cos(a); g[i * 2 + 1] = Math.sin(a); }
    TerrainCore.GT = g;
  },
  hi(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = Math.imul(h ^ (h >>> 16), 668265263);
    return (h ^ (h >>> 15)) >>> 0;
  },
  hf(x, y, s) { return TerrainCore.hi(x, y, s) / 4294967296; },
  rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
  gn(x, y, s) {
    const G = TerrainCore.GT, H = TerrainCore.hi;
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    let k = (H(ix, iy, s) & 255) << 1; const n00 = G[k] * fx + G[k + 1] * fy;
    k = (H(ix + 1, iy, s) & 255) << 1; const n10 = G[k] * (fx - 1) + G[k + 1] * fy;
    k = (H(ix, iy + 1, s) & 255) << 1; const n01 = G[k] * fx + G[k + 1] * (fy - 1);
    k = (H(ix + 1, iy + 1, s) & 255) << 1; const n11 = G[k] * (fx - 1) + G[k + 1] * (fy - 1);
    const a = n00 + (n10 - n00) * u, b = n01 + (n11 - n01) * u;
    return (a + (b - a) * v) * 1.45;
  },
  fbm(x, y, s, o) {
    let sum = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < o; i++) { sum += amp * TerrainCore.gn(x * f + i * 17.31, y * f - i * 9.17, s + i * 101); n += amp; amp *= 0.5; f *= 2.03; }
    return sum / n;
  },
  ridge(x, y, s, o) {
    let sum = 0, amp = 0.5, f = 1, n = 0, prev = 1;
    for (let i = 0; i < o; i++) { let r = 1 - Math.abs(TerrainCore.gn(x * f + i * 7.7, y * f + i * 3.3, s + i * 59)); r *= r; sum += r * amp * prev; prev = r; n += amp; amp *= 0.5; f *= 2.1; }
    return sum / n;
  },
  // cellular noise: returns F2-F1 (crack distance) and writes the cell hash into out[0]
  worley(x, y, s, out) {
    const ix = Math.floor(x), iy = Math.floor(y), H = TerrainCore.hi;
    let d1 = 9, d2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j, h = H(cx, cy, s);
      const px = cx + (h & 1023) / 1024, py = cy + ((h >>> 10) & 1023) / 1024;
      const dx = px - x, dy = py - y, d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; id = h; } else if (d < d2) d2 = d;
    }
    if (out) out[0] = id;
    return Math.sqrt(d2) - Math.sqrt(d1);
  },
  ss(a, b, x) { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); },
  rgb(hex) { const n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; },

  // ---------------- planet parameters (plain data, sent to the worker) ----------------
  STYLES: {
    1: { name: 'ares', dust: '#b98a66', sand: '#c99a70', crust: '#9c5e42', gravel: '#8c6c58', bed: '#705854', salt: '#dccbb2', shadow: '#4a3048', zones: ['#b9874a', '#7a5058', '#857266', '#7e7a5e'], crater: 1, dune: 1, ridge: 0.8, mesa: 0.7, basin: 0.8, relief: 1, emis: '' },
    2: { name: 'cuprum', dust: '#b88c5e', sand: '#c6a06a', crust: '#8e5c38', gravel: '#7c6248', bed: '#5c4838', salt: '#4fb8a0', shadow: '#3a2a30', zones: ['#c07a3a', '#6a4a3a', '#8a7a5a', '#5a8a70'], crater: 0.7, dune: 0.6, ridge: 1.1, mesa: 0.5, basin: 1, relief: 1.1, emis: 'patina' },
    3: { name: 'glacia', dust: '#e6f0f8', sand: '#dbe9f4', crust: '#a6c8e2', gravel: '#90b0c8', bed: '#5e7ea0', salt: '#cdeafa', shadow: '#4a6a9a', zones: ['#c8dcf0', '#8ab0d0', '#e8f4ff', '#a0c0d8'], crater: 0.6, dune: 0.8, ridge: 1, mesa: 0.3, basin: 0.6, relief: 0.9, emis: 'ice' },
    4: { name: 'ignis', dust: '#4c4646', sand: '#3e3838', crust: '#322a26', gravel: '#3c2e28', bed: '#26201e', salt: '#8a7a3a', shadow: '#1a1218', zones: ['#40302a', '#2a2a30', '#4a3a30', '#382624'], crater: 0.9, dune: 0.7, ridge: 0.9, mesa: 0.6, basin: 0.4, relief: 1.1, emis: 'lava' },
    5: { name: 'viridia', dust: '#4e5e42', sand: '#6c5c7c', crust: '#42503a', gravel: '#5c4c68', bed: '#30293f', salt: '#4fd6a8', shadow: '#1e1830', zones: ['#5a7a48', '#5a4a72', '#3e5a4a', '#6a6a4a'], crater: 0.4, dune: 0.4, ridge: 0.8, mesa: 0.8, basin: 0.9, relief: 1, emis: 'bio' },
    6: { name: 'nebulon', dust: '#3c3262', sand: '#463a72', crust: '#2e2652', gravel: '#36365c', bed: '#221d42', salt: '#6058a4', shadow: '#140c2a', zones: ['#4a347e', '#2a3a6c', '#58326e', '#32325e'], crater: 0.6, dune: 0.3, ridge: 0.8, mesa: 1.0, basin: 0.7, relief: 1.0, emis: 'grid' },
    7: { name: 'crystallis', dust: '#e4dcf0', sand: '#d8d0e8', crust: '#c8bcd8', gravel: '#b8acd0', bed: '#9c8cba', salt: '#eaf6ff', shadow: '#7a6a9a', zones: ['#d0c4e8', '#c4e0f0', '#e8dcf0', '#b8b0d8'], crater: 0.6, dune: 0.5, ridge: 0.9, mesa: 0.6, basin: 0.8, relief: 1, emis: 'crystal' },
    8: { name: 'singularis', dust: '#26264e', sand: '#2c2c56', crust: '#1b1b38', gravel: '#22223f', bed: '#14142c', salt: '#3a3a74', shadow: '#08081a', zones: ['#2c2050', '#1c1c4e', '#241840', '#162238'], crater: 0.9, dune: 0.3, ridge: 0.8, mesa: 0.6, basin: 0.6, relief: 1.0, emis: 'void' }
  },
  params(planet, seed) {
    const k = planet.index || 1;
    let st = TerrainCore.STYLES[k <= 8 ? k : 1], base = k <= 8 ? k : 1;
    let pal = st;
    if (k > 8) {
      // procedural planets: a base style recoloured from the planet palette
      base = 1 + (TerrainCore.hi(k, 77, 5) % 8);
      st = TerrainCore.STYLES[base];
      const mix = (a, b, t) => { const A = TerrainCore.rgb(a), B = TerrainCore.rgb(b); const c = A.map((v, i) => Math.round((v + (B[i] - v) * t) * 255)); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); };
      const g0 = planet.ground[0], g1 = planet.ground[1], g2 = planet.ground[2];
      pal = Object.assign({}, st, { dust: mix(g2, st.dust, 0.3), sand: mix(g2, g1, 0.4), crust: mix(g1, st.crust, 0.25), gravel: mix(g1, g0, 0.4), bed: mix(g0, st.bed, 0.3), salt: mix(planet.deco || g2, '#ffffff', 0.3), shadow: mix(g0, '#000000', 0.5), zones: [mix(g1, planet.accent, 0.25), g0, mix(g2, '#808080', 0.3), mix(g1, g2, 0.5)] });
    }
    const r = TerrainCore.rgb;
    return {
      seed: (seed ^ Math.imul(k, 2654435761)) >>> 0, k, style: base, name: st.name,
      col: [r(pal.dust), r(pal.sand), r(pal.crust), r(pal.gravel), r(pal.bed), r(pal.salt)],
      shadow: r(pal.shadow), zones: pal.zones.map(r),
      crater: st.crater, dune: st.dune, ridge: st.ridge, mesa: st.mesa, basin: st.basin, relief: st.relief, emis: st.emis,
      // dark grounds: multiplied shading is invisible on near-black albedo, so lit slopes get an additive light term
      dark: (() => { const d = r(pal.dust); const L = 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]; return Math.max(0, Math.min(1, (0.3 - L) / 0.2)); })(),
      wind: (TerrainCore.hf(k, 3, 9) - 0.5) * 1.4 + 0.3,
      landing: [16, 16]
    };
  },

  // ---------------- feature lists (craters, landmarks) ----------------
  CC: 40, // crater cell size (tiles)
  LC: 192, // landmark cell size (tiles)
  craterCell(ci, cj, P) {
    const T = TerrainCore, rnd = T.rng(T.hi(ci, cj, P.seed + 7001));
    const S = T.CC, out = [];
    const field = T.ss(-0.2, 0.45, T.fbm(ci * S / 300 + 4.1, cj * S / 300 - 2.7, P.seed + 31, 2));
    let n = Math.floor((1.2 + field * 13) * P.crater * (0.6 + rnd() * 0.8));
    const add = (x, y, R, age, prof) => {
      const kind = R > 7 ? 2 : R > 3 ? 1 : 0;
      out.push({ x, y, R, age, prof, kind, e: 0.82 + rnd() * 0.18, rot: rnd() * 3.1416, seed: (rnd() * 1e9) | 0, rays: rnd() < 0.5 });
    };
    for (let i = 0; i < n; i++) {
      const u = rnd();
      const R = Math.min(12, 0.9 * Math.pow(1 - u * 0.99, -0.72));
      add((ci + rnd()) * S, (cj + rnd()) * S, R, rnd(), Math.floor(rnd() * 8));
    }
    // crater chain
    if (rnd() < 0.12 * P.crater) {
      const a = rnd() * 3.1416, x0 = (ci + 0.2 + rnd() * 0.6) * S, y0 = (cj + 0.2 + rnd() * 0.6) * S, m = 5 + Math.floor(rnd() * 5), age = rnd();
      for (let i = 0; i < m; i++) add(x0 + Math.cos(a) * i * 2.3, y0 + Math.sin(a) * i * 2.3, 0.7 + rnd() * 0.9, age + rnd() * 0.02, 4);
    }
    // secondary field around big craters
    const big = out.filter(c => c.R > 5);
    for (const c of big) {
      const m = 5 + Math.floor(rnd() * 8);
      for (let i = 0; i < m; i++) { const a = rnd() * 6.283, d = c.R * (2 + rnd() * 2.2); add(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 0.5 + rnd() * 0.7, c.age + 0.001, 4); }
    }
    return out;
  },
  landmarkCell(li, lj, P) {
    const T = TerrainCore, rnd = T.rng(T.hi(li, lj, P.seed + 9001));
    if (rnd() > 0.42) return null;
    const L = T.LC, x = (li + 0.2 + rnd() * 0.6) * L, y = (lj + 0.2 + rnd() * 0.6) * L;
    if (Math.hypot(x - P.landing[0], y - P.landing[1]) < 70) return null;
    const types = ['basin', 'riverbed', 'canyon', 'mesas', 'devils', 'wreck', 'basin', 'wreck'];
    const type = types[Math.floor(rnd() * types.length)];
    const lm = { type, x, y, seed: (rnd() * 1e9) | 0, a: rnd() * 6.283, R: 16 + rnd() * 14, wreck: Math.floor(rnd() * 6) };
    if (type === 'riverbed' || type === 'canyon') {
      // meandering polyline
      const pts = []; let px = x, py = y, a = lm.a;
      const len = type === 'canyon' ? 14 : 22;
      for (let i = 0; i < len; i++) { pts.push([px, py]); a += (rnd() - 0.5) * (type === 'canyon' ? 0.25 : 0.7); px += Math.cos(a) * 5; py += Math.sin(a) * 5; }
      lm.pts = pts; lm.w = type === 'canyon' ? 2.2 + rnd() * 1.5 : 1.4 + rnd();
    }
    return lm;
  },
  context(cx, cy, S, P, deposits) {
    const T = TerrainCore, C = { craters: [], lms: [], deps: deposits || [] };
    const x0 = cx * S - 34, y0 = cy * S - 34, x1 = (cx + 1) * S + 34, y1 = (cy + 1) * S + 34;
    for (let j = Math.floor(y0 / T.CC); j <= Math.floor(y1 / T.CC); j++) for (let i = Math.floor(x0 / T.CC); i <= Math.floor(x1 / T.CC); i++) {
      for (const c of T.craterCell(i, j, P)) if (c.x + c.R * 2.4 > x0 + 30 && c.x - c.R * 2.4 < x1 - 30 && c.y + c.R * 2.4 > y0 + 30 && c.y - c.R * 2.4 < y1 - 30) C.craters.push(c);
    }
    const lx0 = cx * S - 90, ly0 = cy * S - 90, lx1 = (cx + 1) * S + 90, ly1 = (cy + 1) * S + 90;
    for (let j = Math.floor(ly0 / T.LC); j <= Math.floor(ly1 / T.LC); j++) for (let i = Math.floor(lx0 / T.LC); i <= Math.floor(lx1 / T.LC); i++) {
      const lm = T.landmarkCell(i, j, P);
      if (!lm) continue;
      if (lm.type === 'basin') C.craters.push({ x: lm.x, y: lm.y, R: lm.R, age: 0.02, prof: 2, kind: 3, e: 0.92, rot: lm.a, seed: lm.seed, rays: false, basin: true });
      C.lms.push(lm);
    }
    C.craters.sort((a, b) => a.age - b.age);
    C.near = C.craters; // per-sample filtered by bbox in field()
    return C;
  },

  // ---------------- the height field ----------------
  // writes into o: [h, dune, eject, rim, bowlFill, basin, ridge, mesaEdge, mineral, rays, landmarkMat, depNear, inBowl]
  field(x, y, P, C, o) {
    const T = TerrainCore, s = P.seed;
    const wx = x + 38 * T.fbm(x / 310, y / 310, s + 1, 2), wy = y + 38 * T.fbm(x / 310 + 7.7, y / 310 - 3.1, s + 2, 2);
    const macro = T.fbm(wx / 520, wy / 520, s + 3, 3);
    let h = macro * 5.5 * P.relief + T.fbm(wx / 38, wy / 38, s + 17, 3) * 1.25 * P.relief;
    // ridges (exposed bedrock crests)
    const rgMask = T.ss(0.0, 0.45, T.fbm(x / 260, y / 260, s + 5, 2)) * P.ridge;
    let ridge = 0;
    if (rgMask > 0.01) { const rg = T.ridge(wx / 64, wy / 64, s + 4, 3); ridge = rg * rg * rg * rgMask; h += ridge * 7.5; }
    // mesas with soft break edges
    let mesaEdge = 0;
    const mm = P.mesa * T.ss(0.15, 0.5, T.fbm(x / 430 + 3, y / 430, s + 7, 2));
    if (mm > 0.01) { const ms = T.fbm(wx / 105, wy / 105, s + 6, 3); const t = T.ss(0.16, 0.26, ms); h += t * 2.4 * mm; mesaEdge = (1 - Math.abs(t * 2 - 1)) * mm; }
    // basins / dry lakes
    const bs = T.fbm(x / 270 - 5, y / 270 + 9, s + 8, 2);
    const basin = P.basin * T.ss(-0.22, -0.4, bs);
    if (basin > 0) h = h * (1 - basin * 0.92) - basin * 1.6;
    // dunes: asymmetric profile along the wind, warped crests, organic field edges
    let dune = 0;
    const dm = P.dune * T.ss(0.12, 0.38, T.fbm(x / 185 + 11, y / 185 - 6, s + 10, 3)) * (1 - basin) * (1 - T.ss(0.25, 0.6, ridge));
    if (dm > 0.01) {
      const wa = P.wind + 0.45 * T.fbm(x / 600, y / 600, s + 12, 2);
      const cw = Math.cos(wa), sw = Math.sin(wa);
      const u = x * cw + y * sw, v = -x * sw + y * cw;
      const uu = u + 5 * T.fbm(v / 22, u / 45, s + 13, 2) + 2 * T.gn(v / 7, u / 9, s + 14);
      const lam = 10.5;
      let ph = uu / lam; ph -= Math.floor(ph);
      const prof = ph < 0.72 ? T.ss(0, 0.72, ph) : 1 - T.ss(0.72, 1, ph);
      const gap = T.ss(-0.15, 0.25, T.gn(v / 14 + 3, u / 30, s + 15)); // barchan-like breaks
      dune = dm * prof * (0.45 + 0.55 * gap);
      h += dune * 1.5;
    }
    // micro relief
    h += T.gn(x / 2.6, y / 2.6, s + 9) * 0.1 + T.gn(x / 1.1, y / 1.1, s + 16) * 0.035;
    // craters stamped in age order (young cut old)
    let eject = 0, rim = 0, fill = 0, rays = 0, inBowl = 0;
    const cr = C.craters;
    for (let i = 0; i < cr.length; i++) {
      const c = cr[i];
      const dx = x - c.x, dy = y - c.y, R = c.R;
      if (dx > R * 2.4 || dx < -R * 2.4 || dy > R * 2.4 || dy < -R * 2.4) continue;
      const ca = Math.cos(c.rot), sa = Math.sin(c.rot);
      const lx = dx * ca + dy * sa, ly = (-dx * sa + dy * ca) / c.e;
      const d = Math.sqrt(lx * lx + ly * ly);
      const ang = Math.atan2(ly, lx);
      const Rn = R * (1 + 0.09 * T.gn(Math.cos(ang) * 1.6 + c.seed % 97, Math.sin(ang) * 1.6, c.seed));
      const q = d / Rn;
      if (q > 2.3) continue;
      const fresh = c.basin ? 0.7 : c.age < 0.2 ? 1 : c.age < 0.55 ? 0.72 : c.age < 0.88 ? 0.42 : 0.16;
      const D = Math.min(R, 6) * 0.3 * fresh * (c.prof === 4 ? 1.25 : 1);
      if (q < 1.06) {
        let bowl;
        if (c.prof === 1 || (R > 4 && c.prof !== 4)) bowl = -D * (1 - Math.pow(Math.min(1, q / 0.95), 2.6)); // flat-ish floor
        else bowl = -D * (1 - q * q);
        if ((c.prof === 2 || c.kind >= 2) && R > 3.5) bowl += D * 0.75 * Math.exp(-(q * q) / 0.016); // central peak
        if ((c.prof === 3 && c.kind >= 2 || c.basin) && q > 0.55 && q < 0.93) bowl += D * 0.06 * Math.sin(q * 22) * Math.max(0, T.gn(Math.cos(ang) * 2 + 3, Math.sin(ang) * 2, c.seed + 5)); // broken terraces
        const rimH = D * (c.prof === 5 ? 0.25 : 0.4) * Math.exp(-Math.pow((q - 1) / (fresh > 0.7 ? 0.1 : 0.2), 2));
        const target = c.href + bowl + rimH;
        const k = 1 - T.ss(0.92, 1.06, q);
        h = h + (target - h) * k + rimH * (1 - k);
        if (c.age > 0.55) fill = Math.max(fill, (1 - q) * (c.age > 0.88 ? 0.9 : 0.6));
        inBowl = Math.max(inBowl, 1 - T.ss(0.85, 1.15, q));
        rim = Math.max(rim, Math.exp(-Math.pow((q - 1) / 0.12, 2)) * fresh);
      } else {
        const t = (q - 1) / 1.3;
        const rimH = D * 0.4 * Math.exp(-Math.pow((q - 1) / (fresh > 0.7 ? 0.1 : 0.2), 2));
        const ej = t < 1 ? (1 - t) * (1 - t) : 0;
        let ray = 0;
        if (c.rays && fresh > 0.7) { ray = Math.max(0, T.gn(Math.cos(ang) * 4.5 + c.seed % 31, Math.sin(ang) * 4.5, c.seed + 1)) * ej; }
        h += rimH + D * 0.07 * ej * (0.6 + T.gn(lx / 1.3, ly / 1.3, c.seed + 2));
        eject = Math.max(eject, ej * fresh * (c.prof === 5 ? 1.3 : 1));
        rays = Math.max(rays, ray);
        rim = Math.max(rim, Math.exp(-Math.pow((q - 1) / 0.12, 2)) * fresh);
        inBowl = Math.max(inBowl, 1 - T.ss(1.0, 1.25, q));
      }
    }
    // landmark carving (riverbed / canyon)
    let lmMat = 0;
    for (let i = 0; i < C.lms.length; i++) {
      const lm = C.lms[i];
      if (!lm.pts) continue;
      let best = 1e9;
      const pts = lm.pts;
      for (let k = 0; k < pts.length - 1; k++) {
        const ax = pts[k][0], ay = pts[k][1], bx = pts[k + 1][0], by = pts[k + 1][1];
        const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
        let t = ((x - ax) * vx + (y - ay) * vy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = ax + vx * t - x, ey = ay + vy * t - y, dd = ex * ex + ey * ey;
        if (dd < best) best = dd;
      }
      const dist = Math.sqrt(best), W = lm.w * (1 + 0.3 * T.gn(x / 9, y / 9, lm.seed));
      if (dist < W * 3) {
        const q = dist / W;
        if (lm.type === 'canyon') { h -= 1.8 * Math.exp(-q * q * 1.2) - 0.35 * Math.exp(-Math.pow(q - 1.4, 2) * 3); lmMat = Math.max(lmMat, Math.exp(-q * q)); }
        else { h -= 0.9 * Math.exp(-q * q * 1.6); lmMat = Math.max(lmMat, Math.exp(-q * q * 0.8) * 0.8); }
      }
    }
    // deposits sit on a flattened, calm plateau (no rims or dunes running through them)
    let depNear = 0;
    const deps = C.deps;
    for (let i = 0; i < deps.length; i++) {
      const dp = deps[i];
      const dx = x - dp.x, dy = y - dp.y;
      if (dx * dx + dy * dy > (dp.r + 3) * (dp.r + 3)) continue;
      const dd = Math.sqrt(dx * dx + dy * dy);
      const k = 1 - T.ss(dp.r, dp.r + 2.4, dd);
      if (k > 0) { h = h + (dp.h - h) * k * 0.92; depNear = Math.max(depNear, k); }
    }
    const mineral = T.fbm(x / 140 + 300, y / 140 - 80, s + 20, 2);
    o[0] = h; o[1] = dune; o[2] = eject; o[3] = rim; o[4] = fill; o[5] = basin; o[6] = ridge; o[7] = mesaEdge; o[8] = mineral; o[9] = rays; o[10] = lmMat; o[11] = depNear; o[12] = inBowl;
  },
  // height of the undisturbed surface (reference for crater floors and deposit plateaus)
  baseH(x, y, P) {
    const T = TerrainCore, o = new Float32Array(13);
    T.field(x, y, P, { craters: [], lms: [], deps: [] }, o);
    return o[0];
  },

  // ---------------- bake one chunk ----------------
  // job: { cx, cy, S, res, P, deps, level } -> { w, h, rgba, emis, cells, props }
  bake(job) { const it = TerrainCore.bakeIter(job); let r = it.next(); while (!r.done) r = it.next(); return r.value; },
  _gc: null,
  *bakeIter(job) {
    const T = TerrainCore; T.init();
    const { cx, cy, S, res, P } = job;
    const GS0 = res <= 6 ? 2 : res <= 12 ? 4 : 6;
    const gkey = cx + ',' + cy + ',' + GS0 + ',' + P.seed + ',' + (job.depKey || '');
    if (!T._gc) T._gc = new Map();
    let GD = T._gc.get(gkey);
    if (!GD) {
      GD = yield* T.gridIter(job, GS0);
      T._gc.set(gkey, GD);
      if (T._gc.size > 18) T._gc.delete(T._gc.keys().next().value);
    }
    return yield* T.pixelIter(job, GD);
  },
  *gridIter(job, GS) {
    const T = TerrainCore;
    const { cx, cy, S, P } = job;
    const C = T.context(cx, cy, S, P, null);
    for (const c of C.craters) c.href = T.baseH(c.x, c.y, P);
    C.deps = (job.deps || []).map(d => ({ x: d.x, y: d.y, r: d.r, h: T.baseH(d.x, d.y, P), tier: d.tier, col: d.col ? T.rgb(d.col) : null }));
    const PAD = GS * 3, N = S * GS + PAD * 2;
    const x0 = cx * S, y0 = cy * S;
    const H = new Float32Array(N * N), A = new Float32Array(N * N * 13);
    const o = new Float32Array(13);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      T.field(x0 + (i - PAD + 0.5) / GS, y0 + (j - PAD + 0.5) / GS, P, C, o);
      const k = j * N + i; H[k] = o[0];
      for (let q = 0; q < 13; q++) A[k * 13 + q] = o[q];
      if (i === N - 1 && (j & 7) === 7) yield;
    }
    // lighting on the grid: hillshade, soft shadows along the light, ambient occlusion
    const Z = 1.7, LX = -0.5, LY = -0.5, LZ = 0.707;
    const SH = new Float32Array(N * N), W = new Float32Array(N * N * 6), ALB = new Float32Array(N * N * 3), EM = new Float32Array(N * N);
    const col = P.col, zones = P.zones;
    const st = P.style;
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const k = j * N + i;
      const dhx = (H[k + 1] - H[k - 1]) * GS * 0.5 * Z, dhy = (H[k + N] - H[k - N]) * GS * 0.5 * Z;
      const nl = Math.sqrt(dhx * dhx + dhy * dhy + 1);
      const lam = (-dhx * LX - dhy * LY + LZ) / nl / LZ; // 1 on flat ground
      const lap = (H[k + 1] + H[k - 1] + H[k + N] + H[k - N] - 4 * H[k]) * GS * GS * 0.25;
      // soft shadow: march towards the sun
      let sh = 1;
      for (let m = 1; m <= PAD - 1; m++) {
        const ii = i - m, jj = j - m;
        if (ii < 0 || jj < 0) break;
        const rise = (H[jj * N + ii] - H[k]) * Z - m / GS * 1.414 * 0.9;
        // fades out toward the end of the march (no hard offset copy of a ridge edge)
        if (rise > 0) { sh = Math.min(sh, 1 - Math.min(1, rise * 2.2) * 0.4 * (1 - (m - 1) / (PAD - 1))); }
      }
      const ao = Math.max(0.72, Math.min(1.06, 1 - lap * 0.35));
      SH[k] = Math.max(0.55, Math.min(1.45, lam)) * sh * ao;
      // materials
      const a = A, b = k * 13;
      const slope = Math.sqrt(dhx * dhx + dhy * dhy) / Z;
      const dune = a[b + 1], ej = a[b + 2], rimv = a[b + 3], fill = a[b + 4], basin = a[b + 5], ridge = a[b + 6], mesaE = a[b + 7], mineral = a[b + 8], rays = a[b + 9], lmm = a[b + 10], dep = a[b + 11];
      const wx = x0 + (i - PAD + 0.5) / GS, wy = y0 + (j - PAD + 0.5) / GS;
      const patch = T.gn(wx / 9, wy / 9, P.seed + 40) * 0.7 + T.gn(wx / 4, wy / 4, P.seed + 44) * 0.3;
      const patch2 = T.fbm(wx / 26, wy / 26, P.seed + 42, 2), patch3 = T.gn(wx / 15 + 5, wy / 15, P.seed + 43);
      let wSand = dune * 1.6 + T.ss(0.3, 0.6, patch) * 0.25;
      let wDust = T.ss(0.0, 0.25, lap) * 0.8 + fill * 1.2 + T.ss(-0.05, -0.4, patch) * 0.9 + (1 - T.ss(0.05, 0.3, slope)) * 0.12;
      let wCrust = (0.25 + T.ss(0.05, 0.4, patch2) * 0.6) * (1 - a[b + 12] * 0.9) * (1 - rimv);
      let wGravel = ej * 1.2 + T.ss(0.2, 0.5, slope) * 0.5 + lmm * 0.8 + dep * 0.35 + T.ss(0.3, 0.6, patch3) * 0.45;
      let wBed = T.ss(0.45, 1.0, slope) * 1.2 + ridge * 2.2 + rimv * 0.6 + mesaE * 0.9 + T.ss(0.42, 0.6, -patch2) * 0.5;
      let wSalt = basin * 1.6 + (st === 2 || st === 5 ? T.ss(0.35, 0.6, -patch) * basin : 0);
      if (lmm > 0.2) wSalt += lmm * 0.25;
      const sum = wSand + wDust + wCrust + wGravel + wBed + wSalt;
      wSand /= sum; wDust /= sum; wCrust /= sum; wGravel /= sum; wBed /= sum; wSalt /= sum;
      const w6 = k * 6; W[w6] = wDust; W[w6 + 1] = wSand; W[w6 + 2] = wCrust; W[w6 + 3] = wGravel; W[w6 + 4] = wBed; W[w6 + 5] = wSalt;
      let r = col[0][0] * wDust + col[1][0] * wSand + col[2][0] * wCrust + col[3][0] * wGravel + col[4][0] * wBed + col[5][0] * wSalt;
      let g = col[0][1] * wDust + col[1][1] * wSand + col[2][1] * wCrust + col[3][1] * wGravel + col[4][1] * wBed + col[5][1] * wSalt;
      let bb = col[0][2] * wDust + col[1][2] * wSand + col[2][2] * wCrust + col[3][2] * wGravel + col[4][2] * wBed + col[5][2] * wSalt;
      // mineral zones: hue/value variation in large soft regions
      const zi = mineral > 0.18 ? 0 : mineral < -0.2 ? 1 : -1;
      if (zi >= 0) { const zk = T.ss(0.18, 0.42, Math.abs(mineral)) * 0.32; r += (zones[zi][0] - r) * zk; g += (zones[zi][1] - g) * zk; bb += (zones[zi][2] - bb) * zk; }
      const z2 = T.gn(wx / 60 + 9, wy / 60, P.seed + 41);
      if (z2 > 0.35) { const zk = T.ss(0.35, 0.6, z2) * 0.22; r += (zones[2][0] - r) * zk; g += (zones[2][1] - g) * zk; bb += (zones[2][2] - bb) * zk; }
      if (z2 < -0.45) { const zk = T.ss(-0.45, -0.7, z2) * 0.2; r += (zones[3][0] - r) * zk; g += (zones[3][1] - g) * zk; bb += (zones[3][2] - bb) * zk; }
      // fresh ejecta and rays are brighter, old crater floors dustier
      const bright = 1 + rays * 0.22 + ej * 0.05 * (rays > 0 ? 1 : 0);
      r *= bright; g *= bright; bb *= bright;
      // mineral halo around rare deposits
      for (let d = 0; d < C.deps.length; d++) {
        const dp = C.deps[d];
        if (!dp.col || dp.tier < 2) continue;
        const dd = Math.hypot(wx - dp.x, wy - dp.y);
        const hk = (1 - T.ss(dp.r * 0.8, dp.r + 2.5 + dp.tier * 0.4, dd)) * (0.06 + dp.tier * 0.02);
        if (hk > 0) { r += (dp.col[0] - r) * hk; g += (dp.col[1] - g) * hk; bb += (dp.col[2] - bb) * hk; }
      }
      // planet-specific emission (night glow) and tints
      let em = 0;
      if (P.emis === 'lava') { const lv = 1 - Math.abs(T.gn(wx / 3.8, wy / 3.8, P.seed + 50)); const lm2 = T.ss(-0.1, 0.4, T.fbm(wx / 70, wy / 70, P.seed + 51, 2)) * (1 - wSand); em = T.ss(0.93, 0.985, lv) * lm2; r += em * 0.25; g += em * 0.08; }
      else if (P.emis === 'bio') { const bio = T.fbm(wx / 11, wy / 11, P.seed + 52, 2); if (bio > 0.3) { const k2 = T.ss(0.3, 0.55, bio) * (1 - wSand); r += (0.33 - r) * k2 * 0.5; g += (0.54 - g) * k2 * 0.5; bb += (0.27 - bb) * k2 * 0.5; em = k2 * 0.35 * T.ss(0.1, 0.6, T.gn(wx / 2, wy / 2, P.seed + 53)); } em += wSalt * 0.4; }
      else if (P.emis === 'patina') em = wSalt * 0.25;
      else if (P.emis === 'crystal') em = wSalt * 0.15;
      ALB[k * 3] = r; ALB[k * 3 + 1] = g; ALB[k * 3 + 2] = bb; EM[k] = em;
      if (i === N - 2 && (j & 15) === 15) yield;
    }
    // per-tile dominant material (footprints, minimap)
    const mats = new Uint8Array(S * S);
    for (let ty = 0; ty < S; ty++) for (let tx = 0; tx < S; tx++) {
      const k = (ty * GS + PAD + (GS >> 1)) * N + tx * GS + PAD + (GS >> 1);
      let best = 0, bw = -1;
      for (let m = 0; m < 6; m++) if (W[k * 6 + m] > bw) { bw = W[k * 6 + m]; best = m; }
      mats[ty * S + tx] = best;
    }
    const props = T.props(cx, cy, S, P, C, A, N, GS, PAD, W);
    return { GS, PAD, N, SH, W, ALB, EM, mats, props, lms: C.lms.map(l => ({ type: l.type, x: l.x, y: l.y, wreck: l.wreck, a: l.a, seed: l.seed })) };
  },
  *pixelIter(job, GD) {
    const T = TerrainCore;
    const { cx, cy, S, res, P } = job;
    const { GS, PAD, N, SH, W, ALB, EM } = GD;
    const x0 = cx * S, y0 = cy * S, st = P.style;
    const PW = S * res;
    const rgba = new Uint8ClampedArray(PW * PW * 4);
    const hasEm = !!P.emis && P.emis !== 'ice';
    const emis = hasEm ? new Uint8ClampedArray(PW * PW * 4) : null;
    const shR = P.shadow[0], shG = P.shadow[1], shB = P.shadow[2], dk = P.dark || 0;
    const wa = P.wind, wcx = Math.cos(wa), wcy = Math.sin(wa);
    const cell = new Float64Array(1);
    const detail = res >= 8;
    const fine = res >= 16;
    for (let py = 0; py < PW; py++) {
      const wy = y0 + (py + 0.5) / res;
      const gy = (py + 0.5) / res * GS + PAD - 0.5;
      const j0 = Math.floor(gy), fy = gy - j0;
      for (let px = 0; px < PW; px++) {
        const wx = x0 + (px + 0.5) / res;
        const gx = (px + 0.5) / res * GS + PAD - 0.5;
        const i0 = Math.floor(gx), fx = gx - i0;
        const k00 = j0 * N + i0, k10 = k00 + 1, k01 = k00 + N, k11 = k01 + 1;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        let r = ALB[k00 * 3] * w00 + ALB[k10 * 3] * w10 + ALB[k01 * 3] * w01 + ALB[k11 * 3] * w11;
        let g = ALB[k00 * 3 + 1] * w00 + ALB[k10 * 3 + 1] * w10 + ALB[k01 * 3 + 1] * w01 + ALB[k11 * 3 + 1] * w11;
        let b = ALB[k00 * 3 + 2] * w00 + ALB[k10 * 3 + 2] * w10 + ALB[k01 * 3 + 2] * w01 + ALB[k11 * 3 + 2] * w11;
        let sh = SH[k00] * w00 + SH[k10] * w10 + SH[k01] * w01 + SH[k11] * w11;
        let em = hasEm ? EM[k00] * w00 + EM[k10] * w10 + EM[k01] * w01 + EM[k11] * w11 : 0;
        if (detail) {
          const wD = W[k00 * 6] * w00 + W[k10 * 6] * w10 + W[k01 * 6] * w01 + W[k11 * 6] * w11;
          const wS = W[k00 * 6 + 1] * w00 + W[k10 * 6 + 1] * w10 + W[k01 * 6 + 1] * w01 + W[k11 * 6 + 1] * w11;
          const wC = W[k00 * 6 + 2] * w00 + W[k10 * 6 + 2] * w10 + W[k01 * 6 + 2] * w01 + W[k11 * 6 + 2] * w11;
          const wG = W[k00 * 6 + 3] * w00 + W[k10 * 6 + 3] * w10 + W[k01 * 6 + 3] * w01 + W[k11 * 6 + 3] * w11;
          const wB = W[k00 * 6 + 4] * w00 + W[k10 * 6 + 4] * w10 + W[k01 * 6 + 4] * w01 + W[k11 * 6 + 4] * w11;
          const wL = W[k00 * 6 + 5] * w00 + W[k10 * 6 + 5] * w10 + W[k01 * 6 + 5] * w01 + W[k11 * 6 + 5] * w11;
          let lit = 0, val = 0;
          // sand ripples (crests lit on the sun side)
          if (wS > 0.06) { const ph = (wx * wcx + wy * wcy) * 19.6 + 2.4 * T.gn(wx / 1.6, wy / 1.6, P.seed + 60); lit += wS * 0.085 * Math.sin(ph + 0.8); val += wS * 0.03 * Math.cos(ph); }
          // dust: soft wind streaks
          if (wD > 0.08) { const sk = T.gn((wx * wcx + wy * wcy) / 6, (-wx * wcy + wy * wcx) * 1.6, P.seed + 61); val += wD * 0.05 * sk; }
          // crust: dried polygon cracks with a lit plate edge
          const cm = T.ss(0.02, 0.4, T.gn(wx / 17, wy / 17, P.seed + 69));
          if (wC > 0.15 && cm > 0.02) {
            const sc = 0.75 + 1.1 * T.ss(-0.5, 0.5, T.gn(wx / 40, wy / 40, P.seed + 77));
            const d = T.worley(wx / sc, wy / sc, P.seed + 62, cell);
            const crack = (1 - T.ss(0.012, 0.06, d)) * cm * (fine ? 1 : 0.45);
            val -= wC * crack * 0.15;
            val += wC * ((cell[0] & 255) / 255 - 0.5) * 0.07 * cm;
            if (st === 3) { val += wC * crack * 0.55; lit += wC * T.ss(0.06, 0.1, d) * 0.03; }
          }
          // gravel: many small stones in different colours with tiny shadows
          if (wG > 0.08 && fine) {
            const gx2 = wx / 0.17, gy2 = wy / 0.17, ix = Math.floor(gx2), iy = Math.floor(gy2);
            const hh = T.hi(ix, iy, P.seed + 63);
            if ((hh & 255) < 150 * Math.min(1, wG * 1.6)) {
              const cxp = ix + 0.25 + ((hh >>> 8) & 127) / 254, cyp = iy + 0.25 + ((hh >>> 15) & 127) / 254;
              const ddx = gx2 - cxp, ddy = gy2 - cyp, dd = ddx * ddx + ddy * ddy, rr = 0.08 + ((hh >>> 22) & 15) / 100;
              if (dd < rr) { const tone = ((hh >>> 26) & 3); val += [0.16, -0.12, 0.06, 0.24][tone] * wG; lit += (-ddx - ddy) * 0.25 * wG; }
              else if (dd < rr * 1.7 && ddx + ddy > 0) val -= 0.12 * wG;
            }
          } else if (wG > 0.08) val += (T.hf(Math.floor(wx * 5), Math.floor(wy * 5), P.seed + 63) - 0.5) * 0.18 * wG;
          // bedrock: strata bands and joint cracks
          if (wB > 0.1) {
            const strata = Math.sin((wx * 0.62 + wy * 0.78) * 5.5 + 3 * T.gn(wx / 7, wy / 7, P.seed + 64));
            val += wB * 0.07 * strata;
            const d = T.worley(wx / 3.2, wy / 3.2, P.seed + 65, null);
            val -= wB * (1 - T.ss(0.01, 0.05, d)) * 0.3;
          }
          // salt / mineral crust: bright polygons with darker rims and sparkle
          if (wL > 0.1) {
            const d = T.worley(wx / 2.3, wy / 2.3, P.seed + 66, cell);
            const crack = 1 - T.ss(0.02, 0.09, d);
            val -= wL * crack * 0.2; lit += wL * crack * 0.05;
            if (fine && T.hf(Math.floor(wx * 9), Math.floor(wy * 9), P.seed + 67) > 0.992) { val += 0.5 * wL; if (hasEm) em += 0.4 * wL; }
          }
          // grain everywhere, visible but calm (single pixels plus small clumps), micro pits and bumps
          val += (T.hf(px + x0 * res, py + y0 * res, P.seed + 68) - 0.5) * (fine ? 0.08 : 0.05);
          if (fine) {
            val += (T.hf((px + x0 * res) >> 1, (py + y0 * res) >> 1, P.seed + 78) - 0.5) * 0.07;
            const mb = T.gn(wx * 2.6, wy * 2.6, P.seed + 79);
            lit += mb * 0.09 * (1 - wS);
            // scattered small stones on every ground type except dunes
            const sx2 = wx / 0.45, sy2 = wy / 0.45, jx = Math.floor(sx2), jy = Math.floor(sy2);
            const h2 = T.hi(jx, jy, P.seed + 80);
            if ((h2 & 255) < 70 * (1 - wS) * (0.3 + wG + wB) * T.ss(-0.35, 0.45, T.gn(wx / 6, wy / 6, P.seed + 81))) {
              const cxp = jx + 0.3 + ((h2 >>> 8) & 63) / 160, cyp = jy + 0.3 + ((h2 >>> 14) & 63) / 160;
              const ddx = sx2 - cxp, ddy = sy2 - cyp, dd = ddx * ddx + ddy * ddy, rr = 0.02 + ((h2 >>> 20) & 15) / 400;
              if (dd < rr) { val += [0.14, -0.16, 0.05, 0.22][(h2 >>> 24) & 3]; lit += (-ddx - ddy) * 1.2; }
              else if (dd < rr * 2.2 && ddx + ddy > 0) val -= 0.16;
            }
          }
          // planet detail
          if (st === 6) {
            // platform plates (4 x 4 tiles) with individual tones, dark seams and a lit upper-left edge; neon lines glow at night
            const pm = T.gn(wx / 9, wy / 9, P.seed + 70), plat = T.ss(-0.35, -0.1, pm);
            const ux = ((wx + 2) % 4 + 4) % 4, uy = ((wy + 2) % 4 + 4) % 4, gl = Math.min(Math.abs(ux - 2), Math.abs(uy - 2));
            if (plat > 0) {
              const cid = T.hf(Math.floor((wx + 2) / 4), Math.floor((wy + 2) / 4), P.seed + 79);
              val += (cid - 0.5) * 0.16 * plat;
              if (gl > 1.93) { if (pm > -0.2) em += 0.85; val += 0.12; }
              else if (gl > 1.84) { val -= 0.14 * plat; }
              else if (ux < 0.2 || uy < 0.2) lit += 0.12 * plat;
            } else if (gl > 1.9) val -= 0.05;
          }
          if (st === 8) { const sp = T.hf(Math.floor(wx * 7), Math.floor(wy * 7), P.seed + 71); if (sp > 0.994) { em += 0.9; val += 0.6; } const rr2 = T.gn(wx / 40, wy / 40, P.seed + 72); lit += 0.05 * Math.sin(rr2 * 40); }
          if (st === 7 && wC > 0.2) { T.worley(wx / 1.1, wy / 1.1, P.seed + 73, cell); lit += ((cell[0] & 255) / 255 - 0.5) * 0.2 * wC; if (T.hf(Math.floor(wx * 8), Math.floor(wy * 8), P.seed + 74) > 0.993) em += 0.6; }
          if (st === 5) { const moss = T.fbm(wx / 6, wy / 6, P.seed + 75, 2); if (moss > 0.2) { const mk = T.ss(0.2, 0.45, moss) * (1 - wS); val += (T.hf(Math.floor(wx * 6), Math.floor(wy * 6), P.seed + 76) - 0.5) * 0.25 * mk; } }
          sh *= 1 + lit;
          r *= 1 + val; g *= 1 + val; b *= 1 + val;
        }
        // shading with cool violet-brown shadows (never black) and warm light
        let lr, lg, lb;
        if (sh < 1) { const t = 1 - sh; lr = r * sh + shR * t * 0.55; lg = g * sh + shG * t * 0.55; lb = b * sh + shB * t * 0.55; }
        else { const t = sh - 1; lr = r * (1 + t * 0.95) + t * dk * 0.34; lg = g * (1 + t * 0.85) + t * dk * 0.3; lb = b * (1 + t * 0.7) + t * dk * 0.38; }
        const o4 = (py * PW + px) * 4;
        rgba[o4] = lr * 255; rgba[o4 + 1] = lg * 255; rgba[o4 + 2] = lb * 255; rgba[o4 + 3] = 255;
        if (emis && em > 0.02) {
          const e = em > 1 ? 1 : em;
          let er, eg, eb;
          if (P.emis === 'lava') { er = 255; eg = 90 + e * 120; eb = 20; }
          else if (P.emis === 'grid') { er = 90; eg = 230; eb = 255; }
          else if (P.emis === 'bio') { er = 80; eg = 255; eb = 190; }
          else if (P.emis === 'void') { er = 210; eg = 210; eb = 255; }
          else if (P.emis === 'patina') { er = 90; eg = 255; eb = 220; }
          else { er = 230; eg = 245; eb = 255; }
          emis[o4] = er; emis[o4 + 1] = eg; emis[o4 + 2] = eb; emis[o4 + 3] = e * 255;
        }
      }
      if ((py & 31) === 31) yield;
    }
    return { w: PW, h: PW, rgba, emis, mats: GD.mats, props: GD.props, lms: GD.lms };
  },

  // ---------------- rock and prop instances (density-driven, clustered, never uniform) ----------------
  props(cx, cy, S, P, C, A, N, GS, PAD, W) {
    const T = TerrainCore, out = [];
    const x0 = cx * S, y0 = cy * S;
    const at = (x, y) => { const i = Math.max(0, Math.min(N - 1, Math.round((x - x0) * GS + PAD - 0.5))), j = Math.max(0, Math.min(N - 1, Math.round((y - y0) * GS + PAD - 0.5))); return j * N + i; };
    const nearDep = (x, y) => { for (const d of C.deps) if (Math.hypot(x - d.x, y - d.y) < d.r + 1.6) return true; return false; };
    const geo = k => { const wB = W[k * 6 + 4], wL = W[k * 6 + 5], wG = W[k * 6 + 3]; return wL > 0.35 ? 2 : wB > 0.35 ? 0 : wG > 0.3 ? 3 : 1; };
    // clusters
    for (let by = 0; by < S; by += 8) for (let bx = 0; bx < S; bx += 8) {
      const rnd = T.rng(T.hi(cx * 4 + bx / 8, cy * 4 + by / 8, P.seed + 8001));
      for (let t = 0; t < 3; t++) {
        const x = x0 + bx + rnd() * 8, y = y0 + by + rnd() * 8;
        const k = at(x, y), a = k * 13;
        const dens = A[a + 2] * 1.4 + A[a + 3] * 1.1 + A[a + 6] * 0.9 + A[a + 7] * 1.2 + W[k * 6 + 3] * 0.8 + W[k * 6 + 4] * 0.6 - W[k * 6 + 1] * 0.8 - W[k * 6] * 0.4 - A[a + 5] * 0.6;
        if (rnd() > dens * 0.55 || nearDep(x, y)) continue;
        const g = geo(k);
        const n = 3 + Math.floor(rnd() * 6);
        const bigCls = rnd() < 0.25 ? 3 : 2;
        out.push(['rock', Math.floor(rnd() * 6), x, y, bigCls, g, rnd() < 0.15 ? 1 : 0]);
        for (let m = 0; m < n; m++) {
          const aa = rnd() * 6.283, dd = 0.6 + rnd() * 1.8, xx = x + Math.cos(aa) * dd, yy = y + Math.sin(aa) * dd * 0.8;
          if (nearDep(xx, yy)) continue;
          out.push([rnd() < 0.45 ? 'pebbles' : 'rock', Math.floor(rnd() * 6), xx, yy, rnd() < 0.7 ? 0 : 1, g, 0]);
        }
      }
    }
    // scattered singles following density
    const rnd = T.rng(T.hi(cx, cy, P.seed + 8101));
    for (let i = 0; i < 46; i++) {
      const x = x0 + rnd() * S, y = y0 + rnd() * S;
      const k = at(x, y), a = k * 13;
      const dens = 0.35 + A[a + 2] + A[a + 3] * 0.8 + W[k * 6 + 4] * 0.7 + W[k * 6 + 3] * 0.6 - W[k * 6 + 1] * 0.9 - A[a + 5] * 0.5;
      if (rnd() > dens * 0.6 || nearDep(x, y)) continue;
      out.push([rnd() < 0.5 ? 'pebbles' : 'rock', Math.floor(rnd() * 6), x, y, rnd() < 0.85 ? 0 : 1, geo(k), 0]);
    }
    // floor scatter: every 8 x 8 block carries at least one small detail (no empty 400 px windows)
    for (let by = 0; by < S; by += 8) for (let bx = 0; bx < S; bx += 8) {
      const r2 = T.rng(T.hi(cx * 4 + bx / 8 + 911, cy * 4 + by / 8 - 377, P.seed + 8201));
      const m = 1 + (r2() < 0.5 ? 1 : 0);
      for (let i = 0; i < m; i++) {
        const x = x0 + bx + 0.5 + r2() * 7, y = y0 + by + 0.5 + r2() * 7;
        if (nearDep(x, y)) continue;
        const k = at(x, y), dune = W[k * 6 + 1];
        out.push([dune > 0.5 || r2() < 0.6 ? 'pebbles' : 'rock', Math.floor(r2() * 6), x, y, 0, geo(k), 0]);
      }
    }
    // planet props
    const pr = { 2: 'patina', 3: 'ice', 4: 'lavarock', 5: 'flora', 6: 'pylon', 7: 'crystal', 8: 'voidshard' }[P.style];
    if (pr) for (let i = 0; i < 10; i++) {
      const x = x0 + rnd() * S, y = y0 + rnd() * S, k = at(x, y);
      if (nearDep(x, y) || W[k * 6 + 1] > 0.5) continue;
      if (rnd() < 0.55) out.push([pr, Math.floor(rnd() * 4), x, y, rnd() < 0.3 ? 1 : 0, 0, 0]);
    }
    // landmarks inside this chunk
    for (const lm of C.lms) {
      if (lm.x < x0 || lm.x >= x0 + S || lm.y < y0 || lm.y >= y0 + S) continue;
      if (lm.type === 'wreck') {
        out.push(['wreck', lm.wreck, lm.x, lm.y, 2, 0, 0]);
        const r2 = T.rng(lm.seed);
        for (let i = 0; i < 9; i++) { const a = r2() * 6.283, d = 1 + r2() * 3; out.push(['debris', Math.floor(r2() * 4), lm.x + Math.cos(a) * d, lm.y + Math.sin(a) * d * 0.7, 0, 0, 0]); }
      } else if (lm.type === 'devils') {
        const r2 = T.rng(lm.seed);
        for (let i = 0; i < 6; i++) out.push(['devtrack', Math.floor(r2() * 4), lm.x + (r2() - 0.5) * 24, lm.y + (r2() - 0.5) * 24, 1, 0, 0]);
      }
    }
    out.sort((a, b) => a[3] - b[3]);
    return out;
  },

  // cheap single-point colour for overviews (no craters)
  sampleColor(x, y, P, out) {
    const T = TerrainCore; T.init();
    const o = new Float32Array(13);
    T.field(x, y, P, { craters: [], lms: [], deps: [] }, o);
    const c = P.col;
    const wS = o[1] * 1.6, wB = o[6] * 1.3, wL = o[5] * 1.6, wC = 0.6, sum = wS + wB + wL + wC;
    for (let i = 0; i < 3; i++) out[i] = ((c[1][i] * wS + c[4][i] * wB + c[5][i] * wL + c[2][i] * wC) / sum) * 255 * (1 + o[0] * 0.03);
  }
};
