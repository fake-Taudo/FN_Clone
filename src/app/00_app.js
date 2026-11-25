// =====================================================================
// App: shared client state (DOM side)
// =====================================================================
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const h = (tag, attrs, ...kids) => {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const App = {
  g: null,
  running: false,
  paused: false,
  settings: {
    sound: true, volume: 0.6, music: 0.35, reducedFx: false, quality: 'auto', numberFormat: 'short',
    joySize: 1, joySide: 'left', dayNight: true, weather: true, autosaveToast: false, minimap: true, favorites: []
  },
  cam: { x: 0, y: 0, zoom: CONFIG.zoomDefault, follow: true, tx: 0, ty: 0 },
  view: { w: 0, h: 0, dpr: 1 },
  mode: 'play',        // play | build
  tool: null,          // { type, rot, grade } when placing; 'demolish' | 'select' | 'paste' | 'move'
  selected: null,      // building selected for info panel
  hover: null,         // {x,y} tile under pointer
  ghost: null,         // current placement preview
  linePath: null,      // belt drag path [[x,y,dir]...]
  selRect: null,       // selection rectangle in tiles
  selection: [],       // selected buildings (mass)
  blueprint: null,
  touch: false,
  timeScale: 1,
  debug: { open: false, chunkBorders: false, wallhack: false, fps: 0, frameMs: 0 },
  quality: 'high',
  fpsLow: 0,
  lastSave: 0,
  lastSeenWrite: 0,
  frame: 0,
  alpha: 0,
  now: 0,

  loadSettings() {
    const ls = Save.storage();
    try {
      const s = ls && ls.getItem(Save.SETTINGS);
      if (s) Object.assign(App.settings, JSON.parse(s));
    } catch (e) { /* defaults */ }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches && !(ls && ls.getItem(Save.SETTINGS))) App.settings.reducedFx = true;
    App.applySettings();
  },
  saveSettings() {
    const ls = Save.storage();
    try { if (ls) ls.setItem(Save.SETTINGS, JSON.stringify(App.settings)); } catch (e) { /* ignore */ }
    App.applySettings();
  },
  applySettings() {
    Fmt.mode = App.settings.numberFormat;
    document.body.classList.toggle('reduced', !!App.settings.reducedFx);
    if (App.settings.quality !== 'auto') App.quality = App.settings.quality;
    if (typeof Audio2 !== 'undefined') Audio2.applyVolume();
    const mm = $('#minimap-wrap');
    if (mm) mm.classList.toggle('hidden', !App.settings.minimap);
  },
  isTouch() { return App.touch; }
};
