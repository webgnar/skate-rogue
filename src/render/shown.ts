// Performance pass on small iPhones (2026-10-31).
import * as THREE from 'three';

// the street's world matrices for the frame, skipping hidden branches: three walks every node on every render,
// hidden or not, and the pools kept hidden until used (peds, choppers, the floors' spare props) were over half the
// street's 600-odd nodes. A skipped branch is marked, so the frame it shows again it's worked out in full.
const plainUpdate = THREE.Object3D.prototype.updateMatrixWorld;
export function updateShown(o: THREE.Object3D, force: boolean): void {
  if (o.matrixAutoUpdate) o.updateMatrix();
  if (o.matrixWorldNeedsUpdate || force) {
    if (o.matrixWorldAutoUpdate) {
      if (o.parent) o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix);
      else o.matrixWorld.copy(o.matrix);
    }
    o.matrixWorldNeedsUpdate = false;
    force = true;
  }
  for (const c of o.children) {
    if (!c.visible) c.matrixWorldNeedsUpdate = true;
    else if (c.updateMatrixWorld === plainUpdate) updateShown(c, force);
    else c.updateMatrixWorld(force); // cameras and skinned meshes do more (three's own walk below them)
  }
}
