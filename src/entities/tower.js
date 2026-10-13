// 防御塔与基地水晶。基地在外塔存活时无敌。
import { Unit } from './unit.js';
import { Projectile } from './projectile.js';
import { sfx } from '../audio.js';
import { TEAM_COLORS } from '../config.js';

export class Tower extends Unit {
  constructor(game, { x, y, team, kind, guard = null }) {
    const core = kind === 'core';
    super(game, { x, y, team, radius: core ? 54 : 40, maxHp: core ? 2600 : 2000, kind });
    this.range = core ? 430 : 400;
    this.height = core ? 175 : 150;
    this.mass = 999;
    this.guard = guard;
    this.atkCd = 1;
    this.target = null;
    this.streak = 0;
    this.aggroHero = null;
    this.aggroT = 0;
  }

  isInvulnerable() { return !!(this.guard && this.guard.alive); }

  canHit(u) {
    return u.alive && u.targetable && u.team !== this.team && (u.kind === 'hero' || u.kind === 'minion') &&
      Math.hypot(u.x - this.x, u.y - this.y) <= this.range + u.radius;
  }

  update(dt) {
    if (!this.alive) return;
    this.updateStatus(dt);
    this.atkCd -= dt;
    this.aggroT -= dt;
    const g = this.game;

    if (this.aggroT > 0 && this.aggroHero && this.canHit(this.aggroHero)) {
      if (this.target !== this.aggroHero) { this.target = this.aggroHero; this.streak = 0; }
    } else if (!this.target || !this.canHit(this.target)) {
      this.target = null;
      this.streak = 0;
      let best = null, bestD = Infinity;
      for (const u of g.units) {
        if (!this.canHit(u)) continue;
        // 优先攻击小兵
        const d = Math.hypot(u.x - this.x, u.y - this.y) + (u.kind === 'hero' ? 10000 : 0);
        if (d < bestD) { bestD = d; best = u; }
      }
      this.target = best;
    }

    if (this.target && this.atkCd <= 0) {
      this.atkCd = 1.15;
      const isHero = this.target.kind === 'hero';
      const dmg = isHero ? 130 * (1 + 0.3 * this.streak) : 85;
      if (isHero) this.streak = Math.min(this.streak + 1, 5);
      const color = TEAM_COLORS[this.team];
      g.projectiles.push(new Projectile(g, {
        owner: this, x: this.x, y: this.y + 2, z: this.height - 15, homing: this.target,
        speed: 620, life: 3, dmg, radius: 12, kind: 'tower', color, opts: { kb: 60 },
        onHit: (p, u) => g.fx.burst(u.x, u.y, 40, color, 12, { speed: 220, life: 0.4 }),
      }));
      g.fx.burst(this.x, this.y, this.height - 15, color, 8, { speed: 120, life: 0.3 });
      sfx.tower();
    }
  }
}
