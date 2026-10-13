// 视觉特效：粒子、刀光、闪电、冲击环、伤害数字、临时光源
import { YS, FONT } from './config.js';
import { rand } from './math.js';

export class FX {
  constructor() {
    this.parts = [];
    this.slashes = [];
    this.bolts = [];
    this.rings = [];
    this.texts = [];
    this.lights = [];
    this.impacts = [];
  }

  // 命中瞬间的十字星闪光
  impact(x, y, z, color, size = 1) {
    this.impacts.push({ x, y, z, color, size, rot: Math.random() * Math.PI, life: 0.14, max: 0.14 });
    this.burst(x, y, z, color, 6, { speed: 260 * size, life: 0.25, size: 2.2, type: 'streak', drag: 6 });
  }

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.vx *= 1 - p.drag * dt;
      p.vy *= 1 - p.drag * dt;
      p.vz = p.vz * (1 - p.drag * dt) - p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.z < 0 && p.grav > 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const s of this.slashes) {
      s.life -= dt;
      if (s.follow) { s.x = s.follow.x; s.y = s.follow.y; }
    }
    this.slashes = this.slashes.filter((s) => s.life > 0);
    for (const b of this.bolts) {
      b.life -= dt;
      b.jitterT -= dt;
      if (b.jitterT <= 0) { b.jitterT = 0.035; b.path = jag(b.pts, b.jag); }
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const t of this.texts) { t.life -= dt; t.z += t.vz * dt; t.vz *= 1 - 3 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const m of this.impacts) m.life -= dt;
    this.impacts = this.impacts.filter((m) => m.life > 0);
    for (const l of this.lights) l.life -= dt;
    this.lights = this.lights.filter((l) => l.life > 0);
    if (this.parts.length > 1800) this.parts.splice(0, this.parts.length - 1800);
  }

  // type: spark（叠加发光）/ ember（上浮火星）/ smoke（烟雾）/ shard（碎片，受重力）
  burst(x, y, z, color, n, { speed = 200, life = 0.5, size = 3, type = 'spark', up = 80, grav = 0, drag = 3, spread = Math.PI * 2, angle = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = angle + rand(-spread / 2, spread / 2);
      const s = rand(speed * 0.3, speed);
      const l = rand(life * 0.5, life);
      this.parts.push({
        x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(0, up),
        life: l, max: l, size: rand(size * 0.6, size * 1.3), color, type, grav, drag,
      });
    }
  }

  slash(x, y, z, angle, radius, arc, color, { width = 22, dur = 0.18, dir = 1, follow = null } = {}) {
    this.slashes.push({ x, y, z, angle, radius, arc, color, width, life: dur, max: dur, dir, follow });
  }

  // pts: [{x,y,z}]，在两点之间生成锯齿闪电
  lightning(pts, color, { width = 3, dur = 0.2, jagAmt = 18 } = {}) {
    this.bolts.push({ pts, color, width, life: dur, max: dur, jag: jagAmt, jitterT: 0, path: jag(pts, jagAmt) });
  }

  ring(x, y, r0, r1, color, { dur = 0.4, width = 4, fill = false } = {}) {
    this.rings.push({ x, y, r0, r1, color, life: dur, max: dur, width, fill });
  }

  // 同一目标短时间内的伤害合并成一个数字，避免数字堆叠
  damage(target, amount, color, size) {
    const t = this.texts.find((q) => q.key === target.id && q.color === color && q.max - q.life < 0.35);
    if (t) {
      t.value += amount;
      t.str = String(t.value);
      t.life = t.max;
      t.size = Math.min(size * 1.5, Math.max(t.size, size + Math.log2(1 + t.value / 60) * 3));
      return;
    }
    this.text(target.x, target.y, (target.height || 60) + 14, String(amount), color, size);
    const q = this.texts[this.texts.length - 1];
    q.key = target.id;
    q.value = amount;
  }

  text(x, y, z, str, color, size = 18) {
    this.texts.push({ x: x + rand(-10, 10), y, z, str, color, size, life: 0.8, max: 0.8, vz: 120 });
  }

  light(x, y, r, life = 0.25, z = 20) {
    this.lights.push({ x, y, z, r, life, max: life });
  }

  drawGround(ctx) {
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * easeOut(k);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y * YS, rad, rad * YS, 0, 0, Math.PI * 2);
      if (r.fill) { ctx.fillStyle = r.color; ctx.globalAlpha *= 0.35; ctx.fill(); ctx.globalAlpha = (1 - k) * 0.9; }
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawTop(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.slashes) drawSlash(ctx, s);
    for (const b of this.bolts) {
      const a = b.life / b.max;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      b.path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y * YS - p.z) : ctx.moveTo(p.x, p.y * YS - p.z)));
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = a * 0.35;
      ctx.lineWidth = b.width * 5;
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.lineWidth = b.width;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, b.width * 0.4);
      ctx.stroke();
    }
    for (const p of this.parts) {
      if (p.type === 'smoke') continue;
      const a = Math.min(1, p.life / p.max * 1.5);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const px = p.x, py = p.y * YS - p.z;
      if (p.type === 'streak') {
        // 沿速度方向拉长的火花
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - p.vx * 0.04, py - (p.vy * YS - p.vz) * 0.04); ctx.stroke();
        continue;
      }
      if (p.type === 'shard') {
        const s = p.size * 1.4, r = p.life * 20;
        ctx.save(); ctx.translate(px, py); ctx.rotate(r);
        ctx.beginPath(); ctx.moveTo(0, -s * 1.6); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s * 1.6); ctx.lineTo(-s * 0.7, 0); ctx.closePath();
        ctx.fill();
        ctx.restore();
        continue;
      }
      const sz = p.type === 'ember' ? p.size * a : p.size;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.5, sz), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const m of this.impacts) {
      const k = m.life / m.max;
      const s = (1.4 - k * 0.6) * 26 * m.size;
      ctx.save();
      ctx.translate(m.x, m.y * YS - m.z);
      ctx.rotate(m.rot);
      ctx.globalAlpha = k;
      for (const [col, sc] of [[m.color, 1], ['#ffffff', 0.55]]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const rr = (i % 2 ? 0.18 : 1) * s * sc * (i % 4 === 0 ? 1 : 0.65);
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.save();
    for (const p of this.parts) {
      if (p.type !== 'smoke') continue;
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = (1 - k) * 0.35;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y * YS - p.z, p.size * (1 + k * 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawTexts(ctx, zoom) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k > 0.8 ? 1 + (k - 0.8) * 2.5 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = `900 ${(t.size * pop) / Math.max(1, zoom * 0.75)}px ${FONT}`;
      ctx.lineWidth = 3 / Math.max(1, zoom * 0.75);
      ctx.strokeStyle = 'rgba(10,6,20,0.9)';
      const py = t.y * YS - t.z;
      ctx.strokeText(t.str, t.x, py);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, py);
    }
    ctx.restore();
  }
}

const easeOut = (k) => 1 - (1 - k) * (1 - k);

function jag(pts, amt) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const n = Math.max(2, Math.round(len / 28));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const off = j === 0 ? 0 : amt;
      out.push({
        x: a.x + (b.x - a.x) * t + rand(-off, off),
        y: a.y + (b.y - a.y) * t + rand(-off, off),
        z: a.z + (b.z - a.z) * t + rand(-off, off) * 0.6,
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function drawSlash(ctx, s) {
  const k = 1 - s.life / s.max;
  const a = s.life / s.max;
  ctx.save();
  ctx.translate(s.x, s.y * YS - s.z);
  ctx.scale(1, YS);
  const sweep = s.arc;
  const head = Math.min(1, k * 1.7);
  const tail = Math.max(0, k * 1.7 - 0.55);
  const N = 14;
  const r = s.radius;
  for (let i = 0; i < N; i++) {
    const u0 = tail + ((head - tail) * i) / N, u1 = tail + ((head - tail) * (i + 1)) / N;
    if (u1 <= u0) continue;
    const a0 = s.angle + s.dir * (-sweep / 2 + sweep * u0);
    const a1 = s.angle + s.dir * (-sweep / 2 + sweep * u1);
    const f = (i + 1) / N;
    const w = s.width * (0.25 + 0.75 * f) * (0.5 + 0.5 * a);
    ctx.globalAlpha = a * (0.25 + 0.75 * f);
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, a1, s.dir < 0);
    ctx.arc(0, 0, r - w, a1, a0, s.dir > 0);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
  }
  // 白色刃芯
  const h0 = s.angle + s.dir * (-sweep / 2 + sweep * Math.max(tail, head - 0.35));
  const h1 = s.angle + s.dir * (-sweep / 2 + sweep * head);
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, h0, h1, s.dir < 0);
  ctx.strokeStyle = '#fffbea';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}
