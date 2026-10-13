// 渲染主流程：摄像机 → 地面 → 阴影 → 按深度排序的物体 → 特效 → 光照 → 世界 UI → HUD
import { YS, WORLD, TEAM_COLORS, SPAWN, FOUNTAIN_R } from '../config.js';
import { clamp, lerp } from '../math.js';
import { buildGround, GROUND_PAD } from './ground.js';
import { drawProp, drawHero, drawMinion, drawTower, drawProjectile, drawZone, hpBar, shadow, hexA } from './draw.js';
import { drawHUD } from './hud.js';

// 可遮挡角色的物件：h 为在其后方多远（世界 y）仍视为被遮挡，w 为横向半宽
const OCCLUDE = { pillar: { h: 210, w: 50 }, tree: { h: 380, w: 90 }, torch: { h: 140, w: 22 }, rock: { h: 90, w: 55 } };

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ground = buildGround();
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.cam = { x: 600, y: 520 };
    this.hpGhost = new Map();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.W = innerWidth;
    this.H = innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    // 保证纵向能看到大半个战场、横向至少约 1000 像素的世界范围
    this.zoom = clamp(Math.min(this.H / 600, this.W / 1150), 0.6, 2.2);
    this.light.width = Math.ceil(this.W / 2);
    this.light.height = Math.ceil(this.H / 2);
  }

  updateCamera(game, dt) {
    const p = game.player;
    const focus = p.alive ? p : { x: SPAWN[p.team].x + 300, y: SPAWN[p.team].y };
    const lead = p.alive ? 60 : 0;
    const tx = focus.x + p.facing.x * lead;
    const ty = focus.y + p.facing.y * lead * 0.5;
    const k = 1 - Math.exp(-6 * dt);
    this.cam.x = lerp(this.cam.x, tx, k);
    this.cam.y = lerp(this.cam.y, ty, k);
    const hw = this.W / 2 / this.zoom, hh = this.H / 2 / this.zoom / YS;
    const mx = 200, my = 140;
    this.cam.x = hw * 2 > WORLD.w + mx * 2 ? WORLD.w / 2 : clamp(this.cam.x, hw - mx, WORLD.w - hw + mx);
    this.cam.y = hh * 2 > WORLD.h + my * 2 ? WORLD.h / 2 : clamp(this.cam.y, hh - my, WORLD.h - hh + my);
  }

  toScreen(x, y, z = 0) {
    return {
      x: (x - this.cam.x) * this.zoom + this.W / 2 + this.shakeX,
      y: (y * YS - z - this.cam.y * YS) * this.zoom + this.H / 2 + this.shakeY,
    };
  }

  render(game, dt, { hud = true } = {}) {
    const { ctx, W, H, dpr, zoom } = this;
    const t = performance.now() / 1000;
    this.updateCamera(game, dt);
    const sh = game.shakeMag;
    this.shakeX = (Math.random() - 0.5) * sh * 2;
    this.shakeY = (Math.random() - 0.5) * sh * 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#07050f';
    ctx.fillRect(0, 0, W, H);

    const ox = W / 2 - this.cam.x * zoom + this.shakeX;
    const oy = H / 2 - this.cam.y * YS * zoom + this.shakeY;
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * ox, dpr * oy);

    const gc = this.ground.canvas;
    ctx.drawImage(gc, -GROUND_PAD.x, -GROUND_PAD.y * YS, gc.width / this.ground.res, gc.height / this.ground.res);

    // 视野剔除范围
    const vx0 = this.cam.x - W / 2 / zoom - 300, vx1 = this.cam.x + W / 2 / zoom + 300;
    const inView = (x) => x > vx0 && x < vx1;

    // 地面层：泉水光圈、塔的攻击范围、区域效果、冲击环
    this.drawFountains(ctx, t);
    for (const tw of game.towers) {
      if (!tw.alive || tw.team === game.player.team || !game.player.alive) continue;
      const d = Math.hypot(tw.x - game.player.x, tw.y - game.player.y);
      if (d < tw.range + 220) {
        const targeted = tw.target === game.player;
        ctx.save();
        ctx.globalAlpha = clamp((tw.range + 220 - d) / 200, 0, 1) * (targeted ? 0.85 : 0.45);
        ctx.strokeStyle = targeted ? '#ff4d5e' : '#ff9aa4';
        ctx.lineWidth = targeted ? 3 : 2;
        ctx.setLineDash([14, 10]);
        ctx.beginPath(); ctx.ellipse(tw.x, tw.y * YS, tw.range, tw.range * YS, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    for (const z of game.zones) if (inView(z.x)) drawZone(ctx, z, t, game.player.team);
    game.fx.drawGround(ctx);

    // 阴影
    for (const h of game.heroes) if (h.alive) shadow(ctx, h.x, h.y, 17 - Math.min(8, h.z * 0.1), 0.4);
    for (const m of game.minions) shadow(ctx, m.x, m.y, 14);

    // 状态脚底标记（减速、定身）
    for (const u of [...game.heroes, ...game.minions]) {
      if (!u.alive) continue;
      if (u.status.root > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(160,230,255,0.75)';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const sx = u.x + Math.cos(a) * u.radius, sy = u.y * YS + Math.sin(a) * u.radius * YS;
          ctx.beginPath(); ctx.moveTo(sx - 4, sy); ctx.lineTo(sx, sy - 18); ctx.lineTo(sx + 4, sy); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      } else if (u.status.slow > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(143,227,255,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(u.x, u.y * YS, u.radius + 6, (u.radius + 6) * YS, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }

    // 蓄力指示：脚下的扇形/范围预览
    for (const h of game.heroes) {
      if (!h.alive || h.state !== 'charging') continue;
      this.drawChargePreview(ctx, h);
    }

    // 按 y 深度排序绘制
    const list = [];
    for (const p of game.props) if (inView(p.x)) list.push({ y: p.y, k: 0, o: p });
    for (const tw of game.towers) list.push({ y: tw.y, k: 1, o: tw });
    for (const m of game.minions) if (inView(m.x)) list.push({ y: m.y, k: 2, o: m });
    for (const h of game.heroes) if (h.alive) list.push({ y: h.y, k: 3, o: h });
    for (const p of game.projectiles) if (inView(p.x)) list.push({ y: p.y, k: 4, o: p });
    list.sort((a, b) => a.y - b.y);
    for (const h of game.heroes) for (const gh of h.ghosts) drawHero(ctx, h, t, gh);
    const pl = game.player;
    for (const it of list) {
      if (it.k === 0) {
        // 玩家走到高大物件后方时，物件半透明，避免看不到角色
        const p = it.o;
        const reach = OCCLUDE[p.type];
        const hidden = reach && pl.alive && pl.y < p.y && p.y - pl.y < reach.h * (p.s || 1) && Math.abs(pl.x - p.x) < reach.w * (p.s || 1);
        if (hidden) { ctx.save(); ctx.globalAlpha = 0.4; drawProp(ctx, p, t); ctx.restore(); }
        else drawProp(ctx, p, t);
      }
      else if (it.k === 1) drawTower(ctx, it.o, t);
      else if (it.k === 2) drawMinion(ctx, it.o, t);
      else if (it.k === 3) drawHero(ctx, it.o, t);
      else drawProjectile(ctx, it.o);
    }

    game.fx.drawTop(ctx);

    // 光照：先压暗全屏，再为光源“挖洞”
    this.drawLighting(game, t);

    // 世界空间 UI（不受光照影响）
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * ox, dpr * oy);
    this.drawWorldUI(ctx, game, t);
    game.fx.drawTexts(ctx, zoom);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 暗角
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    if (hud) drawHUD(ctx, game, this, t);
  }

  drawFountains(ctx, t) {
    for (const team of [0, 1]) {
      const sp = SPAWN[team];
      ctx.save();
      ctx.translate(sp.x, sp.y * YS);
      ctx.scale(1, YS);
      ctx.strokeStyle = hexA(TEAM_COLORS[team], 0.35 + Math.sin(t * 2) * 0.1);
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = t * 20 * (team ? -1 : 1);
      ctx.beginPath(); ctx.arc(0, 0, FOUNTAIN_R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  drawChargePreview(ctx, h) {
    const d = h.def;
    const r = clamp(h.chargeT / d.charged.maxTime, 0, 1);
    const full = r >= 1;
    ctx.save();
    ctx.globalAlpha = 0.25 + r * 0.35;
    ctx.strokeStyle = full ? '#fff3c4' : d.color2;
    ctx.fillStyle = hexA(d.color2, 0.12 + r * 0.1);
    ctx.lineWidth = 2;
    if (d.id === 'ember') {
      const R = lerp(115, 195, r);
      ctx.beginPath(); ctx.ellipse(h.x, h.y * YS, R, R * YS, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (d.id === 'storm') {
      const len = lerp(420, 680, r), w = lerp(28, 46, r);
      ctx.translate(h.x, h.y * YS);
      ctx.scale(1, YS);
      ctx.rotate(h.faceAngle);
      ctx.fillRect(20, -w / 2, len - 20, w);
      ctx.strokeRect(20, -w / 2, len - 20, w);
    } else {
      const spread = lerp(0.45, 0.85, r), len = 520;
      ctx.translate(h.x, h.y * YS);
      ctx.scale(1, YS);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, len, h.faceAngle - spread / 2, h.faceAngle + spread / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLighting(game, t) {
    const L = this.lctx, lw = this.light.width, lh = this.light.height;
    const s = lw / this.W;
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, lw, lh);
    L.fillStyle = 'rgba(10,6,26,0.58)';
    L.fillRect(0, 0, lw, lh);
    L.globalCompositeOperation = 'destination-out';
    const hole = (x, y, z, r, a = 1) => {
      const p = this.toScreen(x, y, z);
      const rr = r * this.zoom * s;
      const px = p.x * s, py = p.y * s;
      if (px < -rr || px > lw + rr || py < -rr || py > lh + rr) return;
      const g = L.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = g;
      L.beginPath(); L.arc(px, py, rr, 0, Math.PI * 2); L.fill();
    };
    for (const p of game.props) {
      if (p.type === 'torch') hole(p.x, p.y, p.h + 10, 260 + Math.sin(t * 9 + p.seed * 10) * 12, 0.95);
      else if (p.type === 'crystal') hole(p.x, p.y, 20, 150, 0.6);
      else if (p.type === 'shroom') hole(p.x, p.y, 10, 60, 0.4);
    }
    for (const tw of game.towers) if (tw.alive) hole(tw.x, tw.y, tw.height, 280, 0.8);
    for (const h of game.heroes) if (h.alive) hole(h.x, h.y, 30, h === game.player ? 260 : 190, 0.75);
    for (const m of game.minions) hole(m.x, m.y, 10, 70, 0.35);
    for (const p of game.projectiles) hole(p.x, p.y, p.z, 90, 0.8);
    for (const z of game.zones) if (z.kind !== 'trap') hole(z.x, z.y, 10, z.radius * 1.5, 0.7);
    for (const l of game.fx.lights) hole(l.x, l.y, l.z, l.r, l.life / l.max);
    for (const team of [0, 1]) hole(SPAWN[team].x, SPAWN[team].y, 0, 260, 0.7);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.light, 0, 0, this.W, this.H);
  }

  drawWorldUI(ctx, game, t) {
    const zoom = this.zoom;
    for (const h of game.heroes) {
      if (!h.alive) continue;
      const tc = h === game.player ? '#5fd17a' : TEAM_COLORS[h.team];
      const y = h.y * YS - h.z - 92;
      const ghost = this.trackGhost(h);
      hpBar(ctx, h.x, y, 64, h.hp / h.maxHp, tc, zoom, { label: h === game.player ? '你' : h.name, ghost });
      // 眩晕星星
      if (h.status.stun > 0) {
        ctx.save();
        ctx.fillStyle = '#ffe066';
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + (i * Math.PI * 2) / 3;
          ctx.beginPath(); ctx.arc(h.x + Math.cos(a) * 16, h.y * YS - h.z - 72 + Math.sin(a) * 5, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      // 蓄力条
      if (h.state === 'charging') {
        const r = clamp(h.chargeT / h.def.charged.maxTime, 0, 1);
        const full = r >= 1;
        ctx.save();
        ctx.strokeStyle = 'rgba(8,5,16,0.85)';
        ctx.lineWidth = 6;
        const cy = h.y * YS - h.z - 30;
        ctx.beginPath(); ctx.arc(h.x, cy, 34, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
        ctx.strokeStyle = full ? (Math.floor(t * 12) % 2 ? '#ffffff' : '#ffe58a') : h.def.color2;
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(h.x, cy, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * r); ctx.stroke();
        ctx.restore();
      }
    }
    for (const m of game.minions) {
      if (m.hp < m.maxHp) hpBar(ctx, m.x, m.y * YS - 50, 32, m.hp / m.maxHp, TEAM_COLORS[m.team], zoom);
    }
    for (const tw of game.towers) {
      if (!tw.alive) continue;
      const y = tw.y * YS - tw.height - 52;
      hpBar(ctx, tw.x, y, tw.kind === 'core' ? 110 : 90, tw.hp / tw.maxHp, TEAM_COLORS[tw.team], zoom, { label: tw.kind === 'core' ? '基地水晶' : '防御塔', ghost: this.trackGhost(tw) });
    }
  }

  // 受伤后缓慢跟随的“残影血条”
  trackGhost(u) {
    const r = u.hp / u.maxHp;
    let g = this.hpGhost.get(u.id);
    if (g === undefined || r > g) g = r;
    else g = Math.max(r, g - 0.006);
    this.hpGhost.set(u.id, g);
    return g;
  }
}
