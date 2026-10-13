// 英雄被动：每位英雄一个，给英雄带来独特的玩法倾向
import { hitCircle } from './combat.js';
import { EL } from './elements.js';
import { bushAt } from './map.js';

export const PASSIVES = {
  pyre: { name: '余烬', desc: '每第 3 次普攻命中时引发元素爆发，对周围敌人造成伤害并附带元素效果。' },
  vampire: { name: '嗜血', desc: '获得 12% 吸血；生命低于 40% 时吸血翻倍。' },
  executioner: { name: '处决', desc: '对生命低于 35% 的敌人伤害提升 35%。' },
  momentum: { name: '冲势', desc: '持续移动 1.5 秒后，下一次普攻伤害 +60% 并击退。' },
  reset: { name: '收割', desc: '击杀或助攻英雄时刷新技能冷却；击杀小兵时技能冷却减少 1 秒。' },
  lastStand: { name: '坚韧', desc: '生命低于 30% 时获得最大生命 30% 的护盾（45 秒冷却）。' },
  echo: { name: '法术回响', desc: '释放技能后 3 秒内，下一次普攻伤害 +80% 并附带元素效果。' },
  banner: { name: '战旗', desc: '附近 450 范围内的队友伤害提升 10%。' },
  thorns: { name: '荆棘', desc: '受到非持续伤害时，把 25% 反弹给攻击者。' },
  crit: { name: '致命', desc: '攻击有 22% 几率暴击，造成 1.8 倍伤害。' },
  frostbite: { name: '霜咬', desc: '普攻使敌人减速 25%；对减速中的敌人伤害提升 20%。' },
  secondWind: { name: '回春', desc: '4 秒未受伤后，每秒恢复 4% 最大生命。' },
  twinDash: { name: '双影', desc: '穿梭可以连续使用两次。' },
  fury: { name: '狂怒', desc: '生命越低伤害越高，最多提升 50%。' },
  hunter: { name: '潜伏者', desc: '在草丛中移速 +30%；离开草丛后 3 秒内的第一次攻击伤害 +80%。' },
};

// 伤害修正：攻击方被动
export function passiveDamage(owner, target, amount, opts, game) {
  const p = owner.def?.passive;
  if (!p) return amount;
  const pv = owner.pv;
  const tr = target.hp / target.maxHp;
  switch (p) {
    case 'executioner': if (tr < 0.35) amount *= 1.35; break;
    case 'frostbite': if (target.status?.slow > 0) amount *= 1.2; break;
    case 'fury': amount *= 1 + 0.5 * (1 - owner.hp / owner.maxHp); break;
    case 'crit':
      if (!opts.dot && Math.random() < 0.22) { amount *= 1.8; opts._crit = true; }
      break;
    case 'momentum':
      if (opts.basic && pv.momentum >= 1.5) { amount *= 1.6; opts.kb = (opts.kb || 0) + 260; pv.momentum = 0; game.fx.ring(target.x, target.y, 10, 60, owner.def.color2, { dur: 0.25 }); }
      break;
    case 'echo':
      if (opts.basic && pv.echoT > 0) { amount *= 1.8; pv.echoT = 0; Object.assign(opts, EL[owner.def.el].on); }
      break;
    case 'hunter':
      if (!opts.dot && pv.ambushT > 0) { amount *= 1.8; pv.ambushT = 0; opts._crit = true; }
      break;
  }
  return amount;
}

export function passiveOnHit(owner, target, opts, game) {
  const p = owner.def?.passive;
  if (p === 'pyre' && opts.basic) {
    owner.pv.hits = (owner.pv.hits || 0) + 1;
    if (owner.pv.hits >= 3) {
      owner.pv.hits = 0;
      const el = EL[owner.def.el];
      game.fx.ring(target.x, target.y, 10, 90, el.c, { dur: 0.3, width: 5 });
      game.fx.burst(target.x, target.y, 30, el.c2, 14, { speed: 220, life: 0.4 });
      hitCircle(game, owner, target.x, target.y, 90, 55, { silent: true, ...el.on });
    }
  }
  if (p === 'frostbite' && opts.basic && target.status) {
    target.status.slowAmt = Math.max(target.status.slow > 0 ? target.status.slowAmt : 0, 0.25);
    target.status.slow = Math.max(target.status.slow, 1);
  }
}

export function passiveOnHurt(target, owner, amount, opts, game) {
  const p = target.def?.passive;
  if (p === 'thorns' && !opts.dot && owner.alive && owner.kind !== 'tower' && owner.kind !== 'core' && owner !== target) {
    owner.hp -= amount * 0.25;
    if (owner.hp <= 0) { owner.hp = 0; owner.die(target); }
  }
  if (p === 'lastStand' && target.alive && target.hp / target.maxHp < 0.3 && (target.pv.lastStandCd || 0) <= 0) {
    target.pv.lastStandCd = 45;
    target.shield = Math.max(target.shield, target.maxHp * 0.3);
    target.shieldT = 5;
    game.fx.ring(target.x, target.y, 10, 80, '#ffe58a', { dur: 0.5, width: 6 });
  }
}

export function passiveUpdate(h, game, dt) {
  const p = h.def.passive;
  const pv = h.pv;
  if (pv.lastStandCd > 0) pv.lastStandCd -= dt;
  if (pv.echoT > 0) pv.echoT -= dt;
  if (pv.ambushT > 0) pv.ambushT -= dt;
  if (p === 'momentum') pv.momentum = h.speedNow > 100 ? (pv.momentum || 0) + dt : Math.max(0, (pv.momentum || 0) - dt * 2);
  if (p === 'secondWind' && game.time - h.lastDmgT > 4) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.04 * dt);
  if (p === 'hunter') {
    const inBush = bushAt(h.x, h.y) >= 0;
    if (pv.wasInBush && !inBush) pv.ambushT = 3;
    pv.wasInBush = inBush;
  }
}

export function passiveAttrs(h, a, game) {
  const p = h.def.passive;
  if (p === 'vampire') a.lifesteal += h.hp / h.maxHp < 0.4 ? 0.24 : 0.12;
  if (p === 'hunter' && bushAt(h.x, h.y) >= 0) a.speed += 0.3;
  // 队友的战旗
  for (const o of game.heroes || []) {
    if (o !== h && o.alive && o.team === h.team && o.def.passive === 'banner' && Math.hypot(o.x - h.x, o.y - h.y) < 450) { a.power += 0.1; break; }
  }
}
