// 装备：四档品质，属性加成在英雄身上实时汇总
export const RARITY = [
  { id: 0, name: '普通', color: '#d8d4e6' },
  { id: 1, name: '稀有', color: '#4fb0ff' },
  { id: 2, name: '史诗', color: '#c27bff' },
  { id: 3, name: '传说', color: '#ffae3d' },
];

// power 伤害加成 / hp 生命 / armor 减伤 / cdr 冷却缩减 / haste 攻速 / speed 移速 / lifesteal 吸血 / regen 每秒回血
export const ITEMS = [
  { id: 'blade', name: '锋利短剑', r: 0, icon: 'sword', s: { power: 0.08 } },
  { id: 'orb', name: '学徒法珠', r: 0, icon: 'orb', s: { cdr: 0.08 } },
  { id: 'leather', name: '硬皮甲', r: 0, icon: 'armor', s: { armor: 0.08 } },
  { id: 'gem', name: '生命宝石', r: 0, icon: 'heart', s: { hp: 160 } },
  { id: 'boots', name: '迅捷之靴', r: 0, icon: 'boots', s: { speed: 0.08 } },
  { id: 'fang', name: '吸血獠牙', r: 1, icon: 'fang', s: { lifesteal: 0.08, power: 0.05 } },
  { id: 'axe', name: '狂战斧', r: 1, icon: 'axe', s: { power: 0.14, haste: 0.08 } },
  { id: 'mail', name: '秘银锁甲', r: 1, icon: 'armor', s: { armor: 0.14, hp: 150 } },
  { id: 'glass', name: '时之沙漏', r: 1, icon: 'hourglass', s: { cdr: 0.15 } },
  { id: 'charm', name: '疾风护符', r: 1, icon: 'feather', s: { haste: 0.16, speed: 0.04 } },
  { id: 'scale', name: '龙鳞盾', r: 2, icon: 'shield', s: { armor: 0.2, hp: 320, regen: 6 } },
  { id: 'reaper', name: '噬魂镰刃', r: 2, icon: 'scythe', s: { power: 0.22, lifesteal: 0.1 } },
  { id: 'crown', name: '大法师之冠', r: 2, icon: 'crown', s: { cdr: 0.2, power: 0.12 } },
  { id: 'stride', name: '风行者长靴', r: 2, icon: 'boots', s: { speed: 0.15, haste: 0.12 } },
  { id: 'slayer', name: '屠龙者', r: 3, icon: 'sword', s: { power: 0.35, hp: 220 } },
  { id: 'heart', name: '不朽之心', r: 3, icon: 'heart', s: { hp: 650, armor: 0.15, regen: 14 } },
  { id: 'codex', name: '永恒法典', r: 3, icon: 'book', s: { cdr: 0.28, power: 0.2 } },
];

export const STAT_LABEL = {
  power: (v) => `伤害 +${Math.round(v * 100)}%`,
  hp: (v) => `生命 +${v}`,
  armor: (v) => `减伤 +${Math.round(v * 100)}%`,
  cdr: (v) => `冷却 -${Math.round(v * 100)}%`,
  haste: (v) => `攻速 +${Math.round(v * 100)}%`,
  speed: (v) => `移速 +${Math.round(v * 100)}%`,
  lifesteal: (v) => `吸血 ${Math.round(v * 100)}%`,
  regen: (v) => `回血 ${v}/秒`,
};

export const describe = (it) => Object.entries(it.s).map(([k, v]) => STAT_LABEL[k](v)).join(' · ');

// 按品质权重随机抽一件装备。tier 越高，高品质越容易出现
export function rollItem(tier = 0) {
  const weights = [
    [70, 26, 4, 0],
    [30, 50, 18, 2],
    [5, 35, 45, 15],
    [0, 0, 55, 45],
  ][Math.max(0, Math.min(3, tier))];
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  let r = 0;
  while (roll > weights[r]) { roll -= weights[r]; r++; }
  const pool = ITEMS.filter((it) => it.r === r);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function sumStats(items) {
  const a = { power: 0, hp: 0, armor: 0, cdr: 0, haste: 0, speed: 0, lifesteal: 0, regen: 0 };
  for (const it of items) for (const k in it.s) a[k] += it.s[k];
  return a;
}
