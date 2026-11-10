// Every model loads through this one loader: GLTFLoader with the meshopt decoder, so a .glb whose meshes were
// compressed (EXT_meshopt_compression, scripts/crazygames/meshopt.mjs does it to the CrazyGames build) loads the same
// as a plain one. The decoder only runs on compressed files; plain ones load exactly as before.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export function gltfLoader(): GLTFLoader {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}
