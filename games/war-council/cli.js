// Headless battle runner: plays a scripted sequence of commander orders
// against the simulation and prints the council chat and battle log.
//   node cli.js                      # uses BRAIN_MODE / LLM_* from env or .env
//   node cli.js --ticks 300 --fast   # don't wait for real time between ticks
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from './src/engine.js';
import { Council, brainConfig } from './src/brain.js';
import { loadEnv } from './src/env.js';
import { relaunchWithProxy } from './src/proxy.js';

if (!relaunchWithProxy()) await main();

async function main() {
  loadEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'));

  const args = process.argv.slice(2);
  const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
  const ticks = Number(opt('--ticks', 400));
  const fast = args.includes('--fast');
  const tickMs = fast ? 0 : Number(process.env.TICK_MS || 1000);

  const SCRIPT = [
    [1, 'all', 'Generals, the Red banner is on the east bank at (21,8). Old Qin, hold the middle bridge (12,8). Su Li, cover us from the hill at (9,6). Huo Lie, no heroics yet — wait for my signal.'],
    [25, 'B', 'Su Li, once across the middle bridge, move near (16,5) and suppress the E2 archers on the hill.'],
    [30, 'C', 'Old Qin, lead your men over the middle bridge and stop the E4 bridge patrol. You are the rock this army stands on.'],
    [60, 'A', 'Huo Lie! Swing around through the north bridge (12,3) and hit the E2 archers in the flank. The glory of this battle is yours!'],
    [130, 'all', 'Well done, all of you! Everyone push forward — take the banner at (21,8)!'],
  ];

  const game = new Game();
  const council = new Council(game, brainConfig());
  console.log('Brain:', council.status());

  let printedMsg = 0, printedEv = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let t = 0; t < ticks && game.status === 'playing'; t++) {
    for (const [at, to, text] of SCRIPT) if (game.tick === at) game.say('player', 'Commander', to, text);
    game.step();
    council.update();
    // In fast mode give in-flight LLM calls a chance to land before the next tick.
    if (fast && council.useLLM) while (game.units.some((u) => u.thinking)) await sleep(50);
    else await sleep(tickMs);
    for (const m of game.messages.filter((m) => m.seq > printedMsg)) {
      console.log(`💬 [${m.tick}] ${m.name}${m.to !== 'all' ? ' → ' + m.to : ''}: ${m.text}${m.source && m.source !== 'llm' ? ` (${m.source})` : ''}`);
      printedMsg = m.seq;
    }
    for (const e of game.events.filter((e) => e.seq > printedEv)) {
      console.log(`   [${e.tick}] ${e.text}`);
      printedEv = e.seq;
    }
  }
  while (game.units.some((u) => u.thinking)) await sleep(50);
  console.log('\n=== Result ===');
  console.log(game.status, game.result || `(stopped at tick ${game.tick})`);
  for (const u of game.units) console.log(`${u.side.padEnd(5)} ${u.id} ${u.name} troops=${Math.round(u.troops)} morale=${Math.round(u.morale)} ${u.alive ? '' : 'DEAD'} ${u.thought ? '“' + u.thought + '”' : ''}`);
  console.log('LLM:', council.status());
  process.exit(0);
}
