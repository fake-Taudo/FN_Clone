// =====================================================================
// Economy: production, refining, storage, selling, customers, demand, events, contracts
// =====================================================================
const MAX_CUSTOMERS = [3, 2, 1, 1, 1, 0];
const QTY_SCALE = [1, 5, 19, 77, 318, 2270]; // average visit size relative to aliens (saturation scaling)
const ARRIVE_TIME = [5, 4, 3.5, 4, 5, 0];
const WISH_COUNT = [[0.7, 0.25, 0.05], [0.4, 0.45, 0.15], [0.25, 0.5, 0.25], [0.2, 0.5, 0.3], [0.15, 0.5, 0.35], [0.3, 0.5, 0.2]];

const Economy = {
  // ---------------- capacities and rates ----------------
  siloCap(g, b) { return Math.floor(CONFIG.siloCapacity * Math.pow(CONFIG.siloLevelCapacity, b.level - 1) * g.mods.siloCap); },
  shelfCap(g, b) { return Math.floor(CONFIG.shelfCapacity[SELLER_TIER[b.type]] * Math.pow(1.5, b.level - 1) * g.mods.shelfCap); },
  serviceRate(g, b) {
    const t = SELLER_TIER[b.type];
    return CONFIG.serviceRate[t] * Math.pow(1.3, b.level - 1) * g.mods.service * (b.ramps && b.ramps.length ? 1 + CONFIG.rampBonus : 1);
  },
  extractRate(g, b) {
    return CONFIG.extractRate[b.tier] * Math.pow(CONFIG.extractorLevelSpeed, b.level - 1) * (1 + b.bonus) * g.mods.extract;
  },
  refineRate(g, b) {
    return CONFIG.refineRate[REFINERY_LEVEL[b.type] - 1] * Math.pow(1.25, b.level - 1) * (1 + b.bonus) * g.mods.refine;
  },
  arrivalMult(g, b) {
    let m = g.mods.arrival * Math.pow(1.1, b.level - 1);
    if (b.type === 'bazaar') m *= 1 + Math.min(CONFIG.pathBonusMax, b.pathTiles * CONFIG.pathBonusPerTile);
    return m;
  },
  itemValue(res, ref) { return DATA.RESOURCES[res].value * CONFIG.refineFactor[ref]; },

  // ---------------- silo helpers ----------------
  siloAdd(b, key, n) {
    const c = b.store.get(key) || 0;
    b.store.set(key, c + n);
    b.total += n;
  },
  siloTake(b, key, n) {
    const c = b.store.get(key) || 0;
    const t = Math.min(c, n);
    if (t <= 0) return 0;
    if (c - t <= 0) b.store.delete(key); else b.store.set(key, c - t);
    b.total -= t;
    return t;
  },

  // ---------------- per tick: producers ----------------
  tickExtractor(g, b) {
    const dt = 1 / CONFIG.tickRate;
    if (b.buf.length < CONFIG.maxItemsPerBuffer) {
      b.acc += b.rate * dt;
      while (b.acc >= 1 && b.buf.length < CONFIG.maxItemsPerBuffer) {
        b.acc -= 1;
        b.buf.push(Items.make(b.res, 0));
        Economy.onProduced(g, b.res, 0, 1, true);
        b.made++;
      }
      if (b.buf.length < CONFIG.maxItemsPerBuffer) b.blocked = 0;
    } else {
      b.blocked += dt;
      if (b.acc > 1) b.acc = 1;
    }
    const outs = b.outs;
    if (!outs || !outs.length) return;
    for (let k = 0; k < 3 && b.buf.length; k++) {
      let ok = false;
      for (let i = 0; i < outs.length; i++) {
        const o = outs[(b.rr + i) % outs.length];
        if (Logistics.insert(g, o[0], o[1], o[2], b.buf[0])) { b.buf.shift(); b.rr = (b.rr + i + 1) % outs.length; ok = true; break; }
      }
      if (!ok) break;
    }
  },

  tickSilo(g, b) {
    if (!b.outEnabled || b.total <= 0) return;
    const port = b.port;
    if (!port) return;
    for (let k = 0; k < 2 && b.total > 0; k++) {
      let key = -1;
      if (b.outFilter !== null && b.outFilter !== undefined) {
        for (const [kk, c] of b.store) if (c > 0 && Logistics.matches(b.outFilter, { res: kk >> 2, ref: kk & 3 })) { key = kk; break; }
      } else {
        const keys = [...b.store.keys()];
        if (keys.length) key = keys[b.rr % keys.length];
      }
      if (key < 0) return;
      const it = Items.make(key >> 2, key & 3);
      if (Logistics.insert(g, port[0], port[1], b.rot, it)) { Economy.siloTake(b, key, 1); b.rr++; }
      else { Items.free(it); return; }
    }
  },

  tickRefinery(g, b) {
    const dt = 1 / CONFIG.tickRate;
    if (!b.cur && b.inBuf.length && b.outBuf.length < 4) { b.cur = b.inBuf.shift(); }
    if (b.cur) {
      b.prog += b.rate * dt;
      if (b.prog >= 1) {
        b.prog -= 1;
        b.cur.ref++;
        Economy.onProduced(g, b.cur.res, b.cur.ref, 1, false);
        b.outBuf.push(b.cur);
        b.cur = null;
        b.made++;
        if (b.inBuf.length && b.outBuf.length < 4) b.cur = b.inBuf.shift(); else b.prog = 0;
      }
    } else b.prog = 0;
    if (b.outBuf.length && b.port) {
      if (Logistics.insert(g, b.port[0], b.port[1], b.rot, b.outBuf[0])) b.outBuf.shift();
    }
  },

  onProduced(g, res, ref, n, mined) {
    const key = res * 4 + ref;
    if (!g.run.produced.has(key)) { g.run.produced.add(key); g.events.push({ type: 'newProduct', res, ref }); }
    if (mined) {
      const cx = g.meta.codex;
      if (cx.state[res] < 2) { cx.state[res] = 2; g.events.push({ type: 'codex', res }); Progression.onCodex(g); }
      cx.mined[res] += n;
      g.stats.minedByTier[DATA.RESOURCES[res].tier] += n;
      g.run.minedRun[DATA.RESOURCES[res].tier] += n;
    } else {
      g.stats.refined += n;
      if (ref >= 1) Progression.unlock(g, 'refine1');
      if (ref >= 3) Progression.unlock(g, 'refine3');
    }
  },

  // ---------------- sellers ----------------
  wishMatches(w, res, ref) {
    if (ref < w.ref) return false;
    if (w.res >= 0) return w.res === res;
    return DATA.RESOURCES[res].tier === w.tier;
  },
  shelfMatching(b, w) {
    let n = 0;
    for (const [k, c] of b.shelf) if (Economy.wishMatches(w, k >> 2, k & 3)) n += c;
    return n;
  },
  sellerAccepts(g, b, it) {
    if (b.shelfTotal >= Economy.shelfCap(g, b)) return false;
    if (b.type === 'terminal') {
      for (const c of g.run.contracts) for (const r of c.req) {
        if (r.got < r.qty && it.res === r.res && it.ref >= r.ref) {
          const onShelf = b.shelf.get(it.res * 4 + it.ref) || 0;
          if (r.qty - r.got > onShelf) return true;
        }
      }
      return false;
    }
    for (const c of b.customers) {
      if (c.state === 'out') continue;
      for (const w of c.wishes) {
        if (w.got >= w.qty || !Economy.wishMatches(w, it.res, it.ref)) continue;
        if (w.qty - w.got > Economy.shelfMatching(b, w)) return true;
      }
    }
    return b.shelfTotal < Economy.shelfCap(g, b) * CONFIG.shelfPrestock;
  },
  sellerTake(g, b, it) {
    const k = Items.key(it);
    b.shelf.set(k, (b.shelf.get(k) || 0) + 1);
    b.shelfTotal++;
    Items.free(it);
  },

  priceFactor(g, res, custTier) {
    const dm = g.run.demand;
    const vol = Math.max(0.3, 1 - 0.1 * custTier);
    let f = (1 + (dm.d[res] - 1) * vol) * dm.s[res];
    for (const ev of g.run.events) {
      if (ev.res !== res) continue;
      f *= ev.mult >= 1 ? 1 + (ev.mult - 1) * (1 + 0.15 * custTier) : 1 + (ev.mult - 1) * vol;
    }
    return f;
  },
  eventMult(g, res) {
    let m = 1;
    for (const ev of g.run.events) if (ev.res === res) m *= ev.mult;
    return m;
  },

  // Pays for n units sold to a customer of tier ct. Returns revenue.
  pay(g, res, ref, n, ct, opts = {}) {
    if (n <= 0) return 0;
    const base = Economy.itemValue(res, ref);
    const pf = opts.stable ? 1 + (g.run.demand.d[res] - 1) * 0.3 : Economy.priceFactor(g, res, ct);
    const rev = U.safe(base * n * CONFIG.customers[ct].factor * pf * g.mods.sales);
    if (!opts.stable) {
      const t = DATA.RESOURCES[res].tier;
      const dm = g.run.demand;
      dm.s[res] = Math.max(CONFIG.saturationMin, dm.s[res] - n * CONFIG.saturationPerUnit / (1 + t * 0.3) / QTY_SCALE[ct]);
      if (Economy.eventMult(g, res) > 1) Progression.unlock(g, 'event');
    }
    Economy.earn(g, rev);
    const cx = g.meta.codex;
    const unit = rev / n;
    if (unit > cx.best[res]) cx.best[res] = unit;
    g.stats.sold += n;
    g.run.soldRun += n;
    return rev;
  },
  earn(g, rev) {
    rev = U.safe(rev);
    g.run.money = U.safe(g.run.money + rev);
    g.run.earned = U.safe(g.run.earned + rev);
    g.meta.totalEarned = U.safe(g.meta.totalEarned + rev);
    g.incomeAcc += rev;
    if (g.run.earned > 0) Progression.unlock(g, 'firstSale');
  },

  tickSeller(g, b) {
    const dt = 1 / CONFIG.tickRate;
    const tier = SELLER_TIER[b.type];
    if (tier === 5) { Economy.tickTerminal(g, b, dt); return; }
    // arrivals
    if (b.customers.length < MAX_CUSTOMERS[tier]) {
      b.timer -= dt * Economy.arrivalMult(g, b);
      if (b.timer <= 0) {
        b.customers.push(Customers.spawn(g, b, tier));
        const iv = CONFIG.customers[tier].interval;
        b.timer = U.randRange(iv[0], iv[1], g.rnd);
      }
    }
    // service budget
    b.svc = (b.svc || 0) + Economy.serviceRate(g, b) * dt;
    for (let i = b.customers.length - 1; i >= 0; i--) {
      const c = b.customers[i];
      c.t += dt;
      if (c.state === 'in') {
        if (c.t >= c.arrive) { c.state = 'wait'; c.t = 0; }
        continue;
      }
      if (c.state === 'out') {
        if (c.t >= 3) b.customers.splice(i, 1);
        continue;
      }
      // waiting & buying
      let done = true;
      for (const w of c.wishes) {
        if (w.got >= w.qty) continue;
        done = false;
        if (b.svc < 1) continue;
        const want = Math.min(w.qty - w.got, Math.floor(b.svc));
        const got = Economy.takeForWish(g, b, w, want, c, tier);
        if (got > 0) { w.got += got; b.svc -= got; c.buying = 0.4; }
      }
      if (c.buying > 0) c.buying -= dt;
      if (!done) done = c.wishes.every(w => w.got >= w.qty);
      if (done || c.t >= c.patience) Customers.leave(g, b, c, done);
    }
    if (b.svc > 4) b.svc = 4;
  },

  // Takes up to n matching units from the shelf, then adjacent silos (loading ramp). Pays them.
  takeForWish(g, b, w, n, c, tier) {
    let got = 0;
    const takeFrom = (store, isShelf, silo) => {
      for (const [k, cnt] of store) {
        if (got >= n) break;
        const res = k >> 2, ref = k & 3;
        if (!Economy.wishMatches(w, res, ref)) continue;
        const t = Math.min(cnt, n - got);
        if (isShelf) {
          if (cnt - t <= 0) store.delete(k); else store.set(k, cnt - t);
          b.shelfTotal -= t;
        } else Economy.siloTake(silo, k, t);
        c.spent += Economy.pay(g, res, ref, t, tier);
        c.units += t;
        c.lastKey = k;
        got += t;
      }
    };
    takeFrom(b.shelf, true, null);
    if (got < n && b.ramps) for (const s of b.ramps) { if (got >= n) break; if (s.total > 0) takeFrom(s.store, false, s); }
    return got;
  },

  tickTerminal(g, b, dt) {
    b.svc = (b.svc || 0) + Economy.serviceRate(g, b) * dt;
    if (b.svc < 1) return;
    for (const c of g.run.contracts) {
      for (const r of c.req) {
        if (r.got >= r.qty || b.svc < 1) continue;
        const want = Math.min(r.qty - r.got, Math.floor(b.svc));
        let got = 0;
        const takeFrom = (store, isShelf, silo) => {
          for (const [k, cnt] of store) {
            if (got >= want) break;
            const res = k >> 2, ref = k & 3;
            if (res !== r.res || ref < r.ref) continue;
            const t = Math.min(cnt, want - got);
            if (isShelf) { if (cnt - t <= 0) store.delete(k); else store.set(k, cnt - t); b.shelfTotal -= t; }
            else Economy.siloTake(silo, k, t);
            c.paid += Economy.pay(g, res, ref, t, 5, { stable: true });
            got += t;
          }
        };
        takeFrom(b.shelf, true, null);
        if (got < want && b.ramps) for (const s of b.ramps) if (got < want && s.total > 0) takeFrom(s.store, false, s);
        r.got += got; b.svc -= got;
      }
    }
    if (b.svc > 4) b.svc = 4;
  },

  // ---------------- contracts ----------------
  tickContracts(g, dt) {
    const run = g.run;
    if (run.custTier < 5) return;
    const hasTerminal = g.lists.terminal && g.lists.terminal.length > 0;
    for (let i = run.contracts.length - 1; i >= 0; i--) {
      const c = run.contracts[i];
      const complete = c.req.every(r => r.got >= r.qty);
      if (complete) {
        const bonus = c.paid * CONFIG.satisfiedBonus;
        Economy.earn(g, bonus);
        let rp = 0;
        if (g.rnd() < CONFIG.contractRpChance) { rp = 1; g.meta.bonusRp += 1; }
        g.stats.contracts++;
        Progression.unlock(g, 'contract');
        g.events.push({ type: 'contractDone', c, bonus, rp });
        run.contracts.splice(i, 1);
      } else if (run.time >= c.end) {
        g.events.push({ type: 'contractFail', c });
        run.contracts.splice(i, 1);
      }
    }
    if (!hasTerminal) return;
    run.contractTimer -= dt;
    if (run.contracts.length < g.mods.contractSlots && (run.contractTimer <= 0 || run.contracts.length === 0 && run.contractTimer > 30)) {
      if (run.contracts.length === 0 && run.contractTimer > 30) run.contractTimer = 0;
      if (run.contractTimer <= 0) {
        const c = Customers.makeContract(g);
        if (c) { run.contracts.push(c); g.events.push({ type: 'contractNew', c }); }
        const iv = CONFIG.customers[5].interval;
        run.contractTimer = U.randRange(iv[0], iv[1], g.rnd);
      }
    }
  },

  // ---------------- demand, saturation and events ----------------
  tickDemand(g, dt) {
    const dm = g.run.demand;
    const rec = CONFIG.saturationRecover * dt;
    for (let i = 0; i < 91; i++) if (dm.s[i] < 1) dm.s[i] = Math.min(1, dm.s[i] + rec);
    dm.timer -= dt;
    if (dm.timer <= 0) {
      dm.timer += CONFIG.demandInterval;
      for (let i = 0; i < 91; i++) {
        let d = dm.d[i];
        d += (1 - d) * CONFIG.demandRevert + U.gauss(g.rnd) * CONFIG.demandNoise;
        dm.d[i] = U.clamp(d, CONFIG.demandMin, CONFIG.demandMax);
      }
    }
    dm.histTimer -= dt;
    if (dm.histTimer <= 0) {
      dm.histTimer += CONFIG.historyInterval;
      const L = CONFIG.historyLength;
      for (let i = 0; i < 91; i++) dm.hist[i * L + dm.histPos] = dm.d[i] * dm.s[i] * Economy.eventMult(g, i);
      dm.histPos = (dm.histPos + 1) % L;
      dm.histCount = Math.min(L, dm.histCount + 1);
    }
    // events
    const run = g.run;
    for (let i = run.events.length - 1; i >= 0; i--) {
      if (run.time >= run.events[i].end) { g.events.push({ type: 'eventEnd', ev: run.events[i] }); run.events.splice(i, 1); }
    }
    run.eventTimer -= dt * g.mods.eventFreq;
    if (run.eventTimer <= 0) {
      const iv = CONFIG.eventInterval;
      run.eventTimer = U.randRange(iv[0], iv[1], g.rnd);
      Economy.spawnEvent(g);
    }
  },
  spawnEvent(g, forcePositive) {
    const run = g.run;
    const owned = [...new Set([...run.produced].map(k => k >> 2))].filter(r => !run.events.some(e => e.res === r));
    if (!owned.length) return null;
    const res = U.pick(owned, g.rnd);
    const neg = forcePositive === undefined ? g.rnd() < CONFIG.eventNegativeChance : !forcePositive;
    const cfg = neg ? CONFIG.eventNegative : CONFIG.eventPositive;
    let dur = U.randRange(cfg.dur[0], cfg.dur[1], g.rnd);
    if (!neg) dur *= g.mods.eventLen;
    const mult = Math.round(U.randRange(cfg.mult[0], cfg.mult[1], g.rnd) * 10) / 10;
    const ev = { res, mult, start: run.time, end: run.time + dur, pos: !neg, who: neg ? null : U.pick(['Frachter', 'Händlergilde', 'Kolonie', 'Forschungsstation', 'Orbitalwerft'], g.rnd) };
    run.events.push(ev);
    g.events.push({ type: 'eventStart', ev });
    return ev;
  },
  demandTrend(g, res) {
    const dm = g.run.demand, L = CONFIG.historyLength;
    const now = dm.d[res] * dm.s[res] * Economy.eventMult(g, res);
    if (dm.histCount < 2) return { now, arrow: '→', cls: now > 1.15 ? 'up' : now < 0.85 ? 'down' : '' };
    const prev = dm.hist[res * L + ((dm.histPos - 3 + L * 2) % L)] || now;
    const diff = now - prev;
    const arrow = diff > 0.25 ? '↑↑' : diff > 0.04 ? '↑' : diff < -0.25 ? '↓↓' : diff < -0.04 ? '↓' : '→';
    return { now, arrow, cls: now > 1.15 ? 'up' : now < 0.85 ? 'down' : '' };
  },
  history(g, res) {
    const dm = g.run.demand, L = CONFIG.historyLength, out = [];
    for (let i = dm.histCount - 1; i >= 0; i--) out.push(dm.hist[res * L + ((dm.histPos - 1 - i + L * 2) % L)]);
    return out;
  }
};

// =====================================================================
// Customers: spawning, wishes, leaving
// =====================================================================
const Customers = {
  stockKeys(g, b) {
    const m = new Map();
    for (const [k, c] of b.shelf) m.set(k, (m.get(k) || 0) + c);
    if (b.ramps) for (const s of b.ramps) for (const [k, c] of s.store) m.set(k, (m.get(k) || 0) + c);
    return m;
  },
  candidateKeys(g) {
    const list = [...g.run.produced];
    if (list.length) return list;
    // nothing produced yet: wish for what the player can find near the landing site
    const start = g.world.start.deposits.filter(d => d.tier <= 1).map(d => d.res * 4);
    return start.length ? start : [0];
  },

  genWishes(g, b, tier) {
    const rnd = g.rnd;
    const n = U.weighted(WISH_COUNT[tier], rnd) + 1;
    const qr = CONFIG.customers[tier].qty;
    const total = U.randInt(qr[0], qr[1], rnd);
    const stock = Customers.stockKeys(g, b);
    const stockList = [...stock.keys()];
    const cand = Customers.candidateKeys(g);
    const wishes = [];
    const weights = [];
    for (let i = 0; i < n; i++) weights.push(0.5 + rnd());
    const wsum = weights.reduce((a, c) => a + c, 0);
    for (let i = 0; i < n; i++) {
      let qty = Math.max(1, Math.round(total * weights[i] / wsum));
      const r = rnd();
      let w;
      if (i > 0 && r < 0.07) {
        // exploration wish: something rarer than anything owned so far
        const maxOwned = Math.max(0, ...cand.map(k => DATA.RESOURCES[k >> 2].tier));
        const t = Math.min(7, maxOwned + 1 + (rnd() < 0.3 ? 1 : 0));
        w = { res: -1, tier: t, ref: 0, qty: Math.max(1, Math.round(qty * 0.3)), got: 0, explore: true };
      } else {
        let key;
        if (stockList.length && r < 0.78) key = U.pick(stockList, rnd);
        else {
          // weight refined products higher for better customers
          const ws = cand.map(k => 1 + (k & 3) * tier * 0.8);
          key = cand[U.weighted(ws, rnd)];
        }
        const res = key >> 2;
        let ref = key & 3;
        if (ref > 0 && rnd() < 0.25) ref--;
        const tierWish = rnd() < 0.06 + 0.04 * tier;
        w = tierWish ? { res: -1, tier: DATA.RESOURCES[res].tier, ref, qty, got: 0 } : { res, tier: DATA.RESOURCES[res].tier, ref, qty, got: 0 };
      }
      const dup = wishes.find(o => o.res === w.res && o.tier === w.tier && o.ref === w.ref);
      if (dup) dup.qty += w.qty; else wishes.push(w);
    }
    return wishes;
  },

  spawn(g, b, tier) {
    const rnd = g.rnd;
    const pat = CONFIG.patience;
    // spawn point for walking aliens: farthest path tile near the bazaar, else a random edge point
    let sx, sy;
    if (tier === 0 && b.pathEnds && b.pathEnds.length) { const p = U.pick(b.pathEnds, rnd); sx = p[0] + 0.5; sy = p[1] + 0.5; }
    else { const a = rnd() * Math.PI * 2; sx = b.x + b.w / 2 + Math.cos(a) * 12; sy = b.y + b.h / 2 + Math.sin(a) * 12; }
    return {
      tier,
      wishes: Customers.genWishes(g, b, tier),
      patience: U.randRange(pat[0], pat[1], rnd) * (1 + 0.6 * tier) * g.mods.patience,
      state: 'in', t: 0, arrive: ARRIVE_TIME[tier],
      sx, sy, skin: Math.floor(rnd() * 6), spent: 0, units: 0, buying: 0, slot: b.customers.length, lastKey: -1
    };
  },

  leave(g, b, c, satisfied) {
    c.state = 'out'; c.t = 0;
    let bonus = 0;
    if (satisfied) {
      bonus = c.spent * CONFIG.satisfiedBonus;
      Economy.earn(g, bonus);
      g.stats.satisfied++;
      if (g.stats.satisfied >= 100) Progression.unlock(g, 'satisfied100');
    }
    c.satisfied = satisfied;
    if (c.units > 0) {
      b.sold += c.units;
      const entry = { t: g.run.time, tier: c.tier, units: c.units, rev: c.spent + bonus, key: c.lastKey, ok: satisfied };
      g.run.salesLog.unshift(entry);
      if (g.run.salesLog.length > 20) g.run.salesLog.length = 20;
      g.events.push({ type: 'sale', b, entry });
      if (g.rnd() < CONFIG.tipChance) {
        g.run.tips.push({ x: b.x + b.w / 2 + (g.rnd() - 0.5) * b.w, y: b.y - 0.3, value: (c.spent + bonus) * CONFIG.tipValue + 1, life: CONFIG.tipLifetime });
      }
    }
  },

  makeContract(g) {
    const rnd = g.rnd;
    const cand = Customers.candidateKeys(g);
    if (!cand.length) return null;
    const n = rnd() < 0.5 ? 1 : 2;
    const qr = CONFIG.customers[5].qty;
    const total = U.randInt(qr[0], qr[1], rnd);
    const req = [];
    for (let i = 0; i < n; i++) {
      const ws = cand.map(k => 1 + (k & 3));
      const key = cand[U.weighted(ws, rnd)];
      if (req.some(r => r.res === (key >> 2))) continue;
      req.push({ res: key >> 2, ref: key & 3, qty: Math.max(100, Math.round(total / n / 50) * 50), got: 0 });
    }
    g.run.contractSeq = (g.run.contractSeq || 0) + 1;
    return { id: g.run.contractSeq, planet: U.pick(DATA.CONTRACT_PLANETS, rnd), req, end: g.run.time + CONFIG.contractDuration, paid: 0 };
  }
};
