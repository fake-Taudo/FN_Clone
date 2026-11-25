// =====================================================================
// FxLib: pre-rendered effect sprites (particles, coins, flames, rings, bolts)
// All sprites are generated once and reused from the cache.
// =====================================================================
const FxLib = {
  S: 64,
  get(name, v = 0) { return Art.cached('FX|' + name + '|' + v, () => FxLib.make(name, v)); },
  make(name, v) {
    const big = name === 'fan' || name === 'radar' || name === 'ring' || name === 'ringThick' || name === 'beam' || name === 'impact';
    const S = big ? 128 : FxLib.S;
    const c = Art.canvas(S, S), x = c.getContext('2d');
    const h = S / 2;
    const rnd = RNG.mulberry32(RNG.hashString(name) + v * 7919);
    x.translate(h, h);
    switch (name) {
      case 'soft': { const g = x.createRadialGradient(0, 0, 0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(-h, -h, S, S); break; }
      case 'spark': {
        const g = x.createRadialGradient(0, 0, 0, 0, 0, h * 0.5); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(-h, -h, S, S);
        x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, 0, h * 0.9, h * 0.08, 0, 0, Math.PI * 2); x.fill();
        break;
      }
      case 'glint4': case 'glint8': {
        const n = name === 'glint8' ? 8 : 4;
        const g = x.createRadialGradient(0, 0, 0, 0, 0, h * 0.35); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(-h, -h, S, S);
        x.fillStyle = '#fff';
        for (let i = 0; i < n; i++) { x.save(); x.rotate(i * Math.PI * 2 / n); const L = (i % 2 && n === 8) ? h * 0.55 : h * 0.95; x.beginPath(); x.moveTo(0, -L); x.lineTo(h * 0.05, 0); x.lineTo(0, L * 0.02); x.lineTo(-h * 0.05, 0); x.fill(); x.restore(); }
        break;
      }
      case 'fan': {
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + (i - 4) * 0.22 + (rnd() - 0.5) * 0.08;
          const g = x.createLinearGradient(0, 0, Math.cos(a) * h, Math.sin(a) * h);
          g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a - 0.05) * h, Math.sin(a - 0.05) * h); x.lineTo(Math.cos(a + 0.05) * h, Math.sin(a + 0.05) * h); x.fill();
        }
        break;
      }
      case 'beam': {
        const g = x.createLinearGradient(0, h, 0, -h); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.6, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.beginPath(); x.moveTo(-h * 0.22, h); x.lineTo(h * 0.22, h); x.lineTo(h * 0.08, -h); x.lineTo(-h * 0.08, -h); x.fill();
        break;
      }
      case 'ring': case 'ringThick': {
        x.strokeStyle = '#fff'; x.lineWidth = name === 'ring' ? S * 0.025 : S * 0.07;
        x.beginPath(); x.arc(0, 0, h * 0.9, 0, Math.PI * 2); x.stroke();
        x.globalAlpha = 0.35; x.lineWidth *= 2.5; x.stroke();
        break;
      }
      case 'impact': {
        const g = x.createRadialGradient(0, 0, h * 0.55, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.scale(1, 0.5); x.beginPath(); x.arc(0, 0, h, 0, Math.PI * 2); x.fill();
        break;
      }
      case 'radar': {
        const g = x.createConicGradient ? x.createConicGradient(-Math.PI / 2, 0, 0) : null;
        if (g) { g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(0.14, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; }
        else x.fillStyle = 'rgba(255,255,255,.3)';
        x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, h, -Math.PI / 2, -Math.PI / 2 + Math.PI * 0.28); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -h); x.stroke();
        break;
      }
      case 'bolt': {
        x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
        const pts = [[-h * 0.9, (rnd() - 0.5) * h * 0.3]];
        for (let i = 1; i <= 7; i++) pts.push([-h * 0.9 + i * h * 1.8 / 7, (rnd() - 0.5) * h * 0.7]);
        x.lineWidth = S * 0.08; x.globalAlpha = 0.35; Art.polyline(x, pts); x.stroke();
        x.lineWidth = S * 0.03; x.globalAlpha = 1; Art.polyline(x, pts); x.stroke();
        break;
      }
      case 'steam': case 'smoke': case 'dust': {
        const n = 6 + Math.floor(rnd() * 4);
        for (let i = 0; i < n; i++) {
          const px = (rnd() - 0.5) * h * 0.9, py = (rnd() - 0.5) * h * 0.7, r = h * (0.25 + rnd() * 0.3);
          const g = x.createRadialGradient(px, py, 0, px, py, r);
          const a = name === 'steam' ? 0.55 : name === 'smoke' ? 0.5 : 0.45;
          g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
          x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
        }
        break;
      }
      case 'ash': { x.fillStyle = '#fff'; x.rotate(rnd() * 3); x.beginPath(); x.moveTo(-h * 0.4, -h * 0.1); x.lineTo(h * 0.2, -h * 0.35); x.lineTo(h * 0.45, h * 0.1); x.lineTo(-h * 0.1, h * 0.3); x.fill(); break; }
      case 'confetti': { x.fillStyle = '#fff'; x.rotate(rnd() * 3); x.fillRect(-h * 0.45, -h * 0.18, h * 0.9, h * 0.36); break; }
      case 'spore': { const g = x.createRadialGradient(0, 0, 0, 0, 0, h * 0.6); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(-h, -h, S, S); break; }
      case 'snow': {
        x.strokeStyle = '#fff'; x.lineWidth = S * 0.06; x.lineCap = 'round';
        for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * Math.PI / 3); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -h * 0.8); x.moveTo(0, -h * 0.45); x.lineTo(h * 0.2, -h * 0.62); x.moveTo(0, -h * 0.45); x.lineTo(-h * 0.2, -h * 0.62); x.stroke(); x.restore(); }
        break;
      }
      case 'coin': {
        // v = spin frame 0..7: horizontal squash shows the rotation
        const k = Math.abs(Math.cos(v / 8 * Math.PI));
        const w = h * 0.8 * Math.max(0.12, k);
        x.fillStyle = '#9a6406'; x.beginPath(); x.ellipse(h * 0.06, h * 0.04, w, h * 0.8, 0, 0, Math.PI * 2); x.fill();
        const g = x.createLinearGradient(-w, -h * 0.8, w, h * 0.8); g.addColorStop(0, '#fff3b8'); g.addColorStop(0.45, '#f7c946'); g.addColorStop(1, '#c4870f');
        x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, w, h * 0.8, 0, 0, Math.PI * 2); x.fill();
        if (k > 0.35) { x.strokeStyle = 'rgba(150,95,5,.85)'; x.lineWidth = S * 0.04; x.beginPath(); x.ellipse(0, 0, w * 0.68, h * 0.55, 0, 0, Math.PI * 2); x.stroke(); x.fillStyle = 'rgba(150,95,5,.85)'; x.fillRect(-w * 0.12, -h * 0.3, w * 0.24, h * 0.6); }
        x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(-w * 0.35, -h * 0.35, w * 0.18, h * 0.16, 0, 0, Math.PI * 2); x.fill();
        break;
      }
      case 'flame': {
        // v = flicker frame 0..3; flame points downwards (engine exhaust)
        const L = h * (0.75 + 0.2 * Math.sin(v * 2.1));
        const g = x.createLinearGradient(0, -h * 0.5, 0, L);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(160,220,255,.95)'); g.addColorStop(0.6, 'rgba(120,160,255,.55)'); g.addColorStop(1, 'rgba(120,160,255,0)');
        x.fillStyle = g;
        x.beginPath(); x.moveTo(-h * 0.32, -h * 0.5); x.quadraticCurveTo(-h * (0.2 + 0.08 * Math.sin(v)), L * 0.4, 0, L); x.quadraticCurveTo(h * (0.2 + 0.08 * Math.cos(v)), L * 0.4, h * 0.32, -h * 0.5); x.closePath(); x.fill();
        break;
      }
      case 'fire': {
        const L = h * (0.8 + 0.15 * Math.sin(v * 1.7));
        const g = x.createLinearGradient(0, h * 0.6, 0, -L);
        g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.3, 'rgba(255,190,60,.95)'); g.addColorStop(0.7, 'rgba(255,90,30,.6)'); g.addColorStop(1, 'rgba(255,60,20,0)');
        x.fillStyle = g;
        x.beginPath(); x.moveTo(-h * 0.35, h * 0.6); x.quadraticCurveTo(-h * 0.45, -L * 0.2, (rnd() - 0.5) * h * 0.2, -L); x.quadraticCurveTo(h * 0.45, -L * 0.2, h * 0.35, h * 0.6); x.closePath(); x.fill();
        break;
      }
      case 'crack': {
        x.strokeStyle = '#fff'; x.lineCap = 'round';
        const seg = (px, py, a, len, w, d) => { if (d > 3 || len < 3) return; const nx = px + Math.cos(a) * len, ny = py + Math.sin(a) * len; x.lineWidth = w; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke(); seg(nx, ny, a + (rnd() - 0.5) * 1.2, len * 0.7, w * 0.7, d + 1); if (rnd() < 0.5) seg(nx, ny, a + (rnd() - 0.5) * 2, len * 0.5, w * 0.6, d + 1); };
        for (let i = 0; i < 3; i++) seg(0, 0, rnd() * Math.PI * 2, h * 0.45, S * 0.05, 0);
        break;
      }
      default: { x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, h * 0.5, 0, Math.PI * 2); x.fill(); }
    }
    return c;
  },
  // tinted copy of a white sprite (cached)
  tinted(name, v, color) {
    return Art.cached('FXT|' + name + '|' + v + '|' + color, () => {
      const src = FxLib.get(name, v);
      const c = Art.canvas(src.width, src.height), x = c.getContext('2d');
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
      return c;
    });
  }
};
