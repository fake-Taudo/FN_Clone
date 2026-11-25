// =====================================================================
// Build: build-mode controller (tools, ghost preview, placing, lines, demolish, selection)
// =====================================================================
const LINE_TYPES = { belt: 1, path: 1, fence: 1 };

const Build = {
  bridgeStart: null,

  isSpecTool() { return App.tool && typeof App.tool === 'object' && App.tool.type; },
  isLineTool() { return Build.isSpecTool() && LINE_TYPES[App.tool.type] === 1; },

  enter() {
    if (App.mode === 'build') return;
    App.mode = 'build';
    UI.onModeChange();
  },
  exit() {
    App.mode = 'play'; App.tool = null; App.ghost = null; App.linePath = null; Build.bridgeStart = null;
    App.selection = []; App.selRect = null;
    UI.onModeChange();
  },
  setTool(tool) {
    Build.enter();
    if (tool === 'demolish' || tool === 'select') App.tool = App.tool === tool ? null : tool;
    else if (tool && tool.type) {
      const prevRot = Build.isSpecTool() ? App.tool.rot : 0;
      App.tool = { type: tool.type, rot: tool.rot !== undefined ? tool.rot : prevRot, grade: tool.grade || 0 };
    } else App.tool = tool;
    Build.bridgeStart = null;
    App.ghost = null; App.linePath = null;
    if (App.hover) Build.hover(App.hover.x, App.hover.y);
    UI.onToolChange();
  },
  cancel() {
    if (UI.closeTopPanel()) return;
    if (App.selection.length) { App.selection = []; UI.updateSelectionBar(); return; }
    if (Build.bridgeStart) { Build.bridgeStart = null; App.ghost = null; return; }
    if (App.mode === 'build' && App.tool) { App.tool = null; App.ghost = null; UI.onToolChange(); return; }
    if (App.mode === 'build') { Build.exit(); return; }
    if (App.selected) UI.select(null);
  },
  rotate() {
    if (Build.isSpecTool()) {
      App.tool.rot = (App.tool.rot + 1) & 3;
      if (App.hover) Build.hover(App.hover.x, App.hover.y);
      Audio2.play('click');
      return;
    }
    if (App.tool && App.tool.paste) { App.tool.rot = (App.tool.rot + 1) & 3; if (App.hover) Build.hover(App.hover.x, App.hover.y); return; }
    const b = App.selected;
    if (b && App.g.buildings.has(b.id)) {
      const from = { x: b.x, y: b.y, rot: b.rot };
      const fee = b.w === 1 && b.h === 1 ? 0 : Grid.moveFee(App.g, b);
      const err = Grid.rotate(App.g, b);
      if (err) { UI.toast(err, 'bad'); Audio2.play('error'); }
      else { Actions.record(App.g, { kind: 'move', id: b.id, from, to: { x: b.x, y: b.y, rot: b.rot }, fee }); Audio2.play('click'); UI.refreshInfo(true); }
    }
  },

  // anchored top-left for a footprint so that the hovered tile is roughly centred
  anchor(type, rot, x, y) {
    const sz = Grid.size(type, rot);
    return { x: x - ((sz.w - 1) >> 1), y: y - ((sz.h - 1) >> 1) };
  },

  hover(x, y) {
    App.hover = { x, y };
    if (App.mode !== 'build') return;
    const g = App.g;
    if (Input.drag && Input.drag.kind === 'line' && Input.drag.started) return;
    if (Build.isSpecTool() && !(App.touch && App.ghost && App.ghost.locked)) {
      const t = App.tool;
      if (t.type === 'bridge') {
        if (!Build.bridgeStart) { const spec = { type: 'bridge', x, y, rot: t.rot, len: 2 }; App.ghost = { spec, ok: true, reason: 'Start der Brücke wählen', cost: Grid.cost(g, 'bridge') }; }
        else {
          const s = Build.bridgeStart;
          const dx = x - s.x, dy = y - s.y;
          let ok = (dx === 0) !== (dy === 0);
          const len = Math.abs(dx) + Math.abs(dy) + 1;
          const rot = dx > 0 ? 0 : dx < 0 ? 2 : dy > 0 ? 1 : 3;
          const spec = { type: 'bridge', x: s.x, y: s.y, rot, len: Math.max(2, len) };
          let reason = null;
          if (!ok) reason = 'Ziel muss in einer Linie liegen';
          else if (len > 6) { ok = false; reason = 'Höchstens 4 Felder überspringen'; }
          else { const chk = Grid.canPlace(g, spec); ok = chk.ok; reason = chk.reason; }
          App.ghost = { list: [{ spec, ok }], ok, reason, cost: Grid.cost(g, 'bridge') };
        }
      } else {
        const a = Build.anchor(t.type, t.rot, x, y);
        const spec = { type: t.type, x: a.x, y: a.y, rot: t.rot, grade: t.grade };
        const chk = Grid.canPlace(g, spec);
        App.ghost = { spec, ok: chk.ok, reason: chk.reason, cost: chk.cost !== undefined ? chk.cost : Grid.cost(g, t.type, { grade: t.grade, tier: chk.dep ? chk.dep.tier : 0 }), dep: chk.dep };
        if (t.type === 'extractor' && !chk.dep) {
          const any = Grid.touchingDeposits(g, a.x, a.y, 2, 2);
          if (any.length) App.ghost.dep = any[0];
        }
        if (chk.ok && Collide.mode(t.type) !== 'none') App.ghost.gap = Build.enclosesPlayer(g, spec);
      }
    } else if (App.tool && App.tool.paste) {
      Build.pasteGhost(x, y);
    } else if (App.tool && App.tool.moveGroup) {
      Build.moveGhost(x, y);
    } else if (!Build.isSpecTool()) {
      App.ghost = null;
    }
    UI.updateGhostInfo();
  },

  // gentle hint (never blocking): would this placement wall the astronaut in?
  enclosesPlayer(g, spec) {
    const sz = Grid.size(spec.type, spec.rot, spec.len);
    const p = g.run.player, px = Math.floor(p.x), py = Math.floor(p.y), R = 12;
    if (Math.abs(spec.x - px) > R + 4 || Math.abs(spec.y - py) > R + 4) return false;
    const inGhost = (x, y) => x >= spec.x && x < spec.x + sz.w && y >= spec.y && y < spec.y + sz.h;
    const seen = new Set([px + ',' + py]), q = [[px, py]];
    while (q.length) {
      const [x, y] = q.shift();
      if (Math.abs(x - px) >= R || Math.abs(y - py) >= R) return false;
      for (let d = 0; d < 4; d++) {
        const nx = x + U.DX[d], ny = y + U.DY[d], k = nx + ',' + ny;
        if (seen.has(k) || inGhost(nx, ny) || Paths.blocked(g, nx, ny)) continue;
        seen.add(k); q.push([nx, ny]);
      }
      if (seen.size > 2500) return false;
    }
    return true;
  },

  tap(x, y, isTouch) {
    const g = App.g;
    if (App.tool === 'demolish') {
      const b = Grid.at(g, x, y);
      if (b) { const r = Actions.removeMany(g, [b]); Build.afterRemove([b], r); }
      return;
    }
    if (App.tool === 'select' || !App.tool) {
      UI.select(Grid.at(g, x, y));
      return;
    }
    if (App.tool.paste) {
      if (isTouch && !(App.ghost && App.ghost.at && App.ghost.at.x === x && App.ghost.at.y === y)) { Build.hover(x, y); return; }
      Build.pasteAt(x, y); return;
    }
    if (App.tool.moveGroup) {
      if (isTouch && !(App.ghost && App.ghost.at && App.ghost.at.x === x && App.ghost.at.y === y)) { Build.hover(x, y); return; }
      Build.moveGroupAt(x, y); return;
    }
    if (!Build.isSpecTool()) return;
    const t = App.tool;
    if (t.type === 'bridge') {
      if (!Build.bridgeStart) {
        const chk = Grid.at(g, x, y);
        if (chk) { UI.toast('Feld ist belegt', 'bad'); Audio2.play('error'); return; }
        Build.bridgeStart = { x, y }; Build.hover(x, y); Audio2.play('click');
        UI.toast('Jetzt das Ziel der Brücke wählen (bis zu 4 Felder Abstand).');
        return;
      }
      Build.hover(x, y);
      const gh = App.ghost;
      if (gh && gh.list && gh.ok) {
        const res = Actions.placeMany(g, [gh.list[0].spec]);
        if (res.placed.length) { Build.afterPlace(res.placed, res.spent); Build.bridgeStart = null; App.ghost = null; }
      } else { UI.toast(gh && gh.reason ? gh.reason : 'Ungültig', 'bad'); Audio2.play('error'); }
      return;
    }
    const a = Build.anchor(t.type, t.rot, x, y);
    if (isTouch) {
      // first tap positions the ghost, a second tap on the same spot (or the ✓ button) places it
      const gh = App.ghost;
      if (!gh || !gh.spec || gh.spec.x !== a.x || gh.spec.y !== a.y || !gh.touchArmed) {
        Build.hover(x, y);
        if (App.ghost) App.ghost.touchArmed = true;
        return;
      }
    }
    Build.placeSpec({ type: t.type, x: a.x, y: a.y, rot: t.rot, grade: t.grade });
  },
  confirm() {
    const gh = App.ghost;
    if (!gh) return;
    if (App.tool && App.tool.paste && gh.at) { Build.pasteAt(gh.at.x, gh.at.y); return; }
    if (App.tool && App.tool.moveGroup && gh.at) { Build.moveGroupAt(gh.at.x, gh.at.y); return; }
    if (gh.spec && Build.isSpecTool()) {
      if (App.tool.type === 'bridge') { if (App.hover) Build.tap(App.hover.x, App.hover.y, false); return; }
      Build.placeSpec(Object.assign({}, gh.spec));
    }
  },
  placeSpec(spec) {
    const g = App.g;
    const chk = Grid.canPlace(g, spec);
    if (!chk.ok) { UI.toast(chk.reason, 'bad'); Audio2.play('error'); return false; }
    const res = Actions.placeMany(g, [spec]);
    if (!res.placed.length) { UI.toast(res.fail || 'Nicht möglich', 'bad'); Audio2.play('error'); return false; }
    Build.afterPlace(res.placed, res.spent);
    if (App.hover) Build.hover(App.hover.x, App.hover.y);
    return true;
  },
  afterPlace(list, spent) {
    const b = list[list.length - 1];
    Audio2.play(b.type === 'belt' ? 'belt' : 'build');
    const r = Grid.rect(b);
    if (spent > 0) Render.float('-' + Fmt.num(spent) + ' ' + CURRENCY_SHORT, r.x + r.w / 2, r.y, '#ff9a8a');
    const now = App.now;
    for (const pb of list) pb._pop = now;
    if (!App.settings.reducedFx) {
      for (let i = 0; i < 10; i++) Render.spawn('dust', r.x + Math.random() * r.w, r.y + r.h - Math.random() * 0.5, (Math.random() - 0.5) * 2, -Math.random(), 0.8, Render.palette.particle, 0.1);
      if (b.type !== 'belt' && b.type !== 'path' && b.type !== 'fence') Render.ring(r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.7, '#ffffff', 0.45);
    }
    Tutorial.onEvent('place', b);
    UI.refreshBuildBar();
  },
  demolishFx(b) {
    if (!b || b.x === undefined) return;
    const r = Grid.rect(b), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const big = r.w * r.h > 1;
    Render.puff(cx, cy + r.h * 0.3, big ? 14 : 5, Render.palette.particle, big ? 0.35 : 0.2);
    Render.puff(cx, cy, big ? 6 : 2, '#c8c8c8', big ? 0.3 : 0.15);
    if (big) Render.coinBurst(cx, cy, 6);
  },
  afterRemove(list, refund) {
    Audio2.play('remove');
    const b = list[0];
    if (b) Render.float('+' + Fmt.num(refund) + ' ' + CURRENCY_SHORT, b.x + b.w / 2, b.y, '#9bff8c');
    if (!App.settings.reducedFx) for (const o of list.slice(0, 40)) Build.demolishFx(o);
    if (App.selected && list.includes(App.selected)) UI.select(null);
    UI.refreshBuildBar();
  },

  // ---------------- lines (belts, paths, fences) ----------------
  lineStart(x, y) { App.linePath = [[x, y]]; Build.lineGhost(); },
  lineMove(x, y) {
    const path = App.linePath;
    if (!path) return;
    let last = path[path.length - 1];
    let guard = 0;
    while ((last[0] !== x || last[1] !== y) && guard++ < 400) {
      const dx = x - last[0], dy = y - last[1];
      let nx = last[0], ny = last[1];
      if (Math.abs(dx) >= Math.abs(dy)) nx += Math.sign(dx); else ny += Math.sign(dy);
      if (path.length >= 2 && path[path.length - 2][0] === nx && path[path.length - 2][1] === ny) path.pop();
      else if (!path.some(p => p[0] === nx && p[1] === ny)) path.push([nx, ny]);
      else break;
      last = path[path.length - 1];
      if (path.length > 600) break;
    }
    Build.lineGhost();
  },
  lineSpecs() {
    const path = App.linePath, t = App.tool;
    const out = [];
    for (let i = 0; i < path.length; i++) {
      let rot = t.rot;
      if (i < path.length - 1) { const dx = path[i + 1][0] - path[i][0], dy = path[i + 1][1] - path[i][1]; rot = dx > 0 ? 0 : dx < 0 ? 2 : dy > 0 ? 1 : 3; }
      else if (i > 0) { const dx = path[i][0] - path[i - 1][0], dy = path[i][1] - path[i - 1][1]; rot = dx > 0 ? 0 : dx < 0 ? 2 : dy > 0 ? 1 : 3; }
      out.push({ type: t.type, x: path[i][0], y: path[i][1], rot, grade: t.grade });
    }
    return out;
  },
  lineGhost() {
    const g = App.g;
    const specs = Build.lineSpecs();
    let money = g.run.money, total = 0, okCount = 0;
    const kits = Object.assign({}, g.run.kits);
    const counts = g.run.counts.belt || 0;
    const list = specs.map((s, i) => {
      const chk = Grid.canPlace(g, s, { ignoreMoney: true });
      let cost = 0;
      if (chk.ok) {
        if (kits[s.type] > 0) { kits[s.type]--; cost = 0; }
        else cost = s.type === 'belt' ? Grid.baseCost('belt', { grade: s.grade }) * Math.pow(CONFIG.beltCostGrowth, counts + okCount) : Grid.cost(g, s.type);
      }
      const ok = chk.ok && cost <= money + 1e-9;
      if (ok) { money -= cost; total += cost; okCount++; }
      return { spec: s, ok, reason: chk.ok ? (ok ? null : 'Zu teuer') : chk.reason };
    });
    if (specs.length) App.tool.rot = specs[specs.length - 1].rot;
    const firstBad = list.find(l => !l.ok);
    App.ghost = { list, ok: okCount > 0, cost: total, count: okCount, reason: firstBad ? firstBad.reason : null, line: true };
    UI.updateGhostInfo();
  },
  lineEnd() {
    const g = App.g;
    const gh = App.ghost;
    App.linePath = null;
    if (!gh || !gh.list) return;
    const specs = gh.list.filter(l => l.ok).map(l => l.spec);
    if (!specs.length) { UI.toast(gh.reason || 'Nichts platzierbar', 'bad'); Audio2.play('error'); App.ghost = null; return; }
    const res = Actions.placeMany(g, specs);
    App.ghost = null;
    if (res.placed.length) {
      Build.afterPlace(res.placed, res.spent);
      if (res.placed.length < gh.list.length) UI.toast(res.placed.length + ' von ' + gh.list.length + ' Feldern gebaut' + (gh.reason ? ' (' + gh.reason + ')' : ''));
    }
    if (App.hover) Build.hover(App.hover.x, App.hover.y);
  },
  lineCancel() { App.linePath = null; App.ghost = null; UI.updateGhostInfo(); },

  // ---------------- demolish ----------------
  eraseAt(x, y, removed) {
    const g = App.g;
    const b = Grid.at(g, x, y);
    if (!b) return;
    const spec = Object.assign(Grid.toSpec(b), { id: b.id });
    spec.refund = Grid.remove(g, b);
    removed.push(spec);
    Audio2.play('remove');
    Render.float('+' + Fmt.num(spec.refund), b.x + b.w / 2, b.y, '#9bff8c');
    if (!App.settings.reducedFx) Build.demolishFx(b);
    if (App.selected === b) UI.select(null);
  },
  eraseDone(removed) { Actions.record(App.g, { kind: 'remove', specs: removed }); UI.refreshBuildBar(); },
  deleteSelected() {
    const g = App.g;
    if (App.selection.length) {
      const list = App.selection.filter(b => g.buildings.has(b.id));
      const r = Actions.removeMany(g, list);
      Build.afterRemove(list, r);
      App.selection = []; UI.updateSelectionBar();
      UI.toast(list.length + ' Objekte abgerissen (+' + Fmt.money(r) + ')');
      return;
    }
    if (App.selected && g.buildings.has(App.selected.id)) {
      const b = App.selected;
      const r = Actions.removeMany(g, [b]);
      Build.afterRemove([b], r);
    }
  },

  // ---------------- selection, move, blueprints ----------------
  rectDone() {
    const g = App.g, s = App.selRect;
    App.selRect = null;
    if (!s) return;
    const x0 = Math.min(s.x0, s.x1), y0 = Math.min(s.y0, s.y1), x1 = Math.max(s.x0, s.x1), y1 = Math.max(s.y0, s.y1);
    const set = new Set();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const b = Grid.at(g, x, y); if (b) set.add(b); }
    App.selection = [...set];
    UI.updateSelectionBar();
  },
  startMoveGroup() {
    if (!App.selection.length) return;
    const xs = App.selection.map(b => Grid.rect(b));
    const minX = Math.min(...xs.map(r => r.x)), minY = Math.min(...xs.map(r => r.y));
    App.tool = { moveGroup: App.selection.slice(), ox: minX, oy: minY, rot: 0 };
    UI.onToolChange();
    UI.toast('Ziel wählen: Die Auswahl wird mit der linken oberen Ecke dort platziert.');
  },
  moveGhost(x, y) {
    const g = App.g, t = App.tool;
    const dx = x - t.ox, dy = y - t.oy;
    const ids = new Set(t.moveGroup.map(b => b.id));
    const list = t.moveGroup.map(b => {
      const spec = { type: b.type, x: b.x + dx, y: b.y + dy, rot: b.rot, len: b.len, grade: b.grade };
      const ok = Grid.occTiles(spec.type, spec.x, spec.y, spec.rot, spec.len).every(tt => { const id = g.occ.get(U.tileKey(tt[0], tt[1])); return id === undefined || ids.has(id); });
      return { spec, ok };
    });
    const fee = t.moveGroup.reduce((a, b) => a + Grid.moveFee(g, b), 0);
    App.ghost = { list, ok: list.every(l => l.ok), cost: fee, at: { x, y }, reason: list.every(l => l.ok) ? null : 'Blockiert' };
  },
  moveGroupAt(x, y) {
    const g = App.g, t = App.tool;
    Build.moveGhost(x, y);
    const gh = App.ghost;
    if (!gh.ok) { UI.toast(gh.reason || 'Blockiert', 'bad'); Audio2.play('error'); return; }
    if (gh.cost > g.run.money) { UI.toast('Zu teuer', 'bad'); Audio2.play('error'); return; }
    const dx = x - t.ox, dy = y - t.oy;
    const group = t.moveGroup.filter(b => g.buildings.has(b.id));
    // extractors must stay at a deposit
    for (const b of group) if (b.type === 'extractor') {
      const deps = Grid.touchingDeposits(g, b.x + dx, b.y + dy, b.w, b.h);
      if (!deps.some(d => d.id === b.dep || Grid.depositFree(g, d) > 0)) { UI.toast('Extraktoren müssen an einem Vorkommen bleiben', 'bad'); Audio2.play('error'); return; }
    }
    for (const b of group) Grid.unregister(g, b);
    for (const b of group) {
      b.x += dx; b.y += dy;
      if (b.type === 'extractor') {
        const deps = Grid.touchingDeposits(g, b.x, b.y, b.w, b.h).filter(d => d.id === b.dep || Grid.depositFree(g, d) > 0);
        if (deps.length && !deps.some(d => d.id === b.dep)) { const d = deps.sort((a, c) => c.tier - a.tier)[0]; b.dep = d.id; b.res = d.res; b.tier = d.tier; }
      }
      Grid.register(g, b);
    }
    g.run.money -= gh.cost;
    g.undo.length = 0; g.redo.length = 0; // group moves are not undoable (documented)
    Audio2.play('build');
    App.selection = []; App.tool = null; App.ghost = null;
    UI.onToolChange(); UI.updateSelectionBar();
    UI.toast(group.length + ' Objekte verschoben (−' + Fmt.money(gh.cost) + ')');
  },
  copySelection() {
    const g = App.g;
    if (!g.run.research.done.has('blueprints')) { UI.toast('Forschung nötig: Blaupausen', 'bad'); return; }
    if (!App.selection.length) { UI.toast('Erst eine Auswahl treffen (Shift+Ziehen bzw. Auswahl-Werkzeug)'); return; }
    const rects = App.selection.map(b => Grid.rect(b));
    const minX = Math.min(...rects.map(r => r.x)), minY = Math.min(...rects.map(r => r.y));
    const items = App.selection.filter(b => b.type !== 'extractor').map(b => ({ type: b.type, dx: b.x - minX, dy: b.y - minY, rot: b.rot, len: b.len, grade: b.grade, filter: b.filter || null }));
    if (!items.length) { UI.toast('Extraktoren lassen sich nicht kopieren', 'bad'); return; }
    App.blueprint = { items };
    UI.toast('Blaupause mit ' + items.length + ' Objekten kopiert. V oder Einfügen zum Platzieren.', 'good');
    Build.startPaste();
  },
  startPaste() {
    if (!App.blueprint) { UI.toast('Keine Blaupause vorhanden'); return; }
    Build.enter();
    App.selection = []; UI.updateSelectionBar();
    App.tool = { paste: App.blueprint, rot: 0 };
    UI.onToolChange();
    if (App.hover) Build.hover(App.hover.x, App.hover.y);
  },
  bpTransform(it, rot) {
    // rotate blueprint offsets around origin
    let dx = it.dx, dy = it.dy;
    for (let i = 0; i < rot; i++) { const t = dx; dx = -dy; dy = t; }
    return { dx, dy, rot: (it.rot + rot) & 3 };
  },
  pasteGhost(x, y) {
    const g = App.g, t = App.tool;
    let money = g.run.money, total = 0;
    const list = t.paste.items.map(it => {
      const tr = Build.bpTransform(it, t.rot);
      let sx = x + tr.dx, sy = y + tr.dy;
      if (t.rot) { const sz = Grid.size(it.type, tr.rot, it.len); if (t.rot === 1) sx -= sz.w - 1; else if (t.rot === 2) { sx -= sz.w - 1; sy -= sz.h - 1; } else if (t.rot === 3) sy -= sz.h - 1; }
      const spec = { type: it.type, x: sx, y: sy, rot: tr.rot, len: it.len, grade: it.grade, filter: it.filter };
      const chk = Grid.canPlace(g, spec, { ignoreMoney: true });
      const ok = chk.ok && chk.cost <= money;
      if (ok) { money -= chk.cost; total += chk.cost; }
      return { spec, ok };
    });
    App.ghost = { list, ok: list.some(l => l.ok), cost: total, at: { x, y }, count: list.filter(l => l.ok).length, reason: list.every(l => l.ok) ? null : 'Teilweise blockiert' };
  },
  pasteAt(x, y) {
    Build.pasteGhost(x, y);
    const gh = App.ghost;
    const specs = gh.list.filter(l => l.ok).map(l => l.spec);
    if (!specs.length) { UI.toast('Blaupause passt hier nicht', 'bad'); Audio2.play('error'); return; }
    const res = Actions.placeMany(App.g, specs);
    if (res.placed.length) { Build.afterPlace(res.placed, res.spent); UI.toast(res.placed.length + ' Objekte aus Blaupause gebaut'); }
  },

  pipette() {
    const g = App.g;
    const hv = App.hover;
    const b = hv ? Grid.at(g, hv.x, hv.y) : App.selected;
    if (!b) return;
    if (b.type === 'bridge') { Build.setTool({ type: 'bridge', rot: b.rot }); return; }
    Build.setTool({ type: b.type, rot: b.rot, grade: b.grade || 0 });
    UI.toast('Pipette: ' + (b.type === 'belt' ? DATA.BELT_GRADES[b.grade].name : DATA.BUILDINGS[b.type].name));
  },
  favorite(i) {
    const f = App.settings.favorites[i];
    if (!f) return;
    const [type, grade] = f.split(':');
    if (!DATA.BUILDINGS[type]) return;
    Build.setTool({ type, grade: +grade || 0 });
    UI.toggleBuild(true);
  },
  undo() {
    const err = Actions.undo(App.g);
    if (err) { UI.toast(err, 'bad'); Audio2.play('error'); } else { Audio2.play('click'); UI.toast('Rückgängig gemacht'); }
    if (App.selected && !App.g.buildings.has(App.selected.id)) UI.select(null);
    UI.refreshBuildBar();
  },
  redo() {
    const err = Actions.redo(App.g);
    if (err) { UI.toast(err, 'bad'); Audio2.play('error'); } else { Audio2.play('click'); UI.toast('Wiederholt'); }
    UI.refreshBuildBar();
  }
};
