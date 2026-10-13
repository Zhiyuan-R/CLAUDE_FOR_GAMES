// 30 位英雄：由技能库中的普攻 / 蓄力 / 穿梭 / 技能组合而成，每位英雄的技能组合都不相同
import { basicSlash, basicThrust, basicShot, chargedSpin, chargedBeam, chargedFan, chargedLeap, chargedOrb, chargedQuake, chargedThrust, makeSkill, makeUlt, EL } from './skills.js';
import { PASSIVES } from './passives.js';

const ROLE = {
  tank: { label: '坦克', hp: 1550, speed: 240, size: 1.42 },
  fighter: { label: '战士', hp: 1250, speed: 255, size: 1.32 },
  assassin: { label: '刺客', hp: 980, speed: 275, size: 1.22 },
  mage: { label: '法师', hp: 930, speed: 245, size: 1.28 },
  marksman: { label: '射手', hp: 960, speed: 265, size: 1.26 },
  support: { label: '辅助', hp: 1080, speed: 250, size: 1.28 },
};

const MELEE_BASIC = {
  sword: () => basicSlash({}),
  axe: () => basicSlash({ range: 105, arc: 2.0, dmg: [50, 52, 84], times: [0.3, 0.3, 0.48] }),
  hammer: () => basicSlash({ range: 110, arc: 2.0, dmg: [56, 58, 96], times: [0.38, 0.38, 0.58], kb3: 520 }),
  dagger: () => basicSlash({ range: 84, arc: 1.6, dmg: [30, 30, 54], times: [0.16, 0.16, 0.3], lunge: 360 }),
  scythe: () => basicSlash({ range: 125, arc: 2.7, dmg: [44, 44, 76], times: [0.3, 0.3, 0.46] }),
  greatsword: () => basicSlash({ range: 120, arc: 2.4, dmg: [58, 60, 98], times: [0.36, 0.36, 0.56] }),
  fist: () => basicSlash({ range: 82, arc: 1.8, dmg: [26, 26, 26, 60], times: [0.14, 0.14, 0.14, 0.32], lunge: 260 }),
  spear: () => basicThrust({}),
};

const DASH = {
  dash: (name = '疾影步') => ({ type: 'dash', name, cd: 2.3, speed: 1150, time: 0.17 }),
  blink: (name = '闪现') => ({ type: 'blink', name, cd: 3.2, dist: 240 }),
  roll: (name = '翻滚') => ({ type: 'roll', name, cd: 2.0, speed: 1000, time: 0.2 }),
};

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1))));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
}


// 每位英雄的被动与大招：[被动, 大招类型, 大招名]
const EXTRA = {
  ember: ['pyre', 'inferno', '炼狱领域'], storm: ['echo', 'starfall', '雷霆审判'], frost: ['frostbite', 'barrage', '冰晶暴雨'],
  magma: ['thorns', 'fissure', '熔岩裂谷'], shade: ['executioner', 'execute', '影杀'], cleric: ['secondWind', 'sanctuary', '圣域'],
  plague: ['pyre', 'blackhole', '瘟疫之井'], berserker: ['fury', 'avatar', '血怒化身'], wind: ['twinDash', 'ricochet', '风暴弹射'],
  tide: ['echo', 'blackhole', '深渊之眼'], arbalest: ['crit', 'barrage', '火力覆盖'], paladin: ['banner', 'sanctuary', '神圣庇护所'],
  count: ['vampire', 'beast', '血蝠之王'], druid: ['secondWind', 'beast', '远古树灵'], troll: ['lastStand', 'fissure', '冰川崩裂'],
  astral: ['echo', 'timeStop', '星辰禁锢'], butcher: ['vampire', 'execute', '屠宰'], gale: ['twinDash', 'dragonDash', '风龙三连斩'],
  thunder: ['momentum', 'dragonDash', '雷龙突袭'], soul: ['hunter', 'blackhole', '灵魂深渊'], pyro: ['crit', 'barrage', '流星火雨'],
  lancer: ['momentum', 'fissure', '流沙裂地'], dk: ['lastStand', 'timeStop', '死亡凝滞'], shaman: ['frostbite', 'inferno', '永冬领域'],
  tinker: ['reset', 'ricochet', '弹射机关球'], moon: ['hunter', 'starfall', '月神降临'], monk: ['reset', 'avatar', '金刚不坏'],
  gorgon: ['executioner', 'timeStop', '石化凝视'], brew: ['thorns', 'inferno', '烈酒火海'], chrono: ['banner', 'sanctuary', '时光倒流'],
};

function H(o) {
  const role = ROLE[o.role];
  const el = EL[o.el];
  const ranged = o.weapon === 'staff' || o.weapon === 'bow' || o.weapon === 'orb';
  const [cape, body, hood] = o.colors;
  const basic = o.basic || (ranged
    ? basicShot(o.weapon === 'bow'
      ? { kind: 'arrow', speed: 1000, life: 0.56, dmg: [34, 34, 54], times: [0.24, 0.24, 0.38], third: 'pierce', el: o.el, radius: 9 }
      : { kind: 'bolt', speed: 760, life: 0.62, dmg: [40, 40, 30], third: o.third || 'spread', el: o.el })
    : MELEE_BASIC[o.weapon]());
  basic.name = o.basicName;
  const charged = o.charged[0]({ name: o.charged[1], el: o.el });
  const def = {
    id: o.id, name: o.name, en: o.en, role: role.label, roleId: o.role, blurb: o.blurb, el: o.el,
    color: cape, colorD: shade(cape, 0.62), color2: el.c,
    body, bodyL: shade(body, 1.35), hood, hoodD: shade(hood, 0.62),
    weapon: o.weapon, head: o.head, size: role.size,
    maxHp: o.hp || role.hp, speed: o.speed || role.speed,
    ranged, projSpeed: basic.projSpeed || 800,
    aiRange: ranged ? (o.weapon === 'bow' ? 400 : 360) : 70,
    aiAttackRange: ranged ? (o.weapon === 'bow' ? 500 : 450) : (o.weapon === 'spear' || o.weapon === 'scythe' ? 135 : 105),
    assistRange: ranged ? 540 : 170,
    dash: DASH[o.dash[0]](o.dash[1]),
    basic, charged,
    skills: [makeSkill(o.s1[0], { name: o.s1[1], el: o.el }), makeSkill(o.s2[0], { name: o.s2[1], el: o.el }), makeUlt(EXTRA[o.id][1], { name: EXTRA[o.id][2], el: o.el })],
    passive: EXTRA[o.id][0], passiveName: PASSIVES[EXTRA[o.id][0]].name, passiveDesc: PASSIVES[EXTRA[o.id][0]].desc,
  };
  return def;
}

export const HERO_LIST = [
  H({ id: 'ember', name: '烈焰剑士', en: 'Ember Knight', role: 'fighter', el: 'fire', weapon: 'sword', head: 'hornhood', colors: ['#d63a2c', '#3b2a33', '#c2352a'], basicName: '烈焰连斩', charged: [chargedSpin, '烈焰回旋'], dash: ['dash'], s1: ['dashStrike', '炎龙突进'], s2: ['aura', '烈焰风暴'], blurb: '贴身连斩、火焰突进与环身风暴，擅长近身压制。' }),
  H({ id: 'storm', name: '雷霆法师', en: 'Storm Mage', role: 'mage', el: 'lightning', weapon: 'staff', head: 'hat', colors: ['#6a4fe0', '#2f2a5e', '#4b34b0'], basicName: '奥术飞弹', charged: [chargedBeam, '雷光贯穿'], dash: ['blink'], s1: ['chain', '连锁闪电'], s2: ['storm', '雷暴领域'], blurb: '连锁闪电与雷暴领域的远程爆发，用闪现拉开距离。' }),
  H({ id: 'frost', name: '寒霜游侠', en: 'Frost Ranger', role: 'marksman', el: 'ice', weapon: 'bow', head: 'furhood', colors: ['#2f8fb3', '#2b3d4a', '#2a86ab'], basicName: '冰棱箭', charged: [chargedFan, '寒霜箭雨'], dash: ['roll'], s1: ['trap', '冰霜陷阱'], s2: ['novaLeap', '后跃冰爆'], blurb: '高频冰棱箭与陷阱，边打边撤的风筝型射手。' }),
  H({ id: 'magma', name: '熔岩巨像', en: 'Magma Titan', role: 'tank', el: 'fire', weapon: 'hammer', head: 'horns', colors: ['#8a3a1c', '#3a2a24', '#5a2a1a'], basicName: '熔岩锤击', charged: [chargedQuake, '熔地震波'], dash: ['dash', '熔岩冲撞'], s1: ['charge', '巨像冲锋'], s2: ['roar', '熔心怒吼'], blurb: '冲锋撞晕敌人，再用怒吼把整群人震开，前排开团核心。' }),
  H({ id: 'shade', name: '影刃', en: 'Shadow Blade', role: 'assassin', el: 'shadow', weapon: 'dagger', head: 'mask', colors: ['#3a2a5a', '#1e1a2e', '#2a2244'], basicName: '影袭连刺', charged: [chargedThrust, '影穿'], dash: ['blink', '影遁'], s1: ['shadowStrike', '背刺'], s2: ['stealth', '暗影潜行'], blurb: '潜行接背刺，一套带走脆皮，然后消失在阴影里。' }),
  H({ id: 'cleric', name: '圣光牧师', en: 'Holy Cleric', role: 'support', el: 'holy', weapon: 'staff', head: 'crown', colors: ['#f0e6c8', '#6a5a40', '#e8d8a8'], third: 'big', basicName: '圣光弹', charged: [chargedOrb, '审判圣球'], dash: ['roll'], s1: ['heal', '圣泉'], s2: ['shield', '神圣护盾'], blurb: '群体治疗与护盾，让队友在团战里活得更久。' }),
  H({ id: 'plague', name: '瘟疫术士', en: 'Plague Warlock', role: 'mage', el: 'poison', weapon: 'staff', head: 'mask', colors: ['#4a6a2a', '#2a3020', '#3a5020'], basicName: '腐毒飞弹', charged: [chargedOrb, '瘟疫之球'], dash: ['blink', '毒雾遁'], s1: ['poison', '剧毒云雾'], s2: ['drain', '生命汲取'], blurb: '毒云封锁区域，再用汲取锁链吸干敌人的生命。' }),
  H({ id: 'berserker', name: '狂战士', en: 'Berserker', role: 'fighter', el: 'blood', weapon: 'axe', head: 'horns', colors: ['#9a2a2a', '#4a3020', '#6a4a30'], basicName: '裂骨斧', charged: [chargedSpin, '血腥回旋'], dash: ['dash', '蛮冲'], s1: ['berserk', '狂暴'], s2: ['whirlwind', '血色旋风'], blurb: '狂暴后化身旋风冲进人群，越打越凶。' }),
  H({ id: 'wind', name: '风行者', en: 'Wind Walker', role: 'marksman', el: 'wind', weapon: 'bow', head: 'hair', colors: ['#4aa88a', '#2a4038', '#e8e0c8'], basicName: '疾风箭', charged: [chargedFan, '飓风连射'], dash: ['roll', '风步'], s1: ['arrowRain', '风暴箭雨'], s2: ['boomerang', '回旋风刃'], blurb: '箭雨覆盖区域，回旋风刃来回切割，灵活的远程输出。' }),
  H({ id: 'tide', name: '深海女巫', en: 'Tide Witch', role: 'mage', el: 'water', weapon: 'orb', head: 'hood', colors: ['#2a5a9a', '#1e3050', '#2a6aaa'], basicName: '潮汐弹', charged: [chargedBeam, '激流喷射'], dash: ['blink', '水遁'], s1: ['vortex', '深海漩涡'], s2: ['bomb', '泡沫炸弹'], blurb: '漩涡把敌人聚到一起，再丢炸弹一网打尽。' }),
  H({ id: 'arbalest', name: '雷火弩手', en: 'Arbalest', role: 'marksman', el: 'fire', weapon: 'bow', head: 'helm', colors: ['#8a5a2a', '#3a3030', '#7a7a8a'], basicName: '火弩', charged: [chargedOrb, '爆裂弩矢'], dash: ['roll'], s1: ['spear', '穿甲重矢'], s2: ['turret', '火焰炮台'], blurb: '穿甲重矢贯穿整条线，放下炮台架起火力网。' }),
  H({ id: 'paladin', name: '圣骑士', en: 'Paladin', role: 'tank', el: 'holy', weapon: 'hammer', head: 'helm', colors: ['#e8d8a8', '#5a5a70', '#c8c8d8'], basicName: '圣锤', charged: [chargedQuake, '神圣震击'], dash: ['dash', '圣光冲刺'], s1: ['slam', '制裁之锤'], s2: ['shield', '庇护'], blurb: '重锤眩晕敌人，用护盾保护自己和队友的坚固前排。' }),
  H({ id: 'count', name: '血族伯爵', en: 'Blood Count', role: 'fighter', el: 'blood', weapon: 'scythe', head: 'crown', colors: ['#5a1a2a', '#2a1a24', '#3a1a2a'], basicName: '血镰', charged: [chargedSpin, '猩红收割'], dash: ['blink', '蝠影'], s1: ['drain', '血之契约'], s2: ['orbitals', '血环'], blurb: '血环护身，用契约锁链吸血续航的吸血鬼贵族。' }),
  H({ id: 'druid', name: '森林德鲁伊', en: 'Grove Druid', role: 'support', el: 'nature', weapon: 'staff', head: 'ears', colors: ['#4a7a3a', '#3a3020', '#6a5a3a'], basicName: '荆棘飞弹', charged: [chargedOrb, '萌芽之种'], dash: ['roll', '林间跃'], s1: ['turret', '树精图腾'], s2: ['heal', '生命之泉'], blurb: '种下树精图腾守点，同时用生命之泉治疗队友。' }),
  H({ id: 'troll', name: '冰霜巨魔', en: 'Frost Troll', role: 'tank', el: 'ice', weapon: 'axe', head: 'horns', colors: ['#5a8aaa', '#3a4a5a', '#7aa8c8'], basicName: '冰斧', charged: [chargedQuake, '冰川裂地'], dash: ['dash', '冰面滑行'], s1: ['wall', '冰川之墙'], s2: ['roar', '寒霜咆哮'], blurb: '冰墙切断退路，咆哮减速，留住敌人的大块头。' }),
  H({ id: 'astral', name: '星界术士', en: 'Astral Sage', role: 'mage', el: 'arcane', weapon: 'orb', head: 'hat', colors: ['#3a2a7a', '#1e1a40', '#2a2a6a'], basicName: '星辰弹', charged: [chargedBeam, '星光射线'], dash: ['blink', '星界穿梭'], s1: ['meteor', '星陨'], s2: ['blinkNova', '星爆跃迁'], blurb: '召唤星陨重创区域，跃迁切入后爆发眩晕。' }),
  H({ id: 'butcher', name: '屠夫', en: 'Butcher', role: 'fighter', el: 'blood', weapon: 'axe', head: 'mask', colors: ['#6a4a3a', '#4a3a30', '#5a4a40'], basicName: '剁骨刀', charged: [chargedLeap, '屠宰跳斩'], dash: ['dash', '猛扑'], s1: ['hook', '肉钩'], s2: ['berserk', '嗜血'], blurb: '肉钩把敌人拉到身边，嗜血之后一顿乱砍。' }),
  H({ id: 'gale', name: '疾风刺客', en: 'Gale Assassin', role: 'assassin', el: 'wind', weapon: 'dagger', head: 'hair', colors: ['#2a6a6a', '#1e2e30', '#d8d0c0'], basicName: '风刃连击', charged: [chargedThrust, '疾风突刺'], dash: ['dash', '风行'], s1: ['knives', '飞刀扇'], s2: ['blinkNova', '旋风跃'], blurb: '飞刀消耗，跃迁切入眩晕，出手快、走得也快。' }),
  H({ id: 'thunder', name: '雷鸣战神', en: 'Thunder Lord', role: 'fighter', el: 'lightning', weapon: 'spear', head: 'helm', colors: ['#3a5aaa', '#2a2a40', '#b8b8d8'], basicName: '雷枪', charged: [chargedLeap, '雷霆坠击'], dash: ['dash', '雷闪'], s1: ['spear', '雷枪投掷'], s2: ['slam', '天雷重击'], blurb: '投出雷枪远程开团，跳斩落地眩晕一片。' }),
  H({ id: 'soul', name: '灵魂猎手', en: 'Soul Hunter', role: 'assassin', el: 'shadow', weapon: 'scythe', head: 'hood', colors: ['#2a2a3a', '#1a1a24', '#3a3a50'], basicName: '魂镰', charged: [chargedSpin, '亡魂收割'], dash: ['blink', '魂步'], s1: ['hook', '灵魂锁链'], s2: ['vortex', '冥界漩涡'], blurb: '锁链拉人接冥界漩涡，让敌人无处可逃。' }),
  H({ id: 'pyro', name: '炎爆魔导', en: 'Pyromancer', role: 'mage', el: 'fire', weapon: 'staff', head: 'hat', colors: ['#aa3a1a', '#3a2020', '#8a2a1a'], basicName: '火球', charged: [chargedOrb, '炎爆术'], dash: ['blink', '火焰闪现'], s1: ['meteor', '陨石术'], s2: ['bomb', '燃烧瓶'], blurb: '陨石与炸弹的范围轰炸，团战伤害极高。' }),
  H({ id: 'lancer', name: '沙漠枪骑', en: 'Desert Lancer', role: 'fighter', el: 'earth', weapon: 'spear', head: 'hood', colors: ['#c89a5a', '#5a4030', '#d8b880'], basicName: '沙枪', charged: [chargedThrust, '贯沙突击'], dash: ['dash', '沙行'], s1: ['charge', '沙暴冲锋'], s2: ['wall', '流沙之墙'], blurb: '冲锋撞晕后竖起沙墙，把敌人困在自己身边。' }),
  H({ id: 'dk', name: '亡灵骑士', en: 'Death Knight', role: 'tank', el: 'shadow', weapon: 'greatsword', head: 'helm', colors: ['#2a2a4a', '#2a2a30', '#5a5a6a'], basicName: '亡者巨剑', charged: [chargedLeap, '冥王坠落'], dash: ['dash', '亡灵冲锋'], s1: ['frostLine', '死亡之握'], s2: ['drain', '灵魂虹吸'], blurb: '死亡之握定住一条线的敌人，再虹吸生命续航。' }),
  H({ id: 'shaman', name: '雪原萨满', en: 'Snow Shaman', role: 'support', el: 'ice', weapon: 'staff', head: 'furhood', colors: ['#6a8aaa', '#3a4050', '#e8f0f8'], third: 'pierce', basicName: '寒冰弹', charged: [chargedBeam, '冰霜射线'], dash: ['roll'], s1: ['storm', '暴风雪'], s2: ['turret', '寒冰图腾'], blurb: '暴风雪封锁区域，寒冰图腾持续减速敌人。' }),
  H({ id: 'tinker', name: '机关工匠', en: 'Tinker', role: 'mage', el: 'arcane', weapon: 'orb', head: 'helm', colors: ['#8a6a3a', '#3a3a40', '#a8a8b8'], basicName: '能量弹', charged: [chargedFan, '散射弹幕'], dash: ['roll', '弹簧跳'], s1: ['trap', '奥术地雷'], s2: ['turret', '自动炮台'], blurb: '埋地雷、放炮台，靠机关控制战场。' }),
  H({ id: 'moon', name: '月影弓手', en: 'Moon Archer', role: 'marksman', el: 'arcane', weapon: 'bow', head: 'ears', colors: ['#5a4a9a', '#2a2a40', '#d8d0f0'], basicName: '月光箭', charged: [chargedBeam, '月神之矢'], dash: ['roll', '月影步'], s1: ['frostLine', '月光束缚'], s2: ['stealth', '月隐'], blurb: '月光束缚定住一条线，隐身后再补上致命一箭。' }),
  H({ id: 'monk', name: '武僧', en: 'Monk', role: 'fighter', el: 'wind', weapon: 'fist', head: 'hair', colors: ['#d88a2a', '#5a3a20', '#2a2a2a'], basicName: '连环拳', charged: [chargedQuake, '震地掌'], dash: ['dash', '踏风'], s1: ['whirlwind', '旋风腿'], s2: ['dashStrike', '飞龙踢'], blurb: '四段连环拳，飞龙踢突进，旋风腿收割。' }),
  H({ id: 'gorgon', name: '蛇发女妖', en: 'Gorgon', role: 'marksman', el: 'poison', weapon: 'bow', head: 'hair', colors: ['#3a7a5a', '#2a3a30', '#5a9a4a'], basicName: '毒牙箭', charged: [chargedFan, '蛇群齐射'], dash: ['roll', '蛇行'], s1: ['poison', '毒雾'], s2: ['knives', '毒鳞飞刃'], blurb: '毒雾与毒鳞飞刃叠加持续伤害，越拖越强。' }),
  H({ id: 'brew', name: '熊猫酒仙', en: 'Brewmaster', role: 'tank', el: 'earth', weapon: 'hammer', head: 'ears', colors: ['#7a5a3a', '#e8e0d0', '#2a2a2a'], basicName: '酒坛锤', charged: [chargedSpin, '醉拳回旋'], dash: ['roll', '醉步'], s1: ['aura', '酒气冲天'], s2: ['novaLeap', '醉酒后跳'], blurb: '酒气环身持续伤害，醉步后跳躲开集火。' }),
  H({ id: 'chrono', name: '时空旅者', en: 'Chronomancer', role: 'support', el: 'arcane', weapon: 'orb', head: 'crown', colors: ['#c8a84a', '#3a3040', '#e8d8a0'], basicName: '时光弹', charged: [chargedOrb, '时间奇点'], dash: ['blink', '时空跳跃'], s1: ['shield', '时间护盾'], s2: ['chain', '时光连锁'], blurb: '为队友套上时间护盾，用连锁弹射同时打多个目标。' }),
];

export const HEROES = Object.fromEntries(HERO_LIST.map((h) => [h.id, h]));
