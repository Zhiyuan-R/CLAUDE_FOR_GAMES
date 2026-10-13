// 英雄头像：用游戏内的角色绘制函数渲染半身像，配元素色背景与光芒，结果缓存
import { drawHero, hexA, INK } from './draw.js';

const cache = new Map();

export function portrait(def, size = 128) {
  const key = def.id + ':' + size;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const s = size / 128;

  // 背景：元素色径向光 + 放射光芒
  const g = ctx.createRadialGradient(size * 0.55, size * 0.35, 0, size * 0.5, size * 0.5, size * 0.8);
  g.addColorStop(0, hexA(def.color2, 0.95));
  g.addColorStop(0.4, hexA(def.color, 0.9));
  g.addColorStop(1, '#0d0918');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size * 0.55, size * 0.35);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.fillStyle = hexA(def.color2, 0.08);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size, -size * 0.12); ctx.lineTo(size, size * 0.12); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // 半身像：放大角色并让头部落在画面上方三分之一处
  const k = 1.75 * s;
  const fake = {
    def, x: 0, y: 0, z: 0, facing: { x: 1, y: 0.2 }, flash: 0, speedNow: 0, walkT: 0, mounted: false, stealthT: 0, invuln: 0,
    state: 'idle', swing: null, buffs: {}, chargeT: 0, shield: 0, team: 0, game: { player: { team: 0 } },
  };
  ctx.save();
  ctx.translate(size * 0.47, size * 0.4 + 48 * def.size * k);
  ctx.scale(k, k);
  drawHero(ctx, fake, 0.6);
  ctx.restore();

  // 底部暗角 + 描边
  const v = ctx.createLinearGradient(0, size * 0.6, 0, size);
  v.addColorStop(0, 'rgba(13,9,24,0)');
  v.addColorStop(1, 'rgba(13,9,24,0.85)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4 * s;
  ctx.strokeRect(0, 0, size, size);
  cache.set(key, c);
  return c;
}
