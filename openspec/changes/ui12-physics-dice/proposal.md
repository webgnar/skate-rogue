# Physics street dice

## Why

zack (2026-11-10): "for this dice rolling thing, it would be cool if it was actual physics. like if there was a 3d
ground, and the dice actually threw based on the players finger swipe or shaking the phone." Until now the roll was
decided when the run ended and the dice were animated onto that result.

## What changes

- The street dice are two rigid-body dice (cannon-es, `src/run/dice-physics.ts`) thrown onto a real 3D patch of
  night street (`src/render/dice3d.ts`: asphalt, curb, sidewalk, a lamp with shadows), walled to the view.
- The face up when both dice come to rest is the roll; the game pays it then (`DiceView.settle`, `settle()` in
  `src/run/dice.ts`). Cocked dice get a nudge.
- Throw by swiping the pair (follows the finger, flies the way and as hard as the swipe), shaking the phone (iOS
  motion permission on the first tap), or a tap / ROLL / Space (desktop). A tap mid-tumble runs the physics to the end.
- Rolls owed are saved at the end of the run (`save.diceOwed`) and banked one pair at a time, so nothing is lost if
  the app closes on the dice screen.
- Landscape phones: words left, street right.
