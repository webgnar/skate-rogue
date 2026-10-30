// Lou in the world, not pasted over it (zack, 2026-10-30: a playtester asked why the player is always drawn in front
// of everything). Lou used to draw in his own pass after the depth was cleared, so nothing could ever hide him. Now
// his pass keeps the level's depth: poles, near-lane cars, the low wall and the foreground houses pass in front of
// him. Two things keep it fair:
//  - A margin. His depth is pulled GHOST.margin tiles toward the camera (biasCamera), so what he rides (a rail, a
//    ledge, the street under his wheels, a car roof) never cuts into his board or feet; only things well in front
//    of his lane hide him.
//  - A ghost. Where he's hidden, his shape shows through as a hot pink (or yellow, ?ghost=yellow) ordered dither of
//    chunky pixels: no outline, so it reads as "Lou, behind that". One extra draw of his meshes, depth test only.
import * as THREE from 'three';
import type { Ghost } from './fx-settings';

export const GHOST = {
  margin: 1.6, // tiles: things nearer the camera than Lou by less than this never hide him
  colors: { pink: 0xff3cae, yellow: 0xffd23a } as Record<Ghost, number>,
  cell: 2, // dither cell in CSS pixels, so it stays chunky on every phone
};

const vertex = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
  void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    #include <project_vertex>
  }
`;

// a 50% checker dither in chunky screen cells: the classic see-through-the-wall pixel pattern
const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uCell;
  void main() {
    vec2 c = floor(gl_FragCoord.xy / uCell);
    if (mod(c.x + c.y, 2.0) > 0.5) discard;
    gl_FragColor = vec4(uColor, 1.0);
    #include <colorspace_fragment>
  }
`;

export function ghostMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { uColor: { value: new THREE.Color(GHOST.colors.pink) }, uCell: { value: GHOST.cell } },
    depthFunc: THREE.GreaterDepth, // only where the level is in front of him
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// `out` set to `camera` with depth pulled `margin` world units toward it for things `dist` in front of it (the
// skater): x and y land where they did, only the depth test changes. The depth buffer holds -e10 - e14 / z for view
// depth z (clip z = e10 z + e14 over w = -z); scaling e14 by d / (d - m) gives exactly the depth of a point m nearer
// at d, and near enough over the skater's own few tiles of depth
export function biasCamera(camera: THREE.PerspectiveCamera, dist: number, margin: number, out: THREE.PerspectiveCamera): THREE.PerspectiveCamera {
  out.copy(camera, false);
  const e = out.projectionMatrix.elements;
  const d = Math.max(dist, margin + 0.5);
  e[14] *= d / (d - margin);
  out.projectionMatrixInverse.copy(out.projectionMatrix).invert();
  return out;
}
