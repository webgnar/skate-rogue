# ui9-boons-below-meters

## Why
zack (2026-10-31): "upgrades shouldnt overlap stoke meter on mobile". The held-boon chips sat at a fixed offset from
the top, but the top bar wraps taller on a phone held upright, so the chips covered the HEAT row under STOKE.

## What changes
- The HUD measures where the top bar ends (a ResizeObserver on #top sets `--top-b` on #hud) and the boon chips sit
  just under it, on every screen and both ways round. The portrait-only fixed offset is gone.
