// =====================================================================
// TerrainSys: main-thread manager for baked terrain chunks.
// Up to two Web Workers (built from TerrainCore's own source, so it all
// stays inside this single file), a main-thread fallback in 2 ms time
// slices, an LRU cache with a memory budget, four detail levels with
// cross-fades, look-ahead prefetching, and the rock/prop layer.
// =====================================================================
const TerrainSys = {
  LEVELS: [4, 10, 20, 34],
  workers: [], idle: [], queue: [], inflight: new Map(),
  cache: new Map(), bytes: 0,
  P: null, gen: 0, fallback: null, ok: true,
  budget() { return App.touch ? 110e6 : 190e6; },
  source() {
    const parts = [];
    for (const [k, v] of Object.entries(TerrainCore)) {
      if (typeof v === 'function') parts.push(v.toString());
      else parts.push(k + ': ' + JSON.stringify(k === 'GT' || k === '_gc' ? null : v));
    }
    return 'const TerrainCore = {\n' + parts.join(',\n') + '\n};\n' +
      'self.onmessage = e => { const j = e.data; let r;\n' +
      ' try { r = TerrainCore.bake(j); } catch (err) { self.postMessage({ key: j.key, gen: j.gen, error: String(err) }); return; }\n' +
      ' const msg = { key: j.key, gen: j.gen, w: r.w, h: r.h, mats: r.mats, props: r.props, lms: r.lms }; const tr = [];\n' +
      ' if (typeof OffscreenCanvas !== "undefined") {\n' +
      '  const oc = new OffscreenCanvas(r.w, r.h); oc.getContext("2d").putImageData(new ImageData(r.rgba, r.w, r.h), 0, 0); msg.bmp = oc.transferToImageBitmap(); tr.push(msg.bmp);\n' +
      '  if (r.emis) { const oe = new OffscreenCanvas(r.w, r.h); oe.getContext("2d").putImageData(new ImageData(r.emis, r.w, r.h), 0, 0); msg.ebmp = oe.transferToImageBitmap(); tr.push(msg.ebmp); }\n' +
      ' } else { msg.rgba = r.rgba; tr.push(r.rgba.buffer); if (r.emis) { msg.emis = r.emis; tr.push(r.emis.buffer); } }\n' +
      ' self.postMessage(msg, tr); };';
  },
  init() {
    TerrainCore.init();
    if (TerrainSys.workers.length || !window.Worker || !window.Blob) return;
    try {
      const url = URL.createObjectURL(new Blob([TerrainSys.source()], { type: 'text/javascript' }));
      const n = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1));
      for (let i = 0; i < n; i++) {
        const w = new Worker(url);
        w.onmessage = e => TerrainSys.onResult(w, e.data);
        w.onerror = () => { TerrainSys.workers = TerrainSys.workers.filter(x => x !== w); TerrainSys.idle = TerrainSys.idle.filter(x => x !== w); };
        TerrainSys.workers.push(w); TerrainSys.idle.push(w);
      }
    } catch (e) { TerrainSys.workers = []; TerrainSys.idle = []; }
  },
  setPlanet(planet, seed) {
    TerrainSys.init();
    TerrainSys.P = TerrainCore.params(planet, seed);
    TerrainSys.P.landing = [CONFIG.landing.x, CONFIG.landing.y];
    TerrainSys.gen++;
    TerrainSys.cache.clear(); TerrainSys.bytes = 0; TerrainSys.queue.length = 0; TerrainSys.inflight.clear(); TerrainSys.fallback = null;
    if (TerrainCore._gc) TerrainCore._gc.clear();
    TerrainSys.idle = TerrainSys.workers.slice();
    TerrainSys.matCache = new Map();
  },
  key(cx, cy, L) { return cx + ',' + cy + ',' + L; },
  levelFor(ppt) {
    const L = TerrainSys.LEVELS, q = App.quality === 'low' ? 2 : 3;
    for (let i = 0; i <= q; i++) if (L[i] >= ppt * 0.8) return i;
    return q;
  },
  depsFor(g, cx, cy) {
    const S = CONFIG.chunkSize;
    const list = World.depositsInRect(g.world, cx * S - 5, cy * S - 5, (cx + 1) * S + 5, (cy + 1) * S + 5);
    return list.map(d => {
      let sx = 0, sy = 0; for (const t of d.tiles) { sx += t[0] + 0.5; sy += t[1] + 0.5; }
      return { x: sx / d.tiles.length, y: sy / d.tiles.length, r: 0.7 + Math.sqrt(d.tiles.length) * 0.55, tier: d.tier, col: DATA.RESOURCES[d.res].color };
    });
  },
  request(g, cx, cy, L, prio) {
    const key = TerrainSys.key(cx, cy, L);
    if (TerrainSys.cache.has(key) || TerrainSys.inflight.has(key)) return;
    const q = TerrainSys.queue.find(j => j.key === key);
    if (q) { q.prio = Math.min(q.prio, prio); return; }
    const deps = TerrainSys.depsFor(g, cx, cy);
    TerrainSys.queue.push({ key, cx, cy, L, prio, S: CONFIG.chunkSize, res: TerrainSys.LEVELS[L], P: TerrainSys.P, deps, depKey: deps.length + ':' + deps.map(d => d.x.toFixed(1)).join(','), gen: TerrainSys.gen });
  },
  pump() {
    const Q = TerrainSys.queue;
    if (!Q.length) return;
    Q.sort((a, b) => a.prio - b.prio);
    if (Q.length > 60) Q.length = 60;
    if (TerrainSys.workers.length) {
      while (TerrainSys.idle.length && Q.length) {
        const j = Q.shift(), w = TerrainSys.idle.pop();
        TerrainSys.inflight.set(j.key, j);
        w.postMessage(j);
      }
      return;
    }
    // fallback: bake on the main thread in time slices (max ~2 ms per frame)
    const t0 = performance.now();
    if (!TerrainSys.fallback) { const j = Q.shift(); TerrainSys.fallback = { job: j, it: TerrainCore.bakeIter(j) }; }
    const F = TerrainSys.fallback;
    let r;
    do { r = F.it.next(); } while (!r.done && performance.now() - t0 < 2);
    if (r.done) {
      TerrainSys.fallback = null;
      const v = r.value;
      TerrainSys.store(F.job, { w: v.w, h: v.h, rgba: v.rgba, emis: v.emis, mats: v.mats, props: v.props, lms: v.lms });
    }
  },
  onResult(w, m) {
    TerrainSys.idle.push(w);
    const job = TerrainSys.inflight.get(m.key);
    TerrainSys.inflight.delete(m.key);
    if (!job || m.gen !== TerrainSys.gen || m.error) return;
    TerrainSys.store(job, m);
  },
  store(job, m) {
    let img = m.bmp, em = m.ebmp || null;
    if (!img) {
      const c = Art.canvas(m.w, m.h); c.getContext('2d').putImageData(new ImageData(m.rgba, m.w, m.h), 0, 0); img = c;
      if (m.emis) { const e = Art.canvas(m.w, m.h); e.getContext('2d').putImageData(new ImageData(m.emis, m.w, m.h), 0, 0); em = e; }
    }
    const bytes = m.w * m.h * 4 * (em ? 2 : 1);
    const S = CONFIG.chunkSize;
    const e = { img, em, mats: m.mats, props: m.props, lms: m.lms, L: job.L, bytes, used: App.frame, born: App.now, comp: null, ox: job.cx * S, oy: job.cy * S };
    TerrainSys.cache.set(job.key, e);
    TerrainSys.bytes += bytes;
    TerrainSys.matCache.set(job.cx + ',' + job.cy, m.mats);
    if (m.lms) for (const l of m.lms) TerrainSys.landmarks.set(l.x.toFixed(1) + ',' + l.y.toFixed(1), l);
    TerrainSys.evict();
  },
  landmarks: new Map(),
  evict() {
    if (TerrainSys.bytes <= TerrainSys.budget()) return;
    const arr = [...TerrainSys.cache.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [k, e] of arr) {
      if (TerrainSys.bytes <= TerrainSys.budget() * 0.8 || e.used >= App.frame - 2) break;
      TerrainSys.cache.delete(k); TerrainSys.bytes -= e.bytes + (e.comp ? e.comp.width * e.comp.height * 4 : 0);
      if (e.img && e.img.close) e.img.close();
    }
  },
  // best available image for a chunk: exact level, else the nearest other level
  best(cx, cy, L) {
    const C = TerrainSys.cache;
    let e = C.get(TerrainSys.key(cx, cy, L));
    if (e) return e;
    for (let d = 1; d < 4; d++) {
      e = C.get(TerrainSys.key(cx, cy, L - d)); if (e) return e;
      e = C.get(TerrainSys.key(cx, cy, L + d)); if (e) return e;
    }
    return null;
  },
  matAt(x, y) {
    const S = CONFIG.chunkSize, cx = Math.floor(x / S), cy = Math.floor(y / S);
    const m = TerrainSys.matCache && TerrainSys.matCache.get(cx + ',' + cy);
    if (!m) return 2;
    return m[(Math.floor(y) - cy * S) * S + (Math.floor(x) - cx * S)];
  },

  // ---------------- drawing ----------------
  draw(ctx, g, vr) {
    if (!TerrainSys.P) return;
    const S = CONFIG.chunkSize, ppt = Render.ppt();
    const L = TerrainSys.levelFor(ppt);
    const bakeProps = ppt <= 24;
    TerrainSys.liveProps = !bakeProps;
    const cx0 = Math.floor(vr.x0 / S), cy0 = Math.floor(vr.y0 / S), cx1 = Math.floor(vr.x1 / S), cy1 = Math.floor(vr.y1 / S);
    const ccx = App.cam.x / S, ccy = App.cam.y / S;
    const P = Render.palette;
    ctx.imageSmoothingEnabled = true;
    let comps = 1;
    TerrainSys.visible = TerrainSys.visible || [];
    TerrainSys.visible.length = 0;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const dist = Math.hypot(cx + 0.5 - ccx, cy + 0.5 - ccy);
      // coarse level first so nothing is ever empty, then the needed level
      if (!TerrainSys.cache.has(TerrainSys.key(cx, cy, 0))) TerrainSys.request(g, cx, cy, 0, dist);
      TerrainSys.request(g, cx, cy, L, 2 + dist);
      const e = TerrainSys.best(cx, cy, L);
      const rx = cx * S - Render.ox, ry = cy * S - Render.oy;
      if (!e) { ctx.fillStyle = P.ground[1]; ctx.fillRect(rx, ry, S + 0.02, S + 0.02); continue; }
      e.used = App.frame;
      TerrainSys.visible.push(e);
      // cross-fade from the previously shown level of this chunk
      const ck = cx + ',' + cy, prev = TerrainSys.shown.get(ck);
      if (prev && prev.e !== e && prev.e.L !== e.L && !prev.fading) { prev.fading = true; prev.from = prev.e; prev.t0 = App.now; prev.e = e; }
      else if (!prev) TerrainSys.shown.set(ck, { e, fading: false });
      const st = TerrainSys.shown.get(ck);
      let img = e.img;
      if (bakeProps) {
        if ((!e.comp || e.compL !== L) && e.props && e.props.length && comps-- > 0) { e.comp = TerrainSys.composite(e); e.compL = L; }
        if (e.comp) img = e.comp;
      }
      if (st.fading && !App.settings.reducedFx) {
        const k = (App.now - st.t0) / 180;
        if (k >= 1) st.fading = false;
        else { ctx.drawImage(st.from.comp && bakeProps ? st.from.comp : st.from.img, rx, ry, S + 0.02, S + 0.02); ctx.globalAlpha = k; ctx.drawImage(img, rx, ry, S + 0.02, S + 0.02); ctx.globalAlpha = 1; continue; }
      }
      ctx.drawImage(img, rx, ry, S + 0.02, S + 0.02);
    }
    if (TerrainSys.shown.size > 300) TerrainSys.shown.clear();
    // look-ahead: prefetch the ring of chunks in the walking direction
    const p = g.run.player, vx = p.vx || 0, vy = p.vy || 0, sp = Math.hypot(vx, vy);
    if (sp > 0.5) {
      const ax = Math.round(vx / sp), ay = Math.round(vy / sp);
      for (let i = -1; i <= 1; i++) {
        const tx = Math.floor((ax ? (ax > 0 ? vr.x1 : vr.x0) : App.cam.x) / S) + ax + (ax ? 0 : i), ty = Math.floor((ay ? (ay > 0 ? vr.y1 : vr.y0) : App.cam.y) / S) + ay + (ay ? 0 : i);
        TerrainSys.request(g, tx, ty, Math.max(0, L - 1), 6);
      }
    }
    TerrainSys.pump();
  },
  shown: new Map(),
  composite(e) {
    const S = CONFIG.chunkSize, w = e.img.width, ppt = w / S;
    const c = Art.canvas(w, w), x = c.getContext('2d');
    x.drawImage(e.img, 0, 0);
    // chunk origin from any prop is not needed: props carry world coords; recover origin from the cache key
    x.setTransform(ppt, 0, 0, ppt, -e.ox * ppt, -e.oy * ppt);
    for (const pr of e.props) RockArt.draw(x, pr, 0, 0, ppt);
    return c;
  },
  // live props at close zoom (crisp, culled)
  drawProps(ctx, vr) {
    if (!TerrainSys.liveProps) return;
    const ppt = Render.ppt();
    for (const e of TerrainSys.visible) {
      if (!e.props) continue;
      for (const pr of e.props) {
        if (pr[2] < vr.x0 - 3 || pr[2] > vr.x1 + 3 || pr[3] < vr.y0 - 3 || pr[3] > vr.y1 + 3) continue;
        RockArt.draw(ctx, pr, Render.ox, Render.oy, ppt);
      }
    }
  },
  // night emission (lava, grid lines, bioluminescence, sparkles), additive after the grade
  drawEmission(ctx, night, tm) {
    if (!TerrainSys.P || !TerrainSys.P.emis || !TerrainSys.visible) return;
    const S = CONFIG.chunkSize;
    const pulse = TerrainSys.P.emis === 'lava' ? 0.8 + 0.2 * Math.sin(tm * 1.7) : 0.9 + 0.1 * Math.sin(tm * 0.9);
    const a = (0.25 + night * 0.75) * pulse;
    if (a < 0.02) return;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
    for (const e of TerrainSys.visible) if (e.em) ctx.drawImage(e.em, e.ox * 1 - Render.ox, e.oy - Render.oy, S + 0.02, S + 0.02);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
};
