// Wires a run together: floors from the generator, the fixed-step skater, input, the view and the HUD.
import { makeLayout } from '../gen/layout';

import { buildLevel, type Level } from '../physics/level';
import { Skater } from '../physics/skater';
import { StreetView } from '../render/scene';
import { SkaterSprite, TRICKS, TRICK_NAMES } from '../render/skater-sprite';
import { toX, toY } from '../render/kit';
import { OneButton } from './input';
import { FixedStep } from './loop';

export interface Hud {
  floor(n: number): void;
  callout(text: string, kind?: 'trick' | 'good' | 'bad'): void;
  bail(show: boolean): void;
  debug(text: string): void;
}

export class Game {
  private level: Level;
  private skater: Skater;
  private prev = { x: 0, y: 0 };
  private loop = new FixedStep();
  private floor = 1;
  private last = performance.now();
  private combo = 0;

  constructor(
    private readonly seed: number,
    private readonly view: StreetView,
    private readonly sprite: SkaterSprite,
    private readonly input: OneButton,
    private readonly hud: Hud,
  ) {
    this.level = this.makeLevel();
    this.skater = new Skater(this.level);
    this.view.scene.add(this.sprite.mesh);
    this.startFloor();
  }

  private makeLevel(): Level {
    return buildLevel(makeLayout(this.seed, this.floor));
  }

  private startFloor(): void {
    this.skater = new Skater(this.level);
    this.prev = { x: this.skater.x, y: this.skater.y };
    this.view.setLevel(this.level);
    this.view.follow(this.skater.x, this.skater.y, this.skater.hsp, true);
    this.sprite.play('push');
    this.hud.floor(this.floor);
    this.hud.bail(false);
    this.combo = 0;
  }

  frame(now: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    if (this.skater.mode === 'bail') {
      //one press: try the same floor again
      if (this.input.takePress()) this.startFloor();
    } else {
      this.loop.advance(dt, () => {
        this.prev = { x: this.skater.x, y: this.skater.y };
        this.skater.step(this.input.sample());
        for (const e of this.skater.events) this.handle(e);
        this.skater.events.length = 0;
      });
    }

    if (this.skater.mode === 'exit') {
      this.floor++;
      this.level = this.makeLevel();
      this.startFloor();
      this.hud.callout(`FLOOR ${this.floor}`, 'good');
    }

    const a = this.loop.alpha;
    const x = this.prev.x + (this.skater.x - this.prev.x) * a;
    const y = this.prev.y + (this.skater.y - this.prev.y) * a;
    this.sprite.mesh.position.x = toX(x);
    this.sprite.mesh.position.y = toY(this.level, y);
    const angle = this.skater.mode === 'rail' ? Math.atan2(-this.skater.vsp, this.skater.hsp) : 0;
    this.sprite.update(dt * 1000, this.skater, angle);
    this.view.follow(x, y, this.skater.hsp);
    this.view.adapt(dt * 1000);
    this.view.render();
    this.hud.debug(`${Math.round(1 / Math.max(dt, 1e-3))} fps · ${this.skater.hsp.toFixed(1)} px/f · res ${this.view.resolution.toFixed(2)}`);
  }

  private handle(e: (typeof this.skater.events)[number]): void {
    this.sprite.onEvent(e);
    switch (e.type) {
      case 'trick':
        this.combo++;
        this.hud.callout(TRICK_NAMES[TRICKS[e.index % TRICKS.length]] + (this.combo > 1 ? ` x${this.combo}` : ''), 'trick');
        break;
      case 'grind':
        this.combo++;
        this.hud.callout('50-50', 'trick');
        break;
      case 'rail':
        this.combo++;
        this.hud.callout('BOARDSLIDE', 'trick');
        break;
      case 'hop':
        this.combo++;
        this.hud.callout('CAR HOP!', 'good');
        break;
      case 'land':
        this.combo = 0;
        break;
      case 'slam':
        this.combo = 0;
        this.hud.callout('SLAM!', 'bad');
        break;
      case 'bail':
        this.hud.bail(true);
        break;
    }
  }
}


