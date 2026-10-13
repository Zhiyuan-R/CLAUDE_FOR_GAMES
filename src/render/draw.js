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
    case 'shroom': return shroom(ctx, x, gy, p.s, p.hue, t, p.seed);
    case 'crystal': return crystalDecor(ctx, x, gy, t, p.seed);
    case 'fern': return fern(ctx, x, gy, p.s, p.seed, t, p.hue);
    case 'sconce': return sconce(ctx, x, gy, p.h, t, p.seed);
    case 'bones': return bones(ctx, x, gy, p.s);
  }
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
const ROBE = new Set(['staff', 'orb']);
const MOUNT_SEAT = { wolf: 26, boar: 24, raptor: 34, stag: 34 };

export function drawHero(ctx, h, t, ghost = null) {
  const d = h.def;
  const src = ghost || h;
  const x = src.x;
  const fx = ghost ? ghost.fx : h.facing.x, fy = ghost ? ghost.fy : h.facing.y;
  const side = fx >= 0 ? 1 : -1;
  const back = fy < -0.5;
  const mounted = !ghost && h.mounted;
  const moving = !ghost && h.speedNow > 20;
  const walk = h.walkT * 2;
  const S = d.size;
  let base = src.y * YS - src.z;
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
  } else if (h.stealthT > 0) {
    ctx.globalAlpha = h.team === h.game.player.team ? 0.4 : 0.12;
  } else if (h.invuln > 0 && h.state !== 'dash' && Math.floor(t * 16) % 2 === 0) {
    ctx.globalAlpha = 0.55;
  }

  if (mounted) {
    drawMount(ctx, h.mount, x, base, side, t, moving ? walk : 0, white);
    base -= MOUNT_SEAT[h.mount.id] * Math.min(1.15, S);
  }
  const bob = mounted ? Math.abs(Math.sin(walk * 1.2)) * 2 : moving ? Math.abs(Math.sin(walk)) * 2.2 : Math.sin(t * 2.4) * 0.7;
  const ang = Math.atan2(fy * YS, fx);
  const shoulder = { x: x + side * 3 * S, y: base - (31 + bob) * S };
  if (!ghost && back) drawArmWeapon(ctx, h, shoulder, ang, t, pal, S);

  ctx.save();
  ctx.translate(x, base);
  ctx.scale(side * S, S);

  const swing = moving && !mounted ? Math.sin(walk) * 0.55 : mounted ? 0.5 : 0;
  leg(ctx, -2, -15, swing, pal, true);
  ctx.translate(0, -bob);

  // 披风
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

  leg(ctx, 3, -15, mounted ? 0.5 : -swing, pal, false);

  // 躯干：法系穿长袍，其余穿短衣
  const robe = ROBE.has(d.weapon);
  if (robe) {
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
    const wide = d.roleId === 'tank' ? 2 : 0;
    ctx.beginPath();
    ctx.moveTo(-7 - wide, -38); ctx.lineTo(7 + wide, -38);
    ctx.quadraticCurveTo(10 + wide, -26, 8 + wide * 0.5, -13);
    ctx.lineTo(-7 - wide * 0.5, -13);
    ctx.quadraticCurveTo(-9 - wide, -26, -7 - wide, -38);
    ink(ctx, pal.body, pal.line);
    if (!white && !ghost) {
      ctx.beginPath(); ctx.moveTo(-5, -36); ctx.quadraticCurveTo(-7, -26, -5, -16); ctx.lineTo(-1, -16); ctx.quadraticCurveTo(-2, -26, -1, -36); ctx.closePath();
      ctx.fillStyle = pal.bodyL; ctx.fill();
    }
    ctx.beginPath(); ctx.rect(-8, -21, 17, 4); ink(ctx, white || ghost ? pal.body : '#5a3a26', pal.line ? 1.6 : 0);
    if (!white && !ghost) { ctx.fillStyle = '#e8b84a'; ctx.fillRect(3, -20.5, 3.5, 3); }
  }
  // 肩甲（坦克 / 战士）或箭袋（弓手）
  if (d.roleId === 'tank' || d.roleId === 'fighter') {
    ctx.beginPath(); ctx.ellipse(-1, -36, 8 + (d.roleId === 'tank' ? 2 : 0), 5, -0.2, 0, TAU); ink(ctx, pal.metal, pal.line);
    if (!white && !ghost) { ctx.fillStyle = '#d7dcef'; ctx.beginPath(); ctx.ellipse(-3, -38, 4, 2, -0.2, 0, TAU); ctx.fill(); }
  } else if (d.weapon === 'bow') {
    ctx.save();
    ctx.translate(-8, -30);
    ctx.rotate(-0.5);
    ctx.beginPath(); ctx.rect(-3.5, -12, 7, 22); ink(ctx, white || ghost ? pal.body : '#6b4a2e', pal.line ? 1.8 : 0);
    if (!white && !ghost) {
      ctx.fillStyle = d.color2;
      for (const ox of [-2, 1.5]) { ctx.beginPath(); ctx.moveTo(ox, -12); ctx.lineTo(ox - 2, -18); ctx.lineTo(ox + 2, -18); ctx.closePath(); ctx.fill(); }
    }
    ctx.restore();
  }

  head(ctx, d, pal, back, t, white || ghost);
  ctx.restore();

  if (!ghost && !back) drawArmWeapon(ctx, h, shoulder, ang, t, pal, S);

  // 护盾
  if (!ghost && h.shield > 0) {
    ctx.globalCompositeOperation = 'lighter';
    const cy = base - 32 * S;
    ctx.strokeStyle = 'rgba(255,229,138,0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, cy, 30 * S, 38 * S, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,229,138,0.08)';
    ctx.fill();
  }
  ctx.restore();
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

function face(ctx, d, pal, hy, flat) {
  ctx.beginPath(); ctx.ellipse(5, hy + 1, 5.8, 7, 0, 0, TAU); ink(ctx, pal.skin, pal.line ? 1.6 : 0);
  if (flat) return;
  ctx.beginPath(); ctx.ellipse(5, hy - 4, 6.5, 3.5, 0, 0, Math.PI); ctx.fillStyle = 'rgba(20,10,30,0.4)'; ctx.fill();
  ctx.fillStyle = d.color2;
  ctx.beginPath(); ctx.ellipse(8, hy, 1.6, 2.2, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 8, hy, 5, d.color2, 0.7); ctx.restore();
}

function head(ctx, d, pal, back, t, flat) {
  const hy = -50;
  const kind = d.head;
  if (kind === 'hat') {
    ctx.beginPath(); ctx.arc(0, hy, 10.5, 0, TAU); ink(ctx, pal.hood, pal.line);
    if (!back) {
      ctx.beginPath(); ctx.ellipse(4, hy + 1, 6.5, 7.5, 0, 0, TAU); ink(ctx, pal.skin, pal.line ? 1.6 : 0);
      if (!flat) {
        ctx.fillStyle = '#d9d2f0';
        ctx.beginPath(); ctx.moveTo(1, hy + 5); ctx.quadraticCurveTo(5, hy + 16, 9, hy + 5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = INK; ctx.fillRect(6, hy - 1, 2.2, 2.6);
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
    return;
  }
  if (kind === 'helm') {
    // 全覆式头盔 + 羽饰
    if (!flat) {
      ctx.beginPath(); ctx.moveTo(-2, hy - 10); ctx.quadraticCurveTo(-14, hy - 26, -20, hy - 14); ctx.quadraticCurveTo(-12, hy - 16, -6, hy - 6); ctx.closePath();
      ink(ctx, pal.cloak, pal.line);
    }
    ctx.beginPath(); ctx.arc(1, hy, 11.5, Math.PI * 0.95, Math.PI * 0.05 + Math.PI * 2); ctx.lineTo(11, hy + 9); ctx.lineTo(-9, hy + 9); ctx.closePath();
    ink(ctx, pal.metal, pal.line);
    if (!flat) {
      ctx.fillStyle = '#d7dcef'; ctx.beginPath(); ctx.ellipse(-3, hy - 6, 4, 3, -0.4, 0, TAU); ctx.fill();
      if (!back) {
        ctx.fillStyle = INK; ctx.fillRect(2, hy - 1, 10, 3.2);
        ctx.fillStyle = d.color2; ctx.fillRect(6, hy - 0.4, 3.5, 2);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 8, hy, 6, d.color2, 0.8); ctx.restore();
      }
    }
    return;
  }
  if (kind === 'hair' || kind === 'crown' || kind === 'ears') {
    // 露脸的发型
    ctx.beginPath(); ctx.arc(0, hy, 10, 0, TAU); ink(ctx, pal.hood, pal.line);
    if (!back) face(ctx, d, pal, hy, flat);
    ctx.beginPath();
    if (kind === 'hair') {
      ctx.moveTo(-11, hy + 2); ctx.lineTo(-15, hy - 6); ctx.lineTo(-9, hy - 8); ctx.lineTo(-12, hy - 16); ctx.lineTo(-3, hy - 12); ctx.lineTo(-2, hy - 19); ctx.lineTo(4, hy - 12); ctx.lineTo(10, hy - 15); ctx.lineTo(10, hy - 7); ctx.lineTo(6, hy - 4); ctx.lineTo(-6, hy - 3); ctx.closePath();
    } else {
      ctx.moveTo(-10, hy + 4); ctx.quadraticCurveTo(-12, hy - 12, 0, hy - 11); ctx.quadraticCurveTo(11, hy - 11, 10, hy - 4); ctx.lineTo(4, hy - 5); ctx.lineTo(-5, hy - 3); ctx.closePath();
    }
    ink(ctx, pal.hood, pal.line);
    if (kind === 'crown') {
      ctx.beginPath(); ctx.moveTo(-7, hy - 10); ctx.lineTo(-7, hy - 18); ctx.lineTo(-3, hy - 13); ctx.lineTo(1, hy - 20); ctx.lineTo(4, hy - 13); ctx.lineTo(8, hy - 18); ctx.lineTo(8, hy - 10); ctx.closePath();
      ink(ctx, flat ? pal.hood : '#f0c040', pal.line ? 1.6 : 0);
      if (!flat) { ctx.fillStyle = d.color2; ctx.beginPath(); ctx.arc(1, hy - 13, 1.8, 0, TAU); ctx.fill(); }
    } else if (kind === 'ears') {
      for (const [ex, tilt] of [[-7, -0.5], [4, 0.2]]) {
        ctx.save(); ctx.translate(ex, hy - 8); ctx.rotate(tilt);
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(0, -12); ctx.lineTo(4, 0); ctx.closePath(); ink(ctx, pal.hood, pal.line ? 1.8 : 0);
        if (!flat) { ctx.beginPath(); ctx.moveTo(-2, -1); ctx.lineTo(0, -8); ctx.lineTo(2, -1); ctx.closePath(); ctx.fillStyle = '#f0b0c0'; ctx.fill(); }
        ctx.restore();
      }
    }
    return;
  }
  // 兜帽系：hood / hornhood / furhood / horns / mask
  ctx.beginPath();
  ctx.moveTo(-10, hy + 6);
  ctx.quadraticCurveTo(-14, hy - 10, -2, hy - 13);
  if (kind === 'hornhood') { ctx.lineTo(-10, hy - 20); ctx.lineTo(3, hy - 12.5); }
  ctx.quadraticCurveTo(13, hy - 10, 11, hy + 3);
  ctx.quadraticCurveTo(12, hy + 9, 6, hy + 11);
  ctx.lineTo(-6, hy + 11);
  ctx.closePath();
  ink(ctx, pal.hood, pal.line);
  if (!back) {
    if (kind === 'mask') {
      ctx.beginPath(); ctx.ellipse(5, hy + 1, 6.2, 7.5, 0, 0, TAU); ink(ctx, flat ? pal.skin : '#e8e2d4', pal.line ? 1.6 : 0);
      if (!flat) {
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.ellipse(3.5, hy - 1, 1.8, 2.4, 0, 0, TAU); ctx.ellipse(8, hy - 1, 1.8, 2.4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.color2;
        ctx.beginPath(); ctx.arc(8, hy - 1, 1, 0, TAU); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 8, hy - 1, 6, d.color2, 0.9); ctx.restore();
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(3, hy + 5); ctx.lineTo(9, hy + 5); ctx.stroke();
      }
    } else face(ctx, d, pal, hy, flat);
  }
  if (!flat) {
    ctx.beginPath(); ctx.moveTo(-8, hy + 2); ctx.quadraticCurveTo(-10, hy - 8, -2, hy - 11); ctx.quadraticCurveTo(-7, hy - 6, -6, hy + 4); ctx.closePath();
    ctx.fillStyle = pal.hoodD; ctx.fill();
  }
  if (kind === 'furhood' && !flat) {
    ctx.strokeStyle = INK; ctx.lineWidth = 6.5;
    ctx.beginPath(); ctx.arc(4, hy + 1, 9, -1.4, 1.6); ctx.stroke();
    ctx.strokeStyle = '#eef8ff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(4, hy + 1, 9, -1.4, 1.6); ctx.stroke();
  }
  if (kind === 'horns') {
    for (const [bx, dir] of [[-6, -1], [5, 1]]) {
      ctx.beginPath();
      ctx.moveTo(bx - 2, hy - 8);
      ctx.quadraticCurveTo(bx + dir * 10, hy - 14, bx + dir * 9, hy - 26);
      ctx.quadraticCurveTo(bx + dir * 4, hy - 16, bx + 3, hy - 9);
      ctx.closePath();
      ink(ctx, flat ? pal.hood : '#e8dcc0', pal.line ? 1.8 : 0);
    }
  }
}

function drawArmWeapon(ctx, h, sh, ang, t, pal, S) {
  const d = h.def;
  const wp = d.weapon;
  let a = ang;
  let reach = 1;
  const swinger = wp === 'sword' || wp === 'greatsword' || wp === 'axe' || wp === 'hammer' || wp === 'scythe' || wp === 'dagger';
  if (h.swing) {
    const k = h.swing.t / h.swing.dur;
    if (swinger) {
      const dir = h.swing.i % 2 ? -1 : 1;
      if (h.swing.i === 9) a = ang + k * Math.PI * 2;
      else a = ang + dir * (-1.4 + 2.8 * Math.min(1, k * 1.8));
    } else if (wp === 'spear' || wp === 'fist') {
      reach = 1 + Math.sin(Math.min(1, k * 2) * Math.PI) * (wp === 'fist' ? 0.9 : 0.6);
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
  const px = -sa, py = ca;
  ctx.save();
  ctx.lineCap = 'round';
  inkLine(ctx, sh.x, sh.y, hx, hy, pal.body, 5 * S, line ? 1.6 : 0);
  const glowOn = charging || h.buffs.haste > 0 || h.buffs.berserk > 0;

  if (wp === 'sword' || wp === 'greatsword' || wp === 'dagger') {
    const len = (wp === 'greatsword' ? 56 : wp === 'dagger' ? 22 : 40) * S;
    const wdt = wp === 'greatsword' ? 5 : wp === 'dagger' ? 2.6 : 3.4;
    const tx = hx + ca * len, ty = hy + sa * len;
    if (glowOn) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = full ? 'rgba(255,240,180,0.9)' : hexA(d.color2, 0.35 + cr * 0.4);
      ctx.lineWidth = 10 + cr * 6;
      ctx.beginPath(); ctx.moveTo(hx + ca * 8, hy + sa * 8); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(hx + ca * 6 + px * wdt, hy + sa * 6 + py * wdt);
    ctx.lineTo(tx - ca * 6 + px * wdt * 0.8, ty - sa * 6 + py * wdt * 0.8);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx - ca * 6 - px * wdt * 0.8, ty - sa * 6 - py * wdt * 0.8);
    ctx.lineTo(hx + ca * 6 - px * wdt, hy + sa * 6 - py * wdt);
    ctx.closePath();
    ink(ctx, pal.metal === '#ffffff' ? '#fff' : '#dfe5f5', line ? 2 : 0);
    ctx.strokeStyle = d.color2;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(hx + ca * 9, hy + sa * 9); ctx.lineTo(tx - ca * 9, ty - sa * 9); ctx.stroke();
    inkLine(ctx, hx + px * 8, hy + py * 8, hx - px * 8, hy - py * 8, '#d9a63e', 3.5, 1.5);
    inkLine(ctx, hx - ca * 7, hy - sa * 7, hx + ca * 2, hy + sa * 2, '#5a3a26', 3.5, 1.5);
  } else if (wp === 'axe' || wp === 'hammer' || wp === 'scythe') {
    const len = (wp === 'scythe' ? 50 : 38) * S;
    const tx = hx + ca * len, ty = hy + sa * len;
    inkLine(ctx, hx - ca * 8, hy - sa * 8, tx, ty, '#6b4a33', 3.6, 1.6);
    if (glowOn) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, tx, ty, 26 + cr * 14, d.color2, 0.4 + cr * 0.4); ctx.restore(); }
    ctx.beginPath();
    if (wp === 'axe') {
      ctx.moveTo(tx - ca * 4 + px * 2, ty - sa * 4 + py * 2);
      ctx.quadraticCurveTo(tx + px * 18 - ca * 10, ty + py * 18 - sa * 10, tx + px * 16 + ca * 8, ty + py * 16 + sa * 8);
      ctx.quadraticCurveTo(tx + px * 10 + ca * 2, ty + py * 10 + sa * 2, tx + ca * 4 + px * 2, ty + sa * 4 + py * 2);
    } else if (wp === 'hammer') {
      const hw = 9, hl = 14;
      ctx.moveTo(tx - ca * hw + px * hl, ty - sa * hw + py * hl);
      ctx.lineTo(tx + ca * hw + px * hl, ty + sa * hw + py * hl);
      ctx.lineTo(tx + ca * hw - px * hl, ty + sa * hw - py * hl);
      ctx.lineTo(tx - ca * hw - px * hl, ty - sa * hw - py * hl);
    } else {
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + px * 26 + ca * 6, ty + py * 26 + sa * 6, tx + px * 30 - ca * 18, ty + py * 30 - sa * 18);
      ctx.quadraticCurveTo(tx + px * 18 - ca * 2, ty + py * 18 - sa * 2, tx - ca * 3, ty - sa * 3);
    }
    ctx.closePath();
    ink(ctx, pal.metal === '#ffffff' ? '#fff' : wp === 'hammer' ? '#8a8fa8' : '#d0d6e8', line ? 2 : 0);
    if (line) { ctx.strokeStyle = d.color2; ctx.lineWidth = 1.5; ctx.stroke(); }
  } else if (wp === 'spear') {
    const len = 62 * S * reach;
    const bx = hx - ca * 26, by = hy - sa * 26;
    const tx = hx + ca * len * 0.7, ty = hy + sa * len * 0.7;
    inkLine(ctx, bx, by, tx, ty, '#7a5a3a', 3.2, 1.6);
    ctx.beginPath();
    ctx.moveTo(tx + ca * 16, ty + sa * 16);
    ctx.lineTo(tx + px * 5, ty + py * 5);
    ctx.lineTo(tx - ca * 3, ty - sa * 3);
    ctx.lineTo(tx - px * 5, ty - py * 5);
    ctx.closePath();
    ink(ctx, '#dfe5f5', line ? 1.8 : 0);
    ctx.fillStyle = d.color2; ctx.fillRect(tx - ca * 5 - 2, ty - sa * 5 - 2, 4, 4);
    if (glowOn) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, tx + ca * 8, ty + sa * 8, 20 + cr * 12, d.color2, 0.5); ctx.restore(); }
  } else if (wp === 'fist') {
    const r = 6 * S;
    ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ink(ctx, pal.metal === '#ffffff' ? '#fff' : '#c8a060', line ? 2 : 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, hx, hy, r * 3 + cr * 10, d.color2, 0.5 + cr * 0.4); ctx.restore();
  } else if (wp === 'staff') {
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
    ink(ctx, line ? d.color2 : pal.body, line ? 1.8 : 0);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(topX, topY - 4 - r * 1.4); ctx.lineTo(topX + r * 0.8, topY - 4); ctx.lineTo(topX, topY - 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(topX, topY - 3, r * 1.2, 0.2, Math.PI - 0.2); ctx.stroke();
  } else if (wp === 'orb') {
    // 悬浮法球
    const ox = hx + ca * 10, oy = hy + sa * 6 - 8 + Math.sin(t * 3) * 2;
    const r = (7 + cr * 5) * S * 0.8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, ox, oy, r * 4, d.color2, 0.6 + cr * 0.3);
    ctx.restore();
    ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ink(ctx, d.color2, line ? 2 : 0);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(ox - r * 0.3, oy - r * 0.35, r * 0.35, 0, TAU); ctx.fill();
    ctx.strokeStyle = hexA(d.color2, 0.8); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(ox, oy, r * 1.8, r * 0.6, t * 2, 0, TAU); ctx.stroke();
  } else {
    const bx = hx + ca * 4, by = hy + sa * 4;
    const R = 20 * S;
    const pull = charging ? cr * 11 : h.swing ? 7 * reach : 0;
    ctx.beginPath();
    ctx.moveTo(bx + px * R, by + py * R);
    ctx.quadraticCurveTo(bx + ca * 16, by + sa * 16, bx - px * R, by - py * R);
    ctx.strokeStyle = INK; ctx.lineWidth = line ? 6.5 : 3; ctx.stroke();
    ctx.strokeStyle = '#8a6040'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.strokeStyle = d.color2; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx + px * R * 0.98, by + py * R * 0.98); ctx.lineTo(bx + px * R * 0.6 + ca * 9, by + py * R * 0.6 + sa * 9); ctx.stroke();
    const sx = bx - ca * pull, sy = by - sa * pull;
    ctx.strokeStyle = 'rgba(235,245,255,0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(bx + px * R, by + py * R); ctx.lineTo(sx, sy); ctx.lineTo(bx - px * R, by - py * R); ctx.stroke();
    if (charging || h.swing) {
      inkLine(ctx, sx, sy, bx + ca * 20, by + sa * 20, '#e6fbff', 2, 1);
      if (charging) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glow(ctx, bx + ca * 20, by + sa * 20, 10 + cr * 14, d.color2, 0.4 + cr * 0.4);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function shade(hex) {
  if (hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.7));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ───────────── 坐骑 ─────────────
function drawMount(ctx, m, x, base, side, t, walk, white) {
  const c1 = white ? '#fff' : m.color, c2 = white ? '#fff' : m.color2;
  const dark = white ? '#fff' : shade(m.color);
  ctx.save();
  ctx.translate(x, base);
  ctx.scale(side * 1.15, 1.15);
  const st = Math.sin(walk * 1.2);
  const legA = st * 0.6, legB = -st * 0.6;
  const legsAt = (pts, len, w, col) => {
    for (const [lx, ly, rot] of pts) {
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(rot);
      ctx.beginPath(); ctx.rect(-w / 2, 0, w, len); ink(ctx, col, 1.6);
      ctx.restore();
    }
  };
  if (m.id === 'wolf') {
    legsAt([[-16, -18, legB], [14, -18, legA]], 18, 5, dark);
    ctx.beginPath(); ctx.moveTo(-26, -30); ctx.quadraticCurveTo(-44, -36 + st * 3, -46, -24); ctx.quadraticCurveTo(-38, -28, -26, -24); ink(ctx, c1, 2);
    ctx.beginPath(); ctx.ellipse(0, -27, 27, 11, 0, 0, TAU); ink(ctx, c1, 2.2);
    ctx.beginPath(); ctx.ellipse(-2, -31, 18, 4, 0, 0, TAU); ctx.fillStyle = c2; ctx.fill();
    legsAt([[-10, -18, legA], [20, -18, legB]], 18, 5, c1);
    ctx.beginPath(); ctx.moveTo(18, -34); ctx.lineTo(28, -44); ctx.lineTo(42, -36); ctx.lineTo(44, -31); ctx.lineTo(30, -28); ctx.closePath(); ink(ctx, c1, 2);
    ctx.beginPath(); ctx.moveTo(24, -42); ctx.lineTo(26, -52); ctx.lineTo(31, -43); ctx.closePath(); ink(ctx, c1, 1.6);
    if (!white) { ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.arc(34, -38, 1.8, 0, TAU); ctx.fill(); }
  } else if (m.id === 'boar') {
    legsAt([[-14, -14, legB], [12, -14, legA]], 14, 6, dark);
    ctx.beginPath(); ctx.ellipse(0, -24, 27, 15, 0, 0, TAU); ink(ctx, c1, 2.2);
    ctx.beginPath(); ctx.moveTo(-20, -36); for (let k = 0; k < 6; k++) ctx.lineTo(-16 + k * 7, -40 - (k % 2) * 5); ctx.lineTo(18, -34); ctx.closePath(); ink(ctx, dark, 1.6);
    legsAt([[-8, -14, legA], [18, -14, legB]], 14, 6, c1);
    ctx.beginPath(); ctx.ellipse(26, -24, 11, 10, 0, 0, TAU); ink(ctx, c1, 2);
    ctx.beginPath(); ctx.ellipse(35, -22, 5, 4, 0, 0, TAU); ink(ctx, c2, 1.5);
    ctx.beginPath(); ctx.moveTo(30, -18); ctx.quadraticCurveTo(38, -18, 40, -28); ctx.lineTo(36, -20); ctx.closePath(); ink(ctx, '#f0e8d8', 1.4);
    if (!white) { ctx.fillStyle = '#ff6a4a'; ctx.beginPath(); ctx.arc(28, -28, 1.8, 0, TAU); ctx.fill(); }
  } else if (m.id === 'raptor') {
    ctx.beginPath(); ctx.moveTo(-14, -34); ctx.quadraticCurveTo(-36, -38 + st * 3, -54, -30); ctx.quadraticCurveTo(-34, -28, -12, -26); ctx.closePath(); ink(ctx, c1, 2);
    for (const [lx, rot] of [[-4, legB], [6, legA]]) {
      ctx.save(); ctx.translate(lx, -28); ctx.rotate(rot);
      ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.lineTo(2, 14); ctx.lineTo(6, 26); ctx.lineTo(10, 28); ctx.lineTo(-2, 28); ctx.lineTo(-3, 14); ctx.closePath();
      ink(ctx, lx < 0 ? dark : c1, 1.6);
      ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(0, -33, 20, 11, -0.1, 0, TAU); ink(ctx, c1, 2.2);
    ctx.beginPath(); ctx.ellipse(-2, -37, 14, 3.5, -0.1, 0, TAU); ctx.fillStyle = c2; ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, -38); ctx.quadraticCurveTo(22, -52, 26, -56); ctx.lineTo(42, -52); ctx.lineTo(42, -47); ctx.lineTo(28, -46); ctx.quadraticCurveTo(22, -40, 18, -30); ctx.closePath(); ink(ctx, c1, 2);
    if (!white) { ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(31, -52, 1.8, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(30, -47.5); ctx.lineTo(41, -48.5); ctx.stroke(); }
  } else {
    legsAt([[-16, -26, legB * 0.8], [14, -26, legA * 0.8]], 26, 4, dark);
    ctx.beginPath(); ctx.ellipse(0, -33, 24, 10, 0, 0, TAU); ink(ctx, c1, 2.2);
    ctx.fillStyle = white ? '#fff' : '#b8c8d8';
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(-10 + k * 6, -35 + (k % 2) * 3, 1.6, 0, TAU); ctx.fill(); }
    legsAt([[-10, -26, legA * 0.8], [20, -26, legB * 0.8]], 26, 4, c1);
    ctx.beginPath(); ctx.moveTo(14, -38); ctx.quadraticCurveTo(18, -50, 22, -56); ctx.lineTo(34, -52); ctx.lineTo(32, -47); ctx.lineTo(24, -47); ctx.quadraticCurveTo(22, -40, 20, -30); ctx.closePath(); ink(ctx, c1, 2);
    ctx.save();
    if (!white) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 22, -64, 16, m.color2, 0.5); }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 4.5;
    const antler = () => { ctx.beginPath(); ctx.moveTo(22, -56); ctx.lineTo(18, -70); ctx.lineTo(12, -76); ctx.moveTo(18, -70); ctx.lineTo(24, -78); ctx.moveTo(21, -62); ctx.lineTo(28, -68); ctx.stroke(); };
    antler();
    ctx.strokeStyle = c2; ctx.lineWidth = 2.2; antler();
  }
  ctx.restore();
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
  if (m.caster) {
    ctx.beginPath(); ctx.moveTo(-9, -33); ctx.lineTo(12, -33); ctx.lineTo(-2, -52); ctx.closePath(); ink(ctx, white ? '#fff' : '#3a2a6a', 1.8);
    inkLine(ctx, 10, -4, 14, -30, '#6b4a33', 2, 1.2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 14, -32, 10 + (m.windup > 0 ? 6 : 0), tc, 0.7); ctx.restore();
    ctx.restore();
    return;
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
  const pa = Math.atan2(p.vy * YS, p.vx), pca = Math.cos(pa), psa = Math.sin(pa);
  if (p.kind === 'knife') {
    ctx.beginPath(); ctx.moveTo(x + pca * 10, y + psa * 10); ctx.lineTo(x - psa * 3, y + pca * 3); ctx.lineTo(x - pca * 8, y - psa * 8); ctx.lineTo(x + psa * 3, y - pca * 3); ctx.closePath();
    ink(ctx, '#e8eef8', 1.6);
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 14, p.color, 0.5);
    ctx.restore(); return;
  }
  if (p.kind === 'spear') {
    inkLine(ctx, x - pca * 46, y - psa * 46, x, y, '#8a6a4a', 3, 1.5);
    ctx.beginPath(); ctx.moveTo(x + pca * 16, y + psa * 16); ctx.lineTo(x - psa * 6, y + pca * 6); ctx.lineTo(x - pca * 4, y - psa * 4); ctx.lineTo(x + psa * 6, y - pca * 6); ctx.closePath();
    ink(ctx, '#e8eef8', 1.8);
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 26, p.color, 0.55);
    ctx.restore(); return;
  }
  if (p.kind === 'boomerang') {
    const sp = performance.now() / 40;
    ctx.translate(x, y); ctx.rotate(sp);
    ctx.beginPath(); ctx.moveTo(-18, -4); ctx.quadraticCurveTo(0, -14, 18, -4); ctx.quadraticCurveTo(0, -6, -18, -4); ctx.moveTo(-4, -18); ctx.quadraticCurveTo(-14, 0, -4, 18); ctx.quadraticCurveTo(-6, 0, -4, -18);
    ink(ctx, p.color, 2);
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 28, p.color, 0.4);
    ctx.restore(); return;
  }
  if (p.kind === 'hook') {
    const o = p.owner;
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(o.x, o.y * YS - 34); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = '#9a9ab0'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x + pca * 4, y + psa * 4, 9, pa - 2.2, pa + 2.2); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#dfe5f5'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore(); return;
  }
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
    void g;
    ctx.strokeStyle = hexA(p.color, 0.5);
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
    ink(ctx, p.color, 1.5);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, big ? 18 : 12, p.color, 0.5);
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
  const col = z.color || '#ff7a2f';
  const fade = Math.min(1, z.life / 0.4, z.age / 0.15);
  ctx.save();
  ctx.globalAlpha = fade;
  switch (z.kind) {
    case 'fire': {
      ctx.fillStyle = 'rgba(30,8,4,0.35)';
      ctx.beginPath(); ctx.ellipse(x, gy, r * 0.9, r * 0.9 * YS, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = radial(ctx, x, gy, r, col, 0.6);
      ctx.beginPath(); ctx.ellipse(x, gy, r, r * YS, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3; i++) {
        const ox = Math.sin(t * 3 + i * 2 + z.x) * r * 0.45;
        const hh = 16 + Math.sin(t * 12 + i * 3) * 5;
        flame(ctx, x + ox, gy + (i - 1) * 5, 7, hh, col, true);
        flame(ctx, x + ox, gy + (i - 1) * 5, 4, hh * 0.6, '#ffe8b0');
      }
      break;
    }
    case 'aura': case 'whirl': {
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(x, gy); ctx.scale(1, YS);
      const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r);
      g.addColorStop(0, hexA(col, 0)); g.addColorStop(0.8, hexA(col, 0.38)); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      const sp = z.kind === 'whirl' ? 14 : 7;
      for (let i = 0; i < 4; i++) {
        const a = t * sp + (i * TAU) / 4;
        ctx.strokeStyle = i % 2 ? '#ffffffcc' : hexA(col, 0.9);
        ctx.lineWidth = 7 - i;
        ctx.beginPath(); ctx.arc(0, 0, r * (0.75 + i * 0.06), a, a + 1.3); ctx.stroke();
      }
      break;
    }
    case 'storm': case 'rain': case 'cloud': {
      ctx.translate(x, gy); ctx.scale(1, YS);
      ctx.fillStyle = hexA(col, z.kind === 'cloud' ? 0.25 : 0.14);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(col, 0.85);
      ctx.lineWidth = 3;
      ctx.setLineDash([22, 10]);
      ctx.lineDashOffset = -t * 70;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      if (z.kind === 'cloud') {
        for (let i = 0; i < 7; i++) {
          const a = i * 0.9 + t * 0.4, rr = r * (0.3 + (i % 3) * 0.2);
          ctx.fillStyle = hexA(col, 0.18);
          ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.35, 0, TAU); ctx.fill();
        }
      } else {
        ctx.strokeStyle = hexA(col, 0.35);
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (0.3 + i * 0.2), -t * (2 + i), -t * (2 + i) + 3.5); ctx.stroke(); }
      }
      break;
    }
    case 'vortex': {
      ctx.translate(x, gy); ctx.scale(1, YS);
      ctx.fillStyle = 'rgba(10,6,24,0.45)';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = hexA(col, 0.25 + i * 0.12);
        ctx.lineWidth = 3;
        const a0 = -t * (3 + i) + i;
        ctx.beginPath(); ctx.arc(0, 0, r * (1 - i * 0.18), a0, a0 + 2.6); ctx.stroke();
      }
      ctx.fillStyle = radial(ctx, 0, 0, r * 0.4, col, 0.6);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, TAU); ctx.fill();
      break;
    }
    case 'trap': {
      const mine = z.team === viewerTeam;
      const armed = z.age >= 0.6;
      ctx.globalAlpha = fade * (mine ? 1 : 0.4);
      ctx.translate(x, gy); ctx.scale(1, YS);
      ctx.fillStyle = 'rgba(20,20,40,0.45)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.stroke();
      ctx.strokeStyle = armed ? col : hexA(col, 0.5);
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.stroke();
      ctx.rotate(t * 0.8);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        ctx.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15);
        ctx.lineTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hexA(col, 0.14 + Math.sin(t * 4) * 0.07);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.fill();
      break;
    }
    case 'warn': case 'warnRing': {
      const k = 1 - z.life / z.max;
      ctx.globalAlpha = 1;
      ctx.translate(x, gy); ctx.scale(1, YS);
      ctx.fillStyle = hexA(col, 0.12 + k * 0.2);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.fillStyle = hexA(col, 0.3);
      ctx.beginPath(); ctx.arc(0, 0, r * k, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexA(col, 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      if (z.kind === 'warn') {
        // 下落中的陨石
        ctx.setTransform(ctx.getTransform());
        ctx.scale(1, 1 / YS);
        const mz = (1 - k) * 420;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = radial(ctx, 0, -mz, 40, col, 0.9);
        ctx.beginPath(); ctx.arc(0, -mz, 40, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath(); ctx.arc(0, -mz, 16, 0, TAU); ink(ctx, '#3a2a30', 2.5, INK);
      }
      break;
    }
    case 'orbit': {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const a = z.age * 5 + (k * TAU) / 3;
        const bx = x + Math.cos(a) * r, by = (z.y + Math.sin(a) * r) * YS - 30;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(z.age * 20);
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, 0, 0, 18, col, 0.5);
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(4, 0); ctx.lineTo(0, 11); ctx.lineTo(-4, 0); ctx.closePath(); ink(ctx, col, 1.8);
        ctx.restore();
      }
      break;
    }
    case 'tether': {
      const tg = z.target;
      if (!tg) break;
      ctx.globalCompositeOperation = 'lighter';
      const x0 = z.owner.x, y0 = z.owner.y * YS - 34, x1 = tg.x, y1 = tg.y * YS - 30;
      ctx.strokeStyle = hexA(col, 0.35); ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 30 + Math.sin(t * 10) * 8, x1, y1); ctx.stroke();
      ctx.strokeStyle = hexA(col, 0.9); ctx.lineWidth = 3; ctx.stroke();
      break;
    }
    case 'turret': {
      ctx.globalAlpha = 1;
      shadow(ctx, x, z.y, 18, 0.45);
      ctx.beginPath(); ctx.moveTo(x - 10, gy); ctx.lineTo(x - 7, gy - 44); ctx.lineTo(x + 7, gy - 44); ctx.lineTo(x + 10, gy); ctx.closePath(); ink(ctx, '#5a4a3a', 2.2);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - 9, gy - k * 11); ctx.lineTo(x + 9, gy - k * 11); ctx.stroke(); }
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, gy - 54, 22, col, 0.6 + Math.sin(t * 6) * 0.15);
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); ctx.moveTo(x, gy - 64); ctx.lineTo(x + 7, gy - 54); ctx.lineTo(x, gy - 44); ctx.lineTo(x - 7, gy - 54); ctx.closePath(); ink(ctx, col, 2);
      break;
    }
    case 'lob': {
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(8,3,16,0.35)';
      ctx.beginPath(); ctx.ellipse(x, gy, 10, 4, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexA(col, 0.5); ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.ellipse(z.tx, z.ty * YS, r, r * YS, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      const by = gy - (z.z || 0);
      ctx.beginPath(); ctx.arc(x, by, 10, 0, TAU); ink(ctx, '#3a3048', 2.2);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x + 4, by - 8, 10, col, 0.9);
      break;
    }
  }
  ctx.restore();
}

function radial(ctx, x, y, r, col, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(col, a));
  g.addColorStop(1, hexA(col, 0));
  return g;
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

// ───────────── 墙上烛台 / 骸骨 ─────────────
function sconce(ctx, x, gy, h, t, seed) {
  const y = gy - h;
  ctx.beginPath(); ctx.moveTo(x - 4, y + 16); ctx.lineTo(x, y + 4); ctx.lineTo(x + 4, y + 16); ctx.closePath(); ink(ctx, '#3a2e4a', 1.8);
  ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.lineTo(x + 6, y + 8); ctx.lineTo(x - 6, y + 8); ctx.closePath(); ink(ctx, '#4a3c5e', 1.8);
  const fl = Math.sin(t * 13 + seed * 20) * 2 + Math.sin(t * 7.3 + seed * 5) * 1.5;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y - 12, 60, '#ff8a30', 0.4);
  ctx.restore();
  flame(ctx, x, y, 10, 26 + fl, '#ff5a1a', true);
  flame(ctx, x, y, 6, 18 + fl * 0.7, '#ffb347');
  flame(ctx, x, y, 3, 9 + fl * 0.4, '#fff3c4');
}

function bones(ctx, x, gy, s) {
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(s, s);
  inkLine(ctx, -12, 2, 10, -2, '#e8e0cc', 3, 1.2);
  inkLine(ctx, -8, -4, 8, 4, '#d8d0bc', 3, 1.2);
  ctx.beginPath(); ctx.arc(14, -6, 6, 0, TAU); ink(ctx, '#ece4d0', 1.6);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(12, -7, 1.4, 0, TAU); ctx.arc(16, -7, 1.4, 0, TAU); ctx.fill();
  ctx.restore();
}

// ───────────── 野怪 ─────────────
export function drawMonster(ctx, m, t) {
  const x = m.x, gy = m.y * YS;
  const white = m.flash > 0;
  const moving = Math.hypot(m.vx, m.vy) > 5;
  const ph = m.phase;
  const W = (c) => (white ? '#ffffff' : c);
  const wind = m.windup > 0 ? 1 - m.windup / (m.special ? 0.9 : 0.35) : 0;
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(m.face, 1);
  if (m.type === 'skeleton') {
    const bob = moving ? Math.abs(Math.sin(ph * 9)) * 2 : 0;
    const st = moving ? Math.sin(ph * 9) * 3 : 0;
    inkLine(ctx, -3 + st, -14, -4 + st, 0, W('#e8e0cc'), 2.4, 1.2);
    inkLine(ctx, 3 - st, -14, 4 - st, 0, W('#e8e0cc'), 2.4, 1.2);
    ctx.translate(0, -bob);
    ctx.beginPath(); ctx.ellipse(0, -24, 8, 11, 0, 0, TAU); ink(ctx, W('#3a3040'), 2);
    ctx.strokeStyle = W('#e8e0cc'); ctx.lineWidth = 1.6;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-6, -29 + k * 5); ctx.quadraticCurveTo(0, -26 + k * 5, 6, -29 + k * 5); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(1, -41, 8.5, 0, TAU); ink(ctx, W('#ece4d0'), 2);
    if (!white) {
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(3, -42, 2.4, 0, TAU); ctx.arc(8, -42, 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff6a4a'; ctx.beginPath(); ctx.arc(3, -42, 1, 0, TAU); ctx.arc(8, -42, 0.9, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.fillRect(2, -36, 7, 1.5);
    }
    const ra = -0.6 + wind * 1.8;
    ctx.save(); ctx.translate(7, -28); ctx.rotate(ra);
    ctx.beginPath(); ctx.moveTo(-1.5, 0); ctx.lineTo(1.5, 0); ctx.lineTo(1, -24); ctx.lineTo(0, -28); ctx.lineTo(-1, -24); ctx.closePath(); ink(ctx, W('#9a8a7a'), 1.5);
    ctx.restore();
  } else if (m.type === 'spider') {
    const st = moving ? ph * 14 : ph * 2;
    ctx.strokeStyle = INK;
    for (let k = 0; k < 4; k++) {
      for (const s2 of [-1, 1]) {
        const bx = -6 + k * 5, a = Math.sin(st + k + (s2 > 0 ? 1.5 : 0)) * 0.3;
        ctx.lineWidth = 4.5; ctx.strokeStyle = INK;
        ctx.beginPath(); ctx.moveTo(bx, -12); ctx.lineTo(bx + s2 * 10 + a * 8, -20); ctx.lineTo(bx + s2 * 18 + a * 10, 0); ctx.stroke();
        ctx.lineWidth = 2.2; ctx.strokeStyle = W('#4a2a5a');
        ctx.stroke();
      }
    }
    ctx.beginPath(); ctx.ellipse(-10, -14, 14, 11, 0, 0, TAU); ink(ctx, W('#5a2a6a'), 2.2);
    if (!white) { ctx.fillStyle = '#9be24a'; ctx.beginPath(); ctx.moveTo(-14, -20); ctx.lineTo(-8, -14); ctx.lineTo(-14, -8); ctx.lineTo(-20, -14); ctx.closePath(); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(8, -14, 9, 8, 0, 0, TAU); ink(ctx, W('#4a2258'), 2);
    if (!white) { ctx.fillStyle = '#c8ff6a'; for (const [ex, ey] of [[11, -17], [14, -15], [12, -12]]) { ctx.beginPath(); ctx.arc(ex, ey, 1.6, 0, TAU); ctx.fill(); } }
  } else if (m.type === 'wolf') {
    const bob = moving ? Math.abs(Math.sin(ph * 8)) * 3 : Math.sin(ph * 2);
    const st = moving ? Math.sin(ph * 8) * 0.6 : 0;
    for (const [lx, r] of [[-6, st], [6, -st]]) {
      ctx.save(); ctx.translate(lx, -20); ctx.rotate(r);
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(6, 20); ctx.lineTo(-2, 20); ctx.closePath(); ink(ctx, W('#3a3448'), 1.8);
      ctx.restore();
    }
    ctx.translate(0, -bob);
    ctx.beginPath(); ctx.moveTo(-14, -18); ctx.quadraticCurveTo(-18, -44, 0, -52); ctx.quadraticCurveTo(18, -50, 16, -22); ctx.closePath(); ink(ctx, W('#4a4258'), 2.4);
    ctx.beginPath(); ctx.moveTo(-12, -46); for (let k = 0; k < 5; k++) ctx.lineTo(-10 + k * 5, -54 - (k % 2) * 6); ctx.lineTo(12, -48); ctx.closePath(); ink(ctx, W('#2e2a3a'), 1.8);
    ctx.beginPath(); ctx.moveTo(8, -50); ctx.lineTo(14, -62); ctx.lineTo(16, -50); ctx.lineTo(28, -46); ctx.lineTo(28, -40); ctx.lineTo(12, -38); ctx.closePath(); ink(ctx, W('#4a4258'), 2);
    if (!white) {
      ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(18, -46, 1.8, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 18, -46, 6, '#ff3a3a', 0.8); ctx.restore();
    }
    const ra = 0.4 - wind * 1.6;
    ctx.save(); ctx.translate(10, -34); ctx.rotate(ra);
    ctx.beginPath(); ctx.rect(-3, 0, 6, 16); ink(ctx, W('#4a4258'), 1.8);
    ctx.fillStyle = W('#e8e0cc'); for (const cx of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(cx - 1, 16); ctx.lineTo(cx, 22); ctx.lineTo(cx + 1, 16); ctx.fill(); }
    ctx.restore();
  } else if (m.type === 'golem' || m.type === 'colossus') {
    const big = m.type === 'colossus' ? 1.7 : 1;
    ctx.scale(big, big);
    const bob = Math.sin(ph * 2) * 1.5;
    const core = m.type === 'colossus' ? '#ffb347' : '#4fe0d0';
    ctx.beginPath(); ctx.rect(-14, -18, 10, 18); ink(ctx, W('#4a4268'), 2.2);
    ctx.beginPath(); ctx.rect(5, -18, 10, 18); ink(ctx, W('#4a4268'), 2.2);
    ctx.translate(0, bob);
    ctx.beginPath(); ctx.moveTo(-22, -20); ctx.lineTo(-26, -54); ctx.lineTo(-10, -66); ctx.lineTo(14, -64); ctx.lineTo(26, -50); ctx.lineTo(22, -18); ctx.closePath(); ink(ctx, W('#5a5280'), 2.6);
    ctx.beginPath(); ctx.moveTo(-22, -20); ctx.lineTo(-26, -54); ctx.lineTo(-14, -60); ctx.lineTo(-10, -22); ctx.closePath(); ctx.fillStyle = W('#6e66a0'); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-6, -60); ctx.lineTo(0, -44); ctx.lineTo(-8, -30); ctx.moveTo(10, -58); ctx.lineTo(14, -40); ctx.stroke();
    if (!white) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 2, -40, 18, core, 0.6);
      ctx.restore();
      ctx.fillStyle = core; ctx.beginPath(); ctx.moveTo(2, -48); ctx.lineTo(7, -40); ctx.lineTo(2, -32); ctx.lineTo(-3, -40); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(-6, -64); ctx.lineTo(-4, -78); ctx.lineTo(14, -78); ctx.lineTo(16, -64); ctx.closePath(); ink(ctx, W('#5a5280'), 2.2);
    if (!white) { ctx.fillStyle = core; ctx.fillRect(4, -73, 8, 3); }
    const ra = -0.2 - wind * 1.5;
    ctx.save(); ctx.translate(20, -52); ctx.rotate(ra);
    ctx.beginPath(); ctx.rect(-6, 0, 12, 26); ink(ctx, W('#4a4268'), 2.2);
    ctx.beginPath(); ctx.arc(0, 30, 9, 0, TAU); ink(ctx, W('#5a5280'), 2.2);
    ctx.restore();
  } else if (m.type === 'dragon') {
    const flap = Math.sin(ph * 4) * 0.35;
    ctx.scale(1.6, 1.6);
    // 后翼
    ctx.save(); ctx.translate(-6, -54); ctx.rotate(-0.4 + flap);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, -40); ctx.lineTo(-44, -30); ctx.lineTo(-40, -12); ctx.lineTo(-26, -8); ctx.lineTo(-20, 2); ctx.closePath(); ink(ctx, W('#4a1a2a'), 2);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(-20, -30); ctx.quadraticCurveTo(-50, -26 + Math.sin(ph * 2) * 4, -62, -10); ctx.lineTo(-56, -8); ctx.quadraticCurveTo(-42, -18, -18, -20); ctx.closePath(); ink(ctx, W('#7a2a3a'), 2);
    for (const lx of [-12, 10]) { ctx.beginPath(); ctx.rect(lx - 5, -18, 10, 18); ink(ctx, W('#5a2030'), 2); }
    ctx.beginPath(); ctx.ellipse(0, -32, 28, 18, -0.1, 0, TAU); ink(ctx, W('#8a2a3a'), 2.4);
    ctx.beginPath(); ctx.ellipse(4, -26, 18, 9, -0.1, 0, TAU); ctx.fillStyle = W('#d8a050'); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18, -40); ctx.quadraticCurveTo(30, -66, 34, -70); ctx.lineTo(54, -66); ctx.lineTo(56, -58); ctx.lineTo(40, -56); ctx.quadraticCurveTo(30, -46, 26, -30); ctx.closePath(); ink(ctx, W('#8a2a3a'), 2.2);
    ctx.beginPath(); ctx.moveTo(34, -70); ctx.lineTo(30, -82); ctx.lineTo(40, -70); ctx.closePath(); ink(ctx, W('#e8dcc0'), 1.6);
    if (!white) {
      ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(44, -64, 2, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 56, -60, 16 + wind * 20, '#ff7a2f', 0.5 + wind * 0.4); ctx.restore();
    }
    ctx.save(); ctx.translate(6, -56); ctx.rotate(0.3 - flap);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-24, -46); ctx.lineTo(-40, -40); ctx.lineTo(-38, -20); ctx.lineTo(-22, -14); ctx.lineTo(-16, 0); ctx.closePath(); ink(ctx, W('#6a2030'), 2.2);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-38, -20); ctx.moveTo(0, 0); ctx.lineTo(-30, -36); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function drawChest(ctx, c, t) {
  const x = c.x + (c.wobble > 0 ? Math.sin(t * 60) * 2 : 0), gy = c.y * YS;
  const white = c.flash > 0;
  shadow(ctx, c.x, c.y, 22, 0.45);
  ctx.beginPath(); ctx.rect(x - 18, gy - 22, 36, 22); ink(ctx, white ? '#fff' : '#7a4a2a', 2.2);
  ctx.beginPath(); ctx.moveTo(x - 19, gy - 22); ctx.quadraticCurveTo(x, gy - 40, x + 19, gy - 22); ctx.closePath(); ink(ctx, white ? '#fff' : '#9a5e34', 2.2);
  if (!white) {
    ctx.fillStyle = '#e8b84a';
    ctx.fillRect(x - 18, gy - 23, 36, 3);
    ctx.fillRect(x - 2.5, gy - 30, 5, 12);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, gy - 22, 30, '#ffd27a', 0.25 + Math.sin(t * 3) * 0.1); ctx.restore();
  }
}

const ICON_DRAW = {
  sword: (c) => { c.moveTo(-6, 6); c.lineTo(6, -6); c.moveTo(-3, 1); c.lineTo(1, 5); },
  axe: (c) => { c.moveTo(-5, 6); c.lineTo(4, -5); c.moveTo(1, -6); c.quadraticCurveTo(8, -6, 6, 1); },
  orb: (c) => { c.arc(0, 0, 5, 0, TAU); },
  armor: (c) => { c.moveTo(-6, -5); c.lineTo(6, -5); c.lineTo(4, 6); c.lineTo(-4, 6); c.closePath(); },
  heart: (c) => { c.moveTo(0, 6); c.lineTo(-6, -1); c.arc(-3, -2, 3, Math.PI, 0); c.arc(3, -2, 3, Math.PI, 0); c.lineTo(0, 6); },
  boots: (c) => { c.moveTo(-3, -6); c.lineTo(-3, 4); c.lineTo(6, 4); c.lineTo(6, 1); c.lineTo(2, 0); c.lineTo(2, -6); },
  fang: (c) => { c.moveTo(-5, -5); c.quadraticCurveTo(0, 8, 5, -5); },
  hourglass: (c) => { c.moveTo(-5, -6); c.lineTo(5, -6); c.lineTo(-5, 6); c.lineTo(5, 6); c.closePath(); },
  feather: (c) => { c.moveTo(-5, 6); c.quadraticCurveTo(-4, -6, 6, -6); c.quadraticCurveTo(4, 4, -5, 6); },
  shield: (c) => { c.moveTo(0, -6); c.lineTo(6, -3); c.quadraticCurveTo(5, 4, 0, 7); c.quadraticCurveTo(-5, 4, -6, -3); c.closePath(); },
  scythe: (c) => { c.moveTo(-4, 6); c.lineTo(2, -6); c.quadraticCurveTo(-6, -8, -7, -2); },
  crown: (c) => { c.moveTo(-6, 4); c.lineTo(-6, -4); c.lineTo(-2, 0); c.lineTo(0, -6); c.lineTo(2, 0); c.lineTo(6, -4); c.lineTo(6, 4); c.closePath(); },
  book: (c) => { c.rect(-5, -6, 10, 12); c.moveTo(-2, -6); c.lineTo(-2, 6); },
};
export function itemIcon(ctx, icon, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  (ICON_DRAW[icon] || ICON_DRAW.orb)(ctx);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

export function drawLoot(ctx, l, t, color) {
  const x = l.x, gy = l.y * YS;
  const bob = Math.sin(t * 3 + l.x) * 3;
  const y = gy - 22 + bob;
  const r = l.item.r;
  ctx.fillStyle = 'rgba(8,3,16,0.4)';
  ctx.beginPath(); ctx.ellipse(x, gy, 12, 5, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (r >= 2) {
    const g = ctx.createLinearGradient(0, gy - 140, 0, gy);
    g.addColorStop(0, hexA(color, 0));
    g.addColorStop(1, hexA(color, 0.45));
    ctx.fillStyle = g;
    ctx.fillRect(x - 6, gy - 140, 12, 140);
  }
  glow(ctx, x, y, 26 + r * 4, color, 0.45);
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2 + l.x) * 0.15);
  ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(11, 0); ctx.lineTo(0, 13); ctx.lineTo(-11, 0); ctx.closePath();
  ink(ctx, '#2a2040', 2.2, color);
  ctx.restore();
  itemIcon(ctx, l.item.icon, x, y, 0.9, color);
}

export function drawDynWall(ctx, w, t) {
  const x = w.x, gy = w.y * YS;
  const k = Math.min(1, (w.max - w.life) / 0.15, w.life / 0.3);
  const h = w.h * k;
  shadow(ctx, w.x, w.y, w.r * 1.2, 0.4);
  ctx.beginPath();
  ctx.moveTo(x - w.r, gy); ctx.lineTo(x - w.r * 0.7, gy - h * 0.7); ctx.lineTo(x - w.r * 0.1, gy - h); ctx.lineTo(x + w.r * 0.5, gy - h * 0.8); ctx.lineTo(x + w.r, gy);
  ctx.closePath();
  ink(ctx, w.color, 2.5);
  ctx.beginPath(); ctx.moveTo(x - w.r * 0.7, gy - h * 0.7); ctx.lineTo(x - w.r * 0.1, gy - h); ctx.lineTo(x - w.r * 0.2, gy); ctx.lineTo(x - w.r * 0.8, gy); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, gy - h * 0.5, w.r * 2, w.color, 0.2); ctx.restore();
}
