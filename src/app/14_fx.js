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
  drawPlanet(ctx, cx, cy, r, planet, t, o) { PlanetArt.draw(ctx, cx, cy, r, planet, t, o || { async: true }); },

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
    const dur = App.settings.reducedFx ? 1800 : kind === 'rebirth' ? 8500 : 4800;
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
    // lander: shuttle with braking flame and extending legs
    const y = H * (0.05 + Art.ease.outCubic(Math.min(1, t * 1.15)) * 0.62);
    const x = W / 2;
    const s = Math.min(W, H) * 0.16;
    ctx.save(); ctx.translate(x, y);
    if (t < 0.88) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(FxLib.tinted('flame', Math.floor(t * 90) & 3, '#ffb04a'), -s * 0.12, s * 0.2, s * 0.24, s * (0.6 + (t > 0.55 ? 0.6 : 0.2)));
      ctx.globalAlpha = 0.6; ctx.drawImage(FxLib.tinted('soft', 0, '#ffb04a'), -s * 0.5, s * 0.1, s, s);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    const legs = U.clamp((t - 0.55) / 0.25, 0, 1);
    ctx.strokeStyle = '#3a3f48'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.15); ctx.lineTo(-s * (0.3 + legs * 0.12), s * (0.15 + legs * 0.25)); ctx.moveTo(s * 0.3, s * 0.15); ctx.lineTo(s * (0.3 + legs * 0.12), s * (0.15 + legs * 0.25)); ctx.stroke();
    ctx.drawImage(CharArt.shipSprite(2, Art.bucket(s, 128)), -s / 2, -s / 2, s, s);
    ctx.restore();
    if (t > 0.72) { ctx.fillStyle = Col.rgba(planet.particle, Math.min(0.5, (t - 0.72) * 2)); ctx.beginPath(); ctx.ellipse(x, y + s, s * (2 + (t - 0.72) * 14), s * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    text.innerHTML = 'Landung auf ' + esc(planet.name) + '<small>' + esc(planet.desc) + '</small>';
    text.style.opacity = String(U.clamp(t * 3 - 0.3, 0, 1));
  },
  // longer cinematic rebirth: liftoff, hyperspace tunnel, exit flash, planet-specific arrival
  drawRebirth(ctx, W, H, t, planet, text) {
    const old = DATA.planet(App.g ? App.g.run.planet : 1);
    const M = Math.min(W, H), E = Art.ease;
    const ship = (x, y, s, thrust, rot = 0) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      if (thrust > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(FxLib.tinted('flame', Math.floor(t * 120) & 3, '#ffb04a'), -s * 0.14, s * 0.25, s * 0.28, s * (0.5 + thrust * 0.8));
        ctx.globalAlpha = 0.7; ctx.drawImage(FxLib.tinted('soft', 0, '#7fd3ff'), -s * 0.5, s * 0.05, s, s);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(CharArt.shipSprite(2, Art.bucket(s / 2.2 * 2, 128)), -s / 2, -s / 2, s, s);
      ctx.restore();
    };
    const hashf = (i, k) => (RNG.hash(i, k, 4242) & 0xffff) / 65535;
    if (t < 0.3) {
      const k = t / 0.3;
      FX.drawStars(ctx, W, H, t * 5, 0, Math.max(0, k - 0.6) * 0.6);
      const r = Math.max(W, H) * (1.1 - E.inCubic(k) * 1.0);
      FX.drawPlanet(ctx, W / 2, H * 0.55 + r * 0.75 + E.inCubic(k) * H * 0.1, Math.max(12, r), old, t * 5);
      const shake = k < 0.15 ? (Math.random() - 0.5) * 6 * (1 - k / 0.15) : 0;
      const sy = H * (0.72 - E.inOutCubic(k) * 0.32);
      // launch smoke ring
      if (k < 0.35) { ctx.fillStyle = Col.rgba(old.particle, 0.5 * (1 - k / 0.35)); ctx.beginPath(); ctx.ellipse(W / 2, H * 0.8, M * (0.08 + k * 0.6), M * (0.02 + k * 0.1), 0, 0, Math.PI * 2); ctx.fill(); }
      ship(W / 2 + shake, sy, M * 0.16 * (1 - k * 0.35), 0.6 + k * 0.6);
      text.innerHTML = 'Start von ' + esc(old.name) + '<small>Der Außenposten bleibt als Legende zurück</small>';
      text.style.opacity = String(U.clamp(k * 4, 0, 1));
    } else if (t < 0.64) {
      const k = (t - 0.3) / 0.34;
      const bell = Math.sin(k * Math.PI);
      FX.drawStars(ctx, W, H, t * 10, 0, 0.2 + bell * 1.1);
      // tunnel rings rushing outwards in the colour of the destination
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const p = ((k * 3.2 + i / 9) % 1), rr = M * (0.04 + p * p * 1.3);
        ctx.strokeStyle = Col.rgba(i % 2 ? planet.accent : '#7fa8ff', (1 - p) * 0.5 * bell);
        ctx.lineWidth = 2 + p * 10;
        ctx.beginPath(); ctx.ellipse(W / 2, H / 2, rr, rr * 0.82, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = bell * 0.55; ctx.drawImage(FxLib.tinted('soft', 0, planet.accent), W / 2 - M * 0.25, H / 2 - M * 0.25, M * 0.5, M * 0.5);
      ctx.restore();
      ctx.fillStyle = 'rgba(120,160,255,' + (bell * 0.12).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
      ship(W / 2 + Math.sin(t * 40) * 1.5, H * 0.4, M * 0.1, 1.2);
      text.innerHTML = 'Hyperraum<small>Rebirth-Punkte werden gutgeschrieben</small>';
      text.style.opacity = '1';
    } else {
      const k = (t - 0.64) / 0.36;
      FX.drawStars(ctx, W, H, t * 5);
      const r = Math.max(W, H) * (0.03 + E.outCubic(k) * 0.62);
      const cy = H * 0.5 + r * 0.55 * E.outCubic(k);
      FX.drawPlanet(ctx, W / 2, cy, r, planet, t * 8);
      // planet-specific arrival particles
      const st = PlanetArt.spec(planet).style;
      ctx.save();
      for (let i = 0; i < 70; i++) {
        const h1 = hashf(i, 1), h2 = hashf(i, 2), h3 = hashf(i, 3);
        let x = h1 * W, y, a = Math.min(1, k * 3) * (1 - Math.max(0, k - 0.85) / 0.15);
        if (st === 'ice') { y = ((h2 + k * (0.3 + h3 * 0.4)) % 1) * H; x += Math.sin(k * 8 + i) * 12; ctx.globalAlpha = a * 0.85; ctx.drawImage(FxLib.get('snow', 0), x - 5, y - 5, 10, 10); continue; }
        if (st === 'lava') { y = H - ((h2 + k * (0.4 + h3 * 0.5)) % 1) * H; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.9; ctx.drawImage(FxLib.tinted('soft', 0, '#ff7a2a'), x - 4, y - 4, 8, 8); continue; }
        if (st === 'jungle') { y = ((h2 - k * 0.2 + 1) % 1) * H; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(k * 20 + i)); ctx.drawImage(FxLib.tinted('spore', 0, planet.deco), x - 6, y - 6, 12, 12); continue; }
        if (st === 'crystal' || st === 'patina') { y = h2 * H; ctx.globalCompositeOperation = 'lighter'; const tw = Math.max(0, Math.sin(k * 14 + i * 1.7)); ctx.globalAlpha = a * tw; ctx.drawImage(FxLib.tinted('glint4', 0, st === 'crystal' ? '#ffffff' : planet.accent), x - 9, y - 9, 18, 18); continue; }
        if (st === 'dark') { const ang = h1 * 6.28 + k * 2, rad = M * (0.2 + h2 * 0.5) * (1 - k * 0.3); x = W / 2 + Math.cos(ang) * rad; y = cy + Math.sin(ang) * rad * 0.4; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.8; ctx.drawImage(FxLib.tinted('soft', 0, planet.accent), x - 4, y - 4, 8, 8); continue; }
        if (st === 'gas') { y = h2 * H; x = (h1 * W + k * W * (0.2 + h3 * 0.3)) % W; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.7; ctx.drawImage(FxLib.tinted('soft', 0, i % 2 ? planet.accent : planet.deco), x - 5, y - 5, 10, 10); continue; }
        y = h2 * H; x = (h1 * W + k * W * 0.35 * (0.5 + h3)) % W; ctx.globalAlpha = a * 0.55; ctx.drawImage(FxLib.tinted('dust', i % 3, planet.particle), x - 8, y - 8, 16, 16);
      }
      ctx.restore();
      // exit flash
      if (k < 0.15) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - k / 0.15).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      const sk = E.inOutCubic(Math.min(1, k * 1.2));
      ship(W / 2 + (1 - sk) * M * 0.1, H * (0.3 + sk * 0.25), M * 0.1 * (1 - sk * 0.75), 0.4 * (1 - sk), Math.PI);
      text.innerHTML = 'Ankunft: ' + esc(planet.name) + '<small>' + esc(planet.desc) + (planet.special ? ' · ' + esc(DATA.PLANET_SPECIALS[planet.special].desc) : '') + '</small>';
      text.style.opacity = String(U.clamp(k * 3, 0, 1));
    }
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
