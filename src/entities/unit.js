// 所有可受伤单位（英雄、小兵、防御塔）的基类
import { dealDamage } from '../combat.js';

let nextId = 1;

export class Unit {
  constructor(game, { x, y, team, radius, maxHp, kind }) {
    this.game = game;
    this.id = nextId++;
    this.kind = kind;
    this.team = team;
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.kx = 0; // 击退速度
    this.ky = 0;
    this.radius = radius;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.alive = true;
    this.targetable = true;
    this.mass = 1;
    this.flash = 0;
    this.invuln = 0;
    this.height = 60;
    this.status = { stun: 0, root: 0, slow: 0, slowAmt: 0, burn: 0, burnDps: 0, burnTick: 0, burnSrc: null, burnColor: null };
    this.shield = 0;
  }

  get slowMul() { return (this.status.slow > 0 ? 1 - this.status.slowAmt : 1) * (this.inWater ? 0.7 : 1); }

  updateStatus(dt) {
    const s = this.status;
    if (s.stun > 0) s.stun -= dt;
    if (s.root > 0) s.root -= dt;
    if (s.slow > 0) s.slow -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (s.burn > 0) {
      s.burn -= dt;
      s.burnTick -= dt;
      if (s.burnTick <= 0) {
        s.burnTick = 0.5;
        if (s.burnSrc) dealDamage(this.game, s.burnSrc, this, s.burnDps * 0.5, { dot: true, color: s.burnColor });
        if (Math.random() < 0.8) this.game.fx.burst(this.x, this.y, 30, s.burnColor || '#ff8a2a', 3, { type: 'ember', speed: 40, up: 90, life: 0.7, size: 3 });
      }
    }
    // 击退速度指数衰减
    const k = Math.exp(-9 * dt);
    this.kx *= k;
    this.ky *= k;
  }

  clearStatus() {
    Object.assign(this.status, { stun: 0, root: 0, slow: 0, slowAmt: 0, burn: 0, burnDps: 0, burnSrc: null });
    this.kx = this.ky = 0;
  }

  die(killer) {
    this.alive = false;
    this.game.onUnitDeath(this, killer);
  }
}
