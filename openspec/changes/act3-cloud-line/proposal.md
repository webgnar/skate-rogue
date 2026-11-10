# act3-cloud-line

## Why
zack (2026-11-10): act 3 starts in the clouds, so the cloud route should be the act: "in order to pass act 3, you
gotta take the cloud route all the time, if you fall, u just gotta grind out that level on the surface and then it
makes you restart act 3". And the route has to be more fun than an accent on the level: rainbow hubbas, S-shaped
rails and I-beams, drone stomping, quarterpipes that launch you up through a cloud onto a big rail down.

## What changes
- Act 3's cloud layer lays sets between its clouds (src/gen/clouds.ts `CLOUD_LINE`, `LAUNCH`): the rainbow hubba,
  the S-rail, the S I-beam, the drone bridge and the launch (quarterpipe, cloud bank, downrail, flat, again).
- The launch quarterpipe sets a fixed speed for its throw (`Surface.launchHsp`); gaps crossed by a launch or a drone
  bridge are `level.airways`, never decked over by the sky line's bridging.
- Act 3 drops the girder staircases and the window washer's rig; the crane jib gets a low cloud under it.
- Falling off is for good: `FloorSim.fell` and a 'grounded' event; the game restarts the act from its first floor
  after this one, with fresh layouts (src/game/game.ts `restartAct`, `act3Retries`).
- The sky bot reads drones as decks, never ollies on a launch, and doesn't aim for the power lines in act 3.
- The new pieces are drawn in src/render/sky-pieces-view.ts.
