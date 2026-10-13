// Generals' brains, driven by SubQ's Decisions API (POST /v1/systemone).
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

import { KINDS, CAMP, BANNER, dist, dirName } from './engine.js';
import { renderView } from './render.js';

export function brainConfig(env = process.env) {
  return {
    mode: (env.BRAIN_MODE || 'auto').toLowerCase(), // llm | auto | heuristic
    baseUrl: (env.LLM_BASE_URL || 'https://api.subq.ai/v1').replace(/\/$/, ''),
    apiKey: env.LLM_API_KEY || env.SUBQ_API_KEY || '',
    model: env.LLM_MODEL || 'subq-snap-preview',
    timeoutMs: Number(env.LLM_TIMEOUT_MS || 15000),
    images: env.LLM_IMAGES !== '0',
  };
}

export const LANDMARKS = [
  { key: 'north_bridge', name: '北桥', x: 12, y: 3 },
  { key: 'mid_bridge', name: '中桥', x: 12, y: 8 },
  { key: 'south_bridge', name: '南桥', x: 12, y: 13 },
  { key: 'west_hill', name: '西岸山丘', x: 9, y: 6 },
  { key: 'southwest_hill', name: '西南山丘', x: 4, y: 12 },
  { key: 'west_village', name: '西岸村庄(补给)', x: 6, y: 8 },
  { key: 'east_village', name: '东岸村庄(补给)', x: 16, y: 3 },
  { key: 'east_forest', name: '东岸森林', x: 16, y: 10 },
  { key: 'east_hill', name: '东岸山丘', x: 19, y: 5 },
  { key: 'banner', name: '敌方帅旗', x: BANNER.x, y: BANNER.y },
];

// Coordinates the commander mentioned recently to this general.
function orderPoints(game, u) {
  const pts = [];
  const msgs = game.messages.filter((m) => m.from === 'player' && (m.to === 'all' || m.to === u.id)).slice(-3).reverse();
  for (const m of msgs) for (const c of m.text.matchAll(/\(?\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*\)?/g)) {
    const x = +c[1], y = +c[2];
    if (x < 24 && y < 16 && game.passable(x, y) && !pts.some((p) => p.x === x && p.y === y)) pts.push({ x, y });
    if (pts.length >= 4) return pts;
  }
  return pts;
}

// Builds the concrete options for the action question, each mapped to an engine action.
export function actionOptions(game, u) {
  const opts = [];
  const add = (key, desc, action, label) => opts.push({ key, desc, action, label });
  add('continue', `继续当前行动：${game.describeAction(u.action)}`, null, '继续');
  for (const e of game.visibleEnemies().sort((a, b) => dist(u, a) - dist(u, b)))
    add(`attack_${e.id}`, `进攻 ${e.id} ${e.name}（${KINDS[e.kind].label}，兵力约 ${Math.round(e.troops)}，距 ${dist(u, e)} 格，在${dirName(u, e)}方）`,
      { type: 'attack', target: e.id }, `攻${e.id}`);
  const points = orderPoints(game, u);
  const landmarkAt = (p) => LANDMARKS.find((l) => l.x === p.x && l.y === p.y);
  points.forEach((p, i) => {
    const l = landmarkAt(p);
    add(`order_point_${i + 1}`, `前往主公命令中提到的坐标 (${p.x},${p.y})${l ? '，即' + l.name : ''}`, { type: 'move', x: p.x, y: p.y }, l?.name ?? `(${p.x},${p.y})`);
  });
  for (const l of LANDMARKS) if (dist(u, l) > 0 && !points.some((p) => p.x === l.x && p.y === l.y))
    add(`go_${l.key}`, `行军至${l.name} (${l.x},${l.y})，距 ${dist(u, l)} 格`, { type: 'move', x: l.x, y: l.y }, l.name);
  for (const a of game.allies()) if (a !== u)
    add(`support_${a.id}`, `前去支援 ${a.name}（当前在 (${a.x},${a.y})）`, { type: 'move', x: a.x, y: a.y }, `援${a.name}`);
  add('hold', '原地驻守，攻击进入射程的敌人', { type: 'hold' }, '驻守');
  add('retreat', '撤回我方大营休整补给', { type: 'retreat' }, '撤退');
  return opts;
}

function newOrders(game, u) {
  return game.messages.filter((m) => m.from === 'player' && m.seq > u.lastSeenMsg && (m.to === 'all' || m.to === u.id));
}

export function buildRequest(game, u, cfg) {
  const options = actionOptions(game, u);
  const fresh = newOrders(game, u);
  const name = u.name;
  const questions = {
    action: {
      type: 'choice',
      instructions: `${name}接下来会怎么做？请完全代入${name}的性格、士气和对主公的羁绊，结合主公的最新命令（标记 [新] 的消息）、` +
        `图中和文字描述的战场形势（地形、敌我兵力、兵种克制、射程）做出判断。主公的命令通常会被执行，除非它明显违背${name}的性格或会让部队白白送死。`,
      criteria: Object.fromEntries(options.map((o) => [o.key, o.desc])),
    },
  };
  if (fresh.length) {
    const said = fresh.map((m) => `「${m.text}」`).join(' ');
    questions.obey = {
      type: 'noul',
      instructions: `主公刚刚说：${said}。${name}会照主公的意思去做吗？`,
      criteria: { true: `${name}领命执行`, false: `${name}心有异议，会拒绝或变通` },
    };
    questions.morale = {
      type: 'score',
      instructions: `主公刚刚说：${said}。这番话让${name}的士气（斗志）如何变化？考虑${name}的性格和语气、措辞带来的情绪。`,
      criteria: ['大幅下降', '略微下降', '基本不变', '略微上升', '大幅上升'],
    };
    questions.bond = {
      type: 'score',
      instructions: `主公刚刚说：${said}。这番话让${name}对主公的信任与亲近（羁绊）如何变化？`,
      criteria: ['大幅下降', '略微下降', '基本不变', '略微上升', '大幅上升'],
    };
  }
  const body = {
    model: cfg.model,
    state: `以下是将领${name}的人设（文中的“你”即${name}）：\n${u.persona}\n\n` +
      `附图是战场俯视图：蓝色圆点为我方将领（字母 A/B/C，黄色外圈的是${name}本人），红色圆点为敌军（数字为 E 编号），` +
      `暗色格为战争迷雾，深绿为森林，土黄为山丘，蓝色竖带为河流（只能从桥通过），左侧蓝格为我方大营，右侧红格为敌方帅旗。坐标标在上方和左侧。\n\n` +
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

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const scoreToDelta = (s) => (s && Number.isFinite(s.score) ? Math.round((s.score - 2) * 2.5) : 0);

// Turns the model's answers into a decision the engine can apply.
export function interpret(game, u, answers, options, fresh) {
  const ranked = Object.entries(answers.action.probabilities || {}).sort((a, b) => b[1] - a[1]);
  const chosen = options.find((o) => o.key === answers.action.choice) ?? options[0];
  const label = (k) => options.find((o) => o.key === k)?.label ?? k;
  const thought = ranked.slice(0, 3).map(([k, p]) => `${label(k)} ${Math.round(p * 100)}%`).join(' · ');
  const d = { thought, action: chosen.action, say: '' };
  const act = game.describeAction(chosen.action ?? u.action);
  if (fresh.length) {
    const morale = scoreToDelta(answers.morale);
    const bond = scoreToDelta(answers.bond);
    d.feeling = { morale, bond };
    const obey = answers.obey?.noul ?? 1;
    const lines = u.lines;
    // Only object out loud when the general actually does something other than what was asked.
    const objects = obey < 0.5 && !followsOrder(chosen, fresh);
    let say = (objects ? pick(lines.object) : pick(lines.ack)).replace('{act}', act);
    if (morale >= 3 || bond >= 3) say = pick(lines.cheered) + ' ' + say;
    else if (morale <= -3 || bond <= -3) say = pick(lines.hurt) + ' ' + say;
    d.say = say;
    d.thought += ` · 服从 ${Math.round(obey * 100)}%`;
  }
  return d;
}

// Whether the chosen option is what the commander's new message asked for.
function followsOrder(chosen, fresh) {
  const text = fresh.map((m) => m.text).join(' ');
  if (chosen.key.startsWith('order_point_')) return true;
  if (chosen.action?.type === 'attack') return text.toUpperCase().includes(chosen.action.target);
  if (chosen.key === 'retreat') return /撤|退|retreat/i.test(text);
  if (chosen.key === 'hold' || chosen.key === 'continue') return /守|驻|等|别动|hold|wait/i.test(text);
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

// ---------- rule-based fallback ----------
// Understands a handful of keywords so orders still do something offline.
export function heuristicDecision(game, u) {
  const order = newOrders(game, u).at(-1)?.text ?? '';
  const vis = game.visibleEnemies();
  const d = { thought: '（规则引擎）', say: '', action: null };

  const coord = order.match(/\(?\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*\)?/);
  const target = order.match(/E\s*([1-9])/i);
  const alive = target && game.unit('E' + target[1])?.alive;
  if (/撤|退|retreat|fall back/i.test(order)) d.action = { type: 'retreat' };
  else if (alive) d.action = { type: 'attack', target: 'E' + target[1] };
  else if (coord) d.action = { type: 'move', x: +coord[1], y: +coord[2] };
  else if (/守|驻|hold|stay|wait/i.test(order)) d.action = { type: 'hold' };
  else if (/旗|banner/i.test(order)) d.action = { type: 'move', ...BANNER };
  if (order) d.say = d.action ? `遵命：${game.describeAction(game.sanitizeAction(d.action) ?? { type: 'hold' })}` : '末将没听懂，请主公示下坐标或目标（如 E2、(10,5)）。';
  if (/好样|厉害|相信|辛苦|great|proud|trust/i.test(order)) d.feeling = { morale: 3, bond: 2 };
  if (/废物|蠢|滚|useless|idiot/i.test(order)) d.feeling = { morale: -3, bond: -4 };

  if (!d.action && !order) {
    // Idle autonomy: hit what is close by when strong enough, otherwise hold.
    const near = vis.filter((e) => dist(u, e) <= KINDS[u.kind].vision).sort((a, b) => dist(u, a) - dist(u, b))[0];
    if (u.troops < u.maxTroops * 0.35) d.action = { type: 'retreat' };
    else if (near && u.action.type === 'hold' && u.troops >= near.troops * 0.8) d.action = { type: 'attack', target: near.id };
    else if (u.action.type === 'retreat' && u.x === CAMP.x && u.y === CAMP.y) d.action = { type: 'hold' };
  }
  return d;
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
  }

  get useLLM() {
    return this.cfg.mode !== 'heuristic' && !!this.cfg.apiKey;
  }

  resetState() {
    this.prev.clear();
    this.why.clear();
    this.generation++;
  }

  // Signals that warrant an immediate re-think.
  triggered(u) {
    const g = this.game;
    const hasNew = g.messages.some((m) => m.seq > u.lastSeenMsg && m.from === 'player' && (m.to === 'all' || m.to === u.id));
    const p = this.prev.get(u.id) || {};
    const visible = g.visibleEnemies().map((e) => e.id).sort();
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
    for (const u of g.allies()) {
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
      if (!decision.say) decision.say = report(g, u, why);
      source = 'llm';
      this.lastError = '';
    } catch (err) {
      if (!err.quiet) { this.llmFailures++; this.lastError = String(err.message || err); }
      if (this.cfg.mode === 'llm') {
        decision = { thought: `（决策模型调用失败：${String(err.message || err).slice(0, 60)}）` };
        source = 'error';
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
      llmCalls: this.llmCalls,
      llmFailures: this.llmFailures,
      latencyMs: this.latencyMs,
      lastError: this.lastError,
    };
  }
}
