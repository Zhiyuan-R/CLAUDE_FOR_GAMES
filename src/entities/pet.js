// 召唤兽：跟随主人，自动攻击附近敌人，持续一段时间后消散
import { Unit } from './unit.js';
import { dealDamage } from '../combat.js';
import { norm } from '../math.js';
import { los } from '../nav.js';

export class Pet extends Unit {
  constructor(game, owner, { hp = 900, dmg = 55, life = 14, color, color2 }) {
    super(game, { x: owner.x + owner.facing.x * 50, y: owner.y + owner.facing.y * 50, team: owner.team, radius: 24, maxHp: hp, kind: 'pet' });
    this.owner = null;
    this.master = owner;
    this.dmg = dmg;
    this.life = life;
    this.color = color;
    this.color2 = color2;
    this.height = 50;
    this.mass = 4;
    this.target = null;
    this.atkCd = 0;
    this.windup = 0;
    this.face = 1;
    this.walkT = 0;
    this.retargetT = 0;
  }

  update(dt) {
    this.updateStatus(dt);
    if (!this.alive) return;
    if ((this.life -= dt) <= 0 || !this.master.alive) { this.alive = false; this.game.fx.burst(this.x, this.y, 30, this.color, 20, { speed: 200, life: 0.5 }); return; }
    this.atkCd -= dt;
    this.retargetT -= dt;
    const g = this.game, m = this.master;
    if (this.retargetT <= 0 || !this.target?.alive || !this.target.targetable) {
      this.retargetT = 0.4;
      let best = null, bd = 420;
      for (const u of g.near(this.x, this.y, 460)) {
        if (!u.alive || !u.targetable || u.team === this.team || u.kind === 'tower' || u.kind === 'core' || u.kind === 'chest' || u.kind === 'barrel') continue;
        if (g.hidden[this.team].has(u.id)) continue;
        const d = Math.hypot(u.x - this.x, u.y - this.y) - (u.kind === 'hero' ? 80 : 0);
        if (d < bd && los(this.x, this.y, u.x, u.y)) { bd = d; best = u; }
      }
      this.target = best;
    }
    let mv = { x: 0, y: 0 };
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0 && this.target?.alive && Math.hypot(this.target.x - this.x, this.target.y - this.y) < this.target.radius + 60) {
        dealDamage(g, m, this.target, this.dmg, { kb: 120 });
        g.fx.slash(this.x, this.y, 30, Math.atan2(this.target.y - this.y, this.target.x - this.x), 70, 2, this.color2, { width: 20, dur: 0.18 });
      }
    } else if (this.target) {
      const d = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      if (d > this.target.radius + 40) mv = norm(this.target.x - this.x, this.target.y - this.y);
      else if (this.atkCd <= 0) { this.windup = 0.25; this.atkCd = 0.9; }
      this.face = this.target.x >= this.x ? 1 : -1;
    } else if (Math.hypot(m.x - this.x, m.y - this.y) > 120) {
      mv = norm(m.x - this.x, m.y - this.y);
      this.face = mv.x >= 0 ? 1 : -1;
    }
    const sp = this.status.stun > 0 || this.status.root > 0 ? 0 : 300 * this.slowMul;
    this.vx = mv.x * sp; this.vy = mv.y * sp;
    this.x += (this.vx + this.kx) * dt;
    this.y += (this.vy + this.ky) * dt;
    this.walkT += Math.hypot(this.vx, this.vy) * dt * 0.035;
  }

  die(killer) { this.alive = false; this.game.fx.burst(this.x, this.y, 30, this.color, 20, { speed: 200, life: 0.5 }); void killer; }
}
