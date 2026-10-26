// Shaders compile once a session (performance thread, zack 2026-10-26: "lots of hang ups"). Compiling a shader
// stalls the frame it's first drawn on, a tenth to two thirds of a second on the phones we measured against, and
// three.js throws a compiled program away as soon as the last material using it is disposed. Floors, slams and
// gates dispose theirs all the time, so the same shaders compiled again and again through a run. Two fixes:
//  - every program three makes is pinned: it's never freed, so a material made later with the same settings picks
//    it up at once (there are only ever a hundred or so);
//  - a ShaderMaterial's program is filed under ids three hands out per shader source, and those ids are dropped
//    with the last material using the source, so a fresh material got fresh ids and a fresh compile even with the
//    program pinned. The first compiled material of each source is kept (its dispose is skipped) so the ids stay.
// The loading screen then compiles everything up front (StreetView.warm), so a run should compile nothing.
import * as THREE from 'three';

type Program = { usedTimes: number };
let patched = false;

export class ShaderKeep {
  private readonly pinned = new WeakSet<object>();
  private count = 0;
  private readonly kept = new Set<string>();

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    if (patched) return; // one game renderer a page
    patched = true;
    const kept = this.kept;
    const props = renderer.properties;
    const dispose = THREE.Material.prototype.dispose;
    THREE.Material.prototype.dispose = function (this: THREE.Material) {
      const s = this as THREE.ShaderMaterial;
      if (s.isShaderMaterial && props.has(s) && (props.get(s) as { currentProgram?: unknown }).currentProgram) {
        const key = `${s.vertexShader}\u0000${s.fragmentShader}`;
        if (!kept.has(key)) {
          kept.add(key);
          return;
        }
      }
      dispose.call(this);
    };
  }

  // pin the programs made since the last call (cheap: only looks when the count changed)
  pin(): number {
    const programs = (this.renderer.info.programs ?? []) as unknown as Program[];
    if (programs.length === this.count) return 0;
    let fresh = 0;
    for (const p of programs) {
      if (this.pinned.has(p)) continue;
      this.pinned.add(p);
      p.usedTimes++;
      fresh++;
    }
    this.count = programs.length;
    return fresh;
  }
}

//three files a program under some of the geometry's attributes too (normals): a stand-in has the usual ones
const TINY = new THREE.PlaneGeometry(0.001, 0.001);

// a hidden stand-in drawing with `material`, for something made on the fly (a slam's burst): kept in the scene, so
// the loading screen compiles its shader along with everything else
export function warmMesh(material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(TINY, material);
  m.visible = false;
  m.frustumCulled = false;
  m.name = 'warm';
  return m;
}
