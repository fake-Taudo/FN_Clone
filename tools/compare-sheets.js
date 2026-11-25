// Before/after contact sheets per category from two texture exports.
// Usage: node tools/compare-sheets.js <oldDir (texturen)> <newDir (texturen-neu)> <outDir>
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [OLD, NEW, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const list = (d) => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.png')).sort() : [];

function pairs(cat) {
  const o = list(path.join(OLD, cat)), n = new Set(list(path.join(NEW, cat)));
  if (cat === 'vorkommen') {
    // deposit names depend on the map: match by rarity prefix
    const nn = [...n];
    return o.map(f => [f, nn.find(x => x.startsWith(f.split('_').slice(0, 2).join('_')))]).filter(p => p[1]);
  }
  let common = o.filter(f => n.has(f));
  if (cat === 'items') common = common.filter(f => f.endsWith('_roh.png') || (/_perfekt\.png$/.test(f) && parseInt(f) % 6 === 0));
  if (cat === 'planeten') common = common.filter(f => /planet0[1-8]_.*(kugel|mit-deko)/.test(f));
  return common.map(f => [f, f]);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const cats = { items: [96, 'Items (alle 91 roh + perfekt-Stichprobe)'], gebaeude: [170, 'Gebäude & Bänder'], figuren: [150, 'Figuren & Fahrzeuge'], vorkommen: [220, 'Vorkommen je Seltenheit'], planeten: [220, 'Planeten 1–8'], effekte: [80, 'Effekte (Glows)'] };
  for (const [cat, [max, title]] of Object.entries(cats)) {
    const ps = pairs(cat);
    if (!ps.length) continue;
    const cells = ps.map(([a, b]) => `<figure><div class="p"><img src="${b64(path.join(OLD, cat, a))}"><img src="${b64(path.join(NEW, cat, b))}"></div><figcaption>${b.replace('.png', '')}</figcaption></figure>`).join('');
    const html = `<html><head><style>
      body{margin:0;padding:14px;background:#17131b;color:#eee;font:11px system-ui}
      h1{font-size:18px;margin:0 0 4px} .k{color:#aaa;margin-bottom:10px}
      .g{display:flex;flex-wrap:wrap;gap:8px}
      figure{margin:0;background:repeating-conic-gradient(#2b2530 0 25%,#332c38 0 50%) 0 0/16px 16px;border-radius:8px;padding:6px}
      .p{display:flex;gap:6px;align-items:flex-end} .p img{max-width:${max}px;max-height:${max}px}
      .p img:first-child{opacity:.95;outline:1px solid #555} .p img:last-child{outline:1px solid #e8935a}
      figcaption{max-width:${max * 2 + 6}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#ccc;margin-top:3px}
    </style></head><body><h1>Vorher / Nachher: ${title}</h1><div class="k">links vorher (grau umrandet), rechts nachher (orange umrandet) · ${ps.length} Paare</div><div class="g">${cells}</div></body></html>`;
    await page.setContent(html); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'vergleich_' + cat + '.png'), fullPage: true });
    console.log(cat, ps.length, 'Paare');
  }
  await browser.close();
})();
