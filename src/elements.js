// 12 种元素：颜色、名称、命中附加效果、音效
export const EL = {
  fire: { c: '#ff7a2f', c2: '#ffd27a', w: 'flame', on: { burn: { dps: 22, t: 2.5 } }, snd: 'fire' },
  ice: { c: '#8fe3ff', c2: '#e6fbff', w: 'frost', on: { slow: { amt: 0.35, t: 1.5 } }, snd: 'ice' },
  lightning: { c: '#a98bff', c2: '#e6dbff', w: 'storm', on: { slow: { amt: 0.2, t: 0.8 } }, snd: 'zap' },
  poison: { c: '#9be24a', c2: '#e2ffb0', w: 'venom', on: { burn: { dps: 20, t: 3, color: '#9be24a' } }, snd: 'fire' },
  holy: { c: '#ffe58a', c2: '#fffbe0', w: 'holy', on: {}, snd: 'ready' },
  shadow: { c: '#b061ff', c2: '#e2c4ff', w: 'shadow', on: {}, snd: 'blink' },
  nature: { c: '#7ddc6a', c2: '#d8ffc8', w: 'thorn', on: { slow: { amt: 0.2, t: 1 } }, snd: 'arrow' },
  blood: { c: '#ff4a6a', c2: '#ffc2cf', w: 'blood', on: {}, snd: 'heavy' },
  earth: { c: '#d9a35a', c2: '#ffe2b0', w: 'earth', on: {}, snd: 'heavy' },
  wind: { c: '#9ff5dc', c2: '#effff9', w: 'wind', on: {}, snd: 'dash' },
  water: { c: '#4ab8ff', c2: '#d6f0ff', w: 'tidal', on: { slow: { amt: 0.25, t: 1.2 } }, snd: 'ice' },
  arcane: { c: '#d48cff', c2: '#f6e2ff', w: 'arcane', on: {}, snd: 'bolt' },
};
