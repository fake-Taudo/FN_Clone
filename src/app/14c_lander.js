// =====================================================================
// LanderArt: the "Versorgungslander ARES-01" in the building style
// (light from the top left, panels, rivets, hazard stripes, orange
// accent). Two views: a side profile for orbit and entry, and the 2.5D
// top-down view used for the approach, the touchdown and the lander that
// stays on the map as a landmark. Everything is vector-drawn per frame
// (DPR sharp); the landmark caches its final state.
// =====================================================================
const LanderArt = {
  HULL: Art.tones('#d9d3c9'), ACC: Art.tones('#e8833a'), DARK: Art.tones('#3c4049'), STEEL: Art.pal('steel'),
  GOLD: Art.tones('#d6a447'), CELL: Art.tones('#24405e'),
  // leg feet on the ground (top view, oblique like all round buildings: depth = 0.5 x width)
  FEET: [[-1.22, -0.58], [1.22, -0.58], [-1.3, 0.62], [1.3, 0.62]],
  hitbox(x, y) { return [x - 1, y - 0.85, x + 1, y + 0.75]; },

  // ---------------- top-down 2.5D ----------------
  // s: legs 0..1 deployed, comp 0..1 spring compression, hatch 0..1, wings 0..1, soot 0..1, heat 0..1, tm, lights
  top(ctx, s) {
    const V = Art.V, H = LanderArt.HULL, A = LanderArt.ACC, Dk = LanderArt.DARK, St = LanderArt.STEEL;
    const comp = s.comp || 0, legs = s.legs === undefined ? 1 : s.legs;
    const clr = 0.7 - comp * 0.09;                 // body bottom height above ground
    const bodyH = 1.2, rx = 0.92, ry = 0.46;
    const zb = clr, zt = clr + bodyH;               // bottom / top height
    const Y = z => -z * V;                          // height -> screen y offset
    const leg = (fx, fy, front) => {
      // telescopic leg: hinge on the body, upper strut, lower piston, foot pad
      const k = legs;
      const hx = Math.sign(fx) * rx * 0.86, hy = fy * 0.42, hz = zb + 0.42;
      const footX = hx + (fx - hx) * k, footY = hy + (fy - hy) * k, footZ = (1 - k) * (zb + 0.05);
      const kx = hx + (footX - hx) * 0.55, ky = hy + (footY - hy) * 0.55, kz = hz + (footZ - hz) * 0.42 + 0.1 * k;
      const P = (x, y, z) => [x, y + Y(z)];
      const a = P(hx, hy, hz), kn = P(kx, ky, kz), f = P(footX, footY, footZ);
      ctx.lineCap = 'round';
      // lower piston (steel) then upper strut (hull colour, thicker)
      ctx.strokeStyle = St.edge; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(kn[0], kn[1]); ctx.lineTo(f[0], f[1]); ctx.stroke();
      ctx.strokeStyle = St.hi; ctx.lineWidth = 0.055; ctx.beginPath(); ctx.moveTo(kn[0], kn[1]); ctx.lineTo(f[0], f[1]); ctx.stroke();
      ctx.strokeStyle = H.edge; ctx.lineWidth = 0.16; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(kn[0], kn[1]); ctx.stroke();
      ctx.strokeStyle = front ? H.base : H.lo; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(kn[0], kn[1]); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(a[0] - 0.02, a[1] - 0.03); ctx.lineTo(kn[0] - 0.02, kn[1] - 0.03); ctx.stroke();
      // knee joint, foot pad with contact shadow
      ctx.fillStyle = Dk.base; ctx.beginPath(); ctx.arc(kn[0], kn[1], 0.06, 0, Math.PI * 2); ctx.fill();
      if (k > 0.2) {
        if (footZ < 0.05) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(footX + 0.04, footY + 0.03, 0.24, 0.11, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = Dk.lo; ctx.beginPath(); ctx.ellipse(f[0], f[1] + 0.015, 0.2, 0.09, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = St.base; ctx.beginPath(); ctx.ellipse(f[0], f[1] - 0.015, 0.18, 0.075, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(f[0] - 0.05, f[1] - 0.03, 0.08, 0.03, 0, 0, Math.PI * 2); ctx.fill();
      }
    };
    const wing = side => {
      const w = s.wings === undefined ? 1 : s.wings;
      if (w <= 0.02) return;
      const z = zt - 0.1, y0 = -0.32 + Y(z), L = 1.55 * w, x0 = side * (rx + 0.05);
      const x1 = x0 + side * L;
      // boom
      ctx.strokeStyle = St.edge; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(x0, y0 + 0.2); ctx.lineTo(x0 + side * 0.25, y0 + 0.2); ctx.stroke();
      const xa = x0 + side * 0.22, xb = x1, l = Math.min(xa, xb), r = Math.max(xa, xb);
      if (r - l < 0.05) return;
      // panel: dark blue cells, gold frame, sun glint toward the upper left
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(l + 0.06, y0 + 0.08, r - l, 0.46);
      const g = ctx.createLinearGradient(l, y0, r, y0 + 0.46);
      g.addColorStop(0, '#4f78a6'); g.addColorStop(0.35, LanderArt.CELL.base); g.addColorStop(1, LanderArt.CELL.lo);
      ctx.fillStyle = g; ctx.fillRect(l, y0, r - l, 0.46);
      ctx.strokeStyle = 'rgba(150,190,230,.35)'; ctx.lineWidth = 0.015; ctx.beginPath();
      for (let c = l + 0.19; c < r - 0.02; c += 0.19) { ctx.moveTo(c, y0); ctx.lineTo(c, y0 + 0.46); }
      ctx.moveTo(l, y0 + 0.23); ctx.lineTo(r, y0 + 0.23); ctx.stroke();
      ctx.strokeStyle = LanderArt.GOLD.lo; ctx.lineWidth = 0.035; ctx.strokeRect(l, y0, r - l, 0.46);
    };
    // back legs, wings
    leg(LanderArt.FEET[0][0], LanderArt.FEET[0][1], false); leg(LanderArt.FEET[1][0], LanderArt.FEET[1][1], false);
    wing(-1); wing(1);
    // engine cluster below the body (visible under the skirt): three bells
    const heat = s.heat || 0;
    for (let i = -1; i <= 1; i++) {
      const nx = i * 0.3, ny = Y(zb) + 0.05 + (i === 0 ? 0.04 : 0), bell = 0.17;
      const g = ctx.createLinearGradient(nx - bell, 0, nx + bell, 0);
      g.addColorStop(0, '#5a5f68'); g.addColorStop(0.4, '#2c3038'); g.addColorStop(1, '#16181d');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(nx - bell * 0.55, ny - 0.1); ctx.lineTo(nx + bell * 0.55, ny - 0.1); ctx.lineTo(nx + bell, ny + 0.22); ctx.lineTo(nx - bell, ny + 0.22); ctx.closePath(); ctx.fill();
      if (heat > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        const hg = ctx.createLinearGradient(0, ny + 0.22, 0, ny - 0.1);
        hg.addColorStop(0, 'rgba(255,150,60,' + (0.85 * heat).toFixed(3) + ')'); hg.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = hg; ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = '#0c0d10'; ctx.beginPath(); ctx.ellipse(nx, ny + 0.22, bell, bell * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      if (heat > 0.01) { ctx.fillStyle = 'rgba(255,170,80,' + (0.9 * heat).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(nx, ny + 0.22, bell * 0.7, bell * 0.26, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    // body: octagonal drum (front face with facets), skirt with hazard stripes
    const yB = Y(zb), yT = Y(zt);
    const fg = ctx.createLinearGradient(-rx, 0, rx, 0);
    fg.addColorStop(0, H.hi); fg.addColorStop(0.3, H.base); fg.addColorStop(1, H.lo);
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(-rx, yT); ctx.lineTo(-rx, yB); ctx.ellipse(0, yB, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(rx, yT); ctx.closePath(); ctx.fill();
    // facet edges (8-sided drum seen from the front)
    ctx.strokeStyle = Col.rgba(H.lo, 0.8); ctx.lineWidth = 0.022; ctx.beginPath();
    for (const a of [-0.62, 0, 0.62]) { const fx = Math.sin(a) * rx; const fy = Math.cos(a) * ry; ctx.moveTo(fx, yT + fy); ctx.lineTo(fx, yB + fy); }
    ctx.stroke();
    // panel seams + rivets
    ctx.strokeStyle = Col.rgba(H.edge, 0.35); ctx.lineWidth = 0.016;
    for (const z of [zb + 0.42, zb + 0.86]) { ctx.beginPath(); ctx.ellipse(0, Y(z), rx, ry, 0, 0, Math.PI); ctx.stroke(); }
    const rv = [];
    for (let i = -3; i <= 3; i++) { const a = i / 3 * 1.2; rv.push([Math.sin(a) * rx * 0.96, Y(zb + 0.86) + Math.cos(a) * ry * 0.96 - 0.04]); }
    Art.rivets(ctx, rv, 0.022, St);
    // orange accent band
    ctx.save(); ctx.beginPath(); ctx.moveTo(-rx, Y(zb + 0.62)); ctx.lineTo(-rx, Y(zb + 0.5)); ctx.ellipse(0, Y(zb + 0.5), rx, ry, 0, Math.PI, 0, true); ctx.lineTo(rx, Y(zb + 0.62)); ctx.ellipse(0, Y(zb + 0.62), rx, ry, 0, 0, Math.PI, false); ctx.closePath();
    const ag = ctx.createLinearGradient(-rx, 0, rx, 0); ag.addColorStop(0, A.hi); ag.addColorStop(0.4, A.base); ag.addColorStop(1, A.lo);
    ctx.fillStyle = ag; ctx.fill(); ctx.restore();
    // hazard skirt
    ctx.save(); ctx.beginPath(); ctx.moveTo(-rx, Y(zb + 0.14)); ctx.lineTo(-rx, yB); ctx.ellipse(0, yB, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(rx, Y(zb + 0.14)); ctx.ellipse(0, Y(zb + 0.14), rx, ry, 0, 0, Math.PI, false); ctx.closePath(); ctx.clip();
    Art.hazard(ctx, -rx, Y(zb + 0.14) - 0.02, rx * 2, ry + 0.2);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-rx, Y(zb + 0.14), rx * 2, ry + 0.2);
    ctx.restore();
    // soot from the re-entry: darker lower half, streaks upwards
    const soot = s.soot || 0;
    if (soot > 0.01) {
      ctx.save(); ctx.beginPath(); ctx.moveTo(-rx, yT); ctx.lineTo(-rx, yB); ctx.ellipse(0, yB, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(rx, yT); ctx.closePath(); ctx.clip();
      const sg = ctx.createLinearGradient(0, yB + ry, 0, yT);
      sg.addColorStop(0, 'rgba(30,22,20,' + (0.55 * soot).toFixed(3) + ')'); sg.addColorStop(0.45, 'rgba(40,30,26,' + (0.18 * soot).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(40,30,26,0)');
      ctx.fillStyle = sg; ctx.fillRect(-rx, yT, rx * 2, yB - yT + ry);
      ctx.strokeStyle = 'rgba(30,22,20,' + (0.25 * soot).toFixed(3) + ')'; ctx.lineWidth = 0.05;
      for (let i = 0; i < 9; i++) { const x = -rx * 0.9 + i * rx * 0.225, l = 0.25 + ((i * 37) % 5) * 0.08; ctx.beginPath(); ctx.moveTo(x, yB + ry * Math.cos(x / rx * 1.4)); ctx.lineTo(x + 0.03, yB + ry * 0.4 - l); ctx.stroke(); }
      ctx.restore();
    }
    // hatch on the south face: door opens into a ramp down to the ground
    const hk = s.hatch || 0, dw = 0.42, dz0 = zb + 0.16, dz1 = zb + 0.82;
    const dy = ry * 0.98;
    if (hk < 0.02) {
      ctx.fillStyle = H.lo; Art.rrect(ctx, -dw / 2, dy + Y(dz1), dw, (dz1 - dz0) * V, 0.05); ctx.fill();
      ctx.strokeStyle = H.edge; ctx.lineWidth = 0.025; ctx.stroke();
      ctx.fillStyle = A.base; ctx.fillRect(-dw / 2 + 0.04, dy + Y(dz1) + 0.05, dw - 0.08, 0.04);
    } else {
      // dark interior with warm light
      ctx.fillStyle = '#1a1414'; Art.rrect(ctx, -dw / 2, dy + Y(dz1), dw, (dz1 - dz0) * V, 0.05); ctx.fill();
      const lg = ctx.createRadialGradient(0, dy + Y(dz0 + 0.3), 0.02, 0, dy + Y(dz0 + 0.3), 0.32);
      lg.addColorStop(0, 'rgba(255,214,150,' + (0.85 * hk).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = lg; ctx.fillRect(-dw / 2, dy + Y(dz1), dw, (dz1 - dz0) * V);
      // ramp: hinged at the door sill, swings from vertical (closed) to the ground
      const ang = hk * (Math.PI / 2 + 0.38); // past horizontal: rests on the ground
      const len = 0.92;
      const tipZ = dz0 + Math.cos(ang) * len, tipY = dy + Math.sin(ang) * len * 0.95;
      const zTip = Math.max(0, tipZ);
      const sill = dy + Y(dz0), tip = tipY + Y(zTip);
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.moveTo(-dw / 2, dy); ctx.lineTo(dw / 2, dy); ctx.lineTo(dw / 2 + 0.05, tipY + 0.06); ctx.lineTo(-dw / 2 + 0.05, tipY + 0.06); ctx.closePath(); ctx.fill();
      const rg = ctx.createLinearGradient(0, sill, 0, tip);
      rg.addColorStop(0, H.lo); rg.addColorStop(1, H.base);
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(-dw / 2, sill); ctx.lineTo(dw / 2, sill); ctx.lineTo(dw / 2 + 0.03, tip); ctx.lineTo(-dw / 2 - 0.03, tip); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = H.edge; ctx.lineWidth = 0.022; ctx.stroke();
      // grip stripes on the ramp
      ctx.strokeStyle = 'rgba(60,50,45,.45)'; ctx.lineWidth = 0.018; ctx.beginPath();
      for (let i = 1; i < 5; i++) { const t = i / 5, yy = sill + (tip - sill) * t; ctx.moveTo(-dw / 2 + 0.04, yy); ctx.lineTo(dw / 2 - 0.04, yy); }
      ctx.stroke();
      ctx.fillStyle = A.base; ctx.fillRect(-dw / 2 - 0.03, tip - 0.03, dw + 0.06, 0.03);
    }
    // stencil on the front: ARES-01
    ctx.save();
    ctx.fillStyle = Col.rgba(Dk.base, 0.85);
    ctx.font = '800 0.13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ARES-01', -0.52, dy * 0.7 + Y(zb + 0.98));
    ctx.restore();
    // top deck
    const tg = ctx.createLinearGradient(-rx, yT - ry, rx * 0.4, yT + ry);
    tg.addColorStop(0, H.rim); tg.addColorStop(1, H.base);
    ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(0, yT, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = H.edge; ctx.lineWidth = 0.04; ctx.stroke();
    ctx.strokeStyle = Col.rgba(H.lo, 0.6); ctx.lineWidth = 0.02; ctx.beginPath(); ctx.ellipse(0, yT, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
    // payload module (gold foil box) + radiator + antenna mast with dish and blinking beacon
    Art.box(ctx, -0.42, yT - 0.26, 0.64, 0.36, 0.36, LanderArt.GOLD, { r: 0.04, lw: 0.022, outline: 0.028 });
    const pz = yT - 0.26 - 0.36 * V;
    ctx.strokeStyle = 'rgba(120,80,20,.5)'; ctx.lineWidth = 0.014; ctx.beginPath();
    for (let i = 1; i < 4; i++) { ctx.moveTo(-0.42 + i * 0.16, pz); ctx.lineTo(-0.42 + i * 0.16, pz + 0.36); }
    ctx.stroke();
    ctx.fillStyle = A.base; ctx.fillRect(-0.42, pz + 0.27, 0.64, 0.045);
    // radiator fins on the left of the deck
    ctx.fillStyle = St.lo; for (let i = 0; i < 4; i++) ctx.fillRect(-0.72 + i * 0.06, yT - 0.12 - 0.14, 0.03, 0.16);
    Art.box(ctx, 0.36, yT - 0.08, 0.24, 0.22, 0.2, Dk, { r: 0.03, lw: 0.02, outline: 0.025 });
    const mx = 0.48, my = yT - 0.08 - 0.2 * V;
    ctx.strokeStyle = St.edge; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, my - 0.62); ctx.stroke();
    ctx.strokeStyle = St.hi; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.moveTo(mx - 0.01, my); ctx.lineTo(mx - 0.01, my - 0.62); ctx.stroke();
    ctx.fillStyle = '#f2efe9'; ctx.beginPath(); ctx.ellipse(mx - 0.12, my - 0.48, 0.16, 0.1, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = St.lo; ctx.lineWidth = 0.02; ctx.stroke();
    ctx.fillStyle = St.lo; ctx.beginPath(); ctx.arc(mx - 0.12, my - 0.48, 0.025, 0, Math.PI * 2); ctx.fill();
    const blink = s.lights === false ? 0 : (Math.sin((s.tm || 0) * 3.1) > 0.6 ? 1 : 0.25);
    Art.light(ctx, mx, my - 0.64, 0.035, '#ff5a3a', blink);
    // deck hatch ring and two RCS quads on the rim
    ctx.fillStyle = Dk.base; ctx.beginPath(); ctx.ellipse(-0.62, yT + 0.12, 0.11, 0.06, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = Dk.base; ctx.beginPath(); ctx.ellipse(0.66, yT + 0.2, 0.11, 0.06, 0, 0, Math.PI * 2); ctx.fill();
    // front legs last
    leg(LanderArt.FEET[2][0], LanderArt.FEET[2][1], true); leg(LanderArt.FEET[3][0], LanderArt.FEET[3][1], true);
    return { top: yT, bottom: yB };
  },
  // body height on screen (for the flame origin) given the clearance
  nozzleY(comp) { return -(0.7 - (comp || 0) * 0.09) * Art.V + 0.31; },

  // engine plume in the top-down view: three layers + shock diamonds, pointing at the ground
  plumeTop(ctx, len, thr, tm) {
    if (thr <= 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const y0 = LanderArt.nozzleY(0), L = Math.max(0.2, len);
    const fl = 0.9 + 0.1 * Math.sin(tm * 47) * Math.sin(tm * 23);
    const layer = (w, l, c0, c1, a) => {
      const g = ctx.createLinearGradient(0, y0, 0, y0 + l);
      g.addColorStop(0, Col.rgba(c0, a)); g.addColorStop(1, Col.rgba(c1, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-w * 0.55, y0); ctx.quadraticCurveTo(-w, y0 + l * 0.45, 0, y0 + l); ctx.quadraticCurveTo(w, y0 + l * 0.45, w * 0.55, y0); ctx.closePath(); ctx.fill();
    };
    layer(0.75, L * 1.05 * fl, '#ff7a2a', '#ff3a10', 0.55 * thr);
    layer(0.48, L * 0.8 * fl, '#ffc060', '#ff8a30', 0.75 * thr);
    layer(0.22, L * 0.55, '#fffbe8', '#ffd890', 0.95 * thr);
    // shock diamonds along the axis
    for (let i = 1; i <= 3; i++) {
      const yy = y0 + L * (0.16 * i + 0.02 * Math.sin(tm * 30 + i)), r = 0.07 * (1 - i * 0.18);
      ctx.fillStyle = 'rgba(255,255,240,' + (0.6 * thr * (1 - i * 0.2)).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(0, yy - r * 1.6); ctx.lineTo(r, yy); ctx.lineTo(0, yy + r * 1.6); ctx.lineTo(-r, yy); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },

  // ---------------- side profile (orbit, entry) ----------------
  // unit: lander height = 1; origin at the nozzle exit plane centre; s: legs, wings, flame, plasma, soot, tm
  profile(ctx, s) {
    const H = LanderArt.HULL, A = LanderArt.ACC, Dk = LanderArt.DARK, St = LanderArt.STEEL;
    const tm = s.tm || 0;
    // solar wings (seen almost edge-on, slightly tilted toward the sun)
    const w = s.wings === undefined ? 1 : s.wings;
    if (w > 0.02) for (const side of [-1, 1]) {
      const x0 = side * 0.42, x1 = side * (0.42 + 1.25 * w), y = -0.62;
      const l = Math.min(x0, x1), r = Math.max(x0, x1);
      ctx.strokeStyle = St.edge; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(side * 0.3, y + 0.05); ctx.lineTo(x0, y + 0.05); ctx.stroke();
      const g = ctx.createLinearGradient(l, y - 0.06, r, y + 0.1);
      g.addColorStop(0, '#5a86b8'); g.addColorStop(0.5, LanderArt.CELL.base); g.addColorStop(1, LanderArt.CELL.lo);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(r, y - 0.03); ctx.lineTo(r, y + 0.1); ctx.lineTo(l, y + 0.12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(160,200,240,.35)'; ctx.lineWidth = 0.008; ctx.beginPath();
      for (let c = l + 0.1; c < r; c += 0.1) { ctx.moveTo(c, y - 0.02); ctx.lineTo(c, y + 0.11); }
      ctx.stroke();
      ctx.strokeStyle = LanderArt.GOLD.lo; ctx.lineWidth = 0.015; ctx.stroke();
    }
    // legs (folded along the body, or deployed)
    const lg = s.legs || 0;
    for (const side of [-1, 1]) {
      const hx = side * 0.36, hy = -0.36;
      const fx = side * (0.38 + 0.32 * lg), fy = -0.18 + 0.32 * lg;
      ctx.strokeStyle = H.edge; ctx.lineWidth = 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.strokeStyle = side < 0 ? H.hi : H.lo; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = St.base; ctx.beginPath(); ctx.ellipse(fx, fy + 0.02, 0.07, 0.025, 0, 0, Math.PI * 2); ctx.fill();
    }
    // nozzle cluster
    for (let i = -1; i <= 1; i++) {
      const nx = i * 0.12, b = 0.07;
      const g = ctx.createLinearGradient(nx - b, 0, nx + b, 0); g.addColorStop(0, '#6a707a'); g.addColorStop(1, '#1a1c22');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(nx - b * 0.5, -0.14); ctx.lineTo(nx + b * 0.5, -0.14); ctx.lineTo(nx + b, 0); ctx.lineTo(nx - b, 0); ctx.closePath(); ctx.fill();
    }
    // heat shield / skirt (dark, curved)
    ctx.fillStyle = '#2c2624'; ctx.beginPath(); ctx.moveTo(-0.46, -0.2); ctx.quadraticCurveTo(0, -0.08, 0.46, -0.2); ctx.lineTo(0.42, -0.26); ctx.lineTo(-0.42, -0.26); ctx.closePath(); ctx.fill();
    // body: truncated cone with panels, light from the upper left
    const bg = ctx.createLinearGradient(-0.42, 0, 0.42, 0);
    bg.addColorStop(0, H.hi); bg.addColorStop(0.35, H.base); bg.addColorStop(1, H.lo);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-0.42, -0.26); ctx.lineTo(-0.34, -0.74); ctx.lineTo(0.34, -0.74); ctx.lineTo(0.42, -0.26); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = H.edge; ctx.lineWidth = 0.014; ctx.stroke();
    ctx.strokeStyle = Col.rgba(H.lo, 0.8); ctx.lineWidth = 0.008; ctx.beginPath();
    for (const x of [-0.18, 0, 0.18]) { ctx.moveTo(x * 1.1, -0.27); ctx.lineTo(x * 0.95, -0.73); }
    ctx.moveTo(-0.4, -0.42); ctx.lineTo(0.4, -0.42); ctx.stroke();
    ctx.fillStyle = A.base; ctx.beginPath(); ctx.moveTo(-0.385, -0.5); ctx.lineTo(0.385, -0.5); ctx.lineTo(0.38, -0.55); ctx.lineTo(-0.38, -0.55); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(-0.42, -0.31, 0.84, 0.05); ctx.clip(); Art.hazard(ctx, -0.42, -0.31, 0.84, 0.05); ctx.restore();
    Art.rivets(ctx, [[-0.3, -0.68], [-0.1, -0.68], [0.1, -0.68], [0.3, -0.68]], 0.009, St);
    ctx.fillStyle = Col.rgba(Dk.base, 0.85); ctx.font = '800 0.065px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ARES-01', 0, -0.62);
    // payload module + antenna
    const pg = ctx.createLinearGradient(-0.24, 0, 0.24, 0); pg.addColorStop(0, LanderArt.GOLD.hi); pg.addColorStop(1, LanderArt.GOLD.lo);
    ctx.fillStyle = pg; ctx.fillRect(-0.24, -0.92, 0.42, 0.18);
    ctx.strokeStyle = LanderArt.GOLD.edge; ctx.lineWidth = 0.01; ctx.strokeRect(-0.24, -0.92, 0.42, 0.18);
    ctx.strokeStyle = St.edge; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(0.26, -0.74); ctx.lineTo(0.26, -1.08); ctx.stroke();
    ctx.fillStyle = '#efe9e0'; ctx.beginPath(); ctx.ellipse(0.2, -1.02, 0.07, 0.035, -0.6, 0, Math.PI * 2); ctx.fill();
    Art.light(ctx, 0.26, -1.09, 0.014, '#ff5a3a', Math.sin(tm * 3.1) > 0.6 ? 1 : 0.3);
    // soot
    if (s.soot > 0.01) {
      ctx.save(); ctx.beginPath(); ctx.moveTo(-0.42, -0.26); ctx.lineTo(-0.34, -0.74); ctx.lineTo(0.34, -0.74); ctx.lineTo(0.42, -0.26); ctx.closePath(); ctx.clip();
      const sg = ctx.createLinearGradient(0, -0.26, 0, -0.74); sg.addColorStop(0, 'rgba(30,20,18,' + (0.6 * s.soot).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(30,20,18,0)');
      ctx.fillStyle = sg; ctx.fillRect(-0.5, -0.8, 1, 0.6); ctx.restore();
    }
  },
  // three-layer exhaust with shock diamonds for the side view (vacuum: wider, atmosphere: tighter)
  plumeSide(ctx, thr, wide, tm) {
    if (thr <= 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fl = 0.92 + 0.08 * Math.sin(tm * 53) * Math.cos(tm * 21);
    const L = (0.55 + thr * 0.9) * fl, W = 0.16 + wide * 0.35;
    const layer = (w, l, c0, c1, a) => {
      const g = ctx.createLinearGradient(0, 0, 0, l);
      g.addColorStop(0, Col.rgba(c0, a)); g.addColorStop(1, Col.rgba(c1, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-0.2, 0); ctx.quadraticCurveTo(-w, l * 0.4, 0, l); ctx.quadraticCurveTo(w, l * 0.4, 0.2, 0); ctx.closePath(); ctx.fill();
    };
    layer(W * 1.4, L * 1.1, '#ff8a3a', '#ff4a1a', 0.5 * thr);
    layer(W, L * 0.85, '#ffc870', '#ff9a40', 0.7 * thr);
    layer(W * 0.45, L * 0.55, '#fffcea', '#ffe0a0', 0.95 * thr);
    for (let i = 1; i <= 4; i++) {
      const yy = L * (0.1 * i + 0.01 * Math.sin(tm * 40 + i)), r = 0.035 * (1 - i * 0.15);
      ctx.fillStyle = 'rgba(255,255,245,' + (0.65 * thr * (1 - i * 0.18)).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(0, yy - r * 1.8); ctx.lineTo(r, yy); ctx.lineTo(0, yy + r * 1.8); ctx.lineTo(-r, yy); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },
  // re-entry plasma around the heat shield (side view); k 0..1 intensity
  plasma(ctx, k, tm, layer) {
    if (k <= 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (layer === 'back') {
      // glow behind the hull and trailing streaks that flow past both sides (away from the direction of travel)
      const g = ctx.createRadialGradient(0, -0.05, 0.05, 0, -0.35, 1.0);
      g.addColorStop(0, 'rgba(255,200,160,' + (0.5 * k).toFixed(3) + ')'); g.addColorStop(0.35, 'rgba(255,120,80,' + (0.35 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,70,50,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -0.4, 0.95, 0.95, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 18; i++) {
        const ph = (tm * 2.3 + i * 0.37) % 1, side = i % 2 ? 1 : -1, x = side * (0.42 + ((i * 73) % 100) / 100 * 0.5), len = 0.35 + ((i * 31) % 7) * 0.1;
        const y0 = -0.05 - ph * 1.3;
        ctx.strokeStyle = 'rgba(255,' + (150 + (i % 3) * 30) + ',110,' + (0.5 * k * (1 - ph)).toFixed(3) + ')';
        ctx.lineWidth = 0.022 * (1 - ph * 0.5); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x * (1 + ph * 0.3), y0); ctx.lineTo(x * (1.05 + ph * 0.45), y0 - len * (0.6 + ph)); ctx.stroke();
      }
    } else {
      // bow shock in front of the heat shield
      const g = ctx.createRadialGradient(0, 0.02, 0.02, 0, 0.02, 0.6);
      g.addColorStop(0, 'rgba(255,240,220,' + (0.75 * k).toFixed(3) + ')'); g.addColorStop(0.4, 'rgba(255,150,100,' + (0.4 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,80,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0.0, 0.62, 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,170,' + (0.65 * k).toFixed(3) + ')'; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.ellipse(0, -0.12, 0.6, 0.3, 0, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    ctx.restore();
  },
  // RCS puff (white, short), drawn in local units at (x, y) pointing along (dx, dy)
  rcs(ctx, x, y, dx, dy, k) {
    if (k <= 0 || k >= 1) return;
    const a = Math.sin(k * Math.PI);
    ctx.save(); ctx.globalAlpha = 0.85 * a;
    const r = 0.08 + k * 0.25;
    ctx.drawImage(FxLib.get('steam', 1), x + dx * k * 0.5 - r, y + dy * k * 0.5 - r, r * 2, r * 2);
    ctx.restore();
  },

  // ---------------- ground decals ----------------
  // burn mark (radius ~3) with glassy centre and blast rays, plus four leg prints; cached per zoom
  scorch(ppt) {
    return Art.cached('LANDER|scorch|' + ppt, () => {
      const R = 3.4, S = Math.ceil(R * 2 * ppt), c = Art.canvas(S, S), x = c.getContext('2d');
      x.setTransform(ppt, 0, 0, ppt, S / 2, S / 2);
      const rnd = RNG.mulberry32(4711);
      // blast rays (soft, irregular)
      for (let i = 0; i < 46; i++) {
        const a = rnd() * Math.PI * 2, l = R * (0.55 + rnd() * 0.45), w = 0.05 + rnd() * 0.12;
        const g = x.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l * 0.62);
        g.addColorStop(0, 'rgba(20,14,12,.0)'); g.addColorStop(0.35, 'rgba(24,16,14,' + (0.12 + rnd() * 0.12).toFixed(3) + ')'); g.addColorStop(1, 'rgba(24,16,14,0)');
        x.strokeStyle = g; x.lineWidth = w; x.lineCap = 'round';
        x.beginPath(); x.moveTo(Math.cos(a) * 0.6, Math.sin(a) * 0.37); x.lineTo(Math.cos(a) * l, Math.sin(a) * l * 0.62); x.stroke();
      }
      const g = x.createRadialGradient(0, 0, 0.1, 0, 0, R * 0.7);
      g.addColorStop(0, 'rgba(18,12,12,.55)'); g.addColorStop(0.4, 'rgba(26,18,16,.32)'); g.addColorStop(1, 'rgba(30,20,16,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, R * 0.8, R * 0.5, 0, 0, Math.PI * 2); x.fill();
      // glassy fused centre with a faint sheen toward the light
      const gg = x.createRadialGradient(-0.15, -0.1, 0.02, 0, 0, 0.75);
      gg.addColorStop(0, 'rgba(120,100,95,.35)'); gg.addColorStop(0.5, 'rgba(40,30,30,.35)'); gg.addColorStop(1, 'rgba(40,30,30,0)');
      x.fillStyle = gg; x.beginPath(); x.ellipse(0, 0, 0.8, 0.45, 0, 0, Math.PI * 2); x.fill();
      // leg prints: shallow depressions, lit edge top-left, dark edge bottom-right
      for (const [fx, fy] of LanderArt.FEET) {
        x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(fx + 0.02, fy + 0.015, 0.22, 0.1, 0, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(255,240,220,.22)'; x.lineWidth = 0.03; x.beginPath(); x.ellipse(fx, fy, 0.22, 0.1, 0, Math.PI * 0.95, Math.PI * 1.75); x.stroke();
      }
      return { canvas: c, R, S };
    });
  },
  // cached final-state sprite for the landmark
  sprite(ppt) {
    return Art.cached('LANDER|top|' + ppt, () => {
      const W = 6, Hh = 5, c = Art.canvas(W * ppt, Hh * ppt), x = c.getContext('2d');
      x.setTransform(ppt, 0, 0, ppt, W / 2 * ppt, 3.4 * ppt);
      LanderArt.top(x, { legs: 1, comp: 0, hatch: 1, wings: 1, soot: 0.8, heat: 0, tm: 0, lights: false });
      return { canvas: c, ox: -W / 2, oy: -3.4, w: W, h: Hh };
    });
  }
};
