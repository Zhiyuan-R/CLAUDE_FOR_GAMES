// 技能库：普攻 / 蓄力 / 30 种技能机制，均按元素参数化。英雄由这些积木组合而成（见 heroes.js）
import { hitArc, hitCircle, hitLine, enemiesOf, dealDamage } from './combat.js';
import { Projectile } from './entities/projectile.js';
import { Zone } from './entities/zone.js';
import { lerp, rand, clamp, angleDiff, norm } from './math.js';
import { WORLD } from './config.js';
import { los, nearestFloor } from './nav.js';
import { wallAt } from './map.js';
import { sfx } from './audio.js';
import { EL } from './elements.js';
import { Pet } from './entities/pet.js';

export { EL };
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
    if (u.isInvulnerable?.() || u.kind === 'chest' || u.kind === 'barrel' || g.hidden[h.team].has(u.id)) continue;
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
        const n = hitArc(g, h, { range, arc, dmg: o.dmg[i], basic: true, kb: heavy ? o.kb3 : 130, hitstop: heavy ? 0.06 : 0.03, shake: heavy ? 5 : 2, ...(heavy && o.el ? EL[o.el].on : {}) });
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
        hitLine(g, h, h.x, h.y, x1, y1, o.width, o.dmg[i], { basic: true, kb: heavy ? 380 : 120, hitstop: heavy ? 0.05 : 0.025, shake: heavy ? 4 : 1.5, ...(heavy && o.el ? EL[o.el].on : {}) });
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
      const base = { color: col, kind: o.kind, speed: o.speed, life: o.life, radius: o.radius, opts: { kb: 80, basic: true } };
      o.kind === 'arrow' ? sfx.arrow() : sfx.bolt();
      if (i < o.times.length - 1) { shoot(h, g, { ...base, angle: a, dmg: o.dmg[i] }); return; }
      if (o.third === 'spread') for (const off of [-0.17, 0, 0.17]) shoot(h, g, { ...base, angle: a + off, dmg: o.dmg[2] });
      else if (o.third === 'pierce') shoot(h, g, { ...base, angle: a, dmg: o.dmg[2], pierce: true, kind: o.kind === 'arrow' ? 'shard' : o.kind, radius: o.radius + 2, opts: { kb: 140, basic: true, ...(o.el ? EL[o.el].on : {}) } });
      else shoot(h, g, { ...base, angle: a, dmg: o.dmg[2], radius: o.radius * 1.6, opts: { kb: 220, basic: true, ...(o.el ? EL[o.el].on : {}) } });
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
    desc: `Dash forward, scorching enemies in your path with ${EL[p.el].w} and leaving a damaging trail.`,
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
    desc: `Surround yourself with a ${EL[p.el].w} whirlwind for 3.5s, damaging nearby enemies and gaining 25% move speed.`,
    fn(h, g) {
      h.buffs.haste = 3.5;
      play(p.el);
      g.fx.ring(h.x, h.y, 20, 140, EL[p.el].c, { dur: 0.4, width: 6 });
      g.addZone(new Zone(g, { owner: h, kind: 'aura', color: EL[p.el].c, follow: h, x: h.x, y: h.y, radius: 125, life: 3.5, tick: 0.3, onTick: (z) => hitCircle(g, h, z.x, z.y, z.radius, D(p, 26), { kb: 70, silent: true }) }));
    },
  }),
  chain: (p) => ({
    cd: 5, castTime: 0.26, aiRange: 430, aimRange: 470, ai: 'enemy',
    desc: `Unleash ${EL[p.el].w} lightning at an enemy ahead that bounces up to 3 targets and slows them.`,
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
    desc: `Summon a ${EL[p.el].w} storm ahead for 3.2s that strikes enemies inside at random.`,
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
    desc: `Place a ${EL[p.el].w} trap ahead (max 2). Enemies who step on it are rooted for 1.3s.`,
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
    desc: `Detonate a ${EL[p.el].w} nova that heavily slows, then leap backward to escape.`,
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
    desc: `Call down a ${EL[p.el].w} meteor that crashes into the area ahead after 0.9s for massive damage.`,
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
    desc: `Throw a ${EL[p.el].w} boomerang blade that damages on the way out and on the way back.`,
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
    desc: `Throw a ${EL[p.el].w} chain that drags the first enemy hit to you.`,
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
    desc: `Smash the ground ahead with ${EL[p.el].w} force, damaging and stunning for 1s.`,
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
    desc: `Become a ${EL[p.el].w} cyclone for 1.6s, moving freely while shredding nearby enemies.`,
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
    desc: `Blink behind an enemy ahead for a ${EL[p.el].w} backstab that deals heavy damage and slows.`,
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
    desc: `Rain ${EL[p.el].w} arrows over the area ahead for 2.2s, damaging and slowing enemies.`,
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
    desc: `Raise a ${EL[p.el].w} wall ahead that blocks movement and projectiles for 4s and damages enemies beneath it.`,
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
    desc: `Gain a ${EL[p.el].w} shield for 4s that absorbs 260 damage, and give the same shield to a wounded ally nearby.`,
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
    desc: `Release a ${EL[p.el].w} spring that heals you and allies within 320 range for 220 HP.`,
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
    desc: `Summon a ${EL[p.el].w} totem for 7s that automatically attacks nearby enemies.`,
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
    desc: `Release a ${EL[p.el].w} cloud ahead for 4s that damages and slows enemies inside.`,
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
    desc: `Charge forward with ${EL[p.el].w} force. The first enemy you hit is stunned for 1.1s and knocked back.`,
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
    desc: `Create a ${EL[p.el].w} vortex ahead for 2.5s that keeps pulling enemies to its center and damaging them.`,
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
    desc: `Summon 3 ${EL[p.el].w} blades that orbit you for 5s, cutting any enemy they touch.`,
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
    desc: `Hurl a ${EL[p.el].w} spear that pierces every enemy in a line and knocks them back.`,
    fn(h, g) {
      const c = EL[p.el].c;
      sfx.arrow();
      shoot(h, g, { kind: 'spear', color: c, speed: 1200, life: 0.55, dmg: D(p, 120), radius: 16, pierce: true, opts: { kb: 320, hitstop: 0.05, shake: 4, ...EL[p.el].on } });
    },
  }),
  stealth: (p) => ({
    cd: 14, castTime: 0.1, aiRange: 500, ai: 'self',
    desc: `Fade into ${EL[p.el].w} for 3s: untargetable, faster, and your next attack deals 80% more damage.`,
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
    desc: `Tether an enemy ahead with a ${EL[p.el].w} chain for 2.5s, draining their life.`,
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
    desc: `Throw a fan of 6 ${EL[p.el].w} knives ahead.`,
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
    desc: `Lob a ${EL[p.el].w} bomb that explodes on landing for area damage.`,
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
    desc: `Enter a ${EL[p.el].w} frenzy for 5s: +45% attack speed and +20% lifesteal.`,
    fn(h, g) {
      h.buffs.berserk = 5;
      sfx.heavy();
      g.fx.ring(h.x, h.y, 10, 90, EL[p.el].c, { dur: 0.4, width: 6 });
      g.fx.burst(h.x, h.y, 30, EL[p.el].c, 20, { type: 'ember', speed: 100, up: 160, life: 0.7, size: 4 });
    },
  }),
  roar: (p) => ({
    cd: 12, castTime: 0.3, aiRange: 180, ai: 'self',
    desc: `Let out a ${EL[p.el].w} roar that knocks back nearby enemies and slows them by 50% for 2s.`,
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
    desc: `Send a ${EL[p.el].w} shockwave along a line, rooting every enemy hit for 1.2s.`,
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
    desc: `Warp forward in a burst of ${EL[p.el].w}, stunning nearby enemies for 0.6s on landing.`,
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

// ═════════════════════ 大招（O 键） ═════════════════════

function visibleFoes(h, g, range) {
  return g.heroes.filter((e) => e.alive && e.team !== h.team && e.targetable && !g.hidden[h.team].has(e.id) && Math.hypot(e.x - h.x, e.y - h.y) < range);
}

export const ULT = {
  inferno: (p) => ({
    cd: 60, castTime: 0.4, aiRange: 220, ai: 'fight',
    desc: `Unfold a ${EL[p.el].w} domain around you for 5s (radius 260) that damages and slows enemies, while you take 20% less damage.`,
    fn(h, g) {
      const c = EL[p.el].c;
      h.buffs.ultArmor = 5;
      sfx.boom();
      g.shake(8);
      g.fx.ring(h.x, h.y, 20, 280, c, { dur: 0.6, width: 10 });
      g.addZone(new Zone(g, { owner: h, kind: 'ultField', color: c, follow: h, x: h.x, y: h.y, radius: 260, life: 5, tick: 0.35, onTick: (z) => hitCircle(g, h, z.x, z.y, z.radius, D(p, 42), { slow: { amt: 0.3, t: 0.6 }, silent: true, ...EL[p.el].on }) }));
    },
  }),
  blackhole: (p) => ({
    cd: 70, castTime: 0.5, aiRange: 460, aimRange: 500, ai: 'group',
    desc: `Open a ${EL[p.el].w} black hole ahead for 3s that pulls enemies in, then explodes for heavy damage and a stun.`,
    fn(h, g) {
      const t = pickTarget(h, g, 500, 0.7);
      const q = t ? { x: t.x, y: t.y } : ahead(h, 340);
      const c = EL[p.el].c;
      sfx.zap();
      g.addZone(new Zone(g, {
        owner: h, kind: 'blackhole', color: c, x: q.x, y: q.y, radius: 270, life: 3, tick: 0.4,
        onUpdate: (z, dt) => {
          for (const u of enemiesOf(g, h.team)) {
            if (u.mass >= 99) continue;
            const dx = z.x - u.x, dy = z.y - u.y, d = Math.hypot(dx, dy);
            if (d < z.radius + u.radius && d > 14) { u.x += (dx / d) * 230 * dt; u.y += (dy / d) * 230 * dt; }
          }
          if (Math.random() < dt * 30) { const a = rand(0, 6.28); g.fx.burst(z.x + Math.cos(a) * z.radius, z.y + Math.sin(a) * z.radius, 10, c, 1, { speed: 10, life: 0.5 }); }
        },
        onTick: (z) => hitCircle(g, h, z.x, z.y, z.radius, D(p, 26), { silent: true }),
        onEnd: (z) => {
          sfx.boom();
          g.fx.ring(z.x, z.y, 10, 300, c, { dur: 0.6, width: 10 });
          g.fx.burst(z.x, z.y, 20, EL[p.el].c2, 50, { speed: 460, life: 0.8 });
          g.fx.light(z.x, z.y, 420, 0.6);
          hitCircle(g, h, z.x, z.y, 200, D(p, 230), { stun: 0.7, kb: 420, hitstop: 0.1, shake: 14 });
        },
      }));
    },
  }),
  barrage: (p) => ({
    cd: 60, castTime: 0.3, aiRange: 520, aimRange: 560, ai: 'group',
    desc: `Bombard a large area ahead with a ${EL[p.el].w} barrage for 4s. Every impact explodes.`,
    fn(h, g) {
      const t = pickTarget(h, g, 560, 0.7);
      const q = t ? { x: t.x, y: t.y } : ahead(h, 380);
      const c = EL[p.el].c;
      g.addZone(new Zone(g, {
        owner: h, kind: 'barrage', color: c, x: q.x, y: q.y, radius: 280, life: 4, tick: 0.16,
        onTick: (z) => {
          const a = rand(0, 6.28), rr = Math.sqrt(Math.random()) * z.radius;
          const x = z.x + Math.cos(a) * rr, y = z.y + Math.sin(a) * rr;
          g.fx.lightning([{ x: x - 60, y: y - 30, z: 420 }, { x, y, z: 0 }], c, { width: 5, dur: 0.18, jagAmt: 4 });
          g.fx.ring(x, y, 5, 70, c, { dur: 0.3, width: 4 });
          g.fx.burst(x, y, 4, EL[p.el].c2, 8, { speed: 200, life: 0.4, up: 160, grav: 500 });
          g.fx.light(x, y, 120, 0.2);
          play(p.el);
          hitCircle(g, h, x, y, 72, D(p, 70), { silent: true, kb: 120, shake: 2, ...EL[p.el].on });
        },
      }));
    },
  }),
  avatar: (p) => ({
    cd: 70, castTime: 0.4, aiRange: 260, ai: 'fight',
    desc: `Become a ${EL[p.el].w} giant for 8s: larger size, +40% damage, +30% attack speed and +25% damage reduction.`,
    fn(h, g) {
      h.buffs.avatar = 8;
      sfx.boom();
      g.shake(8);
      g.fx.ring(h.x, h.y, 10, 200, EL[p.el].c, { dur: 0.6, width: 10 });
      g.fx.burst(h.x, h.y, 30, EL[p.el].c, 40, { type: 'ember', speed: 200, up: 220, life: 0.9, size: 5 });
    },
  }),
  sanctuary: (p) => ({
    cd: 75, castTime: 0.4, aiRange: 450, ai: 'save',
    desc: `Raise a ${EL[p.el].w} sanctuary: allies within 450 heal 35% HP and are immune to damage for 2s.`,
    fn(h, g) {
      const c = EL[p.el].c;
      sfx.win();
      g.fx.ring(h.x, h.y, 10, 450, c, { dur: 0.8, width: 8 });
      g.fx.ring(h.x, h.y, 10, 450, c, { dur: 0.7, fill: true });
      for (const u of g.heroes) {
        if (!u.alive || u.team !== h.team || Math.hypot(u.x - h.x, u.y - h.y) > 450) continue;
        const amt = u.maxHp * 0.35;
        u.hp = Math.min(u.maxHp, u.hp + amt);
        u.invuln = Math.max(u.invuln, 2);
        g.fx.text(u.x, u.y, 90, `+${Math.round(amt)}`, '#7dffb0', 18);
        g.fx.burst(u.x, u.y, 10, c, 24, { type: 'ember', speed: 60, up: 180, life: 1.1, size: 4 });
      }
    },
  }),
  execute: (p) => ({
    cd: 55, castTime: 0.2, aiRange: 520, aimRange: 560, ai: 'kill',
    desc: `Blink to the enemy hero ahead with the lowest HP% and deliver a ${EL[p.el].w} execution: damage plus 40% of their missing HP. Refunds half the cooldown on a kill.`,
    fn(h, g) {
      const c = EL[p.el].c;
      const t = visibleFoes(h, g, 600).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!t) { h.skillCd[2] = 3; return; }
      const d = norm(t.x - h.x, t.y - h.y);
      teleport(h, g, t.x - d.x * (t.radius + 30), t.y - d.y * (t.radius + 30), c);
      h.facing = d;
      g.fx.slash(t.x, t.y, 40, h.faceAngle + 0.8, 120, 2.6, c, { width: 40, dur: 0.3 });
      g.fx.slash(t.x, t.y, 40, h.faceAngle - 0.8, 120, 2.6, EL[p.el].c2, { width: 30, dur: 0.3, dir: -1 });
      sfx.heavy();
      const before = t.alive;
      dealDamage(g, h, t, D(p, 150) + (t.maxHp - t.hp) * 0.4, { hitstop: 0.14, shake: 12 });
      if (before && !t.alive) h.skillCd[2] *= 0.5;
    },
  }),
  timeStop: (p) => ({
    cd: 70, castTime: 0.4, aiRange: 420, aimRange: 460, ai: 'group',
    desc: `Freeze ${EL[p.el].w} time in the area ahead, stunning enemies inside for 2s.`,
    fn(h, g) {
      const t = pickTarget(h, g, 460, 0.7);
      const q = t ? { x: t.x, y: t.y } : ahead(h, 300);
      const c = EL[p.el].c;
      sfx.blink();
      g.addZone(new Zone(g, { owner: h, kind: 'clock', color: c, x: q.x, y: q.y, radius: 220, life: 2 }));
      hitCircle(g, h, q.x, q.y, 220, D(p, 70), { stun: 2, hitstop: 0.1, shake: 6 });
    },
  }),
  fissure: (p) => ({
    cd: 55, castTime: 0.5, aiRange: 620, ai: 'group',
    desc: `Tear open a 900-long ${EL[p.el].w} rift: enemies along it take heavy damage and are stunned, and rock walls rise along both sides for 3s.`,
    fn(h, g) {
      const c = EL[p.el].c;
      const fx = h.facing.x, fy = h.facing.y, px = -fy, py = fx;
      const x0 = h.x, y0 = h.y;
      const hitSet = new Set();
      sfx.boom();
      for (let k = 1; k <= 12; k++) {
        g.after(k * 0.035, () => {
          const x = x0 + fx * k * 75, y = y0 + fy * k * 75;
          if (wallAt(x, y)) return;
          g.fx.burst(x, y, 4, EL[p.el].c2, 10, { speed: 220, life: 0.6, up: 260, grav: 600, type: 'shard', size: 5 });
          g.fx.ring(x, y, 5, 70, c, { dur: 0.35, width: 6 });
          g.shake(4);
          hitCircle(g, h, x, y, 70, D(p, 150), { stun: 0.9, kb: 200, silent: true }, hitSet);
          for (const s of [-1, 1]) {
            const wx = x + px * 95 * s, wy = y + py * 95 * s;
            if (k % 2 === 0 && !wallAt(wx, wy)) g.dynWalls.push({ x: wx, y: wy, r: 26, h: 100, life: 3, max: 3, color: c, seed: Math.random() });
          }
        });
      }
    },
  }),
  beast: (p) => ({
    cd: 70, castTime: 0.5, aiRange: 500, ai: 'fight',
    desc: `Summon a ${EL[p.el].w} beast to fight beside you for 14s. It attacks nearby enemies on its own.`,
    fn(h, g) {
      const pet = new Pet(g, h, { hp: D(p, 900), dmg: D(p, 55), life: 14, color: EL[p.el].c, color2: EL[p.el].c2 });
      g.pets.push(pet);
      sfx.heavy();
      g.fx.ring(pet.x, pet.y, 10, 120, EL[p.el].c, { dur: 0.5, width: 7 });
      g.fx.burst(pet.x, pet.y, 20, EL[p.el].c2, 30, { speed: 260, life: 0.6 });
    },
  }),
  ricochet: (p) => ({
    cd: 50, castTime: 0.3, aiRange: 520, aimRange: 560, ai: 'fight',
    desc: `Fire a ${EL[p.el].w} orb that ricochets between up to 8 enemies, preferring heroes.`,
    fn(h, g) {
      const c = EL[p.el].c;
      const first = pickTarget(h, g, 560, 0.8);
      if (!first) { h.skillCd[2] = 3; return; }
      const hitIds = new Set();
      const fire = (from, t, k) => {
        hitIds.add(t.id);
        g.projectiles.push(new Projectile(g, {
          owner: h, x: from.x, y: from.y, z: 40, homing: t, speed: 1100, life: 1.2, dmg: D(p, 95) * Math.pow(0.92, k), radius: 12, kind: 'bolt', color: c,
          opts: { kb: 120, ...EL[p.el].on },
          onHit: (pr, u) => {
            play(p.el);
            g.fx.burst(u.x, u.y, 40, EL[p.el].c2, 12, { speed: 240, life: 0.3 });
            if (k >= 7) return;
            let next = null, bs = Infinity;
            for (const o of enemiesOf(g, h.team)) {
              if (hitIds.has(o.id) || o.isInvulnerable?.() || o.kind === 'chest' || o.kind === 'barrel') continue;
              const d = Math.hypot(o.x - u.x, o.y - u.y);
              if (d > 380) continue;
              const s = d * (o.kind === 'hero' ? 0.4 : 1);
              if (s < bs) { bs = s; next = o; }
            }
            if (next) g.after(0.03, () => fire({ x: u.x, y: u.y }, next, k + 1));
          },
        }));
      };
      sfx.zap();
      fire({ x: h.x, y: h.y }, first, 0);
    },
  }),
  dragonDash: (p) => ({
    cd: 55, castTime: 0.1, aiRange: 450, ai: 'fight',
    desc: `Turn into a ${EL[p.el].w} dragon and dash 3 times (steer with the arrow keys), damaging enemies and scorching the ground along each path.`,
    fn(h, g) {
      const c = EL[p.el].c;
      for (let k = 0; k < 3; k++) {
        g.after(k * 0.42, () => {
          if (!h.alive) return;
          const hitSet = new Set();
          h.impulse(1300, 0.24);
          h.invuln = Math.max(h.invuln, 0.3);
          h.state = 'cast'; h.stateT = 0.26;
          sfx.dash();
          for (let s = 0; s <= 4; s++) {
            g.after(s * 0.06, () => {
              if (!h.alive) return;
              hitCircle(g, h, h.x, h.y, 75, D(p, 85), { kb: 260, hitstop: 0.03, shake: 4, ...EL[p.el].on }, hitSet);
              g.fx.burst(h.x, h.y, 30, c, 10, { speed: 160, life: 0.5, type: 'ember', up: 100 });
              g.addZone(new Zone(g, { owner: h, kind: 'fire', color: c, x: h.x, y: h.y, radius: 40, life: 2, tick: 0.45, onTick: (z) => hitCircle(g, h, z.x, z.y, z.radius, D(p, 12), { dot: true, silent: true }) }));
            });
          }
        });
      }
    },
  }),
  starfall: (p) => ({
    cd: 75, castTime: 0.6, aiRange: 900, ai: 'fight',
    desc: `Mark every visible enemy hero within 1000 range, then strike each one with ${EL[p.el].w} judgment after 1s.`,
    fn(h, g) {
      const c = EL[p.el].c;
      const foes = visibleFoes(h, g, 1000);
      if (!foes.length) { h.skillCd[2] = 3; return; }
      sfx.zap();
      for (const e of foes) {
        g.addZone(new Zone(g, {
          owner: h, kind: 'warn', color: c, x: e.x, y: e.y, radius: 110, life: 1, follow: null,
          onUpdate: (z) => { if (z.age < 0.6 && e.alive) { z.x = e.x; z.y = e.y; } },
          onEnd: (z) => {
            g.fx.lightning([{ x: z.x + 30, y: z.y, z: 520 }, { x: z.x, y: z.y, z: 0 }], c, { width: 9, dur: 0.35, jagAmt: 24 });
            g.fx.ring(z.x, z.y, 10, 130, c, { dur: 0.45, width: 8 });
            g.fx.light(z.x, z.y, 260, 0.4);
            sfx.boom();
            hitCircle(g, h, z.x, z.y, 110, D(p, 200), { stun: 0.5, hitstop: 0.08, shake: 8, ...EL[p.el].on });
          },
        }));
      }
    },
  }),
};

export function makeUlt(type, p) {
  const s = ULT[type](p);
  return { type, name: p.name, el: p.el, ult: true, ...s };
}
