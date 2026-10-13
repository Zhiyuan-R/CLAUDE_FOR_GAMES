// Sends one real general's perception + battlefield image to the decision
// model and prints the answers and how they'd be interpreted. Use it to
// verify the API key, endpoint and model.
//   node check-llm.js [--save view.png]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from './src/engine.js';
import { brainConfig, buildRequest, callDecisions, interpret } from './src/brain.js';
import { loadEnv } from './src/env.js';
import { relaunchWithProxy } from './src/proxy.js';

if (!relaunchWithProxy()) await main();

async function main() {
  loadEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'));
  const cfg = brainConfig();
  if (!cfg.apiKey) { console.error('No LLM_API_KEY set (see .env.example).'); process.exit(1); }
  const game = new Game();
  game.say('player', 'Commander', 'A', 'Huo Lie, you are the general I trust most! Swing around through the north bridge (12,3) and see what the enemy has on the east bank.');
  const u = game.unit('A');
  const { body, options, fresh } = buildRequest(game, u, cfg);
  const save = process.argv.indexOf('--save');
  if (save > 0 && body.images) fs.writeFileSync(process.argv[save + 1], Buffer.from(body.images[0].base64, 'base64'));
  console.log(`POST ${cfg.baseUrl}/systemone model=${cfg.model} images=${body.images?.length ?? 0} options=${options.length} questions=${Object.keys(body.questions).join(',')}`);
  const t0 = Date.now();
  try {
    const answers = await callDecisions(cfg, body);
    console.log(`--- answers (${Date.now() - t0} ms) ---\n${JSON.stringify(answers, null, 2)}`);
    const d = interpret(game, u, answers, options, fresh);
    console.log('--- interpreted ---');
    console.log(`action: ${game.describeAction(d.action ?? u.action)}\nthought: ${d.thought}\nfeeling: ${JSON.stringify(d.feeling)}\nsay: ${d.say}`);
  } catch (err) {
    console.error('Decision call failed:', err.message);
    process.exit(1);
  }
}
