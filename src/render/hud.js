// 屏幕空间 HUD：双方阵容、比分、技能栏 + 背包、小地图、击杀播报、横幅
import { FONT, TEAM_COLORS, WORLD, GRID_W, GRID_H, TILE } from '../config.js';
import { solid } from '../map.js';
import { hexA, itemIcon } from './draw.js';
import { RARITY, sumStats, STAT_LABEL } from '../items.js';

export function buildMinimap() {
  const s = 5;
  const c = document.createElement('canvas');
  c.width = GRID_W * s;
  c.height = GRID_H * s;
  const x = c.getContext('2d');
  x.fillStyle = '#0d0918';
  x.fillRect(0, 0, c.width, c.height);
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      if (solid(i, j)) continue;
      x.fillStyle = '#4a4268';
      x.fillRect(i * s, j * s, s, s);
    }
  }
  return c;
}

export function drawHUD(ctx, game, R, t) {
  const W = R.W, H = R.H;
  const s = Math.min(1.15, Math.max(0.7, Math.min(W / 1500, H / 860)));
  const p = game.player;

  playerPanel(ctx, p, 16, 16, s);
  const allies = game.heroes.filter((h) => h.team === p.team && h !== p);
  const foes = game.heroes.filter((h) => h.team !== p.team);
  allies.forEach((h, i) => miniRow(ctx, game, h, 16, 16 + 92 * s + i * 34 * s, s, false));
  foes.forEach((h, i) => miniRow(ctx, game, h, W - 16, 16 + i * 34 * s, s, true));

  // 比分
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = W / 2;
  panelBg(ctx, cx - 120 * s, 14, 240 * s, 58 * s, 12);
  ctx.font = `900 ${26 * s}px ${FONT}`;
  ctx.fillStyle = TEAM_COLORS[0];
  ctx.fillText(String(game.score[0]), cx - 64 * s, 14 + 24 * s);
  ctx.fillStyle = TEAM_COLORS[1];
  ctx.fillText(String(game.score[1]), cx + 64 * s, 14 + 24 * s);
  ctx.fillStyle = '#d9d2f2';
  ctx.font = `700 ${14 * s}px ${FONT}`;
  const mm = Math.floor(game.time / 60), ss = Math.floor(game.time % 60);
  ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, cx, 14 + 24 * s);
  ctx.font = `500 ${11 * s}px ${FONT}`;
  ctx.fillStyle = '#9f97bf';
  ctx.fillText(`下一波小兵 ${Math.max(0, Math.ceil(game.waveT))}s`, cx, 14 + 46 * s);
  // 团队增益
  const tb = game.teamBuffs[p.team];
  const buffs = [];
  if (tb.dragon > 0) buffs.push(['龙魂 伤害+15%', '#ff9a40', tb.dragon]);
  if (tb.colossus > 0) buffs.push(['巨像 减伤+15%', '#e0c080', tb.colossus]);
  buffs.forEach(([txt, col, tl], i) => {
    ctx.font = `700 ${11 * s}px ${FONT}`;
    ctx.fillStyle = col;
    ctx.fillText(`${txt} ${Math.ceil(tl)}s`, cx, 14 + (70 + i * 16) * s);
  });
  ctx.restore();

  // 击杀播报
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = `700 ${12 * s}px ${FONT}`;
  const fy = 16 + 5 * 34 * s + 10;
  game.feed.forEach((f, i) => {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = 'rgba(14,10,28,0.7)';
    const tw = ctx.measureText(f.text).width;
    ctx.fillRect(W - 16 - tw - 14, fy + i * 22 * s, tw + 14, 19 * s);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, W - 23, fy + i * 22 * s + 3 * s);
  });
  ctx.restore();

  skillBar(ctx, p, W / 2, H - 16, s, t);
  minimap(ctx, game, R, W - 16, H - 16, s);
  controlsHint(ctx, 16, H - 16, s);

  // 横幅
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  game.banners.slice(-2).forEach((b, i) => {
    const k = b.life / b.max;
    const appear = Math.min(1, (1 - k) * 8);
    ctx.globalAlpha = Math.min(1, k * 3) * appear;
    const y = H * 0.26 + i * 70 * s;
    const bw = 420 * s;
    const g = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
    g.addColorStop(0, 'rgba(10,6,22,0)');
    g.addColorStop(0.5, 'rgba(10,6,22,0.78)');
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
  ctx.fillStyle = 'rgba(14,10,28,0.8)';
  ctx.strokeStyle = 'rgba(160,140,230,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();
}

function portrait(ctx, h, x, y, r) {
  ctx.fillStyle = h.def.color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = h.def.hood;
  ctx.beginPath(); ctx.arc(x, y - r * 0.12, r * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c9a0';
  ctx.beginPath(); ctx.arc(x + r * 0.12, y - r * 0.08, r * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = TEAM_COLORS[h.team];
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.stroke();
  if (!h.alive) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${r * 0.8}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(h.respawnT), x, y);
  }
}

function hpBarScreen(ctx, x, y, w, h, r, right = false) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = r > 0.5 ? '#5fd17a' : r > 0.25 ? '#f0c040' : '#ff5a5a';
  if (right) ctx.fillRect(x + w * (1 - r), y, w * r, h);
  else ctx.fillRect(x, y, w * r, h);
}

function playerPanel(ctx, h, x, y, s) {
  const w = 320 * s, hgt = 84 * s;
  ctx.save();
  panelBg(ctx, x, y, w, hgt, 12);
  portrait(ctx, h, x + 38 * s, y + 38 * s, 26 * s);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${15 * s}px ${FONT}`;
  ctx.fillStyle = '#efe9ff';
  ctx.fillText(h.name, x + 74 * s, y + 24 * s);
  const nw = ctx.measureText(h.name).width;
  ctx.font = `600 ${11 * s}px ${FONT}`;
  ctx.fillStyle = '#7dffb0';
  ctx.fillText(`你 · ${h.def.role} · ${h.game.roleName(h)}`, x + 74 * s + nw + 8 * s, y + 24 * s);
  const bw = w - 90 * s, bx = x + 74 * s, by = y + 33 * s, bh = 12 * s;
  hpBarScreen(ctx, bx, by, bw, bh, Math.max(0, h.hp / h.maxHp));
  if (h.shield > 0) { ctx.fillStyle = 'rgba(255,229,138,0.85)'; ctx.fillRect(bx, by + bh - 3 * s, bw * Math.min(1, h.shield / h.maxHp), 3 * s); }
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${10 * s}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(h.hp)} / ${h.maxHp}`, bx + bw / 2, by + bh - 2 * s);
  ctx.font = `600 ${10.5 * s}px ${FONT}`;
  ctx.fillStyle = '#a79fc8';
  ctx.textAlign = 'left';
  ctx.fillText(`击杀 ${h.stats.kills}  死亡 ${h.stats.deaths}  助攻 ${h.stats.assists}  补刀 ${h.stats.cs}`, bx, y + 60 * s);
  // 属性汇总
  const a = sumStats(h.items);
  const parts = Object.entries(a).filter(([, v]) => v > 0).map(([k, v]) => STAT_LABEL[k](Math.round(v * 100) / 100));
  ctx.fillStyle = '#d0c6f0';
  ctx.font = `600 ${10 * s}px ${FONT}`;
  ctx.fillText(parts.length ? parts.slice(0, 4).join('  ') : '暂无装备：打野怪、开宝箱、击杀敌人会掉落装备', bx, y + 76 * s);
  ctx.restore();
}

function miniRow(ctx, game, h, x, y, s, right) {
  const w = 210 * s, hgt = 30 * s;
  const x0 = right ? x - w : x;
  ctx.save();
  panelBg(ctx, x0, y, w, hgt, 8);
  const px = right ? x0 + w - 16 * s : x0 + 16 * s;
  portrait(ctx, h, px, y + hgt / 2, 10 * s);
  ctx.font = `700 ${11 * s}px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = right ? 'right' : 'left';
  ctx.fillStyle = '#e2dcf8';
  const tx = right ? x0 + w - 32 * s : x0 + 32 * s;
  ctx.fillText(`${h.name}`, tx, y + 13 * s);
  ctx.fillStyle = '#9f97bf';
  ctx.font = `600 ${9.5 * s}px ${FONT}`;
  ctx.textAlign = right ? 'left' : 'right';
  ctx.fillText(`${game.roleName(h)} ${h.stats.kills}/${h.stats.deaths}/${h.stats.assists} · 装${h.items.length}`, right ? x0 + 8 * s : x0 + w - 8 * s, y + 13 * s);
  const bw = w - 44 * s;
  hpBarScreen(ctx, right ? x0 + 8 * s : x0 + 32 * s, y + 18 * s, bw, 6 * s, h.alive ? Math.max(0, h.hp / h.maxHp) : 0, right);
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
    { key: 'R', name: h.mounted ? '下坐骑' : h.mount.name, cd: Math.max(0, h.mountCd), max: 2.5, icon: 'mount', active: h.mounted || h.state === 'mounting', small: true },
    { key: 'B', name: '回城', cd: 0, max: 1, icon: 'recall', active: h.state === 'recall', small: true },
  ];
  const size = 58 * s, gap = 10 * s;
  const total = slots.reduce((a, sl) => a + (sl.small ? size * 0.78 : size) + gap, -gap);
  let x = cx - total / 2;
  const y = bottom - size - 22 * s;
  panelBg(ctx, x - 14 * s, y - 64 * s, total + 28 * s, size + 90 * s, 14);
  // 背包
  const inv = 6, isz = 36 * s, igap = 8 * s;
  const iw = inv * isz + (inv - 1) * igap;
  let ix = cx - iw / 2;
  const iy = y - 52 * s;
  for (let k = 0; k < inv; k++) {
    const it = h.items[k];
    ctx.fillStyle = 'rgba(30,22,52,0.95)';
    ctx.strokeStyle = it ? RARITY[it.r].color : 'rgba(120,110,160,0.35)';
    ctx.lineWidth = it ? 2 : 1.2;
    ctx.beginPath(); ctx.roundRect(ix, iy, isz, isz, 7); ctx.fill(); ctx.stroke();
    if (it) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(ix + isz / 2, iy + isz / 2, 0, ix + isz / 2, iy + isz / 2, isz * 0.6);
      g.addColorStop(0, hexA(RARITY[it.r].color, 0.35)); g.addColorStop(1, hexA(RARITY[it.r].color, 0));
      ctx.fillStyle = g; ctx.fillRect(ix, iy, isz, isz);
      ctx.restore();
      itemIcon(ctx, it.icon, ix + isz / 2, iy + isz / 2, 1.5 * s, RARITY[it.r].color);
    }
    ix += isz + igap;
  }
  for (const sl of slots) {
    const sz = sl.small ? size * 0.78 : size;
    const sy = y + (size - sz);
    ctx.save();
    const ready = sl.cd <= 0;
    ctx.fillStyle = sl.active ? hexA(d.color2, 0.35) : 'rgba(30,22,52,0.95)';
    ctx.strokeStyle = ready ? hexA(d.color2, 0.9) : 'rgba(120,110,160,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, sy, sz, sz, 10); ctx.fill(); ctx.stroke();
    skillIcon(ctx, sl.icon, x + sz / 2, sy + sz / 2 - 3 * s, sz * 0.32, d, sl.name, s);
    if (!ready) {
      const k = sl.cd / sl.max;
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, sy, sz, sz, 10); ctx.clip();
      ctx.fillStyle = 'rgba(5,3,12,0.7)';
      ctx.beginPath();
      ctx.moveTo(x + sz / 2, sy + sz / 2);
      ctx.arc(x + sz / 2, sy + sz / 2, sz * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${16 * s}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sl.cd >= 1 ? Math.ceil(sl.cd) : sl.cd.toFixed(1), x + sz / 2, sy + sz / 2);
    }
    ctx.font = `800 ${10.5 * s}px ${FONT}`;
    const kw = Math.max(16 * s, ctx.measureText(sl.key).width + 8 * s);
    ctx.fillStyle = '#0d0918';
    ctx.strokeStyle = hexA(d.color2, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x + 3 * s, sy + 3 * s, kw, 15 * s, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#efe9ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sl.key, x + 3 * s + kw / 2, sy + 11 * s);
    ctx.font = `600 ${10.5 * s}px ${FONT}`;
    ctx.fillStyle = ready ? '#e2dcf8' : '#8a83a8';
    ctx.fillText(sl.name, x + sz / 2, y + size + 12 * s);
    ctx.restore();
    x += sz + gap;
  }
}

function skillIcon(ctx, kind, x, y, r, d, name, s) {
  ctx.save();
  ctx.strokeStyle = d.color2;
  ctx.fillStyle = d.color2;
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  if (kind === 'basic') {
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x - r + i * 6 * s, y + r); ctx.lineTo(x + r + i * 6 * s, y - r); ctx.stroke(); }
  } else if (kind === 'charge') {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'dash') {
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * r * 0.6;
      ctx.globalAlpha = 0.4 + i * 0.3;
      ctx.beginPath(); ctx.moveTo(x + ox - r * 0.3, y - r * 0.7); ctx.lineTo(x + ox + r * 0.35, y); ctx.lineTo(x + ox - r * 0.3, y + r * 0.7); ctx.stroke();
    }
  } else if (kind === 'mount') {
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.2, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r * 0.7, y); ctx.lineTo(x + r * 1.1, y - r * 0.7); ctx.stroke();
  } else if (kind === 'recall') {
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, -Math.PI * 0.8, Math.PI * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r * 0.9, y - r * 0.2); ctx.lineTo(x - r * 0.6, y - r * 0.9); ctx.lineTo(x - r * 0.1, y - r * 0.5); ctx.stroke();
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
  const w = 300 * s, h = w * (GRID_H / GRID_W);
  const x0 = right - w, y0 = bottom - h;
  ctx.save();
  panelBg(ctx, x0 - 6, y0 - 6, w + 12, h + 12, 10);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(R.minimap, x0, y0, w, h);
  ctx.imageSmoothingEnabled = true;
  const mx = (x) => x0 + (x / WORLD.w) * w;
  const my = (y) => y0 + (y / WORLD.h) * h;
  for (const c of game.camps) {
    if (!c.units.some((u) => u.alive)) continue;
    ctx.fillStyle = c.side === -1 ? '#ff9a40' : '#e8c060';
    ctx.beginPath(); ctx.arc(mx(c.x), my(c.y), (c.side === -1 ? 4.5 : 3) * s, 0, Math.PI * 2); ctx.fill();
  }
  for (const tw of game.towers) {
    const sz = (tw.kind === 'core' ? 9 : 6) * s;
    ctx.fillStyle = tw.alive ? TEAM_COLORS[tw.team] : '#555';
    ctx.fillRect(mx(tw.x) - sz / 2, my(tw.y) - sz / 2, sz, sz);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(mx(tw.x) - sz / 2, my(tw.y) - sz / 2, sz, sz);
  }
  for (const m of game.minions) {
    ctx.fillStyle = hexA(TEAM_COLORS[m.team], 0.85);
    ctx.fillRect(mx(m.x) - 1.5, my(m.y) - 1.5, 3, 3);
  }
  for (const l of game.loot) {
    if (l.item.r < 2) continue;
    ctx.fillStyle = RARITY[l.item.r].color;
    ctx.fillRect(mx(l.x) - 2, my(l.y) - 2, 4, 4);
  }
  for (const hh of game.heroes) {
    if (!hh.alive || (hh.stealthT > 0 && hh.team !== game.player.team)) continue;
    ctx.fillStyle = TEAM_COLORS[hh.team];
    ctx.strokeStyle = hh === game.player ? '#fff' : '#000';
    ctx.lineWidth = hh === game.player ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(mx(hh.x), my(hh.y), (hh === game.player ? 5.5 : 4.5) * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  const hw = R.W / 2 / R.zoom, hhgt = R.H / 2 / R.zoom / 0.62;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx(R.cam.x - hw), my(R.cam.y - hhgt), (hw * 2 / WORLD.w) * w, (hhgt * 2 / WORLD.h) * h);
  ctx.restore();
  void TILE;
}

function controlsHint(ctx, x, bottom, s) {
  const lines = ['WASD 移动 · J 普攻 · 按住 K 蓄力', '空格 穿梭 · U I 技能', 'R 坐骑 · B 回城 · 走过装备自动拾取', 'Esc 暂停 · M 静音'];
  ctx.save();
  ctx.font = `600 ${11 * s}px ${FONT}`;
  const lh = 16 * s;
  const w = 228 * s, h = lines.length * lh + 14 * s;
  panelBg(ctx, x, bottom - h, w, h, 10);
  ctx.fillStyle = '#b9b0d8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x + 10 * s, bottom - h + 8 * s + i * lh));
  ctx.restore();
}
