// 技能库：普攻 / 蓄力 / 30 种技能机制，均按元素参数化。英雄由这些积木组合而成（见 heroes.js）
import { hitArc, hitCircle, hitLine, enemiesOf, dealDamage } from './combat.js';
import { Projectile } from './entities/projectile.js';
import { Zone } from './entities/zone.js';
import { lerp, rand, clamp, angleDiff, norm } from './math.js';
import { WORLD } from './config.js';
import { los, nearestFloor } from './nav.js';
import { wallAt } from './map.js';
import { sfx } from './audio.js';

export const EL = {
  fire: { c: '#ff7a2f', c2: '#ffd27a', w: '火焰', on: { burn: { dps: 22, t: 2.5 } }, snd: 'fire' },
  ice: { c: '#8fe3ff', c2: '#e6fbff', w: '冰霜', on: { slow: { amt: 0.35, t: 1.5 } }, snd: 'ice' },
  lightning: { c: '#a98bff', c2: '#e6dbff', w: '雷电', on: { slow: { amt: 0.2, t: 0.8 } }, snd: 'zap' },
  poison: { c: '#9be24a', c2: '#e2ffb0', w: '剧毒', on: { burn: { dps: 20, t: 3, color: '#9be24a' } }, snd: 'fire' },
  holy: { c: '#ffe58a', c2: '#fffbe0', w: '圣光', on: {}, snd: 'ready' },
  shadow: { c: '#b061ff', c2: '#e2c4ff', w: '暗影', on: {}, snd: 'blink' },
  nature: { c: '#7ddc6a', c2: '#d8ffc8', w: '自然', on: { slow: { amt: 0.2, t: 1 } }, snd: 'arrow' },
  blood: { c: '#ff4a6a', c2: '#ffc2cf', w: '鲜血', on: {}, snd: 'heavy' },
  earth: { c: '#d9a35a', c2: '#ffe2b0', w: '大地', on: {}, snd: 'heavy' },
  wind: { c: '#9ff5dc', c2: '#effff9', w: '疾风', on: {}, snd: 'dash' },
  water: { c: '#4ab8ff', c2: '#d6f0ff', w: '潮汐', on: { slow: { amt: 0.25, t: 1.2 } }, snd: 'ice' },
  arcane: { c: '#d48cff', c2: '#f6e2ff', w: '奥术', on: {}, snd: 'bolt' },
};
const play = (el) => sfx[EL[el].snd]?.();

// 前方落点（不会落进墙里）
export function ahead(h, d) {
  let x = h.x, y = h.y;
  const steps = Math.ceil(d / 20);
  for (let s = 1; s <= steps; s++) {
    const nx = h.x + h.facing.x * (d * s) / steps, ny = h.y + h.facing.y * (d * s) / steps;
    if (wallAt(nx, ny)) break;
    x = nx; y = ny;
  }
  return { x: clamp(x, 0, WORLD.w), y: clamp(y, 0, WORLD.h) };
}

function pickTarget(h, g, range, cone = 0.9, heroFirst = true) {
  const fa = h.faceAngle;
  let best = null, bestS = Infinity;
  for (const u of enemiesOf(g, h.team)) {
    if (u.isInvulnerable?.() || u.kind === 'chest') continue;
    const dx = u.x - h.x, dy = u.y - h.y, d = Math.hypot(dx, dy);
    if (d > range + u.radius) continue;
    const ad = Math.abs(angleDiff(fa, Math.atan2(dy, dx)));
    if (ad > cone) continue;
    if (!los(h.x, h.y, u.x, u.y)) continue;
    const s = d * (1 + ad) * (heroFirst && u.kind === 'hero' ? 0.5 : 1);
    if (s < bestS) { bestS = s; best = u; }
  }
  return best;
}

function teleport(h, g, x, y, color) {
  g.fx.burst(h.x, h.y, 30, color, 16, { speed: 180, life: 0.4 });
  g.fx.ring(h.x, h.y, 34, 4, color, { dur: 0.25 });
  const p = nearestFloor(x, y);
  h.x = p.x; h.y = p.y;
  g.fx.ring(h.x, h.y, 4, 54, color, { dur: 0.3 });
  g.fx.burst(h.x, h.y, 30, color, 18, { speed: 240, life: 0.4 });
  g.fx.light(h.x, h.y, 170, 0.3);
}

function shoot(h, g, o) {
  const a = o.angle ?? h.faceAngle;
  g.projectiles.push(new Projectile(g, {
    owner: h, x: h.x + Math.cos(a) * 20, y: h.y + Math.sin(a) * 20, z: 34, angle: a,
    radius: 10, speed: 760, life: 0.6, kind: 'bolt', ...o,
    onHit: o.onHit || ((p) => g.fx.burst(p.x, p.y, p.z, o.color || '#fff', 8, { speed: 200, life: 0.3 })),
  }));
}

// ═════════════════════ 普通攻击 ═════════════════════
export function basicSlash(p = {}) {
  const o = { times: [0.26, 0.26, 0.42], dmg: [44, 46, 74], range: 100, arc: 2.3, kb3: 420, lunge: 300, ...p };
  return {
    name: o.name, kind: 'melee', times: o.times,
    fn(h, g, i) {
      const heavy = i === o.times.length - 1;
      const col = o.color || h.def.color2;
      h.impulse(heavy ? o.lunge * 1.7 : o.lunge, 0.08);
      sfx.swing();
      g.after(0.06, () => {
        if (!h.alive) return;
        const range = heavy ? o.range * 1.25 : o.range, arc = heavy ? o.arc * 0.75 : o.arc;
        g.fx.slash(h.x, h.y, 28, h.faceAngle, range, arc, col, { width: heavy ? 30 : 22, dur: 0.2, dir: i % 2 ? -1 : 1 });
        const n = hitArc(g, h, { range, arc, dmg: o.dmg[i], kb: heavy ? o.kb3 : 130, hitstop: heavy ? 0.06 : 0.03, shake: heavy ? 5 : 2, ...(heavy && o.el ? EL[o.el].on : {}) });
        if (n) g.fx.burst(h.x + h.facing.x * 60, h.y + h.facing.y * 60, 30, col, 10, { speed: 260, life: 0.35 });
      });
    },
  };
}

export function basicThrust(p = {}) {
  const o = { times: [0.3, 0.3, 0.45], dmg: [46, 46, 78], len: 150, width: 44, ...p };
  return {
    name: o.name, kind: 'melee', times: o.times,
    fn(h, g, i) {
      const heavy = i === o.times.length - 1;
      const len = heavy ? o.len * 1.35 : o.len;
      const col = o.color || h.def.color2;
      h.impulse(heavy ? 520 : 260, 0.08);
      sfx.swing();
      g.after(0.05, () => {
        if (!h.alive) return;
        const x1 = h.x + h.facing.x * len, y1 = h.y + h.facing.y * len;
        g.fx.lightning([{ x: h.x, y: h.y, z: 30 }, { x: x1, y: y1, z: 30 }], col, { width: heavy ? 6 : 4, dur: 0.14, jagAmt: 2 });
        hitLine(g, h, h.x, h.y, x1, y1, o.width, o.dmg[i], { kb: heavy ? 380 : 120, hitstop: heavy ? 0.05 : 0.025, shake: heavy ? 4 : 1.5, ...(heavy && o.el ? EL[o.el].on : {}) });
      });
    },
  };
}

export function basicShot(p = {}) {
  const o = { times: [0.3, 0.3, 0.46], dmg: [40, 40, 30], speed: 760, life: 0.62, kind: 'bolt', third: 'spread', radius: 11, ...p };
  return {
    name: o.name, kind: 'ranged', times: o.times, projSpeed: o.speed,
    fn(h, g, i) {
      const col = o.color || h.def.color2;
      const a = h.faceAngle;
      const base = { color: col, kind: o.kind, speed: o.speed, life: o.life, radius: o.radius, opts: { kb: 80 } };
      o.kind === 'arrow' ? sfx.arrow() : sfx.bolt();
      if (i < o.times.length - 1) { shoot(h, g, { ...base, angle: a, dmg: o.dmg[i] }); return; }
      if (o.third === 'spread') for (const off of [-0.17, 0, 0.17]) shoot(h, g, { ...base, angle: a + off, dmg: o.dmg[2] });
      else if (o.third === 'pierce') shoot(h, g, { ...base, angle: a, dmg: o.dmg[2], pierce: true, kind: o.kind === 'arrow' ? 'shard' : o.kind, radius: o.radius + 2, opts: { kb: 140, ...(o.el ? EL[o.el].on : {}) } });
      else shoot(h, g, { ...base, angle: a, dmg: o.dmg[2], radius: o.radius * 1.6, opts: { kb: 220, ...(o.el ? EL[o.el].on : {}) } });
    },
  };
}

// ═════════════════════ 蓄力攻击 ═════════════════════
export function chargedSpin(p = {}) {
  const o = { r0: 115, r1: 195, d0: 70, d1: 175, maxTime: 0.9, ...p };
  return {
    name: o.name, maxTime: o.maxTime, moveMul: 0.45, recover: 0.42,
    preview: (h, r) => ({ type: 'circle', R: lerp(o.r0, o.r1, r) }),
    fn(h, g, r) {
      const R = lerp(o.r0, o.r1, r);
      const c = EL[o.el].c, c2 = EL[o.el].c2;
      sfx.heavy();
      g.fx.slash(h.x, h.y, 26, h.faceAngle, R, Math.PI * 2, c, { width: 34, dur: 0.28, follow: h });
      g.fx.slash(h.x, h.y, 26, h.faceAngle + Math.PI, R * 0.8, Math.PI * 2, c2, { width: 18, dur: 0.24, dir: -1, follow: h });
      g.fx.ring(h.x, h.y, 20, R, c, { dur: 0.35, width: 6 });
      g.fx.burst(h.x, h.y, 20, c, 30 + r * 30, { speed: 380, life: 0.5, type: 'ember', up: 120 });
      g.fx.light(h.x, h.y, R * 1.8, 0.35);
      hitCircle(g, h, h.x, h.y, R, lerp(o.d0, o.d1, r), { kb: lerp(260, 520, r), hitstop: 0.08, shake: 4 + r * 6, ...(r >= 1 ? EL[o.el].on : {}) });
    },
  };
}

export function chargedBeam(p = {}) {
  const o = { l0: 420, l1: 680, d0: 80, d1: 210, maxTime: 1, ...p };
  return {
    name: o.name, maxTime: o.maxTime, moveMul: 0.3, recover: 0.45,
    preview: (h, r) => ({ type: 'line', len: lerp(o.l0, o.l1, r), w: lerp(28, 46, r) }),
    fn(h, g, r) {
      const len = lerp(o.l0, o.l1, r), w = lerp(28, 46, r);
      const c = EL[o.el].c, c2 = EL[o.el].c2;
      const x0 = h.x + h.facing.x * 20, y0 = h.y + h.facing.y * 20;
      const x1 = h.x + h.facing.x * len, y1 = h.y + h.facing.y * len;
      sfx.zap();
      g.fx.lightning([{ x: x0, y: y0, z: 36 }, { x: x1, y: y1, z: 30 }], c, { width: lerp(4, 8, r), dur: 0.28, jagAmt: 12 });
      g.fx.lightning([{ x: x0, y: y0, z: 36 }, { x: x1, y: y1, z: 30 }], c2, { width: 2, dur: 0.22, jagAmt: 20 });
      g.fx.ring(x1, y1, 10, 70, c, { dur: 0.3 });
      g.fx.burst(x1, y1, 30, c2, 20, { speed: 260, life: 0.4 });
      g.fx.light((x0 + x1) / 2, (y0 + y1) / 2, len * 0.7, 0.3);
      hitLine(g, h, x0, y0, x1, y1, w, lerp(o.d0, o.d1, r), { kb: 160, stun: r >= 1 ? 0.6 : 0, hitstop: 0.06, shake: 3 + r * 5, ...(r >= 1 ? EL[o.el].on : {}) });
    },
  };
}

export function chargedFan(p = {}) {
  const o = { n0: 3, n1: 7, d0: 40, d1: 64, kind: 'shard', maxTime: 1, ...p };
  return {
    name: o.name, maxTime: o.maxTime, moveMul: 0.4, recover: 0.4,
    preview: (h, r) => ({ type: 'cone', len: 520, spread: lerp(0.45, 0.85, r) }),
    fn(h, g, r) {
      const n = Math.round(lerp(o.n0, o.n1, r));
      const spread = lerp(0.45, 0.85, r);
      const c = EL[o.el].c;
      play(o.el);
      for (let k = 0; k < n; k++) {
        const a = h.faceAngle - spread / 2 + (spread * k) / Math.max(1, n - 1);
        shoot(h, g, { angle: a, kind: o.kind, color: c, speed: 900, life: 0.62, dmg: lerp(o.d0, o.d1, r), radius: 12, pierce: true, opts: { kb: 140, ...(r >= 1 ? EL[o.el].on : {}) } });
      }
      g.fx.burst(h.x + h.facing.x * 24, h.y + h.facing.y * 24, 36, EL[o.el].c2, 16, { speed: 200, life: 0.3, angle: h.faceAngle, spread });
      h.impulse(-160, 0.1);
    },
  };
}

export function chargedLeap(p = {}) {
  const o = { dist0: 160, dist1: 380, R: 150, d0: 80, d1: 195, maxTime: 1, ...p };
  return {
    name: o.name, maxTime: o.maxTime, moveMul: 0.35, recover: 0.5,
    preview: (h, r) => ({ type: 'leap', dist: lerp(o.dist0, o.dist1, r), R: o.R }),
    fn(h, g, r) {
      const dist = lerp(o.dist0, o.dist1, r), dur = 0.42;
      const c = EL[o.el].c;
      h.impulse(dist / dur, dur);
      h.hop = { t: 0, dur, h: 90 };
      h.invuln = Math.max(h.invuln, dur * 0.8);
      sfx.dash();
      g.after(dur, () => {
        if (!h.alive) return;
        sfx.heavy();
        g.fx.ring(h.x, h.y, 10, o.R, c, { dur: 0.4, width: 7 });
        g.fx.ring(h.x, h.y, 10, o.R, c, { dur: 0.4, fill: true });
        g.fx.burst(h.x, h.y, 5, EL[o.el].c2, 34, { speed: 340, life: 0.6, up: 200, grav: 500, type: 'shard', size: 4 });
        g.fx.burst(h.x, h.y, 5, '#8a7a9a', 14, { type: 'smoke', speed: 120, life: 0.8, size: 12, up: 30 });
        g.fx.light(h.x, h.y, 260, 0.35);
        hitCircle(g, h, h.x, h.y, o.R, lerp(o.d0, o.d1, r), { kb: 300, stun: r >= 1 ? 0.7 : 0.25, hitstop: 0.08, shake: 9, ...(r >= 1 ? EL[o.el].on : {}) });
      });
    },
  };
}

export function chargedOrb(p = {}) {
  const o = { d0: 90, d1: 220, r0: 90, r1: 170, maxTime: 1, ...p };
  return {
    name: o.name, maxTime: o.maxTime, moveMul: 0.35, recover: 0.45,
    preview: (h, r) => ({ type: 'line', len: 560, w: lerp(o.r0, o.r1, r) * 0.6 }),
    fn(h, g, r) {
      const R = lerp(o.r0, o.r1, r), dmg = lerp(o.d0, o.d1, r);
      const c = EL[o.el].c;
      const boom = (p2) => {
        g.fx.ring(p2.x, p2.y, 10, R, c, { dur: 0.4, width: 7 });
        g.fx.ring(p2.x, p2.y, 10, R, c, { dur: 0.35, fill: true });
        g.fx.burst(p2.x, p2.y, 20, EL[o.el].c2, 30, { speed: 300, life: 0.5 });
        g.fx.light(p2.x, p2.y, R * 2, 0.35);
        sfx.heavy();
        hitCircle(g, h, p2.x, p2.y, R, dmg, { kb: 260, hitstop: 0.06, shake: 6, ...EL[o.el].on });
      };
      play(o.el);
      shoot(h, g, { kind: 'bolt', color: c, speed: 520, life: 1.05, dmg: 0, radius: 14 + r * 10, onHit: (p2) => boom(p2), onExpire: (p2) => boom(p2) });
    },
  };
}

export function chargedQuake(p = {}) {
  const o = { len0: 200, len1: 360, d0: 70, d1: 180, maxTime: 1, ...p };
  return {
    name: o.name, maxTime: o.maxTime, moveMul: 0.3, recover: 0.5,
    preview: (h, r) => ({ type: 'cone', len: lerp(o.len0, o.len1, r), spread: 1.1 }),
    fn(h, g, r) {
      const len = lerp(o.len0, o.len1, r);
      const c = EL[o.el].c;
      sfx.heavy();
      for (let k = 1; k <= 4; k++) {
        g.after(k * 0.05, () => {
          const d = (len * k) / 4;
          const x = h.x + h.facing.x * d, y = h.y + h.facing.y * d;
          g.fx.ring(x, y, 10, 50 + k * 14, c, { dur: 0.35, width: 6 });
          g.fx.burst(x, y, 4, EL[o.el].c2, 12, { speed: 200, life: 0.5, up: 220, grav: 600, type: 'shard', size: 4 });
        });
      }
      g.shake(6 + r * 6);
      hitArc(g, h, { range: len, arc: 1.1, dmg: lerp(o.d0, o.d1, r), kb: 360, stun: r >= 1 ? 0.9 : 0.3, hitstop: 0.07 });
    },
  };
}

export function chargedThrust(p = {}) {
  const o = { dist0: 220, dist1: 440, d0: 70, d1: 190, maxTime: 0.9, ...p };
  return {
    name: o.name, maxTime: o.maxTime, moveMul: 0.4, recover: 0.35,
    preview: (h, r) => ({ type: 'line', len: lerp(o.dist0, o.dist1, r), w: 50 }),
    fn(h, g, r) {
      const dist = lerp(o.dist0, o.dist1, r), dur = 0.2;
      const c = EL[o.el].c;
      const x0 = h.x, y0 = h.y;
      h.impulse(dist / dur, dur);
      h.invuln = Math.max(h.invuln, dur + 0.05);
      sfx.dash();
      g.after(dur, () => {
        if (!h.alive) return;
        g.fx.lightning([{ x: x0, y: y0, z: 28 }, { x: h.x, y: h.y, z: 28 }], c, { width: 6, dur: 0.25, jagAmt: 3 });
        hitLine(g, h, x0, y0, h.x, h.y, 60, lerp(o.d0, o.d1, r), { kb: 200, hitstop: 0.07, shake: 5, ...(r >= 1 ? EL[o.el].on : {}) });
      });
    },
  };
}

// ═════════════════════ 技能 ═════════════════════
// 每个技能：name 名称、desc 描述、cd 冷却、castTime 施法、aiRange AI 使用距离、ai 使用时机（enemy / self / heal / escape）
const D = (p, k) => (p.power || 1) * k;

export const SKILL = {
  dashStrike: (p) => ({
    cd: 6, castTime: 0.24, aiRange: 300, aimRange: 330, ai: 'enemy',
    desc: `向前突进，${EL[p.el].w}灼烧沿途敌人并留下持续伤害的轨迹。`,
    fn(h, g) {
      const time = 0.22, c = EL[p.el].c;
      h.impulse(340 / time, time);
      h.invuln = Math.max(h.invuln, 0.12);
      play(p.el);
      const hitSet = new Set();
      for (let k = 0; k <= 5; k++) {
        g.after((k * time) / 5, () => {
          if (!h.alive) return;
          hitCircle(g, h, h.x, h.y, 60, D(p, 92), { kb: 220, hitstop: 0.04, shake: 3, ...EL[p.el].on }, hitSet);
          g.fx.burst(h.x, h.y, 20, c, 10, { speed: 160, life: 0.45, type: 'ember', up: 100 });
          g.addZone(new Zone(g, { owner: h, kind: 'fire', color: c, x: h.x, y: h.y, radius: 46, life: 2.6, tick: 0.45, onTick: (z) => hitCircle(g, h, z.x, z.y, z.radius, D(p, 15), { dot: true, silent: true }) }));
        });
      }
    },
  }),
  aura: (p) => ({
    cd: 12, castTime: 0.2, aiRange: 140, ai: 'self',
    desc: `召唤环绕自身的${EL[p.el].w}旋风 3.5 秒，持续伤害周围敌人，移速提升 25%。`,
    fn(h, g) {
      h.buffs.haste = 3.5;
      play(p.el);
      g.fx.ring(h.x, h.y, 20, 140, EL[p.el].c, { dur: 0.4, width: 6 });
      g.addZone(new Zone(g, { owner: h, kind: 'aura', color: EL[p.el].c, follow: h, x: h.x, y: h.y, radius: 125, life: 3.5, tick: 0.3, onTick: (z) => hitCircle(g, h, z.x, z.y, z.radius, D(p, 26), { kb: 70, silent: true }) }));
    },
  }),
  chain: (p) => ({
    cd: 5, castTime: 0.26, aiRange: 430, aimRange: 470, ai: 'enemy',
    desc: `向前方敌人释放${EL[p.el].w}闪电，最多弹射 3 个目标并减速。`,
    fn(h, g) {
      const c = EL[p.el].c;
      const first = pickTarget(h, g, 470);
      sfx.zap();
      if (!first) { const q = ahead(h, 300); g.fx.lightning([{ x: h.x, y: h.y, z: 40 }, { x: q.x, y: q.y, z: 10 }], c, { width: 3, dur: 0.2 }); h.skillCd[h._casting] *= 0.4; return; }
      const hitIds = new Set();
      let prev = { x: h.x, y: h.y, z: 44 }, cur = first;
      [115, 85, 65].forEach((dmg, k) => {
        if (!cur) return;
        const t = cur, from = prev;
        hitIds.add(t.id);
        g.after(k * 0.09, () => {
          g.fx.lightning([from, { x: t.x, y: t.y, z: 40 }], c, { width: 4, dur: 0.25 });
          g.fx.burst(t.x, t.y, 40, EL[p.el].c2, 12, { speed: 220, life: 0.3 });
          dealDamage(g, h, t, D(p, dmg), { slow: { amt: 0.35, t: 1.4 }, hitstop: 0.03, shake: 2 });
        });
        prev = { x: t.x, y: t.y, z: 40 };
        let next = null, nd = 270;
        for (const u of enemiesOf(g, h.team)) {
          if (hitIds.has(u.id) || u.isInvulnerable?.()) continue;
          const d = Math.hypot(u.x - t.x, u.y - t.y);
          if (d < nd) { nd = d; next = u; }
        }
        cur = next;
      });
    },
  }),
  storm: (p) => ({
    cd: 13, castTime: 0.35, aiRange: 380, aimRange: 420, ai: 'enemy',
    desc: `在前方召唤 3.2 秒${EL[p.el].w}风暴，随机打击区域内的敌人。`,
    fn(h, g) {
      const q = ahead(h, 300), c = EL[p.el].c;
      play(p.el);
      g.addZone(new Zone(g, {
        owner: h, kind: 'storm', color: c, x: q.x, y: q.y, radius: 155, life: 3.2, tick: 0.4, tickT: 0.25,
        onTick: (z) => {
          const inside = enemiesOf(g, h.team).filter((u) => Math.hypot(u.x - z.x, u.y - z.y) < z.radius + u.radius && !u.isInvulnerable?.());
          const t = inside.length && Math.random() < 0.8 ? inside[Math.floor(Math.random() * inside.length)] : null;
          const a = rand(0, Math.PI * 2), rr = rand(0, z.radius * 0.8);
          const s = t ? { x: t.x, y: t.y } : { x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr };
          g.fx.lightning([{ x: s.x + rand(-40, 40), y: s.y, z: 320 }, { x: s.x, y: s.y, z: 0 }], c, { width: 4, dur: 0.22, jagAmt: 20 });
          g.fx.ring(s.x, s.y, 5, 55, c, { dur: 0.3 });
          g.fx.light(s.x, s.y, 150, 0.2);
          play(p.el);
          hitCircle(g, h, s.x, s.y, 58, D(p, 50), { silent: true, shake: 1.5, ...EL[p.el].on });
        },
      }));
    },
  }),
  trap: (p) => ({
    cd: 7, castTime: 0.2, aiRange: 160, ai: 'enemy',
    desc: `在前方布置${EL[p.el].w}陷阱（最多 2 个），敌人踩中后定身 1.3 秒。`,
    fn(h, g) {
      const q = ahead(h, 80), c = EL[p.el].c;
      const mine = g.zones.filter((z) => z.kind === 'trap' && z.owner === h && z.alive);
      if (mine.length >= 2) mine[0].end();
      play(p.el);
      g.addZone(new Zone(g, {
        owner: h, kind: 'trap', color: c, x: q.x, y: q.y, radius: 48, life: 16,
        onUpdate: (z) => {
          if (z.age < 0.6) return;
          for (const u of enemiesOf(g, h.team)) {
            if (u.kind !== 'hero' && u.kind !== 'minion' && u.kind !== 'monster') continue;
            if (Math.hypot(u.x - z.x, u.y - z.y) < z.radius + u.radius * 0.5) {
              hitCircle(g, h, z.x, z.y, z.radius + 30, D(p, 90), { root: 1.3, hitstop: 0.05, shake: 4 });
              g.fx.ring(z.x, z.y, 10, 110, c, { dur: 0.4, width: 6 });
              g.fx.burst(z.x, z.y, 10, EL[p.el].c2, 30, { speed: 300, life: 0.6, up: 200, grav: 500, type: 'shard', size: 4 });
              play(p.el);
              z.end();
              return;
            }
          }
        },
      }));
    },
  }),
  novaLeap: (p) => ({
    cd: 10, castTime: 0.12, aiRange: 170, ai: 'escape',
    desc: `原地引爆${EL[p.el].w}新星并强力减速，同时向后跃起拉开距离。`,
    fn(h, g) {
      const c = EL[p.el].c;
      play(p.el);
      g.fx.ring(h.x, h.y, 10, 170, c, { dur: 0.45, width: 7 });
      g.fx.ring(h.x, h.y, 10, 170, c, { dur: 0.45, fill: true });
      g.fx.burst(h.x, h.y, 10, EL[p.el].c2, 36, { speed: 360, life: 0.6, up: 150, grav: 500, type: 'shard', size: 3.5 });
      hitCircle(g, h, h.x, h.y, 170, D(p, 95), { kb: 240, slow: { amt: 0.5, t: 2 }, hitstop: 0.05, shake: 5 });
      h.impulse(950, 0.24, { x: -h.facing.x, y: -h.facing.y });
      h.hop = { t: 0, dur: 0.3, h: 46 };
      h.invuln = Math.max(h.invuln, 0.22);
    },
  }),
  meteor: (p) => ({
    cd: 11, castTime: 0.4, aiRange: 420, aimRange: 460, ai: 'enemy',
    desc: `召唤${EL[p.el].w}陨石，0.9 秒后砸向前方区域，造成大范围重创。`,
    fn(h, g) {
      const t = pickTarget(h, g, 460, 0.6);
      const q = t ? { x: t.x, y: t.y } : ahead(h, 340);
      const c = EL[p.el].c;
      g.addZone(new Zone(g, {
        owner: h, kind: 'warn', color: c, x: q.x, y: q.y, radius: 150, life: 0.9,
        onEnd: (z) => {
          sfx.boom();
          g.fx.ring(z.x, z.y, 10, 170, c, { dur: 0.5, width: 9 });
          g.fx.ring(z.x, z.y, 10, 150, c, { dur: 0.45, fill: true });
          g.fx.burst(z.x, z.y, 10, EL[p.el].c2, 50, { speed: 420, life: 0.8, up: 260, grav: 500, type: 'shard', size: 5 });
          g.fx.burst(z.x, z.y, 10, '#5a4a6a', 16, { type: 'smoke', speed: 140, life: 1, size: 16, up: 40 });
          g.fx.light(z.x, z.y, 340, 0.5);
          hitCircle(g, h, z.x, z.y, 150, D(p, 210), { kb: 380, hitstop: 0.09, shake: 12, ...EL[p.el].on });
        },
      }));
    },
  }),
  boomerang: (p) => ({
    cd: 6, castTime: 0.2, aiRange: 420, ai: 'enemy',
    desc: `掷出${EL[p.el].w}回旋刃，去程与回程各造成一次伤害。`,
    fn(h, g) {
      const c = EL[p.el].c;
      play(p.el);
      shoot(h, g, {
        kind: 'boomerang', color: c, speed: 820, life: 1.6, dmg: D(p, 70), radius: 20, pierce: true, opts: { kb: 120, ...EL[p.el].on },
        steer: (pr) => {
          const age = pr.max - pr.life;
          if (age > 0.55) {
            if (!pr.back) { pr.back = true; pr.hit.clear(); }
            const dx = h.x - pr.x, dy = h.y - pr.y, d = Math.hypot(dx, dy) || 1;
            pr.vx = (dx / d) * 900; pr.vy = (dy / d) * 900;
            if (d < 30 || !h.alive) pr.alive = false;
          }
        },
      });
    },
  }),
  hook: (p) => ({
    cd: 9, castTime: 0.3, aiRange: 480, ai: 'enemy',
    desc: `掷出${EL[p.el].w}锁链，命中第一个敌人后将其拉到身前。`,
    fn(h, g) {
      const c = EL[p.el].c;
      sfx.arrow();
      shoot(h, g, {
        kind: 'hook', color: c, speed: 1100, life: 0.5, dmg: D(p, 90), radius: 16,
        onHit: (pr, u, ok) => {
          if (!ok || u.mass >= 99) return;
          const dx = h.x + h.facing.x * 50 - u.x, dy = h.y + h.facing.y * 50 - u.y;
          u.kx = dx * 9; u.ky = dy * 9;
          if (u.status) u.status.stun = Math.max(u.status.stun, 0.5);
          g.fx.burst(u.x, u.y, 40, c, 14, { speed: 240, life: 0.4 });
          g.shake(5);
        },
      });
    },
  }),
  slam: (p) => ({
    cd: 8, castTime: 0.35, aiRange: 150, ai: 'enemy',
    desc: `${EL[p.el].w}重击前方地面，造成伤害并眩晕 1 秒。`,
    fn(h, g) {
      const c = EL[p.el].c;
      g.after(0.15, () => {
        if (!h.alive) return;
        sfx.heavy();
        const x = h.x + h.facing.x * 80, y = h.y + h.facing.y * 80;
        g.fx.ring(x, y, 10, 140, c, { dur: 0.4, width: 8 });
        g.fx.burst(x, y, 5, EL[p.el].c2, 30, { speed: 300, life: 0.6, up: 220, grav: 600, type: 'shard', size: 4 });
        g.fx.light(x, y, 220, 0.3);
        hitArc(g, h, { range: 190, arc: 1.6, dmg: D(p, 120), stun: 1, kb: 200, hitstop: 0.08, shake: 9 });
      });
    },
  }),
  whirlwind: (p) => ({
    cd: 9, castTime: 0.1, aiRange: 130, ai: 'self',
    desc: `化身${EL[p.el].w}旋风 1.6 秒，期间可以移动并持续绞杀周围敌人。`,
    fn(h, g) {
      const c = EL[p.el].c;
      h.buffs.whirl = 1.6;
      sfx.swing();
      g.addZone(new Zone(g, {
        owner: h, kind: 'whirl', color: c, follow: h, x: h.x, y: h.y, radius: 115, life: 1.6, tick: 0.2,
        onTick: (z) => { hitCircle(g, h, z.x, z.y, z.radius, D(p, 32), { kb: 90, silent: true }); g.fx.slash(z.x, z.y, 26, Math.random() * 6.28, 110, 3, c, { width: 20, dur: 0.18, follow: h }); sfx.swing(); },
      }));
    },
  }),
  shadowStrike: (p) => ({
    cd: 8, castTime: 0.15, aiRange: 420, aimRange: 450, ai: 'enemy',
    desc: `瞬移到前方敌人身后发动${EL[p.el].w}背刺，造成高额伤害并减速。`,
    fn(h, g) {
      const t = pickTarget(h, g, 450, 0.8);
      const c = EL[p.el].c;
      if (!t) { const q = ahead(h, 220); teleport(h, g, q.x, q.y, c); return; }
      const d = norm(t.x - h.x, t.y - h.y);
      teleport(h, g, t.x + d.x * (t.radius + 30), t.y + d.y * (t.radius + 30), c);
      h.facing = { x: -d.x, y: -d.y };
      g.fx.slash(h.x, h.y, 30, h.faceAngle, 90, 2, c, { width: 26, dur: 0.2 });
      dealDamage(g, h, t, D(p, 150), { slow: { amt: 0.4, t: 1.5 }, hitstop: 0.08, shake: 6 });
    },
  }),
  arrowRain: (p) => ({
    cd: 10, castTime: 0.3, aiRange: 450, aimRange: 480, ai: 'enemy',
    desc: `向前方区域降下 2.2 秒${EL[p.el].w}箭雨，持续伤害并减速。`,
    fn(h, g) {
      const t = pickTarget(h, g, 480, 0.6);
      const q = t ? { x: t.x, y: t.y } : ahead(h, 340);
      const c = EL[p.el].c;
      sfx.arrow();
      g.addZone(new Zone(g, {
        owner: h, kind: 'rain', color: c, x: q.x, y: q.y, radius: 140, life: 2.2, tick: 0.25,
        onTick: (z) => {
          for (let k = 0; k < 4; k++) {
            const a = rand(0, 6.28), rr = rand(0, z.radius);
            const x = z.x + Math.cos(a) * rr, y = z.y + Math.sin(a) * rr;
            g.fx.lightning([{ x: x - 20, y, z: 260 }, { x, y, z: 0 }], c, { width: 2, dur: 0.12, jagAmt: 0 });
            g.fx.burst(x, y, 2, EL[p.el].c2, 3, { speed: 80, life: 0.25 });
          }
          hitCircle(g, h, z.x, z.y, z.radius, D(p, 26), { slow: { amt: 0.3, t: 0.6 }, silent: true });
        },
      }));
    },
  }),
  wall: (p) => ({
    cd: 14, castTime: 0.3, aiRange: 260, ai: 'enemy',
    desc: `在前方升起一道${EL[p.el].w}之墙，阻挡移动与飞行物 4 秒，并伤害墙下敌人。`,
    fn(h, g) {
      const q = ahead(h, 160), c = EL[p.el].c;
      const px = -h.facing.y, py = h.facing.x;
      play(p.el);
      for (let k = -2; k <= 2; k++) {
        const x = q.x + px * k * 44, y = q.y + py * k * 44;
        if (wallAt(x, y)) continue;
        g.dynWalls.push({ x, y, r: 26, h: 110, life: 4, max: 4, color: c, seed: Math.random() });
        g.fx.burst(x, y, 4, EL[p.el].c2, 8, { speed: 200, life: 0.5, up: 220, grav: 600, type: 'shard', size: 4 });
      }
      g.shake(5);
      hitCircle(g, h, q.x, q.y, 120, D(p, 80), { kb: 260, ...EL[p.el].on });
    },
  }),
  shield: (p) => ({
    cd: 12, castTime: 0.15, aiRange: 400, ai: 'self',
    desc: `获得${EL[p.el].w}护盾 4 秒，吸收 260 点伤害，并为附近一名受伤队友提供同样的护盾。`,
    fn(h, g) {
      const amt = D(p, 260);
      play(p.el);
      const give = (u) => { u.shield = Math.max(u.shield || 0, amt); u.shieldT = 4; g.fx.ring(u.x, u.y, 10, 60, EL[p.el].c, { dur: 0.4, width: 5 }); };
      give(h);
      const ally = g.heroes.filter((u) => u !== h && u.alive && u.team === h.team && Math.hypot(u.x - h.x, u.y - h.y) < 450).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (ally) give(ally);
    },
  }),
  heal: (p) => ({
    cd: 11, castTime: 0.3, aiRange: 360, ai: 'heal',
    desc: `释放${EL[p.el].w}之泉，为自身与 320 范围内的队友恢复 220 生命。`,
    fn(h, g) {
      const amt = D(p, 220), c = EL[p.el].c;
      sfx.ready();
      g.fx.ring(h.x, h.y, 10, 320, c, { dur: 0.6, width: 5 });
      g.fx.ring(h.x, h.y, 10, 320, c, { dur: 0.5, fill: true });
      for (const u of g.heroes) {
        if (!u.alive || u.team !== h.team || Math.hypot(u.x - h.x, u.y - h.y) > 320) continue;
        u.hp = Math.min(u.maxHp, u.hp + amt);
        g.fx.text(u.x, u.y, 80, `+${Math.round(amt)}`, '#7dffb0', 16);
        g.fx.burst(u.x, u.y, 10, c, 14, { type: 'ember', speed: 40, up: 120, life: 0.9, size: 3.5 });
      }
    },
  }),
  turret: (p) => ({
    cd: 12, castTime: 0.3, aiRange: 400, ai: 'enemy',
    desc: `召唤${EL[p.el].w}图腾，持续 7 秒，自动攻击附近敌人。`,
    fn(h, g) {
      const q = ahead(h, 70), c = EL[p.el].c;
      play(p.el);
      g.fx.ring(q.x, q.y, 5, 60, c, { dur: 0.4 });
      g.addZone(new Zone(g, {
        owner: h, kind: 'turret', color: c, x: q.x, y: q.y, radius: 30, life: 7, tick: 0.55,
        onTick: (z) => {
          let best = null, bd = 470;
          for (const u of enemiesOf(g, h.team)) {
            if (u.isInvulnerable?.() || u.kind === 'chest') continue;
            const d = Math.hypot(u.x - z.x, u.y - z.y);
            if (d < bd && los(z.x, z.y, u.x, u.y)) { bd = d; best = u; }
          }
          if (!best) return;
          g.projectiles.push(new Projectile(g, { owner: h, x: z.x, y: z.y, z: 60, homing: best, speed: 700, life: 1.5, dmg: D(p, 34), radius: 9, kind: 'bolt', color: c, opts: { silent: true, ...EL[p.el].on } }));
        },
      }));
    },
  }),
  poison: (p) => ({
    cd: 9, castTime: 0.3, aiRange: 400, aimRange: 430, ai: 'enemy',
    desc: `在前方释放${EL[p.el].w}毒云 4 秒，持续伤害并减速其中的敌人。`,
    fn(h, g) {
      const t = pickTarget(h, g, 430, 0.6);
      const q = t ? { x: t.x, y: t.y } : ahead(h, 300);
      const c = EL[p.el].c;
      play(p.el);
      g.addZone(new Zone(g, { owner: h, kind: 'cloud', color: c, x: q.x, y: q.y, radius: 140, life: 4, tick: 0.4, onTick: (z) => hitCircle(g, h, z.x, z.y, z.radius, D(p, 24), { slow: { amt: 0.35, t: 0.6 }, dot: true, color: c, silent: true }) }));
    },
  }),
  charge: (p) => ({
    cd: 9, castTime: 0.05, aiRange: 380, ai: 'enemy',
    desc: `向前${EL[p.el].w}冲锋，撞到第一个敌人时将其眩晕 1.1 秒并撞飞。`,
    fn(h, g) {
      const c = EL[p.el].c;
      h.impulse(900, 0.5);
      h.state = 'cast'; h.stateT = 0.5;
      sfx.dash();
      g.addZone(new Zone(g, {
        owner: h, kind: 'none', follow: h, x: h.x, y: h.y, radius: 1, life: 0.5,
        onUpdate: (z) => {
          g.fx.burst(h.x, h.y, 10, '#8a7a9a', 1, { type: 'smoke', speed: 40, life: 0.5, size: 8 });
          for (const u of enemiesOf(g, h.team)) {
            if (u.kind === 'tower' || u.kind === 'core' || u.kind === 'chest') continue;
            if (Math.hypot(u.x - h.x, u.y - h.y) < u.radius + h.radius + 12) {
              dealDamage(g, h, u, D(p, 110), { stun: 1.1, kb: 420, hitstop: 0.1, shake: 9 });
              g.fx.ring(u.x, u.y, 10, 90, c, { dur: 0.35, width: 6 });
              h.forced = null; h.stateT = 0.15;
              z.end();
              return;
            }
          }
        },
      }));
    },
  }),
  vortex: (p) => ({
    cd: 13, castTime: 0.35, aiRange: 400, aimRange: 430, ai: 'enemy',
    desc: `在前方制造${EL[p.el].w}漩涡 2.5 秒，不断把敌人吸向中心并造成伤害。`,
    fn(h, g) {
      const t = pickTarget(h, g, 430, 0.6);
      const q = t ? { x: t.x, y: t.y } : ahead(h, 300);
      const c = EL[p.el].c;
      play(p.el);
      g.addZone(new Zone(g, {
        owner: h, kind: 'vortex', color: c, x: q.x, y: q.y, radius: 170, life: 2.5, tick: 0.3,
        onUpdate: (z, dt) => {
          for (const u of enemiesOf(g, h.team)) {
            if (u.mass >= 99) continue;
            const dx = z.x - u.x, dy = z.y - u.y, d = Math.hypot(dx, dy);
            if (d < z.radius + u.radius && d > 10) { u.x += (dx / d) * 150 * dt; u.y += (dy / d) * 150 * dt; }
          }
        },
        onTick: (z) => hitCircle(g, h, z.x, z.y, z.radius, D(p, 28), { silent: true, ...EL[p.el].on }),
      }));
    },
  }),
  orbitals: (p) => ({
    cd: 12, castTime: 0.15, aiRange: 160, ai: 'self',
    desc: `召唤 3 枚环绕自身的${EL[p.el].w}飞刃，持续 5 秒，切割接触到的敌人。`,
    fn(h, g) {
      const c = EL[p.el].c;
      play(p.el);
      const cdMap = new Map();
      g.addZone(new Zone(g, {
        owner: h, kind: 'orbit', color: c, follow: h, x: h.x, y: h.y, radius: 95, life: 5,
        onUpdate: (z) => {
          for (let k = 0; k < 3; k++) {
            const a = z.age * 5 + (k * Math.PI * 2) / 3;
            const bx = z.x + Math.cos(a) * z.radius, by = z.y + Math.sin(a) * z.radius;
            for (const u of enemiesOf(g, h.team)) {
              if (Math.hypot(u.x - bx, u.y - by) > u.radius + 18) continue;
              if ((cdMap.get(u.id) || 0) > z.age) continue;
              cdMap.set(u.id, z.age + 0.45);
              dealDamage(g, h, u, D(p, 38), { kb: 120, ...EL[p.el].on });
            }
          }
        },
      }));
    },
  }),
  spear: (p) => ({
    cd: 7, castTime: 0.3, aiRange: 560, ai: 'enemy',
    desc: `投出${EL[p.el].w}长矛，贯穿直线上的所有敌人并击退。`,
    fn(h, g) {
      const c = EL[p.el].c;
      sfx.arrow();
      shoot(h, g, { kind: 'spear', color: c, speed: 1200, life: 0.55, dmg: D(p, 120), radius: 16, pierce: true, opts: { kb: 320, hitstop: 0.05, shake: 4, ...EL[p.el].on } });
    },
  }),
  stealth: (p) => ({
    cd: 14, castTime: 0.1, aiRange: 500, ai: 'self',
    desc: `隐入${EL[p.el].w} 3 秒，期间无法被选中，移速提升，下一次攻击伤害提升 80%。`,
    fn(h, g) {
      h.stealthT = 3;
      h.buffs.haste = 3;
      h.buffs.ambush = 6;
      g.fx.burst(h.x, h.y, 30, EL[p.el].c, 24, { type: 'smoke', speed: 100, life: 0.8, size: 10 });
      sfx.blink();
    },
  }),
  drain: (p) => ({
    cd: 10, castTime: 0.2, aiRange: 380, aimRange: 420, ai: 'enemy',
    desc: `用${EL[p.el].w}锁链连接前方敌人 2.5 秒，持续吸取生命。`,
    fn(h, g) {
      const t = pickTarget(h, g, 420, 0.8);
      const c = EL[p.el].c;
      if (!t) { h.skillCd[h._casting] *= 0.3; return; }
      play(p.el);
      g.addZone(new Zone(g, {
        owner: h, kind: 'tether', color: c, follow: h, target: t, x: h.x, y: h.y, radius: 1, life: 2.5, tick: 0.25,
        onUpdate: (z) => { if (!t.alive || !t.targetable || Math.hypot(t.x - h.x, t.y - h.y) > 560) z.end(); },
        onTick: () => {
          if (dealDamage(g, h, t, D(p, 30), { silent: true, ...EL[p.el].on })) {
            h.hp = Math.min(h.maxHp, h.hp + D(p, 22));
            g.fx.burst(t.x, t.y, 40, c, 4, { speed: 120, life: 0.4 });
          }
        },
      }));
    },
  }),
  knives: (p) => ({
    cd: 5, castTime: 0.2, aiRange: 320, ai: 'enemy',
    desc: `向前方扇形掷出 6 把${EL[p.el].w}飞刀。`,
    fn(h, g) {
      const c = EL[p.el].c;
      sfx.arrow();
      for (let k = 0; k < 6; k++) {
        const a = h.faceAngle - 0.5 + k * 0.2;
        shoot(h, g, { angle: a, kind: 'knife', color: c, speed: 950, life: 0.36, dmg: D(p, 42), radius: 10, opts: { kb: 90, ...EL[p.el].on } });
      }
    },
  }),
  bomb: (p) => ({
    cd: 8, castTime: 0.3, aiRange: 420, aimRange: 450, ai: 'enemy',
    desc: `抛出${EL[p.el].w}炸弹，落地后爆炸造成范围伤害。`,
    fn(h, g) {
      const t = pickTarget(h, g, 450, 0.6);
      const q = t ? { x: t.x, y: t.y } : ahead(h, 320);
      const c = EL[p.el].c;
      sfx.swing();
      g.addZone(new Zone(g, {
        owner: h, kind: 'lob', color: c, x: h.x, y: h.y, sx: h.x, sy: h.y, tx: q.x, ty: q.y, radius: 120, life: 0.6,
        onUpdate: (z) => { const k = 1 - z.life / z.max; z.x = lerp(z.sx, z.tx, k); z.y = lerp(z.sy, z.ty, k); z.z = Math.sin(Math.min(1, k) * Math.PI) * 120; },
        onEnd: (z) => {
          sfx.heavy();
          g.fx.ring(z.tx, z.ty, 10, 130, c, { dur: 0.4, width: 7 });
          g.fx.burst(z.tx, z.ty, 10, EL[p.el].c2, 34, { speed: 340, life: 0.6, up: 200, grav: 500 });
          g.fx.burst(z.tx, z.ty, 10, '#5a4a6a', 10, { type: 'smoke', speed: 100, life: 0.9, size: 14, up: 30 });
          g.fx.light(z.tx, z.ty, 240, 0.35);
          hitCircle(g, h, z.tx, z.ty, 120, D(p, 130), { kb: 300, hitstop: 0.06, shake: 7, ...EL[p.el].on });
        },
      }));
    },
  }),
  berserk: (p) => ({
    cd: 14, castTime: 0.1, aiRange: 200, ai: 'self',
    desc: `${EL[p.el].w}狂暴 5 秒：攻速 +45%，吸血 +20%。`,
    fn(h, g) {
      h.buffs.berserk = 5;
      sfx.heavy();
      g.fx.ring(h.x, h.y, 10, 90, EL[p.el].c, { dur: 0.4, width: 6 });
      g.fx.burst(h.x, h.y, 30, EL[p.el].c, 20, { type: 'ember', speed: 100, up: 160, life: 0.7, size: 4 });
    },
  }),
  roar: (p) => ({
    cd: 12, castTime: 0.3, aiRange: 180, ai: 'self',
    desc: `发出${EL[p.el].w}怒吼，震退周围敌人并使其减速 50% 持续 2 秒。`,
    fn(h, g) {
      const c = EL[p.el].c;
      sfx.heavy();
      for (let k = 0; k < 3; k++) g.after(k * 0.08, () => g.fx.ring(h.x, h.y, 20, 210, c, { dur: 0.45, width: 6 - k }));
      g.shake(7);
      hitCircle(g, h, h.x, h.y, 210, D(p, 70), { kb: 380, slow: { amt: 0.5, t: 2 }, hitstop: 0.05 });
    },
  }),
  frostLine: (p) => ({
    cd: 10, castTime: 0.35, aiRange: 480, ai: 'enemy',
    desc: `沿直线释放${EL[p.el].w}冲击，命中的敌人被定身 1.2 秒。`,
    fn(h, g) {
      const len = 520, c = EL[p.el].c;
      const x1 = h.x + h.facing.x * len, y1 = h.y + h.facing.y * len;
      play(p.el);
      for (let k = 1; k <= 8; k++) {
        g.after(k * 0.03, () => {
          const x = h.x + h.facing.x * (len * k) / 8, y = h.y + h.facing.y * (len * k) / 8;
          g.fx.burst(x, y, 4, EL[p.el].c2, 6, { speed: 120, life: 0.5, up: 220, grav: 600, type: 'shard', size: 4 });
          g.fx.ring(x, y, 5, 40, c, { dur: 0.3 });
        });
      }
      hitLine(g, h, h.x, h.y, x1, y1, 60, D(p, 100), { root: 1.2, hitstop: 0.05, shake: 4, ...EL[p.el].on });
    },
  }),
  blinkNova: (p) => ({
    cd: 10, castTime: 0.2, aiRange: 320, aimRange: 340, ai: 'enemy',
    desc: `${EL[p.el].w}跃迁到前方，落地时爆发冲击，眩晕周围敌人 0.6 秒。`,
    fn(h, g) {
      const q = ahead(h, 300), c = EL[p.el].c;
      teleport(h, g, q.x, q.y, c);
      sfx.blink();
      g.fx.ring(h.x, h.y, 10, 140, c, { dur: 0.4, width: 7 });
      hitCircle(g, h, h.x, h.y, 140, D(p, 95), { stun: 0.6, kb: 220, hitstop: 0.06, shake: 6, ...EL[p.el].on });
    },
  }),
};

export function makeSkill(type, p) {
  const s = SKILL[type](p);
  return { type, name: p.name, el: p.el, ...s, ...(p.cd ? { cd: p.cd } : {}) };
}
