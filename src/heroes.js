// 30 位英雄：由技能库中的普攻 / 蓄力 / 穿梭 / 技能组合而成，每位英雄的技能组合都不相同
import { basicSlash, basicThrust, basicShot, chargedSpin, chargedBeam, chargedFan, chargedLeap, chargedOrb, chargedQuake, chargedThrust, makeSkill, makeUlt, EL } from './skills.js';
import { PASSIVES } from './passives.js';

const ROLE = {
  tank: { label: 'Tank', hp: 1550, speed: 240, size: 1.42 },
  fighter: { label: 'Fighter', hp: 1250, speed: 255, size: 1.32 },
  assassin: { label: 'Assassin', hp: 980, speed: 275, size: 1.22 },
  mage: { label: 'Mage', hp: 930, speed: 245, size: 1.28 },
  marksman: { label: 'Marksman', hp: 960, speed: 265, size: 1.26 },
  support: { label: 'Support', hp: 1080, speed: 250, size: 1.28 },
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
  dash: (name = 'Shadow Step') => ({ type: 'dash', name, cd: 2.3, speed: 1150, time: 0.17 }),
  blink: (name = 'Blink') => ({ type: 'blink', name, cd: 3.2, dist: 240 }),
  roll: (name = 'Roll') => ({ type: 'roll', name, cd: 2.0, speed: 1000, time: 0.2 }),
};

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1))));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
}


// 每位英雄的被动与大招：[被动, 大招类型, 大招名]
const EXTRA = {
  ember: ['pyre', 'inferno', 'Inferno Domain'], storm: ['echo', 'starfall', 'Thunder Judgment'], frost: ['frostbite', 'barrage', 'Crystal Hailstorm'],
  magma: ['thorns', 'fissure', 'Magma Rift'], shade: ['executioner', 'execute', 'Shadow Execution'], cleric: ['secondWind', 'sanctuary', 'Sanctuary'],
  plague: ['pyre', 'blackhole', 'Plague Well'], berserker: ['fury', 'avatar', 'Blood Avatar'], wind: ['twinDash', 'ricochet', 'Storm Ricochet'],
  tide: ['echo', 'blackhole', 'Eye of the Abyss'], arbalest: ['crit', 'barrage', 'Saturation Fire'], paladin: ['banner', 'sanctuary', 'Holy Bastion'],
  count: ['vampire', 'beast', 'Bat Lord'], druid: ['secondWind', 'beast', 'Ancient Treant'], troll: ['lastStand', 'fissure', 'Glacial Rupture'],
  astral: ['echo', 'timeStop', 'Stellar Stasis'], butcher: ['vampire', 'execute', 'Slaughter'], gale: ['twinDash', 'dragonDash', 'Wind Dragon Triad'],
  thunder: ['momentum', 'dragonDash', 'Thunder Dragon Raid'], soul: ['hunter', 'blackhole', 'Soul Abyss'], pyro: ['crit', 'barrage', 'Meteor Shower'],
  lancer: ['momentum', 'fissure', 'Quicksand Rift'], dk: ['lastStand', 'timeStop', 'Death Stasis'], shaman: ['frostbite', 'inferno', 'Eternal Winter'],
  tinker: ['reset', 'ricochet', 'Ricochet Drone'], moon: ['hunter', 'starfall', 'Moonfall'], monk: ['reset', 'avatar', 'Diamond Body'],
  gorgon: ['executioner', 'timeStop', 'Petrifying Gaze'], brew: ['thorns', 'inferno', 'Firewater Sea'], chrono: ['banner', 'sanctuary', 'Rewind'],
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
    id: o.id, name: o.name, en: o.en, title: `${el.w[0].toUpperCase()}${el.w.slice(1)} ${o.weapon}`, role: role.label, roleId: o.role, blurb: o.blurb, el: o.el,
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
  H({ id: 'ember', name: 'Ember Knight', en: 'Ember Knight', role: 'fighter', el: 'fire', weapon: 'sword', head: 'hornhood', colors: ['#d63a2c', '#3b2a33', '#c2352a'], basicName: 'Flame Combo', charged: [chargedSpin, 'Flame Whirl'], dash: ['dash'], s1: ['dashStrike', 'Dragon Rush'], s2: ['aura', 'Firestorm'], blurb: 'Relentless close-range pressure with blazing combos, a fire rush and a burning whirlwind.' }),
  H({ id: 'storm', name: 'Storm Mage', en: 'Storm Mage', role: 'mage', el: 'lightning', weapon: 'staff', head: 'hat', colors: ['#6a4fe0', '#2f2a5e', '#4b34b0'], basicName: 'Arcane Missiles', charged: [chargedBeam, 'Lightning Lance'], dash: ['blink'], s1: ['chain', 'Chain Lightning'], s2: ['storm', 'Thunderstorm'], blurb: 'Long-range burst with chain lightning and thunderstorms, using blink to keep distance.' }),
  H({ id: 'frost', name: 'Frost Ranger', en: 'Frost Ranger', role: 'marksman', el: 'ice', weapon: 'bow', head: 'furhood', colors: ['#2f8fb3', '#2b3d4a', '#2a86ab'], basicName: 'Icicle Arrows', charged: [chargedFan, 'Frost Volley'], dash: ['roll'], s1: ['trap', 'Frost Trap'], s2: ['novaLeap', 'Frost Nova Leap'], blurb: 'A kiting marksman with rapid icicle arrows and freezing traps.' }),
  H({ id: 'magma', name: 'Magma Titan', en: 'Magma Titan', role: 'tank', el: 'fire', weapon: 'hammer', head: 'horns', colors: ['#8a3a1c', '#3a2a24', '#5a2a1a'], basicName: 'Magma Hammer', charged: [chargedQuake, 'Molten Quake'], dash: ['dash', 'Lava Ram'], s1: ['charge', 'Titan Charge'], s2: ['roar', 'Molten Roar'], blurb: 'Charges in to stun, then roars the whole crowd away. The frontline initiator.' }),
  H({ id: 'shade', name: 'Shadow Blade', en: 'Shadow Blade', role: 'assassin', el: 'shadow', weapon: 'dagger', head: 'mask', colors: ['#3a2a5a', '#1e1a2e', '#2a2244'], basicName: 'Shadow Stabs', charged: [chargedThrust, 'Shadow Pierce'], dash: ['blink', 'Shadow Slip'], s1: ['shadowStrike', 'Backstab'], s2: ['stealth', 'Shadow Veil'], blurb: 'Vanishes, backstabs a squishy target and melts back into the shadows.' }),
  H({ id: 'cleric', name: 'Holy Cleric', en: 'Holy Cleric', role: 'support', el: 'holy', weapon: 'staff', head: 'crown', colors: ['#f0e6c8', '#6a5a40', '#e8d8a8'], third: 'big', basicName: 'Holy Bolt', charged: [chargedOrb, 'Orb of Judgment'], dash: ['roll'], s1: ['heal', 'Holy Spring'], s2: ['shield', 'Divine Shield'], blurb: 'Group heals and shields that keep the team alive through every fight.' }),
  H({ id: 'plague', name: 'Plague Warlock', en: 'Plague Warlock', role: 'mage', el: 'poison', weapon: 'staff', head: 'mask', colors: ['#4a6a2a', '#2a3020', '#3a5020'], basicName: 'Blight Bolts', charged: [chargedOrb, 'Plague Orb'], dash: ['blink', 'Miasma Slip'], s1: ['poison', 'Toxic Cloud'], s2: ['drain', 'Life Drain'], blurb: 'Seals areas with toxic clouds and drains the life from enemies with a tether.' }),
  H({ id: 'berserker', name: 'Berserker', en: 'Berserker', role: 'fighter', el: 'blood', weapon: 'axe', head: 'horns', colors: ['#9a2a2a', '#4a3020', '#6a4a30'], basicName: 'Bonesplitter', charged: [chargedSpin, 'Bloody Whirl'], dash: ['dash', 'Savage Rush'], s1: ['berserk', 'Berserk'], s2: ['whirlwind', 'Crimson Cyclone'], blurb: 'Goes berserk and spins into the crowd, getting deadlier the longer the fight lasts.' }),
  H({ id: 'wind', name: 'Wind Walker', en: 'Wind Walker', role: 'marksman', el: 'wind', weapon: 'bow', head: 'hair', colors: ['#4aa88a', '#2a4038', '#e8e0c8'], basicName: 'Gale Arrows', charged: [chargedFan, 'Hurricane Volley'], dash: ['roll', 'Wind Step'], s1: ['arrowRain', 'Arrow Storm'], s2: ['boomerang', 'Wind Boomerang'], blurb: 'Rains arrows over an area and slices back and forth with a returning wind blade.' }),
  H({ id: 'tide', name: 'Tide Witch', en: 'Tide Witch', role: 'mage', el: 'water', weapon: 'orb', head: 'hood', colors: ['#2a5a9a', '#1e3050', '#2a6aaa'], basicName: 'Tide Bolts', charged: [chargedBeam, 'Torrent Jet'], dash: ['blink', 'Water Slip'], s1: ['vortex', 'Maelstrom'], s2: ['bomb', 'Bubble Bomb'], blurb: 'Pulls enemies together with a maelstrom, then bombs the whole group.' }),
  H({ id: 'arbalest', name: 'Arbalest', en: 'Arbalest', role: 'marksman', el: 'fire', weapon: 'bow', head: 'helm', colors: ['#8a5a2a', '#3a3030', '#7a7a8a'], basicName: 'Fire Bolts', charged: [chargedOrb, 'Explosive Bolt'], dash: ['roll'], s1: ['spear', 'Piercing Bolt'], s2: ['turret', 'Flame Turret'], blurb: 'Heavy bolts pierce whole lines and turrets lock down the area.' }),
  H({ id: 'paladin', name: 'Paladin', en: 'Paladin', role: 'tank', el: 'holy', weapon: 'hammer', head: 'helm', colors: ['#e8d8a8', '#5a5a70', '#c8c8d8'], basicName: 'Holy Hammer', charged: [chargedQuake, 'Divine Quake'], dash: ['dash', 'Holy Charge'], s1: ['slam', 'Hammer of Justice'], s2: ['shield', 'Protection'], blurb: 'A sturdy frontliner who stuns with a hammer and shields allies.' }),
  H({ id: 'count', name: 'Blood Count', en: 'Blood Count', role: 'fighter', el: 'blood', weapon: 'scythe', head: 'crown', colors: ['#5a1a2a', '#2a1a24', '#3a1a2a'], basicName: 'Blood Scythe', charged: [chargedSpin, 'Crimson Harvest'], dash: ['blink', 'Bat Form'], s1: ['drain', 'Blood Pact'], s2: ['orbitals', 'Blood Halo'], blurb: 'A vampire noble wrapped in orbiting blood blades, sustained by draining pacts.' }),
  H({ id: 'druid', name: 'Grove Druid', en: 'Grove Druid', role: 'support', el: 'nature', weapon: 'staff', head: 'ears', colors: ['#4a7a3a', '#3a3020', '#6a5a3a'], basicName: 'Thorn Bolts', charged: [chargedOrb, 'Sprouting Seed'], dash: ['roll', 'Forest Leap'], s1: ['turret', 'Treant Totem'], s2: ['heal', 'Wellspring'], blurb: 'Plants treant totems to hold ground while healing allies from a wellspring.' }),
  H({ id: 'troll', name: 'Frost Troll', en: 'Frost Troll', role: 'tank', el: 'ice', weapon: 'axe', head: 'horns', colors: ['#5a8aaa', '#3a4a5a', '#7aa8c8'], basicName: 'Ice Axe', charged: [chargedQuake, 'Glacier Quake'], dash: ['dash', 'Ice Slide'], s1: ['wall', 'Glacier Wall'], s2: ['roar', 'Frost Roar'], blurb: 'A big brute who cuts off escapes with ice walls and slows with a roar.' }),
  H({ id: 'astral', name: 'Astral Sage', en: 'Astral Sage', role: 'mage', el: 'arcane', weapon: 'orb', head: 'hat', colors: ['#3a2a7a', '#1e1a40', '#2a2a6a'], basicName: 'Star Bolts', charged: [chargedBeam, 'Starbeam'], dash: ['blink', 'Astral Shift'], s1: ['meteor', 'Starfall Meteor'], s2: ['blinkNova', 'Nova Jump'], blurb: 'Calls down meteors and jumps into fights with a stunning nova.' }),
  H({ id: 'butcher', name: 'Butcher', en: 'Butcher', role: 'fighter', el: 'blood', weapon: 'axe', head: 'mask', colors: ['#6a4a3a', '#4a3a30', '#5a4a40'], basicName: 'Cleaver', charged: [chargedLeap, 'Butcher Leap'], dash: ['dash', 'Pounce'], s1: ['hook', 'Meat Hook'], s2: ['berserk', 'Bloodlust'], blurb: 'Hooks enemies in close, then hacks away in a bloodlust.' }),
  H({ id: 'gale', name: 'Gale Assassin', en: 'Gale Assassin', role: 'assassin', el: 'wind', weapon: 'dagger', head: 'hair', colors: ['#2a6a6a', '#1e2e30', '#d8d0c0'], basicName: 'Wind Blades', charged: [chargedThrust, 'Gale Thrust'], dash: ['dash', 'Windrun'], s1: ['knives', 'Knife Fan'], s2: ['blinkNova', 'Cyclone Jump'], blurb: 'Pokes with knife fans and jumps in to stun. Strikes fast, leaves faster.' }),
  H({ id: 'thunder', name: 'Thunder Lord', en: 'Thunder Lord', role: 'fighter', el: 'lightning', weapon: 'spear', head: 'helm', colors: ['#3a5aaa', '#2a2a40', '#b8b8d8'], basicName: 'Thunder Spear', charged: [chargedLeap, 'Thunder Drop'], dash: ['dash', 'Lightning Step'], s1: ['spear', 'Spear Throw'], s2: ['slam', 'Heaven Strike'], blurb: 'Opens fights with a thrown spear and leaps in to stun a whole group.' }),
  H({ id: 'soul', name: 'Soul Hunter', en: 'Soul Hunter', role: 'assassin', el: 'shadow', weapon: 'scythe', head: 'hood', colors: ['#2a2a3a', '#1a1a24', '#3a3a50'], basicName: 'Soul Scythe', charged: [chargedSpin, 'Reaping Whirl'], dash: ['blink', 'Soul Step'], s1: ['hook', 'Soul Chain'], s2: ['vortex', 'Netherwhirl'], blurb: 'Chains a victim in, then traps everyone in a nether whirlpool.' }),
  H({ id: 'pyro', name: 'Pyromancer', en: 'Pyromancer', role: 'mage', el: 'fire', weapon: 'staff', head: 'hat', colors: ['#aa3a1a', '#3a2020', '#8a2a1a'], basicName: 'Fireballs', charged: [chargedOrb, 'Pyroblast'], dash: ['blink', 'Flame Blink'], s1: ['meteor', 'Meteor'], s2: ['bomb', 'Firebomb'], blurb: 'Massive area damage in team fights with meteors and firebombs.' }),
  H({ id: 'lancer', name: 'Desert Lancer', en: 'Desert Lancer', role: 'fighter', el: 'earth', weapon: 'spear', head: 'hood', colors: ['#c89a5a', '#5a4030', '#d8b880'], basicName: 'Sand Lance', charged: [chargedThrust, 'Sandpiercer'], dash: ['dash', 'Sand Walk'], s1: ['charge', 'Sandstorm Charge'], s2: ['wall', 'Sand Wall'], blurb: 'Charges to stun, then raises a sand wall to keep the enemy trapped nearby.' }),
  H({ id: 'dk', name: 'Death Knight', en: 'Death Knight', role: 'tank', el: 'shadow', weapon: 'greatsword', head: 'helm', colors: ['#2a2a4a', '#2a2a30', '#5a5a6a'], basicName: 'Deathblade', charged: [chargedLeap, 'Lich Drop'], dash: ['dash', 'Death Charge'], s1: ['frostLine', 'Death Grip'], s2: ['drain', 'Soul Siphon'], blurb: 'Roots a whole line with Death Grip, then siphons life to keep fighting.' }),
  H({ id: 'shaman', name: 'Snow Shaman', en: 'Snow Shaman', role: 'support', el: 'ice', weapon: 'staff', head: 'furhood', colors: ['#6a8aaa', '#3a4050', '#e8f0f8'], third: 'pierce', basicName: 'Ice Bolts', charged: [chargedBeam, 'Frost Ray'], dash: ['roll'], s1: ['storm', 'Blizzard'], s2: ['turret', 'Ice Totem'], blurb: 'Locks down areas with blizzards and keeps enemies slowed with ice totems.' }),
  H({ id: 'tinker', name: 'Tinker', en: 'Tinker', role: 'mage', el: 'arcane', weapon: 'orb', head: 'helm', colors: ['#8a6a3a', '#3a3a40', '#a8a8b8'], basicName: 'Energy Bolts', charged: [chargedFan, 'Scatter Barrage'], dash: ['roll', 'Spring Hop'], s1: ['trap', 'Arcane Mine'], s2: ['turret', 'Auto Turret'], blurb: 'Controls the battlefield with mines and turrets.' }),
  H({ id: 'moon', name: 'Moon Archer', en: 'Moon Archer', role: 'marksman', el: 'arcane', weapon: 'bow', head: 'ears', colors: ['#5a4a9a', '#2a2a40', '#d8d0f0'], basicName: 'Moonlight Arrows', charged: [chargedBeam, 'Lunar Arrow'], dash: ['roll', 'Moon Step'], s1: ['frostLine', 'Moonbind'], s2: ['stealth', 'Moon Veil'], blurb: 'Roots a line with moonlight, vanishes, then lands a lethal shot.' }),
  H({ id: 'monk', name: 'Monk', en: 'Monk', role: 'fighter', el: 'wind', weapon: 'fist', head: 'hair', colors: ['#d88a2a', '#5a3a20', '#2a2a2a'], basicName: 'Flurry Fists', charged: [chargedQuake, 'Earth Palm'], dash: ['dash', 'Wind Stride'], s1: ['whirlwind', 'Cyclone Kick'], s2: ['dashStrike', 'Dragon Kick'], blurb: 'A four-hit fist flurry, a flying dragon kick to engage and a cyclone kick to finish.' }),
  H({ id: 'gorgon', name: 'Gorgon', en: 'Gorgon', role: 'marksman', el: 'poison', weapon: 'bow', head: 'hair', colors: ['#3a7a5a', '#2a3a30', '#5a9a4a'], basicName: 'Fang Arrows', charged: [chargedFan, 'Serpent Volley'], dash: ['roll', 'Slither'], s1: ['poison', 'Venom Mist'], s2: ['knives', 'Scale Knives'], blurb: 'Stacks venom with mist and scale knives. The longer the fight, the stronger she gets.' }),
  H({ id: 'brew', name: 'Brewmaster', en: 'Brewmaster', role: 'tank', el: 'earth', weapon: 'hammer', head: 'ears', colors: ['#7a5a3a', '#e8e0d0', '#2a2a2a'], basicName: 'Keg Smash', charged: [chargedSpin, 'Drunken Spin'], dash: ['roll', 'Drunken Step'], s1: ['aura', 'Brew Aura'], s2: ['novaLeap', 'Tipsy Hop'], blurb: 'Burns enemies with a brew aura and hops away from focus fire.' }),
  H({ id: 'chrono', name: 'Chronomancer', en: 'Chronomancer', role: 'support', el: 'arcane', weapon: 'orb', head: 'crown', colors: ['#c8a84a', '#3a3040', '#e8d8a0'], basicName: 'Time Bolts', charged: [chargedOrb, 'Singularity'], dash: ['blink', 'Time Jump'], s1: ['shield', 'Time Shield'], s2: ['chain', 'Chrono Chain'], blurb: 'Wraps allies in time shields and hits many targets with chained bolts.' }),
];

export const HEROES = Object.fromEntries(HERO_LIST.map((h) => [h.id, h]));
