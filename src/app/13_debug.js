// =====================================================================
// Debug: hidden panel (Ctrl+Shift+D or 5 taps on the logo)
// =====================================================================
const Debug = {
  el: null,
  toggle() {
    App.debug.open = !App.debug.open;
    if (App.debug.open) Debug.show(); else if (Debug.el) { Debug.el.remove(); Debug.el = null; }
  },
  show() {
    if (Debug.el) Debug.el.remove();
    const g = App.g;
    const panel = h('div', { class: 'panel', style: { position: 'fixed', left: '10px', top: '90px', width: 'min(360px, calc(100% - 20px))', maxHeight: 'calc(100% - 110px)', overflowY: 'auto', padding: '12px', zIndex: 80, fontSize: '13px', pointerEvents: 'auto' } });
    Debug.el = panel;
    const row = (...k) => h('div', { class: 'ip-actions', style: { paddingTop: '6px' } }, ...k);
    const btn = (t, f) => h('button', { class: 'pill', onclick: () => { try { f(); } catch (e) { UI.toast('Fehler: ' + esc(e.message), 'bad'); } } }, t);
    panel.append(h('div', { style: { display: 'flex', alignItems: 'center' } }, h('b', { text: '🛠 Debug', style: { flex: 1, fontSize: '15px' } }), h('button', { class: 'icon-btn small', onclick: () => Debug.toggle() }, '✕')));
    panel.append(h('div', { id: 'dbg-stats', class: 'muted', style: { margin: '6px 0' } }));
    if (!g) { panel.append(h('p', { text: 'Kein Spiel geladen.' })); document.body.append(panel); return; }
    panel.append(h('b', { text: 'Zeitraffer' }));
    panel.append(row(...[1, 10, 100, 1000].map(s => { const b = btn('×' + s, () => { App.timeScale = s; Debug.show(); }); if (App.timeScale === s) b.classList.add('on'); return b; })));
    panel.append(h('b', { text: 'Ressourcen' }));
    panel.append(row(btn('+1.000 ET', () => Economy.earn(g, 1000)), btn('+1 Mio ET', () => Economy.earn(g, 1e6)), btn('Geld ×10', () => { g.run.money = Math.max(1000, g.run.money * 10); }), btn('+10 RP', () => { g.meta.rp += 10; g.meta.rpTotal += 10; Progression.computeMods(g); })));
    const tierSel = h('select', { class: 'sel' });
    for (let t = 0; t < 6; t++) tierSel.append(h('option', { value: t }, 'Kundenstufe ' + (t + 1)));
    tierSel.value = g.run.custTier;
    tierSel.addEventListener('change', () => { g.run.custTier = +tierSel.value; UI.refreshBuildBar(true); });
    panel.append(row(tierSel, btn('Alles erforschen', () => { for (const r of DATA.RESEARCH) g.run.research.done.add(r.id); Progression.computeMods(g); g.topologyDirty = true; UI.refreshBuildBar(true); })));
    panel.append(h('b', { text: 'Welt' }));
    panel.append(row(btn('Seed neu würfeln', () => { g.meta.baseSeed = RNG.newSeed(); const g2 = Game.create(g.meta, g.run.planet); MainLoop.start(g2, { fresh: true }); Debug.show(); }),
      btn((App.debug.chunkBorders ? '☑' : '☐') + ' Chunk-Grenzen', () => { App.debug.chunkBorders = !App.debug.chunkBorders; Debug.show(); }),
      btn((App.debug.hitboxes ? '☑' : '☐') + ' Hitboxen & Sortierung', () => { App.debug.hitboxes = !App.debug.hitboxes; Debug.show(); }),
      btn((App.debug.wallhack ? '☑' : '☐') + ' Alle Vorkommen', () => { App.debug.wallhack = !App.debug.wallhack; if (App.debug.wallhack) { const p = g.run.player; for (const d of World.depositsInRadius(g.world, p.x, p.y, 200)) g.world.known.add(d.id); World.discover(g.world, p.x, p.y, 200); } Debug.show(); })));
    panel.append(h('b', { text: 'Ereignisse' }));
    panel.append(row(btn('Positives Event', () => { if (!Economy.spawnEvent(g, true)) UI.toast('Erst etwas produzieren'); }), btn('Negatives Event', () => { if (!Economy.spawnEvent(g, false)) UI.toast('Erst etwas produzieren'); }), btn('Vertrag', () => { const c = Customers.makeContract(g); if (c) { g.run.contracts.push(c); g.events.push({ type: 'contractNew', c }); } })));
    const hrs = h('input', { type: 'number', min: 0.02, max: 24, step: 0.5, value: 2, style: { width: '80px', minHeight: '40px', borderRadius: '10px', background: '#241c2a', color: 'var(--text)', border: '1px solid var(--line-strong)', padding: '4px 8px' }, 'aria-label': 'Stunden' });
    panel.append(h('b', { text: 'Offline-Test' }));
    panel.append(row(hrs, btn('Offline simulieren', () => { MainLoop.offlineFor(Math.max(0, +hrs.value) * 3600); })));
    panel.append(h('b', { text: 'Balancing & Tests' }));
    const out = h('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '12px', background: '#0f0b12', padding: '8px', borderRadius: '10px', maxHeight: '260px', overflow: 'auto', userSelect: 'text' } }, 'Bereit.');
    panel.append(row(btn('Balancing-Report', () => Debug.balance(out)), btn('Selbsttests', () => Debug.selftest(out))));
    panel.append(out);
    document.body.append(panel);
    Debug.updateStats();
  },
  updateStats() {
    const el = $('#dbg-stats');
    if (!el || !App.g) return;
    const g = App.g;
    let items = 0;
    for (const b of g.buildings.values()) { if (b.items) items += b.items.length; if (b.queue) items += b.queue.length; }
    el.textContent = 'FPS ' + App.debug.fps.toFixed(0) + ' · Frame ' + App.debug.frameMs.toFixed(1) + ' ms · Sim ' + (App.debug.simMs || 0).toFixed(2) + ' ms · Gebäude ' + g.buildings.size + ' · Items ' + items + ' · Partikel ' + Render.particles.length + ' · Chunks ' + Render.chunks.size + ' · Qualität ' + App.quality + ' · Tick ' + g.tick;
  },
  balance(out) {
    out.textContent = 'Simulation läuft … (greedy Bot, Planet 1). Das Spiel pausiert währenddessen.';
    // the report runs at 10 ticks/s for speed; the live game is paused meanwhile
    const prevRate = CONFIG.tickRate;
    App.running = false;
    CONFIG.tickRate = 10;
    const it = Bot.runIter({ maxHours: 6, seed: RNG.newSeed() % 100000 });
    const finish = () => { CONFIG.tickRate = prevRate; App.running = true; MainLoop.last = 0; };
    const step = () => {
      const t0 = performance.now();
      let r;
      while (performance.now() - t0 < 40) { r = it.next(); if (r.done) break; }
      if (r && r.done) { finish(); out.textContent = Bot.format(r.value); return; }
      if (!Debug.el) { finish(); return; }
      if (r && r.value) out.textContent = 'Simulation läuft … ' + Fmt.duration(r.value.time) + ' Spielzeit, ' + Fmt.money(r.value.earned);
      setTimeout(step, 0);
    };
    step();
  },
  selftest(out) {
    out.textContent = 'Tests laufen …';
    setTimeout(() => {
      const res = SelfTest.run();
      out.textContent = res.map(r => (r.ok ? '✔ ' : '✘ ') + r.name + (r.info ? ' – ' + r.info : '')).join('\n');
    }, 20);
  }
};
