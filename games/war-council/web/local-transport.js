// Runs the battle inside the page and hands its state to the shared UI
// (public/app.js) through the same transport interface the server uses.

import { Game, W, H, GENERALS } from '../src/engine.js';
import { ClaudeCouncil } from './claude-council.js';

const TICK_MS = 1000;

const game = new Game();
const council = new ClaudeCouncil(game);
let paused = true; // the battle waits for "Begin battle"
let started = false;
let onStateCb = () => {};

function snapshot() {
  return { ...game.snapshot(), paused, tickMs: TICK_MS, brain: council.status() };
}
const push = () => onStateCb(snapshot());

setInterval(() => {
  if (!paused) game.step();
  push();
}, TICK_MS);

council.connect().then(push);

function begin() {
  started = true;
  paused = false;
  document.getElementById('intro').hidden = true;
  push();
}
document.getElementById('begin').addEventListener('click', begin);

window.WC_TRANSPORT = {
  connect(onInit, onState) {
    // Answer asynchronously, like the server's event stream, so the UI has
    // finished setting itself up first.
    setTimeout(() => {
      onStateCb = onState;
      onInit({ map: game.map, W, H, generals: GENERALS.map(({ persona, lines, ...g }) => g) });
      push();
    }, 0);
  },
  order(to, text) {
    if (!started) begin();
    const target = to === 'all' ? 'all' : game.unit(to)?.side === 'ally' ? to : null;
    if (!target || !text.trim()) return;
    game.say('player', 'Commander', target, text.trim().slice(0, 300));
    council.onOrder();
    push();
  },
  pause() {
    if (!started) return begin();
    paused = !paused;
    push();
  },
  reset() {
    game.reset();
    council.reset();
    paused = !started;
    push();
  },
};
