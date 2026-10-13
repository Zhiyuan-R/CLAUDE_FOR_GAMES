// War Council server: runs the battle simulation, schedules the generals'
// decision-model calls, serves the browser UI and streams state over SSE.
// No dependencies beyond Node 18 (22.21+ behind an HTTPS proxy).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game, W, H, GENERALS } from './src/engine.js';
import { Council, brainConfig } from './src/brain.js';
import { loadEnv } from './src/env.js';
import { relaunchWithProxy } from './src/proxy.js';
import { renderView } from './src/render.js';

if (!relaunchWithProxy()) main();

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  loadEnv(path.join(here, '.env'));

  const PORT = Number(process.env.PORT || 8787);
  const HOST = process.env.HOST || '0.0.0.0';
  const TICK_MS = Number(process.env.TICK_MS || 1000);

  const game = new Game();
  const council = new Council(game, brainConfig());
  let paused = false;
  const clients = new Set();

  function payload() {
    return JSON.stringify({ ...game.snapshot(), paused, tickMs: TICK_MS, brain: council.status() });
  }

  function broadcast() {
    const data = `data: ${payload()}\n\n`;
    for (const res of clients) res.write(data);
  }

  // The battle only advances while someone is watching, so an idle server
  // doesn't keep spending decision-model calls.
  setInterval(() => {
    if (!paused && clients.size > 0) {
      game.step();
      council.update();
    }
    broadcast();
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
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (req.method === 'GET' && url.pathname === '/api/stream') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(`event: init\ndata: ${JSON.stringify({ map: game.map, W, H, generals: GENERALS.map(({ persona, ...g }) => g) })}\n\n`);
        res.write(`data: ${payload()}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      const view = url.pathname.match(/^\/api\/view\/([A-Z])\.png$/);
      if (req.method === 'GET' && view) {
        const u = game.unit(view[1]);
        if (!u || u.side !== 'ally') return json(res, 404, { error: 'no such general' });
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
        return res.end(renderView(game, u));
      }
      if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, JSON.parse(payload()));
      if (req.method === 'POST' && url.pathname === '/api/order') {
        const { to = 'all', text = '' } = await readBody(req);
        const t = String(text).trim().slice(0, 300);
        if (!t) return json(res, 400, { error: 'empty order' });
        const target = to === 'all' ? 'all' : game.unit(String(to))?.side === 'ally' ? String(to) : null;
        if (!target) return json(res, 400, { error: 'unknown recipient' });
        game.say('player', 'Commander', target, t);
        council.update(); // let generals react right away
        broadcast();
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/pause') {
        paused = !paused;
        broadcast();
        return json(res, 200, { paused });
      }
      if (req.method === 'POST' && url.pathname === '/api/reset') {
        game.reset();
        council.resetState();
        paused = false;
        broadcast();
        return json(res, 200, { ok: true });
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
    const b = council.status();
    console.log(`War Council running at http://localhost:${PORT}`);
    console.log(`Brain: mode=${b.mode} model=${b.model} endpoint=${b.baseUrl} key=${b.hasKey ? 'set' : 'MISSING'} -> ${b.usingLLM ? 'LLM generals' : 'rule-based fallback'}`);
  });
}
