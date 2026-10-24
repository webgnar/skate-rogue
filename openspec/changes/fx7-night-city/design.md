# Design

- **Window mask:** for each facade tile index, a mask texture marking window pixels (bright cells in the tile).
  The facade toon material gets `emissiveMap = mask`, `emissive` set by mood (`windows` 0 by day, up to 1 at
  night), and a per-building hash picks which windows are lit by sampling a 2D hash in the shader (via
  `onBeforeCompile`).
- **Fake lights:** one `InstancedMesh` of cones (additive, depthWrite off, fog on) and one of ground pools
  (additive decals). Lamps are placed every ~8 tiles on sidewalks and roofs from a seeded pass over the level.
- **Headlights:** each car view gets a cone and pool child, visible from dusk on, scaled by mood.
- **Billboards:** a canvas texture of slogans in the comic font, scrolling; the board's yaw eases toward the
  skater within 10 tiles. Flock cameras are a small model with an emissive red eye, yaw/pitch toward the skater.
- **Visor:** a moving specular highlight on the visor's Phong material driven by the nearest light's screen x.
