// 装备：四档品质，属性加成在英雄身上实时汇总
export const RARITY = [
  { id: 0, name: 'Common', color: '#d8d4e6' },
  { id: 1, name: 'Rare', color: '#4fb0ff' },
  { id: 2, name: 'Epic', color: '#c27bff' },
  { id: 3, name: 'Legendary', color: '#ffae3d' },
];

// power 伤害加成 / hp 生命 / armor 减伤 / cdr 冷却缩减 / haste 攻速 / speed 移速 / lifesteal 吸血 / regen 每秒回血
export const ITEMS = [
  { id: 'blade', name: 'Keen Dagger', r: 0, icon: 'sword', s: { power: 0.08 } },
  { id: 'orb', name: 'Apprentice Orb', r: 0, icon: 'orb', s: { cdr: 0.08 } },
  { id: 'leather', name: 'Hard Leather', r: 0, icon: 'armor', s: { armor: 0.08 } },
  { id: 'gem', name: 'Life Gem', r: 0, icon: 'heart', s: { hp: 160 } },
  { id: 'boots', name: 'Swift Boots', r: 0, icon: 'boots', s: { speed: 0.08 } },
  { id: 'fang', name: 'Vampiric Fang', r: 1, icon: 'fang', s: { lifesteal: 0.08, power: 0.05 } },
  { id: 'axe', name: 'Berserker Axe', r: 1, icon: 'axe', s: { power: 0.14, haste: 0.08 } },
  { id: 'mail', name: 'Mithril Mail', r: 1, icon: 'armor', s: { armor: 0.14, hp: 150 } },
  { id: 'glass', name: 'Hourglass', r: 1, icon: 'hourglass', s: { cdr: 0.15 } },
  { id: 'charm', name: 'Gale Charm', r: 1, icon: 'feather', s: { haste: 0.16, speed: 0.04 } },
  { id: 'scale', name: 'Dragonscale Shield', r: 2, icon: 'shield', s: { armor: 0.2, hp: 320, regen: 6 } },
  { id: 'reaper', name: 'Soulreaper', r: 2, icon: 'scythe', s: { power: 0.22, lifesteal: 0.1 } },
  { id: 'crown', name: 'Archmage Crown', r: 2, icon: 'crown', s: { cdr: 0.2, power: 0.12 } },
  { id: 'stride', name: 'Windwalker Boots', r: 2, icon: 'boots', s: { speed: 0.15, haste: 0.12 } },
  { id: 'slayer', name: 'Dragonslayer', r: 3, icon: 'sword', s: { power: 0.35, hp: 220 } },
  { id: 'heart', name: 'Undying Heart', r: 3, icon: 'heart', s: { hp: 650, armor: 0.15, regen: 14 } },
  { id: 'codex', name: 'Eternal Codex', r: 3, icon: 'book', s: { cdr: 0.28, power: 0.2 } },
];

export const STAT_LABEL = {
  power: (v) => `+${Math.round(v * 100)}% damage`,
  hp: (v) => `+${v} HP`,
  armor: (v) => `+${Math.round(v * 100)}% armor`,
  cdr: (v) => `-${Math.round(v * 100)}% cooldowns`,
  haste: (v) => `+${Math.round(v * 100)}% attack speed`,
  speed: (v) => `+${Math.round(v * 100)}% move speed`,
  lifesteal: (v) => `${Math.round(v * 100)}% lifesteal`,
  regen: (v) => `${v} HP/s regen`,
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
