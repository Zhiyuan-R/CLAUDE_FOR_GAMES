import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, BANNER } from '../src/engine.js';
import zlib from 'node:zlib';
import { Council, heuristicDecision, actionOptions } from '../src/brain.js';
import { renderView } from '../src/render.js';

test('river is impassable except at bridges', () => {
  const g = new Game();
  assert.equal(g.passable(12, 0), false);
  assert.equal(g.passable(12, 8), true);
});

test('fog of war hides distant enemies from the snapshot', () => {
  const g = new Game();
  const ids = g.snapshot().units.map((u) => u.id);
  assert.ok(ids.includes('A'));
  assert.ok(!ids.includes('E1'), 'enemy at the banner should start hidden');
});

test('perception describes the general and the council channel', () => {
  const g = new Game();
  g.say('player', '主公', 'A', '霍烈，冲！');
  const p = g.perceive(g.unit('A'));
  assert.match(p, /霍烈/);
  assert.match(p, /\[新\].*霍烈，冲！/);
  assert.match(p, /@/);
});

test('applyDecision sanitizes actions and clamps feelings', () => {
  const g = new Game();
  const u = g.unit('C');
  g.applyDecision(u, { action: { type: 'move', x: 99, y: -3 }, feeling: { morale: 50, bond: -50 }, say: '得令' }, 'llm');
  assert.deepEqual(u.action, { type: 'move', x: 23, y: 0 });
  assert.equal(u.morale, 78);
  assert.equal(u.bond, 52);
  assert.equal(g.messages.at(-1).text, '得令');
  g.applyDecision(u, { action: { type: 'attack', target: 'A' } }, 'llm'); // can't attack an ally
  assert.equal(u.action.type, 'move');
});

test('units walk to their destination', () => {
  const g = new Game();
  const u = g.unit('C');
  u.action = { type: 'move', x: 10, y: 8 };
  for (let i = 0; i < 12; i++) g.step();
  assert.deepEqual([u.x, u.y], [10, 8]);
});

test('holding the banner unguarded wins', () => {
  const g = new Game();
  for (const e of g.enemies()) { if (e.id !== 'E3') e.alive = false; }
  const a = g.unit('A');
  Object.assign(a, { x: BANNER.x, y: BANNER.y, action: { type: 'hold' } });
  g.unit('E3').x = 0; g.unit('E3').y = 0;
  g.unit('E3').role = 'none';
  for (let i = 0; i < 3; i++) g.step();
  assert.equal(g.status, 'won');
});

test('heuristic fallback understands targets and coordinates', () => {
  const g = new Game();
  g.say('player', '主公', 'all', '去 (10,5)');
  assert.deepEqual(heuristicDecision(g, g.unit('A')).action, { type: 'move', x: 10, y: 5 });
  g.say('player', '主公', 'all', '攻击 E2');
  assert.deepEqual(heuristicDecision(g, g.unit('A')).action, { type: 'attack', target: 'E2' });
});

test('battlefield renders to a valid PNG', () => {
  const g = new Game();
  const png = renderView(g, g.unit('A'));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  const idat = png.subarray(33 + 8, png.length - 12 - 4);
  assert.equal(zlib.inflateSync(idat).length, (w * 3 + 1) * h);
});

test('action options cover visible enemies, ordered points and landmarks without duplicates', () => {
  const g = new Game();
  g.say('player', '主公', 'all', '去 (12,3)，再看 (10,10)');
  const keys = actionOptions(g, g.unit('A')).map((o) => o.key);
  assert.ok(keys.includes('order_point_1') && keys.includes('order_point_2'));
  assert.ok(!keys.includes('go_north_bridge'), '(12,3) is offered once, as the ordered point');
  assert.ok(keys.includes('hold') && keys.includes('retreat') && keys.includes('support_B'));
  assert.ok(!keys.some((k) => k.startsWith('attack_')), 'no enemies visible at the start');
});

const cfg = { mode: 'llm', baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm', timeoutMs: 1000, images: true };

test('council asks the decision model and applies its answers', async () => {
  const g = new Game();
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    const answers = {
      action: { type: 'choice', choice: 'order_point_1', probabilities: { order_point_1: 0.8, hold: 0.2 }, confidence: 0.8 },
      obey: { type: 'noul', noul: 0.9 },
      morale: { type: 'score', score: 3.8 },
      bond: { type: 'score', score: 2.1 },
    };
    return new Response(JSON.stringify({ model: 'm', answers }), { status: 200 });
  };
  const c = new Council(g, cfg, { fetchImpl });
  g.say('player', '主公', 'A', '霍烈，去北桥 (12,3)，好样的！');
  const a = g.unit('A');
  await c.think(a);
  const req = calls[0];
  assert.equal(req.url, 'https://example.test/v1/systemone');
  assert.equal(req.auth, 'Bearer k');
  assert.equal(req.body.model, 'm');
  assert.match(req.body.state, /霍烈，去北桥/);
  assert.equal(req.body.images[0].mediaType, 'image/png');
  assert.deepEqual(Object.keys(req.body.questions), ['action', 'obey', 'morale', 'bond']);
  assert.deepEqual(a.action, { type: 'move', x: 12, y: 3 });
  assert.equal(a.brainSource, 'llm');
  assert.equal(a.morale, 75); // 70 + round((3.8-2)*2.5)
  assert.equal(a.bond, 60);
  assert.match(a.thought, /北桥 80%/);
  assert.equal(g.messages.at(-1).from, 'A');
});

test('without new orders only the action is asked and nothing is said', async () => {
  const g = new Game();
  let body;
  const fetchImpl = async (url, init) => {
    body = JSON.parse(init.body);
    return new Response(JSON.stringify({ answers: { action: { choice: 'hold', probabilities: { hold: 1 } } } }), { status: 200 });
  };
  const c = new Council(g, { ...cfg, images: false }, { fetchImpl });
  const before = g.messages.length;
  await c.think(g.unit('C'));
  assert.deepEqual(Object.keys(body.questions), ['action']);
  assert.equal(body.images, undefined);
  assert.equal(g.messages.length, before);
});

test('in llm mode a failed call is surfaced, not replaced by rules', async () => {
  const g = new Game();
  const fetchImpl = async () => new Response('{"detail":{}}', { status: 403 });
  const c = new Council(g, cfg, { fetchImpl });
  await c.think(g.unit('B'));
  assert.equal(g.unit('B').brainSource, 'error');
  assert.match(c.status().lastError, /403/);
});
