// 无界面对局模拟：10 名 AI 打完整局 5v5，用于检查逻辑错误与节奏
// 用法：node tools/sim.js [局数=3] [难度=normal] [最长分钟=20]
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
    console.error(`第 ${r + 1} 局，第 ${(i * DT).toFixed(1)}s 报错`, e);
    continue;
  }
  const ms = (performance.now() - t0) / i;
  const towers = [0, 1].map((tm) => g.towers.filter((t) => t.team === tm && !t.alive).length);
  const items = g.heroes.map((h) => h.items.length).join(',');
  const kda = g.heroes.map((h) => `${h.name}(${h.role}) ${h.stats.kills}/${h.stats.deaths}/${h.stats.assists}`).join(' | ');
  console.log(`第 ${r + 1} 局 | 胜者: ${g.winner === null ? '未分胜负' : g.winner === 0 ? '蓝方' : '红方'} | ${(g.time / 60).toFixed(1)}min | 比分 ${g.score.join(':')} | 被拆塔 蓝${towers[0]} 红${towers[1]} | 装备数 ${items} | ${ms.toFixed(2)}ms/帧`);
  console.log('   ', kda);
}
process.exit(failed ? 1 : 0);
