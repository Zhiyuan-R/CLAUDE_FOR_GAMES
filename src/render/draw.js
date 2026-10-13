// 场景物件与单位的程序化绘制（坐标已经过世界变换：点 (x, y*YS - z)）
// 画风：粗墨线描边 + 赛璐璐二分阴影 + 发光特效，参考手绘动作游戏
import { YS, TEAM_COLORS, FONT } from '../config.js';

const TAU = Math.PI * 2;
export const INK = '#140c20';

// 填充并描墨线
function ink(ctx, fill, w = 2.2, stroke = INK) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (w > 0) {
    ctx.lineWidth = w;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

function inkLine(ctx, x0, y0, x1, y1, color, w, outline = 2) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + outline * 2;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

function glow(ctx, x, y, r, color, a = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, a));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

export function shadow(ctx, x, y, r, a = 0.35) {
  ctx.fillStyle = `rgba(8,3,16,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y * YS, r, r * 0.42, 0, 0, TAU);
  ctx.fill();
}

// ───────────── 场景物件 ─────────────
export function drawProp(ctx, p, t) {
  const x = p.x, gy = p.y * YS;
  switch (p.type) {
    case 'tree': return tree(ctx, x, gy, p.s, p.seed, t);
    case 'stalag': return stalag(ctx, x, gy, p.s, p.seed);
    case 'pillar': return pillar(ctx, x, gy, p.r, p.h, p.broken, p.seed);
    case 'rock': return rock(ctx, x, gy, p.r, p.seed);
    case 'torch': return torch(ctx, x, gy, p.h, t, p.seed);
    case 'shroom': return shroom(ctx, x, gy, p.s, p.hue, t, p.seed);
    case 'crystal': return crystalDecor(ctx, x, gy, t, p.seed);
    case 'fern': return fern(ctx, x, gy, p.s, p.seed, t, p.hue);
  }
}

function tree(ctx, x, gy, s, seed, t) {
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(s * (seed > 0.5 ? 1 : -1), s);
  ctx.fillStyle = 'rgba(8,3,16,0.5)';
  ctx.beginPath(); ctx.ellipse(0, 0, 70, 22, 0, 0, TAU); ctx.fill();
  // 树根与扭曲的树干
  ctx.beginPath();
  ctx.moveTo(-40, 4);
  ctx.quadraticCurveTo(-22, -4, -16, -30);
  ctx.bezierCurveTo(-20, -70, -4, -100, -14, -150);
  ctx.lineTo(14, -150);
  ctx.bezierCurveTo(10, -100, 22, -70, 16, -30);
  ctx.quadraticCurveTo(26, -4, 44, 6);
  ctx.quadraticCurveTo(20, 2, 8, -6);
  ctx.quadraticCurveTo(0, 6, -10, -4);
  ctx.quadraticCurveTo(-20, 4, -40, 4);
  ink(ctx, '#231733', 2.5);
  ctx.beginPath();
  ctx.moveTo(4, -20); ctx.bezierCurveTo(10, -60, 2, -100, 8, -146);
  ctx.strokeStyle = '#3a2a52'; ctx.lineWidth = 4; ctx.stroke();
  // 树冠：多层叶团，下暗上亮
  const sway = Math.sin(t * 0.7 + seed * 10) * 3;
  const blobs = [[-62, -150, 46], [58, -158, 48], [-30, -200, 54], [32, -210, 52], [0, -250, 50], [-55, -228, 34], [60, -236, 32]];
  for (const [bx, by, br] of blobs) {
    const sx = bx + sway * (-by / 250);
    ctx.beginPath(); ctx.arc(sx, by, br, 0, TAU);
    ink(ctx, '#2c1f4a', 3);
  }
  for (const [bx, by, br] of blobs) {
    const sx = bx + sway * (-by / 250);
    ctx.beginPath(); ctx.arc(sx - br * 0.12, by - br * 0.18, br * 0.78, 0, TAU);
    ctx.fillStyle = '#3d2c66'; ctx.fill();
    ctx.beginPath(); ctx.arc(sx - br * 0.25, by - br * 0.35, br * 0.45, 0, TAU);
    ctx.fillStyle = '#54408a'; ctx.fill();
  }
  // 垂挂藤蔓
  ctx.strokeStyle = '#4f7d3a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const vx = -50 + i * 32 + seed * 10;
    ctx.beginPath(); ctx.moveTo(vx, -150 - (i % 2) * 20);
    ctx.quadraticCurveTo(vx + 4 + sway, -125, vx + sway * 1.5, -100 - i * 6);
    ctx.stroke();
  }
  ctx.restore();
}

function stalag(ctx, x, gy, s, seed) {
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(s, s);
  const h = 60 + seed * 40;
  ctx.beginPath(); ctx.moveTo(-28, 6); ctx.lineTo(-8, -h); ctx.lineTo(4, -h * 0.6); ctx.lineTo(10, -h * 0.75); ctx.lineTo(30, 6); ctx.closePath();
  ink(ctx, '#2a2240', 2.5);
  ctx.beginPath(); ctx.moveTo(-26, 4); ctx.lineTo(-8, -h); ctx.lineTo(-4, 4); ctx.closePath();
  ctx.fillStyle = '#3d3358'; ctx.fill();
  ctx.restore();
}

function pillar(ctx, x, gy, r, h, broken, seed) {
  ctx.fillStyle = 'rgba(8,3,16,0.5)';
  ctx.beginPath(); ctx.ellipse(x + 10, gy + 4, r * 1.5, r * 0.6, 0, 0, TAU); ctx.fill();
  // 底座
  ctx.beginPath();
  ctx.moveTo(x - r * 1.3, gy); ctx.lineTo(x - r * 1.3, gy - 18); ctx.lineTo(x + r * 1.3, gy - 18); ctx.lineTo(x + r * 1.3, gy);
  ctx.ellipse(x, gy, r * 1.3, r * 0.5, 0, 0, Math.PI);
  ink(ctx, '#3a3352');
  ctx.beginPath(); ctx.ellipse(x, gy - 18, r * 1.3, r * 0.5, 0, 0, TAU); ink(ctx, '#57507a');
  // 柱身
  const top = gy - h;
  ctx.beginPath();
  ctx.moveTo(x - r, gy - 18);
  ctx.lineTo(x - r * 0.9, top + (broken ? 22 : 0));
  if (broken) { ctx.lineTo(x - r * 0.4, top + 6); ctx.lineTo(x - r * 0.05, top + 26); ctx.lineTo(x + r * 0.5, top); ctx.lineTo(x + r * 0.9, top + 16); }
  else ctx.lineTo(x + r * 0.9, top);
  ctx.lineTo(x + r, gy - 18);
  ctx.closePath();
  ink(ctx, '#4a4268', 2.5);
  // 受光面与阴影面
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#625a8a';
  ctx.fillRect(x - r * 0.75, top, r * 0.5, h);
  ctx.fillStyle = '#2f2848';
  ctx.fillRect(x + r * 0.35, top, r * 0.7, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  for (let k = 1; k < 5; k++) {
    const yy = gy - 18 - k * (h - 18) / 5;
    ctx.beginPath(); ctx.moveTo(x - r, yy); ctx.quadraticCurveTo(x, yy + 5, x + r, yy); ctx.stroke();
  }
  // 苔藓
  ctx.fillStyle = '#4f7d3a';
  ctx.beginPath(); ctx.ellipse(x - r * 0.3, gy - 40 - seed * 30, r * 0.7, 12, 0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#6fa040';
  ctx.beginPath(); ctx.ellipse(x - r * 0.45, gy - 44 - seed * 30, r * 0.35, 5, 0.4, 0, TAU); ctx.fill();
  ctx.restore();
  // 裂缝
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + r * 0.2, top + 30); ctx.lineTo(x - r * 0.1, top + 55); ctx.lineTo(x + r * 0.15, top + 70); ctx.stroke();
  if (!broken) {
    ctx.beginPath();
    ctx.moveTo(x - r * 1.25, top + 2); ctx.lineTo(x - r * 1.25, top - 12); ctx.lineTo(x + r * 1.25, top - 12); ctx.lineTo(x + r * 1.25, top + 2);
    ctx.ellipse(x, top + 2, r * 1.25, r * 0.45, 0, 0, Math.PI);
    ink(ctx, '#4a4268');
    ctx.beginPath(); ctx.ellipse(x, top - 12, r * 1.25, r * 0.45, 0, 0, TAU); ink(ctx, '#6a6292');
  }
}

function rock(ctx, x, gy, r, seed) {
  ctx.fillStyle = 'rgba(8,3,16,0.5)';
  ctx.beginPath(); ctx.ellipse(x + 8, gy + 4, r * 1.3, r * 0.5, 0, 0, TAU); ctx.fill();
  const j = (i) => 0.85 + ((seed * 977 * (i + 3)) % 1) * 0.3;
  ctx.beginPath();
  ctx.moveTo(x - r * 1.2, gy + 4);
  ctx.lineTo(x - r * 1.1 * j(1), gy - r * 0.5);
  ctx.lineTo(x - r * 0.55, gy - r * 1.1 * j(2));
  ctx.lineTo(x + r * 0.2, gy - r * 1.25 * j(3));
  ctx.lineTo(x + r * 0.9, gy - r * 0.8 * j(4));
  ctx.lineTo(x + r * 1.2, gy - r * 0.2);
  ctx.lineTo(x + r * 1.15, gy + 4);
  ctx.closePath();
  ink(ctx, '#3a3254', 2.5);
  // 顶面受光
  ctx.beginPath();
  ctx.moveTo(x - r * 1.05 * j(1), gy - r * 0.48);
  ctx.lineTo(x - r * 0.55, gy - r * 1.1 * j(2));
  ctx.lineTo(x + r * 0.2, gy - r * 1.25 * j(3));
  ctx.lineTo(x + r * 0.85, gy - r * 0.78 * j(4));
  ctx.lineTo(x + r * 0.1, gy - r * 0.45);
  ctx.closePath();
  ink(ctx, '#5b5285', 1.5);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, gy - r * 1.0 * j(2));
  ctx.lineTo(x + r * 0.15, gy - r * 1.15 * j(3));
  ctx.lineTo(x - r * 0.1, gy - r * 0.7);
  ctx.closePath();
  ctx.fillStyle = '#7468a8'; ctx.fill();
  // 苔藓
  ctx.fillStyle = '#4f7d3a';
  ctx.beginPath(); ctx.ellipse(x + r * 0.5, gy - r * 0.7, r * 0.35, r * 0.15, -0.5, 0, TAU); ctx.fill();
}

function torch(ctx, x, gy, h, t, seed) {
  shadow(ctx, x, gy / YS, 16, 0.45);
  // 铁架
  ctx.beginPath(); ctx.rect(x - 3.5, gy - h, 7, h); ink(ctx, '#2e2440', 2);
  ctx.beginPath(); ctx.moveTo(x - 10, gy); ctx.lineTo(x, gy - 18); ctx.lineTo(x + 10, gy); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 15, gy - h - 2); ctx.lineTo(x + 15, gy - h - 2); ctx.lineTo(x + 8, gy - h + 12); ctx.lineTo(x - 8, gy - h + 12); ctx.closePath();
  ink(ctx, '#4a3c5e', 2);
  ctx.fillStyle = '#ff9a40';
  ctx.fillRect(x - 12, gy - h - 2, 24, 3);
  const fl = Math.sin(t * 13 + seed * 20) * 2 + Math.sin(t * 7.3 + seed * 5) * 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, gy - h - 16, 80, '#ff8a30', 0.4);
  ctx.restore();
  flame(ctx, x, gy - h, 13, 34 + fl, '#ff5a1a', true);
  flame(ctx, x + Math.sin(t * 9) * 1.5, gy - h, 8, 24 + fl * 0.7, '#ffb347');
  flame(ctx, x, gy - h, 4, 13 + fl * 0.4, '#fff3c4');
}

export function flame(ctx, x, y, w, h, color, outline = false) {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.bezierCurveTo(x - w * 1.1, y - h * 0.45, x - w * 0.2, y - h * 0.6, x + w * 0.15, y - h);
  ctx.bezierCurveTo(x + w * 0.3, y - h * 0.65, x + w * 1.1, y - h * 0.45, x + w, y);
  ctx.closePath();
  if (outline) ink(ctx, color, 2);
  else { ctx.fillStyle = color; ctx.fill(); }
}

function shroom(ctx, x, gy, s, hue, t, seed) {
  const c = hue === 'teal' ? ['#3fe0c8', '#9ffff0'] : ['#ff6fb5', '#ffc2e2'];
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(s, s);
  for (const [ox, sc] of [[-9, 0.7], [0, 1], [8, 0.6]]) {
    ctx.save();
    ctx.translate(ox, 0);
    ctx.scale(sc, sc);
    ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(-4, -10, -2, -16); ctx.lineTo(2, -16); ctx.quadraticCurveTo(4, -10, 3, 0); ctx.closePath();
    ink(ctx, '#e8def6', 1.8);
    ctx.beginPath(); ctx.ellipse(0, -16, 12, 8, 0, Math.PI, 0); ctx.closePath();
    ink(ctx, c[0], 2);
    ctx.fillStyle = c[1];
    ctx.beginPath(); ctx.arc(-4, -19, 1.8, 0, TAU); ctx.arc(3, -21, 1.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 0, -14, 30, c[0], 0.3 + Math.sin(t * 2 + seed * 10) * 0.1);
  ctx.restore();
}

function fern(ctx, x, gy, s, seed, t, hue) {
  const cols = hue === 'green' ? ['#3d6b34', '#5c9a45'] : ['#3b2a63', '#5d46a0'];
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(s, s);
  const sway = Math.sin(t * 1.3 + seed * 20) * 0.06;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.38 + sway;
    const len = 26 + ((seed * 31 * (i + 1)) % 1) * 14;
    ctx.save();
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-7, -len * 0.5, 0, -len);
    ctx.quadraticCurveTo(7, -len * 0.5, 0, 0);
    ink(ctx, cols[i % 2], 1.6);
    ctx.restore();
  }
  ctx.restore();
}

function crystalDecor(ctx, x, gy, t, seed) {
  shadow(ctx, x, gy / YS, 20, 0.4);
  ctx.beginPath(); ctx.moveTo(x - 16, gy); ctx.lineTo(x - 8, gy - 8); ctx.lineTo(x + 10, gy - 6); ctx.lineTo(x + 16, gy); ctx.closePath();
  ink(ctx, '#3a3254', 2);
  const bob = Math.sin(t * 1.6 + seed * 6) * 3;
  const cy = gy - 30 + bob;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, cy, 40, '#9d86ff', 0.35);
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(x, cy - 24); ctx.lineTo(x + 10, cy); ctx.lineTo(x, cy + 14); ctx.lineTo(x - 10, cy); ctx.closePath();
  ink(ctx, '#6a52c8', 2);
  ctx.beginPath(); ctx.moveTo(x, cy - 24); ctx.lineTo(x + 10, cy); ctx.lineTo(x, cy); ctx.closePath();
  ctx.fillStyle = '#b5a2ff'; ctx.fill();
}

// ───────────── 英雄 ─────────────
const HERO_SCALE = 1.3;

export function drawHero(ctx, h, t, ghost = null) {
  const d = h.def;
  const src = ghost || h;
  const x = src.x, base = src.y * YS - src.z;
  const fx = ghost ? ghost.fx : h.facing.x, fy = ghost ? ghost.fy : h.facing.y;
  const side = fx >= 0 ? 1 : -1;
  const back = fy < -0.5;
  const moving = !ghost && h.speedNow > 20;
  const walk = h.walkT * 2;
  const bob = moving ? Math.abs(Math.sin(walk)) * 2.2 : Math.sin(t * 2.4) * 0.7;
  const white = !ghost && h.flash > 0;
  const W = '#ffffff';
  const pal = white
    ? { cloak: W, cloakD: W, body: W, bodyL: W, hood: W, hoodD: W, skin: W, boot: W, trim: W, metal: W, line: 2.2 }
    : { cloak: d.color, cloakD: d.colorD, body: d.body, bodyL: d.bodyL, hood: d.hood, hoodD: d.hoodD, skin: '#f0c9a0', boot: '#2a1d2e', trim: d.color2, metal: '#9aa2bd', line: 2.2 };
  if (ghost) {
    for (const k in pal) if (k !== 'line') pal[k] = d.color2;
    pal.line = 0;
  }

  ctx.save();
  if (ghost) {
    ctx.globalAlpha = (ghost.life / ghost.max) * 0.4;
    ctx.globalCompositeOperation = 'lighter';
  } else if (h.invuln > 0 && h.state !== 'dash' && Math.floor(t * 16) % 2 === 0) {
    ctx.globalAlpha = 0.55;
  }

  const S = HERO_SCALE;
  const ang = Math.atan2(fy * YS, fx);
  const shoulder = { x: x + side * 3 * S, y: base - (31 + bob) * S };
  if (!ghost && back) drawArmWeapon(ctx, h, shoulder, ang, t, pal, S);

  ctx.translate(x, base);
  ctx.scale(side * S, S);

  // 腿：以髋部为轴摆动
  const swing = moving ? Math.sin(walk) * 0.55 : 0;
  leg(ctx, -2, -15, swing, pal, true);
  ctx.translate(0, -bob);

  // 披风 / 长袍下摆
  const f = moving ? 6 + Math.sin(walk * 1.5) * 3 : 2 + Math.sin(t * 2) * 1.5;
  ctx.beginPath();
  ctx.moveTo(6, -37);
  ctx.quadraticCurveTo(-4, -41, -9, -35);
  ctx.bezierCurveTo(-15 - f * 0.4, -26, -18 - f, -14, -21 - f * 1.2, -3 + f * 0.25);
  ctx.lineTo(-15 - f, -6);
  ctx.lineTo(-11 - f * 0.6, -1);
  ctx.lineTo(-5, -5);
  ctx.lineTo(2, -10);
  ctx.closePath();
  ink(ctx, pal.cloak, pal.line);
  if (!white && !ghost) {
    ctx.beginPath();
    ctx.moveTo(-8, -33);
    ctx.bezierCurveTo(-12 - f * 0.4, -24, -14 - f * 0.8, -14, -15 - f, -6);
    ctx.lineTo(-11 - f * 0.6, -1);
    ctx.quadraticCurveTo(-8, -18, -8, -33);
    ctx.fillStyle = pal.cloakD; ctx.fill();
  }

  leg(ctx, 3, -15, -swing, pal, false);

  // 躯干
  if (d.id === 'storm') {
    ctx.beginPath();
    ctx.moveTo(-7, -38); ctx.lineTo(7, -38);
    ctx.quadraticCurveTo(10, -22, 13, -3);
    ctx.quadraticCurveTo(0, 1, -11, -3);
    ctx.quadraticCurveTo(-9, -22, -7, -38);
    ink(ctx, pal.body, pal.line);
    if (!white && !ghost) {
      ctx.beginPath(); ctx.moveTo(-5, -36); ctx.quadraticCurveTo(-7, -20, -8, -4); ctx.lineTo(-3, -3); ctx.quadraticCurveTo(-2, -20, -1, -36); ctx.closePath();
      ctx.fillStyle = pal.bodyL; ctx.fill();
      ctx.strokeStyle = pal.trim; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-10, -5); ctx.quadraticCurveTo(0, -2, 12, -5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, -36); ctx.lineTo(4, -4); ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(-7, -38); ctx.lineTo(7, -38);
    ctx.quadraticCurveTo(10, -26, 8, -13);
    ctx.lineTo(-7, -13);
    ctx.quadraticCurveTo(-9, -26, -7, -38);
    ink(ctx, pal.body, pal.line);
    if (!white && !ghost) {
      ctx.beginPath(); ctx.moveTo(-5, -36); ctx.quadraticCurveTo(-7, -26, -5, -16); ctx.lineTo(-1, -16); ctx.quadraticCurveTo(-2, -26, -1, -36); ctx.closePath();
      ctx.fillStyle = pal.bodyL; ctx.fill();
    }
  }
  // 腰带
  if (d.id !== 'storm') {
    ctx.beginPath(); ctx.rect(-8, -21, 17, 4); ink(ctx, white || ghost ? pal.body : '#5a3a26', pal.line ? 1.6 : 0);
    if (!white && !ghost) { ctx.fillStyle = '#e8b84a'; ctx.fillRect(3, -20.5, 3.5, 3); }
  }
  // 肩甲 / 箭袋
  if (d.id === 'ember') {
    ctx.beginPath(); ctx.ellipse(-1, -36, 8, 5, -0.2, 0, TAU); ink(ctx, pal.metal, pal.line);
    if (!white && !ghost) { ctx.fillStyle = '#d7dcef'; ctx.beginPath(); ctx.ellipse(-3, -38, 4, 2, -0.2, 0, TAU); ctx.fill(); }
  } else if (d.id === 'frost') {
    ctx.save();
    ctx.translate(-8, -30);
    ctx.rotate(-0.5);
    ctx.beginPath(); ctx.rect(-3.5, -12, 7, 22); ink(ctx, white || ghost ? pal.body : '#6b4a2e', pal.line ? 1.8 : 0);
    if (!white && !ghost) {
      ctx.fillStyle = '#e6fbff';
      for (const ox of [-2, 1.5]) { ctx.beginPath(); ctx.moveTo(ox, -12); ctx.lineTo(ox - 2, -18); ctx.lineTo(ox + 2, -18); ctx.closePath(); ctx.fill(); }
    }
    ctx.restore();
  }

  // 头部
  head(ctx, d, pal, back, t, white || ghost);
  ctx.restore();

  if (!ghost && !back) drawArmWeapon(ctx, h, shoulder, ang, t, pal, S);
}

function leg(ctx, hx, hy, rot, pal, isBack) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.lineTo(3.2, 12); ctx.lineTo(7, 13); ctx.quadraticCurveTo(8, 15.5, 6, 16); ctx.lineTo(-3.5, 16); ctx.closePath();
  ink(ctx, isBack && pal.line ? shade(pal.boot) : pal.boot, pal.line ? 1.8 : 0);
  ctx.restore();
}

function head(ctx, d, pal, back, t, flat) {
  const hy = -50;
  if (d.id === 'storm') {
    // 宽檐尖帽
    ctx.beginPath(); ctx.arc(0, hy, 10.5, 0, TAU); ink(ctx, pal.hood, pal.line);
    if (!back) {
      ctx.beginPath(); ctx.ellipse(4, hy + 1, 6.5, 7.5, 0, 0, TAU); ink(ctx, pal.skin, pal.line ? 1.6 : 0);
      if (!flat) {
        ctx.fillStyle = '#d9d2f0';
        ctx.beginPath(); ctx.moveTo(1, hy + 5); ctx.quadraticCurveTo(5, hy + 16, 9, hy + 5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    ctx.beginPath(); ctx.ellipse(0, hy - 6, 19, 5, -0.08, 0, TAU); ink(ctx, pal.hoodD, pal.line);
    ctx.beginPath(); ctx.moveTo(-10, hy - 7); ctx.quadraticCurveTo(-6, hy - 26, -14, hy - 40); ctx.quadraticCurveTo(2, hy - 26, 10, hy - 8); ctx.closePath();
    ink(ctx, pal.hood, pal.line);
    if (!flat) {
      ctx.beginPath(); ctx.moveTo(-9, hy - 10); ctx.quadraticCurveTo(0, hy - 13, 9.5, hy - 10); ctx.lineTo(9, hy - 13); ctx.quadraticCurveTo(0, hy - 16, -8, hy - 13); ctx.closePath();
      ctx.fillStyle = pal.trim; ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, -14, hy - 40, 7, d.color2, 0.8); ctx.restore();
    }
    if (!back && !flat) { ctx.fillStyle = INK; ctx.fillRect(6, hy - 1, 2.2, 2.6); }
    return;
  }
  // 兜帽（剑士带尖角，游侠带毛边）
  ctx.beginPath();
  ctx.moveTo(-10, hy + 6);
  ctx.quadraticCurveTo(-14, hy - 10, -2, hy - 13);
  if (d.id === 'ember') { ctx.lineTo(-10, hy - 20); ctx.lineTo(3, hy - 12.5); }
  ctx.quadraticCurveTo(13, hy - 10, 11, hy + 3);
  ctx.quadraticCurveTo(12, hy + 9, 6, hy + 11);
  ctx.lineTo(-6, hy + 11);
  ctx.closePath();
  ink(ctx, pal.hood, pal.line);
  if (!back) {
    ctx.beginPath(); ctx.ellipse(5, hy + 1, 5.8, 7, 0, 0, TAU); ink(ctx, pal.skin, pal.line ? 1.6 : 0);
    if (!flat) {
      // 兜帽阴影压在额头
      ctx.beginPath(); ctx.ellipse(5, hy - 4, 6.5, 3.5, 0, 0, Math.PI); ctx.fillStyle = 'rgba(20,10,30,0.45)'; ctx.fill();
      ctx.fillStyle = d.color2;
      ctx.beginPath(); ctx.ellipse(8, hy, 1.6, 2.2, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 8, hy, 5, d.color2, 0.7); ctx.restore();
    }
  }
  if (!flat) {
    ctx.beginPath(); ctx.moveTo(-8, hy + 2); ctx.quadraticCurveTo(-10, hy - 8, -2, hy - 11); ctx.quadraticCurveTo(-7, hy - 6, -6, hy + 4); ctx.closePath();
    ctx.fillStyle = pal.hoodD; ctx.fill();
  }
  if (d.id === 'frost' && !flat) {
    ctx.strokeStyle = INK; ctx.lineWidth = 6.5;
    ctx.beginPath(); ctx.arc(4, hy + 1, 9, -1.4, 1.6); ctx.stroke();
    ctx.strokeStyle = '#eef8ff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(4, hy + 1, 9, -1.4, 1.6); ctx.stroke();
  }
}

function drawArmWeapon(ctx, h, sh, ang, t, pal, S) {
  const d = h.def;
  let a = ang;
  let reach = 1;
  if (h.swing) {
    const k = h.swing.t / h.swing.dur;
    if (d.weapon === 'sword') {
      const dir = h.swing.i === 1 ? -1 : 1;
      if (h.swing.i === 3) a = ang + k * Math.PI * 2;
      else a = ang + dir * (-1.4 + 2.8 * Math.min(1, k * 1.8));
    } else {
      reach = 1 - Math.sin(Math.min(1, k * 2) * Math.PI) * 0.3;
    }
  }
  const charging = h.state === 'charging';
  const cr = charging ? Math.min(1, h.chargeT / d.charged.maxTime) : 0;
  const full = cr >= 1;
  const ca = Math.cos(a), sa = Math.sin(a);
  const hx = sh.x + ca * 11 * S * reach, hy = sh.y + sa * 11 * S * reach;
  const line = pal.line;
  ctx.save();
  ctx.lineCap = 'round';
  inkLine(ctx, sh.x, sh.y, hx, hy, pal.body, 5 * S, line ? 1.6 : 0);

  if (d.weapon === 'sword') {
    const len = 40 * S;
    const tx = hx + ca * len, ty = hy + sa * len;
    const px = -sa, py = ca;
    if (charging || h.buffs.flame > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = full ? 'rgba(255,230,140,0.9)' : `rgba(255,120,40,${0.35 + cr * 0.4})`;
      ctx.lineWidth = 10 + cr * 6;
      ctx.beginPath(); ctx.moveTo(hx + ca * 8, hy + sa * 8); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.restore();
    }
    // 剑刃
    ctx.beginPath();
    ctx.moveTo(hx + ca * 6 + px * 3.4, hy + sa * 6 + py * 3.4);
    ctx.lineTo(tx - ca * 6 + px * 2.6, ty - sa * 6 + py * 2.6);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx - ca * 6 - px * 2.6, ty - sa * 6 - py * 2.6);
    ctx.lineTo(hx + ca * 6 - px * 3.4, hy + sa * 6 - py * 3.4);
    ctx.closePath();
    ink(ctx, pal.metal === '#ffffff' ? '#fff' : '#dfe5f5', line ? 2 : 0);
    ctx.strokeStyle = d.color2;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(hx + ca * 9, hy + sa * 9); ctx.lineTo(tx - ca * 9, ty - sa * 9); ctx.stroke();
    // 护手与剑柄
    inkLine(ctx, hx + px * 8, hy + py * 8, hx - px * 8, hy - py * 8, '#d9a63e', 3.5, 1.5);
    inkLine(ctx, hx - ca * 7, hy - sa * 7, hx + ca * 2, hy + sa * 2, '#5a3a26', 3.5, 1.5);
  } else if (d.weapon === 'staff') {
    // 法杖斜持：下端靠地，上端顶着发光晶石
    const topX = hx + ca * 14 * S * reach + 2, topY = hy + sa * 8 - 24 * S;
    const botX = hx - ca * 10 - 4, botY = hy + 26 * S;
    inkLine(ctx, botX, botY, topX, topY, '#6b4a33', 3.2, 1.6);
    const pulse = 1 + Math.sin(t * 6) * 0.12;
    const r = (6 + cr * 5) * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, topX, topY - 4, r * 4.5, d.color2, 0.55 + cr * 0.3);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(topX, topY - 4 - r * 1.4); ctx.lineTo(topX + r * 0.8, topY - 4); ctx.lineTo(topX, topY - 4 + r * 1.1); ctx.lineTo(topX - r * 0.8, topY - 4); ctx.closePath();
    ink(ctx, line ? '#c8b4ff' : pal.body, line ? 1.8 : 0);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(topX, topY - 4 - r * 1.4); ctx.lineTo(topX + r * 0.8, topY - 4); ctx.lineTo(topX, topY - 4); ctx.closePath(); ctx.fill();
    // 法杖上的托爪
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(topX, topY - 3, r * 1.2, 0.2, Math.PI - 0.2); ctx.stroke();
  } else {
    const bx = hx + ca * 4, by = hy + sa * 4;
    const px = -sa, py = ca;
    const R = 20 * S;
    const pull = charging ? cr * 11 : h.swing ? 7 * reach : 0;
    ctx.beginPath();
    ctx.moveTo(bx + px * R, by + py * R);
    ctx.quadraticCurveTo(bx + ca * 16, by + sa * 16, bx - px * R, by - py * R);
    ctx.strokeStyle = INK; ctx.lineWidth = line ? 6.5 : 3; ctx.stroke();
    ctx.strokeStyle = '#8a6040'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.strokeStyle = '#bff0ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx + px * R * 0.98, by + py * R * 0.98); ctx.lineTo(bx + px * R * 0.6 + ca * 9, by + py * R * 0.6 + sa * 9); ctx.stroke();
    const sx = bx - ca * pull, sy = by - sa * pull;
    ctx.strokeStyle = 'rgba(235,245,255,0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(bx + px * R, by + py * R); ctx.lineTo(sx, sy); ctx.lineTo(bx - px * R, by - py * R); ctx.stroke();
    if (charging || h.swing) {
      inkLine(ctx, sx, sy, bx + ca * 20, by + sa * 20, '#e6fbff', 2, 1);
      if (charging) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glow(ctx, bx + ca * 20, by + sa * 20, 10 + cr * 14, '#8fe3ff', 0.4 + cr * 0.4);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.7));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ───────────── 小兵：哥布林小鬼 ─────────────
export function drawMinion(ctx, m, t) {
  const x = m.x, gy = m.y * YS;
  const moving = Math.hypot(m.vx, m.vy) > 5;
  const bob = moving ? Math.abs(Math.sin(m.phase * 9)) * 3 : Math.sin(m.phase * 3) * 0.6;
  const tc = TEAM_COLORS[m.team];
  const white = m.flash > 0;
  const lunge = m.windup > 0 ? (1 - m.windup / 0.28) * 7 : 0;
  const skin = white ? '#fff' : '#6d5a9a', skinD = white ? '#fff' : '#4a3a70';
  ctx.save();
  ctx.translate(x + m.face * lunge, gy);
  ctx.scale(m.face * 1.1, 1.1);
  // 脚
  const st = moving ? Math.sin(m.phase * 9) * 3 : 0;
  ctx.beginPath(); ctx.ellipse(-4 + st, -2, 4.5, 3, 0, 0, TAU); ink(ctx, skinD, 1.6);
  ctx.beginPath(); ctx.ellipse(5 - st, -2, 4.5, 3, 0, 0, TAU); ink(ctx, skinD, 1.6);
  ctx.translate(0, -bob);
  // 身体
  ctx.beginPath(); ctx.ellipse(0, -12, 10, 10, 0, 0, TAU); ink(ctx, skin, 2);
  ctx.beginPath(); ctx.ellipse(2, -9, 6, 6, 0, 0, TAU); ctx.fillStyle = white ? '#fff' : '#8a77b8'; ctx.fill();
  // 队伍围巾
  ctx.beginPath(); ctx.moveTo(-9, -19); ctx.quadraticCurveTo(0, -15, 9, -19); ctx.lineTo(9, -15); ctx.quadraticCurveTo(0, -11, -9, -15); ctx.closePath();
  ink(ctx, white ? '#fff' : tc, 1.5);
  ctx.beginPath(); ctx.moveTo(-8, -17); ctx.lineTo(-15, -12 + Math.sin(m.phase * 8) * 2); ctx.lineTo(-13, -9); ctx.closePath(); ink(ctx, white ? '#fff' : tc, 1.5);
  // 大脑袋 + 长耳朵
  ctx.beginPath(); ctx.moveTo(-6, -28); ctx.lineTo(-20, -34); ctx.lineTo(-5, -23); ctx.closePath(); ink(ctx, skin, 1.8);
  ctx.beginPath(); ctx.moveTo(6, -29); ctx.lineTo(15, -40); ctx.lineTo(10, -24); ctx.closePath(); ink(ctx, skin, 1.8);
  ctx.beginPath(); ctx.ellipse(1, -27, 10.5, 9, 0, 0, TAU); ink(ctx, skin, 2);
  ctx.beginPath(); ctx.ellipse(-2, -31, 6, 3.5, 0, 0, TAU); ctx.fillStyle = white ? '#fff' : '#8a77b8'; ctx.fill();
  // 发光的眼睛
  if (!white) {
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(6, -27, 3.6, 3.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = tc;
    ctx.beginPath(); ctx.arc(6.5, -27, 2.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(7.2, -27.8, 0.8, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(3, -21.5); ctx.lineTo(10, -22.5); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(5, -22); ctx.lineTo(6, -19.8); ctx.lineTo(7, -22.2); ctx.closePath(); ctx.fill();
  }
  // 小砍刀
  const raise = m.windup > 0 ? -0.9 : 0.3;
  ctx.save();
  ctx.translate(9, -13);
  ctx.rotate(raise);
  inkLine(ctx, 0, 0, 0, -6, '#5a3a26', 2.2, 1.2);
  ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(4, -6); ctx.lineTo(5, -17); ctx.quadraticCurveTo(0, -18, -3, -14); ctx.closePath();
  ink(ctx, white ? '#fff' : '#cfd5e6', 1.5);
  ctx.restore();
  ctx.beginPath(); ctx.arc(9, -13, 3, 0, TAU); ink(ctx, skin, 1.5);
  ctx.restore();
}

// ───────────── 防御塔 / 基地 ─────────────
export function drawTower(ctx, tw, t) {
  const x = tw.x, gy = tw.y * YS;
  const core = tw.kind === 'core';
  const tc = TEAM_COLORS[tw.team];
  const r = tw.radius;
  ctx.save();
  if (!tw.alive) {
    ctx.beginPath(); ctx.ellipse(x, gy, r * 1.3, r * 0.55, 0, 0, TAU); ink(ctx, '#2c2540');
    for (let i = 0; i < 8; i++) {
      const a = i * 0.8 + 0.3;
      const rx = x + Math.cos(a) * r * 0.8, ry = gy + Math.sin(a) * r * 0.35 - 4;
      ctx.beginPath(); ctx.moveTo(rx - 10, ry + 4); ctx.lineTo(rx - 6, ry - 8 - (i % 3) * 4); ctx.lineTo(rx + 8, ry - 5); ctx.lineTo(rx + 10, ry + 4); ctx.closePath();
      ink(ctx, i % 2 ? '#4a4268' : '#3a3352', 2);
    }
    ctx.restore();
    return;
  }
  const white = tw.flash > 0;
  const C = (c) => (white ? '#ffffff' : c);
  // 阶梯底座
  for (const [rr, hh, col, top] of [[r * 1.45, 10, '#332c4a', '#4a4268'], [r * 1.15, 22, '#3a3352', '#5a5280']]) {
    ctx.beginPath();
    ctx.moveTo(x - rr, gy - hh + 10); ctx.lineTo(x - rr, gy - hh); ctx.lineTo(x + rr, gy - hh); ctx.lineTo(x + rr, gy - hh + 10);
    ctx.ellipse(x, gy - hh + 10, rr, rr * 0.42, 0, 0, Math.PI);
    ink(ctx, C(col), 2.5);
    ctx.beginPath(); ctx.ellipse(x, gy - hh, rr, rr * 0.42, 0, 0, TAU); ink(ctx, C(top), 2.5);
  }
  // 塔身
  const h = tw.height - 44;
  const bY = gy - 22;
  const w0 = core ? r * 0.78 : r * 0.62, w1 = core ? r * 0.5 : r * 0.42;
  ctx.beginPath();
  ctx.moveTo(x - w0, bY); ctx.lineTo(x - w1, gy - h); ctx.lineTo(x + w1, gy - h); ctx.lineTo(x + w0, bY);
  ctx.closePath();
  ink(ctx, C('#4a4268'), 2.8);
  if (!white) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#655c92';
    ctx.beginPath(); ctx.moveTo(x - w0, bY); ctx.lineTo(x - w1, gy - h); ctx.lineTo(x - w1 * 0.3, gy - h); ctx.lineTo(x - w0 * 0.35, bY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2e2846';
    ctx.beginPath(); ctx.moveTo(x + w0 * 0.45, bY); ctx.lineTo(x + w1 * 0.45, gy - h); ctx.lineTo(x + w1, gy - h); ctx.lineTo(x + w0, bY); ctx.closePath(); ctx.fill();
    // 砖缝
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    const rows = 6;
    for (let k = 1; k < rows; k++) {
      const yy = bY - (k * (bY - (gy - h))) / rows;
      const ww = w0 + (w1 - w0) * (k / rows);
      ctx.beginPath(); ctx.moveTo(x - ww, yy); ctx.quadraticCurveTo(x, yy + 4, x + ww, yy); ctx.stroke();
      const off = k % 2 ? -0.35 : 0.3;
      const yy2 = bY - ((k - 1) * (bY - (gy - h))) / rows;
      ctx.beginPath(); ctx.moveTo(x + ww * off, yy + 2); ctx.lineTo(x + ww * off, yy2 + 2); ctx.stroke();
    }
    ctx.restore();
    // 发光符文
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.6 + Math.sin(t * 3 + tw.id) * 0.25;
    ctx.strokeStyle = hexA(tc, pulse);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, bY - 8); ctx.lineTo(x, gy - h + 10);
    ctx.moveTo(x - 6, bY - 30); ctx.lineTo(x, bY - 36); ctx.lineTo(x + 6, bY - 30);
    ctx.moveTo(x - 5, gy - h + 34); ctx.lineTo(x, gy - h + 28); ctx.lineTo(x + 5, gy - h + 34);
    ctx.stroke();
    ctx.restore();
  }
  // 塔冠：四根尖爪托着水晶
  const capY = gy - h;
  ctx.beginPath(); ctx.ellipse(x, capY, w1 * 1.9, w1 * 0.75, 0, 0, TAU); ink(ctx, C('#5a5280'), 2.5);
  for (const sx of [-1, -0.4, 0.4, 1]) {
    const bx = x + sx * w1 * 1.5;
    ctx.beginPath(); ctx.moveTo(bx - 4, capY); ctx.quadraticCurveTo(bx + sx * 6, capY - 16, bx - sx * 2, capY - 28); ctx.lineTo(bx + 4, capY);
    ctx.closePath();
    ink(ctx, C('#4a4268'), 2);
  }
  // 漂浮水晶
  const bob = Math.sin(t * 2 + tw.id) * 4;
  const cy = capY - (core ? 46 : 34) + bob;
  const cs = core ? 26 : 17;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, cy, cs * 4.5, tc, 0.5);
  ctx.restore();
  gem(ctx, x, cy, cs, tc, white);
  if (core) {
    for (let i = 0; i < 3; i++) {
      const a = t * 1.2 + (i * TAU) / 3;
      const sx = x + Math.cos(a) * 44, sy = cy + Math.sin(a) * 14;
      if (Math.sin(a) < 0) continue;
      gem(ctx, sx, sy, 8, tc, white);
    }
  }
  // 符文环
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = hexA(tc, 0.55);
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.lineDashOffset = -t * 20;
  ctx.beginPath(); ctx.ellipse(x, cy + 4, cs * 1.8, cs * 0.5, 0, 0, TAU); ctx.stroke();
  ctx.restore();
  if (core) {
    for (let i = 0; i < 3; i++) {
      const a = t * 1.2 + (i * TAU) / 3;
      if (Math.sin(a) >= 0) continue;
      gem(ctx, x + Math.cos(a) * 44, cy + Math.sin(a) * 14, 8, tc, white);
    }
  }
  if (tw.isInvulnerable()) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(tc, 0.3 + Math.sin(t * 3) * 0.1);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, gy - h * 0.6, r * 1.4, h * 0.85, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = hexA(tc, 0.06);
    ctx.fill();
  }
  ctx.restore();
}

function gem(ctx, x, cy, cs, tc, white) {
  ctx.beginPath();
  ctx.moveTo(x, cy - cs * 1.5); ctx.lineTo(x + cs * 0.75, cy - cs * 0.2); ctx.lineTo(x + cs * 0.45, cy + cs); ctx.lineTo(x - cs * 0.45, cy + cs); ctx.lineTo(x - cs * 0.75, cy - cs * 0.2); ctx.closePath();
  ink(ctx, white ? '#fff' : tc, 2.5);
  if (white) return;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.moveTo(x, cy - cs * 1.5); ctx.lineTo(x - cs * 0.75, cy - cs * 0.2); ctx.lineTo(x - cs * 0.2, cy - cs * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(10,5,30,0.35)';
  ctx.beginPath(); ctx.moveTo(x, cy - cs * 1.5); ctx.lineTo(x + cs * 0.75, cy - cs * 0.2); ctx.lineTo(x + cs * 0.45, cy + cs); ctx.lineTo(x + cs * 0.1, cy - cs * 0.1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - cs * 0.2, cy - cs * 0.1); ctx.lineTo(x - cs * 0.1, cy + cs * 0.95); ctx.stroke();
}

// ───────────── 飞行道具 ─────────────
export function drawProjectile(ctx, p, t = 0) {
  const x = p.x, y = p.y * YS - p.z;
  ctx.fillStyle = 'rgba(8,3,16,0.3)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y * YS, 8, 3.2, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.lineCap = 'round';
  if (p.kind === 'arrow' || p.kind === 'shard') {
    const a = Math.atan2(p.vy * YS, p.vx);
    const big = p.kind === 'shard';
    const len = big ? 30 : 24;
    const ca = Math.cos(a), sa = Math.sin(a);
    const tx = x - ca * len, ty = y - sa * len;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(tx - ca * 40, ty - sa * 40, x, y);
    g.addColorStop(0, 'rgba(143,227,255,0)');
    g.addColorStop(1, 'rgba(143,227,255,0.7)');
    ctx.strokeStyle = g;
    ctx.lineWidth = big ? 10 : 6;
    ctx.beginPath(); ctx.moveTo(tx - ca * 40, ty - sa * 40); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    inkLine(ctx, tx, ty, x - ca * 6, y - sa * 6, '#e6fbff', big ? 3 : 2.2, 1.2);
    // 冰晶箭头
    ctx.beginPath();
    ctx.moveTo(x + ca * (big ? 11 : 8), y + sa * (big ? 11 : 8));
    ctx.lineTo(x - ca * 4 - sa * (big ? 6 : 4.5), y - sa * 4 + ca * (big ? 6 : 4.5));
    ctx.lineTo(x - ca * 1, y - sa * 1);
    ctx.lineTo(x - ca * 4 + sa * (big ? 6 : 4.5), y - sa * 4 - ca * (big ? 6 : 4.5));
    ctx.closePath();
    ink(ctx, '#bff0ff', 1.5);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, big ? 18 : 12, '#8fe3ff', 0.5);
  } else {
    const r = p.radius;
    ctx.globalCompositeOperation = 'lighter';
    p.trail.forEach((q, i) => {
      const k = (i + 1) / p.trail.length;
      ctx.fillStyle = hexA(p.color, 0.3 * k);
      ctx.beginPath(); ctx.arc(q.x, q.y * YS - q.z, r * k * 0.9, 0, TAU); ctx.fill();
    });
    glow(ctx, x, y, r * 3.2, p.color, 0.65);
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, TAU);
    ink(ctx, '#ffffff', 2, hexA(p.color, 1));
    // 环绕的小光点
    ctx.globalCompositeOperation = 'lighter';
    const tt = performance.now() / 1000;
    for (let i = 0; i < 2; i++) {
      const a = tt * 12 + i * Math.PI;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 0.6, 1.8, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// ───────────── 区域效果（画在地面层） ─────────────
export function drawZone(ctx, z, t, viewerTeam) {
  const x = z.x, gy = z.y * YS, r = z.radius;
  const fade = Math.min(1, z.life / 0.4, z.age / 0.15);
  ctx.save();
  ctx.globalAlpha = fade;
  if (z.kind === 'fire') {
    ctx.fillStyle = 'rgba(30,8,4,0.35)';
    ctx.beginPath(); ctx.ellipse(x, gy, r * 0.9, r * 0.9 * YS, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, gy, 0, x, gy, r);
    g.addColorStop(0, 'rgba(255,150,50,0.6)');
    g.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, gy, r, r * YS, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 3; i++) {
      const ox = Math.sin(t * 3 + i * 2 + z.x) * r * 0.45;
      const hh = 16 + Math.sin(t * 12 + i * 3) * 5;
      flame(ctx, x + ox, gy + (i - 1) * 5, 7, hh, '#ff5a1a', true);
      flame(ctx, x + ox, gy + (i - 1) * 5, 4, hh * 0.6, '#ffd36b');
    }
  } else if (z.kind === 'flameAura') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, gy);
    ctx.scale(1, YS);
    const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r);
    g.addColorStop(0, 'rgba(255,100,30,0)');
    g.addColorStop(0.8, 'rgba(255,120,40,0.4)');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = t * 7 + (i * TAU) / 4;
      ctx.strokeStyle = i % 2 ? 'rgba(255,210,110,0.9)' : 'rgba(255,120,40,0.9)';
      ctx.lineWidth = 7 - i;
      ctx.beginPath(); ctx.arc(0, 0, r * (0.75 + i * 0.06), a, a + 1.3); ctx.stroke();
    }
  } else if (z.kind === 'storm') {
    ctx.translate(x, gy);
    ctx.scale(1, YS);
    ctx.fillStyle = 'rgba(40,20,110,0.28)';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(190,160,255,0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 10]);
    ctx.lineDashOffset = -t * 70;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(190,160,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(0, 0, r * (0.3 + i * 0.2), -t * (2 + i), -t * (2 + i) + 3.5); ctx.stroke();
    }
  } else if (z.kind === 'trap') {
    const mine = z.team === viewerTeam;
    const armed = z.age >= 0.6;
    ctx.globalAlpha = fade * (mine ? 1 : 0.4);
    ctx.translate(x, gy);
    ctx.scale(1, YS);
    ctx.fillStyle = 'rgba(20,40,60,0.4)';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.stroke();
    ctx.strokeStyle = armed ? '#8fe3ff' : 'rgba(143,227,255,0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.stroke();
    ctx.rotate(t * 0.8);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6;
      ctx.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15);
      ctx.lineTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
      ctx.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
      ctx.lineTo(Math.cos(a + 0.25) * r * 0.5, Math.sin(a + 0.25) * r * 0.5);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(143,227,255,${0.14 + Math.sin(t * 4) * 0.07})`;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ───────────── 血条 ─────────────
export function hpBar(ctx, x, y, w, ratio, color, zoom, { label = null, ghost = null } = {}) {
  const k = Math.max(1, zoom * 0.7);
  const h = 7 / k;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.roundRect(x - w / 2 - 2 / k, y - 2 / k, w + 4 / k, h + 4 / k, 2); ctx.fill();
  ctx.fillStyle = 'rgba(60,40,80,0.9)';
  ctx.fillRect(x - w / 2, y, w, h);
  if (ghost !== null && ghost > ratio) {
    ctx.fillStyle = 'rgba(255,240,200,0.75)';
    ctx.fillRect(x - w / 2, y, w * ghost, h);
  }
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), h);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), h * 0.35);
  // 刻度
  ctx.fillStyle = 'rgba(20,12,32,0.5)';
  for (let i = 1; i < 4; i++) ctx.fillRect(x - w / 2 + (w * i) / 4, y, 1 / k, h);
  if (label) {
    ctx.font = `800 ${11 / k}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ece6ff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3 / k;
    ctx.lineJoin = 'round';
    ctx.strokeText(label, x, y - 3 / k);
    ctx.fillText(label, x, y - 3 / k);
  }
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
