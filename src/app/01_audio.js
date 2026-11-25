// =====================================================================
// Audio: synthesised with Web Audio, started after first user gesture
// =====================================================================
const Audio2 = {
  ctx: null, master: null, sfx: null, music: null, drone: null, started: false, lastPlay: {},

  start() {
    if (Audio2.started) { if (Audio2.ctx && Audio2.ctx.state === 'suspended') Audio2.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      Audio2.ctx = ctx;
      Audio2.master = ctx.createGain(); Audio2.master.connect(ctx.destination);
      Audio2.sfx = ctx.createGain(); Audio2.sfx.connect(Audio2.master);
      Audio2.music = ctx.createGain(); Audio2.music.connect(Audio2.master);
      Audio2.started = true;
      Audio2.applyVolume();
      if (App.g) Audio2.setPlanet(App.g.run.planet);
    } catch (e) { Audio2.ctx = null; }
  },
  applyVolume() {
    if (!Audio2.ctx) return;
    const s = App.settings;
    const t = Audio2.ctx.currentTime;
    Audio2.master.gain.setTargetAtTime(s.sound ? 1 : 0, t, 0.05);
    Audio2.sfx.gain.setTargetAtTime(s.volume, t, 0.05);
    Audio2.music.gain.setTargetAtTime(s.music * 0.5, t, 0.3);
  },
  ok(name, gap = 0.04) {
    if (!Audio2.ctx || !App.settings.sound) return false;
    const now = Audio2.ctx.currentTime;
    if (Audio2.lastPlay[name] && now - Audio2.lastPlay[name] < gap) return false;
    Audio2.lastPlay[name] = now;
    return true;
  },
  tone(freq, dur, type = 'sine', vol = 0.2, opts = {}) {
    const ctx = Audio2.ctx;
    const t = ctx.currentTime + (opts.delay || 0);
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + (opts.attack || 0.005));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(opts.dest || Audio2.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.2, opts = {}) {
    const ctx = Audio2.ctx;
    const t = ctx.currentTime + (opts.delay || 0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = opts.filter || 'lowpass';
    f.frequency.setValueAtTime(opts.f0 || 1200, t);
    if (opts.f1) f.frequency.exponentialRampToValueAtTime(opts.f1, t + dur);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + (opts.attack || 0.01));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(gn); gn.connect(Audio2.sfx);
    src.start(t); src.stop(t + dur + 0.02);
  },
  play(name, arg) {
    if (!Audio2.ok(name, name === 'sell' ? 0.08 : 0.04)) return;
    switch (name) {
      case 'click': Audio2.tone(880, 0.05, 'triangle', 0.08); break;
      case 'open': Audio2.tone(520, 0.08, 'sine', 0.08); Audio2.tone(780, 0.1, 'sine', 0.06, { delay: 0.05 }); break;
      case 'build': Audio2.tone(140, 0.16, 'square', 0.12, { slide: 70 }); Audio2.noise(0.12, 0.12, { f0: 900, f1: 200 }); break;
      case 'belt': Audio2.tone(320, 0.05, 'triangle', 0.06); break;
      case 'remove': Audio2.tone(300, 0.18, 'sawtooth', 0.08, { slide: 90 }); break;
      case 'error': Audio2.tone(180, 0.14, 'square', 0.08); Audio2.tone(140, 0.16, 'square', 0.07, { delay: 0.08 }); break;
      case 'sell': {
        const base = 1046 * Math.pow(1.12, arg || 0);
        Audio2.tone(base, 0.12, 'triangle', 0.09); Audio2.tone(base * 1.5, 0.18, 'sine', 0.07, { delay: 0.06 });
        break;
      }
      case 'coin': Audio2.tone(1568, 0.08, 'square', 0.05); Audio2.tone(2093, 0.12, 'square', 0.04, { delay: 0.05 }); break;
      case 'scan': Audio2.tone(300, 0.9, 'sine', 0.12, { slide: 1400, attack: 0.02 }); Audio2.tone(1400, 0.25, 'sine', 0.05, { delay: 0.6 }); break;
      case 'found': [660, 880, 1320].forEach((f, i) => Audio2.tone(f, 0.18, 'triangle', 0.08, { delay: i * 0.08 })); break;
      case 'event': [523, 659, 784, 1046].forEach((f, i) => Audio2.tone(f, 0.22, 'triangle', 0.08, { delay: i * 0.09 })); break;
      case 'unlock': [392, 523, 659, 784, 1046].forEach((f, i) => Audio2.tone(f, 0.3, 'sine', 0.09, { delay: i * 0.07 })); break;
      case 'upgrade': Audio2.tone(440, 0.1, 'triangle', 0.08); Audio2.tone(660, 0.14, 'triangle', 0.08, { delay: 0.07 }); Audio2.tone(990, 0.16, 'triangle', 0.07, { delay: 0.14 }); break;
      case 'rebirth': Audio2.noise(2.4, 0.25, { f0: 200, f1: 6000, attack: 0.8 }); Audio2.tone(60, 2.5, 'sawtooth', 0.12, { slide: 600, attack: 0.5 }); break;
      case 'land': Audio2.noise(1.2, 0.2, { f0: 3000, f1: 150 }); break;
      case 'warn': Audio2.tone(620, 0.1, 'square', 0.05); Audio2.tone(620, 0.1, 'square', 0.05, { delay: 0.16 }); break;
      case 'horn': Audio2.tone(310, 0.35, 'sawtooth', 0.06); Audio2.tone(370, 0.35, 'sawtooth', 0.05); break;
    }
  },
  // Ambient drone per planet: two detuned oscillators through a slowly moving filter.
  setPlanet(k) {
    if (!Audio2.ctx) return;
    const ctx = Audio2.ctx;
    if (Audio2.drone) { const d = Audio2.drone; d.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5); setTimeout(() => { try { d.nodes.forEach(n => n.stop()); } catch (e) { /* stopped */ } }, 2000); }
    const roots = [55, 61.7, 73.4, 49, 65.4, 82.4, 69.3, 41.2];
    const root = roots[(k - 1) % roots.length] * (k > 8 ? Math.pow(1.06, k % 5) : 1);
    const gain = ctx.createGain(); gain.gain.value = 0.0001;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420; filt.Q.value = 6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + (k % 3) * 0.02;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 260;
    lfo.connect(lfoGain); lfoGain.connect(filt.frequency);
    const nodes = [lfo];
    [[root, 'sawtooth', 0.5], [root * 1.004, 'sawtooth', 0.5], [root * 1.5, 'triangle', 0.35], [root * 2.01, 'sine', 0.25]].forEach(([f, type, v]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const gg = ctx.createGain(); gg.gain.value = v;
      o.connect(gg); gg.connect(filt); o.start(); nodes.push(o);
    });
    filt.connect(gain); gain.connect(Audio2.music);
    lfo.start();
    gain.gain.setTargetAtTime(0.08, ctx.currentTime, 2);
    Audio2.drone = { gain, nodes };
  }
};
