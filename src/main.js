// 入口：菜单（选英雄 / 难度）、主循环、暂停与结算
import { Game } from './game.js';
import { Renderer } from './render/renderer.js';
import { Keyboard } from './input.js';
import { HERO_LIST } from './heroes.js';
import { DIFFICULTY } from './ai.js';
import { initAudio, toggleMute, sfx } from './audio.js';

const params = new URLSearchParams(location.search);
const SPEED = Math.min(8, Math.max(0.25, Number(params.get('speed')) || 1));

const kb = new Keyboard();
const renderer = new Renderer(document.getElementById('game'));
const $ = (id) => document.getElementById(id);

const sel = {
  hero: params.get('hero') || 'ember',
  difficulty: params.get('difficulty') || 'normal',
};
let game = makeDemo();
let mode = 'menu'; // menu | play | pause | result
let resultShown = false;

function makeDemo() {
  const ids = HERO_LIST.map((h) => h.id);
  const a = ids[Math.floor(Math.random() * ids.length)];
  const b = ids.filter((x) => x !== a)[Math.floor(Math.random() * (ids.length - 1))];
  const g = new Game({ playerHero: a, aiHero: b, difficulty: 'hard', auto: true, demo: true }, kb);
  // 菜单背景直接从中盘开始，更热闹
  for (let i = 0; i < 60 * 8; i++) g.update(1 / 60);
  return g;
}

function startMatch() {
  initAudio();
  sfx.ui();
  const others = HERO_LIST.filter((h) => h.id !== sel.hero);
  const enemy = params.get('enemy') || others[Math.floor(Math.random() * others.length)].id;
  game = new Game({ playerHero: sel.hero, aiHero: enemy, difficulty: sel.difficulty, auto: params.has('auto') }, kb);
  renderer.cam.x = game.player.x + 300;
  renderer.cam.y = game.player.y;
  resultShown = false;
  setMode('play');
}

function setMode(m) {
  mode = m;
  $('menu').classList.toggle('hidden', m !== 'menu');
  $('pause').classList.toggle('hidden', m !== 'pause');
  $('result').classList.toggle('hidden', m !== 'result');
}

// ───────── 菜单 ─────────
function buildMenu() {
  const cards = $('heroes');
  cards.innerHTML = '';
  HERO_LIST.forEach((h) => {
    const el = document.createElement('button');
    el.className = 'hero-card';
    el.dataset.id = h.id;
    el.style.setProperty('--c', h.color);
    el.style.setProperty('--c2', h.color2);
    el.innerHTML = `
      <div class="hero-head"><span class="sigil"></span><div><div class="hero-name">${h.name}</div><div class="hero-en">${h.en} · ${h.role}</div></div></div>
      <p class="hero-blurb">${h.blurb}</p>
      <ul class="kit">
        <li><kbd>J</kbd><b>${h.basic.name}</b><span>三段连击</span></li>
        <li><kbd>K</kbd><b>${h.charged.name}</b><span>按住蓄力，松开释放</span></li>
        <li><kbd>空格</kbd><b>${h.dash.name}</b><span>冷却 ${h.dash.cd}s · 无敌帧</span></li>
        <li><kbd>U</kbd><b>${h.skills[0].name}</b><span>${h.skills[0].desc}</span></li>
        <li><kbd>I</kbd><b>${h.skills[1].name}</b><span>${h.skills[1].desc}</span></li>
      </ul>
      <div class="stats"><span>生命 ${h.maxHp}</span><span>移速 ${h.speed}</span></div>`;
    el.addEventListener('click', () => { sel.hero = h.id; sfx.ui(); refreshMenu(); });
    cards.appendChild(el);
  });
  const diff = $('difficulty');
  diff.innerHTML = '';
  Object.entries(DIFFICULTY).forEach(([k, v]) => {
    const b = document.createElement('button');
    b.className = 'diff';
    b.dataset.id = k;
    b.textContent = v.label;
    b.addEventListener('click', () => { sel.difficulty = k; sfx.ui(); refreshMenu(); });
    diff.appendChild(b);
  });
  $('start').addEventListener('click', startMatch);
  $('resume').addEventListener('click', () => setMode('play'));
  $('quit').addEventListener('click', toMenu);
  $('again').addEventListener('click', startMatch);
  $('back').addEventListener('click', toMenu);
  refreshMenu();
}

function refreshMenu() {
  document.querySelectorAll('.hero-card').forEach((c) => c.classList.toggle('active', c.dataset.id === sel.hero));
  document.querySelectorAll('.diff').forEach((c) => c.classList.toggle('active', c.dataset.id === sel.difficulty));
}

function toMenu() {
  sfx.ui();
  game = makeDemo();
  setMode('menu');
}

function showResult() {
  const win = game.winner === game.player.team;
  $('result-title').textContent = win ? '胜利' : '失败';
  $('result-title').className = win ? 'win' : 'lose';
  const p = game.player, e = game.enemy;
  const mm = Math.floor(game.time / 60), ss = String(Math.floor(game.time % 60)).padStart(2, '0');
  $('result-stats').innerHTML = `
    <div class="row head"><span></span><span>击杀</span><span>死亡</span><span>补刀</span><span>伤害</span></div>
    <div class="row"><span>你 · ${p.name}</span><span>${p.stats.kills}</span><span>${p.stats.deaths}</span><span>${p.stats.cs}</span><span>${p.stats.dmg}</span></div>
    <div class="row"><span>电脑 · ${e.name}</span><span>${e.stats.kills}</span><span>${e.stats.deaths}</span><span>${e.stats.cs}</span><span>${e.stats.dmg}</span></div>
    <div class="time">对局时长 ${mm}:${ss}</div>`;
  setMode('result');
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') toggleMute();
  if (mode === 'menu') {
    const ids = HERO_LIST.map((h) => h.id);
    const i = ids.indexOf(sel.hero);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { sel.hero = ids[(i + ids.length - 1) % ids.length]; refreshMenu(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { sel.hero = ids[(i + 1) % ids.length]; refreshMenu(); }
    if (e.code === 'Enter') startMatch();
  } else if (e.code === 'Escape') {
    if (mode === 'play') setMode('pause');
    else if (mode === 'pause') setMode('play');
  } else if (mode === 'result' && e.code === 'Enter') startMatch();
});

// ───────── 主循环 ─────────
let last = performance.now();
function frame(now) {
  const real = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'play' || mode === 'menu') {
    let left = real * (mode === 'menu' ? 1 : SPEED);
    while (left > 1e-4) {
      const step = Math.min(left, 1 / 30);
      game.update(step);
      left -= step;
    }
    if (mode === 'menu' && game.winner !== null && game.endT > 4) game = makeDemo();
  }
  renderer.render(game, real, { hud: mode !== 'menu' });
  kb.endFrame();
  if (mode === 'play' && game.winner !== null && game.endT > 2.6 && !resultShown) {
    resultShown = true;
    showResult();
  }
  requestAnimationFrame(frame);
}

buildMenu();
if (params.has('play')) startMatch();
requestAnimationFrame(frame);

// 便于自动化测试检查状态
window.__game = () => game;
