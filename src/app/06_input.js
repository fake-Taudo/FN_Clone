// =====================================================================
// Input: keyboard, mouse, touch (joystick, pinch, swipe), camera control
// =====================================================================
const Input = {
  keys: new Set(),
  pointers: new Map(),
  joy: null,          // { id, ox, oy, x, y }
  drag: null,         // primary pointer drag state
  pinch: null,
  lastTap: 0,
  mouse: { x: 0, y: 0, inside: false },

  init() {
    const cv = Render.canvas;
    window.addEventListener('keydown', Input.onKeyDown);
    window.addEventListener('keyup', e => { Input.keys.delete(e.code); });
    window.addEventListener('blur', () => { Input.keys.clear(); Input.joyEnd(); });
    cv.addEventListener('pointerdown', Input.onDown);
    window.addEventListener('pointermove', Input.onMove, { passive: false });
    window.addEventListener('pointerup', Input.onUp);
    window.addEventListener('pointercancel', Input.onUp);
    cv.addEventListener('wheel', Input.onWheel, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerleave', () => { Input.mouse.inside = false; });
    document.addEventListener('gesturestart', e => e.preventDefault());
    // double-tap zoom guard on iOS
    document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  },

  typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'); },

  onKeyDown(e) {
    Audio2.start();
    if (Input.typing()) return;
    const code = e.code;
    if (e.ctrlKey && e.shiftKey && code === 'KeyD') { e.preventDefault(); Debug.toggle(); return; }
    if (UI.modalOpen()) { if (code === 'Escape') UI.closeModal(); return; }
    if (!App.g || !App.running) return;
    Input.keys.add(code);
    const ctrl = e.ctrlKey || e.metaKey;
    switch (code) {
      case 'KeyR': Build.rotate(); break;
      case 'KeyQ': Build.pipette(); break;
      case 'KeyM': UI.openMap(); break;
      case 'KeyF': UI.scan(); break;
      case 'KeyB': UI.toggleBuild(); break;
      case 'KeyZ': if (ctrl && e.shiftKey) Build.redo(); else Build.undo(); e.preventDefault(); break;
      case 'KeyY': Build.redo(); e.preventDefault(); break;
      case 'KeyC': if (ctrl || App.selection.length) Build.copySelection(); break;
      case 'KeyV': Build.startPaste(); break;
      case 'KeyX': Build.setTool('demolish'); break;
      case 'Delete': case 'Backspace': Build.deleteSelected(); e.preventDefault(); break;
      case 'Escape': Build.cancel(); break;
      case 'KeyH': UI.centerCamera(); break;
      default:
        if (/^Digit[1-9]$/.test(code)) { Build.favorite(+code.slice(5) - 1); }
    }
    if (code.startsWith('Arrow') || code === 'Space') e.preventDefault();
  },

  // movement vector from keys + joystick
  updateMovement(g) {
    let x = 0, y = 0;
    if (!Input.typing() && !UI.modalOpen()) {
      const k = Input.keys;
      if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
      if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    }
    if (Input.joy) {
      const j = Input.joy;
      const R = 54 * App.settings.joySize;
      let dx = (j.x - j.ox) / R, dy = (j.y - j.oy) / R;
      const len = Math.hypot(dx, dy);
      const dead = 0.12;
      if (len < dead) { dx = 0; dy = 0; }
      else { const k2 = Math.min(1, (len - dead) / (1 - dead)) / len; dx *= k2; dy *= k2; }
      x += dx; y += dy;
    }
    g.input.x = x; g.input.y = y;
    g.input.sprint = Input.keys.has('ShiftLeft') && !Input.drag;
    if ((x || y) && !App.cam.follow) { App.cam.follow = true; UI.updateCenterBtn(); }
  },

  // ---------------- pointers ----------------
  tileAt(sx, sy) { const w = Render.screenToWorld(sx, sy); return { x: Math.floor(w[0]), y: Math.floor(w[1]), wx: w[0], wy: w[1] }; },
  inJoyZone(x, y) {
    if (!App.touch) return false;
    const W = App.view.w, H = App.view.h;
    const left = App.settings.joySide !== 'right';
    if (App.mode === 'build') {
      const jx = left ? 90 : W - 90, jy = H - 110;
      return Math.hypot(x - jx, y - jy) < 95;
    }
    const inX = left ? x < W * 0.45 : x > W * 0.55;
    return inX && y > H * 0.35;
  },
  onDown(e) {
    Audio2.start();
    if (!App.g || !App.running) return;
    if (e.pointerType === 'touch') { App.touch = true; document.body.classList.add('touch'); }
    else if (e.pointerType === 'mouse' && App.touch) { App.touch = false; document.body.classList.remove('touch'); }
    Render.canvas.setPointerCapture && Render.canvas.setPointerCapture(e.pointerId);
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, type: e.pointerType, button: e.button, t: performance.now(), moved: false };
    Input.pointers.set(e.pointerId, p);
    UI.hideTooltip();
    if (e.pointerType === 'touch') {
      if (Input.pointers.size === 2) {
        // second finger: start pinch, cancel single-finger actions
        if (Input.drag) Input.cancelDrag();
        if (Input.joy) {
          const jp = Input.pointers.get(Input.joy.id);
          // a joystick touch that just started and has not moved is really the first finger of a pinch
          if (jp && performance.now() - jp.t < 350 && !jp.moved) Input.joyEnd();
        }
        const ps = [...Input.pointers.values()].filter(q => !Input.joy || q.id !== Input.joy.id);
        if (ps.length === 2) Input.pinch = { d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), zoom: App.cam.zoom, mx: (ps[0].x + ps[1].x) / 2, my: (ps[0].y + ps[1].y) / 2 };
        return;
      }
      if (!Input.joy && Input.inJoyZone(e.clientX, e.clientY) && !(App.mode === 'build' && Build.isLineTool() && Input.drag)) {
        Input.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        Input.showJoy();
        return;
      }
    }
    if (e.button === 2) { Build.cancel(); return; }
    if (e.button === 1) { Input.drag = { kind: 'pan', id: e.pointerId, lx: e.clientX, ly: e.clientY }; return; }
    const t = Input.tileAt(e.clientX, e.clientY);
    // start a drag-type action
    if (App.mode === 'build') {
      if ((e.shiftKey || App.tool === 'select') && App.g.run.research.done.has('massSelect')) { Input.drag = { kind: 'rect', id: e.pointerId }; App.selRect = { x0: t.x, y0: t.y, x1: t.x, y1: t.y }; return; }
      if (Build.isLineTool()) { Input.drag = { kind: 'line', id: e.pointerId, started: false, t0: t }; return; }
      if (App.tool === 'demolish') { Input.drag = { kind: 'erase', id: e.pointerId, removed: [], t0: t }; return; }
    }
    Input.drag = { kind: 'maybe', id: e.pointerId, lx: e.clientX, ly: e.clientY };
  },
  onMove(e) {
    const p = Input.pointers.get(e.pointerId);
    if (e.pointerType === 'mouse') {
      Input.mouse.x = e.clientX; Input.mouse.y = e.clientY;
      Input.mouse.inside = e.target === Render.canvas;
      if (App.g && App.running && e.target === Render.canvas && (!Input.drag || Input.drag.kind !== 'pan')) {
        const t = Input.tileAt(e.clientX, e.clientY);
        Build.hover(t.x, t.y);
        UI.hoverTooltip(e.clientX, e.clientY, t);
      }
    }
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > (p.type === 'touch' ? 10 : 5)) p.moved = true;
    if (Input.joy && Input.joy.id === e.pointerId) {
      Input.joy.x = e.clientX; Input.joy.y = e.clientY;
      Input.showJoy();
      e.preventDefault();
      return;
    }
    if (Input.pinch) {
      const ps = [...Input.pointers.values()].filter(q => !Input.joy || q.id !== Input.joy.id);
      if (ps.length >= 2) {
        const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        const mx = (ps[0].x + ps[1].x) / 2, my = (ps[0].y + ps[1].y) / 2;
        Input.zoomAt(mx, my, U.clamp(Input.pinch.zoom * d / Math.max(10, Input.pinch.d), CONFIG.zoomMin, CONFIG.zoomMax));
        // two-finger pan
        App.cam.x -= (mx - Input.pinch.mx) / App.cam.zoom; App.cam.y -= (my - Input.pinch.my) / App.cam.zoom;
        if (Math.hypot(mx - Input.pinch.mx, my - Input.pinch.my) > 0.5) { App.cam.follow = false; UI.updateCenterBtn(); }
        Input.pinch.mx = mx; Input.pinch.my = my;
      }
      e.preventDefault();
      return;
    }
    const d = Input.drag;
    if (!d || d.id !== e.pointerId) return;
    const t = Input.tileAt(e.clientX, e.clientY);
    if (d.kind === 'line') {
      if (!d.started) { d.started = true; Build.lineStart(d.t0.x, d.t0.y); }
      Build.lineMove(t.x, t.y);
      e.preventDefault();
      return;
    }
    if (d.kind === 'rect') { App.selRect.x1 = t.x; App.selRect.y1 = t.y; return; }
    if (d.kind === 'erase') { Build.eraseAt(t.x, t.y, d.removed); return; }
    if (d.kind === 'maybe' && p.moved) { d.kind = 'pan'; }
    if (d.kind === 'pan') {
      App.cam.x -= (e.clientX - d.lx) / App.cam.zoom;
      App.cam.y -= (e.clientY - d.ly) / App.cam.zoom;
      d.lx = e.clientX; d.ly = e.clientY;
      if (App.cam.follow) { App.cam.follow = false; UI.updateCenterBtn(); }
    }
  },
  onUp(e) {
    const p = Input.pointers.get(e.pointerId);
    Input.pointers.delete(e.pointerId);
    if (Input.joy && Input.joy.id === e.pointerId) {
      // a quick tap inside the joystick zone without moving counts as a normal tap
      if (p && !p.moved && performance.now() - p.t < 250) Input.tap(p.x, p.y, p);
      Input.joyEnd();
      return;
    }
    if (Input.pinch) { if (Input.pointers.size < 2) Input.pinch = null; Input.drag = null; return; }
    const d = Input.drag;
    if (!d || d.id !== e.pointerId) return;
    Input.drag = null;
    if (d.kind === 'line') {
      if (d.started) Build.lineEnd(); else Input.tap(e.clientX, e.clientY, p);
      return;
    }
    if (d.kind === 'rect') { Build.rectDone(); return; }
    if (d.kind === 'erase') { if (d.removed.length) Build.eraseDone(d.removed); else Input.tap(e.clientX, e.clientY, p); return; }
    if (d.kind === 'maybe' && p && !p.moved && e.button !== 2) Input.tap(e.clientX, e.clientY, p);
  },
  cancelDrag() {
    const d = Input.drag;
    Input.drag = null;
    if (!d) return;
    if (d.kind === 'line') Build.lineCancel();
    if (d.kind === 'rect') App.selRect = null;
    if (d.kind === 'erase' && d.removed.length) Build.eraseDone(d.removed);
  },
  tap(sx, sy, p) {
    const t = Input.tileAt(sx, sy);
    // tips can be collected by tapping
    const g = App.g;
    for (let i = 0; i < g.run.tips.length; i++) {
      const tp = g.run.tips[i];
      if (U.dist2(tp.x, tp.y, t.wx, t.wy) < 0.5) { const v = Game.collectTip(g, i); Audio2.play('coin'); Render.float('+' + Fmt.num(v), tp.x, tp.y, '#ffd24a'); return; }
    }
    if (App.mode === 'build') { Build.tap(t.x, t.y, p && p.type === 'touch'); return; }
    const b = Grid.at(g, t.x, t.y);
    UI.select(b);
  },
  onWheel(e) {
    e.preventDefault();
    if (!App.g) return;
    const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
    Input.zoomAt(e.clientX, e.clientY, U.clamp(App.cam.zoom * f, CONFIG.zoomMin, CONFIG.zoomMax));
  },
  zoomAt(sx, sy, z) {
    const before = Render.screenToWorld(sx, sy);
    App.cam.zoom = z;
    const after = Render.screenToWorld(sx, sy);
    if (!App.cam.follow) { App.cam.x += before[0] - after[0]; App.cam.y += before[1] - after[1]; }
  },
  showJoy() {
    const el = $('#joystick');
    const j = Input.joy;
    if (!j) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const s = App.settings.joySize;
    el.style.transform = 'scale(' + s + ')';
    el.style.left = j.ox + 'px'; el.style.top = j.oy + 'px';
    const R = 54 * s;
    let dx = j.x - j.ox, dy = j.y - j.oy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    el.firstElementChild.style.transform = 'translate(' + (dx / s) + 'px,' + (dy / s) + 'px)';
  },
  joyEnd() { Input.joy = null; Input.showJoy(); },

  // camera follow each frame
  updateCamera(g, dt, alpha) {
    const p = g.run.player;
    if (App.cam.follow) {
      const tx = p.px !== undefined ? p.px + (p.x - p.px) * alpha : p.x;
      const ty = (p.py !== undefined ? p.py + (p.y - p.py) * alpha : p.y) - 0.5;
      const k = 1 - Math.exp(-dt * 8);
      App.cam.x += (tx - App.cam.x) * k;
      App.cam.y += (ty - App.cam.y) * k;
      if (Math.abs(tx - App.cam.x) > 60 || Math.abs(ty - App.cam.y) > 60) { App.cam.x = tx; App.cam.y = ty; }
    }
  }
};
