// =====================================================================
// MainLoop: boot, title, game start, fixed-step loop, saving, offline, events
// =====================================================================
const MainLoop = {
  acc: 0, last: 0, catchup: 0, fpsT: 0, fpsN: 0, lowFor: 0, saveTimer: 0, hiddenAt: 0,
  step: 1 / CONFIG.tickRate,

  boot() {
    App.loadSettings();
    App.touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    document.body.classList.toggle('touch', App.touch);
    Render.init($('#game'));
    Input.init();
    UI.init();
    window.addEventListener('resize', () => { Render.resize(); });
    window.addEventListener('orientationchange', () => setTimeout(Render.resize, 200));
    document.addEventListener('visibilitychange', MainLoop.onVisibility);
    window.addEventListener('pagehide', () => MainLoop.save(false));
    window.addEventListener('beforeunload', () => MainLoop.save(false));
    $('#title-name').textContent = GAME_TITLE;
    document.title = GAME_TITLE;
    $('#title-version').textContent = 'Version ' + GAME_VERSION + ' · ' + CURRENCY_NAME;
    if (!Save.storage()) UI.toast('Hinweis: Speichern ist in diesem Browser nicht möglich. Du kannst trotzdem spielen.', 'bad', 6000);
    const hasSave = !!(Save.read(Save.KEY) || Save.read(Save.BACKUP));
    // exactly one primary action: "Weiterspielen" with a save, otherwise "Neues Spiel"
    $('#btn-continue').classList.toggle('hidden', !hasSave);
    $('#btn-new').classList.toggle('primary', !hasSave); $('#btn-new').classList.toggle('ghost', hasSave);
    $('#btn-continue').onclick = () => { Audio2.start(); MainLoop.continueGame(); };
    $('#btn-new').onclick = () => {
      Audio2.start();
      if (hasSave) UI.confirm('Neues Spiel?', 'Dein bisheriger Spielstand wird überschrieben (ein Backup bleibt erhalten, bis du erneut speicherst).', 'Neues Spiel', MainLoop.newGame, true);
      else MainLoop.newGame();
    };
    $('#btn-title-settings').onclick = () => MainLoop.titleSettings();
    requestAnimationFrame(MainLoop.frame);
    // debug: ?intro=force plays the intro in a throw-away game (nothing is saved), ?intro=t:5.5 seeks and holds
    const dbg = Intro.debugParam();
    if (dbg) {
      MainLoop.noSave = true;
      const sm = /[?&]seed=(\d+)/.exec(location.search);
      const meta = Game.createMeta(sm ? +sm[1] : undefined), g = Game.create(meta, 1);
      TitleScene.start();
      const go = () => { const m = /^t:([\d.]+)/.exec(dbg); Intro.begin(g, m ? { seek: +m[1], freeze: true } : {}); };
      setTimeout(go, 60);
      return;
    }
    TitleScene.start();
  },

  titleSettings() {
    const m = h('div', { class: 'modal small' }, h('div', { class: 'modal-head' }, h('h2', { text: 'Einstellungen' }), h('button', { class: 'icon-btn small', onclick: () => UI.closeModal() }, '✕')));
    const body = h('div', { class: 'modal-body' });
    m.append(body);
    UI.openModal(m);
    const fakeBody = body;
    const prevG = App.g;
    if (!prevG) {
      // settings that do not need a running game
      const s = App.settings;
      const mk = (label, key) => { const el = h('div', { class: 'switch' + (s[key] ? ' on' : '') }); el.onclick = () => { s[key] = !s[key]; el.classList.toggle('on', s[key]); App.saveSettings(); }; fakeBody.append(h('div', { class: 'set-row' }, h('label', { text: label }), el)); };
      mk('Ton an', 'sound'); mk('Reduzierte Effekte', 'reducedFx'); mk('Tag/Nacht-Zyklus', 'dayNight'); mk('Wetter', 'weather');
      const io = h('textarea', { class: 'io', placeholder: 'Exportierten Spielstand hier einfügen …' });
      fakeBody.append(h('h3', { text: 'Spielstand importieren' }), io, h('div', { class: 'ip-actions' }, h('button', { class: 'btn accent', onclick: () => MainLoop.importSave(io.value) }, 'Importieren')));
    }
  },

  newGame() {
    if (MainLoop.starting) return;
    MainLoop.starting = true;
    UI.closeModal();
    const meta = Game.createMeta();
    const g = Game.create(meta, 1);
    // the cinematic starts from the title frame (push within the same frame as the click)
    Intro.begin(g);
  },
  // handover after the intro: music, first save (without a toast for 30 s), then the lucky reveal
  afterIntro(g) {
    Audio2.setPlanet(g.run.planet);
    MainLoop.quietUntil = performance.now() + 30000;
    g.run.startShown = true;
    MainLoop.save(true);
    setTimeout(() => { if (App.g === g) Intro.reveal(g); }, 250);
  },
  continueGame() {
    const loaded = Save.load();
    if (!loaded) { UI.toast('Spielstand konnte nicht geladen werden. Starte ein neues Spiel.', 'bad', 5000); MainLoop.newGame(); return; }
    MainLoop.hideTitle();
    if (loaded.fromBackup) UI.toast('Hauptspeicher beschädigt, Backup geladen.', 'bad', 5000);
    MainLoop.start(loaded.game, { camera: loaded.camera });
    const now = Date.now();
    const gap = (now - loaded.lastSeen) / 1000;
    if (gap > CONFIG.offlineMin) MainLoop.offlineFor(gap);
    else if (gap > 0) MainLoop.catchup += gap;
  },
  hideTitle() { $('#screen-title').classList.add('hidden'); TitleScene.stop(); TitleScene.release(); },

  start(g, opts = {}) {
    App.g = g;
    Items.live = 0;
    UI.select(null);
    Build.exit();
    App.blueprint = null;
    Render.setPlanet(g.world.planet, g.world.seed);
    Collide.extra = g.run.lander ? [LanderArt.hitbox(g.run.lander.x, g.run.lander.y)] : [];
    Intro.rv = null;
    MapView.cellCache.clear();
    Render.particles.length = 0; Render.floating.length = 0; Render.edgeMarks.length = 0;
    App.cam.x = g.run.player.x; App.cam.y = g.run.player.y; App.cam.follow = true;
    App.cam.zoom = opts.camera && opts.camera.zoom ? U.clamp(opts.camera.zoom, CONFIG.zoomMin, CONFIG.zoomMax) : CONFIG.zoomDefault;
    UI.moneyShown = g.run.money;
    UI.updateCenterBtn();
    App.running = true;
    MainLoop.acc = 0; MainLoop.last = 0;
    $('#planet-name').textContent = g.world.planet.name;
    Tutorial.active = false;
    if (opts.intro) return;
    Audio2.setPlanet(g.run.planet);
    // queue: lucky reveal -> card -> tutorial (0.8 s after the card); never two overlays at once
    if (!g.run.startShown) { g.run.startShown = true; setTimeout(() => { if (App.g === g) Intro.reveal(g); }, opts.fresh ? 700 : 400); }
    else if (!g.meta.tutorial.done) setTimeout(() => { if (App.g === g) Tutorial.start(); }, opts.fresh ? 1200 : 300);
    if (App.debug.open) Debug.show();
  },

  // ---------------- main loop ----------------
  frame(ts) {
    requestAnimationFrame(MainLoop.frame);
    App.now = ts;
    if (Intro.active) { Intro.frame(ts); MainLoop.last = ts; return; }
    const g = App.g;
    if (!g || !App.running) { MainLoop.last = ts; return; }
    let dt = MainLoop.last ? (ts - MainLoop.last) / 1000 : 0;
    MainLoop.last = ts;
    if (dt > 0.25) { MainLoop.catchup += dt - 0.25; dt = 0.25; }
    const t0 = performance.now();
    Input.updateMovement(g);
    // fixed-step simulation (paused while a modal is open only for the first-run dialogs, never otherwise)
    MainLoop.acc += dt * App.timeScale;
    // spread online catch-up over several frames
    if (MainLoop.catchup > 0) { const take = Math.min(MainLoop.catchup, 5); MainLoop.catchup -= take; MainLoop.acc += take; }
    const maxTicks = App.timeScale > 1 ? 400 : 120;
    let n = 0;
    const s0 = performance.now();
    while (MainLoop.acc >= MainLoop.step && n < maxTicks) { Game.tick(g); MainLoop.acc -= MainLoop.step; n++; }
    if (n >= maxTicks && MainLoop.acc >= MainLoop.step) {
      // too far behind for one frame: real-time backlog is caught up over the next frames, time-lapse excess is dropped
      if (App.timeScale === 1) MainLoop.catchup += MainLoop.acc - MainLoop.step;
      MainLoop.acc = MainLoop.step * 0.5;
    }
    App.debug.simMs = (performance.now() - s0) / Math.max(1, n);
    const alpha = U.clamp(MainLoop.acc / MainLoop.step, 0, 1);
    App.alpha = alpha;
    MainLoop.handleEvents(g);
    Tutorial.tick(g);
    Intro.update(g, dt);
    Input.updateCamera(g, dt, alpha);
    Frame.draw(g, alpha, dt);
    UI.updateHud(dt);
    if (App.mode === 'build' && App.ghost) UI.updateGhostInfo();
    MapView.drawMini(g);
    // autosave
    MainLoop.saveTimer += dt;
    if (MainLoop.saveTimer >= CONFIG.autosaveInterval) { MainLoop.saveTimer = 0; MainLoop.save(false); }
    // performance monitor
    MainLoop.perf(dt, performance.now() - t0);
  },
  perf(dt, ms) {
    MainLoop.fpsN++; MainLoop.fpsT += dt;
    if (MainLoop.fpsT >= 1) {
      App.debug.fps = MainLoop.fpsN / MainLoop.fpsT;
      App.debug.frameMs = ms;
      MainLoop.fpsN = 0; MainLoop.fpsT = 0;
      if (App.debug.open) Debug.updateStats();
      if (App.settings.quality === 'auto' && !document.hidden) {
        if (App.debug.fps < 40) MainLoop.lowFor++; else MainLoop.lowFor = Math.max(0, MainLoop.lowFor - 1);
        if (MainLoop.lowFor >= 5 && App.quality !== 'low') {
          App.quality = App.quality === 'high' ? 'medium' : 'low';
          MainLoop.lowFor = 0;
          Render.chunks.clear();
          UI.toast('Grafikqualität automatisch auf „' + (App.quality === 'medium' ? 'Mittel' : 'Niedrig') + '“ gesenkt, um flüssig zu bleiben.');
        }
      }
    }
  },

  // ---------------- simulation events -> UI feedback ----------------
  handleEvents(g) {
    const evs = g.events;
    if (!evs.length) return;
    for (const e of evs) {
      switch (e.type) {
        case 'sale': {
          const b = e.b;
          Audio2.play('sell', e.entry.tier);
          Render.float('+' + Fmt.num(e.entry.rev) + ' ' + CURRENCY_SHORT, b.x + b.w / 2, b.y - 0.2, e.entry.ok ? '#7dff8a' : '#d8ffd8');
          if (!App.settings.reducedFx) Render.coinBurst(b.x + b.w / 2, b.y + b.h * 0.45, Math.min(18, 5 + e.entry.tier * 3));
          break;
        }
        case 'stuck': UI.toast('Du steckst fest. Befreit.'); break;
        case 'landingZone': Audio2.play('horn'); UI.toast('Achtung: Landezone wird geräumt.'); break;
        case 'tip': Audio2.play('coin'); Render.float('+' + Fmt.num(e.tp.value) + ' Trinkgeld', e.tp.x, e.tp.y, '#ffd24a'); break;
        case 'codex': {
          const R = DATA.RESOURCES[e.res];
          UI.toast('Neu im Kodex: <b style="color:' + DATA.TIERS[R.tier].color + '">' + esc(R.name) + '</b> (' + DATA.TIERS[R.tier].name + ')', R.tier >= 2 ? 'gold' : 'good');
          if (R.tier >= 2) Audio2.play('found');
          break;
        }
        case 'tier':
          UI.toast('Kundenstufe ' + (e.tier + 1) + ' freigeschaltet: <b>' + esc(DATA.CUSTOMERS[e.tier].plural) + '</b>! Baue ' + esc(DATA.BUILDINGS[DATA.CUSTOMERS[e.tier].building].name) + '.', 'gold', 6000);
          Audio2.play('unlock');
          UI.refreshBuildBar(true);
          break;
        case 'research': UI.toast('Forschung abgeschlossen: <b>' + esc(DATA.RESEARCH_BY_ID[e.id].name) + '</b>', 'good', 4500); Audio2.play('unlock'); UI.refreshBuildBar(true); break;
        case 'eventStart': {
          const R = DATA.RESOURCES[e.ev.res];
          UI.toast(e.ev.pos ? e.ev.who + ' sucht <b>' + esc(R.name) + '</b>: ×' + Fmt.dec(e.ev.mult, 1) + ' für ' + Fmt.time(e.ev.end - e.ev.start) : 'Überangebot an <b>' + esc(R.name) + '</b>: ×' + Fmt.dec(e.ev.mult, 1) + ' für ' + Fmt.time(e.ev.end - e.ev.start), e.ev.pos ? 'gold' : 'bad', 5000);
          Audio2.play('event');
          break;
        }
        case 'contractNew': UI.toast('Neuer Planeten-Vertrag von <b>' + esc(e.c.planet) + '</b>', 'gold'); Audio2.play('event'); break;
        case 'contractDone': UI.toast('Vertrag mit ' + esc(e.c.planet) + ' erfüllt! Bonus ' + Fmt.money(e.bonus) + (e.rp ? ' und +1 Rebirth-Punkt beim nächsten Rebirth' : ''), 'gold', 5000); Audio2.play('unlock'); break;
        case 'contractFail': UI.toast('Vertrag mit ' + esc(e.c.planet) + ' ist abgelaufen.', 'bad'); break;
        case 'achievement': { const a = DATA.ACH_BY_ID[e.id]; UI.toast('🏆 Erfolg: <b>' + esc(a.name) + '</b> (+' + Fmt.dec(a.bonus * 100, 1) + ' % Erlös)', 'gold', 4500); Audio2.play('unlock'); break; }
        case 'warn': {
          const b = e.b;
          const name = DATA.BUILDINGS[b.type].name;
          if (e.kind === 'blocked') UI.toast(name + ' blockiert bei ' + b.x + ', ' + b.y + ': Ausgang voll.', 'bad');
          else if (e.kind === 'full') UI.toast('Lager voll bei ' + b.x + ', ' + b.y + '.', 'bad');
          else if (e.kind === 'nearfull') UI.toast('Lager bei ' + b.x + ', ' + b.y + ' zu 90 % gefüllt.', '');
          Audio2.play('warn');
          break;
        }
        case 'depositSeen':
          if (e.d.tier >= 3) { UI.toast('Seltenes Vorkommen gesichtet: <b style="color:' + DATA.TIERS[e.d.tier].color + '">' + esc(DATA.RESOURCES[e.d.res].name) + '</b>', 'gold'); Audio2.play('found'); }
          break;
      }
    }
    evs.length = 0;
  },

  // ---------------- saving ----------------
  save(manual) {
    const g = App.g;
    if (!g || !App.running || MainLoop.noSave) return;
    const dot = $('#save-dot');
    dot.className = 'save-dot saving';
    const res = Save.write(g, { lastSeen: Date.now(), camera: { zoom: App.cam.zoom } });
    setTimeout(() => { dot.className = 'save-dot ' + (res.ok ? 'saved' : 'error'); }, 150);
    dot.title = res.ok ? 'Gespeichert ' + new Date().toLocaleTimeString('de-DE') : res.err;
    if (!res.ok && !MainLoop.saveWarned) { MainLoop.saveWarned = true; UI.toast('Speichern fehlgeschlagen: ' + res.err + '. Du kannst weiterspielen, nutze den Export als Sicherung.', 'bad', 6000); }
    if (res.ok && (manual || App.settings.autosaveToast) && !(MainLoop.quietUntil > performance.now())) UI.toast('Spiel gespeichert', 'good', 1500);
  },
  onVisibility() {
    if (!App.g || !App.running) return;
    if (document.hidden) { MainLoop.hiddenAt = Date.now(); MainLoop.save(false); return; }
    if (!MainLoop.hiddenAt) return;
    const gap = (Date.now() - MainLoop.hiddenAt) / 1000;
    MainLoop.hiddenAt = 0;
    MainLoop.last = 0;
    if (gap <= 0) return; // clock went backwards: ignore
    if (gap <= CONFIG.onlineCatchup) MainLoop.catchup += gap;
    else MainLoop.offlineFor(gap);
  },
  offlineFor(seconds) {
    const g = App.g;
    seconds = Math.min(seconds, CONFIG.offlineMax);
    if (seconds <= 0) return;
    const t0 = performance.now();
    const rep = Offline.simulate(g, seconds);
    const ms = performance.now() - t0;
    if (App.debug.open) UI.toast('Offline-Berechnung: ' + ms.toFixed(0) + ' ms');
    MainLoop.catchup = 0; MainLoop.acc = 0;
    FX.welcomeBack(rep, () => {
      Offline.apply(g, rep);
      UI.moneyShown = g.run.money - rep.earned;
      Audio2.play('sell', 3);
      MainLoop.save(false);
    });
  },
  importSave(text) {
    let parsed;
    try { parsed = Save.parseImport(text); }
    catch (e) { UI.toast('Import fehlgeschlagen: ' + esc(e.message || 'ungültiger Text') + '. Dein Spielstand bleibt unverändert.', 'bad', 6000); Audio2.play('error'); return; }
    if (!Save.writeRaw(parsed.obj)) { UI.toast('Import geprüft, aber Speichern nicht möglich. Spiel wird trotzdem geladen.', 'bad'); }
    UI.closeModal();
    MainLoop.hideTitle();
    MainLoop.start(parsed.loaded.game, { camera: parsed.loaded.camera });
    UI.toast('Spielstand importiert', 'good');
  },
  restoreBackup() {
    const o = Save.read(Save.BACKUP);
    if (!o) { UI.toast('Kein Backup vorhanden', 'bad'); return; }
    UI.confirm('Backup laden?', 'Der vorherige automatische Spielstand wird geladen. Der aktuelle Stand wird zum neuen Backup.', 'Backup laden', () => {
      try { const l = Save.fromObject(o); Save.writeRaw(o); MainLoop.start(l.game, { camera: l.camera }); UI.toast('Backup geladen', 'good'); }
      catch (e) { UI.toast('Backup beschädigt', 'bad'); }
    });
  },
  wipeSave() {
    UI.confirm('Spielstand löschen?', 'Alles geht verloren: Planeten, Rebirth-Punkte, Kodex und Statistiken.', 'Weiter', () => {
      UI.confirm('Wirklich endgültig löschen?', 'Dieser Schritt kann nicht rückgängig gemacht werden.', 'Endgültig löschen', () => {
        App.running = false;
        Save.wipe();
        location.reload();
      }, true);
    }, true);
  },
  doRebirth(target) {
    const g = App.g;
    MainLoop.save(false);
    const res = Game.rebirth(g, target);
    if (!res) { UI.toast('Rebirth nicht möglich', 'bad'); return; }
    UI.closeModal();
    App.running = false;
    MainLoop.quietUntil = 0;
    FX.sequence('rebirth', res.game.world.planet, () => {
      MainLoop.start(res.game, { fresh: true });
      UI.toast('Rebirth abgeschlossen: +' + res.gained + ' Rebirth-Punkte. Multiplikator ×' + Fmt.dec(res.game.mods.rebirthMult, 2), 'gold', 6000);
      MainLoop.save(true);
    });
  },
  teleport(x, y, label) {
    const g = App.g;
    const scr = $('#screen-fx');
    const cv = $('#fx-canvas');
    scr.classList.remove('hidden');
    scr.querySelector('.fx-text').innerHTML = label || 'Teleport';
    scr.querySelector('.fx-skip').classList.add('hidden');
    const ctx = cv.getContext('2d');
    const d = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * d; cv.height = innerHeight * d;
    let t0 = null;
    const loop = ts => {
      if (t0 === null) t0 = ts;
      const k = (ts - t0) / 900;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, innerWidth, innerHeight);
      FX.drawStars(ctx, innerWidth, innerHeight, k, 0, Math.sin(Math.min(1, k) * Math.PI) * 0.8);
      if (k < 1) { requestAnimationFrame(loop); return; }
      g.run.player.x = x; g.run.player.y = y; g.run.player.px = x; g.run.player.py = y;
      App.cam.x = x; App.cam.y = y; App.cam.follow = true; UI.updateCenterBtn();
      g.lastCell = null;
      scr.classList.add('hidden');
      scr.querySelector('.fx-skip').classList.remove('hidden');
    };
    requestAnimationFrame(loop);
  }
};

// Small handle for automated tests and power users (read-only use recommended).
window.__AO__ = { Art, ItemArt, FxLib, TerrainCore, TerrainSys, RockArt, LanderArt, PlanetCore, PlanetView, Intro, IntroAudio, TitleScene, BuildingArt, BeltArt, CharArt, DepositArt, DecorArt, PlanetArt: typeof PlanetArt !== 'undefined' ? PlanetArt : null, ALIEN_SPECIES, Draw, Sprites, FX, Col, Tutorial, App, Game, Grid, World, Build, UI, Render, Economy, Save, Offline, Progression, MainLoop, Menus, MapView, Bot, SelfTest, Actions, DATA, CONFIG };
MainLoop.boot();
