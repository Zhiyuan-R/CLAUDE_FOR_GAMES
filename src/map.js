// 地牢地图：墙体网格、地形（草丛 / 浅水 / 尖刺）、三条兵线、野区房间、Boss 巢穴、防御塔、营地、宝箱、炸药桶
// 所有布局只写蓝方一半，另一半按地图中心点对称生成
import { TILE, GRID_W, GRID_H, mirror } from './config.js';
import { seeded } from './math.js';

const W = GRID_W, H = GRID_H;
const mt = (i, j) => [W - 1 - i, H - 1 - j];

// 地板区域（含端点的瓦片矩形）[i0, j0, i1, j1]
const CARVE = [
  [1, 13, 10, 26], // 基地
  [7, 2, 11, 12], [7, 27, 11, 37], // 基地通往上下路
  [7, 2, 64, 6], // 上路（5 格宽）
  [10, 17, 61, 22], // 中路（6 格宽）
  [13, 8, 22, 15], [15, 7, 18, 7], [23, 10, 24, 13], [14, 16, 15, 16], // 野区 A
  [25, 8, 31, 14], [28, 15, 30, 16], [30, 7, 31, 7], [32, 10, 32, 12], // 野区 B
  [33, 8, 38, 14], [35, 7, 36, 7], [35, 15, 36, 16], // 上方 Boss 巢穴
  [13, 24, 22, 31], [15, 32, 18, 32], [23, 26, 24, 29], [14, 23, 15, 23], // 野区 C
  [25, 25, 31, 31], [28, 23, 30, 24], [28, 32, 29, 32], [32, 27, 32, 29], // 野区 D
  [32, 15, 39, 24], // 中央广场
];
// 房间与中路里的石柱
const PILLARS = [[20, 10], [26, 13], [16, 29], [30, 26], [18, 17], [27, 22], [34, 16]];

// 地形：1 草丛 / 2 浅水 / 3 尖刺
export const BUSH = 1, WATER = 2, SPIKE = 3;
const TERRAIN = [
  [BUSH, 17, 5, 20, 6], [BUSH, 28, 2, 31, 3], [BUSH, 44, 5, 46, 6],
  [BUSH, 15, 17, 16, 17], [BUSH, 23, 22, 25, 22],
  [BUSH, 13, 14, 15, 15], [BUSH, 29, 8, 31, 9], [BUSH, 20, 24, 22, 25], [BUSH, 25, 30, 26, 31],
  [BUSH, 32, 15, 33, 16], [BUSH, 37, 8, 38, 9],
  [WATER, 34, 19, 37, 20], [WATER, 26, 11, 27, 12], [WATER, 17, 11, 18, 12], [WATER, 26, 27, 27, 28],
  [SPIKE, 23, 11, 24, 12], [SPIKE, 23, 27, 24, 28], [SPIKE, 30, 19, 30, 20], [SPIKE, 15, 16, 15, 16],
];

export const LANES = ['top', 'mid', 'bot'];

function buildMap() {
  const grid = new Uint8Array(W * H).fill(1);
  const terrain = new Uint8Array(W * H);
  const set = (arr, i, j, v) => { if (i >= 0 && j >= 0 && i < W && j < H) arr[j * W + i] = v; };
  const both = (arr, i, j, v) => { set(arr, i, j, v); const [mi, mj] = mt(i, j); set(arr, mi, mj, v); };
  for (const [i0, j0, i1, j1] of CARVE) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) both(grid, i, j, 0);
  for (const [i, j] of PILLARS) both(grid, i, j, 1);
  for (const [v, i0, j0, i1, j1] of TERRAIN) {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (grid[j * W + i] === 0) both(terrain, i, j, v);
  }

  // 草丛连通区域编号：同一片草丛里的单位互相可见
  const bushId = new Int16Array(W * H).fill(-1);
  let nb = 0;
  for (let k = 0; k < W * H; k++) {
    if (terrain[k] !== BUSH || bushId[k] >= 0) continue;
    const stack = [k];
    bushId[k] = nb;
    while (stack.length) {
      const c = stack.pop();
      const ci = c % W, cj = (c - ci) / W;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const n = nj * W + ni;
        if (terrain[n] === BUSH && bushId[n] < 0) { bushId[n] = nb; stack.push(n); }
      }
    }
    nb++;
  }

  // 尖刺瓦片：每块有自己的相位，周期性升起
  const spikes = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (terrain[j * W + i] === SPIKE) spikes.push({ i, j, x: (i + 0.5) * TILE, y: (j + 0.5) * TILE, phase: ((i + j) % 2) * 0.6 });

  const blue = {
    top: [[760, 1200], [760, 360], [5000, 360], [5000, 1350], [5400, 1600]],
    mid: [[880, 1600], [4880, 1600], [5400, 1600]],
    bot: [[760, 2000], [760, 2840], [5000, 2840], [5000, 1850], [5400, 1600]],
  };
  const toPts = (arr) => arr.map(([x, y]) => ({ x, y }));
  const mirPath = (arr) => arr.map(([x, y]) => mirror(x, y));
  const lanePaths = [
    { top: toPts(blue.top), mid: toPts(blue.mid), bot: toPts(blue.bot) },
    { top: mirPath(blue.bot), mid: mirPath(blue.mid), bot: mirPath(blue.top) },
  ];

  const towerSpots = [];
  const addTower = (team, lane, tier, x, y) => towerSpots.push({ team, lane, tier, ...(team === 0 ? { x, y } : mirror(x, y)) });
  for (const team of [0, 1]) {
    const L = (l) => (team === 0 ? l : l === 'top' ? 'bot' : l === 'bot' ? 'top' : 'mid');
    addTower(team, L('top'), 'inner', 1300, 360);
    addTower(team, L('top'), 'outer', 2300, 360);
    addTower(team, L('mid'), 'inner', 1350, 1600);
    addTower(team, L('mid'), 'outer', 2350, 1600);
    addTower(team, L('bot'), 'inner', 1300, 2840);
    addTower(team, L('bot'), 'outer', 2300, 2840);
    addTower(team, 'base', 'core', 360, 1600);
  }

  const camps = [];
  const addCamp = (type, x, y) => {
    camps.push({ type, x, y, side: 0 });
    const m = mirror(x, y);
    camps.push({ type, x: m.x, y: m.y, side: 1 });
  };
  addCamp('skeleton', 1440, 960);
  addCamp('golem', 2240, 900);
  addCamp('spider', 1440, 2240);
  addCamp('wolf', 2240, 2300);
  camps.push({ type: 'dragon', x: 2880, y: 900, side: -1 });
  camps.push({ type: 'colossus', x: 2880, y: 2300, side: -1 });

  const chests = [];
  for (const [x, y] of [[1100, 700], [1780, 2500], [3060, 2480]]) { chests.push({ x, y }); chests.push(mirror(x, y)); }
  const barrels = [];
  for (const [x, y] of [[1700, 680], [2000, 1060], [1240, 2460], [2440, 2060], [2700, 1300], [1950, 440]]) { barrels.push({ x, y }); barrels.push(mirror(x, y)); }

  return { grid, terrain, bushId, spikes, lanePaths, towerSpots, camps, chests, barrels };
}

export const MAP = buildMap();

export function solid(i, j) {
  if (i < 0 || j < 0 || i >= W || j >= H) return true;
  return MAP.grid[j * W + i] === 1;
}
export const wallAt = (x, y) => solid(Math.floor(x / TILE), Math.floor(y / TILE));
export function terrainAt(x, y) {
  const i = Math.floor(x / TILE), j = Math.floor(y / TILE);
  if (i < 0 || j < 0 || i >= W || j >= H) return 0;
  return MAP.terrain[j * W + i];
}
export function bushAt(x, y) {
  const i = Math.floor(x / TILE), j = Math.floor(y / TILE);
  if (i < 0 || j < 0 || i >= W || j >= H) return -1;
  return MAP.bushId[j * W + i];
}

// 装饰物件：墙上烛台、草丛叶簇、蘑菇、蕨类、晶石、骸骨
export function buildProps() {
  const rnd = seeded(7);
  const props = [];
  let k = 0;
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W; i++) {
      if (!solid(i, j) || solid(i, j + 1)) continue;
      if ((k++ + (i * 7 + j * 3)) % 6 !== 0) continue;
      props.push({ type: 'sconce', x: (i + 0.5) * TILE, y: (j + 1) * TILE + 2, h: 48, seed: rnd() });
    }
  }
  // 草丛：每块瓦片铺 3 排叶簇，能盖住站在里面的角色
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (MAP.terrain[j * W + i] !== BUSH) continue;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          props.push({ type: 'bush', x: (i + 0.17 + c * 0.33 + (rnd() - 0.5) * 0.12) * TILE, y: (j + 0.22 + r * 0.33) * TILE, s: 0.85 + rnd() * 0.35, seed: rnd(), bush: MAP.bushId[j * W + i] });
        }
      }
    }
  }
  for (let j = 1; j < H - 1; j++) {
    for (let i = 1; i < W - 1; i++) {
      if (solid(i, j) || MAP.terrain[j * W + i]) continue;
      const nearWall = solid(i, j - 1) || solid(i - 1, j) || solid(i + 1, j);
      if (!nearWall) continue;
      const r = rnd();
      const x = (i + 0.2 + rnd() * 0.6) * TILE, y = (j + 0.15 + rnd() * 0.3) * TILE;
      if (r < 0.12) props.push({ type: 'fern', x, y, s: 0.7 + rnd() * 0.6, seed: rnd(), hue: rnd() < 0.5 ? 'purple' : 'green' });
      else if (r < 0.18) props.push({ type: 'shroom', x, y, s: 0.6 + rnd() * 0.5, seed: rnd(), hue: rnd() < 0.5 ? 'teal' : 'pink' });
      else if (r < 0.21) props.push({ type: 'bones', x, y, s: 0.8 + rnd() * 0.4, seed: rnd() });
    }
  }
  for (const c of MAP.camps) {
    if (c.side !== -1) continue;
    for (let n = 0; n < 6; n++) {
      const x = c.x + (rnd() - 0.5) * 420, y = c.y + (rnd() - 0.5) * 420;
      if (!solid(Math.floor(x / TILE), Math.floor(y / TILE))) props.push({ type: 'crystal', x, y, seed: rnd() });
    }
  }
  return props;
}
