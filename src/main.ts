import './style.css';
import { BOON_COLORS, boonById, stacksOf, type Boon, type Held } from './boons/defs';
import { Game, type Hud, type ShopView } from './game/game';
import { modDef, type ModId } from './board/mods';
import { label } from './gen/roads';
import { actOf } from './gen/escape';
import { OneButton } from './game/input';
import { buildFloor } from './gen/descent';
import { StreetView } from './render/scene';
import { FX, initFx } from './render/fx-settings';
import { SkaterRig } from './render/skater-rig';
import { loadModels } from './render/models';
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

function modKind(id: ModId | null): string {
  return id ? modDef(id).kind : 'empty';
}

// a board slot: the mod's short name, coloured by trigger or effect
function slot(id: ModId | null, i: number, cls = ''): string {
  return `<button class="slot ${modKind(id)} ${cls}" data-slot="${i}">${id ? esc(modDef(id).short) : ''}</button>`;
}

function shopHtml(v: ShopView): { slots: string; stock: string; hint: string } {
  const { shop, picked } = v;
  const sel = (i: number) => (picked && 'slot' in picked && picked.slot === i ? 'picked' : picked && 'stock' in picked ? 'target' : '');
  let slots = shop.board.map((id, i) => slot(id, i, sel(i))).join('<i class="arrow">›</i>');
  if (shop.board.length < v.maxSlots) {
    slots += `<button class="slot add" data-buyslot ${shop.cash < v.slotPrice ? 'disabled' : ''}>+ SLOT<small>$${v.slotPrice}</small></button>`;
  }
  const stock = shop.stock
    .map((id, i) => {
      if (!id) return `<div class="mod sold">SOLD</div>`;
      const m = modDef(id);
      const on = picked && 'stock' in picked && picked.stock === i ? 'picked' : '';
      const poor = shop.cash < m.price ? 'poor' : '';
      return `<button class="mod ${m.kind} ${on} ${poor}" data-stock="${i}">
        <span class="kind">${m.kind === 'trigger' ? 'TRIGGER' : 'EFFECT'}</span>
        <b>${esc(m.name)}</b><span class="text">${esc(m.text)}</span><span class="price">$${m.price}</span>
      </button>`;
    })
    .join('');
  const hint = !picked
    ? 'Tap a mod, then a slot to put it in · tap two slots to swap · triggers fire the effects to their right'
    : 'stock' in picked
      ? `Tap a slot for ${modDef(shop.stock[picked.stock]!).name}`
      : 'Tap another slot to swap';
  return { slots, stock, hint };
}

function makeHud(): Hud {
  const floorEl = document.getElementById('floortext')!;
  const calloutEl = document.getElementById('callout')!;
  const debugEl = document.getElementById('debug')!;
  const boonsEl = document.getElementById('boons')!;
  const pickEl = document.getElementById('pick')!;
  const overEl = document.getElementById('over')!;
  const appEl = document.getElementById('app')!;
  const warnEl = document.getElementById('warn')!;
  const cashEl = document.getElementById('cash')!;
  const stokenEl = document.getElementById('stoken')!;
  const scoreEl = document.getElementById('score')!;
  const comboEl = document.getElementById('combo')!;
  const stokeEl = document.getElementById('stoke')!;
  const stokeFill = stokeEl.querySelector('i')!;
  const roadEl = document.getElementById('road')!;
  const boardEl = document.getElementById('board')!;
  const shopEl = document.getElementById('shop')!;
  let level = 0;
  let held: Held[] = [];
  let timer = 0;
  return {
    floor: (n, road) => {
      floorEl.textContent = road.kind === 'escape' ? `ACT ${road.act} ESCAPE` : `ACT ${actOf(n)} · FLOOR ${n}`;
      roadEl.textContent = label(road);
      roadEl.dataset.kind = road.kind;
    },
    money: (cash, stoken) => {
      cashEl.textContent = `$${cash}`;
      stokenEl.textContent = `◆ ${stoken}`;
    },
    score: (score, combo, stoke, gnar) => {
      scoreEl.textContent = score.toLocaleString();
      comboEl.textContent = combo > 1 ? `x${combo}` : '';
      stokeFill.style.width = `${Math.round((gnar > 0 ? gnar : stoke) * 100)}%`;
      stokeEl.classList.toggle('gnar', gnar > 0);
    },
    callout: (text, kind = 'trick') => {
      calloutEl.textContent = text;
      calloutEl.className = `show ${kind}`;
      clearTimeout(timer);
      timer = window.setTimeout(() => (calloutEl.className = ''), 900);
    },
    debug: (text) => (debugEl.textContent = text),
    heat: (value) => {
      //escalation steps: 50 lights, 75 drone, 90 the screen edge pulses and the phone buzzes once
      const next = value >= 90 ? 3 : value >= 75 ? 2 : value >= 50 ? 1 : 0;
      if (next === level) return;
      if (next === 3) navigator.vibrate?.([60, 60, 60]);
      appEl.dataset.heat = String(next);
      level = next;
    },
    warn: (show) => (warnEl.hidden = !show),
    board: (slots) => {
      boardEl.innerHTML = slots.some(Boolean) ? slots.map((id) => `<span class="slot ${modKind(id)}">${id ? esc(modDef(id).short) : ''}</span>`).join('') : '';
    },
    fire: (i) => {
      const el = boardEl.children[i] as HTMLElement | undefined;
      if (!el) return;
      el.classList.remove('fire');
      void el.offsetWidth; // restart the flash
      el.classList.add('fire');
    },
    shop: (v) => {
      shopEl.hidden = !v;
      if (!v) return;
      const h = shopHtml(v);
      shopEl.querySelector('.slots')!.innerHTML = h.slots;
      shopEl.querySelector('.stock')!.innerHTML = h.stock;
      shopEl.querySelector('.hint')!.textContent = h.hint;
      shopEl.querySelector('.cash')!.textContent = `$${v.shop.cash}`;
      const re = shopEl.querySelector<HTMLButtonElement>('.restock')!;
      re.textContent = `RESTOCK $${v.restockPrice}`;
      re.disabled = v.shop.cash < v.restockPrice;
    },
    boons: (h) => {
      held = h;
      boonsEl.innerHTML = h.map(chip).join('');
    },
    pick: (offer, info) => {
      pickEl.hidden = !offer;
      if (!offer) return;
      pickEl.querySelector('.cards')!.innerHTML = offer.map((b, i) => card(b, i, held)).join('');
      if (info) {
        pickEl.querySelector('.title')!.textContent = info.title;
        const btn = pickEl.querySelector<HTMLButtonElement>('.reroll')!;
        btn.textContent = `REROLL $${info.rerollCost}`;
        btn.disabled = !info.canReroll;
      }
    },
    over: (result) => {
      overEl.hidden = !result;
      if (!result) return;
      overEl.classList.toggle('won', result.won);
      overEl.querySelector('b')!.textContent = result.won ? 'YOU ESCAPED!' : result.caught ? 'BUSTED' : 'BAILED';
      overEl.querySelector('.reached')!.textContent = result.won
        ? `Out of the city in ${result.floor} floors · escape #${result.wins}`
        : `You made it to act ${result.act}, floor ${result.floor}`;
      overEl.querySelector('.final')!.textContent = `${result.score.toLocaleString()}${result.newBest ? ' · NEW BEST' : ''}`;
      overEl.querySelector('.best')!.textContent = `best ${result.best.toLocaleString()} · ◆ ${result.stoken} Stoken this run (${result.bank} banked)`;
      overEl.querySelector('.held')!.innerHTML = result.boons.length ? result.boons.map(chip).join('') : '<span class="none">no boons</span>';
    },
  };
}

async function start() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const params = new URLSearchParams(location.search);
  initFx(params, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  document.getElementById('app')!.classList.toggle('noflash', FX.reduceFlashing);
  const fixedSeed = Number(params.get('seed')) || 0;
  const seed = fixedSeed || Math.floor(Math.random() * 1e6);

  await Promise.all([loadCityTiles(`${base}tex/chicago_tiles.png`), loadModels(base)]);
  const view = new StreetView(canvas, buildFloor(seed, 1));
  await view.loadBackdrop(base);
  const sprite = await SkaterRig.create(base);
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
