// =====================================================================
// Colour helpers and cached sprites (glows, items)
// =====================================================================
const Col = {
  cache: new Map(),
  rgb(hex) {
    let c = Col.cache.get(hex);
    if (c) return c;
    const s = hex.replace('#', '');
    const n = parseInt(s.length === 3 ? s.split('').map(x => x + x).join('') : s, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    Col.cache.set(hex, c);
    return c;
  },
  hex(r, g, b) { return '#' + [r, g, b].map(v => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); },
  mix(a, b, t) { const A = Col.rgb(a), B = Col.rgb(b); return Col.hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); },
  shade(hex, f) { return f >= 0 ? Col.mix(hex, '#ffffff', f) : Col.mix(hex, '#000000', -f); },
  rgba(hex, a) { const c = Col.rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; },
  hsl(h, s, l) { return 'hsl(' + (h % 360) + ',' + s + '%,' + l + '%)'; },
  prism(t, off = 0) { return Col.hsl(((t * 90 + off) % 360 + 360) % 360, 90, 72); }
};

const Sprites = {
  glows: new Map(),
  items: new Map(),
  // Radial glow sprite (64px) in a given colour.
  glow(color) {
    let c = Sprites.glows.get(color);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, Col.rgba(color, 0.9));
    gr.addColorStop(0.35, Col.rgba(color, 0.45));
    gr.addColorStop(1, Col.rgba(color, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    Sprites.glows.set(color, c);
    return c;
  },
  // Path for one of the 14 item shapes centred at 0,0 with radius r.
  shapePath(ctx, shape, r) {
    ctx.beginPath();
    const poly = (n, rot = -Math.PI / 2, rr = r) => { for (let i = 0; i < n; i++) { const a = rot + i * Math.PI * 2 / n; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); };
    switch (shape) {
      case 'circle': ctx.arc(0, 0, r, 0, Math.PI * 2); break;
      case 'square': ctx.rect(-r * 0.82, -r * 0.82, r * 1.64, r * 1.64); break;
      case 'diamond': poly(4, -Math.PI / 2, r * 1.1); break;
      case 'triangle': poly(3, -Math.PI / 2, r * 1.15); break;
      case 'hexagon': poly(6, 0); break;
      case 'pentagon': poly(5); break;
      case 'octagon': poly(8, Math.PI / 8); break;
      case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r * 1.1; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); break;
      case 'cross': { const a = r * 0.36; ctx.moveTo(-a, -r); ctx.lineTo(a, -r); ctx.lineTo(a, -a); ctx.lineTo(r, -a); ctx.lineTo(r, a); ctx.lineTo(a, a); ctx.lineTo(a, r); ctx.lineTo(-a, r); ctx.lineTo(-a, a); ctx.lineTo(-r, a); ctx.lineTo(-r, -a); ctx.lineTo(-a, -a); ctx.closePath(); break; }
      case 'ring': ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.moveTo(r * 0.45, 0); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2, true); break;
      case 'crescent': ctx.arc(0, 0, r, Math.PI * 0.25, Math.PI * 1.75); ctx.arc(r * 0.45, 0, r * 0.7, Math.PI * 1.6, Math.PI * 0.4, true); ctx.closePath(); break;
      case 'drop': ctx.moveTo(0, -r * 1.15); ctx.bezierCurveTo(r * 0.9, -r * 0.2, r * 0.95, r, 0, r); ctx.bezierCurveTo(-r * 0.95, r, -r * 0.9, -r * 0.2, 0, -r * 1.15); ctx.closePath(); break;
      case 'capsule': { const w = r * 0.55; ctx.moveTo(-w, -r * 0.5); ctx.arc(0, -r * 0.5, w, Math.PI, 0); ctx.lineTo(w, r * 0.5); ctx.arc(0, r * 0.5, w, 0, Math.PI); ctx.closePath(); break; }
      case 'trapezoid': ctx.moveTo(-r * 0.55, -r * 0.8); ctx.lineTo(r * 0.55, -r * 0.8); ctx.lineTo(r, r * 0.8); ctx.lineTo(-r, r * 0.8); ctx.closePath(); break;
      default: ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
  },
  // Draws an item icon (used for sprites and UI thumbnails).
  drawItem(ctx, res, ref, r, t = 0) {
    const R = DATA.RESOURCES[res];
    const tier = DATA.TIERS[R.tier];
    const fill = R.tier === 7 ? Col.prism(t, res * 120) : R.color;
    Sprites.shapePath(ctx, R.shape, r);
    const gr = ctx.createLinearGradient(-r, -r, r, r);
    gr.addColorStop(0, Col.shade(fill, 0.35));
    gr.addColorStop(1, Col.shade(fill, -0.25));
    ctx.fillStyle = gr;
    ctx.fill('evenodd');
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.strokeStyle = R.tier === 0 ? 'rgba(20,16,18,.8)' : Col.shade(tier.color, -0.15);
    if (R.tier === 7) ctx.strokeStyle = Col.prism(t, 180);
    ctx.stroke();
    // highlight
    ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.36, r * 0.22, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill();
    if (ref > 0) {
      const rc = ref === 1 ? '#e6edf5' : ref === 2 ? '#ffcf4a' : Col.prism(t, 40);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, r * (0.12 + ref * 0.05)); ctx.strokeStyle = rc; ctx.stroke();
      if (ref >= 2) { for (let i = 0; i < ref; i++) { const a = -Math.PI / 2 + (i - (ref - 1) / 2) * 0.55; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, r * 0.2, 0, Math.PI * 2); ctx.fillStyle = rc; ctx.fill(); } }
    }
  },
  // Cached 40px sprite per (res, ref); exotic/exquisite are drawn live for animation.
  item(res, ref) {
    const key = res * 4 + ref;
    let c = Sprites.items.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 48;
    const x = c.getContext('2d');
    x.translate(24, 24);
    Sprites.drawItem(x, res, ref, 14, 0);
    Sprites.items.set(key, c);
    return c;
  },
  // Small canvas for DOM usage (codex, panels).
  itemCanvas(res, ref, size = 40, unknown = false) {
    const c = document.createElement('canvas');
    const d = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * d);
    const x = c.getContext('2d');
    x.scale(d, d); x.translate(size / 2, size / 2);
    if (unknown) {
      Sprites.shapePath(x, DATA.RESOURCES[res].shape, size * 0.3);
      x.fillStyle = '#3a3340'; x.fill('evenodd');
      x.fillStyle = '#9a8f96'; x.font = 'bold ' + Math.round(size * 0.34) + 'px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 0, 1);
    } else {
      const tier = DATA.RESOURCES[res].tier;
      if (tier > 0) { x.globalAlpha = 0.25 + tier * 0.08; x.drawImage(Sprites.glow(DATA.TIERS[tier].color), -size / 2, -size / 2, size, size); x.globalAlpha = 1; }
      Sprites.drawItem(x, res, ref, size * 0.27, 0);
    }
    return c;
  }
};
