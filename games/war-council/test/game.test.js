import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, BANNER } from '../src/engine.js';
import { Council, parseDecision, heuristicDecision } from '../src/brain.js';

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

test('parseDecision tolerates code fences and trailing text', () => {
  const d = parseDecision('```json\n{"thought":"a {b}","action":{"type":"hold"}}\n```\nextra');
  assert.equal(d.action.type, 'hold');
  assert.throws(() => parseDecision('no json here'));
});

test('heuristic fallback understands targets and coordinates', () => {
  const g = new Game();
  g.say('player', '主公', 'all', '去 (10,5)');
  assert.deepEqual(heuristicDecision(g, g.unit('A')).action, { type: 'move', x: 10, y: 5 });
  g.say('player', '主公', 'all', '攻击 E2');
  assert.deepEqual(heuristicDecision(g, g.unit('A')).action, { type: 'attack', target: 'E2' });
});

test('council sends perception to the model and applies its reply', async () => {
  const g = new Game();
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    const content = '{"thought":"冲","say":"末将领命！","to":"all","action":{"type":"move","x":12,"y":3},"feeling":{"morale":3,"bond":2}}';
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  };
  const c = new Council(g, { mode: 'llm', baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm', timeoutMs: 1000, temperature: 0.5 }, { fetchImpl });
  g.say('player', '主公', 'A', '霍烈，去北桥');
  await c.think(g.unit('A'));
  assert.equal(calls[0].url, 'https://example.test/v1/chat/completions');
  assert.equal(calls[0].auth, 'Bearer k');
  assert.equal(calls[0].body.model, 'm');
  assert.match(calls[0].body.messages[1].content, /霍烈，去北桥/);
  const a = g.unit('A');
  assert.deepEqual(a.action, { type: 'move', x: 12, y: 3 });
  assert.equal(a.brainSource, 'llm');
  assert.equal(g.messages.at(-1).text, '末将领命！');
});

test('in llm mode a failed call is surfaced, not replaced by rules', async () => {
  const g = new Game();
  const fetchImpl = async () => new Response('nope', { status: 402 });
  const c = new Council(g, { mode: 'llm', baseUrl: 'x', apiKey: 'k', model: 'm', timeoutMs: 1000 }, { fetchImpl });
  await c.think(g.unit('B'));
  assert.equal(g.unit('B').brainSource, 'error');
  assert.match(c.status().lastError, /402/);
});
