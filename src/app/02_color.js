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
  // Hex colour (not an hsl() string) so it can be mixed and shaded like every other colour.
  hslHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return Col.hex(f(0) * 255, f(8) * 255, f(4) * 255);
  },
  prism(t, off = 0) { return Col.hslHex(Math.round(((t * 90 + off) % 360 + 360) % 360), 90, 72); }
};

const Sprites = {
  glows: new Map(),
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
    if (Sprites.glows.size > 400) Sprites.glows.clear();
    Sprites.glows.set(color, c);
    return c;
  },
  // Item sprite at a medium size (used by older call sites).
  item(res, ref) { return ItemArt.sprite(res, ref, 64); },
  // Draws an item centred at 0,0 in the current transform with object radius ~r.
  drawItem(ctx, res, ref, r, t = 0) {
    const m = ctx.getTransform();
    const scale = Math.hypot(m.a, m.b) || 1;
    const ext = r * 1.6;
    const px = ItemArt.sizeFor(ext * 2 * scale);
    const frame = Math.floor(((t || App.now / 1000) * 2)) & 7;
    ctx.drawImage(ItemArt.sprite(res, ref, px, 0, frame), -ext, -ext, ext * 2, ext * 2);
  },
  // Small canvas for DOM usage (codex, panels). Unknown items show a dark silhouette.
  itemCanvas(res, ref, size = 40, unknown = false) {
    const c = document.createElement('canvas');
    const d = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(size * d);
    c.width = c.height = px;
    const x = c.getContext('2d');
    const spr = ItemArt.sprite(res, ref, ItemArt.sizeFor(px));
    if (unknown) {
      x.drawImage(spr, 0, 0, px, px);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = '#3a3340'; x.fillRect(0, 0, px, px);
      x.globalCompositeOperation = 'source-over';
      x.fillStyle = '#a99fa6'; x.font = 'bold ' + Math.round(px * 0.34) + 'px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', px / 2, px / 2 + 1);
    } else x.drawImage(spr, 0, 0, px, px);
    return c;
  }
};
