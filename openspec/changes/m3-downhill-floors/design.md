# Design

## Context

A floor today is a QFS piece layout on one street at a fixed height; rooftops (`R`) are one-way surfaces with a
building drawn below. The descent keeps that model: terraces are rooftop surfaces, gaps have no street below them,
and the street finale is the existing piece layout placed after the descent.

## Decisions

- **Sections, not ASCII, for the descent.** Stair sets and handrails need exact geometry (steps, rail height,
  clearable lengths), so `descent.ts` builds them from parameters with the floor RNG. The finale reuses
  `makeLayout` pieces so canals, curved rails and parked cars stay.
- **Stairs:** run 1 tile, rise 16 px per step, 4 to 16 steps. A sloped surface with `kind: 'stairs'`. Touching it
  from the air or rolling onto it is a slam (Heat +35) and you roll down it to the bottom terrace.
- **Handrails:** a straight `CurvedRail` (curve 0) from 24 px above the top landing's edge to 24 px above the bottom
  step, offered on most sets and always on sets the base ollie and flip can't clear (more than 8 steps).
- **Banks:** a sloped surface rising 1 to 3 tiles over 3 to 6 tiles; you roll up it and leave the top edge with
  `vsp = slope * hsp`, a small kick.
- **Gaps:** 2 to 5 tiles between terraces, the far side 0 to 4 tiles lower. No street under the descent, so missing
  is a fall into the alley and a bail.
- **Size:** floor 1 about 150 tiles and 14 tiles high; each floor adds about 20 tiles of descent and 2 of height,
  capped at 24 sections.
- **Traffic** only spawns over the street finale.

## Risks / Trade-offs

- [Big drops leave the camera behind] → the camera's vertical follow speeds up when falling.
- [Long stair sets without a handrail are unclearable] → the generator always adds a rail past 8 steps, and the
  validator checks every floor.
