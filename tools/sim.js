// Headless match simulation: 10 bots play full 5v5 matches to catch errors and check pacing
// Usage: node tools/sim.js [matches=3] [difficulty=normal] [maxMinutes=20]
import { Game } from '../src/game.js';
import { HERO_LIST } from '../src/heroes.js';

const rounds = Number(process.argv[2]) || 3;
const difficulty = process.argv[3] || 'normal';
const maxMin = Number(process.argv[4]) || 20;
const DT = 1 / 30;
let failed = false;
for (let r = 0; r < rounds; r++) {
  const hero = HERO_LIST[(r * 7) % HERO_LIST.length].id;
  const g = new Game({ playerHero: hero, difficulty, auto: true }, null);
  let i = 0;
  const t0 = performance.now();
  try {
    for (; i < maxMin * 60 * 30 && !(g.winner !== null && g.endT > 1); i++) g.update(DT);
  } catch (e) {
    failed = true;
    console.error(`Match ${r + 1} crashed at ${(i * DT).toFixed(1)}s`, e);
    continue;
  }
  const ms = (performance.now() - t0) / i;
  const towers = [0, 1].map((tm) => g.towers.filter((t) => t.team === tm && !t.alive).length);
  const items = g.heroes.map((h) => h.items.length).join(',');
  const kda = g.heroes.map((h) => `${h.name}(${h.role}) ${h.stats.kills}/${h.stats.deaths}/${h.stats.assists}`).join(' | ');
  console.log(`Match ${r + 1} | winner: ${g.winner === null ? 'none' : g.winner === 0 ? 'Blue' : 'Red'} | ${(g.time / 60).toFixed(1)}min | score ${g.score.join(':')} | towers lost Blue ${towers[0]} Red ${towers[1]} | items ${items} | ${ms.toFixed(2)}ms/frame`);
  console.log('   ', kda);
}
process.exit(failed ? 1 : 0);
