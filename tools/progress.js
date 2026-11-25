// Usage: node tools/progress.js <phase> <status> "<log text>"
'use strict';
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'progress.json');
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const [phase, status, text] = process.argv.slice(2);
const now = new Date().toISOString();
if (phase) {
  const id = +phase;
  for (const ph of p.phases) {
    if (ph.id === id) ph.status = status;
    if (status === 'done' && ph.id === id + 1 && ph.status === 'open') { ph.status = 'active'; p.currentPhase = ph.id; }
  }
}
if (text) p.log.push({ time: now, text });
p.updated = now;
fs.writeFileSync(file, JSON.stringify(p, null, 2) + '\n');
console.log('progress updated');
