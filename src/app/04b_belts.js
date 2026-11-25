// =====================================================================
// BeltArt: belt tiles as cached animation frames. Base plate, riveted
// rails, moving profile (scrolls at the real belt speed), true quarter
// curves, end caps and T-inlets. Grades differ in material and motion:
// rubber / yellow metal slats / steel-blue with glowing arrows / plasma.
// =====================================================================
const BELT_GRADES = [
  { rail: '#8b939c', surf: '#303237', slat: 'rgba(255,255,255,.09)', gap: 'rgba(0,0,0,.35)', chev: null, period: 0.25, frames: 8 },
  { rail: '#e8b830', surf: '#5a6068', slat: 'rgba(255,255,255,.22)', gap: 'rgba(0,0,0,.45)', chev: null, period: 0.25, frames: 8 },
  { rail: '#4a90d8', surf: '#2c3a4c', slat: 'rgba(170,210,255,.16)', gap: 'rgba(0,0,0,.45)', chev: '#7fe8ff', period: 0.5, frames: 12 },
  { rail: '#7a3aa8', surf: '#1e1426', slat: 'rgba(255,120,230,.1)', gap: 'rgba(0,0,0,.5)', chev: '#ff6ae0', period: 0.5, frames: 12, plasma: true }
];

const BeltArt = {
  M: 0.06,
  // topology bits: 1 back connected, 2 front connected, 4 left inlet, 8 right inlet
  topo(g, b) {
    if (b._tv === g.topoVersion && b._topo !== undefined) return b._topo;
    b._tv = g.topoVersion;
    const r = b.rot, DX = U.DX, DY = U.DY;
    const feeds = d => {
      const o = Grid.at(g, b.x - DX[d], b.y - DY[d]);
      if (!o) return false;
      if (o.type === 'belt' || o.type === 'merger') return o.x + DX[o.rot] === b.x && o.y + DY[o.rot] === b.y;
      return o.type === 'splitter' || o.type === 'fsplitter' || o.type === 'osplitter';
    };
    let m = 0;
    const back = Grid.at(g, b.x - DX[r], b.y - DY[r]);
    if (back && (back.type !== 'belt' || feeds(r))) m |= 1;
    const front = Grid.at(g, b.x + DX[r], b.y + DY[r]);
    if (front && !(front.type === 'belt' && front.rot === ((r + 2) & 3)) && front.type !== 'path' && !Grid.isDeco(front.type)) m |= 2;
    if (feeds((r + 1) & 3)) m |= 4;
    if (feeds((r + 3) & 3)) m |= 8;
    b._topo = m;
    return m;
  },
  frameOf(grade, speed, tm) {
    const G = BELT_GRADES[grade];
    if (App.settings.reducedFx) return 0;
    const ph = (tm * speed / G.period) % 1;
    return Math.floor(ph * G.frames) % G.frames;
  },
  sprite(grade, shape, rot, mask, frame, ppt) {
    const k = shape === 0 ? mask & 15 : 0;
    return Art.cached('BL|' + grade + '|' + shape + '|' + rot + '|' + k + '|' + frame + '|' + ppt, () => BeltArt.render(grade, shape, rot, k, frame, ppt));
  },
  // world-space vector expressed in the local (rotated / mirrored) frame
  toLocal(wx, wy, rot, mir) {
    let x = wx, y = wy;
    for (let i = 0; i < rot; i++) { const t = x; x = y; y = -t; }
    return [x, y * mir];
  },
  render(grade, shape, rot, mask, frame, ppt) {
    const M = BeltArt.M, S = Math.ceil((1 + M * 2) * ppt);
    const c = Art.canvas(S, S), x = c.getContext('2d');
    const G = BELT_GRADES[grade];
    x.scale(S / (1 + M * 2), S / (1 + M * 2));
    x.translate(0.5 + M, 0.5 + M);
    x.rotate(rot * Math.PI / 2);
    const mir = shape === 2 ? -1 : 1;
    if (shape === 2) x.scale(1, -1);
    const off = frame < 0 ? -1 : (frame / G.frames) * G.period; // profile offset in tiles (-1 = static)
    const rail = Art.tones(G.rail);
    const [hx, hy] = BeltArt.toLocal(-0.014, -0.018, rot, mir);
    x.lineCap = 'butt';
    if (shape === 0) BeltArt.straight(x, G, rail, mask, off, hx, hy, rot, grade);
    else BeltArt.curve(x, G, rail, off, hx, hy, grade);
    return c;
  },
  straight(x, G, rail, mask, off, hx, hy, rot, grade) {
    const capB = !(mask & 1), capF = !(mask & 2);
    const x0 = capB ? -0.44 : -0.5, x1 = capF ? 0.44 : 0.5;
    // contact shadow + base plate
    x.fillStyle = 'rgba(0,0,0,.3)'; Art.rrect(x, x0 + 0.02, -0.47 + 0.03, x1 - x0, 0.96, capB || capF ? 0.12 : 0); x.fill();
    x.fillStyle = '#1b1d21'; Art.rrect(x, x0, -0.47, x1 - x0, 0.94, capB || capF ? 0.12 : 0); x.fill();
    // moving surface
    x.save(); x.beginPath(); x.rect(x0 + 0.02, -0.34, x1 - x0 - 0.04, 0.68); x.clip();
    const sg = x.createLinearGradient(0, -0.34, 0, 0.34);
    sg.addColorStop(0, Col.shade(G.surf, 0.08)); sg.addColorStop(0.5, G.surf); sg.addColorStop(1, Col.shade(G.surf, -0.15));
    x.fillStyle = sg; x.fillRect(-0.6, -0.34, 1.2, 0.68);
    // slats perpendicular to the motion (static variant: plain surface with a centre groove)
    if (off < 0) { x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(-0.6, -0.02, 1.2, 0.04); x.fillStyle = G.slat; x.fillRect(-0.6, 0.02, 1.2, 0.02); }
    else for (let s = -0.75 + (off % 0.125); s < 0.6; s += 0.125) {
      x.fillStyle = G.gap; x.fillRect(s - 0.012, -0.34, 0.024, 0.68);
      x.fillStyle = G.slat; x.fillRect(s + 0.014, -0.34, 0.02, 0.68);
    }
    if (G.chev && off >= 0) BeltArt.chevrons(x, G, off, grade);
    x.restore();
    // rails (open where a side belt joins)
    BeltArt.railStraight(x, rail, x0, x1, -0.47, -0.35, !!(mask & 4), hx, hy, G);
    BeltArt.railStraight(x, rail, x0, x1, 0.35, 0.47, !!(mask & 8), hx, hy, G);
    // end caps with rollers
    for (const [cap, cx, dir] of [[capB, x0, -1], [capF, x1, 1]]) {
      if (!cap) continue;
      x.fillStyle = rail.lo; Art.rrect(x, cx - (dir > 0 ? 0.1 : 0), -0.47, 0.1, 0.94, 0.05); x.fill();
      x.fillStyle = rail.hi; x.fillRect(cx - (dir > 0 ? 0.08 : -0.02), -0.4, 0.03, 0.8);
      x.strokeStyle = rail.edge; x.lineWidth = 0.02; Art.rrect(x, cx - (dir > 0 ? 0.1 : 0), -0.47, 0.1, 0.94, 0.05); x.stroke();
    }
  },
  railStraight(x, t, x0, x1, ya, yb, open, hx, hy, G) {
    const seg = open ? [[x0, -0.36], [0.36, x1]] : [[x0, x1]];
    for (const [a, b] of seg) {
      if (b - a < 0.02) continue;
      x.fillStyle = t.lo; x.fillRect(a, ya, b - a, yb - ya);
      x.fillStyle = t.base; x.fillRect(a, ya + 0.012, b - a, yb - ya - 0.024);
      x.fillStyle = Col.rgba(t.rim, 0.85); x.fillRect(a, (hy < 0 ? ya + 0.012 : yb - 0.03), b - a, 0.018);
      // rivets
      for (let px = Math.ceil(a / 0.25) * 0.25; px <= b - 0.05; px += 0.25) { x.fillStyle = t.edge; x.beginPath(); x.arc(px + 0.012, (ya + yb) / 2 + 0.008, 0.017, 0, Math.PI * 2); x.fill(); x.fillStyle = t.hi; x.beginPath(); x.arc(px, (ya + yb) / 2, 0.015, 0, Math.PI * 2); x.fill(); }
      if (G.plasma) { x.fillStyle = 'rgba(255,90,230,.9)'; x.fillRect(a, (ya + yb) / 2 - 0.008, b - a, 0.016); }
    }
    if (open) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(-0.36, ya, 0.72, yb - ya); }
  },
  chevrons(x, G, off, grade) {
    for (let s = -1 + (off % 0.5); s < 0.8; s += 0.5) {
      if (G.plasma) {
        const g = x.createRadialGradient(s, 0, 0, s, 0, 0.3);
        g.addColorStop(0, 'rgba(255,120,235,.55)'); g.addColorStop(1, 'rgba(255,80,220,0)');
        x.fillStyle = g; x.fillRect(s - 0.32, -0.34, 0.64, 0.68);
      }
      x.strokeStyle = Col.rgba(G.chev, 0.35); x.lineWidth = 0.11;
      x.beginPath(); x.moveTo(s - 0.09, -0.19); x.lineTo(s + 0.07, 0); x.lineTo(s - 0.09, 0.19); x.stroke();
      x.strokeStyle = G.chev; x.lineWidth = 0.045; x.stroke();
    }
  },
  curve(x, G, rail, off, hx, hy, grade) {
    const cx = 0.5, cy = -0.5, A0 = Math.PI / 2, A1 = Math.PI;
    const ring = (r0, r1) => { x.beginPath(); x.arc(cx, cy, r1, A0, A1); x.arc(cx, cy, r0, A1, A0, true); x.closePath(); };
    x.fillStyle = 'rgba(0,0,0,.3)'; x.save(); x.translate(0.02, 0.03); ring(0.03, 0.97); x.fill(); x.restore();
    x.fillStyle = '#1b1d21'; ring(0.03, 0.97); x.fill();
    // surface
    x.save(); ring(0.16, 0.84); x.clip();
    const sg = x.createRadialGradient(cx, cy, 0.16, cx, cy, 0.84);
    sg.addColorStop(0, Col.shade(G.surf, -0.12)); sg.addColorStop(1, Col.shade(G.surf, 0.06));
    x.fillStyle = sg; x.fillRect(-0.6, -0.6, 1.2, 1.2);
    // slats radial; the profile moves from angle PI to PI/2 (one tile length = quarter turn)
    const dA = (Math.PI / 2) * 0.125, offA = (off % 0.125) / 0.125 * dA;
    if (off < 0) { x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 0.04; x.beginPath(); x.arc(cx, cy, 0.5, A0, A1); x.stroke(); }
    else for (let a = A1 + dA - offA; a > A0 - dA; a -= dA) {
      const c = Math.cos(a), s = Math.sin(a);
      x.strokeStyle = G.gap; x.lineWidth = 0.024; x.beginPath(); x.moveTo(cx + c * 0.16, cy + s * 0.16); x.lineTo(cx + c * 0.84, cy + s * 0.84); x.stroke();
      const a2 = a - 0.04, c2 = Math.cos(a2), s2 = Math.sin(a2);
      x.strokeStyle = G.slat; x.lineWidth = 0.02; x.beginPath(); x.moveTo(cx + c2 * 0.16, cy + s2 * 0.16); x.lineTo(cx + c2 * 0.84, cy + s2 * 0.84); x.stroke();
    }
    if (G.chev && off >= 0) {
      const pA = Math.PI / 4, oA = (off % 0.5) / 0.5 * pA;
      for (let a = A1 + pA - oA; a > A0 - pA; a -= pA) {
        const px = cx + Math.cos(a) * 0.5, py = cy + Math.sin(a) * 0.5;
        x.save(); x.translate(px, py); x.rotate(a - Math.PI / 2 + Math.PI);
        if (G.plasma) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 0.3); g.addColorStop(0, 'rgba(255,120,235,.55)'); g.addColorStop(1, 'rgba(255,80,220,0)'); x.fillStyle = g; x.fillRect(-0.32, -0.32, 0.64, 0.64); }
        x.strokeStyle = Col.rgba(G.chev, 0.35); x.lineWidth = 0.11; x.beginPath(); x.moveTo(-0.09, -0.19); x.lineTo(0.07, 0); x.lineTo(-0.09, 0.19); x.stroke();
        x.strokeStyle = G.chev; x.lineWidth = 0.045; x.stroke();
        x.restore();
      }
    }
    x.restore();
    // rails as arcs
    for (const [r0, r1] of [[0.03, 0.15], [0.85, 0.97]]) {
      x.strokeStyle = rail.lo; x.lineWidth = r1 - r0; x.beginPath(); x.arc(cx, cy, (r0 + r1) / 2, A0, A1); x.stroke();
      x.strokeStyle = rail.base; x.lineWidth = r1 - r0 - 0.024; x.stroke();
      x.save(); x.translate(hx, hy); x.strokeStyle = Col.rgba(rail.rim, 0.7); x.lineWidth = 0.016; x.beginPath(); x.arc(cx, cy, r1 - 0.02, A0, A1); x.stroke(); x.restore();
      const n = r1 > 0.5 ? 6 : 2;
      for (let i = 0; i <= n; i++) { const a = A0 + (A1 - A0) * (i + 0.5) / (n + 1), rr = (r0 + r1) / 2; x.fillStyle = rail.hi; x.beginPath(); x.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.015, 0, Math.PI * 2); x.fill(); }
      if (G.plasma) { x.strokeStyle = 'rgba(255,90,230,.9)'; x.lineWidth = 0.016; x.beginPath(); x.arc(cx, cy, (r0 + r1) / 2, A0, A1); x.stroke(); }
    }
  },

  // ---------------- drawing ----------------
  draw(ctx, g, list, tm) {
    if (!list.length) return;
    const z = App.cam.zoom, ox = Render.ox, oy = Render.oy;
    if (z < 9) { BeltArt.drawFlat(ctx, list); return; }
    if (Render.ppt() <= 64) { BeltArt.drawChunked(ctx, g, list, tm); return; }
    const ppt = Art.bucket(Render.ppt() * (1 + BeltArt.M * 2), 128);
    const M = BeltArt.M, size = 1 + M * 2;
    const frames = [0, 0, 0, 0];
    for (let gr = 0; gr < 4; gr++) frames[gr] = BeltArt.frameOf(gr, CONFIG.belt.speed[gr], tm);
    let boosted = null;
    for (const b of list) {
      const shape = Draw.beltShape(g, b);
      const mask = shape === 0 ? BeltArt.topo(g, b) : 0;
      const fr = b.boost > 1 ? BeltArt.frameOf(b.grade, CONFIG.belt.speed[b.grade] * b.boost, tm) : frames[b.grade];
      const s = BeltArt.sprite(b.grade, shape, b.rot, mask, fr, ppt);
      ctx.drawImage(s, b.x - ox - M, b.y - oy - M, size, size);
      if (b.boost > 1) (boosted || (boosted = [])).push(b);
    }
    if (boosted) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(155,240,106,' + (0.1 + 0.06 * Math.sin(tm * 6)).toFixed(3) + ')';
      ctx.beginPath();
      for (const b of boosted) { if (b.rot & 1) { ctx.rect(b.x - ox + 0.03, b.y - oy, 0.1, 1); ctx.rect(b.x - ox + 0.87, b.y - oy, 0.1, 1); } else { ctx.rect(b.x - ox, b.y - oy + 0.03, 1, 0.1); ctx.rect(b.x - ox, b.y - oy + 0.87, 1, 0.1); } }
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  },
  // mid zoom: static belt layer cached per 16x16 sub-chunk + batched moving profile
  chunks: new Map(), SS: 16,
  drawChunked(ctx, g, list, tm) {
    const ppt = Art.bucket(Render.ppt(), 64), ox = Render.ox, oy = Render.oy;
    const SS = BeltArt.SS = ppt <= 24 ? 32 : 16;
    if (BeltArt._ss !== SS) { BeltArt.chunks.clear(); BeltArt._ss = SS; }
    const seen = BeltArt._seen || (BeltArt._seen = new Map());
    seen.clear();
    for (const b of list) { const k = U.chunkKey(Math.floor(b.x / SS), Math.floor(b.y / SS)); let arr = seen.get(k); if (!arr) seen.set(k, arr = []); arr.push(b); }
    const now = App.now;
    let budget = 3;
    for (const [key, arr] of seen) {
      let e = BeltArt.chunks.get(key);
      const cx = U.chunkKeyX(key), cy = U.chunkKeyY(key);
      if (!e || e.ppt !== ppt || e.tv !== g.topoVersion) {
        // signature over the sub-chunk's belts decides whether the cached layer is still valid
        const all = BeltArt.subBelts(g, cx, cy);
        let sig = 0;
        for (const b of all) { const sh = Draw.beltShape(g, b), m = sh === 0 ? BeltArt.topo(g, b) : 0; sig = (sig * 31 + b.x * 7 + b.y * 13 + b.rot * 3 + b.grade * 5 + sh * 17 + m * 11) | 0; }
        let ok = true;
        if (!e || e.ppt !== ppt || e.sig !== sig || e.n !== all.length) {
          if (budget-- <= 0 && e && e.canvas) ok = false; // keep the old layer, retry next frame
          else { e = BeltArt.renderChunk(g, cx, cy, ppt, all, e && e.ppt === ppt ? e : null); e.sig = sig; e.n = all.length; }
        }
        if (ok) e.tv = g.topoVersion;
        BeltArt.chunks.set(key, e);
      }
      e.used = now;
      ctx.drawImage(e.canvas, cx * SS - ox, cy * SS - oy, SS, SS);
    }
    // evict layers not used recently (memory budget ~64 MB)
    let px = 0; for (const e of BeltArt.chunks.values()) px += e.canvas.width * e.canvas.height;
    const capPx = App.touch ? 6e6 : 11e6;
    if (px > capPx) for (const [k, e] of [...BeltArt.chunks.entries()].sort((a, b) => a[1].used - b[1].used)) { if (px <= capPx * 0.7 || now - e.used < 50) break; px -= e.canvas.width * e.canvas.height; BeltArt.chunks.delete(k); }
    if (App.settings.reducedFx || BeltArt.noMotion) return;
    // moving profile: slats (close zoom) and chevrons, one path per grade
    const o = BeltArt._o2 || (BeltArt._o2 = [0, 0, 0, 0]), fake = { p: 0, pp: 0, from: 0 };
    const slats = Render.ppt() >= 34;
    ctx.lineCap = 'butt';
    for (let gr = 0; gr < 4; gr++) {
      const G = BELT_GRADES[gr];
      const ph = (tm * CONFIG.belt.speed[gr] / 0.5) % 1;
      let any = false;
      if (slats) {
        ctx.beginPath();
        for (const b of list) {
          if (b.grade !== gr) continue;
          any = true;
          fake.from = b.shape !== 0 ? (b.shape === 1 ? (b.rot + 1) & 3 : (b.rot + 3) & 3) : b.rot;
          for (let k = 0; k < 4; k++) {
            fake.p = fake.pp = (ph * 0.5 + k * 0.25 + 0.125) % 1;
            BeltArt.itemPos(g, b, fake, 1, o);
            const x = o[0] - ox, y = o[1] - oy, px2 = -o[3] * 0.32, py2 = o[2] * 0.32;
            ctx.moveTo(x - px2, y - py2); ctx.lineTo(x + px2, y + py2);
          }
        }
        if (any) { ctx.strokeStyle = G.gap; ctx.lineWidth = 0.035; ctx.stroke(); }
        if (!G.chev) continue;
      }
      ctx.beginPath();
      any = false;
      if (Render.ppt() < 16) {
        // far: one short dash per tile, straight segments only (cheap motion cue)
        const p = ph * 0.5, DX = U.DX, DY = U.DY;
        for (const b of list) {
          if (b.grade !== gr || b.shape !== 0) continue;
          any = true;
          const d = (p * 2 % 1) - 0.5, x = b.x + 0.5 - ox + DX[b.rot] * d, y = b.y + 0.5 - oy + DY[b.rot] * d;
          ctx.moveTo(x - DX[b.rot] * 0.12, y - DY[b.rot] * 0.12); ctx.lineTo(x + DX[b.rot] * 0.12, y + DY[b.rot] * 0.12);
        }
        if (any) { ctx.strokeStyle = G.chev || (gr === 1 ? 'rgba(255,240,180,.45)' : 'rgba(255,255,255,.28)'); ctx.lineWidth = 0.12; ctx.stroke(); }
        continue;
      }
      // chevrons: butt caps / miter joins (cheap to rasterise), one per tile at mid zoom
      const per = slats ? 2 : 1;
      for (const b of list) {
        if (b.grade !== gr) continue;
        any = true;
        fake.from = b.shape !== 0 ? (b.shape === 1 ? (b.rot + 1) & 3 : (b.rot + 3) & 3) : b.rot;
        for (let k = 0; k < per; k++) {
          fake.p = fake.pp = (ph * (per === 2 ? 0.5 : 1) + k * 0.5) % 1;
          BeltArt.itemPos(g, b, fake, 1, o);
          const x = o[0] - ox, y = o[1] - oy, dx = o[2] * 0.09, dy = o[3] * 0.09;
          ctx.moveTo(x - dx - dy * 1.9, y - dy + dx * 1.9); ctx.lineTo(x + dx, y + dy); ctx.lineTo(x - dx + dy * 1.9, y - dy - dx * 1.9);
        }
      }
      if (!any) continue;
      ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      ctx.strokeStyle = G.chev || (gr === 1 ? 'rgba(255,240,180,.5)' : 'rgba(255,255,255,.3)'); ctx.lineWidth = gr >= 2 ? 0.07 : 0.06;
      ctx.stroke();
    }
    let boosted = false;
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(155,240,106,' + (0.1 + 0.06 * Math.sin(tm * 6)).toFixed(3) + ')'; ctx.beginPath();
    for (const b of list) if (b.boost > 1) { boosted = true; if (b.rot & 1) { ctx.rect(b.x - ox + 0.03, b.y - oy, 0.1, 1); ctx.rect(b.x - ox + 0.87, b.y - oy, 0.1, 1); } else { ctx.rect(b.x - ox, b.y - oy + 0.03, 1, 0.1); ctx.rect(b.x - ox, b.y - oy + 0.87, 1, 0.1); } }
    if (boosted) ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },
  subBelts(g, scx, scy) {
    const SS = BeltArt.SS, S = CONFIG.chunkSize;
    const x0 = scx * SS, y0 = scy * SS;
    const set = g.bchunk.get(U.chunkKey(Math.floor(x0 / S), Math.floor(y0 / S)));
    const out = [];
    if (set) for (const id of set) { const b = g.buildings.get(id); if (b && b.type === 'belt' && b.x >= x0 && b.x < x0 + SS && b.y >= y0 && b.y < y0 + SS) out.push(b); }
    return out;
  },
  renderChunk(g, cx, cy, ppt, belts, old) {
    const SS = BeltArt.SS, M = BeltArt.M, size = 1 + M * 2;
    const c = old ? old.canvas : Art.canvas(SS * ppt, SS * ppt);
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
    x.setTransform(ppt, 0, 0, ppt, -cx * SS * ppt, -cy * SS * ppt);
    const sp = Art.bucket(ppt * size, 96);
    for (const b of belts) {
      const shape = Draw.beltShape(g, b), mask = shape === 0 ? BeltArt.topo(g, b) : 0;
      x.drawImage(BeltArt.sprite(b.grade, shape, b.rot, mask, -1, sp), b.x - M, b.y - M, size, size);
    }
    return { canvas: c, ppt, used: App.now };
  },
  // far zoom: flat batched rectangles
  drawFlat(ctx, list) {
    const ox = Render.ox, oy = Render.oy;
    ctx.fillStyle = '#25282d'; ctx.beginPath();
    for (const b of list) ctx.rect(b.x - ox, b.y - oy + 0.08, 1, 0.84);
    ctx.fill();
    for (let gr = 0; gr < 4; gr++) {
      ctx.fillStyle = BELT_GRADES[gr].rail; ctx.beginPath();
      let any = false;
      for (const b of list) if (b.grade === gr) { any = true; if (b.rot & 1) ctx.rect(b.x - ox + 0.4, b.y - oy, 0.2, 1); else ctx.rect(b.x - ox, b.y - oy + 0.4, 1, 0.2); }
      if (any) ctx.fill();
    }
  },

  // position of an item on a belt (true arcs on curves)
  itemPos(g, b, it, alpha, out) {
    const p = it.pp + (it.p - it.pp) * alpha;
    const cx = b.x + 0.5, cy = b.y + 0.5;
    const shape = b.shape || 0;
    if (shape !== 0 && it.from !== b.rot) {
      // local frame: enters from -y (shape 1) / +y (shape 2), leaves to +x
      const a = Math.PI - p * Math.PI / 2;
      let lx = 0.5 + Math.cos(a) * 0.5, ly = -0.5 + Math.sin(a) * 0.5;
      if (shape === 2) ly = -ly;
      let dx = Math.sin(a), dy = -Math.cos(a) * (shape === 2 ? -1 : 1);
      for (let i = 0; i < b.rot; i++) { let t = lx; lx = -ly; ly = t; t = dx; dx = -dy; dy = t; }
      out[0] = cx + lx; out[1] = cy + ly; out[2] = dx; out[3] = dy;
      return out;
    }
    if (p < 0.5) {
      const ex = cx - U.DX[it.from] * 0.5, ey = cy - U.DY[it.from] * 0.5, k = p * 2;
      out[0] = ex + (cx - ex) * k; out[1] = ey + (cy - ey) * k; out[2] = U.DX[it.from]; out[3] = U.DY[it.from];
      return out;
    }
    const k = (p - 0.5) * 2;
    out[0] = cx + U.DX[b.rot] * 0.5 * k; out[1] = cy + U.DY[b.rot] * 0.5 * k; out[2] = U.DX[b.rot]; out[3] = U.DY[b.rot];
    return out;
  },
  // items on belts: contact shadow is part of the sprite; lateral and angular jitter, spawn pop, jam shake
  drawItems(ctx, g, list, alpha, tm) {
    const z = App.cam.zoom;
    if (z < 6) return;
    const ox = Render.ox, oy = Render.oy, now = App.now;
    const s = 0.34; // half extent in tiles
    const px = ItemArt.sizeFor(s * 2 * Render.ppt());
    const lod = z < 13;
    const out = BeltArt._o || (BeltArt._o = [0, 0, 0, 0]);
    const fx = !App.settings.reducedFx;
    // numeric memo of item sprites for this size (avoids building string keys per item)
    const memoKey = px + '|' + (Render.darkGround ? 1 : 0) + (Render.lightGround ? 2 : 0);
    if (BeltArt._mk !== memoKey || Art.tick - (BeltArt._mt || 0) > 900) { BeltArt._memo = new Map(); BeltArt._mk = memoKey; BeltArt._mt = Art.tick; }
    const memo = BeltArt._memo;
    const spr = (res, ref, rot, fr) => { const k = ((res * 4 + ref) * 3 + rot + 1) * 8 + fr; let c = memo.get(k); if (!c) { c = ItemArt.sprite(res, ref, px, rot, fr); memo.set(k, c); } return c; };
    const tier7 = Math.floor(tm * 2) & 7;
    for (const b of list) {
      const its = b.items;
      for (let i = 0; i < its.length; i++) {
        const it = its[i];
        if (!it._born) { it._born = now; it._j = Math.random(); }
        BeltArt.itemPos(g, b, it, alpha, out);
        let x = out[0] - ox, y = out[1] - oy;
        if (lod) { ctx.drawImage(spr(it.res, it.ref, 0, 0), x - s, y - s, s * 2, s * 2); continue; }
        const j = it._j;
        const lat = (j - 0.5) * 0.16;
        x += -out[3] * lat; y += out[2] * lat;
        let k = 1;
        const age = now - it._born;
        if (fx && age < 120) k = 0.6 + 0.4 * Art.ease.outBack(age / 120);
        if (fx && it.p === it.pp && it.p > 0.3) { x += Math.sin(tm * 40 + j * 20) * 0.012; }
        const rot = j < 0.33 ? -1 : j < 0.66 ? 0 : 1;
        const fr = DATA.RESOURCES[it.res].tier === 7 ? tier7 : 0;
        const e = s * k;
        ctx.drawImage(spr(it.res, it.ref, rot, fr), x - e, y - e, e * 2, e * 2);
      }
    }
  },
  // small "plop" when an item leaves a belt into a building
  plops(g, list) {
    if (App.settings.reducedFx || App.cam.zoom < 16) return;
    for (const b of list) {
      const head = b.items.length ? b.items[b.items.length - 1] : null;
      if (b._head && b._head !== head && b._headP > 0.75 && (BeltArt.topo(g, b) & 2)) {
        const f = Grid.at(g, b.x + U.DX[b.rot], b.y + U.DY[b.rot]);
        if (f && f.type !== 'belt' && !Grid.isTransport(f.type)) {
          const x = b.x + 0.5 + U.DX[b.rot] * 0.55, y = b.y + 0.5 + U.DY[b.rot] * 0.55;
          Render.spawn('ring', x, y, 0, 0, 0.3, '#ffffff', 0.18);
          Render.spawn('dust', x, y, (Math.random() - 0.5) * 0.4, -0.3, 0.4, Render.palette.particle, 0.08);
        }
      }
      b._head = head; b._headP = head ? head.p : 0;
    }
  }
};
