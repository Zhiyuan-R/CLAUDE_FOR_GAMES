// Headless battle runner: plays a scripted sequence of commander orders
// against the simulation and prints the council chat and battle log.
//   node cli.js                      # uses BRAIN_MODE / LLM_* from env or .env
//   node cli.js --ticks 300 --fast   # don't wait for real time between ticks
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from './src/engine.js';
import { Council, brainConfig } from './src/brain.js';
import { loadEnv } from './src/env.js';

loadEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'));

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const ticks = Number(opt('--ticks', 400));
const fast = args.includes('--fast');
const tickMs = fast ? 0 : Number(process.env.TICK_MS || 1000);

const SCRIPT = [
  [1, 'all', '诸位将军，敌军帅旗在河东 (21,8)。老秦守中桥 (12,8)，苏璃去山丘 (9,6) 掩护，霍烈先别冲动，等我号令。'],
  [25, 'B', '苏璃，过中桥后去 (16,5) 附近压制山丘上的 E2 弓手。'],
  [30, 'C', '老秦，带兵过中桥，挡住巡桥的 E4，你是全军的定海神针。'],
  [60, 'A', '霍烈！从北桥 (12,3) 绕过去，冲击 E2 弓手的侧翼，此战首功归你！'],
  [130, 'all', '干得漂亮！全军压上，目标帅旗 (21,8)！'],
];

const game = new Game();
const council = new Council(game, brainConfig());
console.log('Brain:', council.status());

let printedMsg = 0, printedEv = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let t = 0; t < ticks && game.status === 'playing'; t++) {
  for (const [at, to, text] of SCRIPT) if (game.tick === at) game.say('player', '主公', to, text);
  game.step();
  council.update();
  // In fast mode give in-flight LLM calls a chance to land before the next tick.
  if (fast && council.useLLM) while (game.allies().some((u) => u.thinking)) await sleep(50);
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
while (game.allies().some((u) => u.thinking)) await sleep(50);
console.log('\n=== Result ===');
console.log(game.status, game.result || `(stopped at tick ${game.tick})`);
for (const u of game.units) console.log(`${u.side.padEnd(5)} ${u.id} ${u.name} troops=${Math.round(u.troops)} morale=${Math.round(u.morale)} ${u.alive ? '' : 'DEAD'} ${u.thought ? '“' + u.thought + '”' : ''}`);
console.log('LLM:', council.status());
process.exit(0);
