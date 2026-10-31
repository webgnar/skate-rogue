# ui10-again-button

## Why
zack's roadmap (2026-10-31): a one-tap "Again" on the game-over screen that starts a new run at once, skipping menus.
A tap anywhere already restarted, but the only hint was a small "tap for a new run" line at the bottom, off screen on
a short phone held sideways.

## What changes
- The game-over card has a big AGAIN ▶ button right under the score, in the shop's ink button style. It starts a new
  run straight away, the same as before (newRun: same mode, no menus). A tap anywhere else that isn't a button still
  does the same thing.
- The "tap for a new run" line is gone. On short landscape screens the card packs tighter so AGAIN and UNLOCKS both fit.
