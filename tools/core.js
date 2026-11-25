// Loads the DOM-free core modules into Node for headless tests and balancing.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'src/core');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const src = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const exportsList = ['GAME_TITLE','CURRENCY_NAME','CURRENCY_SHORT','CONFIG','RNG','Noise','Fmt','DATA','World','Grid','Logistics','Economy','Progression','Offline','Save','Game','Bot','SelfTest','U','Codec','GAME_VERSION','SAVE_VERSION','Items','Customers','Actions'];
const body = '"use strict";\n' + src + '\nreturn {' + exportsList.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',') + '};';
module.exports = new Function(body)();
