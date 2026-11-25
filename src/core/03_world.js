// =====================================================================
// World: infinite deterministic chunks, terrain, deposits, discovery
// =====================================================================
const World = {
  LUCK_NAMES: ['Normalstart', 'Guter Start', 'Jackpot-Start', 'Wunder-Start'],
  LUCK_TIERS: [null, [2, 3], [4, 5], [6, 7]],

  create(seed, k, opts = {}) {
    const planet = DATA.planet(k);
    const w = {
      seed: seed >>> 0,
      k,
      planet,
      luckLevel: opts.luckLevel || 0,
      noiseA: Noise.make(RNG.hash(seed, 11)),
      noiseB: Noise.make(RNG.hash(seed, 22)),
      noiseC: Noise.make(RNG.hash(seed, 33)),
      depositCache: new Map(),
      decorCache: new Map(),
      discovered: new Map(),   // chunkKey -> 16-bit mask
      known: new Set(),        // known deposit ids
      weights: null,
      start: null
    };
    w.weights = World.tierWeights(w);
    w.start = World.genStart(w);
    return w;
  },

  tierWeights(w) {
    const base = CONFIG.tierWeights;
    const out = base.map((v, t) => {
      let x = v * (1 + CONFIG.planetTierShift * (w.k - 1) * t);
      if (t >= 2) x *= 1 + 0.1 * w.luckLevel;
      if (t >= 4 && w.planet.special === 'rare') x *= 1.25;
      return x;
    });
    const s = out.reduce((a, b) => a + b, 0);
    return out.map(v => v / s);
  },

  // Deterministic lucky start: always a playable set of common deposits plus a bonus by luck class.
  genStart(w) {
    const rnd = RNG.mulberry32(RNG.hash(w.seed, 9001, w.k));
    const p = CONFIG.luckyStart.slice();
    // Luck upgrade moves probability from "normal" into the better classes.
    const shift = Math.min(0.4, 0.04 * w.luckLevel);
    p[0] -= shift; p[1] += shift * 0.55; p[2] += shift * 0.3; p[3] += shift * 0.15;
    const luck = U.weighted(p, rnd);
    const L = CONFIG.landing;
    const list = [];
    const used = [];
    const place = (tier, minD, maxD, sizeClass) => {
      for (let attempt = 0; attempt < 60; attempt++) {
        const ang = rnd() * Math.PI * 2;
        const d = minD + rnd() * (maxD - minD);
        const x = Math.round(L.x + Math.cos(ang) * d), y = Math.round(L.y + Math.sin(ang) * d);
        const cx = Math.floor(x / CONFIG.chunkSize), cy = Math.floor(y / CONFIG.chunkSize);
        const lx = x - cx * CONFIG.chunkSize, ly = y - cy * CONFIG.chunkSize;
        if (lx < 3 || ly < 3 || lx > CONFIG.chunkSize - 4 || ly > CONFIG.chunkSize - 4) continue;
        if (used.some(u => U.dist2(u.x, u.y, x, y) < 81)) continue;
        if (U.dist2(x, y, L.x, L.y) < 16) continue;
        used.push({ x, y });
        const res = U.pick(DATA.BY_TIER[tier], rnd);
        list.push({ x, y, tier, res, sizeClass });
        return true;
      }
      return false;
    };
    // Guaranteed: one large common close by, one or two more common/uncommon.
    place(0, 6, 10, 2);
    place(rnd() < 0.5 ? 0 : 1, 9, 16, 1);
    if (rnd() < 0.6) place(1, 12, 20, 1);
    if (luck > 0) {
      const tiers = World.LUCK_TIERS[luck];
      place(rnd() < 0.65 ? tiers[0] : tiers[1], 14, CONFIG.startRadius - 2, 0);
    }
    return { luck, deposits: list };
  },

  genChunkDeposits(w, cx, cy) {
    const S = CONFIG.chunkSize;
    const rnd = RNG.forChunk(w.seed, cx, cy, 1);
    const out = [];
    const L = CONFIG.landing;
    const count = U.weighted(CONFIG.depositsPerChunk, rnd);
    const centers = [];
    const tryAdd = (x, y, tier, res, sizeClass, r) => {
      const tiles = World.growCluster(x, y, sizeClass, cx, cy, r);
      const dep = {
        id: U.chunkKey(cx, cy) * 8 + out.length,
        x, y, tier, res, sizeClass,
        slots: CONFIG.sizeSlots[sizeClass],
        tiles,
        tileSet: new Set(tiles.map(t => U.tileKey(t[0], t[1])))
      };
      out.push(dep);
      centers.push([x, y]);
    };
    for (let i = 0; i < count; i++) {
      let ok = false, x = 0, y = 0;
      for (let a = 0; a < 12 && !ok; a++) {
        x = cx * S + 4 + Math.floor(rnd() * (S - 8));
        y = cy * S + 4 + Math.floor(rnd() * (S - 8));
        ok = U.dist2(x, y, L.x, L.y) >= CONFIG.depositStartExclusion * CONFIG.depositStartExclusion &&
          centers.every(c => U.dist2(c[0], c[1], x, y) >= CONFIG.depositMinDist * CONFIG.depositMinDist);
      }
      const tier = U.weighted(w.weights, rnd);
      const res = U.pick(DATA.BY_TIER[tier], rnd);
      const sizeClass = U.weighted(CONFIG.sizeChance[tier], rnd);
      if (ok) tryAdd(x, y, tier, res, sizeClass, rnd);
    }
    for (const sd of w.start.deposits) {
      if (Math.floor(sd.x / S) === cx && Math.floor(sd.y / S) === cy) {
        tryAdd(sd.x, sd.y, sd.tier, sd.res, sd.sizeClass, RNG.mulberry32(RNG.hash(w.seed, sd.x, sd.y, 5)));
      }
    }
    return out;
  },

  growCluster(x, y, sizeClass, cx, cy, rnd) {
    const S = CONFIG.chunkSize;
    const range = CONFIG.sizeTiles[sizeClass];
    const n = U.randInt(range[0], range[1], rnd);
    const minX = cx * S + 1, maxX = cx * S + S - 2, minY = cy * S + 1, maxY = cy * S + S - 2;
    const tiles = [[x, y]];
    const set = new Set([U.tileKey(x, y)]);
    let guard = 0;
    while (tiles.length < n && guard++ < 200) {
      const base = tiles[Math.floor(rnd() * tiles.length)];
      const d = Math.floor(rnd() * 4);
      const nx = base[0] + U.DX[d], ny = base[1] + U.DY[d];
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const k = U.tileKey(nx, ny);
      if (set.has(k)) continue;
      set.add(k); tiles.push([nx, ny]);
    }
    return tiles;
  },

  chunkDeposits(w, cx, cy) {
    const key = U.chunkKey(cx, cy);
    let d = w.depositCache.get(key);
    if (!d) {
      d = World.genChunkDeposits(w, cx, cy);
      if (w.depositCache.size > 6000) {
        // drop the oldest quarter (Map keeps insertion order)
        let n = 1500;
        for (const k of w.depositCache.keys()) { w.depositCache.delete(k); if (--n <= 0) break; }
      }
      w.depositCache.set(key, d);
    }
    return d;
  },

  depositById(w, id) {
    const ck = Math.floor(id / 8);
    const list = World.chunkDeposits(w, U.chunkKeyX(ck), U.chunkKeyY(ck));
    return list[id % 8] || null;
  },

  depositAt(w, x, y) {
    const S = CONFIG.chunkSize;
    const list = World.chunkDeposits(w, Math.floor(x / S), Math.floor(y / S));
    const k = U.tileKey(x, y);
    for (const d of list) if (d.tileSet.has(k)) return d;
    return null;
  },

  depositsInRect(w, x0, y0, x1, y1, out = []) {
    const S = CONFIG.chunkSize;
    const cx0 = Math.floor(x0 / S), cy0 = Math.floor(y0 / S), cx1 = Math.floor(x1 / S), cy1 = Math.floor(y1 / S);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      for (const d of World.chunkDeposits(w, cx, cy)) {
        if (d.x >= x0 - 3 && d.x <= x1 + 3 && d.y >= y0 - 3 && d.y <= y1 + 3) out.push(d);
      }
    }
    return out;
  },

  depositsInRadius(w, x, y, r) {
    const list = World.depositsInRect(w, x - r, y - r, x + r, y + r);
    return list.filter(d => U.dist2(d.x, d.y, x, y) <= r * r);
  },

  // ---- terrain ----
  // Returns values used by the renderer: base elevation, biome mix, detail.
  biome(w, x, y) {
    const b = w.noiseA.fbm(x / 170, y / 170, 2);
    const r = w.noiseB.fbm(x / 65 + 50, y / 65 - 20, 2);
    // 0 Staubebene, 1 Dünen, 2 Felsfeld, 3 Kraterfeld, 4 Geröll
    if (b > 0.28) return 1;
    if (b < -0.3) return 3;
    if (r > 0.25) return 2;
    if (r < -0.28) return 4;
    return 0;
  },
  BIOME_NAMES: ['Staubebene', 'Dünen', 'Felsfeld', 'Kraterfeld', 'Geröll'],

  terrain(w, x, y) {
    const e = w.noiseA.fbm(x / 26, y / 26, 3);
    const b = w.noiseA.fbm(x / 170, y / 170, 2);
    const r = w.noiseB.fbm(x / 65 + 50, y / 65 - 20, 2);
    const d = w.noiseC.noise2(x / 5, y / 5);
    return { e, b, r, d };
  },

  // Deterministic cosmetic decorations for a chunk.
  chunkDecor(w, cx, cy) {
    const key = U.chunkKey(cx, cy);
    let list = w.decorCache.get(key);
    if (list) return list;
    const S = CONFIG.chunkSize;
    const rnd = RNG.forChunk(w.seed, cx, cy, 2);
    list = [];
    const n = 26 + Math.floor(rnd() * 16);
    for (let i = 0; i < n; i++) {
      const x = cx * S + rnd() * S, y = cy * S + rnd() * S;
      const bi = World.biome(w, Math.floor(x), Math.floor(y));
      const roll = rnd();
      let type;
      if (bi === 3) type = roll < 0.35 ? 'crater' : roll < 0.7 ? 'rock' : 'pebble';
      else if (bi === 2) type = roll < 0.55 ? 'rock' : roll < 0.75 ? 'vein' : 'pebble';
      else if (bi === 4) type = roll < 0.75 ? 'pebble' : 'rock';
      else if (bi === 1) type = roll < 0.6 ? 'ripple' : roll < 0.8 ? 'pebble' : 'rock';
      else type = roll < 0.12 ? 'crater' : roll < 0.4 ? 'pebble' : roll < 0.55 ? 'rock' : roll < 0.7 ? 'vein' : 'ripple';
      const size = type === 'crater' ? 1.2 + rnd() * 2.8 : type === 'rock' ? 0.35 + rnd() * 0.6 : type === 'vein' ? 1 + rnd() * 2 : type === 'ripple' ? 1.5 + rnd() * 2.5 : 0.12 + rnd() * 0.2;
      list.push({ type, x, y, size, rot: rnd() * Math.PI * 2, v: rnd() });
    }
    if (w.decorCache.size > 800) { let k2 = 200; for (const kk of w.decorCache.keys()) { w.decorCache.delete(kk); if (--k2 <= 0) break; } }
    w.decorCache.set(key, list);
    return list;
  },

  // ---- discovery ----
  discover(w, x, y, r) {
    const C = CONFIG.fogCell, S = CONFIG.chunkSize, per = S / C;
    const gx0 = Math.floor((x - r) / C), gx1 = Math.floor((x + r) / C);
    const gy0 = Math.floor((y - r) / C), gy1 = Math.floor((y + r) / C);
    let changed = false;
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const mx = gx * C + C / 2, my = gy * C + C / 2;
      if (U.dist2(mx, my, x, y) > (r + C * 0.7) * (r + C * 0.7)) continue;
      const cx = Math.floor(gx / per), cy = Math.floor(gy / per);
      const bit = 1 << ((gy - cy * per) * per + (gx - cx * per));
      const key = U.chunkKey(cx, cy);
      const m = w.discovered.get(key) || 0;
      if (!(m & bit)) { w.discovered.set(key, m | bit); changed = true; }
    }
    return changed;
  },
  isDiscovered(w, x, y) {
    const C = CONFIG.fogCell, S = CONFIG.chunkSize, per = S / C;
    const gx = Math.floor(x / C), gy = Math.floor(y / C);
    const cx = Math.floor(gx / per), cy = Math.floor(gy / per);
    const m = w.discovered.get(U.chunkKey(cx, cy)) || 0;
    return (m & (1 << ((gy - cy * per) * per + (gx - cx * per)))) !== 0;
  },
  // Marks deposits as known; returns the newly known ones.
  reveal(w, x, y, r) {
    const found = [];
    for (const d of World.depositsInRadius(w, x, y, r)) {
      if (!w.known.has(d.id)) { w.known.add(d.id); found.push(d); }
    }
    return found;
  }
};
