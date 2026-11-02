// Who shows where two surfaces lie in one plane. Pieces of the kit built on their own often meet flush: a sewer's
// brick end wall in the same plane as the hill's concrete, the ground under a tunnel behind the subway's lining, a
// grass top laid on a pier's top. With nothing to choose between them the depth test flips pixel by pixel and the
// two flicker through each other as the camera moves (z-fighting; scripts/zfight finds them). A polygon offset
// settles it: a fill steps back a hair and loses every tie, a mark laid on a surface steps forward and wins every
// tie. It's a few steps of the depth buffer, far too little to show through anything really in front.
import type * as THREE from 'three';

// how far each kind of surface steps back (+) or forward (-), in polygon offset units (factor and units alike)
export const DEPTH = {
  rock: 2, // the dark ground drawn in under the sewers: loses to everything
  fill: 1, // the hill's concrete mass and the street's slab sides: loses to walls and marks on it
  mark: -1, // thin things laid flat on a surface: wires, chevrons, paint
};

// set a material's step; returns it
export function depthStep<M extends THREE.Material>(m: M, step: number): M {
  m.polygonOffset = step !== 0;
  m.polygonOffsetFactor = step;
  m.polygonOffsetUnits = step;
  return m;
}
