// 电脑英雄：按位置（上 / 中 / 下 / 辅助 / 打野）行动，A* 寻路穿过地牢，
// 会团战支援、打野怪、捡装备、骑坐骑赶路、残血回城。输出与键盘相同的指令结构
import { blankInput } from './input.js';
import { norm, rand, dist, chance } from './math.js';
import { SPAWN, FOUNTAIN_R } from './config.js';
import { MAP } from './map.js';
import { findPath, los } from './nav.js';

export const DIFFICULTY = {
  easy: { label: 'Easy', think: 0.32, dodge: 0.12, aggression: 0.55, skill: 0.5, attackRate: 0.55, lead: 0.3 },
  normal: { label: 'Normal', think: 0.2, dodge: 0.4, aggression: 0.8, skill: 1, attackRate: 0.85, lead: 0.7 },
  hard: { label: 'Hard', think: 0.12, dodge: 0.7, aggression: 1, skill: 1.6, attackRate: 1, lead: 0.95 },
};

// 沿兵线路径的推进进度（路径长度坐标）
function progressOn(path, x, y) {
  let best = Infinity, bestS = 0, acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (l * l)));
    const d = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
    if (d < best) { best = d; bestS = acc + l * t; }
    acc += l;
  }
  return { s: bestS, off: best };
}
function pointAt(path, s) {
  let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + l >= s) { const t = (s - acc) / l; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    acc += l;
  }
  return { ...path[path.length - 1] };
}

export class AIController {
  constructor(game, hero, difficulty = 'normal', role = 'mid') {
    this.g = game;
    this.h = hero;
    this.role = role;
    this.d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.out = blankInput();
    this.thinkT = Math.random() * 0.3;
    this.mode = 'lane';
    this.target = null;
    this.goal = null;
    this.path = null;
    this.pathGoal = null;
    this.repathT = 0;
    this.stuckT = 0;
    this.lastPos = { x: hero.x, y: hero.y };
    this.strafeDir = chance(0.5) ? 1 : -1;
    this.strafeT = 0;
    this.charging = false;
    this.chargeHold = 0;
    this.attackT = 0;
    this.dodged = new WeakSet();
    this.camp = null;
    this.lane = role === 'support' ? 'bot' : role === 'jungle' ? 'mid' : role;
  }

  enemyHeroes() { return this.g.heroes.filter((x) => x.team !== this.h.team && x.alive && x.targetable && !this.g.hidden[this.h.team].has(x.id)); }
  enemyTowers() { return this.g.towers.filter((t) => t.alive && t.team !== this.h.team); }

  towerTanked(t) {
    if (t.target && t.target.kind === 'minion') return true;
    return this.g.minions.some((m) => m.alive && m.team === this.h.team && Math.abs(m.x - t.x) < t.range && dist(m, t) < t.range - 20);
  }

  towerDanger(x, y) {
    for (const t of this.enemyTowers()) {
      if (Math.hypot(t.x - x, t.y - y) < t.range + 50 && !(this.towerTanked(t) && t.target !== this.h)) return t;
    }
    return null;
  }

  visible(u, r) {
    return u.alive && u.targetable && !this.g.hidden[this.h.team].has(u.id) && Math.hypot(u.x - this.h.x, u.y - this.h.y) < r && los(this.h.x, this.h.y, u.x, u.y);
  }

  laneFront() {
    const g = this.g, h = this.h;
    const path = MAP.lanePaths[h.team][this.lane];
    let front = -1;
    for (const m of g.minions) {
      if (m.team !== h.team || m.lane !== this.lane) continue;
      const p = progressOn(path, m.x, m.y);
      if (p.off < 300) front = Math.max(front, p.s);
    }
    if (front < 0) {
      // 没有己方兵线时，站在本路最前面的己方塔前
      for (const t of g.towers) {
        if (!t.alive || t.team !== h.team || t.lane !== this.lane) continue;
        front = Math.max(front, progressOn(path, t.x, t.y).s + 150);
      }
      if (front < 0) front = 300;
    }
    const s = Math.max(0, front - (h.def.ranged ? 160 : 90));
    const p = pointAt(path, s);
    // 别站进无人扛塔的敌方塔范围
    const danger = this.towerDanger(p.x, p.y);
    if (danger) return pointAt(path, Math.max(0, progressOn(path, danger.x, danger.y).s - danger.range - 80));
    return p;
  }

  chooseCamp() {
    const h = this.h, g = this.g;
    let best = null, bestS = Infinity;
    for (const c of g.camps) {
      if (!c.units.some((u) => u.alive)) continue;
      if (c.side === -1) {
        const helpers = g.heroes.filter((x) => x.alive && x.team === h.team && Math.hypot(x.x - c.x, x.y - c.y) < 900).length;
        if (g.time < 360 || helpers < 2 || h.hp / h.maxHp < 0.85) continue;
      }
      const s = Math.hypot(c.x - h.x, c.y - h.y) + (c.side === 1 - h.team ? 600 : 0);
      if (s < bestS) { bestS = s; best = c; }
    }
    return best;
  }

  decide() {
    const h = this.h, g = this.g;
    const hpR = h.hp / h.maxHp;
    const home = SPAWN[h.team];
    const atHome = Math.hypot(h.x - home.x, h.y - home.y) < FOUNTAIN_R * 0.8;
    const foes = this.enemyHeroes().filter((e) => this.visible(e, 700));
    const nearestFoe = foes.sort((a, b) => dist(h, a) - dist(h, b))[0];

    // 残血：有敌人追就撤，没人就回城
    if (atHome && hpR < 0.9) { this.mode = 'heal'; this.target = null; this.goal = null; return; }
    if (hpR < 0.3 || (this.mode === 'recall' && !atHome)) {
      const threat = nearestFoe && dist(h, nearestFoe) < 650;
      this.mode = threat ? 'flee' : 'recall';
      this.target = null;
      this.goal = { x: home.x, y: home.y };
      return;
    }

    // 团战：自己或队友附近有敌方英雄
    let target = null;
    for (const e of foes) {
      const danger = this.towerDanger(e.x, e.y);
      const killable = e.hp / e.maxHp < 0.25 * this.d.aggression && hpR > 0.45;
      if (danger && !killable) continue;
      const allies = g.heroes.filter((a) => a.alive && a.team === h.team && dist(a, e) < 600).length;
      const enemies = g.heroes.filter((a) => a.alive && a.team !== h.team && dist(a, e) < 600).length;
      if (allies + 0.5 < enemies && hpR < 0.6) continue;
      if (!target || dist(h, e) < dist(h, target)) target = e;
    }
    if (!target) {
      for (const a of g.heroes) {
        if (a === h || !a.alive || a.team !== h.team || dist(a, h) > 1100) continue;
        const e = this.enemyHeroes().find((x) => dist(x, a) < 450 && !this.towerDanger(x.x, x.y));
        if (e && hpR > 0.5) { target = e; break; }
      }
    }
    if (target) { this.mode = 'fight'; this.target = target; this.goal = { x: target.x, y: target.y }; return; }

    // 捡装备
    if (!nearestFoe || dist(h, nearestFoe) > 600) {
      const worst = h.items.length < 6 ? -1 : Math.min(...h.items.map((it) => it.r));
      const l = g.loot.filter((x) => x.item.r > worst && !(x.denyT > 0 && x.deniedFor === h) && Math.hypot(x.x - h.x, x.y - h.y) < 520).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      if (l) { this.mode = 'loot'; this.target = null; this.goal = { x: l.x, y: l.y }; return; }
    }

    // 宝箱就在附近就顺手打开
    const chest = g.chests.find((c) => c.alive && this.visible(c, 420));
    if (chest && !nearestFoe) { this.mode = 'farm'; this.target = chest; this.goal = { x: chest.x, y: chest.y }; return; }

    if (this.role === 'jungle') {
      if (!this.camp || !this.camp.units.some((u) => u.alive)) this.camp = this.chooseCamp();
      if (this.camp) {
        const alive = this.camp.units.filter((u) => u.alive);
        const near = alive.sort((a, b) => dist(h, a) - dist(h, b))[0];
        if (near && dist(h, near) < 520 && los(h.x, h.y, near.x, near.y)) { this.mode = 'farm'; this.target = near; this.goal = { x: near.x, y: near.y }; }
        else { this.mode = 'travel'; this.target = null; this.goal = { x: this.camp.x, y: this.camp.y }; }
        return;
      }
    }
    // 被野怪追着打时还手
    const angry = g.monsters.find((m) => m.target === h && this.visible(m, 400));
    if (angry) { this.mode = 'farm'; this.target = angry; this.goal = { x: angry.x, y: angry.y }; return; }

    if (this.role === 'support') {
      const carry = g.heroes.find((a) => a !== h && a.alive && a.team === h.team && a.role === 'bot');
      if (carry) {
        const m = this.minionTarget();
        if (m && dist(m, carry) < 450) { this.mode = 'farm'; this.target = m; this.goal = { x: m.x, y: m.y }; return; }
        this.mode = 'travel';
        this.target = null;
        this.goal = { x: carry.x - (h.team === 0 ? 70 : -70), y: carry.y + 40 };
        return;
      }
    }

    // 兵线：打小兵 / 推塔 / 站到兵线前沿
    const m = this.minionTarget();
    if (m) { this.mode = 'farm'; this.target = m; this.goal = { x: m.x, y: m.y }; return; }
    for (const t of this.enemyTowers()) {
      if (t.isInvulnerable() || dist(h, t) > 700) continue;
      if (this.towerTanked(t) || (!nearestFoe && hpR > 0.7 && g.time > 300)) { this.mode = 'farm'; this.target = t; this.goal = { x: t.x, y: t.y }; return; }
    }
    this.mode = 'travel';
    this.target = null;
    this.goal = this.laneFront();
  }

  minionTarget() {
    const h = this.h;
    let best = null, bd = 520;
    for (const m of this.g.minions) {
      if (m.team === h.team) continue;
      const d = dist(h, m);
      if (d < bd && !this.towerDanger(m.x, m.y) && los(h.x, h.y, m.x, m.y)) { bd = d; best = m; }
    }
    return best;
  }

  followPath(o, dt) {
    const h = this.h;
    const goal = this.goal;
    if (!goal) return 0;
    this.repathT -= dt;
    if (!this.path || this.repathT <= 0 || !this.pathGoal || Math.hypot(goal.x - this.pathGoal.x, goal.y - this.pathGoal.y) > 140) {
      this.path = findPath(h.x, h.y, goal.x, goal.y, h.radius);
      this.pathGoal = { ...goal };
      this.repathT = 1.2;
    }
    if (!this.path.length) this.path = [{ x: goal.x, y: goal.y }];
    while (this.path.length > 1 && Math.hypot(this.path[0].x - h.x, this.path[0].y - h.y) < 40) this.path.shift();
    const next = this.path[0];
    const dd = Math.hypot(next.x - h.x, next.y - h.y);
    if (dd < 30 && this.path.length === 1) return 0;
    const n = norm(next.x - h.x, next.y - h.y);
    o.mx = n.x; o.my = n.y;
    // 卡住了就重新寻路
    this.stuckT += dt;
    if (this.stuckT > 0.8) {
      if (Math.hypot(h.x - this.lastPos.x, h.y - this.lastPos.y) < 20 && h.state === 'idle') { this.repathT = 0; o.mx += rand(-0.6, 0.6); o.my += rand(-0.6, 0.6); }
      this.lastPos = { x: h.x, y: h.y };
      this.stuckT = 0;
    }
    let remain = dd;
    for (let i = 0; i < this.path.length - 1; i++) remain += Math.hypot(this.path[i + 1].x - this.path[i].x, this.path[i + 1].y - this.path[i].y);
    return remain;
  }

  tryDodge(o) {
    const h = this.h;
    if (h.dashCd > 0) return;
    for (const p of this.g.projectiles) {
      if (!p.alive || p.team === h.team || p.homing || this.dodged.has(p)) continue;
      const rx = h.x - p.x, ry = h.y - p.y;
      if (Math.abs(rx) > 400 || Math.abs(ry) > 400) continue;
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
    const h = this.h, g = this.g;
    const hpR = h.hp / h.maxHp;
    for (let i = 0; i < 3; i++) {
      if (h.skillCd[i] > 0) continue;
      const s = h.def.skills[i];
      let want = false;
      if (s.ult) {
        // 大招：有英雄目标，且对方残血、或敌人扎堆、或自己需要保命
        if (t.kind !== 'hero' && s.ai !== 'save') continue;
        const foes = g.heroes.filter((e) => e.alive && e.team !== h.team && dist(e, t) < 400).length;
        if (s.ai === 'save') want = g.heroes.some((a) => a.alive && a.team === h.team && a.hp / a.maxHp < 0.35 && dist(a, h) < 420);
        else if (s.ai === 'kill') want = d < s.aiRange && t.hp / t.maxHp < 0.45;
        else if (s.ai === 'group') want = d < s.aiRange + t.radius && (foes >= 2 || t.hp / t.maxHp < 0.5);
        else want = d < s.aiRange + t.radius && (foes >= 2 || t.hp / t.maxHp < 0.6 || hpR < 0.5);
        if (!want || !chance(this.lastDt * 1.5 * this.d.skill)) continue;
        o.ult = true;
        return true;
      }
      if (s.ai === 'heal') {
        want = hpR < 0.6 || g.heroes.some((a) => a.alive && a.team === h.team && a.hp / a.maxHp < 0.5 && dist(a, h) < 300);
      } else if (s.ai === 'escape') {
        want = (hpR < 0.45 && d < 260) || (t.kind === 'hero' && d < s.aiRange + t.radius && chance(0.3));
      } else if (s.ai === 'self') {
        want = d < s.aiRange + t.radius + 40 && (t.kind === 'hero' || t.kind === 'monster' || chance(0.2));
      } else {
        want = d < s.aiRange + t.radius && (t.kind === 'hero' || (t.kind === 'monster' && t.m.tier >= 1) || chance(0.08));
      }
      if (!want || !chance(this.lastDt * 2.4 * this.d.skill)) continue;
      if (i === 0) o.s1 = true; else o.s2 = true;
      return true;
    }
    return false;
  }

  read(dt) {
    this.lastDt = dt;
    const o = this.out, h = this.h, g = this.g;
    o.attack = o.dash = o.s1 = o.s2 = o.ult = o.mount = o.recall = false;
    o.mx = o.my = 0;
    o.aim = null;
    if (!h.alive) { o.charge = false; this.charging = false; this.path = null; return o; }

    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = this.d.think * rand(0.7, 1.3);
      this.decide();
    }
    // 引导中（上坐骑 / 回城）保持不动
    if (h.state === 'mounting' || h.state === 'recall') {
      o.charge = false;
      if (h.state === 'recall' && this.enemyHeroes().some((e) => dist(e, h) < 500)) o.mx = 0.6;
      return o;
    }
    const hpR = h.hp / h.maxHp;

    if (this.mode === 'heal') { o.charge = false; return o; }
    if (this.mode === 'recall') {
      o.charge = false;
      if (h.state === 'idle' && !h.mounted) o.recall = true;
      else if (h.mounted) o.mount = true;
      return o;
    }
    if (this.mode === 'flee') {
      o.charge = false;
      const remain = this.followPath(o, dt);
      const e = this.enemyHeroes().find((x) => dist(x, h) < 260);
      if (e && h.dashCd <= 0 && chance(dt * 4)) o.dash = true;
      if (e) this.useSkills(o, e, dist(e, h));
      if (!e && remain > 900 && !h.mounted && h.mountCd <= 0 && h.state === 'idle') { o.mx = o.my = 0; o.mount = true; }
      return o;
    }

    const t = this.target && this.target.alive && this.target.targetable ? this.target : null;
    if (t) this.goal = { x: t.x, y: t.y };
    const dx = t ? t.x - h.x : 0, dy = t ? t.y - h.y : 0;
    const d = Math.hypot(dx, dy);

    // 目标不在视线内或太远：寻路接近
    if (!t || d > 650 || !los(h.x, h.y, t.x, t.y, 8)) {
      o.charge = false;
      this.charging = false;
      const remain = this.followPath(o, dt);
      const foeNear = this.enemyHeroes().some((e) => dist(e, h) < 900);
      if (remain > 1000 && !foeNear && !h.mounted && h.mountCd <= 0 && h.state === 'idle' && g.time > 2) { o.mx = o.my = 0; o.mount = true; }
      this.tryDodge(o);
      return o;
    }

    const n = norm(dx, dy);
    const ranged = h.def.ranged;
    const isStructure = t.kind === 'tower' || t.kind === 'core';

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
    else want = ranged ? Math.min(300, h.def.aiRange) : 40 + t.radius;

    let mx = 0, my = 0;
    if (d > want + 25) { mx = n.x; my = n.y; }
    else if (ranged && d < want - 90) { mx = -n.x; my = -n.y; }
    if (t.kind === 'hero') {
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = rand(0.5, 1.3); if (chance(0.6)) this.strafeDir *= -1; }
      const k = ranged ? 0.8 : 0.45;
      mx += -n.y * this.strafeDir * k;
      my += n.x * this.strafeDir * k;
      if (t.state === 'charging' && t.chargeT > 0.3 && d < 220 && chance(this.d.dodge + 0.2)) { mx = -n.x; my = -n.y; }
    }
    if (!isStructure) {
      const danger = this.towerDanger(h.x + mx * 40, h.y + my * 40);
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

    if (t.kind === 'hero' || t.kind === 'monster') if (this.useSkills(o, t, d)) return o;
    if (d <= reach) {
      if (h.state === 'idle' && h.chargeCd <= 0 && (t.kind === 'hero' || t.kind === 'monster' || isStructure) && chance(dt * 0.45 * this.d.aggression)) {
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
    } else if (!ranged && t.kind === 'hero' && d > 200 && d < 420 && h.dashCd <= 0 && hpR > 0.4 && chance(dt * 1.2 * this.d.aggression)) {
      o.dash = true;
      o.mx = n.x;
      o.my = n.y;
    }
    return o;
  }
}
