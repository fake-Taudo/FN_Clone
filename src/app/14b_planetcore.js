// =====================================================================
// PlanetCore: high-resolution planet renderer for the title screen and
// the intro (runs in a Web Worker built from its own source; DOM free).
// A seamless equirectangular texture is generated once per planet
// (3D noise on the sphere, smooth thresholds, so no stair steps), then
// each view is mapped onto a lit sphere: soft terminator with scatter,
// frayed polar caps, cloud layer with shadows, night-side fill light.
// =====================================================================
const PlanetCore = {
  hi(x, y, z, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2246822519) ^ Math.imul(s | 0, 3266489917); h = Math.imul(h ^ (h >>> 13), 1274126177); h = Math.imul(h ^ (h >>> 16), 668265263); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; },
  vn(x, y, z, s) {
    const H = PlanetCore.hi, xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10), w = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
    const a = H(xi, yi, zi, s), b = H(xi + 1, yi, zi, s), c = H(xi, yi + 1, zi, s), d = H(xi + 1, yi + 1, zi, s);
    const e = H(xi, yi, zi + 1, s), f = H(xi + 1, yi, zi + 1, s), g = H(xi, yi + 1, zi + 1, s), h = H(xi + 1, yi + 1, zi + 1, s);
    const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (h - g) * u;
    const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
    return y1 + (y2 - y1) * w;
  },
  fbm(x, y, z, s, o) { let a = 0.5, f = 1, t = 0, n = 0; for (let i = 0; i < o; i++) { t += a * PlanetCore.vn(x * f, y * f, z * f, s + i * 17); n += a; a *= 0.5; f *= 2.03; } return t / n; },
  ss(a, b, x) { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); },
  // equirect texture (RGB + emission + cloud alpha), generated once per planet
  texture(job) {
    const P = PlanetCore, TW = job.tw, TH = TW >> 1, s = job.seed, st = job.style, C = job.col;
    const rgb = new Uint8ClampedArray(TW * TH * 3), em = new Uint8ClampedArray(TW * TH), cl = new Uint8ClampedArray(TW * TH);
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    // a few big craters and one long canyon scar (Ares-like worlds)
    const craters = [[0.6, 0.2, 0.62, 0.16], [2.4, -0.4, 0.55, 0.11], [4.1, 0.35, 0.6, 0.13]];
    for (let j = 0; j < TH; j++) {
      const lat = (j / (TH - 1) - 0.5) * Math.PI, cla = Math.cos(lat), sla = Math.sin(lat);
      for (let i = 0; i < TW; i++) {
        const lon = i / TW * Math.PI * 2;
        const x = cla * Math.cos(lon), y = sla, z = cla * Math.sin(lon);
        const wx = x + 0.35 * (P.fbm(x * 1.5 + 3, y * 1.5, z * 1.5, s + 3, 3) - 0.5), wz = z + 0.35 * (P.fbm(x * 1.5, y * 1.5 + 7, z * 1.5, s + 4, 3) - 0.5);
        const n = P.fbm(wx * 2.4 + 5, y * 2.4 + 5, wz * 2.4 + 5, s, 5);
        const n2 = P.fbm(x * 6 + 11, y * 6 + 11, z * 6 + 11, s + 9, 4);
        let col, e = 0;
        if (st === 'gas') {
          const band = Math.sin(lat * 9 + (n - 0.5) * 5 + (n2 - 0.5) * 2);
          const k2 = (band * 0.5 + 0.5) * 3, a = Math.floor(k2), f = k2 - a;
          const pal = [C[1], C[6], C[2], C[7]];
          col = mix(pal[a], pal[Math.min(3, a + 1)], f);
          col = mix(col, C[0], 0.2);
        } else {
          // dark volcanic regions with soft organic edges, bright dust plains, fine dust bands
          const dark = P.ss(0.47, 0.58, n);
          col = mix(C[2], C[0], dark * 0.85);
          col = mix(col, C[3], P.ss(0.58, 0.72, n2) * 0.25);
          col = mix(col, C[4], P.ss(0.35, 0.25, n) * 0.5);
          const bands = Math.sin(lat * 22 + n * 6) * 0.5 + 0.5;
          col = mix(col, C[2], bands * 0.08);
          if (st === 'patina') col = mix(col, C[6], P.ss(0.36, 0.28, n));
          if (st === 'ice') { const rid = Math.abs(P.fbm(x * 4, y * 4, z * 4, s + 21, 3) - 0.5); col = mix(col, C[5], P.ss(0.03, 0.0, rid) * 0.7); }
          if (st === 'lava') { const rid = Math.abs(P.fbm(x * 3.5, y * 3.5, z * 3.5, s + 22, 4) - 0.5); e = P.ss(0.045, 0.0, rid); col = mix(col, C[6], e * 0.6); }
          if (st === 'jungle') col = mix(col, C[6], P.ss(0.45, 0.6, n2) * 0.35);
          if (st === 'crystal') { const c2 = Math.floor(n * 9) / 9; col = mix(C[1], C[2], c2); if (n2 > 0.7) e = (n2 - 0.7) * 2; }
          if (st === 'dark') { const sw = P.fbm(x * 1.6 + 3, y * 3 + 3, z * 1.6 + 3, s + 7, 4); col = mix(col, C[6], P.ss(0.58, 0.75, sw) * 0.6); e = P.ss(0.6, 0.8, sw) * 0.6; }
          // canyon scar (a long, soft groove)
          if (st === 'rocky' || st === 'patina') { const cy = Math.abs(y - 0.05 * Math.sin(lon * 3) - 0.08); if (lon > 1.2 && lon < 2.9) { const k = P.ss(0.03, 0.0, cy) * P.ss(1.2, 1.5, lon) * P.ss(2.9, 2.6, lon); col = mix(col, C[0], k * 0.7); } }
          // big craters: dark floor, bright lit rim (light comes from the upper left)
          for (const c of craters) {
            const cx = Math.cos(c[1]) * Math.cos(c[0]), cyy = Math.sin(c[1]), cz = Math.cos(c[1]) * Math.sin(c[0]);
            const d = Math.hypot(x - cx, y - cyy, z - cz);
            if (d < c[3] * 1.3) { const q = d / c[3]; if (q < 0.9) col = mix(col, C[0], 0.25 * (1 - q)); else col = mix(col, C[5], 0.35 * P.ss(1.25, 1.0, q) * P.ss(0.85, 1.0, q)); }
          }
        }
        // frayed, spiralling polar caps with broken-off islands (soft edges, no steps)
        if (job.caps) {
          const pa = Math.abs(sla);
          const spiral = Math.sin(lon * 3 + pa * 18 + (n2 - 0.5) * 6) * 0.02;
          const edge = 0.9 + spiral + (n - 0.5) * 0.06;
          const isl = P.ss(0.6, 0.66, n2) * P.ss(edge - 0.07, edge - 0.02, pa);
          const k = Math.max(P.ss(edge - 0.012, edge + 0.012, pa), isl * 0.85);
          if (k > 0) { const ice = mix([0.93, 0.95, 0.98], [0.82, 0.88, 0.95], P.ss(0.4, 0.7, n2)); col = mix(col, ice, k); }
        }
        const o = (j * TW + i);
        rgb[o * 3] = col[0] * 255; rgb[o * 3 + 1] = col[1] * 255; rgb[o * 3 + 2] = col[2] * 255;
        em[o] = e * 255;
        if (job.clouds > 0) {
          const c = P.fbm(x * 3 + 21, y * 7 + 21, z * 3 + 21, s + 31, 5);
          cl[o] = P.ss(0.62 - job.clouds * 0.2, 0.78 - job.clouds * 0.2, c) * 235;
        }
      }
    }
    return { TW, TH, rgb, em, cl };
  },
  // maps the texture onto a lit sphere; renders only the requested rect of the disc
  render(job, T) {
    const D = job.D, R = D / 2, x0 = job.rx, y0 = job.ry, W = job.rw, H = job.rh;
    const out = new Uint8ClampedArray(W * H * 4);
    const L = [-0.62, -0.5, 0.6], ll = Math.hypot(L[0], L[1], L[2]); L[0] /= ll; L[1] /= ll; L[2] /= ll;
    const { TW, TH, rgb, em, cl } = T, rot = job.rot, crot = job.crot;
    const emc = job.emc;
    const samp = (arr, st, ch, u, v) => {
      const fu = u * TW, fv = v * (TH - 1), i0 = Math.floor(fu), j0 = Math.floor(fv), a = fu - i0, b = fv - j0;
      const i1 = (i0 + 1) % TW, ia = ((i0 % TW) + TW) % TW, j1 = Math.min(TH - 1, j0 + 1);
      const p00 = arr[(j0 * TW + ia) * st + ch], p10 = arr[(j0 * TW + i1) * st + ch], p01 = arr[(j1 * TW + ia) * st + ch], p11 = arr[(j1 * TW + i1) * st + ch];
      return (p00 + (p10 - p00) * a) * (1 - b) + (p01 + (p11 - p01) * a) * b;
    };
    for (let py = 0; py < H; py++) {
      const ny = (y0 + py + 0.5 - R) / R;
      for (let px = 0; px < W; px++) {
        const nx = (x0 + px + 0.5 - R) / R, q = nx * nx + ny * ny;
        if (q >= 1) continue;
        const nz = Math.sqrt(1 - q);
        const lat = Math.asin(ny);
        const lonA = Math.atan2(nx, nz);
        let u = ((lonA + rot) / (Math.PI * 2)) % 1; if (u < 0) u += 1;
        let uc = ((lonA + crot) / (Math.PI * 2)) % 1; if (uc < 0) uc += 1;
        const v = lat / Math.PI + 0.5;
        let r = samp(rgb, 3, 0, u, v), g = samp(rgb, 3, 1, u, v), b = samp(rgb, 3, 2, u, v);
        const dot = nx * L[0] + ny * L[1] + nz * L[2];
        // soft terminator with a little scatter; night side keeps ~6 % cool fill light
        const lit = Math.max(0, Math.min(1, (dot + 0.18) / 0.72));
        const day = lit * lit * (3 - 2 * lit);
        let c = 0;
        if (T.hasClouds) {
          c = samp(cl, 1, 0, uc, v) / 255;
          // cloud shadow: sample the cloud layer slightly towards the light
          const cs = samp(cl, 1, 0, (uc + 0.004) % 1, Math.min(1, v + 0.004)) / 255;
          const sh = 1 - cs * 0.35 * day;
          r *= sh; g *= sh; b *= sh;
        }
        const limb = 0.78 + 0.22 * nz;
        let rr = r * (0.06 + 0.94 * day) * limb + 255 * 0.012 * (1 - day), gg = g * (0.06 + 0.94 * day) * limb + 255 * 0.016 * (1 - day), bb = b * (0.06 + 0.94 * day) * limb + 255 * 0.03 * (1 - day);
        if (c > 0) { const cl2 = (0.08 + 0.92 * day) * limb * 245; rr += (cl2 - rr) * c; gg += (cl2 * 0.98 - gg) * c; bb += (cl2 * 1.02 - bb) * c; }
        const e = samp(em, 1, 0, u, v) / 255 * (1 - c);
        if (e > 0) { const k = e * (0.35 + 0.65 * (1 - day)); rr += emc[0] * k; gg += emc[1] * k; bb += emc[2] * k; }
        // gentle haze towards the limb on the lit side
        const haze = Math.pow(1 - nz, 3) * day * 0.5;
        rr += (job.sky[0] - rr) * haze; gg += (job.sky[1] - gg) * haze; bb += (job.sky[2] - bb) * haze;
        const o = (py * W + px) * 4;
        out[o] = rr; out[o + 1] = gg; out[o + 2] = bb;
        const edge = (1 - Math.sqrt(q)) * R;
        out[o + 3] = edge < 1.2 ? Math.max(0, edge / 1.2) * 255 : 255;
      }
    }
    return out;
  }
};

// main-thread side: worker management, cached texture per planet, bitmap views
const PlanetView = {
  worker: null, busy: false, pending: null, cb: null, tex: null, seq: 0,
  src() {
    const parts = [];
    for (const [k, v] of Object.entries(PlanetCore)) parts.push(typeof v === 'function' ? v.toString() : k + ': ' + JSON.stringify(v));
    return 'const PlanetCore = {\n' + parts.join(',\n') + '\n};\nlet TEX = null, TEXKEY = "";\n' +
      'self.onmessage = e => { const j = e.data;\n' +
      ' if (j.texKey !== TEXKEY) { TEX = PlanetCore.texture(j.tex); TEX.hasClouds = j.tex.clouds > 0; TEXKEY = j.texKey; }\n' +
      ' const px = PlanetCore.render(j, TEX);\n' +
      ' if (typeof OffscreenCanvas !== "undefined") { const oc = new OffscreenCanvas(j.rw, j.rh); oc.getContext("2d").putImageData(new ImageData(px, j.rw, j.rh), 0, 0); const bmp = oc.transferToImageBitmap(); self.postMessage({ id: j.id, bmp, rx: j.rx, ry: j.ry, D: j.D }, [bmp]); }\n' +
      ' else self.postMessage({ id: j.id, px, rx: j.rx, ry: j.ry, rw: j.rw, rh: j.rh, D: j.D }, [px.buffer]); };';
  },
  init() {
    if (PlanetView.worker || !window.Worker) return;
    try {
      PlanetView.worker = new Worker(URL.createObjectURL(new Blob([PlanetView.src()], { type: 'text/javascript' })));
      PlanetView.worker.onmessage = e => PlanetView.done(e.data);
    } catch (e) { PlanetView.worker = null; }
  },
  params(planet) {
    const sp = PlanetArt.spec(planet), r = h => Col.rgb(h).map(v => v / 255);
    const style = sp.style;
    const em = style === 'lava' ? [255, 110, 40] : style === 'dark' ? [140, 125, 255] : style === 'crystal' ? [200, 240, 255] : [255, 200, 120];
    return {
      texKey: planet.index + '|' + sp.seed, emc: em, sky: planet.sky || [200, 200, 255],
      tex: { seed: sp.seed, style, caps: sp.caps || style === 'ice', clouds: sp.clouds, col: [r(planet.ground[0]), r(planet.ground[1]), r(planet.ground[2]), r(planet.deco || planet.ground[2]), r(planet.rock), r('#f4ece2'), r(planet.accent), r(planet.deco || planet.accent)], tw: 2048 }
    };
  },
  // request a view of the disc (diameter D, visible rect) at rotation rot; cb(bitmap, rect)
  request(planet, D, rect, rot, cb, lowRes) {
    PlanetView.init();
    const P = PlanetView.params(planet);
    if (lowRes) P.tex.tw = 512;
    const job = Object.assign({ id: ++PlanetView.seq, D, rx: Math.max(0, rect[0] | 0), ry: Math.max(0, rect[1] | 0), rot, crot: rot * 1.25 + 0.4 }, P);
    job.texKey += '|' + P.tex.tw;
    job.rw = Math.max(1, Math.min(D - job.rx, rect[2] | 0)); job.rh = Math.max(1, Math.min(D - job.ry, rect[3] | 0));
    if (!PlanetView.worker) return false;
    if (PlanetView.busy) { PlanetView.pending = [job, cb]; return true; }
    PlanetView.busy = true; PlanetView.cb = cb;
    PlanetView.worker.postMessage(job);
    return true;
  },
  done(m) {
    PlanetView.busy = false;
    let bmp = m.bmp;
    if (!bmp && m.px) { const c = Art.canvas(m.rw, m.rh); c.getContext('2d').putImageData(new ImageData(m.px, m.rw, m.rh), 0, 0); bmp = c; }
    const cb = PlanetView.cb; PlanetView.cb = null;
    if (cb) cb(bmp, m.rx, m.ry, m.D);
    if (PlanetView.pending) { const [j, c] = PlanetView.pending; PlanetView.pending = null; PlanetView.busy = true; PlanetView.cb = c; PlanetView.worker.postMessage(j); }
  }
};
