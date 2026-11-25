// =====================================================================
// Render: camera, terrain chunks (colour zones + grain), decoration sprites,
// planet props, footprints, particles, atmosphere and night
// =====================================================================
// Planet looks beyond the core palette: ground zones, wind, prop set, ambient particles
const PLANET_LOOK = {
  1: { zones: ['#6e3a52', '#c98a4a', '#e8c9a8'], wind: 0.35, props: ['basalt'], amb: 'dust', rockTint: '#4a2216' },
  2: { zones: ['#3f6e62', '#c98a4a', '#e0b07a'], wind: 0.9, props: ['pool', 'shard'], amb: 'dust', rockTint: '#5a3a22' },
  3: { zones: ['#7aa6d0', '#e8f4ff', '#bcd8ee'], wind: -0.4, props: ['floe', 'frost'], amb: 'snow', rockTint: '#6a8aaa' },
  4: { zones: ['#2a1a14', '#4a2a1a', '#3a3230'], wind: 1.6, props: ['lava', 'ash'], amb: 'ash', rockTint: '#151112' },
  5: { zones: ['#3a2a5a', '#3a6a3a', '#5a4a7a'], wind: 0.2, props: ['plant', 'shroom'], amb: 'spore', rockTint: '#2a2240' },
  6: { zones: ['#24164a', '#3a2a6a', '#1a2a5a'], wind: 0.0, props: ['panel', 'beamline'], amb: 'neon', rockTint: '#1a1030' },
  7: { zones: ['#c8b8e8', '#f4ecff', '#b8e0f0'], wind: 0.6, props: ['crystal'], amb: 'glitter', rockTint: '#9a8ab8' },
  8: { zones: ['#0a0a1a', '#141430', '#20103a'], wind: 0.0, props: ['stars', 'gring', 'arc'], amb: 'stardust', rockTint: '#06060c' }
};
const PROP_SETS = [['basalt'], ['pool', 'shard'], ['floe', 'frost'], ['lava', 'ash'], ['plant', 'shroom'], ['panel', 'beamline'], ['crystal'], ['stars', 'gring', 'arc']];
const AMBS = ['dust', 'snow', 'ash', 'spore', 'neon', 'glitter', 'stardust'];

const Render = {
  canvas: null, ctx: null,
  chunks: new Map(), chunkGenBudget: 2,
  ox: 0, oy: 0, S: 1,
  particles: [], pool: [],
  palette: null, planetStyle: 1, look: PLANET_LOOK[1],
  floating: [],
  edgeMarks: [],
  prints: [], printDist: 0, lastStep: null,
  stormT: 0, storm: 0, nextStorm: 300,
  grain: null,

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
    Art.clearPlanet();
    Render.palette = planet;
    Render.planetStyle = planet.index <= 8 ? planet.index : (RNG.hash(planet.index, 3) % 8) + 1;
    if (planet.index <= 8) Render.look = PLANET_LOOK[planet.index];
    else {
      // procedural planets: palette-derived zones plus a random combination of prop sets
      const rnd = RNG.mulberry32(RNG.hash(planet.index, 51));
      const a = PROP_SETS[Math.floor(rnd() * PROP_SETS.length)], b = PROP_SETS[Math.floor(rnd() * PROP_SETS.length)];
      Render.look = { zones: [Col.shade(planet.ground[0], 0.15), Col.mix(planet.ground[2], planet.accent, 0.25), Col.shade(planet.ground[2], 0.2)], wind: rnd() * 2 - 1, props: [...new Set(a.concat(b))].slice(0, 3), amb: AMBS[Math.floor(rnd() * AMBS.length)], rockTint: planet.rock };
    }
    Render.prints.length = 0;
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
  ppt() { return App.cam.zoom * App.view.dpr; },

  // ---------------- terrain ----------------
  smooth(a, b, x) { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); },
  terrainColor(w, x, y, out) {
    const P = Render.palette, st = Render.planetStyle, L = Render.look;
    const t = World.terrain(w, x, y);
    const v = U.clamp(t.e * 0.6 + 0.5, 0, 1);
    const band = v * 3, fl = Math.floor(band);
    const vv = (fl + Render.smooth(0.3, 0.7, band - fl)) / 3;
    const g0 = Col.rgb(P.ground[0]), g1 = Col.rgb(P.ground[1]), g2 = Col.rgb(P.ground[2]);
    let r, g, b;
    if (vv < 0.5) { const k = vv * 2; r = g0[0] + (g1[0] - g0[0]) * k; g = g0[1] + (g1[1] - g0[1]) * k; b = g0[2] + (g1[2] - g0[2]) * k; }
    else { const k = (vv - 0.5) * 2; r = g1[0] + (g2[0] - g1[0]) * k; g = g1[1] + (g2[1] - g1[1]) * k; b = g1[2] + (g2[2] - g1[2]) * k; }
    // large colour zones (low frequency, soft)
    const z = w.noiseB.fbm(x / 120 + 300, y / 120 - 80, 2);
    const mixIn = (hex, k) => { if (k <= 0) return; const c = Col.rgb(hex); r += (c[0] - r) * k; g += (c[1] - g) * k; b += (c[2] - b) * k; };
    mixIn(L.zones[0], Render.smooth(-0.18, -0.42, z) * 0.45);
    mixIn(L.zones[1], Render.smooth(0.2, 0.42, z) * 0.38);
    const salt = w.noiseC.fbm(x / 70 - 40, y / 70 + 90, 2);
    mixIn(L.zones[2], Render.smooth(0.38, 0.55, salt) * 0.4);
    const wDune = Render.smooth(0.15, 0.35, t.b), wCrater = Render.smooth(-0.2, -0.4, t.b);
    const wRock = Render.smooth(0.15, 0.35, t.r), wRub = Render.smooth(-0.15, -0.35, t.r);
    let f = 1 + t.d * 0.045;
    if (wDune > 0) { const rip = Math.sin((x * Math.cos(L.wind) + y * Math.sin(L.wind)) * 1.3 + t.e * 6); f *= 1 + wDune * (0.05 + rip * 0.05); }
    if (wCrater > 0) f *= 1 - wCrater * 0.1;
    if (wRub > 0 && t.d > 0.25) f *= 1 - wRub * 0.08;
    r *= f; g *= f; b *= f;
    if (wRock > 0) mixIn(P.rock, wRock * 0.3);
    // planet identity baked into the ground
    if (st === 2 && t.e < -0.42) mixIn(P.accent, Render.smooth(-0.42, -0.55, t.e) * 0.7);
    if (st === 3) { if (t.d > 0.45) mixIn('#ffffff', 0.3); const crack = Math.abs(w.noiseC.noise2(x / 6, y / 6)); if (crack < 0.03) mixIn('#5a8ab8', 0.5); }
    if (st === 4) { const vein = Math.abs(w.noiseC.noise2(x / 14, y / 14)); if (vein < 0.045) mixIn('#ff5a14', (1 - vein / 0.045) * 0.8); }
    if (st === 5 && t.d > 0.3) mixIn(t.b > 0 ? '#6ad07a' : '#9a5ad6', Render.smooth(0.3, 0.6, t.d) * 0.35);
    if (st === 6) { const gx = ((x % 6) + 6) % 6, gy = ((y % 6) + 6) % 6; if (gx < 0.1 || gy < 0.1) { r += 25; g += 45; b += 70; } }
    if (st === 7 && t.d > 0.55) { r += 35; g += 35; b += 45; }
    if (st === 8) { const n = w.noiseC.noise2(x * 3.1, y * 3.1); if (n > 0.8) { r = 230; g = 230; b = 255; } }
    // muted ground (saturation economy): pull slightly towards grey
    const gr = (r + g + b) / 3;
    out[0] = r + (gr - r) * 0.12; out[1] = g + (gr - g) * 0.12; out[2] = b + (gr - b) * 0.12;
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
      const ch = Render.chunks.get(key);
      const rx = cx * S - Render.ox, ry = cy * S - Render.oy;
      if (ch) { ch.last = App.frame; ctx.drawImage(ch.canvas, rx, ry, S + 0.02, S + 0.02); }
      else { ctx.fillStyle = P.ground[1]; ctx.fillRect(rx, ry, S + 0.02, S + 0.02); need.push([cx, cy, U.dist2(cx * S + 16, cy * S + 16, App.cam.x, App.cam.y)]); }
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
    Render.drawGrain(ctx, vr);
  },
  // static seamless micro-grain, anchored to the world (one pattern fill per frame)
  drawGrain(ctx, vr) {
    if (App.cam.zoom < 14 || App.quality === 'low') return;
    if (!Render.grain) {
      const c = Art.canvas(128, 128), x = c.getContext('2d');
      const rnd = RNG.mulberry32(99);
      for (let i = 0; i < 2600; i++) { const v = rnd(); x.fillStyle = v < 0.5 ? 'rgba(0,0,0,' + (0.25 + rnd() * 0.5) + ')' : 'rgba(255,255,255,' + (0.18 + rnd() * 0.4) + ')'; x.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), 1, 1 + (rnd() < 0.2 ? 1 : 0)); }
      Render.grain = { canvas: c, pat: null };
    }
    const G = Render.grain;
    if (!G.pat) G.pat = Render.ctx.createPattern(G.canvas, 'repeat');
    const T = 6; // tiles covered by one pattern tile
    if (G.pat.setTransform) G.pat.setTransform(new DOMMatrix([T / 128, 0, 0, T / 128, -(((Render.ox % T) + T) % T), -(((Render.oy % T) + T) % T)]));
    ctx.globalAlpha = 0.09 * U.clamp((App.cam.zoom - 14) / 10, 0.3, 1);
    ctx.fillStyle = G.pat;
    ctx.fillRect(vr.x0 - Render.ox, vr.y0 - Render.oy, vr.x1 - vr.x0, vr.y1 - vr.y0);
    ctx.globalAlpha = 1;
  },

  // ---------------- decoration (render side, deterministic per chunk) ----------------
  decorFor(g, cx, cy) {
    const key = 'D' + U.chunkKey(cx, cy);
    let list = Render.decorCache && Render.decorCache.get(key);
    if (list) return list;
    if (!Render.decorCache || Render.decorCache.size > 600) Render.decorCache = new Map();
    const S = CONFIG.chunkSize;
    const rnd = RNG.forChunk(g.world.seed, cx, cy, 7);
    list = [];
    const add = (kind, x, y, s, v) => list.push({ kind, x, y, s, v, ph: rnd() });
    const n = 30 + Math.floor(rnd() * 14);
    for (let i = 0; i < n; i++) {
      const x = cx * S + rnd() * S, y = cy * S + rnd() * S;
      const bi = World.biome(g.world, Math.floor(x), Math.floor(y));
      const roll = rnd();
      if (bi === 3) { if (roll < 0.3) add('crater', x, y, 1.6 + rnd() * 3.2, Math.floor(rnd() * 6)); else if (roll < 0.65) add('rock', x, y, 0.6 + rnd() * 0.8, Math.floor(rnd() * 12)); else add('pebbles', x, y, 1, Math.floor(rnd() * 4)); }
      else if (bi === 2) { if (roll < 0.62) add('rock', x, y, 0.7 + rnd() * 1.1, Math.floor(rnd() * 12)); else add('pebbles', x, y, 1, Math.floor(rnd() * 4)); }
      else if (bi === 4) { if (roll < 0.7) add('pebbles', x, y, 1 + rnd() * 0.5, Math.floor(rnd() * 4)); else add('rock', x, y, 0.5 + rnd() * 0.5, Math.floor(rnd() * 12)); }
      else if (bi === 1) { if (roll < 0.6) add('dune', x, y, 2 + rnd() * 2, Math.floor(rnd() * 3)); else if (roll < 0.8) add('pebbles', x, y, 1, Math.floor(rnd() * 4)); else add('rock', x, y, 0.5 + rnd() * 0.6, Math.floor(rnd() * 12)); }
      else { if (roll < 0.1) add('crater', x, y, 1.2 + rnd() * 2, Math.floor(rnd() * 6)); else if (roll < 0.38) add('pebbles', x, y, 1, Math.floor(rnd() * 4)); else if (roll < 0.55) add('rock', x, y, 0.5 + rnd() * 0.6, Math.floor(rnd() * 12)); else if (roll < 0.7) add('dune', x, y, 1.5 + rnd() * 1.5, Math.floor(rnd() * 3)); }
    }
    // planet props
    const props = Render.look.props;
    const np = 6 + Math.floor(rnd() * 7);
    for (let i = 0; i < np; i++) {
      const kind = props[Math.floor(rnd() * props.length)];
      if (kind === 'basalt') { add('rock', cx * S + rnd() * S, cy * S + rnd() * S, 0.9 + rnd() * 0.9, 8 + Math.floor(rnd() * 4)); continue; }
      add(kind, cx * S + rnd() * S, cy * S + rnd() * S, 0.8 + rnd() * 1.4, Math.floor(rnd() * 4));
    }
    list.sort((a, b) => (DECOR_LAYER[a.kind] || 1) - (DECOR_LAYER[b.kind] || 1) || a.y - b.y);
    Render.decorCache.set(key, list);
    return list;
  },
  drawDecor(ctx, g, vr) {
    const S = CONFIG.chunkSize;
    const z = App.cam.zoom;
    const ppt = Art.bucket(Render.ppt(), 64);
    const cx0 = Math.floor(vr.x0 / S), cy0 = Math.floor(vr.y0 / S), cx1 = Math.floor(vr.x1 / S), cy1 = Math.floor(vr.y1 / S);
    const tm = App.now / 1000;
    const anim = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      for (const d of Render.decorFor(g, cx, cy)) {
        if (d.x < vr.x0 - 6 || d.x > vr.x1 + 6 || d.y < vr.y0 - 6 || d.y > vr.y1 + 6) continue;
        if (z < 12 && (d.kind === 'pebbles' || d.kind === 'dune')) continue;
        const spr = DecorArt.sprite(d.kind, d.v, ppt);
        const w = spr.w * d.s, h = spr.h * d.s;
        ctx.drawImage(spr.canvas, d.x - Render.ox - w * spr.ax, d.y - Render.oy - h * spr.ay, w, h);
        if (DECOR_ANIM[d.kind]) anim.push(d);
      }
    }
    // animated props (pulsing lava, glowing mushrooms, twinkling stars ...)
    if (anim.length && !App.settings.reducedFx) {
      ctx.globalCompositeOperation = 'lighter';
      for (const d of anim) {
        const pulse = 0.55 + 0.45 * Math.sin(tm * DECOR_ANIM[d.kind].speed + d.ph * 6.28);
        const a = DECOR_ANIM[d.kind];
        ctx.globalAlpha = pulse * a.a;
        const r = a.r * d.s;
        ctx.drawImage(Sprites.glow(a.color === 'accent' ? Render.palette.accent : a.color), d.x - Render.ox - r, d.y - Render.oy - r * a.dy - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  },

  // ---------------- footprints ----------------
  updatePrints(g, dt) {
    const p = g.run.player;
    for (let i = Render.prints.length - 1; i >= 0; i--) { Render.prints[i].t += dt; if (Render.prints[i].t > 15) Render.prints.splice(i, 1); }
    if (!p.moving) { Render.lastStep = null; return; }
    if (!Render.lastStep) { Render.lastStep = { x: p.x, y: p.y, side: 1 }; return; }
    const L = Render.lastStep;
    const rover = g.run.research.done.has('rover');
    const dist = Math.hypot(p.x - L.x, p.y - L.y);
    if (dist < (rover ? 0.35 : 0.42)) return;
    const a = Math.atan2(p.y - L.y, p.x - L.x);
    L.side = -L.side;
    if (Render.prints.length > 90) Render.prints.shift();
    Render.prints.push({ x: p.x, y: p.y - 0.02, a, side: L.side, t: 0, rover });
    L.x = p.x; L.y = p.y;
    if (!App.settings.reducedFx && !rover) Render.spawn('dust', p.x + Math.cos(a + Math.PI / 2) * 0.08 * L.side, p.y, -Math.cos(a) * 0.3, -0.15, 0.7, Render.palette.particle, 0.09);
  },
  drawPrints(ctx) {
    if (!Render.prints.length) return;
    const col = Col.shade(Render.palette.ground[1], -0.4);
    for (const f of Render.prints) {
      const a = 1 - f.t / 15;
      ctx.globalAlpha = a * 0.45;
      ctx.save(); ctx.translate(f.x - Render.ox, f.y - Render.oy); ctx.rotate(f.a);
      ctx.fillStyle = col;
      if (f.rover) { ctx.fillRect(-0.22, -0.32, 0.44, 0.09); ctx.fillRect(-0.22, 0.23, 0.44, 0.09); }
      else { ctx.beginPath(); ctx.ellipse(0, f.side * 0.09, 0.1, 0.05, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },

  roundRect(ctx, x, y, w, hh, r) { Art.rrect(ctx, x, y, w, hh, r); },

  // ---------------- particles (pooled, sprite based) ----------------
  maxParticles() { return App.settings.reducedFx ? 80 : App.quality === 'low' ? 150 : App.quality === 'medium' ? 500 : 1500; },
  spawn(type, x, y, vx, vy, life, color, size, extra) {
    if (Render.particles.length >= Render.maxParticles()) return null;
    const p = Render.pool.pop() || {};
    p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.color = color; p.size = size;
    p.rot = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * 6; p.v = Math.floor(Math.random() * 3); p.g = 0; p.z = 0; p.vz = 0;
    if (extra) Object.assign(p, extra);
    Render.particles.push(p);
    return p;
  },
  updateParticles(dt) {
    const arr = Render.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) { arr[i] = arr[arr.length - 1]; arr.pop(); Render.pool.push(p); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.type === 'coin') {
        // flies in an arc with gravity on a virtual height, bounces once
        p.vz -= 9 * dt; p.z += p.vz * dt;
        if (p.z < 0) { p.z = 0; p.vz = -p.vz * 0.35; p.vx *= 0.6; p.vy *= 0.6; }
      }
      if (p.type === 'smoke' || p.type === 'dust' || p.type === 'steam') { p.vx *= 0.97; p.vy *= 0.97; p.size += dt * (p.type === 'steam' ? 0.35 : 0.22); }
      if (p.type === 'snow' || p.type === 'ash' || p.type === 'spore') { p.vx += Math.sin(p.life * 2 + p.rot) * dt * 0.3; }
    }
  },
  drawParticles(ctx) {
    const arr = Render.particles;
    if (!arr.length) return;
    // pass 1: normal blending
    for (const p of arr) {
      const T = PTYPES[p.type] || PTYPES.dust;
      if (T.add) continue;
      Render.drawParticle(ctx, p, T);
    }
    // pass 2: additive (batched)
    ctx.globalCompositeOperation = 'lighter';
    for (const p of arr) { const T = PTYPES[p.type] || PTYPES.dust; if (T.add) Render.drawParticle(ctx, p, T); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  },
  drawParticle(ctx, p, T) {
    const k = U.clamp(p.life / p.max, 0, 1);
    const x = p.x - Render.ox, y = p.y - Render.oy - (p.z || 0) * 0.5;
    const s = p.size * (T.grow ? 1 + (1 - k) * T.grow : 1);
    ctx.globalAlpha = T.fadeIn ? Math.min(1, (1 - k) * 6) * k : k * (T.a || 1);
    if (p.type === 'coin') {
      ctx.globalAlpha = Math.min(1, k * 3);
      // shadow on the ground
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, p.y - Render.oy + 0.05, s * 0.8, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      const fr = Math.floor((p.life * 14 + p.v)) & 7;
      ctx.drawImage(FxLib.get('coin', fr), x - s, y - s, s * 2, s * 2);
      return;
    }
    const spr = p.color ? FxLib.tinted(T.spr, T.vars ? p.v % T.vars : 0, p.color) : FxLib.get(T.spr, T.vars ? p.v % T.vars : 0);
    if (T.rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.drawImage(spr, -s, -s, s * 2, s * 2); ctx.restore(); }
    else ctx.drawImage(spr, x - s, y - s, s * 2, s * 2);
  },
  // coin fountain at a seller
  coinBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.4;
      Render.spawn('coin', x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.5, 1.1 + Math.random() * 0.4, null, 0.13 + Math.random() * 0.05, { z: 0.4, vz: 3 + Math.random() * 2.5 });
    }
    Render.spawn('glint', x, y - 0.4, 0, -0.2, 0.5, '#fff6c0', 0.5);
  },
  puff(x, y, n, color, size = 0.25) {
    for (let i = 0; i < n; i++) Render.spawn('dust', x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 1.6, -Math.random() * 0.6, 0.6 + Math.random() * 0.5, color, size * (0.6 + Math.random() * 0.6));
  },
  ring(x, y, r, color, life = 0.6) { Render.spawn('ring', x, y, 0, 0, life, color, r); },

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
      const pop = Art.ease.outBack(Math.min(1, f.t / 0.25));
      const fs = 15 / z * (0.6 + 0.4 * pop);
      ctx.font = '800 ' + fs + 'px system-ui, sans-serif';
      ctx.globalAlpha = a;
      ctx.lineWidth = fs * 0.24; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      const x = f.x - Render.ox, y = f.y - Render.oy - Art.ease.outCubic(Math.min(1, f.t / 1.6)) * 1.1;
      ctx.strokeText(f.text, x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
  },

  // ---------------- atmosphere ----------------
  dayNight(g) {
    if (!App.settings.dayNight) return 0;
    const cycle = 600;
    const ph = ((g.run.time % cycle) / cycle) * Math.PI * 2;
    return U.clamp(-Math.cos(ph) * 1.1 - 0.05, 0, 1) * (Render.planetStyle === 8 ? 0.7 : 1);
  },
  // sun direction for cast shadows: longer in the evening, softer at night
  sun(g) {
    if (!App.settings.dayNight) return { dx: Art.SHADOW[0], dy: Art.SHADOW[1], a: 0.26 };
    const ph = ((g.run.time % 600) / 600) * Math.PI * 2;
    const len = 1 + Math.max(0, Math.cos(ph)) * 0.2 + Math.max(0, -Math.cos(ph)) * 0.9;
    const night = Render.dayNight(g);
    return { dx: (0.4 + 0.3 * Math.sin(ph)) * len, dy: 0.38 * len, a: 0.26 * (1 - night * 0.55) };
  },
  devils: [],
  updateDevils(g, dt) {
    Render.updatePrints(g, dt);
    if (App.settings.reducedFx || !App.settings.weather || App.quality === 'low') { Render.devils.length = 0; return; }
    if (Render.devils.length < 2 && Math.random() < dt * 0.04) {
      const p = g.run.player, a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 10;
      Render.devils.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: Math.cos(Render.look.wind) * 1.2, vy: Math.sin(Render.look.wind) * 1.2, life: 8 + Math.random() * 6 });
    }
    for (let i = Render.devils.length - 1; i >= 0; i--) {
      const dv = Render.devils[i];
      dv.life -= dt; dv.x += dv.vx * dt; dv.y += dv.vy * dt;
      if (dv.life <= 0) { Render.devils.splice(i, 1); continue; }
      const k = Math.min(1, dv.life / 2);
      for (let j = 0; j < 2; j++) {
        const ang = App.now / 120 + j * Math.PI + Math.random() * 0.5, r = 0.3 + Math.random() * 0.6;
        Render.spawn('dust', dv.x + Math.cos(ang) * r, dv.y + Math.sin(ang) * r * 0.5 - Math.random() * 0.8, -Math.sin(ang) * 1.5 * k, Math.cos(ang) * 0.7 * k - 0.4, 0.9, Render.palette.particle, 0.09);
      }
    }
    Render.ambient(g, dt);
  },
  // planet-specific ambient particles around the camera
  ambient(g, dt) {
    const rate = App.quality === 'high' ? 14 : 6;
    const n = Math.random() < (rate * dt) % 1 ? Math.ceil(rate * dt) : Math.floor(rate * dt);
    const vr = Render.visibleRect(0);
    const P = Render.palette, w = Render.look.wind;
    for (let i = 0; i < n; i++) {
      const x = vr.x0 + Math.random() * (vr.x1 - vr.x0), y = vr.y0 + Math.random() * (vr.y1 - vr.y0);
      switch (Render.look.amb) {
        case 'snow': Render.spawn('snow', x, y, Math.cos(w) * 0.8, 0.9, 4, '#ffffff', 0.07); break;
        case 'ash': Render.spawn(Math.random() < 0.3 ? 'ember' : 'ash', x, y, Math.cos(w) * 1, -0.2, 3, Math.random() < 0.3 ? '#ffb04a' : '#4a4040', 0.06); break;
        case 'spore': Render.spawn('spore', x, y, Math.cos(w) * 0.3, -0.25, 5, Math.random() < 0.5 ? '#9aff8a' : '#d08aff', 0.07); break;
        case 'neon': Render.spawn('spore', x, y, 0, -0.4, 3, Math.random() < 0.5 ? '#3ff0ff' : '#ff4fd8', 0.06); break;
        case 'glitter': Render.spawn('glint', x, y, 0, 0, 0.8, '#ffffff', 0.12); break;
        case 'stardust': Render.spawn('spore', x, y, 0.1, 0.05, 4, '#c8c0ff', 0.04); break;
        default: Render.spawn('mote', x, y, Math.cos(w) * 1.6, Math.sin(w) * 0.6, 3, P.particle, 0.05);
      }
    }
  },
  drawAtmosphere(ctx, g, dt) {
    const d = App.view.dpr, W = App.view.w * d, H = App.view.h * d;
    const night = Render.dayNight(g);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // dusk tint and night: multiply grade (clearly darker and cooler at night)
    const ph = ((g.run.time % 600) / 600) * Math.PI * 2;
    const dusk = App.settings.dayNight ? Math.max(0, 1 - Math.abs(Math.cos(ph)) * 1.6) * 0.5 : 0;
    if (night > 0.01 || dusk > 0.02) {
      ctx.globalCompositeOperation = 'multiply';
      const r = 255 - night * 175 - dusk * 10, gg = 255 - night * 165 - dusk * 45, b = 255 - night * 95 - dusk * 80;
      ctx.fillStyle = 'rgb(' + Math.round(r) + ',' + Math.round(gg) + ',' + Math.round(b) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    // distance haze when zoomed far out
    if (App.cam.zoom < 18) {
      const k = (18 - App.cam.zoom) / 8;
      const sky = Render.palette.sky;
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, 'rgba(' + sky[0] + ',' + sky[1] + ',' + sky[2] + ',' + (0.16 * k).toFixed(3) + ')'); gr.addColorStop(0.45, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
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

// particle types -> sprite, blending, growth
const PTYPES = {
  dust: { spr: 'dust', vars: 3, grow: 1.4, a: 0.55 },
  smoke: { spr: 'smoke', vars: 3, grow: 1.8, a: 0.55 },
  steam: { spr: 'steam', vars: 3, grow: 2, a: 0.6 },
  spark: { spr: 'spark', add: true, rot: true },
  jet: { spr: 'soft', add: true },
  ember: { spr: 'soft', add: true },
  glint: { spr: 'glint4', add: true, fadeIn: true },
  ring: { spr: 'ring', add: true, grow: 2.5 },
  mote: { spr: 'soft', a: 0.5 },
  snow: { spr: 'snow', rot: true, a: 0.9 },
  ash: { spr: 'ash', rot: true, a: 0.85 },
  spore: { spr: 'spore', add: true, fadeIn: true },
  confetti: { spr: 'confetti', rot: true },
  coin: { spr: 'coin' }
};

// decoration kinds drawn on the lower layer first
const DECOR_LAYER = { crater: 0, dune: 0, pool: 0, frost: 0, ash: 0, lava: 0, panel: 0, gring: 0, stars: 0, pebbles: 1, floe: 1, rock: 2, shard: 2, plant: 2, shroom: 2, crystal: 2, beamline: 3, arc: 3 };
// animated glow on props
const DECOR_ANIM = {
  lava: { color: '#ff6a1a', r: 1.4, a: 0.65, speed: 1.6, dy: 0 },
  shroom: { color: '#7affc0', r: 0.9, a: 0.55, speed: 1.1, dy: 0.4 },
  plant: { color: '#c07aff', r: 0.7, a: 0.3, speed: 0.8, dy: 0.5 },
  beamline: { color: '#3ff0ff', r: 1.2, a: 0.4, speed: 2.4, dy: 0 },
  stars: { color: '#c8c0ff', r: 0.7, a: 0.45, speed: 3.1, dy: 0 },
  crystal: { color: '#ffffff', r: 0.5, a: 0.4, speed: 2.2, dy: 0.6 },
  gring: { color: 'accent', r: 1.4, a: 0.25, speed: 0.9, dy: 0 }
};
