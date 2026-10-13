// 电脑对手：与玩家输出相同的指令结构（移动 / 普攻 / 蓄力 / 穿梭 / 技能 + 瞄准方向）
import { blankInput } from './input.js';
import { norm, rand, dist, chance } from './math.js';
import { SPAWN, FOUNTAIN_R, LANE_Y } from './config.js';

export const DIFFICULTY = {
  easy: { label: '简单', think: 0.32, dodge: 0.12, aggression: 0.55, skill: 0.5, attackRate: 0.55, lead: 0.3 },
  normal: { label: '普通', think: 0.18, dodge: 0.4, aggression: 0.8, skill: 1, attackRate: 0.85, lead: 0.7 },
  hard: { label: '困难', think: 0.1, dodge: 0.7, aggression: 1, skill: 1.6, attackRate: 1, lead: 0.95 },
};

export class AIController {
  constructor(game, hero, difficulty = 'normal') {
    this.g = game;
    this.h = hero;
    this.d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.out = blankInput();
    this.thinkT = 0;
    this.target = null;
    this.mode = 'push';
    this.strafeDir = 1;
    this.strafeT = 0;
    this.charging = false;
    this.chargeHold = 0;
    this.attackT = 0;
    this.dodged = new WeakSet();
  }

  enemyHero() { return this.g.heroes.find((x) => x.team !== this.h.team); }
  enemyTowers() { return this.g.towers.filter((t) => t.alive && t.team !== this.h.team); }

  // 敌方塔正在攻击我方小兵（或塔下有我方小兵）时，才算“有兵扛塔”
  towerTanked(t) {
    if (t.target && t.target.kind === 'minion') return true;
    return this.g.minions.some((m) => m.alive && m.team === this.h.team && dist(m, t) < t.range - 20);
  }

  inTowerDanger(x, y) {
    return this.enemyTowers().find((t) => Math.hypot(t.x - x, t.y - y) < t.range + 50 && !this.towerTanked(t)) || null;
  }

  decide() {
    const h = this.h, e = this.enemyHero();
    const hpR = h.hp / h.maxHp;
    const home = SPAWN[h.team];

    if (this.mode === 'retreat') {
      const atHome = Math.hypot(h.x - home.x, h.y - home.y) < FOUNTAIN_R * 0.7;
      if (hpR > 0.92 || (!atHome && hpR > 0.65)) this.mode = 'push';
      else { this.target = null; return; }
    }
    const enemyLow = e.alive && e.hp / e.maxHp < hpR * 0.7 && dist(h, e) < 300;
    if (hpR < 0.28 && !enemyLow) {
      this.mode = 'retreat';
      this.target = null;
      this.charging = false;
      return;
    }

    let target = null;
    if (e.alive && dist(h, e) < 780) {
      const danger = this.inTowerDanger(e.x, e.y);
      const killable = e.hp / e.maxHp < 0.22 * this.d.aggression && hpR > 0.5;
      if (!danger || killable) target = e;
    }
    if (!target) {
      let best = null, bd = 650;
      for (const m of this.g.minions) {
        if (!m.alive || m.team === h.team) continue;
        const d = dist(h, m);
        if (d < bd && !this.inTowerDanger(m.x, m.y)) { bd = d; best = m; }
      }
      target = best;
    }
    if (!target) {
      for (const t of this.enemyTowers()) {
        if (t.isInvulnerable()) continue;
        const enemyAway = !e.alive || dist(e, t) > 700;
        if (dist(h, t) < 950 && (this.towerTanked(t) || (enemyAway && hpR > 0.65))) { target = t; break; }
      }
    }
    this.target = target;
  }

  laneGoal() {
    const h = this.h, dir = h.team === 0 ? 1 : -1;
    const allies = this.g.minions.filter((m) => m.alive && m.team === h.team);
    let x;
    if (allies.length) {
      x = dir > 0 ? Math.max(...allies.map((m) => m.x)) - 90 : Math.min(...allies.map((m) => m.x)) + 90;
    } else {
      const own = this.g.towers.filter((t) => t.alive && t.team === h.team);
      const front = own.sort((a, b) => (b.x - a.x) * dir)[0];
      x = front ? front.x + dir * 160 : SPAWN[h.team].x;
    }
    for (const t of this.enemyTowers()) {
      if (Math.abs(t.x - x) < t.range + 60 && !this.towerTanked(t)) x = t.x - dir * (t.range + 70);
    }
    return { x, y: LANE_Y + (h.team === 0 ? -50 : 50) };
  }

  tryDodge(o) {
    const h = this.h;
    if (h.dashCd > 0) return;
    for (const p of this.g.projectiles) {
      if (!p.alive || p.team === h.team || this.dodged.has(p)) continue;
      const rx = h.x - p.x, ry = h.y - p.y;
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const along = (rx * p.vx + ry * p.vy) / sp;
      if (along <= 0 || along / sp > 0.35) continue;
      const perp = Math.abs(rx * p.vy - ry * p.vx) / sp;
      if (perp > h.radius + p.radius + 14) continue;
      this.dodged.add(p);
      if (!chance(this.d.dodge)) continue;
      const side = (rx * p.vy - ry * p.vx) > 0 ? 1 : -1;
      o.dash = true;
      o.mx = (-p.vy / sp) * side;
      o.my = (p.vx / sp) * side;
      o.aim = null;
      return;
    }
  }

  useSkills(o, t, d) {
    const h = this.h;
    const skills = h.def.skills;
    for (let i = 0; i < 2; i++) {
      if (h.skillCd[i] > 0) continue;
      const s = skills[i];
      if (d > s.aiRange + t.radius) continue;
      if (!chance(this.lastDt * 2.2 * this.d.skill)) continue;
      if (i === 0) o.s1 = true; else o.s2 = true;
      return true;
    }
    return false;
  }

  read(dt) {
    this.lastDt = dt;
    const o = this.out, h = this.h, g = this.g;
    o.attack = o.dash = o.s1 = o.s2 = false;
    o.mx = o.my = 0;
    o.aim = null;
    if (!h.alive) { o.charge = false; this.charging = false; return o; }

    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = this.d.think * rand(0.7, 1.3);
      this.decide();
    }

    if (this.mode === 'retreat') {
      o.charge = false;
      const home = SPAWN[h.team];
      const n = norm(home.x - h.x, home.y - h.y);
      if (Math.hypot(home.x - h.x, home.y - h.y) > 40) { o.mx = n.x; o.my = n.y; }
      const e = this.enemyHero();
      if (e.alive && dist(h, e) < 220 && h.dashCd <= 0 && chance(dt * 4)) o.dash = true;
      return o;
    }

    const t = this.target && this.target.alive ? this.target : null;
    if (!t) {
      o.charge = false;
      this.charging = false;
      const goal = this.laneGoal();
      const dx = goal.x - h.x, dy = goal.y - h.y;
      if (Math.hypot(dx, dy) > 40) { const n = norm(dx, dy); o.mx = n.x; o.my = n.y; }
      this.tryDodge(o);
      return o;
    }

    const dx = t.x - h.x, dy = t.y - h.y;
    const d = Math.hypot(dx, dy);
    const n = norm(dx, dy);
    const ranged = h.def.ranged;
    const isStructure = t.kind === 'tower' || t.kind === 'core';

    // 远程英雄预判目标移动
    let ax = t.x, ay = t.y;
    if (ranged && t.vx !== undefined) {
      const tt = d / (h.def.projSpeed || 800);
      ax += (t.vx || 0) * tt * this.d.lead;
      ay += (t.vy || 0) * tt * this.d.lead;
    }
    o.aim = norm(ax - h.x, ay - h.y);

    let want;
    if (t.kind === 'hero') want = h.def.aiRange;
    else if (isStructure) want = t.radius + (ranged ? 300 : 40);
    else want = ranged ? 280 : 45;

    let mx = 0, my = 0;
    if (d > want + 25) { mx = n.x; my = n.y; }
    else if (ranged && d < want - 90) { mx = -n.x; my = -n.y; }
    if (t.kind === 'hero') {
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = rand(0.5, 1.3); if (chance(0.6)) this.strafeDir *= -1; }
      const k = ranged ? 0.8 : 0.45;
      mx += -n.y * this.strafeDir * k;
      my += n.x * this.strafeDir * k;
      // 对手蓄力时拉开距离
      if (t.state === 'charging' && t.chargeT > 0.3 && d < 220 && chance(this.d.dodge + 0.2)) { mx = -n.x; my = -n.y; }
    }
    // 避免无兵时进入敌方塔范围
    if (!isStructure) {
      const danger = this.inTowerDanger(h.x + mx * 40, h.y + my * 40);
      if (danger && !(t.kind === 'hero' && t.hp / t.maxHp < 0.2)) {
        const away = norm(h.x - danger.x, h.y - danger.y);
        mx = away.x * 1.5 + mx * 0.3;
        my = away.y * 1.5 + my * 0.3;
      }
    }
    o.mx = mx;
    o.my = my;

    this.tryDodge(o);
    if (o.dash) { o.charge = false; this.charging = false; return o; }

    if (this.charging) {
      this.chargeHold -= dt;
      o.charge = this.chargeHold > 0;
      if (!o.charge) this.charging = false;
      return o;
    }
    o.charge = false;

    const reach = isStructure
      ? t.radius + (ranged ? h.def.aiAttackRange * 0.85 : 70)
      : h.def.aiAttackRange + t.radius - 10;

    if (d <= reach) {
      if (t.kind === 'hero' && this.useSkills(o, t, d)) return o;
      if (h.state === 'idle' && h.chargeCd <= 0 && t.kind !== 'minion' && chance(dt * 0.45 * this.d.aggression)) {
        this.charging = true;
        this.chargeHold = h.def.charged.maxTime * rand(0.6, 1.15);
        o.charge = true;
        return o;
      }
      this.attackT -= dt;
      if (this.attackT <= 0) {
        o.attack = true;
        this.attackT = rand(0.05, 0.25) / this.d.attackRate;
      }
    } else if (!ranged && t.kind === 'hero' && d > 200 && d < 420 && h.dashCd <= 0 && chance(dt * 1.2 * this.d.aggression)) {
      o.dash = true;
      o.mx = n.x;
      o.my = n.y;
    } else if (t.kind === 'hero' && h.def.skills[0].aiRange > 250 && d <= h.def.skills[0].aiRange + t.radius) {
      this.useSkills(o, t, d);
    }
    return o;
  }
}
