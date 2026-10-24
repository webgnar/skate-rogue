# Proposal

## Why

zack (2026-10-24) picked the fork plus cash and score as the next build: it turns separate floors into a run with
choices, and the shop, events and meta all need money and score first.

## What Changes

- Every floor ends at a fork. A plain street runway leads under an overpass; the low road keeps rolling on the
  street, the high road is up on the overpass (2 tiles up: ollie + flip). Signs on a gantry show where each road
  leads and its danger (1-3 cars). Two gates, one per road.
- The road taken decides the next floor and what it pays at its end:
  - boon street (POP or GRIND): pick 1 of 3 of that type;
  - cash street: a cash payout;
  - hot street (from floor 2): rush-hour traffic, Heat starts at 30; pays a pick of 4 from any type plus cash;
  - stoken stash: a shorter, lower floor ending in a Stoken payout.
  Skate shop and underground spot follow once board mods and carried-over Heat exist.
- Cash coins along rails, ledges, gaps and drops; Stoken gems up high (only a flip reaches them), at least one per
  floor. Cash buys boon rerolls for now (15, then +10 each).
- Score: tricks, grinds and car-hops build a combo; landing banks points x count x speed. Long combos also pay
  cash; slams lose the combo. Banked points fill the stoke meter; full stoke is the gnar state (8 s, +20% cruising
  speed, slams cost no Heat). Floor clear pays 250 x floor.
- HUD: score and combo, cash and Stoken, the floor's road, the stoke meter. Game over shows score, best and Stoken;
  best score and the Stoken bank are saved on the phone.

## Capabilities

### New Capabilities

- `run-loop`: forks, roads and rewards, pickups, score and stoke.

### Modified Capabilities

(none)

## Impact

New `src/gen/roads.ts`, `src/run/score.ts`, `src/run/save.ts`, `src/render/pickups.ts`. Levels gain pickups, a
fork site and a traffic danger; FloorSim collects pickups and reports the road taken; the skater has a speed boost
hook and Heat a slam-free flag.
