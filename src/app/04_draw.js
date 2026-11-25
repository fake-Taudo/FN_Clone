// =====================================================================
// Draw: buildings, belts, items, customers, astronaut (tile units, relative coords)
// =====================================================================
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const GRADE_COLORS = ['#8b939c', '#f2c84b', '#4aa8ff', '#ff4fd8'];

const Draw = {
  tm: 0,
  shadow(ctx, x, y, w, hh, r = 0.25) {
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    Render.roundRect(ctx, x + 0.1, y + 0.16, w, hh, r); ctx.fill();
  },
  body(ctx, x, y, w, hh, fill, r = 0.25, stroke = true) {
    Render.roundRect(ctx, x, y, w, hh, r);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = 0.06; ctx.strokeStyle = Col.shade(fill, -0.5); ctx.stroke(); }
  },
  arrow(ctx, cx, cy, dir, s, color) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(dir * Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.6, -s * 0.75); ctx.lineTo(-s * 0.25, 0); ctx.lineTo(-s * 0.6, s * 0.75); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  },
  levelTag(ctx, b, x, y) {
    if (b.level <= 1 || App.cam.zoom < 20) return;
    const fs = Math.max(0.26, 12 / App.cam.zoom);
    const s = fs * 1.3;
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    Render.roundRect(ctx, x + 0.08, y + b.h - s - 0.08, fs * 1.1 + ROMAN[b.level].length * fs * 0.65, s, 0.1); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 ' + fs + 'px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(ROMAN[b.level], x + 0.08 + fs * 0.55, y + b.h - s / 2 - 0.08);
  },
  frontArrow(ctx, b, x, y) {
    const p = Grid.frontPort(b);
    const ax = p[0] - U.DX[b.rot] * 0.62 - Render.ox + 0.5 - (b.x - Render.ox - x);
    const ay = p[1] - U.DY[b.rot] * 0.62 - Render.oy + 0.5 - (b.y - Render.oy - y);
    Draw.arrow(ctx, ax, ay, b.rot, 0.2, 'rgba(255,255,255,.85)');
  },

  // ---------------- belts ----------------
  beltShape(g, b) {
    if (b._sv === g.topoVersion) return b.shape;
    b._sv = g.topoVersion;
    const feeds = d => {
      const o = Grid.at(g, b.x - U.DX[d], b.y - U.DY[d]);
      if (!o) return false;
      if (o.type === 'belt' || o.type === 'merger') return o.x + U.DX[o.rot] === b.x && o.y + U.DY[o.rot] === b.y;
      if (o.type === 'splitter' || o.type === 'fsplitter' || o.type === 'osplitter') return true;
      return false;
    };
    const back = feeds(b.rot), left = feeds((b.rot + 1) & 3), right = feeds((b.rot + 3) & 3);
    // "left" input arrives moving in direction rot+1 (coming from the left-hand tile)
    b.shape = back || (left && right) || (!left && !right) ? 0 : left ? 1 : 2;
    return b.shape;
  },
  belt(ctx, g, b, x, y) {
    const shape = Draw.beltShape(g, b);
    const col = GRADE_COLORS[b.grade];
    const z = App.cam.zoom;
    ctx.save();
    ctx.translate(x + 0.5, y + 0.5);
    ctx.rotate(b.rot * Math.PI / 2);
    const speed = CONFIG.belt.speed[b.grade] * (b.boost || 1);
    const off = App.settings.reducedFx ? 0 : (Draw.tm * speed) % 0.5;
    if (shape === 0) {
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(-0.5, -0.4, 1, 0.8);
      ctx.fillStyle = col; ctx.fillRect(-0.5, -0.42, 1, 0.09); ctx.fillRect(-0.5, 0.33, 1, 0.09);
      if (z >= 14) {
        ctx.strokeStyle = b.grade === 3 ? 'rgba(255,120,230,.75)' : 'rgba(255,255,255,.22)'; ctx.lineWidth = 0.07;
        ctx.beginPath();
        for (let i = -1; i < 2; i++) { const cx = -0.5 + off + i * 0.5; if (cx < -0.55 || cx > 0.45) continue; ctx.moveTo(cx - 0.08, -0.2); ctx.lineTo(cx + 0.08, 0); ctx.lineTo(cx - 0.08, 0.2); }
        ctx.stroke();
      }
    } else {
      // curve: input from side, output to the front (+x). side=-y for shape 2 (right-hand feed) mirrored for shape 1
      const sgn = shape === 1 ? 1 : -1;
      ctx.scale(1, sgn);
      // arc centred at (0.5, -0.5) going from top edge to right edge
      ctx.beginPath(); ctx.arc(0.5, -0.5, 0.92, Math.PI / 2, Math.PI); ctx.arc(0.5, -0.5, 0.08, Math.PI, Math.PI / 2, true); ctx.closePath();
      ctx.fillStyle = '#2b2f36'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 0.09;
      ctx.beginPath(); ctx.arc(0.5, -0.5, 0.875, Math.PI / 2, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(0.5, -0.5, 0.125, Math.PI / 2, Math.PI); ctx.stroke();
      if (z >= 14) {
        ctx.strokeStyle = b.grade === 3 ? 'rgba(255,120,230,.75)' : 'rgba(255,255,255,.22)'; ctx.lineWidth = 0.07;
        for (let i = 0; i < 2; i++) {
          const a = Math.PI - ((off / 0.5 + i) / 2) * (Math.PI / 2);
          const ca = Math.cos(a), sa = Math.sin(a);
          ctx.beginPath();
          ctx.moveTo(0.5 + ca * 0.3, -0.5 + sa * 0.3); ctx.lineTo(0.5 + ca * 0.5 + sa * 0.08, -0.5 + sa * 0.5 - ca * 0.08); ctx.lineTo(0.5 + ca * 0.7, -0.5 + sa * 0.7);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    if (b.boost > 1 && z >= 14) { ctx.fillStyle = 'rgba(155,240,106,.18)'; ctx.fillRect(x, y, 1, 1); }
  },
  itemPos(b, it, alpha) {
    const p = it.pp + (it.p - it.pp) * alpha;
    const cx = b.x + 0.5, cy = b.y + 0.5;
    if (p < 0.5) {
      const ex = cx - U.DX[it.from] * 0.5, ey = cy - U.DY[it.from] * 0.5;
      const k = p * 2;
      return [ex + (cx - ex) * k, ey + (cy - ey) * k];
    }
    const k = (p - 0.5) * 2;
    return [cx + U.DX[b.rot] * 0.5 * k, cy + U.DY[b.rot] * 0.5 * k];
  },
  item(ctx, res, ref, x, y, s) {
    const tier = DATA.RESOURCES[res].tier;
    if (tier >= 6) {
      ctx.save(); ctx.translate(x, y);
      const pulse = tier === 6 ? 0.7 + 0.3 * Math.sin(Draw.tm * 4) : 1;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 * pulse;
      ctx.drawImage(Sprites.glow(tier === 7 ? Col.prism(Draw.tm, res * 50) : DATA.TIERS[tier].color), -s * 1.4, -s * 1.4, s * 2.8, s * 2.8);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      Sprites.drawItem(ctx, res, ref, s * 0.58, Draw.tm);
      ctx.restore();
      return;
    }
    ctx.drawImage(Sprites.item(res, ref), x - s, y - s, s * 2, s * 2);
  },

  // ---------------- generic building ----------------
  building(ctx, g, b, x, y) {
    const def = DATA.BUILDINGS[b.type];
    const tm = Draw.tm;
    const w = b.w, hh = b.h;
    if (App.cam.zoom < 13 && !b._thumb && b.id >= 0) {
      // level of detail: flat blocks when zoomed far out
      if (b.type === 'belt') { ctx.fillStyle = '#2b2f36'; ctx.fillRect(x, y + 0.12, 1, 0.76); ctx.fillStyle = GRADE_COLORS[b.grade]; ctx.fillRect(x, y + 0.42, 1, 0.16); return; }
      if (b.type === 'bridge') return;
      ctx.fillStyle = b.type === 'extractor' ? '#ff8a2f' : def.color;
      ctx.fillRect(x + 0.08, y + 0.08, w - 0.16, hh - 0.16);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 0.08, y + hh - 0.3, w - 0.16, 0.22);
      return;
    }
    switch (b.type) {
      case 'belt': Draw.belt(ctx, g, b, x, y); return;
      case 'extractor': return Draw.extractor(ctx, g, b, x, y);
      case 'splitter': case 'fsplitter': case 'osplitter': case 'merger': case 'crossing': return Draw.node(ctx, g, b, x, y);
      case 'bridge': return; // drawn in the overlay layer
      case 'silo': return Draw.silo(ctx, g, b, x, y);
      case 'lab': return Draw.lab(ctx, g, b, x, y);
      case 'cooler': {
        Draw.shadow(ctx, x + 0.1, y + 0.1, w - 0.2, hh - 0.2, 0.9);
        ctx.fillStyle = '#3c5a68'; ctx.beginPath(); ctx.arc(x + 1, y + 1, 0.92, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(x + 1, y + 1, 0.78, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#20343c'; ctx.beginPath(); ctx.arc(x + 1, y + 1, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.05;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + 1, y + 1, 0.55 + i * 0.1, 0, Math.PI * 2); ctx.stroke(); }
        if (!App.settings.reducedFx && Math.random() < 0.08) Render.spawn('smoke', b.x + 1 + (Math.random() - 0.5) * 0.6, b.y + 1, (Math.random() - 0.5) * 0.2, -0.5, 2, '#e8f6ff', 0.18);
        break;
      }
      case 'servo': {
        Draw.shadow(ctx, x + 0.08, y + 0.08, w - 0.16, hh - 0.16);
        Draw.body(ctx, x + 0.08, y + 0.08, w - 0.16, hh - 0.16, '#5a5040');
        ctx.save(); ctx.translate(x + 1, y + 1); ctx.rotate(App.settings.reducedFx ? 0 : tm * 1.5);
        ctx.fillStyle = def.color;
        ctx.beginPath();
        for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; const r = i % 2 ? 0.55 : 0.72; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a5040'; ctx.beginPath(); ctx.arc(0, 0, 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'charger': {
        Draw.shadow(ctx, x + 0.08, y + 0.08, w - 0.16, hh - 0.16);
        Draw.body(ctx, x + 0.08, y + 0.08, w - 0.16, hh - 0.16, '#2f4a2a');
        const pul = 0.6 + 0.4 * Math.sin(tm * 3);
        ctx.fillStyle = Col.rgba(def.color, 0.5 + pul * 0.5);
        ctx.beginPath(); ctx.moveTo(x + 1.15, y + 0.35); ctx.lineTo(x + 0.7, y + 1.1); ctx.lineTo(x + 1.0, y + 1.1); ctx.lineTo(x + 0.85, y + 1.65); ctx.lineTo(x + 1.3, y + 0.9); ctx.lineTo(x + 1.0, y + 0.9); ctx.closePath(); ctx.fill();
        break;
      }
      case 'path': return Draw.path(ctx, g, b, x, y);
      case 'fence': return Draw.fence(ctx, g, b, x, y);
      case 'lamp': {
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 0.55, y + 0.8, 0.25, 0.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#555c66'; ctx.fillRect(x + 0.46, y + 0.2, 0.08, 0.62);
        ctx.fillStyle = b.level >= 2 ? '#bfe8ff' : def.color; ctx.beginPath(); ctx.arc(x + 0.5, y + 0.2, 0.14 + b.level * 0.02, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'flag': {
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 0.5, y + 0.85, 0.2, 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ddd'; ctx.fillRect(x + 0.3, y + 0.05, 0.06, 0.8);
        const wave = Math.sin(tm * 4 + b.x) * 0.05;
        ctx.fillStyle = b.level >= 2 ? Render.palette.accent : def.color;
        ctx.beginPath(); ctx.moveTo(x + 0.36, y + 0.08); ctx.quadraticCurveTo(x + 0.6, y + 0.05 + wave, x + 0.85, y + 0.12 + wave); ctx.lineTo(x + 0.85, y + 0.42 + wave); ctx.quadraticCurveTo(x + 0.6, y + 0.36 - wave, x + 0.36, y + 0.4); ctx.closePath(); ctx.fill();
        break;
      }
      case 'plant': {
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 0.55, y + 0.6, 0.42, 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(170,230,255,.25)'; ctx.strokeStyle = 'rgba(200,240,255,.7)'; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = def.color;
        for (let i = 0; i < 2 + b.level; i++) { const a = i * 2.1; ctx.beginPath(); ctx.ellipse(x + 0.5 + Math.cos(a) * 0.15, y + 0.52 + Math.sin(a) * 0.12, 0.08, 0.18, a, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'beacon': {
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 0.5, y + 0.85, 0.3, 0.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4a5564'; ctx.beginPath(); ctx.moveTo(x + 0.3, y + 0.85); ctx.lineTo(x + 0.45, y + 0.25); ctx.lineTo(x + 0.55, y + 0.25); ctx.lineTo(x + 0.7, y + 0.85); ctx.closePath(); ctx.fill();
        const p = 0.5 + 0.5 * Math.sin(tm * 3 + b.x);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 + p * 0.6;
        ctx.drawImage(Sprites.glow(def.color), x - 0.1, y - 0.4, 1.2, 1.2);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        break;
      }
      default:
        if (REFINERY_LEVEL[b.type]) return Draw.refinery(ctx, g, b, x, y);
        if (SELLER_TIER[b.type] !== undefined) return Draw.seller(ctx, g, b, x, y);
        Draw.body(ctx, x, y, w, hh, def.color);
    }
  },

  extractor(ctx, g, b, x, y) {
    const R = b.res !== undefined ? DATA.RESOURCES[b.res] : DATA.RESOURCES[0];
    const working = b.buf ? b.buf.length < CONFIG.maxItemsPerBuffer : true;
    Draw.shadow(ctx, x + 0.06, y + 0.06, 1.88, 1.88, 0.3);
    Draw.body(ctx, x + 0.06, y + 0.06, 1.88, 1.88, '#3a3d44', 0.3);
    Draw.body(ctx, x + 0.22, y + 0.22, 1.56, 1.56, b.level >= 7 ? '#ffa24a' : '#ff8a2f', 0.26);
    // hazard stripes on higher levels
    if (b.level >= 4) {
      ctx.save(); Render.roundRect(ctx, x + 0.22, y + 1.5, 1.56, 0.28, 0.1); ctx.clip();
      ctx.fillStyle = '#222';
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(x + 0.1 + i * 0.25, y + 1.78); ctx.lineTo(x + 0.25 + i * 0.25, y + 1.5); ctx.lineTo(x + 0.35 + i * 0.25, y + 1.5); ctx.lineTo(x + 0.2 + i * 0.25, y + 1.78); ctx.fill(); }
      ctx.restore();
    }
    // drill head
    ctx.save(); ctx.translate(x + 1, y + 0.95);
    ctx.fillStyle = '#2a2c31'; ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(working && !App.settings.reducedFx ? Draw.tm * (3 + b.level * 0.4) : 0);
    ctx.fillStyle = '#c9ced6';
    for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0.42, -0.12); ctx.lineTo(0.42, 0.12); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = R.color; ctx.beginPath(); ctx.arc(0, 0, 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // resource lamp
    const tier = R.tier;
    if (tier > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(Sprites.glow(DATA.TIERS[tier].color), x + 1.25, y + 0.05, 0.7, 0.7); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    ctx.fillStyle = DATA.TIERS[tier].color; ctx.beginPath(); ctx.arc(x + 1.6, y + 0.4, 0.11, 0, Math.PI * 2); ctx.fill();
    // output indicators
    if (b.outs && App.cam.zoom >= 18) for (const o of b.outs) Draw.arrow(ctx, o[0] - U.DX[o[2]] * 0.62 + 0.5 - Render.ox, o[1] - U.DY[o[2]] * 0.62 + 0.5 - Render.oy, o[2], 0.13, 'rgba(255,255,255,.75)');
    Draw.levelTag(ctx, b, x, y);
    if (working && b.made && !App.settings.reducedFx && Math.random() < 0.12 && App.quality !== 'low') {
      Render.spawn('dust', b.x + 1 + (Math.random() - 0.5) * 0.8, b.y + 1.2, (Math.random() - 0.5) * 0.6, -0.2 - Math.random() * 0.3, 0.9, Render.palette.particle, 0.08);
    }
  },

  node(ctx, g, b, x, y) {
    ctx.fillStyle = '#2b2f36'; ctx.fillRect(x + 0.05, y + 0.05, 0.9, 0.9);
    const def = DATA.BUILDINGS[b.type];
    Draw.body(ctx, x + 0.12, y + 0.12, 0.76, 0.76, def.color, 0.16);
    const c = x + 0.5, cy = y + 0.5;
    const white = 'rgba(255,255,255,.9)';
    if (b.type === 'crossing') {
      ctx.fillStyle = white; ctx.fillRect(c - 0.06, y + 0.18, 0.12, 0.64); ctx.fillRect(x + 0.18, cy - 0.06, 0.64, 0.12);
      return;
    }
    const f = b.rot, l = (b.rot + 3) & 3, r = (b.rot + 1) & 3;
    if (b.type === 'merger') {
      Draw.arrow(ctx, c + U.DX[f] * 0.22, cy + U.DY[f] * 0.22, f, 0.16, white);
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(c, cy, 0.1, 0, Math.PI * 2); ctx.fill();
      return;
    }
    Draw.arrow(ctx, c + U.DX[f] * 0.22, cy + U.DY[f] * 0.22, f, 0.14, white);
    const sideCol = b.type === 'osplitter' ? 'rgba(255,255,255,.45)' : white;
    Draw.arrow(ctx, c + U.DX[l] * 0.22, cy + U.DY[l] * 0.22, l, 0.12, sideCol);
    Draw.arrow(ctx, c + U.DX[r] * 0.22, cy + U.DY[r] * 0.22, r, 0.12, sideCol);
    if (b.type === 'fsplitter' && b.filter) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(c, cy, 0.16, 0, Math.PI * 2); ctx.fill();
      if (b.filter.kind === 'res') Draw.item(ctx, b.filter.res, 0, c, cy, 0.14);
      else { ctx.fillStyle = b.filter.kind === 'tier' ? DATA.TIERS[b.filter.tier].color : '#ffcf4a'; ctx.beginPath(); ctx.arc(c, cy, 0.1, 0, Math.PI * 2); ctx.fill(); }
    }
  },

  bridge(ctx, g, b, alpha) {
    const ex = b.x + U.DX[b.rot] * (b.len - 1), ey = b.y + U.DY[b.rot] * (b.len - 1);
    const ax = b.x + 0.5 - Render.ox, ay = b.y + 0.5 - Render.oy, bx = ex + 0.5 - Render.ox, by = ey + 0.5 - Render.oy;
    const def = DATA.BUILDINGS.bridge;
    for (const [px, py] of [[ax, ay], [bx, by]]) {
      Draw.shadow(ctx, px - 0.45, py - 0.45, 0.9, 0.9, 0.2);
      Draw.body(ctx, px - 0.45, py - 0.45, 0.9, 0.9, def.color, 0.2);
    }
    // arch
    const mx = (ax + bx) / 2 - (U.DY[b.rot] !== 0 ? 0.25 : 0), my = (ay + by) / 2 - 0.35;
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.55; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax + 0.1, ay + 0.2); ctx.quadraticCurveTo(mx + 0.1, my + 0.4, bx + 0.1, by + 0.2); ctx.stroke();
    ctx.strokeStyle = '#5a6488'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
    ctx.strokeStyle = def.color; ctx.lineWidth = 0.12;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
    Draw.arrow(ctx, bx, by, b.rot, 0.18, '#fff');
    // items riding over the bridge
    for (const q of b.queue) {
      const t = ((q.pt !== undefined ? q.pt + (q.t - q.pt) * alpha : q.t)) / Math.max(1, b.len - 1);
      const u = 1 - t;
      const px = u * u * ax + 2 * u * t * mx + t * t * bx, py = u * u * ay + 2 * u * t * my + t * t * by;
      Draw.item(ctx, q.it.res, q.it.ref, px, py, 0.2);
    }
  },

  silo(ctx, g, b, x, y) {
    const cx = x + b.w / 2, cy = y + b.h / 2;
    Draw.shadow(ctx, x + 0.1, y + 0.1, b.w - 0.2, b.h - 0.2, 0.5);
    Draw.body(ctx, x + 0.1, y + 0.1, b.w - 0.2, b.h - 0.2, '#3c4a5a', 0.4);
    ctx.fillStyle = '#6d8aa8'; ctx.beginPath(); ctx.arc(cx, cy, 1.25, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 0.06; ctx.strokeStyle = '#2a3644'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.arc(cx, cy, 0.95, 0, Math.PI * 2); ctx.stroke();
    // fill gauge
    const cap = Economy.siloCap(g, b);
    const f = U.clamp(b.total / Math.max(1, cap), 0, 1);
    ctx.lineWidth = 0.16; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(cx, cy, 1.1, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
    ctx.strokeStyle = f >= 1 ? '#ff6464' : f > 0.9 ? '#ffc24d' : '#63df74';
    if (f > 0) { ctx.beginPath(); ctx.arc(cx, cy, 1.1, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * f); ctx.stroke(); }
    // top content preview
    let best = -1, bc = 0;
    for (const [k, c] of b.store) if (c > bc) { bc = c; best = k; }
    ctx.fillStyle = '#2a3644'; ctx.beginPath(); ctx.arc(cx, cy, 0.55, 0, Math.PI * 2); ctx.fill();
    if (best >= 0) Draw.item(ctx, best >> 2, best & 3, cx, cy, 0.34);
    if (b.outEnabled) Draw.frontArrow(ctx, b, x, y);
    Draw.levelTag(ctx, b, x, y);
  },

  refinery(ctx, g, b, x, y) {
    const lvl = REFINERY_LEVEL[b.type];
    const def = DATA.BUILDINGS[b.type];
    Draw.shadow(ctx, x + 0.08, y + 0.08, b.w - 0.16, b.h - 0.16);
    Draw.body(ctx, x + 0.08, y + 0.08, b.w - 0.16, b.h - 0.16, '#24363a');
    Draw.body(ctx, x + 0.3, y + 0.3, b.w - 0.6, b.h - 0.6, def.color, 0.3);
    // tanks per level
    for (let i = 0; i < lvl; i++) {
      ctx.fillStyle = '#d8f4f0'; ctx.beginPath(); ctx.arc(x + 0.75 + i * 0.75, y + 0.75, 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = Col.shade(def.color, -0.4); ctx.lineWidth = 0.05; ctx.stroke();
    }
    // processing window
    const working = !!b.cur;
    const wx = x + b.w / 2, wy = y + b.h / 2 + 0.35;
    ctx.fillStyle = '#0d1a1c'; Render.roundRect(ctx, wx - 0.75, wy - 0.38, 1.5, 0.76, 0.15); ctx.fill();
    if (working) {
      ctx.fillStyle = Col.rgba(DATA.RESOURCES[b.cur.res].color, 0.35 + 0.25 * Math.sin(Draw.tm * 6));
      Render.roundRect(ctx, wx - 0.7, wy - 0.33, 1.4 * U.clamp(b.prog, 0, 1), 0.66, 0.12); ctx.fill();
      Draw.item(ctx, b.cur.res, b.cur.ref, wx, wy, 0.22);
      if (!App.settings.reducedFx && Math.random() < 0.15) Render.spawn('smoke', b.x + 0.75 + Math.random() * 0.2, b.y + 0.5, (Math.random() - 0.5) * 0.2, -0.6, 2.2, '#cfd8d8', 0.14);
    }
    // chimney
    ctx.fillStyle = '#18282a'; ctx.fillRect(x + b.w - 0.75, y + 0.35, 0.35, 0.35);
    Draw.frontArrow(ctx, b, x, y);
    Draw.levelTag(ctx, b, x, y);
  },

  lab(ctx, g, b, x, y) {
    const cx = x + 2, cy = y + 2;
    Draw.shadow(ctx, x + 0.1, y + 0.1, 3.8, 3.8, 0.6);
    Draw.body(ctx, x + 0.1, y + 0.1, 3.8, 3.8, '#56607a', 0.6);
    ctx.fillStyle = '#e6edf8'; ctx.beginPath(); ctx.arc(cx, cy, 1.45, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a96b0'; ctx.lineWidth = 0.06; ctx.stroke();
    ctx.strokeStyle = 'rgba(80,100,140,.35)'; ctx.lineWidth = 0.05;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, i * 0.36, 0, Math.PI * 2); ctx.stroke(); }
    const active = !!g.run.research.active;
    ctx.save(); ctx.translate(cx + 1.2, cy - 1.2); ctx.rotate(App.settings.reducedFx ? 0 : Draw.tm * 0.6);
    ctx.fillStyle = '#c8d4e8'; ctx.beginPath(); ctx.ellipse(0, 0, 0.45, 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#56607a'; ctx.fillRect(-0.04, -0.04, 0.5, 0.08);
    ctx.restore();
    if (active) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(Draw.tm * 3);
      ctx.drawImage(Sprites.glow('#7fd3ff'), cx - 1.2, cy - 1.2, 2.4, 2.4);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    Draw.levelTag(ctx, b, x, y);
  },

  path(ctx, g, b, x, y) {
    const col = b.level >= 2 ? '#c9b48a' : DATA.BUILDINGS.path.color;
    ctx.fillStyle = Col.shade(col, -0.25);
    const has = d => { const o = Grid.at(g, b.x + U.DX[d], b.y + U.DY[d]); return o && o.type === 'path'; };
    ctx.fillRect(x + 0.15, y + 0.15, 0.7, 0.7);
    if (has(0)) ctx.fillRect(x + 0.5, y + 0.15, 0.5, 0.7);
    if (has(2)) ctx.fillRect(x, y + 0.15, 0.5, 0.7);
    if (has(1)) ctx.fillRect(x + 0.15, y + 0.5, 0.7, 0.5);
    if (has(3)) ctx.fillRect(x + 0.15, y, 0.7, 0.5);
    ctx.fillStyle = col;
    for (let i = 0; i < 4; i++) { const px = x + 0.22 + (i % 2) * 0.32, py = y + 0.22 + (i >> 1) * 0.32; Render.roundRect(ctx, px, py, 0.26, 0.26, 0.06); ctx.fill(); }
  },
  fence(ctx, g, b, x, y) {
    const col = b.level >= 2 ? '#d0d6de' : DATA.BUILDINGS.fence.color;
    const has = d => { const o = Grid.at(g, b.x + U.DX[d], b.y + U.DY[d]); return o && o.type === 'fence'; };
    ctx.strokeStyle = col; ctx.lineWidth = 0.08; ctx.lineCap = 'round';
    ctx.beginPath();
    if (has(0)) { ctx.moveTo(x + 0.5, y + 0.45); ctx.lineTo(x + 1, y + 0.45); }
    if (has(2)) { ctx.moveTo(x, y + 0.45); ctx.lineTo(x + 0.5, y + 0.45); }
    if (has(1)) { ctx.moveTo(x + 0.5, y + 0.45); ctx.lineTo(x + 0.5, y + 1); }
    if (has(3)) { ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + 0.45); }
    ctx.stroke();
    ctx.fillStyle = Col.shade(col, -0.3); ctx.fillRect(x + 0.42, y + 0.3, 0.16, 0.3);
  },

  // ---------------- sellers ----------------
  seller(ctx, g, b, x, y) {
    const t = SELLER_TIER[b.type];
    const def = DATA.BUILDINGS[b.type];
    const tm = Draw.tm;
    if (t === 0) {
      Draw.shadow(ctx, x + 0.1, y + 0.1, b.w - 0.2, b.h - 0.2);
      Draw.body(ctx, x + 0.1, y + 0.4, b.w - 0.2, b.h - 0.5, '#6a4a2a', 0.15);
      // awning stripes
      const horiz = b.w >= b.h;
      ctx.save(); Render.roundRect(ctx, x + 0.05, y + 0.05, b.w - 0.1, horiz ? 0.75 : b.h - 0.1, 0.15); ctx.clip();
      const n = Math.ceil((horiz ? b.w : b.h) / 0.5);
      for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? '#fff3d6' : (b.level >= 3 ? '#d84fc0' : def.color); if (horiz) ctx.fillRect(x + i * 0.5, y, 0.5, 0.8); else ctx.fillRect(x, y + i * 0.5, b.w, 0.5); }
      ctx.restore();
      // goods on the counter
      let i = 0;
      for (const [k] of b.shelf) { if (i >= 4) break; Draw.item(ctx, k >> 2, k & 3, x + 0.55 + i * 0.6, y + b.h - 0.45, 0.18); i++; }
    } else if (t === 1) {
      Draw.shadow(ctx, x + 0.1, y + 0.1, b.w - 0.2, b.h - 0.2);
      Draw.body(ctx, x + 0.1, y + 0.1, b.w - 0.2, b.h - 0.2, '#b08a5a', 0.3);
      ctx.fillStyle = '#d8b880'; Render.roundRect(ctx, x + 0.5, y + 0.5, b.w - 1, b.h - 1, 0.2); ctx.fill();
      // tents
      for (let i = 0; i < 2; i++) {
        const tx = x + 0.9 + i * 1.6, ty = y + 0.9;
        ctx.fillStyle = i ? def.color : '#e05a3a';
        ctx.beginPath(); ctx.moveTo(tx, ty + 0.9); ctx.lineTo(tx + 0.6, ty); ctx.lineTo(tx + 1.2, ty + 0.9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(tx + 0.6, ty); ctx.lineTo(tx + 1.2, ty + 0.9); ctx.lineTo(tx + 0.6, ty + 0.9); ctx.closePath(); ctx.fill();
      }
      let i = 0;
      for (const [k] of b.shelf) { if (i >= 5) break; Draw.item(ctx, k >> 2, k & 3, x + 0.8 + i * 0.6, y + b.h - 0.75, 0.2); i++; }
    } else if (t === 5) {
      Draw.shadow(ctx, x + 0.2, y + 0.2, b.w - 0.4, b.h - 0.4, 0.6);
      Draw.body(ctx, x + 0.2, y + 0.2, b.w - 0.4, b.h - 0.4, '#2a1a34', 0.6);
      Draw.body(ctx, x + 1, y + 1, b.w - 2, b.h - 2, '#3e2850', 0.5);
      // holo screen
      const p = 0.6 + 0.2 * Math.sin(tm * 2);
      ctx.fillStyle = Col.rgba('#ff5fa8', 0.25 * p); Render.roundRect(ctx, x + 1.5, y + 1.5, b.w - 3, 2.2, 0.2); ctx.fill();
      ctx.strokeStyle = Col.rgba('#ff9fd0', 0.8); ctx.lineWidth = 0.06; ctx.stroke();
      ctx.fillStyle = '#ffd0ea'; ctx.font = '700 ' + Math.max(0.55, 12 / App.cam.zoom) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.run.contracts.length + ' Verträge', x + b.w / 2, y + 2.6);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#8a6aa8'; ctx.beginPath(); ctx.arc(x + 1.8 + i * 1.7, y + b.h - 1.4, 0.45, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = Col.rgba('#ff5fa8', 0.5 + 0.5 * Math.sin(tm * 3 + i)); ctx.beginPath(); ctx.arc(x + 1.8 + i * 1.7, y + b.h - 1.4, 0.15, 0, Math.PI * 2); ctx.fill(); }
    } else {
      // landing pads (shuttle / port / dock)
      const cx = x + b.w / 2, cy = y + b.h / 2, r = b.w / 2 - 0.3;
      Draw.shadow(ctx, x + 0.2, y + 0.2, b.w - 0.4, b.h - 0.4, 0.8);
      Draw.body(ctx, x + 0.15, y + 0.15, b.w - 0.3, b.h - 0.3, '#3a3f48', 0.8);
      ctx.fillStyle = '#545a66'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = def.color; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.arc(cx, cy, r - 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 0.22;
      const s = r * 0.35;
      ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.stroke();
      const nl = 8 + t * 2;
      for (let i = 0; i < nl; i++) {
        const a = i / nl * Math.PI * 2;
        const on = Math.floor(tm * 4) % nl === i;
        ctx.fillStyle = on ? '#fff6a0' : Col.shade(def.color, -0.2);
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (r - 0.05), cy + Math.sin(a) * (r - 0.05), 0.1 + (on ? 0.04 : 0), 0, Math.PI * 2); ctx.fill();
      }
      if (t >= 3) { // control tower and cranes
        Draw.body(ctx, x + 0.3, y + 0.3, 1.2, 1.2, '#6a6f7a', 0.2);
        ctx.fillStyle = '#9fe0ff'; ctx.fillRect(x + 0.5, y + 0.5, 0.8, 0.35);
      }
      if (t >= 4) {
        ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 0.25;
        ctx.beginPath(); ctx.moveTo(x + b.w - 0.6, y + 0.6); ctx.lineTo(x + b.w - 0.6, y + b.h - 0.6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + b.w - 0.6, y + 1.5 + Math.sin(tm * 0.6) * 2); ctx.lineTo(x + b.w - 3, y + 1.5 + Math.sin(tm * 0.6) * 2); ctx.stroke();
      }
      // shelf crates
      let i = 0;
      for (const [k] of b.shelf) { if (i >= 6) break; Draw.item(ctx, k >> 2, k & 3, x + 0.6 + (i % 3) * 0.55, y + b.h - 0.6 - Math.floor(i / 3) * 0.55, 0.2); i++; }
    }
    Draw.levelTag(ctx, b, x, y);
  },

  // Customers: aliens, caravans, shuttles, ships, freighters.
  slotPos(b, slot) {
    const tier = SELLER_TIER[b.type];
    if (tier === 0) return [b.x + 0.6 + slot * ((b.w - 1.2) / 2), b.y + b.h + 0.55];
    if (tier === 1) return [b.x + b.w / 2, b.y + b.h + 0.8];
    return [b.x + b.w / 2, b.y + b.h / 2];
  },
  customers(ctx, g, b) {
    const tm = Draw.tm;
    for (const c of b.customers) {
      const [px, py] = Draw.slotPos(b, c.slot % 3);
      let x, y, k = 1;
      if (c.state === 'in') { k = U.clamp(c.t / c.arrive, 0, 1); }
      else if (c.state === 'out') { k = 1 - U.clamp(c.t / 3, 0, 1); }
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      if (c.tier <= 1) { x = c.sx + (px - c.sx) * e; y = c.sy + (py - c.sy) * e; }
      else { x = px; y = py; }
      const rx = x - Render.ox, ry = y - Render.oy;
      if (c.tier === 0) Draw.alien(ctx, rx, ry, c, tm, c.state !== 'wait');
      else if (c.tier === 1) Draw.caravan(ctx, rx, ry, c, tm, Math.atan2(py - c.sy, px - c.sx) + (c.state === 'out' ? Math.PI : 0));
      else Draw.ship(ctx, rx, ry, c.tier, 1 - e, tm);
      if (c.state === 'wait' && App.cam.zoom >= 16) Draw.bubble(ctx, rx, ry - (c.tier === 0 ? 1.1 : c.tier === 1 ? 1.2 : b.h / 2 + 0.6), c);
    }
  },
  skinCache: null,
  planetSkins() {
    const P = Render.palette;
    if (Draw.skinCache && Draw.skinCache.k === P.index) return Draw.skinCache.list;
    const base = ['#7be07a', '#b07aff', '#4ad0d8', '#ff9a5a', '#e0d050', '#ff7ab0'];
    const rot = P.index - 1;
    const list = base.map((c, i) => Col.mix(base[(i + rot) % base.length], P.accent, 0.25 + (P.index % 3) * 0.08));
    Draw.skinCache = { k: P.index, list };
    return list;
  },
  alien(ctx, x, y, c, tm, walking) {
    const skins = Draw.planetSkins();
    const col = skins[c.skin % skins.length];
    const bob = walking ? Math.abs(Math.sin(tm * 9 + c.skin)) * 0.08 : Math.sin(tm * 2 + c.skin) * 0.02;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 0.05, 0.28, 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y - bob);
    // legs
    ctx.strokeStyle = Col.shade(col, -0.35); ctx.lineWidth = 0.08; ctx.lineCap = 'round';
    const sw = walking ? Math.sin(tm * 9 + c.skin) * 0.12 : 0;
    ctx.beginPath(); ctx.moveTo(-0.1, -0.2); ctx.lineTo(-0.1 + sw, 0); ctx.moveTo(0.1, -0.2); ctx.lineTo(0.1 - sw, 0); ctx.stroke();
    // body
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -0.42, 0.24, 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = Col.shade(col, -0.45); ctx.lineWidth = 0.04; ctx.stroke();
    // eyes
    const eyes = 1 + (c.skin % 3);
    for (let i = 0; i < eyes; i++) {
      const ex = (i - (eyes - 1) / 2) * 0.13;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, -0.5, 0.065, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex, -0.49, 0.032, 0, Math.PI * 2); ctx.fill();
    }
    // antennae
    ctx.strokeStyle = Col.shade(col, -0.3); ctx.lineWidth = 0.035;
    ctx.beginPath(); ctx.moveTo(-0.08, -0.7); ctx.lineTo(-0.15, -0.88); ctx.moveTo(0.08, -0.7); ctx.lineTo(0.15, -0.88); ctx.stroke();
    ctx.fillStyle = Col.shade(col, 0.3); ctx.beginPath(); ctx.arc(-0.15, -0.88, 0.04, 0, Math.PI * 2); ctx.arc(0.15, -0.88, 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
  caravan(ctx, x, y, c, tm, ang) {
    for (let i = 0; i < 3; i++) {
      const ox = x - Math.cos(ang) * i * 0.8, oy = y - Math.sin(ang) * i * 0.8;
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0.05, 0.1, 0.38, 0.24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i === 0 ? '#c86a3a' : '#a8884a';
      ctx.beginPath(); ctx.ellipse(0, 0, 0.36, 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.04; ctx.stroke();
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.05;
      const leg = Math.sin(tm * 12 + i) * 0.06;
      for (let s = -1; s <= 1; s += 2) for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(j * 0.15, s * 0.18); ctx.lineTo(j * 0.15 + leg * s, s * 0.32); ctx.stroke(); }
      if (i > 0) { ctx.fillStyle = '#e8d8a8'; ctx.fillRect(-0.18, -0.12, 0.3, 0.24); }
      ctx.restore();
    }
  },
  ship(ctx, x, y, tier, alt, tm) {
    const size = [0, 0, 1.6, 2.6, 4.0][tier] || 2;
    const sc = 1 + alt * 0.8;
    // shadow shrinks while landed
    ctx.fillStyle = 'rgba(0,0,0,' + (0.35 * (1 - alt * 0.6)).toFixed(2) + ')';
    ctx.beginPath(); ctx.ellipse(x + alt * 1.5, y + alt * 2, size * 0.7, size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y - alt * 3); ctx.scale(sc, sc);
    const body = tier === 2 ? '#e8e8f0' : tier === 3 ? '#c8d0e0' : '#9aa4b8';
    // engines glow
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(tm * 20);
    const gl = Sprites.glow('#7fd3ff');
    ctx.drawImage(gl, -size * 0.5, size * 0.25, size * 0.4, size * 0.6);
    ctx.drawImage(gl, size * 0.1, size * 0.25, size * 0.4, size * 0.6);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.6); ctx.lineTo(size * 0.32, -size * 0.1); ctx.lineTo(size * 0.6, size * 0.3); ctx.lineTo(size * 0.3, size * 0.4);
    ctx.lineTo(-size * 0.3, size * 0.4); ctx.lineTo(-size * 0.6, size * 0.3); ctx.lineTo(-size * 0.32, -size * 0.1); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = '#3a4050'; ctx.lineWidth = 0.06; ctx.stroke();
    ctx.fillStyle = tier === 4 ? '#ff9a3d' : Render.palette.accent; ctx.fillRect(-size * 0.25, size * 0.05, size * 0.5, size * 0.12);
    ctx.fillStyle = '#5ac8ff'; ctx.beginPath(); ctx.ellipse(0, -size * 0.22, size * 0.12, size * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    if (tier >= 4) { ctx.fillStyle = '#6a7488'; for (let i = 0; i < 3; i++) ctx.fillRect(-size * 0.2 + i * size * 0.14, size * 0.18, size * 0.1, size * 0.18); }
    ctx.restore();
  },
  bubble(ctx, x, y, c) {
    const w = c.wishes.find(w2 => w2.got < w2.qty) || c.wishes[0];
    if (!w) return;
    const s = Math.max(0.62, 26 / App.cam.zoom);
    const fs = Math.max(0.24, 12 / App.cam.zoom);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    Render.roundRect(ctx, x - s, y - s * 0.6, s * 2, s * 1.2, 0.18); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 0.1, y + s * 0.6); ctx.lineTo(x, y + s * 0.6 + 0.18); ctx.lineTo(x + 0.1, y + s * 0.6); ctx.fill();
    if (w.res >= 0) Draw.item(ctx, w.res, w.ref, x - s * 0.45, y, s * 0.32);
    else { ctx.fillStyle = DATA.TIERS[w.tier].color; ctx.beginPath(); ctx.arc(x - s * 0.45, y, s * 0.26, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#222'; ctx.font = '700 ' + fs + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', x - s * 0.45, y + 0.01); }
    ctx.fillStyle = '#222'; ctx.font = '700 ' + fs + 'px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(Fmt.num(w.qty - w.got), x - s * 0.15, y - s * 0.13);
    // patience bar
    const pf = U.clamp(1 - c.t / c.patience, 0, 1);
    ctx.fillStyle = '#ddd'; ctx.fillRect(x - s * 0.15, y + s * 0.2, s * 1.0, s * 0.13);
    ctx.fillStyle = pf > 0.35 ? '#3ab54a' : '#e04a3a'; ctx.fillRect(x - s * 0.15, y + s * 0.2, s * 1.0 * pf, s * 0.13);
    if (c.buying > 0) { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x + s * 0.8, y - s * 0.45, 0.1, 0, Math.PI * 2); ctx.fill(); }
  },

  // ---------------- astronaut ----------------
  astronaut(ctx, g, x, y, tm) {
    const p = g.run.player;
    const moving = p.moving;
    const rover = g.run.research.done.has('rover') && moving;
    const face = p.face;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 0.05, rover ? 0.7 : 0.35, rover ? 0.25 : 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y);
    if (rover) {
      ctx.save(); ctx.scale(face, 1);
      ctx.fillStyle = '#d8dde6'; Render.roundRect(ctx, -0.65, -0.45, 1.3, 0.4, 0.12); ctx.fill();
      ctx.strokeStyle = '#4a5060'; ctx.lineWidth = 0.05; ctx.stroke();
      ctx.fillStyle = Render.palette.accent; ctx.fillRect(-0.6, -0.32, 1.2, 0.08);
      ctx.fillStyle = '#2a2d33';
      for (const wx of [-0.42, 0.42]) { ctx.beginPath(); ctx.arc(wx, -0.05, 0.17, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      ctx.translate(0, -0.35);
    }
    const bob = moving && !rover ? Math.abs(Math.sin(tm * 10)) * 0.06 : Math.sin(tm * 2) * 0.015;
    ctx.translate(0, -bob);
    ctx.scale(face, 1);
    const sw = moving && !rover ? Math.sin(tm * 10) * 0.14 : 0;
    // legs
    ctx.strokeStyle = '#c8ccd4'; ctx.lineWidth = 0.13; ctx.lineCap = 'round';
    if (!rover) { ctx.beginPath(); ctx.moveTo(-0.08, -0.3); ctx.lineTo(-0.08 + sw, -0.03); ctx.moveTo(0.1, -0.3); ctx.lineTo(0.1 - sw, -0.03); ctx.stroke(); }
    // backpack
    ctx.fillStyle = '#9aa0aa'; Render.roundRect(ctx, -0.3, -0.72, 0.18, 0.42, 0.06); ctx.fill();
    // body
    ctx.fillStyle = '#f2f4f7'; Render.roundRect(ctx, -0.2, -0.7, 0.4, 0.46, 0.14); ctx.fill();
    ctx.strokeStyle = '#8a909a'; ctx.lineWidth = 0.035; ctx.stroke();
    ctx.fillStyle = Render.palette.accent; ctx.fillRect(-0.14, -0.55, 0.12, 0.08);
    // arm
    ctx.strokeStyle = '#e4e7ec'; ctx.lineWidth = 0.1;
    ctx.beginPath(); ctx.moveTo(0.05, -0.6); ctx.lineTo(0.12 - sw * 0.6, -0.38); ctx.stroke();
    // helmet
    ctx.fillStyle = '#f7f8fa'; ctx.beginPath(); ctx.arc(0.02, -0.88, 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a909a'; ctx.lineWidth = 0.035; ctx.stroke();
    const vg = ctx.createLinearGradient(0, -1, 0.2, -0.75);
    vg.addColorStop(0, '#ffd08a'); vg.addColorStop(1, '#ff7a2a');
    ctx.fillStyle = vg; ctx.beginPath(); ctx.ellipse(0.08, -0.88, 0.13, 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(0.04, -0.92, 0.03, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // jetpack particles
    if (moving && !rover && !App.settings.reducedFx && Math.random() < 0.6) {
      Render.spawn('jet', g.run.player.x - face * 0.22, g.run.player.y - 0.35, -p.vx * 0.05 + (Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.4, 0.35, '#ffb04a', 0.06);
    }
  },

  // Thumbnail for UI (build cards, info panel).
  thumbCache: new Map(),
  thumb(type, size = 56, opts = {}) {
    const key = type + '|' + size + '|' + (opts.grade || 0) + '|' + (opts.res === undefined ? '' : opts.res);
    const d = Math.min(2, window.devicePixelRatio || 1);
    let src = Draw.thumbCache.get(key);
    if (!src) {
      src = document.createElement('canvas');
      src.width = src.height = Math.round(size * d);
      const ctx = src.getContext('2d');
      const def = DATA.BUILDINGS[type];
      const w = type === 'bridge' ? 3 : def.w, hh = def.h;
      const scale = size * d / (Math.max(w, hh) + 0.6);
      ctx.setTransform(scale, 0, 0, scale, (size * d - w * scale) / 2, (size * d - hh * scale) / 2);
      const fake = { _thumb: true, type, x: 0, y: 0, rot: 0, w, h: hh, level: 1, grade: opts.grade || 0, items: [], buf: [], inBuf: [], outBuf: [], shelf: new Map(), store: new Map(), total: 0, customers: [], res: opts.res !== undefined ? opts.res : 0, tier: opts.res !== undefined ? DATA.RESOURCES[opts.res].tier : 0, outMask: 15, boost: 1, len: 3, queue: [], outEnabled: true, _sv: -1, shape: 0 };
      const saveOx = Render.ox, saveOy = Render.oy, saveZoom = App.cam.zoom;
      Render.ox = 0; Render.oy = 0; App.cam.zoom = 40;
      const fakeG = { topoVersion: -2, run: { research: { active: null }, contracts: [] }, mods: { siloCap: 1 } };
      try {
        if (type === 'bridge') { fake.rot = 0; Draw.bridge(ctx, { topoVersion: 0 }, fake, 0); }
        else if (type === 'belt') { fake._sv = -2; Draw.belt(ctx, fakeG, fake, 0, 0); }
        else Draw.building(ctx, fakeG, fake, 0, 0);
      } catch (e) { ctx.fillStyle = def.color; ctx.fillRect(0, 0, w, hh); }
      Render.ox = saveOx; Render.oy = saveOy; App.cam.zoom = saveZoom;
      Draw.thumbCache.set(key, src);
    }
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }
};
