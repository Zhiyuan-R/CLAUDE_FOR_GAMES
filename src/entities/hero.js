// 英雄：状态机（idle / attack / charging / dash / cast / mounting / recall）+ 装备属性 + 坐骑 + 回城
import { Unit } from './unit.js';
import { SPAWN, RESPAWN_BASE, RECALL_TIME } from '../config.js';
import { norm, angleDiff, clamp } from '../math.js';
import { enemiesOf, dealDamage } from '../combat.js';
import { blankInput } from '../input.js';
import { sumStats } from '../items.js';
import { MOUNT_TIME } from '../mounts.js';
import { los, nearestFloor } from '../nav.js';
import { wallAt } from '../map.js';
import { sfx } from '../audio.js';

const BUFFER_TIME = 0.22;

export class Hero extends Unit {
  constructor(game, def, team, mount) {
    super(game, { x: SPAWN[team].x, y: SPAWN[team].y, team, radius: Math.round(14 * def.size), maxHp: def.maxHp, kind: 'hero' });
    this.def = def;
    this.name = def.name;
    this.height = 52 * def.size;
    this.mass = 3;
    this.facing = { x: team === 0 ? 1 : -1, y: 0 };
    this.state = 'idle';
    this.stateT = 0;
    this.combo = 0;
    this.comboT = 0;
    this.chargeT = 0;
    this.chargeCd = 0;
    this.dashCd = 0;
    this.skillCd = [0, 0];
    this.buffs = {};
    this.forced = null;
    this.hop = null;
    this.buffer = null;
    this.input = blankInput();
    this.controller = null;
    this.walkT = 0;
    this.speedNow = 0;
    this.ghosts = [];
    this.swing = null;
    this.respawnT = 0;
    this.stats = { kills: 0, deaths: 0, assists: 0, dmg: 0, cs: 0 };
    this.items = [];
    this.attrs = null;
    this.shield = 0;
    this.shieldT = 0;
    this.stealthT = 0;
    this.mount = mount;
    this.mounted = false;
    this.mountT = 0;
    this.mountCd = 0;
    this.recallT = 0;
    this.lastDmgT = -99;
    this.recentAttackers = new Map();
    this.computeAttrs();
  }

  get faceAngle() { return Math.atan2(this.facing.y, this.facing.x); }

  computeAttrs() {
    const a = sumStats(this.items);
    const tb = this.game.teamBuffs?.[this.team] || {};
    if (tb.dragon > 0) a.power += 0.15;
    if (tb.colossus > 0) { a.armor += 0.15; a.regen += 10; }
    if (this.buffs.berserk > 0) { a.haste += 0.45; a.lifesteal += 0.2; }
    a.power = 1 + a.power;
    a.armor = Math.min(0.5, a.armor);
    a.cdr = Math.min(0.4, a.cdr);
    a.haste = 1 + Math.min(0.9, a.haste);
    let spd = 1 + a.speed + (this.buffs.haste > 0 ? 0.25 : 0);
    if (this.buffs.whirl > 0) spd *= 0.85;
    if (this.mounted) spd += this.mount.speed;
    a.speedMul = spd;
    this.attrs = a;
    const maxHp = Math.round(this.def.maxHp + a.hp);
    if (maxHp !== this.maxHp) {
      if (maxHp > this.maxHp) this.hp += maxHp - this.maxHp;
      this.maxHp = maxHp;
      this.hp = Math.min(this.hp, maxHp);
    }
  }

  readInput(dt) {
    const inp = this.controller.read(dt);
    this.input = inp;
    if (!this.alive) { this.buffer = null; return; }
    if (inp.dash) this.buffer = { a: 'dash', t: BUFFER_TIME };
    else if (inp.s1) this.buffer = { a: 's1', t: BUFFER_TIME };
    else if (inp.s2) this.buffer = { a: 's2', t: BUFFER_TIME };
    else if (inp.attack) this.buffer = { a: 'attack', t: BUFFER_TIME };
  }

  update(dt) {
    const g = this.game, d = this.def;
    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn();
      return;
    }
    this.updateStatus(dt);
    if (!this.alive) return;

    this.dashCd -= dt;
    this.chargeCd -= dt;
    this.mountCd -= dt;
    this.skillCd[0] -= dt;
    this.skillCd[1] -= dt;
    for (const k in this.buffs) this.buffs[k] -= dt;
    if (this.shieldT > 0 && (this.shieldT -= dt) <= 0) this.shield = 0;
    if (this.stealthT > 0) this.stealthT -= dt;
    this.targetable = this.stealthT <= 0;
    this.computeAttrs();
    if (this.attrs.regen) this.hp = Math.min(this.maxHp, this.hp + this.attrs.regen * dt);
    if (this.mounted && this.mount.id === 'stag') this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.03 * dt);
    if (this.buffer && (this.buffer.t -= dt) <= 0) this.buffer = null;
    this.comboT -= dt;
    if (this.comboT <= 0 && this.state !== 'attack') this.combo = 0;

    const inp = this.input;
    const stunned = this.status.stun > 0;
    const rooted = this.status.root > 0;
    if (stunned && this.state !== 'idle' && this.state !== 'dash') { this.state = 'idle'; this.chargeT = 0; }

    let mx = inp.mx || 0, my = inp.my || 0;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const moving = ml > 0.1;

    // 坐骑引导与回城引导：移动或行动会打断
    if (this.state === 'mounting' || this.state === 'recall') {
      const interrupt = moving || this.buffer || inp.charge || stunned;
      if (interrupt) {
        this.state = 'idle';
      } else if (this.state === 'mounting') {
        if ((this.mountT -= dt) <= 0) { this.state = 'idle'; this.mounted = true; g.fx.ring(this.x, this.y, 10, 70, this.mount.color2, { dur: 0.35 }); sfx.ready(); }
      } else if ((this.recallT -= dt) <= 0) {
        this.state = 'idle';
        this.dismount();
        const sp = SPAWN[this.team];
        g.fx.ring(this.x, this.y, 60, 5, '#9fe8ff', { dur: 0.3 });
        this.x = sp.x; this.y = sp.y;
        g.fx.ring(this.x, this.y, 5, 90, '#9fe8ff', { dur: 0.5 });
        g.fx.burst(this.x, this.y, 30, '#9fe8ff', 24, { speed: 200, life: 0.6 });
      }
    }
    if (inp.mount && this.state === 'idle' && !stunned) {
      if (this.mounted) this.dismount();
      else if (this.mountCd <= 0) { this.state = 'mounting'; this.mountT = MOUNT_TIME; }
    }
    if (inp.recall && (this.state === 'idle') && !stunned) { this.state = 'recall'; this.recallT = RECALL_TIME; sfx.blink(); }

    if (this.state === 'attack' || this.state === 'cast' || this.state === 'dash') {
      this.stateT -= dt;
      if (this.stateT <= 0) this.state = 'idle';
    }

    if (inp.aim) this.facing = { x: inp.aim.x, y: inp.aim.y };
    else if (moving && (this.state === 'idle' || this.state === 'charging')) this.facing = norm(mx, my);

    if (!stunned) this.handleActions(dt, inp, rooted, moving, mx, my);

    let sp = 0;
    if ((this.state === 'idle' || this.state === 'charging') && !rooted && !stunned) {
      sp = d.speed * this.slowMul * this.attrs.speedMul;
      if (this.state === 'charging') sp *= d.charged.moveMul;
    }
    this.vx = moving ? mx * sp : 0;
    this.vy = moving ? my * sp : 0;
    if (this.forced) {
      this.vx = this.forced.vx;
      this.vy = this.forced.vy;
      if ((this.forced.t -= dt) <= 0) this.forced = null;
    }
    if (rooted || stunned) { this.vx = 0; this.vy = 0; this.forced = null; }

    this.x += (this.vx + this.kx) * dt;
    this.y += (this.vy + this.ky) * dt;

    if (this.hop) {
      this.hop.t += dt;
      const p = Math.min(1, this.hop.t / this.hop.dur);
      this.z = Math.sin(p * Math.PI) * this.hop.h;
      if (p >= 1) { this.hop = null; this.z = 0; }
    }

    const spd = Math.hypot(this.vx, this.vy);
    this.speedNow = spd;
    this.walkT += spd * dt * (this.mounted ? 0.035 : 0.05);
    if (this.swing && (this.swing.t += dt) >= this.swing.dur) this.swing = null;

    // 战猪：骑乘冲撞
    if (this.mounted && this.mount.id === 'boar' && spd > 300) {
      for (const u of enemiesOf(g, this.team)) {
        if (u.kind !== 'hero' && u.kind !== 'minion') continue;
        if (Math.hypot(u.x - this.x, u.y - this.y) < u.radius + this.radius + 14) {
          dealDamage(g, this, u, 70, { kb: 520, stun: 0.6, hitstop: 0.08, shake: 7 });
          this.dismount();
          break;
        }
      }
    }

    if (spd > 520) this.ghosts.push({ x: this.x, y: this.y, z: this.z, fx: this.facing.x, fy: this.facing.y, life: 0.22, max: 0.22 });
    for (const gh of this.ghosts) gh.life -= dt;
    this.ghosts = this.ghosts.filter((gh) => gh.life > 0);
  }

  dismount() {
    if (!this.mounted) return;
    this.mounted = false;
    this.mountCd = 2.5;
    this.game.fx.burst(this.x, this.y, 10, '#8a7a9a', 10, { type: 'smoke', speed: 90, life: 0.5, size: 9 });
  }

  breakStealth() {
    if (this.stealthT > 0) { this.stealthT = 0; this.targetable = true; }
  }

  handleActions(dt, inp, rooted, moving, mx, my) {
    const d = this.def;
    const b = this.buffer?.a;
    const acting = b || (inp.charge && this.chargeCd <= 0);
    if (this.mounted && acting && !(b === 'dash' && this.mount.id === 'raptor')) this.dismount();

    if (b === 'dash' && this.dashCd <= 0 && !rooted && this.state !== 'dash' && this.state !== 'cast') {
      this.buffer = null;
      this.chargeT = 0;
      this.doDash(moving ? norm(mx, my) : { ...this.facing });
      return;
    }

    if (this.state === 'charging') {
      const before = this.chargeT;
      this.chargeT += dt * this.attrs.haste;
      if (before < d.charged.maxTime && this.chargeT >= d.charged.maxTime) {
        this.game.fx.ring(this.x, this.y, 10, 60, d.color2, { dur: 0.3, width: 3 });
        if (this === this.game.player) sfx.ready();
      }
      if (!inp.charge) this.releaseCharge();
      return;
    }

    if (this.state !== 'idle') return;

    if (inp.charge && this.chargeCd <= 0) {
      this.state = 'charging';
      this.chargeT = 0;
      if (this === this.game.player) sfx.charge();
      return;
    }
    if (b === 's1' || b === 's2') {
      const i = b === 's1' ? 0 : 1;
      this.buffer = null;
      if (this.skillCd[i] <= 0) this.castSkill(i);
      else if (this === this.game.player) this.game.fx.text(this.x, this.y, 90, '冷却中', '#a9a3c9', 13);
      return;
    }
    if (b === 'attack') {
      this.buffer = null;
      this.doBasic();
    }
  }

  // 玩家无需鼠标：在面朝方向的扇形内自动吸附最近的敌人
  autoAim(range) {
    if (this.input.aim) return;
    let best = null, bestScore = Infinity;
    const fa = this.faceAngle;
    for (const u of enemiesOf(this.game, this.team)) {
      if (u.isInvulnerable?.()) continue;
      const dx = u.x - this.x, dy = u.y - this.y;
      const dd = Math.hypot(dx, dy);
      if (dd > range + u.radius) continue;
      const ad = Math.abs(angleDiff(fa, Math.atan2(dy, dx)));
      if (ad > 0.75 && dd > u.radius + 30) continue;
      if (!los(this.x, this.y, u.x, u.y)) continue;
      let score = dd * (1 + ad * 1.5);
      if (u.kind === 'hero') score *= 0.6;
      if (u.kind === 'chest') score *= 1.5;
      if (score < bestScore) { bestScore = score; best = u; }
    }
    if (best) this.facing = norm(best.x - this.x, best.y - this.y);
  }

  doBasic() {
    const d = this.def;
    this.breakStealth();
    this.autoAim(d.assistRange);
    const times = d.basic.times;
    const i = this.combo % times.length;
    this.state = 'attack';
    this.stateT = times[i] / this.attrs.haste;
    this.combo = (i + 1) % times.length;
    this.comboT = this.stateT + 0.45;
    this.swing = { t: 0, dur: this.stateT * 0.8, i };
    d.basic.fn(this, this.game, i);
  }

  releaseCharge() {
    const d = this.def;
    const ratio = clamp(this.chargeT / d.charged.maxTime, 0, 1);
    this.breakStealth();
    this.autoAim(d.assistRange * 1.2);
    this.state = 'attack';
    this.stateT = d.charged.recover;
    this.chargeCd = 0.8;
    this.chargeT = 0;
    this.swing = { t: 0, dur: d.charged.recover, i: 9 };
    d.charged.fn(this, this.game, ratio);
  }

  castSkill(i) {
    const s = this.def.skills[i];
    if (s.type !== 'stealth') this.breakStealth();
    this.autoAim(s.aimRange || this.def.assistRange);
    this.state = 'cast';
    this.stateT = s.castTime;
    this.skillCd[i] = s.cd * (1 - this.attrs.cdr);
    this._casting = i;
    this.swing = { t: 0, dur: s.castTime, i: 10 + i };
    s.fn(this, this.game);
  }

  doDash(dir) {
    const dd = this.def.dash;
    const g = this.game;
    this.dashCd = dd.cd * (1 - this.attrs.cdr * 0.5);
    if (dd.type === 'blink') {
      g.fx.burst(this.x, this.y, 30, this.def.color2, 18, { speed: 160, life: 0.4 });
      g.fx.ring(this.x, this.y, 30, 5, this.def.color2, { dur: 0.25 });
      let tx = this.x, ty = this.y;
      for (let s = 1; s <= 12; s++) {
        const nx = this.x + (dir.x * dd.dist * s) / 12, ny = this.y + (dir.y * dd.dist * s) / 12;
        if (!wallAt(nx, ny)) { tx = nx; ty = ny; }
      }
      const p = nearestFloor(tx, ty);
      this.x = p.x; this.y = p.y;
      this.state = 'dash';
      this.stateT = 0.1;
      this.invuln = Math.max(this.invuln, 0.15);
      g.fx.ring(this.x, this.y, 5, 50, this.def.color2, { dur: 0.3 });
      g.fx.burst(this.x, this.y, 30, this.def.color2, 18, { speed: 220, life: 0.4 });
      g.fx.light(this.x, this.y, 160, 0.3);
      sfx.blink();
    } else {
      const mul = this.mounted && this.mount.id === 'raptor' ? 1.5 : 1;
      this.state = 'dash';
      this.stateT = dd.time;
      this.forced = { vx: dir.x * dd.speed * mul, vy: dir.y * dd.speed * mul, t: dd.time };
      this.invuln = Math.max(this.invuln, dd.time + 0.04);
      if (dd.type === 'roll') this.hop = { t: 0, dur: dd.time, h: 14 };
      g.fx.burst(this.x, this.y, 5, '#cfc6e8', 8, { type: 'smoke', speed: 80, life: 0.5, size: 8, up: 10 });
      sfx.dash();
    }
    this.facing = { ...dir };
  }

  impulse(speed, time, dir = this.facing) {
    this.forced = { vx: dir.x * speed, vy: dir.y * speed, t: time };
  }

  die(killer) {
    this.alive = false;
    this.state = 'idle';
    this.forced = null;
    this.hop = null;
    this.z = 0;
    this.chargeT = 0;
    this.buffs = {};
    this.shield = 0;
    this.stealthT = 0;
    this.mounted = false;
    this.clearStatus();
    this.stats.deaths++;
    this.respawnT = RESPAWN_BASE + Math.min(16, this.game.time / 45);
    this.game.onUnitDeath(this, killer);
  }

  respawn() {
    const sp = SPAWN[this.team];
    this.alive = true;
    this.computeAttrs();
    this.hp = this.maxHp;
    this.x = sp.x;
    this.y = sp.y;
    this.invuln = 1.5;
    this.state = 'idle';
    this.dashCd = 0;
    this.facing = { x: this.team === 0 ? 1 : -1, y: 0 };
    this.game.fx.ring(this.x, this.y, 10, 90, this.def.color2, { dur: 0.6 });
  }
}
