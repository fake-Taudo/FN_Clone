// =====================================================================
// UI: HUD, toasts, banners, build bar, ghost info, tooltips, selection bar
// =====================================================================
const UI = {
  cat: 'mine',
  modal: null,
  moneyShown: 0,
  toastQ: [],
  lastHud: 0,

  init() {
    $('#btn-build').addEventListener('click', () => { Audio2.start(); UI.toggleBuild(); });
    $('#btn-scan').addEventListener('click', () => { Audio2.start(); UI.scan(); });
    $('#btn-probe').addEventListener('click', () => UI.probe());
    $('#btn-map').addEventListener('click', () => UI.openMap());
    $('#btn-menu').addEventListener('click', () => Menus.open('codex'));
    $('#btn-minimap').addEventListener('click', () => { App.settings.minimap = !App.settings.minimap; App.saveSettings(); });
    $('#btn-fullscreen').addEventListener('click', UI.fullscreen);
    $('#btn-rotate').addEventListener('click', () => Build.rotate());
    $('#btn-cancel').addEventListener('click', () => Build.cancel());
    $('#btn-place').addEventListener('click', () => Build.confirm());
    $('#btn-undo').addEventListener('click', () => Build.undo());
    $('#btn-redo').addEventListener('click', () => Build.redo());
    $('#btn-center').addEventListener('click', UI.centerCamera);
    $('#tier-badge').addEventListener('click', () => Menus.open('stats'));
    $('#income').addEventListener('click', () => UI.salesPopover());
    $('#income').title = 'Letzte Verkäufe anzeigen';
    $('#minimap').addEventListener('click', () => UI.openMap());
    $('#tool-demolish').addEventListener('click', () => { Build.setTool('demolish'); if (App.touch && window.innerWidth < 900 && App.tool === 'demolish') UI.collapseBuild(true); });
    $('#tool-select').addEventListener('click', () => Build.setTool('select'));
    $('#bb-mini').addEventListener('click', () => { UI.collapseBuild(false); UI.refreshBuildBar(true); });
    $('#tool-pipette').addEventListener('click', () => { if (App.selected) { const b = App.selected; Build.setTool({ type: b.type, rot: b.rot, grade: b.grade || 0 }); } else UI.toast('Pipette: Gebäude antippen und dann Pipette, oder Q über einem Gebäude drücken'); });
    $('#research-chip').addEventListener('click', () => Menus.open('research'));
    $('#contracts-chip').addEventListener('click', () => { const t = App.g.lists.terminal && App.g.lists.terminal[0]; if (t) UI.select(t); });
    let logoTaps = 0, logoTimer = 0;
    $('#logo').addEventListener('click', () => {
      const now = performance.now();
      if (now - logoTimer > 1500) logoTaps = 0;
      logoTimer = now; logoTaps++;
      if (logoTaps >= 5) { logoTaps = 0; Debug.toggle(); }
    });
    // tooltips on HUD buttons (hover only)
    $$('#ui [title]').forEach(el => {
      el.addEventListener('mouseenter', () => { if (!App.touch) UI.showTooltip(el, el.getAttribute('title')); });
      el.addEventListener('mouseleave', UI.hideTooltip);
    });
    UI.buildCats();
  },

  // ---------------- HUD ----------------
  updateHud(dt) {
    const g = App.g;
    const target = g.run.money;
    const diff = target - UI.moneyShown;
    UI.moneyShown = Math.abs(diff) < 0.01 || !isFinite(UI.moneyShown) ? target : UI.moneyShown + diff * Math.min(1, dt * 8);
    const now = performance.now();
    $('#money').textContent = Fmt.num(UI.moneyShown) + ' ' + CURRENCY_SHORT;
    if (now - UI.lastHud < 200) return;
    UI.lastHud = now;
    $('#income').textContent = '+' + Fmt.num(g.income) + ' ' + CURRENCY_SHORT + '/s';
    const ct = g.run.custTier;
    const next = ct < 5 ? CONFIG.customers[ct + 1].unlock : null;
    const prev = CONFIG.customers[ct].unlock;
    const pct = next ? U.clamp((g.run.earned - prev) / (next - prev), 0, 1) : 1;
    $('#tier-badge').innerHTML = 'Kundenstufe<b>' + (ct + 1) + '<span class="long"> · ' + esc(DATA.CUSTOMERS[ct].plural) + '</span></b><div class="bar"><i style="width:' + (pct * 100).toFixed(1) + '%"></i></div>';
    $('#tier-badge').title = next ? 'Nächste Stufe bei ' + Fmt.money(next) + ' Gesamtverkauf (' + Fmt.money(g.run.earned) + ')' : 'Höchste Kundenstufe erreicht';
    const p = g.run.player;
    $('#coords').textContent = Math.floor(p.x) + ', ' + Math.floor(p.y);
    $('#planet-name').textContent = g.world.planet.name;
    // scanner cooldown ring
    const cd = g.run.scanCd / g.mods.scanCd;
    UI.setRing($('#btn-scan svg circle'), 26, cd);
    $('#btn-scan').classList.toggle('active', cd <= 0);
    const probe = g.run.research.done.has('probe');
    $('#btn-probe').classList.toggle('hidden', !probe);
    if (probe) UI.setRing($('#btn-probe svg circle'), 20, g.run.probeCd / 300);
    // research chip
    const a = g.run.research.active;
    const rc = $('#research-chip');
    if (a) {
      const r = DATA.RESEARCH_BY_ID[a.id];
      const left = Progression.researchTime(g, r) * (1 - a.prog);
      rc.classList.remove('hidden');
      rc.innerHTML = '⚗ ' + esc(r.name) + ' · ' + Fmt.time(left) + '<div class="bar"><i style="width:' + (a.prog * 100).toFixed(1) + '%"></i></div>';
    } else rc.classList.add('hidden');
    const cc = $('#contracts-chip');
    if (g.run.contracts.length) {
      cc.classList.remove('hidden');
      const c = g.run.contracts[0];
      const tot = c.req.reduce((s, r) => s + r.qty, 0), got = c.req.reduce((s, r) => s + r.got, 0);
      cc.innerHTML = '📜 ' + g.run.contracts.length + ' Verträge · ' + esc(c.planet) + ' ' + Fmt.time(c.end - g.run.time) + '<div class="bar"><i style="width:' + (got / tot * 100).toFixed(1) + '%"></i></div>';
    } else cc.classList.add('hidden');
    UI.updateBanners();
    UI.updateCompass();
    if (App.selected) UI.refreshInfo();
  },
  setRing(circle, r, frac) {
    const len = 2 * Math.PI * r;
    circle.style.strokeDasharray = len;
    circle.style.strokeDashoffset = len * (1 - U.clamp(frac, 0, 1));
    circle.style.opacity = frac > 0 ? 1 : 0;
  },
  updateBanners() {
    const g = App.g;
    const wrap = $('#banners');
    const evs = g.run.events;
    const key = evs.map(e => e.res + ':' + e.mult).join('|');
    if (wrap.dataset.key !== key) {
      wrap.dataset.key = key;
      wrap.innerHTML = '';
      for (const ev of evs) {
        const R = DATA.RESOURCES[ev.res];
        const el = h('div', { class: 'banner ' + (ev.pos ? 'pos' : 'neg') });
        el.append(Sprites.itemCanvas(ev.res, 0, 22));
        el.append(h('span', { text: ev.pos ? ev.who + ' sucht ' + R.name + ':' : 'Überangebot ' + R.name + ':' }));
        el.append(h('span', { class: 'mult', text: '×' + Fmt.dec(ev.mult, 1) }));
        el.append(h('span', { class: 'time' }));
        wrap.append(el);
      }
    }
    [...wrap.children].forEach((el, i) => { const ev = evs[i]; if (ev) el.lastChild.textContent = 'für ' + Fmt.time(ev.end - g.run.time); });
    // keep toasts below the event banners
    const bb = wrap.getBoundingClientRect();
    const base = window.innerWidth < 760 ? 78 : 70;
    $('#toasts').style.top = Math.max(base, evs.length ? bb.bottom + 8 : 0) + 'px';
  },
  updateCompass() {
    const g = App.g;
    const el = $('#compass');
    if (!g.run.research.done.has('compass')) { el.classList.add('hidden'); App.compassTarget = null; return; }
    if (!UI._compassT || performance.now() - UI._compassT > 2000) {
      UI._compassT = performance.now();
      let best = null, bestScore = -1;
      const p = g.run.player;
      for (const id of g.world.known) {
        const d = World.depositById(g.world, id);
        if (!d || Grid.depositFree(g, d) <= 0) continue;
        const dist = Math.hypot(d.x - p.x, d.y - p.y);
        const score = Math.pow(3, d.tier) * d.slots / (20 + dist);
        if (score > bestScore) { bestScore = score; best = d; }
      }
      App.compassTarget = best;
    }
    const t = App.compassTarget;
    if (!t) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const p = g.run.player;
    const ang = Math.atan2(t.y - p.y, t.x - p.x);
    el.firstElementChild.style.transform = 'rotate(' + (ang + Math.PI / 2) + 'rad)';
    el.lastElementChild.textContent = DATA.RESOURCES[t.res].name + ' · ' + Math.round(Math.hypot(t.x - p.x, t.y - p.y)) + ' m';
  },
  salesPopover() {
    const g = App.g;
    const log = h('div', { class: 'sales-log' });
    if (!g.run.salesLog.length) log.append(h('div', { class: 'muted', text: 'Noch keine Verkäufe in diesem Durchlauf.' }));
    for (const e of g.run.salesLog) {
      const row = h('div');
      if (e.key >= 0) row.append(Sprites.itemCanvas(e.key >> 2, e.key & 3, 18));
      row.append(h('span', { text: DATA.CUSTOMERS[e.tier].name + ' · ' + Fmt.int(e.units) + ' Items · vor ' + Fmt.time(g.run.time - e.t) + (e.ok ? ' · zufrieden' : '') }));
      row.append(h('b', { text: '+' + Fmt.money(e.rev) }));
      log.append(row);
    }
    UI.openModal(h('div', { class: 'modal small' },
      h('div', { class: 'modal-head' }, h('h2', { text: 'Letzte Verkäufe · Ø ' + Fmt.money(g.income) + '/s' }), h('button', { class: 'icon-btn small', 'aria-label': 'Schließen', onclick: () => UI.closeModal() }, '✕')),
      h('div', { class: 'modal-body' }, log)));
  },
  updateCenterBtn() { $('#btn-center').classList.toggle('hidden', App.cam.follow); },
  centerCamera() { App.cam.follow = true; UI.updateCenterBtn(); },

  // ---------------- toasts ----------------
  toast(text, kind = '', ms = 3200) {
    const wrap = $('#toasts');
    const maxToasts = window.innerWidth < 760 ? 2 : 4;
    while (wrap.children.length >= maxToasts) wrap.firstChild.remove();
    const el = h('div', { class: 'toast ' + kind });
    el.innerHTML = text;
    wrap.append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 240); }, ms);
  },

  // ---------------- tooltips ----------------
  showTooltip(el, text) {
    const t = $('#tooltip');
    t.innerHTML = text;
    t.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    const tw = t.offsetWidth, th = t.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    x = U.clamp(x, 8, App.view.w - tw - 8);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  },
  hideTooltip() { $('#tooltip').classList.add('hidden'); },
  hoverTooltip(sx, sy, t) {
    if (App.mode === 'build' || App.touch) return;
    const g = App.g;
    const d = World.depositAt(g.world, t.x, t.y);
    const b = Grid.at(g, t.x, t.y);
    const tip = $('#tooltip');
    if (d && !b && App.cam.zoom >= 14) {
      const R = DATA.RESOURCES[d.res];
      tip.innerHTML = '<b style="color:' + DATA.TIERS[d.tier].color + '">' + esc(R.name) + '</b>' + DATA.TIERS[d.tier].name + ' · Vorkommen ' + ['klein', 'mittel', 'groß'][d.sizeClass] + ' · ' + Grid.depositFree(g, d) + '/' + d.slots + ' Plätze frei<br>Wert ' + Fmt.num(R.value) + ' ' + CURRENCY_SHORT;
      tip.classList.remove('hidden');
      tip.style.left = Math.min(App.view.w - tip.offsetWidth - 8, sx + 16) + 'px';
      tip.style.top = Math.min(App.view.h - tip.offsetHeight - 8, sy + 16) + 'px';
    } else tip.classList.add('hidden');
  },

  // ---------------- build bar ----------------
  buildCats() {
    const wrap = $('#bb-cats');
    wrap.innerHTML = '';
    for (const c of DATA.CATEGORIES) {
      const el = h('button', { class: 'bb-cat' + (c.id === UI.cat ? ' on' : ''), role: 'tab', title: c.name, 'aria-label': c.name, onclick: () => { UI.cat = c.id; Audio2.play('click'); UI.buildCats(); UI.refreshBuildBar(true); } }, c.icon, h('span', { class: 'lbl', text: ' ' + c.name }));
      wrap.append(el);
    }
  },
  cardsKey: '',
  refreshBuildBar(force) {
    const g = App.g;
    if (!g || $('#buildbar').classList.contains('hidden')) return;
    const items = [];
    for (const type of DATA.BUILDING_ORDER) {
      const def = DATA.BUILDINGS[type];
      if (def.cat !== UI.cat) continue;
      if (type === 'belt') { for (let gr = 0; gr < 4; gr++) items.push({ type, grade: gr }); }
      else items.push({ type, grade: 0 });
    }
    const wrap = $('#bb-cards');
    const key = UI.cat + '|' + Math.floor(g.run.money) + '|' + g.run.custTier + '|' + g.run.research.done.size + '|' + JSON.stringify(App.tool) + '|' + JSON.stringify(g.run.kits) + '|' + Object.values(g.run.counts).join(',');
    if (!force && key === UI.cardsKey) return;
    UI.cardsKey = key;
    wrap.innerHTML = '';
    for (const it of items) {
      const def = DATA.BUILDINGS[it.type];
      const lock = Grid.unlockReason(g, it.type, it.grade);
      let cost = it.type === 'extractor' ? null : Grid.cost(g, it.type, { grade: it.grade });
      const name = it.type === 'belt' ? DATA.BELT_GRADES[it.grade].name : def.name;
      const on = Build.isSpecTool() && App.tool.type === it.type && (App.tool.grade || 0) === it.grade;
      const kit = g.run.kits[it.type] || 0;
      const card = h('button', { class: 'bb-card' + (on ? ' on' : '') + (lock ? ' locked' : ''), 'aria-label': name });
      card.append(Draw.thumb(it.type, 56, { grade: it.grade }));
      card.append(h('div', { class: 'n', text: name }));
      let ctext, ccls = 'c';
      if (lock) { ctext = '🔒 ' + (lock.startsWith('Forschung') ? 'Forschung' : lock.replace(' nötig', '')); ccls += ' lock'; }
      else if (it.type === 'extractor') { const t0 = Grid.cost(g, 'extractor', { tier: 0 }); ctext = 'ab ' + Fmt.money(t0); if (t0 > g.run.money && !kit) ccls += ' no'; }
      else if (kit > 0) ctext = 'Gratis';
      else { ctext = Fmt.money(cost) + (it.type === 'belt' || it.type === 'path' || it.type === 'fence' ? '/Feld' : ''); if (cost > g.run.money) ccls += ' no'; }
      card.append(h('div', { class: ccls, text: ctext }));
      const favIdx = App.settings.favorites.indexOf(it.type + ':' + it.grade);
      if (favIdx >= 0) card.append(h('span', { class: 'fav', text: '★' + (favIdx + 1) }));
      if (kit > 0) card.append(h('span', { class: 'kit', text: '×' + kit }));
      card.addEventListener('click', () => {
        if (card._lp) { card._lp = false; return; }
        if (lock) { UI.toast(lock, 'bad'); Audio2.play('error'); $('#bb-hint').textContent = '🔒 ' + lock + '. ' + def.desc; return; }
        Audio2.play('click');
        Build.setTool({ type: it.type, grade: it.grade });
        UI.refreshBuildBar(true);
        $('#bb-hint').textContent = def.desc;
        if (App.touch && window.innerWidth < 900) UI.collapseBuild(true);
      });
      card.addEventListener('contextmenu', e => { e.preventDefault(); UI.toggleFavorite(it.type + ':' + it.grade); });
      let lp = null;
      card.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') lp = setTimeout(() => { lp = null; card._lp = true; UI.cardInfo(it, card, lock); }, 550); });
      card.addEventListener('pointerup', () => { if (lp) clearTimeout(lp); });
      card.addEventListener('pointerleave', () => { if (lp) clearTimeout(lp); });
      card.addEventListener('mouseenter', () => { $('#bb-hint').textContent = (lock ? '🔒 ' + lock + '. ' : '') + def.desc + (it.type === 'belt' ? ' Durchsatz ' + CONFIG.belt.throughput[it.grade] + ' Items/s.' : ''); });
      wrap.append(card);
    }
    $('#tool-select').classList.toggle('hidden', !g.run.research.done.has('massSelect'));
    $('#tool-demolish').classList.toggle('on', App.tool === 'demolish');
    $('#tool-select').classList.toggle('on', App.tool === 'select');
  },
  // Long-press popover for build cards on touch screens.
  cardInfo(it, card, lock) {
    const def = DATA.BUILDINGS[it.type];
    const key = it.type + ':' + it.grade;
    const fav = App.settings.favorites.includes(key);
    const name = it.type === 'belt' ? DATA.BELT_GRADES[it.grade].name : def.name;
    const m = h('div', { class: 'modal small' },
      h('div', { class: 'modal-head' }, h('h2', { text: name }), h('button', { class: 'icon-btn small', 'aria-label': 'Schließen', onclick: () => UI.closeModal() }, '✕')),
      h('div', { class: 'modal-body' },
        Draw.thumb(it.type, 72, { grade: it.grade }),
        h('p', { text: def.desc + (it.type === 'belt' ? ' Durchsatz ' + CONFIG.belt.throughput[it.grade] + ' Items/s.' : '') }),
        h('p', { class: 'muted', text: 'Größe ' + def.w + '×' + def.h + (lock ? ' · ' + lock : '') })),
      h('div', { class: 'modal-foot' },
        h('button', { class: 'btn', onclick: () => { UI.toggleFavorite(key); UI.closeModal(); } }, fav ? '☆ Favorit entfernen' : '★ Als Favorit'),
        lock ? null : h('button', { class: 'btn accent', onclick: () => { UI.closeModal(); card._lp = false; card.click(); } }, 'Auswählen')));
    UI.openModal(m);
  },
  collapseBuild(on) {
    const bar = $('#buildbar');
    bar.classList.toggle('collapsed', !!on);
    if (on) UI.updateMini();
  },
  updateMini() {
    const mini = $('#bb-mini');
    const g = App.g, t = App.tool;
    mini.innerHTML = '';
    if (t && t.type) {
      const name = t.type === 'belt' ? DATA.BELT_GRADES[t.grade].name : DATA.BUILDINGS[t.type].name;
      const cost = t.type === 'extractor' ? Grid.cost(g, 'extractor', { tier: 0 }) : Grid.cost(g, t.type, { grade: t.grade });
      mini.append(Draw.thumb(t.type, 40, { grade: t.grade }), h('span', { text: name }), h('span', { class: 'cost' + (cost > g.run.money ? ' no' : ''), text: (t.type === 'extractor' ? 'ab ' : '') + Fmt.money(cost) }));
    } else mini.append(h('span', { text: t === 'demolish' ? '⌫ Abriss-Modus' : t === 'select' ? '▭ Auswahl' : 'Bauen' }));
    mini.append(h('span', { class: 'up', text: '▲ Auswahl' }));
  },
  toggleFavorite(key) {
    const f = App.settings.favorites;
    const i = f.indexOf(key);
    if (i >= 0) f.splice(i, 1);
    else { if (f.length >= 9) f.shift(); f.push(key); }
    App.saveSettings();
    UI.toast(i >= 0 ? 'Favorit entfernt' : 'Als Favorit ' + f.length + ' gespeichert (Taste ' + f.length + ')');
    UI.refreshBuildBar(true);
  },
  toggleBuild(forceOpen) {
    const bar = $('#buildbar');
    const open = forceOpen === true || (forceOpen === undefined && bar.classList.contains('hidden'));
    if (open) {
      bar.classList.remove('hidden');
      bar.classList.remove('collapsed');
      Build.enter();
      UI.refreshBuildBar(true);
      Tutorial.onEvent('buildOpen');
    } else {
      bar.classList.add('hidden');
      Build.exit();
    }
    Audio2.play('open');
  },
  onModeChange() {
    const build = App.mode === 'build';
    $('#build-actions').classList.toggle('hidden', !build);
    $('#btn-build').classList.toggle('active', build);
    if (!build) $('#buildbar').classList.add('hidden');
    $('#ghost-info').classList.add('hidden');
    UI.updateSelectionBar();
  },
  onToolChange() {
    UI.refreshBuildBar(true);
    if ($('#buildbar').classList.contains('collapsed')) UI.updateMini();
    UI.updateGhostInfo();
    const t = App.tool;
    let hint = '';
    if (t === 'demolish') hint = 'Abriss: Gebäude antippen oder darüber wischen. 70 % Rückerstattung.';
    else if (t === 'select') hint = 'Auswahl: Rechteck aufziehen, dann Abreißen, Verschieben oder Kopieren.';
    else if (t && t.paste) hint = 'Blaupause platzieren. R dreht.';
    else if (t && t.moveGroup) hint = 'Ziel für die Auswahl wählen.';
    else if (t && t.type) hint = DATA.BUILDINGS[t.type].desc;
    if (hint) $('#bb-hint').textContent = hint;
  },
  updateGhostInfo() {
    const el = $('#ghost-info');
    const gh = App.ghost;
    if (!gh || App.mode !== 'build') { el.classList.add('hidden'); return; }
    const g = App.g;
    let html = '';
    if (gh.line) {
      html = '<b>' + gh.count + ' Felder</b> · ' + Fmt.money(gh.cost) + (gh.reason ? ' · <span class="bad">' + esc(gh.reason) + '</span>' : '');
    } else if (gh.spec) {
      const s = gh.spec;
      const name = s.type === 'belt' ? DATA.BELT_GRADES[s.grade || 0].name : DATA.BUILDINGS[s.type].name;
      html = '<b>' + esc(name) + '</b> · ' + (gh.cost === 0 ? 'Gratis' : Fmt.money(gh.cost || 0));
      if (s.type === 'extractor' && gh.dep) {
        const R = DATA.RESOURCES[gh.dep.res];
        const rate = CONFIG.extractRate[gh.dep.tier] * g.mods.extract;
        html += '<br><span style="color:' + DATA.TIERS[gh.dep.tier].color + '">' + esc(R.name) + '</span> · ' + Fmt.num(rate) + '/s · ≈' + Fmt.num(rate * R.value) + ' ' + CURRENCY_SHORT + '/s';
      }
      html += gh.ok ? '' : '<br><span class="bad">' + esc(gh.reason || 'Ungültig') + '</span>';
      if (gh.ok && App.touch) html += '<br><span class="good">Nochmal tippen oder ✓ zum Bauen</span>';
    } else if (gh.list) {
      html = (gh.count !== undefined ? gh.count + ' Objekte · ' : '') + Fmt.money(gh.cost) + (gh.reason ? '<br><span class="bad">' + esc(gh.reason) + '</span>' : '');
    }
    el.innerHTML = html;
    el.classList.remove('hidden');
    let wx, wy;
    if (gh.spec) { const sz = Grid.size(gh.spec.type, gh.spec.rot, gh.spec.len); wx = gh.spec.x + sz.w / 2; wy = gh.spec.y; }
    else if (gh.list && gh.list.length) { const l = gh.list[gh.list.length - 1].spec; wx = l.x + 0.5; wy = l.y; }
    else { el.classList.add('hidden'); return; }
    const [sx, sy] = Render.worldToScreen(wx, wy);
    el.style.left = U.clamp(sx, 80, App.view.w - 80) + 'px';
    el.style.top = U.clamp(sy - 10, 70, App.view.h - 20) + 'px';
  },
  updateSelectionBar() {
    const bar = $('#selection-bar');
    if (!App.selection.length || App.mode !== 'build') { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    bar.innerHTML = '';
    bar.append(h('span', { text: App.selection.length + ' ausgewählt' }));
    bar.append(h('button', { class: 'pill', onclick: () => Build.deleteSelected() }, '⌫ Abreißen'));
    bar.append(h('button', { class: 'pill', onclick: () => Build.startMoveGroup() }, '✥ Verschieben'));
    if (App.g.run.research.done.has('blueprints')) bar.append(h('button', { class: 'pill', onclick: () => Build.copySelection() }, '⧉ Kopieren'));
    bar.append(h('button', { class: 'pill', onclick: () => { App.selection = []; UI.updateSelectionBar(); } }, '✕'));
  },

  // ---------------- actions ----------------
  scan() {
    const g = App.g;
    if (!g) return;
    if (g.run.scanCd > 0) { UI.toast('Scanner lädt noch (' + Math.ceil(g.run.scanCd) + ' s)'); return; }
    const found = Game.scan(g);
    Audio2.play('scan');
    Tutorial.onEvent('scan');
    if (!found) return;
    const now = App.now;
    for (const d of found) Render.edgeMarks.push({ x: d.x + 0.5, y: d.y + 0.5, color: DATA.TIERS[d.tier].color, label: '', at: now });
    if (found.length) {
      const best = found.reduce((a, d) => d.tier > a.tier ? d : a, found[0]);
      UI.toast('Scanner: ' + found.length + ' neue Vorkommen. Bestes: <b style="color:' + DATA.TIERS[best.tier].color + '">' + esc(DATA.RESOURCES[best.res].name) + '</b> (' + DATA.TIERS[best.tier].name + ')', best.tier >= 3 ? 'gold' : 'good');
      if (best.tier >= 3) setTimeout(() => Audio2.play('found'), 700);
    } else UI.toast('Scanner: keine neuen Vorkommen im Umkreis von ' + Math.round(g.mods.scanRadius) + ' Feldern.');
  },
  probe() {
    const g = App.g;
    if (g.run.probeCd > 0) { UI.toast('Sonde lädt noch (' + Fmt.time(g.run.probeCd) + ')'); return; }
    const d = Game.probe(g);
    if (d) { UI.toast('Sonde: <b style="color:' + DATA.TIERS[d.tier].color + '">' + esc(DATA.RESOURCES[d.res].name) + '</b> in ' + Math.round(Math.hypot(d.x - g.run.player.x, d.y - g.run.player.y)) + ' m Entfernung markiert.', 'gold'); Audio2.play('found'); }
    else UI.toast('Sonde: kein unbekanntes episches Vorkommen in Reichweite.');
  },
  fullscreen() {
    const d = document;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        const el = d.documentElement;
        (el.requestFullscreen || el.webkitRequestFullscreen || (() => UI.toast('Vollbild wird nicht unterstützt'))).call(el);
      } else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } catch (e) { UI.toast('Vollbild nicht möglich'); }
  },
  openMap() { MapView.open(); Tutorial.onEvent('map'); },

  // ---------------- modal helpers ----------------
  modalOpen() { return !!UI.modal; },
  openModal(el, opts = {}) {
    UI.closeModal(true);
    const back = h('div', { class: 'modal-back' });
    back.append(el);
    back.addEventListener('pointerdown', e => { if (e.target === back && !opts.sticky) UI.closeModal(); });
    $('#modal-root').append(back);
    UI.modal = { back, onClose: opts.onClose };
    Audio2.play('open');
    return back;
  },
  closeModal(silent) {
    if (!UI.modal) return false;
    const m = UI.modal;
    UI.modal = null;
    m.back.remove();
    if (m.onClose) m.onClose();
    return true;
  },
  closeTopPanel() {
    if (UI.closeModal()) return true;
    if (!$('#info-panel').classList.contains('hidden')) { UI.select(null); return true; }
    return false;
  },
  confirm(title, html, okText, onOk, danger) {
    const m = h('div', { class: 'modal small' },
      h('div', { class: 'modal-head' }, h('h2', { text: title })),
      h('div', { class: 'modal-body', html }),
      h('div', { class: 'modal-foot' },
        h('button', { class: 'btn', onclick: () => UI.closeModal() }, 'Abbrechen'),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'accent'), onclick: () => { UI.closeModal(); onOk(); } }, okText)));
    UI.openModal(m);
  },

  // ---------------- selection / info panel ----------------
  select(b) {
    App.selected = b || null;
    if (b) { Audio2.play('click'); InfoPanel.open(b); Tutorial.onEvent('select', b); }
    else InfoPanel.close();
  },
  refreshInfo(force) { InfoPanel.refresh(force); }
};
