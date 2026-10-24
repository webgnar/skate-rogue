import '@fontsource/bangers/latin-400.css';
import './style.css';
import { boonById, boonColor, CURSE_COLOR, stacksOf, type Boon, type Held } from './boons/defs';
import { Game, type Hud, type ShopView } from './game/game';
import type { UnderView } from './run/spot';
import { GEAR, GEAR_PARTS, wornness, type Gear } from './run/gear';
import { modDef, type ModId } from './board/mods';
import { HudView } from './ui/hud';
import { OneButton } from './game/input';
import { buildFloor } from './gen/descent';
import { StreetView } from './render/scene';
import { FX, initFx } from './render/fx-settings';
import { isBiome } from './render/biomes';
import { props } from './render/props';
import { SkaterRig, isSkater } from './render/skater-rig';
import { dailySeed, dayKey, FULL_LIBRARY, has, libraryOf, type UnlockId } from './run/meta';
import { loadSave, writeSave } from './run/save';
import { GNAR_RULES, gnarOpen, MAX_GNAR } from './run/gnar';
import { MetaScreen } from './ui/meta-screen';
import { BoardPanel } from './ui/board-panel';
import { loadModels } from './render/models';
import { loadCityTiles } from './render/textures';
import { Sound } from './audio/sound';
import { buzz, loadSettings } from './ui/settings';
import { SettingsPanel } from './ui/settings-panel';

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
        <span class="kind">${m.kind === 'trigger' ? 'TRIGGER' : m.kind === 'modifier' ? 'MODIFIER' : 'EFFECT'}</span>
        <b>${esc(m.name)}</b><span class="text">${esc(m.text)}</span><span class="price">$${m.price}</span>
      </button>`;
    })
    .join('');
  const hint = !picked
    ? 'Tap a mod, then a slot to put it in · tap two slots to swap · triggers fire the effects to their right · a modifier changes the next effect'
    : 'stock' in picked
      ? `Tap a slot for ${modDef(shop.stock[picked.stock]!).name}`
      : 'Tap another slot to swap';
  return { slots, stock, hint };
}

// the shop's gear row: a bar per part, green to red as it wears (the HUD's bars are in src/ui/hud.ts)
function gearTone(c: number): string {
  return c <= GEAR.busted ? 'busted' : wornness(c) > 0 ? 'worn' : 'fresh';
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
  const calloutEl = document.getElementById('callout')!;
  const debugEl = document.getElementById('debug')!;
  const boonsEl = document.getElementById('boons')!;
  const pickEl = document.getElementById('pick')!;
  const overEl = document.getElementById('over')!;
  const appEl = document.getElementById('app')!;
  const warnEl = document.getElementById('warn')!;
  const shopEl = document.getElementById('shop')!;
  const underEl = document.getElementById('under')!;
  const pausedEl = document.getElementById('paused')!;
  const hintEl = document.getElementById('hint')!;
  const view = new HudView();
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
      view.setFloor(n, road);
      hintEl.hidden = n > 1; // the controls line only on the first floor
    },
    money: (cash, stoken) => view.money(cash, stoken),
    score: (score, combo, stoke, gnar, pending) => view.setScore(score, combo, stoke, gnar, pending),
    callout: (text, kind = 'trick') => {
      calloutEl.textContent = text;
      calloutEl.className = `show ${kind}`;
      clearTimeout(timer);
      timer = window.setTimeout(() => (calloutEl.className = ''), 900);
    },
    debug: (text) => (debugEl.textContent = text),
    heat: (value) => {
      view.setHeat(value);
      //escalation steps: 50 lights, 75 drone, 90 the screen edge pulses and the phone buzzes once
      const next = value >= 90 ? 3 : value >= 75 ? 2 : value >= 50 ? 1 : 0;
      if (next === level) return;
      if (next === 3) buzz([60, 60, 60]);
      appEl.dataset.heat = String(next);
      level = next;
    },
    warn: (show) => (warnEl.hidden = !show),
    board: (slots) => view.board(slots),
    fire: (i) => view.fire(i),
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
    gear: (g) => view.gear(g),
    pause: (on) => {
      pausedEl.hidden = !on;
      if (on) pausedEl.querySelector('.held')!.innerHTML = held.length ? held.map(chip).join('') : '<span class="none">no boons yet</span>';
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
      overEl.querySelector('.best')!.textContent += result.daily
        ? ` · today's daily best ${result.daily.best.toLocaleString()}${result.daily.newBest ? ' (NEW)' : ''}`
        : '';
      overEl.querySelector('.held')!.innerHTML = result.boons.length ? result.boons.map(chip).join('') : '<span class="none">no boons</span>';
    },
  };
}

async function start() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const params = new URLSearchParams(location.search);
  initFx(params, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  loadSettings();
  const look = () => {
    document.getElementById('app')!.classList.toggle('noflash', FX.reduceFlashing);
    document.getElementById('app')!.classList.toggle('calm', FX.reduceMotion);
  };
  look();
  //the meta tree: what's unlocked, and the skater and deck you ride (?unlockall opens everything for testing)
  const save = loadSave();
  const all = params.has('unlockall');
  const owns = (id: UnlockId) => all || has(save.unlocked, id);
  const daily = params.has('daily') && owns('daily');
  const fixedSeed = daily ? dailySeed() : Number(params.get('seed')) || 0;
  const seed = fixedSeed || Math.floor(Math.random() * 1e6);

  await Promise.all([loadCityTiles(`${base}tex/chicago_tiles.png`), loadModels(base)]);
  const view = new StreetView(canvas, buildFloor(seed, 1));
  await view.loadBackdrop(base);
  //?skater=webster (keanu, roxy, goldie) rides one without unlocking it
  const urlSkater = params.get('skater');
  const skater = isSkater(urlSkater) ? urlSkater : owns(save.skater) ? save.skater : 'lou-gnar';
  const deck = owns(save.deck) ? save.deck : 'popsicle';
  const sprite = await SkaterRig.create(base, skater);
  const input = new OneButton(document.getElementById('app')!);
  const startAt = Math.max(1, Math.floor(Number(params.get('floor')) || 1));
  //a new phone starts on the tutorial floor (?tutorial shows it again; a test URL skips it)
  const testing = ['floor', 'seed', 'biome', 'daily', 'gnar'].some((k) => params.has(k));
  const tutorial = params.has('tutorial') || (!save.tutorialDone && save.best === 0 && !testing);
  //the Gnar level: what the save picked, up to what's been won (?gnar=3 forces one for testing); never on a daily run
  const urlGnar = params.get('gnar');
  const open = all ? MAX_GNAR : gnarOpen(save.wins, save.gnar);
  const gnar = daily || tutorial ? 0 : urlGnar !== null ? Math.min(MAX_GNAR, Math.max(0, Number(urlGnar) || 0)) : Math.min(save.gnarPick, open);
  const library = all ? FULL_LIBRARY : libraryOf(save.unlocked);
  //the leaderboards: every finished run posts itself (once there's a tag); a daily run also goes on today's board
  const scores = new BoardPanel(document.getElementById('scores')!, document.querySelector<HTMLElement>('#over [data-scores]')!);
  const day = daily ? dayKey() : undefined;
  const hud = makeHud();
  const showOver = hud.over;
  hud.over = (result) => {
    showOver(result);
    if (result) void scores.runEnded({ score: result.score, floor: result.floor, ...(day ? { day } : {}), ...(gnar ? { gnar } : {}) });
  };
  const game = new Game(seed, fixedSeed > 0, view, sprite, input, hud, startAt, { loadout: { skater, deck }, library, daily, tutorial, gnar });
  //?debug exposes the game for headless checks
  if (params.has('debug')) Object.assign(window, { game, props });
  const biome = params.get('biome');
  if (isBiome(biome)) game.setBiome(biome);
  //pause: the button, Esc or P, and whenever the page is hidden. The buttons stop their press reaching the one
  //button, so pausing and resuming never ollie.
  const tapOnly = (id: string, fn: () => void) => {
    const el = document.getElementById(id)!;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      fn();
    });
  };
  tapOnly('pausebtn', () => game.setPaused(true));
  //between runs: the unlock tree, and the daily run once it's unlocked. A change reloads into the new setup.
  const reloadWith = (key: string, on: boolean) => {
    const q = new URLSearchParams(location.search);
    if (on) q.set(key, '');
    else q.delete(key);
    location.search = q.toString().replace(/=(&|$)/g, '$1');
  };
  const metaScreen = new MetaScreen(document.getElementById('meta')!, all, (changed) => {
    //the new skater or deck is picked up from the save, so a ?skater= in the link would only override it
    if (changed) reloadWith('skater', false);
  });
  const dailyBtn = document.querySelector<HTMLElement>('#over [data-daily]')!;
  dailyBtn.hidden = !owns('daily') && !daily;
  dailyBtn.textContent = daily ? 'NORMAL RUN' : 'DAILY RUN';
  document.querySelector('#over .metarow')!.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest('[data-open-meta]')) metaScreen.open();
    else if (t?.closest('[data-scores]')) void scores.open();
    else if (t?.closest('[data-daily]')) reloadWith('daily', !daily);
    else if (t?.closest('[data-gnar]')) {
      //the next level up, wrapping to a normal run; it starts on the next reload
      writeSave({ ...loadSave(), gnarPick: (gnar + 1) % (open + 1) });
      reloadWith('gnar', false);
    }
  });
  const gnarBtn = document.querySelector<HTMLElement>('#over [data-gnar]')!;
  gnarBtn.hidden = open === 0 || daily;
  gnarBtn.textContent = gnar ? `GNAR ${gnar}` : 'GNAR OFF';
  if (gnar) {
    document.querySelector<HTMLElement>('#over [data-gnar-rules]')!.textContent = GNAR_RULES.slice(0, gnar).map((r) => r.name).join(' · ');
    hud.callout(`GNAR ${gnar}: ${GNAR_RULES[gnar - 1].name}`, 'bad');
  }
  tapOnly('resume', () => game.setPaused(false));
  tapOnly('quitrun', () => game.quitRun());
  //sound starts on the first press (browsers need a tap first); the pause card's settings change it live
  const sound = new Sound(base);
  game.sound = sound;
  const unlock = () => sound.unlock();
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  new SettingsPanel(document.querySelector<HTMLElement>('#paused .settings')!, {
    volumes: () => sound.applyVolumes(),
    tier: (tier) => view.setTier(tier),
    look,
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.setPaused(true);
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') game.setPaused(!game.paused);
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') game.choose(Number(e.code.slice(5)) - 1);
  });

  const resize = () => view.resize();
  window.addEventListener('resize', resize);
  resize();
  document.getElementById('seed')!.textContent = (daily ? `daily · seed ${seed}` : `seed ${seed}`) + (gnar ? ` · gnar ${gnar}` : '');
  document.querySelector('#paused .seed')!.textContent = `seed ${seed}` + (gnar ? ` · gnar ${gnar}: ${GNAR_RULES.slice(0, gnar).map((r) => r.name).join(', ')}` : '');
  document.getElementById('app')!.classList.toggle('debug', params.has('debug'));
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
