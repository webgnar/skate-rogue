// The fisheye lens (camera thread, zack 2026-10-25: "exploring fisheye FOV and zoom to add to the rhythm").
//
// The view is drawn into a texture with a wider field of view than the framing asks for, then one full-screen pass
// bends it from a flat (rectilinear) projection toward a stereographic fisheye: the middle swells, the edges curl
// in, and the corners stay where they are so nothing goes black. The camera widens its lens by exactly the swell
// in the middle (lensWiden), so Lou keeps the size the framing gives them and the extra width bends in round the
// edges. strength 0 is a plain flat picture and skips the pass entirely (no cost); 1 is a full stereographic lens.
//
// Budget: one render target the size of the drawing buffer and one textured triangle. Off on the low tier.
import * as THREE from 'three';

export const LENS = {
  fov: 20, // degrees the camera's field of view opens at full strength (dollying in to keep Lou's size)
  sharp: 1.3, // the texture is drawn this much bigger than the screen, so the swollen middle stays crisp
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D tMap;
uniform float uK;
uniform vec2 uTan; // tan of the half field of view across and up
varying vec2 vUv;
void main() {
  vec2 q = (vUv * 2.0 - 1.0) * uTan;   // this pixel on the flat image plane
  float r = length(q);
  float rc = length(uTan);             // the corner's radius, which stays put
  float sc = 2.0 * tan(atan(rc) * 0.5);
  float th = 2.0 * atan(r * sc / rc * 0.5);  // the angle a stereographic lens shows at this radius
  float ratio = r > 1e-5 ? tan(th) / r : sc / rc;
  vec2 s = q * mix(1.0, ratio, uK);
  gl_FragColor = texture2D(tMap, s / uTan * 0.5 + 0.5);
  #include <colorspace_fragment>
}`;

// how much the lens swells the middle of the picture: the flat image's corner radius over the fisheye's
export function lensSwell(k: number, tanX: number, tanY: number): number {
  const rc = Math.hypot(tanX, tanY);
  const sc = 2 * Math.tan(Math.atan(rc) / 2);
  return 1 / (1 + (sc / rc - 1) * k);
}

// where on the flat image (tan units) the lens shows the screen point (nx, ny) in -1..1: the shader's mapping
export function lensSource(k: number, tanX: number, tanY: number, nx: number, ny: number): [number, number] {
  const qx = nx * tanX;
  const qy = ny * tanY;
  const r = Math.hypot(qx, qy);
  const rc = Math.hypot(tanX, tanY);
  const sc = 2 * Math.tan(Math.atan(rc) / 2);
  const ratio = r > 1e-5 ? Math.tan(2 * Math.atan((r * sc) / rc / 2)) / r : sc / rc;
  const m = 1 + (ratio - 1) * k;
  return [qx * m, qy * m];
}

// the tan of the half-height the camera must draw so that, after the swell, the middle shows tanY0
export function lensWiden(k: number, tanY0: number, aspect: number): number {
  let t = tanY0;
  for (let i = 0; i < 4; i++) t = tanY0 * lensSwell(k, t * aspect, t);
  return t;
}

export class Lens {
  private target: THREE.WebGLRenderTarget | null = null;
  private readonly scene = new THREE.Scene();
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { tMap: { value: null }, uK: { value: 0 }, uTan: { value: new THREE.Vector2(1, 1) } },
    depthTest: false,
    depthWrite: false,
  });
  private readonly size = new THREE.Vector2();

  constructor() {
    //one triangle that covers the screen
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const tri = new THREE.Mesh(g, this.mat);
    tri.frustumCulled = false;
    this.scene.add(tri);
  }

  // draw() renders the view; with strength over 0 it goes into the texture and comes out bent. sharp: draw the
  // texture LENS.sharp times the screen's size, so the swell in the middle doesn't blow up its pixels
  render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, k: number, chunky: boolean, sharp: boolean, draw: () => void): void {
    if (k <= 0.001) {
      draw();
      return;
    }
    renderer.getDrawingBufferSize(this.size);
    if (sharp && !chunky) this.size.multiplyScalar(LENS.sharp).round();
    const filter = chunky ? THREE.NearestFilter : THREE.LinearFilter;
    if (!this.target || this.target.width !== this.size.x || this.target.height !== this.size.y || this.target.texture.magFilter !== filter) {
      this.target?.dispose();
      this.target = new THREE.WebGLRenderTarget(this.size.x, this.size.y, { minFilter: filter, magFilter: filter, depthBuffer: true, stencilBuffer: true });
      this.target.texture.colorSpace = THREE.SRGBColorSpace;
    }
    renderer.setRenderTarget(this.target);
    draw();
    renderer.setRenderTarget(null);
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    this.mat.uniforms.tMap.value = this.target.texture;
    this.mat.uniforms.uK.value = Math.min(1, k);
    this.mat.uniforms.uTan.value.set(tanY * camera.aspect, tanY);
    renderer.render(this.scene, this.cam);
  }

  // compile the bend's shader ahead of time (the loading screen)
  warm(renderer: THREE.WebGLRenderer): Promise<unknown> {
    return renderer.compileAsync(this.scene, this.cam);
  }

  dispose(): void {
    this.target?.dispose();
    this.mat.dispose();
  }
}
