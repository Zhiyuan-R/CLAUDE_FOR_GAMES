// 导航：墙体碰撞、视线检测、A* 寻路（8 方向，禁止切角）+ 路径平滑
import { TILE, GRID_W as W, GRID_H as H } from './config.js';
import { solid } from './map.js';

// 把圆形单位推出墙体瓦片
export function resolveWalls(u) {
  const r = u.radius;
  const i0 = Math.floor((u.x - r) / TILE), i1 = Math.floor((u.x + r) / TILE);
  const j0 = Math.floor((u.y - r) / TILE), j1 = Math.floor((u.y + r) / TILE);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (!solid(i, j)) continue;
      const rx0 = i * TILE, ry0 = j * TILE, rx1 = rx0 + TILE, ry1 = ry0 + TILE;
      const cx = Math.max(rx0, Math.min(u.x, rx1)), cy = Math.max(ry0, Math.min(u.y, ry1));
      let dx = u.x - cx, dy = u.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        u.x = cx + (dx / d) * r;
        u.y = cy + (dy / d) * r;
      } else {
        // 圆心已在墙内：沿最短方向推出
        const pens = [[u.x - rx0, -1, 0], [rx1 - u.x, 1, 0], [u.y - ry0, 0, -1], [ry1 - u.y, 0, 1]];
        pens.sort((a, b) => a[0] - b[0]);
        const [p, sx, sy] = pens[0];
        u.x += sx * (p + r);
        u.y += sy * (p + r);
      }
    }
  }
}

// 两点之间是否没有墙（r>0 时同时检查两侧的“宽度”）
export function los(x0, y0, x1, y1, r = 0) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / (TILE * 0.25)));
  const nx = len ? -dy / len : 0, ny = len ? dx / len : 0;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = x0 + dx * t, y = y0 + dy * t;
    if (solid(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
    if (r > 0) {
      if (solid(Math.floor((x + nx * r) / TILE), Math.floor((y + ny * r) / TILE))) return false;
      if (solid(Math.floor((x - nx * r) / TILE), Math.floor((y - ny * r) / TILE))) return false;
    }
  }
  return true;
}

// 找到离某点最近的可行走瓦片中心
export function nearestFloor(x, y) {
  const i = Math.floor(x / TILE), j = Math.floor(y / TILE);
  if (!solid(i, j)) return { x, y };
  for (let r = 1; r < 6; r++) {
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      if (!solid(i + di, j + dj)) return { x: (i + di + 0.5) * TILE, y: (j + dj + 0.5) * TILE };
    }
  }
  return { x, y };
}

const N = W * H;
const gScore = new Float32Array(N);
const came = new Int32Array(N);
const closed = new Uint8Array(N);
const stamp = new Uint32Array(N);
let curStamp = 0;
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

export function findPath(sx, sy, tx, ty, radius = 20) {
  const s = nearestFloor(sx, sy), t = nearestFloor(tx, ty);
  if (los(sx, sy, t.x, t.y, radius)) return [{ x: t.x, y: t.y }];
  const si = Math.floor(s.x / TILE), sj = Math.floor(s.y / TILE);
  const ti = Math.floor(t.x / TILE), tj = Math.floor(t.y / TILE);
  const start = sj * W + si, goal = tj * W + ti;
  curStamp++;
  const heap = [];
  const push = (n, f) => {
    heap.push([f, n]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top[1];
  };
  const h = (i, j) => {
    const dx = Math.abs(i - ti), dy = Math.abs(j - tj);
    return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
  };
  const touch = (n) => { if (stamp[n] !== curStamp) { stamp[n] = curStamp; gScore[n] = Infinity; closed[n] = 0; came[n] = -1; } };
  touch(start);
  gScore[start] = 0;
  push(start, h(si, sj));
  let found = false;
  let iter = 0;
  while (heap.length && iter++ < 4000) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) { found = true; break; }
    const ci = cur % W, cj = (cur - ci) / W;
    for (const [di, dj, cost] of DIRS) {
      const ni = ci + di, nj = cj + dj;
      if (solid(ni, nj)) continue;
      if (di && dj && (solid(ci + di, cj) || solid(ci, cj + dj))) continue;
      const n = nj * W + ni;
      touch(n);
      if (closed[n]) continue;
      const g2 = gScore[cur] + cost;
      if (g2 < gScore[n]) {
        gScore[n] = g2;
        came[n] = cur;
        push(n, g2 + h(ni, nj));
      }
    }
  }
  if (!found) return [{ x: t.x, y: t.y }];
  const cells = [];
  for (let n = goal; n !== -1 && n !== start; n = came[n]) cells.push(n);
  cells.reverse();
  if (!cells.length) return [{ x: t.x, y: t.y }];
  const pts = cells.map((n) => ({ x: ((n % W) + 0.5) * TILE, y: (Math.floor(n / W) + 0.5) * TILE }));
  pts[pts.length - 1] = { x: t.x, y: t.y };
  // 视线平滑：跳过可以直接走到的中间点
  const out = [];
  let ax = sx, ay = sy, k = 0;
  while (k < pts.length) {
    let far = k;
    for (let m = pts.length - 1; m > k; m--) {
      if (los(ax, ay, pts[m].x, pts[m].y, radius)) { far = m; break; }
    }
    out.push(pts[far]);
    ax = pts[far].x; ay = pts[far].y;
    k = far + 1;
  }
  return out;
}
