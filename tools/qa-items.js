// Item QA: distinctiveness (CIEDE2000 colour distance + silhouette IoU at 24 and 16 px,
// pairwise within each rarity tier) and contrast against the 8 planet grounds.
// Usage: node tools/qa-items.js [out.json]     (needs Playwright + Chromium)
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const HTML = 'file://' + path.join(__dirname, '..', 'index.html');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto(HTML);
  await page.waitForTimeout(300);
  await page.click('#btn-new'); await page.waitForTimeout(200);
  const skip = await page.$('.fx-skip'); if (skip) await skip.click();
  await page.waitForTimeout(400);
  const res = await page.evaluate(() => {
    const A = window.__AO__, { ItemArt, DATA, Col, Render, Art } = A;
    A.App.running = false;
    // ---- colour science ----
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lab = (r, g, b) => {
      const R = lin(r), G = lin(g), B = lin(b);
      let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
      const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
      X = f(X); Y = f(Y); Z = f(Z);
      return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
    };
    const de2000 = (l1, l2) => {
      const [L1, a1, b1] = l1, [L2, a2, b2] = l2, rad = Math.PI / 180;
      const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2;
      const G = 0.5 * (1 - Math.sqrt(Math.pow(Cm, 7) / (Math.pow(Cm, 7) + Math.pow(25, 7))));
      const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
      const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
      const h = (a, b) => { if (a === 0 && b === 0) return 0; let x = Math.atan2(b, a) / rad; return x < 0 ? x + 360 : x; };
      const h1p = h(a1p, b1), h2p = h(a2p, b2);
      const dLp = L2 - L1, dCp = C2p - C1p;
      let dhp = 0; if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
      const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2);
      const Lpm = (L1 + L2) / 2, Cpm = (C1p + C2p) / 2;
      let hpm = h1p + h2p; if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hpm += (h1p + h2p < 360 ? 360 : -360); hpm /= 2; }
      const T = 1 - 0.17 * Math.cos((hpm - 30) * rad) + 0.24 * Math.cos(2 * hpm * rad) + 0.32 * Math.cos((3 * hpm + 6) * rad) - 0.2 * Math.cos((4 * hpm - 63) * rad);
      const dTh = 30 * Math.exp(-Math.pow((hpm - 275) / 25, 2));
      const Rc = 2 * Math.sqrt(Math.pow(Cpm, 7) / (Math.pow(Cpm, 7) + Math.pow(25, 7)));
      const Sl = 1 + 0.015 * Math.pow(Lpm - 50, 2) / Math.sqrt(20 + Math.pow(Lpm - 50, 2)), Sc = 1 + 0.045 * Cpm, Sh = 1 + 0.015 * Cpm * T;
      const Rt = -Math.sin(2 * dTh * rad) * Rc;
      return Math.sqrt(Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh));
    };
    const relLum = hex => { const c = Col.rgb(hex); return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); };
    const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    // ---- per item features at a size: object-only mask, mean colour (Lab), colour histogram ----
    const feat = (res, S) => {
      const sp = ItemArt.spec(res), ppu = S / 2.7;
      const c = Art.canvas(S, S), x = c.getContext('2d');
      x.translate(S / 2, S / 2); x.scale(ppu, ppu);
      ItemArt.drawObject(x, sp, 0, { simple: S <= 26, medium: S <= 52, ppu, lw: Math.max(0.05, 1.3 / ppu), t: 0, ref: 0 });
      const d = x.getImageData(0, 0, S, S).data;
      const mask = new Uint8Array(S * S); let n = 0, r = 0, g = 0, b = 0;
      const hist = new Float32Array(27);
      for (let i = 0; i < S * S; i++) if (d[i * 4 + 3] > 110) { mask[i] = 1; n++; r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; hist[Math.floor(d[i * 4] / 86) * 9 + Math.floor(d[i * 4 + 1] / 86) * 3 + Math.floor(d[i * 4 + 2] / 86)]++; }
      for (let i = 0; i < 27; i++) hist[i] /= Math.max(1, n);
      return { mask, n, lab: lab(r / Math.max(1, n), g / Math.max(1, n), b / Math.max(1, n)), hist, hex: Col.hex(r / Math.max(1, n), g / Math.max(1, n), b / Math.max(1, n)) };
    };
    const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.mask.length; k++) { const x = a.mask[k], y = b.mask[k]; if (x && y) i++; if (x || y) u++; } return u ? i / u : 1; };
    const histD = (a, b) => { let s = 0; for (let i = 0; i < 27; i++) s += Math.abs(a.hist[i] - b.hist[i]); return s / 2; };
    const out = { sizes: {}, contrast: [] };
    for (const S of [24, 16]) {
      const F = DATA.RESOURCES.map(R => feat(R.id, S));
      const pairs = [];
      for (let t = 0; t < 8; t++) {
        const ids = DATA.RESOURCES.filter(R => R.tier === t).map(R => R.id);
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
          const a = F[ids[i]], b = F[ids[j]];
          const dE = de2000(a.lab, b.lab), io = iou(a, b), hd = histD(a, b);
          // a pair counts as confusable only if colour AND silhouette AND colour mix are all close
          const score = Math.max(dE / 12, (1 - io) / 0.25, hd / 0.35);
          pairs.push({ tier: t, a: DATA.RESOURCES[ids[i]].name, b: DATA.RESOURCES[ids[j]].name, dE: +dE.toFixed(1), iou: +io.toFixed(2), hist: +hd.toFixed(2), score: +score.toFixed(2) });
        }
      }
      pairs.sort((p, q) => p.score - q.score);
      out.sizes[S] = { pairs: pairs.length, failing: pairs.filter(p => p.score < 1).length, worst: pairs.slice(0, 8) };
    }
    // ---- contrast vs the 8 planet grounds (object colour or its outline must reach 3:1) ----
    for (let k = 1; k <= 8; k++) {
      const P = DATA.planet(k);
      Render.setPlanet(P);
      let fails = [], minC = 99;
      for (const R of DATA.RESOURCES) {
        const f = feat(R.id, 24);
        const ring = ItemArt.ringColor(ItemArt.spec(R.id));
        for (const gnd of P.ground) {
          const lg = relLum(gnd);
          const c = Math.max(contrast(relLum(f.hex), lg), contrast(relLum(ring), lg));
          if (c < minC) minC = c;
          if (c < 3) fails.push(R.name + ' auf ' + gnd + ' (' + c.toFixed(2) + ')');
        }
      }
      out.contrast.push({ planet: k, name: P.name, minContrast: +minC.toFixed(2), failing: fails.length, examples: fails.slice(0, 4) });
    }
    Render.setPlanet(A.App.g.world.planet);
    return out;
  });
  const file = process.argv[2];
  if (file) fs.writeFileSync(file, JSON.stringify(res, null, 2));
  for (const S of Object.keys(res.sizes)) console.log('Unterscheidbarkeit ' + S + ' px: ' + res.sizes[S].pairs + ' Paare, ' + res.sizes[S].failing + ' verwechselbar; knappste: ' + res.sizes[S].worst.slice(0, 3).map(p => p.a + '/' + p.b + ' dE' + p.dE + ' IoU' + p.iou + ' H' + p.hist).join('; '));
  for (const c of res.contrast) console.log('Kontrast ' + c.name + ': min ' + c.minContrast + ':1, ' + c.failing + ' unter 3:1 ' + c.examples.join(', '));
  await browser.close();
})();
