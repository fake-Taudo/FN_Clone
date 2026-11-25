# Ares Outpost

Ein 2D-Weltraum-Außenposten-Tycoon für den Browser (Desktop und Mobil). Das komplette Spiel steckt in **`index.html`**: Datei herunterladen und per Doppelklick im Browser öffnen, ohne Server und ohne Installation.

Live-Version: https://ares-outpost-nn6s.onrender.com/ · Entwicklungsfortschritt: https://ares-outpost-nn6s.onrender.com/fortschritt.html

## Entwicklung

Der Quelltext liegt in `src/` und wird zu `index.html` zusammengebaut:

```bash
node tools/build.js
```

- `src/core/` enthält die Simulation ohne DOM (Welt, Bauen, Logistik, Wirtschaft, Kunden, Forschung, Rebirth, Offline, Speichern, Balancing-Bot, Selbsttests). `tools/core.js` lädt sie in Node.
- `src/app/` enthält Rendering, Steuerung, Oberfläche, Audio und Effekte.
- `src/DESIGN.txt` landet als Kommentarblock am Anfang der `index.html`.

Selbsttests in Node:

```bash
node -e "const C=require('./tools/core.js'); for (const r of C.SelfTest.run()) console.log(r.ok ? 'OK  ' : 'FAIL', r.name, '-', r.info)"
```

Im Spiel öffnet `Strg+Shift+D` (oder fünfmal auf das Logo tippen) das Debug-Menü mit Zeitraffer, Balancing-Report und Selbsttests.
