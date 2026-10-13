// 预渲染整张地面：拼接石板兵道、苔藓与草丛、毒沼、悬崖、基地法阵、烘焙的火把光照
import { WORLD, BOUNDS, YS, LANE_Y, SPAWN, TEAM_COLORS } from '../config.js';
import { seeded } from '../math.js';
import { buildProps } from '../map.js';

export const GROUND_PAD = { x: 260, y: 260 };
const RES = 1.25;
const INK = '#140c20';

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

  // 深渊
  const bg = ctx.createLinearGradient(0, P(-GROUND_PAD.y), 0, P(WORLD.h + GROUND_PAD.y));
  bg.addColorStop(0, '#0c0818');
  bg.addColorStop(0.55, '#120d24');
  bg.addColorStop(1, '#04161a');
  ctx.fillStyle = bg;
  ctx.fillRect(-GROUND_PAD.x, P(-GROUND_PAD.y), w, h);

  const gx0 = BOUNDS.x0 - 70, gx1 = BOUNDS.x1 + 70, gy0 = -40, gy1 = BOUNDS.y1 + 40;

  // ── 下方悬崖：分层岩壁 ──
  const lip = [];
  for (let x = gx0 - 40; x <= gx1 + 40; x += 30) lip.push([x, P(gy1) + R(-4, 6)]);
  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath();
    ctx.moveTo(lip[0][0], lip[0][1]);
    for (const [x, y] of lip) ctx.lineTo(x, y);
    for (let i = lip.length - 1; i >= 0; i--) ctx.lineTo(lip[i][0], lip[i][1] + 40 + layer * 38 + R(0, 26));
    ctx.closePath();
    ctx.fillStyle = ['#2e2547', '#221b38', '#18122a'][layer];
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (let x = gx0; x < gx1; x += R(40, 90)) {
    ctx.beginPath();
    ctx.moveTo(x, P(gy1) + 4);
    ctx.lineTo(x + R(-10, 10), P(gy1) + R(40, 110));
    ctx.stroke();
  }
  const mist = ctx.createLinearGradient(0, P(gy1) + 60, 0, P(gy1) + 220);
  mist.addColorStop(0, 'rgba(50,210,190,0)');
  mist.addColorStop(0.6, 'rgba(50,210,190,0.12)');
  mist.addColorStop(1, 'rgba(50,210,190,0)');
  ctx.fillStyle = mist;
  ctx.fillRect(gx0 - 300, P(gy1) + 60, gx1 - gx0 + 600, 180);

  // ── 地面主体 ──
  ctx.save();
  groundShape(ctx, gx0, P(gy0), gx1 - gx0, P(gy1) - P(gy0), 60);
  ctx.fillStyle = '#2a2342';
  ctx.fill();
  ctx.clip();

  // 绘画感色块
  const tones = ['#30284b', '#251f3a', '#2e2a48', '#352c52', '#211c34', '#2b3040'];
  for (let i = 0; i < 2200; i++) {
    const x = R(gx0, gx1), y = R(gy0, gy1);
    ctx.globalAlpha = R(0.25, 0.6);
    ctx.fillStyle = tones[(rnd() * tones.length) | 0];
    const rr = R(8, 46);
    ctx.beginPath(); ctx.ellipse(x, P(y), rr, rr * YS * R(0.7, 1.2), R(0, 3), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 苔藓地（兵道两侧）
  for (let i = 0; i < 110; i++) {
    const x = R(gx0, gx1);
    const y = rnd() < 0.5 ? R(gy0 + 150, LANE_Y - 140) : R(LANE_Y + 140, gy1 - 20);
    const rr = R(30, 110);
    const g = ctx.createRadialGradient(x, P(y), 0, x, P(y), rr);
    const green = rnd() < 0.7;
    g.addColorStop(0, green ? 'rgba(78,128,62,0.5)' : 'rgba(90,70,150,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, P(y), rr, rr * YS, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ── 毒沼（地图上边缘） ──
  for (const [px, pr] of [[330, 150], [900, 120], [1500, 170], [2080, 130], [2470, 110]]) {
    swamp(ctx, px, P(165 + R(-15, 10)), pr, pr * 0.32, rnd);
  }

  // ── 石板兵道（共享角点的抖动网格，石板之间紧密拼接） ──
  const cw = 62, ch = 50;
  const lx0 = 140, lx1 = WORLD.w - 140, ly0 = LANE_Y - 130, ly1 = LANE_Y + 130;
  const cols = Math.ceil((lx1 - lx0) / cw), rows = Math.ceil((ly1 - ly0) / ch);
  const pt = [];
  for (let j = 0; j <= rows; j++) {
    pt.push([]);
    for (let i = 0; i <= cols; i++) {
      const edge = i === 0 || i === cols || j === 0 || j === rows;
      pt[j].push([lx0 + i * cw + (edge ? 0 : R(-14, 14)), ly0 + j * ch + (edge ? 0 : R(-11, 11))]);
    }
  }
  const cells = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const edgeRow = j === 0 || j === rows - 1;
      const edgeCol = i < 2 || i > cols - 3;
      if ((edgeRow && rnd() < 0.45) || (edgeCol && rnd() < 0.5) || rnd() < 0.03) continue;
      cells.push([pt[j][i], pt[j][i + 1], pt[j + 1][i + 1], pt[j + 1][i]]);
    }
  }
  // 石缝底色
  ctx.fillStyle = '#16111f';
  for (const q of cells) { poly(ctx, q, P); ctx.fill(); }
  for (const q of cells) stone(ctx, q, P, rnd);

  // ── 散落碎石与小石子 ──
  for (let i = 0; i < 260; i++) {
    const x = R(gx0 + 20, gx1 - 20), y = R(gy0 + 180, gy1 - 10);
    const rr = R(2.5, 7);
    ctx.beginPath(); ctx.ellipse(x, P(y), rr, rr * 0.65, R(0, 3), 0, Math.PI * 2);
    ctx.fillStyle = rnd() < 0.5 ? '#4a4268' : '#3b3456'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(160,150,210,0.35)';
    ctx.beginPath(); ctx.ellipse(x - rr * 0.3, P(y) - rr * 0.25, rr * 0.4, rr * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ── 基地法阵 ──
  for (const team of [0, 1]) {
    const cx = team === 0 ? 290 : WORLD.w - 290;
    plaza(ctx, cx, LANE_Y, 260, TEAM_COLORS[team], rnd);
    const sp = SPAWN[team];
    const g2 = ctx.createRadialGradient(sp.x, P(sp.y), 10, sp.x, P(sp.y), 120);
    g2.addColorStop(0, team === 0 ? 'rgba(79,176,255,0.4)' : 'rgba(255,77,94,0.4)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.ellipse(sp.x, P(sp.y), 120, 120 * YS, 0, 0, Math.PI * 2); ctx.fill();
  }
  runeCircle(ctx, WORLD.w / 2, LANE_Y, 125, '#8a74ff', rnd);

  // ── 草丛（带墨线的尖叶簇） ──
  for (let i = 0; i < 700; i++) {
    const x = R(gx0, gx1);
    const y = rnd() < 0.5 ? R(gy0 + 175, LANE_Y - 120) : R(LANE_Y + 125, gy1 - 6);
    const green = rnd() < 0.55;
    tuft(ctx, x, P(y), R(0.6, 1.3), green ? ['#3f6e35', '#5f9a48'] : ['#3d2c66', '#5f48a3'], rnd);
  }
  // 石板缝隙里的小草
  for (let i = 0; i < 160; i++) {
    const x = R(lx0, lx1), y = R(ly0, ly1);
    tuft(ctx, x, P(y), R(0.35, 0.6), ['#3f6e35', '#5f9a48'], rnd);
  }

  // ── 烘焙火把光照 ──
  ctx.globalCompositeOperation = 'lighter';
  for (const p of buildProps()) {
    if (p.type === 'torch') {
      const g = ctx.createRadialGradient(p.x, P(p.y), 0, p.x, P(p.y), 240);
      g.addColorStop(0, 'rgba(255,140,50,0.28)');
      g.addColorStop(0.5, 'rgba(255,110,40,0.1)');
      g.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(p.x, P(p.y), 240, 240 * YS, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  // 上方森林投下的暗影
  const shade = ctx.createLinearGradient(0, P(gy0), 0, P(BOUNDS.y0 + 120));
  shade.addColorStop(0, 'rgba(8,4,18,0.9)');
  shade.addColorStop(0.6, 'rgba(8,4,18,0.35)');
  shade.addColorStop(1, 'rgba(8,4,18,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(gx0, P(gy0), gx1 - gx0, P(BOUNDS.y0 + 120) - P(gy0));
  ctx.restore();

  // 地面边缘墨线 + 悬崖口高光
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(lip[0][0], lip[0][1]); for (const [x, y] of lip) ctx.lineTo(x, y); ctx.stroke();
  ctx.strokeStyle = 'rgba(170,160,220,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(lip[0][0], lip[0][1] - 3); for (const [x, y] of lip) ctx.lineTo(x, y - 3); ctx.stroke();

  return { canvas: c, res: RES };
}

function poly(ctx, q, P) {
  ctx.beginPath();
  q.forEach(([x, y], i) => (i ? ctx.lineTo(x, P(y)) : ctx.moveTo(x, P(y))));
  ctx.closePath();
}

function stone(ctx, q, P, rnd) {
  // 向中心收缩形成石缝
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  const s = q.map(([x, y]) => [x + (cx - x) * 0.07, y + (cy - y) * 0.09]);
  const l = 30 + rnd() * 9;
  const hue = 250 + rnd() * 16;
  poly(ctx, s, P);
  ctx.fillStyle = `hsl(${hue},16%,${l}%)`;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // 斜面：上沿受光、下沿背光
  ctx.lineWidth = 5;
  ctx.strokeStyle = `hsla(${hue},30%,${l + 18}%,0.55)`;
  ctx.beginPath(); ctx.moveTo(s[3][0], P(s[3][1])); ctx.lineTo(s[0][0], P(s[0][1])); ctx.lineTo(s[1][0], P(s[1][1])); ctx.stroke();
  ctx.strokeStyle = `hsla(${hue},20%,${l - 14}%,0.8)`;
  ctx.beginPath(); ctx.moveTo(s[1][0], P(s[1][1])); ctx.lineTo(s[2][0], P(s[2][1])); ctx.lineTo(s[3][0], P(s[3][1])); ctx.stroke();
  // 斑点纹理
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    const px = cx + (rnd() - 0.5) * 40, py = cy + (rnd() - 0.5) * 30;
    ctx.beginPath(); ctx.ellipse(px, P(py), 2 + rnd() * 6, 1.5 + rnd() * 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 苔藓侵蚀
  if (rnd() < 0.18) {
    const k = (rnd() * 4) | 0;
    const [mx, my] = s[k];
    ctx.fillStyle = 'rgba(80,135,60,0.85)';
    ctx.beginPath(); ctx.ellipse(mx, P(my), 14 + rnd() * 14, 7 + rnd() * 6, rnd() * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(120,180,80,0.7)';
    ctx.beginPath(); ctx.ellipse(mx + 2, P(my) - 2, 6 + rnd() * 6, 3 + rnd() * 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  poly(ctx, s, P);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // 裂纹
  if (rnd() < 0.3) {
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

function swamp(ctx, x, y, rx, ry, rnd) {
  ctx.save();
  // 外缘泥岸
  ctx.beginPath(); blob(ctx, x, y, rx + 14, ry + 8, rnd, 0.12);
  ctx.fillStyle = '#1f2a1c'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); blob(ctx, x, y, rx, ry, rnd, 0.1);
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, '#b8f25a');
  g.addColorStop(0.6, '#6fbf2e');
  g.addColorStop(1, '#3f7a1f');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.clip();
  // 涟漪与气泡
  ctx.strokeStyle = 'rgba(220,255,160,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const px = x + (rnd() - 0.5) * rx * 1.4, py = y + (rnd() - 0.5) * ry;
    const rr = 6 + rnd() * 18;
    ctx.beginPath(); ctx.ellipse(px, py, rr, rr * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const px = x + (rnd() - 0.5) * rx * 1.6, py = y + (rnd() - 0.5) * ry * 1.4;
    ctx.beginPath(); ctx.arc(px, py, 1.5 + rnd() * 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(230,255,190,0.7)'; ctx.fill();
  }
  ctx.restore();
  // 发光
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(x, y, 0, x, y, rx * 1.6);
  gl.addColorStop(0, 'rgba(150,240,70,0.22)');
  gl.addColorStop(1, 'rgba(150,240,70,0)');
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.ellipse(x, y, rx * 1.6, rx * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function blob(ctx, x, y, rx, ry, rnd, amt) {
  const n = 16;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rnd() - 0.5) * amt * 2;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

function groundShape(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
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
    const a = (i / 12) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
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
  // 环形石砖
  const rings = [[0, r * 0.3, 1], [r * 0.3, r * 0.58, 10], [r * 0.58, r * 0.8, 16], [r * 0.8, r, 22]];
  for (const [r0, r1, n] of rings) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + 0.02, a1 = ((i + 1) / n) * Math.PI * 2 - 0.02;
      ctx.beginPath();
      if (n === 1) ctx.arc(0, 0, r1 - 4, 0, Math.PI * 2);
      else { ctx.arc(0, 0, r1 - 3, a0, a1); ctx.arc(0, 0, r0 + 3, a1, a0, true); ctx.closePath(); }
      const l = 32 + rnd() * 9;
      ctx.fillStyle = `hsl(${252 + rnd() * 12},18%,${l}%)`;
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
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32); ctx.lineTo(Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56); ctx.stroke();
  }
  ctx.restore();
}
