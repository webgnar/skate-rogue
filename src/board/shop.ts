// The skate shop (GDD: Run structure, the Noita Holy Mountain beat): no floor, just spending run cash on the board.
// Pure: stock rolls from the run seed, and buying, swapping, slots and restocks are plain functions on a ShopState.
import { makeRng, randInt } from '../gen/rng';
import { BOARD, MOD_DEFS, modDef, type ModId, type Slots } from './mods';

export interface ShopState {
  cash: number;
  board: Slots;
  stock: (ModId | null)[]; // null once bought
  restocks: number;
}

export const STOCK_SIZE = 4;

// 4 mods, at least one trigger and one effect, no repeats; modifiers turn up among the rest
export function rollStock(seed: number, visit: number, restocks: number): ModId[] {
  const rng = makeRng(seed * 7919 + visit * 104729 + restocks * 1299709);
  const triggers = MOD_DEFS.filter((m) => m.kind === 'trigger').map((m) => m.id);
  const effects = MOD_DEFS.filter((m) => m.kind === 'effect').map((m) => m.id);
  const modifiers = MOD_DEFS.filter((m) => m.kind === 'modifier').map((m) => m.id);
  const take = (from: ModId[]) => from.splice(randInt(rng, from.length), 1)[0];
  const stock = [take(triggers), take(effects)];
  const rest = [...triggers, ...effects, ...modifiers];
  while (stock.length < STOCK_SIZE) stock.push(take(rest));
  //shuffle so the trigger isn't always first
  for (let i = stock.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [stock[i], stock[j]] = [stock[j], stock[i]];
  }
  return stock;
}

export function restockPrice(s: ShopState): number {
  return BOARD.restockPrice + 5 * s.restocks;
}

// buy stock item i into slot, replacing what's there
export function buy(s: ShopState, i: number, slot: number): ShopState | null {
  const id = s.stock[i];
  if (!id || slot < 0 || slot >= s.board.length) return null;
  const price = modDef(id).price;
  if (s.cash < price) return null;
  const board = s.board.slice();
  board[slot] = id;
  const stock = s.stock.slice();
  stock[i] = null;
  return { ...s, cash: s.cash - price, board, stock };
}

export function swap(s: ShopState, a: number, b: number): ShopState {
  const board = s.board.slice();
  [board[a], board[b]] = [board[b], board[a]];
  return { ...s, board };
}

// the board a drag would leave, for the preview while it's held over a slot (openspec ui8-drag-preview): a stock
// card replaces the slot, a slot swaps with it
export function dropBoard(s: ShopState, from: { stock: number } | { slot: number }, to: number): Slots {
  const board = s.board.slice();
  if ('stock' in from) board[to] = s.stock[from.stock] ?? board[to];
  else [board[from.slot], board[to]] = [board[to], board[from.slot]];
  return board;
}

export function buySlot(s: ShopState): ShopState | null {
  if (s.board.length >= BOARD.maxSlots || s.cash < BOARD.slotPrice) return null;
  return { ...s, cash: s.cash - BOARD.slotPrice, board: [...s.board, null] };
}

export function restock(s: ShopState, seed: number, visit: number): ShopState | null {
  const price = restockPrice(s);
  if (s.cash < price) return null;
  const restocks = s.restocks + 1;
  return { ...s, cash: s.cash - price, restocks, stock: rollStock(seed, visit, restocks) };
}
