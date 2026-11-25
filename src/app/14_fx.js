// =====================================================================
// FX: title background, landing intro, rebirth sequence, dialogs
// =====================================================================
const FX = {
  stars: null,
  makeStars(n = 220) {
    const rnd = RNG.mulberry32(77);
    FX.stars = Array.from({ length: n }, () => ({ x: rnd(), y: rnd(), z: 0.2 + rnd() * 0.8, tw: rnd() * 6 }));
  },
  drawStars(ctx, W, H, t, speed = 0, streak = 0) {
    if (!FX.stars) FX.makeStars();
    for (const s of FX.stars) {
      let x = s.x, y = s.y;
      if (speed) { x = ((s.x - 0.5) * (1 + ((t * speed * s.z) % 1) * 3)) + 0.5; y = ((s.y - 0.5) * (1 + ((t * speed * s.z) % 1) * 3)) + 0.5; }
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.tw));
      if (streak > 0) {
        const cx = W / 2, cy = H / 2;
        const px = x * W, py = y * H;
        const dx = px - cx, dy = py - cy;
        ctx.strokeStyle = 'rgba(200,220,255,' + (a * s.z) + ')'; ctx.lineWidth = s.z * 2;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - dx * streak * s.z, py - dy * streak * s.z); ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,' + (a * s.z) + ')';
        ctx.fillRect(x * W, y * H, s.z * 2, s.z * 2);
      }
    }
  },
  drawPlanet(ctx, cx, cy, r, planet, t) {
    const gr = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    gr.addColorStop(0, planet.ground[2]); gr.addColorStop(0.55, planet.ground[1]); gr.addColorStop(1, planet.ground[0]);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = Col.rgba(planet.rock, 0.35);
    for (let i = 0; i < 9; i++) { const a = i * 2.4 + t * 0.03, d = (i * 0.37 % 1) * r * 0.8; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, r * (0.08 + (i % 3) * 0.04), r * 0.05, a, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(cx + r * 0.45, cy + r * 0.3, r * 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = Col.rgba(planet.accent, 0.5); ctx.lineWidth = r * 0.04;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.02, 0, Math.PI * 2); ctx.stroke();
  },

  // ---------------- title screen ----------------
  titleLoop: null,
  startTitle() {
    const cv = $('#title-bg');
    const ctx = cv.getContext('2d');
    const planet = DATA.planet(1);
    const loop = t => {
      if ($('#screen-title').classList.contains('hidden')) return;
      const d = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth, H = window.innerHeight;
      if (cv.width !== W * d) { cv.width = W * d; cv.height = H * d; }
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = '#0b0710'; ctx.fillRect(0, 0, W, H);
      FX.drawStars(ctx, W, H, t / 1000);
      const r = Math.max(W, H) * 0.55;
      FX.drawPlanet(ctx, W * 0.5, H + r * 0.55, r, planet, t / 1000);
      FX.titleLoop = requestAnimationFrame(loop);
    };
    FX.titleLoop = requestAnimationFrame(loop);
  },

  // ---------------- cinematic sequences ----------------
  sequence(kind, planet, onDone) {
    const scr = $('#screen-fx');
    scr.classList.remove('hidden');
    const cv = $('#fx-canvas');
    const ctx = cv.getContext('2d');
    const text = scr.querySelector('.fx-text');
    const dur = App.settings.reducedFx ? 1800 : kind === 'rebirth' ? 6500 : 4800;
    let start = null, done = false, raf;
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); scr.classList.add('hidden'); onDone(); };
    scr.querySelector('.fx-skip').onclick = finish;
    if (kind === 'rebirth') Audio2.play('rebirth'); else Audio2.play('land');
    const frame = ts => {
      if (start === null) start = ts;
      const t = (ts - start) / dur;
      const d = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth, H = window.innerHeight;
      if (cv.width !== Math.round(W * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H);
      if (kind === 'rebirth') FX.drawRebirth(ctx, W, H, t, planet, text);
      else FX.drawLanding(ctx, W, H, t, planet, text);
      if (t >= 1) { finish(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  },
  drawLanding(ctx, W, H, t, planet, text) {
    FX.drawStars(ctx, W, H, t * 5);
    const r = Math.max(W, H) * (0.6 + t * 1.6);
    FX.drawPlanet(ctx, W / 2, H + r * (0.75 - t * 0.25), r, planet, t * 5);
    // lander
    const y = H * (0.05 + Math.min(1, t * 1.15) * 0.62);
    const x = W / 2;
    ctx.save(); ctx.translate(x, y);
    const s = Math.min(W, H) * 0.08;
    if (t < 0.85) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(Sprites.glow('#ffb04a'), -s * 0.6, s * 0.3, s * 1.2, s * (1.6 + Math.random() * 0.4));
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = '#e8ebf0'; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, s * 0.2); ctx.lineTo(s * 0.4, s * 0.5); ctx.lineTo(-s * 0.4, s * 0.5); ctx.lineTo(-s * 0.6, s * 0.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = planet.accent; ctx.fillRect(-s * 0.3, -s * 0.05, s * 0.6, s * 0.15);
    ctx.strokeStyle = '#9aa0aa'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(-s * 0.4, s * 0.5); ctx.lineTo(-s * 0.7, s * 0.85); ctx.moveTo(s * 0.4, s * 0.5); ctx.lineTo(s * 0.7, s * 0.85); ctx.stroke();
    ctx.restore();
    if (t > 0.72) { ctx.fillStyle = Col.rgba(planet.particle, Math.min(0.5, (t - 0.72) * 2)); ctx.beginPath(); ctx.ellipse(x, y + s, s * (2 + (t - 0.72) * 14), s * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    text.innerHTML = 'Landung auf ' + esc(planet.name) + '<small>' + esc(planet.desc) + '</small>';
    text.style.opacity = String(U.clamp(t * 3 - 0.3, 0, 1));
  },
  drawRebirth(ctx, W, H, t, planet, text) {
    const old = DATA.planet(App.g ? App.g.run.planet : 1);
    if (t < 0.3) {
      const k = t / 0.3;
      FX.drawStars(ctx, W, H, t * 5);
      const r = Math.max(W, H) * (1.2 - k * 1.05);
      FX.drawPlanet(ctx, W / 2, H * 0.5 + r * 0.6 * (1 - k) + k * H * 0.2, Math.max(20, r), old, t * 5);
      const sy = H * (0.6 - k * 0.7);
      ctx.fillStyle = '#e8ebf0'; ctx.beginPath(); ctx.moveTo(W / 2, sy - 30); ctx.lineTo(W / 2 + 16, sy + 12); ctx.lineTo(W / 2 - 16, sy + 12); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Sprites.glow('#7fd3ff'), W / 2 - 20, sy + 8, 40, 60); ctx.globalCompositeOperation = 'source-over';
      text.innerHTML = 'Start von ' + esc(old.name);
    } else if (t < 0.7) {
      const k = (t - 0.3) / 0.4;
      FX.drawStars(ctx, W, H, t * 10, 0, 0.15 + Math.sin(k * Math.PI) * 0.9);
      ctx.fillStyle = 'rgba(120,160,255,' + (Math.sin(k * Math.PI) * 0.18) + ')'; ctx.fillRect(0, 0, W, H);
      text.innerHTML = 'Hyperraum<small>Rebirth-Punkte werden gutgeschrieben</small>';
    } else {
      const k = (t - 0.7) / 0.3;
      FX.drawStars(ctx, W, H, t * 5);
      const r = Math.max(W, H) * (0.1 + k * 0.9);
      FX.drawPlanet(ctx, W / 2, H / 2 + r * 0.6 * k, r, planet, t * 5);
      text.innerHTML = 'Ankunft: ' + esc(planet.name) + '<small>' + esc(planet.desc) + (planet.special ? ' · ' + esc(DATA.PLANET_SPECIALS[planet.special].desc) : '') + '</small>';
    }
    text.style.opacity = '1';
  },

  // ---------------- dialogs ----------------
  luckyStart(g) {
    const luck = g.world.start.luck;
    const best = g.world.start.deposits.reduce((a, d) => d.tier > a.tier ? d : a, g.world.start.deposits[0]);
    const tier = luck === 0 ? 0 : best.tier;
    const col = DATA.TIERS[tier].color;
    const names = ['Normalstart', 'Guter Start!', 'Jackpot!', 'Wunder-Start!!'];
    const subs = ['Ein solider Anfang: In der Nähe liegen gewöhnliche Vorkommen.', 'In der Nähe liegt ein seltenes oder episches Vorkommen.', 'Ein legendäres oder mythisches Vorkommen liegt ganz in der Nähe!', 'Unfassbar: Ein exotisches oder exquisites Vorkommen wartet auf dich!'];
    const m = h('div', { class: 'modal small' },
      h('div', { class: 'modal-body lucky' },
        h('div', { class: 'muted', text: 'Glücksstart' }),
        h('div', { class: 'tierword', style: { color: col, textShadow: '0 0 24px ' + col }, text: names[luck] }),
        h('p', { text: subs[luck] }),
        luck > 0 ? h('p', { html: 'Fund: <b style="color:' + col + '">' + esc(DATA.RESOURCES[best.res].name) + '</b> (' + DATA.TIERS[best.tier].name + ')' }) : null),
      h('div', { class: 'modal-foot' }, h('button', { class: 'btn accent', onclick: () => UI.closeModal() }, 'Los geht\'s')));
    UI.openModal(m);
    if (luck >= 2) { Audio2.play('unlock'); Progression.unlock(g, 'jackpot'); } else Audio2.play('found');
    if (luck > 0) Render.edgeMarks.push({ x: best.x + 0.5, y: best.y + 0.5, color: col, label: DATA.RESOURCES[best.res].name, at: App.now + 20000 });
  },
  welcomeBack(rep, onCollect) {
    const capped = rep.seconds >= CONFIG.offlineMax - 1;
    const num = h('div', { class: 'welcome-num', text: '+0 ' + CURRENCY_SHORT });
    const mined = rep.mined.map((v, t) => v >= 1 ? '<span style="color:' + DATA.TIERS[t].color + '">' + DATA.TIERS[t].name + '</span><b>' + Fmt.int(v) + '</b>' : '').join('');
    const m = h('div', { class: 'modal small' },
      h('div', { class: 'modal-head' }, h('h2', { text: 'Willkommen zurück!' })),
      h('div', { class: 'modal-body' },
        h('p', { html: 'Du warst <b' + (capped ? ' style="color:var(--warn)"' : '') + '>' + Fmt.time(rep.seconds) + '</b> offline' + (capped ? ' (Maximum von 8:00:00 erreicht)' : '') + '. Dein Außenposten hat weitergearbeitet:' }),
        num,
        mined ? h('div', { class: 'kv', html: mined }) : h('p', { class: 'muted', text: 'Es wurde nichts abgebaut. Tipp: Extraktoren brauchen eine vollständige Kette bis zu Lager oder Verkauf.' }),
        rep.storageLimited ? h('p', { html: '<span class="tag warn">Lager voll</span> Ein Teil der Produktion stand still, weil Lager voll waren. Lager-Upgrades helfen.' }) : null,
        h('p', { class: 'muted', text: 'Offline gilt der Durchschnittspreis, Events und Verträge pausieren.' })),
      h('div', { class: 'modal-foot' }, h('button', { class: 'btn accent big', onclick: () => { UI.closeModal(); } }, 'Einsammeln')));
    UI.openModal(m, { sticky: true, onClose: onCollect });
    const t0 = performance.now();
    const anim = () => {
      const k = U.clamp((performance.now() - t0) / 1400, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      num.textContent = '+' + Fmt.num(rep.earned * e) + ' ' + CURRENCY_SHORT;
      if (k < 1 && num.isConnected) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }
};
