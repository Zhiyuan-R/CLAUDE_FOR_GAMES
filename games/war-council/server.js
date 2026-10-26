// War Council server: hosts matches (solo against the Red AI, or 1v1 versus
// where a second player commands Red), runs each battle, schedules the
// decision-model calls, serves the browser UI and streams each player's view
// of their match over SSE. No dependencies beyond Node 18 (22.21+ behind an
// HTTPS proxy).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Game, W, H } from './src/engine.js';
import { Council, brainConfig } from './src/brain.js';
import { loadEnv } from './src/env.js';
import { relaunchWithProxy } from './src/proxy.js';
import { renderView } from './src/render.js';

if (!relaunchWithProxy()) main();

const SIDES = ['ally', 'enemy'];
const SIDE_LABEL = { ally: 'Blue', enemy: 'Red' };
const OBJECTIVE = {
  ally: 'Take the Red banner (21,8) and hold it for 3 turns, or rout every Red unit',
  enemy: 'Defend the banner (21,8): rout the Blue generals, hold their camp (2,8) for 3 turns, or last until turn 900',
};
const IDLE_MATCH_MS = 30 * 60 * 1000;

class Match {
  constructor(code, versus, cfg) {
    this.code = code;
    this.versus = versus;
    this.game = new Game({ versus });
    this.council = new Council(this.game, cfg);
    this.seats = { ally: null, enemy: null }; // seat tokens
    this.clients = new Set(); // { res, side }
    this.paused = false;
    this.lastActive = Date.now();
  }

  connected(side) {
    return [...this.clients].some((c) => c.side === side);
  }

  // A versus battle only runs while both commanders are connected.
  get waiting() {
    return this.versus && !SIDES.every((s) => this.connected(s));
  }

  get running() {
    return this.clients.size > 0 && !this.waiting && !this.paused;
  }

  seatOf(token) {
    return SIDES.find((s) => token && this.seats[s] === token) ?? null;
  }

  take(side) {
    const token = crypto.randomUUID();
    this.seats[side] = token;
    return token;
  }

  init(side) {
    const units = this.game.units.filter((u) => u.side === side).map(({ id, name, title, kind }) => ({ id, name, title, kind }));
    return { map: this.game.map, W, H, generals: units, side, versus: this.versus, code: this.code, objective: OBJECTIVE[side] };
  }

  payload(side, tickMs) {
    return JSON.stringify({
      ...this.game.snapshot({ side }),
      paused: this.paused,
      tickMs,
      brain: this.council.status(),
      lobby: { code: this.code, versus: this.versus, side, waiting: this.waiting, opponent: this.versus ? this.connected(side === 'ally' ? 'enemy' : 'ally') : null },
    });
  }

  broadcast(tickMs) {
    const cache = {};
    for (const c of this.clients) c.res.write(`data: ${(cache[c.side] ??= this.payload(c.side, tickMs))}\n\n`);
  }
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  loadEnv(path.join(here, '.env'));

  const PORT = Number(process.env.PORT || 8787);
  const HOST = process.env.HOST || '0.0.0.0';
  const TICK_MS = Number(process.env.TICK_MS || 1000);
  const cfg = brainConfig();
  const matches = new Map();

  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newCode() {
    let code;
    do code = Array.from(crypto.randomBytes(5), (b) => ALPHABET[b % ALPHABET.length]).join('');
    while (matches.has(code));
    return code;
  }

  // One clock for every match. A battle only advances while it is being
  // played, so idle matches don't spend decision-model calls.
  setInterval(() => {
    const now = Date.now();
    for (const m of matches.values()) {
      if (m.running) {
        m.game.step();
        m.council.update();
      }
      if (m.clients.size) {
        m.lastActive = now;
        m.broadcast(TICK_MS);
      } else if (now - m.lastActive > IDLE_MATCH_MS) {
        m.council.resetState();
        matches.delete(m.code);
      }
    }
  }, TICK_MS);

  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let s = '';
      req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); });
      req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
      req.on('error', reject);
    });
  }

  function json(res, code, obj) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      // Create a match: { mode: 'solo' | 'versus', side: 'ally' | 'enemy' }
      if (req.method === 'POST' && url.pathname === '/api/matches') {
        const { mode = 'solo', side = 'ally' } = await readBody(req);
        const versus = mode === 'versus';
        const seat = versus && side === 'enemy' ? 'enemy' : 'ally';
        const m = new Match(newCode(), versus, cfg);
        matches.set(m.code, m);
        return json(res, 200, { code: m.code, side: seat, versus, token: m.take(seat) });
      }

      const route = url.pathname.match(/^\/api\/matches\/([A-Z0-9]{5})(?:\/(join|stream|order|pause|reset|view\/([A-Z0-9]+)\.png))?$/);
      if (route) {
        const m = matches.get(route[1]);
        if (!m) return json(res, 404, { error: 'This match does not exist or has expired.' });
        const action = route[2]?.startsWith('view/') ? 'view' : route[2];

        // Join or rejoin: { token?, side? }
        if (req.method === 'POST' && action === 'join') {
          const { token, side } = await readBody(req);
          const mine = m.seatOf(token);
          if (mine) return json(res, 200, { code: m.code, side: mine, versus: m.versus, token });
          const wanted = SIDES.includes(side) && !m.seats[side] ? side : SIDES.find((s) => !m.seats[s] && (m.versus || s === 'ally'));
          if (!wanted) return json(res, 409, { error: m.versus ? 'Both sides of this match are already taken.' : 'This is someone else\'s solo battle.' });
          return json(res, 200, { code: m.code, side: wanted, versus: m.versus, token: m.take(wanted) });
        }

        const token = url.searchParams.get('token') ?? (req.method === 'POST' ? (req.body = await readBody(req)).token : null);
        const side = m.seatOf(token);
        if (!side) return json(res, 403, { error: 'Join the match first.' });

        if (req.method === 'GET' && action === 'stream') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
          res.write(`event: init\ndata: ${JSON.stringify(m.init(side))}\n\n`);
          const client = { res, side };
          m.clients.add(client);
          m.broadcast(TICK_MS);
          req.on('close', () => { m.clients.delete(client); m.broadcast(TICK_MS); });
          return;
        }
        if (req.method === 'GET' && action === 'view') {
          const u = m.game.unit(route[3]);
          if (!u || u.side !== side) return json(res, 404, { error: 'Not one of your units.' });
          res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
          return res.end(renderView(m.game, u));
        }
        if (req.method === 'POST' && action === 'order') {
          const { to = 'all', text = '' } = req.body;
          const t = String(text).trim().slice(0, 300);
          if (!t) return json(res, 400, { error: 'empty order' });
          const target = to === 'all' ? 'all' : m.game.unit(String(to))?.side === side ? String(to) : null;
          if (!target) return json(res, 400, { error: 'unknown recipient' });
          if (m.waiting) return json(res, 409, { error: 'Wait for your opponent to join.' });
          m.game.say('player', m.versus ? `${SIDE_LABEL[side]} Commander` : 'Commander', target, t, '', side);
          m.council.update(); // let the army react right away
          m.broadcast(TICK_MS);
          return json(res, 200, { ok: true });
        }
        if (req.method === 'POST' && action === 'pause') {
          m.paused = !m.paused;
          m.broadcast(TICK_MS);
          return json(res, 200, { paused: m.paused });
        }
        if (req.method === 'POST' && action === 'reset') {
          // In versus, a restart is a rematch once the battle is over.
          if (m.versus && m.game.status === 'playing') return json(res, 409, { error: 'You can only restart a versus match once the battle is over.' });
          m.game.reset();
          m.council.resetState();
          m.paused = false;
          m.broadcast(TICK_MS);
          return json(res, 200, { ok: true });
        }
        return json(res, 404, { error: 'not found' });
      }

      if (req.method === 'GET') {
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const full = path.join(here, 'public', path.normalize(file));
        if (!full.startsWith(path.join(here, 'public'))) return json(res, 403, { error: 'forbidden' });
        if (fs.existsSync(full) && fs.statSync(full).isFile()) {
          res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
          return fs.createReadStream(full).pipe(res);
        }
      }
      json(res, 404, { error: 'not found' });
    } catch (err) {
      json(res, 500, { error: String(err.message || err) });
    }
  });

  server.listen(PORT, HOST, () => {
    const b = new Council(new Game(), cfg).status();
    console.log(`War Council running at http://localhost:${PORT}`);
    console.log(`Brain: mode=${b.mode} model=${b.model} endpoint=${b.baseUrl} key=${b.hasKey ? 'set' : 'MISSING'} -> ${b.usingLLM ? 'decision model' : 'rule-based fallback'}`);
  });
}
