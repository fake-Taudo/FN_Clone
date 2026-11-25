// Screenshot set for the graphics QA (desktop 1440x900, phone 390x844 portrait/landscape).
// Usage: node tools/screenshots.js <outDir> [saveFile.json]   (needs Playwright + Chromium)
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'exports/screenshots-neu';
const SAVE = process.argv[3] ? fs.readFileSync(process.argv[3], 'utf8') : null;
const HTML = 'file://' + path.join(__dirname, '..', 'index.html');
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const wait = (p, ms) => p.waitForTimeout(ms);

async function newGame(page) {
  await page.goto(HTML); await wait(page, 400);
  await page.click('#btn-new'); await wait(page, 300);
  const skip = await page.$('#screen-fx:not(.hidden) .fx-skip'); if (skip) await skip.click();
  await wait(page, 900);
  await page.evaluate(() => { const A = window.__AO__; A.UI.closeModal(); A.App.g.meta.tutorial.done = true; if (A.Tutorial) A.Tutorial.active = false; const t = document.querySelector('#tutorial'); if (t) t.classList.add('hidden'); });
}
async function loadSave(page) {
  await page.addInitScript(s => { localStorage.setItem('aresOutpost.save', s); }, SAVE);
  await page.goto(HTML); await wait(page, 400);
  await page.click('#btn-continue'); await wait(page, 1500);
  await page.evaluate(() => { const A = window.__AO__; A.UI.closeModal(); const L = A.CONFIG.landing; const g = A.App.g; g.run.player.x = L.x + 2; g.run.player.y = L.y + 6; A.App.cam.x = g.run.player.x; A.App.cam.y = g.run.player.y; A.App.cam.zoom = 22; });
}
const smallBase = () => {
  const A = window.__AO__, g = A.App.g, L = A.CONFIG.landing;
  g.run.money = 1e9; g.run.custTier = 5;
  for (const r of A.DATA.RESEARCH) g.run.research.done.add(r.id);
  A.Progression.computeMods(g);
  const P = s => A.Grid.place(g, s, { ignoreRadius: true });
  P({ type: 'silo', x: L.x + 2, y: L.y + 2, rot: 0 });
  P({ type: 'refinery1', x: L.x - 4, y: L.y + 2, rot: 0 });
  P({ type: 'refinery3', x: L.x - 4, y: L.y - 3, rot: 0, level: 10 });
  P({ type: 'bazaar', x: L.x + 6, y: L.y + 2, rot: 0, level: 4 });
  P({ type: 'cooler', x: L.x - 7, y: L.y + 2, rot: 0 });
  P({ type: 'lamp', x: L.x + 5, y: L.y + 5, rot: 0 }); P({ type: 'flag', x: L.x + 9, y: L.y + 5, rot: 0 }); P({ type: 'beacon', x: L.x + 1, y: L.y - 2, rot: 0 }); P({ type: 'plant', x: L.x + 2, y: L.y - 2, rot: 0 });
  for (let i = 0; i < 8; i++) P({ type: 'path', x: L.x + 5 + i, y: L.y + 6, rot: 0 });
  for (let i = 0; i < 8; i++) P({ type: 'belt', x: L.x - 1 + i, y: L.y + 8, rot: 0, grade: Math.floor(i / 2) });
  g.topologyDirty = true;
};
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name + '.png') }); }

(async () => {
  const browser = await chromium.launch();
  const mk = async (vp, touch) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    return { ctx, page };
  };
  // ---------------- desktop ----------------
  {
    const { ctx, page } = await mk({ width: 1440, height: 900 });
    await page.goto(HTML); await wait(page, 900); await shot(page, 'desktop_00_titel');
    await newGame(page); await wait(page, 600); await shot(page, 'desktop_01_start');
    await page.evaluate(smallBase); await wait(page, 1500);
    await page.evaluate(() => { window.__AO__.App.cam.zoom = 30; }); await wait(page, 1500); await shot(page, 'desktop_02_kleine-basis');
    await page.evaluate(() => window.__AO__.UI.scan()); await wait(page, 450); await shot(page, 'desktop_10_scanner-welle');
    await wait(page, 900); await shot(page, 'desktop_11_scanner-marker');
    // freighter landing at a dock
    await page.evaluate(() => {
      const A = window.__AO__, g = A.App.g, L = A.CONFIG.landing;
      A.Grid.place(g, { type: 'dock', x: L.x + 14, y: L.y - 4, rot: 0 }, { ignoreRadius: true });
      A.Game.recompute(g);
      const d = [...g.buildings.values()].find(b => b.type === 'dock');
      d.customers.push({ tier: 4, wishes: [{ res: 0, ref: 0, qty: 500, got: 0 }], patience: 400, state: 'in', t: 0, arrive: 5, sx: d.x, sy: d.y, skin: 1, spent: 0, units: 0, buying: 0, slot: 0, lastKey: -1 });
      g.run.player.x = d.x + 4.5; g.run.player.y = d.y + 11; A.App.cam.zoom = 18;
    });
    for (const [ms, n] of [[900, 'a-anflug'], [1700, 'b-bremsen'], [900, 'c-aufsetzen'], [1500, 'd-entladen']]) { await wait(page, ms); await shot(page, 'desktop_12_frachter-landung-' + n); }
    // planets 1-8 (and one procedural)
    for (const k of [1, 2, 3, 4, 5, 6, 7, 8, 12]) {
      await page.evaluate(k => { const A = window.__AO__; const g = A.Game.create(A.App.g.meta, k); g.run.startShown = true; A.MainLoop.start(g, {}); }, k);
      await wait(page, 300);
      await page.evaluate(smallBase);
      await page.evaluate(() => { const A = window.__AO__; A.UI.closeModal(); A.App.cam.zoom = 24; });
      await wait(page, 1800);
      await shot(page, 'desktop_2' + (k === 12 ? '9' : k) + '_planet-' + String(k).padStart(2, '0'));
    }
    // planet selection with spheres
    await page.evaluate(() => { const A = window.__AO__; A.App.g.meta.maxPlanet = 9; A.Menus.open('rebirth'); });
    await wait(page, 600); await shot(page, 'desktop_30_planetenwahl');
    await page.evaluate(() => window.__AO__.UI.closeModal());
    // rebirth sequence frames
    await page.evaluate(() => { const A = window.__AO__; A.FX.sequence('rebirth', A.DATA.planet(3), () => {}); });
    for (const [ms, n] of [[1000, 'a-start'], [2200, 'b-hyperraum'], [2600, 'c-ankunft'], [1500, 'd-planet']]) { await wait(page, ms); await shot(page, 'desktop_31_rebirth-' + n); }
    await ctx.close();
  }
  if (SAVE) {
    const { ctx, page } = await mk({ width: 1440, height: 900 });
    await loadSave(page); await wait(page, 3000); await shot(page, 'desktop_03_grosse-basis');
    await page.evaluate(() => { window.__AO__.App.cam.zoom = 9; }); await wait(page, 2500); await shot(page, 'desktop_04_zoom-fern');
    await page.evaluate(() => { window.__AO__.App.cam.zoom = 52; }); await wait(page, 2500); await shot(page, 'desktop_05_zoom-nah');
    await page.evaluate(() => { const A = window.__AO__; A.App.cam.zoom = 26; A.App.g.run.time = 300; }); await wait(page, 2500); await shot(page, 'desktop_06_nacht');
    await page.evaluate(() => { const A = window.__AO__; A.App.g.run.time = 140; }); await wait(page, 2000); await shot(page, 'desktop_07_abend');
    await ctx.close();
  }
  // ---------------- phone portrait / landscape ----------------
  for (const [tag, vp] of [['phone-hoch', { width: 390, height: 844 }], ['phone-quer', { width: 844, height: 390 }]]) {
    const { ctx, page } = await mk(vp, true);
    await newGame(page); await wait(page, 600); await shot(page, tag + '_01_start');
    if (SAVE) {
      await ctx.close();
      const n = await mk(vp, true);
      await loadSave(n.page); await wait(n.page, 2500); await shot(n.page, tag + '_03_grosse-basis');
      await n.page.evaluate(() => { window.__AO__.App.cam.zoom = 10; }); await wait(n.page, 2000); await shot(n.page, tag + '_04_zoom-fern');
      await n.page.evaluate(() => { window.__AO__.App.cam.zoom = 40; }); await wait(n.page, 2000); await shot(n.page, tag + '_05_zoom-nah');
      await n.page.evaluate(() => { const A = window.__AO__; A.App.cam.zoom = 22; A.App.g.run.time = 300; }); await wait(n.page, 2000); await shot(n.page, tag + '_06_nacht');
      await n.ctx.close();
    } else await ctx.close();
  }
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'Screenshots ohne Fehler');
  await browser.close();
})();
