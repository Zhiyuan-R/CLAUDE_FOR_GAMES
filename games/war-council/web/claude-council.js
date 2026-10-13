// Web edition brains: both armies are commanded by Claude through the
// artifact `sample` capability, so the page needs no API key.
//
// Calls happen on the player's own actions, never on a timer: each order
// asks Claude once for the Blue generals it was addressed to (their choice,
// an in-character reply, obedience, and how the words affected morale and
// bond) and once for the Red army (every unit re-plans from Red's own fog of
// war). Each side's call carries a picture of that side's view of the field.
// Orders that arrive while a side is still thinking are folded into its next
// call. Without Claude (declined, unavailable, rate limited) Blue falls back
// to the rule engine and Red to the scripted AI, and every decision is
// labelled with where it came from.

import { KINDS, W, H } from '../src/engine.js';
import { actionOptions, newOrders, heuristicDecision } from '../src/tactics.js';

const RULES = `Rules of the battle:
- Each turn is about 1 second. Units move toward their goal and fight automatically when an enemy is in range.
- Cavalry moves 2 tiles per turn on open ground and charges for x1.5 damage on plains, but is slowed in forests and hills. Infantry deals x1.3 against cavalry. Archers have range 3 (+1 on a hill, which also adds +2 vision) but are weak in melee.
- Defense bonuses: forest x1.3, hill x1.2, village x1.1. Villages (and the Blue camp, for Blue) resupply troops and morale.
- The river can only be crossed at the bridges (12,3), (12,8) and (12,13).
- A unit whose morale drops below 15 routs and flees. Higher morale means more damage.
- Blue wins by standing on the Red banner B(21,8) with no Red unit adjacent for 3 turns, or by routing every Red unit. Red wins by routing all Blue generals, holding the Blue camp C(2,8) for 3 turns, or lasting until turn 900.`;

function unitLine(game, u) {
  const t = game.terrainAt(u.x, u.y);
  const terrain = { '.': 'plains', F: 'forest', H: 'hill', '=': 'bridge', V: 'village', C: 'Blue camp', B: 'Red banner' }[t] ?? t;
  return `${u.id} ${u.name} (${KINDS[u.kind].label}) at (${u.x},${u.y}) on ${terrain}, troops ${Math.round(u.troops)}/${u.maxTroops}, ` +
    `morale ${Math.round(u.morale)}${u.bond !== undefined ? `, bond ${Math.round(u.bond)}` : ''}, ` +
    `currently: ${u.routing ? 'routing!' : game.describeAction(u.action, u)}`;
}

function battlefield(game, side) {
  const lead = { side }; // a viewer with no '@' marker: the whole side's view
  const foes = game.visibleFoes(side).sort((a, b) => a.id.localeCompare(b.id));
  const lines = [
    `Turn ${game.tick}.`,
    'Map (x grows right 0-23, y grows down 0-15; letters A/B/C = Blue generals, digits = Red units by E-number, ? = fog of war):',
    'Legend: . plains  F forest  H hill  ~ river  = bridge  V village  C Blue camp  B Red banner',
    game.asciiMap(lead),
    '',
    foes.length ? `Visible enemy units:\n${foes.map((e) => '- ' + unitLine(game, e)).join('\n')}` : 'No enemy units in sight.',
  ];
  const fallen = game.units.filter((u) => u.side === side && !u.alive);
  if (fallen.length) lines.push(`Wiped out on our side: ${fallen.map((u) => u.name).join(', ')}`);
  const evs = game.events.filter((e) => e.side === 'all' || e.side === side).slice(-8);
  if (evs.length) lines.push('', 'Recent battle reports:', ...evs.map((e) => `- [${e.tick}] ${e.text}`));
  return lines.join('\n');
}

function optionsBlock(options) {
  return options.map((o) => `  - ${o.key}: ${o.desc}`).join('\n');
}

export function bluePrompt(game, generals, seenUpTo) {
  const channel = game.messages.filter((m) => m.from !== 'system').slice(-12).map((m) => {
    const isNew = m.from === 'player' && generals.some((g) => m.seq > g.lastSeenMsg) && m.seq <= seenUpTo;
    const to = m.to === 'all' ? 'all generals' : game.unit(m.to)?.name ?? m.to;
    return `${isNew ? '[NEW] ' : ''}[${m.tick}] ${m.name} -> ${to}: ${m.text}`;
  });
  const blocks = generals.map((g) => {
    const options = actionOptions(game, g);
    return `### ${g.id} ${g.name}, ${g.title}\nPersona: ${g.persona}\nStatus: ${unitLine(game, g)}\nOptions (pick one key):\n${optionsBlock(options)}`;
  });
  return `You are playing the Blue generals in "War Council", a real-time tactics game. The commander (the human player) has just ` +
    `spoken in the war council channel. Decide what each general listed below does now, and what they say back.

How to play each general:
- Stay true to their persona, current morale and bond with the commander.
- Usually carry out the commander's orders, reading the intent sensibly (coordinates, enemy IDs like E2, landmarks). A general may object or improvise when an order clearly goes against their character or would throw troops away; with bond below 30 they may refuse orders they dislike.
- The commander's tone matters: praise and trust raise morale and bond; insults, coldness or unfair blame lower them.
- If a message is addressed to one general, the others only react if it concerns them.

${RULES}

The image shows Blue's view of the battlefield: blue discs are Blue generals (A/B/C), red discs are Red units (E-numbers), dark tiles are fog of war.

${battlefield(game, 'ally')}

War council channel (oldest first; [NEW] marks what the generals have not answered yet):
${channel.join('\n')}

Generals to decide for:

${blocks.join('\n\n')}

Reply with only JSON in this shape, one entry per general listed above:
{"generals":[{"id":"A","choice":"<one option key from that general's list>","say":"<their spoken reply to the council, in character, 1-2 short sentences>","thought":"<private reasoning, at most 12 words>","obey":<0 to 1, how fully they follow the commander's new orders>,"morale":<integer -5 to 5, effect of the new messages>,"bond":<integer -5 to 5, effect of the new messages>}]}`;
}

export function redPrompt(game, units) {
  const blocks = units.map((u) => {
    const options = actionOptions(game, u);
    return `### ${u.id} ${u.name}\nPersona: ${u.persona}\nStatus: ${unitLine(game, u)}\nOptions (pick one key):\n${optionsBlock(options)}`;
  });
  return `You command the Red army in "War Council", a real-time tactics game. Red holds the east bank; three Blue generals attack from ` +
    `the west. You only know what Red's own units can see. Choose the next action for every Red unit below so that, together, ` +
    `they defend the banner and beat Blue. Each unit should act according to its persona and duty.

${RULES}

The image shows Red's view of the battlefield: red discs are your units (E-numbers), blue discs are Blue generals (A/B/C), dark tiles are fog of war.

${battlefield(game, 'enemy')}

Red units to command:

${blocks.join('\n\n')}

Reply with only JSON in this shape, one entry per unit listed above:
{"units":[{"id":"E1","choice":"<one option key from that unit's list>","thought":"<the unit's reasoning, at most 12 words>"}]}`;
}

// A picture of one side's view, drawn like the server's model view: terrain,
// that side's fog, and the units it can see.
const TERRAIN_RGB = {
  '.': '#5d6b3a', F: '#264a21', H: '#8c7646', '~': '#2c4f6e', '=': '#966e3c', V: '#aa8c50', C: '#3c5fa0', B: '#a03232',
};
export function renderSideView(game, side) {
  const cell = 24, pad = 18;
  const cv = document.createElement('canvas');
  cv.width = pad + W * cell; cv.height = pad + H * cell;
  const g = cv.getContext('2d');
  g.fillStyle = '#14120e'; g.fillRect(0, 0, cv.width, cv.height);
  const seen = game.visibleSet(side);
  g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = pad + x * cell, py = pad + y * cell;
    g.fillStyle = TERRAIN_RGB[game.map[y][x]] ?? '#555';
    g.fillRect(px, py, cell, cell);
    if (!seen.has(x + ',' + y)) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(px, py, cell, cell); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeRect(px + 0.5, py + 0.5, cell, cell);
  }
  g.fillStyle = '#c8be9f';
  for (let x = 0; x < W; x++) g.fillText(String(x), pad + x * cell + cell / 2, pad / 2);
  for (let y = 0; y < H; y++) g.fillText(String(y), pad / 2, pad + y * cell + cell / 2);
  for (const u of game.units) {
    if (!u.alive || (u.side !== side && !seen.has(u.x + ',' + u.y))) continue;
    const cx = pad + u.x * cell + cell / 2, cy = pad + u.y * cell + cell / 2;
    g.fillStyle = u.side === 'ally' ? '#3c8cdc' : '#dc463c';
    g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.fillText(u.side === 'ally' ? u.id : u.id.slice(1), cx, cy + 0.5);
  }
  return new Promise((resolve) => cv.toBlob((b) => resolve(b), 'image/png'));
}

const BLOCKING = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

export class ClaudeCouncil {
  constructor(game) {
    this.game = game;
    this.sample = null;
    this.available = false; // sample capability present and not refused
    this.images = false;
    this.busy = { ally: false, enemy: false };
    this.pending = { ally: false, enemy: false };
    this.calls = 0;
    this.failures = 0;
    this.latencyMs = 0;
    this.lastError = '';
    this.note = '';
    this.generation = 0;
    game.scriptedEnemies = true; // until Claude is confirmed available
  }

  async connect() {
    const sample = await window.claude?.use?.('sample').catch(() => null);
    if (!sample) return;
    this.sample = sample;
    this.available = true;
    this.game.scriptedEnemies = false;
    const limits = await sample.limits().catch(() => null);
    this.images = !!limits?.images;
  }

  reset() {
    this.generation++;
    this.busy = { ally: false, enemy: false };
    this.pending = { ally: false, enemy: false };
    this.game.scriptedEnemies = !this.available;
  }

  // Called when the commander sends a message.
  onOrder() {
    this.request('ally');
    if (this.available) this.request('enemy');
  }

  request(side) {
    if (this.busy[side]) { this.pending[side] = true; return; }
    this.run(side);
  }

  async run(side) {
    const game = this.game;
    const gen = this.generation;
    this.busy[side] = true;
    this.pending[side] = false;
    const seenUpTo = game.msgSeq;
    const units = side === 'ally'
      ? game.allies().filter((g) => newOrders(game, g).length)
      : game.enemies();
    if (!units.length) { this.busy[side] = false; return; }
    for (const u of units) u.thinking = true;
    try {
      if (!this.available) throw { code: 'unavailable' };
      const prompt = side === 'ally' ? bluePrompt(game, units, seenUpTo) : redPrompt(game, units);
      const opts = { modelTier: 'quick', cache: false };
      if (this.images) opts.images = [await renderSideView(game, side)];
      const t0 = performance.now();
      this.calls++;
      const reply = await this.sample.json(prompt, opts);
      this.latencyMs = Math.round(performance.now() - t0);
      if (gen !== this.generation) return;
      this.lastError = '';
      this.note = '';
      this.apply(side, units, reply, seenUpTo);
    } catch (e) {
      if (gen !== this.generation) return;
      if (e?.code && e.code !== 'unavailable') {
        this.failures++;
        this.lastError = `${e.code}${e.message ? ': ' + e.message : ''}`;
        if (BLOCKING.has(e.code)) { this.available = false; game.scriptedEnemies = true; }
        this.note = e.code === 'rate_limited'
          ? 'Claude is busy for your account right now; this order was handled by the rule engine.'
          : BLOCKING.has(e.code) ? 'Claude is not available on this page, so the rule engine and scripted enemy take over.' : '';
      }
      this.fallback(side, units, seenUpTo);
    } finally {
      for (const u of units) u.thinking = false;
      if (gen === this.generation) {
        this.busy[side] = false;
        if (this.pending[side]) this.run(side);
      }
    }
  }

  apply(side, units, reply, seenUpTo) {
    const game = this.game;
    const list = Array.isArray(reply?.[side === 'ally' ? 'generals' : 'units']) ? reply[side === 'ally' ? 'generals' : 'units'] : [];
    for (const u of units) {
      const d = list.find((x) => String(x?.id).toUpperCase() === u.id);
      if (!d || !u.alive) {
        if (side === 'ally') { u.lastSeenMsg = seenUpTo; }
        continue;
      }
      const options = actionOptions(game, u);
      const chosen = options.find((o) => o.key === d.choice) ?? options[0];
      const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
      const decision = {
        action: chosen.action,
        thought: `${chosen.label}${d.thought ? ': ' + String(d.thought).slice(0, 120) : ''}`,
      };
      if (side === 'ally') {
        u.lastSeenMsg = seenUpTo;
        decision.say = String(d.say ?? '').slice(0, 240);
        decision.feeling = { morale: num(d.morale, -5, 5), bond: num(d.bond, -5, 5) };
        const obey = Number(d.obey);
        if (Number.isFinite(obey)) decision.obey = Math.max(0, Math.min(1, Math.round(obey * 100) / 100));
      }
      game.applyDecision(u, decision, 'llm');
    }
  }

  fallback(side, units, seenUpTo) {
    const game = this.game;
    for (const u of units) {
      if (!u.alive) continue;
      if (side === 'ally') {
        const d = heuristicDecision(game, u);
        u.lastSeenMsg = seenUpTo;
        game.applyDecision(u, d, 'heuristic');
      } else {
        game.enemyAI(u);
        game.applyDecision(u, { thought: '(scripted AI)', action: { ...u.action } }, 'heuristic');
      }
    }
  }

  status() {
    return {
      label: 'Claude',
      model: 'Claude',
      mode: this.available ? 'claude' : 'rules',
      usingLLM: this.available,
      images: this.images,
      enemies: this.available ? 'model' : 'script',
      llmCalls: this.calls,
      llmFailures: this.failures,
      latencyMs: this.latencyMs,
      lastError: this.lastError,
      note: this.note,
      baseUrl: 'artifact sample capability',
    };
  }
}
