// =====================================================================
// MapView: minimap + full-screen map with fog of war, markers and pins
// =====================================================================
const PIN_COLORS = ['#ff5a5a', '#ffc24d', '#63df74', '#4aa8ff', '#d86bff'];

const MapView = {
  cellCache: new Map(),
  view: { x: 0, y: 0, s: 2 },
  pinMode: false,
  lastMini: 0,

  LM_NAMES: { basin: 'Einschlagsbecken', riverbed: 'Trockenes Tal', canyon: 'Spaltennarbe', mesas: 'Mesa-Feld', devils: 'Staubteufel-Spuren', wreck: 'Wrack' },
  landmarkIcon(ctx, lm, x, y, label) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(255,240,220,.85)'; ctx.fillStyle = 'rgba(20,14,18,.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    if (lm.type === 'basin') { ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.moveTo(1, 0); ctx.arc(0, 0, 1, 0, Math.PI * 2); }
    else if (lm.type === 'riverbed') { ctx.moveTo(-4, -2); ctx.quadraticCurveTo(0, 2, 4, -1); ctx.moveTo(-4, 2); ctx.quadraticCurveTo(0, 5, 4, 2); }
    else if (lm.type === 'canyon') { ctx.moveTo(-4, -3); ctx.lineTo(-1, 0); ctx.lineTo(1, -1); ctx.lineTo(4, 3); }
    else if (lm.type === 'mesas') { ctx.moveTo(-4, 3); ctx.lineTo(-2, -1); ctx.lineTo(2, -1); ctx.lineTo(4, 3); }
    else if (lm.type === 'devils') { for (let i = 0; i < 12; i++) { const a = i * 0.7, r = i * 0.35; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } }
    else { ctx.moveTo(-3, 3); ctx.lineTo(3, -3); ctx.moveTo(-3, -3); ctx.lineTo(3, 3); ctx.moveTo(4, 0); ctx.arc(0, 0, 4, 0, Math.PI * 2); }
    ctx.stroke();
    if (label) { ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(MapView.LM_NAMES[lm.type] || '', 0, -11); }
    ctx.restore();
  },
  cellColor(g, cx, cy, i) {
    const key = U.chunkKey(cx, cy);
    let arr = MapView.cellCache.get(key);
    if (!arr) {
      arr = [];
      const S = CONFIG.chunkSize, C = CONFIG.fogCell, per = S / C, col = [0, 0, 0];
      for (let k = 0; k < per * per; k++) {
        Render.terrainColor(g.world, cx * S + (k % per) * C + C / 2, cy * S + Math.floor(k / per) * C + C / 2, col);
        arr.push([col[0] | 0, col[1] | 0, col[2] | 0]);
      }
      if (MapView.cellCache.size > 4000) MapView.cellCache.clear();
      MapView.cellCache.set(key, arr);
    }
    return arr[i];
  },

  // Generic map painter. (cx, cy) = world centre, s = px per tile.
  paint(ctx, g, W, H, cx, cy, s, opts = {}) {
    ctx.fillStyle = '#07060a'; ctx.fillRect(0, 0, W, H);
    const S = CONFIG.chunkSize, C = CONFIG.fogCell, per = S / C;
    const x0 = cx - W / 2 / s, y0 = cy - H / 2 / s, x1 = cx + W / 2 / s, y1 = cy + H / 2 / s;
    const tx = x => (x - cx) * s + W / 2, ty = y => (y - cy) * s + H / 2;
    // terrain: baked chunk textures (same pipeline as the world); soft fog of war on top
    const gx0 = Math.floor(x0 / C) - 1, gy0 = Math.floor(y0 / C) - 1;
    const gw = Math.ceil(x1 / C) - gx0 + 2, gh = Math.ceil(y1 / C) - gy0 + 2;
    let oc = MapView.oc;
    if (!oc || oc.width < gw || oc.height < gh) { oc = MapView.oc = document.createElement('canvas'); oc.width = Math.max(gw, 64); oc.height = Math.max(gh, 64); }
    const ox = oc.getContext('2d');
    const img = ox.createImageData(gw, gh), dd = img.data;
    const fog = MapView.fogc || (MapView.fogc = document.createElement('canvas'));
    if (fog.width < gw || fog.height < gh) { fog.width = Math.max(gw, 64); fog.height = Math.max(gh, 64); }
    const fx = fog.getContext('2d'), fimg = fx.createImageData(gw, gh), fd = fimg.data;
    let requested = 0;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const wx = (gx0 + i) * C, wy = (gy0 + j) * C;
      const ccx = Math.floor(wx / S), ccy = Math.floor(wy / S);
      const m = g.world.discovered.get(U.chunkKey(ccx, ccy));
      const li = ((wx - ccx * S) / C) + ((wy - ccy * S) / C) * per;
      const o = (j * gw + i) * 4;
      if (!m || !(m & (1 << li))) { fd[o] = 7; fd[o + 1] = 6; fd[o + 2] = 10; fd[o + 3] = 255; continue; }
      const c = MapView.cellColor(g, ccx, ccy, li);
      dd[o] = c[0]; dd[o + 1] = c[1]; dd[o + 2] = c[2]; dd[o + 3] = 255;
    }
    ox.clearRect(0, 0, oc.width, oc.height); ox.putImageData(img, 0, 0);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(oc, 0, 0, gw, gh, tx(gx0 * C), ty(gy0 * C), gw * C * s, gh * C * s);
    // sharper baked textures where available
    for (let ccy = Math.floor(y0 / S); ccy <= Math.floor(y1 / S); ccy++) for (let ccx = Math.floor(x0 / S); ccx <= Math.floor(x1 / S); ccx++) {
      if (!g.world.discovered.get(U.chunkKey(ccx, ccy))) continue;
      const e = TerrainSys.best(ccx, ccy, 0);
      if (e) { ctx.drawImage(e.img, tx(ccx * S), ty(ccy * S), S * s + 0.6, S * s + 0.6); continue; }
      if (requested++ < 6 && TerrainSys.P) TerrainSys.request(g, ccx, ccy, 0, 20);
    }
    fx.clearRect(0, 0, fog.width, fog.height); fx.putImageData(fimg, 0, 0);
    ctx.drawImage(fog, 0, 0, gw, gh, tx(gx0 * C), ty(gy0 * C), gw * C * s, gh * C * s);
    ctx.restore();
    TerrainSys.pump();
    // landmarks (only where discovered)
    if (TerrainSys.P && s >= 0.6) {
      const LC = TerrainCore.LC;
      for (let lj = Math.floor(y0 / LC) - 1; lj <= Math.floor(y1 / LC) + 1; lj++) for (let li2 = Math.floor(x0 / LC) - 1; li2 <= Math.floor(x1 / LC) + 1; li2++) {
        const lm = TerrainCore.landmarkCell(li2, lj, TerrainSys.P);
        if (!lm || !World.isDiscovered(g.world, Math.floor(lm.x), Math.floor(lm.y))) continue;
        MapView.landmarkIcon(ctx, lm, tx(lm.x), ty(lm.y), opts.labels);
      }
    }
    // buildings
    for (const b of g.buildings.values()) {
      const r = b.type === 'bridge' ? Grid.rect(b) : b;
      if (r.x + r.w < x0 || r.x > x1 || r.y + r.h < y0 || r.y > y1) continue;
      ctx.fillStyle = b.type === 'belt' ? '#9aa3ad' : DATA.BUILDINGS[b.type].color;
      ctx.fillRect(tx(r.x), ty(r.y), Math.max(1, r.w * s), Math.max(1, r.h * s));
      if (opts.warn && b.warn && g.run.research.done.has('alerts')) { ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(tx(r.x + r.w / 2), ty(r.y), 4, 0, Math.PI * 2); ctx.fill(); }
    }
    // known deposits
    const dotR = Math.max(2.5, Math.min(6, s * 1.5));
    for (const id of g.world.known) {
      const d = World.depositById(g.world, id);
      if (!d || d.x < x0 - 2 || d.x > x1 + 2 || d.y < y0 - 2 || d.y > y1 + 2) continue;
      const col = d.tier === 7 ? Col.prism(App.now / 1000, 0) : DATA.TIERS[d.tier].color;
      ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(tx(d.x + 0.5), ty(d.y + 0.5), dotR * (1 + d.tier * 0.08), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (opts.labels && s >= 3 && d.tier >= 2) { ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(DATA.RESOURCES[d.res].name, tx(d.x + 0.5), ty(d.y) - dotR - 3); }
    }
    if (App.debug.wallhack) {
      for (const d of World.depositsInRect(g.world, x0, y0, x1, y1)) { ctx.strokeStyle = DATA.TIERS[d.tier].color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(tx(d.x + 0.5), ty(d.y + 0.5), dotR + 2, 0, Math.PI * 2); ctx.stroke(); }
    }
    // home
    const hm = g.run.home;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    const hx = tx(hm.x), hy = ty(hm.y);
    ctx.beginPath(); ctx.moveTo(hx, hy - 7); ctx.lineTo(hx + 6, hy); ctx.lineTo(hx + 4, hy); ctx.lineTo(hx + 4, hy + 6); ctx.lineTo(hx - 4, hy + 6); ctx.lineTo(hx - 4, hy); ctx.lineTo(hx - 6, hy); ctx.closePath(); ctx.fill(); ctx.stroke();
    // pins
    for (const p of g.run.pins) {
      const px = tx(p.x + 0.5), py = ty(p.y + 0.5);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 6, py - 10); ctx.arc(px, py - 11, 6, Math.PI * 0.85, Math.PI * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (opts.labels) { ctx.fillStyle = '#fff'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(p.name, px, py - 20); }
    }
    if (g.run.probeTarget) { const p = g.run.probeTarget; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tx(p.x + 0.5), ty(p.y + 0.5), 9 + Math.sin(App.now / 200) * 2, 0, Math.PI * 2); ctx.stroke(); }
    // player
    const pl = g.run.player;
    ctx.fillStyle = Render.palette.accent; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tx(pl.x), ty(pl.y), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (opts.viewRect) {
      const vr = Render.visibleRect(0);
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1;
      ctx.strokeRect(tx(vr.x0), ty(vr.y0), (vr.x1 - vr.x0) * s, (vr.y1 - vr.y0) * s);
    }
  },

  drawMini(g) {
    if (!App.settings.minimap) return;
    const now = performance.now();
    if (now - MapView.lastMini < 180) return;
    MapView.lastMini = now;
    const cv = $('#minimap');
    const d = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 160;
    if (cv.width !== Math.round(w * d)) { cv.width = Math.round(w * d); cv.height = Math.round(w * d); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    MapView.paint(ctx, g, w, w, g.run.player.x, g.run.player.y, w / 120, { viewRect: true, warn: true });
  },

  open() {
    const g = App.g;
    MapView.view = { x: g.run.player.x, y: g.run.player.y, s: 3 };
    MapView.pinMode = false;
    const m = h('div', { class: 'modal' });
    const head = h('div', { class: 'modal-head' }, h('h2', { text: 'Karte · ' + g.world.planet.name }), h('button', { class: 'icon-btn small', 'aria-label': 'Schließen', onclick: () => UI.closeModal() }, '✕'));
    const wrap = h('div', { class: 'map-wrap' });
    const cv = h('canvas', { 'aria-label': 'Karte' });
    wrap.append(cv);
    const tools = h('div', { class: 'map-tools' },
      h('button', { class: 'icon-btn small', 'aria-label': 'Hineinzoomen', onclick: () => { MapView.view.s = Math.min(16, MapView.view.s * 1.4); } }, '+'),
      h('button', { class: 'icon-btn small', 'aria-label': 'Herauszoomen', onclick: () => { MapView.view.s = Math.max(0.15, MapView.view.s / 1.4); } }, '−'),
      h('button', { class: 'icon-btn small', 'aria-label': 'Zum Astronauten', title: 'Zum Astronauten', onclick: () => { MapView.view.x = g.run.player.x; MapView.view.y = g.run.player.y; } }, '◎'));
    wrap.append(tools);
    const legend = h('div', { class: 'map-legend' });
    for (let t = 0; t < 8; t++) legend.append(h('span', { style: { color: DATA.TIERS[t].color }, text: '● ' + DATA.TIERS[t].name }));
    wrap.append(legend);
    const pinBtn = h('button', { class: 'pill' }, '📍 Markierung setzen');
    pinBtn.addEventListener('click', () => { MapView.pinMode = !MapView.pinMode; pinBtn.classList.toggle('on', MapView.pinMode); if (MapView.pinMode) UI.toast('Tippe auf die Karte, um eine Markierung zu setzen (max. 5).'); });
    const body = h('div', { class: 'modal-body' });
    body.append(wrap);
    const pins = h('div', { class: 'pin-list', id: 'pin-list', style: { marginTop: '10px' } });
    body.append(pins);
    const foot = h('div', { class: 'modal-foot' },
      pinBtn,
      h('button', { class: 'pill', onclick: () => { UI.closeModal(); MainLoop.teleport(g.run.home.x, g.run.home.y, 'Schnellreise zum Landeplatz'); } }, '⌂ Schnellreise zum Landeplatz'));
    m.append(head, body, foot);
    UI.openModal(m, { onClose: () => cancelAnimationFrame(MapView.raf) });
    MapView.renderPins();
    // interaction
    const ptrs = new Map();
    let pinch = null, moved = false;
    cv.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); moved = false; if (ptrs.size === 2) { const p = [...ptrs.values()]; pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), s: MapView.view.s }; } cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      if (ptrs.size === 2 && pinch) { p.x = e.clientX; p.y = e.clientY; const q = [...ptrs.values()]; MapView.view.s = U.clamp(pinch.s * Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y) / pinch.d, 0.15, 16); moved = true; return; }
      MapView.view.x -= (e.clientX - p.x) / MapView.view.s; MapView.view.y -= (e.clientY - p.y) / MapView.view.s;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 6) moved = true;
    });
    const up = e => {
      const p = ptrs.get(e.pointerId);
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (p && !moved && MapView.pinMode) {
        const r = cv.getBoundingClientRect();
        const wx = MapView.view.x + (e.clientX - r.left - r.width / 2) / MapView.view.s;
        const wy = MapView.view.y + (e.clientY - r.top - r.height / 2) / MapView.view.s;
        MapView.addPin(Math.floor(wx), Math.floor(wy));
      }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); MapView.view.s = U.clamp(MapView.view.s * Math.exp(-e.deltaY * 0.0015), 0.15, 16); }, { passive: false });
    const loop = () => {
      if (!cv.isConnected) return;
      const d = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, hh = cv.clientHeight;
      if (cv.width !== Math.round(w * d) || cv.height !== Math.round(hh * d)) { cv.width = Math.round(w * d); cv.height = Math.round(hh * d); }
      const ctx = cv.getContext('2d');
      ctx.setTransform(d, 0, 0, d, 0, 0);
      MapView.paint(ctx, g, w, hh, MapView.view.x, MapView.view.y, MapView.view.s, { labels: true, warn: true, viewRect: true });
      MapView.raf = requestAnimationFrame(loop);
    };
    MapView.raf = requestAnimationFrame(loop);
  },
  addPin(x, y) {
    const g = App.g;
    if (g.run.pins.length >= 5) { UI.toast('Maximal 5 Markierungen. Lösche zuerst eine.', 'bad'); return; }
    const n = g.run.pins.length;
    g.run.pins.push({ x, y, color: PIN_COLORS[n % PIN_COLORS.length], name: 'Markierung ' + (n + 1) });
    Audio2.play('click');
    MapView.renderPins();
  },
  renderPins() {
    const g = App.g, el = $('#pin-list');
    if (!el) return;
    el.innerHTML = '';
    if (!g.run.pins.length) { el.append(h('div', { class: 'muted', text: 'Noch keine Markierungen. Markierungen erscheinen auch als Pfeile am Bildschirmrand.' })); return; }
    g.run.pins.forEach((p, i) => {
      const name = h('input', { value: p.name, maxlength: 24, 'aria-label': 'Name der Markierung', style: { flex: '1', minHeight: '40px', borderRadius: '10px', background: '#241c2a', color: 'var(--text)', border: '1px solid var(--line-strong)', padding: '6px 10px' } });
      name.addEventListener('input', () => { p.name = name.value || 'Markierung'; });
      const colors = h('div', { class: 'seg' });
      for (const c of PIN_COLORS) { const b = h('button', { class: p.color === c ? 'on' : '', style: { background: c, width: '40px' }, 'aria-label': 'Farbe' }, ' '); b.addEventListener('click', () => { p.color = c; MapView.renderPins(); }); colors.append(b); }
      el.append(h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, name, colors,
        h('button', { class: 'pill', onclick: () => { MapView.view.x = p.x; MapView.view.y = p.y; } }, 'Zeigen'),
        h('button', { class: 'pill', onclick: () => { g.run.pins.splice(i, 1); MapView.renderPins(); } }, 'Löschen')));
    });
  }
};
