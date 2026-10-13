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
  cavalry: { label: '骑兵', speed: 2, atk: 1.3, def: 0.9, range: 1, vision: 5 },
  infantry: { label: '步兵', speed: 1, atk: 1.0, def: 1.25, range: 1, vision: 4 },
  archer: { label: '弓兵', speed: 1, atk: 0.85, def: 0.7, range: 3, vision: 6 },
};

const TERRAIN = {
  '.': { name: '平原', def: 1.0 },
  F: { name: '森林', def: 1.3 },
  H: { name: '山丘', def: 1.2 },
  '~': { name: '河流', def: 1.0 },
  '=': { name: '桥', def: 0.9 },
  V: { name: '村庄', def: 1.1 },
  C: { name: '我方大营', def: 1.2 },
  B: { name: '敌方帅旗', def: 1.2 },
};

export const GENERALS = [
  {
    id: 'A', name: '霍烈', title: '赤骥将军', kind: 'cavalry', x: 3, y: 6, troops: 300,
    lines: {
      ack: ['得令！{act}，看我的！', '好！{act}，谁也拦不住我！', '末将领命，{act}！'],
      object: ['主公，这也太憋屈了！末将要{act}！', '恕难从命——我要{act}！', '等？不等了，{act}！'],
      cheered: ['哈哈，主公瞧好吧！', '有主公这句话，霍烈死而无憾！'],
      hurt: ['……末将知道了。', '哼，那就让主公看看谁是废物！'],
      spotted: ['发现敌军 {enemy}，在我{dir}方！'],
      wounded: ['弟兄们折了不少，但还能打！'],
    },
    persona:
      '你是霍烈，年轻气盛的骑兵将军。你渴望荣耀，喜欢冲锋陷阵，讨厌撤退和等待。' +
      '主公的赞美会让你热血沸腾；被冷落或被骂胆小会让你赌气。你说话豪爽、短促，偶尔夸口。' +
      '你知道骑兵在平原冲锋最强，在森林和山丘施展不开，正面撞上列阵的步兵会吃亏。',
  },
  {
    id: 'B', name: '苏璃', title: '青鸾军师', kind: 'archer', x: 3, y: 10, troops: 250,
    lines: {
      ack: ['明白，{act}。', '收到。{act}，我会保持距离。', '好，{act}，请友军注意配合。'],
      object: ['主公，此令风险太大。我建议改为{act}。', '恕我直言，那样会白白折损兵力——我先{act}。'],
      cheered: ['谢主公信任，苏璃必不负所托。', '……多谢。我会更谨慎些。'],
      hurt: ['主公息怒，战局需要冷静。', '我会证明我的判断。'],
      spotted: ['斥候回报：{enemy} 位于{dir}方，请诸将留意。'],
      wounded: ['弓手伤亡较重，需要掩护。'],
    },
    persona:
      '你是苏璃，冷静的弓兵统领兼军师。你重视情报和地形，喜欢站在山丘或森林里远程压制。' +
      '如果主公的命令明显会让部队白白送死，你会礼貌但坚定地指出问题并给出替代方案。' +
      '你说话简洁、有条理，常常给同僚提出配合建议。弓兵近身很脆弱，你会尽量保持距离。',
  },
  {
    id: 'C', name: '老秦', title: '玄甲老将', kind: 'infantry', x: 4, y: 8, troops: 400,
    lines: {
      ack: ['好嘞，{act}。', '老秦明白，{act}，主公放心。', '得令，弟兄们，{act}！'],
      object: ['主公，这么打弟兄们要白死的。老秦先{act}。', '不成不成，我看还是{act}稳妥。'],
      cheered: ['嘿，主公这话说得老秦心里热乎。', '有主公在，弟兄们腰杆硬！'],
      hurt: ['……老秦打了一辈子仗，主公说话也得讲点理。', '行，老秦记下了。'],
      spotted: ['{enemy} 在我{dir}边，都别慌。'],
      wounded: ['伤了不少弟兄，可这阵地还在老秦手里。'],
    },
    persona:
      '你是老秦，身经百战的重步兵老将。你对主公忠诚，但心疼手下的兵，不愿打无谓的消耗战。' +
      '你说话粗犷、务实，偶尔带点长辈式的唠叨。你擅长守住要道（桥、村庄、森林），' +
      '在森林里防守尤其顽强，也愿意替年轻将领挡刀。',
  },
];

const ENEMIES = [
  { id: 'E1', name: '帅旗卫队', kind: 'infantry', x: 21, y: 8, troops: 320, role: 'guard', post: { x: 21, y: 8 }, leash: 3 },
  { id: 'E2', name: '山丘弓手', kind: 'archer', x: 19, y: 5, troops: 200, role: 'guard', post: { x: 19, y: 5 }, leash: 2 },
  { id: 'E3', name: '游骑', kind: 'cavalry', x: 18, y: 12, troops: 240, role: 'hunter', post: { x: 18, y: 12 }, leash: 8 },
  { id: 'E4', name: '巡桥队', kind: 'infantry', x: 14, y: 8, troops: 260, role: 'patrol',
    waypoints: [{ x: 13, y: 3 }, { x: 13, y: 8 }, { x: 13, y: 13 }, { x: 13, y: 8 }], leash: 4 },
  { id: 'E5', name: '南营守备', kind: 'infantry', x: 20, y: 11, troops: 230, role: 'guard', post: { x: 20, y: 11 }, leash: 3 },
];

export const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function dirName(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (dx === 0 && dy === 0) return '原地';
  const ns = dy < 0 ? '北' : dy > 0 ? '南' : '';
  const ew = dx > 0 ? '东' : dx < 0 ? '西' : '';
  if (Math.abs(dx) > 2 * Math.abs(dy)) return ew;
  if (Math.abs(dy) > 2 * Math.abs(dx)) return ns;
  return ew + ns;
}

export class Game {
  constructor(opts = {}) {
    this.maxTicks = opts.maxTicks ?? 900;
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
        routing: false, alive: true, wp: 0,
      })),
    ];
    this.msgSeq = 0;
    this.say('system', '系统', 'all',
      '战役开始。目标：攻占敌方帅旗 (21,8) 并守住 3 回合，或击溃全部敌军。别让敌军占领我方大营 (2,8)。');
  }

  // ---------- helpers ----------
  unit(id) { return this.units.find((u) => u.id === id); }
  allies() { return this.units.filter((u) => u.side === 'ally' && u.alive); }
  enemies() { return this.units.filter((u) => u.side === 'enemy' && u.alive); }
  terrainAt(x, y) { return this.map[y]?.[x]; }
  passable(x, y) { const t = this.terrainAt(x, y); return t !== undefined && t !== '~'; }
  occupant(x, y) { return this.units.find((u) => u.alive && u.x === x && u.y === y); }

  log(text) {
    this.events.push({ seq: ++this.evSeq, tick: this.tick, text });
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

  // Cells currently seen by the allied side.
  visibleSet() {
    const seen = new Set();
    for (const a of this.allies()) {
      const r = this.visionOf(a);
      for (let y = a.y - r; y <= a.y + r; y++)
        for (let x = a.x - r; x <= a.x + r; x++)
          if (x >= 0 && y >= 0 && x < W && y < H) seen.add(x + ',' + y);
    }
    return seen;
  }

  visibleEnemies() {
    const seen = this.visibleSet();
    return this.enemies().filter((e) => seen.has(e.x + ',' + e.y));
  }

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
    u.lastDecisionTick = this.tick;
    if (d.feeling) {
      const clamp = (v) => Math.max(-8, Math.min(8, Number(v) || 0));
      u.morale = Math.max(0, Math.min(100, u.morale + clamp(d.feeling.morale)));
      u.bond = Math.max(0, Math.min(100, u.bond + clamp(d.feeling.bond)));
    }
    const a = this.sanitizeAction(d.action);
    if (a && !u.routing) {
      const changed = JSON.stringify(a) !== JSON.stringify(u.action);
      u.action = a;
      if (changed) this.log(`${u.name} → ${this.describeAction(a)}`);
    }
    if (d.say && String(d.say).trim()) this.say(u.id, u.name, d.to || 'all', String(d.say).trim().slice(0, 240), source);
  }

  sanitizeAction(a) {
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
      if (t && t.side === 'enemy' && t.alive) return { type: 'attack', target: t.id };
      return null;
    }
    if (type === 'hold') return { type: 'hold' };
    if (type === 'retreat') return { type: 'retreat' };
    return null;
  }

  describeAction(a) {
    switch (a.type) {
      case 'move': return `行军至 (${a.x},${a.y})`;
      case 'attack': { const t = this.unit(a.target); return `进攻 ${a.target}${t ? ' ' + t.name : ''}`; }
      case 'retreat': return '撤回大营';
      default: return '原地驻守';
    }
  }

  // ---------- perception (the text a general "sees") ----------
  asciiMap(viewer) {
    const seen = this.visibleSet();
    const rows = [];
    rows.push('    ' + Array.from({ length: W }, (_, x) => (x % 10)).join(''));
    for (let y = 0; y < H; y++) {
      let row = '';
      for (let x = 0; x < W; x++) {
        const u = this.occupant(x, y);
        if (u && u.side === 'ally') row += u === viewer ? '@' : u.id;
        else if (u && seen.has(x + ',' + y)) row += u.id.slice(1);
        else if (!seen.has(x + ',' + y) && !'CB~='.includes(this.map[y][x])) row += '?';
        else row += this.map[y][x];
      }
      rows.push(String(y).padStart(3) + ' ' + row);
    }
    return rows.join('\n');
  }

  perceive(u) {
    const k = KINDS[u.kind];
    const t = TERRAIN[this.terrainAt(u.x, u.y)];
    const lines = [];
    lines.push(`【第 ${this.tick} 回合】(每回合约 1 秒)`);
    lines.push(`你：${u.id} ${u.name}（${k.label}），位置 (${u.x},${u.y}) ${t.name}，兵力 ${Math.round(u.troops)}/${u.maxTroops}，士气 ${Math.round(u.morale)}，对主公的羁绊 ${Math.round(u.bond)}。`);
    lines.push(`当前行动：${this.describeAction(u.action)}${u.routing ? '（部队溃散中，正在撤退！）' : ''}。攻击射程 ${this.rangeOf(u)}，视野 ${this.visionOf(u)}。`);
    lines.push('');
    lines.push('地图（x 向右 0-23，y 向下 0-15；@=你，A/B/C=友军将领，数字=敌军 E编号，?=迷雾）：');
    lines.push('图例：.平原 F森林 H山丘 ~河(不可通行) =桥 V村庄(补给) C我方大营 B敌方帅旗');
    lines.push(this.asciiMap(u));
    lines.push('');
    const vis = this.visibleEnemies();
    if (vis.length) {
      lines.push('可见敌军：');
      for (const e of vis.sort((a, b) => dist(u, a) - dist(u, b))) {
        lines.push(`- ${e.id} ${e.name}（${KINDS[e.kind].label}）(${e.x},${e.y}) ${TERRAIN[this.terrainAt(e.x, e.y)].name}，兵力约 ${Math.round(e.troops)}，距你 ${dist(u, e)} 格，方向 ${dirName(u, e)}${e.routing ? '，正在溃逃' : ''}`);
      }
    } else lines.push('目前看不到任何敌军。');
    const others = this.allies().filter((a) => a !== u);
    if (others.length) {
      lines.push('友军将领：');
      for (const a of others) lines.push(`- ${a.id} ${a.name}（${KINDS[a.kind].label}）(${a.x},${a.y})，兵力 ${Math.round(a.troops)}，士气 ${Math.round(a.morale)}，${this.describeAction(a.action)}`);
    }
    const fallen = this.units.filter((x) => x.side === 'ally' && !x.alive);
    if (fallen.length) lines.push('已阵亡/覆灭：' + fallen.map((f) => f.name).join('、'));
    const evs = this.events.slice(-8);
    if (evs.length) {
      lines.push('');
      lines.push('最近战报：');
      for (const e of evs) lines.push(`- [${e.tick}] ${e.text}`);
    }
    const msgs = this.messages.filter((m) => m.to === 'all' || m.to === u.id || m.from === u.id).slice(-10);
    lines.push('');
    lines.push('军议频道（最近消息）：');
    for (const m of msgs) {
      const isNew = m.seq > u.lastSeenMsg && m.from !== u.id;
      const to = m.to === 'all' ? '众将' : (this.unit(m.to)?.name ?? m.to);
      lines.push(`${isNew ? '[新] ' : ''}[${m.tick}] ${m.name} → ${to}：${m.text}`);
    }
    return lines.join('\n');
  }

  // ---------- simulation ----------
  step() {
    if (this.status !== 'playing') return;
    this.tick++;
    const all = this.units.filter((u) => u.alive);

    for (const e of this.enemies()) this.enemyAI(e);

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
      if (Math.floor(before / 50) !== Math.floor(t.troops / 50) && t.side === 'ally')
        this.log(`${t.name} 遭到攻击，兵力降至 ${Math.round(t.troops)}`);
    }

    // Recovery, rout, death
    for (const u of all) {
      if (!u.alive) continue;
      if (u.troops < 1) {
        u.alive = false;
        this.log(`${u.side === 'ally' ? '我方' : '敌方'} ${u.name}（${u.id}）全军覆没！`);
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
        this.log(`${u.name} 士气崩溃，部队溃散撤退！`);
      } else if (u.routing && u.morale > 40) {
        u.routing = false;
        u.action = { type: 'hold' };
        this.log(`${u.name} 重整旗鼓，恢复作战。`);
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
      if (this.bannerHold === 1) this.log(`${onBanner.name} 冲上了敌方帅旗！再坚守 2 回合即可夺旗！`);
    } else this.bannerHold = 0;
    const onCamp = this.occupant(CAMP.x, CAMP.y);
    if (onCamp?.side === 'enemy') {
      this.campLost++;
      if (this.campLost === 1) this.log(`警报！敌军 ${onCamp.name} 闯入我方大营！`);
    } else this.campLost = 0;

    const fighting = (u) => u.alive && !u.routing;
    if (this.bannerHold >= 3) this.end('won', '帅旗易主——我军夺取敌方帅旗，大获全胜！');
    else if (!this.enemies().some(fighting)) this.end('won', '敌军已被全部击溃，大获全胜！');
    else if (!this.allies().length) this.end('lost', '我军三将全部覆没……');
    else if (this.campLost >= 3) this.end('lost', '大营失守，全军败退……');
    else if (this.tick >= this.maxTicks) this.end('lost', '战事拖延过久，粮草耗尽，被迫撤军。');
  }

  end(status, text) {
    this.status = status;
    this.result = text;
    this.log(text);
    this.say('system', '系统', 'all', text);
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
        .map((u) => ({
          id: u.id, name: u.name, title: u.title, side: u.side, kind: u.kind, x: u.x, y: u.y,
          troops: Math.round(u.troops), maxTroops: u.maxTroops, morale: Math.round(u.morale),
          bond: u.bond !== undefined ? Math.round(u.bond) : undefined, alive: u.alive, routing: u.routing,
          action: u.action, thought: u.thought, thinking: u.thinking, brainSource: u.brainSource,
        })),
      events: this.events.slice(-40),
      messages: this.messages.slice(-80),
    };
  }
}
