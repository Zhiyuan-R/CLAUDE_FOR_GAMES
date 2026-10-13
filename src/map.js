// 地牢地图：墙体网格、三条兵线、野区房间、Boss 巢穴、防御塔与营地位置、装饰物件
// 所有布局只写蓝方一半，另一半按地图中心点对称生成
import { TILE, GRID_W, GRID_H, mirror } from './config.js';
import { seeded } from './math.js';

const W = GRID_W, H = GRID_H;
const mt = (i, j) => [W - 1 - i, H - 1 - j];

// 地板区域（含端点的瓦片矩形）[i0, j0, i1, j1]
const CARVE = [
  [1, 10, 8, 21], // 基地
  [6, 3, 8, 9], [6, 22, 8, 28], // 基地通往上下路
  [6, 3, 53, 5], // 上路
  [8, 14, 51, 17], // 中路
  [11, 7, 17, 11], [13, 6, 14, 6], [18, 9, 19, 10], [11, 12, 11, 13], // 野区 A
  [20, 8, 25, 12], [22, 13, 23, 13], [26, 9, 26, 10], // 野区 B
  [27, 7, 32, 11], [29, 6, 30, 6], [29, 12, 30, 13], // 上方 Boss 巢穴
  [11, 20, 17, 24], [13, 25, 14, 25], [18, 21, 19, 22], [11, 18, 11, 19], // 野区 C
  [20, 19, 25, 23], [22, 18, 23, 18], [26, 21, 26, 22], // 野区 D
  [27, 13, 32, 18], // 中央十字路口
];
// 房间与中路中的石柱
const PILLARS = [[16, 8], [21, 11], [12, 23], [24, 20], [17, 14], [25, 14], [28, 14]];

export const LANES = ['top', 'mid', 'bot'];

function buildMap() {
  const grid = new Uint8Array(W * H).fill(1);
  const set = (i, j, v) => { if (i >= 0 && j >= 0 && i < W && j < H) grid[j * W + i] = v; };
  for (const [i0, j0, i1, j1] of CARVE) {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      set(i, j, 0);
      const [mi, mj] = mt(i, j);
      set(mi, mj, 0);
    }
  }
  for (const [i, j] of PILLARS) {
    set(i, j, 1);
    const [mi, mj] = mt(i, j);
    set(mi, mj, 1);
  }

  // 兵线路径（蓝方 → 红方）
  const blue = {
    top: [[600, 1060], [600, 360], [4200, 360], [4200, 1100], [4500, 1280]],
    mid: [[720, 1280], [4080, 1280], [4500, 1280]],
    bot: [[600, 1500], [600, 2200], [4200, 2200], [4200, 1460], [4500, 1280]],
  };
  const toPts = (arr) => arr.map(([x, y]) => ({ x, y }));
  const mirPath = (arr) => arr.map(([x, y]) => mirror(x, y));
  const lanePaths = [
    { top: toPts(blue.top), mid: toPts(blue.mid), bot: toPts(blue.bot) },
    { top: mirPath(blue.bot), mid: mirPath(blue.mid), bot: mirPath(blue.top) },
  ];

  // 防御塔：每路外塔 + 内塔，基地水晶
  const towerSpots = [];
  const addTower = (team, lane, tier, x, y) => {
    const p = team === 0 ? { x, y } : mirror(x, y);
    towerSpots.push({ team, lane, tier, ...p });
  };
  for (const team of [0, 1]) {
    // 红方的上路 = 蓝方下路的镜像
    const L = (l) => (team === 0 ? l : l === 'top' ? 'bot' : l === 'bot' ? 'top' : 'mid');
    addTower(team, L('top'), 'inner', 1000, 360);
    addTower(team, L('top'), 'outer', 1800, 360);
    addTower(team, L('mid'), 'inner', 1060, 1280);
    addTower(team, L('mid'), 'outer', 1860, 1280);
    addTower(team, L('bot'), 'inner', 1000, 2200);
    addTower(team, L('bot'), 'outer', 1800, 2200);
    addTower(team, 'base', 'core', 300, 1280);
  }

  // 野怪营地
  const camps = [];
  const addCamp = (type, x, y, side) => {
    camps.push({ type, x, y, side: 0 });
    const m = mirror(x, y);
    camps.push({ type, x: m.x, y: m.y, side: 1 });
  };
  addCamp('skeleton', 1160, 760);
  addCamp('golem', 1840, 840);
  addCamp('spider', 1160, 1800);
  addCamp('wolf', 1840, 1720);
  camps.push({ type: 'dragon', x: 2400, y: 740, side: -1 });
  camps.push({ type: 'colossus', x: 2400, y: 1820, side: -1 });

  // 宝箱
  const chests = [];
  for (const [x, y] of [[930, 900], [1390, 1930], [2620, 1940]]) {
    chests.push({ x, y });
    chests.push(mirror(x, y));
  }

  return { grid, lanePaths, towerSpots, camps, chests };
}

export const MAP = buildMap();

export function solid(i, j) {
  if (i < 0 || j < 0 || i >= W || j >= H) return true;
  return MAP.grid[j * W + i] === 1;
}
export const wallAt = (x, y) => solid(Math.floor(x / TILE), Math.floor(y / TILE));

// 装饰物件：墙上烛台、蘑菇、蕨类、晶石、骸骨
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
  const floorSpot = (x0, y0, x1, y1, tries = 30) => {
    for (let t = 0; t < tries; t++) {
      const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
      const i = Math.floor(x / TILE), j = Math.floor(y / TILE);
      if (!solid(i, j)) return { x, y };
    }
    return null;
  };
  // 野区与基地的装饰（沿墙脚摆放）
  for (let j = 1; j < H - 1; j++) {
    for (let i = 1; i < W - 1; i++) {
      if (solid(i, j)) continue;
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
    if (c.side === -1) {
      for (let n = 0; n < 4; n++) {
        const p = floorSpot(c.x - 200, c.y - 140, c.x + 200, c.y + 140);
        if (p) props.push({ type: 'crystal', x: p.x, y: p.y, seed: rnd() });
      }
    }
  }
  return props;
}
