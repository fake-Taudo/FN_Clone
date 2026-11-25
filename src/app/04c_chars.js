// =====================================================================
// CharArt: astronaut (8-frame walk in front/back/side, idle breathing,
// waving, jetpack on sprint), rover, six alien species (6-frame walk,
// idle, joy, impatience, disappointment), caravan of rover-beetles,
// shuttle / trader / freighter with landing sequences, speech bubble.
// =====================================================================
const ALIEN_SPECIES = ['Glibber', 'Stelzer', 'Krabbler', 'Pilzling', 'Schweber', 'Steinling'];

const CharArt = {
  dir: 'front', walk: 0, idle: 0, lastStep: -1,
  limb(x, x0, y0, x1, y1, w, t) {
    x.lineCap = 'round';
    x.strokeStyle = t.edge; x.lineWidth = w + 0.04; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    x.strokeStyle = t.base; x.lineWidth = w; x.stroke();
    x.strokeStyle = Col.rgba(t.rim, 0.6); x.lineWidth = w * 0.3; x.beginPath(); x.moveTo(x0 - w * 0.2, y0); x.lineTo(x1 - w * 0.2, y1); x.stroke();
  },
  boot(x, fx, fy, dirx, t) {
    x.fillStyle = t.edge; Art.rrect(x, fx - 0.07 + dirx * 0.02, fy - 0.07, 0.15, 0.09, 0.035); x.fill();
    x.fillStyle = t.base; Art.rrect(x, fx - 0.06 + dirx * 0.02, fy - 0.065, 0.13, 0.065, 0.03); x.fill();
  },

  // ---------------- astronaut ----------------
  astronaut(ctx, g, x, y, tm, dt) {
    const p = g.run.player;
    const moving = p.moving;
    const rover = g.run.research.done.has('rover') && moving;
    const sprint = moving && g.input && g.input.sprint;
    if (moving) {
      CharArt.dir = Math.abs(p.vy) > Math.abs(p.vx) * 1.2 ? (p.vy > 0 ? 'front' : 'back') : 'side';
      CharArt.walk += dt * (sprint ? 2.5 : 1.7);
      CharArt.idle = 0;
    } else { CharArt.idle += dt; CharArt.walk = 0; }
    if (rover) { CharArt.rover(ctx, g, x, y, tm, p); return; }
    const frame = moving ? Math.floor((CharArt.walk % 1) * 8) : 0;
    const ph = frame / 8 * Math.PI * 2;
    // foot dust on contact frames
    if (moving && (frame === 0 || frame === 4) && CharArt.lastStep !== frame && !App.settings.reducedFx && App.quality !== 'low') {
      for (let i = 0; i < 2; i++) Render.spawn('dust', p.x + (Math.random() - 0.5) * 0.2, p.y, (Math.random() - 0.5) * 0.5 - p.vx * 0.05, -0.15 - Math.random() * 0.2, 0.6, Render.palette.particle, 0.07);
    }
    CharArt.lastStep = moving ? frame : -1;
    const breath = moving ? 0 : Math.sin(tm * 2.2) * 0.012;
    const bob = moving ? Math.abs(Math.sin(ph)) * 0.045 : 0;
    const waving = !moving && CharArt.idle > 3 && (CharArt.idle % 9) < 2.2;
    const face = p.face || 1;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(x, y + 0.02, 0.3, 0.11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y - bob);
    const suit = Art.pal('white'), dark = Art.tones('#8a909c'), acc = Art.tones(Render.palette.accent);
    const bootT = Art.tones('#5a6070');
    if (sprint && !App.settings.reducedFx) CharArt.jet(ctx, tm, face);
    if (CharArt.dir === 'side') {
      ctx.scale(face, 1);
      const sw = Math.sin(ph) * 0.42, sw2 = -sw;
      const leg = (a, near) => { const hx = 0.02, hy = -0.34, kx = hx + Math.sin(a) * 0.17, ky = hy + Math.cos(a) * 0.17, bend = Math.max(0, -Math.sin(a)) * 0.08; const fx = kx + Math.sin(a * 0.6) * 0.15 - bend, fy = -0.02 - (near ? 0 : 0.01) - Math.max(0, Math.cos(ph + (near ? 0 : Math.PI))) * 0.03 * (moving ? 1 : 0); CharArt.limb(ctx, hx, hy, kx, ky, 0.11, near ? suit : dark); CharArt.limb(ctx, kx, ky, fx, fy, 0.1, near ? suit : dark); CharArt.boot(ctx, fx, fy + 0.02, 1, bootT); };
      // far arm and leg
      CharArt.limb(ctx, 0.0, -0.7, 0.03 + Math.sin(sw2) * 0.16, -0.46, 0.08, dark);
      leg(sw2, false);
      // backpack
      Art.box(ctx, -0.27, -0.42, 0.16, 0.1, 0.62, Art.tones('#aab0bc'), { r: 0.04, lw: 0.02 });
      ctx.fillStyle = acc.base; ctx.fillRect(-0.25, -0.68, 0.03, 0.12);
      // torso
      ctx.save(); ctx.translate(0, -0.34); ctx.scale(1, 1 + breath * 2); ctx.translate(0, 0.34);
      const tg = ctx.createLinearGradient(-0.17, 0, 0.17, 0); tg.addColorStop(0, suit.hi); tg.addColorStop(1, suit.lo);
      ctx.fillStyle = tg; Art.rrect(ctx, -0.15, -0.76, 0.32, 0.44, 0.12); ctx.fill();
      ctx.strokeStyle = suit.edge; ctx.lineWidth = 0.025; ctx.stroke();
      ctx.fillStyle = acc.base; ctx.fillRect(-0.15, -0.5, 0.32, 0.04);
      ctx.restore();
      leg(sw, true);
      // near arm
      if (waving) { const wa = Math.sin(tm * 9) * 0.4; CharArt.limb(ctx, 0.05, -0.68, 0.22, -0.85, 0.085, suit); CharArt.limb(ctx, 0.22, -0.85, 0.24 + Math.sin(wa) * 0.12, -1.05, 0.08, suit); }
      else CharArt.limb(ctx, 0.04, -0.68, 0.06 + Math.sin(sw) * 0.18, -0.44, 0.085, suit);
      // helmet
      CharArt.helmet(ctx, 0.03, -0.92 + breath, 'side', acc, tm);
    } else {
      const front = CharArt.dir === 'front';
      const lift = i => moving ? Math.max(0, Math.sin(ph + i * Math.PI)) * 0.07 : 0;
      // legs
      for (const [i, lx] of [[0, -0.08], [1, 0.08]]) { const l = lift(i); CharArt.limb(ctx, lx, -0.34, lx, -0.06 - l, 0.11, suit); CharArt.boot(ctx, lx - 0.02, -0.02 - l * 0.6, 0, bootT); }
      if (!front) { Art.box(ctx, -0.19, -0.38, 0.38, 0.12, 0.62, Art.tones('#aab0bc'), { r: 0.05, lw: 0.02 }); }
      // torso
      ctx.save(); ctx.translate(0, -0.34); ctx.scale(1, 1 + breath * 2); ctx.translate(0, 0.34);
      const tg = ctx.createLinearGradient(-0.2, 0, 0.2, 0); tg.addColorStop(0, suit.hi); tg.addColorStop(1, suit.lo);
      ctx.fillStyle = tg; Art.rrect(ctx, -0.19, -0.76, 0.38, 0.44, 0.13); ctx.fill();
      ctx.strokeStyle = suit.edge; ctx.lineWidth = 0.025; ctx.stroke();
      if (front) {
        ctx.fillStyle = '#3a404c'; Art.rrect(ctx, -0.1, -0.66, 0.2, 0.13, 0.03); ctx.fill();
        ctx.fillStyle = acc.base; ctx.fillRect(-0.07, -0.63, 0.05, 0.03); ctx.fillStyle = '#7fe8ff'; ctx.fillRect(0.02, -0.63, 0.05, 0.03);
      } else { Art.box(ctx, -0.17, -0.4, 0.34, 0.1, 0.6, Art.tones('#b4bac6'), { r: 0.05, lw: 0.02 }); ctx.fillStyle = acc.base; ctx.fillRect(-0.15, -0.6, 0.3, 0.035); }
      ctx.fillStyle = acc.base; ctx.fillRect(-0.19, -0.46, 0.38, 0.035);
      ctx.restore();
      // arms
      const as = moving ? Math.sin(ph) * 0.06 : 0;
      CharArt.limb(ctx, -0.2, -0.7, -0.25, -0.44 + as, 0.085, suit);
      if (waving && front) { const wa = Math.sin(tm * 9) * 0.35; CharArt.limb(ctx, 0.2, -0.7, 0.34, -0.86, 0.085, suit); CharArt.limb(ctx, 0.34, -0.86, 0.36 + Math.sin(wa) * 0.1, -1.06, 0.08, suit); }
      else CharArt.limb(ctx, 0.2, -0.7, 0.25, -0.44 - as, 0.085, suit);
      CharArt.helmet(ctx, 0, -0.93 + breath, front ? 'front' : 'back', acc, tm);
    }
    ctx.restore();
    // jetpack exhaust particles
    if (sprint && !App.settings.reducedFx && Math.random() < 0.8) Render.spawn('jet', p.x - face * 0.2, p.y - 0.4, -p.vx * 0.08 + (Math.random() - 0.5) * 0.3, 0.7 + Math.random() * 0.5, 0.35, '#ffb04a', 0.07);
  },
  helmet(ctx, cx, cy, view, acc, tm) {
    const r = 0.21;
    const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#e4e8ef'); g.addColorStop(1, '#a8afbc');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6a7080'; ctx.lineWidth = 0.025; ctx.stroke();
    if (view !== 'back') {
      const vx = view === 'side' ? cx + 0.07 : cx, vw = view === 'side' ? 0.13 : 0.15;
      const vg = ctx.createLinearGradient(vx - vw, cy - 0.12, vx + vw, cy + 0.1);
      vg.addColorStop(0, '#ffe0a0'); vg.addColorStop(0.5, '#ff9a3a'); vg.addColorStop(1, '#8a3a1a');
      ctx.fillStyle = vg; ctx.beginPath(); ctx.ellipse(vx, cy + 0.01, vw, 0.11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 0.02; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(vx - vw * 0.4, cy - 0.04, vw * 0.25, 0.03, -0.4, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = '#8a909c'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(cx + 0.1, cy - 0.12); ctx.lineTo(cx + 0.14, cy - 0.32); ctx.stroke();
      ctx.fillStyle = (Math.floor(tm * 2) & 1) ? '#ff5a5a' : '#7a2a2a'; ctx.beginPath(); ctx.arc(cx + 0.14, cy - 0.33, 0.025, 0, Math.PI * 2); ctx.fill();
    }
  },
  jet(ctx, tm, face) {
    const f = Math.floor(tm * 18) & 3;
    const spr = FxLib.tinted('flame', f, '#ffb04a');
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fx = CharArt.dir === 'side' ? -0.19 * face : 0, fy = -0.36;
    ctx.drawImage(spr, fx - 0.09, fy, 0.18, 0.34);
    ctx.globalAlpha = 0.5; ctx.drawImage(FxLib.tinted('soft', 0, '#ff8a2a'), fx - 0.25, fy - 0.1, 0.5, 0.5);
    ctx.restore();
  },
  rover(ctx, g, x, y, tm, p) {
    const face = p.face || 1;
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(x, y + 0.04, 0.85, 0.24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
    const shake = Math.sin(tm * 30) * 0.008;
    ctx.translate(0, shake);
    const body = Art.pal('white'), acc = Art.tones(Render.palette.accent);
    // far wheels
    for (const wx of [-0.55, 0, 0.55]) { ctx.fillStyle = '#1c1e22'; ctx.beginPath(); ctx.ellipse(wx + 0.06, -0.14, 0.15, 0.15, 0, 0, Math.PI * 2); ctx.fill(); }
    // chassis
    Art.box(ctx, -0.75, -0.28, 1.5, 0.3, 0.45, body, { r: 0.06, lw: 0.025 });
    ctx.fillStyle = acc.base; ctx.fillRect(-0.75, -0.2, 1.5, 0.045);
    // solar panel + antenna
    ctx.fillStyle = '#2a3a5a'; ctx.beginPath(); ctx.moveTo(-0.7, -0.55); ctx.lineTo(-0.15, -0.55); ctx.lineTo(-0.1, -0.42); ctx.lineTo(-0.72, -0.42); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7fb0ff'; ctx.lineWidth = 0.012; ctx.beginPath(); for (let i = 1; i < 5; i++) { ctx.moveTo(-0.7 + i * 0.12, -0.55); ctx.lineTo(-0.71 + i * 0.12, -0.42); } ctx.stroke();
    ctx.strokeStyle = '#d8dde6'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(0.6, -0.45); ctx.lineTo(0.62, -0.85); ctx.stroke();
    ctx.fillStyle = (Math.floor(tm * 3) & 1) ? '#7fe8ff' : '#2a5a6a'; ctx.beginPath(); ctx.arc(0.62, -0.86, 0.03, 0, Math.PI * 2); ctx.fill();
    // driver
    ctx.fillStyle = '#e4e8ef'; Art.rrect(ctx, 0.05, -0.68, 0.24, 0.26, 0.08); ctx.fill();
    CharArt.helmet(ctx, 0.18, -0.8, 'side', acc, tm);
    // headlight
    ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(0.74, -0.32, 0.04, 0, Math.PI * 2); ctx.fill();
    // near wheels with spinning spokes
    const spin = tm * 14;
    for (const wx of [-0.55, 0, 0.55]) {
      ctx.fillStyle = '#26292e'; ctx.beginPath(); ctx.arc(wx, -0.06, 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5a606a'; ctx.lineWidth = 0.03; ctx.beginPath();
      for (let k = 0; k < 3; k++) { const a = spin + k * Math.PI / 3; ctx.moveTo(wx + Math.cos(a) * 0.12, -0.06 + Math.sin(a) * 0.12); ctx.lineTo(wx - Math.cos(a) * 0.12, -0.06 - Math.sin(a) * 0.12); }
      ctx.stroke();
      ctx.fillStyle = '#9aa0aa'; ctx.beginPath(); ctx.arc(wx, -0.06, 0.04, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (!App.settings.reducedFx && Math.random() < 0.5) Render.spawn('dust', p.x - face * 0.7, p.y, -p.vx * 0.15 + (Math.random() - 0.5) * 0.3, -0.2 - Math.random() * 0.2, 0.7, Render.palette.particle, 0.1);
  },

  // ---------------- aliens ----------------
  // pose: 0 walk, 1 idle, 2 joy, 3 impatient, 4 sad
  alienSprite(sp, col, pose, frame, ppt) {
    return Art.cached('P|AL|' + sp + '|' + col + '|' + pose + '|' + frame + '|' + ppt, () => {
      const W = 1.4, H = 1.7, c = Art.canvas(W * ppt, H * ppt), x = c.getContext('2d');
      x.scale(ppt, ppt); x.translate(W / 2, H - 0.2);
      x.lineJoin = 'round'; x.lineCap = 'round';
      CharArt.alienBody(x, sp, col, pose, frame);
      return c;
    });
  },
  alienBody(x, sp, col, pose, frame) {
    const t = Art.tones(col), ph = frame / 6 * Math.PI * 2;
    const walk = pose === 0, joy = pose === 2, sad = pose === 4, imp = pose === 3;
    const hop = joy ? Math.abs(Math.sin(frame / 4 * Math.PI)) * 0.18 : 0;
    const breathe = pose === 1 ? Math.sin(frame / 4 * Math.PI * 2) * 0.02 : 0;
    const droop = sad ? 0.08 : 0;
    const eye = (ex, ey, r, look = 0.3) => {
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(ex, ey, r, 0, Math.PI * 2); x.fill();
      x.strokeStyle = t.edge; x.lineWidth = 0.015; x.stroke();
      x.fillStyle = '#121418'; x.beginPath(); x.arc(ex + r * look, ey + (sad ? r * 0.3 : 0), r * 0.5, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(ex + r * look - r * 0.15, ey - r * 0.2, r * 0.15, 0, Math.PI * 2); x.fill();
      if (imp) { x.strokeStyle = '#121418'; x.lineWidth = 0.02; x.beginPath(); x.moveTo(ex - r, ey - r * 1.1); x.lineTo(ex + r, ey - r * 0.6); x.stroke(); }
      if (sad) { x.fillStyle = Col.rgba(t.lo, 0.9); x.fillRect(ex - r, ey - r, r * 2, r * 0.7); }
    };
    const mouth = (mx, my, w) => {
      x.strokeStyle = '#2a1418'; x.lineWidth = 0.022; x.beginPath();
      if (joy) { x.arc(mx, my - w * 0.2, w, 0.15 * Math.PI, 0.85 * Math.PI); }
      else if (sad) { x.arc(mx, my + w * 0.7, w * 0.8, 1.2 * Math.PI, 1.8 * Math.PI); }
      else if (imp) { x.moveTo(mx - w, my); x.lineTo(mx - w * 0.3, my + 0.02); x.lineTo(mx + w * 0.3, my - 0.02); x.lineTo(mx + w, my); }
      else { x.moveTo(mx - w * 0.6, my); x.quadraticCurveTo(mx, my + w * 0.3, mx + w * 0.6, my); }
      x.stroke();
    };
    const shade = (cx, cy, rx, ry) => { const g = x.createRadialGradient(cx - rx * 0.35, cy - ry * 0.4, rx * 0.1, cx, cy, Math.max(rx, ry)); g.addColorStop(0, t.rim); g.addColorStop(0.5, t.base); g.addColorStop(1, t.lo); return g; };
    // ground shadow
    x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(0, 0.02, 0.28 - hop * 0.4, 0.09, 0, 0, Math.PI * 2); x.fill();
    x.translate(0, -hop);
    if (sp === 0) { // Glibber: hopping blob with one big eye
      const sq = walk ? Math.sin(ph) * 0.06 : breathe;
      const rx = 0.3 + sq, ry = 0.3 - sq;
      x.fillStyle = shade(0, -ry, rx, ry); x.beginPath(); x.ellipse(0, -ry - droop * 0.2, rx, ry, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = t.edge; x.lineWidth = 0.03; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(-rx * 0.4, -ry * 1.5, rx * 0.25, ry * 0.15, -0.5, 0, Math.PI * 2); x.fill();
      eye(0.02, -ry * 1.15, 0.12); mouth(0.02, -ry * 0.55, 0.08);
    } else if (sp === 1) { // Stelzer: tall, thin, three eyes, bird legs
      const a = walk ? Math.sin(ph) * 0.35 : 0;
      for (const [s, k] of [[-1, 1], [1, -1]]) { const fx = Math.sin(a * k) * 0.2; x.strokeStyle = t.edge; x.lineWidth = 0.06; x.beginPath(); x.moveTo(s * 0.06, -0.5); x.lineTo(s * 0.1 + fx * 0.5, -0.25); x.lineTo(fx + s * 0.04, -0.02); x.stroke(); x.strokeStyle = t.lo; x.lineWidth = 0.035; x.stroke(); }
      x.fillStyle = shade(0, -0.65, 0.18, 0.24); x.beginPath(); x.ellipse(0, -0.66 + breathe, 0.17, 0.22, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = t.edge; x.lineWidth = 0.025; x.stroke();
      x.strokeStyle = t.base; x.lineWidth = 0.07; x.beginPath(); x.moveTo(0, -0.82); x.quadraticCurveTo(0.08, -0.98 + droop, 0.04, -1.08 + droop); x.stroke();
      x.fillStyle = shade(0.04, -1.16, 0.18, 0.13); x.beginPath(); x.ellipse(0.04, -1.16 + droop, 0.19, 0.13, sad ? 0.3 : 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = t.edge; x.lineWidth = 0.025; x.stroke();
      eye(-0.06, -1.19 + droop, 0.045); eye(0.04, -1.22 + droop, 0.045); eye(0.14, -1.19 + droop, 0.045);
      mouth(0.05, -1.09 + droop, 0.05);
    } else if (sp === 2) { // Krabbler: crab with claws and eye stalks
      const a = walk ? Math.sin(ph) : 0;
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const lx = s * (0.12 + i * 0.07), k = Math.sin(ph + i + (s > 0 ? Math.PI : 0)) * (walk ? 0.05 : 0); x.strokeStyle = t.edge; x.lineWidth = 0.04; x.beginPath(); x.moveTo(lx * 0.8, -0.2); x.lineTo(lx * 1.5, -0.24 + k); x.lineTo(lx * 1.7, -0.01); x.stroke(); }
      x.fillStyle = shade(0, -0.28, 0.32, 0.18); x.beginPath(); x.ellipse(0, -0.28 + breathe, 0.32, 0.18, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = t.edge; x.lineWidth = 0.03; x.stroke();
      x.fillStyle = Col.rgba(t.hi, 0.6); for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(-0.12 + i * 0.12, -0.36, 0.035, 0, Math.PI * 2); x.fill(); }
      const cl = joy ? -0.25 : sad ? 0.1 : a * 0.08;
      for (const s of [-1, 1]) { x.fillStyle = t.base; x.beginPath(); x.ellipse(s * 0.38, -0.42 + cl, 0.1, 0.07, s * 0.6, 0, Math.PI * 2); x.fill(); x.strokeStyle = t.edge; x.lineWidth = 0.025; x.stroke(); x.strokeStyle = t.edge; x.lineWidth = 0.035; x.beginPath(); x.moveTo(s * 0.26, -0.3); x.lineTo(s * 0.34, -0.38 + cl); x.stroke(); }
      for (const s of [-1, 1]) { x.strokeStyle = t.lo; x.lineWidth = 0.03; x.beginPath(); x.moveTo(s * 0.07, -0.42); x.lineTo(s * 0.1, -0.6 + droop); x.stroke(); eye(s * 0.1, -0.63 + droop, 0.05); }
      mouth(0, -0.25, 0.06);
    } else if (sp === 3) { // Pilzling: mushroom cap, stubby legs
      const a = walk ? Math.sin(ph) * 0.06 : 0;
      for (const s of [-1, 1]) { x.fillStyle = t.lo; Art.rrect(x, s * 0.1 - 0.05 + a * s, -0.16 + Math.max(0, Math.sin(ph + (s > 0 ? Math.PI : 0))) * (walk ? -0.05 : 0), 0.1, 0.16, 0.04); x.fill(); }
      const stem = Art.tones('#efe6d4');
      x.fillStyle = stem.base; Art.rrect(x, -0.15, -0.5 + breathe, 0.3, 0.38, 0.1); x.fill(); x.strokeStyle = stem.edge; x.lineWidth = 0.02; x.stroke();
      eye(-0.06, -0.36, 0.05); eye(0.07, -0.36, 0.05); mouth(0.01, -0.25, 0.05);
      x.save(); x.translate(0, -0.52 + breathe); x.rotate(sad ? 0.2 : joy ? -0.1 : 0);
      x.fillStyle = shade(0, -0.12, 0.38, 0.2); x.beginPath(); x.ellipse(0, 0, 0.38, 0.22, 0, Math.PI, 0); x.quadraticCurveTo(0, 0.08, -0.38, 0); x.fill(); x.strokeStyle = t.edge; x.lineWidth = 0.03; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.85)'; for (const [dx, dy, r] of [[-0.18, -0.1, 0.05], [0.05, -0.16, 0.06], [0.22, -0.07, 0.04]]) { x.beginPath(); x.arc(dx, dy, r, 0, Math.PI * 2); x.fill(); }
      x.restore();
    } else if (sp === 4) { // Schweber: floating jelly with tentacles
      const fl = Math.sin(frame / 6 * Math.PI * 2) * 0.04 - 0.18 + (sad ? 0.1 : 0);
      x.strokeStyle = Col.rgba(t.base, 0.85); x.lineWidth = 0.035;
      for (let i = 0; i < 5; i++) { const tx = -0.16 + i * 0.08, w = Math.sin(ph + i) * 0.05; x.beginPath(); x.moveTo(tx, -0.4 + fl + 0.2); x.quadraticCurveTo(tx + w, -0.18 + fl + 0.2, tx - w, 0 + fl + 0.12); x.stroke(); }
      x.fillStyle = 'rgba(0,0,0,0)';
      const g = shade(0, -0.5 + fl, 0.28, 0.22); x.fillStyle = g; x.globalAlpha = 0.92;
      x.beginPath(); x.ellipse(0, -0.38 + fl, 0.28, 0.24, 0, Math.PI, 0); x.quadraticCurveTo(0, -0.3 + fl, -0.28, -0.38 + fl); x.fill(); x.globalAlpha = 1;
      x.strokeStyle = t.edge; x.lineWidth = 0.025; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.4)'; x.beginPath(); x.ellipse(-0.1, -0.52 + fl, 0.08, 0.05, -0.4, 0, Math.PI * 2); x.fill();
      eye(-0.07, -0.46 + fl, 0.05); eye(0.08, -0.46 + fl, 0.05); mouth(0.0, -0.38 + fl, 0.05);
    } else { // Steinling: rocky golem with a glowing crystal
      const a = walk ? Math.sin(ph) * 0.05 : 0;
      for (const s of [-1, 1]) { const rk = Art.tones(Col.mix(col, '#7a7066', 0.6)); Art.facets(x, Art.blobPts(RNG.mulberry32(7 + s), s * 0.12 + a * s, -0.1, 0.1, 0.1, 5, 0.3), s * 0.12 - 0.02, -0.12, rk, { lw: 0.025 }); }
      const rk = Art.tones(Col.mix(col, '#7a7066', 0.55));
      Art.facets(x, Art.blobPts(RNG.mulberry32(42), 0, -0.42 + breathe + droop * 0.5, 0.3, 0.28, 7, 0.25), -0.08, -0.5, rk, { lw: 0.03 });
      for (const s of [-1, 1]) Art.facets(x, Art.blobPts(RNG.mulberry32(9 + s), s * 0.34, -0.36 + (joy ? -0.18 : sad ? 0.08 : a * s), 0.09, 0.12, 5, 0.3), s * 0.34, -0.38, rk, { lw: 0.025 });
      x.fillStyle = col; x.beginPath(); x.moveTo(-0.06, -0.66); x.lineTo(0, -0.86); x.lineTo(0.06, -0.66); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.moveTo(-0.03, -0.68); x.lineTo(0, -0.8); x.lineTo(0.0, -0.68); x.fill();
      eye(-0.08, -0.48 + droop * 0.5, 0.045, 0.2); eye(0.08, -0.48 + droop * 0.5, 0.045, 0.2); mouth(0, -0.36 + droop * 0.5, 0.06);
    }
    if (imp) { x.strokeStyle = 'rgba(255,90,90,.9)'; x.lineWidth = 0.03; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 0.32, -0.9); x.lineTo(s * 0.38, -0.98); x.moveTo(s * 0.36, -0.86); x.lineTo(s * 0.44, -0.9); x.stroke(); } }
  },
  alienPose(c) {
    if (c.state === 'in') return 0;
    if (c.state === 'out') return c.satisfied ? 2 : 4;
    if (c.buying > 0) return 2;
    if (c.t > c.patience * 0.65) return 3;
    return 1;
  },
  alien(ctx, x, y, c, tm, dirx) {
    const skins = Draw.planetSkins();
    const col = skins[c.skin % skins.length];
    const sp = c.skin % 6;
    const pose = CharArt.alienPose(c);
    const moving = c.state !== 'wait';
    const nf = pose === 0 || (pose === 2 && moving) || (pose === 4 && moving) ? 6 : 4;
    const speed = pose === 0 ? 9 : pose === 2 ? 7 : pose === 3 ? 10 : 3;
    const frame = App.settings.reducedFx ? 0 : Math.floor(tm * speed + c.skin * 1.7) % nf;
    const ppt = Art.bucket(Render.ppt(), 96);
    const spr = CharArt.alienSprite(sp, col, moving && pose !== 2 && pose !== 4 ? 0 : pose, frame, ppt);
    const shake = pose === 3 ? Math.sin(tm * 30) * 0.015 : 0;
    ctx.save(); ctx.translate(x + shake, y);
    if (dirx < 0) ctx.scale(-1, 1);
    ctx.drawImage(spr, -0.7, -1.5, 1.4, 1.7);
    ctx.restore();
    if (pose === 2 && !moving && !App.settings.reducedFx && Math.random() < 0.08) Render.spawn('glint', c._wx + (Math.random() - 0.5) * 0.5, c._wy - 0.8, 0, -0.4, 0.5, '#ffe28a', 0.15);
  },

  // ---------------- caravan: rover beetles with cargo ----------------
  beetleSprite(kind, ppt) {
    return Art.cached('B|beetle|' + kind + '|' + ppt, () => {
      const W = 1.4, H = 1.4, c = Art.canvas(W * ppt, H * ppt), x = c.getContext('2d');
      x.scale(ppt, ppt); x.translate(W / 2, H - 0.25);
      const shell = Art.tones(kind === 0 ? '#c86a3a' : kind === 1 ? '#a8884a' : '#7a8a4a');
      x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(0, 0.04, 0.5, 0.13, 0, 0, Math.PI * 2); x.fill();
      // body shell
      const g = x.createRadialGradient(-0.15, -0.5, 0.05, 0, -0.32, 0.55); g.addColorStop(0, shell.rim); g.addColorStop(0.5, shell.base); g.addColorStop(1, shell.lo);
      x.fillStyle = g; x.beginPath(); x.ellipse(0, -0.3, 0.48, 0.28, 0, Math.PI, 0); x.quadraticCurveTo(0, -0.12, -0.48, -0.3); x.fill();
      x.strokeStyle = shell.edge; x.lineWidth = 0.03; x.stroke();
      x.strokeStyle = Col.rgba(shell.edge, 0.6); x.lineWidth = 0.02; x.beginPath(); x.moveTo(0, -0.58); x.lineTo(0, -0.18); x.stroke();
      // head
      x.fillStyle = shell.lo; x.beginPath(); x.ellipse(0.5, -0.28, 0.13, 0.1, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = shell.edge; x.lineWidth = 0.02; x.stroke();
      x.fillStyle = '#fff6a0'; x.beginPath(); x.arc(0.56, -0.3, 0.03, 0, Math.PI * 2); x.fill();
      x.strokeStyle = shell.edge; x.lineWidth = 0.02; x.beginPath(); x.moveTo(0.55, -0.36); x.quadraticCurveTo(0.65, -0.5, 0.75, -0.48); x.stroke();
      if (kind === 0) { // lead: rider with pennant pole
        x.fillStyle = '#e8d8b8'; Art.rrect(x, -0.12, -0.78, 0.2, 0.22, 0.06); x.fill();
        x.fillStyle = '#8a4a2a'; x.beginPath(); x.arc(-0.02, -0.84, 0.09, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#5a3a1a'; x.lineWidth = 0.025; x.beginPath(); x.moveTo(-0.3, -0.5); x.lineTo(-0.3, -1.1); x.stroke();
      } else { // cargo crates and sacks
        Art.box(x, -0.3, -0.48, 0.3, 0.16, 0.28, Art.tones('#b0824a'), { r: 0.02, lw: 0.02 });
        Art.box(x, 0.02, -0.46, 0.24, 0.14, 0.22, Art.tones(kind === 1 ? '#3a7ad8' : '#d8503a'), { r: 0.02, lw: 0.02 });
        x.fillStyle = '#d8c8a0'; x.beginPath(); x.ellipse(-0.05, -0.72, 0.12, 0.08, 0, 0, Math.PI * 2); x.fill();
      }
      return c;
    });
  },
  caravan(ctx, x, y, c, tm, ang, moving) {
    const n = 3 + (c.skin % 3);
    const dirx = Math.cos(ang) >= 0 ? 1 : -1;
    const ppt = Art.bucket(Render.ppt(), 96);
    for (let i = n - 1; i >= 0; i--) {
      const ox = x - Math.cos(ang) * i * 0.95, oy = y - Math.sin(ang) * i * 0.95;
      const legs = moving ? Math.sin(tm * 12 + i * 1.3) : 0;
      ctx.save(); ctx.translate(ox, oy - Math.abs(legs) * 0.03); if (dirx < 0) ctx.scale(-1, 1);
      // legs
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 0.035; ctx.beginPath();
      for (let k = 0; k < 3; k++) { const lx = -0.3 + k * 0.3, sw = legs * 0.08 * (k % 2 ? 1 : -1); ctx.moveTo(lx, -0.2); ctx.lineTo(lx + sw, 0); }
      ctx.stroke();
      ctx.drawImage(CharArt.beetleSprite(i === 0 ? 0 : 1 + (i % 2), ppt), -0.7, -1.15, 1.4, 1.4);
      if (i === 0) { // waving pennant
        const w = Math.sin(tm * 6 + c.skin) * 0.05;
        ctx.fillStyle = Render.palette.accent; ctx.beginPath(); ctx.moveTo(-0.3, -1.1 + 0.25); ctx.quadraticCurveTo(-0.5, -1.05 + 0.25 + w, -0.68, -1.0 + 0.25 + w); ctx.lineTo(-0.3, -0.92 + 0.25); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  },

  // ---------------- ships ----------------
  shipSprite(tier, ppt) {
    return Art.cached('B|ship|' + tier + '|' + ppt, () => {
      const S = [0, 0, 2.2, 3.4, 5.6][tier], c = Art.canvas(S * ppt, S * ppt), x = c.getContext('2d');
      x.scale(ppt, ppt); x.translate(S / 2, S / 2);
      x.lineJoin = 'round';
      const hull = Art.tones(tier === 2 ? '#e8ebf2' : tier === 3 ? '#c8d0e0' : '#8a94a8');
      const acc = Art.tones(tier === 2 ? '#e0609a' : tier === 3 ? '#d84fc0' : '#ff9a3d');
      const sh = (pts) => { const g = x.createLinearGradient(-S / 2, -S / 2, S / 2, S / 2); g.addColorStop(0, hull.hi); g.addColorStop(0.55, hull.base); g.addColorStop(1, hull.lo); x.fillStyle = g; Art.poly(x, pts); x.fill(); x.strokeStyle = hull.edge; x.lineWidth = 0.05; x.stroke(); };
      if (tier === 2) { // shuttle: compact delta wing
        sh([[0, -0.95], [0.3, -0.35], [0.85, 0.45], [0.35, 0.6], [-0.35, 0.6], [-0.85, 0.45], [-0.3, -0.35]]);
        x.fillStyle = acc.base; Art.poly(x, [[-0.85, 0.45], [-0.55, 0.38], [-0.4, 0.55], [-0.35, 0.6]]); x.fill(); Art.poly(x, [[0.85, 0.45], [0.55, 0.38], [0.4, 0.55], [0.35, 0.6]]); x.fill();
        x.fillStyle = '#2a4a6a'; x.beginPath(); x.ellipse(0, -0.4, 0.14, 0.24, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(200,240,255,.6)'; x.beginPath(); x.ellipse(-0.04, -0.47, 0.05, 0.1, 0, 0, Math.PI * 2); x.fill();
        Art.box(x, -0.32, 0.38, 0.22, 0.2, 0.15, Art.pal('anth'), { r: 0.04, lw: 0.02 }); Art.box(x, 0.1, 0.38, 0.22, 0.2, 0.15, Art.pal('anth'), { r: 0.04, lw: 0.02 });
      } else if (tier === 3) { // trader: long hull with cargo pods
        sh([[0, -1.5], [0.28, -1.1], [0.32, 0.9], [0.2, 1.3], [-0.2, 1.3], [-0.32, 0.9], [-0.28, -1.1]]);
        for (const s of [-1, 1]) { Art.box(x, s * 0.62 - 0.22, -0.5, 0.44, 1.2, 0.3, Art.tones(s < 0 ? '#3a7ad8' : '#e0b03a'), { r: 0.08, lw: 0.03 }); x.strokeStyle = hull.lo; x.lineWidth = 0.08; x.beginPath(); x.moveTo(s * 0.3, -0.2); x.lineTo(s * 0.42, -0.2); x.moveTo(s * 0.3, 0.4); x.lineTo(s * 0.42, 0.4); x.stroke(); }
        x.fillStyle = acc.base; x.fillRect(-0.3, 0.2, 0.6, 0.1);
        x.fillStyle = '#2a4a6a'; x.beginPath(); x.ellipse(0, -1.05, 0.12, 0.2, 0, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#d8dde6'; x.lineWidth = 0.025; x.beginPath(); x.moveTo(0.15, 0.6); x.lineTo(0.3, 0.2); x.stroke();
        for (const s of [-1, 0, 1]) Art.box(x, s * 0.2 - 0.08, 1.15, 0.16, 0.16, 0.1, Art.pal('anth'), { r: 0.03, lw: 0.02 });
      } else { // freighter: huge boxy hull with containers, bridge at the back
        sh([[-0.9, -2.3], [0.9, -2.3], [1.2, -1.8], [1.2, 2.0], [0.9, 2.5], [-0.9, 2.5], [-1.2, 2.0], [-1.2, -1.8]]);
        const cc = ['#d8503a', '#3a7ad8', '#e0b03a', '#3aa86a', '#8a5ad8', '#d87a3a'];
        for (let r = 0; r < 5; r++) for (let k = 0; k < 2; k++) Art.box(x, -0.95 + k * 1.0, -1.95 + r * 0.72, 0.9, 0.55, 0.25, Art.tones(cc[(r * 2 + k) % 6]), { r: 0.02, lw: 0.025 });
        Art.box(x, -0.5, 1.75, 1.0, 0.55, 0.6, hull, { r: 0.05, lw: 0.03 });
        x.fillStyle = '#7fd3ff'; x.fillRect(-0.4, 1.75 - 0.6 * Art.V + 0.45, 0.8, 0.08);
        x.fillStyle = acc.base; x.fillRect(-1.2, -0.1, 0.12, 0.6); x.fillRect(1.08, -0.1, 0.12, 0.6);
        for (const s of [-0.7, -0.25, 0.25, 0.7]) Art.box(x, s - 0.15, 2.38, 0.3, 0.2, 0.15, Art.pal('anth'), { r: 0.04, lw: 0.02 });
      }
      return c;
    });
  },
  // landing / takeoff choreography. k: 0..1 progress; returns {alt, legs, thr}
  shipPhase(c) {
    if (c.state === 'wait') return { alt: 0, legs: 1, thr: 0.05, squash: 0 };
    if (c.state === 'in') {
      const k = U.clamp(c.t / c.arrive, 0, 1);
      if (k < 0.6) { const e = Art.ease.outCubic(k / 0.6); return { alt: 1 - e * 0.78, legs: 0, thr: 0.4, side: 1 - e, squash: 0 }; }
      if (k < 0.85) { const e = Art.ease.inOutQuad((k - 0.6) / 0.25); return { alt: 0.22 * (1 - e) + 0.02, legs: e, thr: 1, squash: 0 }; }
      const e = (k - 0.85) / 0.15;
      return { alt: 0.02 * (1 - e), legs: 1, thr: 0.5 * (1 - e), squash: Math.sin(e * Math.PI) * 0.06 };
    }
    const k = U.clamp(c.t / 3, 0, 1);
    if (k < 0.2) { const e = k / 0.2; return { alt: 0, legs: 1, thr: e, squash: -Math.sin(e * Math.PI) * 0.03 }; }
    const e = Art.ease.inCubic((k - 0.2) / 0.8);
    return { alt: e, legs: 1 - Math.min(1, e * 3), thr: 1, side: -e, squash: 0 };
  },
  ship(ctx, x, y, c, tm, b) {
    const tier = c.tier;
    const S = [0, 0, 2.2, 3.4, 5.6][tier];
    const ph = CharArt.shipPhase(c);
    const sun = Render.sun(App.g);
    const H = 7; // tiles of screen height at full altitude
    const alt = ph.alt;
    const sc = 1 + alt * 0.55;
    const drift = (ph.side || 0) * 4;
    // soft shadow on the ground (shrinks and fades with altitude)
    const sa = 0.4 * (1 - alt * 0.75);
    ctx.save(); ctx.globalAlpha = sa;
    const shx = x + drift * 0.3 + alt * sun.dx * 4, shy = y + alt * sun.dy * 4;
    ctx.drawImage(FxLib.tinted('soft', 0, '#000000'), shx - S * 0.5 * (1 - alt * 0.3), shy - S * 0.32 * (1 - alt * 0.3), S * (1 - alt * 0.3), S * 0.64 * (1 - alt * 0.3));
    ctx.restore();
    const px = x + drift, py = y - alt * H;
    ctx.save(); ctx.translate(px, py); ctx.scale(sc * (1 + ph.squash), sc * (1 - ph.squash));
    // landing legs
    if (ph.legs > 0) {
      ctx.strokeStyle = '#3a3f48'; ctx.lineWidth = 0.08; ctx.lineCap = 'round';
      const L = S * 0.32 * ph.legs;
      ctx.beginPath();
      for (const [lx, ly] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.35], [0.6, 0.35]]) { ctx.moveTo(lx * S * 0.5, ly * S * 0.5); ctx.lineTo(lx * S * 0.5 * 1.25, ly * S * 0.5 + L * 0.5); }
      ctx.stroke();
      ctx.fillStyle = '#22252b'; for (const [lx, ly] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.35], [0.6, 0.35]]) { ctx.beginPath(); ctx.ellipse(lx * S * 0.5 * 1.25, ly * S * 0.5 + L * 0.5, 0.1, 0.05, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.drawImage(CharArt.shipSprite(tier, Art.bucket(Render.ppt() * sc, tier === 4 ? 64 : 96)), -S / 2, -S / 2, S, S);
    // cargo hatch / unloading while waiting
    if (c.state === 'wait') {
      const open = 0.5 + 0.5 * Math.min(1, c.t * 2);
      ctx.fillStyle = 'rgba(255,220,150,' + (0.5 * open).toFixed(2) + ')'; ctx.fillRect(-S * 0.12, S * 0.3, S * 0.24, S * 0.12 * open);
      if (c.buying > 0) { const k = 1 - c.buying / 0.4; Art.box(ctx, -0.12, S * 0.45 - k * S * 0.15, 0.24, 0.18, 0.18, Art.tones('#b0824a'), { r: 0.02, lw: 0.02 }); }
    }
    // engine glow
    if (ph.thr > 0.02 && !App.settings.reducedFx) {
      ctx.globalCompositeOperation = 'lighter';
      const fl = 0.7 + 0.3 * Math.sin(tm * 40);
      const col = tier === 4 ? '#ffb070' : '#7fd3ff';
      ctx.globalAlpha = Math.min(1, ph.thr) * fl;
      const eng = tier === 2 ? [[-0.21, 0.55], [0.21, 0.55]] : tier === 3 ? [[-0.2, 1.3], [0, 1.3], [0.2, 1.3]] : [[-0.7, 2.55], [-0.25, 2.55], [0.25, 2.55], [0.7, 2.55]];
      const fs = 0.35 + ph.thr * 0.6;
      for (const [ex, ey] of eng) {
        ctx.drawImage(FxLib.tinted('soft', 0, col), ex - fs * 0.5, ey - fs * 0.2, fs, fs);
        if (alt > 0.01) ctx.drawImage(FxLib.tinted('flame', Math.floor(tm * 20) & 3, col), ex - 0.1, ey, 0.2, 0.4 + ph.thr * 0.6);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    // retro-thruster dust on the ground during braking
    if (ph.thr > 0.6 && alt < 0.3 && !App.settings.reducedFx && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2;
      Render.spawn('dust', c._wx + Math.cos(a) * S * 0.3, c._wy + Math.sin(a) * S * 0.2, Math.cos(a) * 2, Math.sin(a) * 1.2 - 0.2, 0.9, Render.palette.particle, 0.25);
    }
  },

  // ---------------- speech bubble (UI element in the world) ----------------
  bubble(ctx, x, y, c, tm) {
    const w = c.wishes.find(w2 => w2.got < w2.qty) || c.wishes[0];
    if (!w) return;
    if (!c._bubAt) c._bubAt = App.now;
    const age = (App.now - c._bubAt) / 260;
    const pop = age < 1 ? Art.ease.outBack(Math.max(0, age)) : 1;
    const s = Math.max(0.6, 27 / App.cam.zoom);
    ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
    const bw = s * 2.3, bh = s * 1.15;
    // body
    ctx.fillStyle = 'rgba(0,0,0,.25)'; Art.rrect(ctx, -bw / 2 + s * 0.06, -bh / 2 + s * 0.08, bw, bh, s * 0.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.97)'; Art.rrect(ctx, -bw / 2, -bh / 2, bw, bh, s * 0.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * 0.12, bh / 2 - 0.01); ctx.lineTo(0, bh / 2 + s * 0.22); ctx.lineTo(s * 0.14, bh / 2 - 0.01); ctx.fill();
    ctx.strokeStyle = 'rgba(40,40,60,.35)'; ctx.lineWidth = s * 0.04; Art.rrect(ctx, -bw / 2, -bh / 2, bw, bh, s * 0.3); ctx.stroke();
    // patience ring around the item
    const ix = -bw / 2 + s * 0.62;
    const pf = U.clamp(1 - c.t / c.patience, 0, 1);
    ctx.lineWidth = s * 0.09; ctx.strokeStyle = '#e4e6ec'; ctx.beginPath(); ctx.arc(ix, 0, s * 0.43, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = pf > 0.5 ? '#3ab54a' : pf > 0.25 ? '#f0a030' : '#e04a3a';
    ctx.beginPath(); ctx.arc(ix, 0, s * 0.43, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pf); ctx.stroke();
    if (w.res >= 0) Draw.item(ctx, w.res, w.ref, ix, 0, s * 0.36);
    else { ctx.fillStyle = DATA.TIERS[w.tier].color; ctx.beginPath(); ctx.arc(ix, 0, s * 0.24, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = s * 0.04; ctx.stroke(); }
    // remaining number (counts down live)
    const fs = s * 0.48;
    ctx.fillStyle = '#20222a'; ctx.font = '800 ' + fs + 'px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(Fmt.num(Math.max(0, w.qty - w.got)), ix + s * 0.55, -s * 0.02);
    // mood glyph
    const mx = bw / 2 - s * 0.32, my = -bh / 2 + s * 0.32, mr = s * 0.2;
    const mood = c.buying > 0 ? 2 : pf < 0.3 ? 0 : 1;
    ctx.fillStyle = mood === 2 ? '#ffd24a' : mood === 0 ? '#ff7a5a' : '#c8ccd6'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = s * 0.035; ctx.beginPath();
    ctx.moveTo(mx - mr * 0.4, my - mr * 0.25); ctx.lineTo(mx - mr * 0.4, my - mr * 0.05); ctx.moveTo(mx + mr * 0.4, my - mr * 0.25); ctx.lineTo(mx + mr * 0.4, my - mr * 0.05);
    if (mood === 2) { ctx.moveTo(mx - mr * 0.5, my + mr * 0.2); ctx.quadraticCurveTo(mx, my + mr * 0.75, mx + mr * 0.5, my + mr * 0.2); }
    else if (mood === 0) { ctx.moveTo(mx - mr * 0.45, my + mr * 0.5); ctx.quadraticCurveTo(mx, my + mr * 0.05, mx + mr * 0.45, my + mr * 0.5); }
    else { ctx.moveTo(mx - mr * 0.4, my + mr * 0.35); ctx.lineTo(mx + mr * 0.4, my + mr * 0.35); }
    ctx.stroke();
    ctx.restore();
  }
};
