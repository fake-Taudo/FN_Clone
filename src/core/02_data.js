// =====================================================================
// DATA: resources, buildings, customers, planets, research, rebirth shop, achievements
// =====================================================================
const DATA = {};

DATA.TIERS = [
  { name: 'Gewöhnlich',   color: '#d9dde2', glow: 0.0 },
  { name: 'Ungewöhnlich', color: '#5fdc6e', glow: 0.15 },
  { name: 'Selten',       color: '#4aa8ff', glow: 0.3 },
  { name: 'Episch',       color: '#b46bff', glow: 0.45 },
  { name: 'Legendär',     color: '#ffb02e', glow: 0.6 },
  { name: 'Mythisch',     color: '#ff3d7f', glow: 0.75 },
  { name: 'Exotisch',     color: '#2ef2e0', glow: 0.9 },
  { name: 'Exquisit',     color: '#ffffff', glow: 1.0, prismatic: true }
];
DATA.REFINE_NAMES = ['Roh', 'Veredelt', 'Hochveredelt', 'Perfektioniert'];
DATA.SHAPES = ['circle', 'square', 'diamond', 'triangle', 'hexagon', 'pentagon', 'star', 'cross', 'ring', 'crescent', 'drop', 'octagon', 'capsule', 'trapezoid'];

// [name, fill colour, flavour text] grouped per tier (25/20/16/12/8/5/3/2 = 91)
DATA.RESOURCE_DEFS = [
  [ // Gewöhnlich
    ['Rotstaub', '#c4552d', 'Feiner Oxidstaub, der jede Ritze im Raumanzug findet.'],
    ['Basaltkies', '#5b5f66', 'Dunkler Vulkankies, schwer und zuverlässig.'],
    ['Eisenoxid', '#a8432a', 'Der Rost eines ganzen Planeten, schaufelweise.'],
    ['Regolithsand', '#cfa77a', 'Lockerer Oberflächensand, geformt von Meteoriteneinschlägen.'],
    ['Schiefersplitt', '#6f7b86', 'Spröde Platten, die bei jedem Schritt knirschen.'],
    ['Kalkstein', '#e6dcc3', 'Heller Fels aus einer Zeit, als hier Wasser floss.'],
    ['Tonerde', '#b97a4f', 'Formbarer Boden, beliebt bei Siedlern für Ziegel.'],
    ['Bimsstein', '#d8cfbf', 'So leicht, dass er fast im Wind schwebt.'],
    ['Feldspat', '#e8b9a0', 'Rosa schimmerndes Allerweltsmineral.'],
    ['Quarzsand', '#f3efe2', 'Klarer Sand, Grundstoff jedes Sichtfensters.'],
    ['Gipsbrocken', '#f6f3ea', 'Weiche, kreidige Brocken aus alten Salzseen.'],
    ['Granitschotter', '#8d8a8f', 'Grob gebrochener Urfels für Fundamente.'],
    ['Lehmklumpen', '#9c6b3f', 'Feuchter Klumpen, der nach Heimat riecht.'],
    ['Ascheflocken', '#4a4a4f', 'Graue Flocken längst erloschener Vulkane.'],
    ['Dolomit', '#d7c8b0', 'Bröckeliges Karbonat mit perlmuttartigem Glanz.'],
    ['Glimmerschuppen', '#b8b09a', 'Glitzernde Blättchen, die im Licht tanzen.'],
    ['Kieselgur', '#ece6d6', 'Pulver aus winzigen versteinerten Schalen.'],
    ['Sandstein', '#d99a5e', 'Gepresste Dünen aus Jahrmillionen.'],
    ['Magnetitkörner', '#2f3238', 'Schwarze Körner, die am Kompass zerren.'],
    ['Olivinsand', '#8fa35a', 'Olivgrüner Sand aus dem Planetenmantel.'],
    ['Mergel', '#a9967a', 'Kalkiger Ton, gut für einfache Keramik.'],
    ['Talkum', '#f0eef5', 'Das weichste Mineral, seidig zwischen den Fingern.'],
    ['Schwefelstaub', '#e8d24a', 'Gelber Staub mit unverkennbarem Geruch.'],
    ['Graphitbrocken', '#3c3f45', 'Glänzender Kohlenstoff für Schmiermittel und Stifte.'],
    ['Obsidiansplitter', '#1f1b2a', 'Scharfkantiges Vulkanglas, schwarz wie die Nacht.']
  ],
  [ // Ungewöhnlich
    ['Kupfernuggets', '#d27a3c', 'Weiche, rötliche Klumpen, begehrt für Leitungen.'],
    ['Zinnerz', '#a9b3b8', 'Unscheinbares Erz, unverzichtbar für Lote.'],
    ['Bleiglanz', '#7d8590', 'Schwere Würfel mit metallischem Glanz.'],
    ['Zinkblende', '#9f8f5a', 'Harziges Erz, das unter UV-Licht glimmt.'],
    ['Steinsalz', '#f1e3e3', 'Kristallklares Salz aus verdunsteten Meeren.'],
    ['Kalisalz', '#e9a3a3', 'Rosafarbenes Salz für Dünger in den Gewächshäusern.'],
    ['Nickelerz', '#8ba08a', 'Grünliches Erz für korrosionsfeste Legierungen.'],
    ['Bauxit', '#b5562f', 'Rotbraunes Gestein, aus dem Aluminium entsteht.'],
    ['Chromit', '#34383f', 'Schwarzes Erz für glänzende Oberflächen.'],
    ['Manganknollen', '#5a4a3f', 'Runde Knollen, über Äonen gewachsen.'],
    ['Pyrit', '#d8c04a', 'Narrengold, das trotzdem gut bezahlt wird.'],
    ['Malachit', '#2fa36b', 'Gebänderter grüner Stein mit Kupferseele.'],
    ['Azuritkruste', '#2f5fd0', 'Tiefblaue Kruste auf kupferhaltigem Fels.'],
    ['Borax', '#e8f0f4', 'Weiße Kristalle für Glas und Hitzeschilde.'],
    ['Perchloratsalz', '#f2d6a0', 'Reaktives Salz, Raketentreibstoff in Rohform.'],
    ['Ilmenit', '#4f4a52', 'Schwarzes Titaneisenerz aus alten Lavaströmen.'],
    ['Kobalterz', '#3d63b8', 'Blaustichiges Erz für Akkus und Farben.'],
    ['Wolframit', '#565048', 'Extrem dichtes Erz für hitzefeste Bauteile.'],
    ['Siderit', '#a88a5a', 'Bräunliches Eisenkarbonat mit sanftem Glanz.'],
    ['Fluorit', '#9d7fe0', 'Würfelkristalle, die in allen Farben fluoreszieren.']
  ],
  [ // Selten
    ['Silberader', '#d6dde6', 'Helle Adern, die im Scannerlicht aufblitzen.'],
    ['Golderz', '#f2c84b', 'Das älteste Versprechen von Reichtum, auch hier draußen.'],
    ['Platinkörner', '#c9cfd8', 'Schwere Körner für Katalysatoren.'],
    ['Titanschwamm', '#9aa6b2', 'Poröses Titan, leicht und unglaublich zäh.'],
    ['Rubinsplitter', '#e0284f', 'Rote Funken in hartem Korund.'],
    ['Saphirgeode', '#2f6bff', 'Hohle Steinkugel voller blauer Kristalle.'],
    ['Smaragdkristall', '#22c76a', 'Grünes Leuchten aus der Tiefe.'],
    ['Amethystdruse', '#a157e8', 'Violette Kristallhöhle im Taschenformat.'],
    ['Topas', '#f2a65a', 'Goldgelber Kristall von großer Klarheit.'],
    ['Mondopal', '#cfe7f2', 'Milchiger Stein mit wanderndem Farbspiel.'],
    ['Iridiumstaub', '#b9c2d6', 'Feinster Staub aus einem uralten Einschlag.'],
    ['Palladiumerz', '#a7b4c0', 'Seltenes Erz, das Wasserstoff wie ein Schwamm aufsaugt.'],
    ['Lithiumkristall', '#f0b8d8', 'Rosafarbener Kristall, Herz jeder Batterie.'],
    ['Berylliumgeode', '#7fd6c2', 'Leichte Geode für Weltraumoptiken.'],
    ['Rhodiumflitter', '#e2e6ee', 'Spiegelnde Flitter, teurer als Gold.'],
    ['Turmalinnadel', '#2fa39a', 'Zweifarbige Nadel, die sich elektrisch auflädt.']
  ],
  [ // Episch
    ['Meteoreisen', '#6d6a72', 'Eisen von einem Stern, der vor Ewigkeiten zerbrach.'],
    ['Plasmaquarz', '#ff6ad5', 'Quarz, in dem eingeschlossenes Plasma flackert.'],
    ['Uraninit', '#c6ff3a', 'Schwach leuchtendes Erz. Nicht in die Tasche stecken.'],
    ['Thoriumglas', '#7ef0c0', 'Glasige Masse mit warmem inneren Glühen.'],
    ['Kryonit', '#9fe8ff', 'Ein Kristall, der auch in der Sonne nicht taut.'],
    ['Fulguritkern', '#ffe36a', 'Versteinerter Blitz, noch immer elektrisch geladen.'],
    ['Tektitglas', '#3a7d4f', 'Grünes Glas, beim Einschlag aus Fels geschmolzen.'],
    ['Pallasit', '#c8a23a', 'Meteorit aus Metall mit eingeschlossenen Olivinen.'],
    ['Ionenkristall', '#6ab8ff', 'Kristallgitter voller freier Ladung.'],
    ['Neutronit-Spat', '#8a7dff', 'Unvorstellbar dicht, ein Splitter wiegt wie ein Fels.'],
    ['Helium-3-Eis', '#e9f6ff', 'Gefrorener Fusionsbrennstoff aus dem Sonnenwind.'],
    ['Supraleitererz', '#4ff0ff', 'Leitet Strom ohne Verlust, solange es kalt bleibt.']
  ],
  [ // Legendär
    ['Xenostahl', '#ff9b3d', 'Eine Legierung, die keine menschliche Schmiede kennt.'],
    ['Sternenmetall', '#ffd56a', 'Glänzt, als hätte es Licht gespeichert.'],
    ['Aurorakristall', '#7dffb0', 'Im Inneren tanzen Polarlichter.'],
    ['Quantenglas', '#b6f0ff', 'Durchsichtig nur, wenn niemand hinsieht.'],
    ['Phasenmithril', '#e0e8ff', 'Wechselt zwischen fest und flüssig im Herzschlagtakt.'],
    ['Nebelperle', '#ffc0e8', 'In Gasnebeln gewachsen, weich wie Rauch.'],
    ['Gravitonsplitter', '#ff7a3d', 'Zieht kleine Steine sanft zu sich heran.'],
    ['Chronoquarz', '#ffe9a8', 'Uhren in seiner Nähe gehen merklich langsamer.']
  ],
  [ // Mythisch
    ['Drachenglas der Ahnen', '#ff2f5a', 'Laut Legende das erstarrte Feuer eines Weltenwurms.'],
    ['Leviathan-Bernstein', '#ff8a2f', 'Harz eines Wesens, das einst ganze Ozeane bewohnte.'],
    ['Seelenkristall von Tharsis', '#ff4fd8', 'Die Siedler schwören, er summe leise Lieder.'],
    ['Phönixasche', '#ff5a3a', 'Asche, die nachts wieder zu glühen beginnt.'],
    ['Titanenblut', '#c2185b', 'Dunkelrote Flüssigkeit, die niemals gefriert.']
  ],
  [ // Exotisch
    ['Antimaterie-Splitter', '#2ef2e0', 'Gehalten von Feldern, die man besser nicht abschaltet.'],
    ['Dunkle-Materie-Kern', '#3fd0ff', 'Unsichtbar, außer im richtigen Scannerlicht.'],
    ['Singularitätsstaub', '#7fffe8', 'Krümel eines winzigen schwarzen Lochs.']
  ],
  [ // Exquisit
    ['Sternenherz', '#ffffff', 'Der Kern eines sterbenden Sterns, warm wie ein Versprechen.'],
    ['Ewigkeitsprisma', '#ffffff', 'Bricht nicht nur Licht, sondern auch die Zeit.']
  ]
];

DATA.RESOURCES = [];
(function buildResources() {
  let idx = 0;
  DATA.RESOURCE_DEFS.forEach((list, tier) => {
    list.forEach((def, j) => {
      const h = RNG.hash(idx * 7919 + 13, tier, 4242);
      const jitter = ((h % 10001) / 10000 * 2 - 1) * CONFIG.valueJitter;
      DATA.RESOURCES.push({
        id: idx,
        key: 'r' + idx,
        name: def[0],
        color: def[1],
        desc: def[2],
        tier,
        shape: DATA.SHAPES[(j * 5 + tier * 3) % DATA.SHAPES.length],
        value: Math.pow(CONFIG.tierValueBase, tier) * (1 + jitter)
      });
      idx++;
    });
  });
  DATA.BY_TIER = DATA.TIERS.map((_, t) => DATA.RESOURCES.filter(r => r.tier === t).map(r => r.id));
})();
DATA.resName = (res, ref) => (ref > 0 ? DATA.REFINE_NAMES[ref] + 'es ' : '') + DATA.RESOURCES[res].name;
DATA.itemName = (res, ref) => {
  const n = DATA.RESOURCES[res].name;
  return ref === 0 ? n : (ref === 1 ? 'Veredeltes ' : ref === 2 ? 'Hochveredeltes ' : 'Perfektes ') + n;
};

// ---------------------------------------------------------------------
// Buildings. ports: 'belt' handled in logistics; inputs/outputs defined by type logic.
// cat: mine | transport | process | sell | boost | deco
// ---------------------------------------------------------------------
DATA.BUILDINGS = {
  extractor: { name: 'Extraktor', cat: 'mine', w: 2, h: 2, cost: 0, color: '#ff8a2f',
    desc: 'Baut den Rohstoff eines angrenzenden Vorkommens ab. Muss direkt am Vorkommen stehen.' },
  belt: { name: 'Förderband', cat: 'transport', w: 1, h: 1, cost: 2, color: '#59636e', line: true,
    desc: 'Transportiert Items in Pfeilrichtung. Ziehen zum Zeichnen langer Strecken.' },
  splitter: { name: 'Splitter', cat: 'transport', w: 1, h: 1, cost: 40, color: '#4d8fd6',
    desc: 'Verteilt Items abwechselnd nach vorne, links und rechts.' },
  merger: { name: 'Merger', cat: 'transport', w: 1, h: 1, cost: 40, color: '#4d8fd6',
    desc: 'Führt bis zu drei Bänder fair zusammen und gibt nach vorne aus.' },
  crossing: { name: 'Kreuzung', cat: 'transport', w: 1, h: 1, cost: 60, color: '#4d8fd6',
    desc: 'Lässt zwei Bänder sich kreuzen, ohne dass Items gemischt werden.' },
  bridge: { name: 'Brücke', cat: 'transport', w: 1, h: 1, cost: 200, color: '#6b7ed6', research: 'bridges',
    desc: 'Überspringt bis zu 4 Felder. Start setzen, dann Ziel in einer Linie wählen.' },
  fsplitter: { name: 'Filter-Splitter', cat: 'transport', w: 1, h: 1, cost: 150, color: '#3fb2c9', research: 'filters',
    desc: 'Passende Items (Rohstoff oder Stufe) gehen geradeaus, alle anderen zur Seite.' },
  osplitter: { name: 'Überlauf-Splitter', cat: 'transport', w: 1, h: 1, cost: 120, color: '#3fb2c9', research: 'overflow',
    desc: 'Gibt bevorzugt nach vorne aus, nur bei Stau zur Seite.' },
  silo: { name: 'Lager (Silo)', cat: 'process', w: 3, h: 3, cost: 250, color: '#6d8aa8',
    desc: 'Speichert Items. Nimmt an allen Seiten an, gibt vorne (Pfeil) aus. Neben Verkauf: Verladerampe +20 %.' },
  refinery1: { name: 'Raffinerie I', cat: 'process', w: 3, h: 3, cost: 400, color: '#1fb5a3', refine: 1,
    desc: 'Veredelt Rohstoffe 1:1 zu Wert ×2. Eingang an den Seiten, Ausgang vorne.' },
  refinery2: { name: 'Raffinerie II', cat: 'process', w: 3, h: 3, cost: 6000, color: '#18a3c4', refine: 2, research: 'ref2',
    desc: 'Veredelt veredelte Items weiter (kumulativ ×4).' },
  refinery3: { name: 'Raffinerie III', cat: 'process', w: 3, h: 3, cost: 90000, color: '#3a7bea', refine: 3, research: 'ref3',
    desc: 'Höchste Veredelungsstufe (kumulativ ×8).' },
  cooler: { name: 'Kühlturm', cat: 'boost', w: 2, h: 2, cost: 800, color: '#7fd3f0', research: 'cooler',
    desc: '+10 % Tempo für angrenzende Raffinerien (max. 2 je Raffinerie).' },
  servo: { name: 'Servo-Hub', cat: 'boost', w: 2, h: 2, cost: 4000, color: '#f0c050', research: 'servo',
    desc: '+15 % Tempo für angrenzende Extraktoren und Raffinerien (max. 1).' },
  charger: { name: 'Ladestation', cat: 'boost', w: 2, h: 2, cost: 15000, color: '#9bf06a', research: 'charger',
    desc: '+25 % Durchsatz für angrenzende Förderbänder (bis zu 3 Felder weit entlang des Bandes).' },
  lab: { name: 'Forschungslabor', cat: 'process', w: 4, h: 4, cost: 1500, color: '#c8d4e8',
    desc: 'Schaltet die Forschung frei. Höhere Stufe forscht schneller.' },
  bazaar: { name: 'Basarstand', cat: 'sell', w: 3, h: 2, cost: 30, color: '#e8b33a', tier: 0,
    desc: 'Vorbeilaufende Alien-Wanderer kaufen hier ein. Alien-Wege in der Nähe locken mehr Kunden an.' },
  caravan: { name: 'Karawanenhof', cat: 'sell', w: 4, h: 4, cost: 5000, color: '#e89a3a', tier: 1,
    desc: 'Händler-Karawanen kaufen größere Mengen (Erlös ×1,5).' },
  shuttlepad: { name: 'Shuttle-Landepad', cat: 'sell', w: 5, h: 5, cost: 50000, color: '#e0609a', tier: 2,
    desc: 'Shuttles landen und kaufen in großen Mengen (Erlös ×2,5).' },
  port: { name: 'Orbitalhafen', cat: 'sell', w: 7, h: 7, cost: 250000, color: '#d84fc0', tier: 3,
    desc: 'Kleine Handelsschiffe docken an (Erlös ×4).' },
  dock: { name: 'Frachterdock', cat: 'sell', w: 9, h: 9, cost: 2500000, color: '#b44fe0', tier: 4,
    desc: 'Große Frachter kaufen riesige Mengen (Erlös ×8).' },
  terminal: { name: 'Planeten-Handelsterminal', cat: 'sell', w: 7, h: 7, cost: 25000000, color: '#ff5fa8', tier: 5,
    desc: 'Planeten-Verträge mit Erlös ×20. Stabile Preise.' },
  path: { name: 'Alien-Weg', cat: 'deco', w: 1, h: 1, cost: 1, color: '#b9a27a', line: true, walkable: true,
    desc: 'Gepflasterter Weg. Lockt Alien-Wanderer zum Basar (+3 % Kunden je Feld in der Nähe).' },
  lamp: { name: 'Straßenlicht', cat: 'deco', w: 1, h: 1, cost: 8, color: '#ffe28a', desc: 'Leuchtet nachts. Rein kosmetisch.' },
  flag: { name: 'Flagge', cat: 'deco', w: 1, h: 1, cost: 12, color: '#ff5a5a', desc: 'Markiert deinen Außenposten. Rein kosmetisch.' },
  plant: { name: 'Gewächskuppel', cat: 'deco', w: 1, h: 1, cost: 25, color: '#6ad38a', desc: 'Eine kleine Kuppel mit Pflanzen. Rein kosmetisch.' },
  fence: { name: 'Zaun', cat: 'deco', w: 1, h: 1, cost: 3, color: '#9aa0a8', line: true, desc: 'Ein Zaunelement. Rein kosmetisch.' },
  beacon: { name: 'Leuchtfeuer', cat: 'deco', w: 1, h: 1, cost: 50, color: '#7fe0ff', desc: 'Pulsierendes Leuchtfeuer. Rein kosmetisch.' }
};
DATA.BUILDING_ORDER = ['extractor', 'belt', 'splitter', 'merger', 'crossing', 'bridge', 'fsplitter', 'osplitter',
  'silo', 'refinery1', 'refinery2', 'refinery3', 'lab', 'bazaar', 'caravan', 'shuttlepad', 'port', 'dock', 'terminal',
  'cooler', 'servo', 'charger', 'path', 'lamp', 'flag', 'plant', 'fence', 'beacon'];
DATA.TYPE_INDEX = {}; DATA.BUILDING_ORDER.forEach((t, i) => { DATA.TYPE_INDEX[t] = i; });
DATA.CATEGORIES = [
  { id: 'mine', name: 'Abbau', icon: '⛏' },
  { id: 'transport', name: 'Transport', icon: '➜' },
  { id: 'process', name: 'Lager & Verarbeitung', icon: '⚗' },
  { id: 'sell', name: 'Verkauf', icon: '¤' },
  { id: 'boost', name: 'Boosts', icon: '⚡' },
  { id: 'deco', name: 'Deko', icon: '✿' }
];
DATA.BELT_GRADES = [
  { name: 'Förderband', cost: 2, research: null },
  { name: 'Verbessertes Band', cost: 6, research: 'belt2' },
  { name: 'Hochleistungsband', cost: 18, research: 'belt3' },
  { name: 'Plasmaband', cost: 50, research: 'belt4' }
];
DATA.SELLER_TYPES = ['bazaar', 'caravan', 'shuttlepad', 'port', 'dock', 'terminal'];

DATA.CUSTOMERS = [
  { name: 'Alien-Wanderer', plural: 'Alien-Wanderer', building: 'bazaar' },
  { name: 'Händler-Karawane', plural: 'Händler-Karawanen', building: 'caravan' },
  { name: 'Shuttle', plural: 'Shuttles', building: 'shuttlepad' },
  { name: 'Kleines Handelsschiff', plural: 'Handelsschiffe', building: 'port' },
  { name: 'Großer Frachter', plural: 'Frachter', building: 'dock' },
  { name: 'Planeten-Vertrag', plural: 'Planeten-Verträge', building: 'terminal' }
];
DATA.CONTRACT_PLANETS = ['Nebulon', 'Kepler-Gamma', 'Vesta Nova', 'Orionis', 'Tau Ceti IV', 'Proxima Hafen', 'Aldebaran-Kolonie', 'Rigel Minor', 'Helios', 'Draconis'];

// ---------------------------------------------------------------------
// Planets: palettes [ground dark, ground mid, ground light, accent, deco, sky tint]
// ---------------------------------------------------------------------
DATA.PLANETS = [
  { name: 'Ares Prime', desc: 'Rostroter Staub und orange Dünen.', ground: ['#7a2f1c', '#a8482a', '#c86a3e'], accent: '#e8935a', rock: '#5b2618', deco: '#f0b080', sky: [255, 140, 80], particle: '#e8a070', special: null },
  { name: 'Cuprum', desc: 'Kupferne Hügel und türkise Patina-Seen.', ground: ['#5a3a22', '#8a5a34', '#b87a46'], accent: '#3fc7b0', rock: '#4a2c18', deco: '#58d8c0', sky: [255, 190, 120], particle: '#ffd0a0', special: 'refine' },
  { name: 'Glacia', desc: 'Blau-weißes Eis und Raureif.', ground: ['#5c7ea0', '#8fb4d0', '#d4e8f4'], accent: '#ffffff', rock: '#4a6888', deco: '#e8f6ff', sky: [160, 200, 255], particle: '#ffffff', special: 'events' },
  { name: 'Ignis', desc: 'Schwarze Vulkanebenen mit Lavaadern.', ground: ['#16120f', '#2a221c', '#3a2e26'], accent: '#ff6a1f', rock: '#0e0b09', deco: '#ff8a3a', sky: [255, 90, 40], particle: '#ffb050', special: 'extract' },
  { name: 'Viridia', desc: 'Violett-grüner Alien-Dschungel.', ground: ['#2a1f3a', '#3a5a3a', '#5a8a4a'], accent: '#c07aff', rock: '#1e1830', deco: '#8aff9a', sky: [170, 120, 255], particle: '#b0ff9a', special: 'storage' },
  { name: 'Nebulon', desc: 'Neon-Plattformen über einem Gasriesen.', ground: ['#1a1030', '#2a1a4a', '#3a2a66'], accent: '#ff4fd8', rock: '#120a24', deco: '#3ff0ff', sky: [255, 80, 220], particle: '#3ff0ff', special: 'customers' },
  { name: 'Crystallis', desc: 'Kristallwüste mit prismatischem Funkeln.', ground: ['#b8a8c8', '#d8cce4', '#f0e8f8'], accent: '#7ff0ff', rock: '#9888b0', deco: '#ffffff', sky: [220, 200, 255], particle: '#ffffff', special: 'rare' },
  { name: 'Singularis', desc: 'Dunkler Weltraum, Sterne und verzerrtes Licht.', ground: ['#07070f', '#0f0f1e', '#1a1a30'], accent: '#8a7dff', rock: '#04040a', deco: '#c8c0ff', sky: [120, 100, 255], particle: '#c8c0ff', special: 'sales' }
];
DATA.PLANET_SPECIALS = {
  refine:    { name: 'Kupferfieber', desc: 'Raffinerien arbeiten 10 % schneller.' },
  events:    { name: 'Eisige Märkte', desc: 'Nachfrage-Events treten 50 % häufiger auf.' },
  extract:   { name: 'Vulkanwärme', desc: 'Extraktoren bauen 10 % schneller ab.' },
  storage:   { name: 'Dichter Dschungel', desc: 'Lager haben 25 % mehr Kapazität.' },
  customers: { name: 'Neon-Basar', desc: 'Kunden kommen 15 % häufiger.' },
  rare:      { name: 'Kristallfelder', desc: 'Seltene Vorkommen (ab Legendär) sind 25 % häufiger.' },
  sales:     { name: 'Ereignishorizont', desc: 'Verkaufserlöse +15 %.' }
};
DATA.PROC_NAMES_A = ['Kor', 'Vel', 'Zan', 'Ty', 'Ori', 'Xa', 'Mel', 'Dra', 'Su', 'Ny', 'Ka', 'Le', 'Pyr', 'Ul', 'Ae'];
DATA.PROC_NAMES_B = ['thos', 'nara', 'vex', 'lune', 'mira', 'dor', 'quis', 'thal', 'reon', 'sia', 'gar', 'phos', 'bel', 'mon', 'ris'];
// Returns planet descriptor for index k (1-based).
DATA.planet = function (k) {
  if (k <= DATA.PLANETS.length) return Object.assign({ index: k }, DATA.PLANETS[k - 1]);
  const rnd = RNG.mulberry32(RNG.hash(k, 777, 4091));
  const hue = Math.floor(rnd() * 360), sat = 25 + rnd() * 45, light = 18 + rnd() * 30;
  const hsl = (h, s, l) => {
    s /= 100; l /= 100;
    const f = n => { const kk = (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const c = l - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1)); return Math.round(255 * c).toString(16).padStart(2, '0'); };
    return '#' + f(0) + f(8) + f(4);
  };
  const accentHue = (hue + 120 + rnd() * 120) % 360;
  const specials = Object.keys(DATA.PLANET_SPECIALS);
  return {
    index: k,
    name: U.pick(DATA.PROC_NAMES_A, rnd) + U.pick(DATA.PROC_NAMES_B, rnd) + ' ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][k % 7],
    desc: 'Ein unerforschter Planet am Rand der Karten.',
    ground: [hsl(hue, sat, light * 0.7), hsl(hue, sat, light), hsl(hue, sat * 0.9, Math.min(80, light * 1.4))],
    accent: hsl(accentHue, 80, 60), rock: hsl(hue, sat, light * 0.5), deco: hsl(accentHue, 70, 75),
    sky: [Math.floor(120 + rnd() * 135), Math.floor(120 + rnd() * 135), Math.floor(120 + rnd() * 135)],
    particle: hsl(accentHue, 60, 80), special: specials[Math.floor(rnd() * specials.length)]
  };
};

// ---------------------------------------------------------------------
// Research tree (~40 nodes). effect keys are read by Progression.mods.
// ---------------------------------------------------------------------
DATA.RESEARCH = [
  // Logistik
  { id: 'belt2', cat: 'Logistik', name: 'Verbesserte Bänder', cost: 800, time: 30, req: [], desc: 'Schaltet Förderbänder mit 5 Items/s frei.', x: 0, y: 0 },
  { id: 'belt3', cat: 'Logistik', name: 'Hochleistungsbänder', cost: 15000, time: 90, req: ['belt2'], desc: 'Schaltet Förderbänder mit 12 Items/s frei.', x: 1, y: 0 },
  { id: 'belt4', cat: 'Logistik', name: 'Plasmabänder', cost: 250000, time: 240, req: ['belt3'], desc: 'Schaltet Förderbänder mit 30 Items/s frei.', x: 2, y: 0 },
  { id: 'bridges', cat: 'Logistik', name: 'Brückenbau', cost: 1200, time: 30, req: [], desc: 'Brücken überspringen bis zu 4 Felder.', x: 0, y: 1 },
  { id: 'filters', cat: 'Logistik', name: 'Filter-Splitter', cost: 3000, time: 45, req: ['bridges'], desc: 'Sortiert Items nach Rohstoff oder Stufe.', x: 1, y: 1 },
  { id: 'overflow', cat: 'Logistik', name: 'Überlauf-Splitter', cost: 6000, time: 60, req: ['filters'], desc: 'Leitet nur bei Stau zur Seite.', x: 2, y: 1 },
  { id: 'massSelect', cat: 'Logistik', name: 'Massen-Auswahl', cost: 2000, time: 40, req: [], desc: 'Auswahl-Rechteck zum Abreißen und Verschieben vieler Objekte.', x: 0, y: 2 },
  { id: 'blueprints', cat: 'Logistik', name: 'Blaupausen', cost: 9000, time: 75, req: ['massSelect'], desc: 'Auswahl kopieren und als Blaupause einfügen.', x: 1, y: 2 },
  { id: 'beltSpeed', cat: 'Logistik', name: 'Gleitlager', cost: 40000, time: 120, req: ['belt3'], desc: 'Alle Förderbänder +15 % schneller.', x: 3, y: 0 },
  // Produktion
  { id: 'drill1', cat: 'Produktion', name: 'Bohrkopf-Optimierung I', cost: 600, time: 25, req: [], desc: 'Extraktoren +10 % Abbau.', x: 0, y: 3 },
  { id: 'drill2', cat: 'Produktion', name: 'Bohrkopf-Optimierung II', cost: 12000, time: 80, req: ['drill1'], desc: 'Extraktoren +15 % Abbau.', x: 1, y: 3 },
  { id: 'drill3', cat: 'Produktion', name: 'Bohrkopf-Optimierung III', cost: 180000, time: 200, req: ['drill2'], desc: 'Extraktoren +20 % Abbau.', x: 2, y: 3 },
  { id: 'ref2', cat: 'Produktion', name: 'Raffinerie II', cost: 8000, time: 60, req: [], desc: 'Zweite Veredelungsstufe (×4).', x: 0, y: 4 },
  { id: 'ref3', cat: 'Produktion', name: 'Raffinerie III', cost: 120000, time: 160, req: ['ref2'], desc: 'Dritte Veredelungsstufe (×8).', x: 1, y: 4 },
  { id: 'refSpeed', cat: 'Produktion', name: 'Katalysatoren', cost: 20000, time: 90, req: ['ref2'], desc: 'Raffinerien +15 % Tempo.', x: 2, y: 4 },
  { id: 'cooler', cat: 'Produktion', name: 'Kühltürme', cost: 2500, time: 40, req: [], desc: 'Kühltürme beschleunigen benachbarte Raffinerien.', x: 0, y: 5 },
  { id: 'servo', cat: 'Produktion', name: 'Servo-Hubs', cost: 8000, time: 60, req: ['cooler'], desc: 'Servo-Hubs beschleunigen Extraktoren und Raffinerien.', x: 1, y: 5 },
  { id: 'charger', cat: 'Produktion', name: 'Ladestationen', cost: 30000, time: 100, req: ['servo', 'belt2'], desc: 'Ladestationen erhöhen den Banddurchsatz.', x: 2, y: 5 },
  { id: 'silo2', cat: 'Produktion', name: 'Lager-Erweiterung', cost: 4000, time: 45, req: [], desc: 'Lager +50 % Kapazität.', x: 3, y: 3 },
  { id: 'silo3', cat: 'Produktion', name: 'Verdichtungslager', cost: 90000, time: 150, req: ['silo2'], desc: 'Lager weitere +100 % Kapazität.', x: 3, y: 4 },
  // Handel
  { id: 'shelf1', cat: 'Handel', name: 'Größere Regale', cost: 1000, time: 30, req: [], desc: 'Regale aller Verkaufsgebäude +50 %.', x: 0, y: 6 },
  { id: 'patience', cat: 'Handel', name: 'Geduldige Kunden', cost: 2500, time: 40, req: ['shelf1'], desc: 'Kunden warten 30 % länger.', x: 1, y: 6 },
  { id: 'traffic1', cat: 'Handel', name: 'Händlernetz', cost: 6000, time: 60, req: [], desc: 'Kunden kommen 15 % häufiger.', x: 0, y: 7 },
  { id: 'traffic2', cat: 'Handel', name: 'Interstellare Werbung', cost: 90000, time: 140, req: ['traffic1'], desc: 'Kunden kommen weitere 20 % häufiger.', x: 1, y: 7 },
  { id: 'haggle1', cat: 'Handel', name: 'Verhandlungsgeschick I', cost: 1500, time: 35, req: [], desc: 'Verkaufserlös +8 %.', x: 0, y: 8 },
  { id: 'haggle2', cat: 'Handel', name: 'Verhandlungsgeschick II', cost: 40000, time: 90, req: ['haggle1'], desc: 'Verkaufserlös +12 %.', x: 1, y: 8 },
  { id: 'haggle3', cat: 'Handel', name: 'Verhandlungsgeschick III', cost: 300000, time: 220, req: ['haggle2'], desc: 'Verkaufserlös +18 %.', x: 2, y: 8 },
  { id: 'service', cat: 'Handel', name: 'Express-Abfertigung', cost: 15000, time: 70, req: ['patience'], desc: 'Verkaufsgebäude fertigen 40 % schneller ab.', x: 2, y: 6 },
  { id: 'contracts', cat: 'Handel', name: 'Vertragsbüro', cost: 400000, time: 240, req: ['haggle2'], desc: 'Ein zusätzlicher aktiver Planeten-Vertrag.', x: 3, y: 8 },
  { id: 'marketing', cat: 'Handel', name: 'Marktbeobachtung', cost: 8000, time: 50, req: ['traffic1'], desc: 'Positive Nachfrage-Events dauern 25 % länger.', x: 2, y: 7 },
  // Exploration
  { id: 'scan1', cat: 'Exploration', name: 'Scanner-Reichweite I', cost: 500, time: 20, req: [], desc: 'Scanradius +30 %.', x: 0, y: 9 },
  { id: 'scan2', cat: 'Exploration', name: 'Scanner-Reichweite II', cost: 10000, time: 70, req: ['scan1'], desc: 'Scanradius weitere +40 %.', x: 1, y: 9 },
  { id: 'scanCd', cat: 'Exploration', name: 'Scanner-Takt', cost: 3000, time: 40, req: ['scan1'], desc: 'Scanner-Abklingzeit −40 %.', x: 1, y: 10 },
  { id: 'probe', cat: 'Exploration', name: 'Langstrecken-Sonde', cost: 35000, time: 120, req: ['scan2'], desc: 'Ortet alle 5 Minuten das nächste epische oder bessere Vorkommen.', x: 2, y: 9 },
  { id: 'jet1', cat: 'Exploration', name: 'Jetpack I', cost: 700, time: 25, req: [], desc: 'Laufgeschwindigkeit +50 %.', x: 0, y: 11 },
  { id: 'jet2', cat: 'Exploration', name: 'Jetpack II', cost: 9000, time: 60, req: ['jet1'], desc: 'Laufgeschwindigkeit weitere +50 %.', x: 1, y: 11 },
  { id: 'rover', cat: 'Exploration', name: 'Rover', cost: 80000, time: 150, req: ['jet2'], desc: 'Geschwindigkeit weitere +150 % (bis ca. 14 Felder/s).', x: 2, y: 11 },
  { id: 'radius1', cat: 'Exploration', name: 'Bauradius I', cost: 900, time: 25, req: [], desc: 'Bauradius +6 Felder.', x: 0, y: 12 },
  { id: 'radius2', cat: 'Exploration', name: 'Bauradius II', cost: 14000, time: 70, req: ['radius1'], desc: 'Bauradius weitere +8 Felder.', x: 1, y: 12 },
  { id: 'radius3', cat: 'Exploration', name: 'Bauradius III', cost: 150000, time: 180, req: ['radius2'], desc: 'Bauradius weitere +8 Felder.', x: 2, y: 12 },
  // Komfort
  { id: 'undo2', cat: 'Komfort', name: 'Erweiterter Verlauf', cost: 1500, time: 30, req: [], desc: 'Rückgängig-Verlauf auf 60 Schritte erweitert.', x: 0, y: 13 },
  { id: 'autocollect', cat: 'Komfort', name: 'Auto-Sammeln', cost: 6000, time: 50, req: [], desc: 'Trinkgeld-Münzen werden automatisch eingesammelt.', x: 1, y: 13 },
  { id: 'alerts', cat: 'Komfort', name: 'Frühwarnsystem', cost: 2500, time: 35, req: [], desc: 'Warnt, wenn Lager zu 90 % gefüllt sind, und zeigt Störungen auf der Karte.', x: 2, y: 13 },
  { id: 'fasttravel', cat: 'Komfort', name: 'Teleport-Netz', cost: 20000, time: 90, req: ['alerts'], desc: 'Schnellreise zu jedem eigenen Gebäude über das Info-Panel.', x: 3, y: 13 },
  { id: 'compass', cat: 'Komfort', name: 'Rohstoff-Kompass', cost: 12000, time: 60, req: ['scan1'], desc: 'Zeigt die Richtung zum wertvollsten bekannten, freien Vorkommen.', x: 3, y: 9 }
];
DATA.RESEARCH_BY_ID = {}; DATA.RESEARCH.forEach(r => { DATA.RESEARCH_BY_ID[r.id] = r; });

// ---------------------------------------------------------------------
// Rebirth shop
// ---------------------------------------------------------------------
DATA.REBIRTH_UPGRADES = [
  { id: 'capital', name: 'Startkapital', desc: '+400 ET Startkapital je Stufe (wächst stark).', max: 10, cost: [1, 1.6] },
  { id: 'radius', name: 'Bauradius', desc: '+3 Felder Bauradius je Stufe.', max: 6, cost: [1, 1.5] },
  { id: 'speed', name: 'Laufgeschwindigkeit', desc: '+12 % Laufgeschwindigkeit je Stufe.', max: 6, cost: [1, 1.5] },
  { id: 'scanner', name: 'Scanner', desc: '+20 % Scanradius und −10 % Abklingzeit je Stufe.', max: 5, cost: [1, 1.6] },
  { id: 'storage', name: 'Lagerkapazität', desc: '+25 % Lager- und Regalkapazität je Stufe.', max: 8, cost: [1, 1.5] },
  { id: 'belts', name: 'Förderband-Tempo', desc: '+10 % Bandgeschwindigkeit je Stufe.', max: 6, cost: [2, 1.6] },
  { id: 'startTier', name: 'Start-Kundenstufe', desc: 'Beginne bereits mit freigeschalteter Kundenstufe 2 bzw. 3.', max: 2, cost: [3, 3] },
  { id: 'luck', name: 'Glückstreffer', desc: 'Bessere Glücksstarts und +10 % seltene Vorkommen je Stufe.', max: 5, cost: [2, 1.7] },
  { id: 'extCap', name: 'Extraktor-Obergrenze', desc: 'Maximale Extraktor-Stufe +1 je Stufe (V → X).', max: 5, cost: [1, 1.8] },
  { id: 'sales', name: 'Verkaufserlös', desc: '+10 % auf alle Verkaufserlöse je Stufe.', max: 20, cost: [1, 1.35] },
  { id: 'events', name: 'Event-Dauer', desc: '+15 % Dauer positiver Nachfrage-Events je Stufe.', max: 5, cost: [1, 1.5] },
  { id: 'research', name: 'Forschung', desc: '−10 % Forschungskosten und +20 % Forschungstempo je Stufe.', max: 5, cost: [1, 1.6] },
  { id: 'kit', name: 'Startausrüstung', desc: 'Gratis-Bausatz zum Start: Extraktor, Basar, Bänder, später Lager, Raffinerie und Labor.', max: 3, cost: [1, 2] },
  { id: 'offlineBoost', name: 'Autopilot', desc: '+10 % Offline-Erträge je Stufe.', max: 5, cost: [1, 1.5] }
];
DATA.REBIRTH_BY_ID = {}; DATA.REBIRTH_UPGRADES.forEach(r => { DATA.REBIRTH_BY_ID[r.id] = r; });
DATA.rebirthUpgradeCost = (def, level) => Math.ceil(def.cost[0] * Math.pow(def.cost[1], level));

// ---------------------------------------------------------------------
// Achievements (bonus = permanent sales bonus)
// ---------------------------------------------------------------------
DATA.ACHIEVEMENTS = [
  { id: 'firstSale', name: 'Erster Handel', desc: 'Verkaufe dein erstes Item.', bonus: 0.01 },
  { id: 'firstExtractor', name: 'Bohrbeginn', desc: 'Baue deinen ersten Extraktor.', bonus: 0.01 },
  { id: 'tier0', name: 'Steinsammler', desc: 'Baue einen gewöhnlichen Rohstoff ab.', bonus: 0.005 },
  { id: 'tier1', name: 'Erzsucher', desc: 'Baue einen ungewöhnlichen Rohstoff ab.', bonus: 0.01 },
  { id: 'tier2', name: 'Kristallklar', desc: 'Baue einen seltenen Rohstoff ab.', bonus: 0.01 },
  { id: 'tier3', name: 'Episch!', desc: 'Baue einen epischen Rohstoff ab.', bonus: 0.01 },
  { id: 'tier4', name: 'Legende', desc: 'Baue einen legendären Rohstoff ab.', bonus: 0.015 },
  { id: 'tier5', name: 'Mythenjäger', desc: 'Baue einen mythischen Rohstoff ab.', bonus: 0.02 },
  { id: 'tier6', name: 'Exot', desc: 'Baue einen exotischen Rohstoff ab.', bonus: 0.02 },
  { id: 'tier7', name: 'Sternenherz', desc: 'Baue einen exquisiten Rohstoff ab.', bonus: 0.03 },
  { id: 'cust2', name: 'Karawanen-Ruf', desc: 'Schalte Kundenstufe 2 frei.', bonus: 0.01 },
  { id: 'cust3', name: 'Landeerlaubnis', desc: 'Schalte Kundenstufe 3 frei.', bonus: 0.01 },
  { id: 'cust4', name: 'Orbitaler Handel', desc: 'Schalte Kundenstufe 4 frei.', bonus: 0.01 },
  { id: 'cust5', name: 'Frachtkönig', desc: 'Schalte Kundenstufe 5 frei.', bonus: 0.015 },
  { id: 'cust6', name: 'Interplanetar', desc: 'Schalte Kundenstufe 6 frei.', bonus: 0.02 },
  { id: 'earn1k', name: 'Taschengeld', desc: 'Verdiene insgesamt 1.000 ET.', bonus: 0.005 },
  { id: 'earn100k', name: 'Unternehmer', desc: 'Verdiene insgesamt 100 Tsd ET.', bonus: 0.01 },
  { id: 'earn10m', name: 'Magnat', desc: 'Verdiene insgesamt 10 Mio ET.', bonus: 0.015 },
  { id: 'earn1b', name: 'Planetarer Tycoon', desc: 'Verdiene insgesamt 1 Mrd ET.', bonus: 0.02 },
  { id: 'earn1t', name: 'Galaktischer Tycoon', desc: 'Verdiene insgesamt 1 Bio ET.', bonus: 0.03 },
  { id: 'rebirth1', name: 'Neubeginn', desc: 'Führe dein erstes Rebirth durch.', bonus: 0.02 },
  { id: 'rebirth5', name: 'Planetenspringer', desc: 'Führe 5 Rebirths durch.', bonus: 0.03 },
  { id: 'rebirth10', name: 'Wanderer zwischen Welten', desc: 'Führe 10 Rebirths durch.', bonus: 0.04 },
  { id: 'codexFull', name: 'Vollständiger Kodex', desc: 'Entdecke alle 91 Rohstoffe.', bonus: 0.1 },
  { id: 'codex45', name: 'Halbzeit', desc: 'Entdecke 45 Rohstoffe.', bonus: 0.02 },
  { id: 'belts1000', name: 'Bandwurm', desc: 'Besitze 1.000 Förderband-Felder gleichzeitig.', bonus: 0.02 },
  { id: 'belts100', name: 'Logistiker', desc: 'Besitze 100 Förderband-Felder gleichzeitig.', bonus: 0.005 },
  { id: 'refine1', name: 'Veredler', desc: 'Veredle dein erstes Item.', bonus: 0.01 },
  { id: 'refine3', name: 'Perfektionist', desc: 'Stelle ein perfektioniertes Item her (Stufe III).', bonus: 0.02 },
  { id: 'research10', name: 'Wissbegierig', desc: 'Schließe 10 Forschungen ab.', bonus: 0.01 },
  { id: 'researchAll', name: 'Universalgelehrter', desc: 'Schließe alle Forschungen in einem Durchlauf ab.', bonus: 0.03 },
  { id: 'event', name: 'Marktgespür', desc: 'Verkaufe während eines positiven Nachfrage-Events.', bonus: 0.005 },
  { id: 'contract', name: 'Vertragspartner', desc: 'Erfülle einen Planeten-Vertrag.', bonus: 0.02 },
  { id: 'jackpot', name: 'Glückspilz', desc: 'Erlebe einen Jackpot- oder Wunder-Start.', bonus: 0.01 },
  { id: 'explorer', name: 'Kartograf', desc: 'Entferne dich 500 Felder vom Landeplatz.', bonus: 0.01 },
  { id: 'maxLevel', name: 'Volle Leistung', desc: 'Bringe einen Extraktor auf Stufe X.', bonus: 0.02 },
  { id: 'buildings100', name: 'Stadtplaner', desc: 'Besitze 100 Gebäude (ohne Bänder und Deko).', bonus: 0.02 },
  { id: 'satisfied100', name: 'Kundenliebling', desc: 'Stelle 100 Kunden vollständig zufrieden.', bonus: 0.01 },
  { id: 'offline', name: 'Autopilot', desc: 'Kassiere Offline-Einnahmen.', bonus: 0.005 },
  { id: 'planet8', name: 'Singularität', desc: 'Erreiche Planet 8.', bonus: 0.05 }
];
DATA.ACH_BY_ID = {}; DATA.ACHIEVEMENTS.forEach(a => { DATA.ACH_BY_ID[a.id] = a; });
