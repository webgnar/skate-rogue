// Freeing what a floor's views built once the floor is gone (perf thread, zack 2026-11-03). The sewer's rats, gators,
// trains and waves, the twists' ruins and streaks, the gates' portals and the sirens' light bars were taken out of
// the scene but never freed, so every floor left about 150 buffers on the GPU for the rest of the run (1,500 by
// floor 14). Materials are left alone: they hold no GPU memory of their own here, and the programs they use are
// pinned for the session (shader-keep.ts).
import * as THREE from 'three';

// a geometry made once and shared by everything that draws it (a model's flat geometry, models.ts): never freed
export function shareGeometry<T extends THREE.BufferGeometry>(geo: T): T {
  geo.userData.shared = true;
  return geo;
}

// free the geometry (and instanced meshes' instance buffers) of everything under root, bar the subtrees in `keep`
// and shared geometry. Call it on what was just taken out of the scene.
export function disposeGeometries(root: THREE.Object3D, keep: THREE.Object3D[] = []): void {
  const geos = new Set<THREE.BufferGeometry>();
  const walk = (o: THREE.Object3D) => {
    if (keep.includes(o)) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine) {
      if (mesh.geometry && !mesh.geometry.userData.shared) geos.add(mesh.geometry);
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  for (const g of geos) g.dispose();
}
