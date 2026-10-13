// Brains for both sides, driven by SubQ's Decisions API (POST /v1/systemone).
// The player's three generals and each red (enemy) unit decide independently,
// each from its own side's fog of war.
//
// The decision model doesn't write text: it reads a state (the general's
// persona + perception) plus an image of the battlefield, and answers typed
// questions with probabilities. Each think() asks:
//   action – choice among concrete options (attack a visible enemy, march to a
//            landmark or a point the commander named, support an ally, hold…)
//   obey   – noul: does the general go along with the commander's latest order?
//   morale / bond – score: how the commander's latest words land emotionally.
// The answers become the unit's action, its morale/bond change, and a line of
// dialogue picked from the general's personality templates.
//
// If the model can't be reached, an optional rule-based fallback keeps the game
// playable; every decision is tagged with its source so the UI never passes
// one off as the other.

import { KINDS, dist, dirName } from './engine.js';
import { renderView } from './render.js';
import { actionOptions, newOrders, cap, pick, RETREAT_WORDS, HOLD_WORDS, heuristicDecision } from './tactics.js';

export { LANDMARKS, actionOptions, heuristicDecision } from './tactics.js';

export function brainConfig(env = process.env) {
  return {
    mode: (env.BRAIN_MODE || 'auto').toLowerCase(), // llm | auto | heuristic
    baseUrl: (env.LLM_BASE_URL || 'https://api.subq.ai/v1').replace(/\/$/, ''),
    apiKey: env.LLM_API_KEY || env.SUBQ_API_KEY || '',
    model: env.LLM_MODEL || 'subq-snap-preview',
    timeoutMs: Number(env.LLM_TIMEOUT_MS || 15000),
    images: env.LLM_IMAGES !== '0',
    enemyBrain: (env.ENEMY_BRAIN || 'llm').toLowerCase(), // llm | script
  };
}

const MAP_LEGEND = 'Blue discs are the Blue generals (letters A/B/C), red discs are Red units (digits are E-numbers), and the disc with ' +
  'a yellow ring is you. Darkened tiles are fog of war outside your side\'s vision; dark green is forest, tan is hills, the blue vertical ' +
  'band is the river (crossable only at bridges), the blue tile on the left is the Blue camp and the red tile on the right is the Red ' +
  'banner. Coordinates are labeled along the top and left edges.';

function buildEnemyRequest(game, u, cfg) {
  const options = actionOptions(game, u);
  const body = {
    model: cfg.model,
    state: `Persona of the commander of Red unit ${u.id} "${u.name}":\n${u.persona}\n\nThe attached image is a top-down view of the battlefield. ${MAP_LEGEND}\n\n${game.perceive(u)}`,
    questions: {
      action: {
        type: 'choice',
        instructions: `What will ${u.name} do next? Stay true to its persona and duty, and make the soundest tactical call given the ` +
          'battlefield shown in the image and described in the text (terrain, troop strength on both sides, unit counters, ranges, ' +
          'the safety of the banner and the camp, and where friendly units are).',
        criteria: Object.fromEntries(options.map((o) => [o.key, o.desc])),
      },
    },
  };
  if (cfg.images) body.images = [{ mediaType: 'image/png', base64: renderView(game, u).toString('base64') }];
  return { body, options, fresh: [] };
}

export function buildRequest(game, u, cfg) {
  if (u.side === 'enemy') return buildEnemyRequest(game, u, cfg);
  const options = actionOptions(game, u);
  const fresh = newOrders(game, u);
  const name = u.name;
  const questions = {
    action: {
      type: 'choice',
      instructions: `What will ${name} do next? Fully inhabit ${name}'s personality, morale and bond with the commander, and weigh the ` +
        'commander\'s latest orders (messages marked [NEW]) and the battlefield shown in the image and described in the text (terrain, ' +
        `troop strength, unit counters, ranges). The commander's orders are usually carried out, unless they clearly go against ${name}'s ` +
        'character or would throw the troops away for nothing.',
      criteria: Object.fromEntries(options.map((o) => [o.key, o.desc])),
    },
  };
  if (fresh.length) {
    const said = fresh.map((m) => `"${m.text}"`).join(' ');
    const scale = ['Drops sharply', 'Drops slightly', 'About the same', 'Rises slightly', 'Rises sharply'];
    questions.obey = {
      type: 'noul',
      instructions: `The commander just said: ${said}. Will ${name} do what the commander wants?`,
      criteria: { true: `${name} accepts the order and carries it out`, false: `${name} has objections and will refuse or improvise` },
    };
    questions.morale = {
      type: 'score',
      instructions: `The commander just said: ${said}. How does this change ${name}'s morale (fighting spirit)? Consider ${name}'s personality and the emotion carried by the tone and wording.`,
      criteria: scale,
    };
    questions.bond = {
      type: 'score',
      instructions: `The commander just said: ${said}. How does this change ${name}'s trust and closeness toward the commander (bond)?`,
      criteria: scale,
    };
  }
  const body = {
    model: cfg.model,
    state: `Persona of the general ${name} ("you" below means ${name}):\n${u.persona}\n\n` +
      `The attached image is a top-down view of the battlefield. ${MAP_LEGEND}\n\n` +
      game.perceive(u),
    questions,
  };
  if (cfg.images) body.images = [{ mediaType: 'image/png', base64: renderView(game, u).toString('base64') }];
  return { body, options, fresh };
}

export async function callDecisions(cfg, body, fetchImpl = fetch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.baseUrl}/systemone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    const json = JSON.parse(text);
    if (!json.answers?.action?.choice) throw new Error('response has no action choice');
    return json.answers;
  } finally {
    clearTimeout(timer);
  }
}

const scoreToDelta = (s) => (s && Number.isFinite(s.score) ? Math.round((s.score - 2) * 2.5) : 0);
const fill = (line, act) => line.replace('{Act}', cap(act)).replace('{act}', act);

// Turns the model's answers into a decision the engine can apply.
export function interpret(game, u, answers, options, fresh) {
  const ranked = Object.entries(answers.action.probabilities || {}).sort((a, b) => b[1] - a[1]);
  const chosen = options.find((o) => o.key === answers.action.choice) ?? options[0];
  const label = (k) => options.find((o) => o.key === k)?.label ?? k;
  const thought = ranked.slice(0, 3).map(([k, p]) => `${label(k)} ${Math.round(p * 100)}%`).join(' · ');
  const top = ranked.slice(0, 4).map(([k, p]) => ({ label: label(k), p: Math.round(p * 100) / 100 }));
  const d = { thought, top, action: chosen.action, say: '' };
  const act = game.describeAction(chosen.action ?? u.action, u);
  if (fresh.length) {
    const morale = scoreToDelta(answers.morale);
    const bond = scoreToDelta(answers.bond);
    d.feeling = { morale, bond };
    const obey = answers.obey?.noul ?? 1;
    const lines = u.lines;
    // Only object out loud when the general actually does something other than what was asked.
    const objects = obey < 0.5 && !followsOrder(chosen, fresh);
    let say = fill(objects ? pick(lines.object) : pick(lines.ack), act);
    if (morale >= 3 || bond >= 3) say = pick(lines.cheered) + ' ' + say;
    else if (morale <= -3 || bond <= -3) say = pick(lines.hurt) + ' ' + say;
    d.say = say;
    d.thought += ` · obey ${Math.round(obey * 100)}%`;
    d.obey = Math.round(obey * 100) / 100;
  }
  return d;
}

// Whether the chosen option is what the commander's new message asked for.
function followsOrder(chosen, fresh) {
  const text = fresh.map((m) => m.text).join(' ');
  if (chosen.key.startsWith('order_point_')) return true;
  if (chosen.action?.type === 'attack') return text.toUpperCase().includes(chosen.action.target);
  if (chosen.key === 'retreat') return RETREAT_WORDS.test(text);
  if (chosen.key === 'hold' || chosen.key === 'continue') return HOLD_WORDS.test(text);
  return false;
}

// Short unprompted reports when the situation changes, rate-limited so the
// channel doesn't fill up with the same news.
const REPORT_GAP = 12;
const WOUNDED_GAP = 40;
function report(game, u, why) {
  const last = u.lastReport ?? { any: -99, wounded: -99 };
  if (game.tick - last.any < REPORT_GAP) return '';
  let say = '';
  if (why.spotted) {
    const e = game.unit(why.spotted);
    if (e) say = pick(u.lines.spotted).replace('{enemy}', `${e.id} ${e.name}`).replace('{dir}', dirName(u, e));
  } else if (why.wounded && game.tick - last.wounded >= WOUNDED_GAP) {
    say = pick(u.lines.wounded);
    last.wounded = game.tick;
  }
  if (say) last.any = game.tick;
  u.lastReport = last;
  return say;
}

// ---------- scheduler ----------
// Decides when each general thinks: on new orders, when the situation changes,
// and otherwise every `intervalTicks`. One request in flight per general.
export class Council {
  constructor(game, cfg = brainConfig(), opts = {}) {
    this.game = game;
    this.cfg = cfg;
    this.intervalTicks = opts.intervalTicks ?? 4;
    this.fetchImpl = opts.fetchImpl ?? ((...a) => fetch(...a));
    this.lastError = '';
    this.llmCalls = 0;
    this.llmFailures = 0;
    this.latencyMs = 0;
    this.prev = new Map();
    this.why = new Map();
    this.generation = 0;
    game.scriptedEnemies = !this.drivesEnemies;
  }

  get useLLM() {
    return this.cfg.mode !== 'heuristic' && !!this.cfg.apiKey;
  }

  // Whether the red side is also driven by the decision model.
  get drivesEnemies() {
    return this.useLLM && this.cfg.enemyBrain !== 'script';
  }

  resetState() {
    this.prev.clear();
    this.why.clear();
    this.generation++;
  }

  // Signals that warrant an immediate re-think.
  triggered(u) {
    const g = this.game;
    const hasNew = u.side === 'ally' && g.messages.some((m) => m.seq > u.lastSeenMsg && m.from === 'player' && (m.to === 'all' || m.to === u.id));
    const p = this.prev.get(u.id) || {};
    const visible = g.visibleFoes(u.side).map((e) => e.id).sort();
    const cur = { visible: visible.join(','), troopsBand: Math.floor(u.troops / (u.maxTroops * 0.2)), routing: u.routing };
    const arrived = u.action.type === 'move' && u.x === u.action.x && u.y === u.action.y;
    const first = p.visible === undefined;
    const why = this.why.get(u.id) || {};
    if (!first) {
      const spotted = visible.find((id) => !p.visible.split(',').includes(id) && dist(u, g.unit(id)) <= KINDS[u.kind].vision + 2);
      if (spotted) why.spotted = spotted;
      if (cur.troopsBand < p.troopsBand) why.wounded = true;
    }
    this.why.set(u.id, why);
    const changed = !first && (p.visible !== cur.visible || p.troopsBand !== cur.troopsBand || p.routing !== cur.routing);
    this.prev.set(u.id, cur);
    return hasNew || arrived || changed || g.tick - u.lastDecisionTick >= this.intervalTicks;
  }

  // Call once per tick. Fires off async decisions without blocking the loop.
  update() {
    const g = this.game;
    if (g.status !== 'playing') return;
    const units = this.drivesEnemies ? g.units.filter((u) => u.alive) : g.allies();
    for (const u of units) {
      if (u.thinking || !this.triggered(u)) continue;
      this.think(u);
    }
  }

  async think(u) {
    const g = this.game;
    const gen = this.generation;
    const seenUpTo = g.msgSeq;
    const why = this.why.get(u.id) || {};
    this.why.set(u.id, {});
    u.thinking = true;
    u.lastDecisionTick = g.tick; // avoid immediate re-trigger while in flight
    let decision, source;
    try {
      if (!this.useLLM) throw Object.assign(new Error(this.cfg.apiKey ? 'heuristic mode' : 'no API key configured'), { quiet: true });
      const { body, options, fresh } = buildRequest(g, u, this.cfg);
      this.llmCalls++;
      const t0 = Date.now();
      const answers = await callDecisions(this.cfg, body, this.fetchImpl);
      this.latencyMs = Date.now() - t0;
      decision = interpret(g, u, answers, options, fresh);
      if (!decision.say && u.side === 'ally') decision.say = report(g, u, why);
      source = 'llm';
      this.lastError = '';
    } catch (err) {
      if (!err.quiet) { this.llmFailures++; this.lastError = String(err.message || err); }
      if (this.cfg.mode === 'llm') {
        decision = { thought: `(decision model call failed: ${String(err.message || err).slice(0, 60)})` };
        source = 'error';
      } else if (u.side === 'enemy') {
        g.enemyAI(u);
        decision = { thought: '(scripted AI)', action: { ...u.action } };
        source = 'heuristic';
      } else {
        decision = heuristicDecision(g, u);
        source = 'heuristic';
      }
    }
    u.thinking = false;
    if (gen !== this.generation || !u.alive) return; // game was reset meanwhile
    u.lastSeenMsg = seenUpTo;
    g.applyDecision(u, decision, source);
  }

  status() {
    return {
      mode: this.cfg.mode,
      model: this.cfg.model,
      baseUrl: this.cfg.baseUrl,
      hasKey: !!this.cfg.apiKey,
      usingLLM: this.useLLM,
      images: this.cfg.images,
      enemies: this.drivesEnemies ? 'model' : 'script',
      llmCalls: this.llmCalls,
      llmFailures: this.llmFailures,
      latencyMs: this.latencyMs,
      lastError: this.lastError,
    };
  }
}
