// Board mods (GDD: Board build, the light launch version). A board has slots; a slot holds a trigger or an effect.
// When a trigger's event happens it fires the effects to its right, left to right, until the next trigger.
// A modifier changes the next effect after it (GDD: ×2, Only On Combo, Chance); modifiers stack.
// Trimmed 2026-11-06 (zack): Spark Trail, Slow-mo, Gravity Flip, Delay, On Grind End and On Car-hop cut; Patch Job added.
export type TriggerId = 'onOllie' | 'onLand' | 'onGrind' | 'onTrick';
export type EffectId = 'doublePop' | 'speedKick' | 'cashBurst' | 'shockwave' | 'patchJob';
export type ModifierId = 'twice' | 'comboOnly' | 'coinFlip';
export type ModId = TriggerId | EffectId | ModifierId;

export interface ModDef {
  id: ModId;
  kind: 'trigger' | 'effect' | 'modifier';
  name: string;
  short: string; // fits a HUD slot
  text: string;
  price: number;
}

export const MOD_DEFS: ModDef[] = [
  { id: 'onOllie', kind: 'trigger', name: 'On Ollie', short: 'OLLIE', text: 'Fires when you pop off the ground', price: 20 },
  { id: 'onLand', kind: 'trigger', name: 'On Land', short: 'LAND', text: 'Fires when you land on your wheels', price: 20 },
  { id: 'onGrind', kind: 'trigger', name: 'On Grind', short: 'GRIND', text: 'Fires when you lock onto a ledge or rail', price: 20 },
  { id: 'onTrick', kind: 'trigger', name: 'On Trick', short: 'TRICK', text: 'Fires on every flip trick', price: 25 },
  { id: 'doublePop', kind: 'effect', name: 'Double Pop', short: '2X POP', text: 'A second small ollie 0.2 s later', price: 40 },
  { id: 'speedKick', kind: 'effect', name: 'Speed Kick', short: 'KICK', text: '+2 speed, fading like rail speed', price: 35 },
  { id: 'cashBurst', kind: 'effect', name: 'Cash Burst', short: '+$2', text: '+2 cash', price: 25 },
  { id: 'shockwave', kind: 'effect', name: 'Shockwave', short: 'SHOCK', text: 'Cars near you pull out of the skate lane', price: 45 },
  { id: 'patchJob', kind: 'effect', name: 'Patch Job', short: 'PATCH', text: '+5 to your most worn gear part (6 times a floor)', price: 40 },
  { id: 'twice', kind: 'modifier', name: 'Times Two', short: '×2', text: 'The next effect fires twice', price: 45 },
  { id: 'comboOnly', kind: 'modifier', name: 'Combo Only', short: 'COMBO 5+', text: 'The next effect fires only in a 5+ combo, and twice', price: 30 },
  { id: 'coinFlip', kind: 'modifier', name: 'Coin Flip', short: '50/50', text: 'The next effect: half the time nothing, half the time three times', price: 25 },
];

export const BOARD = {
  startSlots: 3,
  maxSlots: 5,
  slotPrice: 60,
  restockPrice: 10, // then +5 each
  doublePopFrames: 12,
  doublePop: 0.6, // share of an ollie
  speedKick: 2, // px/frame
  speedKickMax: 7, // kicks stack up to twice cruising speed
  cashBurst: 2,
  shockwaveTiles: 12,
  patchJob: 5, // gear points back on the most worn part
  patchJobPerFloor: 6, // so a busy trigger can't undo a floor's wear by itself
  comboOnly: 5,
};

export function modDef(id: ModId): ModDef {
  return MOD_DEFS.find((m) => m.id === id)!;
}

export type Slots = (ModId | null)[];

export function newBoard(slots: number = BOARD.startSlots): Slots {
  return Array.from({ length: slots }, () => null);
}

export interface Firing {
  slot: number;
  effect: EffectId;
  times: number; // ×2 doubles it; a won coin flip triples it
  comboOnly: boolean; // only in a combo of BOARD.comboOnly or more
  coinFlip: boolean; // a 50/50: nothing, or three times
}

// the effects a trigger fires, with their slots: every copy of the trigger fires its own run of effects, and the
// modifiers before an effect (since the last effect or trigger) shape it
export function fires(slots: Slots, trigger: TriggerId): Firing[] {
  const out: Firing[] = [];
  let live = false;
  let pending: ModifierId[] = [];
  slots.forEach((id, slot) => {
    if (!id) return;
    const def = modDef(id);
    if (def.kind === 'trigger') {
      live = id === trigger;
      pending = [];
    } else if (def.kind === 'modifier') {
      if (live) pending.push(id as ModifierId);
    } else if (live) {
      const n = (m: ModifierId) => pending.filter((p) => p === m).length;
      out.push({
        slot,
        effect: id as EffectId,
        times: 2 ** n('twice') * (n('comboOnly') ? 2 : 1),
        comboOnly: n('comboOnly') > 0,
        coinFlip: n('coinFlip') > 0,
      });
      pending = [];
    }
  });
  return out;
}

// How a board reads, for drawing it (the shop and the HUD): which trigger each slot answers to and whether it ever
// does anything. A wire runs from a trigger along to the last effect it fires; a modifier is live when an effect
// follows it in the same run; anything left of every trigger, or a trigger with nothing after it, is dead.
export interface Link {
  live: boolean; // fires (a trigger: fires something; an effect: is fired; a modifier: shapes a fired effect)
  wire: 'start' | 'mid' | 'end' | null; // its place on its trigger's wire
}

export function chain(slots: Slots): Link[] {
  const out: Link[] = slots.map(() => ({ live: false, wire: null }));
  const kind = (i: number) => (slots[i] ? modDef(slots[i]!).kind : null);
  for (let t = 0; t < slots.length; t++) {
    if (kind(t) !== 'trigger') continue;
    let end = t;
    for (let i = t + 1; i < slots.length && kind(i) !== 'trigger'; i++) if (kind(i) === 'effect') end = i;
    if (end === t) continue; // fires nothing
    out[t] = { live: true, wire: 'start' };
    let effectAhead = false;
    for (let i = end; i > t; i--) {
      if (kind(i) === 'effect') effectAhead = true;
      out[i] = { live: kind(i) === 'effect' || (kind(i) === 'modifier' && effectAhead), wire: i === end ? 'end' : 'mid' };
    }
  }
  return out;
}

// the board in words, one line per trigger that fires anything: "OLLIE ▸ ×2 KICK · SPARKS"
export function chainText(slots: Slots): string[] {
  const lines: string[] = [];
  let line: string[] | null = null;
  let head = '';
  let mods: string[] = [];
  const flush = () => {
    if (line?.length) lines.push(`${head} ▸ ${line.join(' · ')}`);
  };
  for (const id of slots) {
    if (!id) continue;
    const d = modDef(id);
    if (d.kind === 'trigger') {
      flush();
      line = [];
      head = d.short;
      mods = [];
    } else if (line && d.kind === 'modifier') mods.push(d.short);
    else if (line && d.kind === 'effect') {
      line.push([...mods, d.short].join(' '));
      mods = [];
    }
  }
  flush();
  return lines;
}
