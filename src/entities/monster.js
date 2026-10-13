// 野怪与宝箱（中立阵营）。野怪被攻击后追击，离营地太远会回家回血；死亡掉落装备
import { Unit } from './unit.js';
import { dealDamage, hitCircle, hitArc } from '../combat.js';
import { norm, rand } from '../math.js';
import { NEUTRAL } from '../config.js';
import { sfx } from '../audio.js';

export const MONSTERS = {
  skeleton: { name: 'Skeleton Warrior', hp: 520, dmg: 32, radius: 16, speed: 130, atk: 1.1, range: 30, count: 3, tier: 0, height: 50 },
  golem: { name: 'Gargoyle', hp: 1600, dmg: 62, radius: 30, speed: 95, atk: 1.6, range: 40, count: 1, tier: 1, height: 80 },
  spider: { name: 'Cave Spider', hp: 700, dmg: 34, radius: 20, speed: 150, atk: 1.0, range: 30, count: 2, tier: 0, height: 36, burn: true },
  wolf: { name: 'Shadow Werewolf', hp: 1150, dmg: 50, radius: 24, speed: 145, atk: 1.2, range: 34, count: 1, tier: 1, height: 64 },
  dragon: { name: 'Abyssal Dragon', hp: 6000, dmg: 110, radius: 54, speed: 80, atk: 1.8, range: 70, count: 1, tier: 3, height: 130, boss: true, buff: 'dragon' },
  colossus: { name: 'Ancient Colossus', hp: 6800, dmg: 100, radius: 56, speed: 70, atk: 2.0, range: 70, count: 1, tier: 3, height: 140, boss: true, buff: 'colossus' },
};

export class Monster extends Unit {
  constructor(game, camp, type, x, y) {
    const m = MONSTERS[type];
    super(game, { x, y, team: NEUTRAL, radius: m.radius, maxHp: m.hp, kind: 'monster' });
    this.camp = camp;
    this.type = type;
    this.m = m;
    this.name = m.name;
    this.boss = !!m.boss;
    this.home = { x, y };
    this.height = m.height;
    this.mass = m.boss ? 999 : m.radius > 25 ? 5 : 2;
    this.target = null;
    this.atkCd = 1;
    this.windup = 0;
    this.specialCd = 5;
    this.leash = m.boss ? 520 : 420;
    this.returning = false;
    this.face = 1;
    this.phase = Math.random() * 10;
  }

  onHurt(attacker) {
    if (attacker.team === NEUTRAL) return;
    if (!this.target || !this.target.alive || this.returning) { this.target = attacker; this.returning = false; }
    // 同营地的伙伴一起仇恨
    for (const o of this.camp.units) if (o !== this && o.alive && !o.target) o.target = attacker;
  }

  update(dt) {
    this.updateStatus(dt);
    if (!this.alive) return;
    this.phase += dt;
    this.atkCd -= dt;
    this.specialCd -= dt;
    let mvx = 0, mvy = 0;
    const homeD = Math.hypot(this.x - this.home.x, this.y - this.home.y);
    const t = this.target;
    if (t && (!t.alive || !t.targetable || homeD > this.leash || Math.hypot(t.x - this.home.x, t.y - this.home.y) > this.leash + 80)) {
      this.target = null;
      this.returning = true;
      this.windup = 0;
    }
    if (this.returning) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt);
      if (homeD < 20) this.returning = false;
      else { const n = norm(this.home.x - this.x, this.home.y - this.y); mvx = n.x; mvy = n.y; }
    } else if (this.target && this.status.stun <= 0) {
      const tg = this.target;
      const gap = Math.hypot(tg.x - this.x, tg.y - this.y) - tg.radius - this.radius;
      this.face = tg.x >= this.x ? 1 : -1;
      if (this.boss && this.specialCd <= 0 && gap < 260) {
        this.specialCd = 6.5;
        this.windup = 0.9;
        this.special = true;
        this.game.addZone({ alive: true, kind: 'warnRing', x: this.x, y: this.y, radius: 230, life: 0.9, max: 0.9, age: 0, owner: this, team: NEUTRAL, color: this.type === 'dragon' ? '#ff7a2f' : '#d9a35a', update(dt2) { this.life -= dt2; this.age += dt2; if (this.life <= 0) this.alive = false; }, end() { this.alive = false; } });
      }
      if (this.windup > 0) {
        this.windup -= dt;
        if (this.windup <= 0) this.strike(tg);
      } else if (gap > this.m.range) {
        const n = norm(tg.x - this.x, tg.y - this.y);
        mvx = n.x; mvy = n.y;
      } else if (this.atkCd <= 0) {
        this.windup = 0.35;
        this.atkCd = this.m.atk;
        this.special = false;
      }
    } else if (!this.target && homeD > 30) {
      const n = norm(this.home.x - this.x, this.home.y - this.y); mvx = n.x * 0.5; mvy = n.y * 0.5;
    }
    const sp = this.status.root > 0 || this.status.stun > 0 ? 0 : this.m.speed * this.slowMul * (this.returning ? 1.6 : 1);
    this.vx = mvx * sp;
    this.vy = mvy * sp;
    this.x += (this.vx + this.kx) * dt;
    this.y += (this.vy + this.ky) * dt;
  }

  strike(tg) {
    const g = this.game;
    if (this.special) {
      this.special = false;
      sfx.boom();
      const col = this.type === 'dragon' ? '#ff7a2f' : '#d9a35a';
      g.fx.ring(this.x, this.y, 20, 240, col, { dur: 0.5, width: 9 });
      g.fx.burst(this.x, this.y, 20, col, 40, { speed: 380, life: 0.7, up: 200, grav: 500, type: 'shard', size: 5 });
      g.shake(8);
      hitCircle(g, this, this.x, this.y, 230, this.m.dmg * 1.4, this.type === 'dragon' ? { burn: { dps: 40, t: 3 }, kb: 300 } : { stun: 1, kb: 300 });
      return;
    }
    if (Math.hypot(tg.x - this.x, tg.y - this.y) - tg.radius - this.radius > this.m.range + 30) return;
    if (this.boss) {
      g.fx.slash(this.x, this.y, 50, Math.atan2(tg.y - this.y, tg.x - this.x), 140, 2, this.type === 'dragon' ? '#ff9a40' : '#e0c080', { width: 30, dur: 0.25 });
      this.facing = norm(tg.x - this.x, tg.y - this.y);
      hitArc(g, this, { range: 150, arc: 2, dmg: this.m.dmg, kb: 260 });
    } else {
      dealDamage(g, this, tg, this.m.dmg, { kb: 80, ...(this.m.burn ? { burn: { dps: 14, t: 3, color: '#9be24a' } } : {}) });
    }
  }

  get faceAngle() { return Math.atan2(this.facing?.y || 0, this.facing?.x || this.face); }
}

export class Chest extends Unit {
  constructor(game, spot) {
    super(game, { x: spot.x, y: spot.y, team: NEUTRAL, radius: 20, maxHp: 140, kind: 'chest' });
    this.spot = spot;
    this.mass = 999;
    this.height = 30;
    this.wobble = 0;
  }
  onHurt() { this.wobble = 0.3; }
  update(dt) { this.updateStatus(dt); if (this.wobble > 0) this.wobble -= dt; }
}



// 炸药桶：被打爆后对周围所有单位（不分敌我）造成爆炸伤害
export class Barrel extends Unit {
  constructor(game, spot) {
    super(game, { x: spot.x, y: spot.y, team: NEUTRAL, radius: 18, maxHp: 50, kind: 'barrel' });
    this.spot = spot;
    this.mass = 999;
    this.height = 34;
    this.wobble = 0;
  }
  onHurt() { this.wobble = 0.25; }
  update(dt) { this.updateStatus(dt); if (this.wobble > 0) this.wobble -= dt; }
}
