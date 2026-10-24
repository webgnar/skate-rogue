# Design

## Stance and space

Regular stance facing the camera: travel is +x, left (front) foot toward the nose, toes toward the camera (+z), heels
away. Pose values are in the skater's own tiles; the rig is scaled 1.15 to stand about 2 tiles tall like the sprite.

## Trick mechanics

- Ollie (re-keyed from zack's ollie sequence photo): crouch deep with the torso folded and hands by the knees, with the front foot behind the front bolts and the back foot on the tail; the tail snaps down, the
  board tips over the back wheels until the tail strikes the ground (0.58 rad for this deck height), then rises nose
  first pivoting on the tail, standing up to about 1 rad while the front foot drags up the grip (front knee to the
  chest, back leg long, back arm straight up). Level at the top with both knees tucked high; the front foot pushes
  the nose a little low on the way down, arms out wide.
- Kickflip: the front foot flicks off the heel-side edge, the heel edge goes down and the board rolls toe edge up
  toward the heels (roll -2π). Keyed from zack's photos of tweaked kickflips: the body keeps rising away from the
  board and at the height of the flip the legs split wide over it (front leg kicked out past the nose, back knee up,
  board turning in the gap below the feet), back arm flung overhead, front arm reaching down, head looking at the
  board. The legs close and the back foot catches first.
- Heelflip: the front heel kicks off the toe-side edge toward the camera; the board rolls the other way (+2π).
- Pop shove-it (backside): the back foot scoops the tail behind the heels and the board spins flat -π (360: -2π).
- 50-50: hangers on the rail. Ledges and flat bars take turns between 50-50, crooked grind (front truck locked,
  nose pressed on the rail, tail up and swung toward the toe side, weight forward, arms wide) and backside smith
  (back truck locked, nose dipped past the far side, weight on the back leg, back arm up), from zack's photos. Backside boardslide: board across the rail on the middle of the deck, nose away from
  the camera, chest turned down the rail.
- Push: front foot turned toward the nose, standing knee deep, back foot planted on the toe side and kicked back.
  Push at cruising speed (two strokes, then roll about 1.3 s); roll without pushing when carrying extra speed.

## Rendering

The skater lives in `StreetView.front`, rendered after `clearDepth()`, so it is always in front of the level but its
own parts still occlude each other.

## Slams

A slam throws the skater off: knees buckle, head whips back, the board shoots ahead tumbling, they pitch onto their
hands, bounce and scramble back on (0.9 s). It spawns a comic-book impact burst: an open cylinder whose shader draws
a jagged, ink-outlined burst (white core, yellow, red tips, halftone dots, speed lines); over 0.55 s the cylinder
shortens, its top flares wide and it dissolves cell by cell. The camera shakes. Landing from a drop of about 4 tiles
or more spawns a smaller burst.
