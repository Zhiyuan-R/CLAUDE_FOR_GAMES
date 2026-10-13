// 英雄被动：每位英雄一个，给英雄带来独特的玩法倾向
import { hitCircle } from './combat.js';
import { EL } from './elements.js';
import { bushAt } from './map.js';

export const PASSIVES = {
  pyre: { name: 'Embers', desc: 'Every 3rd basic hit triggers an elemental burst that damages nearby enemies and applies your element.' },
  vampire: { name: 'Bloodthirst', desc: 'Gain 12% lifesteal, doubled below 40% HP.' },
  executioner: { name: 'Executioner', desc: 'Deal 35% more damage to enemies below 35% HP.' },
  momentum: { name: 'Momentum', desc: 'After moving for 1.5s, your next basic attack deals 60% more damage and knocks back.' },
  reset: { name: 'Reaper', desc: 'Hero kills and assists reset your skill cooldowns. Minion kills shave 1s off them.' },
  lastStand: { name: 'Last Stand', desc: 'Dropping below 30% HP grants a shield worth 30% of max HP (45s cooldown).' },
  echo: { name: 'Spell Echo', desc: 'Within 3s of casting a skill, your next basic attack deals 80% more damage and applies your element.' },
  banner: { name: 'War Banner', desc: 'Allies within 450 range deal 10% more damage.' },
  thorns: { name: 'Thorns', desc: 'Reflect 25% of direct damage taken back to the attacker.' },
  crit: { name: 'Lethality', desc: 'Attacks have a 22% chance to crit for 1.8x damage.' },
  frostbite: { name: 'Frostbite', desc: 'Basic attacks slow by 25%. Deal 20% more damage to slowed enemies.' },
  secondWind: { name: 'Second Wind', desc: 'After 4s without taking damage, regenerate 4% max HP per second.' },
  twinDash: { name: 'Twin Shadow', desc: 'Your dash has 2 charges.' },
  fury: { name: 'Fury', desc: 'Deal more damage the lower your HP, up to +50%.' },
  hunter: { name: 'Stalker', desc: '+30% move speed in bushes. Your first attack within 3s of leaving a bush deals 80% more damage.' },
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
