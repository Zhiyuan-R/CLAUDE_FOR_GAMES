// Browser-safe tactical helpers shared by the server brain (SubQ Decisions API)
// and the web edition (Claude via the artifact `sample` capability): the
// action options a unit can choose from, order parsing, and the rule-based
// fallback used when no model is available.

import { KINDS, CAMP, BANNER, dist, dirName } from './engine.js';

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const LANDMARKS = [
  { key: 'north_bridge', name: 'north bridge', x: 12, y: 3 },
  { key: 'mid_bridge', name: 'middle bridge', x: 12, y: 8 },
  { key: 'south_bridge', name: 'south bridge', x: 12, y: 13 },
  { key: 'west_hill', name: 'west hill', x: 9, y: 6 },
  { key: 'southwest_hill', name: 'southwest hill', x: 4, y: 12 },
  { key: 'west_village', name: 'west village', note: 'resupply', x: 6, y: 8 },
  { key: 'east_village', name: 'east village', note: 'resupply', x: 16, y: 3 },
  { key: 'east_forest', name: 'east forest', x: 16, y: 10 },
  { key: 'east_hill', name: 'east hill', x: 19, y: 5 },
  { key: 'banner', name: 'enemy banner', enemyName: 'our banner', enemyNote: 'fall back to defend it', x: BANNER.x, y: BANNER.y },
  { key: 'camp', name: 'our camp', enemyName: 'Blue camp', enemyNote: 'raid it', x: CAMP.x, y: CAMP.y, enemyOnly: true },
];

export const COORD = /\(?\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)?/g;

// Coordinates the commander mentioned recently to this general.
export function orderPoints(game, u) {
  const pts = [];
  const msgs = game.messages.filter((m) => m.from === 'player' && (m.to === 'all' || m.to === u.id)).slice(-3).reverse();
  for (const m of msgs) for (const c of m.text.matchAll(COORD)) {
    const x = +c[1], y = +c[2];
    if (x < 24 && y < 16 && game.passable(x, y) && !pts.some((p) => p.x === x && p.y === y)) pts.push({ x, y });
    if (pts.length >= 4) return pts;
  }
  return pts;
}

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Builds the concrete options for the action question, each mapped to an engine action.
export function actionOptions(game, u) {
  const red = u.side === 'enemy';
  const opts = [];
  const add = (key, desc, action, label) => opts.push({ key, desc, action, label });
  add('continue', `Keep doing the current action: ${game.describeAction(u.action, u)}`, null, 'Continue');
  for (const e of game.visibleFoes(u.side).sort((a, b) => dist(u, a) - dist(u, b)))
    add(`attack_${e.id}`, `Attack ${e.id} ${e.name} (${KINDS[e.kind].label}, about ${Math.round(e.troops)} troops, ${dist(u, e)} tiles to the ${dirName(u, e)})`,
      { type: 'attack', target: e.id }, `Attack ${e.id}`);
  const points = red ? [] : orderPoints(game, u);
  const landmarkAt = (p) => LANDMARKS.find((l) => l.x === p.x && l.y === p.y);
  points.forEach((p, i) => {
    const l = landmarkAt(p);
    add(`order_point_${i + 1}`, `Go to (${p.x},${p.y}), the position named in the commander's order${l ? ` (the ${l.name})` : ''}`,
      { type: 'move', x: p.x, y: p.y }, l ? cap(l.name) : `(${p.x},${p.y})`);
  });
  for (const l of LANDMARKS) {
    if (dist(u, l) === 0 || (l.enemyOnly && !red) || points.some((p) => p.x === l.x && p.y === l.y)) continue;
    const name = red ? l.enemyName ?? l.name : l.name;
    const note = red ? l.enemyNote ?? l.note : l.note;
    add(`go_${l.key}`, `March to the ${name} at (${l.x},${l.y})${note ? `, ${note}` : ''}, ${dist(u, l)} tiles away`, { type: 'move', x: l.x, y: l.y }, cap(name));
  }
  for (const a of game.units) if (a.alive && a.side === u.side && a !== u)
    add(`support_${a.id}`, `Go support ${a.id} ${a.name} (currently at (${a.x},${a.y}))`, { type: 'move', x: a.x, y: a.y }, `Support ${a.name}`);
  add('hold', 'Hold position and attack enemies that come into range', { type: 'hold' }, 'Hold');
  const home = red ? (u.post ?? BANNER) : CAMP;
  add('retreat', red ? `Fall back to your post at (${home.x},${home.y}) and regroup` : 'Fall back to our camp to rest and resupply', { type: 'retreat' }, 'Retreat');
  return opts;
}

export function newOrders(game, u) {
  return game.messages.filter((m) => m.from === 'player' && m.seq > u.lastSeenMsg && (m.to === 'all' || m.to === u.id));
}

export const RETREAT_WORDS = /\b(retreat|fall back|withdraw|pull back)\b/i;
export const HOLD_WORDS = /\b(hold|stay|wait|defend|guard|stand fast|don't move)\b/i;

// ---------- rule-based fallback ----------
// Understands a handful of keywords so orders still do something offline.
export function heuristicDecision(game, u) {
  const order = newOrders(game, u).at(-1)?.text ?? '';
  const vis = game.visibleEnemies();
  const d = { thought: '(rule engine)', say: '', action: null };

  const coord = [...order.matchAll(COORD)][0];
  const target = order.match(/\bE\s*([1-9])\b/i);
  const alive = target && game.unit('E' + target[1])?.alive;
  if (RETREAT_WORDS.test(order)) d.action = { type: 'retreat' };
  else if (alive) d.action = { type: 'attack', target: 'E' + target[1] };
  else if (coord) d.action = { type: 'move', x: +coord[1], y: +coord[2] };
  else if (HOLD_WORDS.test(order)) d.action = { type: 'hold' };
  else if (/\bbanner\b/i.test(order)) d.action = { type: 'move', ...BANNER };
  if (order) d.say = d.action
    ? `As you command: ${game.describeAction(game.sanitizeAction(d.action, u) ?? { type: 'hold' }, u)}.`
    : 'I did not follow that, my lord. Give me a position or a target (e.g. E2 or (10,5)).';
  if (/\b(well done|great|brave|proud|trust|thank)/i.test(order)) d.feeling = { morale: 3, bond: 2 };
  if (/\b(useless|idiot|coward|fool|pathetic)/i.test(order)) d.feeling = { morale: -3, bond: -4 };

  if (!d.action && !order) {
    // Idle autonomy: hit what is close by when strong enough, otherwise hold.
    const near = vis.filter((e) => dist(u, e) <= KINDS[u.kind].vision).sort((a, b) => dist(u, a) - dist(u, b))[0];
    if (u.troops < u.maxTroops * 0.35) d.action = { type: 'retreat' };
    else if (near && u.action.type === 'hold' && u.troops >= near.troops * 0.8) d.action = { type: 'attack', target: near.id };
    else if (u.action.type === 'retreat' && u.x === CAMP.x && u.y === CAMP.y) d.action = { type: 'hold' };
  }
  return d;
}
