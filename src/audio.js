// 程序化合成音效（WebAudio），无需任何音频文件

let ac = null;
let master = null;
let muted = false;
const last = new Map();

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0.22;
    master.connect(ac.destination);
  } catch { ac = null; }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.22;
  return muted;
}

function gate(name, ms) {
  const now = performance.now();
  if (now - (last.get(name) || 0) < ms) return false;
  last.set(name, now);
  return true;
}

function noise(dur, { freq = 1200, q = 1, type = 'bandpass', gain = 0.5, sweep = 1 } = {}) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

function tone(f0, f1, dur, { type = 'sine', gain = 0.3 } = {}) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  swing() { if (gate('swing', 40)) noise(0.12, { freq: 2600, type: 'highpass', gain: 0.25, sweep: 0.4 }); },
  hit() { if (gate('hit', 35)) { noise(0.09, { freq: 900, gain: 0.5 }); tone(220, 90, 0.08, { type: 'square', gain: 0.08 }); } },
  heavy() { if (gate('heavy', 60)) { noise(0.3, { freq: 500, gain: 0.7, sweep: 0.3 }); tone(140, 40, 0.3, { type: 'sawtooth', gain: 0.15 }); } },
  dash() { if (gate('dash', 50)) noise(0.18, { freq: 1500, q: 0.7, gain: 0.3, sweep: 2.5 }); },
  blink() { if (gate('blink', 50)) { tone(400, 1600, 0.15, { type: 'triangle', gain: 0.15 }); noise(0.15, { freq: 3000, gain: 0.15 }); } },
  zap() { if (gate('zap', 40)) { noise(0.16, { freq: 4000, q: 3, gain: 0.3, sweep: 0.5 }); tone(900, 200, 0.12, { type: 'sawtooth', gain: 0.08 }); } },
  bolt() { if (gate('bolt', 40)) tone(700, 300, 0.1, { type: 'triangle', gain: 0.12 }); },
  arrow() { if (gate('arrow', 40)) noise(0.08, { freq: 3500, q: 2, gain: 0.25, sweep: 0.6 }); },
  fire() { if (gate('fire', 80)) noise(0.4, { freq: 600, q: 0.5, gain: 0.45, sweep: 0.5 }); },
  ice() { if (gate('ice', 60)) { tone(1800, 900, 0.18, { type: 'triangle', gain: 0.12 }); noise(0.2, { freq: 5000, type: 'highpass', gain: 0.2 }); } },
  charge() { if (gate('charge', 300)) tone(300, 900, 0.5, { type: 'sine', gain: 0.06 }); },
  ready() { if (gate('ready', 200)) tone(1200, 1600, 0.12, { type: 'sine', gain: 0.1 }); },
  tower() { if (gate('tower', 80)) tone(500, 160, 0.25, { type: 'triangle', gain: 0.12 }); },
  death() { noise(0.6, { freq: 300, gain: 0.6, sweep: 0.2 }); tone(300, 50, 0.6, { type: 'sawtooth', gain: 0.12 }); },
  boom() { noise(0.9, { freq: 260, gain: 0.9, sweep: 0.15 }); tone(90, 30, 0.9, { type: 'sine', gain: 0.4 }); },
  ui() { tone(660, 880, 0.08, { type: 'square', gain: 0.05 }); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f, 0.3, { type: 'triangle', gain: 0.15 }), i * 130)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, f * 0.98, 0.35, { type: 'triangle', gain: 0.15 }), i * 160)); },
};
