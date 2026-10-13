// 英雄定义：每位英雄的普攻、蓄力攻击、穿梭方式与两个技能机制都不同
import { hitArc, hitCircle, hitLine, enemiesOf, dealDamage } from './combat.js';
import { Projectile } from './entities/projectile.js';
import { Zone } from './entities/zone.js';
import { lerp, rand, clamp, angleDiff } from './math.js';
import { BOUNDS } from './config.js';
import { sfx } from './audio.js';

const ahead = (h, d) => ({ x: clamp(h.x + h.facing.x * d, BOUNDS.x0, BOUNDS.x1), y: clamp(h.y + h.facing.y * d, BOUNDS.y0, BOUNDS.y1) });

// ───────────────────────── 烈焰剑士：近战斗士 ─────────────────────────
const ember = {
  id: 'ember',
  name: '烈焰剑士',
  en: 'Ember Knight',
  role: '近战 · 斗士',
  blurb: '贴身连斩、火焰突进与环身风暴，擅长近身压制。',
  color: '#d63a2c',
  color2: '#ff8a3d',
  body: '#3b2a2a',
  hood: '#8e1f1a',
  weapon: 'sword',
  maxHp: 1250,
  speed: 255,
  ranged: false,
  aiRange: 70,
  aiAttackRange: 105,
  assistRange: 170,
  dash: { type: 'dash', name: '疾影步', cd: 2.3, speed: 1150, time: 0.17 },
  basic: {
    name: '烈焰连斩',
    times: [0.26, 0.26, 0.42],
    fn(h, g, i) {
      const heavy = i === 2;
      h.impulse(heavy ? 520 : 300, 0.08);
      sfx.swing();
      g.after(0.06, () => {
        if (!h.alive) return;
        const range = heavy ? 125 : 100, arc = heavy ? 1.7 : 2.3;
        g.fx.slash(h.x, h.y, 28, h.faceAngle, range, arc, heavy ? '#ffb347' : '#ff7a2f', { width: heavy ? 30 : 22, dur: 0.2, dir: i === 1 ? -1 : 1 });
        const n = hitArc(g, h, { range, arc, dmg: heavy ? 74 : 44, kb: heavy ? 420 : 130, hitstop: heavy ? 0.07 : 0.035, shake: heavy ? 6 : 2 });
        if (n) g.fx.burst(h.x + h.facing.x * 60, h.y + h.facing.y * 60, 30, '#ffb347', 10, { speed: 260, life: 0.35 });
      });
    },
  },
  charged: {
    name: '烈焰回旋',
    maxTime: 0.9,
    moveMul: 0.45,
    recover: 0.42,
    fn(h, g, r) {
      const R = lerp(115, 195, r);
      sfx.heavy();
      g.fx.slash(h.x, h.y, 26, h.faceAngle, R, Math.PI * 2, '#ff7a2f', { width: 34, dur: 0.28, follow: h });
      g.fx.slash(h.x, h.y, 26, h.faceAngle + Math.PI, R * 0.8, Math.PI * 2, '#ffd27a', { width: 18, dur: 0.24, dir: -1, follow: h });
      g.fx.ring(h.x, h.y, 20, R, '#ff7a2f', { dur: 0.35, width: 6 });
      g.fx.burst(h.x, h.y, 20, '#ff9a40', 30 + r * 30, { speed: 380, life: 0.5, type: 'ember', up: 120 });
      g.fx.light(h.x, h.y, R * 1.8, 0.35);
      hitCircle(g, h, h.x, h.y, R, lerp(70, 175, r), { kb: lerp(260, 520, r), burn: r >= 1 ? { dps: 34, t: 3 } : null, hitstop: 0.08, shake: 4 + r * 6 });
    },
  },
  skills: [
    {
      name: '炎龙突进',
      desc: '向前高速突进，灼烧沿途敌人并留下持续燃烧的火焰轨迹。',
      cd: 6,
      castTime: 0.24,
      aiRange: 300,
      aimRange: 330,
      fn(h, g) {
        const dist = 340, time = 0.22;
        h.impulse(dist / time, time);
        h.invuln = Math.max(h.invuln, 0.12);
        sfx.fire();
        const hitSet = new Set();
        for (let k = 0; k <= 5; k++) {
          g.after((k * time) / 5, () => {
            if (!h.alive) return;
            hitCircle(g, h, h.x, h.y, 60, 92, { kb: 220, burn: { dps: 24, t: 2.5 }, hitstop: 0.04, shake: 3 }, hitSet);
            g.fx.burst(h.x, h.y, 20, '#ff7a2f', 10, { speed: 160, life: 0.45, type: 'ember', up: 100 });
            g.addZone(new Zone(g, {
              owner: h, kind: 'fire', x: h.x, y: h.y, radius: 46, life: 2.6, tick: 0.45,
              onTick: (z) => hitCircle(g, h, z.x, z.y, z.radius, 15, { dot: true, silent: true }),
            }));
          });
        }
      },
    },
    {
      name: '烈焰风暴',
      desc: '召唤环绕自身的火焰旋风 3.5 秒，持续灼烧周围敌人，并提升 25% 移速。',
      cd: 12,
      castTime: 0.2,
      aiRange: 140,
      fn(h, g) {
        h.buffs.flame = 3.5;
        sfx.fire();
        g.fx.ring(h.x, h.y, 20, 140, '#ff7a2f', { dur: 0.4, width: 6 });
        g.addZone(new Zone(g, {
          owner: h, kind: 'flameAura', follow: h, x: h.x, y: h.y, radius: 125, life: 3.5, tick: 0.3,
          onTick: (z) => hitCircle(g, h, z.x, z.y, z.radius, 26, { kb: 70, silent: true }),
        }));
      },
    },
  ],
  speedMul: (h) => (h.buffs.flame > 0 ? 1.25 : 1),
};

// ───────────────────────── 雷霆法师：远程爆发 ─────────────────────────
function arcaneBolt(h, g, angle, dmg) {
  g.projectiles.push(new Projectile(g, {
    owner: h, kind: 'arcane', x: h.x + Math.cos(angle) * 20, y: h.y + Math.sin(angle) * 20, z: 34,
    angle, speed: 760, life: 0.62, dmg, radius: 11, color: '#b98cff', opts: { kb: 90 },
    onHit: (p, u) => g.fx.burst(p.x, p.y, p.z, '#d6b8ff', 10, { speed: 200, life: 0.3 }),
  }));
}

const storm = {
  id: 'storm',
  name: '雷霆法师',
  en: 'Storm Mage',
  role: '远程 · 法师',
  blurb: '奥术飞弹牵制、雷光贯穿与连锁闪电爆发，用闪现拉开距离。',
  color: '#5b3fd1',
  color2: '#a98bff',
  body: '#2a2546',
  hood: '#3a2b8f',
  weapon: 'staff',
  maxHp: 960,
  speed: 245,
  ranged: true,
  projSpeed: 760,
  aiRange: 360,
  aiAttackRange: 450,
  assistRange: 520,
  dash: { type: 'blink', name: '闪现', cd: 3.2, dist: 240 },
  basic: {
    name: '奥术飞弹',
    times: [0.3, 0.3, 0.46],
    fn(h, g, i) {
      const a = h.faceAngle;
      sfx.bolt();
      if (i < 2) arcaneBolt(h, g, a, 40);
      else for (const off of [-0.17, 0, 0.17]) arcaneBolt(h, g, a + off, 30);
      g.fx.burst(h.x + h.facing.x * 26, h.y + h.facing.y * 26, 40, '#c9b0ff', 6, { speed: 120, life: 0.25 });
    },
  },
  charged: {
    name: '雷光贯穿',
    maxTime: 1.0,
    moveMul: 0.3,
    recover: 0.45,
    fn(h, g, r) {
      const len = lerp(420, 680, r), w = lerp(28, 46, r);
      const x0 = h.x + h.facing.x * 20, y0 = h.y + h.facing.y * 20;
      const x1 = h.x + h.facing.x * len, y1 = h.y + h.facing.y * len;
      sfx.zap();
      g.fx.lightning([{ x: x0, y: y0, z: 36 }, { x: x1, y: y1, z: 30 }], '#b79cff', { width: lerp(3, 7, r), dur: 0.28, jagAmt: 14 });
      g.fx.lightning([{ x: x0, y: y0, z: 36 }, { x: x1, y: y1, z: 30 }], '#7fd8ff', { width: 2, dur: 0.22, jagAmt: 22 });
      g.fx.ring(x1, y1, 10, 70, '#b79cff', { dur: 0.3 });
      g.fx.burst(x1, y1, 30, '#d9c8ff', 20, { speed: 260, life: 0.4 });
      g.fx.light((x0 + x1) / 2, (y0 + y1) / 2, len * 0.7, 0.3);
      hitLine(g, h, x0, y0, x1, y1, w, lerp(80, 210, r), { kb: 160, stun: r >= 1 ? 0.7 : 0, hitstop: 0.06, shake: 3 + r * 5 });
    },
  },
  skills: [
    {
      name: '连锁闪电',
      desc: '向前方敌人释放闪电，最多弹射 3 个目标并减速。',
      cd: 5,
      castTime: 0.26,
      aiRange: 430,
      aimRange: 470,
      fn(h, g) {
        const fa = h.faceAngle;
        let first = null, best = Infinity;
        for (const u of enemiesOf(g, h.team)) {
          if (u.isInvulnerable?.()) continue;
          const dx = u.x - h.x, dy = u.y - h.y, d = Math.hypot(dx, dy);
          if (d > 470 + u.radius) continue;
          const ad = Math.abs(angleDiff(fa, Math.atan2(dy, dx)));
          if (ad > 0.9) continue;
          const s = d * (1 + ad) * (u.kind === 'hero' ? 0.6 : 1);
          if (s < best) { best = s; first = u; }
        }
        sfx.zap();
        if (!first) {
          const p = ahead(h, 300);
          g.fx.lightning([{ x: h.x, y: h.y, z: 40 }, { x: p.x, y: p.y, z: 10 }], '#8fd0ff', { width: 3, dur: 0.2 });
          h.skillCd[0] *= 0.4;
          return;
        }
        const dmgs = [115, 85, 65];
        const hitIds = new Set();
        let prev = { x: h.x, y: h.y, z: 44 };
        let cur = first;
        dmgs.forEach((dmg, k) => {
          if (!cur) return;
          const target = cur, from = prev;
          hitIds.add(target.id);
          g.after(k * 0.09, () => {
            g.fx.lightning([from, { x: target.x, y: target.y, z: 40 }], '#8fd0ff', { width: 4, dur: 0.25 });
            g.fx.burst(target.x, target.y, 40, '#bfe8ff', 12, { speed: 220, life: 0.3 });
            g.fx.light(target.x, target.y, 140, 0.25);
            if (k > 0) sfx.zap();
            dealDamage(g, h, target, dmg, { slow: { amt: 0.35, t: 1.4 }, hitstop: 0.03, shake: 2 });
          });
          prev = { x: target.x, y: target.y, z: 40 };
          let next = null, nd = 270;
          for (const u of enemiesOf(g, h.team)) {
            if (hitIds.has(u.id) || u.isInvulnerable?.()) continue;
            const d = Math.hypot(u.x - target.x, u.y - target.y);
            if (d < nd) { nd = d; next = u; }
          }
          cur = next;
        });
      },
    },
    {
      name: '雷暴领域',
      desc: '在前方召唤 3.2 秒雷暴，随机劈打区域内敌人并减速。',
      cd: 13,
      castTime: 0.35,
      aiRange: 380,
      aimRange: 420,
      fn(h, g) {
        const c = ahead(h, 300);
        sfx.zap();
        g.fx.ring(c.x, c.y, 160, 150, '#a98bff', { dur: 0.4, width: 5 });
        g.addZone(new Zone(g, {
          owner: h, kind: 'storm', x: c.x, y: c.y, radius: 155, life: 3.2, tick: 0.4, tickT: 0.25,
          onTick: (z) => {
            const inside = enemiesOf(g, h.team).filter((u) => Math.hypot(u.x - z.x, u.y - z.y) < z.radius + u.radius && !u.isInvulnerable?.());
            const tgt = inside.length && Math.random() < 0.8 ? inside[Math.floor(Math.random() * inside.length)] : null;
            const a = rand(0, Math.PI * 2), rr = rand(0, z.radius * 0.8);
            const p = tgt ? { x: tgt.x + rand(-12, 12), y: tgt.y + rand(-12, 12) } : { x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr };
            g.fx.lightning([{ x: p.x + rand(-40, 40), y: p.y, z: 320 }, { x: p.x, y: p.y, z: 0 }], '#c4adff', { width: 4, dur: 0.22, jagAmt: 20 });
            g.fx.ring(p.x, p.y, 5, 55, '#c4adff', { dur: 0.3 });
            g.fx.burst(p.x, p.y, 4, '#e6dbff', 10, { speed: 200, life: 0.35, up: 160, grav: 400 });
            g.fx.light(p.x, p.y, 150, 0.2);
            sfx.zap();
            hitCircle(g, h, p.x, p.y, 58, 50, { slow: { amt: 0.4, t: 1 }, silent: true, shake: 1.5 });
          },
        }));
      },
    },
  ],
};

// ───────────────────────── 寒霜游侠：远程控制 ─────────────────────────
function iceArrow(h, g, angle, dmg, { pierce = false, slow = null, big = false } = {}) {
  g.projectiles.push(new Projectile(g, {
    owner: h, kind: big ? 'shard' : 'arrow', x: h.x + Math.cos(angle) * 18, y: h.y + Math.sin(angle) * 18, z: 34,
    angle, speed: big ? 900 : 1000, life: big ? 0.62 : 0.56, dmg, radius: big ? 12 : 9, pierce, color: '#8fe3ff',
    opts: { kb: big ? 140 : 70, slow },
    onHit: (p) => g.fx.burst(p.x, p.y, p.z, '#d8f6ff', 8, { speed: 180, life: 0.3, size: 2.5 }),
  }));
}

const frost = {
  id: 'frost',
  name: '寒霜游侠',
  en: 'Frost Ranger',
  role: '远程 · 射手',
  blurb: '高频冰棱箭、扇形箭雨、冰霜陷阱和后跃冰爆，边打边撤的风筝型英雄。',
  color: '#2f8fb3',
  color2: '#8fe3ff',
  body: '#24323d',
  hood: '#1f5f7a',
  weapon: 'bow',
  maxHp: 1000,
  speed: 265,
  ranged: true,
  projSpeed: 1000,
  aiRange: 400,
  aiAttackRange: 500,
  assistRange: 560,
  dash: { type: 'roll', name: '翻滚', cd: 2.0, speed: 1000, time: 0.2 },
  basic: {
    name: '冰棱箭',
    times: [0.24, 0.24, 0.38],
    fn(h, g, i) {
      sfx.arrow();
      if (i < 2) iceArrow(h, g, h.faceAngle, 34);
      else iceArrow(h, g, h.faceAngle, 54, { pierce: true, slow: { amt: 0.3, t: 1.2 }, big: true });
    },
  },
  charged: {
    name: '寒霜箭雨',
    maxTime: 1.0,
    moveMul: 0.4,
    recover: 0.4,
    fn(h, g, r) {
      const n = 3 + Math.round(r * 4);
      const spread = lerp(0.45, 0.85, r);
      sfx.ice();
      for (let k = 0; k < n; k++) {
        const a = h.faceAngle - spread / 2 + (spread * k) / (n - 1);
        iceArrow(h, g, a, lerp(40, 64, r), { pierce: true, slow: r >= 1 ? { amt: 0.45, t: 1.6 } : null, big: true });
      }
      g.fx.burst(h.x + h.facing.x * 24, h.y + h.facing.y * 24, 36, '#bff0ff', 16, { speed: 200, life: 0.3, angle: h.faceAngle, spread });
      h.impulse(-160, 0.1);
    },
  },
  skills: [
    {
      name: '冰霜陷阱',
      desc: '在前方布置冰霜陷阱（最多 2 个），敌人踩中后被定身 1.3 秒并受到伤害。',
      cd: 7,
      castTime: 0.2,
      aiRange: 160,
      fn(h, g) {
        const p = ahead(h, 80);
        const mine = g.zones.filter((z) => z.kind === 'trap' && z.owner === h && z.alive);
        if (mine.length >= 2) mine[0].end();
        sfx.ice();
        g.fx.ring(p.x, p.y, 5, 50, '#8fe3ff', { dur: 0.3 });
        g.addZone(new Zone(g, {
          owner: h, kind: 'trap', x: p.x, y: p.y, radius: 48, life: 14,
          onUpdate: (z) => {
            if (z.age < 0.6) return;
            for (const u of enemiesOf(g, h.team)) {
              if (u.kind === 'tower' || u.kind === 'core') continue;
              if (Math.hypot(u.x - z.x, u.y - z.y) < z.radius + u.radius * 0.5) {
                hitCircle(g, h, z.x, z.y, z.radius + 30, 90, { root: 1.3, hitstop: 0.05, shake: 4 });
                g.fx.ring(z.x, z.y, 10, 110, '#bff0ff', { dur: 0.4, width: 6 });
                g.fx.burst(z.x, z.y, 10, '#d8f6ff', 30, { speed: 300, life: 0.6, up: 200, grav: 500, type: 'shard', size: 4 });
                g.fx.light(z.x, z.y, 180, 0.3);
                sfx.ice();
                z.end();
                return;
              }
            }
          },
        }));
      },
    },
    {
      name: '后跃冰爆',
      desc: '在原地引爆冰霜新星（伤害 + 强力减速），同时向后跃起拉开距离。',
      cd: 10,
      castTime: 0.12,
      aiRange: 170,
      fn(h, g) {
        sfx.ice();
        g.fx.ring(h.x, h.y, 10, 170, '#8fe3ff', { dur: 0.45, width: 7 });
        g.fx.ring(h.x, h.y, 10, 170, '#8fe3ff', { dur: 0.45, fill: true });
        g.fx.burst(h.x, h.y, 10, '#d8f6ff', 36, { speed: 360, life: 0.6, up: 150, grav: 500, type: 'shard', size: 3.5 });
        g.fx.light(h.x, h.y, 220, 0.35);
        hitCircle(g, h, h.x, h.y, 170, 95, { kb: 240, slow: { amt: 0.5, t: 2 }, hitstop: 0.05, shake: 5 });
        const back = { x: -h.facing.x, y: -h.facing.y };
        h.impulse(950, 0.24, back);
        h.hop = { t: 0, dur: 0.3, h: 46 };
        h.invuln = Math.max(h.invuln, 0.22);
      },
    },
  ],
};

export const HEROES = { ember, storm, frost };
export const HERO_LIST = [ember, storm, frost];
