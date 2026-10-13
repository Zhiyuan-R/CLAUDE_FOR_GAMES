// Generals' brains. Each general is driven by a language model through an
// OpenAI-compatible Chat Completions endpoint (SubQ by default). If the model
// can't be reached, an optional rule-based fallback keeps the game playable;
// every decision is tagged with its source so the UI never passes one off as
// the other.

import { KINDS, CAMP, BANNER, dist } from './engine.js';

export function brainConfig(env = process.env) {
  return {
    mode: (env.BRAIN_MODE || 'auto').toLowerCase(), // llm | auto | heuristic
    baseUrl: (env.LLM_BASE_URL || 'https://api.subq.ai/v1').replace(/\/$/, ''),
    apiKey: env.LLM_API_KEY || env.SUBQ_API_KEY || '',
    model: env.LLM_MODEL || 'subq-preview',
    timeoutMs: Number(env.LLM_TIMEOUT_MS || 25000),
    temperature: Number(env.LLM_TEMPERATURE || 0.8),
  };
}

const RULES = `
你是一场实时战棋战役中的一名将领，由主公（玩家）统率。战场每秒推进一回合，你每隔几秒或在局势变化时做一次决策。
你会收到：你的状态、带迷雾的战场 ASCII 地图、可见敌军、友军动向、战报和军议频道消息。

规则要点：
- 骑兵在平原冲锋伤害 ×1.5；在森林/山丘移动减速。步兵克骑兵 (×1.3)。弓兵射程 3，站在山丘射程 +1、视野 +2，但近战很弱。
- 森林防御 ×1.3，山丘 ×1.2，村庄 ×1.1 且可补给兵力和士气，我方大营也可补给。河流只能从桥 (12,3)(12,8)(12,13) 通过。
- 士气低于 15 部队会溃散自动撤退。士气越高伤害越高。
- 胜利：任一将领站上敌方帅旗 B(21,8) 且周围无敌兵，坚守 3 回合；或击溃所有敌军。失败：大营被占 3 回合、三将覆没、或超时。

你的决策方式：
- 主公的命令通常要执行，但你是有血有肉的将领，不是傀儡：按你的性格、士气和对主公的羁绊理解命令的意图。
  羁绊低于 30 时，你可以拒绝你不认同的命令并说明理由；明显送死的命令，你可以提出异议或变通。
- 主公的语气、情感会影响你：鼓舞、信任、赞美会提升士气/羁绊；辱骂、冷漠、不合理的苛责会降低它们。
  用 feeling 字段表达【新消息】对你的影响（只在有标记 [新] 的主公消息时给非零值）。
- 与同僚配合：可以在 say 中向主公汇报或向友军提出配合建议。没必要每次都说话，没有新情况时 say 留空。
- say 用主公使用的语言，口语化，符合你的人设，不超过 40 字。

只输出一个 JSON 对象，不要输出任何其他文字：
{"thought":"你的简短内心想法(<=40字)","say":"对军议频道说的话(可为空字符串)","to":"all 或 player 或友军ID",
 "action":{"type":"move","x":整数,"y":整数} 或 {"type":"attack","target":"E1"} 或 {"type":"hold"} 或 {"type":"retreat"},
 "feeling":{"morale":-5到5的整数,"bond":-5到5的整数}}
`.trim();

export function buildMessages(game, u) {
  return [
    { role: 'system', content: `${u.persona}\n\n${RULES}` },
    { role: 'user', content: game.perceive(u) + '\n\n现在做出你的决策（只输出 JSON）：' },
  ];
}

export function parseDecision(text) {
  if (!text) throw new Error('empty response');
  let s = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = s.indexOf('{');
  if (start < 0) throw new Error('no JSON object in response');
  // Find the matching closing brace of the first object.
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { end = i; break; }
  }
  if (end < 0) throw new Error('unterminated JSON object');
  const d = JSON.parse(s.slice(start, end + 1));
  if (typeof d !== 'object' || d === null) throw new Error('decision is not an object');
  return d;
}

export async function callLLM(cfg, messages, fetchImpl = fetch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages, temperature: cfg.temperature, max_tokens: 400 }),
      signal: ctrl.signal,
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    const json = JSON.parse(body);
    return json.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

// ---------- rule-based fallback ----------
// Understands a handful of keywords so orders still do something offline.
export function heuristicDecision(game, u) {
  const newOrders = game.messages.filter((m) => m.from === 'player' && m.seq > u.lastSeenMsg && (m.to === 'all' || m.to === u.id));
  const order = newOrders.at(-1)?.text ?? '';
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
    // Idle autonomy: hit what is in range or close by when strong enough, otherwise hold.
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
    this.intervalTicks = opts.intervalTicks ?? 6;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.lastError = '';
    this.llmCalls = 0;
    this.llmFailures = 0;
    this.prev = new Map();
    this.generation = 0;
  }

  get useLLM() {
    return this.cfg.mode !== 'heuristic' && !!this.cfg.apiKey;
  }

  resetState() {
    this.prev.clear();
    this.generation++;
  }

  // Signals that warrant an immediate re-think.
  triggered(u) {
    const g = this.game;
    const hasNew = g.messages.some((m) => m.seq > u.lastSeenMsg && m.from !== u.id && m.from !== 'system' && (m.to === 'all' || m.to === u.id || m.to === 'player'));
    const p = this.prev.get(u.id) || {};
    const visible = g.visibleEnemies().map((e) => e.id).sort().join(',');
    const cur = { visible, troopsBand: Math.floor(u.troops / (u.maxTroops * 0.2)), act: u.action.type, routing: u.routing };
    const arrived = u.action.type === 'move' && u.x === u.action.x && u.y === u.action.y;
    const changed = p.visible !== undefined && (p.visible !== cur.visible || p.troopsBand !== cur.troopsBand || p.routing !== cur.routing);
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
    u.thinking = true;
    u.lastDecisionTick = g.tick; // avoid immediate re-trigger while in flight
    let decision, source;
    try {
      if (!this.useLLM) throw Object.assign(new Error(this.cfg.apiKey ? 'heuristic mode' : 'no API key configured'), { quiet: true });
      this.llmCalls++;
      const text = await callLLM(this.cfg, buildMessages(g, u), this.fetchImpl);
      decision = parseDecision(text);
      source = 'llm';
      this.lastError = '';
    } catch (err) {
      if (!err.quiet) { this.llmFailures++; this.lastError = String(err.message || err); }
      if (this.cfg.mode === 'llm') {
        decision = { thought: `（大模型调用失败：${String(err.message || err).slice(0, 60)}）` };
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
      llmCalls: this.llmCalls,
      llmFailures: this.llmFailures,
      lastError: this.lastError,
    };
  }
}
