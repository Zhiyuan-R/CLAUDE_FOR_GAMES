// 键盘输入 + 玩家控制器。控制器输出统一的指令结构，AI 控制器输出同样的结构。

const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Keyboard {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    addEventListener('keydown', (e) => {
      if (BLOCK.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
  }
  isDown(...codes) { return codes.some((c) => this.down.has(c)); }
  wasPressed(...codes) { return codes.some((c) => this.pressed.has(c)); }
  endFrame() { this.pressed.clear(); }
}

export const KEYMAP = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ'],
  charge: ['KeyK'],
  dash: ['Space', 'KeyL'],
  s1: ['KeyU', 'KeyQ'],
  s2: ['KeyI', 'KeyE'],
  mount: ['KeyR'],
  recall: ['KeyB'],
};

export const blankInput = () => ({ mx: 0, my: 0, attack: false, charge: false, dash: false, s1: false, s2: false, mount: false, recall: false, aim: null });

export class PlayerController {
  constructor(kb) { this.kb = kb; this.out = blankInput(); }
  read() {
    const k = this.kb, o = this.out;
    o.mx = (k.isDown(...KEYMAP.right) ? 1 : 0) - (k.isDown(...KEYMAP.left) ? 1 : 0);
    o.my = (k.isDown(...KEYMAP.down) ? 1 : 0) - (k.isDown(...KEYMAP.up) ? 1 : 0);
    o.attack = k.wasPressed(...KEYMAP.attack);
    o.charge = k.isDown(...KEYMAP.charge);
    o.dash = k.wasPressed(...KEYMAP.dash);
    o.s1 = k.wasPressed(...KEYMAP.s1);
    o.s2 = k.wasPressed(...KEYMAP.s2);
    o.mount = k.wasPressed(...KEYMAP.mount);
    o.recall = k.wasPressed(...KEYMAP.recall);
    o.aim = null;
    return o;
  }
}
