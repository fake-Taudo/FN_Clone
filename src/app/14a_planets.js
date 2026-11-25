// =====================================================================
// PlanetArt: individual procedural planet spheres. A seamless surface
// texture (3D value noise sampled on the sphere) is mapped onto a lit
// disc with a soft terminator; atmosphere rim, clouds, rings and moons
// are layered per frame. Dark planets get a strong rim light.
// =====================================================================
const PlanetArt = {
  // style per planet: 1..8 fixed, 9+ procedural combinations
  spec(planet) {
    const k = planet.index || 1;
    if (PlanetArt._spec[k]) return PlanetArt._spec[k];
    const rnd = RNG.mulberry32(RNG.hash(k, 313, 77));
    let s;
    if (k <= 8) s = [null,
      { style: 'rocky', rings: 0, moons: 2, clouds: 0.15, caps: 1, craters: 26 },
      { style: 'patina', rings: 0, moons: 1, clouds: 0.25, caps: 0, craters: 8 },
      { style: 'ice', rings: 0, moons: 1, clouds: 0.3, caps: 0, craters: 4 },
      { style: 'lava', rings: 0, moons: 0, clouds: 0.1, caps: 0, craters: 10, emissive: '#ff6a1f' },
      { style: 'jungle', rings: 0, moons: 1, clouds: 0.55, caps: 0, craters: 0 },
      { style: 'gas', rings: 2, moons: 3, clouds: 0, caps: 0, craters: 0 },
      { style: 'crystal', rings: 1, moons: 1, clouds: 0.1, caps: 0, craters: 6, emissive: '#ffffff' },
      { style: 'dark', rings: 3, moons: 0, clouds: 0, caps: 0, craters: 0, emissive: '#8a7dff' }][k];
    else {
      const styles = ['rocky', 'gas', 'ice', 'lava', 'jungle', 'patina'];
      const st = styles[Math.floor(rnd() * styles.length)];
      s = { style: st, rings: rnd() < 0.4 ? 1 + Math.floor(rnd() * 2) : 0, moons: Math.floor(rnd() * 3), clouds: st === 'gas' ? 0 : rnd() * 0.5, caps: rnd() < 0.4 ? 1 : 0, craters: st === 'rocky' ? 20 : Math.floor(rnd() * 8), emissive: st === 'lava' ? planet.accent : null };
    }
    s.seed = RNG.hash(k, 999);
    s.dark = ItemArt.lum(planet.ground[1]) < 0.12;
    PlanetArt._spec[k] = s;
    return s;
  },
  _spec: {},
  // seamless 3D value noise
  vn(x, y, z, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const h = (a, b, c) => (RNG.hash(a, b, c, seed) & 0xffff) / 65535;
    const x00 = h(xi, yi, zi) + (h(xi + 1, yi, zi) - h(xi, yi, zi)) * u;
    const x10 = h(xi, yi + 1, zi) + (h(xi + 1, yi + 1, zi) - h(xi, yi + 1, zi)) * u;
    const x01 = h(xi, yi, zi + 1) + (h(xi + 1, yi, zi + 1) - h(xi, yi, zi + 1)) * u;
    const x11 = h(xi, yi + 1, zi + 1) + (h(xi + 1, yi + 1, zi + 1) - h(xi, yi + 1, zi + 1)) * u;
    const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
    return y0 + (y1 - y0) * w;
  },
  fbm(x, y, z, seed, oct = 4) {
    let a = 0.5, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * PlanetArt.vn(x * f, y * f, z * f, seed + i * 17); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  },
  // equirectangular texture: rgb + emissive + cloud alpha
  texture(planet, TW) {
    const key = 'PLT|' + planet.index + '|' + TW;
    return Art.cached(key, () => {
      const TH = TW >> 1, sp = PlanetArt.spec(planet), seed = sp.seed;
      const rgb = new Float32Array(TW * TH * 3), emi = new Float32Array(TW * TH), cld = new Float32Array(TW * TH);
      const C = c => Col.rgb(c).map(v => v / 255);
      const g0 = C(planet.ground[0]), g1 = C(planet.ground[1]), g2 = C(planet.ground[2]), ac = C(planet.accent), rk = C(planet.rock), dc = C(planet.deco);
      const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const rnd = RNG.mulberry32(seed);
      const craters = []; for (let i = 0; i < sp.craters; i++) { const lon = rnd() * Math.PI * 2, lat = (rnd() - 0.5) * 2.6; craters.push([Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon), 0.05 + rnd() * rnd() * 0.22]); }
      const storm = [rnd() * 6.28, (rnd() - 0.5) * 0.8];
      for (let j = 0; j < TH; j++) {
        const lat = (j / (TH - 1) - 0.5) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
        for (let i = 0; i < TW; i++) {
          const lon = i / TW * Math.PI * 2;
          const x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon);
          const n = PlanetArt.fbm(x * 2.2 + 5, y * 2.2 + 5, z * 2.2 + 5, seed);
          const n2 = PlanetArt.fbm(x * 5 + 11, y * 5 + 11, z * 5 + 11, seed + 3, 3);
          let col, e = 0;
          switch (sp.style) {
            case 'rocky': col = mix(mix(g0, g2, U.clamp(n * 1.6 - 0.3, 0, 1)), rk, n2 > 0.62 ? 0.55 : 0); break;
            case 'patina': col = n < 0.42 ? mix(ac, mix(ac, [0.1, 0.3, 0.35], 0.5), (0.42 - n) * 4) : mix(g0, g2, U.clamp((n - 0.42) * 2.5, 0, 1)); if (n > 0.6 && n2 > 0.55) col = mix(col, dc, 0.35); break;
            case 'ice': { col = mix(g1, g2, U.clamp(n * 1.5 - 0.2, 0, 1)); if (n2 < 0.33) col = mix(col, g0, 0.6); const rid = Math.abs(PlanetArt.fbm(x * 4 + 2, y * 4 + 2, z * 4 + 2, seed + 9, 3) - 0.5); if (rid < 0.025) col = mix(col, [0.25, 0.45, 0.7], 0.7); break; }
            case 'lava': { col = mix(g0, g2, n); const rid = Math.abs(PlanetArt.fbm(x * 3.5 + 1, y * 3.5 + 1, z * 3.5 + 1, seed + 5, 4) - 0.5); if (rid < 0.035) { e = 1 - rid / 0.035; col = mix(col, ac, e); } break; }
            case 'jungle': col = n > 0.5 ? mix(g1, g2, U.clamp((n - 0.5) * 3, 0, 1)) : mix(mix(g0, ac, 0.35), g1, n * 2); if (n2 > 0.7) col = mix(col, dc, 0.25); break;
            case 'gas': { const band = Math.sin(lat * 9 + n * 4 + n2 * 1.5); const pal = [g1, ac, g2, dc]; const k2 = (band * 0.5 + 0.5) * 3; const a = Math.floor(k2), f = k2 - a; col = mix(pal[a], pal[Math.min(3, a + 1)], f); col = mix(col, g0, 0.25); const dl = Math.hypot((((lon - storm[0]) + 9.42) % 6.28) - 3.14, (lat - storm[1]) * 2.2); if (dl < 0.32) col = mix(col, [1, 0.95, 1], (0.32 - dl) * 2.2); break; }
            case 'crystal': { const cell = Math.floor(n * 9) / 9; col = mix(g1, g2, cell); col = mix(col, ac, n2 > 0.66 ? 0.3 : 0); if (n2 > 0.78) e = (n2 - 0.78) * 4; break; }
            case 'dark': { col = mix(g0, g1, n); const sw = PlanetArt.fbm(x * 1.6 + 3, y * 3 + 3, z * 1.6 + 3, seed + 7, 4); if (sw > 0.58) { col = mix(col, ac, (sw - 0.58) * 1.6); e = (sw - 0.58) * 1.2; } break; }
            default: col = mix(g0, g2, n);
          }
          // craters: dark floor, bright rim towards the light
          for (const [cx, cy, cz, cr] of craters) {
            const d = Math.hypot(x - cx, y - cy, z - cz);
            if (d < cr * 1.25) { const k = d / cr; col = k < 0.85 ? mix(col, rk, 0.35 * (1 - k * 0.6)) : mix(col, [1, 1, 1], 0.18 * (1 - Math.abs(k - 1.05) * 5)); }
          }
          if (sp.caps) { const p = Math.abs(sl); if (p > 0.86 + n2 * 0.06) col = mix(col, [0.97, 0.96, 0.95], 0.85); }
          const o = (j * TW + i);
          rgb[o * 3] = col[0]; rgb[o * 3 + 1] = col[1]; rgb[o * 3 + 2] = col[2]; emi[o] = e;
          if (sp.clouds) { const c = PlanetArt.fbm(x * 3 + 21, y * 6 + 21, z * 3 + 21, seed + 31, 4); cld[o] = U.clamp((c - (0.62 - sp.clouds * 0.25)) * 3.2, 0, 0.85); }
        }
      }
      return { TW, TH, rgb, emi, cld, bytes: TW * TH * 20, width: TW, height: TH };
    });
  },
  // lit sphere as a canvas (cached per planet and pixel size)
  disc(planet, size) {
    const B = [64, 128, 256, 384, 512, 768];
    let S = 768; for (const b of B) if (b >= size * 0.95) { S = b; break; }
    return Art.cached('PL|' + planet.index + '|' + S, () => {
      const tex = PlanetArt.texture(planet, S <= 128 ? 128 : S <= 256 ? 256 : 384);
      const sp = PlanetArt.spec(planet);
      const c = Art.canvas(S, S), x = c.getContext('2d');
      const img = x.createImageData(S, S), d = img.data;
      const R = S / 2, L = [-0.55, -0.48, 0.68], ll = Math.hypot(L[0], L[1], L[2]);
      const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
      const { TW, TH, rgb, emi, cld } = tex;
      const rot = 1.3;
      const samp = (arr, st, off, k00, k10, k01, k11, a, b) => { const p00 = arr[k00 * st + off], p10 = arr[k10 * st + off]; const p01 = arr[k01 * st + off], p11 = arr[k11 * st + off]; return (p00 + (p10 - p00) * a) * (1 - b) + (p01 + (p11 - p01) * a) * b; };
      const emCol = sp.emissive ? Col.rgb(sp.emissive).map(v => v / 255) : [1, 0.5, 0.2];
      for (let py = 0; py < S; py++) {
        const ny = (py + 0.5 - R) / R;
        for (let px = 0; px < S; px++) {
          const nx = (px + 0.5 - R) / R, q = nx * nx + ny * ny;
          if (q > 1) continue;
          const nz = Math.sqrt(1 - q);
          const lon = Math.atan2(nx, nz) + rot, lat = Math.asin(ny);
          let u = (lon / (Math.PI * 2)) % 1; if (u < 0) u += 1;
          const fu = u * TW, fv = (lat / Math.PI + 0.5) * (TH - 1);
          const i0 = Math.floor(fu) % TW, i1 = (i0 + 1) % TW, j0 = Math.min(TH - 1, Math.floor(fv)), j1 = Math.min(TH - 1, j0 + 1);
          const a = fu - Math.floor(fu), b = fv - j0;
          const k00 = j0 * TW + i0, k10 = j0 * TW + i1, k01 = j1 * TW + i0, k11 = j1 * TW + i1;
          let r = samp(rgb, 3, 0, k00, k10, k01, k11, a, b), g = samp(rgb, 3, 1, k00, k10, k01, k11, a, b), bl = samp(rgb, 3, 2, k00, k10, k01, k11, a, b);
          const cl = sp.clouds ? samp(cld, 1, 0, k00, k10, k01, k11, a, b) : 0;
          r = r + (0.96 - r) * cl; g = g + (0.97 - g) * cl; bl = bl + (1 - bl) * cl;
          const dot = nx * lx + ny * ly + nz * lz;
          const lit = U.clamp((dot + 0.12) / 0.75, 0, 1);
          const shade = (0.06 + 0.94 * lit * lit * (3 - 2 * lit)) * (0.78 + 0.22 * nz);
          const em = samp(emi, 1, 0, k00, k10, k01, k11, a, b) * (1 - cl);
          const night = 1 - lit;
          r = r * shade + emCol[0] * em * (0.35 + night * 0.65); g = g * shade + emCol[1] * em * (0.35 + night * 0.65); bl = bl * shade + emCol[2] * em * (0.35 + night * 0.65);
          // specular glint on the lit side
          const spc = Math.pow(Math.max(0, dot), 24) * (sp.style === 'ice' || sp.style === 'patina' || sp.style === 'crystal' ? 0.35 : 0.12);
          const o = (py * S + px) * 4;
          d[o] = Math.min(255, (r + spc) * 255); d[o + 1] = Math.min(255, (g + spc) * 255); d[o + 2] = Math.min(255, (bl + spc) * 255);
          const edge = (1 - Math.sqrt(q)) * R;
          d[o + 3] = edge < 1 ? Math.max(0, edge) * 255 : 255;
        }
      }
      x.putImageData(img, 0, 0);
      return c;
    });
  },
  ringPath(ctx, cx, cy, rx, ry, back) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, -0.32, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI);
  },
  rings(ctx, cx, cy, r, planet, sp, back, t) {
    if (!sp.rings) return;
    const ac = planet.accent;
    ctx.save();
    if (sp.style === 'dark') {
      // accretion ring with lensed arc
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = Col.rgba(i === 1 ? '#ffffff' : ac, back ? 0.25 : 0.55 - i * 0.1); ctx.lineWidth = r * (0.09 - i * 0.025);
        PlanetArt.ringPath(ctx, cx, cy, r * (1.55 + i * 0.12), r * (0.32 + i * 0.03), back); ctx.stroke();
      }
      if (back) { ctx.strokeStyle = Col.rgba(ac, 0.35 + 0.1 * Math.sin(t * 2)); ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.12, r * 1.12, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
    } else {
      const bands = sp.rings === 2 ? [[1.35, 0.1, 0.5], [1.55, 0.16, 0.65], [1.8, 0.07, 0.4]] : [[1.45, 0.05, 0.55], [1.62, 0.03, 0.4]];
      for (const [k, w, a] of bands) {
        ctx.strokeStyle = Col.rgba(Col.mix(ac, '#ffffff', 0.35), back ? a * 0.6 : a); ctx.lineWidth = r * w;
        PlanetArt.ringPath(ctx, cx, cy, r * k, r * k * 0.24, back); ctx.stroke();
      }
    }
    ctx.restore();
  },
  moons(ctx, cx, cy, r, planet, sp, back, t) {
    for (let i = 0; i < sp.moons; i++) {
      const a = t * (0.18 + i * 0.07) + i * 2.1 + sp.seed % 7;
      const behind = Math.sin(a) < 0;
      if (behind !== back) continue;
      const mr = r * (0.09 + (i % 2) * 0.05), dist = r * (1.55 + i * 0.35);
      const mx = cx + Math.cos(a) * dist, my = cy + Math.sin(a) * dist * 0.3 - r * 0.12 * i;
      const col = Col.mix(planet.rock, '#c8c8d0', 0.55);
      const g = ctx.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, mr * 0.1, mx, my, mr);
      g.addColorStop(0, Col.shade(col, 0.45)); g.addColorStop(0.6, col); g.addColorStop(1, Col.shade(col, -0.7));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    }
  },
  draw(ctx, cx, cy, r, planet, t = 0, o = {}) {
    if (r <= 0.5) return;
    const sp = PlanetArt.spec(planet);
    const m = ctx.getTransform(), px = r * 2 * (Math.hypot(m.a, m.b) || 1);
    const sky = planet.sky || [200, 200, 255];
    const skyHex = Col.hex(sky[0], sky[1], sky[2]);
    // halo
    const hg = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.35);
    hg.addColorStop(0, Col.rgba(skyHex, sp.dark ? 0.22 : 0.3)); hg.addColorStop(1, Col.rgba(skyHex, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2); ctx.fill();
    PlanetArt.moons(ctx, cx, cy, r, planet, sp, true, t);
    PlanetArt.rings(ctx, cx, cy, r, planet, sp, true, t);
    ctx.drawImage(PlanetArt.disc(planet, Math.min(768, px)), cx - r, cy - r, r * 2, r * 2);
    // drifting cloud shimmer (cheap: rotating soft blotches inside the disc)
    if (sp.clouds > 0.2 && !o.still) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) { const a = t * 0.05 + i * 1.3; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r * 0.55, cy + (i - 2) * r * 0.3, r * 0.35, r * 0.07, 0.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    // atmosphere rim (lit side stronger) and rim light for dark worlds
    const rg = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r * 1.04);
    rg.addColorStop(0, Col.rgba(skyHex, 0)); rg.addColorStop(0.8, Col.rgba(skyHex, sp.dark ? 0.15 : 0.28)); rg.addColorStop(1, Col.rgba(skyHex, 0));
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, r * 1.04, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = Col.rgba(sp.dark ? Col.mix(planet.accent, '#ffffff', 0.4) : Col.mix(skyHex, '#ffffff', 0.5), sp.dark ? 0.9 : 0.55);
    ctx.lineWidth = Math.max(1, r * (sp.dark ? 0.035 : 0.02));
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.995, Math.PI * 0.85, Math.PI * 1.65); ctx.stroke();
    if (sp.dark) { ctx.globalAlpha = 0.45; ctx.lineWidth = Math.max(1, r * 0.012); ctx.beginPath(); ctx.arc(cx, cy, r * 0.995, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    // emissive twinkle (lava / crystal / dark glow)
    if (sp.emissive && !o.still) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 2.2);
      ctx.drawImage(FxLib.tinted('soft', 0, sp.emissive), cx - r * 0.3, cy - r * 0.1, r * 1.3, r * 1.3);
      ctx.restore();
    }
    PlanetArt.rings(ctx, cx, cy, r, planet, sp, false, t);
    PlanetArt.moons(ctx, cx, cy, r, planet, sp, false, t);
  },
  // small canvas for DOM lists (planet selection)
  icon(planet, size = 44) {
    const d = Math.min(2, window.devicePixelRatio || 1), S = Math.round(size * d);
    const c = document.createElement('canvas'); c.width = c.height = S;
    c.style.width = c.style.height = size + 'px';
    const x = c.getContext('2d');
    x.scale(d, d);
    PlanetArt.draw(x, size / 2, size / 2, size * 0.3, planet, 1, { still: true });
    return c;
  }
};
