# ui9-callout-float

## Why
zack (2026-10-30): the trick names and points that pop up top center vanished after 0.9 s. They should float up and
shrink slowly off the screen so the player can read them if they want.

## What changes
- Each callout is its own element (src/ui/callouts.ts): it pops in, holds full size for 0.65 s, then drifts up off
  the top of the screen over 2.2 s, easing in and shrinking to 45%.
- A new callout pushes the ones still on screen up a line, so quick tricks never print over each other. At most six
  are on screen.
- The pause card freezes them. Reduce motion (?calm): no drift, they hold and fade in place.
