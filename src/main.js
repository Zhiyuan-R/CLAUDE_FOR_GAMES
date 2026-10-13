// 入口：菜单（30 位英雄 / 坐骑 / 难度）、主循环、暂停与结算
import { Game } from './game.js';
import { Renderer } from './render/renderer.js';
import { Keyboard } from './input.js';
import { HERO_LIST, HEROES } from './heroes.js';
import { MOUNT_LIST } from './mounts.js';
import { DIFFICULTY } from './ai.js';
import { initAudio, toggleMute, sfx } from './audio.js';
import { portrait } from './render/portrait.js';

const params = new URLSearchParams(location.search);
const SPEED = Math.min(8, Math.max(0.25, Number(params.get('speed')) || 1));
const COLS = 10;

const kb = new Keyboard();
const renderer = new Renderer(document.getElementById('game'));
const $ = (id) => document.getElementById(id);

const sel = {
  hero: HEROES[params.get('hero')] ? params.get('hero') : 'ember',
  difficulty: params.get('difficulty') || 'normal',
  mount: params.get('mount') || 'wolf',
};
let game = makeDemo();
let mode = 'menu';
let resultShown = false;

function makeDemo() {
  const id = HERO_LIST[Math.floor(Math.random() * HERO_LIST.length)].id;
  const g = new Game({ playerHero: id, difficulty: 'hard', auto: true, demo: true }, kb);
  for (let i = 0; i < 30 * 70; i++) g.update(1 / 30);
  return g;
}

function startMatch() {
  initAudio();
  sfx.ui();
  game = new Game({ playerHero: sel.hero, difficulty: sel.difficulty, mount: sel.mount, auto: params.has('auto') }, kb);
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

function buildMenu() {
  const grid = $('heroes');
  grid.innerHTML = '';
  for (const h of HERO_LIST) {
    const el = document.createElement('button');
    el.className = 'hero-btn';
    el.dataset.id = h.id;
    el.style.setProperty('--c', h.color);
    el.style.setProperty('--c2', h.color2);
    el.innerHTML = `<img class="pt" alt="" src="${portrait(h, 128).toDataURL()}"><span class="nm">${h.name}</span><span class="rl">${h.role}</span>`;
    el.addEventListener('click', () => { sel.hero = h.id; sfx.ui(); refreshMenu(); });
    grid.appendChild(el);
  }
  const mounts = $('mounts');
  mounts.innerHTML = '';
  for (const m of MOUNT_LIST) {
    const b = document.createElement('button');
    b.className = 'mount';
    b.dataset.id = m.id;
    b.innerHTML = `<b>${m.name}</b><span>${m.desc}</span>`;
    b.addEventListener('click', () => { sel.mount = m.id; sfx.ui(); refreshMenu(); });
    mounts.appendChild(b);
  }
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
  document.querySelectorAll('.hero-btn').forEach((c) => c.classList.toggle('active', c.dataset.id === sel.hero));
  document.querySelectorAll('.diff').forEach((c) => c.classList.toggle('active', c.dataset.id === sel.difficulty));
  document.querySelectorAll('.mount').forEach((c) => c.classList.toggle('active', c.dataset.id === sel.mount));
  const h = HEROES[sel.hero];
  const det = $('detail');
  det.style.setProperty('--c', h.color);
  det.style.setProperty('--c2', h.color2);
  det.innerHTML = `
    <div class="hero-head"><img class="big-pt" alt="" src="${portrait(h, 256).toDataURL()}"><div><div class="hero-name">${h.name}</div><div class="hero-en">${h.title} · ${h.role}</div><div class="stats"><span>HP ${h.maxHp}</span><span>Speed ${h.speed}</span><span>${h.ranged ? 'Ranged' : 'Melee'}</span></div></div></div>
    <p class="hero-blurb">${h.blurb}</p>
    <ul class="kit">
      <li><kbd>J</kbd><b>${h.basic.name}</b><span>${h.basic.times.length}-hit combo</span></li>
      <li><kbd>K</kbd><b>${h.charged.name}</b><span>Hold to charge, release to unleash</span></li>
      <li><kbd>Space</kbd><b>${h.dash.name}</b><span>${h.dash.type === 'blink' ? 'Blink' : h.dash.type === 'roll' ? 'Roll' : 'Dash'} · ${h.dash.cd}s cooldown · invulnerable</span></li>
      <li><kbd>U</kbd><b>${h.skills[0].name}</b><span>${h.skills[0].desc}</span></li>
      <li><kbd>I</kbd><b>${h.skills[1].name}</b><span>${h.skills[1].desc}</span></li>
      <li class="ult"><kbd>O</kbd><b>${h.skills[2].name}</b><span>${h.skills[2].desc} · ${h.skills[2].cd}s cooldown</span></li>
      <li class="passive"><kbd>Passive</kbd><b>${h.passiveName}</b><span>${h.passiveDesc}</span></li>
    </ul>`;
  document.querySelector('.hero-btn.active')?.scrollIntoView({ block: 'nearest' });
}

function toMenu() {
  sfx.ui();
  game = makeDemo();
  setMode('menu');
}

function showResult() {
  const win = game.winner === game.player.team;
  $('result-title').textContent = win ? 'Victory' : 'Defeat';
  $('result-title').className = win ? 'win' : 'lose';
  const mm = Math.floor(game.time / 60), ss = String(Math.floor(game.time % 60)).padStart(2, '0');
  const row = (h) => `<div class="row${h === game.player ? ' me' : ''}"><span style="color:${h.team ? '#ff8a8a' : '#8fd0ff'}">${h === game.player ? 'You · ' : ''}${h.name}</span><span>${h.stats.kills}/${h.stats.deaths}/${h.stats.assists}</span><span>${h.stats.cs}</span><span>${h.items.length}</span><span>${h.stats.dmg}</span></div>`;
  $('result-stats').innerHTML = `
    <div class="row head"><span></span><span>K / D / A</span><span>CS</span><span>Items</span><span>Damage</span></div>
    ${game.heroes.filter((h) => h.team === 0).map(row).join('')}
    <div class="sep"></div>
    ${game.heroes.filter((h) => h.team === 1).map(row).join('')}
    <div class="time">Match length ${mm}:${ss} · Score ${game.score[0]} : ${game.score[1]}</div>`;
  setMode('result');
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') toggleMute();
  if (mode === 'menu') {
    const ids = HERO_LIST.map((h) => h.id);
    let i = ids.indexOf(sel.hero);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') i = (i + ids.length - 1) % ids.length;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') i = (i + 1) % ids.length;
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') i = (i + ids.length - COLS) % ids.length;
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') i = (i + COLS) % ids.length;
    else if (e.code === 'Enter') { startMatch(); return; }
    else return;
    e.preventDefault();
    sel.hero = ids[i];
    refreshMenu();
  } else if (e.code === 'Escape') {
    if (mode === 'play') setMode('pause');
    else if (mode === 'pause') setMode('play');
  } else if (mode === 'result' && e.code === 'Enter') startMatch();
});

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

window.__game = () => game;
