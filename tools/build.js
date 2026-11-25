// Concatenates src/ into the single self-contained index.html deliverable.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const list = dir => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.js')).sort().map(f => path.join(dir, f));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const coreFiles = list('src/core');
const appFiles = list('src/app');
const css = read('src/style.css');
let html = read('src/template.html');
const design = read('src/DESIGN.txt').replace(/-->/g, '- ->');
const js = '(function(){\n"use strict";\n' +
  coreFiles.map(f => '// ===== ' + f + ' =====\n' + read(f)).join('\n') + '\n' +
  appFiles.map(f => '// ===== ' + f + ' =====\n' + read(f)).join('\n') + '\n})();\n';
if (js.includes('</script')) throw new Error('Script contains </script');
html = html.replace('/*__DESIGN__*/', () => design).replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html built:', (html.length / 1024).toFixed(1) + ' KB,', html.split('\n').length, 'lines');
