// 伤害结算与命中判定
import { angleDiff, norm, segDist } from './math.js';
import { sfx } from './audio.js';

export function enemiesOf(game, team) {
  return game.units.filter((u) => u.alive && u.targetable && u.team !== team);
}

// opts: kb 击退力度, from {x,y} 击退源点, stun/root 秒数, slow {amt,t}, burn {dps,t},
//       hitstop 卡肉秒数, shake 屏幕震动, dot 是否为持续伤害, silent 不播命中音
export function dealDamage(game, src, target, amount, opts = {}) {
  if (!target.alive || !target.targetable || target.team === src.team) return false;
  if (target.invuln > 0) {
    if (!opts.dot) game.fx.text(target.x, target.y, 70, '闪避', '#9fe8ff', 14);
    return false;
  }
  if (target.isInvulnerable?.()) {
    if (!opts.dot && game.time - (target._immuneMsgT || 0) > 0.6) {
      target._immuneMsgT = game.time;
      game.fx.text(target.x, target.y, 150, '先摧毁外塔', '#c9c3e0', 15);
    }
    return false;
  }

  amount = Math.round(amount);
  target.hp -= amount;
  if (!opts.dot && !opts.silent) target.flash = 0.1;
  const owner = src.owner || src;
  target.lastHitBy = owner;
  target.lastHitT = game.time;
  if (owner.stats) owner.stats.dmg += amount;

  // 伤害数字颜色：玩家受伤红色、玩家造成伤害金色、其余灰白
  let color = '#e8e4f4', size = 14;
  if (target === game.player) { color = '#ff5a5a'; size = 18; }
  else if (owner === game.player) { color = amount >= 100 ? '#ffd24a' : '#fff2b0'; size = amount >= 100 ? 24 : 17; }
  if (opts.dot) { color = opts.color || '#ff9a40'; size = 13; }
  if (target.kind === 'hero' || owner === game.player || target === game.player) {
    game.fx.damage(target, amount, color, size);
  }

  if (opts.kb && target.mass < 99) {
    const from = opts.from || src;
    const d = norm(target.x - from.x, target.y - from.y);
    const dir = d.x || d.y ? d : (src.facing || { x: 1, y: 0 });
    target.kx += (dir.x * opts.kb) / target.mass;
    target.ky += (dir.y * opts.kb) / target.mass;
  }
  const st = target.status;
  if (st) {
    if (opts.stun) { st.stun = Math.max(st.stun, opts.stun); game.fx.text(target.x, target.y, 95, '眩晕', '#ffe066', 15); }
    if (opts.root) { st.root = Math.max(st.root, opts.root); game.fx.text(target.x, target.y, 95, '定身', '#8fe3ff', 15); }
    if (opts.slow) {
      st.slowAmt = Math.max(st.slow > 0 ? st.slowAmt : 0, opts.slow.amt);
      st.slow = Math.max(st.slow, opts.slow.t);
    }
    if (opts.burn) {
      st.burnDps = Math.max(st.burn > 0 ? st.burnDps : 0, opts.burn.dps);
      st.burn = Math.max(st.burn, opts.burn.t);
      st.burnSrc = owner;
    }
  }
  if (opts.hitstop) game.hitstop(opts.hitstop);
  if (opts.shake) game.shake(opts.shake);
  if (!opts.dot && !opts.silent) sfx.hit();
  if (!opts.dot) {
    const big = amount >= 90;
    game.fx.impact(target.x, target.y, (target.height || 50) * 0.55, big ? '#ffd27a' : '#ffffff', big ? 1.4 : target.kind === 'minion' ? 0.6 : 0.9);
  }

  // 防御塔仇恨：在敌方塔下攻击其英雄会被塔优先锁定
  if (owner.kind === 'hero' && target.kind === 'hero') {
    for (const t of game.towers) {
      if (t.alive && t.team === target.team && Math.hypot(t.x - owner.x, t.y - owner.y) < t.range + 60) {
        t.aggroHero = owner;
        t.aggroT = 2.5;
      }
    }
  }

  if (target.hp <= 0) {
    target.hp = 0;
    target.die(owner);
  }
  return true;
}

export function inCone(owner, u, range, arc) {
  const dx = u.x - owner.x, dy = u.y - owner.y;
  const d = Math.hypot(dx, dy);
  if (d > range + u.radius) return false;
  if (d < u.radius + 12) return true;
  return Math.abs(angleDiff(owner.faceAngle, Math.atan2(dy, dx))) <= arc / 2 + Math.atan2(u.radius, d);
}

export function hitArc(game, owner, { range, arc, dmg, ...opts }) {
  let n = 0;
  for (const u of enemiesOf(game, owner.team)) {
    if (inCone(owner, u, range, arc) && dealDamage(game, owner, u, dmg, opts)) n++;
  }
  return n;
}

export function hitCircle(game, owner, x, y, r, dmg, opts = {}, hitSet = null) {
  let n = 0;
  const from = opts.from || { x, y };
  for (const u of enemiesOf(game, owner.team)) {
    if (hitSet && hitSet.has(u.id)) continue;
    if (Math.hypot(u.x - x, u.y - y) <= r + u.radius) {
      if (dealDamage(game, owner, u, dmg, { ...opts, from })) {
        n++;
        if (hitSet) hitSet.add(u.id);
      }
    }
  }
  return n;
}

export function hitLine(game, owner, x0, y0, x1, y1, width, dmg, opts = {}) {
  let n = 0;
  for (const u of enemiesOf(game, owner.team)) {
    if (segDist(u.x, u.y, x0, y0, x1, y1) <= width / 2 + u.radius) {
      if (dealDamage(game, owner, u, dmg, { ...opts, from: { x: x0, y: y0 } })) n++;
    }
  }
  return n;
}
