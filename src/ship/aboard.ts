// The ship between runs, wired to the game (main.ts): the crew's models load in the background once the run is
// going, the hub (hub-scene.ts) is drawn behind the run summary, the camera moves in on the crew while the unlocks
// screen is open (a skater bought there wakes up), and act 5's win plays the Chapter 1 ending (ending-scene.ts).
import type * as THREE from 'three';
import type { SkaterId } from '../render/skater-rig';
import { loadSave, writeSave } from '../run/save';
import { has } from '../run/meta';
import { loadCrew } from './crew';
import { loadPleiadians } from './pleiadians';
import { HubScene } from './hub-scene';
import { EndingScene, type EndingUi } from './ending-scene';
import { SpaceFallScene } from '../cutscene/space-fall';
import { ActBreakScene, type ActBreak, type CutsceneUi } from '../cutscene/act-breaks';

export class Aboard {
  private hub: HubScene | null = null;
  private rigs: Awaited<ReturnType<typeof loadCrew>> = {};

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly rider: SkaterId,
    private readonly all: boolean, // ?unlockall: the whole crew awake
  ) {}

  // load the crew and build the hub, its shaders compiled before it's first drawn
  async load(base: string, meshy: boolean): Promise<void> {
    [this.rigs] = await Promise.all([loadCrew(base, meshy), loadPleiadians(base)]);
    const hub = new HubScene(this.renderer);
    this.crew(hub);
    hub.setBank(loadSave().stoken, true);
    hub.pose(0); // posed and placed once, so the compile sees what it will draw (not drawn: a draw compiles every shader on the spot)
    await this.renderer.compileAsync(hub.scene, hub.camera);
    this.hub = hub;
  }

  get ready(): HubScene | null {
    return this.hub;
  }

  private crew(hub: HubScene): void {
    const save = loadSave();
    const rider = this.rider;
    hub.setCrew(this.rigs, (id) => this.all || id === 'webster' || id === rider || has(save.unlocked, id), rider);
  }

  // behind the run summary: true if it drew
  backdrop(dt: number): boolean {
    if (!this.hub) return false;
    this.hub.frame(dt);
    return true;
  }

  // the summary's up: the core shows the bank
  summary(): void {
    this.hub?.setBank(loadSave().stoken);
    this.hub?.look('wide');
  }

  // the unlocks screen opened (in on the crew), changed something (wake whoever was bought), or closed
  unlocks(step: 'open' | 'change' | 'close'): void {
    const hub = this.hub;
    if (!hub) return;
    if (step === 'change') {
      this.crew(hub);
      hub.setBank(loadSave().stoken);
    }
    hub.look(step === 'close' ? 'wide' : 'crew');
  }

  // act 5 won: the ending, the long one the first time
  // (`force`: the long one or the short one whatever the save says, for the ?ending link)
  ending(ui: EndingUi, done: () => void, force?: boolean): EndingScene | null {
    const hub = this.hub;
    if (!hub) return null;
    const save = loadSave();
    const full = force ?? !save.endingSeen;
    if (full && force === undefined) writeSave({ ...save, endingSeen: true });
    hub.setBank(save.stoken, true);
    const scene = new EndingScene(this.renderer, hub, full, ui);
    scene.onDone = () => {
      this.crew(hub); // the rider back in their spot
      done();
    };
    return scene;
  }

  // an act cleared (1 to 4) for the first time: its act break, the rider played by their own model (null if the
  // crew aren't loaded yet, or it's been seen; `force` plays it anyway, for the ?cutscene link, and isn't remembered)
  actBreak(act: ActBreak, ui: CutsceneUi, done: () => void, force = false): ActBreakScene | null {
    const hub = this.hub;
    const rider = hub?.rider;
    if (!hub || !rider) return null;
    const save = loadSave();
    const seen = save.actBreaks ?? [];
    if (!force) {
      if (seen.includes(act)) return null;
      writeSave({ ...save, actBreaks: [...seen, act] });
    }
    const scene = new ActBreakScene(this.renderer, rider, () => hub.inkWidths(), act, ui);
    scene.onDone = () => {
      this.crew(hub); // the rider back aboard, in their spot
      done();
    };
    return scene;
  }

  // act 5's bail: lost in space, the rider falling away to Earth (null if the crew aren't loaded yet)
  spaceFall(done: () => void): SpaceFallScene | null {
    const hub = this.hub;
    const rider = hub?.rider;
    if (!hub || !rider) return null;
    const scene = new SpaceFallScene(this.renderer, rider, () => hub.inkWidths());
    scene.onDone = () => {
      this.crew(hub); // the rider back aboard, in their spot
      done();
    };
    return scene;
  }
}
