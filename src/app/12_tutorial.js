// =====================================================================
// Tutorial: short contextual steps in the first run (skippable)
// =====================================================================
const Tutorial = {
  STEPS: [
    { text: 'Willkommen auf dem Planeten! <b>Laufe</b> ein paar Schritte: WASD/Pfeiltasten oder den Joystick unten links (Daumen aufsetzen und ziehen).', target: null },
    { text: 'Rohstoffe liegen als leuchtende Vorkommen auf dem Boden. Drücke den <b>Scanner</b> (◉ bzw. F), um alle Vorkommen in der Nähe zu markieren.', target: '#btn-scan' },
    { text: 'Öffne <b>Bauen</b> (⚒ bzw. B), wähle den <b>Extraktor</b> und setze ihn <b>direkt neben oder auf ein Vorkommen</b>. Am besten auf ein graues, gewöhnliches.', target: '#btn-build' },
    { text: 'Wähle in „Transport“ das <b>Förderband</b> und <b>ziehe eine Linie</b> vom Extraktor weg. Die Pfeile zeigen die Laufrichtung.', target: '#bb-cats' },
    { text: 'Setze am Ende des Bandes einen <b>Basarstand</b> (Kategorie „Verkauf“). Das Band muss in den Stand hineinführen.', target: '#bb-cats' },
    { text: 'Gleich kommen <b>Alien-Wanderer</b> vorbei und kaufen, was sie sich wünschen (Sprechblase). Warte auf deinen <b>ersten Verkauf</b>.', target: null },
    { text: 'Sehr gut! Tipp: <b>Lager</b> puffern Items, wenn gerade niemand kauft, und neben einem Verkaufsgebäude wirken sie als Verladerampe. <b>Raffinerien</b> verdoppeln den Wert deiner Rohstoffe.', target: null, next: true },
    { text: 'Auf der <b>Karte</b> (M) siehst du entdeckte Gebiete und Vorkommen. Mit einem <b>Forschungslabor</b> schaltest du bessere Bänder, Raffinerien und mehr frei. Viel Erfolg!', target: '#btn-map', next: true, last: true }
  ],
  active: false,
  step: 0,
  moved: 0,
  belts: 0,

  start() {
    const t = App.g.meta.tutorial;
    if (t.done) return;
    Tutorial.active = true;
    Tutorial.step = t.step || 0;
    Tutorial.show();
    $('#tutorial .tut-skip').onclick = () => Tutorial.finish(true);
    $('#tutorial .tut-next').onclick = () => Tutorial.advance();
  },
  restart() {
    App.g.meta.tutorial = { done: false, step: 0 };
    Tutorial.start();
  },
  show() {
    const el = $('#tutorial');
    $$('.pulse-target').forEach(e => e.classList.remove('pulse-target'));
    if (!Tutorial.active) { el.classList.add('hidden'); return; }
    const s = Tutorial.STEPS[Tutorial.step];
    el.classList.remove('hidden');
    el.querySelector('.tut-text').innerHTML = '<div class="tut-step">Schritt ' + (Tutorial.step + 1) + ' von ' + Tutorial.STEPS.length + '</div>' + s.text;
    const nx = el.querySelector('.tut-next');
    nx.classList.toggle('hidden', !s.next);
    nx.textContent = s.last ? 'Fertig' : 'Weiter';
    if (s.target) { const t = $(s.target); if (t) t.classList.add('pulse-target'); }
  },
  advance() {
    Tutorial.step++;
    App.g.meta.tutorial.step = Tutorial.step;
    if (Tutorial.step >= Tutorial.STEPS.length) { Tutorial.finish(false); return; }
    Audio2.play('click');
    Tutorial.show();
  },
  finish(skipped) {
    Tutorial.active = false;
    App.g.meta.tutorial = { done: true, step: Tutorial.STEPS.length };
    Tutorial.show();
    if (!skipped) UI.toast('Tutorial abgeschlossen. Viel Spaß beim Aufbau!', 'good');
  },
  tick(g) {
    if (!Tutorial.active) return;
    if (Tutorial.step === 0) {
      const p = g.run.player;
      if (Math.hypot(p.x - g.run.home.x, p.y - g.run.home.y) > 3) Tutorial.advance();
    }
    if (Tutorial.step === 5 && g.run.earned > 0) Tutorial.advance();
    // skip ahead if the player is faster than the tutorial
    if (Tutorial.step === 2 && (g.lists.extractor || []).length) Tutorial.advance();
    if (Tutorial.step === 4 && (g.lists.seller || []).length) Tutorial.advance();
  },
  onEvent(type, data) {
    if (!Tutorial.active) return;
    const s = Tutorial.step;
    if (s === 1 && type === 'scan') Tutorial.advance();
    else if (s === 2 && type === 'place' && data.type === 'extractor') Tutorial.advance();
    else if (s === 3 && type === 'place' && data.type === 'belt') Tutorial.advance();
    else if (s === 4 && type === 'place' && SELLER_TIER[data.type] !== undefined) Tutorial.advance();
    else if (s === 7 && type === 'map') Tutorial.advance();
  }
};
