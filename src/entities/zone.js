// 持续区域效果：火焰轨迹、雷暴领域、冰霜陷阱、环身火焰等
export class Zone {
  constructor(game, o) {
    this.game = game;
    this.alive = true;
    this.radius = 60;
    this.life = 1;
    this.tick = 0.5;
    this.tickT = 0;
    this.kind = 'generic';
    this.follow = null;
    this.onTick = null;
    this.onUpdate = null;
    this.onEnd = null;
    this.age = 0;
    Object.assign(this, o);
    this.team = this.owner.team;
    this.max = this.life;
  }

  update(dt) {
    this.age += dt;
    this.life -= dt;
    if (this.follow) {
      if (!this.follow.alive) { this.end(); return; }
      this.x = this.follow.x;
      this.y = this.follow.y;
    }
    this.onUpdate?.(this, dt);
    if (!this.alive) return;
    if (this.onTick) {
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT += this.tick;
        this.onTick(this);
      }
    }
    if (this.life <= 0) this.end();
  }

  end() {
    if (!this.alive) return;
    this.alive = false;
    this.onEnd?.(this);
  }
}
