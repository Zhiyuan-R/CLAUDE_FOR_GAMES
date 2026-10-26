// War Council client: draws the battlefield on a canvas (pre-painted terrain,
// soft fog, animated units and effects) and renders the generals' panel and
// the council channel from the server's SSE state stream.

const CELL = 40;
const PAD = 24; // margin for coordinate labels
const KIND_ICON = { cavalry: '♞', infantry: '⛨', archer: '➶' };
const KIND_LABEL = { cavalry: 'Cavalry', infantry: 'Infantry', archer: 'Archers' };
const SRC = { llm: 'Decision model', heuristic: 'Rule fallback', error: 'Call failed' };
const SIDE = {
  ally: { light: '#7cc0f0', mid: '#3d84bd', dark: '#1d4b74' },
  enemy: { light: '#f08a74', mid: '#c4402e', dark: '#701c13' },
};

const $ = (s) => document.querySelector(s);
const canvas = $('#map');
const ctx = canvas.getContext('2d');
const tooltip = $('#tooltip');

let init = null;
let state = null;
let to = 'all';
let hover = null; // {x, y}
let scale = 1;
let terrainLayer = null;
const anim = new Map(); // unit id -> {fx, fy, tx, ty, t0}
const lastTroops = new Map();
const flashes = new Map(); // unit id -> time
let effects = []; // floating texts

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Blue generals show an initial (H, S, Q); Red units show their number.
const glyphOf = (u) => (/^E\d$/.test(u.id ?? '') ? u.id.slice(1) : u.name?.startsWith('Old ') ? u.name[4] : u.name?.[0] ?? u.id);
const DISPLAY = '"Cinzel", "Trajan Pro", Georgia, serif';
const BODY = '"Spectral", Georgia, serif';

// ---------- data ----------
// The UI talks to the battle through a transport set up before this script:
// the server lobby (public/lobby.js) or the in-page battle of the web edition.
const transport = window.WC_TRANSPORT;
// The side this player commands ('ally' = Blue, 'enemy' = Red).
const me = () => init?.side ?? 'ally';
const SIDE_NAME = { ally: 'Blue', enemy: 'Red' };

transport.connect((data) => {
  init = data;
  resize();
  renderRecipients();
  if (data.objective) $('.objective').textContent = 'Objective: ' + data.objective;
  if (data.side === 'enemy') $('#review-tab').textContent = 'Enemy review';
}, (next) => {
  ingest(next);
  state = next;
  renderPanels();
});
const brainLabel = () => state?.brain?.label ?? 'Decision model';
const srcLabel = (src) => (src === 'llm' ? brainLabel() : SRC[src] || src);

function ingest(next) {
  const now = performance.now();
  if (state && next.tick < state.tick) { anim.clear(); lastTroops.clear(); effects = []; } // restarted
  for (const u of next.units) {
    const a = anim.get(u.id);
    if (!a) anim.set(u.id, { fx: u.x, fy: u.y, tx: u.x, ty: u.y, t0: now });
    else if (a.tx !== u.x || a.ty !== u.y) {
      const p = animPos(u.id, now);
      anim.set(u.id, { fx: p.x, fy: p.y, tx: u.x, ty: u.y, t0: now });
    }
    const before = lastTroops.get(u.id);
    if (before !== undefined && u.troops < before) {
      effects.push({ id: u.id, text: u.alive ? `-${before - u.troops}` : 'Routed', t0: now, side: u.side, big: !u.alive });
      flashes.set(u.id, now);
    }
    lastTroops.set(u.id, u.troops);
  }
}

function animPos(id, now) {
  const a = anim.get(id);
  const dur = (state?.tickMs ?? 1000) * 0.85;
  const t = Math.min(1, (now - a.t0) / dur);
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return { x: a.fx + (a.tx - a.fx) * e, y: a.fy + (a.ty - a.fy) * e };
}

// ---------- canvas sizing ----------
const LW = () => PAD + init.W * CELL + 6;
const LH = () => PAD + init.H * CELL + 6;

// On wide screens the whole game fits the window: the map takes the largest
// size that fits the space left beside the side panel. On narrow screens the
// page stacks and the map simply fills the width.
const oneScreen = window.matchMedia('(min-width: 900px)');
function resize() {
  if (!init) return;
  const dpr = window.devicePixelRatio || 1;
  const area = $('.map-area');
  const frame = 20; // the frame's padding around the canvas
  let cssW = area.clientWidth - frame;
  if (oneScreen.matches) cssW = Math.min(cssW, ((area.clientHeight - frame) * LW()) / LH());
  cssW = Math.max(240, Math.floor(cssW));
  canvas.style.width = cssW + 'px';
  canvas.style.height = (cssW * LH()) / LW() + 'px';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round((cssW * LH() * dpr) / LW());
  scale = canvas.width / LW();
  terrainLayer = paintTerrain();
}
const scheduleResize = () => { clearTimeout(resize.t); resize.t = setTimeout(resize, 80); };
window.addEventListener('resize', scheduleResize);
oneScreen.addEventListener?.('change', scheduleResize);
if (window.ResizeObserver) new ResizeObserver(() => { if (oneScreen.matches) scheduleResize(); }).observe($('.map-area'));
document.fonts?.ready.then(() => { if (init) terrainLayer = paintTerrain(); });

// ---------- terrain (painted once) ----------
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintTerrain() {
  const off = document.createElement('canvas');
  off.width = canvas.width; off.height = canvas.height;
  const g = off.getContext('2d');
  g.setTransform(scale, 0, 0, scale, 0, 0);
  const R = rng(7);
  const { map, W, H } = init;

  // frame background + coordinates
  g.fillStyle = '#1b150d';
  g.fillRect(0, 0, LW(), LH());
  g.fillStyle = 'rgba(232, 214, 176, .55)';
  g.font = `11px ${BODY}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let x = 0; x < W; x++) g.fillText(x, PAD + x * CELL + CELL / 2, PAD / 2 + 1);
  for (let y = 0; y < H; y++) g.fillText(y, PAD / 2, PAD + y * CELL + CELL / 2);

  g.save();
  g.translate(PAD, PAD);
  const cellBase = (x, y) => {
    g.fillStyle = `hsl(${74 + R() * 8}, ${24 + R() * 6}%, ${31 + R() * 4}%)`;
    g.fillRect(x * CELL, y * CELL, CELL + 0.5, CELL + 0.5);
    for (let i = 0; i < 7; i++) {
      const px = x * CELL + R() * CELL, py = y * CELL + R() * CELL;
      g.strokeStyle = R() < 0.5 ? 'rgba(30, 45, 15, .35)' : 'rgba(200, 210, 140, .16)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + (R() - 0.5) * 3, py - 3 - R() * 3); g.stroke();
    }
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = map[y][x];
    const cx = x * CELL, cy = y * CELL;
    if (t === '~' || t === '=') {
      const grad = g.createLinearGradient(cx, 0, cx + CELL, 0);
      grad.addColorStop(0, '#8a7a52'); grad.addColorStop(0.12, '#2a5a7e');
      grad.addColorStop(0.5, '#23506f'); grad.addColorStop(0.88, '#2a5a7e'); grad.addColorStop(1, '#8a7a52');
      g.fillStyle = grad;
      g.fillRect(cx, cy, CELL, CELL + 0.5);
      if (t === '=') {
        g.fillStyle = '#6d4a28';
        g.fillRect(cx - 4, cy + 8, CELL + 8, CELL - 16);
        g.strokeStyle = 'rgba(30, 18, 8, .55)';
        for (let i = 0; i <= CELL + 8; i += 6) { g.beginPath(); g.moveTo(cx - 4 + i, cy + 8); g.lineTo(cx - 4 + i, cy + CELL - 8); g.stroke(); }
        g.fillStyle = '#3d2814';
        g.fillRect(cx - 4, cy + 6, CELL + 8, 3); g.fillRect(cx - 4, cy + CELL - 9, CELL + 8, 3);
      }
      continue;
    }
    cellBase(x, y);
    if (t === 'F') {
      for (let i = 0; i < 4; i++) {
        const tx = cx + 8 + (i % 2) * 22 + R() * 6, ty = cy + 10 + Math.floor(i / 2) * 18 + R() * 4, r = 8 + R() * 3;
        g.fillStyle = 'rgba(10, 18, 6, .35)';
        g.beginPath(); g.ellipse(tx + 2, ty + r * 0.8, r, r * 0.45, 0, 0, Math.PI * 2); g.fill();
        const tg = g.createRadialGradient(tx - r * 0.3, ty - r * 0.4, 1, tx, ty, r);
        tg.addColorStop(0, '#5b8a3c'); tg.addColorStop(1, '#22401a');
        g.fillStyle = tg;
        g.beginPath(); g.arc(tx, ty, r, 0, Math.PI * 2); g.fill();
      }
    } else if (t === 'H') {
      const hg = g.createRadialGradient(cx + CELL * 0.45, cy + CELL * 0.4, 2, cx + CELL / 2, cy + CELL / 2, CELL * 0.62);
      hg.addColorStop(0, '#b59a62'); hg.addColorStop(1, 'rgba(120, 98, 58, .2)');
      g.fillStyle = hg;
      g.fillRect(cx, cy, CELL, CELL);
      g.strokeStyle = 'rgba(70, 52, 25, .45)';
      for (const k of [0.38, 0.26, 0.14]) {
        g.beginPath(); g.ellipse(cx + CELL / 2, cy + CELL / 2 + 2, CELL * k * 1.2, CELL * k, 0, 0, Math.PI * 2); g.stroke();
      }
    } else if (t === 'V') {
      for (const [hx, hy, s] of [[cx + 7, cy + 14, 13], [cx + 21, cy + 20, 12]]) {
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(hx + 2, hy + s * 0.75, s, 3);
        g.fillStyle = '#d6c294'; g.fillRect(hx, hy, s, s * 0.75);
        g.fillStyle = '#8c3b27';
        g.beginPath(); g.moveTo(hx - 2, hy); g.lineTo(hx + s / 2, hy - s * 0.55); g.lineTo(hx + s + 2, hy); g.fill();
        g.fillStyle = '#4a3420'; g.fillRect(hx + s * 0.4, hy + s * 0.35, s * 0.22, s * 0.4);
      }
    } else if (t === 'C') {
      g.fillStyle = 'rgba(70, 130, 190, .28)';
      g.beginPath(); g.arc(cx + CELL / 2, cy + CELL / 2, CELL * 0.48, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8e0cc';
      g.beginPath(); g.moveTo(cx + 8, cy + 31); g.lineTo(cx + 20, cy + 11); g.lineTo(cx + 32, cy + 31); g.fill();
      g.fillStyle = '#2f6aa0';
      g.beginPath(); g.moveTo(cx + 16, cy + 31); g.lineTo(cx + 20, cy + 22); g.lineTo(cx + 24, cy + 31); g.fill();
    } else if (t === 'B') {
      g.fillStyle = 'rgba(200, 60, 45, .25)';
      g.beginPath(); g.arc(cx + CELL / 2, cy + CELL / 2, CELL * 0.48, 0, Math.PI * 2); g.fill();
    }
  }
  // faint grid
  g.strokeStyle = 'rgba(0, 0, 0, .10)';
  g.lineWidth = 1;
  for (let x = 0; x <= W; x++) { g.beginPath(); g.moveTo(x * CELL, 0); g.lineTo(x * CELL, H * CELL); g.stroke(); }
  for (let y = 0; y <= H; y++) { g.beginPath(); g.moveTo(0, y * CELL); g.lineTo(W * CELL, y * CELL); g.stroke(); }
  // vignette
  const vg = g.createRadialGradient(W * CELL / 2, H * CELL / 2, H * CELL * 0.35, W * CELL / 2, H * CELL / 2, W * CELL * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10, 6, 2, .45)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W * CELL, H * CELL);
  g.restore();
  return off;
}

// ---------- per-frame drawing ----------
const fogCanvas = document.createElement('canvas');

function frame(now) {
  requestAnimationFrame(frame);
  if (!init || !state || !terrainLayer) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(terrainLayer, 0, 0);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.save();
  ctx.translate(PAD, PAD);
  drawWater(now);
  drawBanner(now);
  drawFog();
  drawHover();
  drawIntents(now);
  drawUnits(now);
  drawEffects(now);
  drawSpeech(now);
  ctx.restore();
}
requestAnimationFrame(frame);

function drawWater(now) {
  const { map, W, H } = init;
  ctx.strokeStyle = 'rgba(190, 225, 245, .28)';
  ctx.lineWidth = 1.2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (map[y][x] !== '~') continue;
    for (let i = 0; i < 2; i++) {
      const yy = y * CELL + ((now / 60 + i * 20 + y * 13) % CELL);
      ctx.beginPath();
      ctx.moveTo(x * CELL + 12 + i * 8, yy);
      ctx.quadraticCurveTo(x * CELL + 16 + i * 8, yy + 3, x * CELL + 20 + i * 8, yy);
      ctx.stroke();
    }
  }
}

function drawBanner(now) {
  const bx = 21 * CELL + 14, by = 8 * CELL + 6;
  ctx.fillStyle = '#3a2a16';
  ctx.fillRect(bx, by, 2.5, 30);
  ctx.fillStyle = '#c8392b';
  ctx.beginPath();
  ctx.moveTo(bx + 2.5, by + 1);
  for (let i = 0; i <= 16; i += 2) ctx.lineTo(bx + 2.5 + i, by + 1 + Math.sin(now / 220 + i / 4) * 1.6);
  for (let i = 16; i >= 0; i -= 2) ctx.lineTo(bx + 2.5 + i, by + 12 + Math.sin(now / 220 + i / 4) * 1.6);
  ctx.closePath(); ctx.fill();
  if (state.bannerHold > 0) {
    ctx.strokeStyle = '#f0cf86'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(21 * CELL + CELL / 2, 8 * CELL + CELL / 2, CELL * 0.6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * state.bannerHold) / 3);
    ctx.stroke();
  }
}

function drawFog() {
  if (!state.seen) return;
  const { W, H } = init;
  fogCanvas.width = W; fogCanvas.height = H;
  const f = fogCanvas.getContext('2d');
  const seen = new Set(state.seen);
  f.fillStyle = 'rgba(12, 9, 6, .62)';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!seen.has(x + ',' + y)) f.fillRect(x, y, 1, 1);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(fogCanvas, 0, 0, W * CELL, H * CELL);
}

function drawHover() {
  if (!hover) return;
  ctx.strokeStyle = 'rgba(240, 207, 134, .8)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(hover.x * CELL + 1, hover.y * CELL + 1, CELL - 2, CELL - 2);
}

const cpos = (p) => [p.x * CELL + CELL / 2, p.y * CELL + CELL / 2];

function drawIntents(now) {
  const byId = Object.fromEntries(state.units.map((u) => [u.id, u]));
  for (const u of state.units) {
    if (!u.alive || u.routing || !u.action || u.action.type === 'unknown' || u.action.type === 'hold') continue;
    if (u.side !== me() && state.status === 'playing') continue;
    let dest = null;
    if (u.action.type === 'move') dest = u.action;
    else if (u.action.type === 'attack' && byId[u.action.target]?.alive) dest = animPos(u.action.target, now);
    else if (u.action.type === 'retreat' && u.side === 'ally') dest = { x: 2, y: 8 };
    if (!dest) continue;
    const [x0, y0] = cpos(animPos(u.id, now));
    const [x1, y1] = cpos(dest);
    if (Math.hypot(x1 - x0, y1 - y0) < CELL * 0.6) continue;
    const attack = u.action.type === 'attack';
    const col = attack ? 'rgba(240, 120, 95, .85)' : u.side === 'ally' ? 'rgba(150, 205, 245, .75)' : 'rgba(240, 150, 130, .6)';
    const mx = (x0 + x1) / 2 - (y1 - y0) * 0.12, my = (y0 + y1) / 2 + (x1 - x0) * 0.12;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]); ctx.lineDashOffset = -now / 40;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(y1 - my, x1 - mx);
    const tip = attack ? 17 : 4;
    const ax = x1 - Math.cos(ang) * tip, ay = y1 - Math.sin(ang) * tip;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(ang) * 6, ay + Math.sin(ang) * 6);
    ctx.lineTo(ax + Math.cos(ang + 2.5) * 7, ay + Math.sin(ang + 2.5) * 7);
    ctx.lineTo(ax + Math.cos(ang - 2.5) * 7, ay + Math.sin(ang - 2.5) * 7);
    ctx.fill();
    if (!attack) {
      ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x1, y1, 6 + (Math.sin(now / 250) + 1) * 2, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

function drawUnits(now) {
  const units = state.units.filter((u) => u.alive).sort((a, b) => a.y - b.y);
  for (const u of units) {
    const [x, y] = cpos(animPos(u.id, now));
    const col = SIDE[u.side];
    const r = 14;
    // shadow
    ctx.fillStyle = 'rgba(0, 0, 0, .45)';
    ctx.beginPath(); ctx.ellipse(x + 1.5, y + r * 0.85, r * 0.95, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    // troop ring
    const frac = Math.max(0, u.troops / u.maxTroops);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, .55)';
    ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = frac > 0.55 ? '#7fd39a' : frac > 0.28 ? '#e8b14a' : '#ec6a55';
    ctx.beginPath(); ctx.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
    // body
    const bg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 2, x, y, r);
    bg.addColorStop(0, col.light); bg.addColorStop(0.55, col.mid); bg.addColorStop(1, col.dark);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(250, 232, 190, .75)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, r - 0.7, 0, Math.PI * 2); ctx.stroke();
    // flash on hit
    const fl = flashes.get(u.id);
    if (fl && now - fl < 350) {
      ctx.fillStyle = `rgba(255, 240, 220, ${0.6 * (1 - (now - fl) / 350)})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // glyph: generals show their initial, enemy units their E-number
    ctx.fillStyle = '#fbf1da';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (u.side === 'ally') {
      ctx.font = `700 16px ${DISPLAY}`;
      ctx.fillText(glyphOf(u), x, y + 1.5);
    } else {
      ctx.font = `700 11px ${DISPLAY}`;
      ctx.fillText(u.id, x, y + 1);
    }
    // badge: troop type icon
    const bx = x + r * 0.78, by = y - r * 0.78;
    ctx.fillStyle = '#16110b';
    ctx.beginPath(); ctx.arc(bx, by, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col.light; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#f2e6c9'; ctx.font = `8.5px ${BODY}`;
    ctx.fillText(KIND_ICON[u.kind], bx, by + 0.5);
    // routing
    if (u.routing) {
      ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]); ctx.lineDashOffset = now / 30;
      ctx.beginPath(); ctx.arc(x, y, r + 8, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // thinking dots
    if (u.thinking) {
      for (let i = 0; i < 3; i++) {
        const a = 0.35 + 0.65 * Math.max(0, Math.sin(now / 180 - i * 0.9));
        ctx.fillStyle = `rgba(240, 207, 134, ${a})`;
        ctx.beginPath(); ctx.arc(x - 6 + i * 6, y - r - 10, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function drawEffects(now) {
  effects = effects.filter((e) => now - e.t0 < 1100);
  for (const e of effects) {
    if (!anim.has(e.id)) continue;
    const [x, y] = cpos(animPos(e.id, now));
    const t = (now - e.t0) / 1100;
    ctx.globalAlpha = 1 - t;
    ctx.font = e.big ? `700 15px ${DISPLAY}` : `700 12px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
    const yy = y - 22 - t * 18;
    ctx.strokeText(e.text, x + 10, yy);
    ctx.fillStyle = e.side === 'ally' ? '#ff9b85' : '#ffe08a';
    ctx.fillText(e.text, x + 10, yy);
    ctx.globalAlpha = 1;
  }
}

function drawSpeech(now) {
  const latest = new Map();
  for (const m of state.messages) if (m.from !== 'player' && m.from !== 'system' && state.tick - m.tick <= 4) latest.set(m.from, m);
  ctx.font = `12px ${BODY}`;
  ctx.textBaseline = 'middle';
  for (const [id, m] of latest) {
    const u = state.units.find((x) => x.id === id);
    if (!u?.alive) continue;
    const [x, y] = cpos(animPos(id, now));
    const text = m.text.length > 34 ? m.text.slice(0, 33).trimEnd() + '…' : m.text;
    const w = Math.min(ctx.measureText(text).width + 16, 260);
    const bx = Math.max(2, Math.min(x - w / 2, init.W * CELL - w - 2));
    const by = Math.max(2, y - 48);
    ctx.fillStyle = 'rgba(246, 236, 212, .96)';
    ctx.strokeStyle = 'rgba(120, 90, 40, .6)'; ctx.lineWidth = 1;
    roundRect(bx, by, w, 22, 7);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 5, by + 22); ctx.lineTo(x, by + 29); ctx.lineTo(x + 5, by + 22); ctx.fill();
    ctx.fillStyle = '#2a2016'; ctx.textAlign = 'left';
    ctx.fillText(text, bx + 8, by + 11.5);
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------- interaction ----------
function cellAt(ev) {
  const r = canvas.getBoundingClientRect();
  const lx = ((ev.clientX - r.left) / r.width) * LW() - PAD;
  const ly = ((ev.clientY - r.top) / r.height) * LH() - PAD;
  const x = Math.floor(lx / CELL), y = Math.floor(ly / CELL);
  return x >= 0 && y >= 0 && x < init.W && y < init.H ? { x, y } : null;
}

canvas.addEventListener('mousemove', (ev) => {
  if (!init || !state) return;
  hover = cellAt(ev);
  const u = hover && state.units.find((u) => u.alive && u.x === hover.x && u.y === hover.y);
  if (!u) { tooltip.hidden = true; return; }
  const box = canvas.parentElement.getBoundingClientRect();
  tooltip.hidden = false;
  tooltip.innerHTML = `
    <b>${esc(u.id)} · ${esc(u.name)}</b> <span style="color:${u.side === 'ally' ? 'var(--blue)' : 'var(--red)'}">${u.side === 'ally' ? 'Blue' : 'Red'} ${KIND_LABEL[u.kind].toLowerCase()}</span>
    <div class="row"><span>Troops</span><span>${u.troops} / ${u.maxTroops}</span></div>
    <div class="row"><span>Morale</span><span>${u.morale}</span></div>
    ${u.bond !== undefined ? `<div class="row"><span>Bond</span><span>${u.bond}</span></div>` : ''}
    <div class="row"><span>Action</span><span>${u.routing ? 'Routing' : esc(describe(u.action))}</span></div>`;
  tooltip.style.left = Math.min(ev.clientX - box.left + 16, box.width - 190) + 'px';
  tooltip.style.top = ev.clientY - box.top + 14 + 'px';
});
canvas.addEventListener('mouseleave', () => { hover = null; tooltip.hidden = true; });

canvas.addEventListener('click', (ev) => {
  if (!state) return;
  const c = cellAt(ev);
  if (!c) return;
  const u = state.units.find((u) => u.alive && u.x === c.x && u.y === c.y);
  const input = $('#text');
  if (u && u.side === me()) { setRecipient(u.id); input.focus(); return; }
  input.value = (input.value ? input.value.trimEnd() + ' ' : '') + (u ? u.id : `(${c.x},${c.y})`);
  input.focus();
});

function setRecipient(id) {
  to = id;
  renderRecipients();
  if (state) renderGenerals(true);
  $('#text').placeholder = id === 'all' ? 'Order, rally or scold your generals…' : `Speak to ${nameOf(id)}…`;
}

const nameOf = (id) => (id === 'all' ? 'All generals' : id === 'player' ? 'Commander' : state?.units.find((u) => u.id === id)?.name ?? id);

function renderRecipients() {
  if (!init) return;
  const alive = (id) => !state || state.units.find((u) => u.id === id)?.alive !== false;
  const html = [{ id: 'all', name: 'All generals' }, ...init.generals]
    .map((g) => `<button type="button" class="rcpt ${to === g.id ? 'on' : ''}" data-id="${g.id}" ${alive(g.id) ? '' : 'disabled'}>${esc(g.name)}</button>`)
    .join('');
  if ($('#recipients').innerHTML !== html) $('#recipients').innerHTML = html;
}
$('#recipients').addEventListener('click', (e) => {
  const b = e.target.closest('.rcpt');
  if (b && !b.disabled) setRecipient(b.dataset.id);
});
$('#generals').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const card = e.target.closest('.gen');
  if (card && !card.classList.contains('dead')) setRecipient(to === card.dataset.id ? 'all' : card.dataset.id);
});

$('#order').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const text = $('#text').value.trim();
  if (!text) return;
  $('#text').value = '';
  await transport.order(to, text);
});
$('#pause').onclick = () => transport.pause();
// Restart asks for a second click instead of a confirm() dialog.
let resetArmed = null;
$('#reset').onclick = () => {
  const btn = $('#reset');
  if (resetArmed) { clearTimeout(resetArmed); resetArmed = null; btn.classList.remove('armed'); btn.textContent = '↻'; restart(); return; }
  btn.classList.add('armed'); btn.textContent = 'Restart?';
  resetArmed = setTimeout(() => { resetArmed = null; btn.classList.remove('armed'); btn.textContent = '↻'; }, 3000);
};
$('#again').onclick = () => restart();
function restart() {
  transport.reset();
  setRecipient('all');
  showTab('chat');
}

document.querySelector('.tabs').addEventListener('click', (e) => {
  const t = e.target.closest('.tab');
  if (t) showTab(t.dataset.tab);
});
function showTab(name) {
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === name);
  for (const p of ['chat', 'events', 'review']) $('#' + p).hidden = p !== name;
}

// ---------- panels ----------
function describe(a) {
  if (!a) return '';
  if (a.type === 'move') return `Marching to (${a.x},${a.y})`;
  if (a.type === 'attack') return `Attacking ${a.target} ${nameOf(a.target)}`;
  if (a.type === 'retreat') return 'Falling back';
  if (a.type === 'unknown') return '?';
  return 'Holding position';
}
const ACT_ICON = { move: '➜', attack: '⚔', retreat: '↩', hold: '◼' };

function renderPanels() {
  renderTop();
  renderGenerals();
  renderChat();
  renderEvents();
  renderReview();
  renderOverlay();
}

function renderTop() {
  $('#tick').textContent = `Turn ${state.tick} / ${state.maxTicks}${state.paused ? ' · Paused' : ''}`;
  $('#tickbar').style.width = `${(state.tick / state.maxTicks) * 100}%`;
  [...$('#hold').children].forEach((i, k) => i.classList.toggle('on', k < state.bannerHold));
  $('#pause').textContent = state.paused ? '▶' : '❚❚';
  const b = state.brain;
  const blue = b.usingLLM ? (b.lastError ? 'warn' : 'ok') : 'warn';
  const chips = state.versus ? [
    `<span class="chip side-${me()}"><i class="dot"></i>You command ${SIDE_NAME[me()]}</span>`,
    `<span class="chip ${state.lobby?.opponent ? 'ok' : 'warn'}"><i class="dot"></i>Opponent ${state.lobby?.opponent ? 'connected' : 'away'}</span>`,
  ] : [
    `<span class="chip ${blue}" title="${esc(b.lastError || b.baseUrl)}"><i class="dot"></i>Blue · ${b.usingLLM ? brainLabel() : 'Rule fallback'}</span>`,
    `<span class="chip ${b.enemies === 'model' ? blue : 'warn'}"><i class="dot"></i>Red · ${b.enemies === 'model' ? brainLabel() : 'Scripted AI'}</span>`,
  ];
  if (state.versus && !b.usingLLM) chips.push('<span class="chip warn"><i class="dot"></i>Rule fallback</span>');
  if (b.usingLLM) chips.push(`<span class="chip" title="${b.llmCalls} calls, ${b.llmFailures} failed">${esc(b.model)}${b.images ? ' · vision' : ''}${b.latencyMs ? ` · ${b.latencyMs}ms` : ''}</span>`);
  const html = chips.join('');
  if ($('#brain').innerHTML !== html) $('#brain').innerHTML = html;
  const note = $('#note');
  if (note && b.note !== undefined) { note.textContent = b.note; note.hidden = !b.note; }
}

let generalsKey = '';
function renderGenerals(force) {
  const gens = state.units.filter((u) => u.side === me());
  $('#generals').classList.toggle('many', gens.length > 3);
  const key = JSON.stringify([to, gens]);
  if (!force && key === generalsKey) return;
  generalsKey = key;
  const ring = (frac, color) => {
    const c = 2 * Math.PI * 23;
    return `<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23" fill="none" stroke="#2d261b" stroke-width="3"/>
      <circle cx="26" cy="26" r="23" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"
        stroke-dasharray="${c * frac} ${c}"/></svg>`;
  };
  const stat = (label, v, max, color) => `
    <div class="stat"><div class="lbl"><span>${label}</span><b>${v}</b></div>
    <div class="bar"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%;background:${color}"></i></div></div>`;
  $('#generals').innerHTML = gens.map((u) => {
    const frac = u.troops / u.maxTroops;
    const col = frac > 0.55 ? '#7fd39a' : frac > 0.28 ? '#e8b14a' : '#ec6a55';
    const top = u.top || [];
    return `
    <div class="gen ${u.side === 'enemy' ? 'red' : ''} ${u.alive ? '' : 'dead'} ${to === u.id ? 'selected' : ''}" data-id="${u.id}">
      <div class="medal ${u.thinking ? 'thinking' : ''}">${ring(frac, col)}<div class="face">${esc(glyphOf(u))}</div></div>
      <div class="gen-head">
        <span class="gen-name">${esc(u.name)}</span><span class="gen-title">${esc(u.title)} · ${KIND_LABEL[u.kind]}</span>
        <span class="spacer"></span>
        ${u.alive && transport.viewUrl ? `<a class="view" href="${transport.viewUrl(u.id)}" target="_blank" title="The battlefield image the model sees right now">Model view</a>` : ''}
        ${u.brainSource ? `<span class="tag ${u.brainSource}">${srcLabel(u.brainSource)}</span>` : ''}
      </div>
      <div class="stats">
        ${stat('Troops', u.troops, u.maxTroops, '#7fd39a')}
        ${stat('Morale', u.morale, 100, '#e8b14a')}
        ${stat('Bond', u.bond, 100, '#b98ad8')}
      </div>
      <div class="doing"><span class="ico">${u.alive ? (u.routing ? '!' : ACT_ICON[u.action.type] || '·') : '✕'}</span>
        ${!u.alive ? 'Wiped out' : u.routing ? 'Routing!' : esc(describe(u.action))} <span style="color:var(--muted)">· (${u.x},${u.y})</span></div>
      ${top.length ? `
      <div class="mind">
        <div class="seg">${top.slice(0, 3).map((o, i) => `<i class="s${i}" style="width:${Math.max(1, Math.round(o.p * 100))}%"></i>`).join('')}</div>
        <div class="seglegend">${top.slice(0, 3).map((o, i) => `<span><i class="s${i}"></i>${esc(o.label)} ${Math.round(o.p * 100)}%</span>`).join('')}
          ${u.obey != null ? `<span class="obey">Obey ${Math.round(u.obey * 100)}%</span>` : ''}</div>
      </div>` : u.thought ? `<div class="mind"><div class="seglegend"><span>${esc(u.thought)}</span></div></div>` : ''}
    </div>`;
  }).join('');
  renderRecipients();
}

let lastMsgSeq = -1;
function renderChat() {
  const msgs = state.messages;
  const last = msgs.at(-1)?.seq ?? 0;
  if (last === lastMsgSeq) return;
  lastMsgSeq = last;
  const chat = $('#chat');
  const atBottom = chat.scrollTop + chat.clientHeight >= chat.scrollHeight - 40;
  chat.innerHTML = msgs.map((m) => {
    if (m.from === 'system') return `<div class="msg system"><div class="text">${esc(m.text)}</div></div>`;
    const player = m.from === 'player';
    return `<div class="msg ${player ? 'player' : ''}">
      <div class="avatar ${/^E\d$/.test(m.from) ? 'red' : ''}">${player ? '★' : esc(glyphOf({ id: m.from, name: m.name }))}</div>
      <div class="bubble"><div class="meta"><b class="${/^E\d$/.test(m.from) ? 'red' : ''}">${esc(m.name)}</b>${m.to !== 'all' ? `→ ${esc(nameOf(m.to))} ` : ''}· ${m.tick}
        ${m.source && m.source !== 'llm' ? `<span class="src">${srcLabel(m.source)}</span>` : ''}</div>
      <div class="text">${esc(m.text)}</div></div></div>`;
  }).join('');
  if (atBottom) chat.scrollTop = chat.scrollHeight;
}

let lastEvSeq = -1;
function renderEvents() {
  const evs = state.events;
  const last = evs.at(-1)?.seq ?? 0;
  if (last === lastEvSeq) return;
  lastEvSeq = last;
  $('#events').innerHTML = evs.slice().reverse().map((e) => {
    return `<div class="ev ${e.tone || ''}"><span class="t">${e.tick}</span><span>${esc(e.text)}</span></div>`;
  }).join('');
}

function renderReview() {
  const over = state.status !== 'playing';
  $('#review-tab').hidden = !over;
  if (!over) return;
  const reds = state.units.filter((u) => u.side !== me());
  $('#review').innerHTML = `<p class="rv t">The battle is over. Here is how the ${me() === 'ally' ? 'Red' : 'Blue'} army was deployed and what it decided:</p>` + reds.map((u) => `
    <div class="rv"><b>${esc(u.id)} ${esc(u.name)}</b> (${KIND_LABEL[u.kind].toLowerCase()}) ${u.alive ? `${u.troops} troops left` : 'wiped out'} · ${u.brainSource ? srcLabel(u.brainSource) : 'Scripted'}<br />
    <span class="t">Last decision: </span>${esc(describe(u.action))}${u.thought ? `<br /><span class="t">${esc(u.thought)}</span>` : ''}</div>`).join('');
}

function renderOverlay() {
  const over = state.status !== 'playing';
  $('#overlay').hidden = !over;
  if (!over) return;
  const v = $('#verdict');
  const won = state.winner ? state.winner === me() : state.status === 'won';
  v.textContent = won ? 'Victory' : 'Defeat';
  v.className = 'verdict ' + (won ? 'won' : 'lost');
  $('#verdict-text').textContent = state.result;
}
