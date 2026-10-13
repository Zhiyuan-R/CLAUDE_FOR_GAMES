// 坐骑：按 R 召唤（需引导 1 秒），骑乘时大幅提速，攻击 / 受到伤害会下马
export const MOUNTS = {
  wolf: { id: 'wolf', name: 'Shadow Wolf', speed: 0.75, desc: '+75% move speed, the fastest mount', color: '#6c7088', color2: '#a9aec8' },
  boar: { id: 'boar', name: 'War Boar', speed: 0.55, desc: '+55% move speed, rams and knocks up enemies', color: '#7a4a32', color2: '#c48a5a' },
  raptor: { id: 'raptor', name: 'Raptor', speed: 0.62, desc: '+62% move speed, dashing keeps you mounted', color: '#3f8a4a', color2: '#9be26a' },
  stag: { id: 'stag', name: 'Spirit Stag', speed: 0.55, desc: '+55% move speed, regenerates 3% HP per second', color: '#d9e6f2', color2: '#6ff0d8' },
};
export const MOUNT_LIST = Object.values(MOUNTS);
export const MOUNT_TIME = 1;
