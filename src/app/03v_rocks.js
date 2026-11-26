// =====================================================================
// RockArt: rock and prop sprites placed by the terrain (density driven).
// 4 size classes (pebble group, boulder, findling, slab) x 6 shapes x
// 4 geologies (basalt, sandstone, salt/gypsum, iron oxide) + mineral veins,
// planet props, wrecks and debris. Each sprite carries its own AO, a
// shadow towards the bottom right, a dust lip and a half-buried base.
// =====================================================================
const RockArt = {
  SIZE: [0.38, 0.72, 1.25, 2.1],
  hex(c) { return Col.hex(c[0] * 255, c[1] * 255, c[2] * 255); },
  geoColor(geo) {
    const P = TerrainSys.P, c = P.col;
    const base = [c[4], c[2], c[5], c[3]][geo] || c[2];
    const tint = ['#5e5862', '#a8694a', '#ddd3c2', '#8e5236'][geo];
    return Col.mix(RockArt.hex(base), tint, P.style <= 2 ? 0.45 : 0.2);
  },
  sprite(kind, v, cls, geo, flag, ppt) {
    return Art.cached('P|RK|' + kind + '|' + v + '|' + cls + '|' + geo + '|' + flag + '|' + ppt, () => RockArt.make(kind, v, cls, geo, flag, ppt));
  },
  draw(ctx, pr, ox, oy, ppt) {
    const [kind, v, x, y, cls, geo, flag] = pr;
    const bucket = Art.bucket(ppt, 96);
    const s = RockArt.sprite(kind, v, cls, geo, flag, bucket);
    ctx.drawImage(s.canvas, x - ox - s.ax, y - oy - s.ay, s.w, s.h);
  },
  make(kind, v, cls, geo, flag, ppt) {
    const P = TerrainSys.P;
    const sz = kind === 'rock' ? RockArt.SIZE[cls] : kind === 'pebbles' ? 0.9 : kind === 'wreck' ? 2.6 : kind === 'devtrack' ? 3 : kind === 'debris' ? 0.5 : 0.8 + cls * 0.5;
    const W = sz * 2.0 + 0.4, H = sz * 1.7 + 0.4;
    const c = Art.canvas(W * ppt, H * ppt), x = c.getContext('2d');
    x.scale(ppt, ppt); x.translate(W * 0.42, H * 0.62);
    x.lineJoin = 'round'; x.lineCap = 'round';
    const rnd = RNG.mulberry32(RNG.hash(RNG.hashString(kind), v * 31 + cls, geo * 7 + flag));
    const dustCol = RockArt.hex(P.col[0]), shadowCol = RockArt.hex(P.shadow);
    const wa = P.wind;
    const shadow = (w, h, hh) => { x.fillStyle = Col.rgba(shadowCol, 0.32); x.beginPath(); x.ellipse(hh * 0.42, hh * 0.22, w * 1.05, h * 0.75, 0.25, 0, Math.PI * 2); x.fill(); };
    const lip = (w, h) => {
      // dust lip and a sand tongue in the lee (wind direction)
      x.fillStyle = Col.rgba(Col.shade(dustCol, 0.18), 0.45); x.beginPath(); x.ellipse(0, h * 0.18, w * 1.15, h * 0.5, 0, 0, Math.PI * 2); x.fill();
      x.save(); x.rotate(wa); x.fillStyle = Col.rgba(Col.shade(dustCol, 0.1), 0.35); x.beginPath(); x.moveTo(w * 0.2, -h * 0.25); x.quadraticCurveTo(w * 2.4, 0, w * 0.2, h * 0.3); x.fill(); x.restore();
      x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(0.02, h * 0.05, w * 0.95, h * 0.35, 0, 0, Math.PI * 2); x.fill();
    };
    // half-buried base: dust colour creeping up the rock, only inside its silhouette
    const bury = (w, h, top, pts) => {
      x.save();
      if (pts) { Art.poly(x, pts); x.clip(); }
      const g = x.createLinearGradient(0, top + h * 0.15, 0, h * 0.35);
      g.addColorStop(0, Col.rgba(dustCol, 0)); g.addColorStop(1, Col.rgba(dustCol, 0.7));
      x.fillStyle = g; x.fillRect(-w * 1.3, top, w * 2.6, h * 1.4);
      x.restore();
    };
    if (kind === 'rock') {
      const col = RockArt.geoColor(geo), t = Art.tones(col);
      const w = sz * (0.55 + rnd() * 0.25), hh = sz * (cls === 3 ? 0.22 : 0.45 + rnd() * 0.35), d = sz * 0.42;
      shadow(w, d, hh); lip(w, d);
      if (cls === 3) {
        // flat slab with strata and a lit edge
        const pts = Art.blobPts(rnd, 0, -hh * 0.5, w * 1.15, d * 0.85, 9, 0.22, rnd());
        x.fillStyle = t.lo; x.save(); x.translate(0, hh * 0.5); Art.poly(x, pts); x.fill(); x.restore();
        Art.facets(x, pts, -w * 0.25, -hh, t, { lw: 0.025, flat: true });
        x.strokeStyle = Col.rgba(t.lo, 0.6); x.lineWidth = 0.025;
        for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(-w * 0.9, -hh * 0.5 + i * d * 0.22 - d * 0.4); x.quadraticCurveTo(0, -hh * 0.5 + i * d * 0.22 - d * 0.5, w * 0.9, -hh * 0.5 + i * d * 0.22 - d * 0.35); x.stroke(); }
        x.strokeStyle = Col.rgba(t.rim, 0.8); x.lineWidth = 0.03; Art.polyline(x, pts.slice(Math.floor(pts.length * 0.45), Math.floor(pts.length * 0.85))); x.stroke();
      } else {
        const n = 6 + (v % 3);
        const pts = Art.blobPts(rnd, 0, -hh * 0.55, w, hh * 0.75 + d * 0.3, n, 0.32 + (v % 2) * 0.1, rnd());
        Art.facets(x, pts, -w * 0.28, -hh * 0.8, t, { lw: 0.025 + sz * 0.02 });
        // light edge (top left) and a few speckles
        x.strokeStyle = Col.rgba(t.rim, 0.7); x.lineWidth = 0.022;
        Art.polyline(x, pts.slice(Math.floor(n * 0.45), Math.floor(n * 0.85) + 1)); x.stroke();
        for (let i = 0; i < 4 + cls * 3; i++) { x.fillStyle = Col.rgba(i % 2 ? t.hi : t.lo, 0.5); x.fillRect((rnd() - 0.5) * w * 1.2, -hh * 0.55 + (rnd() - 0.5) * hh, 0.025, 0.025); }
        if (flag) { // mineral vein with a glint
          x.strokeStyle = Col.rgba(P.style === 4 ? '#ff8a3a' : '#f0e0a0', 0.9); x.lineWidth = 0.03;
          x.beginPath(); x.moveTo(-w * 0.6, -hh * 0.3); x.lineTo(-w * 0.1, -hh * 0.7); x.lineTo(w * 0.4, -hh * 0.5); x.stroke();
          Art.glint(x, -w * 0.1, -hh * 0.7, 0.08 + sz * 0.05);
        }
        if (P.style === 3) { x.fillStyle = 'rgba(240,250,255,.7)'; x.beginPath(); x.ellipse(-w * 0.1, -hh * 1.1, w * 0.6, hh * 0.25, 0, 0, Math.PI * 2); x.fill(); }
        if (P.style === 5 && geo !== 2) { x.fillStyle = 'rgba(100,190,110,.55)'; x.beginPath(); x.ellipse(w * 0.2, -hh * 1.0, w * 0.5, hh * 0.22, 0, 0, Math.PI * 2); x.fill(); }
        bury(w, d, -hh * 0.2, pts);
      }
    } else if (kind === 'pebbles') {
      const n = 4 + (v % 4);
      for (let i = 0; i < n; i++) {
        const px = (rnd() - 0.5) * sz * 1.1, py = (rnd() - 0.5) * sz * 0.5, r = 0.04 + rnd() * 0.06;
        const col = Col.shade(RockArt.geoColor((geo + i) % 4), (rnd() - 0.5) * 0.3), t = Art.tones(col);
        x.fillStyle = Col.rgba(shadowCol, 0.35); x.beginPath(); x.ellipse(px + r * 0.6, py + r * 0.4, r * 1.05, r * 0.55, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = t.base; x.beginPath(); x.ellipse(px, py, r, r * 0.75, rnd() * 3, 0, Math.PI * 2); x.fill();
        x.fillStyle = Col.rgba(t.rim, 0.7); x.beginPath(); x.arc(px - r * 0.3, py - r * 0.3, r * 0.35, 0, Math.PI * 2); x.fill();
      }
    } else if (kind === 'debris') {
      const t = Art.pal(v % 2 ? 'steel' : 'anth');
      for (let i = 0; i < 3; i++) { x.save(); x.translate((rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.2); x.rotate(rnd() * 3); x.fillStyle = Col.rgba(shadowCol, 0.3); x.fillRect(0.03, 0.03, 0.18, 0.06); x.fillStyle = t.base; x.fillRect(0, 0, 0.18, 0.06); x.fillStyle = t.hi; x.fillRect(0, 0, 0.18, 0.015); x.restore(); }
    } else if (kind === 'devtrack') {
      x.strokeStyle = Col.rgba(Col.shade(dustCol, -0.35), 0.35); x.lineWidth = 0.12;
      x.beginPath(); let px = -sz, py = 0;
      x.moveTo(px, py);
      for (let i = 0; i < 40; i++) { const a = i * 0.55; px += 0.08; py = Math.sin(i * 0.3) * 0.4; x.lineTo(px + Math.cos(a) * 0.25, py + Math.sin(a) * 0.15); }
      x.stroke();
    } else if (kind === 'wreck') {
      RockArt.wreck(x, v, rnd, dustCol, shadowCol);
    } else {
      RockArt.planetProp(x, kind, v, cls, rnd, dustCol, shadowCol);
    }
    return { canvas: c, w: W, h: H, ax: W * 0.42, ay: H * 0.62 };
  },
  wreck(x, v, rnd, dustCol, shadowCol) {
    const steel = Art.pal('steel'), anth = Art.pal('anth'), white = Art.pal('white'), orange = Art.pal('orange');
    x.fillStyle = Col.rgba(Col.shade(dustCol, -0.3), 0.35); x.beginPath(); x.ellipse(0.2, 0.15, 1.6, 0.7, 0, 0, Math.PI * 2); x.fill();
    const dusty = () => { x.fillStyle = Col.rgba(dustCol, 0.35); x.beginPath(); x.ellipse(0, 0.1, 1.2, 0.35, 0, 0, Math.PI * 2); x.fill(); };
    if (v === 0) { // crashed probe
      x.fillStyle = Col.rgba(shadowCol, 0.35); x.beginPath(); x.ellipse(0.4, 0.2, 0.8, 0.35, 0, 0, Math.PI * 2); x.fill();
      BuildingArt.sphere(x, 0, -0.35, 0.45, white);
      x.fillStyle = '#2a3a5a'; x.save(); x.rotate(-0.3); x.fillRect(0.4, -0.55, 0.9, 0.35); x.strokeStyle = '#7fb0ff'; x.lineWidth = 0.02; x.strokeRect(0.4, -0.55, 0.9, 0.35); x.restore();
      x.strokeStyle = steel.base; x.lineWidth = 0.04; x.beginPath(); x.moveTo(-0.2, -0.7); x.lineTo(-0.6, -1.3); x.stroke();
    } else if (v === 1) { // old rover
      Art.box(x, -0.9, -0.35, 1.8, 0.6, 0.45, Art.tones('#b8aa98'), { r: 0.06, lw: 0.025 });
      for (const wx of [-0.7, 0, 0.7]) { x.fillStyle = '#2a2a2e'; x.beginPath(); x.ellipse(wx, 0.3, 0.2, 0.12, 0, 0, Math.PI * 2); x.fill(); }
      x.strokeStyle = steel.lo; x.lineWidth = 0.04; x.beginPath(); x.moveTo(0.5, -0.6); x.lineTo(0.7, -1.1); x.stroke();
      x.fillStyle = Col.rgba(dustCol, 0.5); x.fillRect(-0.9, -0.62, 1.8, 0.25);
      x.strokeStyle = Col.rgba(Col.shade(dustCol, -0.3), 0.4); x.lineWidth = 0.08; x.beginPath(); x.moveTo(-1.0, 0.55); x.quadraticCurveTo(-2, 0.9, -3, 0.6); x.moveTo(-1.0, 0.1); x.quadraticCurveTo(-2, 0.4, -3, 0.15); x.stroke();
    } else if (v === 2) { // fallen antenna mast
      x.save(); x.rotate(0.2);
      x.strokeStyle = steel.edge; x.lineWidth = 0.08; x.beginPath(); x.moveTo(-1.4, 0); x.lineTo(1.2, -0.2); x.stroke();
      x.strokeStyle = steel.base; x.lineWidth = 0.04; x.beginPath(); for (let i = 0; i < 8; i++) { x.moveTo(-1.3 + i * 0.32, -0.1); x.lineTo(-1.15 + i * 0.32, 0.06); } x.stroke();
      BuildingArt.dish(x, 1.25, -0.25, 0.4, 1);
      x.restore();
    } else if (v === 3) { // solar panel debris
      for (let i = 0; i < 4; i++) { x.save(); x.translate((i - 1.5) * 0.55, (i % 2) * 0.2); x.rotate((rnd() - 0.5) * 0.8); x.fillStyle = Col.rgba(shadowCol, 0.3); x.fillRect(0.05, 0.05, 0.5, 0.32); x.fillStyle = '#26365a'; x.fillRect(0, 0, 0.5, 0.32); x.strokeStyle = '#7fb0ff'; x.lineWidth = 0.015; x.strokeRect(0, 0, 0.5, 0.32); x.beginPath(); x.moveTo(0.25, 0); x.lineTo(0.25, 0.32); x.stroke(); x.restore(); }
    } else if (v === 4) { // weathered flag
      BuildingArt.mast(x, 0, 0.1, 1.5, 0.05, white);
      x.fillStyle = Col.mix(orange.base, dustCol, 0.5); x.beginPath(); x.moveTo(0.03, -1.35); x.quadraticCurveTo(0.35, -1.2, 0.6, -1.32); x.lineTo(0.55, -1.05); x.quadraticCurveTo(0.3, -0.98, 0.03, -1.08); x.fill();
      dusty();
    } else { // lander remains
      Art.cyl(x, 0, 0, 0.7, 0.35, 0.7, Art.tones('#9aa0aa'), { bands: 1 });
      x.strokeStyle = anth.base; x.lineWidth = 0.07;
      x.beginPath(); x.moveTo(-0.6, -0.1); x.lineTo(-1.1, 0.35); x.moveTo(0.6, -0.1); x.lineTo(0.9, 0.2); x.lineTo(1.3, 0.25); x.stroke();
      x.fillStyle = orange.lo; x.fillRect(-0.6, -0.55, 1.2, 0.07);
      x.fillStyle = 'rgba(20,16,14,.35)'; x.beginPath(); x.ellipse(0.1, 0.3, 1.5, 0.6, 0, 0, Math.PI * 2); x.fill();
    }
  },
  planetProp(x, kind, v, cls, rnd, dustCol, shadowCol) {
    const s = 0.8 + cls * 0.4;
    x.fillStyle = Col.rgba(shadowCol, 0.3); x.beginPath(); x.ellipse(0.15 * s, 0.08, 0.45 * s, 0.16 * s, 0, 0, Math.PI * 2); x.fill();
    if (kind === 'patina') {
      const pts = Art.blobPts(rnd, 0, 0, 0.6 * s, 0.35 * s, 9, 0.25);
      x.fillStyle = 'rgba(90,60,40,.5)'; x.save(); x.scale(1.15, 1.2); Art.smoothPath(x, pts); x.fill(); x.restore();
      const g = x.createLinearGradient(-0.5, -0.3, 0.5, 0.3); g.addColorStop(0, '#9af0d8'); g.addColorStop(1, '#1f8a76');
      x.fillStyle = g; Art.smoothPath(x, pts); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 0.03; x.beginPath(); x.ellipse(-0.15 * s, -0.08 * s, 0.2 * s, 0.05 * s, -0.2, Math.PI, Math.PI * 1.8); x.stroke();
    } else if (kind === 'ice') {
      for (let i = 0; i < 3; i++) { const t = { hi: '#ffffff', base: '#c8e6fa', lo: '#7aa8d0', edge: '#4a78a8', rim: '#ffffff' }; Art.facets(x, Art.blobPts(rnd, (i - 1) * 0.3 * s, -0.12 * s, 0.25 * s, 0.22 * s, 5, 0.35), (i - 1) * 0.3 * s - 0.05, -0.2 * s, t, { lw: 0.025 }); }
    } else if (kind === 'lavarock') {
      const t = Art.tones('#2a2220');
      const pts = Art.blobPts(rnd, 0, -0.2 * s, 0.4 * s, 0.3 * s, 7, 0.3);
      Art.facets(x, pts, -0.1, -0.3 * s, t, { lw: 0.03 });
      x.strokeStyle = '#ff7a2a'; x.lineWidth = 0.035; x.beginPath(); x.moveTo(-0.25 * s, -0.15 * s); x.lineTo(0, -0.3 * s); x.lineTo(0.2 * s, -0.18 * s); x.stroke();
      x.fillStyle = 'rgba(255,140,60,.3)'; x.beginPath(); x.arc(0, -0.25 * s, 0.25 * s, 0, Math.PI * 2); x.fill();
    } else if (kind === 'flora') {
      const cols = ['#7affb0', '#c07aff', '#ff8ad8', '#7ad0ff'];
      for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; x.fillStyle = i % 2 ? '#3a8a5a' : '#5ab07a'; x.beginPath(); x.ellipse(Math.cos(a) * 0.18 * s, Math.sin(a) * 0.1 * s, 0.2 * s, 0.07 * s, a, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = cols[v % 4]; x.beginPath(); x.arc(0, 0, 0.07 * s, 0, Math.PI * 2); x.fill();
    } else if (kind === 'pylon') {
      Art.box(x, -0.12, -0.12, 0.24, 0.2, 0.9, Art.tones('#3a3460'), { r: 0.03, lw: 0.02 });
      x.fillStyle = v % 2 ? '#3ff0ff' : '#ff4fd8'; x.beginPath(); x.arc(0, -0.62, 0.06, 0, Math.PI * 2); x.fill();
    } else if (kind === 'crystal') {
      for (let i = 0; i < 4; i++) { const px = (i - 1.5) * 0.16 * s, len = (0.35 + rnd() * 0.45) * s, w = 0.07 * s, a = (i - 1.5) * 0.22; x.save(); x.translate(px, 0); x.rotate(a); Art.facets(x, [[-w, 0], [-w * 0.8, -len], [0, -len - w * 1.3], [w * 0.8, -len], [w, 0]], -w * 0.2, -len * 0.5, { hi: '#ffffff', base: '#e0d4ff', lo: '#9a8ad0', edge: '#5a4a8a', rim: '#ffffff' }, { lw: 0.02 }); x.restore(); }
    } else if (kind === 'voidshard') {
      for (let i = 0; i < 3; i++) { const t = { hi: '#6a6aa8', base: '#1c1c3a', lo: '#0a0a18', edge: '#8a7dff', rim: '#c8c0ff' }; Art.facets(x, [[(i - 1) * 0.2 - 0.06, 0], [(i - 1) * 0.2, -0.45 * s + i * 0.08], [(i - 1) * 0.2 + 0.08, 0]], (i - 1) * 0.2, -0.2, t, { lw: 0.02 }); }
      Art.glint(x, 0, -0.35 * s, 0.1, '#ffffff');
    }
  }
};
