// 渲染主流程：摄像机 → 地面 → 阴影 → 按深度排序的墙体与物体 → 特效 → 光照 → 世界 UI → HUD
import { YS, WORLD, TEAM_COLORS, SPAWN, FOUNTAIN_R, TILE, GRID_W, GRID_H, WALL_H } from '../config.js';
import { clamp, lerp } from '../math.js';
import { solid } from '../map.js';
import { buildGround, buildWallSprites, GROUND_PAD } from './ground.js';
import { drawProp, drawHero, drawMinion, drawTower, drawProjectile, drawZone, drawMonster, drawChest, drawLoot, drawDynWall, hpBar, shadow, hexA, INK } from './draw.js';
import { drawHUD, buildMinimap } from './hud.js';
import { RARITY } from '../items.js';
import { FONT } from '../config.js';

const OCCLUDE = { crystal: { h: 80, w: 20 } };

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ground = buildGround();
    this.walls = buildWallSprites(WALL_H);
    this.minimap = buildMinimap();
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.cam = { x: 600, y: 1100 };
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
    this.zoom = clamp(Math.min(this.H / 640, this.W / 1200), 0.6, 2.2);
    this.light.width = Math.ceil(this.W / 2);
    this.light.height = Math.ceil(this.H / 2);
  }

  updateCamera(game, dt) {
    const p = game.player;
    const focus = p.alive ? p : SPAWN[p.team];
    const lead = p.alive ? 60 : 0;
    const tx = focus.x + p.facing.x * lead;
    const ty = focus.y + p.facing.y * lead * 0.5;
    const k = 1 - Math.exp(-6 * dt);
    this.cam.x = lerp(this.cam.x, tx, k);
    this.cam.y = lerp(this.cam.y, ty, k);
    const hw = this.W / 2 / this.zoom, hh = this.H / 2 / this.zoom / YS;
    this.cam.x = clamp(this.cam.x, hw - 80, WORLD.w - hw + 80);
    this.cam.y = clamp(this.cam.y, hh - 120, WORLD.h - hh + 160);
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

    const hw = W / 2 / zoom, hh = H / 2 / zoom / YS;
    const vx0 = this.cam.x - hw - 120, vx1 = this.cam.x + hw + 120;
    const vy0 = this.cam.y - hh - 120, vy1 = this.cam.y + hh + 260;
    const inView = (o) => o.x > vx0 && o.x < vx1 && o.y > vy0 && o.y < vy1;

    // 地面层
    this.drawFountains(ctx, t);
    const pl = game.player;
    for (const tw of game.towers) {
      if (!tw.alive || tw.team === pl.team || !pl.alive || !inView(tw)) continue;
      const d = Math.hypot(tw.x - pl.x, tw.y - pl.y);
      if (d < tw.range + 220) {
        const targeted = tw.target === pl;
        ctx.save();
        ctx.globalAlpha = clamp((tw.range + 220 - d) / 200, 0, 1) * (targeted ? 0.85 : 0.45);
        ctx.strokeStyle = targeted ? '#ff4d5e' : '#ff9aa4';
        ctx.lineWidth = targeted ? 3 : 2;
        ctx.setLineDash([14, 10]);
        ctx.beginPath(); ctx.ellipse(tw.x, tw.y * YS, tw.range, tw.range * YS, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    for (const z of game.zones) if (inView(z)) drawZone(ctx, z, t, pl.team);
    game.fx.drawGround(ctx);

    for (const h of game.heroes) if (h.alive && inView(h) && h.stealthT <= 0) shadow(ctx, h.x, h.y, (h.mounted ? 24 : 17) - Math.min(8, h.z * 0.1), 0.4);
    for (const m of game.minions) if (inView(m)) shadow(ctx, m.x, m.y, 14);
    for (const m of game.monsters) if (inView(m)) shadow(ctx, m.x, m.y, m.radius * 1.1, 0.45);

    for (const u of [...game.heroes, ...game.minions, ...game.monsters]) {
      if (!u.alive || !inView(u)) continue;
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
    for (const h of game.heroes) if (h.alive && h.state === 'charging' && (h.team === pl.team || h.stealthT <= 0)) this.drawChargePreview(ctx, h);
    // 本队英雄脚下的队伍色圈
    for (const h of game.heroes) {
      if (!h.alive || !inView(h)) continue;
      ctx.save();
      ctx.strokeStyle = h === pl ? '#7dffb0' : hexA(TEAM_COLORS[h.team], 0.8);
      ctx.lineWidth = h === pl ? 2.5 : 1.8;
      ctx.beginPath(); ctx.ellipse(h.x, h.y * YS, h.radius + 8, (h.radius + 8) * YS, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // 深度排序
    const list = [];
    const i0 = Math.max(0, Math.floor(vx0 / TILE)), i1 = Math.min(GRID_W - 1, Math.floor(vx1 / TILE));
    const j0 = Math.max(0, Math.floor(vy0 / TILE)), j1 = Math.min(GRID_H - 1, Math.floor(vy1 / TILE));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (solid(i, j)) list.push({ y: (j + 1) * TILE - 0.5, k: 9, i, j });
    for (const p of game.props) if (inView(p)) list.push({ y: p.y, k: 0, o: p });
    for (const tw of game.towers) if (inView(tw)) list.push({ y: tw.y, k: 1, o: tw });
    for (const m of game.minions) if (inView(m)) list.push({ y: m.y, k: 2, o: m });
    for (const m of game.monsters) if (inView(m)) list.push({ y: m.y, k: 5, o: m });
    for (const c of game.chests) if (inView(c)) list.push({ y: c.y, k: 6, o: c });
    for (const l of game.loot) if (inView(l)) list.push({ y: l.y, k: 7, o: l });
    for (const w of game.dynWalls) if (inView(w)) list.push({ y: w.y, k: 8, o: w });
    for (const h of game.heroes) if (h.alive && inView(h)) list.push({ y: h.y, k: 3, o: h });
    for (const p of game.projectiles) if (inView(p)) list.push({ y: p.y, k: 4, o: p });
    list.sort((a, b) => a.y - b.y);
    for (const h of game.heroes) for (const gh of h.ghosts) if (inView(gh)) drawHero(ctx, h, t, gh);
    for (const it of list) {
      switch (it.k) {
        case 9: this.drawWall(ctx, it.i, it.j, pl); break;
        case 0: {
          const p = it.o, oc = OCCLUDE[p.type];
          if (oc && pl.alive && pl.y < p.y && p.y - pl.y < oc.h && Math.abs(pl.x - p.x) < oc.w) { ctx.save(); ctx.globalAlpha = 0.4; drawProp(ctx, p, t); ctx.restore(); }
          else drawProp(ctx, p, t);
          break;
        }
        case 1: drawTower(ctx, it.o, t); break;
        case 2: drawMinion(ctx, it.o, t); break;
        case 3: drawHero(ctx, it.o, t); break;
        case 4: drawProjectile(ctx, it.o); break;
        case 5: drawMonster(ctx, it.o, t); break;
        case 6: drawChest(ctx, it.o, t); break;
        case 7: drawLoot(ctx, it.o, t, RARITY[it.o.item.r].color); break;
        case 8: drawDynWall(ctx, it.o, t); break;
      }
    }

    game.fx.drawTop(ctx);
    this.drawLighting(game, t);

    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * ox, dpr * oy);
    this.drawWorldUI(ctx, game, t, inView);
    game.fx.drawTexts(ctx, zoom);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    if (hud) drawHUD(ctx, game, this, t);
  }

  drawWall(ctx, i, j, pl) {
    const T = TILE, th = T * YS;
    const x0 = i * T, yTop = j * T * YS - WALL_H;
    const v = (i * 7 + j * 13) & 3;
    const front = j + 1 < GRID_H && !solid(i, j + 1);
    // 玩家被墙挡住时墙体半透明
    let alpha = 1;
    if (pl.alive && pl.y < (j + 1) * T && Math.abs(pl.x - (x0 + T / 2)) < T / 2 + 18) {
      const pyS = pl.y * YS, top = pyS - 80;
      if (pyS > yTop && top < (j + 1) * T * YS) alpha = 0.42;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    if (front) ctx.drawImage(this.walls.fronts[v], x0, (j + 1) * T * YS - WALL_H, T, WALL_H);
    ctx.drawImage(this.walls.tops[v], x0, yTop, T, th);
    const deep = solid(i, j - 1) && solid(i - 1, j) && solid(i + 1, j) && solid(i, j + 1);
    if (deep) { ctx.fillStyle = 'rgba(6,3,14,0.5)'; ctx.fillRect(x0, yTop, T, th); }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (!solid(i, j - 1)) { ctx.moveTo(x0, yTop); ctx.lineTo(x0 + T, yTop); }
    if (front) { ctx.moveTo(x0, yTop + th); ctx.lineTo(x0 + T, yTop + th); ctx.moveTo(x0, yTop + th + WALL_H); ctx.lineTo(x0 + T, yTop + th + WALL_H); }
    if (!solid(i - 1, j)) { ctx.moveTo(x0, yTop); ctx.lineTo(x0, yTop + th + (front ? WALL_H : 0)); }
    if (!solid(i + 1, j)) { ctx.moveTo(x0 + T, yTop); ctx.lineTo(x0 + T, yTop + th + (front ? WALL_H : 0)); }
    ctx.stroke();
    // 墙顶朝向通道的边沿高光
    ctx.strokeStyle = 'rgba(190,180,240,0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (!solid(i, j - 1)) { ctx.moveTo(x0 + 2, yTop + 3); ctx.lineTo(x0 + T - 2, yTop + 3); }
    if (front) { ctx.moveTo(x0 + 2, yTop + th - 3); ctx.lineTo(x0 + T - 2, yTop + th - 3); }
    if (!solid(i - 1, j)) { ctx.moveTo(x0 + 3, yTop + 2); ctx.lineTo(x0 + 3, yTop + th - 2); }
    if (!solid(i + 1, j)) { ctx.moveTo(x0 + T - 3, yTop + 2); ctx.lineTo(x0 + T - 3, yTop + th - 2); }
    ctx.stroke();
    ctx.restore();
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
    const pv = d.charged.preview(h, r);
    const full = r >= 1;
    ctx.save();
    ctx.globalAlpha = 0.25 + r * 0.35;
    ctx.strokeStyle = full ? '#fff3c4' : d.color2;
    ctx.fillStyle = hexA(d.color2, 0.12 + r * 0.1);
    ctx.lineWidth = 2;
    ctx.translate(h.x, h.y * YS);
    ctx.scale(1, YS);
    if (pv.type === 'circle') {
      ctx.beginPath(); ctx.arc(0, 0, pv.R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (pv.type === 'line') {
      ctx.rotate(h.faceAngle);
      ctx.fillRect(20, -pv.w / 2, pv.len - 20, pv.w);
      ctx.strokeRect(20, -pv.w / 2, pv.len - 20, pv.w);
    } else if (pv.type === 'cone') {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, pv.len, h.faceAngle - pv.spread / 2, h.faceAngle + pv.spread / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (pv.type === 'leap') {
      const lx = h.facing.x * pv.dist, ly = h.facing.y * pv.dist;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(lx, ly); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(lx, ly, pv.R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  drawLighting(game, t) {
    const L = this.lctx, lw = this.light.width, lh = this.light.height;
    const s = lw / this.W;
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, lw, lh);
    L.fillStyle = 'rgba(12,6,34,0.55)';
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
    const pl = game.player;
    for (const p of game.props) {
      if (p.type === 'sconce') hole(p.x, p.y + 20, p.h, 250 + Math.sin(t * 9 + p.seed * 10) * 12, 0.9);
      else if (p.type === 'crystal') hole(p.x, p.y, 20, 150, 0.6);
      else if (p.type === 'shroom') hole(p.x, p.y, 10, 60, 0.4);
    }
    for (const tw of game.towers) if (tw.alive) hole(tw.x, tw.y, tw.height, 280, 0.8);
    for (const h of game.heroes) if (h.alive) hole(h.x, h.y, 30, h === pl ? 280 : h.team === pl.team ? 220 : 150, h.team === pl.team ? 0.8 : 0.5);
    for (const m of game.minions) hole(m.x, m.y, 10, 70, 0.35);
    for (const m of game.monsters) if (m.boss) hole(m.x, m.y, 40, 260, 0.6);
    for (const l of game.loot) hole(l.x, l.y, 20, 60 + l.item.r * 30, 0.6);
    for (const c of game.chests) hole(c.x, c.y, 20, 80, 0.5);
    for (const p of game.projectiles) hole(p.x, p.y, p.z, 90, 0.8);
    for (const z of game.zones) if (z.kind !== 'trap' && z.kind !== 'none' && z.kind !== 'tether') hole(z.x, z.y, 10, z.radius * 1.5, 0.7);
    for (const l of game.fx.lights) hole(l.x, l.y, l.z, l.r, l.life / l.max);
    for (const team of [0, 1]) hole(SPAWN[team].x, SPAWN[team].y, 0, 280, 0.7);
    hole(2400, 740, 0, 300, 0.5);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.light, 0, 0, this.W, this.H);
  }

  drawWorldUI(ctx, game, t, inView) {
    const zoom = this.zoom;
    const pl = game.player;
    for (const h of game.heroes) {
      if (!h.alive || !inView(h)) continue;
      if (h.stealthT > 0 && h.team !== pl.team) continue;
      const tc = h === pl ? '#5fd17a' : h.team === pl.team ? '#4fb0ff' : '#ff4d5e';
      const top = h.def.head === 'hat' ? 92 : 76;
      const y = h.y * YS - h.z - top * h.def.size - (h.mounted ? 36 : 0);
      const ghost = this.trackGhost(h);
      hpBar(ctx, h.x, y, 64, h.hp / h.maxHp, tc, zoom, { label: h === pl ? '你' : h.name, ghost });
      if (h.shield > 0) {
        ctx.fillStyle = 'rgba(255,229,138,0.9)';
        ctx.fillRect(h.x - 32, y + 8 / Math.max(1, zoom * 0.7), 64 * Math.min(1, h.shield / h.maxHp * 2), 2.5);
      }
      if (h.state === 'recall' || h.state === 'mounting') {
        const k = h.state === 'recall' ? 1 - h.recallT / 4 : 1 - h.mountT / 1;
        ctx.fillStyle = 'rgba(8,5,16,0.85)';
        ctx.fillRect(h.x - 30, y + 14, 60, 5);
        ctx.fillStyle = h.state === 'recall' ? '#9fe8ff' : h.mount.color2;
        ctx.fillRect(h.x - 30, y + 14, 60 * k, 5);
      }
      if (h.status.stun > 0) {
        ctx.save();
        ctx.fillStyle = '#ffe066';
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + (i * Math.PI * 2) / 3;
          ctx.beginPath(); ctx.arc(h.x + Math.cos(a) * 16, y + 12 + Math.sin(a) * 5, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      if (h.state === 'charging') {
        const r = clamp(h.chargeT / h.def.charged.maxTime, 0, 1);
        const full = r >= 1;
        ctx.save();
        ctx.strokeStyle = 'rgba(8,5,16,0.85)';
        ctx.lineWidth = 6;
        const cy = h.y * YS - h.z - 30;
        ctx.beginPath(); ctx.arc(h.x, cy, 36, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
        ctx.strokeStyle = full ? (Math.floor(t * 12) % 2 ? '#ffffff' : '#ffe58a') : h.def.color2;
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(h.x, cy, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * r); ctx.stroke();
        ctx.restore();
      }
    }
    for (const m of game.minions) {
      if (m.hp < m.maxHp && inView(m)) hpBar(ctx, m.x, m.y * YS - 56, 32, m.hp / m.maxHp, TEAM_COLORS[m.team], zoom);
    }
    for (const m of game.monsters) {
      if (!inView(m) || (m.hp >= m.maxHp && !m.boss)) continue;
      const big = m.boss ? 1.6 : 1;
      hpBar(ctx, m.x, m.y * YS - m.height * big - 16, m.boss ? 120 : 50, m.hp / m.maxHp, '#e8c060', zoom, { label: m.boss || m.m.tier >= 1 ? m.name : null });
    }
    for (const tw of game.towers) {
      if (!tw.alive || !inView(tw)) continue;
      const y = tw.y * YS - tw.height - 52;
      hpBar(ctx, tw.x, y, tw.kind === 'core' ? 110 : 90, tw.hp / tw.maxHp, TEAM_COLORS[tw.team], zoom, { label: tw.kind === 'core' ? '基地水晶' : tw.tier === 'inner' ? '内塔' : '外塔', ghost: this.trackGhost(tw) });
    }
    // 地上装备名称
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const k = Math.max(1, zoom * 0.7);
    ctx.font = `800 ${12 / k}px ${FONT}`;
    ctx.lineWidth = 3 / k;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    for (const l of game.loot) {
      if (!pl.alive || Math.hypot(l.x - pl.x, l.y - pl.y) > 320) continue;
      const y = l.y * YS - 44 + Math.sin(t * 3 + l.x) * 3;
      ctx.fillStyle = RARITY[l.item.r].color;
      ctx.strokeText(l.item.name, l.x, y);
      ctx.fillText(l.item.name, l.x, y);
    }
    ctx.restore();
  }

  trackGhost(u) {
    const r = u.hp / u.maxHp;
    let g = this.hpGhost.get(u.id);
    if (g === undefined || r > g) g = r;
    else g = Math.max(r, g - 0.006);
    this.hpGhost.set(u.id, g);
    return g;
  }
}
