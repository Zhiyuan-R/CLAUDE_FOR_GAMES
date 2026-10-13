// 飞行道具：法球、箭矢、防御塔弹体
import { dealDamage, enemiesOf } from '../combat.js';
import { WORLD } from '../config.js';
import { wallAt } from '../map.js';

export class Projectile {
  constructor(game, o) {
    this.game = game;
    this.alive = true;
    this.z = 32;
    this.radius = 10;
    this.life = 1;
    this.pierce = false;
    this.homing = null;
    this.speed = 0;
    this.dmg = 0;
    this.opts = {};
    this.kind = 'bolt';
    this.color = '#fff';
    this.onHit = null;
    this.onExpire = null;
    this.trail = [];
    Object.assign(this, o);
    this.team = this.owner.team;
    this.hit = new Set();
    if (!this.vx && !this.vy && this.angle !== undefined) {
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
    }
    this.max = this.life;
  }

  expire() {
    if (!this.alive) return;
    this.alive = false;
    this.onExpire?.(this);
  }

  update(dt) {
    const g = this.game;
    if (this.homing) {
      const t = this.homing;
      if (!t.alive) { this.expire(); return; }
      const dx = t.x - this.x, dy = t.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.vx = (dx / d) * this.speed;
      this.vy = (dy / d) * this.speed;
      this.z += (Math.max(30, (t.height || 50) * 0.5) - this.z) * Math.min(1, dt * 5);
    }
    this.steer?.(this, dt);
    if (!this.alive) return;
    this.trail.push({ x: this.x, y: this.y, z: this.z });
    if (this.trail.length > 8) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) { this.expire(); return; }

    if (this.x < 0 || this.x > WORLD.w || this.y < 0 || this.y > WORLD.h) { this.expire(); return; }

    if (!this.homing) {
      if (wallAt(this.x, this.y)) {
        g.fx.burst(this.x - this.vx * 0.02, this.y - this.vy * 0.02, this.z, this.color, 6, { speed: 150, life: 0.3 });
        this.expire();
        return;
      }
      for (const o of g.dynWalls) {
        if (Math.hypot(o.x - this.x, o.y - this.y) < o.r + this.radius * 0.5) {
          g.fx.burst(this.x, this.y, this.z, this.color, 6, { speed: 150, life: 0.3 });
          this.expire();
          return;
        }
      }
    }

    const targets = this.homing ? [this.homing] : enemiesOf(g, this.team);
    for (const u of targets) {
      if (this.hit.has(u.id)) continue;
      if (Math.hypot(u.x - this.x, u.y - this.y) > u.radius + this.radius) continue;
      this.hit.add(u.id);
      const ok = this.dmg > 0 ? dealDamage(g, this.owner, u, this.dmg, { from: { x: this.x - this.vx, y: this.y - this.vy }, ...this.opts }) : true;
      this.onHit?.(this, u, ok);
      if (!this.pierce || this.homing) { this.alive = false; this.onExpire = null; return; }
    }
  }
}
