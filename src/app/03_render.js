// =====================================================================
// Render: camera, terrain chunks, decorations, deposits, particles, overlays
// =====================================================================
const Render = {
  canvas: null, ctx: null,
  chunks: new Map(), chunkGenBudget: 2,
  ox: 0, oy: 0, S: 1,
  particles: [], pool: [],
  palette: null, planetStyle: 1,
  floating: [],
  edgeMarks: [],
  stormT: 0, storm: 0, nextStorm: 300,

  init(canvas) {
    Render.canvas = canvas;
    Render.ctx = canvas.getContext('2d', { alpha: false });
    Render.resize();
  },
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, hh = window.innerHeight;
    App.view.w = w; App.view.h = hh; App.view.dpr = dpr;
    Render.canvas.width = Math.round(w * dpr);
    Render.canvas.height = Math.round(hh * dpr);
  },
  setPlanet(planet) {
    Render.chunks.clear();
    Render.palette = planet;
    Render.planetStyle = planet.index <= 8 ? planet.index : (RNG.hash(planet.index, 3) % 8) + 1;
    document.documentElement.style.setProperty('--accent', planet.accent);
    const lum = Col.rgb(planet.accent).reduce((a, c, i) => a + c * [0.299, 0.587, 0.114][i], 0);
    document.documentElement.style.setProperty('--accent-ink', lum > 140 ? '#160b04' : '#ffffff');
  },

  // ---------------- coordinates ----------------
  worldToScreen(x, y) {
    const c = App.cam;
    return [(x - c.x) * c.zoom + App.view.w / 2, (y - c.y) * c.zoom + App.view.h / 2];
  },
  screenToWorld(sx, sy) {
    const c = App.cam;
    return [(sx - App.view.w / 2) / c.zoom + c.x, (sy - App.view.h / 2) / c.zoom + c.y];
  },
  visibleRect(margin = 2) {
    const c = App.cam;
    const hw = App.view.w / 2 / c.zoom, hh = App.view.h / 2 / c.zoom;
    return { x0: Math.floor(c.x - hw - margin), y0: Math.floor(c.y - hh - margin), x1: Math.ceil(c.x + hw + margin), y1: Math.ceil(c.y + hh + margin) };
  },
  setWorldTransform(ctx) {
    const c = App.cam, d = App.view.dpr;
    Render.ox = Math.floor(c.x); Render.oy = Math.floor(c.y);
    const S = d * c.zoom;
    Render.S = S;
    ctx.setTransform(S, 0, 0, S, d * App.view.w / 2 - S * (c.x - Render.ox), d * App.view.h / 2 - S * (c.y - Render.oy));
  },

  // ---------------- terrain ----------------
  smooth(a, b, x) { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); },
  terrainColor(w, x, y, out) {
    const P = Render.palette, st = Render.planetStyle;
    const t = World.terrain(w, x, y);
    const v = U.clamp(t.e * 0.6 + 0.5, 0, 1);
    const band = v * 4, fl = Math.floor(band);
    const vv = (fl + Render.smooth(0.4, 0.6, band - fl)) / 4;
    const g0 = Col.rgb(P.ground[0]), g1 = Col.rgb(P.ground[1]), g2 = Col.rgb(P.ground[2]);
    let r, g, b;
    if (vv < 0.5) { const k = vv * 2; r = g0[0] + (g1[0] - g0[0]) * k; g = g0[1] + (g1[1] - g0[1]) * k; b = g0[2] + (g1[2] - g0[2]) * k; }
    else { const k = (vv - 0.5) * 2; r = g1[0] + (g2[0] - g1[0]) * k; g = g1[1] + (g2[1] - g1[1]) * k; b = g1[2] + (g2[2] - g1[2]) * k; }
    const wDune = Render.smooth(0.15, 0.35, t.b), wCrater = Render.smooth(-0.2, -0.4, t.b);
    const wRock = Render.smooth(0.15, 0.35, t.r), wRub = Render.smooth(-0.15, -0.35, t.r);
    let f = 1 + t.d * 0.05;
    if (wDune > 0) { const rip = Math.sin(x * 1.1 + y * 0.45 + t.e * 7); f *= 1 + wDune * (0.07 + rip * 0.04); }
    if (wCrater > 0) f *= 1 - wCrater * 0.12;
    if (wRub > 0 && t.d > 0.25) f *= 1 - wRub * 0.1;
    r *= f; g *= f; b *= f;
    if (wRock > 0) { const rc = Col.rgb(P.rock); const k = wRock * 0.35; r += (rc[0] - r) * k; g += (rc[1] - g) * k; b += (rc[2] - b) * k; }
    // planet specific
    if (st === 2 && t.e < -0.42) { const k = Render.smooth(-0.42, -0.55, t.e); const a = Col.rgb(P.accent); r += (a[0] - r) * k * 0.75; g += (a[1] - g) * k * 0.75; b += (a[2] - b) * k * 0.75; }
    if (st === 3 && t.d > 0.45) { r += (255 - r) * 0.3; g += (255 - g) * 0.3; b += (255 - b) * 0.3; }
    if (st === 4) { const vein = Math.abs(w.noiseC.noise2(x / 14, y / 14)); if (vein < 0.05) { const k = 1 - vein / 0.05; r += (255 - r) * k * 0.85; g += (110 - g) * k * 0.85; b += (30 - b) * k * 0.85; } }
    if (st === 5 && t.d > 0.3) { const k = Render.smooth(0.3, 0.6, t.d) * 0.4; const a = t.b > 0 ? [140, 220, 120] : [170, 100, 230]; r += (a[0] - r) * k; g += (a[1] - g) * k; b += (a[2] - b) * k; }
    if (st === 6) { const gx = ((x % 8) + 8) % 8, gy = ((y % 8) + 8) % 8; if (gx < 0.12 || gy < 0.12) { r += 30; g += 60; b += 80; } }
    if (st === 7 && t.d > 0.55) { r += 40; g += 40; b += 50; }
    if (st === 8 && w.noiseC.noise2(x * 3.1, y * 3.1) > 0.78) { r = 220; g = 220; b = 255; }
    const sky = P.sky;
    out[0] = r * 0.95 + sky[0] * 0.05; out[1] = g * 0.95 + sky[1] * 0.05; out[2] = b * 0.95 + sky[2] * 0.05;
  },
  genChunk(g, cx, cy) {
    const S = CONFIG.chunkSize;
    const spt = App.quality === 'low' ? 2 : 3;
    const n = S * spt;
    const c = document.createElement('canvas'); c.width = c.height = n;
    const x = c.getContext('2d');
    const img = x.createImageData(n, n);
    const d = img.data, col = [0, 0, 0];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      Render.terrainColor(g.world, cx * S + (i + 0.5) / spt, cy * S + (j + 0.5) / spt, col);
      const o = (j * n + i) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  },
  drawTerrain(ctx, g, vr) {
    const S = CONFIG.chunkSize;
    const cx0 = Math.floor(vr.x0 / S), cy0 = Math.floor(vr.y0 / S), cx1 = Math.floor(vr.x1 / S), cy1 = Math.floor(vr.y1 / S);
    let budget = Render.chunkGenBudget;
    ctx.imageSmoothingEnabled = true;
    const P = Render.palette;
    const need = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = U.chunkKey(cx, cy);
      let ch = Render.chunks.get(key);
      const rx = cx * S - Render.ox, ry = cy * S - Render.oy;
      if (ch) { ch.last = App.frame; ctx.drawImage(ch.canvas, rx, ry, S + 0.02, S + 0.02); }
      else {
        ctx.fillStyle = P.ground[1]; ctx.fillRect(rx, ry, S + 0.02, S + 0.02);
        need.push([cx, cy, U.dist2(cx * S + 16, cy * S + 16, App.cam.x, App.cam.y)]);
      }
    }
    need.sort((a, b) => a[2] - b[2]);
    for (const [cx, cy] of need) {
      if (budget-- <= 0) break;
      Render.chunks.set(U.chunkKey(cx, cy), { canvas: Render.genChunk(g, cx, cy), last: App.frame });
    }
    if (Render.chunks.size > 160) {
      const arr = [...Render.chunks.entries()].sort((a, b) => a[1].last - b[1].last);
      for (let i = 0; i < arr.length - 120; i++) Render.chunks.delete(arr[i][0]);
    }
  },

  drawDecor(ctx, g, vr) {
    const S = CONFIG.chunkSize, P = Render.palette, st = Render.planetStyle;
    const z = App.cam.zoom;
    const cx0 = Math.floor(vr.x0 / S), cy0 = Math.floor(vr.y0 / S), cx1 = Math.floor(vr.x1 / S), cy1 = Math.floor(vr.y1 / S);
    const rock = P.rock, deco = P.deco;
    const tm = App.now / 1000;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      for (const d of World.chunkDecor(g.world, cx, cy)) {
        if (d.x < vr.x0 - 4 || d.x > vr.x1 + 4 || d.y < vr.y0 - 4 || d.y > vr.y1 + 4) continue;
        const x = d.x - Render.ox, y = d.y - Render.oy;
        switch (d.type) {
          case 'crater': {
            ctx.fillStyle = 'rgba(0,0,0,.16)';
            ctx.beginPath(); ctx.ellipse(x, y, d.size, d.size * 0.82, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,.12)';
            ctx.beginPath(); ctx.ellipse(x + d.size * 0.08, y + d.size * 0.1, d.size * 0.72, d.size * 0.58, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = Math.min(0.12, d.size * 0.05);
            ctx.beginPath(); ctx.ellipse(x, y, d.size, d.size * 0.82, 0, Math.PI * 1.05, Math.PI * 1.65); ctx.stroke();
            break;
          }
          case 'rock': {
            const r = d.size;
            ctx.fillStyle = 'rgba(0,0,0,.22)';
            ctx.beginPath(); ctx.ellipse(x + r * 0.2, y + r * 0.35, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = st === 7 ? Col.mix(rock, '#ffffff', 0.4 + 0.2 * Math.sin(tm * 2 + d.v * 9)) : rock;
            ctx.beginPath();
            const n = 6;
            for (let i = 0; i < n; i++) { const a = d.rot + i * Math.PI * 2 / n; const rr = r * (0.75 + ((d.v * 997 * (i + 1)) % 1) * 0.35); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.8; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.14)';
            ctx.beginPath(); ctx.ellipse(x - r * 0.2, y - r * 0.25, r * 0.4, r * 0.25, -0.4, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'pebble':
            if (z < 18) break;
            ctx.fillStyle = Col.rgba(rock, 0.8);
            ctx.beginPath(); ctx.arc(x, y, d.size, 0, Math.PI * 2); ctx.fill();
            break;
          case 'vein':
            ctx.strokeStyle = st === 4 ? Col.rgba('#ff7a2a', 0.55 + 0.25 * Math.sin(tm * 2 + d.v * 7)) : Col.rgba(deco, 0.35);
            ctx.lineWidth = st === 4 ? 0.12 : 0.07; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + Math.cos(d.rot + 0.7) * d.size, y + Math.sin(d.rot + 0.7) * d.size, x + Math.cos(d.rot) * d.size * 2, y + Math.sin(d.rot) * d.size * 2);
            ctx.stroke();
            break;
          case 'ripple':
            if (z < 14) break;
            ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
              const yy = y + i * 0.3, len = d.size * (0.6 + 0.2 * i);
              ctx.moveTo(x - len / 2, yy);
              ctx.bezierCurveTo(x - len / 6, yy - 0.18, x + len / 6, yy + 0.18, x + len / 2, yy);
            }
            ctx.stroke();
            break;
        }
        if (st === 5 && d.type === 'pebble' && z >= 18) {
          // little alien plants on Viridia
          ctx.fillStyle = d.v > 0.5 ? '#8aff9a' : '#c07aff';
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + (i - 1) * 0.12, y - 0.15, 0.06, 0.22, (i - 1) * 0.5, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    }
  },

  // ---------------- deposits ----------------
  drawDeposits(ctx, g, vr) {
    const deps = World.depositsInRect(g.world, vr.x0, vr.y0, vr.x1, vr.y1);
    const tm = App.now / 1000;
    const fx = !App.settings.reducedFx;
    for (const d of deps) {
      const R = DATA.RESOURCES[d.res], T = DATA.TIERS[d.tier];
      const glowCol = d.tier === 7 ? Col.prism(tm, 0) : T.color;
      const pulse = d.tier === 6 ? 0.75 + 0.25 * Math.sin(tm * 3) : 1;
      // ground patch
      for (const t of d.tiles) {
        const x = t[0] - Render.ox, y = t[1] - Render.oy;
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        Render.roundRect(ctx, x + 0.04, y + 0.04, 0.92, 0.92, 0.25); ctx.fill();
        ctx.fillStyle = Col.rgba(Col.shade(R.color, -0.45), 0.55);
        Render.roundRect(ctx, x + 0.08, y + 0.08, 0.84, 0.84, 0.22); ctx.fill();
      }
      if (d.tier > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.12 + T.glow * 0.45) * pulse;
        const spr = Sprites.glow(glowCol);
        for (const t of d.tiles) ctx.drawImage(spr, t[0] - Render.ox - 0.6, t[1] - Render.oy - 0.6, 2.2, 2.2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      // crystals / ore lumps
      for (let i = 0; i < d.tiles.length; i++) {
        const t = d.tiles[i];
        const hsh = RNG.hash(t[0], t[1], d.res);
        const x = t[0] - Render.ox, y = t[1] - Render.oy;
        const n = 2 + (hsh % 2);
        for (let k = 0; k < n; k++) {
          const px = x + 0.25 + ((hsh >> (k * 4)) & 15) / 15 * 0.5;
          const py = y + 0.3 + ((hsh >> (k * 4 + 2)) & 15) / 15 * 0.45;
          const s = 0.16 + ((hsh >> (k * 3 + 8)) & 7) / 7 * 0.12;
          ctx.save(); ctx.translate(px, py);
          const fill = d.tier === 7 ? Col.prism(tm, k * 60 + i * 30) : R.color;
          if (d.tier >= 2) {
            // crystal shard
            ctx.rotate(((hsh >> (k + 5)) & 7) / 7 * 0.6 - 0.3);
            ctx.beginPath(); ctx.moveTo(0, -s * 1.6); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s * 0.6); ctx.lineTo(-s * 0.6, 0); ctx.closePath();
            ctx.fillStyle = Col.shade(fill, 0.15); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, -s * 1.6); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s * 0.6); ctx.closePath();
            ctx.fillStyle = Col.shade(fill, -0.2); ctx.fill();
          } else {
            ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.75, 0, 0, Math.PI * 2);
            ctx.fillStyle = fill; ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(-s * 0.3, -s * 0.25, s * 0.3, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }
      }
      if (fx && d.tier >= 3 && Math.random() < 0.02 * d.tier * (App.quality === 'low' ? 0.3 : 1)) {
        const t = d.tiles[Math.floor(Math.random() * d.tiles.length)];
        Render.spawn('spark', t[0] + Math.random(), t[1] + Math.random(), (Math.random() - 0.5) * 0.3, -0.4 - Math.random() * 0.4, 1.2, glowCol, 0.08);
      }
      // known marker when zoomed out
      if (g.world.known.has(d.id) && App.cam.zoom < 22) {
        const x = d.x + 0.5 - Render.ox, y = d.y - 0.6 - Render.oy;
        const s = 10 / App.cam.zoom;
        ctx.fillStyle = T.color; ctx.strokeStyle = '#000'; ctx.lineWidth = s * 0.2;
        ctx.beginPath(); ctx.moveTo(x, y + s * 1.4); ctx.lineTo(x - s, y); ctx.arc(x, y, s, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
  },

  roundRect(ctx, x, y, w, hh, r) {
    r = Math.min(r, w / 2, hh / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + hh - r); ctx.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh);
    ctx.lineTo(x + r, y + hh); ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  },

  // ---------------- particles ----------------
  maxParticles() { return App.settings.reducedFx ? 60 : App.quality === 'low' ? 150 : App.quality === 'medium' ? 400 : 900; },
  spawn(type, x, y, vx, vy, life, color, size) {
    if (Render.particles.length >= Render.maxParticles()) return;
    const p = Render.pool.pop() || {};
    p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.color = color; p.size = size;
    Render.particles.push(p);
  },
  updateParticles(dt) {
    const arr = Render.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) { arr[i] = arr[arr.length - 1]; arr.pop(); Render.pool.push(p); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'coin') p.vy += 3 * dt;
      if (p.type === 'smoke' || p.type === 'dust') { p.vx *= 0.98; p.vy *= 0.98; p.size += dt * 0.2; }
    }
  },
  drawParticles(ctx) {
    for (const p of Render.particles) {
      const a = U.clamp(p.life / p.max, 0, 1);
      const x = p.x - Render.ox, y = p.y - Render.oy;
      if (p.type === 'spark' || p.type === 'jet') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.type === 'coin') {
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#a06a00'; ctx.lineWidth = 0.03;
        ctx.beginPath(); ctx.ellipse(x, y, p.size, p.size * (0.6 + 0.4 * Math.abs(Math.sin(p.life * 10))), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },

  // Floating texts (+12 ET) in world space.
  float(text, x, y, color = '#7dff8a') {
    if (Render.floating.length > 40) Render.floating.shift();
    Render.floating.push({ text, x, y, t: 0, color });
  },
  drawFloating(ctx, dt) {
    const z = App.cam.zoom;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = Render.floating.length - 1; i >= 0; i--) {
      const f = Render.floating[i];
      f.t += dt;
      if (f.t > 1.6) { Render.floating.splice(i, 1); continue; }
      const a = 1 - Math.max(0, f.t - 1) / 0.6;
      const fs = Math.max(13, 15) / z;
      ctx.font = '700 ' + fs + 'px system-ui, sans-serif';
      ctx.globalAlpha = a;
      ctx.lineWidth = fs * 0.22; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      const x = f.x - Render.ox, y = f.y - Render.oy - f.t * 0.8;
      ctx.strokeText(f.text, x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
  },

  // ---------------- atmosphere ----------------
  dayNight(g) {
    if (!App.settings.dayNight) return 0;
    const cycle = 600;
    const ph = ((g.run.time % cycle) / cycle) * Math.PI * 2;
    return U.clamp(-Math.cos(ph) * 0.9 - 0.1, 0, 1) * (Render.planetStyle === 8 ? 0.6 : 1);
  },
  devils: [],
  updateDevils(g, dt) {
    if (App.settings.reducedFx || !App.settings.weather || App.quality === 'low') { Render.devils.length = 0; return; }
    if (Render.devils.length < 2 && Math.random() < dt * 0.04) {
      const p = g.run.player, a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 10;
      Render.devils.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, life: 8 + Math.random() * 6 });
    }
    for (let i = Render.devils.length - 1; i >= 0; i--) {
      const dv = Render.devils[i];
      dv.life -= dt; dv.x += dv.vx * dt; dv.y += dv.vy * dt;
      if (dv.life <= 0) { Render.devils.splice(i, 1); continue; }
      const k = Math.min(1, dv.life / 2, 1);
      for (let j = 0; j < 2; j++) {
        const ang = App.now / 120 + j * Math.PI + Math.random() * 0.5, r = 0.3 + Math.random() * 0.6;
        Render.spawn('dust', dv.x + Math.cos(ang) * r, dv.y + Math.sin(ang) * r * 0.5 - Math.random() * 0.8, -Math.sin(ang) * 1.5 * k, Math.cos(ang) * 0.7 * k - 0.4, 0.9, Render.palette.particle, 0.07);
      }
    }
  },
  drawAtmosphere(ctx, g, dt) {
    const d = App.view.dpr, W = App.view.w * d, H = App.view.h * d;
    const night = Render.dayNight(g);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (night > 0.01) {
      ctx.fillStyle = 'rgba(8,10,40,' + (night * 0.45).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    // dust storm
    if (App.settings.weather && !App.settings.reducedFx) {
      Render.stormT += dt;
      if (Render.storm <= 0 && Render.stormT > Render.nextStorm) { Render.storm = 60; Render.stormT = 0; Render.nextStorm = 360 + Math.random() * 480; }
      if (Render.storm > 0) {
        Render.storm -= dt;
        const k = Math.min(1, Math.min(Render.storm, 60 - Render.storm) / 8);
        ctx.fillStyle = Col.rgba(Render.palette.particle, 0.12 * k);
        ctx.fillRect(0, 0, W, H);
        const n = Math.floor(70 * k * (App.quality === 'low' ? 0.4 : 1));
        ctx.strokeStyle = Col.rgba(Render.palette.particle, 0.35 * k);
        ctx.lineWidth = 1.5 * d;
        const tm = App.now / 1000;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const sx = ((i * 137.5 + tm * (380 + (i % 7) * 40)) % (W + 200)) - 100;
          const sy = ((i * 89.3 + tm * 60 + i * i) % H);
          ctx.moveTo(sx, sy); ctx.lineTo(sx - 40 * d, sy - 6 * d);
        }
        ctx.stroke();
      }
    }
    return night;
  }
};
