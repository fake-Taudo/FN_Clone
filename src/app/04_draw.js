// =====================================================================
// Draw: facade used by the frame renderer and the UI. Static bodies come
// from BuildingArt sprites, belts from BeltArt, figures from CharArt;
// this file adds the per-frame animation (state machines, crossfades).
// =====================================================================
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const GRADE_COLORS = ['#8b939c', '#f2c84b', '#4aa8ff', '#ff4fd8'];

const Draw = {
  tm: 0, dt: 0.016, _tw: [],
  bubbles: [], // queued speech bubbles (drawn as UI after the night grade)
  flushBubbles(ctx) {
    const B = Draw.bubbles;
    for (let i = 0; i < B.length; i += 3) CharArt.bubble(ctx, B[i], B[i + 1], B[i + 2], Draw.tm);
    B.length = 0;
  },
  arrow(ctx, cx, cy, dir, s, color) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(dir * Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.6, -s * 0.75); ctx.lineTo(-s * 0.25, 0); ctx.lineTo(-s * 0.6, s * 0.75); ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.save(); ctx.translate(s * 0.08, s * 0.1); ctx.fill(); ctx.restore();
    ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  },
  // level pill: UI overlay (not part of any texture)
  levelTag(ctx, b) {
    if (b.level <= 1 || App.cam.zoom < 20) return;
    const x = b.x - Render.ox, y = b.y - Render.oy;
    const fs = Math.max(0.24, 11 / App.cam.zoom), s = fs * 1.35;
    const txt = ROMAN[b.level];
    ctx.font = '800 ' + fs + 'px system-ui';
    const tw = (Draw._tw[b.level] || (Draw._tw[b.level] = ctx.measureText(txt).width / fs)) * fs + fs * 0.7;
    const vt = VT(b.level);
    ctx.fillStyle = ['rgba(20,22,28,.78)', 'rgba(30,40,56,.82)', 'rgba(40,32,16,.85)', 'rgba(60,46,10,.9)'][vt];
    Art.rrect(ctx, x + 0.08, y + b.h - s - 0.06, tw, s, s / 2); ctx.fill();
    ctx.strokeStyle = ['rgba(255,255,255,.25)', '#7fb0e0', '#c99d48', '#f2c14b'][vt]; ctx.lineWidth = fs * 0.08; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x + 0.08 + tw / 2, y + b.h - s / 2 - 0.05);
  },
  frontArrow(ctx, b, x, y) {
    const p = Grid.frontPort(b);
    const ax = p[0] - U.DX[b.rot] * 0.62 - Render.ox + 0.5 - (b.x - Render.ox - x);
    const ay = p[1] - U.DY[b.rot] * 0.62 - Render.oy + 0.5 - (b.y - Render.oy - y);
    Draw.arrow(ctx, ax, ay - 0.12, b.rot, 0.17, 'rgba(255,255,255,.92)');
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
    b.shape = back || (left && right) || (!left && !right) ? 0 : left ? 1 : 2;
    return b.shape;
  },
  beltsBatch(ctx, g, list) { BeltArt.draw(ctx, g, list, Draw.tm); },
  belt(ctx, g, b, x, y) {
    const ppt = Art.bucket(Render.ppt(), 128);
    const shape = Draw.beltShape(g, b);
    const s = BeltArt.sprite(b.grade || 0, shape, b.rot, shape === 0 ? (b.id < 0 ? 3 : BeltArt.topo(g, b)) : 0, BeltArt.frameOf(b.grade || 0, CONFIG.belt.speed[b.grade || 0], Draw.tm), ppt);
    const M = BeltArt.M;
    ctx.drawImage(s, x - M, y - M, 1 + M * 2, 1 + M * 2);
  },
  itemPos(b, it, alpha) { const o = [0, 0, 0, 0]; BeltArt.itemPos(App.g, b, it, alpha, o); return o; },
  // item centred at x,y with half extent s (tiles)
  item(ctx, res, ref, x, y, s) {
    const m = ctx.getTransform();
    const scale = Math.hypot(m.a, m.b) || 1;
    const px = ItemArt.sizeFor(s * 2 * scale);
    const fr = DATA.RESOURCES[res].tier === 7 ? Math.floor(Draw.tm * 2) & 7 : 0;
    ctx.drawImage(ItemArt.sprite(res, ref, px, 0, fr), x - s, y - s, s * 2, s * 2);
  },

  // ---------------- buildings ----------------
  building(ctx, g, b, x, y) {
    if (b.type === 'belt') return Draw.belt(ctx, g, b, x, y);
    if (b.type === 'bridge') return;
    const now = App.now, fx = !App.settings.reducedFx;
    const vt = VT(b.level || 1);
    if (b.id >= 0) {
      if (b._lv === undefined) b._lv = b.level;
      else if (b._lv !== b.level) {
        const ov = VT(b._lv);
        if (ov !== vt) b._xf = { from: ov, at: now };
        if (b.level > b._lv) { b._up = now; Draw.upgradeFx(b); }
        b._lv = b.level;
      }
    }
    const extra = Draw.extraKey(g, b);
    let scaled = false;
    if (b._pop && fx) {
      const k = (now - b._pop) / 220;
      if (k >= 1) b._pop = 0;
      else {
        const s = k < 0.5 ? 0.9 + 0.16 * Art.ease.outCubic(k / 0.5) : 1.06 - 0.06 * Art.ease.inOutQuad((k - 0.5) / 0.5);
        ctx.save(); scaled = true;
        ctx.translate(x + b.w / 2, y + b.h); ctx.scale(s, s); ctx.translate(-x - b.w / 2, -y - b.h);
      }
    }
    // vibration of running extractors
    let jx = 0, jy = 0;
    if (b.type === 'extractor' && fx && b._spin > 0.5 && App.cam.zoom >= 16) { jx = Math.sin(now * 0.07 + b.id) * 0.01 * b._spin; jy = Math.cos(now * 0.09 + b.id * 3) * 0.006 * b._spin; }
    if (b._xf && fx) {
      const k = (now - b._xf.at) / 250;
      if (k >= 1) { b._xf = null; BuildingArt.drawBody(ctx, b, x + jx, y + jy, vt, extra); }
      else { BuildingArt.drawBody(ctx, b, x + jx, y + jy, b._xf.from, extra, 1 - k); BuildingArt.drawBody(ctx, b, x + jx, y + jy, vt, extra, k); }
    } else BuildingArt.drawBody(ctx, b, x + jx, y + jy, vt, extra);
    const D = Draw.D[b.type] || (REFINERY_LEVEL[b.type] ? Draw.D.refinery : null);
    if (D && (App.cam.zoom >= 13 || b.id < 0)) D(ctx, g, b, x + jx, y + jy, Draw.tm, vt);
    // upgrade glow pulse
    if (b._up && fx) {
      const k = (now - b._up) / 600;
      if (k >= 1) b._up = 0;
      else {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - k) * 0.7;
        const r = Math.max(b.w, b.h) * (1.1 + k * 0.6);
        ctx.drawImage(FxLib.tinted('soft', 0, '#fff2c0'), x + b.w / 2 - r, y + b.h / 2 - r * 1.1, r * 2, r * 2);
        ctx.restore();
      }
    }
    if (scaled) ctx.restore();
  },
  extraKey(g, b) {
    if (b.type === 'path' || b.type === 'fence') {
      if (b.id < 0) return '0';
      if (b._mv !== g.topoVersion) {
        b._mv = g.topoVersion;
        let m = 0;
        for (let d = 0; d < 4; d++) { const o = Grid.at(g, b.x + U.DX[d], b.y + U.DY[d]); if (o && o.type === b.type) m |= 1 << d; }
        b._mask = m;
      }
      return String(b._mask);
    }
    if (b.type === 'lamp' || b.type === 'plant') return String(Math.min(3, b.level || 1));
    return '';
  },
  upgradeFx(b) {
    if (App.settings.reducedFx) return;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    Render.ring(cx, cy, Math.max(b.w, b.h) * 0.9, '#ffe9a0', 0.6);
    for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 2.5; Render.spawn('spark', cx + Math.cos(a) * b.w * 0.3, cy + Math.sin(a) * b.h * 0.3, Math.cos(a) * v, Math.sin(a) * v - 1, 0.6 + Math.random() * 0.4, '#ffd27a', 0.12); }
  },
  approach(v, target, rate) { return v < target ? Math.min(target, v + rate) : Math.max(target, v - rate); },
  glowAt(ctx, x, y, r, color, a) {
    if (a <= 0.01) return;
    const ga = ctx.globalAlpha, op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * Math.min(1, a);
    ctx.drawImage(FxLib.tinted('soft', 0, color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = ga; ctx.globalCompositeOperation = op;
  },
  shelfItems(ctx, b, pts, s) {
    if (!b.shelf) return;
    let i = 0;
    for (const [k] of b.shelf) { if (i >= pts.length) break; Draw.item(ctx, k >> 2, k & 3, pts[i][0], pts[i][1], s); i++; }
  },

  // ---------------- per-type animation overlays ----------------
  D: {
    extractor(ctx, g, b, x, y, tm, vt) {
      const G = BuildingArt.GEO.extractor(vt);
      const working = b.id >= 0 && !(b.buf && b.buf.length >= CONFIG.maxItemsPerBuffer) && !(b.outs && !b.outs.length);
      // state machine: off -> spin-up (0.6 s) -> running -> blocked -> spin-down
      b._spin = Draw.approach(b._spin || 0, working ? 1 : 0, Draw.dt / 0.6);
      if (!App.settings.reducedFx) b._ang = ((b._ang || 0) + Draw.dt * b._spin * (5 + b.level * 0.5)) % (Math.PI * 2);
      const ppt = Art.bucket(Render.ppt(), 128);
      const [px, py] = G.pit;
      ctx.save(); ctx.translate(x + px, y + py); ctx.scale(1, 0.6); ctx.rotate(b._ang || 0);
      ctx.drawImage(BuildingArt.bitSprite(vt, ppt), -0.46, -0.46, 0.92, 0.92);
      ctx.restore();
      // kelly hub
      ctx.fillStyle = '#3a3f48'; ctx.beginPath(); ctx.ellipse(x + px, y + py - 0.02, 0.07, 0.045, 0, 0, Math.PI * 2); ctx.fill();
      // resource window
      const R = b.res !== undefined ? DATA.RESOURCES[b.res] : null;
      if (R) {
        const [wx, wy, ww, wh] = G.win;
        if (R.tier > 0) Draw.glowAt(ctx, x + wx + ww / 2, y + wy + wh / 2, 0.45, R.tier === 7 ? Col.prism(tm, 0) : DATA.TIERS[R.tier].color, 0.55);
        Draw.item(ctx, b.res, 0, x + wx + ww / 2, y + wy + wh / 2 + 0.01, Math.min(ww, wh) * 0.62);
        ctx.fillStyle = 'rgba(200,235,255,.16)'; ctx.fillRect(x + wx, y + wy, ww * 0.35, wh);
      }
      // status lamp
      const [lx, ly] = G.lamp;
      const red = b.warn === 'nocon', amber = b.warn === 'blocked' || (b.id >= 0 && !working);
      const blink = (red || amber) ? (Math.floor(tm * 3) & 1) : 1;
      const col = red ? '#ff4a3a' : amber ? '#ffc24d' : '#5aff7a';
      ctx.fillStyle = blink ? col : Col.shade(col, -0.6); ctx.beginPath(); ctx.arc(x + lx, y + ly - 0.04, 0.06, 0, Math.PI * 2); ctx.fill();
      if (blink) Draw.glowAt(ctx, x + lx, y + ly - 0.04, 0.22, col, 0.7);
      if (vt === 3 && (Math.floor(tm * 1.5) & 1)) Draw.glowAt(ctx, x + 1.75, y + G.ty - 0.45, 0.15, '#7fe8ff', 0.9);
      // dust from the drill
      if (working && b.made && !App.settings.reducedFx && App.quality !== 'low' && Math.random() < 0.14 * b._spin) Render.spawn('dust', b.x + px + (Math.random() - 0.5) * 0.7, b.y + py, (Math.random() - 0.5) * 0.8, -0.25 - Math.random() * 0.3, 0.9, Render.palette.particle, 0.09);
      // output indicators
      if (b.outs && App.cam.zoom >= 18) for (const o of b.outs) Draw.arrow(ctx, o[0] - U.DX[o[2]] * 0.62 + 0.5 - Render.ox, o[1] - U.DY[o[2]] * 0.62 + 0.5 - Render.oy, o[2], 0.12, 'rgba(255,255,255,.8)');
    },
    silo(ctx, g, b, x, y, tm, vt) {
      const G = BuildingArt.GEO.silo(vt);
      const cap = g.mods ? Economy.siloCap(g, b) : 1;
      const f = U.clamp((b.total || 0) / Math.max(1, cap), 0, 1);
      b._fv = b._fv === undefined ? f : b._fv + (f - b._fv) * Math.min(1, Draw.dt * 4);
      let best = -1, bc = 0;
      if (b.store) for (const [k, c] of b.store) if (c > bc) { bc = c; best = k; }
      const [wx, wy, ww, wh] = G.win;
      if (b._fv > 0.002 && best >= 0) {
        const col = DATA.RESOURCES[best >> 2].color;
        const top = y + wy + wh * (1 - b._fv);
        ctx.save(); Art.rrect(ctx, x + wx, y + wy, ww, wh, 0.05); ctx.clip();
        const gr = ctx.createLinearGradient(0, top, 0, y + wy + wh); gr.addColorStop(0, Col.shade(col, 0.25)); gr.addColorStop(1, Col.shade(col, -0.3));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x + wx, top);
        for (let i = 0; i <= 6; i++) ctx.lineTo(x + wx + ww * i / 6, top + Math.sin(tm * 3 + i * 1.3) * 0.02);
        ctx.lineTo(x + wx + ww, y + wy + wh); ctx.lineTo(x + wx, y + wy + wh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x + wx, top - 0.01, ww, 0.025);
        ctx.restore();
        Draw.item(ctx, best >> 2, best & 3, x + G.cx, y + wy - 0.2, 0.2);
      }
      ctx.fillStyle = 'rgba(200,235,255,.18)'; ctx.fillRect(x + wx + 0.02, y + wy, 0.05, wh);
      // inflow pulse at the top hatch
      if (b.id >= 0) {
        if (b._lt !== undefined && b.total > b._lt) b._pulse = 1;
        b._lt = b.total;
        if (b._pulse > 0) { Draw.glowAt(ctx, x + G.cx, y + G.top - 0.45, 0.45, '#bfe8ff', b._pulse * 0.6); b._pulse = Math.max(0, b._pulse - Draw.dt * 3); }
      }
      const lampCol = f >= 1 ? '#ff4a3a' : f > 0.9 ? '#ffc24d' : '#5aff7a';
      const on = f >= 1 ? (Math.floor(tm * 3) & 1) : 1;
      ctx.fillStyle = on ? lampCol : Col.shade(lampCol, -0.6); ctx.beginPath(); ctx.arc(x + G.cx, y + wy + wh + 0.14, 0.05, 0, Math.PI * 2); ctx.fill();
      if (on) Draw.glowAt(ctx, x + G.cx, y + wy + wh + 0.14, 0.18, lampCol, 0.6);
      if (b.outEnabled) Draw.frontArrow(ctx, b, x, y);
    },
    refinery(ctx, g, b, x, y, tm, vt) {
      const lvl = REFINERY_LEVEL[b.type];
      const G = BuildingArt.GEO.refinery(lvl, vt);
      const [sx, sy, sw, sh] = G.sky;
      const working = !!b.cur;
      b._heat = Draw.approach(b._heat || 0, working ? 1 : 0, Draw.dt / 0.8);
      if (b._heat > 0.01) {
        const col = b.cur ? DATA.RESOURCES[b.cur.res].color : (b._hc || '#ff9a4a');
        if (b.cur) b._hc = col;
        const pul = 0.75 + 0.25 * Math.sin(tm * 6 + b.id);
        ctx.save(); Art.rrect(ctx, x + sx, y + sy, sw, sh, 0.08); ctx.clip();
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = b._heat * pul * 0.85;
        ctx.drawImage(FxLib.tinted('soft', 0, Col.mix(col, '#ff8a3a', 0.35)), x + sx - 0.3, y + sy - 0.4, sw + 0.6, sh + 0.8);
        ctx.globalAlpha = b._heat * 0.9;
        ctx.fillStyle = Col.rgba(Col.shade(col, 0.4), 0.55); ctx.fillRect(x + sx, y + sy + sh - 0.1, sw * U.clamp(b.prog || 0, 0, 1), 0.1);
        ctx.restore();
        if (b.cur) Draw.item(ctx, b.cur.res, b.cur.ref, x + sx + sw / 2, y + sy + sh / 2 - 0.04, 0.26);
      }
      // steam synced with processing, output puff on completion
      if (!App.settings.reducedFx && b.id >= 0) {
        if (working && Math.random() < 0.12 * b._heat) for (const [cx, cy] of G.chim) Render.spawn('steam', b.x + cx + (Math.random() - 0.5) * 0.08, b.y + cy, (Math.random() - 0.5) * 0.2 + 0.15, -0.7 - Math.random() * 0.3, 2.2, '#e6eef0', 0.16);
        if (b._lm !== undefined && b.made > b._lm) {
          const p = Grid.frontPort(b);
          Render.spawn('ring', p[0] + 0.5 - U.DX[b.rot] * 0.5, p[1] + 0.5 - U.DY[b.rot] * 0.5, 0, 0, 0.35, DATA.BUILDINGS[b.type].color, 0.3);
          Render.spawn('steam', p[0] + 0.5 - U.DX[b.rot] * 0.5, p[1] + 0.3 - U.DY[b.rot] * 0.5, 0, -0.5, 0.8, '#f0f6f8', 0.14);
        }
        b._lm = b.made;
      }
      if (lvl === 3) Draw.glowAt(ctx, x + 1.35, y + 0.78 - BA_E - 0.7, 0.8, '#8a9aff', 0.25 + 0.2 * Math.sin(tm * 2.5));
      Draw.frontArrow(ctx, b, x, y);
    },
    cooler(ctx, g, b, x, y, tm, vt) {
      const G = BuildingArt.GEO.cooler(vt);
      if (!App.settings.reducedFx && b.id >= 0 && Math.random() < 0.18) Render.spawn('steam', b.x + G.cx + (Math.random() - 0.5) * 0.5, b.y + G.cy - G.hv, (Math.random() - 0.5) * 0.2, -0.8 - Math.random() * 0.4, 2.6, '#f0f8ff', 0.22);
      Draw.glowAt(ctx, x + G.cx, y + G.cy - G.hv, 0.45, '#bfe8ff', 0.15 + 0.1 * Math.sin(tm * 2));
    },
    servo(ctx, g, b, x, y, tm, vt) {
      const G = BuildingArt.GEO.servo(), ppt = Art.bucket(Render.ppt() * 1.5, 128);
      ctx.save(); ctx.translate(x + G.cx, y + G.cy); ctx.scale(1, 0.62); ctx.rotate(App.settings.reducedFx ? 0 : tm * 1.2 + b.id);
      ctx.drawImage(BuildingArt.gearSprite(vt, ppt), -0.75, -0.75, 1.5, 1.5);
      ctx.restore();
    },
    charger(ctx, g, b, x, y, tm, vt) {
      const G = BuildingArt.GEO.charger(vt);
      const pul = 0.5 + 0.5 * Math.sin(tm * 3 + b.id);
      Draw.glowAt(ctx, x + G.rod[0], y + G.rod[1], 0.5 + pul * 0.2, '#9bf06a', 0.4 + pul * 0.4);
      if (App.settings.reducedFx) return;
      const k = Math.floor(tm * 12 + b.id) % 6;
      if (k < 3) {
        const [cx, cy] = G.coils[k];
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const dx = G.rod[0] - cx, dy = G.rod[1] - cy, len = Math.hypot(dx, dy);
        ctx.translate(x + cx, y + cy); ctx.rotate(Math.atan2(dy, dx));
        ctx.drawImage(FxLib.tinted('bolt', Math.floor(tm * 20) % 3, '#c8ffb0'), 0, -0.15, len, 0.3);
        ctx.restore();
      }
    },
    lab(ctx, g, b, x, y, tm, vt) {
      const G = BuildingArt.GEO.lab(vt);
      const active = g.run && g.run.research && !!g.run.research.active;
      // turning dish on its mast
      const a = App.settings.reducedFx ? 0.6 : tm * 0.5 + b.id;
      const ppt = Art.bucket(Render.ppt() * 1.2, 96);
      ctx.save(); ctx.translate(x + G.dish[0], y + G.dish[1]); ctx.scale(0.35 + 0.65 * Math.abs(Math.cos(a)), 1);
      ctx.drawImage(BuildingArt.dishSprite(ppt), -0.6, -0.6, 1.2, 1.2);
      ctx.restore();
      if (active) {
        // holographic atom above the dome
        const [hx, hy] = G.holo;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(127,211,255,.75)'; ctx.lineWidth = 0.03;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + hx, y + hy, 0.42, 0.14, tm * 0.8 + i * Math.PI / 3, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
        Draw.glowAt(ctx, x + hx, y + hy, 0.3, '#bfe8ff', 0.8 + 0.2 * Math.sin(tm * 5));
        for (let i = 0; i < 3; i++) { const e = tm * 2.4 + i * 2.1; Draw.glowAt(ctx, x + hx + Math.cos(e) * 0.42, y + hy + Math.sin(e) * 0.14, 0.08, '#ffffff', 0.9); }
        // lit windows
        const fy0 = G.by + 2.1 - G.bh * Art.V;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,220,150,' + (0.35 + 0.1 * Math.sin(tm * 3)).toFixed(2) + ')';
        for (let i = 0; i < 6; i++) ctx.fillRect(x + 0.55 + i * 0.5, y + fy0 + 0.12, 0.3, 0.26);
        ctx.restore();
      }
    },
    bazaar(ctx, g, b, x, y, tm, vt) {
      const W = b.w, H = b.h;
      const cy = y + H - 0.72 - BA_E - 0.55 * Art.V + 0.18;
      const pts = []; for (let i = 0; i < 4; i++) pts.push([x + 0.45 + i * ((W - 0.9) / 3), cy]);
      Draw.shelfItems(ctx, b, pts, 0.2);
      const n = Math.max(5, Math.round(W * 2.5));
      const ayF = H * 0.52 - 0.6;
      const night = Render.night || 0;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, bx = x + 0.14 + (W - 0.28) * u, by = y + ayF + 0.15 + Math.sin(u * Math.PI) * 0.18;
        const on = 0.6 + 0.4 * Math.sin(tm * 3 + i * 1.7);
        ctx.fillStyle = ['#ffd27a', '#ff8ad8', '#8ae0ff'][i % 3]; ctx.beginPath(); ctx.arc(bx, by + 0.03, 0.035, 0, Math.PI * 2); ctx.fill();
        Draw.glowAt(ctx, bx, by + 0.03, 0.14, ['#ffd27a', '#ff8ad8', '#8ae0ff'][i % 3], (0.25 + night * 0.75) * on);
      }
    },
    caravan(ctx, g, b, x, y, tm, vt) {
      const W = b.w, H = b.h;
      for (const px of [0.2, W - 0.2]) {
        const w = Math.sin(tm * 5 + px) * 0.06;
        ctx.fillStyle = px < 1 ? '#e05a3a' : Render.palette.accent;
        ctx.beginPath(); ctx.moveTo(x + px, y + 0.2 - 1.25); ctx.quadraticCurveTo(x + px + 0.25, y + 0.2 - 1.2 + w, x + px + 0.5, y + 0.2 - 1.12 + w * 1.5); ctx.lineTo(x + px, y + 0.2 - 0.95); ctx.closePath(); ctx.fill();
      }
      const ty = y + H - 1.05 - 0.35 * Art.V + 0.22;
      const pts = []; for (let i = 0; i < 5; i++) pts.push([x + W / 2 - 0.55 + i * 0.275, ty - (i % 2) * 0.05]);
      Draw.shelfItems(ctx, b, pts, 0.17);
    },
    shuttlepad(ctx, g, b, x, y, tm, vt) {
      const W = b.w, H = b.h, ty = 0.01, y1 = H - 0.23;
      const pts = [[0.42, ty + 0.3], [W - 0.42, ty + 0.3], [W - 0.42, y1 - 0.3], [0.42, y1 - 0.3]];
      const k = Math.floor(tm * 4) % 4;
      pts.forEach(([lx, ly], i) => { const on = i === k; ctx.fillStyle = on ? '#ff8a7a' : '#7a2a24'; ctx.beginPath(); ctx.arc(x + lx, y + ly, 0.07, 0, Math.PI * 2); ctx.fill(); if (on) Draw.glowAt(ctx, x + lx, y + ly, 0.35, '#ff6a5a', 0.9); });
      Draw.shelfItems(ctx, b, [[x + 0.9, y + H - 0.75], [x + 1.35, y + H - 0.75], [x + 1.8, y + H - 0.75], [x + 0.9, y + H - 1.15], [x + 1.35, y + H - 1.15], [x + 1.8, y + H - 1.15]], 0.18);
    },
    port(ctx, g, b, x, y, tm, vt) {
      const W = b.w, H = b.h;
      for (const [i, cxm] of [[0, 0.55], [1, W - 0.55]]) {
        const a = Math.sin(tm * 0.4 + i * 2) * 0.9 + (i ? Math.PI : 0);
        const mx = x + cxm, my = y + H - 0.7 - BA_E - 2.1;
        const L = 2.0;
        ctx.strokeStyle = '#8a6a1a'; ctx.lineWidth = 0.14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a) * L, my + Math.sin(a) * L * 0.45); ctx.stroke();
        ctx.strokeStyle = '#f0b43a'; ctx.lineWidth = 0.09; ctx.stroke();
        const ex = mx + Math.cos(a) * L * 0.85, ey = my + Math.sin(a) * L * 0.45 * 0.85;
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex, ey + 1.0); ctx.stroke();
        Art.box(ctx, ex - 0.15, ey + 1.0, 0.3, 0.2, 0.2, Art.tones(i ? '#3a7ad8' : '#d8503a'), { r: 0.02, lw: 0.02 });
      }
      const tY = y + 1.05 - BA_E - (2.6 + vt * 0.25) * Art.V - 0.7;
      if (Math.floor(tm * 1.5) & 1) Draw.glowAt(ctx, x + W / 2, tY, 0.3, '#ff5a5a', 0.95);
      Draw.shelfItems(ctx, b, [[x + 2.8, y + 2.0], [x + 3.25, y + 2.05], [x + 3.7, y + 2.0], [x + 4.15, y + 2.05]], 0.18);
    },
    dock(ctx, g, b, x, y, tm, vt) {
      const W = b.w, H = b.h;
      const gh = 3.0 + vt * 0.2, beamY = y + BuildingArt.GEO.dockGantryY - BA_E - gh * Art.V;
      const tx = x + W / 2 + Math.sin(tm * 0.35 + b.id) * (W / 2 - 1.6);
      Art.box(ctx, tx - 0.35, beamY - 0.06, 0.7, 0.36, 0.25, Art.pal('anth'), { r: 0.03, lw: 0.02 });
      const hook = 1.6 + Math.sin(tm * 0.7) * 0.5;
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(tx - 0.1, beamY + 0.2); ctx.lineTo(tx - 0.1, beamY + hook); ctx.moveTo(tx + 0.1, beamY + 0.2); ctx.lineTo(tx + 0.1, beamY + hook); ctx.stroke();
      Art.box(ctx, tx - 0.5, beamY + hook, 1.0, 0.45, 0.42, Art.tones('#3aa86a'), { r: 0.02, lw: 0.02 });
      const k = Math.floor(tm * 6) % 6, bx0 = x + 1.7, by0 = y + 2.2 - BA_E, bh = H - 3.2;
      for (let i = 0; i < 6; i++) for (const sx of [bx0 + 0.3, bx0 + W - 3.4 - 0.3]) { const on = i === k; const ly = by0 + 0.5 + i * (bh - 1) / 5; ctx.fillStyle = on ? '#ffe08a' : '#6a5a2a'; ctx.beginPath(); ctx.arc(sx, ly, 0.06, 0, Math.PI * 2); ctx.fill(); if (on) Draw.glowAt(ctx, sx, ly, 0.3, '#ffd27a', 0.9); }
      Draw.shelfItems(ctx, b, [[x + 2.4, y + H - 1.1], [x + 2.9, y + H - 1.1], [x + 3.4, y + H - 1.1], [x + 2.4, y + H - 1.6], [x + 2.9, y + H - 1.6], [x + 3.4, y + H - 1.6]], 0.2);
    },
    terminal(ctx, g, b, x, y, tm, vt) {
      const W = b.w, H = b.h;
      const hx = x + W / 2, hy = y + H - 2.2 - BA_E - 0.45 * Art.V - 1.0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const R = 0.75;
      const gr = ctx.createRadialGradient(hx, hy, 0.05, hx, hy, R); gr.addColorStop(0, 'rgba(255,160,220,.35)'); gr.addColorStop(1, 'rgba(255,95,168,.05)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(hx, hy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,170,220,.7)'; ctx.lineWidth = 0.025;
      for (let i = 0; i < 4; i++) { const k = Math.cos(tm * 0.8 + i * Math.PI / 4); ctx.beginPath(); ctx.ellipse(hx, hy, Math.abs(k) * R, R, 0, 0, Math.PI * 2); ctx.stroke(); }
      for (let i = -2; i <= 2; i++) { const yy = hy + i * R * 0.38; const rr = Math.sqrt(Math.max(0, R * R - (yy - hy) * (yy - hy))); ctx.beginPath(); ctx.ellipse(hx, yy, rr, rr * 0.18, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(140,230,255,.75)'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.ellipse(hx, hy, R * 1.35, R * 0.35, Math.sin(tm * 0.5) * 0.2, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      Draw.glowAt(ctx, hx, y + H - 2.2 - BA_E - 0.45 * Art.V, 0.8, '#ff9fd0', 0.5);
      if (Math.floor(tm * 1.2) & 1) Draw.glowAt(ctx, x + W - 1.6, y + 1.7 - BA_E - 0.5 - 1.8 * Art.V - 1.25, 0.25, '#ff9fd0', 0.9);
    },
    lamp(ctx, g, b, x, y, tm, vt) {
      const n = Render.night || 0;
      const heads = b.level >= 2 ? [0.72, 0.28] : [0.72];
      for (const hx of heads) Draw.glowAt(ctx, x + hx, y + 0.72 - 1.57 + 0.11, 0.22, b.level >= 2 ? '#d8f0ff' : '#ffe28a', 0.25 + n * 0.75);
    },
    flag(ctx, g, b, x, y, tm, vt) {
      const fx = x + 0.37, fy = y + 0.78 - 1.6;
      const col = b.level >= 2 ? Render.palette.accent : DATA.BUILDINGS.flag.color;
      const t = Art.tones(col);
      ctx.beginPath(); ctx.moveTo(fx, fy);
      const L = 0.75, Hh = 0.42, ph = tm * 5 + b.x;
      for (let i = 1; i <= 8; i++) { const u = i / 8; ctx.lineTo(fx + L * u, fy + Math.sin(ph - u * 3) * 0.06 * u); }
      for (let i = 8; i >= 0; i--) { const u = i / 8; ctx.lineTo(fx + L * u, fy + Hh + Math.sin(ph - u * 3) * 0.06 * u); }
      ctx.closePath();
      const gr = ctx.createLinearGradient(fx, 0, fx + L, 0); gr.addColorStop(0, t.hi); gr.addColorStop(0.5 + Math.sin(ph) * 0.2, t.base); gr.addColorStop(1, t.lo);
      ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = t.edge; ctx.lineWidth = 0.02; ctx.stroke();
      // emblem: simple planet ring
      ctx.strokeStyle = Col.rgba('#ffffff', 0.85); ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(fx + L * 0.42, fy + Hh / 2 + Math.sin(ph - 1.2) * 0.03, 0.09, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(fx + L * 0.42, fy + Hh / 2 + Math.sin(ph - 1.2) * 0.03, 0.16, 0.05, -0.3, 0, Math.PI * 2); ctx.stroke();
    },
    beacon(ctx, g, b, x, y, tm, vt) {
      const cx = x + 0.5, cy = y + 0.78 - 0.08 - 1.65 - 0.1;
      const p = 0.5 + 0.5 * Math.sin(tm * 3 + b.x);
      Draw.glowAt(ctx, cx, cy, 0.4 + p * 0.25, DATA.BUILDINGS.beacon.color, 0.6 + p * 0.4);
      if (App.settings.reducedFx) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + (Render.night || 0) * 0.4;
      ctx.translate(cx, cy); ctx.scale(1, 0.45); ctx.rotate(tm * 1.6 + b.id);
      ctx.drawImage(FxLib.tinted('beam', 0, '#7fe0ff'), 0, -0.5, 4.5, 1.0);
      ctx.restore();
    },
    plant(ctx, g, b, x, y, tm, vt) { if (Math.sin(tm * 0.7 + b.x) > 0.97) Draw.glowAt(ctx, x + 0.36, y + 0.2, 0.15, '#ffffff', 0.6); },
    fsplitter(ctx, g, b, x, y, tm) {
      if (!b.filter) return;
      const cx = x + 0.5, cy = y + 0.16 - 0.38 * Art.V + 0.36;
      if (b.filter.kind === 'res') Draw.item(ctx, b.filter.res, 0, cx, cy, 0.13);
      else { ctx.fillStyle = b.filter.kind === 'tier' ? DATA.TIERS[b.filter.tier].color : '#ffcf4a'; ctx.beginPath(); ctx.arc(cx, cy, 0.07, 0, Math.PI * 2); ctx.fill(); }
    }
  },

  // ---------------- bridge (steel truss arch) ----------------
  bridge(ctx, g, b, alpha) {
    const ex = b.x + U.DX[b.rot] * (b.len - 1), ey = b.y + U.DY[b.rot] * (b.len - 1);
    const ax = b.x + 0.5 - Render.ox, ay = b.y + 0.5 - Render.oy, bx = ex + 0.5 - Render.ox, by = ey + 0.5 - Render.oy;
    const lift = 0.7 + b.len * 0.12;
    const mx = (ax + bx) / 2, my = (ay + by) / 2 - lift * 2;
    const sun = Render.sun(g);
    const q = (t, p0, p1, p2) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
    // shadow of the arch on the ground
    ctx.strokeStyle = 'rgba(10,8,20,' + (sun.a * 0.9).toFixed(3) + ')'; ctx.lineWidth = 0.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2 + sun.dx * lift, (ay + by) / 2 + sun.dy * lift, bx, by); ctx.stroke();
    // ramps
    const t = Art.tones(DATA.BUILDINGS.bridge.color);
    for (const [px, py] of [[ax, ay], [bx, by]]) Art.box(ctx, px - 0.42, py - 0.38, 0.84, 0.8, 0.45, t, { r: 0.08 });
    // truss underside + deck
    ctx.strokeStyle = t.edge; ctx.lineWidth = 0.58; ctx.beginPath(); ctx.moveTo(ax, ay - 0.25); ctx.quadraticCurveTo(mx, my, bx, by - 0.25); ctx.stroke();
    ctx.strokeStyle = t.lo; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.strokeStyle = '#25282d'; ctx.lineWidth = 0.34; ctx.stroke();
    ctx.strokeStyle = t.hi; ctx.lineWidth = 0.04;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) { const u = i / 10; const px = q(u, ax, mx, bx), py = q(u, ay - 0.25, my, by - 0.25); ctx.moveTo(px - 0.2, py + 0.2); ctx.lineTo(px + 0.2, py + 0.2); }
    ctx.stroke();
    ctx.strokeStyle = Col.rgba(t.rim, 0.8); ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(ax - 0.2, ay - 0.42); ctx.quadraticCurveTo(mx - 0.2, my - 0.17, bx - 0.2, by - 0.42); ctx.stroke();
    Draw.arrow(ctx, bx, by - 0.45, b.rot, 0.16, '#fff');
    for (const qq of b.queue) {
      const u = ((qq.pt !== undefined ? qq.pt + (qq.t - qq.pt) * alpha : qq.t)) / Math.max(1, b.len - 1);
      const px = q(u, ax, mx, bx), py = q(u, ay - 0.25, my, by - 0.25);
      Draw.item(ctx, qq.it.res, qq.it.ref, px, py - 0.08, 0.26);
    }
  },

  // ---------------- customers ----------------
  slotPos(b, slot, tier) {
    if (tier === 0) return [b.x + 0.6 + (slot % 3) * ((b.w - 1.2) / 2), b.y + b.h + 0.55];
    if (tier === 1) return [b.x + b.w / 2, b.y + b.h + 0.9];
    if (b.type === 'port') { const p = BuildingArt.GEO.pads('port', b.w)[slot % 2]; return [b.x + p[0], b.y + p[1]]; }
    return [b.x + b.w / 2, b.y + b.h / 2 + 0.2];
  },
  customers(ctx, g, b) {
    const tm = Draw.tm;
    for (const c of b.customers) {
      const [px, py] = Draw.slotPos(b, c.slot, c.tier);
      let x = px, y = py, k = 1;
      if (c.state === 'in') k = U.clamp(c.t / c.arrive, 0, 1);
      else if (c.state === 'out') k = 1 - U.clamp(c.t / 3, 0, 1);
      const e = Art.ease.inOutQuad(k);
      if (c.tier <= 1) { x = c.sx + (px - c.sx) * e; y = c.sy + (py - c.sy) * e; }
      c._wx = x; c._wy = y;
      const rx = x - Render.ox, ry = y - Render.oy;
      if (c.tier === 0) Draw.alien(ctx, rx, ry, c, tm, (px - c.sx) * (c.state === 'out' ? -1 : 1) >= 0 ? 1 : -1);
      else if (c.tier === 1) CharArt.caravan(ctx, rx, ry, c, tm, Math.atan2(py - c.sy, px - c.sx) + (c.state === 'out' ? Math.PI : 0), c.state !== 'wait');
      else CharArt.ship(ctx, rx, ry, c, tm, b);
      if (c.state === 'wait' && App.cam.zoom >= 13) Draw.bubbles.push(rx, ry - (c.tier === 0 ? 1.6 : c.tier === 1 ? 1.65 : [0, 0, 2.2, 3.4, 5.6][c.tier] * 0.55), c);
      else c._bubAt = 0;
    }
  },
  skinCache: null,
  planetSkins() {
    const P = Render.palette;
    if (Draw.skinCache && Draw.skinCache.k === P.index) return Draw.skinCache.list;
    const base = ['#7be07a', '#b07aff', '#4ad0d8', '#ff9a5a', '#e0d050', '#ff7ab0'];
    const rot = P.index - 1;
    const list = base.map((c, i) => Col.mix(base[(i + rot) % base.length], P.accent, 0.2 + (P.index % 3) * 0.06));
    Draw.skinCache = { k: P.index, list };
    return list;
  },
  alien(ctx, x, y, c, tm, dirx) { CharArt.alien(ctx, x, y, c, tm, dirx); },
  astronaut(ctx, g, x, y, tm) { CharArt.astronaut(ctx, g, x, y, tm, Draw.dt); },

  // ---------------- UI thumbnails (built from the real sprites) ----------------
  thumbCache: new Map(),
  thumb(type, size = 56, opts = {}) {
    const key = type + '|' + size + '|' + (opts.grade || 0) + '|' + (opts.res === undefined ? '' : opts.res);
    const d = Math.min(2, window.devicePixelRatio || 1);
    let src = Draw.thumbCache.get(key);
    if (!src) {
      const S = Math.round(size * d);
      src = document.createElement('canvas'); src.width = src.height = S;
      const x = src.getContext('2d');
      const def = DATA.BUILDINGS[type];
      try {
        if (type === 'belt') {
          const ppt = Art.bucket(S / 1.4, 128);
          const sc = S / 1.5;
          x.setTransform(sc, 0, 0, sc, S / 2 - sc * 0.5, S / 2 - sc * 0.5);
          x.drawImage(BeltArt.sprite(opts.grade || 0, 0, 0, 0, 0, ppt), -BeltArt.M, -BeltArt.M, 1 + BeltArt.M * 2, 1 + BeltArt.M * 2);
        } else if (type === 'bridge') {
          const sc = S / 3.6;
          x.setTransform(sc, 0, 0, sc, S / 2 - sc * 1.5, S / 2 - sc * 0.2);
          const t = Art.tones(def.color);
          Art.box(x, 0.1, 0.1, 0.8, 0.8, 0.45, t, { r: 0.08 }); Art.box(x, 2.1, 0.1, 0.8, 0.8, 0.45, t, { r: 0.08 });
          x.lineCap = 'round'; x.strokeStyle = t.lo; x.lineWidth = 0.5; x.beginPath(); x.moveTo(0.5, 0.25); x.quadraticCurveTo(1.5, -1.3, 2.5, 0.25); x.stroke();
          x.strokeStyle = '#25282d'; x.lineWidth = 0.32; x.stroke();
        } else {
          const w = def.w, h = def.h;
          const ppt = Art.bucket(S / Math.max(w, h) * 1.1, 128);
          const spr = BuildingArt.sprite(type, 0, 0, w, h, ppt, type === 'path' ? '0' : type === 'fence' ? '5' : (type === 'lamp' || type === 'plant') ? '1' : '');
          // fit the sprite's painted extent: footprint plus the tall part
          const top = BuildingArt.TOP[type] || 1;
          const ext = Math.max(w + 0.3, h + top * 0.85);
          const sc = S / ext;
          const cx = w / 2, cy = (h - top * 0.85) / 2 + 0.05;
          x.setTransform(sc, 0, 0, sc, S / 2 - cx * sc, S / 2 - cy * sc);
          x.drawImage(spr.canvas, spr.ox, spr.oy, spr.w, spr.h);
          if (type === 'extractor' && opts.res !== undefined) { const G = BuildingArt.GEO.extractor(0); Draw.item(x, opts.res, 0, G.win[0] + G.win[2] / 2, G.win[1] + G.win[3] / 2, Math.min(G.win[2], G.win[3]) * 0.62); }
          if (type === 'flag') { Render.palette = Render.palette || { accent: '#ff9a3d' }; Draw.D.flag(x, null, { x: 0, level: 1 }, 0, 0, 0.6, 0); }
        }
      } catch (e) { x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = def ? def.color : '#888'; x.fillRect(S * 0.15, S * 0.15, S * 0.7, S * 0.7); }
      Draw.thumbCache.set(key, src);
    }
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }
};
