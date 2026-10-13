// 预渲染整张地面（石板兵道、苔藓、裂缝、基地法阵、悬崖），每帧直接贴图
import { WORLD, BOUNDS, YS, LANE_Y, SPAWN, TEAM_COLORS } from '../config.js';
import { seeded } from '../math.js';

export const GROUND_PAD = { x: 260, y: 260 };
const RES = 1.25;

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
  const P = (y) => y * YS;

  // 深渊背景
  const bg = ctx.createLinearGradient(0, P(-GROUND_PAD.y), 0, P(WORLD.h + GROUND_PAD.y));
  bg.addColorStop(0, '#0d0a1c');
  bg.addColorStop(0.5, '#141027');
  bg.addColorStop(1, '#06171c');
  ctx.fillStyle = bg;
  ctx.fillRect(-GROUND_PAD.x, P(-GROUND_PAD.y), w, h);

  const gx0 = BOUNDS.x0 - 60, gx1 = BOUNDS.x1 + 60, gy0 = BOUNDS.y0 - 80, gy1 = BOUNDS.y1 + 40;

  // 下方悬崖崖壁
  ctx.fillStyle = '#1a1530';
  ctx.beginPath();
  ctx.moveTo(gx0, P(gy1));
  for (let x = gx0; x <= gx1; x += 40) ctx.lineTo(x, P(gy1) + 40 + rnd() * 30);
  ctx.lineTo(gx1, P(gy1));
  ctx.closePath();
  ctx.fill();
  const glow = ctx.createLinearGradient(0, P(gy1) + 30, 0, P(gy1) + 200);
  glow.addColorStop(0, 'rgba(40,190,170,0.0)');
  glow.addColorStop(0.5, 'rgba(40,190,170,0.10)');
  glow.addColorStop(1, 'rgba(40,190,170,0.0)');
  ctx.fillStyle = glow;
  ctx.fillRect(gx0 - 200, P(gy1) + 30, gx1 - gx0 + 400, 200);

  // 地面主体
  ctx.fillStyle = '#29233d';
  roundedBand(ctx, gx0, P(gy0), gx1 - gx0, P(gy1) - P(gy0), 40);
  ctx.fill();
  ctx.save();
  roundedBand(ctx, gx0, P(gy0), gx1 - gx0, P(gy1) - P(gy0), 40);
  ctx.clip();

  // 地面色块噪点
  const tones = ['#2e2744', '#251f37', '#2b2a42', '#312a4a', '#232036'];
  for (let i = 0; i < 1600; i++) {
    const x = gx0 + rnd() * (gx1 - gx0), y = gy0 + rnd() * (gy1 - gy0);
    ctx.globalAlpha = 0.35 + rnd() * 0.4;
    ctx.fillStyle = tones[(rnd() * tones.length) | 0];
    ctx.beginPath();
    ctx.ellipse(x, P(y), 10 + rnd() * 40, (10 + rnd() * 40) * YS, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 苔藓区域（偏离兵道的位置）
  for (let i = 0; i < 70; i++) {
    const x = gx0 + rnd() * (gx1 - gx0);
    const top = rnd() < 0.5;
    const y = top ? gy0 + rnd() * 160 : gy1 - rnd() * 160;
    const r = 40 + rnd() * 90;
    const grd = ctx.createRadialGradient(x, P(y), 0, x, P(y), r);
    grd.addColorStop(0, 'rgba(70,120,70,0.45)');
    grd.addColorStop(1, 'rgba(70,120,70,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(x, P(y), r, r * YS, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 石板兵道
  const laneTop = LANE_Y - 125, laneBot = LANE_Y + 125;
  const tile = 58;
  for (let y = laneTop; y < laneBot; y += tile) {
    const shift = ((y - laneTop) / tile) % 2 ? tile / 2 : 0;
    for (let x = 150 - shift; x < WORLD.w - 150; x += tile) {
      const edge = Math.min(y - laneTop, laneBot - y - tile);
      if (edge < tile && rnd() < 0.35) continue;
      if (rnd() < 0.05) continue;
      const j = () => (rnd() - 0.5) * 6;
      const x0 = x + 2, x1 = x + tile - 2, y0 = y + 2, y1 = y + tile - 2;
      const l = 38 + rnd() * 12;
      ctx.fillStyle = `hsl(${255 + rnd() * 10}, 14%, ${l * 0.6}%)`;
      ctx.beginPath();
      ctx.moveTo(x0 + j(), P(y0 + j()));
      ctx.lineTo(x1 + j(), P(y0 + j()));
      ctx.lineTo(x1 + j(), P(y1 + j()));
      ctx.lineTo(x0 + j(), P(y1 + j()));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(12,8,22,0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,190,240,0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0 + 3, P(y0 + 3));
      ctx.lineTo(x1 - 3, P(y0 + 3));
      ctx.stroke();
    }
  }

  // 中央符文圆环
  runeCircle(ctx, WORLD.w / 2, LANE_Y, 120, '#7c6bd6', rnd);

  // 基地法阵（队伍颜色）
  for (const team of [0, 1]) {
    const cx = team === 0 ? SPAWN[0].x + 110 : SPAWN[1].x - 110;
    platform(ctx, cx, LANE_Y, 250, TEAM_COLORS[team], rnd);
    // 泉水
    const sp = SPAWN[team];
    const g2 = ctx.createRadialGradient(sp.x, P(sp.y), 10, sp.x, P(sp.y), 110);
    g2.addColorStop(0, team === 0 ? 'rgba(79,176,255,0.35)' : 'rgba(255,77,94,0.35)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.ellipse(sp.x, P(sp.y), 110, 110 * YS, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 裂缝
  ctx.strokeStyle = 'rgba(10,6,20,0.6)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 90; i++) {
    let x = gx0 + rnd() * (gx1 - gx0), y = gy0 + rnd() * (gy1 - gy0);
    ctx.beginPath();
    ctx.moveTo(x, P(y));
    for (let k = 0; k < 4; k++) {
      x += (rnd() - 0.5) * 50;
      y += (rnd() - 0.5) * 50;
      ctx.lineTo(x, P(y));
    }
    ctx.stroke();
  }
  // 草丛
  for (let i = 0; i < 900; i++) {
    const x = gx0 + rnd() * (gx1 - gx0);
    const y = rnd() < 0.5 ? gy0 + rnd() * 200 : gy1 - rnd() * 220;
    if (Math.abs(y - LANE_Y) < 130) continue;
    ctx.strokeStyle = rnd() < 0.6 ? 'rgba(80,130,85,0.7)' : 'rgba(110,80,160,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 1.2;
      const l = 5 + rnd() * 8;
      ctx.moveTo(x + k * 3, P(y));
      ctx.lineTo(x + k * 3 + Math.cos(a) * l, P(y) + Math.sin(a) * l);
    }
    ctx.stroke();
  }
  ctx.restore();

  // 上方边界的暗影（森林边缘）
  const shade = ctx.createLinearGradient(0, P(gy0), 0, P(gy0 + 140));
  shade.addColorStop(0, 'rgba(8,5,18,0.85)');
  shade.addColorStop(1, 'rgba(8,5,18,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(gx0, P(gy0), gx1 - gx0, P(140));
  // 下方悬崖边缘高光
  ctx.strokeStyle = 'rgba(160,150,200,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(gx0 + 30, P(gy1));
  ctx.lineTo(gx1 - 30, P(gy1));
  ctx.stroke();

  return { canvas: c, res: RES };
}

function roundedBand(ctx, x, y, w, h, r) {
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
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(r * 0.82, -5);
    ctx.lineTo(r * 0.95, 0);
    ctx.lineTo(r * 0.82, 5);
    if (rnd() < 0.5) { ctx.moveTo(r * 0.86, -8); ctx.lineTo(r * 0.86, 8); }
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const b = ((i + 2) / 6) * Math.PI * 2;
    ctx.moveTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
    ctx.lineTo(Math.cos(b) * r * 0.78, Math.sin(b) * r * 0.78);
  }
  ctx.stroke();
  ctx.restore();
}

function platform(ctx, x, y, r, color, rnd) {
  ctx.save();
  ctx.translate(x, y * YS);
  ctx.scale(1, YS);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, 'rgba(70,62,100,0.9)');
  g.addColorStop(0.85, 'rgba(52,45,78,0.9)');
  g.addColorStop(1, 'rgba(30,25,48,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  // 放射状石砖
  ctx.strokeStyle = 'rgba(12,8,22,0.6)';
  ctx.lineWidth = 2;
  for (const rr of [r * 0.35, r * 0.6, r * 0.85]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + rnd() * 0.05;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35);
    ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
