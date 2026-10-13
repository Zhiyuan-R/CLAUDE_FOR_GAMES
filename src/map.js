// 地图布局：障碍物（可阻挡移动与飞行物）与装饰物件，按中心点对称摆放
import { WORLD, BOUNDS, mirror } from './config.js';
import { seeded } from './math.js';

export const TOWER_SPOTS = [
  { kind: 'core', x: 300 },
  { kind: 'tower', x: 860 },
];

export function buildProps() {
  const rnd = seeded(7);
  const props = [];
  const pair = (type, x, y, o = {}) => {
    props.push({ type, x, y, seed: rnd(), ...o });
    const m = mirror(x, y);
    props.push({ type, x: m.x, y: m.y, seed: rnd(), ...o });
  };

  // 可碰撞障碍物：r 为碰撞半径，h 为高度（低于该高度的飞行物会被挡住）
  pair('pillar', 640, 330, { r: 30, h: 130, solid: true });
  pair('pillar', 640, 710, { r: 30, h: 130, solid: true });
  pair('rock', 1070, 310, { r: 44, h: 60, solid: true });
  pair('rock', 1080, 760, { r: 40, h: 60, solid: true });
  pair('pillar', 1300, 330, { r: 34, h: 140, solid: true, broken: true });
  pair('torch', 440, 240, { r: 10, h: 90, solid: true });
  pair('torch', 440, 800, { r: 10, h: 90, solid: true });
  pair('torch', 1160, 230, { r: 10, h: 90, solid: true });
  pair('torch', 1160, 810, { r: 10, h: 90, solid: true });
  pair('crystal', 200, 300, { r: 0 });
  pair('crystal', 200, 740, { r: 0 });

  // 地图边缘：上方森林、下方悬崖边的石笋、零散蘑菇
  for (let x = -160; x < WORLD.w + 200; x += 110 + rnd() * 60) {
    props.push({ type: 'tree', x, y: BOUNDS.y0 - 40 - rnd() * 50, s: 0.85 + rnd() * 0.5, seed: rnd(), r: 0 });
  }
  for (let x = -100; x < WORLD.w + 100; x += 90 + rnd() * 80) {
    props.push({ type: 'stalag', x, y: BOUNDS.y1 + 30 + rnd() * 25, s: 0.7 + rnd() * 0.7, seed: rnd(), r: 0 });
  }
  for (let i = 0; i < 26; i++) {
    const top = rnd() < 0.5;
    const x = BOUNDS.x0 + 60 + rnd() * (BOUNDS.x1 - BOUNDS.x0 - 120);
    const y = top ? BOUNDS.y0 + 5 + rnd() * 40 : BOUNDS.y1 - 10 - rnd() * 30;
    props.push({ type: 'shroom', x, y, s: 0.6 + rnd() * 0.6, seed: rnd(), r: 0, hue: rnd() < 0.5 ? 'teal' : 'pink' });
  }
  for (let y = BOUNDS.y0 - 20; y < BOUNDS.y1 + 40; y += 70 + rnd() * 40) {
    props.push({ type: 'tree', x: BOUNDS.x0 - 70 - rnd() * 40, y, s: 0.8 + rnd() * 0.4, seed: rnd(), r: 0 });
    props.push({ type: 'tree', x: BOUNDS.x1 + 70 + rnd() * 40, y, s: 0.8 + rnd() * 0.4, seed: rnd(), r: 0 });
  }
  return props;
}
