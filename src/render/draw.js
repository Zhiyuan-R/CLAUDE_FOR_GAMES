// 场景物件与单位的程序化绘制（坐标已经过世界变换：点 (x, y*YS - z)）
import { YS, TEAM_COLORS, FONT } from '../config.js';

const TAU = Math.PI * 2;

export function shadow(ctx, x, y, r, a = 0.35) {
  ctx.fillStyle = `rgba(5,2,12,${a})`;
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
  }
}

function tree(ctx, x, gy, s, seed, t) {
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(5,2,12,0.45)';
  ctx.beginPath(); ctx.ellipse(0, 0, 60, 20, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1a1226';
  ctx.beginPath();
  ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-8, -60, -18, -120); ctx.lineTo(16, -120); ctx.quadraticCurveTo(8, -60, 16, 0);
  ctx.fill();
  const sway = Math.sin(t * 0.8 + seed * 10) * 3;
  const blobs = [[-50, -140, 55], [40, -150, 58], [0, -190, 62], [-30, -215, 45], [35, -220, 42], [0, -250, 38]];
  const cols = ['#2a1d47', '#33235a', '#3d2a6b', '#4b3483'];
  blobs.forEach(([bx, by, br], i) => {
    ctx.fillStyle = cols[(i + Math.floor(seed * 4)) % cols.length];
    ctx.beginPath(); ctx.arc(bx + sway * (by / -200), by, br, 0, TAU); ctx.fill();
  });
  ctx.fillStyle = 'rgba(160,120,255,0.12)';
  ctx.beginPath(); ctx.arc(-10 + sway, -230, 30, 0, TAU); ctx.fill();
  ctx.restore();
}

function stalag(ctx, x, gy, s, seed) {
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(s, s);
  ctx.fillStyle = '#1f1932';
  ctx.beginPath(); ctx.moveTo(-26, 4); ctx.lineTo(-6, -60 - seed * 30); ctx.lineTo(8, -40); ctx.lineTo(28, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2c2445';
  ctx.beginPath(); ctx.moveTo(-26, 4); ctx.lineTo(-6, -60 - seed * 30); ctx.lineTo(-2, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function pillar(ctx, x, gy, r, h, broken, seed) {
  ctx.fillStyle = 'rgba(5,2,12,0.45)';
  ctx.beginPath(); ctx.ellipse(x + 8, gy + 3, r * 1.4, r * 0.55, 0, 0, TAU); ctx.fill();
  const top = gy - h;
  ctx.fillStyle = '#3a3352';
  ctx.fillRect(x - r * 1.2, gy - 16, r * 2.4, 16);
  ctx.beginPath(); ctx.ellipse(x, gy - 16, r * 1.2, r * 0.5, 0, 0, TAU); ctx.fillStyle = '#4b4468'; ctx.fill();
  const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
  g.addColorStop(0, '#2b2540'); g.addColorStop(0.45, '#57507a'); g.addColorStop(1, '#2b2540');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - r, gy - 16);
  ctx.lineTo(x - r * 0.92, top + (broken ? 18 : 0));
  if (broken) { ctx.lineTo(x - r * 0.3, top + 4); ctx.lineTo(x + r * 0.1, top + 22); ctx.lineTo(x + r * 0.6, top); }
  ctx.lineTo(x + r * 0.92, top + (broken ? 12 : 0));
  ctx.lineTo(x + r, gy - 16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,10,28,0.5)';
  ctx.lineWidth = 2;
  for (let k = 1; k < 4; k++) {
    const xx = x - r + (k * 2 * r) / 4;
    ctx.beginPath(); ctx.moveTo(xx, gy - 18); ctx.lineTo(xx, top + 24); ctx.stroke();
  }
  if (!broken) {
    ctx.fillStyle = '#4b4468';
    ctx.fillRect(x - r * 1.15, top - 12, r * 2.3, 14);
    ctx.beginPath(); ctx.ellipse(x, top - 12, r * 1.15, r * 0.45, 0, 0, TAU); ctx.fillStyle = '#5d5682'; ctx.fill();
  }
  ctx.fillStyle = 'rgba(80,140,80,0.55)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.4, gy - 30 - seed * 30, r * 0.5, 10, 0.3, 0, TAU); ctx.fill();
}

function rock(ctx, x, gy, r, seed) {
  ctx.fillStyle = 'rgba(5,2,12,0.45)';
  ctx.beginPath(); ctx.ellipse(x + 6, gy + 4, r * 1.25, r * 0.5, 0, 0, TAU); ctx.fill();
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI + Math.PI;
    const rr = r * (0.85 + ((seed * 997 * (i + 1)) % 1) * 0.3);
    pts.push([x + Math.cos(a) * rr * 1.15, gy + Math.sin(a) * rr * 1.2]);
  }
  ctx.fillStyle = '#3b3456';
  ctx.beginPath();
  ctx.moveTo(x - r * 1.15, gy + 4);
  pts.forEach(([px, py]) => ctx.lineTo(px, py));
  ctx.lineTo(x + r * 1.15, gy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4e4672';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.9, gy - r * 0.6);
  ctx.lineTo(x - r * 0.1, gy - r * 1.15);
  ctx.lineTo(x + r * 0.6, gy - r * 0.8);
  ctx.lineTo(x, gy - r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,10,28,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - r * 0.3, gy - r * 0.9); ctx.lineTo(x + r * 0.1, gy - r * 0.2); ctx.lineTo(x + r * 0.5, gy); ctx.stroke();
}

function torch(ctx, x, gy, h, t, seed) {
  shadow(ctx, x, gy / YS, 14, 0.4);
  ctx.fillStyle = '#2a2238';
  ctx.fillRect(x - 4, gy - h, 8, h);
  ctx.fillStyle = '#3d3352';
  ctx.beginPath(); ctx.moveTo(x - 13, gy - h); ctx.lineTo(x + 13, gy - h); ctx.lineTo(x + 7, gy - h + 10); ctx.lineTo(x - 7, gy - h + 10); ctx.closePath(); ctx.fill();
  const fl = Math.sin(t * 13 + seed * 20) * 2 + Math.sin(t * 7.3 + seed * 5) * 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x, gy - h - 12, 2, x, gy - h - 12, 70);
  glow.addColorStop(0, 'rgba(255,160,60,0.45)');
  glow.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, gy - h - 12, 70, 0, TAU); ctx.fill();
  flame(ctx, x, gy - h, 12, 30 + fl, '#ff7a1a');
  flame(ctx, x, gy - h, 7, 20 + fl * 0.6, '#ffd36b');
  ctx.restore();
}

export function flame(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.9, y - h * 0.6, x, y - h);
  ctx.quadraticCurveTo(x + w * 0.9, y - h * 0.6, x + w, y);
  ctx.closePath();
  ctx.fill();
}

function shroom(ctx, x, gy, s, hue, t, seed) {
  const col = hue === 'teal' ? ['#3fe0c8', 'rgba(63,224,200,'] : ['#ff6fb5', 'rgba(255,111,181,'];
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(s, s);
  ctx.fillStyle = '#d8d0e8';
  ctx.fillRect(-2, -14, 4, 14);
  ctx.fillStyle = col[0];
  ctx.beginPath(); ctx.ellipse(0, -14, 10, 6, 0, Math.PI, 0); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const p = 0.3 + Math.sin(t * 2 + seed * 10) * 0.12;
  const g = ctx.createRadialGradient(0, -14, 0, 0, -14, 22);
  g.addColorStop(0, col[1] + p + ')');
  g.addColorStop(1, col[1] + '0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, -14, 22, 0, TAU); ctx.fill();
  ctx.restore();
}

function crystalDecor(ctx, x, gy, t, seed) {
  shadow(ctx, x, gy / YS, 18, 0.35);
  const bob = Math.sin(t * 1.6 + seed * 6) * 3;
  ctx.save();
  ctx.translate(x, gy - 24 + bob);
  ctx.fillStyle = '#5c49a8';
  ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(10, 0); ctx.lineTo(0, 14); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9d86ff';
  ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(10, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, -4, 0, 0, -4, 30);
  g.addColorStop(0, 'rgba(150,120,255,0.35)');
  g.addColorStop(1, 'rgba(150,120,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, -4, 30, 0, TAU); ctx.fill();
  ctx.restore();
}

// ───────────── 英雄 ─────────────
export function drawHero(ctx, h, t, ghost = null) {
  const d = h.def;
  const src = ghost || h;
  const x = src.x, base = src.y * YS - src.z;
  const fx = ghost ? ghost.fx : h.facing.x, fy = ghost ? ghost.fy : h.facing.y;
  const side = fx >= 0 ? 1 : -1;
  const back = fy < -0.45;
  const moving = !ghost && h.speedNow > 20;
  const walk = h.walkT;
  const bob = moving ? Math.abs(Math.sin(walk * 2)) * 2.5 : Math.sin(t * 2.2) * 0.8;
  const white = !ghost && h.flash > 0;
  const pal = white
    ? { cloak: '#ffffff', body: '#ffffff', hood: '#ffffff', skin: '#ffffff', dark: '#ffffff' }
    : { cloak: d.color, body: d.body, hood: d.hood, skin: '#e9c39d', dark: '#16101f' };

  ctx.save();
  if (ghost) {
    ctx.globalAlpha = (ghost.life / ghost.max) * 0.45;
    ctx.globalCompositeOperation = 'lighter';
    pal.cloak = pal.body = pal.hood = pal.skin = pal.dark = d.color2;
  } else if (h.invuln > 0 && h.state !== 'dash' && Math.floor(t * 16) % 2 === 0) {
    ctx.globalAlpha = 0.55;
  }

  const ang = Math.atan2(fy * YS, fx);
  const weaponBehind = back;
  if (!ghost && weaponBehind) drawWeapon(ctx, h, x, base - 26 - bob, ang, t, pal);

  ctx.translate(x, base);
  ctx.scale(side, 1);

  // 腿
  const step = moving ? Math.sin(walk * 2) * 4 : 0;
  ctx.fillStyle = pal.dark;
  ctx.fillRect(-7, -14 + Math.max(0, step) * 0.5, 5, 14 - Math.max(0, step) * 0.5);
  ctx.fillRect(2, -14 + Math.max(0, -step) * 0.5, 5, 14 - Math.max(0, -step) * 0.5);

  ctx.translate(0, -bob);
  // 披风：随移动向后飘动
  const flutter = moving ? 6 + Math.sin(walk * 3) * 3 : 2 + Math.sin(t * 2) * 1.5;
  ctx.fillStyle = pal.cloak;
  ctx.beginPath();
  ctx.moveTo(-9, -38);
  ctx.lineTo(9, -38);
  ctx.quadraticCurveTo(10, -20, 6, -8);
  ctx.lineTo(-14 - flutter, -6 + flutter * 0.3);
  ctx.quadraticCurveTo(-16 - flutter * 0.5, -24, -9, -38);
  ctx.closePath();
  ctx.fill();
  if (!white && !ghost) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.moveTo(-9, -38);
    ctx.quadraticCurveTo(-16 - flutter * 0.5, -24, -14 - flutter, -6 + flutter * 0.3);
    ctx.lineTo(-6, -8);
    ctx.closePath();
    ctx.fill();
  }
  // 躯干
  ctx.fillStyle = pal.body;
  ctx.beginPath();
  ctx.moveTo(-7, -36); ctx.lineTo(8, -36); ctx.lineTo(9, -13); ctx.lineTo(-6, -13); ctx.closePath();
  ctx.fill();
  if (!white && !ghost) {
    ctx.fillStyle = d.color2;
    ctx.fillRect(-6, -22, 15, 3);
  }
  // 头部 / 兜帽
  ctx.fillStyle = pal.hood;
  ctx.beginPath(); ctx.arc(0, -45, 10, 0, TAU); ctx.fill();
  if (d.id === 'storm') {
    ctx.beginPath(); ctx.moveTo(-12, -48); ctx.lineTo(12, -48); ctx.lineTo(-4, -76); ctx.closePath(); ctx.fill();
    ctx.fillRect(-15, -50, 30, 4);
  } else if (d.id === 'ember') {
    ctx.beginPath(); ctx.moveTo(-10, -46); ctx.lineTo(-16, -60); ctx.lineTo(-3, -52); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(-10, -44); ctx.quadraticCurveTo(-18, -38, -15, -28); ctx.lineTo(-8, -38); ctx.closePath(); ctx.fill();
  }
  if (!back) {
    ctx.fillStyle = pal.skin;
    ctx.beginPath(); ctx.ellipse(4, -44, 5, 5.5, 0, 0, TAU); ctx.fill();
    if (!white && !ghost) {
      ctx.fillStyle = d.color2;
      ctx.fillRect(5, -46, 3, 2);
    }
  }
  if (!white && !ghost && d.id === 'frost') {
    ctx.fillStyle = '#5a4030';
    ctx.save(); ctx.rotate(-0.4); ctx.fillRect(-18, -34, 6, 22); ctx.restore();
  }
  ctx.restore();

  if (!ghost && !weaponBehind) drawWeapon(ctx, h, x, base - 26 - bob, ang, t, pal);
}

function drawWeapon(ctx, h, x, y, ang, t, pal) {
  const d = h.def;
  let a = ang;
  let reach = 1;
  if (h.swing) {
    const k = h.swing.t / h.swing.dur;
    if (d.weapon === 'sword') {
      const dir = h.swing.i === 1 ? -1 : 1;
      if (h.swing.i === 3) a = ang + k * Math.PI * 2;
      else a = ang + dir * (-1.3 + 2.6 * Math.min(1, k * 1.8));
    } else {
      reach = 1 - Math.sin(Math.min(1, k * 2) * Math.PI) * 0.25;
    }
  }
  const charging = h.state === 'charging';
  const full = charging && h.chargeT >= d.charged.maxTime;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  if (d.weapon === 'sword') {
    const len = 40;
    const ex = Math.cos(a) * len, ey = Math.sin(a) * len;
    if (charging || h.buffs.flame > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = full ? 'rgba(255,220,120,0.8)' : 'rgba(255,130,50,0.5)';
      ctx.lineWidth = full ? 12 : 9;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = pal.dark === '#ffffff' ? '#fff' : '#5a3a22';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-Math.cos(a) * 4, -Math.sin(a) * 4); ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.stroke();
    ctx.strokeStyle = '#e9e2f0';
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = d.color2;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.lineTo(ex * 0.95, ey * 0.95); ctx.stroke();
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 3;
    const px = -Math.sin(a) * 7, py = Math.cos(a) * 7;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9 - px, Math.sin(a) * 9 - py); ctx.lineTo(Math.cos(a) * 9 + px, Math.sin(a) * 9 + py); ctx.stroke();
  } else if (d.weapon === 'staff') {
    const len = 44 * reach;
    const sx = Math.cos(a) * 6 - 6, sy = 18;
    const ex = Math.cos(a) * len * 0.6 + Math.cos(a) * 8, ey = Math.sin(a) * len * 0.6 - 26;
    ctx.strokeStyle = '#4a3326';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    const pulse = 1 + Math.sin(t * 6) * 0.15;
    const orbR = (charging ? 7 + Math.min(1, h.chargeT / d.charged.maxTime) * 6 : 6) * pulse;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, orbR * 3.5);
    g.addColorStop(0, 'rgba(220,200,255,0.9)');
    g.addColorStop(0.3, 'rgba(150,110,255,0.6)');
    g.addColorStop(1, 'rgba(100,60,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ex, ey, orbR * 3.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f3ecff';
    ctx.beginPath(); ctx.arc(ex, ey, orbR * 0.6, 0, TAU); ctx.fill();
  } else if (d.weapon === 'bow') {
    const bx = Math.cos(a) * 16, by = Math.sin(a) * 16;
    const px = -Math.sin(a), py = Math.cos(a);
    const pull = charging ? Math.min(1, h.chargeT / d.charged.maxTime) * 10 : h.swing ? 6 * reach : 0;
    ctx.strokeStyle = '#6b4a2e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx + px * 18, by + py * 18);
    ctx.quadraticCurveTo(bx + Math.cos(a) * 10, by + Math.sin(a) * 10, bx - px * 18, by - py * 18);
    ctx.stroke();
    const sx = bx - Math.cos(a) * pull, sy = by - Math.sin(a) * pull;
    ctx.strokeStyle = 'rgba(230,240,255,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx + px * 18, by + py * 18); ctx.lineTo(sx, sy); ctx.lineTo(bx - px * 18, by - py * 18); ctx.stroke();
    if (charging) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = full ? '#e6fbff' : '#8fe3ff';
      ctx.lineWidth = full ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bx + Math.cos(a) * 18, by + Math.sin(a) * 18); ctx.stroke();
    }
  }
  ctx.restore();
}

// ───────────── 小兵 ─────────────
export function drawMinion(ctx, m, t) {
  const x = m.x, gy = m.y * YS;
  const bob = Math.abs(Math.sin(m.phase * 8)) * (Math.hypot(m.vx, m.vy) > 5 ? 3 : 0.8);
  const tc = TEAM_COLORS[m.team];
  const white = m.flash > 0;
  const lunge = m.windup > 0 ? (1 - m.windup / 0.28) * 6 : 0;
  ctx.save();
  ctx.translate(x + m.face * lunge, gy - bob);
  ctx.scale(m.face, 1);
  ctx.fillStyle = white ? '#fff' : '#3a2d58';
  ctx.beginPath(); ctx.ellipse(0, -14, 13, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = white ? '#fff' : '#4b3b73';
  ctx.beginPath(); ctx.ellipse(-3, -18, 7, 6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = white ? '#fff' : '#2a2140';
  ctx.beginPath(); ctx.moveTo(-8, -25); ctx.lineTo(-12, -36); ctx.lineTo(-3, -27); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5, -27); ctx.lineTo(8, -38); ctx.lineTo(10, -24); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tc;
  ctx.beginPath(); ctx.arc(6, -17, 2.6, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(11, -16, 2, 0, TAU); ctx.fill();
  ctx.strokeStyle = white ? '#fff' : '#b8aed8';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(18, -14 + (m.windup > 0 ? -6 : 0)); ctx.stroke();
  ctx.fillStyle = tc;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-12, -6, 24, 3);
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
    ctx.fillStyle = '#2c2540';
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.7, gy + Math.sin(a) * r * 0.3, 14, 8, a, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#3a3352';
    ctx.beginPath(); ctx.ellipse(x, gy, r, r * 0.42, 0, 0, TAU); ctx.fill();
    ctx.restore();
    return;
  }
  const white = tw.flash > 0;
  // 底座
  ctx.fillStyle = white ? '#fff' : '#3a3352';
  ctx.beginPath(); ctx.ellipse(x, gy, r * 1.25, r * 0.55, 0, 0, TAU); ctx.fill();
  ctx.fillRect(x - r * 1.25, gy - 14, r * 2.5, 14);
  ctx.fillStyle = white ? '#fff' : '#4d4670';
  ctx.beginPath(); ctx.ellipse(x, gy - 14, r * 1.25, r * 0.55, 0, 0, TAU); ctx.fill();
  // 塔身
  const h = tw.height - 40;
  const w0 = core ? r * 0.75 : r * 0.62, w1 = core ? r * 0.45 : r * 0.42;
  const g = ctx.createLinearGradient(x - w0, 0, x + w0, 0);
  g.addColorStop(0, '#29233d'); g.addColorStop(0.45, '#5a5280'); g.addColorStop(1, '#29233d');
  ctx.fillStyle = white ? '#fff' : g;
  ctx.beginPath();
  ctx.moveTo(x - w0, gy - 14); ctx.lineTo(x - w1, gy - h); ctx.lineTo(x + w1, gy - h); ctx.lineTo(x + w0, gy - 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,10,28,0.55)';
  ctx.lineWidth = 2;
  for (let k = 1; k < 5; k++) {
    const yy = gy - 14 - (k * (h - 14)) / 5;
    const ww = w0 + (w1 - w0) * (k / 5);
    ctx.beginPath(); ctx.moveTo(x - ww, yy); ctx.lineTo(x + ww, yy); ctx.stroke();
  }
  // 能量纹路
  ctx.strokeStyle = tc;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, gy - 20); ctx.lineTo(x, gy - h + 6); ctx.stroke();
  ctx.globalAlpha = 1;
  // 塔顶托盘
  ctx.fillStyle = white ? '#fff' : '#4d4670';
  ctx.beginPath(); ctx.ellipse(x, gy - h, w1 * 1.8, w1 * 0.7, 0, 0, TAU); ctx.fill();
  // 漂浮水晶
  const bob = Math.sin(t * 2 + tw.id) * 4;
  const cy = gy - h - (core ? 40 : 28) + bob;
  const cs = core ? 26 : 16;
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x, cy, 0, x, cy, cs * 4);
  glow.addColorStop(0, hexA(tc, 0.55));
  glow.addColorStop(1, hexA(tc, 0));
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, cy, cs * 4, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = white ? '#fff' : tc;
  ctx.beginPath(); ctx.moveTo(x, cy - cs * 1.4); ctx.lineTo(x + cs * 0.7, cy); ctx.lineTo(x, cy + cs); ctx.lineTo(x - cs * 0.7, cy); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.moveTo(x, cy - cs * 1.4); ctx.lineTo(x + cs * 0.7, cy); ctx.lineTo(x, cy); ctx.closePath(); ctx.fill();
  if (core) {
    for (let i = 0; i < 3; i++) {
      const a = t * 1.2 + (i * TAU) / 3;
      const sx = x + Math.cos(a) * 42, sy = cy + Math.sin(a) * 14;
      ctx.fillStyle = tc;
      ctx.beginPath(); ctx.moveTo(sx, sy - 9); ctx.lineTo(sx + 4, sy); ctx.lineTo(sx, sy + 7); ctx.lineTo(sx - 4, sy); ctx.closePath(); ctx.fill();
    }
  }
  if (tw.isInvulnerable()) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(tc, 0.35 + Math.sin(t * 3) * 0.1);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, gy - h * 0.55, r * 1.3, h * 0.75, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// ───────────── 飞行道具 ─────────────
export function drawProjectile(ctx, p) {
  const x = p.x, y = p.y * YS - p.z;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  if (p.kind === 'arrow' || p.kind === 'shard') {
    const a = Math.atan2(p.vy * YS, p.vx);
    const len = p.kind === 'shard' ? 30 : 24;
    const tx = x - Math.cos(a) * len, ty = y - Math.sin(a) * len;
    ctx.strokeStyle = 'rgba(143,227,255,0.35)';
    ctx.lineWidth = p.kind === 'shard' ? 9 : 6;
    ctx.beginPath(); ctx.moveTo(tx - Math.cos(a) * 20, ty - Math.sin(a) * 20); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = '#e6fbff';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#bff0ff';
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
    ctx.lineTo(x - Math.sin(a) * 4, y + Math.cos(a) * 4);
    ctx.lineTo(x + Math.sin(a) * 4, y - Math.cos(a) * 4);
    ctx.closePath();
    ctx.fill();
  } else {
    const r = p.radius;
    p.trail.forEach((q, i) => {
      const k = (i + 1) / p.trail.length;
      ctx.fillStyle = hexA(p.color, 0.25 * k);
      ctx.beginPath(); ctx.arc(q.x, q.y * YS - q.z, r * k, 0, TAU); ctx.fill();
    });
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, p.color);
    g.addColorStop(1, hexA(p.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // 地面投影
  ctx.fillStyle = 'rgba(5,2,12,0.25)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y * YS, 7, 3, 0, 0, TAU); ctx.fill();
}

// ───────────── 区域效果（画在地面层） ─────────────
export function drawZone(ctx, z, t, viewerTeam) {
  const x = z.x, gy = z.y * YS, r = z.radius;
  const fade = Math.min(1, z.life / 0.4, z.age / 0.15);
  ctx.save();
  ctx.globalAlpha = fade;
  if (z.kind === 'fire') {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, gy, 0, x, gy, r);
    g.addColorStop(0, 'rgba(255,140,40,0.55)');
    g.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, gy, r, r * YS, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const ox = Math.sin(t * 3 + i * 2 + z.x) * r * 0.4;
      flame(ctx, x + ox, gy + (i - 1) * 4, 6, 14 + Math.sin(t * 12 + i) * 5, 'rgba(255,150,50,0.6)');
    }
  } else if (z.kind === 'flameAura') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, gy);
    ctx.scale(1, YS);
    const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r);
    g.addColorStop(0, 'rgba(255,100,30,0)');
    g.addColorStop(0.8, 'rgba(255,120,40,0.35)');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,70,0.8)';
    ctx.lineWidth = 5;
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i * TAU) / 3;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9, a, a + 1.1); ctx.stroke();
    }
  } else if (z.kind === 'storm') {
    ctx.translate(x, gy);
    ctx.scale(1, YS);
    ctx.fillStyle = 'rgba(80,50,180,0.18)';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(180,150,255,0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 12]);
    ctx.lineDashOffset = -t * 60;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(180,150,255,0.3)';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.6, -t * 2, -t * 2 + 4); ctx.stroke();
  } else if (z.kind === 'trap') {
    const mine = z.team === viewerTeam;
    const armed = z.age >= 0.6;
    ctx.globalAlpha = fade * (mine ? 1 : 0.35);
    ctx.translate(x, gy);
    ctx.scale(1, YS);
    ctx.strokeStyle = armed ? '#8fe3ff' : 'rgba(143,227,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.stroke();
    ctx.rotate(t * 0.8);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(143,227,255,${0.12 + Math.sin(t * 4) * 0.06})`;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ───────────── 血条 ─────────────
export function hpBar(ctx, x, y, w, ratio, color, zoom, { label = null, ghost = null } = {}) {
  const h = 7 / Math.max(1, zoom * 0.7);
  ctx.fillStyle = 'rgba(8,5,16,0.85)';
  ctx.fillRect(x - w / 2 - 1.5, y - 1.5, w + 3, h + 3);
  if (ghost !== null && ghost > ratio) {
    ctx.fillStyle = 'rgba(255,240,200,0.6)';
    ctx.fillRect(x - w / 2, y, w * ghost, h);
  }
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), h * 0.4);
  if (label) {
    ctx.font = `700 ${11 / Math.max(1, zoom * 0.7)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ece6ff';
    ctx.strokeStyle = 'rgba(8,5,16,0.9)';
    ctx.lineWidth = 3 / Math.max(1, zoom * 0.7);
    ctx.strokeText(label, x, y - 3);
    ctx.fillText(label, x, y - 3);
  }
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
