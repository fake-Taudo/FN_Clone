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
    Draw.dt = Math.min(0.1, dt || 0.016);
    Art.tick++;
    App.frame++;
    Render.night = Render.dayNight(g);
    Render.updateParticles(dt);
    Render.updateDevils(g, dt);
    Render.setWorldTransform(ctx);
    const vr = Render.visibleRect(3);
    const P = App.debug.prof;
    let pt = P ? performance.now() : 0;
    const mark = k => { if (!P) return; const n = performance.now(); P[k] = (P[k] || 0) * 0.95 + (n - pt) * 0.05; pt = n; };
    Render.drawTerrain(ctx, g, vr); mark('terrain');
    Render.drawDecor(ctx, g, vr);
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
    // ground stories: trampled paths, foundation zones, prints
    Ground.drawWear(ctx, vr);
    Ground.drawFoundations(ctx, vis);
    if (typeof Intro !== 'undefined' && Intro.groundDecals) Intro.groundDecals(ctx, g);
    Render.drawPrints(ctx); mark('decor');
    const deps = Frame.deps || (Frame.deps = []);
    deps.length = 0;
    World.depositsInRect(g.world, vr.x0 - 2, vr.y0 - 2, vr.x1 + 2, vr.y1 + 2, deps);
    const dppt = Art.bucket(Render.ppt(), 96);
    for (const d of deps) { const r = Ground.depositRing(d, Math.min(64, dppt)); ctx.drawImage(r.canvas, r.ox - Render.ox, r.oy - Render.oy, r.w, r.h); }
    for (const d of deps) { const s = DepositArt.sprite(d, dppt); ctx.drawImage(s.canvas, s.ox - Render.ox, s.oy - Render.oy, s.w, s.h); }
    mark('deposits');
    if (App.debug.chunkBorders) Frame.chunkBorders(ctx, vr);
    // layer 1: flat things (paths, belts, belt items)
    for (const b of vis) if (b.type === 'path') Draw.building(ctx, g, b, b.x - Render.ox, b.y - Render.oy);
    const belts = Frame.belts || (Frame.belts = []);
    belts.length = 0;
    for (const b of vis) if (b.type === 'belt') belts.push(b);
    BeltArt.draw(ctx, g, belts, Draw.tm);
    BeltArt.drawItems(ctx, g, belts, alpha, Draw.tm);
    BeltArt.plops(g, belts);
    mark('belts+items');
    // ground pass: flat transport nodes, bridges and the flat bases of large stations (always under figures)
    const solid = Frame.solid || (Frame.solid = []);
    solid.length = 0;
    const isz = 0.2;
    for (const b of vis) {
      if (b.type === 'path' || b.type === 'belt' || b.type === 'bridge') continue;
      if (Grid.isTransport(b.type)) {
        Draw.building(ctx, g, b, b.x - Render.ox, b.y - Render.oy);
        if (b.buf && b.buf.length) Draw.item(ctx, b.buf[0].res, b.buf[0].ref, b.x + 0.5 - Render.ox, b.y + 0.1 - Render.oy, isz);
        if (b.lanes) for (let d = 0; d < 4; d++) if (b.lanes[d] && b.lanes[d].length) Draw.item(ctx, b.lanes[d][0].res, b.lanes[d][0].ref, b.x + 0.5 - Render.ox, b.y + 0.1 - Render.oy, isz);
        continue;
      }
      solid.push(b);
    }
    for (const b of solid) if (Sorter.isSplit(b)) Draw.building(ctx, g, b, b.x - Render.ox, b.y - Render.oy);
    for (const b of vis) if (b.type === 'bridge') Draw.bridge(ctx, g, b, alpha);
    BuildingArt.castShadows(ctx, g, solid);
    // tips: spinning coins with a glow (on the ground)
    const tm = Draw.tm;
    for (const tp of g.run.tips) {
      const bob = Math.abs(Math.sin(tm * 3 + tp.x)) * 0.18;
      const x = tp.x - Render.ox, y = tp.y - Render.oy;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 0.2, 0.18 - bob * 0.3, 0.06, 0, 0, Math.PI * 2); ctx.fill();
      Draw.glowAt(ctx, x, y - bob, 0.55, '#ffd24a', 0.55);
      ctx.drawImage(FxLib.get('coin', Math.floor(tm * 10 + tp.x) & 7), x - 0.22, y - bob - 0.22, 0.44, 0.44);
    }
    // sorted layer: buildings, tall parts of stations, customers, astronaut, lander (by foot line)
    const items = Frame.items || (Frame.items = []);
    items.length = 0;
    const ships = Frame.ships || (Frame.ships = []);
    ships.length = 0;
    for (const b of solid) {
      if (Sorter.isSplit(b)) { for (const part of Sorter.TALL[b.type](b.w, b.h)) items.push({ kind: 'part', key: b.y + part[4], b, part }); }
      else items.push({ kind: 'b', key: Sorter.footY(b), b });
      if (b.customers && b.customers.length) Draw.prepareCustomers(g, b, items, ships);
    }
    const p = g.run.player;
    const ax = (p.px !== undefined ? p.px + (p.x - p.px) * alpha : p.x), ay = (p.py !== undefined ? p.py + (p.y - p.py) * alpha : p.y);
    const playerItem = { kind: 'p', key: ay };
    if (!(typeof Intro !== 'undefined' && Intro.hidePlayer)) items.push(playerItem);
    if (typeof Intro !== 'undefined' && Intro.sortItems) Intro.sortItems(items, g);
    items.sort((a, b) => a.key - b.key);
    let target = ctx, xctx = null, occluded = false;
    const pi = items.indexOf(playerItem);
    if (pi >= 0) for (let i = pi + 1; i < items.length; i++) if (Sorter.covers(items[i], ax, ay)) { occluded = true; break; }
    Sorter.xr = Draw.approach(Sorter.xr, occluded ? 1 : 0, Draw.dt / 0.15);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'b') {
        Draw.building(target, g, it.b, it.b.x - Render.ox, it.b.y - Render.oy);
      } else if (it.kind === 'part') Sorter.drawPart(target, g, it.b, it.part);
      else if (it.kind === 'c') Draw.drawCustomer(target, g, it.b, it.c);
      else if (it.kind === 'p') {
        Draw.astronaut(target, g, ax - Render.ox, ay - Render.oy, Draw.tm);
        if (Sorter.xr > 0.01 && !App.settings.reducedFx) { xctx = Sorter.begin(ctx); target = xctx; }
      } else if (it.draw) it.draw(target);
    }
    if (xctx) Sorter.end(ctx, xctx, ax - Render.ox, ay - Render.oy);
    // ships fly above everything
    for (let i = 0; i < ships.length; i += 2) { const b = ships[i], c = ships[i + 1]; CharArt.ship(ctx, c._wx - Render.ox, c._wy - Render.oy, c, tm, b); }
    mark('buildings');
    Render.drawParticles(ctx);
    Ground.clouds(ctx, Draw.tm);
    mark('chars+particles');
    // overlays
    Frame.overlays(ctx, g, vis, ax, ay);
    // atmosphere and lights
    const night = Render.drawAtmosphere(ctx, g, dt);
    Render.setWorldTransform(ctx);
    TerrainSys.drawEmission(ctx, night, tm);
    for (const d of deps) DepositArt.dynamic(ctx, d, tm, night, App.cam.zoom);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (night > 0.05) Frame.nightLights(ctx, g, solid, night, ax, ay);
    // UI overlays on top of the night grade: badges, level pills, floating texts
    if (App.cam.zoom >= 10) for (const b of solid) if (b.warn) BuildingArt.badge(ctx, b, tm);
    for (const b of solid) { Draw.levelTag(ctx, b); if (b.type === 'terminal' && App.cam.zoom >= 12) Frame.contractBadge(ctx, g, b); }
    Draw.flushBubbles(ctx);
    Render.drawFloating(ctx, dt);
    document.body.classList.toggle('lowq', App.quality === 'low');
    Frame.edgeMarkers(ctx, g);
    mark('overlays+atmo');
  },

  nightLights(ctx, g, solid, night, ax, ay) {
    ctx.globalCompositeOperation = 'lighter';
    const tm = Draw.tm;
    for (const b of solid) {
      const L = BuildingArt.lights(b);
      if (!L.length) continue;
      const bx = b.x - Render.ox, by = b.y - Render.oy;
      for (const [lx, ly, r, col] of L) {
        const fl = b.type === 'lamp' || b.type === 'bazaar' ? 0.92 + 0.08 * Math.sin(tm * 9 + b.id) : 1;
        ctx.globalAlpha = night * 0.62 * fl;
        ctx.drawImage(FxLib.tinted('soft', 0, col), bx + lx - r / 2, by + ly - r / 2, r, r);
      }
      // light pool on the ground under lamps
      if (b.type === 'lamp') { ctx.globalAlpha = night * 0.35; ctx.drawImage(FxLib.tinted('soft', 0, b.level >= 2 ? '#d8f0ff' : '#ffe28a'), bx - 1.3, by - 0.6, 3.6, 2.6); }
    }
    // helmet lamp of the astronaut
    ctx.globalAlpha = night * 0.5;
    ctx.drawImage(FxLib.tinted('soft', 0, '#ffe8c0'), ax - Render.ox - 2.5, ay - Render.oy - 3, 5, 5);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  contractBadge(ctx, g, b) {
    const n = g.run.contracts.length;
    const x = b.x + b.w / 2 - Render.ox, y = b.y - Render.oy - 0.6;
    const fs = Math.max(0.3, 12 / App.cam.zoom);
    ctx.font = '800 ' + fs + 'px system-ui';
    const txt = String(n), tw = ctx.measureText(txt).width + fs * 1.9;
    ctx.fillStyle = 'rgba(42,26,52,.88)'; Art.rrect(ctx, x - tw / 2, y - fs * 0.75, tw, fs * 1.5, fs * 0.75); ctx.fill();
    ctx.strokeStyle = '#ff9fd0'; ctx.lineWidth = fs * 0.08; ctx.stroke();
    // document glyph
    const gx = x - tw / 2 + fs * 0.55, gy = y;
    ctx.fillStyle = '#ffd0ea'; ctx.fillRect(gx - fs * 0.25, gy - fs * 0.35, fs * 0.5, fs * 0.7);
    ctx.fillStyle = '#7a4a8a'; for (let i = 0; i < 3; i++) ctx.fillRect(gx - fs * 0.16, gy - fs * 0.2 + i * fs * 0.17, fs * 0.32, fs * 0.06);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, gx + fs * 0.45, y + fs * 0.03);
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
        ctx.globalAlpha = 0.55 + 0.15 * Math.sin(Draw.tm * 5);
        const fake = Grid.make({ nextId: 0 }, Object.assign({}, s, { id: -1, res: gh.dep ? gh.dep.res : undefined, tier: gh.dep ? gh.dep.tier : 0 }));
        fake.w = sz.w; fake.h = sz.h; fake._sv = -5; fake.shape = 0;
        try { if (s.type !== 'bridge') Draw.building(ctx, Object.assign({}, g, { topoVersion: -5 }), fake, s.x - Render.ox, s.y - Render.oy); } catch (e) { /* preview only */ }
        ctx.globalAlpha = 1;
        Frame.footprint(ctx, s.x, s.y, sz.w, sz.h, gh.ok, 0.18 + 0.08 * Math.sin(Draw.tm * 5));
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
    // scanner: thick ring wave, trailing thin ring and a radar sweep
    const ping = g.run.scanPing;
    if (ping) {
      const k = U.clamp(ping.t / 1.6, 0, 1);
      const cx = ping.x - Render.ox, cy = ping.y - Render.oy;
      const acc = Render.palette.accent;
      const r = ping.r * Art.ease.outCubic(k), r2 = ping.r * Art.ease.outCubic(U.clamp((ping.t - 0.18) / 1.6, 0, 1));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.drawImage(FxLib.tinted('ringThick', 0, acc), cx - r, cy - r, r * 2, r * 2);
      ctx.globalAlpha = (1 - k) * 0.6;
      if (r2 > 0.1) ctx.drawImage(FxLib.tinted('ring', 0, '#ffffff'), cx - r2, cy - r2, r2 * 2, r2 * 2);
      const sw = Math.min(ping.r, 3 + ping.t * ping.r);
      ctx.globalAlpha = Math.max(0, 1 - ping.t / 2.5) * 0.55;
      ctx.translate(cx, cy); ctx.rotate(ping.t * 5);
      ctx.drawImage(FxLib.tinted('radar', 0, acc), -sw, -sw, sw * 2, sw * 2);
      ctx.restore();
    }
    // freshly scanned deposits pop up in the world (staggered, with overshoot)
    for (const m of Render.edgeMarks) {
      if (!m.scan) continue;
      const age = App.now - m.at;
      if (age < 0 || age > 4500) continue;
      const sc = age < 260 ? Art.ease.outBack(age / 260) : 1;
      const fade = age > 3800 ? 1 - (age - 3800) / 700 : 1;
      const x = m.x - Render.ox, y = m.y - Render.oy;
      const s = Math.max(0.5, 16 / App.cam.zoom) * sc;
      ctx.save(); ctx.globalAlpha = fade;
      ctx.strokeStyle = m.color; ctx.lineWidth = s * 0.12;
      ctx.beginPath(); ctx.arc(x, y, s * (1 + 0.15 * Math.sin(Draw.tm * 6)), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = m.color; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = s * 0.08;
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x - s * 0.35, y - s * 1.2); ctx.arc(x, y - s * 1.3, s * 0.38, Math.PI * 0.8, Math.PI * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // soft landing zones: pulsing hazard frame while a ship touches down
    for (const z of Collide.zones) {
      const a = 0.45 + 0.35 * Math.sin(Draw.tm * 8);
      ctx.strokeStyle = 'rgba(255,194,77,' + a.toFixed(2) + ')'; ctx.lineWidth = 0.12; ctx.setLineDash([0.4, 0.25]); ctx.lineDashOffset = -Draw.tm * 1.5;
      ctx.strokeRect(z[0] - Render.ox, z[1] - Render.oy, z[2] - z[0], z[3] - z[1]); ctx.setLineDash([]);
    }
    // debug: hitboxes, foot lines and sort keys
    if (App.debug.hitboxes) {
      ctx.lineWidth = 2 / Render.S; ctx.font = (11 / Render.S) + 'px system-ui'; ctx.textAlign = 'left';
      for (const b of vis) {
        for (const r of Collide.boxes(b)) { ctx.strokeStyle = 'rgba(255,80,80,.9)'; ctx.strokeRect(r[0] - Render.ox, r[1] - Render.oy, r[2] - r[0], r[3] - r[1]); }
        if (Collide.mode(b.type) === 'none') continue;
        const fy = Sorter.footY(b) - Render.oy;
        ctx.strokeStyle = 'rgba(80,200,255,.9)'; ctx.beginPath(); ctx.moveTo(b.x - Render.ox, fy); ctx.lineTo(b.x + b.w - Render.ox, fy); ctx.stroke();
        ctx.fillStyle = '#7fd3ff'; ctx.fillText((Sorter.footY(b)).toFixed(1), b.x - Render.ox, fy - 0.05);
      }
      for (const r of Collide.extra) { ctx.strokeStyle = 'rgba(255,160,60,.9)'; ctx.strokeRect(r[0] - Render.ox, r[1] - Render.oy, r[2] - r[0], r[3] - r[1]); }
      const pl = g.run.player; ctx.strokeStyle = '#9bff8c'; ctx.beginPath(); ctx.arc(ax - Render.ox, ay - Render.oy, 0.28, 0, Math.PI * 2); ctx.stroke();
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
      ctx.setLineDash([0.22, 0.14]); ctx.lineDashOffset = -Draw.tm * 1.2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox, oy); ctx.stroke();
      ctx.setLineDash([]);
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
      const age = m.at !== undefined ? now - m.at : 1000;
      if (age < 0) continue;
      const pop = age < 260 ? Art.ease.outBack(age / 260) : 1;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang); ctx.scale(pop, pop);
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
