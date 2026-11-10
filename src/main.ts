import { applyWeatherParams } from './render/atmosphere';
import { MOMENTUM, MOMENTUM_MODES, type MomentumMode } from './physics/feel';
import '@fontsource/bangers/latin-400.css';
import '@fontsource/pacifico/latin-400.css'; // the storefronts' script signs (render/storefronts.ts)
import './style.css';
import { boonById, boonColor, CURSE_COLOR, stacksOf, type Boon, type BoonId, type Held } from './boons/defs';
import { Game, type Hud, type ShopView } from './game/game';
import type { UnderView } from './run/spot';
import { GEAR, wornness } from './run/gear';
import { chainText, modDef, type ModId, type Slots } from './board/mods';
import { dropBoard, type ShopState } from './board/shop';
import { gripCardColor, gripDef } from './board/grips';
import type { DeckArt } from './board/deck-art';
import { deckArtUrl } from './render/deck-graphic';
import { drawWires } from './ui/board-wires';
import { actLabel, GEAR_ORDER, HudView } from './ui/hud';
import { bindShopDrag } from './ui/shop-drag';
import { boonArt, boonIcon, spotArt } from './ui/boon-art';
import { gearArt, gearIcon, gripArt, modArt, slotArt } from './ui/shop-art';
import { OneButton } from './game/input';
import { buildFloor } from './gen/descent';
import { SkaterLayer } from './render/skater-layer';
import { StreetView } from './render/scene';
import { FX, initFx } from './render/fx-settings';
import { frameDue } from './game/frame-cap';
import { makeCallouts } from './ui/callouts';
import { makeMissionToast } from './ui/mission-toast';
import { clampUserZoom, initCam } from './render/camera';
import { initBullet } from './game/bullet-time';
import { isBiome } from './render/biomes';
import { props, propsFor } from './render/props';
import { SkaterRig, isSkater } from './render/skater-rig';
import { applyClipEdits } from './render/poses';
import { loadDrafts } from './editor/drafts';
import { loadLevelDrafts } from './levels/drafts';
import { useLevelEdits } from './gen/level-edits';
import { dailySeed, dayKey, FULL_LIBRARY, has, libraryOf, type UnlockId } from './run/meta';
import { loadSave, writeSave } from './run/save';
import { resetAndReload, resetFromLink } from './run/reset';
import { GNAR_RULES, gnarOpen, MAX_GNAR } from './run/gnar';
import { MetaScreen } from './ui/meta-screen';
import { BoardPanel } from './ui/board-panel';
import { MODEL_FILES, loadModels, missingModels } from './render/models';
import { CAT, RAT, DOG } from './render/bot-model';
import { loadPeople } from './title/bot-people';
import { loadPigeon } from './render/pigeon';
import { Loading } from './ui/loading';
import { parseBoons } from './bot/repro';
import { ACTS, FLOORS_PER_ACT } from './gen/escape';
import { DEV, loadDev, meshyModels, saveDev, slower, stepFrame } from './ui/dev';
import { DevPanel } from './ui/dev-panel';
import { BoardView } from './render/board-view';
import { loadCityTiles } from './render/textures';
import { Sound } from './audio/sound';
import { MUSIC } from './audio/cues';
import { SETTINGS, buzz, loadSettings, saveSettings } from './ui/settings';
import { tilt } from './render/tilt';
import { SettingsPanel } from './ui/settings-panel';
import { bindMissions } from './ui/missions-panel';
import { DicePanel } from './ui/dice-panel';
import { TitleScreen, skipTitleOnce, wantTitle } from './ui/title';
import { TitleScene } from './title/title-scene';
import { Aboard } from './ship/aboard';
import { isActBreak, type ActBreak, type ActBreakScene, type CutsceneUi } from './cutscene/act-breaks';
import { ON_CRAZYGAMES, breakAd, happyTime, initPortal, loadingDone, setPlaying, watchPortalMute } from './net/portal';

const base = import.meta.env.BASE_URL;

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function chip(h: Held): string {
  const b = boonById(h.id);
  const n = h.stacks > 1 ? ` ×${h.stacks}` : '';
  return `<span class="chip" style="--type:${boonColor(b)}"><span class="ico">${boonIcon(b.id, b.type)}</span>${esc(b.name)}${n ? `<em>${n.trim()}</em>` : ''}</span>`;
}

// a boon card in QFS's layout: type label, name, effect, small line, stacks
function card(b: Boon, i: number, held: Held[]): string {
  const have = stacksOf(held, b.id);
  const pips = Array.from({ length: b.max }, (_, k) => `<i class="${k < have ? 'on' : k === have ? 'new' : ''}"></i>`).join('');
  const tag = b.cursed ? 'CURSED' : b.duo ? 'DUO' : b.type;
  const duo = b.duo ? `<span class="duo">${b.duo.map((id) => esc(boonById(id).name)).join(' + ')}</span>` : '';
  return `<button class="card${b.cursed ? ' cursed' : ''}" data-pick="${i}" style="--type:${boonColor(b)}">
    <span class="type">${esc(tag)}</span>
    <b class="name">${esc(b.name)}</b>
    ${duo}
    ${boonArt(b.id, b.type)}
    <span class="effect">${esc(b.effect)}</span>
    ${b.note ? `<span class="note">${esc(b.note)}</span>` : ''}
    <span class="pips">${pips}</span>
    <span class="key">${i + 1}</span>
  </button>`;
}

// the underground spot's cards: a plain choice card, coloured, maybe greyed out
function choice(key: string, color: string, tag: string, name: string, effect: string, note: string, off = false): string {
  const [kind, id] = key.split(':');
  const art = id ? boonArt(id as BoonId, boonById(id as BoonId).type) : spotArt(kind);
  return `<button class="card${off ? ' off' : ''}" data-under="${key}" ${off ? 'disabled' : ''} style="--type:${color}">
    <span class="type">${tag}</span>
    <b class="name">${esc(name)}</b>
    ${art}
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

// a new deck's card shows the graphic it comes in (src/board/deck-art.ts)
function deckCardArt(art: DeckArt): string {
  return `<span class="art"><img class="pic deckart" src="${deckArtUrl(art)}" alt="${esc(art.name)}" draggable="false" /></span>`;
}

const KIND_TAG = { trigger: 'TRIGGER', effect: 'EFFECT', modifier: 'MODIFIER' } as const;

// the skate shop as a card game (src/ui/shop-drag.ts): your setup across the top is where cards land, the hand of
// cards along the bottom is the stock
function shopHtml(v: ShopView): { slots: string; parts: string; hand: string; hint: string; story: string } {
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
  if (shop.grip) {
    //the one grip colour this shop sells (src/board/grips.ts)
    const g = gripDef(shop.grip);
    const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
    const color = hex(g.color);
    // dark grips (classic black) get a lighter frame and name so the card reads; the tape keeps its true colour
    cards.push(`<button class="card-shop gripcard ${shop.cash < v.gripPrice ? 'poor' : ''}" data-grip style="--c:${hex(gripCardColor(g.color))}">
      <span class="kind">GRIP</span><b>${esc(g.name.toUpperCase())}</b>${gripArt(color)}
      <span class="text">New grip tape, yours for good</span><span class="price">$${v.gripPrice}</span>
    </button>`);
  }
  for (const p of GEAR_ORDER) {
    const c = Math.round(v.gear[p]);
    if (c >= 100) continue; // only worn parts are for sale
    cards.push(`<button class="card-shop gearcard ${shop.cash < GEAR.price[p] ? 'poor' : ''}" data-gear="${p}">
      <span class="kind">GEAR</span><b>NEW ${GEAR.names[p].toUpperCase()}</b>${p === 'deck' ? deckCardArt(v.deckArt) : gearArt(p)}
      <span class="text">${p === 'deck' ? `Pick 1 of 3 graphics · yours ${c}%` : `Yours: ${c}%`}</span><span class="price">$${GEAR.price[p]}</span>
    </button>`);
  }
  const hint = !picked
    ? 'Tap or drag a card to buy it · drag slots to swap them · triggers fire the effects to their right'
    : 'stock' in picked
      ? `Board full: tap the slot ${modDef(shop.stock[picked.stock]!).name} replaces`
      : 'Tap another slot to swap';
  return { slots, parts, hand: cards.join(''), hint, story: storyHtml(shop.board) };
}

// the board in words under it: what each trigger fires, or how to start
function storyHtml(board: Slots): string {
  const lines = chainText(board);
  return lines.length
    ? lines.map((l) => `<span>${esc(l)}</span>`).join('')
    : board.some(Boolean)
      ? '<span class="none">Nothing fires: a purple TRIGGER fires the effects to its right</span>'
      : '<span class="none">A purple TRIGGER fires the cyan EFFECTS to its right</span>';
}

// the shop's gear tones: green to red as a part wears (the HUD's bars are in src/ui/hud.ts)
function gearTone(c: number): string {
  return c <= GEAR.busted ? 'busted' : wornness(c) > 0 ? 'worn' : 'fresh';
}

// set up by makeHud: the drag preview, drawn on the shop it holds
let shopPreview: (card: HTMLElement, to: HTMLElement | null) => void = () => {};
// set once the game is up: a mission's SKIP
let skipMission: (i: number) => void = () => {};
let pauseBoard: BoardView | null = null; // the pause card's turntable board, once the rig has loaded

function makeHud(): Hud {
  const callouts = makeCallouts(document.getElementById('callout')!, () => FX.reduceMotion, document.getElementById('pointfly')!);
  const missionToast = makeMissionToast(document.getElementById('mission')!);
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
  const view = new HudView();
  const dice = new DicePanel(document.getElementById('dice')!, () => FX.reduceMotion);
  const drawMissions = bindMissions([...document.querySelectorAll<HTMLElement>('#paused .missions, #over .missions')], (i) => skipMission(i));
  let level = 0;
  let held: Held[] = [];
  //screen juice (src/style.css): the card you picked pops while the others fall away; the shop deals its stock in
  //once on opening, pops a slot that changed, and floats what you spent off the cash
  let chosen = -1;
  let pickTimer = 0;
  let shopOpen = false;
  let shopNow: ShopState | null = null; // the shop as last drawn, for the drag preview
  let shopCash = 0;
  let shopSlots: string[] = [];
  pickEl.addEventListener('pointerdown', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
    if (c) chosen = Number(c.dataset.pick);
  });
  window.addEventListener('keydown', (e) => {
    if (/^Digit[123]$/.test(e.code)) chosen = Number(e.code.slice(5)) - 1;
  });
  //while a card is held over a slot, the wires and the words show the board it would make (openspec ui8-drag-preview)
  shopPreview = (card, to) => {
    if (!shopNow) return;
    const slotsEl = shopEl.querySelector<HTMLElement>('.slots')!;
    const from = card.dataset.stock !== undefined ? { stock: Number(card.dataset.stock) } : { slot: Number(card.dataset.slot) };
    const board = to ? dropBoard(shopNow, from, Number(to.dataset.slot)) : shopNow.board;
    slotsEl.classList.toggle('preview', !!to);
    drawWires(slotsEl, board);
    shopEl.querySelector('.story')!.innerHTML = storyHtml(board);
    shopEl.querySelector('.story')!.classList.toggle('preview', !!to);
  };
  return {
    floor: (n, road) => {
      view.setFloor(n, road);
    },
    money: (cash, stoken) => view.money(cash, stoken),
    score: (score, combo, stoke, gnar, pending) => view.setScore(score, combo, stoke, gnar, pending),
    noGround: (n, mult, bonus, banked, label) => view.setNoGround(n, mult, bonus, banked, label),
    callout: (text, kind = 'trick') => callouts.show(text, kind),
    points: (text, kind, points) => {
      view.holdScore(points);
      callouts.show(text, kind, { to: document.getElementById('scorebox')!, land: () => view.landScore(points) });
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
      shopNow = v.shop;
      const slotsEl = shopEl.querySelector('.slots')!;
      slotsEl.classList.remove('preview');
      slotsEl.innerHTML = h.slots;
      shopEl.querySelector('.story')!.innerHTML = h.story;
      shopEl.querySelector('.story')!.classList.remove('preview');
      drawWires(slotsEl as HTMLElement, v.shop.board);
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
      //a new deck just bought: its three graphics over the shop, tap the one to ride
      const deckPickEl = shopEl.querySelector<HTMLElement>('.deckpick')!;
      const wasOpen = !deckPickEl.hidden;
      deckPickEl.hidden = !v.deckPick;
      if (v.deckPick && !wasOpen) {
        deckPickEl.querySelector('.row')!.innerHTML = v.deckPick
          .map((a, i) => `<button class="card-shop gearcard pickdeck" data-deckart="${i}" style="--i:${i}">
            <span class="kind">DECK</span><b>${esc(a.name.toUpperCase())}</b>${deckCardArt(a)}<span class="text">Tap to ride it</span>
          </button>`)
          .join('');
      }
      shopEl.querySelector('.cash')!.textContent = `$${v.shop.cash}`;
      const re = shopEl.querySelector<HTMLButtonElement>('.restock')!;
      re.textContent = `RESTOCK $${v.restockPrice}`;
      re.disabled = v.shop.cash < v.restockPrice;
    },
    gear: (g) => view.gear(g),
    gearTick: (p) => view.gearTick(p),
    pause: (on) => {
      pausedEl.hidden = !on;
      callouts.pause(on);
      if (on) pausedEl.querySelector('.held')!.innerHTML = held.length ? held.map(chip).join('') : '<span class="none">no boons yet</span>';
      pauseBoard?.show(on);
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
      contEl.querySelector('b')!.textContent = v.caught ? 'BUSTED' : 'DEAD';
      contEl.querySelector('.left')!.textContent = `${v.left} CONTINUE${v.left === 1 ? '' : 'S'} LEFT`;
    },
    missions: (v) => drawMissions(v),
    missionTick: (t) => missionToast.tick(t),
    missionDone: (t) => missionToast.done(t),
    dice: (v) => dice.show(v),
    diceTap: () => dice.tap(),
    continues: (left) => (document.getElementById('continues')!.textContent = `${'♥'.repeat(left)}`),
    over: (result) => {
      overEl.hidden = !result;
      if (!result) return;
      overEl.classList.toggle('won', result.won);
      overEl.querySelector('b')!.textContent = result.won ? 'YOU ESCAPED!' : result.caught ? 'BUSTED' : 'DEAD';
      overEl.querySelector('.reached')!.textContent = result.won
        ? `Out of the city in ${result.floor} floors · escape #${result.wins}`
        : `You made it to act ${actLabel(result.floor)}`;
      if (result.continues) overEl.querySelector('.reached')!.textContent += ` · ${result.continues} continue${result.continues === 1 ? '' : 's'} used`;
      overEl.querySelector('.final')!.textContent = `${result.score.toLocaleString()}${result.newBest ? ' · NEW BEST' : ''}`;
      overEl.querySelector('.best')!.textContent = `best ${result.best.toLocaleString()} · ${result.stoken} Stoken this run (${result.bank} banked)`;
      overEl.querySelector('.best')!.textContent += result.daily
        ? ` · today's daily best ${result.daily.best.toLocaleString()}${result.daily.newBest ? ' (NEW)' : ''}`
        : '';
      overEl.querySelector('.held')!.innerHTML = result.boons.length ? result.boons.map(chip).join('') : '<span class="none">no boons</span>';
    },
  };
}

const loading = new Loading(document.getElementById('loading')!);

async function start() {
  //the CrazyGames build (src/net/portal.ts) starts their SDK before anything reads the save; elsewhere a no-op
  await initPortal();
  //?reset wipes the saved progress and reloads without it (src/run/reset.ts)
  if (resetFromLink()) return;
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const params = new URLSearchParams(location.search);
  applyWeatherParams(params);
  if (params.has('editor')) {
    // the animation editor (src/editor): keyframe the skater's clips on the rig
    loading.remove();
    const { startEditor } = await import('./editor/editor');
    return startEditor(base);
  }
  if (params.has('levels')) {
    // the level editor (src/levels): see and shape the generated floors
    loading.remove();
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
  initCam(params);
  initBullet(params);
  initFx(params, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  loadSettings();
  if (params.has('gyro')) SETTINGS.tilt = params.get('gyro') !== '0'; //?gyro: gyro tilt on (?gyro=0 off)
  tilt.start();
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

  //?skater=lou-gnar (keanu, roxy, goldie) rides one without unlocking it
  const urlSkater = params.get('skater');
  const skater = isSkater(urlSkater) ? urlSkater : owns(save.skater) ? save.skater : 'webster';
  const deck = owns(save.deck) ? save.deck : 'popsicle';
  //the loading screen (src/ui/loading.ts): every model (the car-hop damage too), tile sheet and the skater, all at once
  //?models=new rides the Meshy rebuilds (DEV TOOLS MODELS), ?models=old the old skaters
  const meshy = meshyModels(params);
  const rig = loading.track(SkaterRig.create(base, skater, meshy, deck));
  //the title screen (src/ui/title.ts) and its own scene (src/title/title-scene.ts), on a plain visit: Webster stands
  //at the bottom of it, so his rig loads too
  const titled = wantTitle(params, ['floor', 'seed', 'biome', 'daily', 'gnar', 'escape', 'boons', 'bot'].some((k) => params.has(k)));
  const titleRig = titled ? loading.track(SkaterRig.create(base, 'webster', meshy)) : null;
  await Promise.all([loading.track(loadCityTiles(`${base}tex/chicago_tiles.png`)), loadModels(base, MODEL_FILES, loading.add(MODEL_FILES.length)), loading.track(loadPigeon(base)), loading.track(DOG.load(base)), loading.track(CAT.load(base)), loading.track(RAT.load(base)), loading.track(loadPeople(base))]);
  const view = new StreetView(canvas, buildFloor(seed, 1));
  //the ship between runs (src/ship/aboard.ts)
  const aboard = new Aboard(view.renderer, skater, all);
  //the skater drawn over the HUD where he crosses it (zack, 2026-11-06)
  const layer = new SkaterLayer(document.getElementById('skaterlayer') as HTMLCanvasElement, document.getElementById('hud')!);
  view.layer = layer;
  await loading.track(view.loadBackdrop(base));
  const sprite = await rig;
  pauseBoard = new BoardView(document.querySelector<HTMLCanvasElement>('#paused .boardview')!, () => sprite.boardModel());
  const built = loading.add(2);
  loading.say('BUILDING THE CITY');
  await loading.paint();
  const input = new OneButton(document.getElementById('app')!);
  //test URLs (src/bot/repro.ts): ?escape=2 starts on act 2's escape, ?boons=bigPop,grease holds those, ?danger=3 is rush-hour traffic
  const escape = Math.min(ACTS, Math.max(0, Math.floor(Number(params.get('escape')) || (params.has('shop') ? 1 : 0)))); // ?shop: act 1's escape, to the shop
  //?cutscene=actN: the act break plays first, then the run starts on the next act's first floor
  const cutAct = Math.min(ACTS - 1, Math.max(0, Number((params.get('cutscene') ?? '').replace(/^act/, '')) || 0));
  const startAt = escape ? escape * FLOORS_PER_ACT : cutAct ? cutAct * FLOORS_PER_ACT + 1 : Math.max(1, Math.floor(Number(params.get('floor')) || 1));
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
    //the summary goes up over the ship (src/ship/aboard.ts), the run's HUD out of its way
    document.getElementById('app')!.classList.toggle('aboard', !!result && !!aboard.ready);
    if (result) aboard.summary();
    if (result && (result.won || (result.newBest && result.act > 1))) happyTime();
    if (result) void breakAd((on) => sound.sleep(on)); // between runs; a no-op while ads are paused
    //the leaderboard lives on our own server, so it stays off on the portal (docs/CRAZYGAMES.md)
    if (result && !ON_CRAZYGAMES) void scores.runEnded({ score: result.score, floor: result.floor, ...(day ? { day } : {}), ...(gnar ? { gnar } : {}) });
  };
  const game = new Game(seed, fixedSeed > 0, view, sprite, input, hud, startAt, { loadout: { skater, deck }, library, daily, tutorial, gnar, boons: parseBoons(params.get('boons')), danger, escape });
  skipMission = (i) => game.skipMission(i);
  built();
  //?bot hands the button to the playtest bot (src/bot): ?bot=mash presses at random, ?bot=high goes for the top route, ?turbo=4 runs it 4x faster
  if (params.has('clouds')) game.startOnClouds();
  //?sewer (or ?sewer=rats, surge, bowl, subway, gator, kick, gate) starts at the way into a sewer (src/gen/sewer.ts)
  if (params.has('sewer')) game.startInSewer(params.get('sewer') ?? '');
  if (params.has('shop')) game.startAtShop();
  const bot = params.get('bot');
  if (bot !== null) {
    game.setAutopilot(bot === 'mash' || bot === 'high' || bot === 'sewer' || bot === 'sky' ? bot : 'ref');
    game.timeScale = Math.min(8, Math.max(1, Number(params.get('turbo')) || 1));
  }
  //?debug (and ?bot) expose the game for headless checks: the playtest runner reads game.playtest and window.rig
  if (params.has('debug') || bot !== null) Object.assign(window, { game, props, propsFor, rig: sprite, missingModels });
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
  bindShopDrag(document.getElementById('shop')!, { tap: (el) => game.shopTap(el), drop: (card, to) => game.shopDrop(card, to), preview: (card, to) => shopPreview(card, to) }, () => FX.reduceMotion);
  tapOnly('pausebtn', () => game.setPaused(true));
  //between runs: the unlock tree, and the daily run once it's unlocked. A change reloads into the new setup.
  const reloadWith = (key: string, on: boolean) => {
    skipTitleOnce();
    const q = new URLSearchParams(location.search);
    if (on) q.set(key, '');
    else q.delete(key);
    location.search = q.toString().replace(/=(&|$)/g, '$1');
  };
  const metaScreen = new MetaScreen(document.getElementById('meta')!, all, (changed) => {
    aboard.unlocks('close');
    //the new skater or deck is picked up from the save, so a ?skater= in the link would only override it
    if (changed) reloadWith('skater', false);
  });
  metaScreen.onChange = () => aboard.unlocks('change'); // a skater bought wakes up aboard
  const dailyBtn = document.querySelector<HTMLElement>('#over [data-daily]')!;
  dailyBtn.hidden = !owns('daily') && !daily;
  dailyBtn.textContent = daily ? 'NORMAL RUN' : 'DAILY RUN';
  document.querySelector('#over .metarow')!.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest('[data-open-meta]')) {
      metaScreen.open();
      aboard.unlocks('open');
    }
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
  watchPortalMute(() => sound.applyVolumes()); // the site's mute switch, on the portal
  const unlock = () => sound.unlock();
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  //the title screen (src/ui/title.ts), on a plain visit: its music is fetched now so it starts on the first tap
  //its music is fetched now so it starts on the first tap
  if (titled) sound.prefetch('title');
  const settings = new SettingsPanel(document.querySelector<HTMLElement>('#paused .settings')!, {
    volumes: () => sound.applyVolumes(),
    tier: (tier) => view.setTier(tier),
    look,
    pixel: () => view.setPixel(),
  });
  //pinching the street zooms the camera (camera.ts USER_ZOOM), remembered with the settings
  input.onPinch = (scale, done) => {
    SETTINGS.zoom = clampUserZoom(SETTINGS.zoom * scale);
    if (done) {
      saveSettings();
      settings.render();
    }
  };
  //the one button blocks touchstart on the whole game (src/game/input.ts), which on a phone also kills the taps' clicks
  //and the scrolling on the pause card: let the card have its touches back
  document.getElementById('paused')!.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  //leaving the app (home, the app switcher, another app, a call, the lock button) pauses the run and silences the
  //sound. The app switcher only blurs the page on iPhone, so blur counts too; coming back keeps the pause card up
  const away = () => {
    game.setPaused(true);
    sound.sleep(true);
  };
  const back = () => {
    if (!document.hidden) sound.sleep(false);
  };
  document.addEventListener('visibilitychange', () => (document.hidden ? away() : back()));
  window.addEventListener('pagehide', away);
  window.addEventListener('blur', away);
  window.addEventListener('pageshow', back);
  window.addEventListener('focus', back);
  //dev tools (src/ui/dev-panel.ts) on the pause card. The collision overlay (src/render/collision-debug.ts): ?debug=collision
  //(or ?collision) or the saved switch starts with it on, C flips it, [ and ] step the slow motion, . freezes and then
  //steps one frame. With ?debug a COL button flips it too.
  const app = document.getElementById('app')!;
  const showFps = (on: boolean) => app.classList.toggle('debug', on || params.has('debug'));
  const targets = [
    ...Array.from({ length: ACTS * FLOORS_PER_ACT }, (_, i) => `floor ${i + 1}`),
    ...Array.from({ length: ACTS }, (_, i) => `escape ${i + 1}`),
  ];
  //dev tools are ON in every build but the portal (zack, 2026-11-08: "we need dev tools available on mobile"; the
  //2026-11-07 hidden-on-Vercel rule made them unreachable on the phone). The CrazyGames build never has them. Five quick
  //taps on the pause card's PAUSED still hide them (and bring them back) for that device, kept
  const DEV_KEY = 'gnar-run-devtools';
  const devSaved = (): boolean => {
    try {
      return localStorage.getItem(DEV_KEY) !== '0';
    } catch {
      return true;
    }
  };
  const saveDevTools = (on: boolean): void => {
    try {
      localStorage.setItem(DEV_KEY, on ? '1' : '0');
    } catch {
      /* private mode: this session only */
    }
  };
  if (!ON_CRAZYGAMES && params.has('dev')) saveDevTools(true);
  let devTools = !ON_CRAZYGAMES && (import.meta.env.DEV || params.has('dev') || params.has('debug') || devSaved());
  const devHead = document.getElementById('devhead')!;
  devHead.hidden = !devTools;
  if (!ON_CRAZYGAMES) {
    let taps: number[] = [];
    document.querySelector('#paused .title')?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const now = performance.now();
      taps = [...taps.filter((t) => now - t < 2500), now];
      if (taps.length < 5) return;
      taps = [];
      devTools = !devTools;
      saveDevTools(devTools);
      devHead.hidden = !devTools;
      if (!devTools) {
        devHead.nextElementSibling?.setAttribute('hidden', '');
        showFps(false);
      } else showFps(DEV.fps);
    });
  }
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
    reset: resetAndReload,
    meshy,
    reload: () => {
      //the switch decides from now on, not a ?models= in the address
      const q = new URLSearchParams(location.search);
      q.delete('models');
      if (q.toString() === new URLSearchParams(location.search).toString()) location.reload();
      else location.search = q.toString();
    },
  });
  if ((devTools && DEV.collision) || params.get('debug') === 'collision' || params.has('collision')) game.toggleCollision(true);
  showFps(devTools && DEV.fps);
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
    if (!devTools) return; // the dev keys stay off in the shipped builds, like the DEV TOOLS button
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

  //iOS fires 'resize' (and orientationchange) before it has laid the page out in its new shape, so the canvas still
  //measures the old size then, and nothing fires once it settles: the old-shaped picture got stretched over the new
  //screen (portrait drawn into landscape, then squished going back). Watch the canvas box itself, which reports only
  //after layout, and check again a moment after each rotation for good measure
  let sized = '';
  const resize = () => {
    const now = `${canvas.clientWidth}x${canvas.clientHeight}`;
    if (now === sized || canvas.clientHeight === 0) return;
    sized = now;
    view.resize();
  };
  const settle = () => {
    resize();
    requestAnimationFrame(resize);
    for (const ms of [100, 300, 700]) setTimeout(resize, ms);
  };
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', settle);
  window.addEventListener('orientationchange', settle);
  window.visualViewport?.addEventListener('resize', settle);
  resize();
  document.getElementById('seed')!.textContent = (daily ? `daily · seed ${seed}` : `seed ${seed}`) + (gnar ? ` · gnar ${gnar}` : '');
  document.querySelector('#paused .seed')!.textContent = `seed ${seed}` + (gnar ? ` · gnar ${gnar}: ${GNAR_RULES.slice(0, gnar).map((r) => r.name).join(', ')}` : '');
  //every shader compiled and every texture on the GPU before the first frame (StreetView.warm), after one frame
  //behind the loading screen so what's made on the first frame (the people on the sidewalk) is there to compile
  loading.say('WARMING UP');
  await loading.paint();
  game.frame(performance.now());
  await view.warm();
  view.render();
  built();
  if (titled) {
    loading.say('PAINTING THE SKY');
    await loading.paint();
    const scene = new TitleScene(view.renderer, await titleRig);
    await view.renderer.compileAsync(scene.scene, scene.camera);
    game.titled = true;
    game.titleDraw = (dt) => scene.frame(dt);
    const screen = new TitleScreen(document.getElementById('title')!, {
      music: () => SETTINGS.music > 0 && MUSIC.title.length > 0,
      wake: unlock,
      down: () => scene.go(),
      go: () => {
        game.titled = false;
        game.titleDraw = null;
        input.clear();
        view.resize();
      },
    }, save.best);
    scene.onArrive = () => screen.arrived();
    if (import.meta.env.DEV) Object.assign(window, { titleScene: scene }); // stills of the way down in headless checks
    screen.show();
  }
  //the ship between runs (src/ship/aboard.ts): the hub behind the run summary, the ending after act 5's beam.
  //?ship shows the hub on its own (?ship=crew framed on the crew), ?ending plays the ending (?ending=short the
  //later wins' 5 s one), for stills
  game.backdrop = (dt) => aboard.backdrop(dt);
  const endingEl = document.getElementById('ending')!;
  const endingCap = endingEl.querySelector<HTMLElement>('.cap')!;
  const endingCard = endingEl.querySelector<HTMLElement>('.endcard')!;
  const endingFlash = endingEl.querySelector<HTMLElement>('.flash')!;
  const endingUi = {
    caption: (text: string) => {
      if (text) endingCap.textContent = text;
      endingCap.classList.toggle('on', !!text);
    },
    card: (step: 0 | 1 | 2) => {
      endingCard.classList.toggle('on', step > 0);
      if (step) endingCard.dataset.step = String(step);
    },
    flash: (k: number) => {
      endingFlash.style.opacity = String(Math.max(0, Math.min(1, k)));
    },
  };
  game.playEnding = (done, full?: boolean) => {
    const scene = aboard.ending(endingUi, () => {
      endingEl.hidden = true;
      app.classList.remove('titled');
      done();
    }, full);
    if (!scene) return null;
    endingEl.hidden = false;
    endingEl.querySelector('.skip')!.textContent = scene.full ? 'TAP TO SKIP' : '';
    app.classList.add('titled');
    return scene;
  };
  //the act breaks (src/cutscene/act-breaks.ts): after acts 1 to 4's escapes, the first time. ?cutscene=act1 (to act4)
  //plays one on its own
  const cutEl = document.getElementById('cutscene')!;
  const cutBubble = cutEl.querySelector<HTMLElement>('.bubble')!;
  const cutAi = cutEl.querySelector<HTMLElement>('.ai')!;
  const cutSkip = cutEl.querySelector<HTMLButtonElement>('.skip')!;
  const cutFlash = cutEl.querySelector<HTMLElement>('.flash')!;
  let cutScene: ActBreakScene | null = null;
  cutSkip.addEventListener('click', () => cutScene?.tap());
  const cutUi: CutsceneUi = {
    say: (text, at) => {
      cutBubble.classList.toggle('on', !!text && !!at);
      if (!text || !at) return;
      if (cutBubble.firstElementChild!.textContent !== text) cutBubble.firstElementChild!.textContent = text;
      //kept on screen: the bubble slides in from the edges, its tail still pointing at the speaker
      const w = cutBubble.offsetWidth;
      const h = cutBubble.offsetHeight;
      const vw = cutEl.clientWidth;
      const x = Math.min(vw - w / 2 - 10, Math.max(w / 2 + 10, at.x));
      const y = Math.max(h + 34, at.y);
      cutBubble.style.left = `${x}px`;
      cutBubble.style.top = `${y}px`;
      cutBubble.style.setProperty('--tail', `${Math.max(-w / 2 + 18, Math.min(w / 2 - 18, at.x - x))}px`);
    },
    ai: (text) => {
      cutAi.classList.remove('on');
      if (!text) return;
      cutAi.textContent = text;
      void cutAi.offsetWidth; // restart the glitch
      cutAi.classList.add('on');
      sound.aiTone();
    },
    skip: (show) => cutSkip.classList.toggle('on', show),
    flash: (k) => {
      cutFlash.style.opacity = String(Math.max(0, Math.min(1, k)));
    },
  };
  const playActBreak = (act: number, done: () => void, force = false): { frame(dt: number): void; tap(): void } | null => {
    if (!isActBreak(act)) return null;
    if (!aboard.ready) {
      //the crew's models aren't in yet (a fast escape, a slow phone): the run holds until they are, then it plays;
      //if they never come, the run goes on without it
      if (!force && (loadSave().actBreaks ?? []).includes(act)) return null;
      void aboard.load(base, meshy).catch((err) => console.warn('ship hub', err));
      let real: { frame(dt: number): void; tap(): void } | null = null;
      let waited = 0;
      let over = false;
      return {
        frame: (dt) => {
          if (real) return real.frame(dt);
          if (over) return;
          waited += dt;
          if (aboard.ready) real = startActBreak(act, done, force);
          if (!real && (aboard.ready || waited > 25)) {
            over = true;
            done();
          }
        },
        tap: () => real?.tap(),
      };
    }
    return startActBreak(act, done, force);
  };
  const startActBreak = (act: ActBreak, done: () => void, force: boolean) => {
    const scene = aboard.actBreak(act, cutUi, () => {
      cutScene = null;
      cutEl.hidden = true;
      app.classList.remove('titled');
      done();
    }, force);
    if (!scene) return null;
    cutScene = scene;
    cutEl.hidden = false;
    app.classList.add('titled');
    return scene;
  };
  //?escape=N (act N's escape) plays act N's cutscene when it's cleared, every time, so the two can be watched together
  game.playActBreak = (act, done) => playActBreak(act, done, act === escape);
  const shipLink = params.get('ship');
  const endingLink = params.get('ending');
  const cutLink = Number((params.get('cutscene') ?? '').replace(/^act/, '')) || 0;
  if (isActBreak(cutLink)) {
    await aboard.load(base, meshy);
    game.cinema = playActBreak(cutLink, () => {
      game.cinema = null;
    }, true);
    if (import.meta.env.DEV) Object.assign(window, { actBreak: game.cinema });
  }
  if (shipLink !== null || endingLink !== null) {
    await aboard.load(base, meshy);
    const hub = aboard.ready!;
    if (import.meta.env.DEV) Object.assign(window, { hub, aboard });
    if (shipLink !== null) {
      hub.look(shipLink === 'crew' ? 'crew' : 'wide');
      app.classList.add('titled');
      game.titled = true;
      game.titleDraw = (dt) => hub.frame(dt);
    } else {
      game.cinema = game.playEnding(() => {
        game.cinema = null;
      }, endingLink !== 'short');
      if (import.meta.env.DEV) Object.assign(window, { endingScene: game.cinema });
    }
  }
  loading.finish();
  loadingDone();
  //the crew's models, a few seconds into the first run (they're only wanted at its end; not under the title's glide)
  const boardShip = () => {
    if (game.titled) return void setTimeout(boardShip, 2000);
    void aboard.load(base, meshy).catch((err) => console.warn('ship hub', err));
  };
  if (!aboard.ready) setTimeout(boardShip, escape ? 0 : 4000); // ?escape: straight away, its cutscene is close

  //the portal hears when skating starts and stops (src/net/portal.ts): skating is no title and no card up
  const cards = ['title', 'paused', 'pick', 'under', 'shop', 'cont', 'dice', 'over', 'scores', 'meta']
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el);
  //(held to 30 a second with the 30 fps setting: frame-cap.ts)
  let ran = -Infinity;
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    if (!frameDue(now, ran, FX.fps)) return;
    ran = now;
    layer.measure(); // the HUD's boxes while the page's layout is clean, before the frame writes to it
    game.frame(now);
    if (ON_CRAZYGAMES) setPlaying(!game.titled && !game.paused && cards.every((el) => el.hidden || !el.isConnected));
  };
  requestAnimationFrame(tick);
}

start().catch((err) => {
  loading.fail(err);
  console.error(err);
});
