// =====================================================================
// ItemArt: every resource is a composed miniature (family + variant +
// colours + detail). Refinement changes the material (bar, cut gem, pressed
// block, sealed vial) and adds silver/gold settings. LOD: S (<=26 px),
// M (<=52 px), L (bigger). Coordinates: unit radius 1 around (0,0).
// =====================================================================
// [family, variant, cat, c2, c3]   c1 = resource colour from DATA
const ITEM_SPECS = [
  // ---- Gewöhnlich ----
  ['powder', 0, 'powder', '#8a2e14'],            // Rotstaub
  ['gravel', 0, 'stone', '#3a3d43'],             // Basaltkies
  ['rock', 2, 'metal', '#6b2410', '#d2733e'],    // Eisenoxid
  ['sand', 0, 'powder', '#a7835a'],              // Regolithsand
  ['slate', 0, 'stone', '#4c5560'],              // Schiefersplitt
  ['rock', 1, 'stone', '#b9ad92', '#8c7f68'],    // Kalkstein
  ['clay', 0, 'powder', '#8c5534'],              // Tonerde
  ['rock', 3, 'stone', '#a99f8d'],               // Bimsstein
  ['rhomb', 0, 'gem', '#c98c78'],                // Feldspat
  ['sand', 1, 'powder', '#c7c0ad'],              // Quarzsand
  ['rock', 4, 'stone', '#d8d1c2'],               // Gipsbrocken
  ['gravel', 1, 'stone', '#e8e4de', '#2b2a2e'],  // Granitschotter
  ['clay', 1, 'powder', '#6e4524'],              // Lehmklumpen
  ['flakes', 0, 'powder', '#2a2a2e'],            // Ascheflocken
  ['rhomb', 1, 'gem', '#b1a184'],                // Dolomit
  ['flakes', 1, 'powder', '#efe6c8'],            // Glimmerschuppen
  ['granules', 2, 'powder', '#b8ae96'],          // Kieselgur (diatomite pellets)
  ['slate', 1, 'stone', '#b5703a', '#f0c08a'],   // Sandstein
  ['granules', 0, 'metal', '#8a93a3'],           // Magnetitkörner
  ['sand', 2, 'powder', '#5e7036'],              // Olivinsand
  ['clay', 2, 'powder', '#857356', '#c9b998'],   // Mergel
  ['plates', 1, 'powder', '#c9c3d6'],            // Talkum (soapstone tablets)
  ['powder', 3, 'powder', '#b39a1e'],            // Schwefelstaub
  ['plates', 2, 'metal', '#9aa3b3'],             // Graphitbrocken (platy graphite)
  ['glass', 0, 'gem', '#6e7fb8'],                // Obsidiansplitter
  // ---- Ungewöhnlich ----
  ['nugget', 0, 'metal', '#f0a66a'],             // Kupfernuggets
  ['ore', 0, 'metal', '#7a8088', '#eef2f6'],     // Zinnerz (light grey host)
  ['cubes', 0, 'metal', '#c6ccd6'],              // Bleiglanz
  ['crust', 1, 'metal', '#2e2622', '#f0c040', '#e0a030'], // Zinkblende (amber crystals on dark host)
  ['cubes', 1, 'salt', '#ffffff'],               // Steinsalz
  ['cubes', 2, 'salt', '#c86a6a'],               // Kalisalz
  ['ore', 2, 'metal', '#3c5a3a', '#7fe08a'],     // Nickelerz (garnierite green)
  ['ore', 3, 'metal', '#7a3418', '#e08a5a'],     // Bauxit
  ['rhomb', 3, 'metal', '#1c1e22', '#9aa6b8'],   // Chromit (octahedral crystals)
  ['nodule', 0, 'stone', '#8a7a6a', null, '#5a3a5c'], // Manganknollen (purple-black nodules)
  ['cubes', 3, 'metal', '#f7e38a'],              // Pyrit
  ['banded', 0, 'stone', '#145c3a', '#7fe0a8'],  // Malachit
  ['crust', 0, 'gem', '#4f6296', '#7fa6ff'],     // Azuritkruste (bluish host rock)
  ['needles', 0, 'salt', '#ffffff'],             // Borax
  ['saltcluster', 0, 'salt', '#ffe9c2'],         // Perchloratsalz
  ['plates', 0, 'metal', '#8a8592'],             // Ilmenit
  ['ore', 5, 'metal', '#6a4a62', '#ff9ac8'],     // Kobalterz (cobalt bloom, purple host)
  ['blades', 0, 'metal', '#9a948a'],             // Wolframit
  ['rhomb', 2, 'gem', '#7a6038'],                // Siderit
  ['cubes', 4, 'gem', '#5fd0b0'],                // Fluorit
  // ---- Selten ----
  ['ore', 6, 'metal', '#46423e', '#f4f8ff'],     // Silberader
  ['nugget', 1, 'metal', '#ece6dc'],             // Golderz (in quartz)
  ['granules', 1, 'metal', '#eef2f8'],           // Platinkörner
  ['sponge', 0, 'metal', '#d6dee8'],             // Titanschwamm
  ['gem', 0, 'gem', '#ff7a98'],                  // Rubinsplitter
  ['geode', 0, 'gem', '#6d6470', '#7fb0ff'],     // Saphirgeode
  ['crystal', 0, 'gem', '#9ff0c0'],              // Smaragdkristall
  ['saltcluster', 1, 'gem', '#5a5060', '#d8a8ff'], // Amethystdruse (crystal druse)
  ['gem', 1, 'gem', '#ffd29a'],                  // Topas
  ['opal', 0, 'gem', '#ff9ad8', '#7affd8'],      // Mondopal
  ['powder', 4, 'metal', '#eef2fa'],             // Iridiumstaub
  ['blades', 1, 'metal', '#c8ccd2'],             // Palladiumerz (platy metal)
  ['crystal', 1, 'gem', '#fff0f8'],              // Lithiumkristall
  ['geode', 2, 'gem', '#6a6a5a', '#bff6e6'],     // Berylliumgeode
  ['flakes', 2, 'metal', '#ffffff'],             // Rhodiumflitter
  ['needles', 1, 'gem', '#ff7ab8'],              // Turmalinnadel
  // ---- Episch ----
  ['meteor', 0, 'metal', '#a7a4ae'],             // Meteoreisen
  ['crystal', 2, 'gem', '#ffd0f4'],              // Plasmaquarz
  ['glowrock', 0, 'stone', '#2c2f22'],           // Uraninit
  ['glass', 1, 'gem', '#e8fff4'],                // Thoriumglas
  ['ice', 0, 'gem', '#e6fbff'],                  // Kryonit
  ['fulgurite', 0, 'gem', '#fff6c0'],            // Fulguritkern
  ['glass', 2, 'gem', '#8fd6a0'],                // Tektitglas
  ['pallasite', 0, 'metal', '#a7ff5a'],          // Pallasit
  ['crystal', 3, 'gem', '#dff1ff'],              // Ionenkristall
  ['dense', 0, 'gem', '#3c3080'],                // Neutronit-Spat
  ['ice', 1, 'gem', '#bfe6ff'],                  // Helium-3-Eis
  ['ore', 8, 'metal', '#2a3038', '#4ff0ff'],     // Supraleitererz
  // ---- Legendär ----
  ['xenosteel', 0, 'special', '#5a2f8a'],
  ['starmetal', 0, 'special', '#fff3c0'],
  ['aurora', 0, 'special', '#7affc8', '#b07aff'],
  ['quantum', 0, 'special', '#7af0ff'],
  ['phasemithril', 0, 'special', '#a8c8ff'],
  ['mistpearl', 0, 'special', '#ffe6f6'],
  ['graviton', 0, 'special', '#ffd0a0'],
  ['chronoquartz', 0, 'special', '#a0702a'],
  // ---- Mythisch ----
  ['dragonglass', 0, 'special', '#1a0a0e', '#ff3a1a'],
  ['leviathan', 0, 'special', '#5a2a08'],
  ['soulcrystal', 0, 'special', '#ffffff'],
  ['phoenixash', 0, 'special', '#ffcf5a'],
  ['titanblood', 0, 'special', '#5a0010'],
  // ---- Exotisch ----
  ['antimatter', 0, 'special', '#0a0f1a'],
  ['darkmatter', 0, 'special', '#000000'],
  ['singularity', 0, 'special', '#e6fffa'],
  // ---- Exquisit ----
  ['starheart', 0, 'special'],
  ['prism', 0, 'special']
];

const ItemArt = {
  // s[5] (optional) overrides the drawing colour only (DATA colour stays the UI colour)
  spec(res) { const s = ITEM_SPECS[res] || ['rock', 0, 'stone']; return { fam: s[0], v: s[1], cat: s[2], c1: s[5] || DATA.RESOURCES[res].color, c2: s[3] || Col.shade(DATA.RESOURCES[res].color, -0.4), c3: s[4] || Col.shade(DATA.RESOURCES[res].color, 0.4), tier: DATA.RESOURCES[res].tier, res }; },
  T(hex) { return { hi: Col.shade(hex, 0.35), base: hex, lo: Col.shade(hex, -0.35), edge: Col.shade(hex, -0.7), rim: Col.shade(hex, 0.6) }; },
  lum(hex) { const c = Col.rgb(hex); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; },

  // ---------------- public API ----------------
  // size bucket in device pixels for a sprite of the given on-screen diameter
  sizeFor(px) { const B = [16, 20, 24, 32, 40, 48, 64, 96, 128, 192, 256]; for (const b of B) if (b >= px) return b; return 256; },
  // rot: -1, 0, 1 (±6° variants for belts); frame: animation frame for prismatic items
  // outline: dark ring, light ring for very dark items or on very dark planet grounds (contrast >= 3:1)
  ringColor(sp) {
    const dark = ItemArt.lum(sp.c1) < 0.13 || sp.fam === 'darkmatter' || sp.fam === 'antimatter';
    if (Render.darkGround || (dark && !Render.lightGround)) return '#c8d2eb';
    return Col.shade(sp.c1, -0.86);
  },
  sprite(res, ref, sizePx, rot = 0, frame = 0) {
    const tier = DATA.RESOURCES[res].tier;
    const f = tier === 7 ? frame & 7 : 0;
    const dg = Render.darkGround ? 1 : Render.lightGround ? 2 : 0;
    return Art.cached('IT|' + res + '|' + ref + '|' + sizePx + '|' + rot + '|' + f + '|' + dg, () => ItemArt.render(res, ref, sizePx, rot, f));
  },
  render(res, ref, S, rot, frame) {
    const sp = ItemArt.spec(res);
    const ppu = S / 2.7;
    const simple = S <= 26, medium = S <= 52;
    const o = { simple, medium, ppu, lw: Math.max(0.05, 1.3 / ppu), t: frame / 2, ref };
    // object layer
    const O = Art.canvas(S, S), ox = O.getContext('2d');
    ox.translate(S / 2, S / 2); ox.scale(ppu, ppu);
    if (rot) { ox.translate(0, 0.2); ox.rotate(rot * 0.105); ox.translate(0, -0.2); }
    ItemArt.drawObject(ox, sp, ref, o);
    // final sprite: rarity backdrop, contact shadow, outline ring, object
    const c = Art.canvas(S, S), x = c.getContext('2d');
    x.save(); x.translate(S / 2, S / 2); x.scale(ppu, ppu);
    ItemArt.backdrop(x, sp, o);
    const floating = sp.tier >= 5 && sp.cat === 'special';
    x.fillStyle = 'rgba(0,0,0,' + (floating ? 0.22 : 0.38) + ')';
    x.beginPath(); x.ellipse(0.04, 0.9, floating ? 0.42 : 0.66, floating ? 0.1 : 0.16, 0, 0, Math.PI * 2); x.fill();
    x.restore();
    // outline ring from the object's alpha mask (dark, or light for very dark items)
    const ring = Art.canvas(S, S), rx = ring.getContext('2d');
    rx.drawImage(O, 0, 0); rx.globalCompositeOperation = 'source-in';
    const rc = ItemArt.ringColor(sp);
    const w = Math.max(1, simple ? 1.6 : 1.3) * (S >= 96 ? S / 64 : 1);
    // light halo outside a dark outline: keeps >= 3:1 contrast on mid-bright and dark grounds
    {
      rx.fillStyle = rc === '#c8d2eb' ? '#0c0a12' : '#fff4e2'; rx.fillRect(0, 0, S, S);
      x.globalAlpha = 0.7;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.drawImage(ring, Math.cos(a) * w * 2, Math.sin(a) * w * 2); }
      x.globalAlpha = 1;
    }
    rx.fillStyle = rc; rx.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.drawImage(ring, Math.cos(a) * w, Math.sin(a) * w); }
    x.drawImage(O, 0, 0);
    // rarity foreground (glints) baked lightly
    x.save(); x.translate(S / 2, S / 2); x.scale(ppu, ppu);
    ItemArt.foreground(x, sp, o, ref);
    x.restore();
    return c;
  },
  // Draws behind the object: tier glows, fans, auras
  backdrop(x, sp, o) {
    const t = sp.tier;
    if (t >= 2 && !o.simple) {
      const col = t === 7 ? Col.prism(o.t, 0) : DATA.TIERS[t].color;
      x.globalAlpha = 0.18 + t * 0.06;
      x.drawImage(Sprites.glow(col), -1.25, -1.25, 2.5, 2.5);
      x.globalAlpha = 1;
    }
    if (t >= 4 && !o.simple) {
      x.globalAlpha = t === 4 ? 0.45 : 0.3;
      x.drawImage(FxLib.tinted('fan', 0, t === 4 ? '#ffd76a' : t === 7 ? Col.prism(o.t, 90) : DATA.TIERS[t].color), -1.3, -1.45, 2.6, 2.6);
      x.globalAlpha = 1;
    }
    if (t === 6 && !o.simple) { x.strokeStyle = Col.rgba('#2ef2e0', 0.5); x.lineWidth = 0.05; x.beginPath(); x.ellipse(0, 0.05, 1.05, 0.38, -0.25, 0, Math.PI * 2); x.stroke(); }
  },
  foreground(x, sp, o, ref) {
    if (o.simple) return;
    if (ref >= 3) { Art.glint(x, -0.45, -0.55, 0.2); Art.glint(x, 0.55, -0.2, 0.12); Art.glint(x, 0.2, 0.45, 0.09); }
    if (sp.tier === 7) { Art.glint(x, 0.5, -0.62, 0.32, '#ffffff'); }
    else if (sp.tier >= 4) Art.glint(x, 0.48, -0.55, 0.16, sp.tier === 4 ? '#fff1b0' : '#ffffff');
  },

  // Object with refinement stage
  drawObject(x, sp, ref, o) {
    if (ref === 0) { ItemArt.raw(x, sp, o); return; }
    const mounted = ref >= 2;
    if (mounted) ItemArt.mount(x, ref === 3 ? 'gold' : 'silver', o, true);
    x.save();
    if (mounted) { x.translate(0, -0.12); x.scale(0.8, 0.8); }
    ItemArt.refined(x, sp, o, ref);
    x.restore();
    if (mounted) ItemArt.mount(x, ref === 3 ? 'gold' : 'silver', o, false);
  },
  // setting: pedestal behind (back=true) and prongs in front
  mount(x, kind, o, back) {
    const T = kind === 'gold' ? Art.pal('gold') : Art.pal('white');
    if (back) {
      // pedestal
      const g = x.createLinearGradient(-0.55, 0, 0.55, 0); g.addColorStop(0, T.hi); g.addColorStop(0.5, T.base); g.addColorStop(1, T.lo);
      x.fillStyle = g;
      x.beginPath(); x.moveTo(-0.55, 0.6); x.lineTo(0.55, 0.6); x.lineTo(0.42, 0.82); x.lineTo(-0.42, 0.82); x.closePath(); x.fill();
      x.fillStyle = T.hi; x.beginPath(); x.ellipse(0, 0.6, 0.55, 0.12, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = T.edge; x.lineWidth = o.lw; x.stroke();
      // prong arms behind the object
      x.strokeStyle = T.base; x.lineWidth = 0.11; x.lineCap = 'round';
      x.beginPath(); x.moveTo(-0.35, 0.55); x.quadraticCurveTo(-0.78, 0.2, -0.62, -0.35); x.moveTo(0.35, 0.55); x.quadraticCurveTo(0.78, 0.2, 0.62, -0.35); x.stroke();
      if (!o.simple) { x.strokeStyle = T.rim; x.lineWidth = 0.035; x.beginPath(); x.moveTo(-0.38, 0.5); x.quadraticCurveTo(-0.74, 0.2, -0.6, -0.3); x.stroke(); }
    } else {
      // prong tips over the object edge
      x.fillStyle = T.hi;
      for (const px of [-0.6, 0.6]) { x.beginPath(); x.arc(px, -0.32, 0.09, 0, Math.PI * 2); x.fill(); x.strokeStyle = T.edge; x.lineWidth = o.lw * 0.7; x.stroke(); }
      if (kind === 'gold' && !o.simple) { x.fillStyle = '#ff5a7a'; x.beginPath(); x.arc(0, 0.71, 0.06, 0, Math.PI * 2); x.fill(); }
    }
  },

  // ---------------- raw painters ----------------
  raw(x, sp, o) {
    const rnd = RNG.mulberry32(RNG.hash(sp.res, 4711));
    const f = ItemArt.P[sp.fam] || ItemArt.P.rock;
    f(x, sp, rnd, o);
  },
  P: {
    rock(x, sp, rnd, o) {
      const t = ItemArt.T(sp.c1);
      const v = sp.v;
      let pts;
      if (v === 1) pts = [[-0.72, -0.12], [-0.45, -0.5], [0.35, -0.55], [0.75, -0.2], [0.7, 0.45], [0.2, 0.62], [-0.55, 0.55], [-0.78, 0.2]];
      else if (v === 5) pts = [[-0.85, 0.1], [-0.35, -0.35], [0.5, -0.45], [0.88, -0.05], [0.45, 0.42], [-0.4, 0.5]];
      else pts = Art.blobPts(rnd, 0, 0.05, v === 4 ? 0.72 : 0.78, v === 3 ? 0.66 : 0.62, v === 4 ? 10 : 7, v === 4 ? 0.12 : 0.32);
      if (v === 3 || v === 4) { x.fillStyle = t.base; Art.smoothPath(x, pts); x.fill(); const g = x.createRadialGradient(-0.3, -0.3, 0.05, 0, 0, 0.9); g.addColorStop(0, Col.rgba(t.hi, 0.9)); g.addColorStop(1, Col.rgba(t.lo, 0.6)); x.fillStyle = g; x.fill(); }
      else Art.facets(x, pts, -0.12, -0.1, t, { lw: o.lw * 0.6 });
      if (o.simple) return;
      if (v === 2) { // rust patches
        for (let i = 0; i < 6; i++) { x.fillStyle = Col.rgba(i % 2 ? sp.c2 : sp.c3, 0.75); x.beginPath(); x.ellipse((rnd() - 0.5) * 0.9, (rnd() - 0.4) * 0.7, 0.12 + rnd() * 0.12, 0.07 + rnd() * 0.08, rnd() * 3, 0, Math.PI * 2); x.fill(); }
      } else if (v === 3) { // pumice pores
        for (let i = 0; i < 16; i++) { const px = (rnd() - 0.5) * 1.2, py = (rnd() - 0.5) * 0.9; if (px * px / 0.5 + py * py / 0.3 > 0.8) continue; x.fillStyle = Col.rgba(sp.c2, 0.9); x.beginPath(); x.arc(px, py, 0.035 + rnd() * 0.05, 0, Math.PI * 2); x.fill(); }
      } else if (v === 4) { // gypsum fibres
        x.strokeStyle = Col.rgba('#ffffff', 0.6); x.lineWidth = 0.025; for (let i = 0; i < 7; i++) { const yy = -0.4 + i * 0.13; x.beginPath(); x.moveTo(-0.55, yy); x.quadraticCurveTo(0, yy - 0.1, 0.55, yy + 0.05); x.stroke(); }
      } else if (v === 1) { // limestone: fossil shell imprint
        x.strokeStyle = Col.rgba(sp.c3, 0.8); x.lineWidth = 0.035; x.beginPath(); for (let a = 0; a < 9; a += 0.3) { const r = 0.03 + a * 0.025; x.lineTo(0.15 + Math.cos(a) * r, 0.1 + Math.sin(a) * r); } x.stroke();
      } else if (v === 5) { // graphite metallic streaks
        x.strokeStyle = 'rgba(220,230,245,.55)'; x.lineWidth = 0.05; x.beginPath(); x.moveTo(-0.45, -0.1); x.lineTo(0.35, -0.3); x.moveTo(-0.3, 0.15); x.lineTo(0.5, -0.05); x.stroke();
      } else { for (let i = 0; i < 10; i++) { x.fillStyle = Col.rgba(rnd() < 0.5 ? t.lo : t.hi, 0.6); x.fillRect((rnd() - 0.5) * 1.1, (rnd() - 0.4) * 0.8, 0.05, 0.05); } }
    },
    slate(x, sp, rnd, o) {
      const t = ItemArt.T(sp.c1);
      if (sp.v === 0) {
        for (let i = 0; i < 3; i++) {
          const yy = 0.35 - i * 0.32, sx = (i - 1) * 0.12;
          const pts = [[-0.8 + sx, yy], [-0.55 + sx, yy - 0.28], [0.7 + sx, yy - 0.38], [0.85 + sx, yy - 0.1], [0.6 + sx, yy + 0.08]];
          Art.facets(x, pts, sx, yy - 0.15, i === 2 ? t : ItemArt.T(Col.shade(sp.c1, -0.1 * (2 - i))), { lw: o.lw * 0.6 });
          if (!o.simple) { x.strokeStyle = Col.rgba(t.rim, 0.5); x.lineWidth = 0.03; x.beginPath(); x.moveTo(-0.5 + sx, yy - 0.2); x.lineTo(0.6 + sx, yy - 0.3); x.stroke(); }
        }
      } else {
        // banded sandstone block
        Art.box(x, -0.7, -0.15, 1.4, 0.75, 0.9, t, { lw: 0.03, outline: o.lw * 0.6 });
        if (!o.simple) for (let i = 0; i < 4; i++) { x.fillStyle = Col.rgba(i % 2 ? sp.c3 : sp.c2, 0.55); x.fillRect(-0.7, 0.13 + i * 0.1, 1.4, 0.05); x.fillRect(-0.7, -0.62 + i * 0.18, 1.4, 0.06); }
      }
    },
    gravel(x, sp, rnd, o) {
      const n = sp.v === 0 ? 4 : 5;
      const pos = sp.v === 0 ? [[-0.4, 0.3, 0.38], [0.35, 0.32, 0.36], [-0.05, -0.2, 0.42], [0.5, -0.25, 0.25]] : [[-0.5, 0.35, 0.3], [0.1, 0.4, 0.33], [0.55, 0.15, 0.28], [-0.25, -0.15, 0.34], [0.3, -0.35, 0.3]];
      for (let i = 0; i < n; i++) {
        const [px, py, r] = pos[i];
        const tt = ItemArt.T(Col.shade(sp.c1, (rnd() - 0.5) * 0.25));
        const pts = Art.blobPts(rnd, px, py, r, r * 0.8, sp.v === 0 ? 8 : 5, sp.v === 0 ? 0.15 : 0.4);
        if (sp.v === 0) { x.fillStyle = tt.base; Art.smoothPath(x, pts); x.fill(); x.strokeStyle = tt.edge; x.lineWidth = o.lw * 0.6; x.stroke(); x.fillStyle = Col.rgba(tt.hi, 0.8); x.beginPath(); x.ellipse(px - r * 0.3, py - r * 0.35, r * 0.35, r * 0.2, -0.5, 0, Math.PI * 2); x.fill(); }
        else { Art.facets(x, pts, px - r * 0.2, py - r * 0.2, tt, { lw: o.lw * 0.6 }); if (!o.simple) for (let k = 0; k < 6; k++) { x.fillStyle = k % 2 ? sp.c2 : sp.c3; x.fillRect(px + (rnd() - 0.5) * r * 1.2, py + (rnd() - 0.5) * r, 0.05, 0.05); } }
      }
    },
    powder(x, sp, rnd, o) {
      const t = ItemArt.T(sp.c1);
      const v = sp.v;
      const w = v === 1 ? 0.95 : v === 2 ? 0.8 : 0.75, ht = v === 0 ? 1.15 : v === 1 ? 0.6 : v === 2 ? 0.8 : 0.95;
      const base = 0.62;
      x.beginPath();
      x.moveTo(-w, base);
      if (v === 0) { x.quadraticCurveTo(-w * 0.45, base - ht * 0.45, -0.06, base - ht); x.quadraticCurveTo(0.06, base - ht - 0.04, 0.12, base - ht + 0.02); x.quadraticCurveTo(w * 0.5, base - ht * 0.45, w, base); }
      else x.bezierCurveTo(-w * 0.85, base - ht, w * 0.85, base - ht, w, base);
      x.ellipse(0, base, w, 0.16, 0, 0, Math.PI);
      x.closePath();
      const g = x.createLinearGradient(-w, base - ht, w, base);
      g.addColorStop(0, t.hi); g.addColorStop(0.55, t.base); g.addColorStop(1, t.lo);
      x.fillStyle = g; x.fill();
      x.strokeStyle = t.edge; x.lineWidth = o.lw * 0.6; x.stroke();
      if (o.simple) return;
      x.save(); x.clip();
      const n = v === 4 ? 40 : 30;
      for (let i = 0; i < n; i++) {
        const px = (rnd() - 0.5) * 2 * w, py = base - rnd() * ht;
        if (v === 3 && i % 4 === 0) { x.fillStyle = Col.rgba('#fff7a0', 0.9); x.beginPath(); x.moveTo(px, py - 0.08); x.lineTo(px + 0.05, py); x.lineTo(px, py + 0.04); x.lineTo(px - 0.05, py); x.fill(); continue; }
        x.fillStyle = v === 4 ? (i % 3 ? 'rgba(255,255,255,.9)' : Col.rgba(t.lo, 0.8)) : Col.rgba(i % 2 ? t.lo : t.hi, 0.7);
        x.fillRect(px, py, 0.045, 0.045);
      }
      x.restore();
      if (v === 4) { Art.glint(x, -0.2, -0.05, 0.12); Art.glint(x, 0.35, 0.25, 0.08); }
    },
    sand(x, sp, rnd, o) {
      const t = ItemArt.T(sp.c1);
      x.beginPath(); x.moveTo(-0.95, 0.62); x.bezierCurveTo(-0.7, 0.05, -0.2, -0.05, 0.1, 0.05); x.bezierCurveTo(0.45, -0.1, 0.8, 0.2, 0.95, 0.62); x.ellipse(0, 0.62, 0.95, 0.15, 0, 0, Math.PI); x.closePath();
      const g = x.createLinearGradient(-0.9, 0, 0.9, 0.6); g.addColorStop(0, t.hi); g.addColorStop(1, t.lo); x.fillStyle = g; x.fill();
      x.strokeStyle = t.edge; x.lineWidth = o.lw * 0.6; x.stroke();
      if (o.simple) return;
      x.save(); x.clip();
      x.strokeStyle = Col.rgba(t.lo, 0.7); x.lineWidth = 0.035; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-0.8, 0.2 + i * 0.12); x.bezierCurveTo(-0.3, 0.12 + i * 0.12, 0.2, 0.3 + i * 0.1, 0.85, 0.2 + i * 0.12); x.stroke(); }
      for (let i = 0; i < 26; i++) { x.fillStyle = Col.rgba(i % 2 ? t.hi : sp.c2, 0.8); x.fillRect((rnd() - 0.5) * 1.8, 0.05 + rnd() * 0.6, 0.04, 0.04); }
      x.restore();
      if (sp.v === 1) { Art.glint(x, -0.25, 0.15, 0.1); Art.glint(x, 0.4, 0.3, 0.07); }
    },
    clay(x, sp, rnd, o) {
      const t = ItemArt.T(sp.c1);
      const lumps = sp.v === 1 ? [[-0.35, 0.2, 0.48], [0.38, 0.05, 0.42]] : [[0, 0.05, 0.75]];
      for (const [px, py, r] of lumps) {
        const pts = Art.blobPts(rnd, px, py, r, r * 0.78, 9, 0.18);
        Art.smoothPath(x, pts);
        const g = x.createRadialGradient(px - r * 0.35, py - r * 0.35, r * 0.1, px, py, r * 1.1); g.addColorStop(0, t.hi); g.addColorStop(0.6, t.base); g.addColorStop(1, t.lo);
        x.fillStyle = g; x.fill(); x.strokeStyle = t.edge; x.lineWidth = o.lw * 0.6; x.stroke();
        if (!o.simple) {
          if (sp.v === 2) { x.save(); x.clip(); for (let i = 0; i < 4; i++) { x.fillStyle = Col.rgba(i % 2 ? sp.c3 : sp.c2, 0.5); x.fillRect(px - r, py - r * 0.5 + i * r * 0.32, r * 2, r * 0.12); } x.restore(); }
          else { x.fillStyle = Col.rgba(t.lo, 0.55); for (let i = 0; i < 2; i++) { x.beginPath(); x.ellipse(px + (i - 0.5) * r * 0.6, py + r * 0.15, r * 0.14, r * 0.22, 0.3, 0, Math.PI * 2); x.fill(); } }
        }
      }
    },
    flakes(x, sp, rnd, o) {
      const n = sp.v === 0 ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const px = (rnd() - 0.5) * 0.9, py = 0.4 - i * 0.18 + (rnd() - 0.5) * 0.1;
        const tt = ItemArt.T(Col.shade(sp.c1, (rnd() - 0.5) * 0.3));
        x.save(); x.translate(px, py); x.rotate((rnd() - 0.5) * 0.8);
        const pts = sp.v === 1 ? [[-0.42, 0], [-0.2, -0.2], [0.25, -0.2], [0.45, 0], [0.22, 0.18], [-0.22, 0.18]] : Art.blobPts(rnd, 0, 0, 0.42, 0.2, 6, 0.45);
        Art.poly(x, pts);
        const g = x.createLinearGradient(-0.4, -0.2, 0.4, 0.2);
        if (sp.v === 2) { g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#b9c3d6'); g.addColorStop(1, '#ffffff'); }
        else { g.addColorStop(0, tt.hi); g.addColorStop(1, tt.lo); }
        x.fillStyle = g; x.fill(); x.strokeStyle = tt.edge; x.lineWidth = o.lw * 0.5; x.stroke();
        if (!o.simple && sp.v !== 0) { x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 0.03; x.beginPath(); x.moveTo(-0.25, -0.1); x.lineTo(0.2, -0.12); x.stroke(); }
        x.restore();
      }
      if (sp.v === 2 && !o.simple) { Art.glint(x, 0.2, -0.3, 0.18); Art.glint(x, -0.35, 0.1, 0.1); }
    },
    rhomb(x, sp, rnd, o) {
      const t = ItemArt.T(sp.c1);
      const one = (cx, cy, s, sk) => {
        const top = [[cx - s * 0.5 + sk, cy - s * 0.5], [cx + s * 0.6 + sk, cy - s * 0.5], [cx + s * 0.4, cy - s * 0.15], [cx - s * 0.7, cy - s * 0.15]];
        const front = [[cx - s * 0.7, cy - s * 0.15], [cx + s * 0.4, cy - s * 0.15], [cx + s * 0.4 - sk * 0.4, cy + s * 0.6], [cx - s * 0.7 - sk * 0.4, cy + s * 0.6]];
        const side = [[cx + s * 0.4, cy - s * 0.15], [cx + s * 0.6 + sk, cy - s * 0.5], [cx + s * 0.6 + sk * 0.6, cy + s * 0.25], [cx + s * 0.4 - sk * 0.4, cy + s * 0.6]];
        x.fillStyle = t.hi; Art.poly(x, top); x.fill(); x.fillStyle = t.base; Art.poly(x, front); x.fill(); x.fillStyle = t.lo; Art.poly(x, side); x.fill();
        x.strokeStyle = t.edge; x.lineWidth = o.lw * 0.6; for (const p of [top, front, side]) { Art.poly(x, p); x.stroke(); }
      };
      if (sp.v === 0) { one(0, 0.1, 1.15, 0.25); if (!o.simple) { x.strokeStyle = Col.rgba('#ffffff', 0.45); x.lineWidth = 0.03; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(-0.7, 0.05 + i * 0.15); x.lineTo(0.38, 0.05 + i * 0.15); x.stroke(); } } }
      else if (sp.v === 1) { one(-0.32, 0.2, 0.8, 0.18); one(0.35, -0.05, 0.75, -0.12); }
      else { one(-0.35, 0.25, 0.65, 0.3); one(0.3, 0.3, 0.6, 0.2); one(0, -0.25, 0.7, 0.25); }
    },
    granules(x, sp, rnd, o) {
      const metal = sp.v === 0;
      const n = o.simple ? 7 : 12;
      const pts = [];
      for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.62; pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.75 + 0.1, 0.16 + rnd() * 0.1]); }
      pts.sort((a, b) => a[1] - b[1]);
      for (const [px, py, r] of pts) {
        const g = x.createRadialGradient(px - r * 0.4, py - r * 0.4, r * 0.05, px, py, r);
        g.addColorStop(0, metal ? '#c8d0dc' : '#ffffff'); g.addColorStop(0.5, sp.c1); g.addColorStop(1, Col.shade(sp.c1, -0.5));
        x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
        x.strokeStyle = Col.shade(sp.c1, -0.7); x.lineWidth = o.lw * 0.5; x.stroke();
      }
    },
    glass(x, sp, rnd, o) {
      const t = ItemArt.T(sp.c1);
      if (sp.v === 0) {
        const pts = [[-0.75, 0.45], [-0.55, -0.3], [-0.1, -0.78], [0.35, -0.45], [0.78, 0.05], [0.45, 0.55], [-0.2, 0.62]];
        Art.facets(x, pts, 0.05, 0.0, { hi: '#3a3558', base: sp.c1, lo: '#0c0a12', edge: '#05040a' }, { lw: o.lw * 0.6 });
        if (!o.simple) { x.strokeStyle = Col.rgba(sp.c2, 0.9); x.lineWidth = 0.05; x.beginPath(); x.arc(-0.1, 0.05, 0.42, -2.6, -1.2); x.stroke(); x.beginPath(); x.arc(-0.1, 0.05, 0.25, -2.4, -1.4); x.stroke(); }
      } else if (sp.v === 1) {
        const pts = Art.blobPts(rnd, 0, 0.05, 0.7, 0.62, 9, 0.2);
        Art.smoothPath(x, pts);
        const g = x.createRadialGradient(0, 0.1, 0.05, 0, 0.05, 0.75); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, sp.c2); g.addColorStop(1, Col.shade(sp.c1, -0.25));
        x.fillStyle = g; x.fill(); x.strokeStyle = t.edge; x.lineWidth = o.lw * 0.6; x.stroke();
        if (!o.simple) { x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 0.06; x.beginPath(); x.arc(-0.1, -0.05, 0.45, -2.7, -1.6); x.stroke(); }
      } else {
        x.beginPath(); x.moveTo(0, -0.85); x.bezierCurveTo(0.55, -0.3, 0.65, 0.55, 0, 0.62); x.bezierCurveTo(-0.65, 0.55, -0.55, -0.3, 0, -0.85); x.closePath();
        const g = x.createLinearGradient(-0.5, -0.6, 0.5, 0.6); g.addColorStop(0, t.hi); g.addColorStop(1, t.lo); x.fillStyle = g; x.fill(); x.strokeStyle = t.edge; x.lineWidth = o.lw * 0.6; x.stroke();
        if (!o.simple) { x.strokeStyle = Col.rgba(sp.c2, 0.8); x.lineWidth = 0.04; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(0, 0.2, 0.15 + i * 0.12, -2.5, -0.6); x.stroke(); } x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(-0.18, -0.2, 0.08, 0.2, 0.3, 0, Math.PI * 2); x.fill(); }
      }
    },
    nugget(x, sp, rnd, o) {
      if (sp.v === 1) { // gold in quartz
        const q = ItemArt.T(sp.c2);
        const pts = Art.blobPts(rnd, 0, 0.12, 0.8, 0.6, 7, 0.3);
        Art.facets(x, pts, -0.1, 0, q, { lw: o.lw * 0.6 });
      }
      const lumps = sp.v === 1 ? [[0.1, -0.05, 0.38], [-0.3, 0.2, 0.22]] : [[-0.32, 0.18, 0.42], [0.35, 0.22, 0.34], [0.05, -0.3, 0.32]];
      const col = sp.v === 1 ? '#f2c84b' : sp.c1;
      for (const [px, py, r] of lumps) {
        const pts = Art.blobPts(rnd, px, py, r, r * 0.82, 8, 0.35);
        Art.smoothPath(x, pts);
        const g = x.createLinearGradient(px - r, py - r, px + r, py + r); g.addColorStop(0, Col.shade(col, 0.6)); g.addColorStop(0.4, col); g.addColorStop(1, Col.shade(col, -0.55));
        x.fillStyle = g; x.fill(); x.strokeStyle = Col.shade(col, -0.7); x.lineWidth = o.lw * 0.6; x.stroke();
        x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = o.simple ? 0.08 : 0.05; x.beginPath(); x.moveTo(px - r * 0.5, py - r * 0.15); x.lineTo(px - r * 0.05, py - r * 0.55); x.stroke();
      }
    },
    ore(x, sp, rnd, o) {
      const host = ItemArt.T(sp.c2);
      const v = sp.v;
      const pts = Art.blobPts(rnd, 0, 0.08, 0.82, 0.64, 7 + (v % 3), 0.3, v * 0.4);
      Art.facets(x, pts, -0.1, -0.05, host, { lw: o.lw * 0.6 });
      x.save(); Art.poly(x, pts); x.clip();
      const vc = sp.c3, vt = ItemArt.T(vc);
      if (v === 3) { for (let i = 0; i < 9; i++) { x.fillStyle = vt.base; x.beginPath(); x.arc((rnd() - 0.5) * 1.2, (rnd() - 0.4) * 0.9, 0.1 + rnd() * 0.06, 0, Math.PI * 2); x.fill(); } }
      else if (v === 1 || v === 7) { for (let i = 0; i < (o.simple ? 3 : 6); i++) { const px = (rnd() - 0.5) * 1.1, py = (rnd() - 0.4) * 0.8; Art.facets(x, [[px - 0.12, py], [px, py - 0.16], [px + 0.14, py], [px, py + 0.12]], px, py, vt, { lw: 0.02 }); } }
      else if (v === 5) { for (let i = 0; i < 5; i++) { x.fillStyle = Col.rgba(vt.base, 0.85); x.beginPath(); x.ellipse((rnd() - 0.5) * 1.1, (rnd() - 0.4) * 0.8, 0.16, 0.1, rnd() * 3, 0, Math.PI * 2); x.fill(); } }
      else {
        x.strokeStyle = v === 8 ? vc : vt.base; x.lineCap = 'round';
        const n = o.simple ? 2 : 4;
        for (let i = 0; i < n; i++) {
          x.lineWidth = (o.simple ? 0.12 : 0.07) + rnd() * 0.05;
          x.beginPath(); let px = -0.8, py = (rnd() - 0.5) * 0.8; x.moveTo(px, py);
          for (let k = 0; k < 5; k++) { px += 0.35; py += (rnd() - 0.5) * 0.35; x.lineTo(px, py); }
          x.stroke();
          if (!o.simple) { x.strokeStyle = Col.rgba('#ffffff', 0.5); x.lineWidth = 0.025; x.stroke(); x.strokeStyle = v === 8 ? vc : vt.base; }
        }
        if (v === 8 && !o.simple) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.5; x.drawImage(Sprites.glow(vc), -0.8, -0.7, 1.6, 1.5); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
      }
      x.restore();
    },
    cubes(x, sp, rnd, o) {
      const v = sp.v;
      const clear = v === 1 || v === 4;
      const set = v === 0 ? [[-0.32, 0.25, 0.5], [0.32, 0.3, 0.42], [0.02, -0.25, 0.46]] : v === 3 ? [[-0.25, 0.22, 0.6], [0.4, -0.1, 0.42]] : v === 2 ? [[-0.35, 0.3, 0.42], [0.3, 0.25, 0.48], [-0.05, -0.2, 0.4], [0.45, -0.3, 0.26]] : v === 4 ? [[-0.15, 0.18, 0.72]] : [[-0.3, 0.2, 0.55], [0.35, 0.12, 0.5]];
      for (const [cx, cy, s] of set.sort((a, b) => a[1] - b[1])) {
        const c = v === 4 ? sp.c1 : v === 2 ? Col.mix(sp.c1, sp.c2, rnd() * 0.5) : sp.c1;
        const t = ItemArt.T(c);
        const top = [[cx, cy - s * 0.85], [cx + s * 0.62, cy - s * 0.55], [cx, cy - s * 0.25], [cx - s * 0.62, cy - s * 0.55]];
        const left = [[cx - s * 0.62, cy - s * 0.55], [cx, cy - s * 0.25], [cx, cy + s * 0.45], [cx - s * 0.62, cy + s * 0.15]];
        const right = [[cx, cy - s * 0.25], [cx + s * 0.62, cy - s * 0.55], [cx + s * 0.62, cy + s * 0.15], [cx, cy + s * 0.45]];
        const a = clear ? 0.82 : 1;
        x.globalAlpha = a;
        x.fillStyle = t.rim; Art.poly(x, top); x.fill(); x.fillStyle = t.base; Art.poly(x, left); x.fill(); x.fillStyle = t.lo; Art.poly(x, right); x.fill();
        x.globalAlpha = 1;
        x.strokeStyle = t.edge; x.lineWidth = o.lw * 0.6; for (const p of [top, left, right]) { Art.poly(x, p); x.stroke(); }
        if (!o.simple) {
          if (v === 3) { x.strokeStyle = Col.rgba(t.lo, 0.7); x.lineWidth = 0.025; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(cx - s * 0.62, cy - s * 0.55 + i * s * 0.17); x.lineTo(cx, cy - s * 0.25 + i * s * 0.17); x.stroke(); } }
          if (v === 4) { x.strokeStyle = Col.rgba(sp.c2, 0.9); x.lineWidth = 0.06; Art.poly(x, [[cx, cy - s * 0.6], [cx + s * 0.35, cy - s * 0.42], [cx, cy - s * 0.3], [cx - s * 0.35, cy - s * 0.42]]); x.stroke(); }
          if (clear || v === 0) { x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 0.035; x.beginPath(); x.moveTo(cx - s * 0.5, cy - s * 0.5); x.lineTo(cx - s * 0.1, cy - s * 0.72); x.stroke(); }
        }
      }
    },
    nodule(x, sp, rnd, o) {
      for (const [px, py, r] of [[-0.35, 0.25, 0.4], [0.38, 0.2, 0.36], [0.02, -0.25, 0.36]]) {
        const pts = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, k = 1 + (i % 2 ? 0.12 : -0.05) * (0.6 + rnd() * 0.8); pts.push([px + Math.cos(a) * r * k, py + Math.sin(a) * r * k * 0.9]); }
        Art.smoothPath(x, pts);
        const g = x.createRadialGradient(px - r * 0.4, py - r * 0.4, r * 0.1, px, py, r * 1.1); g.addColorStop(0, Col.shade(sp.c1, 0.45)); g.addColorStop(1, Col.shade(sp.c1, -0.4));
        x.fillStyle = g; x.fill(); x.strokeStyle = Col.shade(sp.c1, -0.7); x.lineWidth = o.lw * 0.6; x.stroke();
        if (!o.simple) for (let i = 0; i < 5; i++) { x.fillStyle = Col.rgba(sp.c2, 0.7); x.beginPath(); x.arc(px + (rnd() - 0.5) * r, py + (rnd() - 0.5) * r, r * 0.12, 0, Math.PI * 2); x.fill(); }
      }
    },
    banded(x, sp, rnd, o) {
      const pts = Art.blobPts(rnd, 0, 0.08, 0.8, 0.66, 9, 0.18);
      Art.smoothPath(x, pts); x.fillStyle = sp.c1; x.fill();
      x.save(); x.clip();
      for (let i = 7; i > 0; i--) { x.fillStyle = i % 2 ? sp.c2 : sp.c3; x.beginPath(); x.ellipse(0.25, 0.35, i * 0.15, i * 0.12, -0.4, 0, Math.PI * 2); x.fill(); if (o.simple && i < 5) break; }
      const g = x.createLinearGradient(-0.8, -0.6, 0.8, 0.7); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = g; x.fillRect(-1, -1, 2, 2);
      x.restore();
      x.strokeStyle = Col.shade(sp.c1, -0.6); x.lineWidth = o.lw * 0.6; Art.smoothPath(x, pts); x.stroke();
    },
    crust(x, sp, rnd, o) {
      const pts = Art.blobPts(rnd, 0, 0.18, 0.82, 0.55, 7, 0.25);
      Art.facets(x, pts, -0.1, 0.1, ItemArt.T(sp.c2), { lw: o.lw * 0.6 });
      const ct = ItemArt.T(sp.c1);
      const n = o.simple ? 5 : 11;
      for (let i = 0; i < n; i++) {
        const px = -0.65 + i * 1.3 / n + (rnd() - 0.5) * 0.08, py = -0.12 - rnd() * 0.25, s = 0.14 + rnd() * 0.1;
        x.fillStyle = i % 2 ? ct.base : ct.hi; Art.poly(x, [[px - s * 0.6, py + s * 0.3], [px, py - s], [px + s * 0.6, py + s * 0.3]]); x.fill();
        x.strokeStyle = ct.edge; x.lineWidth = 0.02; x.stroke();
      }
      if (!o.simple) Art.glint(x, -0.2, -0.35, 0.1, '#e6f0ff');
    },
    needles(x, sp, rnd, o) {
      const n = o.simple ? 5 : 8;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.22 + (rnd() - 0.5) * 0.08;
        const len = 0.75 + rnd() * 0.45, w = 0.09 + rnd() * 0.04;
        x.save(); x.translate((i - (n - 1) / 2) * 0.06, 0.55); x.rotate(a + Math.PI / 2);
        const c = sp.v === 1 ? (i % 2 ? sp.c1 : '#3ac77a') : sp.c1;
        const t = ItemArt.T(c);
        x.fillStyle = t.base; x.beginPath(); x.moveTo(-w, 0); x.lineTo(-w, -len); x.lineTo(0, -len - w * 1.6); x.lineTo(w, -len); x.lineTo(w, 0); x.closePath(); x.fill();
        if (sp.v === 1) { x.fillStyle = '#2fd08a'; x.fillRect(-w, -len * 0.45, w * 2, len * 0.45); }
        x.fillStyle = Col.rgba(t.hi, 0.9); x.fillRect(-w, -len, w * 0.7, len);
        x.strokeStyle = t.edge; x.lineWidth = o.lw * 0.5; x.beginPath(); x.moveTo(-w, 0); x.lineTo(-w, -len); x.lineTo(0, -len - w * 1.6); x.lineTo(w, -len); x.lineTo(w, 0); x.stroke();
        x.restore();
      }
    },
    saltcluster(x, sp, rnd, o) {
      for (let i = 0; i < (o.simple ? 6 : 12); i++) {
        const px = (rnd() - 0.5) * 1.2, py = 0.45 - rnd() * 0.8, s = 0.18 + rnd() * 0.16;
        const t = ItemArt.T(Col.shade(sp.c1, (rnd() - 0.5) * 0.2));
        Art.facets(x, [[px - s, py], [px - s * 0.3, py - s], [px + s * 0.6, py - s * 0.7], [px + s, py + s * 0.2], [px, py + s * 0.6]], px - s * 0.2, py - s * 0.2, t, { lw: o.lw * 0.4 });
      }
    },
    plates(x, sp, rnd, o) {
      for (let i = 0; i < 4; i++) {
        x.save(); x.translate((i - 1.5) * 0.25, 0.1 + (i % 2) * 0.08); x.rotate((i - 1.5) * 0.35);
        const t = ItemArt.T(Col.shade(sp.c1, -0.25 + i * 0.1));
        Art.box(x, -0.2, -0.5, 0.4, 0.14, 1.4, t, { lw: 0.02, outline: o.lw * 0.5 });
        x.restore();
      }
    },
    blades(x, sp, rnd, o) {
      for (let i = 0; i < 5; i++) {
        x.save(); x.translate(0, 0.6); x.rotate(-0.7 + i * 0.35);
        const t = ItemArt.T(Col.shade(sp.c1, -0.2 + (i % 2) * 0.25));
        x.fillStyle = t.base; x.beginPath(); x.moveTo(-0.07, 0); x.lineTo(-0.11, -0.95); x.lineTo(0.05, -1.12); x.lineTo(0.12, -0.92); x.lineTo(0.08, 0); x.closePath(); x.fill();
        x.fillStyle = t.hi; x.beginPath(); x.moveTo(-0.07, 0); x.lineTo(-0.11, -0.95); x.lineTo(0.0, -1.0); x.lineTo(0.0, 0); x.fill();
        x.strokeStyle = t.edge; x.lineWidth = o.lw * 0.5; x.beginPath(); x.moveTo(-0.07, 0); x.lineTo(-0.11, -0.95); x.lineTo(0.05, -1.12); x.lineTo(0.12, -0.92); x.lineTo(0.08, 0); x.stroke();
        x.restore();
      }
    },
    sponge(x, sp, rnd, o) {
      const pts = Art.blobPts(rnd, 0, 0.05, 0.8, 0.66, 12, 0.3);
      Art.smoothPath(x, pts);
      const g = x.createLinearGradient(-0.7, -0.6, 0.7, 0.6); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, sp.c1); g.addColorStop(1, Col.shade(sp.c1, -0.45));
      x.fillStyle = g; x.fill(); x.strokeStyle = Col.shade(sp.c1, -0.65); x.lineWidth = o.lw * 0.6; x.stroke();
      if (o.simple) { x.fillStyle = Col.shade(sp.c1, -0.5); for (const [px, py] of [[-0.25, 0], [0.25, 0.2], [0.1, -0.25]]) { x.beginPath(); x.arc(px, py, 0.12, 0, Math.PI * 2); x.fill(); } return; }
      for (let i = 0; i < 18; i++) { const px = (rnd() - 0.5) * 1.2, py = (rnd() - 0.45) * 0.95; if (px * px / 0.5 + py * py / 0.35 > 0.85) continue; const r = 0.04 + rnd() * 0.08; x.fillStyle = Col.shade(sp.c1, -0.55); x.beginPath(); x.ellipse(px, py, r, r * 0.8, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 0.02; x.beginPath(); x.arc(px, py, r, 0.2, 1.8); x.stroke(); }
    },
    gem(x, sp, rnd, o) {
      const t = ItemArt.T(sp.c1);
      if (sp.v === 0) {
        for (const [px, py, s, a] of [[-0.3, 0.2, 0.42, -0.3], [0.32, 0.12, 0.38, 0.4], [0.0, -0.3, 0.36, 0.1]]) {
          x.save(); x.translate(px, py); x.rotate(a);
          const hex = []; for (let i = 0; i < 6; i++) { const aa = i / 6 * Math.PI * 2; hex.push([Math.cos(aa) * s, Math.sin(aa) * s * 0.55]); }
          Art.facets(x, hex, -s * 0.15, -s * 0.1, t, { lw: o.lw * 0.5 });
          if (!o.simple) { x.fillStyle = 'rgba(255,255,255,.55)'; Art.poly(x, [[-s * 0.5, -s * 0.15], [-s * 0.1, -s * 0.4], [0, -s * 0.1]]); x.fill(); }
          x.restore();
        }
      } else {
        x.save(); x.rotate(-0.25);
        const body = [[-0.32, 0.65], [-0.38, -0.25], [0, -0.85], [0.38, -0.25], [0.32, 0.65]];
        Art.poly(x, body); x.fillStyle = t.base; x.fill();
        x.fillStyle = t.hi; Art.poly(x, [[-0.38, -0.25], [0, -0.85], [0, 0.65], [-0.32, 0.65]]); x.fill();
        x.fillStyle = t.lo; Art.poly(x, [[0.12, -0.6], [0.38, -0.25], [0.32, 0.65], [0.12, 0.65]]); x.fill();
        x.strokeStyle = t.edge; x.lineWidth = o.lw * 0.6; Art.poly(x, body); x.stroke();
        if (!o.simple) { x.strokeStyle = Col.rgba('#ffffff', 0.6); x.lineWidth = 0.03; x.beginPath(); x.moveTo(-0.38, -0.25); x.lineTo(0.38, -0.25); x.moveTo(0, -0.85); x.lineTo(0, 0.65); x.stroke(); }
        x.restore();
      }
    },
    geode(x, sp, rnd, o) {
      const shell = ItemArt.T(sp.c2), inner = ItemArt.T(sp.c3);
      const R = 0.82;
      x.fillStyle = shell.base; x.beginPath(); x.ellipse(0, 0.05, R, R * 0.8, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = shell.edge; x.lineWidth = o.lw * 0.6; x.stroke();
      x.fillStyle = shell.lo; x.beginPath(); x.ellipse(0.05, 0.08, R * 0.74, R * 0.58, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = Col.shade(sp.c3, -0.55); x.beginPath(); x.ellipse(0.06, 0.1, R * 0.6, R * 0.46, 0, 0, Math.PI * 2); x.fill();
      x.save(); x.beginPath(); x.ellipse(0.06, 0.1, R * 0.6, R * 0.46, 0, 0, Math.PI * 2); x.clip();
      const n = o.simple ? 7 : 16;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, rx = Math.cos(a) * R * 0.6, ry = Math.sin(a) * R * 0.46;
        const len = 0.22 + rnd() * 0.18;
        const tipx = 0.06 + rx * (1 - len / 0.5), tipy = 0.1 + ry * (1 - len / 0.5);
        x.fillStyle = i % 2 ? inner.hi : inner.base;
        x.beginPath(); x.moveTo(0.06 + rx + Math.sin(a) * 0.08, 0.1 + ry - Math.cos(a) * 0.08); x.lineTo(tipx, tipy); x.lineTo(0.06 + rx - Math.sin(a) * 0.08, 0.1 + ry + Math.cos(a) * 0.08); x.fill();
      }
      if (sp.v === 1 && !o.simple) for (let i = 0; i < 6; i++) { x.fillStyle = inner.rim; x.beginPath(); x.arc(0.06 + (rnd() - 0.5) * 0.4, 0.1 + (rnd() - 0.5) * 0.3, 0.05, 0, Math.PI * 2); x.fill(); }
      x.restore();
      x.strokeStyle = Col.rgba(shell.rim, 0.7); x.lineWidth = 0.04; x.beginPath(); x.ellipse(0, 0.05, R, R * 0.8, 0, 3.3, 4.6); x.stroke();
      if (!o.simple) Art.glint(x, -0.1, -0.05, 0.12, inner.rim);
    },
    crystal(x, sp, rnd, o) {
      const t = ItemArt.T(sp.c1);
      const prism = (cx, cy, w, len, a, tt) => {
        x.save(); x.translate(cx, cy); x.rotate(a);
        const body = [[-w, 0], [-w, -len], [0, -len - w * 1.4], [w, -len], [w, 0]];
        x.fillStyle = tt.base; Art.poly(x, body); x.fill();
        x.fillStyle = tt.hi; Art.poly(x, [[-w, 0], [-w, -len], [0, -len - w * 1.4], [-w * 0.15, -len], [-w * 0.15, 0]]); x.fill();
        x.fillStyle = tt.lo; Art.poly(x, [[w * 0.45, 0], [w * 0.45, -len], [0, -len - w * 1.4], [w, -len], [w, 0]]); x.fill();
        x.strokeStyle = tt.edge; x.lineWidth = o.lw * 0.6; Art.poly(x, body); x.stroke();
        if (!o.simple) { x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 0.03; x.beginPath(); x.moveTo(-w * 0.7, -len * 0.1); x.lineTo(-w * 0.7, -len * 0.85); x.stroke(); }
        x.restore();
      };
      if (sp.v === 0) { prism(0, 0.7, 0.34, 1.05, 0.1, t); }
      else if (sp.v === 1) { prism(-0.3, 0.68, 0.28, 0.65, -0.35, ItemArt.T(sp.c1)); prism(0.25, 0.7, 0.3, 0.85, 0.25, ItemArt.T(Col.shade(sp.c1, -0.1))); prism(0, 0.72, 0.22, 0.5, 0, ItemArt.T(Col.shade(sp.c1, 0.1))); }
      else if (sp.v === 2) {
        prism(-0.25, 0.68, 0.28, 0.9, -0.2, t); prism(0.28, 0.7, 0.25, 0.7, 0.3, t);
        if (!o.simple) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.6; x.drawImage(Sprites.glow(sp.c2), -0.6, -0.6, 1.2, 1.2); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
      } else {
        prism(0, 0.7, 0.3, 0.95, 0, t); prism(-0.35, 0.72, 0.18, 0.5, -0.5, t); prism(0.35, 0.72, 0.18, 0.55, 0.5, t);
        if (!o.simple) { x.strokeStyle = Col.rgba(sp.c2, 0.85); x.lineWidth = 0.035; x.beginPath(); x.ellipse(0, -0.1, 0.75, 0.25, -0.3, 0, Math.PI * 2); x.stroke(); x.fillStyle = '#ffffff'; for (const a of [0.4, 2.6, 4.4]) { x.beginPath(); x.arc(Math.cos(a) * 0.75 * Math.cos(-0.3) - Math.sin(a) * 0.25 * Math.sin(-0.3), -0.1 + Math.cos(a) * 0.75 * Math.sin(-0.3) + Math.sin(a) * 0.25 * Math.cos(-0.3), 0.06, 0, Math.PI * 2); x.fill(); } }
      }
    },
    opal(x, sp, rnd, o) {
      x.beginPath(); x.ellipse(0, 0.05, 0.78, 0.6, -0.15, 0, Math.PI * 2);
      const g = x.createRadialGradient(-0.25, -0.2, 0.05, 0, 0.05, 0.8); g.addColorStop(0, '#ffffff'); g.addColorStop(1, Col.shade(sp.c1, -0.2));
      x.fillStyle = g; x.fill();
      x.save(); x.clip();
      const cols = [sp.c2, sp.c3, '#ffd27a', '#7ab8ff', '#c8ff7a'];
      for (let i = 0; i < (o.simple ? 4 : 12); i++) { x.fillStyle = Col.rgba(cols[i % cols.length], 0.55); x.beginPath(); x.ellipse((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 0.9, 0.18 + rnd() * 0.15, 0.08 + rnd() * 0.1, rnd() * 3, 0, Math.PI * 2); x.fill(); }
      x.restore();
      x.strokeStyle = Col.shade(sp.c1, -0.55); x.lineWidth = o.lw * 0.6; x.beginPath(); x.ellipse(0, 0.05, 0.78, 0.6, -0.15, 0, Math.PI * 2); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.ellipse(-0.3, -0.22, 0.2, 0.08, -0.5, 0, Math.PI * 2); x.fill();
    },
    meteor(x, sp, rnd, o) {
      const pts = Art.blobPts(rnd, 0, 0.05, 0.82, 0.68, 10, 0.25);
      Art.smoothPath(x, pts);
      const g = x.createLinearGradient(-0.8, -0.6, 0.8, 0.6); g.addColorStop(0, '#e6e8ee'); g.addColorStop(0.35, sp.c1); g.addColorStop(1, '#2a2830');
      x.fillStyle = g; x.fill(); x.strokeStyle = '#1a181e'; x.lineWidth = o.lw * 0.6; x.stroke();
      x.save(); Art.smoothPath(x, pts); x.clip();
      for (let i = 0; i < (o.simple ? 3 : 8); i++) { const px = (rnd() - 0.5) * 1.2, py = (rnd() - 0.5) * 0.9, r = 0.1 + rnd() * 0.1; x.fillStyle = 'rgba(30,28,36,.5)'; x.beginPath(); x.ellipse(px, py, r, r * 0.75, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 0.025; x.beginPath(); x.arc(px, py, r, 0.3, 2); x.stroke(); }
      if (!o.simple) { x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 0.02; for (let i = -4; i <= 4; i++) { x.beginPath(); x.moveTo(-0.8, i * 0.18); x.lineTo(0.8, i * 0.18 + 0.5); x.moveTo(-0.8, i * 0.18 + 0.4); x.lineTo(0.8, i * 0.18 - 0.3); x.stroke(); } }
      x.restore();
    },
    glowrock(x, sp, rnd, o) {
      const pts = Art.blobPts(rnd, 0, 0.06, 0.8, 0.64, 8, 0.28);
      Art.facets(x, pts, -0.1, -0.05, ItemArt.T(sp.c2), { lw: o.lw * 0.6 });
      x.save(); Art.poly(x, pts); x.clip();
      x.strokeStyle = sp.c1; x.lineCap = 'round';
      for (let i = 0; i < 3; i++) { x.lineWidth = o.simple ? 0.11 : 0.07; x.beginPath(); let px = -0.7, py = (rnd() - 0.5) * 0.6; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += 0.3; py += (rnd() - 0.5) * 0.4; x.lineTo(px, py); } x.stroke(); }
      if (!o.simple) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.55; x.drawImage(Sprites.glow(sp.c1), -0.9, -0.75, 1.8, 1.6); x.globalAlpha = 1; }
      x.restore();
    },
    ice(x, sp, rnd, o) {
      const t = { hi: '#ffffff', base: sp.c1, lo: Col.shade(sp.c1, -0.3), edge: Col.shade(sp.c1, -0.6), rim: '#ffffff' };
      if (sp.v === 0) {
        for (const [px, py, w, len, a] of [[-0.3, 0.6, 0.22, 0.9, -0.35], [0.28, 0.62, 0.2, 0.8, 0.35], [0, 0.65, 0.24, 1.15, 0]]) {
          x.save(); x.translate(px, py); x.rotate(a);
          Art.facets(x, [[-w, 0], [-w * 0.8, -len], [0, -len - w], [w * 0.8, -len], [w, 0]], -w * 0.2, -len * 0.5, t, { lw: o.lw * 0.5 });
          x.restore();
        }
        if (!o.simple) for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect((rnd() - 0.5) * 1.2, 0.3 + rnd() * 0.4, 0.04, 0.04); }
      } else {
        Art.box(x, -0.62, -0.25, 1.24, 0.9, 0.95, t, { r: 0.12, lw: 0.04, outline: o.lw * 0.6 });
        if (!o.simple) { for (let i = 0; i < 7; i++) { x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 0.02; x.beginPath(); x.arc((rnd() - 0.5) * 1, (rnd() - 0.6) * 0.8, 0.04 + rnd() * 0.05, 0, Math.PI * 2); x.stroke(); } x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 0.025; x.beginPath(); x.moveTo(-0.4, -0.5); x.lineTo(-0.1, -0.2); x.lineTo(0.2, -0.45); x.stroke(); }
      }
    },
    fulgurite(x, sp, rnd, o) {
      const t = ItemArt.T(sp.c1);
      x.lineCap = 'round'; x.lineJoin = 'round';
      const branch = [[[-0.1, 0.7], [0, 0.2], [-0.15, -0.2], [0.05, -0.75]], [[0, 0.2], [0.45, -0.05], [0.6, -0.45]], [[-0.15, -0.2], [-0.5, -0.35]]];
      for (const b of branch) { x.strokeStyle = t.edge; x.lineWidth = 0.3; Art.polyline(x, b); x.stroke(); x.strokeStyle = t.base; x.lineWidth = 0.22; Art.polyline(x, b); x.stroke(); x.strokeStyle = t.rim; x.lineWidth = 0.07; Art.polyline(x, b); x.stroke(); }
      if (!o.simple) { x.strokeStyle = '#ffffff'; x.lineWidth = 0.04; Art.polyline(x, [[0.05, -0.85], [0.2, -1.0], [0.1, -1.08], [0.3, -1.2]]); x.stroke(); }
    },
    pallasite(x, sp, rnd, o) {
      Art.box(x, -0.72, -0.4, 1.44, 0.92, 0.35, { hi: '#e6e8ee', base: '#9a98a2', lo: '#5a5862', edge: '#2a2830', rim: '#ffffff' }, { r: 0.18, outline: o.lw * 0.6 });
      x.save(); Art.rrect(x, -0.72, -0.59, 1.44, 0.92, 0.18); x.clip();
      for (let i = 0; i < (o.simple ? 5 : 11); i++) { const px = -0.55 + (i % 4) * 0.37 + (rnd() - 0.5) * 0.12, py = -0.4 + Math.floor(i / 4) * 0.3 + (rnd() - 0.5) * 0.1; const pts = Art.blobPts(rnd, px, py, 0.13, 0.1, 6, 0.3); x.fillStyle = Col.shade(sp.c1, rnd() * 0.3 - 0.15); Art.poly(x, pts); x.fill(); x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(px - 0.06, py - 0.05, 0.05, 0.03); }
      x.restore();
    },
    dense(x, sp, rnd, o) {
      if (!o.simple) { x.strokeStyle = Col.rgba('#8a7dff', 0.6); x.lineWidth = 0.03; for (let i = 1; i <= 3; i++) { x.beginPath(); x.ellipse(0, 0.15, 0.4 + i * 0.17, 0.15 + i * 0.07, 0, 0, Math.PI * 2); x.stroke(); } }
      const t = ItemArt.T(sp.c2);
      Art.facets(x, [[0, -0.85], [0.5, -0.3], [0.42, 0.45], [0, 0.65], [-0.42, 0.45], [-0.5, -0.3]], -0.08, -0.15, { hi: '#a89aff', base: sp.c2, lo: '#140f30', edge: '#06040f', rim: '#ffffff' }, { lw: o.lw * 0.6 });
      if (!o.simple) { x.fillStyle = 'rgba(200,190,255,.8)'; x.beginPath(); x.arc(-0.05, -0.1, 0.07, 0, Math.PI * 2); x.fill(); }
    },
    // ---------------- specials (legendary and above) ----------------
    xenosteel(x, sp, rnd, o) {
      ItemArt.ingotShape(x, '#c8b8ff', '#6a4aa8', '#2a1a4a', o);
      if (!o.simple) { x.save(); Art.poly(x, [[-0.62, -0.18], [0.62, -0.18], [0.5, -0.55], [-0.5, -0.55]]); x.clip(); x.strokeStyle = 'rgba(120,255,200,.75)'; x.lineWidth = 0.035; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(-0.6 + i * 0.22, -0.18); x.bezierCurveTo(-0.5 + i * 0.22, -0.35, -0.3 + i * 0.22, -0.3, -0.35 + i * 0.22, -0.55); x.stroke(); } x.restore(); }
    },
    starmetal(x, sp, rnd, o) {
      const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.38 : 0.85; pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.05]); }
      Art.facets(x, pts, -0.05, 0, { hi: '#fffbe6', base: '#f0c85a', lo: '#a6781c', edge: '#5a3e08', rim: '#ffffff' }, { lw: o.lw * 0.6 });
      if (!o.simple) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.5; x.drawImage(Sprites.glow('#fff3a0'), -0.5, -0.45, 1, 1); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
    },
    aurora(x, sp, rnd, o) {
      const body = [[-0.35, 0.68], [-0.42, -0.3], [0, -0.92], [0.42, -0.3], [0.35, 0.68]];
      x.save(); Art.poly(x, body); x.clip();
      const g = x.createLinearGradient(0, -0.9, 0, 0.7); g.addColorStop(0, '#e6fff4'); g.addColorStop(0.5, '#3a6a8a'); g.addColorStop(1, '#1a2a4a'); x.fillStyle = g; x.fillRect(-1, -1, 2, 2);
      if (!o.simple) for (let i = 0; i < 3; i++) { x.strokeStyle = Col.rgba(i % 2 ? sp.c2 : sp.c1, 0.8); x.lineWidth = 0.1; x.beginPath(); x.moveTo(-0.5, 0.1 + i * 0.18); x.bezierCurveTo(-0.2, -0.2 + i * 0.18, 0.1, 0.25 + i * 0.18, 0.5, -0.05 + i * 0.18); x.stroke(); }
      else { x.fillStyle = sp.c1; x.fillRect(-0.4, 0, 0.8, 0.2); }
      x.restore();
      x.strokeStyle = '#0a1a2a'; x.lineWidth = o.lw * 0.6; Art.poly(x, body); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 0.03; x.beginPath(); x.moveTo(-0.3, -0.25); x.lineTo(-0.28, 0.55); x.stroke();
    },
    quantum(x, sp, rnd, o) {
      const body = [[-0.75, 0], [-0.4, -0.62], [0.4, -0.62], [0.75, 0], [0.4, 0.62], [-0.4, 0.62]];
      x.save(); Art.poly(x, body); x.clip();
      x.fillStyle = 'rgba(120,230,255,.35)'; x.fillRect(-1, -1, 2, 2);
      const cell = o.simple ? 0.3 : 0.15;
      for (let gx = -0.75; gx < 0.75; gx += cell) for (let gy = -0.62; gy < 0.62; gy += cell) if (rnd() < 0.45) { x.fillStyle = Col.rgba(rnd() < 0.5 ? sp.c1 : '#ff7af0', 0.55 + rnd() * 0.4); x.fillRect(gx, gy, cell * 0.9, cell * 0.9); }
      x.restore();
      x.strokeStyle = '#0a3a4a'; x.lineWidth = o.lw * 0.6; Art.poly(x, body); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 0.04; x.beginPath(); x.moveTo(-0.5, -0.4); x.lineTo(-0.2, -0.55); x.stroke();
    },
    phasemithril(x, sp, rnd, o) {
      for (let k = 0; k < 2; k++) {
        x.save(); x.translate(k ? 0.12 : 0, k ? -0.08 : 0); x.globalAlpha = k ? 0.45 : 1;
        ItemArt.ingotShape(x, '#ffffff', sp.c1, '#4a5a8a', o);
        x.restore();
      }
      if (!o.simple) { x.strokeStyle = 'rgba(200,220,255,.8)'; x.lineWidth = 0.025; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(-0.6, -0.4 + i * 0.12); x.lineTo(0.6, -0.4 + i * 0.12); x.stroke(); } }
    },
    mistpearl(x, sp, rnd, o) {
      const g = x.createRadialGradient(-0.25, -0.3, 0.05, 0, 0, 0.75); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, sp.c1); g.addColorStop(1, '#b08ab8');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, 0.7, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#5a3a6a'; x.lineWidth = o.lw * 0.6; x.stroke();
      if (!o.simple) { x.save(); x.beginPath(); x.arc(0, 0, 0.7, 0, Math.PI * 2); x.clip(); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 0.08; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(0.1, 0.1, 0.2 + i * 0.16, 0.5 + i, 2.5 + i); x.stroke(); } x.restore(); x.fillStyle = 'rgba(255,240,255,.35)'; x.beginPath(); x.ellipse(0, 0.55, 0.9, 0.18, 0, 0, Math.PI * 2); x.fill(); }
    },
    graviton(x, sp, rnd, o) {
      if (!o.simple) { x.strokeStyle = 'rgba(255,160,90,.55)'; x.lineWidth = 0.03; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(0, 0.2, 0.35 + i * 0.2, 0.12 + i * 0.07, 0, Math.PI * 0.05, Math.PI * 0.95); x.stroke(); } }
      Art.facets(x, [[0.05, -0.9], [0.4, -0.2], [0.18, 0.5], [-0.12, 0.62], [-0.35, -0.05]], 0, -0.1, { hi: '#ffe0c0', base: '#ff7a3d', lo: '#8a2e10', edge: '#3a1004', rim: '#ffffff' }, { lw: o.lw * 0.6 });
      if (!o.simple) { x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(0.02, -0.15, 0.08, 0, Math.PI * 2); x.fill(); }
    },
    chronoquartz(x, sp, rnd, o) {
      const t = ItemArt.T('#ffe9a8');
      x.save(); x.rotate(0.1);
      const body = [[-0.42, 0.7], [-0.45, -0.3], [0, -0.92], [0.45, -0.3], [0.42, 0.7]];
      Art.poly(x, body); x.fillStyle = t.base; x.fill(); x.fillStyle = t.hi; Art.poly(x, [[-0.45, -0.3], [0, -0.92], [0, 0.7], [-0.42, 0.7]]); x.fill();
      x.strokeStyle = t.edge; x.lineWidth = o.lw * 0.6; Art.poly(x, body); x.stroke();
      // clock face inside
      x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(0, 0.05, 0.3, 0, Math.PI * 2); x.fill();
      x.strokeStyle = sp.c1; x.lineWidth = o.simple ? 0.07 : 0.045; x.beginPath(); x.arc(0, 0.05, 0.3, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.moveTo(0, 0.05); x.lineTo(0, -0.17); x.moveTo(0, 0.05); x.lineTo(0.16, 0.12); x.stroke();
      if (!o.simple) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.fillStyle = sp.c1; x.fillRect(Math.cos(a) * 0.25 - 0.015, 0.05 + Math.sin(a) * 0.25 - 0.015, 0.03, 0.03); }
      x.restore();
    },
    dragonglass(x, sp, rnd, o) {
      const pts = [[-0.7, 0.5], [-0.62, -0.25], [-0.15, -0.82], [0.45, -0.55], [0.78, 0.05], [0.4, 0.62]];
      Art.facets(x, pts, 0, 0, { hi: '#4a1a24', base: sp.c1, lo: '#050102', edge: '#000000', rim: '#ff6a4a' }, { lw: o.lw * 0.6 });
      x.save(); Art.poly(x, pts); x.clip();
      if (!o.simple) { x.strokeStyle = 'rgba(120,40,50,.7)'; x.lineWidth = 0.025; for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) { const px = -0.7 + c * 0.28 + (r % 2) * 0.14, py = -0.6 + r * 0.25; x.beginPath(); x.arc(px, py, 0.14, 0.2, Math.PI - 0.2); x.stroke(); } }
      x.strokeStyle = sp.c2; x.lineWidth = o.simple ? 0.1 : 0.06; x.lineCap = 'round';
      x.beginPath(); x.moveTo(-0.5, 0.35); x.lineTo(-0.1, 0.05); x.lineTo(0.05, -0.35); x.moveTo(-0.1, 0.05); x.lineTo(0.45, 0.2); x.stroke();
      if (!o.simple) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.6; x.drawImage(Sprites.glow('#ff4a1a'), -0.6, -0.5, 1.1, 1); x.globalAlpha = 1; }
      x.restore();
    },
    leviathan(x, sp, rnd, o) {
      const pts = Art.blobPts(rnd, 0, 0.04, 0.8, 0.66, 9, 0.15);
      Art.smoothPath(x, pts);
      const g = x.createRadialGradient(-0.2, -0.25, 0.05, 0, 0, 0.85); g.addColorStop(0, '#ffe9a0'); g.addColorStop(0.5, '#ff9a2a'); g.addColorStop(1, '#8a3a08');
      x.fillStyle = g; x.fill(); x.strokeStyle = '#3a1404'; x.lineWidth = o.lw * 0.6; x.stroke();
      x.save(); Art.smoothPath(x, pts); x.clip();
      // trapped tentacle
      x.strokeStyle = 'rgba(60,20,6,.85)'; x.lineCap = 'round';
      x.lineWidth = o.simple ? 0.14 : 0.12; x.beginPath(); x.moveTo(-0.55, 0.45); x.bezierCurveTo(-0.3, -0.2, 0.3, 0.35, 0.25, -0.2); x.bezierCurveTo(0.22, -0.45, 0.0, -0.45, 0.05, -0.28); x.stroke();
      if (!o.simple) { x.lineWidth = 0.05; for (let i = 0; i < 6; i++) { const tt = i / 6; x.beginPath(); x.arc(-0.45 + tt * 0.6, 0.3 - tt * 0.35, 0.025, 0, Math.PI * 2); x.stroke(); } }
      x.restore();
      x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(-0.35, -0.3, 0.18, 0.08, -0.5, 0, Math.PI * 2); x.fill();
    },
    soulcrystal(x, sp, rnd, o) {
      const body = [[-0.42, 0.68], [-0.5, -0.2], [0, -0.92], [0.5, -0.2], [0.42, 0.68]];
      x.save(); Art.poly(x, body); x.clip();
      const g = x.createLinearGradient(0, -0.9, 0, 0.7); g.addColorStop(0, '#ffe6fb'); g.addColorStop(1, '#a03a8a'); x.fillStyle = g; x.fillRect(-1, -1, 2, 2);
      // wisp
      x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.moveTo(0, 0.45); x.bezierCurveTo(-0.3, 0.2, 0.25, -0.05, -0.05, -0.35); x.bezierCurveTo(0.2, -0.1, 0.3, 0.25, 0, 0.45); x.fill();
      if (!o.simple) { x.fillStyle = '#5a1a4a'; x.beginPath(); x.arc(-0.06, -0.12, 0.03, 0, Math.PI * 2); x.arc(0.06, -0.1, 0.03, 0, Math.PI * 2); x.fill(); }
      x.restore();
      x.strokeStyle = '#4a0a3a'; x.lineWidth = o.lw * 0.6; Art.poly(x, body); x.stroke();
    },
    phoenixash(x, sp, rnd, o) {
      x.beginPath(); x.moveTo(-0.85, 0.62); x.bezierCurveTo(-0.6, 0.0, 0.6, 0.0, 0.85, 0.62); x.ellipse(0, 0.62, 0.85, 0.14, 0, 0, Math.PI); x.closePath();
      x.fillStyle = '#3a2420'; x.fill(); x.strokeStyle = '#120806'; x.lineWidth = o.lw * 0.6; x.stroke();
      if (!o.simple) for (let i = 0; i < 18; i++) { x.fillStyle = i % 3 ? '#ff7a2a' : '#ffd25a'; x.fillRect((rnd() - 0.5) * 1.4, 0.25 + rnd() * 0.35, 0.05, 0.05); }
      // flame feather
      for (let k = 0; k < 3; k++) {
        const s = 1 - k * 0.25;
        x.fillStyle = ['#ff4a1a', '#ff9a2a', '#ffe08a'][k];
        x.beginPath(); x.moveTo(-0.3 * s, 0.35); x.bezierCurveTo(-0.45 * s, -0.2 * s, 0.1, -0.5 * s, 0.05, -0.85 * s); x.bezierCurveTo(0.4 * s, -0.4 * s, 0.45 * s, -0.05, 0.3 * s, 0.35); x.closePath(); x.fill();
      }
    },
    titanblood(x, sp, rnd, o) {
      ItemArt.vial(x, '#c81a3a', '#ff6a7a', o, 0.85);
      if (!o.simple) { x.strokeStyle = 'rgba(90,0,20,.7)'; x.lineWidth = 0.025; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-0.25 + i * 0.15, 0.6); x.bezierCurveTo(-0.3 + i * 0.15, 0.3, -0.1 + i * 0.12, 0.2, -0.15 + i * 0.15, 0.0); x.stroke(); } }
    },
    antimatter(x, sp, rnd, o) {
      if (!o.simple) { x.fillStyle = 'rgba(230,250,255,.85)'; x.beginPath(); x.ellipse(0, 0, 0.95, 0.9, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = 'rgba(30,240,220,.5)'; x.beginPath(); x.ellipse(0, 0, 0.82, 0.78, 0, 0, Math.PI * 2); x.fill(); }
      Art.facets(x, [[0.1, -0.88], [0.45, -0.35], [0.3, 0.6], [-0.05, 0.7], [-0.4, 0.1], [-0.25, -0.45]], 0, -0.05, { hi: '#2a3a5a', base: '#0a0f1a', lo: '#000000', edge: '#2ef2e0', rim: '#2ef2e0' }, { lw: o.lw * 0.8, edge: '#2ef2e0' });
      x.strokeStyle = '#ffffff'; x.lineWidth = o.simple ? 0.07 : 0.04; x.lineCap = 'round';
      Art.polyline(x, [[0.4, -0.5], [0.6, -0.62], [0.55, -0.75], [0.78, -0.85]]); x.stroke();
      Art.polyline(x, [[-0.35, 0.35], [-0.6, 0.42], [-0.58, 0.6], [-0.8, 0.66]]); x.stroke();
    },
    darkmatter(x, sp, rnd, o) {
      // lensing ring
      const ring = x.createRadialGradient(0, 0, 0.45, 0, 0, 0.95); ring.addColorStop(0, 'rgba(120,220,255,0)'); ring.addColorStop(0.55, 'rgba(180,240,255,.9)'); ring.addColorStop(0.75, 'rgba(90,150,255,.4)'); ring.addColorStop(1, 'rgba(60,100,255,0)');
      x.fillStyle = ring; x.beginPath(); x.arc(0, 0, 0.95, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#000000'; x.beginPath(); x.arc(0, 0, 0.5, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = o.simple ? 0.06 : 0.035; x.beginPath(); x.ellipse(0, 0, 0.9, 0.22, -0.35, 0, Math.PI * 2); x.stroke();
      if (!o.simple) { x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 0.02; x.beginPath(); x.arc(0, 0, 0.58, 2.3, 4.2); x.stroke(); }
    },
    singularity(x, sp, rnd, o) {
      const n = o.simple ? 3 : 5;
      for (let k = 0; k < n; k++) {
        x.strokeStyle = Col.rgba(k % 2 ? '#7fffe8' : '#c8fff4', 0.85); x.lineWidth = o.simple ? 0.09 : 0.06; x.lineCap = 'round';
        x.beginPath();
        for (let i = 0; i <= 40; i++) { const a = k * Math.PI * 2 / n + i * 0.16, r = 0.9 * (1 - i / 44); const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.8; i ? x.lineTo(px, py) : x.moveTo(px, py); }
        x.stroke();
      }
      if (!o.simple) for (let i = 0; i < 24; i++) { const a = rnd() * Math.PI * 2, r = 0.2 + rnd() * 0.7; x.fillStyle = 'rgba(220,255,250,.9)'; x.fillRect(Math.cos(a) * r, Math.sin(a) * r * 0.8, 0.04, 0.04); }
      x.fillStyle = '#04201c'; x.beginPath(); x.arc(0, 0, 0.16, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#ffffff'; x.lineWidth = 0.04; x.stroke();
    },
    starheart(x, sp, rnd, o) {
      // the core of a dying star: radiant 8-point star crystal with a pulsing heart inside
      const pulse = 0.88 + 0.12 * Math.sin(o.t * Math.PI);
      if (!o.simple) {
        x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI / 6 + o.t * 0.15, len = (i % 2 ? 1.22 : 0.98) * pulse, w = 0.09;
          const g = x.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
          g.addColorStop(0, 'rgba(255,220,150,.75)'); g.addColorStop(1, 'rgba(255,140,80,0)');
          x.fillStyle = g; x.beginPath(); x.moveTo(Math.cos(a + 1.57) * w, Math.sin(a + 1.57) * w); x.lineTo(Math.cos(a) * len, Math.sin(a) * len); x.lineTo(Math.cos(a - 1.57) * w, Math.sin(a - 1.57) * w); x.closePath(); x.fill();
        }
        x.globalCompositeOperation = 'source-over';
      }
      const pts = [];
      for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + i * Math.PI / 8, r = i % 4 === 0 ? 0.95 : i % 2 === 0 ? 0.6 : 0.3; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      Art.facets(x, pts, -0.04, -0.06, { hi: '#ffffff', base: '#ffe6a8', lo: '#f0a050', edge: '#7a3a18', rim: '#ffffff' }, { lw: o.lw * 0.7 });
      // heart-shaped core
      const s = 0.3 * pulse;
      const heart = () => { x.beginPath(); x.moveTo(0, s * 0.42); x.bezierCurveTo(-s * 1.15, -s * 0.3, -s * 0.5, -s * 1.1, 0, -s * 0.42); x.bezierCurveTo(s * 0.5, -s * 1.1, s * 1.15, -s * 0.3, 0, s * 0.42); x.closePath(); };
      x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.9;
      x.drawImage(Sprites.glow('#ff6a8a'), -0.5 * pulse, -0.55 * pulse, 1.0 * pulse, 1.0 * pulse);
      x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      const hg = x.createRadialGradient(-s * 0.2, -s * 0.35, s * 0.05, 0, -s * 0.1, s * 1.1);
      hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.35, '#ff9ab0'); hg.addColorStop(1, '#e0284a');
      x.fillStyle = hg; heart(); x.fill();
      x.strokeStyle = '#8a1030'; x.lineWidth = o.lw * 0.5; x.stroke();
      if (!o.simple) for (let i = 0; i < 4; i++) { const a = o.t * 0.9 + i * Math.PI / 2; Art.glint(x, Math.cos(a) * 0.98, Math.sin(a) * 0.42 + 0.05, 0.11, i % 2 ? '#ffe6a8' : '#ffffff'); }
    },
    prism(x, sp, rnd, o) {
      // triangular prism with a light beam split into a rainbow
      if (!o.simple) {
        x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 0.07; x.beginPath(); x.moveTo(-1.2, 0.15); x.lineTo(-0.2, 0.05); x.stroke();
        const cols = ['#ff4a4a', '#ff9a2a', '#ffe24a', '#4aff6a', '#4ab8ff', '#9a5aff'];
        for (let i = 0; i < 6; i++) { const k = (i + Math.floor(o.t * 1.5)) % 6; x.strokeStyle = Col.rgba(cols[k], 0.9); x.lineWidth = 0.07; x.beginPath(); x.moveTo(0.25, 0.08); x.lineTo(1.25, -0.25 + i * 0.1); x.stroke(); }
      }
      const front = [[-0.62, 0.55], [0, -0.75], [0.62, 0.55]];
      const g = x.createLinearGradient(-0.6, -0.7, 0.6, 0.6); g.addColorStop(0, Col.rgba(Col.prism(o.t, 0), 0.95)); g.addColorStop(0.5, 'rgba(255,255,255,.75)'); g.addColorStop(1, Col.rgba(Col.prism(o.t, 180), 0.95));
      x.fillStyle = g; Art.poly(x, front); x.fill();
      x.fillStyle = 'rgba(180,200,230,.55)'; Art.poly(x, [[0, -0.75], [0.62, 0.55], [0.78, 0.42], [0.16, -0.85]]); x.fill();
      x.strokeStyle = '#3a3a6a'; x.lineWidth = o.lw * 0.6; Art.poly(x, front); x.stroke(); Art.poly(x, [[0, -0.75], [0.62, 0.55], [0.78, 0.42], [0.16, -0.85]]); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 0.04; x.beginPath(); x.moveTo(-0.4, 0.35); x.lineTo(-0.05, -0.45); x.stroke();
    }
  },

  // ---------------- refined painters ----------------
  ingotShape(x, hi, base, lo, o) {
    const top = [[-0.5, -0.55], [0.5, -0.55], [0.65, -0.18], [-0.65, -0.18]];
    const front = [[-0.65, -0.18], [0.65, -0.18], [0.72, 0.4], [-0.72, 0.4]];
    x.fillStyle = hi; Art.poly(x, top); x.fill();
    const g = x.createLinearGradient(-0.7, 0, 0.7, 0); g.addColorStop(0, base); g.addColorStop(1, lo);
    x.fillStyle = g; Art.poly(x, front); x.fill();
    x.strokeStyle = Col.shade(lo, -0.5); x.lineWidth = o.lw * 0.6; Art.poly(x, top); x.stroke(); Art.poly(x, front); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = o.simple ? 0.07 : 0.045; x.beginPath(); x.moveTo(-0.45, -0.48); x.lineTo(0.2, -0.48); x.stroke();
  },
  vial(x, liquid, light, o, fill = 0.7) {
    // glass capsule with cork/seal
    x.fillStyle = 'rgba(220,240,255,.35)'; Art.rrect(x, -0.34, -0.55, 0.68, 1.2, 0.3); x.fill();
    x.save(); Art.rrect(x, -0.34, -0.55, 0.68, 1.2, 0.3); x.clip();
    const lv = 0.65 - 1.2 * fill;
    const g = x.createLinearGradient(-0.3, 0, 0.3, 0); g.addColorStop(0, light); g.addColorStop(1, liquid);
    x.fillStyle = g; x.fillRect(-0.34, lv, 0.68, 1.3);
    x.fillStyle = Col.rgba(light, 0.9); x.beginPath(); x.ellipse(0, lv, 0.34, 0.06, 0, 0, Math.PI * 2); x.fill(); // meniscus
    if (!o.simple) for (let i = 0; i < 3; i++) { x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 0.02; x.beginPath(); x.arc(-0.12 + i * 0.12, lv + 0.2 + i * 0.15, 0.03, 0, Math.PI * 2); x.stroke(); }
    x.restore();
    x.strokeStyle = 'rgba(40,60,80,.9)'; x.lineWidth = o.lw * 0.6; Art.rrect(x, -0.34, -0.55, 0.68, 1.2, 0.3); x.stroke();
    x.fillStyle = '#c8a070'; x.fillRect(-0.22, -0.78, 0.44, 0.26); x.strokeStyle = '#5a3a1a'; x.strokeRect(-0.22, -0.78, 0.44, 0.26);
    x.fillStyle = '#d23a3a'; x.fillRect(-0.24, -0.62, 0.48, 0.08);
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = o.simple ? 0.07 : 0.05; x.beginPath(); x.moveTo(-0.2, -0.35); x.lineTo(-0.2, 0.4); x.stroke();
  },
  gemCut(x, c, style, o) {
    const t = ItemArt.T(c);
    let outline;
    switch (style % 6) {
      case 0: outline = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; outline.push([Math.cos(a) * 0.68, Math.sin(a) * 0.62]); } break; // round brilliant
      case 1: outline = [[-0.55, -0.42], [-0.42, -0.55], [0.42, -0.55], [0.55, -0.42], [0.55, 0.42], [0.42, 0.55], [-0.42, 0.55], [-0.55, 0.42]]; break; // emerald
      case 2: outline = [[0, -0.8], [0.45, -0.1], [0.5, 0.25], [0.3, 0.55], [0, 0.62], [-0.3, 0.55], [-0.5, 0.25], [-0.45, -0.1]]; break; // pear
      case 3: outline = [[0, -0.82], [0.38, -0.3], [0.45, 0.1], [0.32, 0.5], [0, 0.78], [-0.32, 0.5], [-0.45, 0.1], [-0.38, -0.3]]; break; // marquise
      case 4: outline = [[0, -0.72], [0.72, 0.55], [-0.72, 0.55]]; break; // trillion
      default: outline = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; outline.push([Math.cos(a) * 0.72, Math.sin(a) * 0.55]); } // oval
    }
    Art.facets(x, outline, -0.08, -0.12, t, { lw: o.lw * 0.6 });
    if (o.simple) return;
    // table facet
    const tab = outline.map(p => [p[0] * 0.48 - 0.04, p[1] * 0.48 - 0.06]);
    x.fillStyle = Col.rgba(t.rim, 0.75); Art.poly(x, tab); x.fill();
    x.strokeStyle = Col.rgba(t.edge, 0.5); x.lineWidth = 0.02;
    for (let i = 0; i < outline.length; i++) { x.beginPath(); x.moveTo(tab[i][0], tab[i][1]); x.lineTo(outline[i][0], outline[i][1]); x.stroke(); }
    Art.glint(x, -0.2, -0.25, 0.14);
  },
  refined(x, sp, o, ref) {
    const rnd = RNG.mulberry32(RNG.hash(sp.res, 99));
    const bright = ref >= 2;
    if (sp.cat === 'special') {
      // polished version of the special object: same identity, cleaner light
      ItemArt.P[sp.fam](x, sp, rnd, o);
      if (!o.simple) { x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 0.05; x.beginPath(); x.moveTo(-0.55, -0.35); x.lineTo(-0.2, -0.6); x.stroke(); }
      return;
    }
    switch (sp.cat) {
      case 'metal': {
        const m = sp.fam === 'ore' ? sp.c3 : sp.fam === 'nugget' && sp.v === 1 ? '#f2c84b' : sp.fam === 'rock' ? sp.c3 : sp.c1;
        const c = Col.mix(m, '#ffffff', sp.fam === 'granules' || sp.fam === 'flakes' ? 0.25 : 0.05);
        ItemArt.ingotShape(x, Col.shade(c, 0.45), c, Col.shade(c, -0.45), o);
        if (!o.simple) { // engraved mark per resource
          x.strokeStyle = Col.rgba(Col.shade(c, -0.6), 0.8); x.lineWidth = 0.035;
          const mk = sp.res % 4;
          x.beginPath();
          if (mk === 0) { x.arc(0, 0.1, 0.14, 0, Math.PI * 2); } else if (mk === 1) { x.moveTo(-0.15, 0.22); x.lineTo(0, -0.02); x.lineTo(0.15, 0.22); x.closePath(); } else if (mk === 2) { x.rect(-0.13, -0.02, 0.26, 0.24); } else { x.moveTo(-0.16, 0.1); x.lineTo(0.16, 0.1); x.moveTo(0, -0.05); x.lineTo(0, 0.25); }
          x.stroke();
        }
        break;
      }
      case 'gem': {
        const c = sp.fam === 'geode' || sp.fam === 'crust' ? sp.c3 : sp.fam === 'glass' && sp.v === 0 ? '#2a2440' : sp.c1;
        ItemArt.gemCut(x, bright ? Col.shade(c, 0.08) : c, sp.res * 7 + sp.v, o);
        break;
      }
      case 'powder': {
        if (sp.res % 2 === 0) {
          // pressed block with embossed rings
          const t = ItemArt.T(Col.shade(sp.c1, 0.05));
          Art.box(x, -0.62, -0.1, 1.24, 0.72, 0.85, t, { r: 0.08, lw: 0.035, outline: o.lw * 0.6 });
          if (!o.simple) { x.strokeStyle = Col.rgba(t.lo, 0.8); x.lineWidth = 0.04; x.beginPath(); x.ellipse(0, -0.21, 0.32, 0.2, 0, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.ellipse(0, -0.21, 0.16, 0.1, 0, 0, Math.PI * 2); x.stroke(); }
        } else ItemArt.vial(x, Col.shade(sp.c1, -0.15), Col.shade(sp.c1, 0.35), o, 0.62);
        break;
      }
      case 'salt': {
        const t = ItemArt.T(sp.c1);
        const s = 0.95;
        const top = [[0, -s * 0.85], [s * 0.7, -s * 0.5], [0, -s * 0.15], [-s * 0.7, -s * 0.5]];
        const left = [[-s * 0.7, -s * 0.5], [0, -s * 0.15], [0, s * 0.65], [-s * 0.7, s * 0.3]];
        const right = [[0, -s * 0.15], [s * 0.7, -s * 0.5], [s * 0.7, s * 0.3], [0, s * 0.65]];
        x.globalAlpha = 0.9; x.fillStyle = t.rim; Art.poly(x, top); x.fill(); x.fillStyle = t.base; Art.poly(x, left); x.fill(); x.fillStyle = t.lo; Art.poly(x, right); x.fill(); x.globalAlpha = 1;
        x.strokeStyle = t.edge; x.lineWidth = o.lw * 0.6; for (const p of [top, left, right]) { Art.poly(x, p); x.stroke(); }
        if (!o.simple) Art.glint(x, -0.3, -0.45, 0.15);
        break;
      }
      default: { // stone: cut block showing the material
        const t = ItemArt.T(sp.c1);
        Art.box(x, -0.6, -0.1, 1.2, 0.72, 0.95, t, { r: 0.05, lw: 0.04, outline: o.lw * 0.6 });
        if (!o.simple) {
          x.save(); Art.rrect(x, -0.6, -0.62, 1.2, 1.24, 0.05); x.clip();
          if (sp.fam === 'slate' || sp.fam === 'banded') { for (let i = 0; i < 5; i++) { x.fillStyle = Col.rgba(i % 2 ? sp.c2 : sp.c3, 0.45); x.fillRect(-0.6, -0.55 + i * 0.25, 1.2, 0.07); } }
          else for (let i = 0; i < 18; i++) { x.fillStyle = Col.rgba(i % 2 ? sp.c2 : t.hi, 0.7); x.fillRect(-0.55 + rnd() * 1.1, -0.6 + rnd() * 1.2, 0.05, 0.05); }
          x.restore();
        }
      }
    }
  }
};
