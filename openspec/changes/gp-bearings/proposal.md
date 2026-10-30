# gp-bearings

## Why
zack (2026-10-30): a new gear part, bearings. They wear out from going through puddles and they matter more to your
speed than wheels do. Wheels mostly decide whether you can ride over stuff: broken glass, grass, puddles. Refs:
a Swiss-style bearing box (black shields, red ring) and an open bronze ceramic bearing.

## What changes
- **Bearings**, the fifth part (src/run/gear.ts). Worn by puddles (12 a puddle) and grit (0.3 a second rolling on the
  ground). Worn past half they cost up to 20% cruising speed at 0. $15 at the shop.
- **Wheels** cost at most 7% speed now (was 20%), multiplied with the bearings'. They still wear from going fast, plus
  8 per stretch of broken glass rolled over.
- **Glass:** wheels at 50 or more roll over broken glass (CRNCH!, shards, a high crunch) instead of slamming. Below 50
  it slams you like before.
- **Puddles** no longer wear the deck. Rolling into one takes speed off you: 6% on fresh wheels, up to 45% on dead
  ones. The bearings' bar flashes blue.
- **Looks:** a bearing in each wheel's outer face (black shield, red ring, silver races) that dulls and rusts as it
  wears (src/render/wear.ts). HUD bar and shop tile with a drawn bearing icon; the shop card draws both refs.
- **Balance:** the bot never hits puddles (no rain in balance runs), so its bearings sit at about 83 by the first
  shop. The first-shop count stays at about 2.5 worn (2.56).

## Open (asked zack)
- What wears bearings beyond puddles, since rain is only about 1 floor in 8 (grit is the current pick).
- Grass: there is none in the levels yet.
