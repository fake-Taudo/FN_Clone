// =====================================================================
// Title scene, landing cinematic and lucky reveal (presentation only).
// The intro is a pure function of its time t: every frame (camera, ship,
// particles, sound schedule) is computed from t, so skipping, seeking and
// replaying always end in the same state. The game simulation is paused
// while it runs; the lucky start result and all seeds stay untouched.
// =====================================================================
const IM = {
  ss(a, b, x) { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); },
  cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; },
  sine(t) { return 0.5 - 0.5 * Math.cos(Math.PI * IM.cl(t)); },
  lerp(a, b, t) { return a + (b - a) * t; },
  hf(i, k) { return (RNG.hash(i, k, 0x1a7d) & 0xffff) / 65535; }
};

// ---------------------------------------------------------------------
// TitleScene: living title (planet from the worker, 3 star layers,
// nebula, sun glare, atmosphere rim, passing satellite, parallax)
// ---------------------------------------------------------------------
const TitleScene = {
  planet: null, stars: null, L: null, A: null, Aold: null, B: null, raf: 0, t0: 0, t: 0,
  par: [0, 0], parT: [0, 0], rot: 0.55, nextRot: 0, stage: 0, atmo: null, atmoKey: '', neb: null, frozen: false,
  still() { return !!App.settings.reducedFx; },
  init() {
    TitleScene.planet = DATA.planet(1);
    const rnd = RNG.mulberry32(9001), S = [];
    const add = (n, l, s0, s1, a0, a1) => { for (let i = 0; i < n; i++) S.push({ x: rnd(), y: rnd(), s: s0 + rnd() * (s1 - s0), a: a0 + rnd() * (a1 - a0), l, ph: rnd() * 6.283, f: 0.5 + rnd() * 1.6, c: rnd() }); };
    add(300, 0, 0.45, 0.9, 0.2, 0.5); add(130, 1, 0.8, 1.35, 0.45, 0.85); add(32, 2, 1.3, 2.1, 0.8, 1);
    TitleScene.stars = S;
    const sr = RNG.mulberry32(4242);
    TitleScene.sat = { rnd: sr, next: 6 + sr() * 10, on: null };
  },
  // planet below the title block (never overlapping the text); diameter >= 1.5 x width and >= 2048 device px
  layout(W, H) {
    const inner = $('#screen-title .title-inner');
    let bottom = H * 0.5;
    if (inner) { const r = inner.getBoundingClientRect(); if (r.height > 0) bottom = r.bottom; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const R = Math.max(W * 0.78, H * 0.6, 1024 / dpr);
    const top = Math.min(Math.max(bottom + 24, H * 0.6), H - Math.max(56, H * 0.12));
    return { W, H, dpr, R, cx: W / 2, top, key: W + 'x' + H + '|' + Math.round(top) };
  },
  geo(L, s) { const R = L.R * s, top = L.H - (L.H - L.top) * Math.pow(s, 0.9); return { R, cx: L.cx, cy: top + R, top }; },
  latMax(L) { return Math.asin(Math.min(1, (L.H - L.top) / L.R - 1 + 0.05)); },
  requestA(rot, tw, detail, dOverride) {
    const L = TitleScene.L, d = dOverride || L.dpr, D = Math.round(L.R * 2 * d);
    const rect = [(L.R - L.cx) * d - 4, 0, L.W * d + 8, Math.ceil((L.H - L.top) * d) + 8];
    const key = L.key;
    return PlanetView.request(TitleScene.planet, D, rect, rot, (bmp, rx, ry) => {
      if (!TitleScene.L || TitleScene.L.key !== key) { if (bmp.close) bmp.close(); return; }
      if (TitleScene.A) { if (TitleScene.Aold && TitleScene.Aold.bmp.close) TitleScene.Aold.bmp.close(); TitleScene.Aold = TitleScene.A; }
      TitleScene.A = { bmp, rx, ry, d, rot, born: performance.now(), tw };
      TitleScene.pump();
    }, { tw, detail, latMax: TitleScene.latMax(L) });
  },
  requestB(rot) {
    const L = TitleScene.L, d = Math.min(L.dpr, 1.5), RB = L.R * 2.5, G = TitleScene.geo(L, 1.6), k = RB / G.R;
    const D = Math.round(RB * 2 * d);
    const rect = [(G.R - L.cx) * k * d - 4, 0, L.W * k * d + 8, Math.ceil((L.H - G.top) * k * d) + 8];
    const key = L.key;
    return PlanetView.request(TitleScene.planet, D, rect, rot, (bmp, rx, ry) => {
      if (!TitleScene.L || TitleScene.L.key !== key) { if (bmp.close) bmp.close(); return; }
      if (TitleScene.B && TitleScene.B.bmp.close) TitleScene.B.bmp.close();
      TitleScene.B = { bmp, rx, ry, d, rot, RB, born: performance.now() };
    }, { tw: 2048, detail: true, latMax: TitleScene.latMax(L) });
  },
  // bake order: fast preview (1024, no grain), sharp view (2048 + grain), close-up for the intro push
  pump() {
    const st = TitleScene.stage;
    if (st === 1) { TitleScene.stage = 2; TitleScene.requestA(TitleScene.rot, 2048, true); }
    else if (st === 2) { TitleScene.stage = 3; TitleScene.requestB(TitleScene.rot); }
  },
  relayout(W, H) {
    const L = TitleScene.layout(W, H);
    if (TitleScene.L && TitleScene.L.key === L.key) return;
    TitleScene.L = L;
    for (const k of ['A', 'Aold', 'B']) { const v = TitleScene[k]; if (v && v.bmp.close) v.bmp.close(); TitleScene[k] = null; }
    TitleScene.stage = 1;
    if (!TitleScene.requestA(TitleScene.rot, 1024, false, 1)) TitleScene.stage = 0;
  },
  start() {
    if (!TitleScene.stars) TitleScene.init();
    const cv = $('#title-bg'), ctx = cv.getContext('2d');
    TitleScene.t0 = performance.now();
    TitleScene.frozen = false;
    const onMove = e => { const W = innerWidth, H = innerHeight; TitleScene.parT = [(e.clientX / W - 0.5) * 2, (e.clientY / H - 0.5) * 2]; };
    window.addEventListener('pointermove', onMove);
    TitleScene.offMove = () => window.removeEventListener('pointermove', onMove);
    const loop = ts => {
      if ($('#screen-title').classList.contains('hidden') || TitleScene.frozen) return;
      const d = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
      if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
      TitleScene.relayout(W, H);
      const t = (ts - TitleScene.t0) / 1000;
      TitleScene.t = t;
      // living planet: about 4 degrees per minute, re-baked every 4 s and cross-faded
      if (!TitleScene.still() && TitleScene.stage >= 3 && t > TitleScene.nextRot && !PlanetView.busy) {
        TitleScene.nextRot = t + 4;
        TitleScene.rot = 0.55 + t * (4 / 60) * Math.PI / 180;
        TitleScene.requestA(TitleScene.rot, 2048, true);
      }
      ctx.setTransform(d, 0, 0, d, 0, 0);
      TitleScene.draw(ctx, W, H, t, 1, 0);
      TitleScene.raf = requestAnimationFrame(loop);
    };
    TitleScene.raf = requestAnimationFrame(loop);
  },
  stop() { TitleScene.frozen = true; cancelAnimationFrame(TitleScene.raf); if (TitleScene.offMove) TitleScene.offMove(); },
  release() {
    for (const k of ['A', 'Aold', 'B']) { const v = TitleScene[k]; if (v && v.bmp && v.bmp.close) v.bmp.close(); TitleScene[k] = null; }
    TitleScene.atmo = null; TitleScene.neb = null; TitleScene.sky = null; TitleScene.L = null; TitleScene.stage = 0;
  },
  // ---------------- drawing ----------------
  nebula(W, H) {
    const key = W + 'x' + H;
    if (TitleScene.neb && TitleScene.neb.key === key) return TitleScene.neb.c;
    const c = Art.canvas(Math.ceil(W / 4), Math.ceil(H / 4)), x = c.getContext('2d');
    const blob = (px, py, r, col, a) => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, Col.rgba(col, a)); g.addColorStop(1, Col.rgba(col, 0)); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height); };
    const w = c.width, h = c.height;
    blob(w * 0.78, h * 0.18, w * 0.45, '#5a2a6a', 0.22); blob(w * 0.92, h * 0.42, w * 0.3, '#2a3a7a', 0.18); blob(w * 0.2, h * 0.5, w * 0.35, '#6a2a3a', 0.1); blob(w * 0.55, h * 0.08, w * 0.25, '#3a2a5a', 0.14);
    TitleScene.neb = { key, c };
    return c;
  },
  // push s: 1 = title; stream: star outflow (intro push); entry: atmosphere glow boost
  skyBase(W, H) {
    const key = W + 'x' + H;
    if (TitleScene.sky && TitleScene.sky.key === key) return TitleScene.sky.c;
    const d = Math.min(2, window.devicePixelRatio || 1), c = Art.canvas(W * d, H * d), x = c.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0);
    x.fillStyle = '#07050b'; x.fillRect(0, 0, W, H);
    x.drawImage(TitleScene.nebula(W, H), 0, 0, W, H);
    const sg = x.createRadialGradient(-W * 0.04, -H * 0.06, 0, -W * 0.04, -H * 0.06, Math.max(W, H) * 0.6);
    sg.addColorStop(0, 'rgba(255,220,180,0.20)'); sg.addColorStop(0.35, 'rgba(255,190,140,0.06)'); sg.addColorStop(1, 'rgba(255,190,140,0)');
    x.fillStyle = sg; x.fillRect(0, 0, W, H);
    TitleScene.sky = { key, c };
    return c;
  },
  drawSky(ctx, W, H, t, s, stream, entry) {
    ctx.drawImage(TitleScene.skyBase(W, H), 0, 0, W, H);
    const still = TitleScene.still();
    TitleScene.par[0] += (TitleScene.parT[0] - TitleScene.par[0]) * 0.06; TitleScene.par[1] += (TitleScene.parT[1] - TitleScene.par[1]) * 0.06;
    const PX = still ? 0 : TitleScene.par[0], PY = still ? 0 : TitleScene.par[1];
    const vx = W * 0.5, vy = H * 0.85;
    const cols = ['#ffd9b4', '#ffffff', '#d4e2ff'];
    for (const st of TitleScene.stars) {
      const off = [2, 4, 6][st.l];
      let x = st.x * W - PX * off, y = st.y * H - PY * off;
      if (stream > 0) { const k = 1 + stream * (0.4 + st.l * 0.35); x = vx + (x - vx) * k; y = vy + (y - vy) * k; }
      const tw = still || st.l === 0 ? 1 : 0.72 + 0.28 * Math.sin(t * st.f + st.ph);
      const a = st.a * tw;
      ctx.fillStyle = Col.rgba(cols[st.c < 0.15 ? 0 : st.c > 0.85 ? 2 : 1], a);
      const r = st.s;
      if (st.l === 2) {
        ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = Col.rgba('#ffffff', a * 0.35); ctx.fillRect(x - r * 2.4, y - 0.4, r * 4.8, 0.8); ctx.fillRect(x - 0.4, y - r * 2.4, 0.8, r * 4.8);
      } else ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    // passing satellite every 20-40 s
    const S = TitleScene.sat;
    if (!still && S) {
      if (!S.on && t > S.next) { const r = S.rnd; const ltr = r() < 0.5; S.on = { t0: t, x0: ltr ? -0.05 : 1.05, x1: ltr ? 1.05 : -0.05, y0: 0.08 + r() * 0.25, y1: 0.12 + r() * 0.3, dur: 8 + r() * 4 }; S.next = t + 20 + r() * 20; }
      if (S.on) {
        const k = (t - S.on.t0) / S.on.dur;
        if (k >= 1) S.on = null;
        else {
          const x = IM.lerp(S.on.x0, S.on.x1, k) * W, y = (IM.lerp(S.on.y0, S.on.y1, k) - 0.03 * Math.sin(k * Math.PI)) * H;
          const a = Math.sin(k * Math.PI);
          ctx.fillStyle = 'rgba(235,240,255,' + (0.85 * a).toFixed(3) + ')'; ctx.fillRect(x - 1, y - 1, 2, 2);
          if (((t - S.on.t0) % 1.3) < 0.12) { ctx.fillStyle = 'rgba(255,90,70,' + a.toFixed(3) + ')'; ctx.fillRect(x + 2, y - 0.5, 1.5, 1.5); }
        }
      }
    }
  },
  // planet (worker bitmaps A/B or a placeholder), then the three atmosphere layers
  drawPlanet(ctx, L, G, t, entry) {
    const P = TitleScene.planet, still = TitleScene.still();
    const px = still ? 0 : -TitleScene.par[0] * 3, py = still ? 0 : -TitleScene.par[1] * 3;
    ctx.save(); ctx.translate(px, py);
    const A = TitleScene.A, now = performance.now();
    const drawView = (v, R0, alpha) => {
      if (!v || alpha <= 0) return;
      const k = G.R / R0, d = v.d;
      ctx.globalAlpha = alpha;
      ctx.drawImage(v.bmp, G.cx - G.R + v.rx / d * k, G.top + v.ry / d * k, v.bmp.width / d * k, v.bmp.height / d * k);
      ctx.globalAlpha = 1;
    };
    const fadeA = A ? IM.cl((now - A.born) / 600) : 0;
    if (!A || fadeA < 1) {
      if (TitleScene.Aold) drawView(TitleScene.Aold, L.R, 1);
      else TitleScene.placeholder(ctx, G);
    }
    drawView(A, L.R, still ? 1 : fadeA);
    const B = TitleScene.B;
    if (B && G.R / L.R > 1.55) drawView(B, B.RB, IM.ss(1.6, 1.9, G.R / L.R));
    ctx.restore();
    TitleScene.atmosphere(ctx, L, G, entry, px, py);
  },
  placeholder(ctx, G) {
    const P = TerrainCore.params(TitleScene.planet, 1), c = v => 'rgb(' + v.map(q => Math.round(q * 255)).join(',') + ')';
    const g = ctx.createRadialGradient(G.cx - G.R * 0.35, G.top + G.R * 0.25, G.R * 0.05, G.cx, G.cy, G.R);
    g.addColorStop(0, c(P.col[0])); g.addColorStop(0.6, c(P.col[2])); g.addColorStop(1, c(P.col[4]));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(G.cx, G.cy, G.R, 0, Math.PI * 2); ctx.fill();
    const sh = ctx.createLinearGradient(G.cx - G.R * 0.4, 0, G.cx + G.R * 0.7, 0);
    sh.addColorStop(0, 'rgba(8,4,12,0)'); sh.addColorStop(1, 'rgba(8,4,12,0.8)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(G.cx, G.cy, G.R, 0, Math.PI * 2); ctx.fill();
  },
  // thin bright rim (1.5-3 % of the radius), outer glow, inner limb haze; brighter on the sun side.
  // Baked once per layout at push 1 and scaled with the planet (a zoom is a pure scale about the disc).
  atmosphere(ctx, L, G, entry, px, py) {
    const W = L.W, H = L.H, q = 0.5;
    const key = L.key;
    if (TitleScene.atmoKey !== key || !TitleScene.atmo) {
      const G0 = TitleScene.geo(L, 1), R = G0.R, top = G0.top - R * 0.09;
      const c = TitleScene.atmo = Art.canvas(W * q, (H - top) * q), x = c.getContext('2d');
      x.setTransform(q, 0, 0, q, 0, -top * q);
      const sky = TitleScene.planet.sky, light = sky.map(v => Math.round(v + (255 - v) * 0.55));
      const rgba = (v, a) => 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a.toFixed(3) + ')';
      const ring = (r0, r1, stops) => { const g = x.createRadialGradient(G0.cx, G0.cy, r0, G0.cx, G0.cy, r1); for (const s of stops) g.addColorStop(s[0], s[1]); x.fillStyle = g; x.fillRect(0, top, W, H - top); };
      ring(R * 0.985, R * 1.075, [[0, rgba(sky, 0)], [0.14, rgba(sky, 0.34)], [0.5, rgba(sky, 0.1)], [1, rgba(sky, 0)]]);
      ring(R * 0.975, R * 1.022, [[0, rgba(light, 0)], [0.52, rgba(light, 0.8)], [0.62, rgba(light, 0.55)], [1, rgba(light, 0)]]);
      ring(R * 0.85, R * 1.004, [[0, rgba(sky, 0)], [0.97, rgba(sky, 0.26)], [1, rgba(sky, 0)]]);
      x.globalCompositeOperation = 'destination-in';
      const m = x.createLinearGradient(G0.cx - R * 0.7, 0, G0.cx + R * 0.7, 0);
      m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.55, 'rgba(0,0,0,0.75)'); m.addColorStop(1, 'rgba(0,0,0,0.28)');
      x.fillStyle = m; x.fillRect(0, top, W, H - top);
      TitleScene.atmoKey = key; TitleScene.atmoTop = top;
    }
    const G0 = TitleScene.geo(L, 1), k = G.R / G0.R, top = TitleScene.atmoTop;
    // same mapping as the planet bitmaps: disc-local coordinates scaled by k
    const dx = G.cx - G.R + px, dy = G.top + py;
    const X = dx + (0 - (G0.cx - G0.R)) * k, Y = dy + (top - G0.top) * k;
    const w = W * k, h = (H - top) * k;
    const e = 1 + entry * 1.5;
    ctx.globalAlpha = Math.min(1, e); ctx.drawImage(TitleScene.atmo, X, Y, w, h);
    if (e > 1) { ctx.globalAlpha = e - 1 > 1 ? 1 : e - 1; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(TitleScene.atmo, X, Y, w, h); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = 1;
  },
  draw(ctx, W, H, t, s, stream, entry) {
    const L = TitleScene.L;
    TitleScene.drawSky(ctx, W, H, t, s, stream || 0, entry || 0);
    if (L) TitleScene.drawPlanet(ctx, L, TitleScene.geo(L, s), t, entry || 0);
  }
};

// ---------------------------------------------------------------------
// IntroAudio: procedural sounds scheduled on the AudioContext clock,
// through a limiter (peak <= -3 dBFS); respects the sound setting
// ---------------------------------------------------------------------
const IntroAudio = {
  chainNodes: null, t0: 0,
  noiseBuf(ctx) {
    const len = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    const r = RNG.mulberry32(777);
    for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
    return b;
  },
  chain(ctx, dest) {
    const bus = ctx.createGain();
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -12; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
    const out = ctx.createGain(); out.gain.value = 0.6;
    bus.connect(lim); lim.connect(out); out.connect(dest);
    return { bus, lim, out };
  },
  // T: timeline; t0: AudioContext time of intro t = 0; from: intro time to start from (seek)
  schedule(ctx, dest, t0, T, from) {
    const C = IntroAudio.chain(ctx, dest), bus = C.bus, NB = IntroAudio.noiseBuf(ctx);
    const at = s => t0 + s;
    const ok = s => s >= from - 0.01;
    const env = (g, s, a, peak, hold, rel) => { const p = g.gain; p.setValueAtTime(0.0001, at(s)); p.linearRampToValueAtTime(peak, at(s + a)); p.setValueAtTime(peak, at(s + a + hold)); p.exponentialRampToValueAtTime(0.0001, at(s + a + hold + rel)); };
    const tone = (s, f0, f1, dur, type, vol, a = 0.01, filt) => {
      if (!ok(s)) return;
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, at(s)); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at(s + dur));
      let n = o; if (filt) { const f = ctx.createBiquadFilter(); f.type = filt[0]; f.frequency.value = filt[1]; f.Q.value = filt[2] || 0.7; o.connect(f); n = f; }
      n.connect(g); g.connect(bus); env(g, s, a, vol, 0, Math.max(0.02, dur - a));
      o.start(at(s)); o.stop(at(s + dur + 0.05));
    };
    const noise = (s, dur, vol, type, f0, f1, q = 0.8, a = 0.02, hold = 0) => {
      if (!ok(s)) return;
      const src = ctx.createBufferSource(); src.buffer = NB; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, at(s)); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, at(s + dur));
      const g = ctx.createGain(); src.connect(f); f.connect(g); g.connect(bus);
      env(g, s, a, vol, hold, Math.max(0.03, dur - a - hold));
      src.start(at(s), (s * 0.37) % 1.5); src.stop(at(s + dur + 0.05));
    };
    // orbit: soft space hum + air of the push
    if (ok(0)) {
      const g = ctx.createGain(); g.connect(bus);
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.frequency.value = 55; o2.frequency.value = 82.6; o2.detune.value = 7;
      o1.connect(g); o2.connect(g);
      g.gain.setValueAtTime(0.0001, at(0)); g.gain.linearRampToValueAtTime(0.06, at(1.0)); g.gain.setValueAtTime(0.06, at(T.cloudIn - 0.5)); g.gain.exponentialRampToValueAtTime(0.0001, at(T.swap + 0.3));
      o1.start(at(0)); o2.start(at(0)); o1.stop(at(T.swap + 0.4)); o2.stop(at(T.swap + 0.4));
    }
    noise(0, 1.4, 0.08, 'bandpass', 400, 1600, 0.6, 0.5);
    // attitude thrusters
    for (const s of [T.entry - 1.0, T.entry - 0.72]) noise(s, 0.14, 0.12, 'highpass', 2400, 2400, 0.7, 0.005);
    // entry: rising roar and plasma crackle
    noise(T.entry, T.swap - T.entry + 0.4, 0.22, 'lowpass', 260, 1500, 0.7, (T.swap - T.entry) * 0.55, 0.2);
    const cr = RNG.mulberry32(31);
    for (let i = 0; i < 26; i++) { const s = T.entry + 0.4 + cr() * (T.swap - T.entry - 0.6); noise(s, 0.05, 0.05 + cr() * 0.05, 'bandpass', 2600 + cr() * 2000, 0, 3, 0.003); }
    // clouds: wind whoosh
    noise(T.cloudIn - 0.2, 1.6, 0.14, 'bandpass', 500, 900, 0.6, 0.6);
    // engine: rumble following the throttle, cut 0.15 s after touchdown
    if (ok(T.app0)) {
      const src = ctx.createBufferSource(); src.buffer = NB; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240; f.Q.value = 0.9;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 41;
      const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 110;
      const g = ctx.createGain(), og = ctx.createGain(); og.gain.value = 0.5;
      src.connect(f); f.connect(g); o.connect(of); of.connect(og); og.connect(g); g.connect(bus);
      const n = 48, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) { const tt = T.app0 + (T.cut - T.app0) * i / (n - 1); curve[i] = 0.0001 + 0.26 * Intro.throttle(tt, T); }
      g.gain.setValueCurveAtTime(curve, at(T.app0), T.cut - T.app0 - 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at(T.cut + 0.15));
      src.start(at(T.app0)); o.start(at(T.app0)); src.stop(at(T.cut + 0.2)); o.stop(at(T.cut + 0.2));
    }
    for (const s of [T.app0 + 1.1, T.app0 + 2.4, T.touch - 0.7]) noise(s, 0.16, 0.1, 'highpass', 2200, 2200, 0.7, 0.005);
    // legs deploy: servo whine + clunk
    tone(T.legs0, 520, 860, T.legs1 - T.legs0, 'triangle', 0.035, 0.05, ['lowpass', 2000]);
    tone(T.legs1, 140, 70, 0.18, 'sine', 0.16, 0.004);
    // touchdown: thump, debris, then silence, steam and metal creaks
    tone(T.touch, 92, 36, 0.45, 'sine', 0.42, 0.004);
    noise(T.touch, 0.6, 0.2, 'lowpass', 500, 140, 0.8, 0.005);
    noise(T.cut + 0.1, 2.2, 0.05, 'highpass', 3200, 2600, 0.7, 0.08);
    for (const s of [T.cut + 0.8, T.cut + 1.35]) if (s < T.hatch0) tone(s, 150, 128, 0.32, 'sawtooth', 0.035, 0.03, ['bandpass', 900, 9]);
    // hatch: servo, hiss, clunk; footsteps on the ramp and the ground
    tone(T.hatch0, 380, 520, T.hatch1 - T.hatch0, 'triangle', 0.03, 0.04, ['lowpass', 1600]);
    noise(T.hatch0, 0.4, 0.06, 'highpass', 4000, 3000, 0.7, 0.01);
    tone(T.hatch1, 120, 60, 0.16, 'sine', 0.14, 0.004);
    for (let s = T.hatch1 + 0.25; s < T.walk1; s += 0.36) noise(s, 0.07, 0.05, 'lowpass', 900, 500, 0.8, 0.004);
    return C;
  },
  start(T, from) {
    IntroAudio.stop(true);
    if (!Audio2.ctx || !App.settings.sound) return false;
    const ctx = Audio2.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    IntroAudio.t0 = ctx.currentTime + 0.06 - (from || 0);
    try { IntroAudio.chainNodes = IntroAudio.schedule(ctx, Audio2.sfx, IntroAudio.t0, T, from || 0); }
    catch (e) { IntroAudio.chainNodes = null; return false; }
    return true;
  },
  time() { const c = Audio2.ctx; return c && IntroAudio.chainNodes && c.state === 'running' ? c.currentTime - IntroAudio.t0 : null; },
  stop(now) {
    const C = IntroAudio.chainNodes;
    IntroAudio.chainNodes = null;
    if (!C || !Audio2.ctx) return;
    const t = Audio2.ctx.currentTime;
    try { C.out.gain.cancelScheduledValues(t); C.out.gain.setValueAtTime(C.out.gain.value, t); C.out.gain.linearRampToValueAtTime(0, t + (now ? 0.02 : 0.15)); } catch (e) { /* ignore */ }
    setTimeout(() => { try { C.out.disconnect(); } catch (e) { /* ignore */ } }, 400);
  }
};

// ---------------------------------------------------------------------
// Intro: director (shots 1-6), lander landmark, lucky reveal and card
// ---------------------------------------------------------------------
const Intro = {
  active: false, hidePlayer: false, g: null, t: 0, T: null, plan: null, frozen: false, replayMode: false, last: 0,
  // timelines in seconds (normal <= 16 s, reduced motion <= 6 s)
  FULL: { entry: 3, cloudIn: 4.7, swap: 5.45, app0: 5.5, cloudGone: 6.9, legs0: 7.6, legs1: 8.4, touch: 9.5, cut: 9.65, hatch0: 11.8, hatch1: 12.4, ramp1: 12.9, walk1: 14.7, end: 15.0, h0: 70, z0: 4 },
  REDUCED: { entry: 0.9, cloudIn: 0.7, swap: 1.3, app0: 1.35, cloudGone: 2.1, legs0: 1.5, legs1: 2.1, touch: 3.0, cut: 3.1, hatch0: 3.35, hatch1: 3.75, ramp1: 4.1, walk1: 5.2, end: 5.45, h0: 16, z0: 18 },
  reduced() { return !!App.settings.reducedFx || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); },
  shake() { return !App.settings.noShake && !Intro.reduced(); },
  throttle(t, T) {
    if (t < T.app0) return 0;
    if (t < T.touch) return 0.38 + 0.62 * IM.ss(T.app0 + 1.0, T.touch - 0.9, t);
    if (t < T.cut) return 1;
    return Math.max(0, 1 - (t - T.cut) / 0.15);
  },

  // ---------------- plan: lander site (own RNG stream), particles ----------------
  site(g) {
    const L = CONFIG.landing, sx = L.x + 0.5, sy = L.y + 0.5;
    const rnd = RNG.mulberry32(RNG.hash(g.world.seed, 0x1A4D, 0x5EE));
    const free = (x, y) => {
      if (World.depositsInRect(g.world, x - 3, y - 3, x + 3, y + 3).length) return false;
      for (let ty = y - 2; ty <= y + 1; ty++) for (let tx = x - 2; tx <= x + 1; tx++) if (g.occ.has(U.tileKey(tx, ty))) return false;
      return true;
    };
    for (let i = 0; i < 40; i++) {
      // prefer north of the start (the astronaut then walks toward the camera)
      const a = i < 24 ? -Math.PI * (0.18 + rnd() * 0.64) : rnd() * Math.PI * 2, d = 3.6 + rnd() * 1.4;
      const x = Math.round(sx + Math.cos(a) * d), y = Math.round(sy + Math.sin(a) * d);
      if (Math.hypot(x - sx, y - sy) < 3 || Math.hypot(x - sx, y - sy) > 5.2) continue;
      if (free(x, y)) return { x, y };
    }
    return { x: Math.round(sx), y: Math.round(sy - 4) };
  },
  makePlan(g, site) {
    const L = CONFIG.landing, T = Intro.T;
    const rnd = RNG.mulberry32(RNG.hash(g.world.seed, 0x1A4E, 3));
    const col = [0, 0, 0];
    TerrainCore.sampleColor(site.x + 0.5, site.y + 1.5, TerrainSys.P, col);
    const hex = v => '#' + v.map(q => Math.max(0, Math.min(255, Math.round(q))).toString(16).padStart(2, '0')).join('');
    const base = col.map(v => v); // sampleColor returns 0..255
    const dust = { mid: hex(base.map(v => v * 1.02 + 6)), hi: hex(base.map(v => v * 1.18 + 22)), lo: hex(base.map(v => v * 0.6)) };
    const parts = [], n = App.quality === 'low' ? 50 : App.touch ? 80 : 120;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, birth = T.touch - 0.9 + rnd() * 1.25;
      parts.push({ a, b: birth, v: 2 + rnd() * 6.5, life: 1.8 + rnd() * 2.0, s: 0.45 + rnd() * 0.7, rise: 0.2 + rnd() * 0.9, v3: Math.floor(rnd() * 3), al: 0.4 + rnd() * 0.4 });
    }
    const pebbles = [];
    for (let i = 0; i < 32; i++) pebbles.push({ a: rnd() * Math.PI * 2, vh: 2.5 + rnd() * 3.5, vz: 1.6 + rnd() * 2.6, s: 0.035 + rnd() * 0.05, b: T.touch - 0.1 + rnd() * 0.25 });
    const steam = [];
    for (let i = 0; i < 18; i++) steam.push({ b: T.cut + rnd() * 2.8, x: (rnd() - 0.5) * 0.8, life: 1.4 + rnd() * 1.2, s: 0.25 + rnd() * 0.25 });
    return {
      site, start: { x: L.x + 0.5, y: L.y + 0.5 }, drift: [-7 - rnd() * 3, -4 - rnd() * 2],
      dust, parts, pebbles, steam, hz: T.h0 / (40 / T.z0 - 1)
    };
  },

  // ---------------- lifecycle ----------------
  begin(g, opts = {}) {
    Intro.g = g;
    Intro.replayMode = !!opts.replay;
    Intro.T = Intro.reduced() ? Intro.REDUCED : Intro.FULL;
    const T = Intro.T;
    if (!Intro.replayMode) MainLoop.start(g, { fresh: true, intro: true });
    const site = Intro.replayMode && g.run.lander ? { x: g.run.lander.x, y: g.run.lander.y } : Intro.site(g);
    Intro.plan = Intro.makePlan(g, site);
    if (Intro.replayMode) {
      const p = g.run.player;
      Intro.snap = { x: p.x, y: p.y, cam: Object.assign({}, App.cam), lander: g.run.lander };
      g.run.lander = null; Collide.extra = [];
      App.running = false;
    }
    // freeze the title composition (the intro starts from exactly this frame)
    const W = innerWidth, H = innerHeight;
    if (!TitleScene.stars) TitleScene.init();
    if (!TitleScene.L) { TitleScene.relayout(W, H); }
    TitleScene.stop();
    if (TitleScene.B && Math.abs(TitleScene.B.rot - (TitleScene.A ? TitleScene.A.rot : TitleScene.rot)) > 0.003) TitleScene.requestB(TitleScene.A ? TitleScene.A.rot : TitleScene.rot);
    else if (!TitleScene.B && TitleScene.stage >= 1) { TitleScene.stage = 3; TitleScene.requestB(TitleScene.A ? TitleScene.A.rot : TitleScene.rot); }
    // screens: the title UI fades out while the push starts (within the same frame)
    const ts = $('#screen-title');
    if (!ts.classList.contains('hidden')) { ts.classList.add('leaving'); setTimeout(() => { ts.classList.add('hidden'); ts.classList.remove('leaving'); }, 380); }
    const fx = $('#screen-fx');
    fx.classList.remove('hidden'); fx.classList.add('intro');
    fx.querySelector('.fx-text').innerHTML = '';
    const skip = fx.querySelector('.fx-skip');
    skip.classList.remove('hidden'); skip.textContent = 'Überspringen';
    skip.onclick = () => Intro.skip();
    fx.onpointerdown = e => { if (e.target !== skip) Intro.onPointer(); };
    let loc = fx.querySelector('.intro-loc');
    if (!loc) { loc = h('div', { class: 'intro-loc', 'aria-live': 'polite' }); fx.append(loc); }
    const S = CONFIG.chunkSize;
    loc.innerHTML = '<span>Landeplatz</span><b>' + esc(g.world.planet.name) + '</b><small>Sektor ' + Math.floor(site.x / S) + ' · ' + Math.floor(site.y / S) + ' — Landezone Alpha</small>';
    loc.style.opacity = '0';
    document.body.classList.add('intro');
    Intro.active = true; Intro.hidePlayer = true; Intro.frozen = false;
    Intro.t = opts.seek || 0; Intro.last = 0; Intro.clock = Intro.t;
    Intro.audio = !opts.seek && IntroAudio.start(T, 0);
    Intro.prebake = Intro.bakeList(g); Intro.warm = null;
    if (!Intro.keysBound) { Intro.keysBound = true; window.addEventListener('keydown', Intro.onKey, true); document.addEventListener('visibilitychange', Intro.onVis); }
    if (opts.freeze) Intro.frozen = true;
    try { skip.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  },
  onKey(e) {
    if (Intro.card && !Intro.active && (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter')) { e.preventDefault(); e.stopImmediatePropagation(); Intro.closeCard(); return; }
    if (!Intro.active) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape' || e.code === 'NumpadEnter') { Intro.skip(); return; }
    // after the touchdown any input takes control
    if (Intro.t >= Intro.T.touch + 0.5) Intro.skip();
  },
  onVis() {
    if (!Intro.active || !Audio2.ctx) return;
    if (document.hidden) Audio2.ctx.suspend(); else Audio2.ctx.resume();
  },
  onPointer() { if (Intro.active && Intro.t >= Intro.T.touch + 0.5) Intro.skip(); },
  skip() { if (!Intro.active) return; Intro.t = Intro.T.end; Intro.finish(); },
  seek(t) { Intro.t = Math.max(0, Math.min(Intro.T.end, t)); Intro.clock = Intro.t; },
  // chunks for the approach: coarse level for the wide start view, detail levels around the site
  bakeList(g) {
    const S = CONFIG.chunkSize, P = Intro.plan, T = Intro.T, W = innerWidth, H = innerHeight;
    const list = [], seen = new Set();
    const add = (cx, cy, L) => { const k = cx + ',' + cy + ',' + L; if (!seen.has(k)) { seen.add(k); list.push([cx, cy, L]); } };
    const sx = P.site.x, sy = P.site.y;
    const scx = Math.floor(sx / S), scy = Math.floor(sy / S);
    for (let L = 3; L >= 1; L--) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add(scx + dx, scy + dy, L);
    const hw = W / 2 / T.z0 + 20, hh = H / 2 / T.z0 + T.h0 * 0.6;
    const ring = [];
    for (let cy = Math.floor((sy - hh) / S); cy <= Math.floor((sy + hh) / S); cy++) for (let cx = Math.floor((sx - hw) / S); cx <= Math.floor((sx + hw) / S); cx++) ring.push([cx, cy, Math.hypot(cx + 0.5 - sx / S, cy + 0.5 - sy / S)]);
    ring.sort((a, b) => a[2] - b[2]);
    const out = [];
    for (const r of ring.slice(0, 24)) out.push([r[0], r[1], 0]);
    for (const l of list) out.push(l);
    for (const r of ring.slice(24)) out.push([r[0], r[1], 0]);
    return out;
  },
  feedBake(g) {
    // deposits of the wide approach view: generate their world chunks and far-zoom sprites ahead of time
    const W = Intro.warm || (Intro.warm = { list: null, i: 0 });
    if (!W.list && Intro.plan) {
      const T = Intro.T, s = Intro.plan.site, hw = innerWidth / 2 / T.z0 + 6, hh = innerHeight / 2 / T.z0 + T.h0 * 0.6;
      W.list = World.depositsInRect(g.world, s.x - hw, s.y - hh, s.x + hw, s.y + hh).slice();
    }
    if (W.list && W.i < W.list.length && Intro.t < Intro.T.swap) {
      const t0 = performance.now();
      while (W.i < W.list.length && performance.now() - t0 < 3) { const d = W.list[W.i++]; for (const p of [12, 16, 24]) DepositArt.sprite(d, p); Ground.depositRing(d, 12); }
    }
    const Q = Intro.prebake;
    if (!Q || !Q.length || !TerrainSys.P) return;
    let n = 0;
    while (Q.length && TerrainSys.queue.length < 24 && n++ < 12) { const [cx, cy, L] = Q.shift(); TerrainSys.request(g, cx, cy, L, 50 + Q.length * 0.01); }
    TerrainSys.pump();
  },

  // ---------------- per-frame ----------------
  frame(ts) {
    const g = Intro.g, T = Intro.T;
    const dt = Intro.last ? Math.min(0.1, (ts - Intro.last) / 1000) : 0;
    Intro.last = ts;
    if (!Intro.frozen) {
      const at = Intro.audio ? IntroAudio.time() : null;
      if (at !== null && at >= 0) Intro.t = Math.max(Intro.t, at); else Intro.t += dt;
    }
    const t = Intro.t;
    if (t >= T.end) { Intro.finish(); return; }
    Intro.feedBake(g);
    const fxc = $('#fx-canvas'), d = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    if (fxc.width !== Math.round(W * d) || fxc.height !== Math.round(H * d)) { fxc.width = Math.round(W * d); fxc.height = Math.round(H * d); }
    const ctx = fxc.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const loc = $('#screen-fx .intro-loc');
    if (loc) loc.style.opacity = String(Intro.reduced() ? IM.ss(0, 0.3, t) * (1 - IM.ss(T.swap - 0.2, T.swap + 0.2, t)) : IM.ss(T.entry + 0.3, T.entry + 0.8, t) * (1 - IM.ss(T.swap - 0.25, T.swap + 0.15, t)));
    if (t < T.swap) { Intro.drawSpace(ctx, W, H, t); return; }
    // world shots: real game world on the game canvas, clouds and haze on top
    ctx.clearRect(0, 0, W, H);
    const S = Intro.world(t);
    Intro.S = S;
    App.cam.x = S.camX; App.cam.y = S.camY; App.cam.zoom = S.zoom; App.cam.follow = false;
    Intro.applyPlayer(g, t, dt);
    App.alpha = 1;
    Frame.draw(g, 1, dt);
    Intro.drawOverlay(ctx, W, H, t, S);
  },

  // ---------------- shots 1-2: orbit and entry (side view) ----------------
  push(t) {
    const T = Intro.T;
    if (t < T.entry) return 1 + 0.5 * IM.sine(t / T.entry);
    return 1.5 + 1.0 * IM.sine((t - T.entry) / (T.swap - T.entry));
  },
  drawSpace(ctx, W, H, t) {
    const T = Intro.T, L = TitleScene.L, red = Intro.reduced();
    const s = Intro.push(t);
    const entry = IM.ss(T.entry, T.swap, t);
    const plasma = red ? 0 : IM.ss(T.entry + 0.25, T.entry + 1.1, t) * (1 - IM.ss(T.cloudIn, T.swap, t) * 0.7);
    // fully inside the cloud deck: only the clouds are visible
    if (IM.ss(T.cloudIn, T.swap - 0.02, t) > 0.985) { Intro.drawClouds(ctx, W, H, t, 'in'); return; }
    let sx = 0, sy = 0;
    if (Intro.shake() && t > T.entry + 0.5) { const a = plasma * 3.2; sx = (Math.sin(t * 37) + Math.sin(t * 61) * 0.6) * a * 0.6; sy = (Math.cos(t * 43) + Math.sin(t * 71) * 0.5) * a * 0.6; }
    ctx.save(); ctx.translate(sx, sy);
    const stream = red ? 0 : IM.ss(0, 2.5, t) * 0.08 + entry * 0.25;
    TitleScene.drawSky(ctx, W, H, t + TitleScene.t, s, stream, entry);
    if (L) TitleScene.drawPlanet(ctx, L, TitleScene.geo(L, s), t, entry);
    // lander: drifts in from the left in orbit, folds its wings, turns its shield into the flight path, dives
    const M = Math.min(W, H), Ls = U.clamp(M * 0.13, 46, 130);
    const u1 = IM.cl(t / T.entry), u2 = IM.cl((t - T.entry) / (T.swap - T.entry));
    let x = W * (-0.06 + 0.5 * u1), y = H * (0.28 + 0.05 * u1), sc = Ls * (0.9 + 0.15 * u1), rot = 0.12 - 0.05 * u1;
    if (t > T.entry - 1.1) rot = IM.lerp(rot, -0.72, IM.sine((t - (T.entry - 1.1)) / 1.3));
    if (t >= T.entry) { x = IM.lerp(W * 0.44, W * 0.55, IM.sine(u2)); y = IM.lerp(H * 0.33, H * 0.5, IM.sine(u2)); sc = Ls * (1.05 + 0.75 * IM.sine(u2)); }
    if (red) { x = W * 0.5; y = H * 0.34; sc = Ls; rot = 0; }
    const wings = red ? 1 : 1 - IM.ss(T.entry - 1.4, T.entry - 0.6, t);
    // speed lines (atmosphere), drawn behind the lander
    if (!red && entry > 0.05) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) {
        const ph = (t * (1.2 + IM.hf(i, 1) * 1.4) + IM.hf(i, 2)) % 1;
        const px = IM.hf(i, 3) * W * 1.3 - W * 0.15 + ph * W * 0.35, py = H * 1.1 - ph * H * 1.4;
        ctx.strokeStyle = 'rgba(255,220,190,' + (0.22 * plasma * Math.sin(ph * Math.PI)).toFixed(3) + ')'; ctx.lineWidth = 1 + IM.hf(i, 4) * 1.5;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 60 - 90 * IM.hf(i, 5), py + 90 + 130 * IM.hf(i, 5)); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(0, 0.45);
    LanderArt.plasma(ctx, plasma, t, 'back');
    LanderArt.profile(ctx, { legs: 0, wings, soot: IM.ss(T.entry, T.swap, t) * 0.8, tm: t });
    LanderArt.plasma(ctx, plasma, t, 'front');
    // attitude thrusters while turning
    for (const [tp, sd] of [[T.entry - 1.0, -1], [T.entry - 0.72, 1]]) LanderArt.rcs(ctx, sd * 0.38, -0.7, sd, -0.3, (t - tp) / 0.35);
    ctx.restore();
    // cloud banks rushing up, then full cover (no white flash: mid-tone, ramped over 0.75 s)
    Intro.drawClouds(ctx, W, H, t, 'in');
    ctx.restore();
  },
  cloudTex(puff) {
    const cc = Intro.cloudColor(), key = cc.join(',') + (puff ? 'p' : 'd');
    if (Intro._ct && Intro._ct[key]) return Intro._ct[key];
    Intro._ct = Intro._ct || {};
    const N = 256, c = Art.canvas(N, N), x = c.getContext('2d'), img = x.createImageData(N, N), D = img.data;
    const r = RNG.mulberry32(99), P = [];
    for (let i = 0; i < 512; i++) P.push(r());
    const vn = (px, py, f) => { const xi = Math.floor(px), yi = Math.floor(py), xf = px - xi, yf = py - yi, w = f; const H = (a, b) => P[(((a % w) + w) % w * 31 + (((b % w) + w) % w) * 17) & 511]; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = H(xi, yi), b = H(xi + 1, yi), cc = H(xi, yi + 1), d = H(xi + 1, yi + 1); return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v; };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let s = 0, a = 0.5, f = 4;
      for (let o = 0; o < 5; o++) { s += a * vn(i / N * f, j / N * f, f); a *= 0.5; f *= 2; }
      let k = IM.ss(0.36, 0.7, s);
      if (puff) { const dx = i / N - 0.5, dy = j / N - 0.5; k *= IM.ss(0.5, 0.18, Math.hypot(dx, dy * 1.25)); }
      // lit from the upper left: brighter where the density rises toward the light
      const lit = IM.cl(0.55 + (s - vn((i + 6) / N * 4, (j + 6) / N * 4, 4) * 0.5 - 0.25) * 1.6);
      const o = (j * N + i) * 4, sh = 0.78 + lit * 0.34;
      D[o] = cc[0] * sh; D[o + 1] = cc[1] * sh; D[o + 2] = cc[2] * sh; D[o + 3] = k * 255;
    }
    x.putImageData(img, 0, 0);
    return (Intro._ct[key] = c);
  },
  cloudColor() {
    const sky = Intro.g.world.planet.sky || [200, 200, 220];
    return sky.map((v, i) => Math.round((v * 0.45 + [228, 218, 210][i] * 0.55) * 0.78));
  },
  // mode 'in': banks rising during the entry, then cover; 'out': parting over the real world
  drawClouds(ctx, W, H, t, mode) {
    const T = Intro.T, cc = Intro.cloudColor(), tex = Intro.cloudTex(false), puff = Intro.cloudTex(true);
    const tint = (a) => 'rgba(' + cc[0] + ',' + cc[1] + ',' + cc[2] + ',' + a.toFixed(3) + ')';
    if (mode === 'in') {
      const cov = IM.ss(T.cloudIn, T.swap - 0.02, t);
      const banks = IM.ss(T.cloudIn - 0.9, T.cloudIn + 0.2, t);
      if (banks <= 0 && cov <= 0) return;
      // drawn at half resolution (soft anyway), composited once
      const c = Intro._cl || (Intro._cl = Art.canvas(4, 4)), q = 0.5;
      if (c.width !== Math.ceil(W * q) || c.height !== Math.ceil(H * q)) { c.width = Math.ceil(W * q); c.height = Math.ceil(H * q); }
      const x = c.getContext('2d');
      x.setTransform(q, 0, 0, q, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, W, H);
      // individual banks moving up past the camera
      for (let i = 0; i < 12; i++) {
        const st = T.cloudIn - 0.9 + IM.hf(i, 7) * 0.9, age = t - st;
        if (age < 0) continue;
        const sz = W * (0.45 + IM.hf(i, 8) * 0.5), px = IM.hf(i, 9) * W * 1.2 - W * 0.1 - age * W * 0.05, py = H * 1.15 - age * H * (0.55 + IM.hf(i, 10) * 0.5);
        if (py + sz * 0.4 < 0) continue;
        x.globalAlpha = Math.min(1, age * 2) * 0.85 * banks;
        x.drawImage(puff, px - sz / 2, py - sz / 2, sz, sz * 0.8);
      }
      if (cov > 0) {
        x.globalAlpha = cov * cov; x.fillStyle = tint(1); x.fillRect(0, 0, W, H);
        x.globalAlpha = cov;
        const sz = Math.max(W, H) * 0.9, o = (t * 0.35) % 1;
        for (let yy = -1; yy <= Math.ceil(H / sz) + 1; yy++) for (let xx = -1; xx <= Math.ceil(W / sz); xx++) x.drawImage(tex, xx * sz, (yy - o) * sz, sz, sz);
      }
      ctx.drawImage(c, 0, 0, W, H);
      return;
    }
    const k = 1 - IM.ss(T.app0, T.cloudGone, t);
    if (k <= 0) return;
    // the cloud deck parts from the centre (soft hole) while the camera sinks through it
    const c = Intro._cl || (Intro._cl = Art.canvas(4, 4));
    const q = 0.5;
    if (c.width !== Math.ceil(W * q) || c.height !== Math.ceil(H * q)) { c.width = Math.ceil(W * q); c.height = Math.ceil(H * q); }
    const x = c.getContext('2d');
    x.setTransform(q, 0, 0, q, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, W, H);
    const grow = 1 + (1 - k) * 1.6, sz = Math.max(W, H) * 0.9 * grow;
    x.globalAlpha = Math.min(1, k * 1.6); x.fillStyle = tint(1); x.fillRect(0, 0, W, H);
    x.globalAlpha = 1;
    for (let yy = -1; yy <= Math.ceil(H / sz) + 1; yy++) for (let xx = -1; xx <= Math.ceil(W / sz) + 1; xx++) x.drawImage(tex, W / 2 + (xx - 0.5) * sz, H / 2 + (yy - 0.5) * sz - (t * 20) % sz, sz, sz);
    x.globalCompositeOperation = 'destination-out';
    const R = Math.hypot(W, H) * 0.75 * (1 - k * 0.92), gr = x.createRadialGradient(W / 2, H / 2, R * 0.35, W / 2, H / 2, R);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = 'rgba(0,0,0,' + Math.min(1, k * 1.3).toFixed(3) + ')'; x.fillRect(0, 0, W, H);
    ctx.drawImage(c, 0, 0, W, H);
  },

  // ---------------- shots 3-6: approach, touchdown, exit (top-down, real world) ----------------
  world(t) {
    const T = Intro.T, P = Intro.plan;
    const u = IM.cl((t - T.app0) / (T.touch - T.app0));
    const h = t >= T.touch ? 0 : T.h0 * Math.pow(1 - u, 2.2);
    const dr = h / T.h0;
    const gx = P.site.x + P.drift[0] * dr * dr, gy = P.site.y + P.drift[1] * dr * dr;
    const zoom = 40 / (1 + h / P.hz);
    const tau = t - T.touch;
    let comp = 0;
    if (tau >= 0) comp = tau < 0.12 ? Math.sin(tau / 0.12 * Math.PI / 2) : Math.exp(-5 * (tau - 0.12)) * Math.cos(14 * (tau - 0.12));
    // camera: over the lander (between ship and its ground point), then gliding to the astronaut
    const lc = [gx, gy - h * Art.V * 0.5 - 0.5];
    const a = Intro.astro(t);
    const k = IM.sine(IM.cl((t - T.hatch1) / (T.walk1 - 0.2 - T.hatch1)));
    let camX = IM.lerp(lc[0], a.x, k), camY = IM.lerp(lc[1], a.y - 0.5, k);
    if (Intro.shake()) {
      if (tau >= 0 && tau < 0.8) camY += 3 / zoom * Math.exp(-9 * tau) * Math.sin(tau * 32);
      const rum = Intro.throttle(t, T) * IM.ss(T.touch - 2.2, T.touch, t) * (t < T.cut ? 1 : 0);
      camX += Math.sin(t * 53) * 0.6 / zoom * rum; camY += Math.cos(t * 47) * 0.6 / zoom * rum;
    }
    return {
      h, gx, gy, zoom, camX, camY, sc: 1 + 0.6 * Math.pow(dr, 0.8), thr: Intro.throttle(t, T),
      legs: IM.ss(T.legs0, T.legs1, t), comp: comp * 1, hatch: IM.ss(T.hatch0, T.hatch1, t), wings: IM.ss(T.touch + 1.0, T.touch + 2.2, t),
      heat: t < T.cut ? 1 : Math.max(0, 1 - (t - T.cut) / 20), tau
    };
  },
  // astronaut: down the ramp, then a smooth walk to the unchanged start position
  astro(t) {
    const T = Intro.T, P = Intro.plan, s = P.site, st = P.start;
    const d0 = [s.x, s.y + 0.47], r1 = [s.x, s.y + 1.36];
    if (t < T.hatch1) return { x: r1[0], y: r1[1], z: 0.86, vis: 0, moving: false, vx: 0, vy: 1 };
    if (t < T.ramp1) { const k = IM.cl((t - T.hatch1) / (T.ramp1 - T.hatch1)); return { x: d0[0], y: IM.lerp(d0[1], r1[1], k), z: 0.86 * (1 - k), vis: IM.cl(k * 4), moving: true, vx: 0, vy: 1, ramp: true }; }
    const k = IM.cl((t - T.ramp1) / (T.walk1 - T.ramp1)), e = IM.sine(k);
    const c = [IM.lerp(r1[0], st.x, 0.15), Math.max(r1[1], st.y) + 0.9];
    const bx = (1 - e) * (1 - e) * r1[0] + 2 * (1 - e) * e * c[0] + e * e * st.x, by = (1 - e) * (1 - e) * r1[1] + 2 * (1 - e) * e * c[1] + e * e * st.y;
    const dx = 2 * (1 - e) * (c[0] - r1[0]) + 2 * e * (st.x - c[0]), dy = 2 * (1 - e) * (c[1] - r1[1]) + 2 * e * (st.y - c[1]);
    return { x: bx, y: by, z: 0, vis: 1, moving: k < 0.97, vx: dx, vy: dy };
  },
  applyPlayer(g, t, dt) {
    if (Intro.replayMode) { Intro.hidePlayer = true; return; }
    const a = Intro.astro(t), p = g.run.player;
    Intro.hidePlayer = t < Intro.T.ramp1;
    if (t >= Intro.T.hatch1) {
      p.x = p.px = a.x; p.y = p.py = a.y; p.moving = a.moving;
      const l = Math.hypot(a.vx, a.vy) || 1; p.vx = a.vx / l * 2.5; p.vy = a.vy / l * 2.5;
      if (Math.abs(a.vx) > 0.05) p.face = a.vx > 0 ? 1 : -1;
    }
    if (!Intro.hidePlayer) Ground.update(g, dt);
  },
  // world-space hooks used by Frame.draw
  groundDecals(ctx, g) {
    const lander = Intro.active ? Intro.plan && Intro.plan.site : g.run.lander;
    if (lander) {
      const ppt = Art.bucket(Render.ppt(), 96), sc = LanderArt.scorch(ppt);
      const a = Intro.active ? IM.ss(Intro.T.touch - 0.6, Intro.T.touch + 0.5, Intro.t) : 1;
      if (a > 0) { ctx.globalAlpha = a; ctx.drawImage(sc.canvas, lander.x - sc.R - Render.ox, lander.y - sc.R - Render.oy, sc.R * 2, sc.R * 2); ctx.globalAlpha = 1; }
      if (!Intro.active) Intro.landerShadow(ctx, lander.x, lander.y, 0, 1);
    }
    if (Intro.active && Intro.S && Intro.t >= Intro.T.app0) Intro.worldGround(ctx, Intro.S, Intro.t);
    if (Intro.rv) Intro.revealGround(ctx, g);
  },
  landerShadow(ctx, x, y, h, sc) {
    const a = 0.42 * (1 - Math.min(1, h / 26));
    if (a <= 0.01) return;
    const ox = h * 0.22 + 0.35, oy = h * 0.13 + 0.2, w = (2.2 + h * 0.06) * sc, d = (1.05 + h * 0.035) * sc;
    ctx.globalAlpha = a;
    ctx.drawImage(FxLib.tinted('soft', 0, '#140a08'), x + ox - w - Render.ox, y + oy - d - Render.oy, w * 2, d * 2);
    ctx.globalAlpha = 1;
  },
  worldGround(ctx, S, t) {
    const T = Intro.T, P = Intro.plan, sx = P.site.x, sy = P.site.y;
    const zk = IM.cl((S.zoom - T.z0) / (40 - T.z0)), haze = 0.5 * Math.pow(1 - zk, 1.6);
    if (haze > 0.005) {
      const sky = Intro.g.world.planet.sky || [200, 200, 220], vr = Render.visibleRect(2);
      ctx.fillStyle = 'rgba(' + sky.join(',') + ',' + (haze * 0.75).toFixed(3) + ')';
      ctx.fillRect(vr.x0 - Render.ox, vr.y0 - Render.oy, vr.x1 - vr.x0, vr.y1 - vr.y0);
    }
    Intro.landerShadow(ctx, S.gx, S.gy, S.h, S.sc);
    // engine light on the ground
    const lit = S.thr * IM.cl(1 - S.h / 22);
    if (lit > 0.01) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * lit;
      const r = 2.4 + 3.5 * S.thr;
      ctx.drawImage(FxLib.tinted('soft', 0, '#ff9a48'), S.gx - r - Render.ox, S.gy - r * 0.6 - Render.oy, r * 2, r * 1.2);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // air ring at touchdown
    if (S.tau >= 0 && S.tau < 1.1) {
      const k = S.tau / 1.1, rr = 1.3 + 6.5 * Art.ease.outCubic(k);
      ctx.strokeStyle = Col.rgba(P.dust.hi, 0.42 * (1 - k)); ctx.lineWidth = 0.7 * (1 - k) + 0.1;
      ctx.beginPath(); ctx.ellipse(sx - Render.ox, sy - Render.oy, rr, rr * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    }
    Intro.drawDust(ctx, t, -1);
  },
  // blown dust: three shaded layers (shadow, body, lit top-left), back half before the lander, front half after
  // one pre-shaded sprite per variant: shadow (bottom right), body, light (top left) baked together
  dustSprite(v) {
    const P = Intro.plan, key = 'INTRO|dust|' + v + '|' + P.dust.mid;
    return Art.cached(key, () => {
      const N = 96, c = Art.canvas(N, N), x = c.getContext('2d');
      x.globalAlpha = 0.5; x.drawImage(FxLib.tinted('dust', v, P.dust.lo), N * 0.09, N * 0.08, N * 0.86, N * 0.86);
      x.globalAlpha = 1; x.drawImage(FxLib.tinted('dust', v, P.dust.mid), N * 0.03, N * 0.03, N * 0.86, N * 0.86);
      x.globalAlpha = 0.55; x.drawImage(FxLib.tinted('dust', (v + 1) % 3, P.dust.hi), N * 0.06, N * 0.04, N * 0.6, N * 0.6);
      return c;
    });
  },
  drawDust(ctx, t, half) {
    if (Intro.reduced()) return;
    const P = Intro.plan, T = Intro.T, sx = P.site.x, sy = P.site.y;
    for (const q of P.parts) {
      const age = t - q.b;
      if (age < 0 || age > q.life) continue;
      const sa = Math.sin(q.a);
      if ((sa < 0 ? -1 : 1) !== half) continue;
      // before touchdown only the low part of the descent kicks up dust
      const hAt = q.b < T.touch ? T.h0 * Math.pow(1 - IM.cl((q.b - T.app0) / (T.touch - T.app0)), 2.2) : 0;
      if (hAt > 7) continue;
      const k = 1.5, dist = 1.1 + q.v / k * (1 - Math.exp(-k * age));
      const x = sx + Math.cos(q.a) * dist, y = sy + sa * dist * 0.55;
      const z = q.rise * (1 - Math.exp(-age * 1.2)) * 0.9;
      const s = q.s * Math.min(2.2, 1 + age * 0.7);
      const a = q.al * Math.sin(Math.PI * IM.cl(age / q.life)) * (1 - hAt / 8);
      if (a < 0.03) continue;
      const px = x - Render.ox, py = y - z * Art.V - Render.oy;
      ctx.globalAlpha = a; ctx.drawImage(Intro.dustSprite(q.v3), px - s, py - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
  },
  // sorted layer: the lander (animated during the intro, cached landmark afterwards) and the astronaut on the ramp
  sortItems(items, g) {
    if (Intro.active && Intro.S) {
      const S = Intro.S;
      items.push({ key: S.h > 0.5 ? 1e9 : Intro.plan.site.y + 0.62, draw: c => Intro.drawLanderWorld(c, S, Intro.t) });
      const a = Intro.astro(Intro.t);
      if (!Intro.replayMode && a.ramp) items.push({ key: Intro.plan.site.y + 1.5, draw: c => { c.globalAlpha = a.vis; CharArt.astronaut(c, g, a.x - Render.ox, a.y - a.z * Art.V - Render.oy, Draw.tm, Draw.dt); c.globalAlpha = 1; } });
      return;
    }
    const L = g.run.lander;
    if (!L) return;
    const vr = Render.visibleRect(4);
    if (L.x < vr.x0 || L.x > vr.x1 || L.y < vr.y0 || L.y > vr.y1 + 3) return;
    items.push({ kind: 'lander', key: L.y + 0.62, x: L.x, y: L.y, draw: c => Intro.drawLanderStatic(c, L) });
  },
  drawLanderStatic(ctx, L) {
    const ppt = Art.bucket(Render.ppt(), 192), s = LanderArt.sprite(ppt);
    ctx.drawImage(s.canvas, L.x + s.ox - Render.ox, L.y + s.oy - Render.oy, s.w, s.h);
    // antenna beacon (blinks; visible at night) and cooling nozzles shortly after the landing
    const on = Math.sin(Draw.tm * 3.1) > 0.6;
    if (on) Art.light(ctx, L.x + 0.48 - Render.ox, L.y - 1.875 - Render.oy, 0.035, '#ff5a3a', 1);
  },
  drawLanderWorld(ctx, S, t) {
    const T = Intro.T, P = Intro.plan;
    const x = S.gx - Render.ox, y = S.gy - S.h * Art.V - Render.oy;
    if (S.thr > 0.01) {
      const r = Math.max(1.6, 46 / S.zoom) * (0.8 + S.thr * 0.4);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * S.thr;
      ctx.drawImage(FxLib.tinted('soft', 0, '#ffb060'), x - r, y + 0.3 * S.sc - r, r * 2, r * 2);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(S.sc, S.sc);
    const len = Math.min(0.6 + S.thr * 1.9, (S.h * Art.V) / S.sc + 0.45);
    LanderArt.plumeTop(ctx, len, S.thr, t);
    if (S.hatch >= 1 && S.wings >= 1 && Math.abs(S.comp) < 0.004 && S.thr <= 0) { const sp = LanderArt.sprite(Art.bucket(Render.ppt(), 192)); ctx.drawImage(sp.canvas, sp.ox, sp.oy, sp.w, sp.h); }
    else LanderArt.top(ctx, { legs: S.legs, comp: S.comp, hatch: S.hatch, wings: S.wings, soot: 0.8, heat: S.heat, tm: t });
    for (const [tp, sd] of [[T.app0 + 1.1, -1], [T.app0 + 2.4, 1], [T.touch - 0.7, -1]]) LanderArt.rcs(ctx, sd * 0.85, -1.2, sd, -0.2, (t - tp) / 0.35);
    // steam from the hot nozzles after the cut
    for (const q of P.steam) {
      const age = t - q.b;
      if (age < 0 || age > q.life) continue;
      const k = age / q.life, s = q.s * (1 + k * 2.2);
      ctx.globalAlpha = 0.35 * Math.sin(Math.PI * k);
      ctx.drawImage(FxLib.get('steam', 0), q.x + k * 0.5 - s, 0.15 - k * 1.3 - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // pebbles on ballistic arcs with tiny shadows, then the front dust layer
    if (S.tau > -0.2 && !Intro.reduced()) {
      const sx = P.site.x, sy = P.site.y, g = 9;
      for (const q of P.pebbles) {
        const age = t - q.b;
        if (age < 0 || age > 2.5) continue;
        const Tf = 2 * q.vz / g, ta = Math.min(age, Tf);
        const dist = 1.0 + q.vh * ta + (age > Tf ? q.vh * 0.25 * (1 - Math.exp(-(age - Tf) * 3)) : 0);
        const z = Math.max(0, q.vz * ta - g * ta * ta / 2);
        const px = sx + Math.cos(q.a) * dist - Render.ox, py = sy + Math.sin(q.a) * dist * 0.55 - Render.oy;
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(px, py, q.s, q.s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.dust.lo; ctx.beginPath(); ctx.arc(px, py - z * Art.V, q.s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.dust.hi; ctx.beginPath(); ctx.arc(px - q.s * 0.3, py - z * Art.V - q.s * 0.3, q.s * 0.45, 0, Math.PI * 2); ctx.fill();
      }
    }
    Intro.drawDust(ctx, t, 1);
  },
  // screen overlay over the world: parting clouds, altitude haze, soft vignette
  drawOverlay(ctx, W, H, t, S) {
    const T = Intro.T;
    const z = IM.cl((S.zoom - T.z0) / (40 - T.z0));
    const vk = W + 'x' + H;
    if (!Intro._vig || Intro._vig.key !== vk) {
      const c = Art.canvas(W / 2, H / 2), x = c.getContext('2d'), v = x.createRadialGradient(W / 4, H / 4, Math.min(W, H) * 0.175, W / 4, H / 4, Math.hypot(W, H) * 0.31);
      v.addColorStop(0, 'rgba(10,5,12,0)'); v.addColorStop(1, 'rgba(10,5,12,1)'); x.fillStyle = v; x.fillRect(0, 0, W / 2, H / 2);
      Intro._vig = { key: vk, c };
    }
    ctx.globalAlpha = 0.28 + 0.2 * (1 - z); ctx.drawImage(Intro._vig.c, 0, 0, W, H); ctx.globalAlpha = 1;
    Intro.drawClouds(ctx, W, H, t, 'out');
  },

  // ---------------- handover ----------------
  finish() {
    if (!Intro.active) return;
    const g = Intro.g, P = Intro.plan, T = Intro.T;
    IntroAudio.stop();
    Intro.active = false; Intro.hidePlayer = false; Intro.S = null;
    const p = g.run.player;
    if (Intro.replayMode) {
      const s = Intro.snap; p.x = p.px = s.x; p.y = p.py = s.y; g.run.lander = s.lander;
      if (s.lander) Collide.extra = [LanderArt.hitbox(s.lander.x, s.lander.y)];
      Object.assign(App.cam, s.cam);
    } else {
      p.x = p.px = P.start.x; p.y = p.py = P.start.y; p.vx = p.vy = 0; p.moving = false; p.face = 1;
      g.run.lander = { x: P.site.x, y: P.site.y };
      g.meta.introSeen = true;
      Collide.extra = [LanderArt.hitbox(P.site.x, P.site.y)];
      App.cam.x = p.x; App.cam.y = p.y - 0.5; App.cam.zoom = CONFIG.zoomDefault;
    }
    App.cam.follow = true;
    UI.updateCenterBtn();
    const fx = $('#screen-fx');
    fx.classList.add('hidden'); fx.classList.remove('intro');
    const loc = fx.querySelector('.intro-loc'); if (loc) loc.remove();
    document.body.classList.remove('intro');
    // HUD comes in staggered (90 ms steps)
    document.body.classList.add('hud-in');
    ['#hud-left', '#hud-right', '#actions', '#buildbar', '#research-chip', '#contracts-chip'].forEach((s, i) => { const el = $(s); if (el) el.style.animationDelay = (i * 90) + 'ms'; });
    setTimeout(() => { document.body.classList.remove('hud-in'); ['#hud-left', '#hud-right', '#actions', '#buildbar', '#research-chip', '#contracts-chip'].forEach(s => { const el = $(s); if (el) el.style.animationDelay = ''; }); }, 1200);
    TitleScene.release();
    Intro._cl = null; Intro._vig = null;
    if (Intro.prebake) Intro.prebake.length = 0;
    App.running = true; MainLoop.last = 0;
    Intro.landedAt = performance.now();
    void T;
    // end state snapshot (tests: skipping and watching must end identically)
    if (!Intro.replayMode) { try { const o = Save.toObject(g, { lastSeen: 1 }); o.savedAt = 0; Intro.endState = JSON.stringify(o); } catch (e) { Intro.endState = null; } }
    if (!Intro.replayMode) MainLoop.afterIntro(g);
  },

  // ---------------- lucky reveal in the world ----------------
  dirWord(dx, dy) {
    const a = Math.atan2(-dy, dx), i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    return ['östlich', 'nordöstlich', 'nördlich', 'nordwestlich', 'westlich', 'südwestlich', 'südlich', 'südöstlich'][i];
  },
  reveal(g) {
    const W = g.world.start;
    if (!W || !W.deposits || !W.deposits.length) { Intro.afterCard(g); return; }
    const luck = W.luck | 0, p = g.run.player;
    const best = W.deposits.reduce((a, d) => d.tier > a.tier ? d : a, W.deposits[0]);
    // start deposits carry only their seed tile: the centre comes from the real cluster in the world
    const cen = d => {
      const real = World.depositsInRect(g.world, d.x - 1, d.y - 1, d.x + 2, d.y + 2).find(q => q.res === d.res && q.tiles);
      if (!real) return [d.x + 0.5, d.y + 0.5];
      let sx = 0, sy = 0; for (const t of real.tiles) { sx += t[0] + 0.5; sy += t[1] + 0.5; } return [sx / real.tiles.length, sy / real.tiles.length];
    };
    let dep = best;
    if (luck === 0) { let bd = 1e9; for (const d of W.deposits) { const c = cen(d), dd = Math.hypot(c[0] - p.x, c[1] - p.y); if (dd < bd) { bd = dd; dep = d; } } }
    const [cx, cy] = cen(dep);
    const o = g.run.lander ? [g.run.lander.x + 0.48, g.run.lander.y - 0.2] : [p.x, p.y];
    const dist = Math.hypot(cx - o[0], cy - o[1]);
    const red = Intro.reduced();
    Intro.rv = {
      g, t: 0, luck, dep, cx, cy, ox: o[0], oy: o[1], dist, hit: dist / 26, col: DATA.TIERS[dep.tier].color,
      name: DATA.RESOURCES[dep.res].name, tierName: DATA.TIERS[dep.tier].name, glide: luck >= 1 && !red, hitDone: false, card: false, cam: null, until: 90, done: false
    };
    if (Audio2.ok('ping')) { Audio2.tone(1320, 0.6, 'sine', 0.07); Audio2.tone(1980, 0.4, 'sine', 0.035, { delay: 0.12 }); }
  },
  // called every frame from the main loop (before the camera update)
  update(g, dt) {
    const R = Intro.rv;
    if (!R || R.g !== g) return;
    R.t += dt;
    const p = g.run.player, moving = Math.hypot(g.input.x || 0, g.input.y || 0) > 0.1;
    if (!R.hitDone && R.t >= R.hit) {
      R.hitDone = true;
      if (R.luck >= 2) { Audio2.play('unlock'); Progression.unlock(g, 'jackpot'); } else Audio2.play('found');
      if (R.glide) { R.cam = { t: 0, x0: App.cam.x, y0: App.cam.y }; App.cam.follow = false; }
    }
    // camera: glide 1.0 s to the deposit, hold 1.2 s, back 0.8 s; any movement hands the camera back at once
    if (R.cam) {
      R.cam.t += dt;
      const c = R.cam, tx = R.cx, ty = R.cy - 0.4, bx = p.x, by = p.y - 0.5;
      if (moving || c.t > 3.0) { R.cam = null; App.cam.follow = true; }
      else if (c.t < 1.0) { const k = IM.sine(c.t); App.cam.x = IM.lerp(c.x0, tx, k); App.cam.y = IM.lerp(c.y0, ty, k); }
      else if (c.t < 2.2) { App.cam.x = tx; App.cam.y = ty; }
      else { const k = IM.sine((c.t - 2.2) / 0.8); App.cam.x = IM.lerp(tx, bx, k); App.cam.y = IM.lerp(ty, by, k); }
    }
    const cardAt = R.hit + (R.glide ? 3.05 : 0.7);
    if (!R.card && R.t >= cardAt && !R.cam && !UI.modalOpen()) { R.card = true; Intro.showCard(g, R); }
    if (Intro.card && Intro.card.autoAt === undefined && p.moving) Intro.card.autoAt = R.t + 6;
    if (Intro.card && Intro.card.autoAt !== undefined && R.t >= Intro.card.autoAt) Intro.closeCard();
    // marker lives until the player is within 6 steps or 90 s passed
    const dd = Math.hypot(R.cx - p.x, R.cy - p.y);
    if (R.hitDone && (dd <= 6 || R.t > R.until)) { R.markerOff = R.markerOff || R.t; }
    if (R.markerOff && R.t - R.markerOff > 1.2 && R.card && !Intro.card) Intro.rv = null;
  },
  revealGround(ctx, g) {
    const R = Intro.rv;
    // scan ping ring from the lander antenna
    if (R.t < R.hit + 0.9) {
      const r = Math.min(R.dist + 2, R.t * 26), a = 0.55 * (1 - IM.ss(R.hit, R.hit + 0.9, R.t));
      ctx.strokeStyle = Col.rgba('#9fe8ff', a); ctx.lineWidth = 0.22;
      ctx.beginPath(); ctx.ellipse(R.ox - Render.ox, R.oy - Render.oy, r, r * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = Col.rgba('#9fe8ff', a * 0.4); ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.ellipse(R.ox - Render.ox, R.oy - Render.oy, Math.max(0.1, r - 0.6), Math.max(0.1, r - 0.6) * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (!R.hitDone) return;
    // the deposit lights up in its rarity colour
    const k = R.t - R.hit, pulse = 0.75 + 0.25 * Math.sin(k * 3);
    const fade = R.markerOff ? Math.max(0, 1 - (R.t - R.markerOff) / 1.2) : 1;
    const amp = (R.luck === 0 ? 0.35 : R.luck === 1 ? 0.6 : 0.85) * Math.min(1, k * 3) * fade;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = amp * pulse;
    const rr = 2.2 + R.luck * 0.6;
    ctx.drawImage(FxLib.tinted('soft', 0, R.col), R.cx - rr - Render.ox, R.cy - rr * 0.6 - Render.oy, rr * 2, rr * 1.2);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
  // light column, sparks and the world label (after the sorted layer)
  worldFx(ctx, g) {
    const R = Intro.rv;
    if (!R || !R.hitDone || R.g !== g) return;
    const k = R.t - R.hit, fade = R.markerOff ? Math.max(0, 1 - (R.t - R.markerOff) / 1.2) : 1;
    const x = R.cx - Render.ox, y = R.cy - Render.oy;
    if (R.luck >= 1) {
      const Hc = R.luck >= 2 ? 9 : 5.5, w = R.luck >= 2 ? 1.1 : 0.8;
      const a = Math.min(1, k * 2.5) * (0.55 + 0.25 * (R.luck >= 2 ? 1 : 0)) * (k < 6 ? 1 : Math.max(0.35, 1 - (k - 6) / 6)) * fade;
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createLinearGradient(0, y, 0, y - Hc);
      gr.addColorStop(0, Col.rgba(R.col, 0.7 * a)); gr.addColorStop(0.5, Col.rgba(R.col, 0.25 * a)); gr.addColorStop(1, Col.rgba(R.col, 0));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w * 0.3, y - Hc); ctx.lineTo(x + w * 0.3, y - Hc); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
      // rising sparks (pure function of time)
      const n = R.luck >= 2 ? 26 : 12;
      for (let i = 0; i < n; i++) {
        const ph = (k * (0.35 + IM.hf(i, 21) * 0.4) + IM.hf(i, 22)) % 1;
        const sx = x + (IM.hf(i, 23) - 0.5) * w * 1.6, sy = y - ph * Hc * 0.8;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * a;
        ctx.drawImage(FxLib.tinted('spark', 0, R.col), sx - 0.12, sy - 0.12, 0.24, 0.24);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  },
  // screen-space: label above the deposit or an edge arrow, both with the distance in steps
  overlay(ctx, g) {
    const R = Intro.rv;
    if (!R || !R.hitDone || R.g !== g) return;
    const fade = R.markerOff ? Math.max(0, 1 - (R.t - R.markerOff) / 1.2) : 1;
    if (fade <= 0) return;
    const d = App.view.dpr, W = App.view.w, H = App.view.h;
    const p = g.run.player, steps = Math.max(1, Math.round(Math.hypot(R.cx - p.x, R.cy - p.y)));
    const [sx, sy] = Render.worldToScreen(R.cx, R.cy - (R.luck >= 1 ? 1.6 : 1.0));
    ctx.save(); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = fade * Math.min(1, (R.t - R.hit) * 3);
    const M = 46, inside = sx > M && sx < W - M && sy > M + 40 && sy < H - M - 60;
    ctx.font = '700 14px system-ui, sans-serif'; ctx.textBaseline = 'middle';
    if (inside) {
      const txt = R.name + ' · ' + steps + ' Schritte', tw = ctx.measureText(txt).width + 20;
      ctx.fillStyle = 'rgba(20,12,18,.88)'; Art.rrect(ctx, sx - tw / 2, sy - 30, tw, 26, 13); ctx.fill();
      ctx.strokeStyle = R.col; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fbf2ea'; ctx.textAlign = 'center'; ctx.fillText(txt, sx, sy - 17);
      ctx.fillStyle = R.col; ctx.beginPath(); ctx.moveTo(sx - 6, sy - 4); ctx.lineTo(sx + 6, sy - 4); ctx.lineTo(sx, sy + 4); ctx.closePath(); ctx.fill();
    } else {
      const cx = W / 2, cy = H / 2, a = Math.atan2(sy - cy, sx - cx);
      const ex = U.clamp(cx + Math.cos(a) * W, M, W - M), ey = U.clamp(cy + Math.sin(a) * H, M + 40, H - M - 60);
      ctx.translate(ex, ey);
      ctx.fillStyle = 'rgba(20,12,18,.9)'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = R.col; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.rotate(a); ctx.fillStyle = R.col; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(2, -8); ctx.lineTo(2, 8); ctx.closePath(); ctx.fill(); ctx.restore();
      const txt = steps + ' Schritte', tw = ctx.measureText(txt).width + 16, ly = ey > H / 2 ? -40 : 40;
      ctx.fillStyle = 'rgba(20,12,18,.88)'; Art.rrect(ctx, -tw / 2, ly - 12, tw, 24, 12); ctx.fill();
      ctx.fillStyle = '#fbf2ea'; ctx.textAlign = 'center'; ctx.fillText(txt, 0, ly + 1);
    }
    ctx.restore();
  },
  showCard(g, R) {
    const names = ['Normalstart', 'Guter Start!', 'Jackpot!', 'Wunder-Start!!'];
    const p = g.run.player, steps = Math.max(1, Math.round(Math.hypot(R.cx - p.x, R.cy - p.y)));
    const where = 'liegt etwa ' + steps + ' Schritte ' + Intro.dirWord(R.cx - p.x, R.cy - p.y) + '.';
    const text = R.luck === 0 ? 'Gewöhnliche Vorkommen in der Nähe: <b style="color:' + R.col + '">' + esc(R.name) + '</b> (' + esc(R.tierName) + ') ' + where
      : '<b style="color:' + R.col + '">' + esc(R.name) + '</b> (' + esc(R.tierName) + ') ' + where;
    const card = h('div', { class: 'reveal-card', role: 'status', 'aria-live': 'polite' },
      h('div', { class: 'rc-label', text: 'Glücksstart' }),
      h('div', { class: 'rc-word', style: { color: R.col }, text: names[R.luck] || names[0] }),
      h('p', { class: 'rc-text', html: text }),
      h('button', { class: 'rc-go', onclick: e => { e.stopPropagation(); Intro.closeCard(); } }, 'Los geht\'s'));
    card.addEventListener('pointerdown', e => { e.stopPropagation(); });
    card.addEventListener('click', () => Intro.closeCard());
    // place it where it covers neither the astronaut nor the deposit
    const W = innerWidth, H = innerHeight;
    // avoid the astronaut, the lander and the deposit (or its edge arrow, clamped into the screen)
    const dep = Render.worldToScreen(R.cx, R.cy);
    const pts = [Render.worldToScreen(p.x, p.y - 0.6), [U.clamp(dep[0], 46, W - 46), U.clamp(dep[1], 86, H - 106)]];
    if (g.run.lander) pts.push(Render.worldToScreen(g.run.lander.x, g.run.lander.y - 0.8));
    const bottomBand = [H - 330, H - 90], topBand = [Math.min(220, H * 0.22), Math.min(220, H * 0.22) + 210];
    const hits = band => pts.some(q => q[1] > band[0] - 40 && q[1] < band[1] + 40 && Math.abs(q[0] - W / 2) < 260);
    card.classList.add(!hits(bottomBand) || hits(topBand) ? 'bottom' : 'top');
    $('#ui').append(card);
    requestAnimationFrame(() => card.classList.add('show'));
    Intro.card = { el: card };
    g.run.luckyRevealSeen = true;
    try { card.querySelector('.rc-go').focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  },
  closeCard() {
    const c = Intro.card;
    if (!c) return;
    Intro.card = null;
    c.el.classList.remove('show');
    setTimeout(() => c.el.remove(), 260);
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (e) { /* ignore */ }
    const g = App.g;
    setTimeout(() => Intro.afterCard(g), 800);
  },
  afterCard(g) {
    if (!g || App.g !== g) return;
    if (!g.meta.tutorial.done && !Tutorial.active) Tutorial.start();
  },
  // debug: ?intro=force (fresh game with the intro, nothing is saved) or ?intro=t:5.5 (seek and hold)
  debugParam() {
    const m = /[?&]intro=([^&]+)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }
};
