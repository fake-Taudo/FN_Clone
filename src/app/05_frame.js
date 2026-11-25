// =====================================================================
// Frame: draws one complete frame of the world
// =====================================================================
const LIGHT_TYPES = { lamp: ['#ffe28a', 2.6], beacon: ['#7fe0ff', 3], bazaar: ['#ffd28a', 3.5], caravan: ['#ffb070', 4], shuttlepad: ['#9fd8ff', 6], port: ['#9fd8ff', 8], dock: ['#ffd0a0', 10], terminal: ['#ff9fd0', 8], lab: ['#bfe8ff', 5], refinery1: ['#7ff0e0', 3.5], refinery2: ['#7fd8ff', 3.5], refinery3: ['#9fb0ff', 3.5], extractor: ['#ffb070', 2.2], silo: ['#c8e0ff', 3] };
const BONUS_REL = {
  cooler: t => REFINERY_LEVEL[t] ? '+10 %' : null,
  servo: t => t === 'extractor' || REFINERY_LEVEL[t] ? '+15 %' : null,
  silo: t => REFINERY_LEVEL[t] ? '+15 %' : SELLER_TIER[t] !== undefined ? 'Rampe +20 %' : null,
  charger: t => t === 'belt' ? '+25 %' : null,
  refinery: t => t === 'cooler' ? '+10 %' : t === 'servo' ? '+15 %' : t === 'silo' ? '+15 %' : null,
  extractor: (t, o, spec) => t === 'servo' ? '+15 %' : (t === 'extractor' && spec.res !== undefined && o.res === spec.res ? '+5 %' : null),
  seller: t => t === 'silo' ? 'Rampe +20 %' : null
};

const Frame = {
  seen: 0,
  draw(g, alpha, dt) {
    const ctx = Render.ctx;
    Draw.tm = App.now / 1000;
    App.frame++;
    Render.updateParticles(dt);
    Render.setWorldTransform(ctx);
    const vr = Render.visibleRect(2);
    const P = App.debug.prof;
    let pt = P ? performance.now() : 0;
    const mark = k => { if (!P) return; const n = performance.now(); P[k] = (P[k] || 0) * 0.95 + (n - pt) * 0.05; pt = n; };
    Render.drawTerrain(ctx, g, vr); mark('terrain');
    Render.drawDecor(ctx, g, vr); mark('decor');
    Render.drawDeposits(ctx, g, vr); mark('deposits');
    if (App.debug.chunkBorders) Frame.chunkBorders(ctx, vr);
    // collect visible buildings
    const S = CONFIG.chunkSize;
    const vis = Frame.vis || (Frame.vis = []);
    vis.length = 0;
    const stamp = ++Frame.seen;
    for (let cy = Math.floor(vr.y0 / S) - 1; cy <= Math.floor(vr.y1 / S); cy++) for (let cx = Math.floor(vr.x0 / S) - 1; cx <= Math.floor(vr.x1 / S); cx++) {
      const set = g.bchunk.get(U.chunkKey(cx, cy));
      if (!set) continue;
      for (const id of set) {
        const b = g.buildings.get(id);
        if (!b || b._seen === stamp) continue;
        b._seen = stamp;
        const r = b.type === 'bridge' ? Grid.rect(b) : b;
        if (r.x + r.w < vr.x0 || r.x > vr.x1 || r.y + r.h < vr.y0 || r.y > vr.y1) continue;
        vis.push(b);
      }
    }
    mark('collect');
    // layer 1: flat things (paths, belts)
    for (const b of vis) if (b.type === 'path' || b.type === 'belt') Draw.building(ctx, g, b, b.x - Render.ox, b.y - Render.oy);
    // items on belts and nodes
    const zoomS = App.cam.zoom;
    const isz = 0.21;
    if (zoomS >= 6) for (const b of vis) {
      if (b.type === 'belt') { for (const it of b.items) { const p = Draw.itemPos(b, it, alpha); Draw.item(ctx, it.res, it.ref, p[0] - Render.ox, p[1] - Render.oy, isz); } }
    }
    mark('belts+items');
    // layer 2: buildings
    for (const b of vis) if (b.type !== 'path' && b.type !== 'belt' && b.type !== 'bridge') Draw.building(ctx, g, b, b.x - Render.ox, b.y - Render.oy);
    for (const b of vis) {
      if (b.buf && b.type !== 'extractor' && b.buf.length) Draw.item(ctx, b.buf[0].res, b.buf[0].ref, b.x + 0.5 - Render.ox, b.y + 0.5 - Render.oy, isz * 0.9);
      if (b.lanes) for (let d = 0; d < 4; d++) if (b.lanes[d] && b.lanes[d].length) Draw.item(ctx, b.lanes[d][0].res, b.lanes[d][0].ref, b.x + 0.5 - Render.ox, b.y + 0.5 - Render.oy, isz * 0.9);
    }
    for (const b of vis) if (b.type === 'bridge') Draw.bridge(ctx, g, b, alpha);
    mark('buildings');
    // tips
    for (const tp of g.run.tips) {
      const bob = Math.sin(Draw.tm * 4 + tp.x) * 0.1;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
      ctx.drawImage(Sprites.glow('#ffd24a'), tp.x - Render.ox - 0.6, tp.y - Render.oy - 0.6 + bob, 1.2, 1.2);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.arc(tp.x - Render.ox, tp.y - Render.oy + bob, 0.24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8a5a00'; ctx.font = '800 0.24px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(CURRENCY_SHORT, tp.x - Render.ox, tp.y - Render.oy + bob + 0.01);
    }
    // customers
    for (const b of vis) if (b.customers && b.customers.length) Draw.customers(ctx, g, b);
    // astronaut
    const p = g.run.player;
    const ax = (p.px !== undefined ? p.px + (p.x - p.px) * alpha : p.x), ay = (p.py !== undefined ? p.py + (p.y - p.py) * alpha : p.y);
    Draw.astronaut(ctx, g, ax - Render.ox, ay - Render.oy, Draw.tm);
    Render.drawParticles(ctx);
    mark('chars+particles');
    // warnings
    if (zoomS >= 10) for (const b of vis) if (b.warn) Frame.warnIcon(ctx, b);
    // overlays
    Frame.overlays(ctx, g, vis, ax, ay);
    Render.drawFloating(ctx, dt);
    // atmosphere and lights
    const night = Render.drawAtmosphere(ctx, g, dt);
    if (night > 0.05) {
      Render.setWorldTransform(ctx);
      ctx.globalCompositeOperation = 'lighter';
      for (const b of vis) {
        const L = LIGHT_TYPES[b.type];
        if (!L) continue;
        const r = L[1] * (b.type === 'lamp' ? 1 + b.level * 0.3 : 1);
        ctx.globalAlpha = night * 0.55;
        ctx.drawImage(Sprites.glow(L[0]), b.x + b.w / 2 - Render.ox - r / 2, b.y + b.h / 2 - Render.oy - r / 2, r, r);
      }
      ctx.globalAlpha = night * 0.5;
      ctx.drawImage(Sprites.glow('#ffe8c0'), ax - Render.ox - 2.5, ay - Render.oy - 3, 5, 5);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    document.body.classList.toggle('lowq', App.quality === 'low');
    Frame.edgeMarkers(ctx, g);
    mark('overlays+atmo');
  },

  warnIcon(ctx, b) {
    const x = b.x + b.w / 2 - Render.ox, y = b.y - 0.35 - Render.oy + Math.sin(Draw.tm * 4) * 0.06;
    const s = Math.max(0.35, 12 / App.cam.zoom);
    const red = b.warn === 'full' || b.warn === 'empty' || b.warn === 'nocon';
    ctx.fillStyle = red ? '#ff5a5a' : '#ffc24d'; ctx.strokeStyle = '#1a1010'; ctx.lineWidth = s * 0.1;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.95, y + s * 0.65); ctx.lineTo(x - s * 0.95, y + s * 0.65); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a1010'; ctx.font = '900 ' + (s * 1.05) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', x, y + s * 0.12);
  },

  chunkBorders(ctx, vr) {
    const S = CONFIG.chunkSize;
    ctx.strokeStyle = 'rgba(0,255,255,.5)'; ctx.lineWidth = 2 / Render.S;
    ctx.beginPath();
    for (let x = Math.floor(vr.x0 / S) * S; x <= vr.x1; x += S) { ctx.moveTo(x - Render.ox, vr.y0 - Render.oy); ctx.lineTo(x - Render.ox, vr.y1 - Render.oy); }
    for (let y = Math.floor(vr.y0 / S) * S; y <= vr.y1; y += S) { ctx.moveTo(vr.x0 - Render.ox, y - Render.oy); ctx.lineTo(vr.x1 - Render.ox, y - Render.oy); }
    ctx.stroke();
  },

  footprint(ctx, x, y, w, hh, ok, alpha = 0.35) {
    ctx.fillStyle = ok ? 'rgba(99,223,116,' + alpha + ')' : 'rgba(255,90,90,' + alpha + ')';
    ctx.fillRect(x - Render.ox, y - Render.oy, w, hh);
    ctx.strokeStyle = ok ? '#63df74' : '#ff5a5a'; ctx.lineWidth = 2 / Render.S;
    ctx.strokeRect(x - Render.ox, y - Render.oy, w, hh);
  },

  overlays(ctx, g, vis, ax, ay) {
    const P = g.run.player;
    const lw = 1 / Render.S;
    // build radius
    if (App.mode === 'build') {
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2 * lw; ctx.setLineDash([8 * lw, 8 * lw]);
      ctx.beginPath(); ctx.arc(ax - Render.ox, ay - Render.oy, g.mods.buildRadius, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      if (App.cam.zoom >= 18) {
        // faint grid around the cursor
        const hv = App.hover;
        if (hv) {
          ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = lw;
          ctx.beginPath();
          for (let i = -8; i <= 8; i++) {
            ctx.moveTo(hv.x + i - Render.ox, hv.y - 8 - Render.oy); ctx.lineTo(hv.x + i - Render.ox, hv.y + 9 - Render.oy);
            ctx.moveTo(hv.x - 8 - Render.ox, hv.y + i - Render.oy); ctx.lineTo(hv.x + 9 - Render.ox, hv.y + i - Render.oy);
          }
          ctx.stroke();
        }
      }
    }
    // selected building
    const sel = App.selected;
    if (sel && g.buildings.has(sel.id)) {
      const r = Grid.rect(sel);
      ctx.strokeStyle = Render.palette.accent; ctx.lineWidth = 3 * lw;
      ctx.strokeRect(r.x - Render.ox - 0.05, r.y - Render.oy - 0.05, r.w + 0.1, r.h + 0.1);
      if (sel.type === 'bazaar') {
        ctx.strokeStyle = 'rgba(185,162,122,.6)'; ctx.setLineDash([6 * lw, 6 * lw]);
        ctx.beginPath(); ctx.arc(sel.x + sel.w / 2 - Render.ox, sel.y + sel.h / 2 - Render.oy, CONFIG.pathRadius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (sel.type === 'extractor' && sel.dep !== undefined) {
        const d = World.depositById(g.world, sel.dep);
        if (d) for (const t of d.tiles) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2 * lw; ctx.strokeRect(t[0] - Render.ox + 0.06, t[1] - Render.oy + 0.06, 0.88, 0.88); }
      }
    }
    // mass selection
    if (App.selection.length) {
      ctx.strokeStyle = '#7fd3ff'; ctx.lineWidth = 2 * lw;
      for (const b of App.selection) { const r = Grid.rect(b); ctx.strokeRect(r.x - Render.ox, r.y - Render.oy, r.w, r.h); }
    }
    if (App.selRect) {
      const s = App.selRect;
      ctx.fillStyle = 'rgba(127,211,255,.12)'; ctx.strokeStyle = '#7fd3ff'; ctx.lineWidth = 2 * lw;
      const x0 = Math.min(s.x0, s.x1), y0 = Math.min(s.y0, s.y1), x1 = Math.max(s.x0, s.x1) + 1, y1 = Math.max(s.y0, s.y1) + 1;
      ctx.fillRect(x0 - Render.ox, y0 - Render.oy, x1 - x0, y1 - y0); ctx.strokeRect(x0 - Render.ox, y0 - Render.oy, x1 - x0, y1 - y0);
    }
    // ghost
    const gh = App.ghost;
    if (gh && App.mode === 'build') {
      if (gh.list) {
        for (const it of gh.list) {
          const s = it.spec;
          if (s.type === 'bridge') { const r = { x: Math.min(s.x, s.x + U.DX[s.rot] * (s.len - 1)), y: Math.min(s.y, s.y + U.DY[s.rot] * (s.len - 1)) }; Frame.footprint(ctx, r.x, r.y, Math.abs(U.DX[s.rot]) * (s.len - 1) + 1, Math.abs(U.DY[s.rot]) * (s.len - 1) + 1, it.ok); continue; }
          const sz = Grid.size(s.type, s.rot, s.len);
          Frame.footprint(ctx, s.x, s.y, sz.w, sz.h, it.ok);
          if (s.type === 'belt' || DATA.BUILDINGS[s.type].w === 1) Draw.arrow(ctx, s.x + 0.5 - Render.ox, s.y + 0.5 - Render.oy, s.rot, 0.25, 'rgba(255,255,255,.9)');
        }
      } else if (gh.spec) {
        const s = gh.spec;
        const sz = Grid.size(s.type, s.rot, s.len);
        ctx.globalAlpha = 0.6;
        const fake = Grid.make({ nextId: 0 }, Object.assign({}, s, { id: -1, res: gh.dep ? gh.dep.res : undefined, tier: gh.dep ? gh.dep.tier : 0 }));
        fake.w = sz.w; fake.h = sz.h; fake._sv = -5; fake.shape = 0;
        try { if (s.type !== 'bridge') Draw.building(ctx, Object.assign({}, g, { topoVersion: -5 }), fake, s.x - Render.ox, s.y - Render.oy); } catch (e) { /* preview only */ }
        ctx.globalAlpha = 1;
        Frame.footprint(ctx, s.x, s.y, sz.w, sz.h, gh.ok, 0.25);
        if (s.type !== 'belt' && (DATA.BUILDINGS[s.type].w > 1 || DATA.BUILDINGS[s.type].h > 1) && !Grid.isDeco(s.type) && s.type !== 'extractor') {
          const pb = { x: s.x, y: s.y, w: sz.w, h: sz.h, rot: s.rot };
          const fp = Grid.frontPort(pb);
          Draw.arrow(ctx, fp[0] + 0.5 - Render.ox, fp[1] + 0.5 - Render.oy, s.rot, 0.3, '#ffffff');
        } else if (DATA.BUILDINGS[s.type].w === 1 && !Grid.isDeco(s.type)) Draw.arrow(ctx, s.x + 0.5 - Render.ox, s.y + 0.5 - Render.oy, s.rot, 0.25, '#ffffff');
        if (gh.dep) for (const t of gh.dep.tiles) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * lw; ctx.strokeRect(t[0] - Render.ox + 0.08, t[1] - Render.oy + 0.08, 0.84, 0.84); }
        // neighbourhood bonuses
        Frame.bonusPreview(ctx, g, s, sz, gh);
      }
    }
    // scanner ping
    const ping = g.run.scanPing;
    if (ping) {
      const k = U.clamp(ping.t / 1.6, 0, 1);
      ctx.strokeStyle = Col.rgba(Render.palette.accent, 1 - k); ctx.lineWidth = 4 * lw;
      ctx.beginPath(); ctx.arc(ping.x - Render.ox, ping.y - Render.oy, ping.r * k, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2 * lw;
      ctx.beginPath(); ctx.arc(ping.x - Render.ox, ping.y - Render.oy, ping.r * k * 0.7, 0, Math.PI * 2); ctx.stroke();
    }
    // pins in world
    for (const pin of g.run.pins) {
      const x = pin.x + 0.5 - Render.ox, y = pin.y + 0.5 - Render.oy, s = Math.max(0.4, 14 / App.cam.zoom);
      ctx.fillStyle = pin.color; ctx.strokeStyle = '#111'; ctx.lineWidth = s * 0.12;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.6, y - s); ctx.arc(x, y - s * 1.1, s * 0.6, Math.PI * 0.85, Math.PI * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  },

  bonusPreview(ctx, g, s, sz, gh) {
    let relKey = s.type;
    if (REFINERY_LEVEL[s.type]) relKey = 'refinery';
    else if (SELLER_TIER[s.type] !== undefined) relKey = 'seller';
    const rel = BONUS_REL[relKey];
    if (!rel) return;
    const pb = { x: s.x, y: s.y, w: sz.w, h: sz.h };
    const seen = new Set();
    const spec = Object.assign({}, s, { res: gh.dep ? gh.dep.res : undefined });
    const cx = s.x + sz.w / 2 - Render.ox, cy = s.y + sz.h / 2 - Render.oy;
    ctx.font = '700 ' + Math.max(0.3, 12 / App.cam.zoom) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of Grid.perimeter(pb)) {
      const o = Grid.at(g, p[0], p[1]);
      if (!o || seen.has(o.id)) continue;
      seen.add(o.id);
      const label = rel(o.type, o, spec);
      if (!label) continue;
      const r = Grid.rect(o);
      const ox = r.x + r.w / 2 - Render.ox, oy = r.y + r.h / 2 - Render.oy;
      ctx.strokeStyle = 'rgba(155,255,140,.9)'; ctx.lineWidth = 3 / Render.S;
      ctx.strokeRect(r.x - Render.ox, r.y - Render.oy, r.w, r.h);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox, oy); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.7)';
      const tw = ctx.measureText(label).width + 0.2;
      ctx.fillRect((cx + ox) / 2 - tw / 2, (cy + oy) / 2 - 0.22, tw, 0.44);
      ctx.fillStyle = '#9bff8c'; ctx.fillText(label, (cx + ox) / 2, (cy + oy) / 2);
    }
  },

  // Off-screen arrows for scan results, probe target and pins.
  edgeMarkers(ctx, g) {
    const d = App.view.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const W = App.view.w, H = App.view.h;
    const marks = [];
    const now = App.now;
    Render.edgeMarks = Render.edgeMarks.filter(m => now - m.at < 12000);
    for (const m of Render.edgeMarks) marks.push(m);
    if (g.run.probeTarget) marks.push({ x: g.run.probeTarget.x + 0.5, y: g.run.probeTarget.y + 0.5, color: '#ffffff', label: 'Sonde' });
    for (const pin of g.run.pins) marks.push({ x: pin.x + 0.5, y: pin.y + 0.5, color: pin.color, label: pin.name });
    if (App.compassTarget) marks.push({ x: App.compassTarget.x + 0.5, y: App.compassTarget.y + 0.5, color: Render.palette.accent, label: '' });
    const pad = 46;
    for (const m of marks) {
      const [sx, sy] = Render.worldToScreen(m.x, m.y);
      if (sx > pad && sx < W - pad && sy > pad && sy < H - pad) continue;
      const cx = W / 2, cy = H / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const k = Math.min((W / 2 - pad) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - pad) / Math.abs(Math.sin(ang) || 1e-6));
      const ex = cx + Math.cos(ang) * k, ey = cy + Math.sin(ang) * k;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.fillStyle = m.color; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      const dist = Math.round(Math.hypot(m.x - g.run.player.x, m.y - g.run.player.y));
      ctx.font = '700 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tx = ex - Math.cos(ang) * 26, ty = ey - Math.sin(ang) * 26;
      const txt = (m.label ? m.label + ' ' : '') + dist + ' m';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(txt, tx, ty);
      ctx.fillStyle = '#fff'; ctx.fillText(txt, tx, ty);
    }
  }
};
