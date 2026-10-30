# Proposal

## Why

zack (2026-10-30): "a new kind of downhill section that includes cross traffic, situated somewhere in the world
progression to mix things up for pacing. There could be taxis you can skitch on like the trolley, that give you speed
on the flat parts, which get you speed to hit kickers that blast you up to the power lines again. We can introduce
Chinatown as a level style." Art references: /mnt/project-files/chinatown/refs (Walled City streets).

## What Changes

- **Placement** (`CHINATOWN` in `src/gen/hills.ts`): on floors 5, 8, 11 and 14 (the middle floor of acts 2-5, Endless
  every third floor) the stretch of hill up the first cable car is a Chinatown block, recipe
  `cross, skitch, cross|railHill, cross, stairs`. `Level.chinatown` marks it for the art.
- **Cross traffic down the hill** (`'cross'` beat, `src/traffic/hill-cross.ts`): each block runs down to a flat
  intersection where cars drive straight across, both ways, through your lane. Ollie them, hop their roofs, or skate
  the gap. A car from the far end shows for over a second before it reaches your lane. Its light on the corner is red
  while a car is close.
- **Cab skitch** (`'skitch'` beat, `src/traffic/cab.ts`, `Skater.skitching`): a long flat with a cab idling at its
  start. It pulls off as you come up; roll into its back bumper and you grab on (the cable car's tow pose). It floors it
  to 2.5x cruising speed, and lets go at the corner before the kicker, where it turns off. Ollie to let go early.
- **Kicker to the power line**: a kicker ramp (`Surface.kicker`, now also on a hill's flat) throws you along its face
  at the speed you hit it (no slope slowdown on a kicker). The top route's power line over that block starts
  `wireOverLip` (5) tiles over the lip and holds that height for 14 tiles: at the cab's speed an ollie on the ramp and
  a flip at the top clears it by about a tile; at your own speed you fall about a tile short. All physics, no launch.
- **Greybox look** (`src/render/chinatown-view.ts`): cross cars, lights, the yellow cab with its roof sign; the cross
  streets run on to the camera (`hillside.ts` breaks the wall and front houses there). Chinatown art is next.
- Level editor: `cross` and `skitch` beat chips.

## Impact

`tests/chinatown.test.ts`: placement, cross traffic in the lane, and the cab-speed gate on the wire for four seeds.
Floors 5/8/11/14 still validate (the reference bot clears them in 1-3 tries).
