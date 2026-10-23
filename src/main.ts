import './style.css';
import { Game, type Hud } from './game/game';
import { OneButton } from './game/input';
import { makeLayout } from './gen/layout';
import { buildLevel } from './physics/level';
import { StreetView } from './render/scene';
import { SkaterSprite } from './render/skater-sprite';
import { loadCityTiles } from './render/textures';

const base = import.meta.env.BASE_URL;

function makeHud(): Hud {
  const floorEl = document.getElementById('floor')!;
  const calloutEl = document.getElementById('callout')!;
  const bailEl = document.getElementById('bail')!;
  const debugEl = document.getElementById('debug')!;
  let timer = 0;
  return {
    floor: (n) => (floorEl.textContent = `FLOOR ${n}`),
    callout: (text, kind = 'trick') => {
      calloutEl.textContent = text;
      calloutEl.className = `show ${kind}`;
      clearTimeout(timer);
      timer = window.setTimeout(() => (calloutEl.className = ''), 900);
    },
    bail: (show) => bailEl.classList.toggle('show', show),
    debug: (text) => (debugEl.textContent = text),
  };
}

async function start() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e6);

  await loadCityTiles(`${base}tex/chicago_tiles.png`);
  const view = new StreetView(canvas, buildLevel(makeLayout(seed, 1)));
  await view.loadBackdrop(base);
  const sprite = await SkaterSprite.create(base);
  const input = new OneButton(document.getElementById('app')!);
  const game = new Game(seed, view, sprite, input, makeHud());

  const resize = () => view.resize();
  window.addEventListener('resize', resize);
  resize();
  document.getElementById('seed')!.textContent = `seed ${seed}`;
  document.getElementById('loading')!.remove();

  const tick = (now: number) => {
    game.frame(now);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

start().catch((err) => {
  document.getElementById('loading')!.textContent = `Couldn't start: ${err}`;
  console.error(err);
});
