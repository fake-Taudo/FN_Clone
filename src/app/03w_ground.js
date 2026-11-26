// =====================================================================
// Ground: the ground tells the story of play. Boot prints (left/right,
// oriented, with depth; fade 20-40 s, faster on dust), rover and alien
// tracks, a wear map that turns busy routes into trampled paths, a
// foundation zone under every building, a contact ring that anchors
// deposits, drifting cloud shadows and sand blowing over dune crests.
// =====================================================================
const Ground = {
  prints: [], wear: new Map(), lastStep: null,
  // ---------------- prints ----------------
  printSprite(kind, ppt) {
    return Art.cached('P|PR|' + kind + '|' + ppt, () => {
      const W = kind === 'rover' ? 1.0 : 0.42, H = kind === 'rover' ? 0.8 : 0.26;
      const c = Art.canvas(W * ppt, H * ppt), x = c.getContext('2d');
      x.scale(ppt, ppt); x.translate(W / 2, H / 2);
      const dark = Col.rgba(Col.shade(Render.palette.ground[1], -0.55), 0.55), lite = 'rgba(255,240,220,.35)';
      if (kind === 'rover') {
        for (const sy of [-0.3, 0.3]) {
          x.fillStyle = dark; x.fillRect(-0.45, sy - 0.07, 0.9, 0.14);
          x.fillStyle = lite; x.fillRect(-0.45, sy + 0.06, 0.9, 0.02);
          x.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 0; i < 9; i++) x.fillRect(-0.44 + i * 0.1, sy - 0.07, 0.03, 0.14);
        }
      } else if (kind === 'paw') {
        x.fillStyle = dark; x.beginPath(); x.ellipse(0, 0.02, 0.06, 0.05, 0, 0, Math.PI * 2); x.fill();
        for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(0.07, -0.05 + i * 0.05, 0.022, 0, Math.PI * 2); x.fill(); }
      } else {
        // boot sole pointing along +x, tread lines, lit lower rim for depth (light from top left)
        x.fillStyle = dark; Art.rrect(x, -0.16, -0.065, 0.32, 0.13, 0.06); x.fill();
        x.strokeStyle = lite; x.lineWidth = 0.018; x.beginPath(); x.moveTo(-0.14, 0.07); x.lineTo(0.14, 0.07); x.stroke();
        x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 0.015; x.beginPath(); for (let i = 0; i < 5; i++) { x.moveTo(-0.12 + i * 0.055, -0.05); x.lineTo(-0.12 + i * 0.055, 0.05); } x.stroke();
      }
      return { canvas: c, w: W, h: H };
    });
  },
  addPrint(kind, x, y, a, side) {
    if (Ground.prints.length > 260) Ground.prints.shift();
    const mat = TerrainSys.matAt(x, y);
    const life = (mat === 0 ? 20 : mat === 1 ? 24 : 34) + Math.random() * 6; // dust and sand blow prints away faster
    Ground.prints.push({ kind, x, y, a, side, t: 0, life });
  },
  update(g, dt) {
    const P = Ground.prints;
    for (let i = P.length - 1; i >= 0; i--) { P[i].t += dt; if (P[i].t > P[i].life) P.splice(i, 1); }
    const p = g.run.player;
    if (!p.moving) { Ground.lastStep = null; return; }
    if (!Ground.lastStep) { Ground.lastStep = { x: p.x, y: p.y, side: 1 }; return; }
    const L = Ground.lastStep;
    const rover = g.run.research.done.has('rover');
    const dist = Math.hypot(p.x - L.x, p.y - L.y);
    if (dist < (rover ? 0.5 : 0.36)) return;
    const a = Math.atan2(p.y - L.y, p.x - L.x);
    L.side = -L.side;
    const ox = Math.cos(a + Math.PI / 2) * 0.09 * L.side, oy = Math.sin(a + Math.PI / 2) * 0.09 * L.side;
    Ground.addPrint(rover ? 'rover' : 'boot', p.x + (rover ? 0 : ox), p.y - 0.02 + (rover ? 0 : oy), a, L.side);
    Ground.tread(p.x, p.y, rover ? 0.06 : 0.035);
    L.x = p.x; L.y = p.y;
    if (!App.settings.reducedFx && !rover && Math.random() < 0.5) Render.spawn('dust', p.x + ox, p.y + oy, -Math.cos(a) * 0.3, -0.15, 0.7, Render.palette.particle, 0.09);
  },
  draw(ctx) {
    const ppt = Art.bucket(Render.ppt(), 96);
    for (const f of Ground.prints) {
      const s = Ground.printSprite(f.kind, ppt);
      const k = f.t / f.life;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.save(); ctx.translate(f.x - Render.ox, f.y - Render.oy); ctx.rotate(f.a);
      ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2, s.w, s.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },
  // ---------------- wear map (trampled paths) ----------------
  tread(x, y, amount) {
    const S = CONFIG.chunkSize, cx = Math.floor(x / S), cy = Math.floor(y / S);
    const key = cx + ',' + cy;
    let w = Ground.wear.get(key);
    if (!w) { w = { a: new Float32Array(S * S), c: null, dirty: true, cx, cy, built: 0, bb: null }; Ground.wear.set(key, w); }
    const tx = Math.floor(x) - cx * S, ty = Math.floor(y) - cy * S, i = ty * S + tx;
    const before = Math.round(w.a[i] * 120);
    w.a[i] = Math.min(1, w.a[i] + amount);
    if (Math.round(w.a[i] * 120) !== before) w.dirty = true;
  },
  // trampled paths: one small overlay per worn chunk, rebuilt at most every 0.5 s and drawn only over the worn area
  drawWear(ctx, vr) {
    const S = CONFIG.chunkSize, col = Col.rgb(Col.shade(Render.palette.ground[0], -0.25));
    for (const w of Ground.wear.values()) {
      if ((w.cx + 1) * S < vr.x0 || w.cx * S > vr.x1 || (w.cy + 1) * S < vr.y0 || w.cy * S > vr.y1) continue;
      if ((w.dirty && App.now - w.built > 500) || !w.c) {
        w.dirty = false; w.built = App.now;
        if (!w.c) w.c = Art.canvas(S, S);
        const x = w.c.getContext('2d'), img = x.createImageData(S, S);
        let x0 = S, y0 = S, x1 = -1, y1 = -1;
        for (let i = 0; i < S * S; i++) {
          const v = w.a[i], al = Math.min(1, v) * 120;
          img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = al;
          if (al >= 1) { const xx = i % S, yy = (i / S) | 0; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
        }
        x.putImageData(img, 0, 0);
        w.bb = x1 < 0 ? null : [Math.max(0, x0 - 1), Math.max(0, y0 - 1), Math.min(S, x1 + 2), Math.min(S, y1 + 2)];
      }
      if (!w.bb) continue;
      const b = w.bb;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(w.c, b[0], b[1], b[2] - b[0], b[3] - b[1], w.cx * S + b[0] - Render.ox, w.cy * S + b[1] - Render.oy, b[2] - b[0], b[3] - b[1]);
    }
  },
  // slow decay (paths fade over many minutes): evaluated every 2 s, marked dirty only on a visible change
  decayWear(dt) {
    Ground.decayAcc = (Ground.decayAcc || 0) + dt;
    if (Ground.decayAcc < 2) return;
    const d = Ground.decayAcc * 0.0008; Ground.decayAcc = 0;
    for (const [k, w] of Ground.wear) {
      let any = false, changed = false;
      for (let i = 0; i < w.a.length; i++) {
        const v = w.a[i]; if (v <= 0) continue;
        const nv = Math.max(0, v - d); if (Math.round(nv * 120) !== Math.round(v * 120)) changed = true;
        w.a[i] = nv; if (nv > 0) any = true;
      }
      if (changed) w.dirty = true;
      if (!any) Ground.wear.delete(k);
    }
  },
  // ---------------- foundation zones ----------------
  NO_FOUND: { belt: 1, path: 1, fence: 1, lamp: 1, flag: 1, beacon: 1, bridge: 1, splitter: 1, merger: 1, crossing: 1, fsplitter: 1, osplitter: 1 },
  foundation(type, w, h, ppt) {
    return Art.cached('P|FD|' + type + '|' + w + 'x' + h + '|' + ppt, () => {
      const M = 0.55, W = w + M * 2, H = h + M * 2;
      const c = Art.canvas(W * ppt, H * ppt), x = c.getContext('2d');
      x.scale(ppt, ppt); x.translate(M, M);
      const rnd = RNG.mulberry32(RNG.hash(RNG.hashString(type), w, h));
      const dust = Col.shade(Render.palette.ground[2], 0.12), dark = Col.shade(Render.palette.ground[0], -0.2);
      // displaced dust rim (light) around a compacted, darker pad
      const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, Col.rgba(dark, 0.28)); g.addColorStop(0.75, Col.rgba(dark, 0.12)); g.addColorStop(1, Col.rgba(dark, 0));
      x.fillStyle = g; Art.rrect(x, -M * 0.6, -M * 0.6, w + M * 1.2, h + M * 1.2, 0.5); x.fill();
      x.strokeStyle = Col.rgba(dust, 0.45); x.lineWidth = 0.22; Art.rrect(x, -0.32, -0.32, w + 0.64, h + 0.64, 0.45); x.stroke();
      // skid marks and small debris / bolts
      x.strokeStyle = Col.rgba(dark, 0.35); x.lineWidth = 0.05;
      for (let i = 0; i < 3 + w; i++) { const sx = rnd() * w, sy = h + 0.1 + rnd() * 0.3; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (rnd() - 0.5) * 0.8, sy + 0.25); x.stroke(); }
      for (let i = 0; i < 4 + w * 2; i++) {
        const a = rnd() * 6.283, px = w / 2 + Math.cos(a) * (w / 2 + 0.15 + rnd() * 0.3), py = h / 2 + Math.sin(a) * (h / 2 + 0.15 + rnd() * 0.3);
        x.fillStyle = rnd() < 0.5 ? 'rgba(160,165,175,.8)' : Col.rgba(dark, 0.6); x.fillRect(px, py, 0.05 + rnd() * 0.05, 0.04);
      }
      if (REFINERY_LEVEL[type] || type === 'cooler') { const sg = x.createRadialGradient(w * 0.8, h * 0.2, 0, w * 0.8, h * 0.2, 1.6); sg.addColorStop(0, 'rgba(20,16,18,.35)'); sg.addColorStop(1, 'rgba(20,16,18,0)'); x.fillStyle = sg; x.fillRect(-M, -M, W, H); }
      return { canvas: c, w: W, h: H, m: M };
    });
  },
  drawFoundations(ctx, list) {
    if (App.cam.zoom < 18) return;
    const ppt = Art.bucket(Render.ppt(), 48);
    for (const b of list) {
      if (Ground.NO_FOUND[b.type]) continue;
      const s = Ground.foundation(b.type, b.w, b.h, ppt);
      ctx.drawImage(s.canvas, b.x - Render.ox - s.m, b.y - Render.oy - s.m, s.w, s.h);
    }
  },
  // ---------------- deposit anchoring (the deposit sprite itself stays unchanged) ----------------
  depositRing(d, ppt) {
    return Art.cached('P|DR|' + d.id + '|' + ppt, () => {
      const bb = DepositArt.bbox(d), M = 1.2;
      const W = bb.x1 - bb.x0 + M * 2, H = bb.y1 - bb.y0 + M * 2;
      const c = Art.canvas(W * ppt, H * ppt), x = c.getContext('2d');
      x.scale(ppt, ppt); x.translate(M - bb.x0, M - bb.y0);
      const rnd = RNG.mulberry32(RNG.hash(d.id & 0x7fffffff, 91));
      const dark = Col.shade(Render.palette.ground[0], -0.35), dust = Col.shade(Render.palette.ground[2], 0.1);
      for (const t of d.tiles) {
        const g = x.createRadialGradient(t[0] + 0.55, t[1] + 0.6, 0.2, t[0] + 0.55, t[1] + 0.6, 1.05);
        g.addColorStop(0, Col.rgba(dark, 0.32)); g.addColorStop(1, Col.rgba(dark, 0));
        x.fillStyle = g; x.fillRect(t[0] - 0.6, t[1] - 0.5, 2.3, 2.3);
      }
      // thrown-up dust and gravel around the rim
      for (let i = 0; i < d.tiles.length * 7; i++) {
        const t = d.tiles[i % d.tiles.length], a = rnd() * 6.283, r = 0.75 + rnd() * 0.45;
        const px = t[0] + 0.5 + Math.cos(a) * r, py = t[1] + 0.5 + Math.sin(a) * r * 0.85;
        x.fillStyle = rnd() < 0.6 ? Col.rgba(dust, 0.55) : Col.rgba(dark, 0.5);
        x.beginPath(); x.ellipse(px, py, 0.04 + rnd() * 0.05, 0.03 + rnd() * 0.03, rnd() * 3, 0, Math.PI * 2); x.fill();
      }
      return { canvas: c, ox: bb.x0 - M, oy: bb.y0 - M, w: W, h: H };
    });
  },
  // ---------------- atmosphere ----------------
  // drifting cloud shadows (<= 8 %): a few soft blobs per 90-tile cell instead of a full-screen texture,
  // so the raster cost follows the shaded area only; far and medium zoom only
  clouds(ctx, tm) {
    if (App.quality === 'low' || App.settings.reducedFx) return;
    const zk = 1 - Math.max(0, Math.min(1, (App.cam.zoom - 10) / 6));
    if (zk <= 0.02) return;
    const T = 90, w = Render.look.wind || 0;
    const sx = tm * 0.9 * Math.cos(w), sy = tm * 0.9 * Math.sin(w);
    const vr = Render.visibleRect(24);
    const spr = FxLib.tinted('soft', 0, '#2a1830');
    ctx.save(); ctx.globalAlpha = 0.075 * zk;
    for (let cy = Math.floor((vr.y0 - sy) / T); cy <= Math.floor((vr.y1 - sy) / T); cy++) for (let cx = Math.floor((vr.x0 - sx) / T); cx <= Math.floor((vr.x1 - sx) / T); cx++) {
      for (let i = 0; i < 4; i++) {
        const h = RNG.hash(cx, cy, i * 131 + 7);
        if ((h & 255) < 90) continue;
        const bx = cx * T + ((h >>> 8) & 255) / 255 * T + sx, by = cy * T + ((h >>> 16) & 255) / 255 * T + sy;
        const rw = 12 + ((h >>> 24) & 15) * 1.4, rh = rw * (0.55 + ((h >>> 4) & 7) * 0.05);
        if (bx + rw < vr.x0 || bx - rw > vr.x1 || by + rh < vr.y0 || by - rh > vr.y1) continue;
        ctx.drawImage(spr, bx - rw - Render.ox, by - rh - Render.oy, rw * 2, rh * 2);
      }
    }
    ctx.restore();
  },
  // sand blowing over dune crests near the player
  sandDrift(g, dt) {
    if (App.settings.reducedFx || App.quality === 'low' || !App.settings.weather) return;
    const vr = Render.visibleRect(0), w = Render.look.wind || 0;
    const n = Math.random() < dt * 10 ? 1 : 0;
    for (let i = 0; i < n * 3; i++) {
      const x = vr.x0 + Math.random() * (vr.x1 - vr.x0), y = vr.y0 + Math.random() * (vr.y1 - vr.y0);
      if (TerrainSys.matAt(x, y) !== 1) continue;
      Render.spawn('mote', x, y, Math.cos(w) * 2.4, Math.sin(w) * 1.0, 1.6, Col.shade(Render.palette.particle, 0.1), 0.05);
    }
  }
};
