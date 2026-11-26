// =====================================================================
// Menus: Kodex, Forschung, Rebirth & Shop, Statistiken, Erfolge, Einstellungen
// =====================================================================
const Menus = {
  tab: 'codex',
  codexSel: -1,
  treeSel: null,
  treeView: { x: 0, y: 0, s: 0.8 },
  rbPlanet: null,
  TABS: [['codex', '📖 Kodex'], ['research', '⚗ Forschung'], ['rebirth', '♻ Rebirth'], ['stats', '📈 Statistik'], ['ach', '🏆 Erfolge'], ['settings', '⚙ Einstellungen']],

  open(tab) {
    Menus.tab = tab || Menus.tab;
    const m = h('div', { class: 'modal' });
    const head = h('div', { class: 'modal-head' }, h('h2', { text: GAME_TITLE }), h('button', { class: 'icon-btn small', 'aria-label': 'Schließen', onclick: () => UI.closeModal() }, '✕'));
    const tabs = h('div', { class: 'modal-tabs', role: 'tablist' });
    for (const [id, label] of Menus.TABS) {
      tabs.append(h('button', { class: 'modal-tab' + (id === Menus.tab ? ' on' : ''), role: 'tab', onclick: () => { Menus.tab = id; Audio2.play('click'); Menus.render(); [...tabs.children].forEach(c => c.classList.toggle('on', c.textContent === label)); } }, label));
    }
    const body = h('div', { class: 'modal-body', id: 'menu-body' });
    m.append(head, tabs, body);
    UI.openModal(m, { onClose: () => { clearInterval(Menus.timer); } });
    Menus.render();
    clearInterval(Menus.timer);
    Menus.timer = setInterval(() => { if (!UI.modalOpen()) { clearInterval(Menus.timer); return; } if (Menus.tab === 'research' || Menus.tab === 'rebirth') Menus.liveUpdate(); }, 500);
    Tutorial.onEvent('menu', tab);
  },
  render() {
    const body = $('#menu-body');
    if (!body) return;
    body.innerHTML = '';
    const f = { codex: Menus.codex, research: Menus.research, rebirth: Menus.rebirth, stats: Menus.stats, ach: Menus.achievements, settings: Menus.settings }[Menus.tab];
    f(body);
  },
  liveUpdate() {
    if (Menus.tab === 'research') {
      $$('.tree-node').forEach(el => {
        const r = DATA.RESEARCH_BY_ID[el.dataset.id];
        const st = Progression.researchState(App.g, r);
        el.className = 'tree-node ' + st;
        const c = el.querySelector('.cost');
        if (c && st !== 'done') c.classList.toggle('no', Progression.researchCost(App.g, r) > App.g.run.money);
        const pr = el.querySelector('.progress i');
        if (pr && App.g.run.research.active && App.g.run.research.active.id === r.id) pr.style.width = (App.g.run.research.active.prog * 100) + '%';
      });
      const det = $('#tree-detail');
      if (det && Menus.treeSel) Menus.treeDetail(det);
    }
    if (Menus.tab === 'rebirth') { const el = $('#rb-live'); if (el) Menus.rebirthLive(el); }
  },

  // ---------------- Kodex ----------------
  codex(body) {
    const g = App.g, cx = g.meta.codex;
    const n = Progression.codexCount(g);
    body.append(h('div', { class: 'big-num', text: n + ' / 91 Rohstoffe entdeckt' }));
    body.append(h('p', { class: 'muted', text: 'Jede vollständig entdeckte Stufe gibt dauerhaft +2 % Verkaufserlös (bleibt über Rebirth erhalten). Entdeckt heißt: mindestens eine Einheit abgebaut.' }));
    const tiers = h('div', { class: 'codex-tiers' });
    for (let t = 0; t < 8; t++) {
      const ids = DATA.BY_TIER[t];
      const got = ids.filter(r => cx.state[r] >= 2).length;
      tiers.append(h('span', { class: 'codex-tier', style: { borderColor: DATA.TIERS[t].color, color: DATA.TIERS[t].color } }, DATA.TIERS[t].name + ' ' + got + '/' + ids.length + (got === ids.length ? ' ✓ +2 %' : '')));
    }
    body.append(tiers);
    const detail = h('div', { id: 'codex-detail' });
    body.append(detail);
    const grid = h('div', { class: 'codex-grid' });
    for (const R of DATA.RESOURCES) {
      const st = cx.state[R.id];
      const cell = h('button', { class: 'codex-cell' + (st < 2 ? ' unknown' : '') + (st >= 1 ? ' rar rar-' + R.tier : '') });
      if (st >= 1) cell.style.setProperty('--rc', DATA.TIERS[R.tier].color);
      cell.append(Sprites.itemCanvas(R.id, 0, 44, st < 1));
      cell.append(h('div', { class: 'n', text: st >= 1 ? R.name : '???' }));
      cell.addEventListener('click', () => { Menus.codexSel = R.id; Menus.codexDetail(detail); Audio2.play('click'); detail.scrollIntoView({ block: 'nearest' }); });
      grid.append(cell);
    }
    body.append(grid);
    if (Menus.codexSel >= 0) Menus.codexDetail(detail);
  },
  codexDetail(el) {
    const g = App.g, cx = g.meta.codex;
    const R = DATA.RESOURCES[Menus.codexSel];
    const st = cx.state[R.id];
    el.innerHTML = '';
    const box = h('div', { class: 'codex-detail' });
    box.append(Sprites.itemCanvas(R.id, 0, 72, st < 1));
    const info = h('div');
    if (st < 1) {
      info.innerHTML = '<h3 style="margin:0">???</h3><p class="muted">' + DATA.TIERS[R.tier].name + '. Noch nicht gesichtet. Erkunde und scanne, um es zu finden.</p>';
    } else {
      info.innerHTML = '<h3 style="margin:0;color:' + DATA.TIERS[R.tier].color + '">' + esc(R.name) + '</h3><p class="muted" style="margin:4px 0 8px">' + esc(R.desc) + '</p>' +
        '<div class="kv"><span>Seltenheit</span><b>' + DATA.TIERS[R.tier].name + '</b><span>Basiswert</span><b>' + Fmt.num(R.value) + ' ' + CURRENCY_SHORT + '</b>' +
        '<span>Status</span><b>' + (st >= 2 ? 'Entdeckt' : 'Gesichtet (noch nicht abgebaut)') + '</b><span>Gesamt abgebaut</span><b>' + Fmt.int(cx.mined[R.id]) + '</b>' +
        '<span>Rekord-Verkaufspreis</span><b>' + (cx.best[R.id] > 0 ? Fmt.num(cx.best[R.id]) + ' ' + CURRENCY_SHORT + '/Stück' : '–') + '</b>' +
        '<span>Aktuelle Nachfrage</span><b>' + InfoPanel.trend(g, R.id) + '</b></div>';
    }
    box.append(info);
    el.append(box);
  },

  // ---------------- Forschung ----------------
  research(body) {
    const g = App.g;
    const hasLab = g.lists.lab && g.lists.lab.length;
    if (!hasLab) body.append(h('div', { class: 'card', style: { marginBottom: '10px' } }, h('h3', { text: 'Forschungslabor nötig' }), h('p', { text: 'Baue ein Forschungslabor (Kategorie „Lager & Verarbeitung“), um Technologien zu erforschen. Forschung kostet ' + CURRENCY_NAME + ' und etwas Zeit.' })));
    const det = h('div', { id: 'tree-detail', class: 'card', style: { marginBottom: '10px', minHeight: '86px' } });
    body.append(det);
    if (!Menus.treeSel) det.innerHTML = '<p class="muted" style="margin:0">Wähle eine Technologie im Baum. Ziehen verschiebt, Mausrad/Pinch zoomt.</p>';
    else Menus.treeDetail(det);
    const wrap = h('div', { class: 'tree-wrap' });
    const inner = h('div', { class: 'tree-inner' });
    const W = 200, H = 76, OX = 110, OY = 10;
    const pos = r => [OX + r.x * W, OY + r.y * H];
    // connectors
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', OX + 4 * W + 40); svg.setAttribute('height', OY + 14 * H + 20);
    svg.style.position = 'absolute'; svg.style.left = '0'; svg.style.top = '0';
    for (const r of DATA.RESEARCH) for (const q of r.req) {
      const a = pos(DATA.RESEARCH_BY_ID[q]), b = pos(r);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', 'M' + (a[0] + 176) + ' ' + (a[1] + 32) + ' C ' + (a[0] + 190) + ' ' + (a[1] + 32) + ', ' + (b[0] - 14) + ' ' + (b[1] + 32) + ', ' + b[0] + ' ' + (b[1] + 32));
      line.setAttribute('stroke', g.run.research.done.has(q) ? '#63df74' : 'rgba(255,255,255,.25)');
      line.setAttribute('stroke-width', '2'); line.setAttribute('fill', 'none');
      svg.append(line);
    }
    inner.append(svg);
    const cats = {};
    for (const r of DATA.RESEARCH) { if (!(r.cat in cats) || r.y < cats[r.cat]) cats[r.cat] = r.y; }
    for (const c in cats) inner.append(h('div', { class: 'tree-cat', style: { left: '8px', top: (OY + cats[c] * H + 24) + 'px' } }, c));
    for (const r of DATA.RESEARCH) {
      const st = Progression.researchState(g, r);
      const [x, y] = pos(r);
      const node = h('div', { class: 'tree-node ' + st, 'data-id': r.id, style: { left: x + 'px', top: y + 'px' } });
      node.innerHTML = '<b>' + esc(r.name) + '</b>' + (st === 'done' ? '<span style="color:var(--good)">✓ Erforscht</span>' : '<span class="cost' + (Progression.researchCost(g, r) > g.run.money ? ' no' : '') + '">' + Fmt.money(Progression.researchCost(g, r)) + '</span> · ' + Fmt.time(Progression.researchTime(g, r))) +
        (st === 'active' ? '<div class="progress" style="margin-top:4px"><i style="width:' + (g.run.research.active.prog * 100) + '%"></i></div>' : '');
      node.addEventListener('click', () => { if (Menus.treeDrag && Menus.treeDrag.moved) return; Menus.treeSel = r.id; Menus.treeDetail(det); Audio2.play('click'); });
      inner.append(node);
    }
    wrap.append(inner);
    const zoom = h('div', { class: 'tree-zoom' },
      h('button', { class: 'icon-btn small', 'aria-label': 'Hineinzoomen', onclick: () => { Menus.treeView.s = Math.min(1.6, Menus.treeView.s * 1.2); apply(); } }, '+'),
      h('button', { class: 'icon-btn small', 'aria-label': 'Herauszoomen', onclick: () => { Menus.treeView.s = Math.max(0.4, Menus.treeView.s / 1.2); apply(); } }, '−'));
    wrap.append(zoom);
    body.append(wrap);
    const v = Menus.treeView;
    const apply = () => { inner.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.s + ')'; };
    apply();
    const pts = new Map();
    wrap.addEventListener('pointerdown', e => {
      if (e.target.closest('.tree-zoom')) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      Menus.treeDrag = { moved: false, sx: e.clientX, sy: e.clientY };
      if (pts.size === 2) { const p = [...pts.values()]; Menus.treePinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), s: v.s }; }
    });
    wrap.addEventListener('pointermove', e => {
      const p0 = pts.get(e.pointerId);
      if (!p0) return;
      if (pts.size === 2 && Menus.treePinch) {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const p = [...pts.values()];
        v.s = U.clamp(Menus.treePinch.s * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / Menus.treePinch.d, 0.4, 1.6);
        Menus.treeDrag.moved = true; apply(); return;
      }
      v.x += e.clientX - p0.x; v.y += e.clientY - p0.y;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (Math.hypot(e.clientX - Menus.treeDrag.sx, e.clientY - Menus.treeDrag.sy) > 6) Menus.treeDrag.moved = true;
      apply();
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) Menus.treePinch = null; setTimeout(() => { if (!pts.size && Menus.treeDrag) Menus.treeDrag.moved = false; }, 0); };
    wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
    wrap.addEventListener('wheel', e => { e.preventDefault(); v.s = U.clamp(v.s * Math.exp(-e.deltaY * 0.0015), 0.4, 1.6); apply(); }, { passive: false });
  },
  treeDetail(det) {
    const g = App.g;
    const r = DATA.RESEARCH_BY_ID[Menus.treeSel];
    const st = Progression.researchState(g, r);
    const err = Progression.canResearch(g, r);
    det.innerHTML = '';
    det.append(h('h3', { text: r.name + ' · ' + r.cat }));
    det.append(h('p', { text: r.desc + (r.req.length ? ' Voraussetzung: ' + r.req.map(q => DATA.RESEARCH_BY_ID[q].name).join(', ') + '.' : '') }));
    const row = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } });
    if (st === 'done') row.append(h('span', { class: 'tag good', text: '✓ Erforscht' }));
    else if (st === 'active') {
      const a = g.run.research.active;
      row.append(h('span', { class: 'tag', text: 'Läuft · noch ' + Fmt.time(Progression.researchTime(g, r) * (1 - a.prog)) }));
    } else {
      const btn = h('button', { class: 'btn accent' }, 'Erforschen · ' + Fmt.money(Progression.researchCost(g, r)));
      if (err) { btn.disabled = true; row.append(btn, h('span', { class: 'muted', text: err })); }
      else row.append(btn);
      btn.addEventListener('click', () => {
        const e2 = Progression.startResearch(g, r.id);
        if (e2) { UI.toast(e2, 'bad'); Audio2.play('error'); }
        else { Audio2.play('upgrade'); UI.toast('Forschung gestartet: ' + r.name); Menus.render(); }
      });
    }
    det.append(row);
  },

  // ---------------- Rebirth ----------------
  rebirth(body) {
    const g = App.g;
    const live = h('div', { id: 'rb-live' });
    body.append(live);
    Menus.rebirthLive(live);
    body.append(h('h3', { text: 'Rebirth-Shop · ' + Fmt.int(g.meta.rp) + ' Punkte verfügbar', style: { marginTop: '16px' } }));
    body.append(h('p', { class: 'muted', text: 'Käufe bleiben dauerhaft erhalten. Der Multiplikator richtet sich nach allen jemals erhaltenen Punkten, Ausgeben senkt ihn nicht.' }));
    const grid = h('div', { class: 'grid-cards' });
    for (const def of DATA.REBIRTH_UPGRADES) {
      const lvl = g.meta.shop[def.id] || 0;
      const c = DATA.rebirthUpgradeCost(def, lvl);
      const card = h('div', { class: 'card' });
      card.append(h('h3', { text: def.name + ' · ' + lvl + '/' + def.max }));
      card.append(h('p', { text: def.desc }));
      const btn = h('button', { class: 'btn' + (lvl < def.max && c <= g.meta.rp ? ' accent' : ''), style: { width: '100%' } }, lvl >= def.max ? 'Maximal' : 'Kaufen · ' + c + ' RP');
      if (lvl >= def.max || c > g.meta.rp) btn.disabled = true;
      btn.addEventListener('click', () => {
        const err = Progression.buyShop(g, def.id);
        if (err) { UI.toast(err, 'bad'); Audio2.play('error'); return; }
        Audio2.play('unlock'); UI.toast(def.name + ' auf Stufe ' + (g.meta.shop[def.id]) + ' verbessert', 'good');
        Menus.render();
      });
      card.append(btn);
      grid.append(card);
    }
    body.append(grid);
  },
  rebirthLive(el) {
    const g = App.g;
    const pv = Progression.rebirthPreview(g);
    const ok = pv.points > 0;
    if (Menus.rbPlanet === null || Menus.rbPlanet > g.meta.maxPlanet + 1) Menus.rbPlanet = Math.max(g.meta.maxPlanet, g.run.planet + 1);
    const avail = Math.max(g.meta.maxPlanet, g.run.planet + 1);
    const key = ok + '|' + pv.points + '|' + Menus.rbPlanet + '|' + Math.floor(g.run.earned / Math.max(1, pv.threshold) * 200);
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.innerHTML = '';
    const hero = h('div', { class: 'rb-hero' });
    const left = h('div', { class: 'card' });
    left.append(h('h3', { text: 'Fortschritt auf ' + g.world.planet.name }));
    left.append(h('div', { class: 'big-num', text: Fmt.money(g.run.earned) }));
    left.append(h('p', { text: 'Schwelle für Planet ' + g.run.planet + ': ' + Fmt.money(pv.threshold) }));
    left.append(h('div', { class: 'progress' }, h('i', { style: { width: U.clamp(g.run.earned / pv.threshold * 100, 0, 100) + '%' } })));
    left.append(h('p', { class: 'muted', style: { marginTop: '8px' }, text: 'Punkte = ⌊√(Erlös ÷ Schwelle)⌋. Wer länger bleibt, bekommt mehr, mit abnehmendem Ertrag.' }));
    const right = h('div', { class: 'card' });
    right.append(h('h3', { text: 'Vorschau' }));
    if (ok) {
      const pl = DATA.planet(Menus.rbPlanet);
      right.append(h('p', { html: 'Du erhältst <b>' + pv.points + (pv.bonus ? ' + ' + pv.bonus + ' Bonus' : '') + ' Rebirth-Punkte</b> (neuer Gesamt-Multiplikator <b>×' + Fmt.dec(pv.newMult, 2) + '</b>), Ziel: <b>Planet ' + pl.index + ' · ' + esc(pl.name) + '</b>' }));
    } else right.append(h('p', { text: 'Noch ' + Fmt.money(pv.threshold - g.run.earned) + ' Gesamtverkauf bis zum ersten möglichen Rebirth.' }));
    right.append(h('p', { class: 'muted', text: 'Aktueller Multiplikator ×' + Fmt.dec(g.mods.rebirthMult, 2) + ' · ' + g.meta.rebirths + ' Rebirths · ' + Fmt.int(g.meta.rpTotal) + ' Punkte insgesamt' }));
    hero.append(left, right);
    el.append(hero);
    el.append(h('b', { text: 'Zielplanet wählen' }));
    const list = h('div', { class: 'planet-list', style: { margin: '8px 0 12px' } });
    for (let k = 1; k <= avail; k++) {
      const pl = DATA.planet(k);
      const btn = h('button', { class: 'planet-btn' + (k === Menus.rbPlanet ? ' on' : '') });
      btn.innerHTML = '<span class="pico"></span><b>' + k + ' · ' + esc(pl.name) + '</b><br><span class="muted">' + (pl.special ? esc(DATA.PLANET_SPECIALS[pl.special].desc) : 'Ausgeglichen') + '</span>' + (k > g.meta.maxPlanet ? '<br><span style="color:var(--good)">Neu!</span>' : '') + '<br><span class="muted">Schwelle ' + Fmt.money(Progression.threshold(k)) + '</span>';
      btn.querySelector('.pico').append(PlanetArt.icon(pl, 46));
      btn.addEventListener('click', () => { Menus.rbPlanet = k; el.dataset.key = ''; Menus.rebirthLive(el); });
      list.append(btn);
    }
    el.append(list);
    const btn = h('button', { class: 'btn big ' + (ok ? 'accent' : ''), style: { width: '100%' } }, ok ? '♻ Rebirth durchführen' : 'Rebirth noch nicht möglich');
    btn.disabled = !ok;
    btn.addEventListener('click', () => Menus.confirmRebirth());
    el.append(btn);
  },
  confirmRebirth() {
    const g = App.g;
    const pv = Progression.rebirthPreview(g);
    const pl = DATA.planet(Menus.rbPlanet);
    UI.confirm('Rebirth bestätigen', '<div class="kv" style="margin-bottom:10px"><span>Punkte</span><b>+' + (pv.points + pv.bonus) + '</b><span>Neuer Multiplikator</span><b>×' + Fmt.dec(pv.newMult, 2) + '</b><span>Ziel</span><b>' + esc(pl.name) + '</b></div>' +
      '<b>Du verlierst:</b><ul class="list-plain"><li>alle Gebäude, Taler und Lagerbestände</li><li>Forschung und Kunden-Freischaltungen</li><li>Kartenfortschritt und Nachfrage</li></ul>' +
      '<b>Du behältst:</b><ul class="list-plain"><li>Rebirth-Punkte und Shop-Käufe</li><li>Kodex und Sammlungsboni</li><li>Erfolge, Statistiken, Einstellungen</li><li>freigeschaltete Planeten</li></ul>', 'Rebirth starten', () => MainLoop.doRebirth(Menus.rbPlanet));
  },

  // ---------------- Statistik ----------------
  stats(body) {
    const g = App.g, st = g.stats;
    const grid = h('div', { class: 'stat-grid' });
    const add = (k, v) => grid.append(h('div', { class: 'stat' }, h('span', { text: k }), h('b', { text: v })));
    add('Gesamt-Erlös', Fmt.money(g.meta.totalEarned));
    add('Erlös dieser Durchlauf', Fmt.money(g.run.earned));
    add('Einnahmen/s (Ø 30 s)', Fmt.money(g.income));
    add('Rekord Einnahmen/s', Fmt.money(st.bestIncome));
    add('Spielzeit', Fmt.duration(st.playTime));
    add('Durchlauf-Zeit', Fmt.duration(g.run.time));
    add('Verkaufte Items', Fmt.int(st.sold));
    add('Veredelte Items', Fmt.int(st.refined));
    add('Zufriedene Kunden', Fmt.int(st.satisfied));
    add('Erfüllte Verträge', Fmt.int(st.contracts));
    add('Abgeschlossene Forschungen', Fmt.int(st.research));
    add('Offline verdient', Fmt.money(st.offlineEarned));
    add('Scans', Fmt.int(st.scans));
    add('Rebirths', Fmt.int(g.meta.rebirths));
    add('Rebirth-Multiplikator', '×' + Fmt.dec(g.mods.rebirthMult, 2));
    add('Gesamt-Verkaufsbonus', '×' + Fmt.dec(g.mods.sales, 2));
    add('Gebäude', Fmt.int(g.buildings.size));
    add('Förderband-Felder', Fmt.int(g.run.counts.belt || 0));
    add('Glücksstart', World.LUCK_NAMES[g.world.start.luck]);
    add('Planet', g.world.planet.name + (g.world.planet.special ? ' · ' + DATA.PLANET_SPECIALS[g.world.planet.special].name : ''));
    body.append(grid);
    body.append(h('h3', { text: 'Abgebaute Mengen nach Stufe' }));
    const mg = h('div', { class: 'stat-grid' });
    for (let t = 0; t < 8; t++) mg.append(h('div', { class: 'stat' }, h('span', { text: DATA.TIERS[t].name, style: { color: DATA.TIERS[t].color } }), h('b', { text: Fmt.int(st.minedByTier[t]) })));
    body.append(mg);
    body.append(h('h3', { text: 'Erlös über Zeit' }));
    const cv = h('canvas', { class: 'chart' });
    body.append(cv);
    requestAnimationFrame(() => Menus.chart(cv));
    body.append(h('h3', { text: 'Letzte Verkäufe' }));
    const log = h('div', { class: 'sales-log' });
    if (!g.run.salesLog.length) log.append(h('div', { class: 'muted', text: 'Noch keine Verkäufe in diesem Durchlauf.' }));
    for (const e of g.run.salesLog) {
      const row = h('div');
      if (e.key >= 0) row.append(Sprites.itemCanvas(e.key >> 2, e.key & 3, 18));
      row.append(h('span', { text: DATA.CUSTOMERS[e.tier].name + ' · ' + Fmt.int(e.units) + ' Items' + (e.ok ? ' · zufrieden' : '') }));
      row.append(h('b', { text: '+' + Fmt.money(e.rev) }));
      log.append(row);
    }
    body.append(log);
    if (st.runs.length) {
      body.append(h('h3', { text: 'Bisherige Durchläufe' }));
      const rl = h('div', { class: 'sales-log' });
      for (const r of st.runs.slice().reverse()) rl.append(h('div', null, h('span', { text: 'Planet ' + r.planet + ' · ' + Fmt.duration(r.time) }), h('b', { text: Fmt.money(r.earned) + ' · +' + r.points + ' RP' })));
      body.append(rl);
    }
  },
  chart(cv) {
    const g = App.g;
    const d = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 600, hh = 180;
    cv.width = w * d; cv.height = hh * d;
    const x = cv.getContext('2d'); x.scale(d, d);
    const data = g.meta.earnHistory.concat([[Math.round(g.stats.playTime), g.meta.totalEarned]]);
    x.fillStyle = 'rgba(255,255,255,.04)'; x.fillRect(0, 0, w, hh);
    if (data.length < 2) { x.fillStyle = '#bdb1a8'; x.font = '13px system-ui'; x.fillText('Daten werden minütlich gesammelt.', 12, 24); return; }
    const t0 = data[0][0], t1 = data[data.length - 1][0];
    const maxV = Math.max(1, ...data.map(p => p[1]));
    const logMax = Math.log10(maxV + 1);
    const px = t => 40 + (t - t0) / Math.max(1, t1 - t0) * (w - 50);
    const py = v => hh - 20 - Math.log10(v + 1) / logMax * (hh - 34);
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.fillStyle = '#bdb1a8'; x.font = '12px system-ui'; x.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const v = Math.pow(10, logMax * i / 4) - 1; const y = py(v); x.beginPath(); x.moveTo(40, y); x.lineTo(w - 10, y); x.stroke(); x.fillText(Fmt.num(v), 2, y + 4); }
    x.fillText(Fmt.duration(t1 - t0), w - 90, hh - 4);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff8a3d';
    x.strokeStyle = accent; x.lineWidth = 2;
    x.beginPath(); data.forEach((p, i) => { i ? x.lineTo(px(p[0]), py(p[1])) : x.moveTo(px(p[0]), py(p[1])); }); x.stroke();
  },

  // ---------------- Erfolge ----------------
  achievements(body) {
    const g = App.g;
    const got = DATA.ACHIEVEMENTS.filter(a => g.meta.ach.has(a.id)).length;
    body.append(h('div', { class: 'big-num', text: got + ' / ' + DATA.ACHIEVEMENTS.length + ' Erfolge' }));
    body.append(h('p', { class: 'muted', text: 'Jeder Erfolg gibt einen kleinen dauerhaften Erlösbonus. Aktuell: +' + Fmt.dec(Progression.achievementBonus(g) * 100, 1) + ' %' }));
    const grid = h('div', { class: 'ach-grid' });
    for (const a of DATA.ACHIEVEMENTS) {
      const has = g.meta.ach.has(a.id);
      grid.append(h('div', { class: 'ach' + (has ? ' got' : '') }, h('div', { class: 'ic', text: has ? '★' : '☆' }), h('div', null, h('b', { text: a.name }), h('small', { text: a.desc + ' · +' + Fmt.dec(a.bonus * 100, 1) + ' %' }))));
    }
    body.append(grid);
  },

  // ---------------- Einstellungen ----------------
  settings(body) {
    const s = App.settings;
    const wrap = h('div', { class: 'settings' });
    const sw = (label, sub, key, after) => {
      const el = h('div', { class: 'switch' + (s[key] ? ' on' : ''), role: 'switch', tabindex: 0, 'aria-checked': String(!!s[key]) });
      const toggle = () => { s[key] = !s[key]; el.classList.toggle('on', s[key]); el.setAttribute('aria-checked', String(s[key])); App.saveSettings(); if (after) after(); Audio2.play('click'); };
      el.addEventListener('click', toggle);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      wrap.append(h('div', { class: 'set-row' }, h('label', null, label, sub ? h('small', { text: sub }) : null), el));
    };
    const range = (label, key, min, max, step, after) => {
      const el = h('input', { type: 'range', min, max, step, value: s[key], 'aria-label': label });
      el.addEventListener('input', () => { s[key] = +el.value; App.saveSettings(); if (after) after(); });
      wrap.append(h('div', { class: 'set-row' }, h('label', { text: label }), el));
    };
    const seg = (label, key, options, after) => {
      const box = h('div', { class: 'seg' });
      for (const [v, t] of options) {
        const b = h('button', { class: s[key] === v ? 'on' : '' }, t);
        b.addEventListener('click', () => { s[key] = v; App.saveSettings(); [...box.children].forEach(c => c.classList.toggle('on', c === b)); if (after) after(); Audio2.play('click'); });
        box.append(b);
      }
      wrap.append(h('div', { class: 'set-row' }, h('label', { text: label }), box));
    };
    wrap.append(h('h3', { text: 'Ton' }));
    sw('Ton an', 'Synthetische Klänge und Ambient-Musik', 'sound', () => Audio2.applyVolume());
    range('Effekt-Lautstärke', 'volume', 0, 1, 0.05);
    range('Musik-Lautstärke', 'music', 0, 1, 0.05);
    wrap.append(h('h3', { text: 'Grafik' }));
    seg('Qualität', 'quality', [['auto', 'Automatisch'], ['high', 'Hoch'], ['medium', 'Mittel'], ['low', 'Niedrig']], () => { if (s.quality !== 'auto') App.quality = s.quality; Render.chunks.clear(); });
    sw('Reduzierte Effekte', 'Weniger Partikel und Animationen', 'reducedFx');
    sw('Kamerawackeln aus', 'Kein Wackeln bei Eintritt und Landung', 'noShake');
    sw('Tag/Nacht-Zyklus', 'Rein optisch', 'dayNight');
    sw('Wetter und Staubstürme', 'Rein optisch', 'weather');
    sw('Minikarte anzeigen', null, 'minimap');
    wrap.append(h('h3', { text: 'Bedienung' }));
    seg('Zahlenformat', 'numberFormat', [['short', '1,23 Mio'], ['sci', '1,23e6'], ['full', '1.234.567']]);
    range('Joystick-Größe', 'joySize', 0.7, 1.4, 0.05);
    seg('Joystick-Seite', 'joySide', [['left', 'Links'], ['right', 'Rechts']]);
    sw('Hinweis beim Auto-Speichern', 'Auto-Speichern läuft alle 10 Sekunden', 'autosaveToast');
    wrap.append(h('h3', { text: 'Spielstand' }));
    const io = h('textarea', { class: 'io', placeholder: 'Hier einen exportierten Spielstand einfügen …', 'aria-label': 'Spielstand-Text' });
    const btns = h('div', { class: 'ip-actions' },
      h('button', { class: 'btn', onclick: () => { io.value = Save.exportString(App.g, { lastSeen: Date.now(), camera: { zoom: App.cam.zoom } }); io.select(); try { navigator.clipboard && navigator.clipboard.writeText(io.value); UI.toast('Spielstand exportiert und kopiert', 'good'); } catch (e) { UI.toast('Spielstand exportiert'); } } }, '⇪ Exportieren'),
      h('button', { class: 'btn', onclick: () => MainLoop.importSave(io.value) }, '⇩ Importieren'),
      h('button', { class: 'btn', onclick: () => MainLoop.restoreBackup() }, '↺ Backup laden'),
      h('button', { class: 'btn', onclick: () => { MainLoop.save(true); } }, '💾 Jetzt speichern'),
      h('button', { class: 'btn danger', onclick: () => MainLoop.wipeSave() }, '🗑 Spielstand löschen'));
    wrap.append(io, btns);
    wrap.append(h('h3', { text: 'Tutorial' }));
    wrap.append(h('div', { class: 'ip-actions' }, h('button', { class: 'btn', onclick: () => { Tutorial.restart(); UI.closeModal(); } }, 'Tutorial neu starten'),
      h('button', { class: 'btn', onclick: () => { UI.closeModal(); Intro.begin(App.g, { replay: true }); } }, 'Intro erneut ansehen')));
    wrap.append(h('p', { class: 'muted', style: { marginTop: '14px' }, text: GAME_TITLE + ' · Version ' + GAME_VERSION + ' · Spielstand-Format ' + SAVE_VERSION + ' · Währung: ' + CURRENCY_NAME + ' (' + CURRENCY_SHORT + ')' }));
    wrap.append(h('p', { class: 'muted', text: 'Tastatur: WASD laufen · Shift sprinten · B Bauen · R Drehen · Q Pipette · F Scanner · M Karte · Z/Y Rückgängig/Wiederholen · Entf Abreißen · 1–9 Favoriten · Shift+Ziehen Auswahl · Strg+Shift+D Debug' }));
    body.append(wrap);
  }
};
