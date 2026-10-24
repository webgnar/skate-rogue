# Design

## Stance and space

Regular stance facing the camera: travel is +x, left (front) foot toward the nose, toes toward the camera (+z), heels
away. Pose values are in the skater's own tiles; the rig is scaled 1.15 to stand about 2 tiles tall like the sprite.

## Trick mechanics

- Ollie: crouch with the front foot behind the front bolts and the back foot on the tail; the tail snaps down, the
  board tips over the back wheels until the tail strikes the ground (0.58 rad for this deck height), then rises nose
  first pivoting on the tail while the front foot drags to the nose and levels it; knees tuck at the top.
- Kickflip: the front foot flicks off the heel-side edge, the heel edge goes down and the board rolls toe edge up
  toward the heels (roll -2π). Keyed from zack's photos of tweaked kickflips: the body keeps rising away from the
  board and at the height of the flip the legs split wide over it (front leg kicked out past the nose, back knee up,
  board turning in the gap below the feet), back arm flung overhead, front arm reaching down, head looking at the
  board. The legs close and the back foot catches first.
- Heelflip: the front heel kicks off the toe-side edge toward the camera; the board rolls the other way (+2π).
- Pop shove-it (backside): the back foot scoops the tail behind the heels and the board spins flat -π (360: -2π).
- 50-50: hangers on the rail. Backside boardslide: board across the rail on the middle of the deck, nose away from
  the camera, chest turned down the rail.
- Push: front foot turned toward the nose, standing knee deep, back foot planted on the toe side and kicked back.
  Push at cruising speed (two strokes, then roll about 1.3 s); roll without pushing when carrying extra speed.

## Rendering

The skater lives in `StreetView.front`, rendered after `clearDepth()`, so it is always in front of the level but its
own parts still occlude each other.
