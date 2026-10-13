// 预渲染地牢地面：石板兵道、野区泥地与苔藓、基地法阵、Boss 巢穴、墙脚阴影、烘焙烛光
import { WORLD, YS, TILE, GRID_W, GRID_H, SPAWN, TEAM_COLORS, mirror } from '../config.js';
import { seeded } from '../math.js';
import { solid, buildProps } from '../map.js';

export const GROUND_PAD = { x: 40, y: 40 };
const RES = 1;
const INK = '#140c20';

// 判断瓦片属于哪类区域
function region(i, j) {
  const inBase = (a, b) => a >= 1 && a <= 8 && b >= 10 && b <= 21;
  const [mi, mj] = [GRID_W - 1 - i, GRID_H - 1 - j];
  if (inBase(i, j) || inBase(mi, mj)) return 'base';
  const lane = (a, b) => (b >= 3 && b <= 5) || (b >= 26 && b <= 28) || (b >= 14 && b <= 17 && a >= 8 && a <= 51) || (a >= 6 && a <= 8 && (b <= 9 || b >= 22));
  if (lane(i, j) || lane(mi, mj)) return 'lane';
  if (i >= 27 && i <= 32 && ((j >= 7 && j <= 11) || (j >= 20 && j <= 24))) return j < 16 ? 'dragon' : 'colossus';
  return 'jungle';
}

export function buildGround() {
  const rnd = seeded(42);
  const w = WORLD.w + GROUND_PAD.x * 2;
  const h = (WORLD.h + GROUND_PAD.y * 2) * YS;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * RES);
  c.height = Math.ceil(h * RES);
  const ctx = c.getContext('2d');
  ctx.scale(RES, RES);
  ctx.translate(GROUND_PAD.x, GROUND_PAD.y * YS);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const P = (y) => y * YS;
  const R = (a, b) => a + rnd() * (b - a);
  const T = TILE;

  ctx.fillStyle = '#0d0918';
  ctx.fillRect(-GROUND_PAD.x, P(-GROUND_PAD.y), w, h);

  // 地板区域裁剪
  ctx.save();
  ctx.beginPath();
  for (let j = 0; j < GRID_H; j++) for (let i = 0; i < GRID_W; i++) if (!solid(i, j)) ctx.rect(i * T - 1, P(j * T) - 1, T + 2, P(T) + 2);
  ctx.clip();

  // 底色：兵道深色石缝、野区泥土
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      if (solid(i, j)) continue;
      const r = region(i, j);
      ctx.fillStyle = r === 'jungle' ? '#29243a' : r === 'dragon' ? '#2e1e26' : r === 'colossus' ? '#2a2630' : '#17121f';
      ctx.fillRect(i * T, P(j * T), T, P(T));
    }
  }
  // 野区：绘画感色块与苔藓
  const tones = ['#30284b', '#262036', '#2e2a46', '#2b3040', '#33294a'];
  for (let n = 0; n < 9000; n++) {
    const x = R(0, WORLD.w), y = R(0, WORLD.h);
    const i = Math.floor(x / T), j = Math.floor(y / T);
    if (solid(i, j) || region(i, j) !== 'jungle') continue;
    ctx.globalAlpha = R(0.3, 0.7);
    ctx.fillStyle = tones[(rnd() * tones.length) | 0];
    const rr = R(8, 34);
    ctx.beginPath(); ctx.ellipse(x, P(y), rr, rr * YS, R(0, 3), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let n = 0; n < 500; n++) {
    const x = R(0, WORLD.w), y = R(0, WORLD.h);
    const i = Math.floor(x / T), j = Math.floor(y / T);
    if (solid(i, j) || region(i, j) === 'lane') continue;
    const rr = R(25, 80);
    const g = ctx.createRadialGradient(x, P(y), 0, x, P(y), rr);
    g.addColorStop(0, rnd() < 0.7 ? 'rgba(78,128,62,0.45)' : 'rgba(100,70,160,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, P(y), rr, rr * YS, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 石板（共享角点抖动网格）：兵道与基地铺满，野区零星
  const cw = 62, ch = 52;
  const cols = Math.ceil(WORLD.w / cw), rows = Math.ceil(WORLD.h / ch);
  const pt = [];
  for (let j = 0; j <= rows; j++) {
    pt.push([]);
    for (let i = 0; i <= cols; i++) pt[j].push([i * cw + R(-13, 13), j * ch + R(-10, 10)]);
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const cx = (i + 0.5) * cw, cy = (j + 0.5) * ch;
      const ti = Math.floor(cx / T), tj = Math.floor(cy / T);
      if (solid(ti, tj)) continue;
      const r = region(ti, tj);
      const keep = r === 'lane' || r === 'base' ? 0.97 : r === 'jungle' ? 0.16 : 0.55;
      if (rnd() > keep) continue;
      stone(ctx, [pt[j][i], pt[j][i + 1], pt[j + 1][i + 1], pt[j + 1][i]], P, rnd, r);
    }
  }

  // Boss 巢穴：熔岩裂缝 / 远古符文
  lavaCracks(ctx, 2400, 740, rnd, P);
  runeCircle(ctx, 2400, 1820, 150, '#d9a35a', rnd);
  runeCircle(ctx, WORLD.w / 2, WORLD.h / 2, 150, '#8a74ff', rnd);

  // 基地法阵与泉水
  for (const team of [0, 1]) {
    const core = team === 0 ? { x: 300, y: 1280 } : mirror(300, 1280);
    plaza(ctx, core.x, core.y, 250, TEAM_COLORS[team], rnd);
    const sp = SPAWN[team];
    const g2 = ctx.createRadialGradient(sp.x, P(sp.y), 10, sp.x, P(sp.y), 150);
    g2.addColorStop(0, team === 0 ? 'rgba(79,176,255,0.45)' : 'rgba(255,77,94,0.45)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.ellipse(sp.x, P(sp.y), 150, 150 * YS, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 碎石、草丛
  for (let n = 0; n < 1600; n++) {
    const x = R(0, WORLD.w), y = R(0, WORLD.h);
    const i = Math.floor(x / T), j = Math.floor(y / T);
    if (solid(i, j)) continue;
    const r = region(i, j);
    if (rnd() < (r === 'lane' ? 0.25 : 0.6)) tuft(ctx, x, P(y), R(0.45, 1.1), rnd() < 0.6 ? ['#3f6e35', '#5f9a48'] : ['#3d2c66', '#5f48a3'], rnd);
    else pebble(ctx, x, P(y), R(2.5, 6.5), rnd);
  }

  // 墙脚阴影（环境光遮蔽）
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      if (solid(i, j)) continue;
      const x0 = i * T, y0 = P(j * T), th = P(T);
      if (solid(i, j - 1)) { const g = ctx.createLinearGradient(0, y0, 0, y0 + th * 0.8); g.addColorStop(0, 'rgba(6,3,14,0.75)'); g.addColorStop(1, 'rgba(6,3,14,0)'); ctx.fillStyle = g; ctx.fillRect(x0, y0, T, th * 0.8); }
      if (solid(i - 1, j)) { const g = ctx.createLinearGradient(x0, 0, x0 + 26, 0); g.addColorStop(0, 'rgba(6,3,14,0.6)'); g.addColorStop(1, 'rgba(6,3,14,0)'); ctx.fillStyle = g; ctx.fillRect(x0, y0, 26, th); }
      if (solid(i + 1, j)) { const g = ctx.createLinearGradient(x0 + T, 0, x0 + T - 26, 0); g.addColorStop(0, 'rgba(6,3,14,0.6)'); g.addColorStop(1, 'rgba(6,3,14,0)'); ctx.fillStyle = g; ctx.fillRect(x0 + T - 26, y0, 26, th); }
    }
  }

  // 烘焙烛光
  ctx.globalCompositeOperation = 'lighter';
  for (const p of buildProps()) {
    if (p.type !== 'sconce') continue;
    const g = ctx.createRadialGradient(p.x, P(p.y + 30), 0, p.x, P(p.y + 30), 210);
    g.addColorStop(0, 'rgba(255,140,50,0.26)');
    g.addColorStop(0.5, 'rgba(255,110,40,0.09)');
    g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(p.x, P(p.y + 30), 210, 210 * YS, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  return { canvas: c, res: RES };
}

function poly(ctx, q, P) {
  ctx.beginPath();
  q.forEach(([x, y], i) => (i ? ctx.lineTo(x, P(y)) : ctx.moveTo(x, P(y))));
  ctx.closePath();
}

function stone(ctx, q, P, rnd, region) {
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  const s = q.map(([x, y]) => [x + (cx - x) * 0.08, y + (cy - y) * 0.1]);
  const l = 28 + rnd() * 9;
  const hue = region === 'dragon' ? 345 + rnd() * 10 : region === 'colossus' ? 30 + rnd() * 10 : 250 + rnd() * 16;
  const sat = region === 'dragon' || region === 'colossus' ? 14 : 16;
  poly(ctx, s, P);
  ctx.fillStyle = `hsl(${hue},${sat}%,${l}%)`;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.lineWidth = 5;
  ctx.strokeStyle = `hsla(${hue},30%,${l + 18}%,0.5)`;
  ctx.beginPath(); ctx.moveTo(s[3][0], P(s[3][1])); ctx.lineTo(s[0][0], P(s[0][1])); ctx.lineTo(s[1][0], P(s[1][1])); ctx.stroke();
  ctx.strokeStyle = `hsla(${hue},20%,${l - 14}%,0.8)`;
  ctx.beginPath(); ctx.moveTo(s[1][0], P(s[1][1])); ctx.lineTo(s[2][0], P(s[2][1])); ctx.lineTo(s[3][0], P(s[3][1])); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(cx + (rnd() - 0.5) * 40, P(cy + (rnd() - 0.5) * 30), 2 + rnd() * 6, 1.5 + rnd() * 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (rnd() < 0.16) {
    const [mx, my] = s[(rnd() * 4) | 0];
    ctx.fillStyle = 'rgba(80,135,60,0.85)';
    ctx.beginPath(); ctx.ellipse(mx, P(my), 14 + rnd() * 14, 7 + rnd() * 6, rnd() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  poly(ctx, s, P);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  if (rnd() < 0.25) {
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let x = cx + (rnd() - 0.5) * 20, y = cy + (rnd() - 0.5) * 14;
    ctx.moveTo(x, P(y));
    for (let i = 0; i < 3; i++) { x += (rnd() - 0.5) * 22; y += (rnd() - 0.5) * 18; ctx.lineTo(x, P(y)); }
    ctx.stroke();
  }
}

function tuft(ctx, x, y, s, cols, rnd) {
  const n = 3 + ((rnd() * 3) | 0);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.45 + (rnd() - 0.5) * 0.3;
    const len = 9 + rnd() * 9;
    const bx = (i - (n - 1) / 2) * 2.5;
    ctx.beginPath();
    ctx.moveTo(bx - 2.2, 0);
    ctx.quadraticCurveTo(bx + Math.cos(a) * len * 0.5 - 2, Math.sin(a) * len * 0.5, bx + Math.cos(a) * len, Math.sin(a) * len);
    ctx.quadraticCurveTo(bx + Math.cos(a) * len * 0.5 + 2, Math.sin(a) * len * 0.5, bx + 2.2, 0);
    ctx.closePath();
    ctx.fillStyle = cols[i % 2];
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

function pebble(ctx, x, y, rr, rnd) {
  ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.65, rnd() * 3, 0, Math.PI * 2);
  ctx.fillStyle = rnd() < 0.5 ? '#4a4268' : '#3b3456'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = 'rgba(160,150,210,0.35)';
  ctx.beginPath(); ctx.ellipse(x - rr * 0.3, y - rr * 0.25, rr * 0.4, rr * 0.2, 0, 0, Math.PI * 2); ctx.fill();
}

function lavaCracks(ctx, x, y, rnd, P) {
  ctx.save();
  for (let k = 0; k < 14; k++) {
    let px = x + (rnd() - 0.5) * 360, py = y + (rnd() - 0.5) * 260;
    const pts = [[px, py]];
    for (let s = 0; s < 4; s++) { px += (rnd() - 0.5) * 70; py += (rnd() - 0.5) * 50; pts.push([px, py]); }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 7;
    ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, P(b)) : ctx.moveTo(a, P(b)))); ctx.stroke();
    ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,140,40,0.35)'; ctx.lineWidth = 12;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function runeCircle(ctx, x, y, r, color, rnd) {
  ctx.save();
  ctx.translate(x, y * YS);
  ctx.scale(1, YS);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    ctx.save();
    ctx.rotate((i / 12) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(r * 0.83, -5); ctx.lineTo(r * 0.95, 0); ctx.lineTo(r * 0.83, 5);
    if (rnd() < 0.5) { ctx.moveTo(r * 0.87, -8); ctx.lineTo(r * 0.87, 8); }
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, b = ((i + 2) / 6) * Math.PI * 2;
    ctx.moveTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
    ctx.lineTo(Math.cos(b) * r * 0.78, Math.sin(b) * r * 0.78);
  }
  ctx.stroke();
  ctx.restore();
}

function plaza(ctx, x, y, r, color, rnd) {
  ctx.save();
  ctx.translate(x, y * YS);
  ctx.scale(1, YS);
  ctx.fillStyle = '#16111f';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  const rings = [[0, r * 0.3, 1], [r * 0.3, r * 0.58, 10], [r * 0.58, r * 0.8, 16], [r * 0.8, r, 22]];
  for (const [r0, r1, n] of rings) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + 0.02, a1 = ((i + 1) / n) * Math.PI * 2 - 0.02;
      ctx.beginPath();
      if (n === 1) ctx.arc(0, 0, r1 - 4, 0, Math.PI * 2);
      else { ctx.arc(0, 0, r1 - 3, a0, a1); ctx.arc(0, 0, r0 + 3, a1, a0, true); ctx.closePath(); }
      ctx.fillStyle = `hsl(${252 + rnd() * 12},18%,${32 + rnd() * 9}%)`;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 12;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ───────────── 墙体精灵（每帧按瓦片贴图） ─────────────
export const SPR = 2;
export function buildWallSprites(wallH) {
  const rnd = seeded(99);
  const T = TILE, th = TILE * YS;
  const make = (wd, ht) => { const c = document.createElement('canvas'); c.width = Math.ceil(wd * SPR); c.height = Math.ceil(ht * SPR); const x = c.getContext('2d'); x.scale(SPR, SPR); return [c, x]; };
  const tops = [], fronts = [];
  for (let v = 0; v < 4; v++) {
    const [c, x] = make(T, th);
    x.fillStyle = '#1f1930';
    x.fillRect(0, 0, T, th);
    for (let k = 0; k < 10; k++) {
      x.fillStyle = rnd() < 0.5 ? 'rgba(70,60,110,0.3)' : 'rgba(6,3,14,0.35)';
      x.beginPath(); x.ellipse(rnd() * T, rnd() * th, 4 + rnd() * 12, 3 + rnd() * 6, 0, 0, Math.PI * 2); x.fill();
    }
    // 顶面石块缝
    x.strokeStyle = 'rgba(14,8,26,0.7)';
    x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(0, th * 0.5 + (rnd() - 0.5) * 6); x.lineTo(T, th * 0.5 + (rnd() - 0.5) * 6);
    const sx = T * (0.3 + rnd() * 0.4);
    x.moveTo(sx, 0); x.lineTo(sx + (rnd() - 0.5) * 8, th * 0.5);
    x.stroke();
    if (rnd() < 0.5) { x.fillStyle = 'rgba(80,135,60,0.6)'; x.beginPath(); x.ellipse(rnd() * T, rnd() * th, 10 + rnd() * 10, 4 + rnd() * 4, 0, 0, Math.PI * 2); x.fill(); }
    tops.push(c);

    const [f, y] = make(T, wallH);
    const g = y.createLinearGradient(0, 0, 0, wallH);
    g.addColorStop(0, '#554a7c');
    g.addColorStop(0.55, '#3d345c');
    g.addColorStop(1, '#241d38');
    y.fillStyle = g;
    y.fillRect(0, 0, T, wallH);
    // 砖块
    const rows = 4, rh = wallH / rows;
    y.strokeStyle = INK;
    y.lineWidth = 2;
    for (let r = 0; r < rows; r++) {
      const yy = r * rh;
      y.beginPath(); y.moveTo(0, yy); y.lineTo(T, yy); y.stroke();
      const off = r % 2 ? T * 0.5 : T * 0.25;
      for (let bx = off; bx < T; bx += T * 0.5) { y.beginPath(); y.moveTo(bx, yy); y.lineTo(bx, yy + rh); y.stroke(); }
      // 砖块高光
      y.fillStyle = 'rgba(160,150,220,0.12)';
      y.fillRect(0, yy + 2, T, 3);
    }
    // 苔藓垂挂与裂缝
    if (rnd() < 0.6) {
      y.fillStyle = '#4f7d3a';
      const mx = rnd() * T;
      y.beginPath(); y.moveTo(mx - 14, 0); y.quadraticCurveTo(mx - 10, 14 + rnd() * 16, mx, 8); y.quadraticCurveTo(mx + 6, 20 + rnd() * 14, mx + 14, 0); y.closePath(); y.fill();
      y.strokeStyle = INK; y.lineWidth = 1.2; y.stroke();
    }
    if (rnd() < 0.5) {
      y.strokeStyle = INK; y.lineWidth = 1.4;
      let cx = rnd() * T, cy = rh * (1 + rnd() * 2);
      y.beginPath(); y.moveTo(cx, cy);
      for (let s = 0; s < 3; s++) { cx += (rnd() - 0.5) * 16; cy += rnd() * 10; y.lineTo(cx, cy); }
      y.stroke();
    }
    // 底部与地面接缝
    y.fillStyle = 'rgba(8,4,16,0.55)';
    y.fillRect(0, wallH - 6, T, 6);
    // 顶沿高光
    y.fillStyle = 'rgba(190,180,240,0.35)';
    y.fillRect(0, 0, T, 2.5);
    fronts.push(f);
  }
  return { tops, fronts };
}
