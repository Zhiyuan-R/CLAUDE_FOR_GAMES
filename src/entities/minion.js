// 兵线小兵：沿各自兵线的路径点推进，自动攻击附近的敌人。近战兵 + 远程法师兵
import { Unit } from './unit.js';
import { Projectile } from './projectile.js';
import { dealDamage } from '../combat.js';
import { norm } from '../math.js';
import { los } from '../nav.js';
import { TEAM_COLORS } from '../config.js';

export class Minion extends Unit {
  constructor(game, { team, lane, path, caster = false, grow = 1 }) {
    super(game, { x: path[0].x, y: path[0].y, team, radius: 15, maxHp: Math.round((caster ? 240 : 340) * grow), kind: 'minion' });
    this.caster = caster;
    this.lane = lane;
    this.path = path;
    this.wp = 1;
    this.speed = 105;
    this.dmg = (caster ? 20 : 24) * grow;
    this.range = caster ? 230 : 26;
    this.aggro = 260;
    this.atkCd = 0;
    this.windup = 0;
    this.target = null;
    this.retargetT = Math.random() * 0.3;
    this.height = 34;
    this.face = team === 0 ? 1 : -1;
    this.phase = Math.random() * 10;
    this.offset = (Math.random() - 0.5) * 50;
  }

  findTarget() {
    const g = this.game;
    let best = null, bestScore = Infinity;
    for (const u of g.near(this.x, this.y, this.aggro + 60)) {
      if (!u.alive || !u.targetable || u.team === this.team || u.team === 2) continue;
      const d = Math.hypot(u.x - this.x, u.y - this.y) - u.radius;
      if (d > this.aggro) continue;
      if (u.isInvulnerable?.()) continue;
      if (!los(this.x, this.y, u.x, u.y)) continue;
      const score = d + (u.kind === 'hero' ? 140 : u.kind === 'minion' ? 0 : 60);
      if (score < bestScore) { bestScore = score; best = u; }
    }
    return best;
  }

  update(dt) {
    this.updateStatus(dt);
    if (!this.alive) return;
    this.phase += dt;
    this.atkCd -= dt;
    const g = this.game;
    let mvx = 0, mvy = 0;

    if (this.status.stun <= 0) {
      this.retargetT -= dt;
      const t = this.target;
      const valid = t && t.alive && t.targetable && Math.hypot(t.x - this.x, t.y - this.y) < this.aggro * 1.5;
      if (!valid || this.retargetT <= 0) {
        this.retargetT = 0.4;
        const nt = this.findTarget();
        if (nt !== this.target) this.windup = 0;
        this.target = nt;
      }

      if (this.windup > 0) {
        this.windup -= dt;
        if (this.windup <= 0 && this.target?.alive) this.strike(this.target);
      } else if (this.target) {
        const t2 = this.target;
        const gap = Math.hypot(t2.x - this.x, t2.y - this.y) - t2.radius - this.radius;
        if (gap > this.range) {
          const n = norm(t2.x - this.x, t2.y - this.y);
          mvx = n.x; mvy = n.y;
        } else if (this.atkCd <= 0) {
          this.windup = 0.28;
          this.atkCd = this.caster ? 1.4 : 1.1;
        }
        this.face = t2.x >= this.x ? 1 : -1;
      } else {
        // 沿兵线路径点前进
        let p = this.path[Math.min(this.wp, this.path.length - 1)];
        if (Math.hypot(p.x - this.x, p.y - this.y) < 60 && this.wp < this.path.length - 1) { this.wp++; p = this.path[this.wp]; }
        const n = norm(p.x - this.x, p.y + this.offset * 0.5 - this.y);
        mvx = n.x; mvy = n.y;
        if (Math.abs(n.x) > 0.2) this.face = n.x >= 0 ? 1 : -1;
      }
    }

    const sp = this.status.root > 0 || this.status.stun > 0 ? 0 : this.speed * this.slowMul;
    this.vx = mvx * sp;
    this.vy = mvy * sp;
    this.x += (this.vx + this.kx) * dt;
    this.y += (this.vy + this.ky) * dt;
  }

  strike(t2) {
    const g = this.game;
    const structure = t2.kind === 'tower' || t2.kind === 'core';
    const dmg = structure ? this.dmg * 1.6 : this.dmg;
    if (this.caster) {
      g.projectiles.push(new Projectile(g, {
        owner: this, x: this.x, y: this.y, z: 30, homing: t2, speed: 560, life: 1.5, dmg, radius: 7, kind: 'bolt', color: TEAM_COLORS[this.team], opts: { silent: true },
      }));
      return;
    }
    if (Math.hypot(t2.x - this.x, t2.y - this.y) - t2.radius - this.radius < this.range + 18) {
      dealDamage(g, this, t2, dmg, { silent: true });
      g.fx.burst(t2.x, t2.y, 25, '#ffd9b0', 4, { speed: 120, life: 0.2, size: 2 });
    }
  }
}
