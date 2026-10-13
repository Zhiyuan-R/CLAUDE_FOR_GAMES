# Arcane Duel · Claude for Games

A 2.5D top-down **dungeon action MOBA**. The combat feel is inspired by *Wizard of Legend* and the map and rules by *League of Legends*. Everything is played on the keyboard: move with WASD and fight with combo attacks, charged attacks, dashes, skills and ultimates. No mouse required.

## Features

**Matches**
- **5v5**: you and 4 bot allies against 5 bots, with 9 bots in every match.

**Heroes**
- **30 heroes**, each with its own illustrated portrait.
- Every hero has:
  - a unique passive
  - two skills
  - an ultimate
  - its own basic attack, charged attack and dash

**Map and terrain**
- **A wide dungeon**: a 72×40-tile map with three lanes 5–6 tiles wide, four large jungle rooms, two boss lairs and a central plaza.
- **Terrain**:
  - **Bushes** hide you from enemies unless they get close or step into the same bush. Attacking reveals you.
  - **Spikes** rise periodically and glow red before they come up.
  - **Shallow water** slows movement by 30%.
  - **Explosive barrels** damage everyone nearby, friend or foe.

**Loot and mounts**
- **Loot** drops from jungle monsters, chests, bosses and hero kills. Walk over it to pick it up. Your bag holds 6 items.
- **Mounts**: 4 to choose from. Press R to summon one and ride.

## Running

The game is written for the HTML5 Canvas with **zero dependencies and no build step**. It uses ES modules, so serve it over HTTP:

```bash
python3 -m http.server 8000   # or: npm start
# then open http://localhost:8000
```

## Controls

| Key | Action |
|---|---|
| `W` `A` `S` `D` / arrow keys | 8-directional movement |
| `J` | Basic attack (tap repeatedly for a combo) |
| Hold `K` | Charge, release to unleash (full charge adds bonus effects) |
| `Space` / `L` | Dash (dash, blink or roll, with invulnerability frames) |
| `U` / `I` (or `Q` / `E`) | Skill 1 / Skill 2 |
| `O` | Ultimate (50–75s cooldown) |
| `R` | Summon or dismiss your mount (1s channel) |
| `B` | Recall to base (4s channel, interrupted by moving or taking damage) |
| `Esc` / `M` | Pause / mute |

Attacks **auto-aim** at enemies inside a cone in front of you, and walls block line of sight.

## Rules

**Towers**
- Each lane has an outer and an inner tower. An inner tower is invulnerable while its outer tower stands.
- Destroying any inner tower exposes the Nexus Crystal. Destroy the Nexus Crystal to win.

**Waves**
- All three lanes spawn 2 melee minions and 1 caster minion every 30s. Minions grow stronger with each wave.

**Jungle**
- Four camp types: skeleton warriors, gargoyles, cave spiders and shadow werewolves. Monsters chase whoever attacks them, then return home and heal if pulled too far.
- Chests respawn inside the jungle rooms.

**Bosses**
- **Abyssal Dragon**: +15% damage for the whole team.
- **Ancient Colossus**: +15% damage reduction and regeneration for the whole team.
- Both bosses telegraph their area attacks, and both drop epic or legendary gear.

**Gear**
- Four rarities: Common, Rare, Epic and Legendary.
- Stats include damage, HP, armor, cooldown reduction, attack speed, move speed, lifesteal and regen.
- When your bag is full, picking up an item only replaces lower-rarity gear.

**Mounts**

| Mount | Effect |
|---|---|
| Shadow Wolf | +75% move speed |
| War Boar | Rams enemies, knocking them up and stunning them |
| Raptor | Dashing doesn't dismount you |
| Spirit Stag | Regenerates HP while riding |

You dismount when you attack, cast or take damage.

**Bots**
- The 9 bots take the roles Top, Mid, Bot, Support and Jungle.
- They path through the dungeon with A*, rotate to team fights, jungle, open chests, pick up loot and ride mounts.
- When low, they retreat or recall. They also dodge skill shots, respect bush vision and use their ultimates when it counts.
- Three difficulty levels.

## Heroes

Heroes are assembled from building blocks in `src/skills.js`:

- **Basic attacks**: 3 types.
- **Charged attacks**: 7 types.
- **Dashes**: 3 types.
- **Skills**: 30 mechanics.
- **Ultimates**: 12 types.
- **Elements**: 12.
- **Passives**: 15, defined in `src/passives.js`.

| Role | Heroes |
|---|---|
| Tank | Magma Titan, Paladin, Frost Troll, Death Knight, Brewmaster |
| Fighter | Ember Knight, Berserker, Blood Count, Butcher, Thunder Lord, Desert Lancer, Monk |
| Assassin | Shadow Blade, Gale Assassin, Soul Hunter |
| Mage | Storm Mage, Plague Warlock, Tide Witch, Astral Sage, Pyromancer, Tinker |
| Marksman | Frost Ranger, Wind Walker, Arbalest, Moon Archer, Gorgon |
| Support | Holy Cleric, Grove Druid, Snow Shaman, Chronomancer |

To add a hero:

1. Add one `H({...})` line to `HERO_LIST` in `src/heroes.js`, picking a role, element, weapon, headgear, colors, charged type, dash type and two skills.
2. Add its passive and ultimate to the `EXTRA` table in the same file.

## Code layout

```
src/
  main.js          entry: menu (hero / mount / difficulty), main loop, pause and results
  game.js          match: teams and roles, waves, camps, chests, barrels, terrain, bush vision, loot, boss buffs, win condition
  map.js           dungeon grid (half authored, mirrored), terrain, lane paths, tower / camp spots, decorations
  nav.js           wall collision, line of sight, A* pathfinding with smoothing
  skills.js        basic / charged / 30 skills / 12 ultimates, parameterized by element
  passives.js      15 hero passives
  elements.js      12 elements
  heroes.js        the 30 hero definitions
  items.js         gear and rarities
  mounts.js        mounts
  ai.js            bot heroes
  combat.js        damage resolution (bonuses, armor, shields, lifesteal, crowd control) and hit tests
  entities/        Hero, Minion, Tower, Monster / Chest / Barrel, Pet, Projectile, Zone
  render/          ground pre-render, wall sprites, character / mount / monster art, portraits, lighting, HUD
tools/sim.js       headless 10-bot match simulation for catching errors and checking pacing
```

**How the 2.5D works**:
- Game logic runs on the ground plane `(x, y)` plus a height `z`. Everything is projected to `(x, y·0.62 − z)` for drawing.
- Dungeon walls are drawn per tile (top face plus brick front) and depth-sorted together with characters by `y`.
- Walls between you and the camera turn translucent.

## Debug URL parameters

- `?play`: skip the menu
- `&hero=pyro`: choose your hero
- `&difficulty=hard`: set bot difficulty
- `&mount=raptor`: choose your mount
- `&auto`: let a bot play your hero
- `&speed=3`: run faster

Example: `/index.html?play&auto&speed=3&hero=moon`

`npm run sim` runs complete headless 5v5 matches and prints winners, scores, towers taken, item counts and KDA.
