// Board mods (GDD: Board build, the light launch version). A board has slots; a slot holds a trigger or an effect.
// When a trigger's event happens it fires the effects to its right, left to right, until the next trigger.
export type TriggerId = 'onOllie' | 'onLand' | 'onGrind' | 'onGrindEnd' | 'onTrick' | 'onHop';
export type EffectId = 'sparks' | 'doublePop' | 'speedKick' | 'jumpRefill' | 'cashBurst' | 'slowMo' | 'gravFlip' | 'shockwave';
export type ModId = TriggerId | EffectId;

export interface ModDef {
  id: ModId;
  kind: 'trigger' | 'effect';
  name: string;
  short: string; // fits a HUD slot
  text: string;
  price: number;
}

export const MOD_DEFS: ModDef[] = [
  { id: 'onOllie', kind: 'trigger', name: 'On Ollie', short: 'OLLIE', text: 'Fires when you pop off the ground', price: 20 },
  { id: 'onLand', kind: 'trigger', name: 'On Land', short: 'LAND', text: 'Fires when you land on your wheels', price: 20 },
  { id: 'onGrind', kind: 'trigger', name: 'On Grind', short: 'GRIND', text: 'Fires when you lock onto a ledge or rail', price: 20 },
  { id: 'onGrindEnd', kind: 'trigger', name: 'On Grind End', short: 'GRIND END', text: 'Fires when you leave a ledge or rail', price: 20 },
  { id: 'onTrick', kind: 'trigger', name: 'On Trick', short: 'TRICK', text: 'Fires on every flip trick', price: 25 },
  { id: 'onHop', kind: 'trigger', name: 'On Car-hop', short: 'CAR HOP', text: 'Fires when you bounce off a car roof', price: 15 },
  { id: 'sparks', kind: 'effect', name: 'Spark Trail', short: 'SPARKS', text: '+50 style to the combo, and a spray of sparks', price: 20 },
  { id: 'doublePop', kind: 'effect', name: 'Double Pop', short: '2X POP', text: 'A second small ollie 0.2 s later', price: 40 },
  { id: 'speedKick', kind: 'effect', name: 'Speed Kick', short: 'KICK', text: '+2 speed, fading like rail speed', price: 35 },
  { id: 'jumpRefill', kind: 'effect', name: 'Jump Refill', short: '+½ JUMP', text: '+½ a jump (two make a flip)', price: 35 },
  { id: 'cashBurst', kind: 'effect', name: 'Cash Burst', short: '+$2', text: '+2 cash', price: 25 },
  { id: 'slowMo', kind: 'effect', name: 'Slow-mo', short: 'SLOW-MO', text: 'Half speed for 0.5 s', price: 30 },
  { id: 'gravFlip', kind: 'effect', name: 'Gravity Flip', short: 'GRAV FLIP', text: 'Gravity pulls up for 0.3 s (in the air)', price: 40 },
  { id: 'shockwave', kind: 'effect', name: 'Shockwave', short: 'SHOCK', text: 'Cars near you pull out of the skate lane', price: 45 },
];

export const BOARD = {
  startSlots: 3,
  maxSlots: 5,
  slotPrice: 60,
  restockPrice: 10, // then +5 each
  sparkStyle: 50,
  doublePopFrames: 12,
  doublePop: 0.6, // share of an ollie
  speedKick: 2, // px/frame
  speedKickMax: 7, // kicks stack up to twice cruising speed
  jumpRefill: 0.5,
  cashBurst: 2,
  slowMoSecs: 0.5,
  slowMoScale: 0.5,
  gravFlipFrames: 18,
  shockwaveTiles: 12,
};

export function modDef(id: ModId): ModDef {
  return MOD_DEFS.find((m) => m.id === id)!;
}

export type Slots = (ModId | null)[];

export function newBoard(slots: number = BOARD.startSlots): Slots {
  return Array.from({ length: slots }, () => null);
}

// the effects a trigger fires, with their slots: every copy of the trigger fires its own run of effects
export function fires(slots: Slots, trigger: TriggerId): { slot: number; effect: EffectId }[] {
  const out: { slot: number; effect: EffectId }[] = [];
  let live = false;
  slots.forEach((id, slot) => {
    if (!id) return;
    const def = modDef(id);
    if (def.kind === 'trigger') live = id === trigger;
    else if (live) out.push({ slot, effect: id as EffectId });
  });
  return out;
}
