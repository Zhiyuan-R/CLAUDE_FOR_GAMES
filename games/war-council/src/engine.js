// Core battle simulation for War Council.
// Pure game state + rules, no I/O. The server (or CLI) drives tick() and
// feeds decisions from the generals' brains via applyDecision().

export const W = 24;
export const H = 16;

// Terrain: '.' plain, 'F' forest, 'H' hill, '~' river (impassable),
// '=' bridge, 'V' village (resupply), 'C' our camp, 'B' enemy banner.
export function buildMap() {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const fill = (x0, x1, y0, y1, c) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c;
  };
  for (let y = 0; y < H; y++) g[y][12] = y === 3 || y === 8 || y === 13 ? '=' : '~';
  fill(5, 7, 2, 4, 'F');
  fill(8, 9, 11, 13, 'F');
  fill(15, 17, 9, 11, 'F');
  fill(18, 19, 1, 2, 'F');
  fill(9, 9, 6, 7, 'H');
  fill(4, 5, 12, 12, 'H');
  fill(19, 20, 5, 6, 'H');
  g[8][6] = 'V';
  g[3][16] = 'V';
  g[8][2] = 'C';
  g[8][21] = 'B';
  return g;
}

export const CAMP = { x: 2, y: 8 };
export const BANNER = { x: 21, y: 8 };

export const KINDS = {
  cavalry: { label: 'cavalry', speed: 2, atk: 1.3, def: 0.9, range: 1, vision: 5 },
  infantry: { label: 'infantry', speed: 1, atk: 1.0, def: 1.25, range: 1, vision: 4 },
  archer: { label: 'archers', speed: 1, atk: 0.85, def: 0.7, range: 3, vision: 6 },
};

const TERRAIN = {
  '.': { name: 'plains', def: 1.0 },
  F: { name: 'forest', def: 1.3 },
  H: { name: 'hill', def: 1.2 },
  '~': { name: 'river', def: 1.0 },
  '=': { name: 'bridge', def: 0.9 },
  V: { name: 'village', def: 1.1 },
  C: { name: 'Blue camp', def: 1.2 },
  B: { name: 'Red banner', def: 1.2 },
};

export const GENERALS = [
  {
    id: 'A', name: 'Huo Lie', title: 'Crimson Steed General', kind: 'cavalry', x: 3, y: 6, troops: 300,
    lines: {
      ack: ['Yes, my lord! {Act} — watch me!', 'Ha! {Act}. Nobody stops me!', 'Understood. {Act}!'],
      object: ['My lord, this is too timid! I will {act}!', 'With respect — no. I will {act}!', 'Wait? Enough waiting. {Act}!'],
      cheered: ['Ha! Just watch, my lord!', 'Words like that and I would ride through fire!'],
      hurt: ['…As you say, my lord.', 'Hmph. Then I will show you who is useless!'],
      spotted: ['Enemy {enemy} spotted to my {dir}!'],
      wounded: ['We have lost good riders, but we can still fight!'],
    },
    persona:
      'You are Huo Lie, a young, hot-blooded cavalry general. You crave glory, love to charge, and hate retreating or waiting. ' +
      'Praise from the commander sets your blood on fire; being ignored or called a coward makes you sulk and act rashly. ' +
      'You speak boldly and briefly, and sometimes boast. You know cavalry charges best on open plains, is hampered in forests ' +
      'and on hills, and suffers when it runs head-on into formed infantry.',
  },
  {
    id: 'B', name: 'Su Li', title: 'Azure Phoenix Strategist', kind: 'archer', x: 3, y: 10, troops: 250,
    lines: {
      ack: ['Understood. {Act}.', 'Copy that. {Act}; I will keep my distance.', 'Very well: {act}. Allies, please coordinate.'],
      object: ['My lord, that order is too risky. I suggest we {act} instead.', 'Forgive me, but that would waste lives. I will {act} first.'],
      cheered: ['Thank you for your trust, my lord. I will not fail you.', '…Thank you. I will be all the more careful.'],
      hurt: ['Please, my lord, a battle needs a cool head.', 'I will prove my judgment right.'],
      spotted: ['Scouts report: {enemy} to the {dir}. Stay alert, everyone.'],
      wounded: ['Our archers are taking heavy losses. We need cover.'],
    },
    persona:
      'You are Su Li, a calm archer commander and the army\'s strategist. You value intelligence and terrain, and prefer to ' +
      'shoot from hills or forests. If the commander\'s order would obviously throw troops away, you politely but firmly point out ' +
      'the problem and offer an alternative. You speak concisely and logically, and often suggest coordination to your peers. ' +
      'Archers are fragile up close, so you try to keep your distance.',
  },
  {
    id: 'C', name: 'Old Qin', title: 'Black Armor Veteran', kind: 'infantry', x: 4, y: 8, troops: 400,
    lines: {
      ack: ['Right then — {act}.', 'Old Qin understands. {Act}. Rest easy, my lord.', 'You heard the commander, lads — {act}!'],
      object: ['My lord, fight like that and the lads die for nothing. I will {act} first.', 'No, no. Better we {act}; it is safer.'],
      cheered: ['Heh, my lord, that warms an old soldier\'s heart.', 'With you behind us, the lads stand tall!'],
      hurt: ['…Old Qin has fought all his life, my lord. A little fairness, please.', 'Fine. Old Qin will remember that.'],
      spotted: ['{enemy} to my {dir}. Steady, everyone.'],
      wounded: ['Lost a good many lads, but this ground is still ours.'],
    },
    persona:
      'You are Old Qin, a battle-hardened veteran of the heavy infantry. You are loyal to the commander but protective of your ' +
      'soldiers, and you refuse pointless battles of attrition. You speak bluntly and practically, sometimes grumbling like an ' +
      'old uncle. You excel at holding chokepoints (bridges, villages, forests), are especially stubborn defending in forests, ' +
      'and are willing to take the blow for the younger generals.',
  },
];

// Enemy units. `role`/`post`/`leash`/`waypoints` drive the scripted fallback AI;
// `persona` drives the decision model when the enemy side is model-controlled.
const ENEMIES = [
  { id: 'E1', name: 'Banner Guard', kind: 'infantry', x: 21, y: 8, troops: 320, role: 'guard', post: { x: 21, y: 8 }, leash: 3,
    persona: 'You command the Red army\'s Banner Guard: stern and immovable. Your sacred duty is to hold the banner at (21,8); ' +
      'if it falls, the whole army is defeated. You only strike when enemies approach the banner, never let yourself be lured ' +
      'more than two or three tiles away from it, and rush back the moment the banner is left unguarded.' },
  { id: 'E2', name: 'Hill Archers', kind: 'archer', x: 19, y: 5, troops: 200, role: 'guard', post: { x: 19, y: 5 }, leash: 2,
    persona: 'You are the captain of the Red archers: shrewd and careful with your life. You like to hold the east hill (19,5) ' +
      'and shoot from above, which extends your range and vision. When enemy cavalry or infantry get close you fall back ' +
      'behind friendly troops and never brawl in melee; when allies are under attack you support them from range.' },
  { id: 'E3', name: 'Raiders', kind: 'cavalry', x: 18, y: 12, troops: 240, role: 'hunter', post: { x: 18, y: 12 }, leash: 8,
    persona: 'You lead the Red raiders: cunning, bloodthirsty, and quick to seize an opening. You prey on isolated, wounded or ' +
      'fragile enemies (archers above all) and avoid charging into full-strength infantry. If the enemy\'s main force has ' +
      'crossed the river, you consider circling around to raid their camp at (2,8) to force them back.' },
  { id: 'E4', name: 'Bridge Patrol', kind: 'infantry', x: 14, y: 8, troops: 260, role: 'patrol',
    waypoints: [{ x: 13, y: 3 }, { x: 13, y: 8 }, { x: 13, y: 13 }, { x: 13, y: 8 }], leash: 4,
    persona: 'You are the captain of the Red bridge patrol: steady and experienced. The three bridges (12,3), (12,8) and ' +
      '(12,13) are the only way across the river, and your job is to hold the bridgeheads and strike the enemy mid-crossing, ' +
      'moving to whichever bridge is threatened. When your strength runs low, fall back to the banner and join the guard.' },
  { id: 'E5', name: 'South Garrison', kind: 'infantry', x: 20, y: 11, troops: 230, role: 'guard', post: { x: 20, y: 11 }, leash: 3,
    persona: 'You command the Red south garrison: cautious and steady. You guard the south side of the banner at (20,11) and ' +
      'back up the Banner Guard. You meet enemies coming from the south bridge or the forest, and hurry to support the ' +
      'guard if the banner comes under attack.' },
];

export const SIDE_NAME = { ally: 'Blue', enemy: 'Red' };
export const foeOf = (side) => (side === 'ally' ? 'enemy' : 'ally');

export const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function dirName(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (dx === 0 && dy === 0) return 'here';
  const ns = dy < 0 ? 'north' : dy > 0 ? 'south' : '';
  const ew = dx > 0 ? 'east' : dx < 0 ? 'west' : '';
  if (Math.abs(dx) > 2 * Math.abs(dy)) return ew;
  if (Math.abs(dy) > 2 * Math.abs(dx)) return ns;
  return ns + ew;
}

export class Game {
  constructor(opts = {}) {
    this.maxTicks = opts.maxTicks ?? 900;
    // When false, enemy actions come from outside (the decision model) instead of enemyAI().
    this.scriptedEnemies = opts.scriptedEnemies ?? true;
    this.reset();
  }

  reset() {
    this.map = buildMap();
    this.tick = 0;
    this.status = 'playing'; // playing | won | lost
    this.result = '';
    this.bannerHold = 0;
    this.campLost = 0;
    this.events = [];
    this.evSeq = 0;
    this.messages = [];
    this.units = [
      ...GENERALS.map((g) => ({
        ...g, side: 'ally', maxTroops: g.troops, morale: 70, bond: 60,
        action: { type: 'hold' }, routing: false, alive: true, thought: '', thinking: false,
        lastDecisionTick: -999, lastSeenMsg: 0, brainSource: '',
      })),
      ...ENEMIES.map((e) => ({
        ...e, side: 'enemy', maxTroops: e.troops, morale: 75, action: { type: 'hold' },
        routing: false, alive: true, wp: 0, thought: '', thinking: false, lastDecisionTick: -999, brainSource: '',
      })),
    ];
    this.msgSeq = 0;
    this.say('system', 'System', 'all',
      'The battle begins. Objective: take the Red banner at (21,8) and hold it for 3 turns, or rout every Red unit. Do not let the enemy take our camp at (2,8).');
  }

  // ---------- helpers ----------
  unit(id) { return this.units.find((u) => u.id === id); }
  allies() { return this.units.filter((u) => u.side === 'ally' && u.alive); }
  enemies() { return this.units.filter((u) => u.side === 'enemy' && u.alive); }
  terrainAt(x, y) { return this.map[y]?.[x]; }
  passable(x, y) { const t = this.terrainAt(x, y); return t !== undefined && t !== '~'; }
  occupant(x, y) { return this.units.find((u) => u.alive && u.x === x && u.y === y); }

  // `side` limits who hears about it: 'all', or only 'ally' / 'enemy'.
  // `tone` is good/bad news from the player's (Blue) point of view, for the UI.
  log(text, side = 'all', tone = '') {
    this.events.push({ seq: ++this.evSeq, tick: this.tick, text, side, tone });
    if (this.events.length > 200) this.events.shift();
  }

  say(from, name, to, text, source = '') {
    const msg = { seq: ++this.msgSeq, tick: this.tick, from, name, to, text, source };
    this.messages.push(msg);
    if (this.messages.length > 200) this.messages.shift();
    return msg;
  }

  visionOf(u) {
    const base = KINDS[u.kind].vision;
    return this.terrainAt(u.x, u.y) === 'H' ? base + 2 : base;
  }

  // Cells currently seen by one side.
  visibleSet(side = 'ally') {
    const seen = new Set();
    for (const a of this.units.filter((u) => u.alive && u.side === side)) {
      const r = this.visionOf(a);
      for (let y = a.y - r; y <= a.y + r; y++)
        for (let x = a.x - r; x <= a.x + r; x++)
          if (x >= 0 && y >= 0 && x < W && y < H) seen.add(x + ',' + y);
    }
    return seen;
  }

  // Living units of the other side that `side` can currently see.
  visibleFoes(side = 'ally') {
    const seen = this.visibleSet(side);
    return this.units.filter((e) => e.alive && e.side !== side && seen.has(e.x + ',' + e.y));
  }

  visibleEnemies() { return this.visibleFoes('ally'); }

  rangeOf(u) {
    const r = KINDS[u.kind].range;
    return u.kind === 'archer' && this.terrainAt(u.x, u.y) === 'H' ? r + 1 : r;
  }

  // 8-directional BFS that treats other units as obstacles (except the goal cell).
  nextStep(u, goal) {
    if (u.x === goal.x && u.y === goal.y) return null;
    const key = (x, y) => y * W + x;
    const prev = new Map([[key(u.x, u.y), null]]);
    const q = [[u.x, u.y]];
    let found = null;
    while (q.length) {
      const [x, y] = q.shift();
      if (x === goal.x && y === goal.y) { found = [x, y]; break; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev.has(k) || !this.passable(nx, ny)) continue;
        const occ = this.occupant(nx, ny);
        if (occ && occ !== u && !(nx === goal.x && ny === goal.y)) continue;
        prev.set(k, key(x, y));
        q.push([nx, ny]);
      }
    }
    if (!found) return null;
    let k = key(found[0], found[1]);
    const start = key(u.x, u.y);
    while (prev.get(k) !== start) { k = prev.get(k); if (k == null) return null; }
    return { x: k % W, y: Math.floor(k / W) };
  }

  moveToward(u, goal, stopAt = 0) {
    const t = KINDS[u.kind];
    let steps = t.speed;
    let moved = false;
    while (steps > 0 && dist(u, goal) > stopAt) {
      const n = this.nextStep(u, goal);
      if (!n || this.occupant(n.x, n.y)) break;
      u.x = n.x; u.y = n.y; moved = true;
      // Cavalry is slowed down by rough terrain.
      steps -= u.kind === 'cavalry' && 'FH'.includes(this.terrainAt(n.x, n.y)) ? 2 : 1;
    }
    return moved;
  }

  // ---------- decisions from brains ----------
  // decision: { action: {type, x, y, target}, say, thought, feeling: {morale, bond} }
  applyDecision(u, d, source) {
    if (!u.alive) return;
    u.brainSource = source;
    u.thought = (d.thought || '').slice(0, 200);
    u.top = d.top ?? null;
    u.obey = d.obey ?? null;
    u.lastDecisionTick = this.tick;
    if (d.feeling) {
      const clamp = (v) => Math.max(-8, Math.min(8, Number(v) || 0));
      u.morale = Math.max(0, Math.min(100, u.morale + clamp(d.feeling.morale)));
      u.bond = Math.max(0, Math.min(100, u.bond + clamp(d.feeling.bond)));
    }
    const a = this.sanitizeAction(d.action, u);
    if (a && !u.routing) {
      const changed = JSON.stringify(a) !== JSON.stringify(u.action);
      u.action = a;
      if (changed) this.log(`${u.name} → ${this.describeAction(a, u)}`, u.side);
    }
    if (d.say && String(d.say).trim()) this.say(u.id, u.name, d.to || 'all', String(d.say).trim().slice(0, 240), source);
  }

  sanitizeAction(a, u) {
    if (!a || typeof a !== 'object') return null;
    const type = String(a.type || '').toLowerCase();
    const cx = (v, max) => Math.max(0, Math.min(max - 1, Math.round(Number(v))));
    if (type === 'move' && Number.isFinite(Number(a.x)) && Number.isFinite(Number(a.y))) {
      let x = cx(a.x, W), y = cx(a.y, H);
      if (!this.passable(x, y)) x = x >= 12 ? 13 : 11; // nudged off the river
      return { type: 'move', x, y };
    }
    if (type === 'attack') {
      const t = this.unit(String(a.target || '').toUpperCase());
      if (t && t.alive && t.side !== (u?.side ?? 'ally')) return { type: 'attack', target: t.id };
      return null;
    }
    if (type === 'hold') return { type: 'hold' };
    if (type === 'retreat') return { type: 'retreat' };
    return null;
  }

  describeAction(a, u) {
    switch (a.type) {
      case 'move': return `march to (${a.x},${a.y})`;
      case 'attack': { const t = this.unit(a.target); return `attack ${a.target}${t ? ' ' + t.name : ''}`; }
      case 'retreat': return u?.side === 'enemy' ? 'fall back to post' : 'fall back to camp';
      default: return 'hold position';
    }
  }

  // ---------- perception (the text a general "sees") ----------
  asciiMap(viewer) {
    const seen = this.visibleSet(viewer.side);
    const label = (u) => (u.side === 'ally' ? u.id : u.id.slice(1));
    const rows = [];
    rows.push('    ' + Array.from({ length: W }, (_, x) => (x % 10)).join(''));
    for (let y = 0; y < H; y++) {
      let row = '';
      for (let x = 0; x < W; x++) {
        const u = this.occupant(x, y);
        if (u === viewer) row += '@';
        else if (u && (u.side === viewer.side || seen.has(x + ',' + y))) row += label(u);
        else if (!seen.has(x + ',' + y) && !'CB~='.includes(this.map[y][x])) row += '?';
        else row += this.map[y][x];
      }
      rows.push(String(y).padStart(3) + ' ' + row);
    }
    return rows.join('\n');
  }

  perceive(u) {
    if (u.side === 'enemy') return this.perceiveEnemy(u);
    const lines = [];
    lines.push(`[Turn ${this.tick}] (about 1 second per turn)`);
    this.describeSelf(u, lines, `, bond with the commander ${Math.round(u.bond)}`);
    lines.push('');
    lines.push('Map (x grows to the right 0-23, y grows downward 0-15; @ = you, A/B/C = fellow generals, digits = enemy E-numbers, ? = fog):');
    lines.push('Legend: . plains  F forest  H hill  ~ river (impassable)  = bridge  V village (resupply)  C our camp  B enemy banner');
    lines.push(this.asciiMap(u));
    lines.push('');
    this.describeForces(u, lines, 'enemies', 'Fellow generals');
    const msgs = this.messages.filter((m) => m.to === 'all' || m.to === u.id || m.from === u.id).slice(-10);
    lines.push('');
    lines.push('War council channel (recent messages):');
    for (const m of msgs) {
      const isNew = m.seq > u.lastSeenMsg && m.from !== u.id;
      const to = m.to === 'all' ? 'all generals' : (this.unit(m.to)?.name ?? m.to);
      lines.push(`${isNew ? '[NEW] ' : ''}[${m.tick}] ${m.name} → ${to}: ${m.text}`);
    }
    return lines.join('\n');
  }

  // The enemy side sees the same world from across the river: its own fog,
  // its own comrades, and only the reports its side would hear.
  perceiveEnemy(u) {
    const lines = [];
    lines.push(`[Turn ${this.tick}] (about 1 second per turn)`);
    lines.push('You belong to the Red army holding the east bank. Three Blue generals are attacking from the west bank. They win by taking our banner B(21,8) (standing on it with no Red unit adjacent for 3 turns) or by routing all of us.');
    lines.push('We win by routing every Blue general, by occupying the Blue camp C(2,8) for 3 turns, or by holding out until turn 900.');
    this.describeSelf(u, lines, '');
    lines.push('');
    lines.push('Map (x grows to the right 0-23, y grows downward 0-15; @ = you, digits = fellow Red units by E-number, A/B/C = Blue generals, ? = fog):');
    lines.push('Legend: . plains  F forest  H hill  ~ river (impassable)  = bridge  V village (resupply)  C Blue camp  B our banner');
    lines.push(this.asciiMap(u));
    lines.push('');
    this.describeForces(u, lines, 'Blue generals', 'Fellow Red units');
    return lines.join('\n');
  }

  describeSelf(u, lines, extra) {
    const k = KINDS[u.kind];
    const t = TERRAIN[this.terrainAt(u.x, u.y)];
    lines.push(`You: ${u.id} ${u.name} (${k.label}) at (${u.x},${u.y}) on ${t.name}, troops ${Math.round(u.troops)}/${u.maxTroops}, morale ${Math.round(u.morale)}${extra}.`);
    lines.push(`Current action: ${this.describeAction(u.action, u)}${u.routing ? ' (your troops are routing and fleeing!)' : ''}. Attack range ${this.rangeOf(u)}, vision ${this.visionOf(u)}.`);
  }

  describeForces(u, lines, foeLabel, friendLabel) {
    const vis = this.visibleFoes(u.side);
    if (vis.length) {
      lines.push(`Visible ${foeLabel}:`);
      for (const e of vis.sort((a, b) => dist(u, a) - dist(u, b))) {
        lines.push(`- ${e.id} ${e.name} (${KINDS[e.kind].label}) at (${e.x},${e.y}) on ${TERRAIN[this.terrainAt(e.x, e.y)].name}, about ${Math.round(e.troops)} troops, ${dist(u, e)} tiles to the ${dirName(u, e)}${e.routing ? ', routing' : ''}`);
      }
    } else lines.push(`No ${foeLabel} in sight.`);
    const others = this.units.filter((a) => a.alive && a.side === u.side && a !== u);
    if (others.length) {
      lines.push(`${friendLabel}:`);
      for (const a of others) lines.push(`- ${a.id} ${a.name} (${KINDS[a.kind].label}) at (${a.x},${a.y}), troops ${Math.round(a.troops)}, morale ${Math.round(a.morale)}, ${this.describeAction(a.action, a)}`);
    }
    const fallen = this.units.filter((x) => x.side === u.side && !x.alive);
    if (fallen.length) lines.push('Wiped out on our side: ' + fallen.map((f) => f.name).join(', '));
    const evs = this.events.filter((e) => e.side === 'all' || e.side === u.side).slice(-8);
    if (evs.length) {
      lines.push('');
      lines.push('Recent battle reports:');
      for (const e of evs) lines.push(`- [${e.tick}] ${e.text}`);
    }
  }

  // ---------- simulation ----------
  step() {
    if (this.status !== 'playing') return;
    this.tick++;
    const all = this.units.filter((u) => u.alive);

    if (this.scriptedEnemies) for (const e of this.enemies()) this.enemyAI(e);

    // Movement
    const movedThisTick = new Set();
    for (const u of all) {
      if (!u.alive) continue;
      if (u.routing) {
        const home = u.side === 'ally' ? CAMP : BANNER;
        if (this.moveToward(u, home)) movedThisTick.add(u);
        continue;
      }
      const a = u.action;
      if (a.type === 'move') {
        if (this.moveToward(u, a)) movedThisTick.add(u);
      } else if (a.type === 'retreat') {
        if (this.moveToward(u, u.side === 'ally' ? CAMP : (u.post ?? BANNER))) movedThisTick.add(u);
      } else if (a.type === 'attack') {
        const t = this.unit(a.target);
        if (!t || !t.alive) { u.action = { type: 'hold' }; continue; }
        if (dist(u, t) > this.rangeOf(u) && this.moveToward(u, t, this.rangeOf(u))) movedThisTick.add(u);
      }
    }

    // Combat: everyone simultaneously
    const damage = new Map();
    const engaged = new Set();
    for (const u of all) {
      if (!u.alive || u.routing || u.action.type === 'retreat') continue;
      const foes = this.units.filter((f) => f.alive && f.side !== u.side && dist(u, f) <= this.rangeOf(u));
      if (!foes.length) continue;
      let target = u.action.type === 'attack' ? foes.find((f) => f.id === u.action.target) : null;
      target ??= foes.sort((a, b) => a.troops - b.troops)[0];
      const k = KINDS[u.kind], tk = KINDS[target.kind];
      let dmg = 0.045 * u.troops * k.atk * (0.55 + u.morale / 220);
      if (u.kind === 'cavalry' && movedThisTick.has(u) && this.terrainAt(u.x, u.y) === '.') dmg *= 1.5; // charge
      if (u.kind === 'infantry' && target.kind === 'cavalry') dmg *= 1.3; // spears vs horses
      if (u.kind === 'archer' && dist(u, target) <= 1) dmg *= 0.6; // archers in melee
      if (target.kind === 'archer' && 'F'.includes(this.terrainAt(target.x, target.y)) && u.kind === 'archer') dmg *= 0.7;
      dmg /= tk.def * TERRAIN[this.terrainAt(target.x, target.y)].def;
      damage.set(target, (damage.get(target) || 0) + dmg);
      engaged.add(u); engaged.add(target);
    }
    for (const [t, dmg] of damage) {
      const before = t.troops;
      t.troops = Math.max(0, t.troops - dmg);
      t.morale = Math.max(0, t.morale - (dmg / t.maxTroops) * 70);
      if (t.troops < t.maxTroops * 0.3) t.morale = Math.max(0, t.morale - 0.6);
      if (Math.floor(before / 50) !== Math.floor(t.troops / 50))
        this.log(`${t.name} is under attack, troops down to ${Math.round(t.troops)}`, t.side);
    }

    // Recovery, rout, death
    for (const u of all) {
      if (!u.alive) continue;
      if (u.troops < 1) {
        u.alive = false;
        this.log(`${SIDE_NAME[u.side]}'s ${u.name} (${u.id}) has been wiped out!`, 'all', u.side === 'ally' ? 'bad' : 'good');
        continue;
      }
      const terr = this.terrainAt(u.x, u.y);
      if (!engaged.has(u)) {
        u.morale = Math.min(100, u.morale + 0.4);
        if (terr === 'V' || (u.side === 'ally' && terr === 'C')) {
          u.troops = Math.min(u.maxTroops, u.troops + 2);
          u.morale = Math.min(100, u.morale + 1.5);
        }
      }
      if (!u.routing && u.morale < 15) {
        u.routing = true;
        this.log(`${SIDE_NAME[u.side]}'s ${u.name} breaks and routs!`, 'all', u.side === 'ally' ? 'bad' : 'good');
      } else if (u.routing && u.morale > 40) {
        u.routing = false;
        u.action = { type: 'hold' };
        this.log(`${SIDE_NAME[u.side]}'s ${u.name} rallies and rejoins the fight.`, 'all', u.side === 'ally' ? 'good' : 'bad');
      }
    }

    this.checkEnd();
  }

  enemyAI(e) {
    if (e.routing) return;
    const allies = this.allies();
    const nearest = (pos, r) => allies.filter((a) => dist(pos, a) <= r).sort((a, b) => dist(pos, a) - dist(pos, b))[0];
    if (e.role === 'guard') {
      const t = nearest(e.post, e.leash + this.rangeOf(e));
      e.action = t ? { type: 'attack', target: t.id } : { type: 'move', ...e.post };
    } else if (e.role === 'patrol') {
      const t = nearest(e, e.leash);
      if (t) e.action = { type: 'attack', target: t.id };
      else {
        const wp = e.waypoints[e.wp];
        if (e.x === wp.x && e.y === wp.y) e.wp = (e.wp + 1) % e.waypoints.length;
        e.action = { type: 'move', ...e.waypoints[e.wp] };
      }
    } else if (e.role === 'hunter') {
      // Picks off weak or isolated allies; otherwise lurks, and raids the camp late in the battle.
      const prey = allies
        .filter((a) => dist(e, a) <= e.leash)
        .sort((a, b) => a.troops / a.maxTroops - b.troops / b.maxTroops)[0];
      if (prey && (prey.kind !== 'infantry' || prey.troops < e.troops * 0.8)) e.action = { type: 'attack', target: prey.id };
      else if (this.tick > 240 && this.tick % 120 < 60) e.action = { type: 'move', ...CAMP };
      else e.action = { type: 'move', ...e.post };
    }
  }

  checkEnd() {
    const onBanner = this.occupant(BANNER.x, BANNER.y);
    const guarded = this.enemies().some((e) => dist(e, BANNER) <= 1 && !e.routing);
    if (onBanner?.side === 'ally' && !guarded) {
      this.bannerHold++;
      if (this.bannerHold === 1) this.log(`${onBanner.name} has reached the Red banner! Hold for 2 more turns to take it!`, 'all', 'good');
    } else this.bannerHold = 0;
    const onCamp = this.occupant(CAMP.x, CAMP.y);
    if (onCamp?.side === 'enemy') {
      this.campLost++;
      if (this.campLost === 1) this.log(`Alarm! Red's ${onCamp.name} has broken into the Blue camp!`, 'all', 'bad');
    } else this.campLost = 0;

    const fighting = (u) => u.alive && !u.routing;
    if (this.bannerHold >= 3) this.end('won', 'The banner has changed hands — Blue takes the Red banner. A great victory!');
    else if (!this.enemies().some(fighting)) this.end('won', 'Every Red unit has been routed. A great victory!');
    else if (!this.allies().length) this.end('lost', 'All three Blue generals have fallen…');
    else if (this.campLost >= 3) this.end('lost', 'The camp has fallen and the army is in retreat…');
    else if (this.tick >= this.maxTicks) this.end('lost', 'The campaign dragged on too long; supplies ran out and the army withdrew.');
  }

  end(status, text) {
    this.status = status;
    this.result = text;
    this.log(text, 'all', status === 'won' ? 'good' : 'bad');
    this.say('system', 'System', 'all', text);
  }

  // ---------- serialization for the UI ----------
  snapshot({ reveal = false } = {}) {
    const seen = this.visibleSet();
    const showAll = reveal || this.status !== 'playing';
    return {
      tick: this.tick,
      maxTicks: this.maxTicks,
      status: this.status,
      result: this.result,
      bannerHold: this.bannerHold,
      seen: showAll ? null : [...seen],
      units: this.units
        .filter((u) => u.side === 'ally' || showAll || (u.alive && seen.has(u.x + ',' + u.y)))
        .map((u) => {
          // The enemy's intentions stay secret until the battle is over.
          const secret = u.side === 'enemy' && !showAll;
          return {
            id: u.id, name: u.name, title: u.title, side: u.side, kind: u.kind, x: u.x, y: u.y,
            troops: Math.round(u.troops), maxTroops: u.maxTroops, morale: Math.round(u.morale),
            bond: u.bond !== undefined ? Math.round(u.bond) : undefined, alive: u.alive, routing: u.routing,
            action: secret ? { type: 'unknown' } : u.action, thought: secret ? '' : u.thought, top: secret ? null : u.top ?? null, obey: secret ? null : u.obey ?? null,
            thinking: secret ? false : u.thinking, brainSource: secret ? '' : u.brainSource,
          };
        }),
      events: this.events.filter((e) => showAll || e.side !== 'enemy').slice(-40),
      messages: this.messages.slice(-80),
    };
  }
}
