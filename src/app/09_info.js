// =====================================================================
// InfoPanel: details and actions for the selected building
// =====================================================================
const IconCache = new Map();
const itemImg = (res, ref, size = 20) => {
  const key = res * 4 + ref + '|' + size;
  let url = IconCache.get(key);
  if (!url) { url = Sprites.itemCanvas(res, ref, size).toDataURL(); IconCache.set(key, url); }
  return '<img src="' + url + '" width="' + size + '" height="' + size + '" alt="">';
};
const STATUS_TEXT = { blocked: ['Blockiert: Ausgang voll', 'bad'], nocon: ['Kein Ausgang angeschlossen', 'bad'], full: ['Lager voll', 'bad'], nearfull: ['Lager fast voll', 'warn'], wrong: ['Falsche Veredelungsstufe am Eingang', 'warn'], empty: ['Kunden warten, Regal leer', 'warn'] };
const DIR_NAMES = ['Osten', 'Süden', 'Westen', 'Norden'];

const InfoPanel = {
  b: null, lastRefresh: 0,

  open(b) {
    InfoPanel.b = b;
    const el = $('#info-panel');
    el.classList.remove('hidden');
    InfoPanel.build();
  },
  close() {
    InfoPanel.b = null;
    $('#info-panel').classList.add('hidden');
  },
  name(b) { return b.type === 'belt' ? DATA.BELT_GRADES[b.grade].name : DATA.BUILDINGS[b.type].name; },

  build() {
    const b = InfoPanel.b, g = App.g;
    if (!b || !g.buildings.has(b.id)) { UI.select(null); return; }
    const el = $('#info-panel');
    el.innerHTML = '';
    const head = h('div', { class: 'ip-head' });
    head.append(Draw.thumb(b.type, 48, { grade: b.grade, res: b.res }));
    head.append(h('div', null, h('div', { class: 'ip-title', text: InfoPanel.name(b) }), h('div', { class: 'ip-sub', id: 'ip-sub' })));
    head.append(h('button', { class: 'icon-btn small ip-close', 'aria-label': 'Schließen', onclick: () => UI.select(null) }, '✕'));
    el.append(head);
    el.append(h('div', { id: 'ip-dyn' }));
    el.append(InfoPanel.controls(b));
    el.append(InfoPanel.actions(b));
    InfoPanel.refresh(true);
  },

  refresh(force) {
    const b = InfoPanel.b, g = App.g;
    if (!b) return;
    if (!g.buildings.has(b.id)) { UI.select(null); return; }
    const now = performance.now();
    if (!force && now - InfoPanel.lastRefresh < 400) return;
    InfoPanel.lastRefresh = now;
    const dyn = $('#ip-dyn');
    if (!dyn) return;
    const lvl = b.type === 'belt' ? 'Güteklasse ' + (b.grade + 1) + '/4' : 'Stufe ' + ROMAN[b.level] + ' / ' + ROMAN[Grid.maxLevel(g, b)];
    const st = b.warn ? STATUS_TEXT[b.warn] : null;
    $('#ip-sub').innerHTML = lvl + ' · ' + (st ? '<span class="tag ' + st[1] + '">' + st[0] + '</span>' : '<span class="tag good">OK</span>');
    dyn.innerHTML = InfoPanel.details(b, g);
    const sp = dyn.querySelector('canvas.spark');
    if (sp) InfoPanel.sparkline(sp, +sp.dataset.res);
    const key = b.level + '|' + (b.grade || 0) + '|' + (Grid.upgradeCost(g, b) <= g.run.money) + '|' + Grid.upgradeBlock(g, b) + '|' + Math.floor(b.paid);
    if (force || key !== InfoPanel.actKey) { InfoPanel.actKey = key; InfoPanel.updateActions(b); }
  },

  row: (k, v) => '<div class="ip-row"><span>' + k + '</span><b>' + v + '</b></div>',
  bonusList(b) {
    if (!b.bonusSrc || !b.bonusSrc.length) return '<div class="muted" style="font-size:13px">Keine Nachbarschaftsboni. Tipp: passende Gebäude angrenzend platzieren.</div>';
    return '<ul class="bonus-list">' + b.bonusSrc.map(s => '<li><span>' + esc(s.name) + '</span><b>+' + Math.round(s.v * 100) + ' %</b></li>').join('') + '</ul>';
  },
  stockList(map, limit = 12) {
    const arr = [...map.entries()].filter(e => e[1] > 0).sort((a, c) => c[1] - a[1]).slice(0, limit);
    if (!arr.length) return '<div class="muted" style="font-size:13px">Leer</div>';
    return '<div class="stock-list">' + arr.map(([k, c]) => '<div class="stock-item">' + itemImg(k >> 2, k & 3) + '<span>' + esc(DATA.itemName(k >> 2, k & 3)) + '</span><b>' + Fmt.int(c) + '</b></div>').join('') + '</div>';
  },
  trend(g, res) {
    const t = Economy.demandTrend(g, res);
    const col = t.cls === 'up' ? 'var(--good)' : t.cls === 'down' ? 'var(--bad)' : 'var(--text)';
    return '<b style="color:' + col + '">' + t.arrow + ' ×' + Fmt.dec(t.now, 2) + '</b>';
  },

  details(b, g) {
    const R = InfoPanel.row;
    let s = '';
    switch (b.type) {
      case 'extractor': {
        const res = DATA.RESOURCES[b.res];
        const d = World.depositById(g.world, b.dep);
        const value = b.rate * res.value * g.mods.sales;
        s += '<div class="ip-section">' + R('Rohstoff', itemImg(b.res, 0) + ' <span style="color:' + DATA.TIERS[res.tier].color + '">' + esc(res.name) + '</span>');
        s += R('Seltenheit', DATA.TIERS[res.tier].name) + R('Abbau', Fmt.num(b.rate) + ' /s') + R('Rohwert', '≈ ' + Fmt.num(value) + ' ' + CURRENCY_SHORT + '/s');
        if (d) s += R('Vorkommen', ['klein', 'mittel', 'groß'][d.sizeClass] + ' · ' + (g.depUse.get(d.id) || 0) + '/' + d.slots + ' Plätze');
        s += R('Puffer', b.buf.length + '/' + CONFIG.maxItemsPerBuffer) + R('Abgebaut', Fmt.int(b.made)) + R('Marktpreis', InfoPanel.trend(g, b.res)) + '</div>';
        s += '<div class="ip-section"><b>Bonus-Quellen</b>' + InfoPanel.bonusList(b) + '</div>';
        s += '<div class="ip-section"><canvas class="spark" data-res="' + b.res + '"></canvas><div class="muted" style="font-size:12px">Preisverlauf der letzten 10 Minuten</div></div>';
        break;
      }
      case 'belt': {
        const tp = CONFIG.belt.throughput[b.grade] * g.mods.beltSpeed * b.boost;
        s += '<div class="ip-section">' + R('Durchsatz', Fmt.num(tp) + ' Items/s') + R('Items auf dem Feld', b.items.length) + R('Richtung', DIR_NAMES[b.rot]);
        if (b.boost > 1) s += R('Ladestation', '+' + Math.round((b.boost - 1) * 100) + ' %');
        s += R('Bänder gesamt', Fmt.int(g.run.counts.belt || 0)) + '</div>';
        break;
      }
      case 'splitter': case 'merger': case 'crossing': case 'osplitter': case 'fsplitter':
        s += '<div class="ip-section"><div class="muted" style="font-size:13px">' + esc(DATA.BUILDINGS[b.type].desc) + '</div>' + R('Richtung', DIR_NAMES[b.rot]) + '</div>';
        break;
      case 'bridge':
        s += '<div class="ip-section">' + R('Länge', (b.len - 2) + ' übersprungene Felder') + R('Items unterwegs', b.queue.length) + '</div>';
        break;
      case 'silo': {
        const cap = Economy.siloCap(g, b);
        s += '<div class="ip-section">' + R('Füllstand', Fmt.int(b.total) + ' / ' + Fmt.int(cap)) + '<div class="progress"><i style="width:' + U.clamp(b.total / cap * 100, 0, 100) + '%"></i></div></div>';
        s += '<div class="ip-section"><b>Inhalt</b>' + InfoPanel.stockList(b.store) + '</div>';
        break;
      }
      case 'lab': {
        const a = g.run.research.active;
        s += '<div class="ip-section">' + R('Forschungstempo', '×' + Fmt.dec(Math.pow(1.3, b.level - 1), 2)) + R('Labore gesamt', g.lists.lab.length);
        if (a) { const r = DATA.RESEARCH_BY_ID[a.id]; s += R('Aktiv', esc(r.name)) + '<div class="progress"><i style="width:' + (a.prog * 100).toFixed(1) + '%"></i></div>'; }
        else s += '<div class="muted" style="font-size:13px">Keine Forschung aktiv.</div>';
        s += R('Erforscht', g.run.research.done.size + ' / ' + DATA.RESEARCH.length) + '</div>';
        break;
      }
      case 'cooler': case 'servo': case 'charger': {
        const n = [...Grid.neighbors(g, b)].filter(o => b.type === 'cooler' ? REFINERY_LEVEL[o.type] : b.type === 'servo' ? (o.type === 'extractor' || REFINERY_LEVEL[o.type]) : o.type === 'belt');
        s += '<div class="ip-section">' + R('Wirkt auf', n.length + ' angrenzende Objekte') + R('Bonus', '+' + Math.round((b.type === 'cooler' ? CONFIG.coolerBonus : b.type === 'servo' ? CONFIG.servoBonus : CONFIG.chargerBonus) * (1 + 0.2 * (b.level - 1)) * 100) + ' %') + '</div>';
        break;
      }
      default:
        if (REFINERY_LEVEL[b.type]) {
          const lv = REFINERY_LEVEL[b.type];
          s += '<div class="ip-section">' + R('Nimmt an', DATA.REFINE_NAMES[lv - 1] + 'e Items') + R('Erzeugt', DATA.REFINE_NAMES[lv] + ' (×' + CONFIG.refineFactor[lv] + ' Wert)') + R('Tempo', Fmt.num(b.rate) + ' Items/s') + R('Eingang', b.inBuf.length + '/' + CONFIG.refineBuffer) + R('Veredelt', Fmt.int(b.made));
          if (b.cur) s += R('In Arbeit', itemImg(b.cur.res, b.cur.ref) + ' ' + esc(DATA.RESOURCES[b.cur.res].name));
          s += '</div><div class="ip-section"><b>Bonus-Quellen</b>' + InfoPanel.bonusList(b) + '</div>';
        } else if (SELLER_TIER[b.type] !== undefined) {
          s += InfoPanel.sellerDetails(b, g);
        } else {
          s += '<div class="ip-section muted" style="font-size:13px">' + esc(DATA.BUILDINGS[b.type].desc) + '</div>';
        }
    }
    return s;
  },

  sellerDetails(b, g) {
    const R = InfoPanel.row;
    const t = SELLER_TIER[b.type];
    let s = '<div class="ip-section">';
    if (t < 5) {
      const iv = CONFIG.customers[t].interval;
      const am = Economy.arrivalMult(g, b);
      s += R('Kunden', esc(DATA.CUSTOMERS[t].plural)) + R('Ankunft', 'alle ' + Fmt.dec(iv[0] / am, 0) + '–' + Fmt.dec(iv[1] / am, 0) + ' s') + R('Erlösfaktor', '×' + Fmt.dec(CONFIG.customers[t].factor, 1));
    } else s += R('Erlösfaktor', '×20 (stabile Preise)');
    s += R('Abfertigung', Fmt.num(Economy.serviceRate(g, b)) + ' Items/s') + R('Regal', Fmt.int(b.shelfTotal) + ' / ' + Fmt.int(Economy.shelfCap(g, b))) + R('Verkauft', Fmt.int(b.sold)) + '</div>';
    if (t < 5) {
      s += '<div class="ip-section"><b>Kunden vor Ort</b><div class="cust-list">';
      const active = b.customers.filter(c => c.state !== 'out');
      if (!active.length) s += '<div class="muted" style="font-size:13px">Gerade niemand da. Nächster Kunde in ca. ' + Math.max(0, Math.ceil(b.timer / Economy.arrivalMult(g, b))) + ' s.</div>';
      for (const c of active) {
        s += '<div class="cust"><div>' + esc(DATA.CUSTOMERS[c.tier].name) + (c.state === 'in' ? ' (kommt an)' : '') + '</div>';
        for (const w of c.wishes) {
          const label = w.res >= 0 ? DATA.itemName(w.res, w.ref) : (w.explore ? 'Ich suche etwas ' + DATA.TIERS[w.tier].name + 'es…' : 'Beliebig ' + DATA.TIERS[w.tier].name + (w.ref ? ' (' + DATA.REFINE_NAMES[w.ref] + ')' : ''));
          s += '<div class="wish">' + (w.res >= 0 ? itemImg(w.res, w.ref, 18) : '<span class="tag" style="color:' + DATA.TIERS[w.tier].color + '">?</span>') + '<span>' + esc(label) + '</span><b style="margin-left:auto">' + Fmt.int(w.got) + '/' + Fmt.int(w.qty) + '</b></div>';
        }
        if (c.state === 'wait') s += '<div class="pbar"><i style="width:' + (U.clamp(1 - c.t / c.patience, 0, 1) * 100).toFixed(0) + '%"></i></div>';
        s += '</div>';
      }
      s += '</div></div>';
    } else {
      s += '<div class="ip-section"><b>Planeten-Verträge</b><div class="cust-list">';
      if (!g.run.contracts.length) s += '<div class="muted" style="font-size:13px">Neue Aufträge folgen in ca. ' + Fmt.time(g.run.contractTimer) + '.</div>';
      for (const c of g.run.contracts) {
        s += '<div class="cust"><div><b>' + esc(c.planet) + '</b> · noch ' + Fmt.time(c.end - g.run.time) + '</div>';
        for (const r of c.req) s += '<div class="wish">' + itemImg(r.res, r.ref, 18) + '<span>' + esc(DATA.itemName(r.res, r.ref)) + '</span><b style="margin-left:auto">' + Fmt.int(r.got) + '/' + Fmt.int(r.qty) + '</b></div>';
        const tot = c.req.reduce((a, r) => a + r.qty, 0), got = c.req.reduce((a, r) => a + r.got, 0);
        s += '<div class="pbar"><i style="width:' + (got / tot * 100).toFixed(1) + '%"></i></div></div>';
      }
      s += '</div></div>';
    }
    s += '<div class="ip-section"><b>Regal</b>' + InfoPanel.stockList(b.shelf, 8) + '</div>';
    if (b.shelf.size) {
      s += '<div class="ip-section"><b>Nachfrage</b>';
      for (const k of [...b.shelf.keys()].slice(0, 4)) s += R(itemImg(k >> 2, 0, 16) + ' ' + esc(DATA.RESOURCES[k >> 2].name), InfoPanel.trend(g, k >> 2));
      s += '<canvas class="spark" data-res="' + ([...b.shelf.keys()][0] >> 2) + '"></canvas></div>';
    }
    s += '<div class="ip-section"><b>Bonus-Quellen</b>' + InfoPanel.bonusList(b) + '</div>';
    return s;
  },

  sparkline(cv, res) {
    const g = App.g;
    const d = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 300, hh = 48;
    cv.width = w * d; cv.height = hh * d;
    const x = cv.getContext('2d');
    x.scale(d, d);
    const hist = Economy.history(g, res);
    const now = Economy.demandTrend(g, res).now;
    hist.push(now);
    x.strokeStyle = 'rgba(255,255,255,.15)'; x.lineWidth = 1;
    const yOf = v => hh - 4 - (U.clamp(v, 0, 2.6) / 2.6) * (hh - 8);
    x.beginPath(); x.moveTo(0, yOf(1)); x.lineTo(w, yOf(1)); x.stroke();
    if (hist.length < 2) return;
    x.strokeStyle = now > 1.15 ? '#63df74' : now < 0.85 ? '#ff6464' : '#ffc24d'; x.lineWidth = 2;
    x.beginPath();
    hist.forEach((v, i) => { const px = i / (hist.length - 1) * (w - 2) + 1; i ? x.lineTo(px, yOf(v)) : x.moveTo(px, yOf(v)); });
    x.stroke();
  },

  // Static controls (filters, outputs)
  controls(b) {
    const g = App.g;
    const wrap = h('div');
    if (b.type === 'extractor') {
      const sec = h('div', { class: 'ip-section' }, h('b', { text: 'Ausgänge' }));
      const seg = h('div', { class: 'seg' });
      ['Osten', 'Süden', 'Westen', 'Norden'].forEach((n, d) => {
        const btn = h('button', { class: (b.outMask & (1 << d)) ? 'on' : '' }, n);
        btn.addEventListener('click', () => { b.outMask ^= (1 << d); if (!b.outMask) b.outMask = 1 << d; g.topologyDirty = true; btn.classList.toggle('on', !!(b.outMask & (1 << d))); Audio2.play('click'); });
        seg.append(btn);
      });
      sec.append(seg);
      wrap.append(sec);
    }
    if (b.type === 'fsplitter') wrap.append(InfoPanel.filterControl(b, 'filter', 'Filter (geradeaus)'));
    if (b.type === 'silo') {
      const sec = h('div', { class: 'ip-section' });
      const sw = h('div', { class: 'switch' + (b.outEnabled ? ' on' : ''), role: 'switch', tabindex: 0 });
      sw.addEventListener('click', () => { b.outEnabled = !b.outEnabled; sw.classList.toggle('on', b.outEnabled); g.topologyDirty = true; Audio2.play('click'); });
      sec.append(h('div', { class: 'set-row' }, h('label', null, 'Ausgang aktiv', h('small', { text: 'Gibt gelagerte Items vorne (Pfeil) aufs Band.' })), sw));
      wrap.append(sec);
      wrap.append(InfoPanel.filterControl(b, 'outFilter', 'Ausgangsfilter'));
    }
    return wrap;
  },
  filterControl(b, prop, label) {
    const g = App.g;
    const sec = h('div', { class: 'ip-section' }, h('b', { text: label }));
    const sel = h('select', { class: 'sel' });
    sel.append(h('option', { value: '' }, 'Alles'));
    for (let t = 0; t < 8; t++) sel.append(h('option', { value: 'tier:' + t }, 'Stufe: ' + DATA.TIERS[t].name));
    for (let r = 0; r < 4; r++) sel.append(h('option', { value: 'ref:' + r }, 'Veredelung: ' + DATA.REFINE_NAMES[r]));
    const known = [...new Set([...g.run.produced].map(k => k >> 2))].sort((a, c) => a - c);
    for (const r of known) sel.append(h('option', { value: 'res:' + r }, 'Rohstoff: ' + DATA.RESOURCES[r].name));
    const f = b[prop];
    sel.value = f ? f.kind + ':' + (f.kind === 'res' ? f.res : f.kind === 'tier' ? f.tier : f.ref) : '';
    sel.addEventListener('change', () => {
      const v = sel.value;
      if (!v) b[prop] = null;
      else { const [kind, n] = v.split(':'); b[prop] = kind === 'res' ? { kind, res: +n } : kind === 'tier' ? { kind, tier: +n } : { kind, ref: +n }; }
      Audio2.play('click');
    });
    sec.append(sel);
    return sec;
  },

  actions(b) {
    const wrap = h('div', { class: 'ip-section ip-actions', id: 'ip-actions' });
    return wrap;
  },
  upgradeEffect(b, g) {
    if (b.type === 'extractor') return Fmt.num(b.rate) + ' → ' + Fmt.num(b.rate * CONFIG.extractorLevelSpeed) + ' /s';
    if (b.type === 'belt') return CONFIG.belt.throughput[b.grade] + ' → ' + CONFIG.belt.throughput[Math.min(3, b.grade + 1)] + ' Items/s';
    if (b.type === 'silo') return Fmt.int(Economy.siloCap(g, b)) + ' → ' + Fmt.int(Economy.siloCap(g, b) * CONFIG.siloLevelCapacity) + ' Plätze';
    if (REFINERY_LEVEL[b.type]) return Fmt.num(b.rate) + ' → ' + Fmt.num(b.rate * 1.25) + ' /s';
    if (SELLER_TIER[b.type] !== undefined) return 'Regal ×1,5 · Abfertigung ×1,3 · Kunden +' + Math.round((CONFIG.sellerLevelArrival - 1) * 100) + ' %';
    if (b.type === 'lab') return 'Forschung ×1,3';
    if (BOOSTER[b.type]) return 'Bonus +20 %';
    return 'Neue Optik';
  },
  updateActions(b) {
    const g = App.g;
    const wrap = $('#ip-actions');
    if (!wrap) return;
    wrap.innerHTML = '';
    const block = Grid.upgradeBlock(g, b);
    const cost = Grid.upgradeCost(g, b);
    const up = h('button', { class: 'btn accent' }, block ? block : 'Upgrade · ' + Fmt.money(cost));
    if (block || cost > g.run.money) up.disabled = true;
    up.title = block || InfoPanel.upgradeEffect(b, g);
    up.addEventListener('click', () => {
      const c = Grid.upgradeCost(g, b);
      if (Grid.upgrade(g, b)) {
        Actions.record(g, { kind: 'upgrade', id: b.id, cost: c });
        Audio2.play('upgrade');
        Render.float('Stufe ' + (b.type === 'belt' ? b.grade + 1 : ROMAN[b.level]), b.x + b.w / 2, b.y, '#ffd24a');
        if (!App.settings.reducedFx) for (let i = 0; i < 16; i++) Render.spawn('spark', b.x + Math.random() * b.w, b.y + Math.random() * b.h, (Math.random() - 0.5) * 2, -Math.random() * 2, 0.8, '#ffd24a', 0.07);
        if (b.type === 'extractor' && b.level >= 10) Progression.unlock(g, 'maxLevel');
        InfoPanel.refresh(true);
      } else { Audio2.play('error'); UI.toast(Grid.upgradeBlock(g, b) || 'Zu teuer', 'bad'); }
    });
    wrap.append(up);
    if (!block) wrap.append(h('div', { class: 'muted', style: { width: '100%', fontSize: '12px' }, text: 'Upgrade: ' + InfoPanel.upgradeEffect(b, g) }));
    if (b.type !== 'bridge') wrap.append(h('button', { class: 'btn', onclick: () => Build.rotate() }, '⟳ Drehen'));
    wrap.append(h('button', { class: 'btn', onclick: () => { Build.enter(); App.selection = [b]; Build.startMoveGroup(); } }, '✥ Verschieben (' + Fmt.money(Grid.moveFee(g, b)) + ')'));
    const refund = b.paid * CONFIG.refundRate;
    wrap.append(h('button', { class: 'btn danger', onclick: () => {
      const doIt = () => { const r = Actions.removeMany(g, [b]); Build.afterRemove([b], r); };
      if (b.paid > 1000 || SELLER_TIER[b.type] !== undefined) UI.confirm('Abreißen?', esc(InfoPanel.name(b)) + ' abreißen und ' + Fmt.money(refund) + ' (70 %) zurückerhalten? Gelagerte Items gehen verloren.', 'Abreißen', doIt, true);
      else doIt();
    } }, '⌫ Abreißen (+' + Fmt.money(refund) + ')'));
    if (b.type === 'lab') wrap.append(h('button', { class: 'btn', onclick: () => Menus.open('research') }, '⚗ Forschung öffnen'));
    if (g.run.research.done.has('fasttravel')) wrap.append(h('button', { class: 'btn', onclick: () => MainLoop.teleport(b.x + b.w / 2, b.y + b.h + 1) }, '⇢ Hierher teleportieren'));
  }
};
