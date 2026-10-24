# Proposal

## Why

The between-floor screens and the floor's way out were flat: cards rose in, the shop replayed its entry on every
tap, and the exit gate was a plain glowing arch.

## What Changes

- **Boon pick**: cards deal in with a flick and a shine sweep; on a mouse they lift on hover; the card you pick
  pops while the others drop away, and the screen fades over 0.3 s.
- **Shop**: the stock deals in once when the shop opens (it used to replay on every tap); a slot you fill or buy
  stamps in; what you spend floats off the cash in red.
- **Gates**: each exit arch (and the fork's high-road arch) fills with a portal of light rings flowing in, and
  brightens and swells as the skater rolls up to it, so the way out reads from across the screen.
- **Reduce motion** (`?calm` or the device setting) turns all screen animations off.

## Capabilities

### Modified Capabilities

- `game-feel`: menu and gate juice.

## Impact

`src/style.css`, the screen code in `src/main.ts` (no change to structure, text or logic), `src/render/gate-fx.ts`
(one draw per gate). Gates are tagged in `kit.ts` and skipped by kit batching.
