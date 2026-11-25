// =====================================================================
// Progression: modifiers, research, customer tiers, rebirth, codex, achievements
// =====================================================================
const Progression = {
  shop(g, id) { return g.meta.shop[id] || 0; },
  has(g, id) { return g.run.research.done.has(id); },

  computeMods(g) {
    const has = id => g.run.research.done.has(id);
    const sh = id => g.meta.shop[id] || 0;
    const sp = g.world.planet.special;
    const m = {};
    m.extract = (1 + (has('drill1') ? 0.10 : 0) + (has('drill2') ? 0.15 : 0) + (has('drill3') ? 0.20 : 0)) * (sp === 'extract' ? 1.1 : 1);
    m.refine = (1 + (has('refSpeed') ? 0.15 : 0)) * (sp === 'refine' ? 1.1 : 1);
    m.beltSpeed = (1 + (has('beltSpeed') ? 0.15 : 0)) * (1 + 0.1 * sh('belts'));
    m.siloCap = (1 + (has('silo2') ? 0.5 : 0) + (has('silo3') ? 1.0 : 0)) * (1 + 0.25 * sh('storage')) * (sp === 'storage' ? 1.25 : 1);
    m.shelfCap = (1 + (has('shelf1') ? 0.5 : 0)) * (1 + 0.25 * sh('storage'));
    m.patience = has('patience') ? 1.3 : 1;
    m.arrival = (1 + (has('traffic1') ? 0.15 : 0)) * (1 + (has('traffic2') ? 0.2 : 0)) * (sp === 'customers' ? 1.15 : 1);
    m.service = has('service') ? 1.4 : 1;
    m.eventLen = (1 + (has('marketing') ? 0.25 : 0)) * (1 + 0.15 * sh('events'));
    m.eventFreq = sp === 'events' ? 1.5 : 1;
    m.scanRadius = CONFIG.scanRadius * (1 + (has('scan1') ? 0.3 : 0) + (has('scan2') ? 0.4 : 0)) * (1 + 0.2 * sh('scanner'));
    m.scanCd = CONFIG.scanCooldown * (has('scanCd') ? 0.6 : 1) * Math.pow(0.9, sh('scanner'));
    m.walk = CONFIG.walkSpeed * (1 + (has('jet1') ? 0.5 : 0) + (has('jet2') ? 0.5 : 0) + (has('rover') ? 1.5 : 0)) * (1 + 0.12 * sh('speed'));
    m.buildRadius = Math.min(CONFIG.maxBuildRadius, CONFIG.buildRadius + (has('radius1') ? 6 : 0) + (has('radius2') ? 8 : 0) + (has('radius3') ? 8 : 0) + 3 * sh('radius'));
    m.undoLimit = has('undo2') ? 60 : CONFIG.undoLimit;
    m.extCap = CONFIG.extractorStartMaxLevel + sh('extCap');
    m.contractSlots = CONFIG.contractSlots + (has('contracts') ? 1 : 0);
    m.researchCost = Math.pow(0.9, sh('research'));
    m.researchSpeed = 1 + 0.2 * sh('research');
    m.offline = 1 + 0.1 * sh('offlineBoost');
    // sales multiplier chain
    const research = 1 + (has('haggle1') ? 0.08 : 0) + (has('haggle2') ? 0.12 : 0) + (has('haggle3') ? 0.18 : 0);
    m.rebirthMult = 1 + CONFIG.rebirthMultPerPoint * g.meta.rpTotal;
    m.codexBonus = 1 + Progression.codexTiersComplete(g) * CONFIG.codexTierBonus;
    m.achBonus = 1 + Progression.achievementBonus(g);
    m.shopSales = 1 + 0.1 * sh('sales');
    m.planetSales = sp === 'sales' ? 1.15 : 1;
    m.researchSales = research;
    m.sales = U.safe(m.rebirthMult * m.codexBonus * m.achBonus * m.shopSales * m.planetSales * research, 1);
    g.mods = m;
    return m;
  },

  // ---------------- research ----------------
  researchCost(g, r) { return r.cost * g.mods.researchCost; },
  researchTime(g, r) {
    let speed = 0;
    for (const b of g.lists.lab || []) speed += Math.pow(1.3, b.level - 1);
    return r.time * CONFIG.researchTimeFactor / (Math.max(1, speed) * g.mods.researchSpeed);
  },
  researchState(g, r) {
    if (g.run.research.done.has(r.id)) return 'done';
    if (g.run.research.active && g.run.research.active.id === r.id) return 'active';
    if (!r.req.every(q => g.run.research.done.has(q))) return 'locked';
    return 'available';
  },
  canResearch(g, r) {
    if (!(g.lists.lab && g.lists.lab.length)) return 'Forschungslabor nötig';
    if (g.run.research.active) return 'Es läuft bereits eine Forschung';
    const st = Progression.researchState(g, r);
    if (st === 'done') return 'Bereits erforscht';
    if (st === 'locked') return 'Voraussetzungen fehlen';
    if (Progression.researchCost(g, r) > g.run.money) return 'Zu teuer';
    return null;
  },
  startResearch(g, id) {
    const r = DATA.RESEARCH_BY_ID[id];
    const err = Progression.canResearch(g, r);
    if (err) return err;
    g.run.money -= Progression.researchCost(g, r);
    g.run.research.active = { id, prog: 0 };
    return null;
  },
  tickResearch(g, dt) {
    const a = g.run.research.active;
    if (!a || !(g.lists.lab && g.lists.lab.length)) return; // paused without a lab
    const r = DATA.RESEARCH_BY_ID[a.id];
    const total = Progression.researchTime(g, r);
    if (!isFinite(total)) return;
    a.prog += dt / total;
    if (a.prog >= 1) Progression.finishResearch(g, a.id);
  },
  finishResearch(g, id) {
    g.run.research.done.add(id);
    g.run.research.active = null;
    g.stats.research++;
    g.topologyDirty = true;
    Progression.computeMods(g);
    g.events.push({ type: 'research', id });
    if (g.stats.research >= 10) Progression.unlock(g, 'research10');
    if (g.run.research.done.size >= DATA.RESEARCH.length) Progression.unlock(g, 'researchAll');
  },

  // ---------------- customer tiers ----------------
  checkTiers(g) {
    const run = g.run;
    while (run.custTier < 5 && run.earned >= CONFIG.customers[run.custTier + 1].unlock) {
      run.custTier++;
      g.events.push({ type: 'tier', tier: run.custTier });
      Progression.unlock(g, 'cust' + (run.custTier + 1));
    }
  },

  // ---------------- codex ----------------
  codexTiersComplete(g) {
    let n = 0;
    for (let t = 0; t < 8; t++) if (DATA.BY_TIER[t].every(r => g.meta.codex.state[r] >= 2)) n++;
    return n;
  },
  codexCount(g) { let n = 0; for (let i = 0; i < 91; i++) if (g.meta.codex.state[i] >= 2) n++; return n; },
  onCodex(g) {
    const n = Progression.codexCount(g);
    if (n >= 45) Progression.unlock(g, 'codex45');
    if (n >= 91) Progression.unlock(g, 'codexFull');
    for (let t = 0; t < 8; t++) {
      if (DATA.BY_TIER[t].some(r => g.meta.codex.state[r] >= 2)) Progression.unlock(g, 'tier' + t);
    }
    Progression.computeMods(g);
  },
  seeDeposit(g, d) {
    if (g.meta.codex.state[d.res] < 1) g.meta.codex.state[d.res] = 1;
  },

  // ---------------- achievements ----------------
  achievementBonus(g) {
    let s = 0;
    for (const id of g.meta.ach) { const a = DATA.ACH_BY_ID[id]; if (a) s += a.bonus; }
    return s;
  },
  unlock(g, id) {
    if (g.meta.ach.has(id) || !DATA.ACH_BY_ID[id]) return;
    g.meta.ach.add(id);
    g.events.push({ type: 'achievement', id });
    g.modsDirty = true;
  },
  checkAchievements(g) {
    const st = g.stats, run = g.run;
    if (g.meta.totalEarned >= 1e3) Progression.unlock(g, 'earn1k');
    if (g.meta.totalEarned >= 1e5) Progression.unlock(g, 'earn100k');
    if (g.meta.totalEarned >= 1e7) Progression.unlock(g, 'earn10m');
    if (g.meta.totalEarned >= 1e9) Progression.unlock(g, 'earn1b');
    if (g.meta.totalEarned >= 1e12) Progression.unlock(g, 'earn1t');
    const belts = run.counts.belt || 0;
    if (belts >= 100) Progression.unlock(g, 'belts100');
    if (belts >= 1000) Progression.unlock(g, 'belts1000');
    if ((g.lists.extractor || []).length > 0) Progression.unlock(g, 'firstExtractor');
    if ((g.lists.extractor || []).some(b => b.level >= 10)) Progression.unlock(g, 'maxLevel');
    let big = 0;
    for (const b of g.buildings.values()) if (!TRANSPORT[b.type] && !Grid.isDeco(b.type)) big++;
    if (big >= 100) Progression.unlock(g, 'buildings100');
    const L = CONFIG.landing;
    if (U.dist2(run.player.x, run.player.y, L.x, L.y) > 500 * 500) Progression.unlock(g, 'explorer');
    if (g.meta.rebirths >= 1) Progression.unlock(g, 'rebirth1');
    if (g.meta.rebirths >= 5) Progression.unlock(g, 'rebirth5');
    if (g.meta.rebirths >= 10) Progression.unlock(g, 'rebirth10');
    if (run.planet >= 8) Progression.unlock(g, 'planet8');
    if (g.world.start.luck >= 2) Progression.unlock(g, 'jackpot');
  },

  // ---------------- rebirth ----------------
  threshold(k) { return CONFIG.rebirthBase * Math.pow(CONFIG.rebirthGrowth, k - 1); },
  rebirthPoints(g) {
    const th = Progression.threshold(g.run.planet);
    if (g.run.earned < th) return 0;
    return Math.max(1, Math.floor(Math.sqrt(g.run.earned / th)));
  },
  rebirthPreview(g) {
    const p = Progression.rebirthPoints(g);
    const total = g.meta.rpTotal + p + (p > 0 ? g.meta.bonusRp : 0);
    return { points: p, bonus: g.meta.bonusRp, newMult: 1 + CONFIG.rebirthMultPerPoint * total, threshold: Progression.threshold(g.run.planet), next: Math.min(g.meta.maxPlanet + 1, Math.max(g.meta.maxPlanet, g.run.planet + 1)) };
  },
  buyShop(g, id) {
    const def = DATA.REBIRTH_BY_ID[id];
    const lvl = g.meta.shop[id] || 0;
    if (lvl >= def.max) return 'Maximale Stufe erreicht';
    const c = DATA.rebirthUpgradeCost(def, lvl);
    if (c > g.meta.rp) return 'Zu wenig Rebirth-Punkte';
    g.meta.rp -= c;
    g.meta.shop[id] = lvl + 1;
    Progression.computeMods(g);
    g.topologyDirty = true;
    return null;
  }
};
