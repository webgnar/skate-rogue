# Animation reference: Lou Gnar's moves

This is the reference for keying Lou Gnar's clips in Blender. For each move it gives the real mechanics, then the
key poses to key in order, then the reference we have and what's missing.

**Where the pictures are:** this repo is public, so photos and video frames from zack or the web are not committed.
They live in the project's shared files under `reference/<move>/`. Lou Gnar's sprite sheets are in
`webgnar/excaliburSkate` `public/images/` (66 × 75 px frames).

**Conventions** (the same as `src/render/poses.ts`): regular stance, chest toward the camera, rolling toward +X
(left foot, the front foot, is toward the nose). Toe side is toward the camera, heel side is away from it.
"Backside" spins turn the tail behind the heels, away from the camera. Clip times are seconds. The physics owns
airtime, so air clips are keyed for about 0.6 s and loop or hold at the top.

**Reference status**, best first:

| Move | Reference we have | Need from zack |
| --- | --- | --- |
| Ollie | zack's 8-frame sequence photo (over a hydrant), sprite `ollie.png` | — |
| 360 flip | zack's slow-mo clip (149 frames, travelling left), contact sheet | — |
| Kickflip | 2 photos of tweaked kickflips at the top, sprite `kickflip.png` | a sequence of the flick and catch |
| Backside smith | 1 photo (ledge), no sprite | the pop in, and the exit |
| Crooked grind | 1 photo (flat bar), no sprite | the pop in, and the exit |
| Heelflip | sprite `heelflip.png` only | photos or a clip |
| Pop shove-it, 360 shove-it | sprites `shuv1.png`, `shuv2.png` only | photos or a clip of the scoop |
| 50-50 | sprite `grind1.png` only | a photo on a ledge and on a handrail |
| Backside boardslide | sprite `grind2.png` only | photos down a handrail |
| Push | sprite `push.png` only | a side-on clip of a few pushes |
| Landing | sprite `impact.png` only | — (the stomp in the 360 flip clip helps) |
| Slam, bail | sprite `freefall.png` only | slam clips, any angle |
| Idle | sprite `idle.png` only | — |
| Frontside and backside 180 | none | — (mechanics are standard; photos welcome) |

## Push

The front foot turns to point at the nose, just behind the front bolts. The back foot steps off on the toe side
and pushes in a walking motion, then swings back onto the tail. The front foot then pivots back across the board.
Push regular, not mongo (pushing with the front foot).

Key poses (one stroke, about 0.9 s):
1. 0.00: riding stance, front foot just turned 70-80° toward the nose, weight on it, knee bending.
2. 0.20: back foot reaching ahead, beside the front truck on the toe side; standing knee deep.
3. 0.45: push: back foot sweeping back past the tail, leg extending; torso leans forward a little, arms swing in
   opposition.
4. 0.65: back leg fully extended behind, toe just off the ground.
5. 0.90: back foot lands on the tail; front foot starts pivoting back across the board (ride pose by about 1.1 s).

## Ollie

The back foot (ball of the foot, across the tail) snaps the tail down. The tail strikes the ground while you jump.
The front foot (just behind the front bolts) drags the side of the shoe up the grip toward the nose. That levels the
board while both knees come up. Shoulders stay centered over the board. Feet move back over the bolts for the
landing.

Key poses (sequence photo, left to right):
1. Crouch: knees deep, chest folded over the knees, hands low; back foot on the tail, front foot behind the bolts.
2. Pop: tail on the ground, board about 30° nose up; back leg straightening, front knee lifting; arms starting up.
3. Slide: board up to about 55°, pivoting on the tail; front foot dragged halfway up the grip; front knee near the
   chest; back arm high.
4. Level: board level at the top, both knees tucked high, arms out wide.
5. Descent: legs extend toward the bolts, front foot slightly pushing the nose down.
6. Land: knees absorb, arms come down; ride away.

## Kickflip

Back foot on the tail pocket. The front foot sits behind the bolts at about 45°, heel hanging off the heel side,
toes toward the toe-side front corner. Chest opens toward the nose. Pop like an ollie. The front foot slides up and
flicks off the heel-side front corner, up and out, not down. The board rolls toe edge up toward the heels (the
negative roll in `poses.ts`). The back knee bends so the back foot rises out of the way. Catch with the back foot
when the grip comes round, then stomp the bolts.

Key poses (tweaked, from zack's photos):
1. Crouch and pop as for the ollie.
2. Flick: front foot leaves the board off the heel-side nose corner; board about 20° nose up and starting to roll.
3. Top (both photos): body high above the board; legs split wide, front leg kicked out past the nose, back knee up;
   the board half flipped in the gap below the feet, showing its bottom; back arm flung overhead, front arm reaching
   down toward the board; head down, watching it.
4. Catch: legs close, the back foot meets the grip first, then the front.
5. Land on the bolts, knees deep.

## Heelflip

The front foot sits near the middle of the board with its toes hanging off the toe side. Pop straight. The front
foot kicks forward and out off the toe-side nose corner with the outside (pinky side) of the foot. The board rolls
heel edge up toward the toes (positive roll). Stay upright, because hunching makes it land behind you. Knees to
the chest, watch, catch, stomp.

Key poses:
1. Crouch, upright chest; front toes over the toe edge.
2. Pop and kick: front leg kicks forward-out toward the camera side of the nose; board starts rolling.
3. Top: knees tucked toward the chest, board rolling below; arms out; head down.
4. Catch with the back foot, then the front; land on the bolts.

Gap: only the sprite. A heelflip photo at the top would settle how far the front leg kicks out.

## Pop shove-it (backside) and 360 shove-it

Ollie stance, but the back foot doesn't hang over the tail. Pop and scoop: the back foot pushes the tail down and
sweeps it behind the heels, so the board spins 180° flat (360° for the 360 shove-it), staying fairly level. The
front foot just leaves the board and steadies the spin, with no ollie drag. The front foot catches the grip as it
comes round, both feet over the bolts, and all four wheels land together.

Key poses:
1. Crouch.
2. Pop and scoop: tail down; the back foot scooping behind (heel side); the board starting to turn, tail swinging
   away from the camera.
3. Air: knees up, feet spread just enough for the board to spin below; arms out for balance; torso doesn't turn.
4. Catch: front foot touches down first as the 180 (or 360) completes.
5. Land level.

Gap: only sprites. A clip of the scoop would help most.

## 360 flip (tre flip)

A 360 backside shove-it and a kickflip at once. The back foot scoops hard behind (the 360 shove-it scoop) while
popping. The front foot flicks forward off the heel-side nose corner, more toward the nose than in a kickflip. The
board pops near vertical and spins and flips together. Knees come up high and the body stays square. The back foot
catches first, then the front, and you stomp the bolts.

Key poses (zack's slow-mo clip; frame numbers out of 149):
1. f0-6: setup: back foot in the tail pocket, front foot angled behind the bolts.
2. f12-18: pop and scoop: tail strikes, the board tips up; the back foot sweeps behind toward the heel side and the
   front foot slides and flicks off the front corner.
3. f24-42: the board stands almost upright while spinning backside and starting to flip; both knees lift clear.
4. f48-72: mid-trick: the board shows its bottom while still rotating; feet high, legs apart.
5. f78-96: the spin and flip finish together, nose round to the front again, the board nearly level, grip
   coming up.
6. f100-110: catch: the back foot meets the tail first, then the front foot over the bolts.
7. f114-130: land on the bolts, knees bent; f130-148 roll away.

The clip travels left, so mirror it for Lou Gnar rolling right. The spin is still backside (the tail goes behind the
heels) and the flip is still kickflip direction.

## 50-50

Pop an ollie onto the ledge or rail with both trucks on it, the board along the ledge. Weight is centered over the
board, knees soft, shoulders square to the direction of travel and arms out for balance. On ledges the back truck
can lock in slightly more than the front. Exit by pressing the tail lightly and ollieing off the end.

Key poses:
1. Ollie up (from the ollie clip).
2. Lock in: both trucks on the edge, slight crouch, arms out.
3. Hold (loop): small balance sway of the arms and hips.
4. Exit: a small ollie off the end.

## Crooked grind (crooks)

From zack's photo: the front truck is locked on the bar with the nose pressed down onto it. The board is turned a
little so the tail swings toward the toe side and is up off the bar. Weight is forward on the front leg, which is
bent, while the back leg stays straighter and higher. Shoulders face down the bar and arms are out wide. The head
looks down the bar.

Key poses:
1. Ollie up, nosing over the bar.
2. Lock in: front truck on, nose pressed, tail up and out toward the toe side.
3. Hold: the pose above, small arm sway.
4. Exit: pop off the nose, turning the board straight.

## Backside smith

From zack's photo: the back truck is locked on the ledge. The nose dips down past the far side of the ledge (away
from the camera, backside) with the front truck below the ledge's top. Weight is on the back leg, which is bent.
The front leg is straighter, pushing the nose down. The back arm is up high and the front arm is low and forward.

Key poses:
1. Ollie up, back truck landing on the edge.
2. Lock in: nose dips past the far side, the board tilted along its length and rolled toward the ledge.
3. Hold: small sway.
4. Exit: pop off the tail, bringing the nose up and over.

Gap: one photo; the lock-in and exit need a sequence.

## Backside boardslide

The rail is behind you (heel side). Pop about a 90° frontside ollie so the middle of the board lands across the
rail. Shoulders wind up before the pop. Feet stay on or near the bolts. Stay over the board, leaning slightly
forward down the rail, because leaning back slips out. Hips and legs bring the board back 90° at the end to ride
away regular.

Key poses:
1. Wind up: shoulders turned toward the rail.
2. Pop and turn: a frontside 90 ollie, the board crossing the rail.
3. Slide (loop): the board across the rail, nose away from the camera; chest turned down the rail; knees soft; arms
   out; the head looking down the rail.
4. Exit: turn the board back 90°, land regular.

Gap: only the sprite. A handrail photo or two would help most.

## Landing

Stomp both feet over the bolts with knees deep (the sprite's `impact.png` takes 350 ms). The torso folds forward a
little and arms come down and out, then the skater stands back up into the ride pose.

## Slam and bail

A slam throws the skater off the board: knees buckle, the head whips back, the board shoots ahead, then the hands go
down and the skater bounces and scrambles back on (0.9 s). A bail (`freefall.png`) is falling with arms and legs
flailing.

Gap: no photo references. Any slam footage helps.

## Stance: 180s and fakie

A frontside or backside 180 turns the skater and board half a turn, so they roll on with the back foot leading:
**fakie** (normal stance, travelling backward). Every trick from there is its fakie version, and a **nollie** pops
the nose with the front foot. Riding the opposite stance going forward is **switch**. In the side view, fakie Lou
has the right foot toward +X and the back to the camera. The rig gets this by turning Lou and the board 180° about
vertical, so a regular clip played that way pops the leading end, which is correct for a fakie ollie.

- Backside 180: the shoulders wind frontside, then the back turns toward the direction of travel as the board
  turns; the skater lands looking over the leading shoulder.
- Frontside 180: the chest opens toward the direction of travel; this one is easier to see the landing on.
- Key poses: wind up (shoulders against the turn), pop (ollie pop, shoulders starting the turn), mid-air at 90°
  (board across the line of travel, knees up), land at 180° on the bolts.

## Idle

A relaxed stance on the board for the title and shop screens: weight shifting, a look around, a glance at the board.
`idle.png` has 4 frames at 100 ms.

## Sources

- Braille Skateboarding: [how to kickflip](https://www.brailleskateboarding.com/blogs/news/how-to-kickflip),
  [how to heelflip](https://www.brailleskateboarding.com/blogs/news/how-to-heelflip),
  [how to backside boardslide](https://www.brailleskateboarding.com/blogs/news/how-to-backside-boardslide),
  [how to push](https://www.brailleskateboarding.com/blogs/news/how-to-push-on-a-skateboard)
- Sidewalk: [beginner pop shuvit](https://sidewalkmag.com/longform/beginner-pop-shove-it)
- Switch: [how to ollie in 10 easy steps](https://www.switchnow.ca/blogs/switch-skate-snow-blog/how-to-ollie-in-10-easy-steps)
- zack's photos and clip (project shared files, `reference/`)
