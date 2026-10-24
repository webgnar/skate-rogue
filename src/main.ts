import './style.css';
import { boonById, boonColor, CURSE_COLOR, stacksOf, type Boon, type Held } from './boons/defs';
import { Game, type Hud, type ShopView } from './game/game';
import type { UnderView } from './run/spot';
import { GEAR, GEAR_PARTS, wornness, type Gear } from './run/gear';
import { modDef, type ModId } from './board/mods';
import { label } from './gen/roads';
import { actOf } from './gen/escape';
import { OneButton } from './game/input';
import { buildFloor } from './gen/descent';
import { StreetView } from './render/scene';
import { FX, initFx } from './render/fx-settings';
import { isBiome } from './render/biomes';
import { props } from './render/props';
import { SkaterRig, isSkater } from './render/skater-rig';
import { loadModels } from './render/models';
import { loadCityTiles } from './render/textures';

const base = import.meta.env.BASE_URL;

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function chip(h: Held): string {
  const b = boonById(h.id);
  const n = h.stacks > 1 ? ` ×${h.stacks}` : '';
  return `<span class="chip" style="--type:${boonColor(b)}">${esc(b.name)}${n}</span>`;
}

// a boon card in QFS's layout: type label, name, effect, small line, stacks
function card(b: Boon, i: number, held: Held[]): string {
  const have = stacksOf(held, b.id);
  const pips = Array.from({ length: b.max }, (_, k) => `<i class="${k < have ? 'on' : k === have ? 'new' : ''}"></i>`).join('');
  const tag = b.cursed ? 'CURSED' : b.duo ? `DUO · ${b.duo.map((id) => boonById(id).name).join(' + ')}` : b.type;
  return `<button class="card${b.cursed ? ' cursed' : ''}" data-pick="${i}" style="--type:${boonColor(b)}">
    <span class="type">${esc(tag)}</span>
    <b class="name">${esc(b.name)}</b>
    <span class="effect">${esc(b.effect)}</span>
    ${b.note ? `<span class="note">${esc(b.note)}</span>` : ''}
    <span class="pips">${pips}</span>
    <span class="key">${i + 1}</span>
  </button>`;
}

// the underground spot's cards: a plain choice card, coloured, maybe greyed out
function choice(key: string, color: string, tag: string, name: string, effect: string, note: string, off = false): string {
  return `<button class="card${off ? ' off' : ''}" data-under="${key}" ${off ? 'disabled' : ''} style="--type:${color}">
    <span class="type">${tag}</span>
    <b class="name">${esc(name)}</b>
    <span class="effect">${esc(effect)}</span>
    <span class="note">${esc(note)}</span>
  </button>`;
}

function underCards(v: UnderView): string {
  if (v.step === 'drop') {
    return v.boons.map((h) => {
      const b = boonById(h.id);
      return choice(`drop:${h.id}`, boonColor(b), b.type, b.name, b.effect, h.stacks > 1 ? `drop one of ${h.stacks}` : 'drop it');
    }).join('');
  }
  if (v.step === 'lift') {
    return v.boons.map((h) => {
      const b = boonById(h.id);
      return choice(`lift:${h.id}`, CURSE_COLOR, 'CURSED', b.name, `${b.effect}, ${b.note ?? ''}`, 'lift it off');
    }).join('');
  }
  return [
    choice('low', '#7df0a0', 'HEAT', 'Lay low', 'Start the next floor at 0 Heat', `You're carrying ${v.heat} Heat`),
    choice('swap', '#4ad8ff', 'BOON', 'Swap a boon', 'Drop one of your boons, pick any type', v.canSwap ? 'Then a pick of 3' : 'No boons to swap yet', !v.canSwap),
    choice('curse', '#b98cff', 'CURSE', 'Remove a curse', 'Lift one cursed boon', v.curses ? `${v.curses} cursed` : 'No curses on you', !v.curses),
  ].join('');
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

// the gear strip and the shop's gear row: a bar per part, green to red as it wears
function gearTone(c: number): string {
  return c <= GEAR.busted ? 'busted' : wornness(c) > 0 ? 'worn' : 'fresh';
}

function gearStrip(g: Gear): string {
  return GEAR_PARTS.map((p) => `<span class="part ${gearTone(g[p])}" title="${GEAR.names[p]}: worn by ${GEAR.wornBy[p]}">
    ${GEAR.names[p].toUpperCase()}<i style="--c:${Math.round(g[p])}%"></i></span>`).join('');
}

function gearShop(g: Gear, cash: number): string {
  return GEAR_PARTS.map((p) => {
    const c = Math.round(g[p]);
    const off = c >= 100 || cash < GEAR.price[p];
    return `<button class="gearbuy ${gearTone(c)}" data-gear="${p}" ${off ? 'disabled' : ''}>
      <b>NEW ${GEAR.names[p].toUpperCase()}</b><span class="cond"><i style="--c:${c}%"></i>${c}%</span>
      <span class="text">worn by ${GEAR.wornBy[p]}</span><span class="price">${c >= 100 ? 'FRESH' : `$${GEAR.price[p]}`}</span>
    </button>`;
  }).join('');
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
  const underEl = document.getElementById('under')!;
  const gearEl = document.getElementById('gear')!;
  let gearKey = '';
  let level = 0;
  let held: Held[] = [];
  let timer = 0;
  //screen juice (src/style.css): the card you picked pops while the others fall away; the shop deals its stock in
  //once on opening, pops a slot that changed, and floats what you spent off the cash
  let chosen = -1;
  let pickTimer = 0;
  let shopOpen = false;
  let shopCash = 0;
  let shopSlots: string[] = [];
  pickEl.addEventListener('pointerdown', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
    if (c) chosen = Number(c.dataset.pick);
  });
  window.addEventListener('keydown', (e) => {
    if (/^Digit[123]$/.test(e.code)) chosen = Number(e.code.slice(5)) - 1;
  });
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
      if (!v) {
        shopOpen = false;
        return;
      }
      const h = shopHtml(v);
      if (!shopOpen) {
        shopOpen = true;
        shopCash = v.shop.cash;
        shopSlots = [];
        shopEl.classList.remove('opening');
        void shopEl.offsetWidth;
        shopEl.classList.add('opening');
      }
      const slotsEl = shopEl.querySelector('.slots')!;
      slotsEl.innerHTML = h.slots;
      const now = [...slotsEl.querySelectorAll('.slot')].map((el) => el.className.replace(/ ?(target|picked)/g, '') + el.textContent);
      slotsEl.querySelectorAll('.slot').forEach((el, i) => {
        if (shopSlots.length && shopSlots[i] !== now[i]) el.classList.add('pop');
      });
      shopSlots = now;
      if (v.shop.cash < shopCash) {
        const spent = document.createElement('span');
        spent.className = 'spent';
        spent.textContent = `-$${shopCash - v.shop.cash}`;
        shopEl.querySelector('.head')!.appendChild(spent);
        window.setTimeout(() => spent.remove(), 900);
      }
      shopCash = v.shop.cash;
      shopEl.querySelector('.stock')!.innerHTML = h.stock;
      shopEl.querySelector('.gearshop')!.innerHTML = gearShop(v.gear, v.shop.cash);
      shopEl.querySelector('.hint')!.textContent = h.hint;
      shopEl.querySelector('.cash')!.textContent = `$${v.shop.cash}`;
      const re = shopEl.querySelector<HTMLButtonElement>('.restock')!;
      re.textContent = `RESTOCK $${v.restockPrice}`;
      re.disabled = v.shop.cash < v.restockPrice;
    },
    gear: (g) => {
      //redrawn only when a part's whole percent changes
      const key = GEAR_PARTS.map((p) => Math.round(g[p])).join();
      if (key === gearKey) return;
      gearKey = key;
      gearEl.innerHTML = gearStrip(g);
    },
    boons: (h) => {
      held = h;
      boonsEl.innerHTML = h.map(chip).join('');
    },
    under: (v) => {
      underEl.hidden = !v;
      if (!v) return;
      underEl.querySelector('.sub')!.textContent = v.step === 'menu' ? 'A DIY spot under the expressway. Take one.' : v.step === 'lift' ? 'Lift which curse?' : 'Drop which boon?';
      underEl.querySelector('.cards')!.innerHTML = underCards(v);
    },
    pick: (offer, info) => {
      clearTimeout(pickTimer);
      pickEl.classList.remove('leaving');
      if (!offer) {
        //the picked card pops, the rest fall away, then the screen goes
        if (pickEl.hidden || FX.reduceMotion) {
          pickEl.hidden = true;
          return;
        }
        pickEl.querySelectorAll('.card').forEach((c, i) => c.classList.toggle('chosen', i === chosen));
        pickEl.classList.add('leaving');
        pickTimer = window.setTimeout(() => {
          pickEl.hidden = true;
          pickEl.classList.remove('leaving');
        }, 320);
        return;
      }
      pickEl.hidden = false;
      chosen = -1;
      pickEl.querySelector('.cards')!.innerHTML = offer.map((b, i) => card(b, i, held)).join('');
      if (info) {
        pickEl.querySelector('.title')!.textContent = info.title;
        const btn = pickEl.querySelector<HTMLButtonElement>('.reroll')!;
        btn.textContent = `REROLL $${info.rerollCost}`;
        btn.disabled = !info.canReroll;
        btn.hidden = info.rerollCost < 0; // no reroll on this pick
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
  document.getElementById('app')!.classList.toggle('calm', FX.reduceMotion);
  const fixedSeed = Number(params.get('seed')) || 0;
  const seed = fixedSeed || Math.floor(Math.random() * 1e6);

  await Promise.all([loadCityTiles(`${base}tex/chicago_tiles.png`), loadModels(base)]);
  const view = new StreetView(canvas, buildFloor(seed, 1));
  await view.loadBackdrop(base);
  //?skater=webster (keanu, roxy, goldie) until the deck shop unlocks them
  const skater = params.get('skater');
  const sprite = await SkaterRig.create(base, isSkater(skater) ? skater : undefined);
  const input = new OneButton(document.getElementById('app')!);
  const game = new Game(seed, fixedSeed > 0, view, sprite, input, makeHud());
  //?debug exposes the game for headless checks
  if (params.has('debug')) Object.assign(window, { game, props });
  const biome = params.get('biome');
  if (isBiome(biome)) game.setBiome(biome);
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
