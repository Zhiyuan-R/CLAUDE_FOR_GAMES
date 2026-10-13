// Renders a general's view of the battlefield to a PNG (no dependencies) so the
// decision model can look at the map, not just read it.

import zlib from 'node:zlib';
import { W, H } from './engine.js';

const CELL = 24;
const PAD = 18; // room for axis labels
const TERRAIN_RGB = {
  '.': [93, 107, 58], F: [38, 74, 33], H: [140, 118, 70], '~': [44, 79, 110], '=': [150, 110, 60],
  V: [170, 140, 80], C: [60, 95, 160], B: [160, 50, 50],
};

// 3x5 bitmap glyphs, rows top to bottom, 3 bits per row.
const FONT = {
  0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 7, 1, 7], 4: [5, 5, 7, 1, 1],
  5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 1, 1, 1], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7],
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [7, 4, 4, 4, 7], V: [5, 5, 5, 5, 2], F: [7, 4, 6, 4, 4],
};

class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.px = Buffer.alloc(w * h * 3); }
  set(x, y, [r, g, b]) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = r; this.px[i + 1] = g; this.px[i + 2] = b;
  }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  darken(x, y, w, h, f) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = ((y + j) * this.w + x + i) * 3;
      for (let c = 0; c < 3; c++) this.px[k + c] = Math.round(this.px[k + c] * f);
    }
  }
  disc(cx, cy, r, c) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.set(cx + x, cy + y, c);
  }
  ring(cx, cy, r, t, c) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d <= r * r && d > (r - t) * (r - t)) this.set(cx + x, cy + y, c);
    }
  }
  text(str, x, y, scale, c) {
    for (const ch of String(str)) {
      const g = FONT[ch];
      if (g) for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++)
        if (g[row] & (4 >> col)) this.rect(x + col * scale, y + row * scale, scale, scale, c);
      x += 4 * scale;
    }
  }
  png() {
    const raw = Buffer.alloc((this.w * 3 + 1) * this.h);
    for (let y = 0; y < this.h; y++) this.px.copy(raw, y * (this.w * 3 + 1) + 1, y * this.w * 3, (y + 1) * this.w * 3);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0); ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// Legend: blue discs = the player's generals (A/B/C), red discs = the enemy
// (number = E-id), yellow ring = the viewer, dark cells = the viewer side's fog
// of war, blue cell = blue camp, red cell = red banner.
export function renderView(game, viewer) {
  const cv = new Canvas(PAD + W * CELL, PAD + H * CELL);
  cv.rect(0, 0, cv.w, cv.h, [20, 18, 14]);
  const seen = game.visibleSet(viewer.side);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = game.map[y][x];
    const px = PAD + x * CELL, py = PAD + y * CELL;
    cv.rect(px, py, CELL, CELL, TERRAIN_RGB[t] || [90, 90, 90]);
    if (t === 'F') for (let i = 4; i < CELL; i += 8) cv.rect(px + i, py + 6, 3, 10, [25, 50, 22]);
    if (t === 'H') cv.rect(px + 6, py + 10, 12, 4, [110, 92, 52]);
    if (t === 'V') cv.text('V', px + 9, py + 7, 2, [60, 40, 20]);
    if (t === 'B') cv.rect(px + 10, py + 4, 3, 16, [240, 220, 120]);
    if (!seen.has(x + ',' + y)) cv.darken(px, py, CELL, CELL, 0.4);
    cv.rect(px, py, CELL, 1, [0, 0, 0]); cv.rect(px, py, 1, CELL, [0, 0, 0]);
  }
  for (let x = 0; x < W; x++) cv.text(x, PAD + x * CELL + (x < 10 ? 9 : 5), 4, 2, [200, 190, 160]);
  for (let y = 0; y < H; y++) cv.text(y, y < 10 ? 6 : 1, PAD + y * CELL + 7, 2, [200, 190, 160]);

  for (const u of game.units) {
    if (!u.alive || (u.side !== viewer.side && !seen.has(u.x + ',' + u.y))) continue;
    const cx = PAD + u.x * CELL + CELL / 2, cy = PAD + u.y * CELL + CELL / 2;
    cv.disc(cx, cy, 10, u.side === 'ally' ? [60, 140, 220] : [220, 70, 60]);
    if (u === viewer) cv.ring(cx, cy, 12, 3, [255, 220, 40]);
    const label = u.side === 'ally' ? u.id : u.id.slice(1);
    cv.text(label, cx - 3, cy - 5, 2, [255, 255, 255]);
    const frac = u.troops / u.maxTroops;
    cv.rect(cx - 10, cy + 9, 20, 2, [0, 0, 0]);
    cv.rect(cx - 10, cy + 9, Math.max(1, Math.round(20 * frac)), 2, frac > 0.5 ? [100, 200, 100] : frac > 0.25 ? [220, 170, 60] : [230, 70, 60]);
  }
  return cv.png();
}
