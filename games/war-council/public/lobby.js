// Server transport with a lobby: play solo against the Red AI, create a 1v1
// match (as Blue or Red) and send the invite link, or join with a code. The
// chosen match is kept in the URL (?match=CODE) and the seat token in
// sessionStorage, so a reload puts you back in your seat.

const $ = (s) => document.querySelector(s);

const store = {
  get(code) { try { return sessionStorage.getItem('wc:' + code); } catch { return null; } },
  set(code, token) { try { sessionStorage.setItem('wc:' + code, token); } catch { /* private mode: no reload resume */ } },
};

let match = null; // { code, token, side, versus }
let callbacks = null;

async function api(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const matchApi = (action, body = {}) => api(`/api/matches/${match.code}/${action}`, { ...body, token: match.token });

// ---------- lobby screen ----------
const lobby = document.createElement('div');
lobby.id = 'lobby';
lobby.hidden = true;
lobby.innerHTML = `
  <div class="lobby-card" role="dialog" aria-labelledby="lobby-title">
    <div class="seal">W<br />C</div>
    <h2 id="lobby-title">War Council</h2>
    <p class="lede">Give orders in plain English. Your generals decide how to carry them out.</p>
    <div class="lobby-options">
      <section>
        <h3>Solo</h3>
        <p>Command Blue's three generals against the Red army.</p>
        <button type="button" class="lobby-btn primary" data-act="solo">Play solo</button>
      </section>
      <section>
        <h3>1v1 versus</h3>
        <p>One player commands Blue, the other commands Red. Each side sees only its own fog of war and war council.</p>
        <div class="lobby-row">
          <button type="button" class="lobby-btn primary" data-act="versus" data-side="ally">Create as Blue</button>
          <button type="button" class="lobby-btn" data-act="versus" data-side="enemy">Create as Red</button>
        </div>
      </section>
      <section>
        <h3>Join a match</h3>
        <form class="lobby-row" id="join-form">
          <input id="join-code" maxlength="5" autocomplete="off" placeholder="Match code" aria-label="Match code" />
          <button type="submit" class="lobby-btn">Join</button>
        </form>
      </section>
    </div>
    <p class="lobby-error" id="lobby-error" hidden></p>
  </div>`;
document.body.append(lobby);

const waiting = document.createElement('div');
waiting.id = 'waiting';
waiting.hidden = true;
waiting.innerHTML = `
  <div class="lobby-card">
    <h2>Waiting for your opponent</h2>
    <p class="lede">You command <b id="wait-side"></b>. Send this link to your opponent; they will command <b id="wait-other"></b>.</p>
    <div class="lobby-row">
      <input id="invite" readonly aria-label="Invite link" />
      <button type="button" class="lobby-btn primary" id="copy-invite">Copy link</button>
    </div>
    <p class="fine">Match code <b id="wait-code"></b>. The battle starts as soon as both commanders are connected, and pauses if either one leaves.</p>
  </div>`;
document.body.append(waiting);

function showError(msg) {
  const el = $('#lobby-error');
  el.textContent = msg;
  el.hidden = !msg;
}

lobby.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  btn.disabled = true;
  try {
    const m = await api('/api/matches', { mode: btn.dataset.act, side: btn.dataset.side });
    enter(m);
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
  }
});
$('#join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = $('#join-code').value.trim().toUpperCase();
  if (code) join(code);
});
$('#copy-invite').addEventListener('click', async () => {
  const input = $('#invite');
  try { await navigator.clipboard.writeText(input.value); $('#copy-invite').textContent = 'Copied'; } catch { input.select(); }
});

async function join(code) {
  try {
    const params = new URLSearchParams(location.search);
    enter(await api(`/api/matches/${code}/join`, { token: store.get(code), side: params.get('side') }));
  } catch (err) {
    lobby.hidden = false;
    showError(err.message);
  }
}

function enter(m) {
  match = m;
  store.set(m.code, m.token);
  const url = new URL(location.href);
  url.search = `?match=${m.code}`;
  history.replaceState(null, '', url);
  lobby.hidden = true;
  showError('');
  const es = new EventSource(`/api/matches/${m.code}/stream?token=${encodeURIComponent(m.token)}`);
  es.addEventListener('init', (e) => callbacks.onInit(JSON.parse(e.data)));
  es.onmessage = (e) => {
    const state = JSON.parse(e.data);
    renderWaiting(state.lobby);
    callbacks.onState(state);
  };
}

function renderWaiting(l) {
  waiting.hidden = !l?.waiting;
  if (!l?.waiting) return;
  const mine = l.side === 'ally' ? 'Blue' : 'Red';
  $('#wait-side').textContent = mine;
  $('#wait-other').textContent = mine === 'Blue' ? 'Red' : 'Blue';
  $('#wait-code').textContent = l.code;
  $('#invite').value = `${location.origin}${location.pathname}?match=${l.code}`;
}

window.WC_TRANSPORT = {
  connect(onInit, onState) {
    callbacks = { onInit, onState };
    const code = new URLSearchParams(location.search).get('match')?.toUpperCase();
    if (code) join(code);
    else lobby.hidden = false;
  },
  order: (to, text) => match && matchApi('order', { to, text }).catch((err) => alertNote(err.message)),
  pause: () => match && matchApi('pause'),
  reset: () => match && matchApi('reset').catch((err) => alertNote(err.message)),
  viewUrl: (id) => match && `/api/matches/${match.code}/view/${id}.png?token=${encodeURIComponent(match.token)}`,
};

function alertNote(msg) {
  const note = $('#note');
  if (!note) return;
  note.textContent = msg;
  note.hidden = false;
  setTimeout(() => { note.hidden = true; }, 4000);
}
