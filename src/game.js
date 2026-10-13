// 对局逻辑：单位更新、碰撞、兵线、击杀与胜负
import { BOUNDS, BLUE, RED, SPAWN, FOUNTAIN_R, LANE_Y, FIRST_WAVE, WAVE_INTERVAL, WAVE_SIZE, TEAM_NAMES, mirror } from './config.js';
import { FX } from './fx.js';
import { Hero } from './entities/hero.js';
import { Tower } from './entities/tower.js';
import { Minion } from './entities/minion.js';
import { HEROES } from './heroes.js';
import { AIController } from './ai.js';
import { PlayerController } from './input.js';
import { buildProps, TOWER_SPOTS } from './map.js';
import { clamp } from './math.js';
import { sfx } from './audio.js';

export class Game {
  constructor({ playerHero, aiHero, difficulty = 'normal', auto = false, demo = false }, kb) {
    this.opts = { playerHero, aiHero, difficulty, auto, demo };
    this.time = 0;
    this.fx = new FX();
    this.timers = [];
    this.heroes = [];
    this.minions = [];
    this.towers = [];
    this.projectiles = [];
    this.zones = [];
    this.units = [];
    this.props = buildProps();
    this.obstacles = this.props.filter((p) => p.solid);
    this.score = [0, 0];
    this.banners = [];
    this.winner = null;
    this.endT = 0;
    this.hitstopT = 0;
    this.shakeMag = 0;
    this.waveT = FIRST_WAVE;
    this.waveN = 0;
    this.firstBlood = false;

    for (const team of [BLUE, RED]) {
      const pos = (x) => (team === BLUE ? { x, y: LANE_Y } : mirror(x, LANE_Y));
      const outer = new Tower(this, { team, kind: 'tower', ...pos(TOWER_SPOTS[1].x) });
      const core = new Tower(this, { team, kind: 'core', guard: outer, ...pos(TOWER_SPOTS[0].x) });
      this.towers.push(core, outer);
    }

    this.player = new Hero(this, HEROES[playerHero], BLUE);
    this.enemy = new Hero(this, HEROES[aiHero], RED);
    this.player.controller = auto ? new AIController(this, this.player, difficulty) : new PlayerController(kb);
    this.enemy.controller = new AIController(this, this.enemy, difficulty);
    this.heroes.push(this.player, this.enemy);
    this.rebuildUnits();
    if (!demo) this.banner('对局开始 · 摧毁敌方基地水晶', '#e9e2ff');
  }

  rebuildUnits() {
    this.units = [...this.heroes, ...this.minions, ...this.towers];
  }

  after(t, fn) { this.timers.push({ t, fn }); }
  addZone(z) { this.zones.push(z); }
  hitstop(t) { if (!this.opts.demo) this.hitstopT = Math.max(this.hitstopT, t); }
  shake(m) { this.shakeMag = Math.min(18, Math.max(this.shakeMag, m)); }
  banner(text, color = '#fff', sub = '') { this.banners.push({ text, sub, color, life: 2.6, max: 2.6 }); }

  update(dt) {
    for (const h of this.heroes) h.readInput(dt);
    this.shakeMag *= Math.exp(-10 * dt);
    for (const b of this.banners) b.life -= dt;
    this.banners = this.banners.filter((b) => b.life > 0);
    if (this.hitstopT > 0) { this.hitstopT -= dt; return; }

    this.time += dt;
    if (this.winner !== null) this.endT += dt;
    this.rebuildUnits();

    const due = this.timers.filter((t) => (t.t -= dt) <= 0);
    if (due.length) {
      this.timers = this.timers.filter((t) => t.t > 0);
      for (const t of due) t.fn();
    }

    if (this.winner === null) {
      this.waveT -= dt;
      if (this.waveT <= 0) { this.waveT = WAVE_INTERVAL; this.spawnWave(); }
    }

    for (const h of this.heroes) h.update(dt);
    for (const m of this.minions) m.update(dt);
    for (const t of this.towers) t.update(dt);
    for (const p of this.projectiles) if (p.alive) p.update(dt);
    for (const z of this.zones) if (z.alive) z.update(dt);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    this.zones = this.zones.filter((z) => z.alive);
    this.minions = this.minions.filter((m) => m.alive);

    this.resolveCollisions();
    this.fountains(dt);
    this.ambient(dt);
    this.fx.update(dt);
  }

  spawnWave() {
    this.waveN++;
    for (const team of [BLUE, RED]) {
      for (let i = 0; i < WAVE_SIZE; i++) {
        const off = (i - (WAVE_SIZE - 1) / 2) * 40;
        const base = team === BLUE ? { x: 380 - i * 18, y: LANE_Y + off } : mirror(380 - i * 18, LANE_Y - off);
        const m = new Minion(this, { team, x: base.x, y: base.y, laneY: LANE_Y + off * 1.4 });
        // 兵线随时间成长，避免后期僵持
        const grow = 1 + 0.07 * (this.waveN - 1);
        m.maxHp = m.hp = Math.round(m.maxHp * grow);
        m.dmg *= grow;
        this.minions.push(m);
        this.fx.ring(m.x, m.y, 5, 40, team === BLUE ? '#4fb0ff' : '#ff4d5e', { dur: 0.4 });
      }
    }
    if (this.waveN === 1 && !this.opts.demo) this.banner('小兵已出发', '#cfc6ff');
  }

  resolveCollisions() {
    const movers = [...this.heroes.filter((h) => h.alive), ...this.minions];
    const statics = this.towers.filter((t) => t.alive);
    for (const m of movers) {
      for (const o of this.obstacles) pushOut(m, o.x, o.y, o.r);
      for (const t of statics) pushOut(m, t.x, t.y, t.radius);
      m.x = clamp(m.x, BOUNDS.x0, BOUNDS.x1);
      m.y = clamp(m.y, BOUNDS.y0, BOUNDS.y1);
    }
    for (let i = 0; i < movers.length; i++) {
      const a = movers[i];
      if (a.state === 'dash' || a.z > 8) continue;
      for (let j = i + 1; j < movers.length; j++) {
        const b = movers[j];
        if (b.state === 'dash' || b.z > 8) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = (a.radius + b.radius) * 0.85;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / d;
        const wa = b.mass / (a.mass + b.mass), wb = a.mass / (a.mass + b.mass);
        a.x -= dx * push * wa * 0.5;
        a.y -= dy * push * wa * 0.5;
        b.x += dx * push * wb * 0.5;
        b.y += dy * push * wb * 0.5;
      }
    }
  }

  fountains(dt) {
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const sp = SPAWN[h.team];
      if (Math.hypot(h.x - sp.x, h.y - sp.y) < FOUNTAIN_R && h.hp < h.maxHp) {
        h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.14 * dt);
        if (Math.random() < dt * 8) this.fx.burst(h.x, h.y, 10, '#7dffb0', 1, { type: 'ember', speed: 20, up: 80, life: 0.8, size: 3 });
      }
      // 敌方泉水伤害
      const esp = SPAWN[1 - h.team];
      if (Math.hypot(h.x - esp.x, h.y - esp.y) < FOUNTAIN_R * 0.6) {
        h.hp -= h.maxHp * 0.25 * dt;
        if (h.hp <= 0) { h.hp = 0; h.die(this.towers.find((t) => t.team !== h.team)); }
      }
    }
  }

  ambient(dt) {
    for (const p of this.props) {
      if (p.type === 'torch' && Math.random() < dt * 6) {
        this.fx.burst(p.x + (Math.random() - 0.5) * 8, p.y, p.h + 14, '#ffb347', 1, { type: 'ember', speed: 15, up: 60, life: 0.9, size: 2.2, drag: 1 });
      }
    }
    for (const z of this.zones) {
      if (z.kind === 'fire' && Math.random() < dt * 10) this.fx.burst(z.x + (Math.random() - 0.5) * z.radius, z.y + (Math.random() - 0.5) * z.radius, 4, '#ff8a2a', 1, { type: 'ember', speed: 20, up: 90, life: 0.6, size: 3 });
      if (z.kind === 'flameAura' && Math.random() < dt * 30) {
        const a = Math.random() * Math.PI * 2;
        this.fx.burst(z.x + Math.cos(a) * z.radius * 0.9, z.y + Math.sin(a) * z.radius * 0.9, 10, '#ff9a40', 1, { type: 'ember', speed: 60, up: 120, life: 0.5, size: 3.5 });
      }
    }
  }

  onUnitDeath(u, killer) {
    const fx = this.fx;
    if (u.kind === 'minion') {
      fx.burst(u.x, u.y, 15, '#6b5a8f', 12, { type: 'smoke', speed: 60, life: 0.7, size: 7, up: 30 });
      fx.burst(u.x, u.y, 15, u.team === BLUE ? '#4fb0ff' : '#ff4d5e', 10, { speed: 160, life: 0.4 });
      if (killer?.kind === 'hero') killer.stats.cs++;
      return;
    }
    if (u.kind === 'hero') {
      sfx.death();
      fx.burst(u.x, u.y, 30, u.def.color2, 40, { speed: 320, life: 0.8, up: 200, grav: 400, type: 'shard', size: 4 });
      fx.ring(u.x, u.y, 10, 140, u.def.color2, { dur: 0.5, width: 6 });
      fx.light(u.x, u.y, 260, 0.5);
      this.shake(8);
      const team = 1 - u.team;
      this.score[team]++;
      const hero = killer?.kind === 'hero' ? killer : null;
      if (hero) hero.stats.kills++;
      if (this.opts.demo) return;
      const fb = !this.firstBlood;
      this.firstBlood = true;
      if (u === this.player) this.banner(fb ? '你被拿下了一血' : '你被击杀了', '#ff6b6b', `${u.respawnT.toFixed(0)} 秒后复活`);
      else this.banner(fb ? '第一滴血！' : '击杀敌方英雄！', '#ffd24a', `${u.name} 已被击败`);
      return;
    }
    // 防御塔 / 基地
    sfx.boom();
    fx.burst(u.x, u.y, 60, '#8c84a8', 40, { speed: 300, life: 1, up: 260, grav: 500, type: 'shard', size: 6 });
    fx.burst(u.x, u.y, 40, '#6b5a8f', 20, { type: 'smoke', speed: 120, life: 1.4, size: 16, up: 40 });
    fx.ring(u.x, u.y, 20, 260, u.team === BLUE ? '#4fb0ff' : '#ff4d5e', { dur: 0.8, width: 8 });
    fx.light(u.x, u.y, 400, 0.8);
    this.shake(14);
    if (u.kind === 'core') {
      this.winner = 1 - u.team;
      if (!this.opts.demo) {
        const win = this.winner === this.player.team;
        this.banner(win ? '胜利' : '失败', win ? '#ffd24a' : '#ff6b6b', `${TEAM_NAMES[u.team]}基地水晶被摧毁`);
        win ? sfx.win() : sfx.lose();
      }
    } else if (!this.opts.demo) {
      const ours = u.team === this.player.team;
      this.banner(ours ? '我方防御塔被摧毁' : '摧毁敌方防御塔！', ours ? '#ff6b6b' : '#7dd3ff', ours ? '基地水晶失去保护' : '敌方基地水晶已可被攻击');
    }
  }
}

function pushOut(m, x, y, r) {
  const dx = m.x - x, dy = m.y - y;
  const min = r + m.radius;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return;
  const d = Math.sqrt(d2) || 0.01;
  m.x = x + (dx / d) * min;
  m.y = y + (dy / d) * min;
}

