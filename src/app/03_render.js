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
  setPlanet(planet, seed) {
    Render.chunks.clear(); Render.comps.clear();
    TerrainSys.setPlanet(planet, seed !== undefined ? seed : (App.g ? App.g.world.seed : 1));
    Render.darkGround = ItemArt.lum(planet.ground[1]) < 0.16;
    Render.lightGround = ItemArt.lum(planet.ground[1]) > 0.6;
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
    Render.look = Object.assign({}, Render.look, { wind: TerrainSys.P.wind });
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
  terrainColor(w, x, y, out) { TerrainCore.sampleColor(x, y, TerrainSys.P, out); },
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
  // height-field terrain baked per chunk (TerrainCore / TerrainSys)
  drawTerrain(ctx, g, vr) { TerrainSys.draw(ctx, g, vr); },
  comps: new Map(),
  buildComp(g, cx, cy, sx, sy, CS, cp, terrain) {
    const S = CONFIG.chunkSize, c = Art.canvas(CS * cp, CS * cp), x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    const tw = terrain.width / S;
    x.drawImage(terrain, sx * tw, sy * tw, CS * tw, CS * tw, 0, 0, CS * cp, CS * cp);
    const X0 = cx * S + sx, Y0 = cy * S + sy;
    if (App.quality !== 'low') {
      const G = Render.grainCanvas(), T = 6, step = T * cp;
      x.globalAlpha = 0.08 * U.clamp((cp - 8) / 16, 0.4, 1);
      const ox = ((X0 % T) + T) % T, oy = ((Y0 % T) + T) % T;
      for (let yy = -oy * cp; yy < CS * cp; yy += step) for (let xx = -ox * cp; xx < CS * cp; xx += step) x.drawImage(G, xx, yy, step, step);
      x.globalAlpha = 1;
    }
    x.setTransform(cp, 0, 0, cp, -X0 * cp, -Y0 * cp);
    const c0x = Math.floor((X0 - 7) / S), c1x = Math.floor((X0 + CS + 7) / S), c0y = Math.floor((Y0 - 7) / S), c1y = Math.floor((Y0 + CS + 7) / S);
    const small = cp < 12;
    for (let ny = c0y; ny <= c1y; ny++) for (let nx = c0x; nx <= c1x; nx++) {
      for (const d of Render.decorFor(g, nx, ny)) {
        if (d.x < X0 - 7 || d.x > X0 + CS + 7 || d.y < Y0 - 7 || d.y > Y0 + CS + 7) continue;
        if (small && (d.kind === 'pebbles' || d.kind === 'dune')) continue;
        const spr = DecorArt.sprite(d.kind, d.v, Art.bucket(cp * Math.min(2, d.s), 128));
        const w = spr.w * d.s, h = spr.h * d.s;
        x.drawImage(spr.canvas, d.x - w * spr.ax, d.y - h * spr.ay, w, h);
      }
    }
    return c;
  },
  grainCanvas() {
    if (!Render.grain) {
      const c = Art.canvas(128, 128), x = c.getContext('2d');
      const rnd = RNG.mulberry32(99);
      for (let i = 0; i < 2600; i++) { const v = rnd(); x.fillStyle = v < 0.5 ? 'rgba(0,0,0,' + (0.25 + rnd() * 0.5) + ')' : 'rgba(255,255,255,' + (0.18 + rnd() * 0.4) + ')'; x.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), 1, 1 + (rnd() < 0.2 ? 1 : 0)); }
      Render.grain = { canvas: c, pat: null };
    }
    return Render.grain.canvas;
  },
  // static seamless micro-grain, anchored to the world (one pattern fill per frame)
  drawGrain(ctx, vr) {
    if (App.cam.zoom < 14 || App.quality === 'low') return;
    Render.grainCanvas();
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
  // rocks and props: baked into the chunk image at far zoom, live sprites when close
  drawDecor(ctx, g, vr) { TerrainSys.drawProps(ctx, vr); },

  // ---------------- footprints ----------------
  updatePrints(g, dt) { Ground.update(g, dt); Ground.decayWear(dt); Ground.sandDrift(g, dt); },
  drawPrints(ctx) { Ground.draw(ctx); },

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
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H * 0.46);
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
