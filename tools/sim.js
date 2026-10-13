// 无界面对局模拟：AI 对 AI 跑完整局，用于检查逻辑错误与平衡性
// 用法：node tools/sim.js [局数=每组1] [难度=normal]
import { Game } from '../src/game.js';
import { HERO_LIST } from '../src/heroes.js';

const rounds = Number(process.argv[2]) || 1;
const difficulty = process.argv[3] || 'normal';
const DT = 1 / 60, MAX = 60 * 60 * 12;
let failed = false;
for (const a of HERO_LIST) for (const b of HERO_LIST) {
  if (a === b) continue;
  for (let r = 0; r < rounds; r++) {
    const g = new Game({ playerHero: a.id, aiHero: b.id, difficulty, auto: true });
    let i = 0;
    try {
      for (; i < MAX && !(g.winner !== null && g.endT > 1); i++) g.update(DT);
    } catch (e) {
      failed = true;
      console.error(`${a.id} vs ${b.id}: 第 ${(i * DT).toFixed(1)}s 报错`, e);
      break;
    }
    const towers = g.towers.map((t) => `${t.team ? '红' : '蓝'}${t.kind === 'core' ? '基地' : '外塔'}:${Math.round(t.hp)}`).join(' ');
    console.log(`${a.name} vs ${b.name} | 胜者: ${g.winner === null ? '未分胜负' : g.winner === 0 ? a.name : b.name} | 用时 ${(g.time / 60).toFixed(1)}min | 比分 ${g.score.join(':')} | 伤害 ${g.player.stats.dmg}/${g.enemy.stats.dmg} | ${towers}`);
  }
}
process.exit(failed ? 1 : 0);
