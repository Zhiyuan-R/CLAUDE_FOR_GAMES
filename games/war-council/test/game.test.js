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
  g.say('player', 'Commander', 'A', 'Huo Lie, charge!');
  const p = g.perceive(g.unit('A'));
  assert.match(p, /Huo Lie/);
  assert.match(p, /\[NEW\].*Huo Lie, charge!/);
  assert.match(p, /@/);
});

test('applyDecision sanitizes actions and clamps feelings', () => {
  const g = new Game();
  const u = g.unit('C');
  g.applyDecision(u, { action: { type: 'move', x: 99, y: -3 }, feeling: { morale: 50, bond: -50 }, say: 'At once!' }, 'llm');
  assert.deepEqual(u.action, { type: 'move', x: 23, y: 0 });
  assert.equal(u.morale, 78);
  assert.equal(u.bond, 52);
  assert.equal(g.messages.at(-1).text, 'At once!');
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
  g.say('player', 'Commander', 'all', 'Go to (10,5)');
  assert.deepEqual(heuristicDecision(g, g.unit('A')).action, { type: 'move', x: 10, y: 5 });
  g.say('player', 'Commander', 'all', 'Attack E2');
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
  g.say('player', 'Commander', 'all', 'Go to (12,3), then check (10,10)');
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
  g.say('player', 'Commander', 'A', 'Huo Lie, take the north bridge (12,3). Well done!');
  const a = g.unit('A');
  await c.think(a);
  const req = calls[0];
  assert.equal(req.url, 'https://example.test/v1/systemone');
  assert.equal(req.auth, 'Bearer k');
  assert.equal(req.body.model, 'm');
  assert.match(req.body.state, /Huo Lie, take the north bridge/);
  assert.equal(req.body.images[0].mediaType, 'image/png');
  assert.deepEqual(Object.keys(req.body.questions), ['action', 'obey', 'morale', 'bond']);
  assert.deepEqual(a.action, { type: 'move', x: 12, y: 3 });
  assert.equal(a.brainSource, 'llm');
  assert.equal(a.morale, 75); // 70 + round((3.8-2)*2.5)
  assert.equal(a.bond, 60);
  assert.match(a.thought, /North bridge 80%/);
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

test('enemy perception uses red fog, red goals and flipped reports', () => {
  const g = new Game();
  g.log("Blue's Huo Lie (A) has been wiped out!");
  g.log('Su Li → march to (9,6)', 'ally');
  const p = g.perceive(g.unit('E3'));
  assert.match(p, /Red army/);
  assert.match(p, /Blue's Huo Lie/);
  assert.doesNotMatch(p, /Su Li → march/, 'blue-only reports stay hidden from red');
  assert.doesNotMatch(p, /War council channel/);
  assert.ok(g.visibleFoes('enemy').every((u) => u.side === 'ally'));
});

test('enemy options target blue units and include raiding the blue camp', () => {
  const g = new Game();
  const e = g.unit('E4');
  Object.assign(g.unit('C'), { x: 11, y: 8 });
  const opts = actionOptions(g, e);
  const keys = opts.map((o) => o.key);
  assert.ok(keys.includes('attack_C'));
  assert.ok(keys.includes('go_camp') && keys.includes('support_E1'));
  assert.ok(!keys.some((k) => k.startsWith('order_point')));
  assert.equal(g.sanitizeAction({ type: 'attack', target: 'C' }, e).target, 'C');
  assert.equal(g.sanitizeAction({ type: 'attack', target: 'E1' }, e), null, 'no friendly fire');
});

test('council drives enemy units with the model and hides their intent while playing', async () => {
  const g = new Game();
  let body;
  const fetchImpl = async (url, init) => {
    body = JSON.parse(init.body);
    return new Response(JSON.stringify({ answers: { action: { choice: 'go_camp', probabilities: { go_camp: 0.7, hold: 0.3 } } } }), { status: 200 });
  };
  const c = new Council(g, cfg, { fetchImpl });
  assert.equal(g.scriptedEnemies, false);
  const e3 = g.unit('E3');
  await c.think(e3);
  assert.deepEqual(Object.keys(body.questions), ['action']);
  assert.match(body.state, /Raiders/);
  assert.deepEqual(e3.action, { type: 'move', x: 2, y: 8 });
  const seen = g.snapshot().units.find((u) => u.id === 'E3');
  assert.ok(!seen || (seen.action.type === 'unknown' && !seen.thought));
  g.status = 'lost';
  assert.equal(g.snapshot().units.find((u) => u.id === 'E3').action.type, 'move');
});

test('enemies stay scripted when ENEMY_BRAIN=script or without a key', () => {
  const g = new Game();
  new Council(g, { ...cfg, enemyBrain: 'script' });
  assert.equal(g.scriptedEnemies, true);
  new Council(g, { ...cfg, apiKey: '' });
  assert.equal(g.scriptedEnemies, true);
});

test('dialogue capitalizes the action at the start of a sentence', async () => {
  const g = new Game();
  const fetchImpl = async () => new Response(JSON.stringify({ answers: {
    action: { choice: 'hold', probabilities: { hold: 1 } }, obey: { noul: 0.9 }, morale: { score: 2 }, bond: { score: 2 },
  } }), { status: 200 });
  const c = new Council(g, cfg, { fetchImpl });
  g.say('player', 'Commander', 'B', 'Su Li, hold here.');
  await c.think(g.unit('B'));
  const said = g.messages.at(-1).text;
  assert.match(said, /hold position/i);
  assert.doesNotMatch(said, /[.!?] hold position/, 'sentence-initial action is capitalized');
});

// ---------- versus ----------

test('versus: each side hears only its own war council', () => {
  const g = new Game({ versus: true });
  g.say('player', 'Blue Commander', 'all', 'Blue secret plan: take the north bridge', '', 'ally');
  g.say('player', 'Red Commander', 'all', 'Red secret plan: ambush at the south bridge', '', 'enemy');
  const blue = g.perceive(g.unit('A'));
  const red = g.perceive(g.unit('E3'));
  assert.match(blue, /Blue secret plan/);
  assert.doesNotMatch(blue, /Red secret plan/);
  assert.match(red, /Red secret plan/);
  assert.doesNotMatch(red, /Blue secret plan/);
  assert.match(red, /human commander/);
  const redView = g.snapshot({ side: 'enemy' });
  assert.ok(redView.messages.every((m) => m.side !== 'ally'));
  assert.equal(redView.perspective, 'enemy');
});

test('versus: snapshots hide the other side and show own bond', () => {
  const g = new Game({ versus: true });
  const red = g.snapshot({ side: 'enemy' });
  assert.ok(red.units.some((u) => u.id === 'E1' && u.bond === 60));
  assert.ok(!red.units.some((u) => u.id === 'A'), 'Blue starts outside Red vision');
  const blue = g.snapshot({ side: 'ally' });
  assert.ok(!blue.units.some((u) => u.id === 'E1'));
});

test('versus: Red units take orders from their commander and answer', async () => {
  const g = new Game({ versus: true });
  let body;
  const fetchImpl = async (url, init) => {
    body = JSON.parse(init.body);
    return new Response(JSON.stringify({ answers: {
      action: { choice: 'order_point_1', probabilities: { order_point_1: 0.9, hold: 0.1 } },
      obey: { noul: 0.8 }, morale: { score: 3 }, bond: { score: 3 },
    } }), { status: 200 });
  };
  const c = new Council(g, { ...cfg, enemyBrain: 'script' }, { fetchImpl });
  assert.equal(g.scriptedEnemies, false, 'a human commands Red in versus');
  g.say('player', 'Red Commander', 'E4', 'Bridge Patrol, hold the middle bridge (13,8)!', '', 'enemy');
  const e4 = g.unit('E4');
  await c.think(e4);
  assert.deepEqual(Object.keys(body.questions), ['action', 'obey', 'morale', 'bond']);
  assert.deepEqual(e4.action, { type: 'move', x: 13, y: 8 });
  assert.equal(g.messages.at(-1).from, 'E4');
  assert.equal(g.messages.at(-1).side, 'enemy');
});

test('versus: rule fallback lets Red target Blue generals by name', () => {
  const g = new Game({ versus: true });
  g.say('player', 'Red Commander', 'all', 'Raiders, attack Su Li!', '', 'enemy');
  assert.deepEqual(heuristicDecision(g, g.unit('E3')).action, { type: 'attack', target: 'B' });
});

test('versus: the winner is reported for both perspectives', () => {
  const g = new Game({ versus: true });
  for (const u of g.allies()) u.alive = false;
  g.step();
  assert.equal(g.winner, 'enemy');
  const red = g.snapshot({ side: 'enemy' });
  assert.ok(red.events.some((e) => /Red wins/.test(e.text) && e.tone === 'good'));
  assert.ok(g.snapshot({ side: 'ally' }).events.some((e) => /Red wins/.test(e.text) && e.tone === 'bad'));
});
