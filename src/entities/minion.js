// 兵线小兵：沿兵线推进，自动攻击附近的敌人
import { Unit } from './unit.js';
import { dealDamage } from '../combat.js';
import { norm } from '../math.js';

export class Minion extends Unit {
  constructor(game, { x, y, team, laneY }) {
    super(game, { x, y, team, radius: 15, maxHp: 340, kind: 'minion' });
    this.speed = 105;
    this.dmg = 24;
    this.range = 26;
    this.aggro = 230;
    this.atkCd = 0;
    this.windup = 0;
    this.target = null;
    this.retargetT = 0;
    this.laneY = laneY;
    this.height = 34;
    this.face = team === 0 ? 1 : -1;
    this.phase = Math.random() * 10;
  }

  findTarget() {
    const g = this.game;
    let best = null, bestScore = Infinity;
    for (const u of g.units) {
      if (!u.alive || !u.targetable || u.team === this.team) continue;
      const d = Math.hypot(u.x - this.x, u.y - this.y) - u.radius;
      if (d > this.aggro) continue;
      if (u.isInvulnerable?.()) continue;
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
        this.retargetT = 0.35;
        const nt = this.findTarget();
        if (nt !== this.target) this.windup = 0;
        this.target = nt;
      }

      if (this.windup > 0) {
        this.windup -= dt;
        if (this.windup <= 0 && this.target?.alive) {
          const t2 = this.target;
          if (Math.hypot(t2.x - this.x, t2.y - this.y) - t2.radius - this.radius < this.range + 18) {
            dealDamage(g, this, t2, t2.kind === 'tower' || t2.kind === 'core' ? this.dmg * 1.6 : this.dmg, { silent: true });
            g.fx.burst(t2.x, t2.y, 25, '#ffd9b0', 4, { speed: 120, life: 0.2, size: 2 });
          }
        }
      } else if (this.target) {
        const t2 = this.target;
        const gap = Math.hypot(t2.x - this.x, t2.y - this.y) - t2.radius - this.radius;
        if (gap > this.range) {
          const n = norm(t2.x - this.x, t2.y - this.y);
          mvx = n.x; mvy = n.y;
        } else if (this.atkCd <= 0) {
          this.windup = 0.28;
          this.atkCd = 1.1;
        }
        this.face = t2.x >= this.x ? 1 : -1;
      } else {
        const core = g.towers.find((t3) => t3.kind === 'core' && t3.team !== this.team);
        const n = norm(core.x - this.x, (this.laneY - this.y) * 3);
        mvx = n.x; mvy = n.y;
        this.face = n.x >= 0 ? 1 : -1;
      }
    }

    const sp = this.status.root > 0 || this.status.stun > 0 ? 0 : this.speed * this.slowMul;
    this.vx = mvx * sp;
    this.vy = mvy * sp;
    this.x += (this.vx + this.kx) * dt;
    this.y += (this.vy + this.ky) * dt;
  }
}
