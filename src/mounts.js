// 坐骑：按 R 召唤（需引导 1 秒），骑乘时大幅提速，攻击 / 受到伤害会下马
export const MOUNTS = {
  wolf: { id: 'wolf', name: '影狼', speed: 0.75, desc: '移速 +75%，最快的坐骑', color: '#6c7088', color2: '#a9aec8' },
  boar: { id: 'boar', name: '战猪', speed: 0.55, desc: '移速 +55%，骑乘时撞到敌人会把对方撞飞', color: '#7a4a32', color2: '#c48a5a' },
  raptor: { id: 'raptor', name: '迅猛龙', speed: 0.62, desc: '移速 +62%，骑乘时穿梭不会下马', color: '#3f8a4a', color2: '#9be26a' },
  stag: { id: 'stag', name: '灵鹿', speed: 0.55, desc: '移速 +55%，骑乘时每秒回复 3% 生命', color: '#d9e6f2', color2: '#6ff0d8' },
};
export const MOUNT_LIST = Object.values(MOUNTS);
export const MOUNT_TIME = 1;
