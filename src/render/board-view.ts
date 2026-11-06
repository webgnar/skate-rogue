// The pause card's board (zack, 2026-11-06: "a 3d model of the players actual board"): the board the skater is riding,
// deck, graphic, grip and wear, turning slowly on its own little canvas. It's a copy of the rig's board that shares its
// geometry and materials, so it's taken fresh each time the card opens and shows the board as it is right then.
// It rolls over slowly about its length, grip side then graphic; drag it to roll it yourself. Only draws while the card is up.
import * as THREE from 'three';

export const BOARD_VIEW = {
  spin: 0.9, // radians a second it rolls over on its own, about its length like a slow kickflip: grip, then graphic
  yaw: -0.4, // radians the nose is turned off square, so it reads as a 3D board, not a plank
  tilt: 0.3, // radians it leans towards you
  drag: 0.012, // radians per pixel dragged
  fill: 0.92, // the board's length as a share of the canvas's width
};

export class BoardView {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  private readonly turn = new THREE.Group(); // rolls about the board's length (x)
  private readonly lean = new THREE.Group(); // turns and tips it towards you
  private copy: THREE.Object3D | null = null;
  private angle = 0.6;
  private last = 0;
  private raf = 0;
  private held: number | null = null; // the pointer's x while dragging

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly source: () => THREE.Object3D | null,
  ) {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5a88, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 4, 3);
    this.scene.add(key);
    this.lean.rotation.set(BOARD_VIEW.tilt, BOARD_VIEW.yaw, 0);
    this.lean.add(this.turn);
    this.scene.add(this.lean);
    canvas.addEventListener('pointerdown', (e) => {
      this.held = e.clientX;
      canvas.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.held === null) return;
      this.angle += (e.clientX - this.held) * BOARD_VIEW.drag;
      this.held = e.clientX;
    });
    const up = () => (this.held = null);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  show(on: boolean): void {
    cancelAnimationFrame(this.raf);
    if (!on) return;
    const board = this.source();
    if (!board) return;
    if (!this.renderer) {
      try {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
      } catch {
        return; // no second WebGL context: the card just goes without the board
      }
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    }
    if (this.copy) this.turn.remove(this.copy);
    this.copy = board.clone(true);
    this.copy.position.set(0, 0, 0);
    this.copy.quaternion.identity();
    this.copy.updateMatrixWorld(true);
    this.copy.visible = true;
    //centre it and stand it lengthwise across the view, whatever its own scale
    const box = new THREE.Box3().setFromObject(this.copy);
    const size = box.getSize(new THREE.Vector3());
    const long = Math.max(size.x, size.z) || 1;
    if (size.z > size.x) this.copy.rotation.y = Math.PI / 2;
    this.copy.scale.multiplyScalar(1 / long);
    this.copy.updateMatrixWorld(true);
    const c = new THREE.Box3().setFromObject(this.copy).getCenter(new THREE.Vector3());
    this.copy.position.sub(c);
    this.turn.add(this.copy);
    this.last = performance.now();
    const frame = (t: number) => {
      this.raf = requestAnimationFrame(frame);
      this.draw(t);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private draw(t: number): void {
    const r = this.renderer!;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.round(w * r.getPixelRatio()) || this.canvas.height !== Math.round(h * r.getPixelRatio())) r.setSize(w, h, false);
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    if (this.held === null) this.angle += BOARD_VIEW.spin * dt;
    this.turn.rotation.x = this.angle;
    //far enough back that the board's length fills `fill` of the width (and fits the height)
    this.camera.aspect = w / h;
    const half = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const across = 0.5 / BOARD_VIEW.fill;
    const dist = Math.max(across / (Math.tan(half) * this.camera.aspect), across / Math.tan(half)) + 0.1;
    this.camera.position.set(0, 0, dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    r.render(this.scene, this.camera);
  }
}
