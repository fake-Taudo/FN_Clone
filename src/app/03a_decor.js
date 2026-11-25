// =====================================================================
// DecorArt: cached terrain decoration sprites per planet (craters with
// depth, 12 rock variants, pebbles, dunes, planet props)
// =====================================================================
const DecorArt = {
  NOM: { crater: 3, rock: 1.2, pebbles: 1.2, dune: 3, pool: 1.5, shard: 1.2, floe: 1.5, frost: 1.5, lava: 1.6, ash: 1.5, plant: 1.2, shroom: 1.1, panel: 1.5, beamline: 1.6, crystal: 1.2, stars: 1.4, gring: 1.6, arc: 1.6 },
  sprite(kind, v, ppt) { return Art.cached('P|DEC|' + kind + '|' + v + '|' + ppt, () => DecorArt.make(kind, v, ppt)); },
  make(kind, v, ppt) {
    const nom = DecorArt.NOM[kind] || 1;
    // sprite box in tiles relative to the anchor
    const box = { crater: [3.6, 3.0], rock: [1.9, 1.7], pebbles: [1.6, 1.0], dune: [3.4, 1.6], pool: [2.2, 1.6], shard: [1.4, 1.6], floe: [2.0, 1.4], frost: [2.0, 1.4], lava: [2.4, 2.0], ash: [2.0, 1.4], plant: [1.4, 1.9], shroom: [1.4, 1.6], panel: [1.8, 1.8], beamline: [2.4, 0.8], crystal: [1.5, 2.0], stars: [1.8, 1.4], gring: [2.4, 1.6], arc: [2.4, 1.4] }[kind] || [1.5, 1.5];
    const [bw, bh] = box;
    const ay = kind === 'rock' || kind === 'shard' || kind === 'plant' || kind === 'shroom' || kind === 'crystal' ? 0.72 : 0.5;
    const c = Art.canvas(bw * ppt, bh * ppt), x = c.getContext('2d');
    x.scale(ppt, ppt); x.translate(bw / 2, bh * ay);
    const rnd = RNG.mulberry32(RNG.hash(RNG.hashString(kind), v, Render.palette.index));
    const P = Render.palette, L = Render.look;
    const gmid = P.ground[1], gdark = Col.shade(P.ground[0], -0.25), glight = Col.shade(P.ground[2], 0.2);
    const rockT = ItemArt.T(Col.mix(P.rock, L.rockTint, 0.5));
    const lw = 0.04;
    switch (kind) {
      case 'crater': {
        const R = 1.35, ry = 0.82;
        if (v >= 3) { // ejecta rays
          x.strokeStyle = Col.rgba(glight, 0.22); x.lineCap = 'round';
          for (let i = 0; i < 10; i++) { const a = rnd() * Math.PI * 2, l = R * (1.15 + rnd() * 0.45); x.lineWidth = 0.08 + rnd() * 0.1; x.beginPath(); x.moveTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * ry * 0.9); x.lineTo(Math.cos(a) * l, Math.sin(a) * l * ry); x.stroke(); }
        }
        // raised rim (outer)
        x.fillStyle = Col.rgba(glight, 0.55); x.beginPath(); x.ellipse(0, 0, R * 1.08, R * ry * 1.08, 0, 0, Math.PI * 2); x.fill();
        // bowl: inner shadow top-left, lit bottom-right
        const g = x.createLinearGradient(-R, -R * ry, R, R * ry);
        g.addColorStop(0, Col.shade(gdark, -0.25)); g.addColorStop(0.55, Col.shade(gmid, -0.15)); g.addColorStop(1, Col.shade(glight, 0.05));
        x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, R * 0.92, R * ry * 0.92, 0, 0, Math.PI * 2); x.fill();
        // floor
        x.fillStyle = Col.rgba(Col.shade(gmid, -0.08), 0.85); x.beginPath(); x.ellipse(R * 0.12, R * ry * 0.16, R * 0.55, R * ry * 0.48, 0, 0, Math.PI * 2); x.fill();
        // rim light bottom-right, rim shadow top-left
        x.lineWidth = 0.09; x.strokeStyle = Col.rgba('#ffffff', 0.28); x.beginPath(); x.ellipse(0, 0, R * 0.95, R * ry * 0.95, 0, -0.3, Math.PI * 0.75); x.stroke();
        x.strokeStyle = Col.rgba('#000000', 0.25); x.beginPath(); x.ellipse(0, 0, R * 0.95, R * ry * 0.95, 0, Math.PI * 0.85, Math.PI * 1.7); x.stroke();
        // boulders on the rim
        for (let i = 0; i < 3 + v; i++) { const a = rnd() * Math.PI * 2, px = Math.cos(a) * R * 1.05, py = Math.sin(a) * R * ry * 1.05, s = 0.07 + rnd() * 0.1; Art.facets(x, Art.blobPts(rnd, px, py, s, s * 0.8, 5, 0.4), px - s * 0.2, py - s * 0.2, rockT, { lw: 0.02 }); }
        if (v % 2) { x.fillStyle = Col.rgba(glight, 0.5); x.beginPath(); x.ellipse(R * 0.2, R * ry * 0.2, R * 0.12, R * ry * 0.1, 0, 0, Math.PI * 2); x.fill(); }
        break;
      }
      case 'rock': {
        const group = v >= 8 ? (v === 8 ? 1 : v - 7) : 1;
        const big = v >= 4 ? 1 : 0.65;
        const stones = [];
        for (let i = 0; i < group; i++) stones.push([(i - (group - 1) / 2) * 0.48 + (rnd() - 0.5) * 0.15, (i % 2) * 0.15, (group > 1 ? 0.32 : 0.5) * big * (0.8 + rnd() * 0.4)]);
        stones.sort((a, b) => a[1] - b[1]);
        for (const [px, py, r] of stones) {
          const h = r * (0.9 + (v % 3) * 0.25);
          // cast shadow (bottom right)
          x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(px + h * 0.45, py + 0.05, r * 1.05, r * 0.42, 0.2, 0, Math.PI * 2); x.fill();
          const n = 5 + ((v + Math.floor(px * 10)) % 3);
          const pts = Art.blobPts(rnd, px, py - h * 0.45, r, h * 0.62, n, 0.35, rnd());
          Art.facets(x, pts, px - r * 0.25, py - h * 0.62, rockT, { lw });
          // planet detail on the rock
          const st = Render.planetStyle;
          x.save(); Art.poly(x, pts); x.clip();
          if (st === 2 && v % 2 === 0) { x.fillStyle = Col.rgba('#3fc7b0', 0.55); x.fillRect(px - r, py - h * 1.1, r * 2, h * 0.35); }
          else if (st === 3) { x.fillStyle = 'rgba(240,250,255,.75)'; x.beginPath(); x.ellipse(px - r * 0.1, py - h * 1.0, r * 0.9, h * 0.32, 0, 0, Math.PI * 2); x.fill(); }
          else if (st === 4) { x.strokeStyle = 'rgba(255,110,30,.85)'; x.lineWidth = 0.035; x.beginPath(); x.moveTo(px - r * 0.5, py - h * 0.3); x.lineTo(px, py - h * 0.55); x.lineTo(px + r * 0.4, py - h * 0.4); x.stroke(); }
          else if (st === 5) { x.fillStyle = 'rgba(90,200,110,.6)'; x.beginPath(); x.ellipse(px + r * 0.2, py - h * 0.95, r * 0.6, h * 0.25, 0, 0, Math.PI * 2); x.fill(); }
          else if (st === 7) { x.fillStyle = 'rgba(200,240,255,.7)'; Art.poly(x, [[px, py - h * 1.2], [px + r * 0.2, py - h * 0.6], [px - r * 0.15, py - h * 0.6]]); x.fill(); }
          else if (v % 4 === 1) { x.strokeStyle = Col.rgba(P.deco, 0.5); x.lineWidth = 0.03; x.beginPath(); x.moveTo(px - r * 0.6, py - h * 0.2); x.quadraticCurveTo(px, py - h * 0.7, px + r * 0.6, py - h * 0.35); x.stroke(); }
          x.restore();
        }
        break;
      }
      case 'pebbles': {
        const n = 5 + v;
        for (let i = 0; i < n; i++) {
          const px = (rnd() - 0.5) * 1.2, py = (rnd() - 0.5) * 0.6, r = 0.05 + rnd() * 0.07;
          x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(px + r * 0.5, py + r * 0.4, r, r * 0.5, 0, 0, Math.PI * 2); x.fill();
          const t = ItemArt.T(Col.shade(rockT.base, (rnd() - 0.5) * 0.3));
          x.fillStyle = t.base; x.beginPath(); x.ellipse(px, py, r, r * 0.75, rnd() * 3, 0, Math.PI * 2); x.fill();
          x.fillStyle = Col.rgba(t.rim, 0.6); x.beginPath(); x.arc(px - r * 0.3, py - r * 0.3, r * 0.35, 0, Math.PI * 2); x.fill();
        }
        break;
      }
      case 'dune': {
        x.rotate(L.wind * 0.6);
        for (let i = 0; i < 4 + v; i++) {
          const yy = (i - 2) * 0.24, len = 1.3 - Math.abs(i - 2) * 0.18;
          x.strokeStyle = Col.rgba(glight, 0.35); x.lineWidth = 0.06; x.lineCap = 'round';
          x.beginPath(); x.moveTo(-len, yy); x.bezierCurveTo(-len * 0.3, yy - 0.18, len * 0.3, yy + 0.12, len, yy - 0.04); x.stroke();
          x.strokeStyle = Col.rgba(gdark, 0.25); x.lineWidth = 0.05;
          x.beginPath(); x.moveTo(-len, yy + 0.07); x.bezierCurveTo(-len * 0.3, yy - 0.1, len * 0.3, yy + 0.2, len, yy + 0.03); x.stroke();
        }
        break;
      }
      case 'pool': {
        const pts = Art.blobPts(rnd, 0, 0, 0.95, 0.6, 9, 0.25);
        x.fillStyle = Col.rgba('#e8f0e0', 0.6); x.save(); x.scale(1.12, 1.15); Art.smoothPath(x, pts); x.fill(); x.restore();
        const g = x.createLinearGradient(-0.9, -0.5, 0.9, 0.5); g.addColorStop(0, '#7af0d8'); g.addColorStop(1, '#1a7a6a');
        x.fillStyle = g; Art.smoothPath(x, pts); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 0.06; x.beginPath(); x.ellipse(-0.25, -0.15, 0.35, 0.1, -0.2, Math.PI * 1.1, Math.PI * 1.8); x.stroke();
        x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.ellipse(0.3, 0.1, 0.12, 0.04, 0, 0, Math.PI * 2); x.fill();
        break;
      }
      case 'shard': {
        for (let i = 0; i < 3; i++) {
          const px = (i - 1) * 0.28, len = 0.5 + rnd() * 0.45, w = 0.07 + rnd() * 0.05;
          x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(px + len * 0.3, 0.04, w * 2, w * 0.7, 0, 0, Math.PI * 2); x.fill();
          x.save(); x.translate(px, 0); x.rotate((rnd() - 0.5) * 0.7);
          const g = x.createLinearGradient(-w, 0, w, 0); g.addColorStop(0, '#ffd2a8'); g.addColorStop(0.5, '#d8803a'); g.addColorStop(1, '#6a3410');
          x.fillStyle = g; x.beginPath(); x.moveTo(-w, 0); x.lineTo(-w * 0.4, -len); x.lineTo(w, -len * 0.8); x.lineTo(w, 0); x.closePath(); x.fill();
          x.strokeStyle = '#3a1a08'; x.lineWidth = 0.025; x.stroke();
          x.restore();
        }
        break;
      }
      case 'floe': {
        const pts = Art.blobPts(rnd, 0, 0, 0.85, 0.5, 6, 0.35);
        x.fillStyle = 'rgba(60,100,140,.35)'; x.save(); x.translate(0.06, 0.08); Art.poly(x, pts); x.fill(); x.restore();
        const g = x.createLinearGradient(-0.8, -0.5, 0.8, 0.5); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#a8d0ee');
        x.fillStyle = g; Art.poly(x, pts); x.fill();
        x.strokeStyle = '#6a9ac8'; x.lineWidth = 0.03; x.stroke();
        x.strokeStyle = 'rgba(70,130,190,.7)'; x.lineWidth = 0.025; x.beginPath(); x.moveTo(-0.5, 0.1); x.lineTo(-0.1, -0.05); x.lineTo(0.2, 0.15); x.lineTo(0.55, -0.1); x.moveTo(-0.1, -0.05); x.lineTo(0, -0.35); x.stroke();
        break;
      }
      case 'frost': {
        x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineCap = 'round';
        for (let i = 0; i < 7; i++) { const px = (rnd() - 0.5) * 1.4, py = (rnd() - 0.5) * 0.8, s = 0.1 + rnd() * 0.15; x.lineWidth = 0.025; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3 + rnd() * 0.3; x.beginPath(); x.moveTo(px - Math.cos(a) * s, py - Math.sin(a) * s * 0.6); x.lineTo(px + Math.cos(a) * s, py + Math.sin(a) * s * 0.6); x.stroke(); } }
        x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.ellipse(0, 0, 0.9, 0.5, 0, 0, Math.PI * 2); x.fill();
        break;
      }
      case 'lava': {
        x.lineCap = 'round'; x.lineJoin = 'round';
        const segs = [];
        let px = -1, py = (rnd() - 0.5) * 0.4;
        segs.push([px, py]);
        for (let i = 0; i < 6; i++) { px += 0.33; py += (rnd() - 0.5) * 0.45; segs.push([px, py]); }
        x.strokeStyle = '#120806'; x.lineWidth = 0.2; Art.polyline(x, segs); x.stroke();
        x.strokeStyle = '#ff5a14'; x.lineWidth = 0.1; Art.polyline(x, segs); x.stroke();
        x.strokeStyle = '#ffd27a'; x.lineWidth = 0.035; Art.polyline(x, segs); x.stroke();
        break;
      }
      case 'ash': {
        x.fillStyle = 'rgba(30,26,26,.55)'; x.beginPath(); x.ellipse(0, 0, 0.9, 0.5, 0, 0, Math.PI * 2); x.fill();
        for (let i = 0; i < 14; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(120,115,115,.7)' : 'rgba(60,55,55,.7)'; x.fillRect((rnd() - 0.5) * 1.5, (rnd() - 0.5) * 0.8, 0.06, 0.04); }
        break;
      }
      case 'plant': {
        const cols = ['#c07aff', '#7affb0', '#ff7ad8', '#7ad0ff'];
        const tip = cols[v % 4];
        x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(0.12, 0.03, 0.45, 0.14, 0, 0, Math.PI * 2); x.fill();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.35, len = 0.6 + rnd() * 0.5;
          const ex = Math.cos(a) * len, ey = Math.sin(a) * len;
          x.strokeStyle = '#2a6a4a'; x.lineWidth = 0.08; x.lineCap = 'round';
          x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(ex * 0.2 + (rnd() - 0.5) * 0.3, ey * 0.6, ex, ey); x.stroke();
          x.strokeStyle = '#4ac07a'; x.lineWidth = 0.035; x.stroke();
          x.fillStyle = tip; x.beginPath(); x.arc(ex, ey, 0.08, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#ffffff'; x.beginPath(); x.arc(ex - 0.02, ey - 0.02, 0.025, 0, Math.PI * 2); x.fill();
        }
        break;
      }
      case 'shroom': {
        for (let i = 0; i < 3; i++) {
          const px = (i - 1) * 0.3, h = 0.3 + rnd() * 0.35, r = 0.14 + rnd() * 0.1;
          x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(px + 0.1, 0.03, r, r * 0.35, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#d8e8d0'; x.fillRect(px - 0.035, -h, 0.07, h);
          const g = x.createRadialGradient(px, -h - r * 0.2, 0.01, px, -h, r * 1.2); g.addColorStop(0, '#d8fff0'); g.addColorStop(0.5, '#3ad8a0'); g.addColorStop(1, '#126a5a');
          x.fillStyle = g; x.beginPath(); x.ellipse(px, -h, r, r * 0.6, 0, Math.PI, 0); x.closePath(); x.fill();
          x.fillStyle = 'rgba(255,255,255,.8)'; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(px + (k - 1) * r * 0.5, -h - r * 0.3, 0.018, 0, Math.PI * 2); x.fill(); }
        }
        break;
      }
      case 'panel': {
        x.fillStyle = 'rgba(20,10,40,.6)'; x.fillRect(-0.75, -0.75, 1.5, 1.5);
        x.strokeStyle = Col.rgba(v % 2 ? '#3ff0ff' : '#ff4fd8', 0.8); x.lineWidth = 0.04; x.strokeRect(-0.7, -0.7, 1.4, 1.4);
        x.strokeStyle = 'rgba(120,200,255,.25)'; x.lineWidth = 0.02; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(-0.7 + i * 0.35, -0.7); x.lineTo(-0.7 + i * 0.35, 0.7); x.stroke(); }
        break;
      }
      case 'beamline': {
        x.strokeStyle = 'rgba(63,240,255,.35)'; x.lineWidth = 0.16; x.lineCap = 'round'; x.beginPath(); x.moveTo(-1.1, 0.1); x.quadraticCurveTo(0, -0.25, 1.1, 0.05); x.stroke();
        x.strokeStyle = '#d8ffff'; x.lineWidth = 0.04; x.stroke();
        break;
      }
      case 'crystal': {
        for (let i = 0; i < 4; i++) {
          const px = (i - 1.5) * 0.22, len = 0.45 + rnd() * 0.55, w = 0.08 + rnd() * 0.06, a = (i - 1.5) * 0.25;
          x.save(); x.translate(px, 0); x.rotate(a);
          const t = { hi: '#ffffff', base: Col.mix('#d8f0ff', Render.palette.accent, 0.25), lo: '#8aa8d0', edge: '#4a5a8a' };
          Art.facets(x, [[-w, 0], [-w * 0.8, -len], [0, -len - w * 1.3], [w * 0.8, -len], [w, 0]], -w * 0.2, -len * 0.5, t, { lw: 0.025 });
          x.restore();
        }
        break;
      }
      case 'stars': {
        for (let i = 0; i < 9; i++) { const px = (rnd() - 0.5) * 1.5, py = (rnd() - 0.5) * 1.0, s = 0.03 + rnd() * 0.05; x.fillStyle = rnd() < 0.3 ? '#c8b8ff' : '#ffffff'; x.beginPath(); x.arc(px, py, s, 0, Math.PI * 2); x.fill(); if (s > 0.06) Art.glint(x, px, py, s * 3); }
        break;
      }
      case 'gring': {
        x.strokeStyle = Col.rgba(Render.palette.accent, 0.45);
        for (let i = 1; i <= 3; i++) { x.lineWidth = 0.025; x.beginPath(); x.ellipse(0, 0, i * 0.35, i * 0.2, 0, 0, Math.PI * 2); x.stroke(); }
        x.fillStyle = 'rgba(0,0,0,.5)'; x.beginPath(); x.ellipse(0, 0, 0.12, 0.07, 0, 0, Math.PI * 2); x.fill();
        break;
      }
      case 'arc': {
        x.strokeStyle = Col.rgba('#c8c0ff', 0.55); x.lineWidth = 0.05;
        x.beginPath(); x.moveTo(-1.1, 0.4); x.bezierCurveTo(-0.6, -0.6, 0.6, -0.6, 1.1, 0.35); x.stroke();
        x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 0.02; x.stroke();
        break;
      }
    }
    return { canvas: c, w: bw, h: bh, ax: 0.5, ay, nom };
  }
};
