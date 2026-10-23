import './style.css';
import { BOON_COLORS, boonById, stacksOf, type Boon, type Held } from './boons/defs';
import { Game, type Hud } from './game/game';
import { OneButton } from './game/input';
import { makeLayout } from './gen/layout';
import { buildLevel } from './physics/level';
import { StreetView } from './render/scene';
import { SkaterSprite } from './render/skater-sprite';
import { loadCityTiles } from './render/textures';

const base = import.meta.env.BASE_URL;

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function chip(h: Held): string {
  const b = boonById(h.id);
  const n = h.stacks > 1 ? ` ×${h.stacks}` : '';
  return `<span class="chip" style="--type:${BOON_COLORS[b.type]}">${esc(b.name)}${n}</span>`;
}

// a boon card in QFS's layout: type label, name, effect, small line, stacks
function card(b: Boon, i: number, held: Held[]): string {
  const have = stacksOf(held, b.id);
  const pips = Array.from({ length: b.max }, (_, k) => `<i class="${k < have ? 'on' : k === have ? 'new' : ''}"></i>`).join('');
  return `<button class="card" data-pick="${i}" style="--type:${BOON_COLORS[b.type]}">
    <span class="type">${b.type}</span>
    <b class="name">${esc(b.name)}</b>
    <span class="effect">${esc(b.effect)}</span>
    ${b.note ? `<span class="note">${esc(b.note)}</span>` : ''}
    <span class="pips">${pips}</span>
    <span class="key">${i + 1}</span>
  </button>`;
}

function makeHud(): Hud {
  const floorEl = document.getElementById('floor')!;
  const calloutEl = document.getElementById('callout')!;
  const debugEl = document.getElementById('debug')!;
  const boonsEl = document.getElementById('boons')!;
  const pickEl = document.getElementById('pick')!;
  const overEl = document.getElementById('over')!;
  let held: Held[] = [];
  let timer = 0;
  return {
    floor: (n) => (floorEl.textContent = `FLOOR ${n}`),
    callout: (text, kind = 'trick') => {
      calloutEl.textContent = text;
      calloutEl.className = `show ${kind}`;
      clearTimeout(timer);
      timer = window.setTimeout(() => (calloutEl.className = ''), 900);
    },
    debug: (text) => (debugEl.textContent = text),
    boons: (h) => {
      held = h;
      boonsEl.innerHTML = h.map(chip).join('');
    },
    pick: (offer) => {
      pickEl.hidden = !offer;
      if (offer) pickEl.querySelector('.cards')!.innerHTML = offer.map((b, i) => card(b, i, held)).join('');
    },
    over: (result) => {
      overEl.hidden = !result;
      if (!result) return;
      overEl.querySelector('.reached')!.textContent = `You made it to floor ${result.floor}`;
      overEl.querySelector('.held')!.innerHTML = result.boons.length ? result.boons.map(chip).join('') : '<span class="none">no boons</span>';
    },
  };
}

async function start() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const params = new URLSearchParams(location.search);
  const fixedSeed = Number(params.get('seed')) || 0;
  const seed = fixedSeed || Math.floor(Math.random() * 1e6);

  await loadCityTiles(`${base}tex/chicago_tiles.png`);
  const view = new StreetView(canvas, buildLevel(makeLayout(seed, 1)));
  await view.loadBackdrop(base);
  const sprite = await SkaterSprite.create(base);
  const input = new OneButton(document.getElementById('app')!);
  const game = new Game(seed, fixedSeed > 0, view, sprite, input, makeHud());
  //?debug exposes the game for headless checks
  if (params.has('debug')) (window as unknown as { game: Game }).game = game;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') game.choose(Number(e.code.slice(5)) - 1);
  });

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
