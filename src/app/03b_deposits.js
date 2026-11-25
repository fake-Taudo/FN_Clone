// =====================================================================
// DepositArt: organic deposits anchored in the ground. Static part is a
// cached sprite per deposit; rarity spectacle is drawn per frame.
// =====================================================================
const DepositArt = {
  // static sprite (tile units: origin = bbox x0-M, y0-TOP)
  M: 1.4, TOP: 2.2,
  bbox(d) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of d.tiles) { if (t[0] < x0) x0 = t[0]; if (t[1] < y0) y0 = t[1]; if (t[0] > x1) x1 = t[0]; if (t[1] > y1) y1 = t[1]; }
    return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  },
  sprite(d, ppt) {
    return Art.cached('P|DEP|' + d.id + '|' + ppt, () => DepositArt.render(d, ppt));
  },
  render(d, ppt) {
    const bb = DepositArt.bbox(d);
    const M = DepositArt.M, TOP = DepositArt.TOP;
    const W = bb.x1 - bb.x0 + M * 2, H = bb.y1 - bb.y0 + M + TOP;
    const c = Art.canvas(W * ppt, H * ppt), x = c.getContext('2d');
    x.scale(ppt, ppt);
    x.translate(M - bb.x0, TOP - bb.y0); // now world tile coords relative
    const R = DATA.RESOURCES[d.res], sp = ItemArt.spec(d.res);
    const rnd = RNG.mulberry32(RNG.hash(d.id & 0x7fffffff, 17));
    const P = Render.palette;
    const groundDark = Col.shade(P.ground[1], -0.35);
    // 1) discoloured halo in the ground
    const haloCol = d.tier === 0 ? Col.mix(groundDark, R.color, 0.25) : d.tier >= 4 ? Col.mix(R.color, '#ffffff', 0.2) : Col.mix(groundDark, R.color, 0.45);
    for (const t of d.tiles) {
      const g = x.createRadialGradient(t[0] + 0.5, t[1] + 0.5, 0.2, t[0] + 0.5, t[1] + 0.5, 1.5);
      g.addColorStop(0, Col.rgba(haloCol, d.tier >= 4 ? 0.28 : 0.34)); g.addColorStop(1, Col.rgba(haloCol, 0));
      x.fillStyle = g; x.fillRect(t[0] - 1.2, t[1] - 1.2, 3.4, 3.4);
    }
    // 2) organic blob: union of jittered circles
    const circles = [];
    for (const t of d.tiles) {
      circles.push([t[0] + 0.5 + (rnd() - 0.5) * 0.2, t[1] + 0.5 + (rnd() - 0.5) * 0.2, 0.62 + rnd() * 0.12]);
      for (let k = 0; k < 2; k++) circles.push([t[0] + 0.5 + (rnd() - 0.5) * 1.0, t[1] + 0.5 + (rnd() - 0.5) * 1.0, 0.3 + rnd() * 0.18]);
    }
    const blob = () => { x.beginPath(); for (const [cx, cy, r] of circles) { x.moveTo(cx + r, cy); x.arc(cx, cy, r, 0, Math.PI * 2); } };
    // raised rim / dust ring
    x.save(); x.translate(0.06, 0.08); blob(); x.fillStyle = 'rgba(0,0,0,.28)'; x.fill(); x.restore();
    x.save(); x.translate(-0.04, -0.05); blob(); x.fillStyle = Col.rgba(Col.shade(P.ground[2], 0.25), 0.55); x.fill(); x.restore();
    blob();
    const bed = d.tier === 0 ? Col.mix(groundDark, R.color, 0.3) : Col.mix(Col.shade(groundDark, -0.2), R.color, 0.22);
    x.fillStyle = bed; x.fill();
    // cracks radiating out
    x.strokeStyle = Col.rgba(Col.shade(groundDark, -0.45), 0.7); x.lineCap = 'round';
    for (let i = 0; i < 3 + d.tiles.length; i++) {
      const t = d.tiles[i % d.tiles.length];
      let px = t[0] + 0.5, py = t[1] + 0.5, a = rnd() * Math.PI * 2;
      x.lineWidth = 0.05; x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 4; k++) { a += (rnd() - 0.5) * 0.9; px += Math.cos(a) * 0.3; py += Math.sin(a) * 0.3; x.lineTo(px, py); }
      x.stroke();
    }
    // speckled bed texture
    x.save(); blob(); x.clip();
    for (let i = 0; i < d.tiles.length * 14; i++) { const t = d.tiles[i % d.tiles.length]; x.fillStyle = Col.rgba(i % 3 ? '#000000' : R.color, i % 3 ? 0.18 : 0.45); x.fillRect(t[0] + rnd() * 1.2 - 0.1, t[1] + rnd() * 1.2 - 0.1, 0.06, 0.06); }
    x.restore();
    // 3) content by tier (sorted back to front)
    const items = [];
    for (const t of d.tiles) {
      const n = d.tier >= 3 ? 1 : 2 + (rnd() < 0.4 ? 1 : 0);
      for (let k = 0; k < n; k++) items.push([t[0] + 0.2 + rnd() * 0.6, t[1] + 0.3 + rnd() * 0.55, rnd()]);
    }
    items.sort((a, b) => a[1] - b[1]);
    const T = ItemArt.T(R.color);
    for (const [px, py, r] of items) DepositArt.piece(x, d, sp, px, py, r, rnd, T);
    // big centre cluster for rare deposits (silhouette grows with rarity)
    if (d.tier >= 3) {
      const cx = d.x + 0.5, cy = d.y + 0.7;
      const s = 0.55 + d.tier * 0.1;
      for (let k = 0; k < 3 + (d.tier >= 5 ? 2 : 0); k++) DepositArt.spike(x, cx + (k - 1.5) * 0.24 * s, cy + (k % 2) * 0.1, 0.16 * s + 0.05, (0.7 + (k % 2 ? 0.25 : 0.55)) * s * 1.4, (k - 1.5) * 0.22, d.tier === 7 ? ItemArt.T('#e8f4ff') : T);
      if (d.tier >= 3) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.45; x.drawImage(Sprites.glow(d.tier === 7 ? '#ffffff' : DATA.TIERS[d.tier].color), cx - 0.9, cy - 1.4, 1.8, 1.8); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
    }
    if (d.tier === 6) { // dark crater for the energy core
      const g = x.createRadialGradient(d.x + 0.5, d.y + 0.6, 0.05, d.x + 0.5, d.y + 0.6, 0.7);
      g.addColorStop(0, '#000000'); g.addColorStop(0.7, 'rgba(0,30,30,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(d.x + 0.5, d.y + 0.6, 0.7, 0.45, 0, 0, Math.PI * 2); x.fill();
    }
    return { canvas: c, ox: bb.x0 - M, oy: bb.y0 - TOP, w: W, h: H };
  },
  spike(x, px, py, w, len, a, T) {
    x.save(); x.translate(px, py); x.rotate(a);
    const body = [[-w, 0], [-w * 0.85, -len], [0, -len - w * 1.3], [w * 0.85, -len], [w, 0]];
    x.fillStyle = T.base; Art.poly(x, body); x.fill();
    x.fillStyle = T.hi; Art.poly(x, [[-w, 0], [-w * 0.85, -len], [0, -len - w * 1.3], [-w * 0.1, 0]]); x.fill();
    x.fillStyle = T.lo; Art.poly(x, [[w * 0.4, 0], [w * 0.4, -len], [0, -len - w * 1.3], [w * 0.85, -len], [w, 0]]); x.fill();
    x.strokeStyle = T.edge; x.lineWidth = 0.045; Art.poly(x, body); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 0.025; x.beginPath(); x.moveTo(-w * 0.6, -len * 0.1); x.lineTo(-w * 0.55, -len * 0.85); x.stroke();
    x.restore();
  },
  piece(x, d, sp, px, py, r, rnd, T) {
    const fam = sp.fam;
    if (d.tier >= 2 && d.tier <= 7 && sp.cat !== 'metal' && sp.cat !== 'powder') { DepositArt.spike(x, px, py, 0.1 + r * 0.06, 0.35 + r * 0.35 + d.tier * 0.05, (r - 0.5) * 0.6, T); return; }
    if (sp.cat === 'powder') {
      const w = 0.28 + r * 0.12, h = 0.18 + r * 0.15;
      x.beginPath(); x.moveTo(px - w, py); x.bezierCurveTo(px - w * 0.6, py - h * 1.4, px + w * 0.6, py - h * 1.4, px + w, py); x.closePath();
      const g = x.createLinearGradient(px - w, py - h, px + w, py); g.addColorStop(0, T.hi); g.addColorStop(1, T.lo);
      x.fillStyle = g; x.fill(); x.strokeStyle = Col.rgba(T.edge, 0.6); x.lineWidth = 0.03; x.stroke();
      return;
    }
    if (fam === 'nugget' || fam === 'granules' || sp.cat === 'metal') {
      const rr = 0.1 + r * 0.08;
      const g = x.createRadialGradient(px - rr * 0.4, py - rr * 0.5, rr * 0.1, px, py - rr * 0.3, rr * 1.2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, sp.cat === 'metal' && fam === 'ore' ? sp.c3 : T.base); g.addColorStop(1, T.edge);
      // host rock then shiny lump
      Art.facets(x, Art.blobPts(rnd, px, py - 0.06, 0.2 + r * 0.08, 0.14 + r * 0.05, 6, 0.4), px - 0.05, py - 0.1, ItemArt.T(sp.fam === 'ore' ? sp.c2 : Col.shade(Render.palette.rock, 0.1)), { lw: 0.03 });
      x.fillStyle = g; x.beginPath(); x.arc(px + 0.04, py - 0.12, rr, 0, Math.PI * 2); x.fill();
      return;
    }
    // stone chunks
    const tt = ItemArt.T(Col.shade(sp.c1, (r - 0.5) * 0.3));
    Art.facets(x, Art.blobPts(rnd, px, py - 0.1, 0.18 + r * 0.1, 0.13 + r * 0.08, 6, 0.35), px - 0.04, py - 0.14, tt, { lw: 0.035 });
  },

  // ---------------- per-frame spectacle ----------------
  dynamic(ctx, d, tm, night, zoom) {
    const t = d.tier;
    const cx = d.x + 0.5 - Render.ox, cy = d.y + 0.6 - Render.oy;
    const col = t === 7 ? Col.prism(tm, 0) : DATA.TIERS[t].color;
    const fx = !App.settings.reducedFx;
    ctx.globalCompositeOperation = 'lighter';
    // night glow (all coloured tiers)
    if (t >= 1 && night > 0.05) { ctx.globalAlpha = night * (0.25 + t * 0.07); ctx.drawImage(Sprites.glow(col), cx - 1.6, cy - 1.8, 3.2, 3.2); }
    // far beacon for legendary and above: a soft vertical beam, stronger when zoomed out
    if (t >= 4) {
      const far = U.clamp((40 - zoom) / 28, 0.25, 1);
      const pulse = 0.75 + 0.25 * Math.sin(tm * 2 + d.id);
      ctx.globalAlpha = (0.32 + night * 0.3) * far * pulse;
      ctx.drawImage(FxLib.tinted('beam', 0, col), cx - 0.9, cy - 9, 1.8, 9.4);
    }
    if (fx) {
      // sparkle glints (frequency and size by rarity)
      if (t >= 1) {
        const n = Math.min(4, t);
        for (let i = 0; i < n; i++) {
          const ph = (tm * (0.35 + t * 0.08) + i / n + Art.phase(d.id + i)) % 1;
          if (ph > 0.35) continue;
          const k = Math.sin(ph / 0.35 * Math.PI);
          const tl = d.tiles[(i * 7 + d.id) % d.tiles.length];
          const s = (0.12 + t * 0.05) * k;
          ctx.globalAlpha = k;
          ctx.drawImage(FxLib.get('glint4'), tl[0] + 0.3 + ((i * 37) % 10) / 25 - Render.ox - s, tl[1] + ((i * 53) % 10) / 20 - Render.oy - s, s * 2, s * 2);
        }
      }
      // legendary: light shimmer rising
      if (t === 4) {
        for (let i = 0; i < 3; i++) { const ph = (tm * 0.4 + i / 3) % 1; ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.7; ctx.drawImage(FxLib.tinted('soft', 0, '#ffe08a'), cx - 0.12 + Math.sin(tm + i) * 0.25, cy - 0.6 - ph * 1.6, 0.24, 0.24); }
      }
      // mythic: floating shards circling
      if (t === 5) {
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        const T = ItemArt.T(DATA.RESOURCES[d.res].color);
        for (let i = 0; i < 4; i++) {
          const a = tm * 0.8 + i * Math.PI / 2;
          const px = cx + Math.cos(a) * 0.75, py = cy - 0.9 + Math.sin(a) * 0.28 + Math.sin(tm * 2 + i) * 0.06;
          ctx.save(); ctx.translate(px, py); ctx.rotate(a);
          ctx.fillStyle = T.hi; ctx.beginPath(); ctx.moveTo(0, -0.16); ctx.lineTo(0.07, 0); ctx.lineTo(0, 0.1); ctx.lineTo(-0.07, 0); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = T.edge; ctx.lineWidth = 0.025; ctx.stroke();
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(tm * 3); ctx.drawImage(Sprites.glow(col), cx - 1, cy - 1.7, 2, 2);
      }
      // exotic: energy core, gravity rings and arcs
      if (t === 6) {
        ctx.globalAlpha = 0.8 + 0.2 * Math.sin(tm * 5); ctx.drawImage(Sprites.glow('#2ef2e0'), cx - 0.6, cy - 1.05, 1.2, 1.2);
        ctx.globalAlpha = 1; ctx.drawImage(FxLib.get('soft'), cx - 0.2, cy - 0.65, 0.4, 0.4);
        for (let i = 0; i < 2; i++) { const s = ((tm * 0.5 + i * 0.5) % 1); ctx.globalAlpha = (1 - s) * 0.7; ctx.drawImage(FxLib.tinted('ring', 0, '#2ef2e0'), cx - s * 1.4, cy - 0.45 - s * 0.55, s * 2.8, s * 1.1); }
        if ((Math.floor(tm * 6) + d.id) % 4 === 0) { ctx.globalAlpha = 0.9; ctx.save(); ctx.translate(cx, cy - 0.45); ctx.rotate(tm * 7 % 6.28); ctx.drawImage(FxLib.tinted('bolt', Math.floor(tm * 6) % 3, '#bffff8'), -0.6, -0.2, 1.2, 0.4); ctx.restore(); }
      }
      // exquisite: prismatic light pillar and shimmering splinters
      if (t === 7) {
        for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.45; ctx.drawImage(FxLib.tinted('beam', 0, Col.prism(tm, i * 120)), cx - 0.35 + (i - 1) * 0.12, cy - 5.5, 0.7, 5.6); }
        for (let i = 0; i < 5; i++) { const a = tm * 0.9 + i * 1.256; ctx.globalAlpha = 0.9; const s = 0.18; ctx.drawImage(FxLib.tinted('glint4', 0, Col.prism(tm, i * 72)), cx + Math.cos(a) * 0.8 - s, cy - 0.8 + Math.sin(a) * 0.3 - s, s * 2, s * 2); }
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
};
