// 英雄：状态机（idle / attack / charging / dash / cast）+ 输入缓冲 + 自动瞄准
import { Unit } from './unit.js';
import { SPAWN, RESPAWN_BASE, BOUNDS } from '../config.js';
import { norm, angleDiff, clamp } from '../math.js';
import { enemiesOf } from '../combat.js';
import { blankInput } from '../input.js';
import { sfx } from '../audio.js';

const BUFFER_TIME = 0.22;

export class Hero extends Unit {
  constructor(game, def, team) {
    super(game, { x: SPAWN[team].x, y: SPAWN[team].y, team, radius: def.radius || 20, maxHp: def.maxHp, kind: 'hero' });
    this.def = def;
    this.name = def.name;
    this.height = 62;
    this.mass = 3;
    this.facing = { x: team === 0 ? 1 : -1, y: 0 };
    this.state = 'idle';
    this.stateT = 0;
    this.combo = 0;
    this.comboT = 0;
    this.chargeT = 0;
    this.chargeCd = 0;
    this.chargeFull = false;
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
    this.stats = { kills: 0, deaths: 0, dmg: 0, cs: 0 };
  }

  get faceAngle() { return Math.atan2(this.facing.y, this.facing.x); }

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
    this.skillCd[0] -= dt;
    this.skillCd[1] -= dt;
    for (const k in this.buffs) this.buffs[k] -= dt;
    if (this.buffer && (this.buffer.t -= dt) <= 0) this.buffer = null;
    this.comboT -= dt;
    if (this.comboT <= 0 && this.state !== 'attack') this.combo = 0;
    d.onUpdate?.(this, g, dt);

    const inp = this.input;
    const stunned = this.status.stun > 0;
    const rooted = this.status.root > 0;
    if (stunned && this.state !== 'idle' && this.state !== 'dash') {
      this.state = 'idle';
      this.chargeT = 0;
    }

    if (this.state === 'attack' || this.state === 'cast' || this.state === 'dash') {
      this.stateT -= dt;
      if (this.stateT <= 0) this.state = 'idle';
    }

    let mx = inp.mx || 0, my = inp.my || 0;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const moving = ml > 0.1;

    if (inp.aim) this.facing = { x: inp.aim.x, y: inp.aim.y };
    else if (moving && (this.state === 'idle' || this.state === 'charging')) this.facing = norm(mx, my);

    if (!stunned) this.handleActions(dt, inp, rooted, moving, mx, my);

    let sp = 0;
    if ((this.state === 'idle' || this.state === 'charging') && !rooted && !stunned) {
      sp = d.speed * this.slowMul * (d.speedMul ? d.speedMul(this) : 1);
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
    this.walkT += spd * dt * 0.05;
    if (this.swing && (this.swing.t += dt) >= this.swing.dur) this.swing = null;

    if (spd > 520) this.ghosts.push({ x: this.x, y: this.y, z: this.z, fx: this.facing.x, fy: this.facing.y, life: 0.22, max: 0.22 });
    for (const gh of this.ghosts) gh.life -= dt;
    this.ghosts = this.ghosts.filter((gh) => gh.life > 0);
  }

  handleActions(dt, inp, rooted, moving, mx, my) {
    const d = this.def;
    const b = this.buffer?.a;

    // 穿梭可以取消攻击后摇与蓄力
    if (b === 'dash' && this.dashCd <= 0 && !rooted && this.state !== 'dash' && this.state !== 'cast') {
      this.buffer = null;
      this.chargeT = 0;
      this.doDash(moving ? norm(mx, my) : { ...this.facing });
      return;
    }

    if (this.state === 'charging') {
      const before = this.chargeT;
      this.chargeT += dt;
      if (before < d.charged.maxTime && this.chargeT >= d.charged.maxTime) {
        this.game.fx.ring(this.x, this.y, 10, 60, d.color, { dur: 0.3, width: 3 });
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
      let score = dd * (1 + ad * 1.5);
      if (u.kind === 'hero') score *= 0.6;
      if (score < bestScore) { bestScore = score; best = u; }
    }
    if (best) this.facing = norm(best.x - this.x, best.y - this.y);
  }

  doBasic() {
    const d = this.def;
    this.autoAim(d.assistRange);
    const times = d.basic.times;
    const i = this.combo % times.length;
    this.state = 'attack';
    this.stateT = times[i];
    this.combo = (i + 1) % times.length;
    this.comboT = times[i] + 0.45;
    this.swing = { t: 0, dur: times[i] * 0.8, i };
    d.basic.fn(this, this.game, i);
  }

  releaseCharge() {
    const d = this.def;
    const ratio = clamp(this.chargeT / d.charged.maxTime, 0, 1);
    this.autoAim(d.assistRange * 1.2);
    this.state = 'attack';
    this.stateT = d.charged.recover;
    this.chargeCd = 0.8;
    this.chargeT = 0;
    this.swing = { t: 0, dur: d.charged.recover, i: 3 };
    d.charged.fn(this, this.game, ratio);
  }

  castSkill(i) {
    const s = this.def.skills[i];
    this.autoAim(s.aimRange || this.def.assistRange);
    this.state = 'cast';
    this.stateT = s.castTime;
    this.skillCd[i] = s.cd;
    this.swing = { t: 0, dur: s.castTime, i: 4 + i };
    s.fn(this, this.game);
  }

  doDash(dir) {
    const dd = this.def.dash;
    this.dashCd = dd.cd;
    if (dd.type === 'blink') {
      const g = this.game;
      g.fx.burst(this.x, this.y, 30, this.def.color2, 18, { speed: 160, life: 0.4 });
      g.fx.ring(this.x, this.y, 30, 5, this.def.color2, { dur: 0.25 });
      this.x = clamp(this.x + dir.x * dd.dist, BOUNDS.x0, BOUNDS.x1);
      this.y = clamp(this.y + dir.y * dd.dist, BOUNDS.y0, BOUNDS.y1);
      this.state = 'dash';
      this.stateT = 0.1;
      this.invuln = Math.max(this.invuln, 0.15);
      g.fx.ring(this.x, this.y, 5, 50, this.def.color2, { dur: 0.3 });
      g.fx.burst(this.x, this.y, 30, this.def.color2, 18, { speed: 220, life: 0.4 });
      g.fx.light(this.x, this.y, 160, 0.3);
      sfx.blink();
    } else {
      this.state = 'dash';
      this.stateT = dd.time;
      this.forced = { vx: dir.x * dd.speed, vy: dir.y * dd.speed, t: dd.time };
      this.invuln = Math.max(this.invuln, dd.time + 0.04);
      if (dd.type === 'roll') this.hop = { t: 0, dur: dd.time, h: 14 };
      this.game.fx.burst(this.x, this.y, 5, '#cfc6e8', 8, { type: 'smoke', speed: 80, life: 0.5, size: 8, up: 10 });
      sfx.dash();
    }
    this.facing = { ...dir };
  }

  // 短距离强制位移（攻击前冲、突进技能等）
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
    this.clearStatus();
    this.stats.deaths++;
    this.respawnT = RESPAWN_BASE + Math.min(8, this.game.time / 60);
    this.game.onUnitDeath(this, killer);
  }

  respawn() {
    const sp = SPAWN[this.team];
    this.alive = true;
    this.hp = this.maxHp;
    this.x = sp.x;
    this.y = sp.y;
    this.invuln = 1.5;
    this.state = 'idle';
    this.dashCd = 0;
    this.facing = { x: this.team === 0 ? 1 : -1, y: 0 };
    this.game.fx.ring(this.x, this.y, 10, 90, this.def.color, { dur: 0.6 });
  }
}
