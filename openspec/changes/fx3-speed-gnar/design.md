# Design

- Speed lines live in camera-relative units (fractions of the view's half width and height at each streak's
  depth, z 3 to 12), so they fill the screen at any zoom; positions are rewritten on the CPU each frame (28 quads).
  The fragment shader tapers each streak and fades its ends; depth test off, drawn in the front pass.
- The aura reuses the outline shader with its own uniforms (width, colour) and a small depth push so it sits behind
  the ink. Its width eases in with the gnar state and pulses; its colour cycles in HSL.
- `TimeWarp.hit(0.05, 0.6, 0.3)` for the gnar beat: much lighter than a slam.
