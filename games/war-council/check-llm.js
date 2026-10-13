// Sends one real general's perception to the configured model and prints the
// raw reply and the parsed decision. Use it to verify the API key/endpoint.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from './src/engine.js';
import { brainConfig, buildMessages, callLLM, parseDecision } from './src/brain.js';
import { loadEnv } from './src/env.js';

loadEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'));
const cfg = brainConfig();
if (!cfg.apiKey) { console.error('No LLM_API_KEY set (see .env.example).'); process.exit(1); }
const game = new Game();
game.say('player', '主公', 'all', '霍烈，从北桥 (12,3) 绕过去，看看敌人在河东布置了什么。');
const u = game.unit('A');
console.log(`POST ${cfg.baseUrl}/chat/completions model=${cfg.model}`);
const t0 = Date.now();
try {
  const text = await callLLM(cfg, buildMessages(game, u));
  console.log(`--- raw reply (${Date.now() - t0} ms) ---\n${text}`);
  console.log('--- parsed ---', parseDecision(text));
} catch (err) {
  console.error('LLM call failed:', err.message);
  process.exit(1);
}
