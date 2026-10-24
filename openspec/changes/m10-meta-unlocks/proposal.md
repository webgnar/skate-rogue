# Proposal

## Why

Stoken has been banked since the first runs but bought nothing. The GDD's meta progression (the M4 milestone) gives
it a use and gives each run a different start, mostly through more variety rather than more power. zack asked the
threads to keep building through the GDD overnight (2026-10-24).

## What Changes

- **Unlock tree** (src/run/meta.ts): 16 unlocks in four branches, bought with banked Stoken.
  - Skaters: Lou Gnar (free), Webster, Roxy, Keanu, Goldie, with the GDD's draft passives and a first-pick lean.
  - Decks: Popsicle (free), Cruiser, Bombhill, Slab. Each is a trade (speed for pop, speed for wear, slots for pop).
  - Boon library: a new save draws from POP and GRIND (12 boons). FLOW, COOL, STREET and LUCK packs, Curses, Duos.
  - Spots: the daily run (one seed per UTC day, its own best score).
- **Save** keeps unlocks, the skater and deck you ride, and today's daily best. Old saves load unchanged.
- **UNLOCKS screen** off the run-over screen. A change reloads the page into the new setup.
- **Each act is its own district**: Chicago, Clemente Park, Greece/Atlantis/museum by seed, High-Tech City, the
  Hive. `?biome=` pins one.
- Debug flags: `?unlockall`, `?daily`.

Not in this change: biomes as starting points, the harder "gnar mode" spot, leaderboards.

## Capabilities

### New Capabilities

- `meta-progression`: unlocks bought with Stoken change what a run starts with and what it can offer.
