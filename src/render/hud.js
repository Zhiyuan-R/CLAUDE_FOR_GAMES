// 屏幕空间 HUD：双方状态、比分、技能栏、小地图、横幅提示
import { FONT, TEAM_COLORS, WORLD, BOUNDS, YS } from '../config.js';
import { hexA } from './draw.js';

export function drawHUD(ctx, game, R, t) {
  const W = R.W, H = R.H;
  const s = Math.min(1.2, Math.max(0.7, W / 1500));
  const p = game.player, e = game.enemy;

  heroPanel(ctx, p, 18, 18, s, false, '你');
  heroPanel(ctx, e, W - 18, 18, s, true, '电脑');

  // 比分与时间
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = W / 2;
  panelBg(ctx, cx - 110 * s, 14, 220 * s, 56 * s, 12);
  ctx.font = `900 ${26 * s}px ${FONT}`;
  ctx.fillStyle = TEAM_COLORS[0];
  ctx.fillText(String(game.score[0]), cx - 50 * s, 14 + 24 * s);
  ctx.fillStyle = TEAM_COLORS[1];
  ctx.fillText(String(game.score[1]), cx + 50 * s, 14 + 24 * s);
  ctx.fillStyle = '#d9d2f2';
  ctx.font = `700 ${14 * s}px ${FONT}`;
  const mm = Math.floor(game.time / 60), ss = Math.floor(game.time % 60);
  ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, cx, 14 + 24 * s);
  ctx.font = `500 ${11 * s}px ${FONT}`;
  ctx.fillStyle = '#9f97bf';
  ctx.fillText(`下一波小兵 ${Math.max(0, Math.ceil(game.waveT))}s`, cx, 14 + 45 * s);
  ctx.restore();

  skillBar(ctx, p, W / 2, H - 20, s, t);
  minimap(ctx, game, R, W - 18, H - 18, s);
  controlsHint(ctx, 18, H - 18, s);

  // 横幅
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  game.banners.slice(-2).forEach((b, i) => {
    const k = b.life / b.max;
    const appear = Math.min(1, (1 - k) * 8);
    const a = Math.min(1, k * 3) * appear;
    const y = H * 0.24 + i * 70 * s;
    ctx.globalAlpha = a;
    const bw = 420 * s;
    const g = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
    g.addColorStop(0, 'rgba(10,6,22,0)');
    g.addColorStop(0.5, 'rgba(10,6,22,0.75)');
    g.addColorStop(1, 'rgba(10,6,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - bw, y - 30 * s, bw * 2, (b.sub ? 66 : 54) * s);
    ctx.font = `900 ${30 * s * (1 + (1 - appear) * 0.3)}px ${FONT}`;
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 16;
    ctx.fillText(b.text, cx, y);
    ctx.shadowBlur = 0;
    if (b.sub) {
      ctx.font = `600 ${14 * s}px ${FONT}`;
      ctx.fillStyle = '#d9d2f2';
      ctx.fillText(b.sub, cx, y + 26 * s);
    }
  });
  ctx.restore();

  // 玩家阵亡
  if (!p.alive && game.winner === null) {
    ctx.save();
    ctx.fillStyle = 'rgba(20,14,30,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#efe9ff';
    ctx.font = `900 ${42 * s}px ${FONT}`;
    ctx.fillText(`${Math.ceil(p.respawnT)}`, W / 2, H / 2);
    ctx.font = `600 ${16 * s}px ${FONT}`;
    ctx.fillStyle = '#b9b0d8';
    ctx.fillText('秒后复活', W / 2, H / 2 + 30 * s);
    ctx.restore();
  }
}

function panelBg(ctx, x, y, w, h, r = 10) {
  ctx.fillStyle = 'rgba(14,10,28,0.78)';
  ctx.strokeStyle = 'rgba(160,140,230,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();
}

function heroPanel(ctx, h, x, y, s, right, tag) {
  const w = 300 * s, hgt = 66 * s;
  const x0 = right ? x - w : x;
  ctx.save();
  panelBg(ctx, x0, y, w, hgt, 12);
  // 头像圆
  const ax = right ? x0 + w - 36 * s : x0 + 36 * s, ay = y + hgt / 2;
  ctx.fillStyle = h.def.color;
  ctx.beginPath(); ctx.arc(ax, ay, 24 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = h.def.hood;
  ctx.beginPath(); ctx.arc(ax, ay - 3 * s, 13 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e9c39d';
  ctx.beginPath(); ctx.arc(ax + 3 * s, ay - 2 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = TEAM_COLORS[h.team];
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(ax, ay, 25 * s, 0, Math.PI * 2); ctx.stroke();
  if (!h.alive) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.arc(ax, ay, 25 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${16 * s}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(h.respawnT), ax, ay);
  }
  // 名称
  const tx = right ? x0 + w - 72 * s : x0 + 72 * s;
  ctx.textAlign = right ? 'right' : 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${15 * s}px ${FONT}`;
  ctx.fillStyle = '#efe9ff';
  ctx.fillText(h.name, tx, y + 24 * s);
  const nw = ctx.measureText(h.name).width;
  ctx.font = `600 ${11 * s}px ${FONT}`;
  ctx.fillStyle = TEAM_COLORS[h.team];
  ctx.fillText(tag, right ? tx - nw - 8 * s : tx + nw + 8 * s, y + 24 * s);
  // 血条
  const bw = w - 96 * s, bx = right ? x0 + 14 * s : tx, by = y + 34 * s, bh = 12 * s;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(bx, by, bw, bh);
  const r = Math.max(0, h.hp / h.maxHp);
  ctx.fillStyle = r > 0.5 ? '#5fd17a' : r > 0.25 ? '#f0c040' : '#ff5a5a';
  if (right) ctx.fillRect(bx + bw * (1 - r), by, bw * r, bh);
  else ctx.fillRect(bx, by, bw * r, bh);
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${10 * s}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(h.hp)} / ${h.maxHp}`, bx + bw / 2, by + bh - 2 * s);
  // 战绩
  ctx.font = `600 ${10.5 * s}px ${FONT}`;
  ctx.fillStyle = '#a79fc8';
  ctx.textAlign = right ? 'right' : 'left';
  const kda = `击杀 ${h.stats.kills}  死亡 ${h.stats.deaths}  补刀 ${h.stats.cs}`;
  ctx.fillText(kda, right ? bx + bw : bx, y + 60 * s);
  ctx.restore();
}

function skillBar(ctx, h, cx, bottom, s, t) {
  const d = h.def;
  const slots = [
    { key: 'J', name: d.basic.name, cd: 0, max: 1, icon: 'basic' },
    { key: 'K', name: d.charged.name, cd: Math.max(0, h.chargeCd), max: 0.8, icon: 'charge', active: h.state === 'charging' },
    { key: '空格', name: d.dash.name, cd: Math.max(0, h.dashCd), max: d.dash.cd, icon: 'dash' },
    { key: 'U', name: d.skills[0].name, cd: Math.max(0, h.skillCd[0]), max: d.skills[0].cd, icon: 's1' },
    { key: 'I', name: d.skills[1].name, cd: Math.max(0, h.skillCd[1]), max: d.skills[1].cd, icon: 's2' },
  ];
  const size = 62 * s, gap = 12 * s;
  const total = slots.length * size + (slots.length - 1) * gap;
  let x = cx - total / 2;
  const y = bottom - size - 20 * s;
  panelBg(ctx, x - 14 * s, y - 12 * s, total + 28 * s, size + 40 * s, 14);
  for (const sl of slots) {
    ctx.save();
    const ready = sl.cd <= 0;
    ctx.fillStyle = sl.active ? hexA(d.color2, 0.35) : 'rgba(30,22,52,0.95)';
    ctx.strokeStyle = ready ? hexA(d.color2, 0.9) : 'rgba(120,110,160,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, size, size, 10); ctx.fill(); ctx.stroke();
    skillIcon(ctx, sl.icon, x + size / 2, y + size / 2 - 3 * s, size * 0.32, d, sl.name, s);
    if (!ready) {
      const k = sl.cd / sl.max;
      ctx.fillStyle = 'rgba(5,3,12,0.7)';
      ctx.beginPath();
      ctx.moveTo(x + size / 2, y + size / 2);
      ctx.arc(x + size / 2, y + size / 2, size * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.closePath();
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, size, size, 10); ctx.clip();
      ctx.beginPath();
      ctx.moveTo(x + size / 2, y + size / 2);
      ctx.arc(x + size / 2, y + size / 2, size * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${18 * s}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sl.cd >= 1 ? Math.ceil(sl.cd) : sl.cd.toFixed(1), x + size / 2, y + size / 2);
    }
    // 按键
    ctx.font = `800 ${11 * s}px ${FONT}`;
    const kw = Math.max(18 * s, ctx.measureText(sl.key).width + 8 * s);
    ctx.fillStyle = '#0d0918';
    ctx.strokeStyle = hexA(d.color2, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x + 4 * s, y + 4 * s, kw, 16 * s, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#efe9ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sl.key, x + 4 * s + kw / 2, y + 12.5 * s);
    // 名称
    ctx.font = `600 ${11 * s}px ${FONT}`;
    ctx.fillStyle = ready ? '#e2dcf8' : '#8a83a8';
    ctx.fillText(sl.name, x + size / 2, y + size + 13 * s);
    ctx.restore();
    x += size + gap;
  }
}

function skillIcon(ctx, kind, x, y, r, d, name, s) {
  ctx.save();
  ctx.strokeStyle = d.color2;
  ctx.fillStyle = d.color2;
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  if (kind === 'basic') {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(x - r + i * 6 * s, y + r); ctx.lineTo(x + r + i * 6 * s, y - r); ctx.stroke();
    }
  } else if (kind === 'charge') {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'dash') {
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * r * 0.6;
      ctx.globalAlpha = 0.4 + i * 0.3;
      ctx.beginPath(); ctx.moveTo(x + ox - r * 0.3, y - r * 0.7); ctx.lineTo(x + ox + r * 0.35, y); ctx.lineTo(x + ox - r * 0.3, y + r * 0.7); ctx.stroke();
    }
  } else {
    ctx.font = `900 ${r * 1.6}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = d.color2;
    ctx.shadowBlur = 10;
    ctx.fillText(name[0], x, y + 2 * s);
  }
  ctx.restore();
}

function minimap(ctx, game, R, right, bottom, s) {
  const w = 280 * s, h = w * ((BOUNDS.y1 - BOUNDS.y0 + 80) / WORLD.w) * 1.4;
  const x0 = right - w, y0 = bottom - h;
  ctx.save();
  panelBg(ctx, x0 - 6, y0 - 6, w + 12, h + 12, 10);
  const mx = (x) => x0 + (x / WORLD.w) * w;
  const my = (y) => y0 + ((y - BOUNDS.y0 + 40) / (BOUNDS.y1 - BOUNDS.y0 + 80)) * h;
  ctx.fillStyle = 'rgba(60,50,95,0.6)';
  ctx.fillRect(mx(BOUNDS.x0), my(BOUNDS.y0), mx(BOUNDS.x1) - mx(BOUNDS.x0), my(BOUNDS.y1) - my(BOUNDS.y0));
  ctx.fillStyle = 'rgba(110,100,150,0.5)';
  ctx.fillRect(mx(150), my(395), mx(WORLD.w - 150) - mx(150), my(645) - my(395));
  for (const tw of game.towers) {
    const sz = (tw.kind === 'core' ? 9 : 7) * s;
    ctx.fillStyle = tw.alive ? TEAM_COLORS[tw.team] : '#555';
    ctx.fillRect(mx(tw.x) - sz / 2, my(tw.y) - sz / 2, sz, sz);
  }
  for (const m of game.minions) {
    ctx.fillStyle = hexA(TEAM_COLORS[m.team], 0.8);
    ctx.fillRect(mx(m.x) - 1.5, my(m.y) - 1.5, 3, 3);
  }
  for (const hh of game.heroes) {
    if (!hh.alive) continue;
    ctx.fillStyle = TEAM_COLORS[hh.team];
    ctx.strokeStyle = hh === game.player ? '#fff' : '#000';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx(hh.x), my(hh.y), 5 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // 视野框
  const hw = R.W / 2 / R.zoom, hhgt = R.H / 2 / R.zoom / YS;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx(R.cam.x - hw), my(R.cam.y - hhgt), (hw * 2 / WORLD.w) * w, my(R.cam.y + hhgt) - my(R.cam.y - hhgt));
  ctx.restore();
}

function controlsHint(ctx, x, bottom, s) {
  const lines = ['WASD / 方向键  移动', 'J 普攻 · 按住 K 蓄力', '空格 / L 穿梭 · U I 技能', 'Esc 暂停 · M 静音'];
  ctx.save();
  ctx.font = `600 ${11.5 * s}px ${FONT}`;
  const lh = 17 * s;
  const w = 200 * s, h = lines.length * lh + 14 * s;
  panelBg(ctx, x, bottom - h, w, h, 10);
  ctx.fillStyle = '#b9b0d8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x + 10 * s, bottom - h + 8 * s + i * lh));
  ctx.restore();
}
