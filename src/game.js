// 对局逻辑：5v5、三路兵线、野怪与宝箱、装备掉落、Boss 团队增益、胜负
import { BLUE, RED, NEUTRAL, SPAWN, FOUNTAIN_R, FIRST_WAVE, WAVE_INTERVAL, TEAM_NAMES } from './config.js';
import { FX } from './fx.js';
import { Hero } from './entities/hero.js';
import { Tower } from './entities/tower.js';
import { Minion } from './entities/minion.js';
import { Monster, Chest, Barrel, MONSTERS } from './entities/monster.js';
import { HEROES, HERO_LIST } from './heroes.js';
import { AIController } from './ai.js';
import { PlayerController } from './input.js';
import { MAP, LANES, buildProps, terrainAt, bushAt, WATER } from './map.js';
import { dealDamage } from './combat.js';
import { resolveWalls } from './nav.js';
import { rollItem, RARITY } from './items.js';
import { MOUNTS, MOUNT_LIST } from './mounts.js';
import { sfx } from './audio.js';

const ROLE_NAMES = { top: 'Top', mid: 'Mid', bot: 'Bot', support: 'Support', jungle: 'Jungle' };
// 各位置偏好的英雄定位
const ROLE_PREF = {
  jungle: ['assassin', 'fighter'],
  support: ['support', 'tank'],
  bot: ['marksman', 'mage'],
  mid: ['mage', 'assassin', 'marksman'],
  top: ['tank', 'fighter'],
};
const pickRand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

function assignRoles(defs) {
  const roles = ['support', 'bot', 'mid', 'jungle', 'top'];
  const left = [...defs];
  const out = new Map();
  for (const r of roles) {
    let idx = left.findIndex((d) => ROLE_PREF[r].includes(d.roleId));
    if (idx < 0) idx = 0;
    out.set(left[idx], r);
    left.splice(idx, 1);
  }
  return out;
}

export class Game {
  constructor({ playerHero, difficulty = 'normal', auto = false, demo = false, mount = 'wolf' }, kb) {
    this.opts = { playerHero, difficulty, auto, demo };
    this.time = 0;
    this.fx = new FX();
    this.timers = [];
    this.heroes = [];
    this.minions = [];
    this.towers = [];
    this.monsters = [];
    this.chests = [];
    this.pets = [];
    this.barrels = [];
    this.hidden = [new Set(), new Set()];
    // 环境伤害来源（尖刺、炸药桶），对所有阵营生效
    this.env = { team: 3, kind: 'env', name: 'Terrain', alive: true, x: 0, y: 0 };
    this.projectiles = [];
    this.zones = [];
    this.dynWalls = [];
    this.loot = [];
    this.units = [];
    this.feed = [];
    this.props = buildProps();
    this.score = [0, 0];
    this.banners = [];
    this.winner = null;
    this.endT = 0;
    this.hitstopT = 0;
    this.shakeMag = 0;
    this.waveT = FIRST_WAVE;
    this.waveN = 0;
    this.firstBlood = false;
    this.teamBuffs = [{ dragon: 0, colossus: 0 }, { dragon: 0, colossus: 0 }];

    // 防御塔：内塔受同路外塔保护，基地水晶在三座内塔全部存活时无敌
    for (const team of [BLUE, RED]) {
      const spots = MAP.towerSpots.filter((s) => s.team === team);
      const byKey = {};
      for (const s of spots.filter((x) => x.tier === 'outer')) byKey[s.lane + 'outer'] = new Tower(this, { team, kind: 'tower', lane: s.lane, tier: 'outer', x: s.x, y: s.y });
      for (const s of spots.filter((x) => x.tier === 'inner')) byKey[s.lane + 'inner'] = new Tower(this, { team, kind: 'tower', lane: s.lane, tier: 'inner', x: s.x, y: s.y, guards: [byKey[s.lane + 'outer']] });
      const c = spots.find((x) => x.tier === 'core');
      const inners = LANES.map((l) => byKey[l + 'inner']);
      byKey.core = new Tower(this, { team, kind: 'core', lane: 'base', tier: 'core', x: c.x, y: c.y, guards: inners, mode: 'all' });
      this.towers.push(...Object.values(byKey));
    }

    // 选英雄：玩家 + 4 名电脑队友 vs 5 名电脑
    const pool = shuffle(HERO_LIST.filter((h) => h.id !== playerHero));
    const allyDefs = [HEROES[playerHero], ...pool.slice(0, 4)];
    const enemyDefs = pool.slice(4, 9);
    const allyRoles = assignRoles(allyDefs);
    const enemyRoles = assignRoles(enemyDefs);
    for (const d of allyDefs) {
      const isPlayer = d.id === playerHero;
      const h = new Hero(this, d, BLUE, isPlayer ? MOUNTS[mount] : pickRand(MOUNT_LIST));
      h.role = allyRoles.get(d);
      h.controller = isPlayer && !auto ? new PlayerController(kb) : new AIController(this, h, difficulty, h.role);
      if (isPlayer) this.player = h;
      this.heroes.push(h);
    }
    for (const d of enemyDefs) {
      const h = new Hero(this, d, RED, pickRand(MOUNT_LIST));
      h.role = enemyRoles.get(d);
      h.controller = new AIController(this, h, difficulty, h.role);
      this.heroes.push(h);
    }
    // 出生点稍微错开
    this.heroes.forEach((h, i) => { h.x += ((i % 5) - 2) * 26 * (h.team ? -1 : 1); h.y += ((i % 5) - 2) * 18; });
    this.enemy = this.heroes.find((h) => h.team === RED);

    this.camps = MAP.camps.map((c) => ({ ...c, units: [], respawnT: c.side === -1 ? 90 : 1 }));
    this.chestSpots = MAP.chests.map((s) => ({ ...s, unit: null, respawnT: 20 + Math.random() * 20 }));
    this.barrelSpots = MAP.barrels.map((s) => ({ ...s, unit: null, respawnT: 0 }));
    this.spikes = MAP.spikes.map((s) => ({ ...s, state: 'down' }));

    this.rebuildUnits();
    if (!demo) {
      this.banner('Welcome to the Arcane Dungeon', '#e9e2ff', `Your role: ${ROLE_NAMES[this.player.role]} · Destroy the enemy Nexus Crystal to win`);
    }
  }

  roleName(h) { return ROLE_NAMES[h.role]; }

  rebuildUnits() {
    this.units = [...this.heroes, ...this.minions, ...this.towers, ...this.monsters, ...this.chests, ...this.pets, ...this.barrels];
  }

  near(x, y, r) {
    return this.units.filter((u) => Math.abs(u.x - x) < r && Math.abs(u.y - y) < r);
  }

  after(t, fn) { this.timers.push({ t, fn }); }
  addZone(z) { this.zones.push(z); }
  hitstop(t) { if (!this.opts.demo) this.hitstopT = Math.max(this.hitstopT, t); }
  shake(m) { this.shakeMag = Math.min(18, Math.max(this.shakeMag, m)); }
  banner(text, color = '#fff', sub = '') { this.banners.push({ text, sub, color, life: 2.8, max: 2.8 }); }
  log(text, color = '#d9d2f2') { this.feed.push({ text, color, life: 7 }); if (this.feed.length > 6) this.feed.shift(); }

  update(dt) {
    for (const h of this.heroes) h.readInput(dt);
    this.shakeMag *= Math.exp(-10 * dt);
    for (const b of this.banners) b.life -= dt;
    this.banners = this.banners.filter((b) => b.life > 0);
    for (const f of this.feed) f.life -= dt;
    this.feed = this.feed.filter((f) => f.life > 0);
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
      this.updateCamps(dt);
    }
    for (const tb of this.teamBuffs) { tb.dragon -= dt; tb.colossus -= dt; }

    for (const h of this.heroes) h.update(dt);
    for (const m of this.minions) m.update(dt);
    for (const m of this.monsters) m.update(dt);
    for (const c of this.chests) c.update(dt);
    for (const p of this.pets) p.update(dt);
    for (const b of this.barrels) b.update(dt);
    for (const t of this.towers) t.update(dt);
    for (const p of this.projectiles) if (p.alive) p.update(dt);
    for (const z of this.zones) if (z.alive) z.update(dt);
    for (const w of this.dynWalls) w.life -= dt;
    this.dynWalls = this.dynWalls.filter((w) => w.life > 0);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    this.zones = this.zones.filter((z) => z.alive);
    this.minions = this.minions.filter((m) => m.alive);
    this.monsters = this.monsters.filter((m) => m.alive);
    this.chests = this.chests.filter((c) => c.alive);
    this.pets = this.pets.filter((p) => p.alive);
    this.barrels = this.barrels.filter((b) => b.alive);

    this.resolveCollisions();
    this.updateTerrain(dt);
    this.updateVisibility();
    this.fountains(dt);
    this.updateLoot(dt);
    this.ambient(dt);
    this.fx.update(dt);
  }

  spawnWave() {
    this.waveN++;
    const grow = 1 + 0.06 * (this.waveN - 1);
    for (const team of [BLUE, RED]) {
      for (const lane of LANES) {
        const path = MAP.lanePaths[team][lane];
        [false, false, true].forEach((caster, k) => {
          this.after(k * 0.9, () => {
            if (this.winner !== null) return;
            this.minions.push(new Minion(this, { team, lane, path, caster, grow }));
          });
        });
      }
    }
    if (this.waveN === 1 && !this.opts.demo) this.banner('Minions are marching down all three lanes', '#cfc6ff');
  }

  updateCamps(dt) {
    for (const c of this.camps) {
      if (c.units.some((u) => u.alive)) continue;
      if (c.respawnT > 0) { c.respawnT -= dt; continue; }
      const m = MONSTERS[c.type];
      c.units = [];
      for (let k = 0; k < m.count; k++) {
        const a = (k / m.count) * Math.PI * 2;
        const off = m.count > 1 ? 50 : 0;
        const u = new Monster(this, c, c.type, c.x + Math.cos(a) * off, c.y + Math.sin(a) * off * 0.6);
        c.units.push(u);
        this.monsters.push(u);
      }
      c.respawnT = m.boss ? 150 : 70;
      if (m.boss && this.time > 5 && !this.opts.demo) this.log(`${m.name} has awakened in its lair`, '#ffb36b');
    }
    for (const s of this.barrelSpots) {
      if (s.unit && s.unit.alive) continue;
      if ((s.respawnT -= dt) <= 0) { s.unit = new Barrel(this, s); this.barrels.push(s.unit); s.respawnT = 40; }
    }
    for (const s of this.chestSpots) {
      if (s.unit && s.unit.alive) continue;
      if ((s.respawnT -= dt) <= 0) {
        s.unit = new Chest(this, s);
        this.chests.push(s.unit);
        s.respawnT = 75;
      }
    }
  }

  resolveCollisions() {
    const movers = [...this.heroes.filter((h) => h.alive), ...this.minions, ...this.pets, ...this.monsters.filter((m) => !m.boss)];
    const statics = [...this.towers.filter((t) => t.alive), ...this.chests, ...this.barrels, ...this.monsters.filter((m) => m.boss)];
    for (const m of movers) {
      for (const t of statics) pushOut(m, t.x, t.y, t.radius);
      for (const w of this.dynWalls) pushOut(m, w.x, w.y, w.r);
      resolveWalls(m);
    }
    for (let i = 0; i < movers.length; i++) {
      const a = movers[i];
      if (a.state === 'dash' || a.z > 8) continue;
      for (let j = i + 1; j < movers.length; j++) {
        const b = movers[j];
        if (b.state === 'dash' || b.z > 8) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = (a.radius + b.radius) * 0.85;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
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

  // 地形：浅水减速、尖刺周期性升起
  updateTerrain(dt) {
    const movers = [...this.heroes.filter((h) => h.alive), ...this.minions, ...this.pets, ...this.monsters];
    for (const u of movers) {
      u.inWater = u.z < 5 && terrainAt(u.x, u.y) === WATER;
      if (u.inWater && Math.hypot(u.vx, u.vy) > 60 && Math.random() < dt * 6) this.fx.ring(u.x, u.y, 4, 30, '#9fe8ff', { dur: 0.5, width: 2 });
      if (u._spikeT > 0) u._spikeT -= dt;
    }
    for (const s of this.spikes) {
      const c = (this.time + s.phase) % 3;
      const prev = s.state;
      s.state = c < 1.7 ? 'down' : c < 2.2 ? 'warn' : 'up';
      if (s.state !== 'up') continue;
      if (prev !== 'up') this.fx.burst(s.x, s.y, 4, '#d8d0e8', 6, { speed: 120, life: 0.3, up: 120, grav: 400, type: 'shard', size: 2.5 });
      for (const u of movers) {
        if (u.z > 10 || u._spikeT > 0 || u.invuln > 0) continue;
        if (Math.floor(u.x / 80) !== s.i || Math.floor(u.y / 80) !== s.j) continue;
        u._spikeT = 0.6;
        dealDamage(this, this.env, u, u.kind === 'hero' ? 70 : 45, { slow: { amt: 0.4, t: 0.8 }, raw: true });
      }
    }
  }

  // 草丛视野：站在草丛里的英雄，只有靠得很近、或同在一片草丛里的敌人才看得到；刚出过手会暴露
  updateVisibility() {
    for (const team of [BLUE, RED]) {
      const set = this.hidden[team];
      set.clear();
      for (const h of this.heroes) {
        if (!h.alive || h.team === team || h.revealT > 0) continue;
        const b = bushAt(h.x, h.y);
        if (b < 0) continue;
        let seen = false;
        for (const u of this.units) {
          if (!u.alive || u.team !== team || (u.kind !== 'hero' && u.kind !== 'minion' && u.kind !== 'tower' && u.kind !== 'pet')) continue;
          const d = Math.hypot(u.x - h.x, u.y - h.y);
          if (d < 150 || (u.kind === 'hero' && bushAt(u.x, u.y) === b)) { seen = true; break; }
        }
        if (!seen) set.add(h.id);
      }
    }
  }

  fountains(dt) {
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const sp = SPAWN[h.team];
      if (Math.hypot(h.x - sp.x, h.y - sp.y) < FOUNTAIN_R && h.hp < h.maxHp) {
        h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.16 * dt);
        if (Math.random() < dt * 8) this.fx.burst(h.x, h.y, 10, '#7dffb0', 1, { type: 'ember', speed: 20, up: 80, life: 0.8, size: 3 });
      }
      const esp = SPAWN[1 - h.team];
      if (Math.hypot(h.x - esp.x, h.y - esp.y) < FOUNTAIN_R * 0.7) {
        h.hp -= h.maxHp * 0.3 * dt;
        if (h.hp <= 0) { h.hp = 0; h.die(this.towers.find((t) => t.team !== h.team)); }
      }
    }
  }

  dropItem(x, y, tier) {
    const item = rollItem(tier);
    const a = Math.random() * Math.PI * 2;
    this.loot.push({ x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 14, item, life: 90, age: 0, denyT: 0 });
    if (item.r >= 2) this.fx.ring(x, y, 10, 80, RARITY[item.r].color, { dur: 0.6, width: 5 });
  }

  // 拾取：背包未满直接放入；已满时只替换品质更低的装备，被替换的掉在地上
  tryPickup(h, l) {
    if (h.items.length < 6) { h.items.push(l.item); return true; }
    let worst = 0;
    h.items.forEach((it, i) => { if (it.r < h.items[worst].r) worst = i; });
    if (h.items[worst].r < l.item.r) {
      const old = h.items[worst];
      h.items[worst] = l.item;
      this.loot.push({ x: h.x, y: h.y + 30, item: old, life: 60, age: 0, denyT: 3, deniedFor: h });
      return true;
    }
    return false;
  }

  updateLoot(dt) {
    for (const l of this.loot) {
      l.life -= dt;
      l.age += dt;
      if (l.denyT > 0) l.denyT -= dt;
      if (l.age < 0.5) continue;
      for (const h of this.heroes) {
        if (!h.alive || (l.denyT > 0 && l.deniedFor === h)) continue;
        if (Math.hypot(h.x - l.x, h.y - l.y) > h.radius + 28) continue;
        if (this.tryPickup(h, l)) {
          l.life = 0;
          const col = RARITY[l.item.r].color;
          this.fx.ring(l.x, l.y, 10, 50, col, { dur: 0.35 });
          this.fx.burst(l.x, l.y, 20, col, 14, { speed: 160, life: 0.5 });
          if (h === this.player) {
            sfx.ready();
            this.fx.text(h.x, h.y, 110, `Picked up ${l.item.name}`, col, 16);
          }
          break;
        } else if (h === this.player && (l._msgT || 0) < this.time) {
          l._msgT = this.time + 2;
          this.fx.text(h.x, h.y, 110, 'Bag full (only replaces lower-rarity gear)', '#c9c3e0', 13);
        }
      }
    }
    this.loot = this.loot.filter((l) => l.life > 0);
  }

  ambient(dt) {
    for (const p of this.props) {
      if (p.type === 'sconce' && Math.random() < dt * 3) {
        this.fx.burst(p.x + (Math.random() - 0.5) * 6, p.y - 8, p.h + 22, '#ffb347', 1, { type: 'ember', speed: 12, up: 50, life: 0.8, size: 2, drag: 1 });
      }
    }
    for (const z of this.zones) {
      if (z.kind === 'fire' && Math.random() < dt * 10) this.fx.burst(z.x + (Math.random() - 0.5) * z.radius, z.y + (Math.random() - 0.5) * z.radius, 4, z.color || '#ff8a2a', 1, { type: 'ember', speed: 20, up: 90, life: 0.6, size: 3 });
      if ((z.kind === 'ultField' || z.kind === 'blackhole') && Math.random() < dt * 40) {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * z.radius;
        this.fx.burst(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, 4, z.color, 1, { type: 'ember', speed: 30, up: 140, life: 0.8, size: 4 });
      }
      if (z.kind === 'aura' && Math.random() < dt * 30) {
        const a = Math.random() * Math.PI * 2;
        this.fx.burst(z.x + Math.cos(a) * z.radius * 0.9, z.y + Math.sin(a) * z.radius * 0.9, 10, z.color, 1, { type: 'ember', speed: 60, up: 120, life: 0.5, size: 3.5 });
      }
    }
  }

  onUnitDeath(u, killer) {
    const fx = this.fx;
    const hero = killer?.kind === 'hero' ? killer : null;
    if (u.kind === 'minion') {
      fx.burst(u.x, u.y, 15, '#6b5a8f', 10, { type: 'smoke', speed: 60, life: 0.7, size: 7, up: 30 });
      if (hero) {
        hero.stats.cs++;
        if (Math.random() < 0.04) this.dropItem(u.x, u.y, 0);
        if (hero.def.passive === 'reset') { hero.skillCd[0] -= 1; hero.skillCd[1] -= 1; }
      }
      return;
    }
    if (u.kind === 'barrel') {
      sfx.boom();
      fx.burst(u.x, u.y, 20, '#ffb347', 40, { speed: 420, life: 0.6, up: 200, grav: 400 });
      fx.burst(u.x, u.y, 20, '#5a4a5a', 18, { type: 'smoke', speed: 140, life: 1.1, size: 16, up: 40 });
      fx.ring(u.x, u.y, 10, 170, '#ff7a2f', { dur: 0.45, width: 9 });
      fx.light(u.x, u.y, 320, 0.5);
      this.shake(10);
      this.env.x = u.x; this.env.y = u.y;
      for (const t of this.units) {
        if (!t.alive || t === u || t.kind === 'tower' || t.kind === 'core') continue;
        if (Math.hypot(t.x - u.x, t.y - u.y) > 160 + t.radius) continue;
        // 引爆者自己的队伍也会受伤，但伤害减半
        const friendly = killer && t.team === killer.team;
        dealDamage(this, this.env, t, friendly ? 60 : 140, { kb: 420, from: { x: u.x, y: u.y }, burn: { dps: 20, t: 2 }, raw: true });
      }
      return;
    }
    if (u.kind === 'chest') {
      fx.burst(u.x, u.y, 20, '#ffd27a', 24, { speed: 260, life: 0.6, up: 160, grav: 400 });
      this.dropItem(u.x, u.y, 1);
      if (Math.random() < 0.3) this.dropItem(u.x, u.y, 0);
      return;
    }
    if (u.kind === 'monster') {
      const m = u.m;
      fx.burst(u.x, u.y, 20, '#8a7aa8', 20, { type: 'smoke', speed: 90, life: 0.9, size: 10, up: 30 });
      fx.burst(u.x, u.y, 20, '#d8d0f0', 16, { speed: 260, life: 0.6, up: 200, grav: 500, type: 'shard', size: 4 });
      if (m.boss) {
        sfx.boom();
        this.shake(10);
        this.dropItem(u.x, u.y, 3);
        this.dropItem(u.x, u.y, 2);
        const team = killer && (killer.team === BLUE || killer.team === RED) ? killer.team : null;
        if (team !== null) {
          this.teamBuffs[team][m.buff] = 150;
          const buffText = m.buff === 'dragon' ? 'Team damage +15%' : 'Team damage reduction +15% and regen';
          const ours = team === this.player.team;
          this.banner(`${TEAM_NAMES[team]} team slew the ${m.name}`, ours ? '#ffd24a' : '#ff6b6b', `${buffText} for 150s`);
        }
      } else if (Math.random() < (m.tier >= 1 ? 0.8 : 0.35)) {
        this.dropItem(u.x, u.y, m.tier);
      }
      return;
    }
    if (u.kind === 'hero') {
      if (u === this.player || hero === this.player) sfx.death();
      fx.burst(u.x, u.y, 30, u.def.color2, 40, { speed: 320, life: 0.8, up: 200, grav: 400, type: 'shard', size: 4 });
      fx.ring(u.x, u.y, 10, 140, u.def.color2, { dur: 0.5, width: 6 });
      fx.light(u.x, u.y, 260, 0.5);
      const team = 1 - u.team;
      this.score[team]++;
      if (hero) hero.stats.kills++;
      for (const [, rec] of u.recentAttackers) {
        if (rec.hero !== hero && rec.hero.team !== u.team && this.time - rec.t < 10) {
          rec.hero.stats.assists++;
          if (rec.hero.def.passive === 'reset') { rec.hero.skillCd[0] = 0; rec.hero.skillCd[1] = 0; }
        }
      }
      if (hero && hero.def.passive === 'reset') { hero.skillCd[0] = 0; hero.skillCd[1] = 0; this.fx.ring(hero.x, hero.y, 10, 70, hero.def.color2, { dur: 0.4 }); }
      u.recentAttackers.clear();
      this.dropItem(u.x, u.y, 1);
      const kname = hero ? hero.name : killer?.kind === 'tower' || killer?.kind === 'core' ? 'A tower' : killer?.kind === 'monster' ? killer.name : killer?.kind === 'env' ? 'Terrain' : 'A minion';
      this.log(`${kname} slew ${u.name}`, team === this.player.team ? '#8fd0ff' : '#ff8a8a');
      if (this.opts.demo) return;
      const fb = !this.firstBlood;
      this.firstBlood = true;
      if (u === this.player) this.banner(fb ? 'You gave up First Blood' : 'You have been slain', '#ff6b6b', `Respawning in ${Math.ceil(u.respawnT)}s`);
      else if (hero === this.player) this.banner(fb ? 'First Blood!' : 'Enemy Slain!', '#ffd24a', `${u.name} has been defeated`);
      return;
    }
    // 防御塔 / 基地
    sfx.boom();
    fx.burst(u.x, u.y, 60, '#8c84a8', 40, { speed: 300, life: 1, up: 260, grav: 500, type: 'shard', size: 6 });
    fx.burst(u.x, u.y, 40, '#6b5a8f', 20, { type: 'smoke', speed: 120, life: 1.4, size: 16, up: 40 });
    fx.ring(u.x, u.y, 20, 260, u.team === BLUE ? '#4fb0ff' : '#ff4d5e', { dur: 0.8, width: 8 });
    fx.light(u.x, u.y, 400, 0.8);
    this.shake(10);
    if (u.kind === 'core') {
      this.winner = 1 - u.team;
      if (!this.opts.demo) {
        const win = this.winner === this.player.team;
        this.banner(win ? 'Victory' : 'Defeat', win ? '#ffd24a' : '#ff6b6b', `The ${TEAM_NAMES[u.team]} Nexus Crystal has fallen`);
        win ? sfx.win() : sfx.lose();
      }
    } else {
      const ours = u.team === this.player.team;
      const laneName = ROLE_NAMES[u.lane] || '';
      this.log(`${TEAM_NAMES[u.team]} ${laneName} ${u.tier === 'inner' ? 'inner' : 'outer'} tower destroyed`, ours ? '#ff8a8a' : '#8fd0ff');
      if (!this.opts.demo && (u.tier === 'inner')) this.banner(ours ? 'Our inner tower has fallen' : 'Enemy inner tower destroyed!', ours ? '#ff6b6b' : '#7dd3ff', ours ? 'Our Nexus Crystal is exposed' : 'The enemy Nexus Crystal can now be attacked');
    }
    void NEUTRAL;
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
