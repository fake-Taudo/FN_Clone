// Overview sheets of an exported texture folder (one PNG per group).
// Usage: node tools/overview-sheets.js <texturDir> <outDir>
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [DIR, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const list = d => fs.existsSync(path.join(DIR, d)) ? fs.readdirSync(path.join(DIR, d)).filter(f => f.endsWith('.png')).sort() : [];
const groups = [
  ['uebersicht_items-roh-veredelt.png', 'Items: roh und veredelt', [['items', f => /_(roh|veredelt)\.png$/.test(f), 84]]],
  ['uebersicht_items-hochveredelt-perfekt.png', 'Items: hochveredelt und perfekt', [['items', f => /_(hochveredelt|perfekt)\.png$/.test(f), 84]]],
  ['uebersicht_gebaeude.png', 'Gebäude (Stufen 1 / 4 / 7 / 10), Bänder, Deko', [['gebaeude', f => !/animation|_rot\d/.test(f), 170]]],
  ['uebersicht_baender-animation.png', 'Bänder: Animationsframes, Endkappen, T-Stücke; Drehungen', [['gebaeude', f => /belt_|_rot\d/.test(f), 900]]],
  ['uebersicht_figuren.png', 'Figuren und Fahrzeuge', [['figuren', () => true, 640]]],
  ['uebersicht_vorkommen-deko-planeten.png', 'Vorkommen, Gelände-Deko, Planeten', [['vorkommen', () => true, 260], ['deko', () => true, 150], ['planeten', f => /kugel|mit-deko/.test(f), 260]]],
  ['uebersicht_effekte-animation.png', 'Effekt-Bibliothek und Animations-Stichproben', [['effekte', () => true, 96], ['animation', () => true, 1300]]]
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  for (const [file, title, parts] of groups) {
    let cells = '';
    for (const [dir, filt, max] of parts) for (const f of list(dir).filter(filt)) cells += `<figure><img style="max-width:${max}px;max-height:${Math.min(max, 260)}px" src="${b64(path.join(DIR, dir, f))}"><figcaption style="max-width:${Math.max(84, Math.min(max, 300))}px">${f.replace('.png', '')}</figcaption></figure>`;
    const html = `<html><head><style>body{margin:0;padding:14px;background:#17131b;color:#eee;font:10px system-ui}h1{font-size:18px;margin:0 0 10px}
      .g{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end}figure{margin:0;padding:5px;border-radius:8px;background:repeating-conic-gradient(#2b2530 0 25%,#332c38 0 50%) 0 0/16px 16px}
      figcaption{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bbb;margin-top:2px}</style></head><body><h1>${title}</h1><div class="g">${cells}</div></body></html>`;
    await page.setContent(html); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, file), fullPage: true });
    console.log(file);
  }
  await browser.close();
})();
