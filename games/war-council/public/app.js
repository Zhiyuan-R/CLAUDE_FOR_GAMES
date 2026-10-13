const CELL = 32;
const TERRAIN_COLOR = {
  '.': '#5d6b3a', F: '#2f4a25', H: '#7a6a45', '~': '#2c4f6e', '=': '#8a6d43',
  V: '#9a7f4f', C: '#3c5f8a', B: '#8a3c3c',
};
const KIND_GLYPH = { cavalry: '骑', infantry: '步', archer: '弓' };

const $ = (s) => document.querySelector(s);
const canvas = $('#map');
const ctx = canvas.getContext('2d');
let init = null;
let state = null;

const es = new EventSource('/api/stream');
es.addEventListener('init', (e) => { init = JSON.parse(e.data); });
es.onmessage = (e) => { state = JSON.parse(e.data); render(); };

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function drawMap() {
  const { map, W, H } = init;
  const seen = state.seen ? new Set(state.seen) : null;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = map[y][x];
    ctx.fillStyle = TERRAIN_COLOR[t] || '#555';
    ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = { F: '林', H: '丘', V: '村', C: '营', B: '旗', '=': '桥' }[t];
    if (label) ctx.fillText(label, x * CELL + CELL / 2, y * CELL + CELL / 2);
    if (seen && !seen.has(x + ',' + y)) {
      ctx.fillStyle = 'rgba(10,8,5,.55)';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,.18)';
  for (let x = 0; x <= W; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H * CELL); ctx.stroke(); }
  for (let y = 0; y <= H; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W * CELL, y * CELL); ctx.stroke(); }
}

function center(u) { return [u.x * CELL + CELL / 2, u.y * CELL + CELL / 2]; }

function drawUnits() {
  const byId = Object.fromEntries(state.units.map((u) => [u.id, u]));
  for (const u of state.units) {
    if (!u.alive || u.side !== 'ally') continue;
    let to = null;
    if (u.action.type === 'move') to = [u.action.x * CELL + CELL / 2, u.action.y * CELL + CELL / 2];
    if (u.action.type === 'attack' && byId[u.action.target]) to = center(byId[u.action.target]);
    if (u.action.type === 'retreat') to = [2 * CELL + CELL / 2, 8 * CELL + CELL / 2];
    if (!to) continue;
    ctx.strokeStyle = u.action.type === 'attack' ? 'rgba(255,120,100,.8)' : 'rgba(150,200,255,.7)';
    ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(...center(u)); ctx.lineTo(...to); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 1;
  }
  for (const u of state.units) {
    if (!u.alive) continue;
    const [cx, cy] = center(u);
    ctx.fillStyle = u.side === 'ally' ? '#4fa3e0' : '#e0574f';
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    if (u.routing) { ctx.strokeStyle = '#ffd'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(u.id, cx, cy - 1);
    ctx.font = '9px sans-serif';
    ctx.fillText(KIND_GLYPH[u.kind], cx + 12, cy - 11);
    const w = 26, frac = u.troops / u.maxTroops;
    ctx.fillStyle = '#000'; ctx.fillRect(cx - w / 2, cy + 12, w, 3);
    ctx.fillStyle = frac > .5 ? '#6cc070' : frac > .25 ? '#d9a441' : '#e0574f';
    ctx.fillRect(cx - w / 2, cy + 12, w * frac, 3);
  }
}

function bar(label, v, max, color) {
  return `<span>${label}</span><div class="bar"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%;background:${color}"></i></div><span>${v}</span>`;
}

const SRC = { llm: '大模型', heuristic: '规则后备', error: '调用失败' };

function renderGenerals() {
  const html = state.units.filter((u) => u.side === 'ally').map((u) => `
    <div class="gen ${u.alive ? '' : 'dead'}">
      <div class="top">
        <span class="name"><b>${u.id}</b> ${esc(u.title)} · ${esc(u.name)} <span class="act">${KIND_GLYPH[u.kind]}兵 (${u.x},${u.y})</span></span>
        ${u.brainSource ? `<span class="src ${u.brainSource}">${SRC[u.brainSource] || u.brainSource}</span>` : ''}
      </div>
      <div class="bars">
        ${bar('兵力', u.troops, u.maxTroops, '#6cc070')}
        ${bar('士气', u.morale, 100, '#d9a441')}
        ${bar('羁绊', u.bond, 100, '#c77dd9')}
      </div>
      <div class="act">${!u.alive ? '已覆灭' : u.routing ? '溃散撤退中' : esc(describe(u.action))}</div>
      <div class="thought ${u.thinking ? 'thinking' : ''}">${u.thought ? '“' + esc(u.thought) + '”' : ''}</div>
    </div>`).join('');
  $('#generals').innerHTML = html;
}

function describe(a) {
  if (a.type === 'move') return `行军至 (${a.x},${a.y})`;
  if (a.type === 'attack') return `进攻 ${a.target}`;
  if (a.type === 'retreat') return '撤回大营';
  return '原地驻守';
}

let lastMsgSeq = -1;
function renderChat() {
  const msgs = state.messages;
  const last = msgs.at(-1)?.seq ?? 0;
  if (last === lastMsgSeq) return;
  lastMsgSeq = last;
  const chat = $('#chat');
  const atBottom = chat.scrollTop + chat.clientHeight >= chat.scrollHeight - 30;
  const nameOf = (id) => (id === 'all' ? '众将' : id === 'player' ? '主公' : state.units.find((u) => u.id === id)?.name ?? id);
  chat.innerHTML = msgs.map((m) => `
    <div class="msg ${m.from === 'player' ? 'player' : m.from === 'system' ? 'system' : ''}">
      <span class="t">[${m.tick}]</span>
      <span class="who ${m.from !== 'player' && m.from !== 'system' ? 'gen-who' : ''}">${esc(m.name)}</span>
      ${m.to !== 'all' ? `<span class="t">→ ${esc(nameOf(m.to))}</span>` : ''}：${esc(m.text)}
      ${m.source && m.source !== 'llm' ? `<span class="src ${m.source}">${SRC[m.source]}</span>` : ''}
    </div>`).join('');
  if (atBottom) chat.scrollTop = chat.scrollHeight;
}

function render() {
  if (!init || !state) return;
  drawMap();
  drawUnits();
  renderGenerals();
  renderChat();
  $('#tick').textContent = `回合 ${state.tick}/${state.maxTicks}${state.paused ? '（暂停）' : ''}`;
  $('#pause').textContent = state.paused ? '继续' : '暂停';
  const b = state.brain;
  const brain = $('#brain');
  brain.className = 'badge ' + (b.usingLLM && !b.lastError ? 'llm' : 'fallback');
  brain.textContent = b.usingLLM
    ? `🧠 ${b.model}${b.lastError ? ' · 调用异常' : ''}`
    : `⚙ 规则后备（${b.hasKey ? b.mode : '未配置 API Key'}）`;
  brain.title = b.lastError || `${b.baseUrl} · 调用 ${b.llmCalls} 次，失败 ${b.llmFailures} 次`;
  $('#events').innerHTML = state.events.slice().reverse().map((e) => `<div>[${e.tick}] ${esc(e.text)}</div>`).join('');
  const banner = $('#banner');
  banner.hidden = state.status === 'playing';
  banner.textContent = state.result;
}

canvas.addEventListener('click', (ev) => {
  if (!state) return;
  const r = canvas.getBoundingClientRect();
  const x = Math.floor(((ev.clientX - r.left) / r.width) * init.W);
  const y = Math.floor(((ev.clientY - r.top) / r.height) * init.H);
  const u = state.units.find((u) => u.alive && u.x === x && u.y === y);
  const input = $('#text');
  const token = u && u.side === 'enemy' ? u.id : `(${x},${y})`;
  if (u && u.side === 'ally') $('#to').value = u.id;
  else input.value = (input.value ? input.value.trimEnd() + ' ' : '') + token;
  input.focus();
});

$('#order').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const text = $('#text').value.trim();
  if (!text) return;
  $('#text').value = '';
  await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: $('#to').value, text }) });
});
$('#pause').onclick = () => fetch('/api/pause', { method: 'POST' });
$('#reset').onclick = () => { if (confirm('重新开始这场战役？')) fetch('/api/reset', { method: 'POST' }); };
