import { MOMENTUM, MOMENTUM_MODES, type MomentumMode } from './physics/feel';
import '@fontsource/bangers/latin-400.css';
import './style.css';
import { boonById, boonColor, CURSE_COLOR, stacksOf, type Boon, type Held } from './boons/defs';
import { Game, type Hud, type ShopView } from './game/game';
import type { UnderView } from './run/spot';
import { GEAR, wornness } from './run/gear';
import { modDef, type ModId } from './board/mods';
import { GEAR_ORDER, HudView } from './ui/hud';
import { bindShopDrag } from './ui/shop-drag';
import { gearArt, gearIcon, modArt, slotArt } from './ui/shop-art';
import { OneButton } from './game/input';
import { buildFloor } from './gen/descent';
import { StreetView } from './render/scene';
import { FX, initFx } from './render/fx-settings';
import { isBiome } from './render/biomes';
import { props } from './render/props';
import { SkaterRig, isSkater } from './render/skater-rig';
import { applyClipEdits } from './render/poses';
import { loadDrafts } from './editor/drafts';
import { loadLevelDrafts } from './levels/drafts';
import { useLevelEdits } from './gen/level-edits';
import { dailySeed, dayKey, FULL_LIBRARY, has, libraryOf, type UnlockId } from './run/meta';
import { loadSave, writeSave } from './run/save';
import { GNAR_RULES, gnarOpen, MAX_GNAR } from './run/gnar';
import { MetaScreen } from './ui/meta-screen';
import { BoardPanel } from './ui/board-panel';
import { loadLater, loadModels, missingModels } from './render/models';
import { parseBoons } from './bot/repro';
import { ACTS, FLOORS_PER_ACT } from './gen/escape';
import { DEV, loadDev, saveDev, slower, stepFrame } from './ui/dev';
import { DevPanel } from './ui/dev-panel';
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

const KIND_TAG = { trigger: 'TRIGGER', effect: 'EFFECT', modifier: 'MODIFIER' } as const;

// the skate shop as a card game (src/ui/shop-drag.ts): your setup across the top is where cards land, the hand of
// cards along the bottom is the stock
function shopHtml(v: ShopView): { slots: string; parts: string; hand: string; hint: string } {
  const { shop, picked } = v;
  const sel = (i: number) => (picked && 'slot' in picked && picked.slot === i ? 'picked' : picked && 'stock' in picked ? 'target' : '');
  const slots = shop.board.map((id, i) => slot(id, i, sel(i))).join('<i class="arrow">›</i>');
  const parts = GEAR_ORDER.map((p) => {
    const c = Math.round(v.gear[p]);
    return `<div class="part ${gearTone(c)}" data-part="${p}"><span class="icon">${gearIcon(p)}</span>
      <span class="name">${GEAR.names[p].toUpperCase()}</span><span class="cond"><i style="--c:${c}%"></i>${c}%</span></div>`;
  }).join('');
  const cards: string[] = shop.stock.map((id, i) => {
    if (!id) return `<div class="card-shop sold"><b>SOLD</b></div>`;
    const m = modDef(id);
    const on = picked && 'stock' in picked && picked.stock === i ? 'picked' : '';
    const poor = shop.cash < m.price ? 'poor' : '';
    return `<button class="card-shop mod ${m.kind} ${on} ${poor}" data-stock="${i}">
      <span class="kind">${KIND_TAG[m.kind]}</span><b>${esc(m.name)}</b>${modArt(id)}<span class="text">${esc(m.text)}</span><span class="price">$${m.price}</span>
    </button>`;
  });
  if (shop.board.length < v.maxSlots) {
    cards.push(`<button class="card-shop extra ${shop.cash < v.slotPrice ? 'poor' : ''}" data-buyslot>
      <span class="kind">BOARD</span><b>+1 SLOT</b>${slotArt()}<span class="text">Room for one more mod</span><span class="price">$${v.slotPrice}</span>
    </button>`);
  }
  for (const p of GEAR_ORDER) {
    const c = Math.round(v.gear[p]);
    if (c >= 100) continue; // only worn parts are for sale
    cards.push(`<button class="card-shop gearcard ${shop.cash < GEAR.price[p] ? 'poor' : ''}" data-gear="${p}">
      <span class="kind">GEAR</span><b>NEW ${GEAR.names[p].toUpperCase()}</b>${gearArt(p)}
      <span class="text">Yours is at ${c}%</span><span class="price">$${GEAR.price[p]}</span>
    </button>`);
  }
  const hint = !picked
    ? 'Drag a card onto your board or gear to buy it · drag slots to swap them · triggers fire the effects to their right'
    : 'stock' in picked
      ? `Drop or tap a slot for ${modDef(shop.stock[picked.stock]!).name}`
      : 'Tap another slot to swap';
  return { slots, parts, hand: cards.join(''), hint };
}

// the shop's gear tones: green to red as a part wears (the HUD's bars are in src/ui/hud.ts)
function gearTone(c: number): string {
  return c <= GEAR.busted ? 'busted' : wornness(c) > 0 ? 'worn' : 'fresh';
}

function makeHud(): Hud {
  const calloutEl = document.getElementById('callout')!;
  const debugEl = document.getElementById('debug')!;
  const boonsEl = document.getElementById('boons')!;
  const pickEl = document.getElementById('pick')!;
  const overEl = document.getElementById('over')!;
  const contEl = document.getElementById('cont')!;
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
      const partsEl = shopEl.querySelector('.parts')!;
      partsEl.innerHTML = h.parts;
      //a slot or a part that changed stamps in
      const tiles = [...slotsEl.querySelectorAll('.slot'), ...partsEl.children];
      const now = tiles.map((el) => el.className.replace(/ ?(target|picked)/g, '') + el.textContent);
      tiles.forEach((el, i) => {
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
      shopEl.querySelector('.hand')!.innerHTML = h.hand;
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
    cont: (v) => {
      contEl.hidden = !v;
      if (!v) return;
      contEl.querySelector('b')!.textContent = v.caught ? 'BUSTED' : 'BAILED';
      contEl.querySelector('.left')!.textContent = `${v.left} CONTINUE${v.left === 1 ? '' : 'S'} LEFT`;
    },
    continues: (left) => (document.getElementById('continues')!.textContent = `${'♥'.repeat(left)}`),
    over: (result) => {
      overEl.hidden = !result;
      if (!result) return;
      overEl.classList.toggle('won', result.won);
      overEl.querySelector('b')!.textContent = result.won ? 'YOU ESCAPED!' : result.caught ? 'BUSTED' : 'BAILED';
      overEl.querySelector('.reached')!.textContent = result.won
        ? `Out of the city in ${result.floor} floors · escape #${result.wins}`
        : `You made it to act ${result.act}, floor ${result.floor}`;
      if (result.continues) overEl.querySelector('.reached')!.textContent += ` · ${result.continues} continue${result.continues === 1 ? '' : 's'} used`;
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
  if (params.has('editor')) {
    // the animation editor (src/editor): keyframe the skater's clips on the rig
    const { startEditor } = await import('./editor/editor');
    return startEditor(base);
  }
  if (params.has('levels')) {
    // the level editor (src/levels): see and shape the generated floors
    const { startLevels } = await import('./levels/levels');
    return startLevels();
  }
  // level edits saved from the editor: reload to skate them; ?leveldrafts skates the editor's unsaved ones
  import.meta.hot?.on('level-edits', () => location.reload());
  if (params.has('leveldrafts')) {
    const drafts = loadLevelDrafts();
    if (drafts) useLevelEdits(drafts);
  }
  // clips saved from the editor: reload to play them; ?drafts plays the editor's unsaved ones
  import.meta.hot?.on('clip-edits', () => location.reload());
  //the dev tools' saved switches (src/ui/dev.ts); a URL flag still wins
  loadDev();
  //momentum on slopes, being explored: ?momentum=real|soften|transfer|both (src/physics/feel.ts)
  const momentum = params.get('momentum');
  if (MOMENTUM_MODES.includes(momentum as MomentumMode)) MOMENTUM.mode = momentum as MomentumMode;
  if (params.has('drafts')) applyClipEdits(loadDrafts());
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
  void loadLater(base);
  const view = new StreetView(canvas, buildFloor(seed, 1));
  await view.loadBackdrop(base);
  //?skater=webster (keanu, roxy, goldie) rides one without unlocking it
  const urlSkater = params.get('skater');
  const skater = isSkater(urlSkater) ? urlSkater : owns(save.skater) ? save.skater : 'lou-gnar';
  const deck = owns(save.deck) ? save.deck : 'popsicle';
  const sprite = await SkaterRig.create(base, skater);
  const input = new OneButton(document.getElementById('app')!);
  //test URLs (src/bot/repro.ts): ?escape=2 starts on act 2's escape, ?boons=bigPop,grease holds those, ?danger=3 is rush-hour traffic
  const escape = Math.min(ACTS, Math.max(0, Math.floor(Number(params.get('escape')) || 0)));
  const startAt = escape ? escape * FLOORS_PER_ACT : Math.max(1, Math.floor(Number(params.get('floor')) || 1));
  const danger = Math.min(3, Math.max(1, Math.floor(Number(params.get('danger')) || 1)));
  //a new phone starts on the tutorial floor (?tutorial shows it again; a test URL skips it)
  const testing = ['floor', 'seed', 'biome', 'daily', 'gnar', 'escape', 'boons', 'bot'].some((k) => params.has(k));
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
  const game = new Game(seed, fixedSeed > 0, view, sprite, input, hud, startAt, { loadout: { skater, deck }, library, daily, tutorial, gnar, boons: parseBoons(params.get('boons')), danger, escape });
  //?bot hands the button to the playtest bot (src/bot): ?bot=mash presses at random, ?bot=high goes for the top route, ?turbo=4 runs it 4x faster
  const bot = params.get('bot');
  if (bot !== null) {
    game.setAutopilot(bot === 'mash' || bot === 'high' ? bot : 'ref');
    game.timeScale = Math.min(8, Math.max(1, Number(params.get('turbo')) || 1));
  }
  //?debug (and ?bot) expose the game for headless checks: the playtest runner reads game.playtest and window.rig
  if (params.has('debug') || bot !== null) Object.assign(window, { game, props, rig: sprite, missingModels });
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
  bindShopDrag(document.getElementById('shop')!, { tap: (el) => game.shopTap(el), drop: (card, to) => game.shopDrop(card, to) }, () => FX.reduceMotion);
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
    pixel: () => view.setPixel(),
  });
  //the one button blocks touchstart on the whole game (src/game/input.ts), which on a phone also kills the taps' clicks
  //and the scrolling on the pause card: let the card have its touches back
  document.getElementById('paused')!.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.setPaused(true);
  });
  //dev tools (src/ui/dev-panel.ts) on the pause card. The collision overlay (src/render/collision-debug.ts): ?debug=collision
  //(or ?collision) or the saved switch starts with it on, C flips it, [ and ] step the slow motion, . freezes and then
  //steps one frame. With ?debug a COL button flips it too.
  const app = document.getElementById('app')!;
  const showFps = (on: boolean) => app.classList.toggle('debug', on || params.has('debug'));
  const targets = [
    ...Array.from({ length: ACTS * FLOORS_PER_ACT }, (_, i) => `floor ${i + 1}`),
    ...Array.from({ length: ACTS }, (_, i) => `escape ${i + 1}`),
  ];
  const dev = new DevPanel(document.getElementById('devhead')!, {
    collision: (on) => game.toggleCollision(on),
    fps: showFps,
    pilot: () => game.pilot,
    setPilot: (style) => game.setAutopilot(style),
    targets,
    start: escape ? ACTS * FLOORS_PER_ACT + escape - 1 : startAt - 1,
    jump: (i) => {
      const q = new URLSearchParams(location.search);
      q.delete('floor');
      q.delete('escape');
      q.delete('tutorial');
      const [kind, n] = targets[i].split(' ');
      q.set(kind, n);
      location.search = q.toString();
    },
    unlockAll: all,
    setUnlockAll: (on) => reloadWith('unlockall', on),
  });
  if (DEV.collision || params.get('debug') === 'collision' || params.has('collision')) game.toggleCollision(true);
  showFps(DEV.fps);
  if (params.has('debug') || params.has('collision')) {
    const colBtn = document.createElement('button');
    colBtn.id = 'colbtn';
    colBtn.textContent = 'COL';
    app.append(colBtn);
    tapOnly('colbtn', () => {
      game.toggleCollision();
      saveDev();
      dev.render();
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC') {
      game.toggleCollision();
      saveDev();
    } else if (e.code === 'BracketLeft') slower(1);
    else if (e.code === 'BracketRight') slower(-1);
    else if (e.code === 'Period') stepFrame();
    else return;
    dev.render();
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
