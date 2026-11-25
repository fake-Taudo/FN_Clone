// =====================================================================
// CONFIG: every balancing value lives here.
// =====================================================================
const GAME_TITLE = 'Ares Outpost';
const CURRENCY_NAME = 'Epstein-Taler';
const CURRENCY_SHORT = 'ET';
const GAME_VERSION = '1.0.0';
const SAVE_VERSION = 3;

const CONFIG = {
  tickRate: 20,                 // simulation ticks per second
  chunkSize: 32,
  fogCell: 8,                   // discovery granularity in tiles (4x4 cells per chunk)
  viewDiscoverRadius: 18,       // tiles around the astronaut that become discovered
  landing: { x: 16, y: 16 },    // landing point (centre of chunk 0/0)

  // ---- world generation ----
  depositsPerChunk: [0.25, 0.40, 0.25, 0.10], // probability of 0/1/2/3 deposits => mean 1.2
  depositMinDist: 9,
  depositStartExclusion: 30,    // normal deposits keep this distance from the landing point
  tierWeights: [40, 25, 15, 10, 5, 3, 1.5, 0.5],
  planetTierShift: 0.12,        // weight_t * (1 + shift*(k-1)*t)
  sizeChance: [                 // [small, medium, large] per tier (rarer => smaller)
    [0.30, 0.40, 0.30], [0.35, 0.40, 0.25], [0.45, 0.38, 0.17], [0.55, 0.33, 0.12],
    [0.65, 0.28, 0.07], [0.75, 0.21, 0.04], [0.85, 0.13, 0.02], [0.92, 0.07, 0.01]
  ],
  sizeTiles: [[1, 3], [4, 7], [8, 12]],
  sizeSlots: [1, 2, 4],
  luckyStart: [0.70, 0.20, 0.08, 0.02], // normal / good / jackpot / wonder
  startRadius: 25,

  // ---- astronaut ----
  walkSpeed: 4.0,               // tiles per second
  sprintFactor: 1.6,
  buildRadius: 14,
  maxBuildRadius: 40,
  scanRadius: 60,
  scanCooldown: 10,
  zoomMin: 10, zoomMax: 96, zoomDefault: 40,

  // ---- economy ----
  startMoney: 100,
  tierValueBase: 3,             // V[t] = 3^t
  valueJitter: 0.08,
  extractRate: [1.0, 0.8, 0.65, 0.5, 0.4, 0.3, 0.2, 0.15],
  extractorBaseCost: 40,        // * 4^t
  extractorCostTierFactor: 4,
  extractorLevelSpeed: 1.35,
  extractorLevelCost: 1.8,
  extractorStartMaxLevel: 5,
  costGrowth: 1.15,
  beltCostGrowth: 1.002,
  refundRate: 0.7,
  moveFeeRate: 0.1,
  buildingLevelCost: 1.9,       // generic upgrade cost growth for non-extractor buildings
  maxBuildingLevel: 10,

  refineFactor: [1, 2, 4, 8],
  refineRate: [0.5, 0.4, 0.3],
  refineBuffer: 6,
  clusterBonus: 0.05, clusterBonusMax: 0.20,
  coolerBonus: 0.10, coolerMax: 2,
  servoBonus: 0.15,
  siloRefineryBonus: 0.15,
  rampBonus: 0.20,
  chargerBonus: 0.25, chargerRange: 3,

  belt: {                       // speed in tiles/s, throughput in items/s
    speed: [1.0, 1.6, 2.4, 4.5],
    throughput: [2, 5, 12, 30]
  },
  siloCapacity: 500,
  siloLevelCapacity: 1.5,       // per building level
  shelfCapacity: [30, 120, 400, 1500, 5000, 20000],
  shelfPrestock: 0.5,           // fraction of the shelf that may be stocked without a customer asking
  serviceRate: [4, 8, 16, 32, 64, 120], // items/s handed from shelf to customers

  // ---- customers ----
  customers: [
    { interval: [8, 14],    factor: 1.0, qty: [3, 8],       unlock: 0 },
    { interval: [30, 50],   factor: 1.5, qty: [12, 30],     unlock: 2000 },
    { interval: [60, 90],   factor: 2.5, qty: [45, 110],    unlock: 25000 },
    { interval: [120, 180], factor: 4.0, qty: [180, 420],   unlock: 120000 },
    { interval: [240, 360], factor: 8.0, qty: [700, 1700],  unlock: 400000 },
    { interval: [480, 720], factor: 20,  qty: [5000, 20000], unlock: 1000000 }
  ],
  patience: [20, 60],
  crowding: [0.15, 0.12, 0.10, 0.08, 0.06], // arrival rate per seller / (1 + c * (sellers of that type - 1))
  satisfiedBonus: 0.10,
  pathBonusPerTile: 0.03, pathBonusMax: 0.6, pathRadius: 9,
  contractSlots: 3, contractDuration: 25 * 60,
  contractRpChance: 0.25,
  tipChance: 0.06, tipValue: 0.15, tipLifetime: 25,

  // ---- demand ----
  demandInterval: 5,
  demandRevert: 0.02, demandNoise: 0.03,
  demandMin: 0.5, demandMax: 2.0,
  saturationPerUnit: 0.004, saturationMin: 0.4, saturationRecover: 0.01,
  eventInterval: [180, 480],
  eventPositive: { mult: [1.8, 2.5], dur: [360, 720] },
  eventNegative: { mult: [0.6, 0.6], dur: [300, 480] },
  eventNegativeChance: 0.25,
  historyInterval: 20, historyLength: 30,

  // ---- research ----
  researchTimeFactor: 1.0,

  // ---- rebirth ----
  rebirthBase: 1e6,
  rebirthGrowth: 20,
  rebirthMultPerPoint: 0.10,
  codexTierBonus: 0.02,

  // ---- offline ----
  offlineMax: 8 * 3600,
  offlineMin: 60,
  offlineStep: 60,
  onlineCatchup: 60,

  // ---- misc ----
  autosaveInterval: 10,
  undoLimit: 30,
  maxItemsPerBuffer: 4
};
