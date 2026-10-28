// Bakes every clip in src/render/poses.ts into art/anim/clips.json: per frame (30 fps), each bone's pose and the
// board's, in the model's own space. art/lou_gnar.py turns them into Blender actions on the skinned rig.
//
//   npm run build && npx vite preview --port 4173 &
//   node art/bake_clips.cjs [http://localhost:4173/]
//
// It runs the game headless and poses the rig the way the game does (clips, leg IK, feet driving the board), so the
// Blender actions start out matching what's in the game today.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const FPS = 30;
const ROOT = path.dirname(__dirname);
const OUT = path.join(ROOT, 'art', 'anim', 'clips.json');

// clip names and lengths, read from the CLIPS table
function clipNames() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'render', 'poses.ts'), 'utf8');
  const body = src.slice(src.indexOf('export const CLIPS'), src.indexOf('export function clipLength'));
  return [...body.matchAll(/^ {2}(\w+): \{$/gm)].map((m) => m[1]);
}

// BOARD.deckTop in src/render/poses.ts: the deck's top above the ground
function deckTop() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'render', 'poses.ts'), 'utf8');
  return Number(/deckTop: ([\d.]+)/.exec(src)[1]);
}

// the sim mode each clip is shown in, so the rig doesn't switch away from it
function modeFor(name) {
  name = name.replace(/^switch([A-Z])/, (_, c) => c.toLowerCase()); // a switch twin shows in its clip's mode
  if (/^(grind\d|crooked|smith|feeble|fiveO|noseGrind|fsBoardslide)$/.test(name)) return 'grind';
  if (/^(push|ride|land|slam|manual|noseManual|firecracker|towed)$/.test(name)) return 'roll';
  return 'air';
}

(async () => {
  const url = process.argv[2] ?? 'http://localhost:4173/';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto(`${url}?debug&seed=1`);
  await p.waitForFunction(() => window.game?.sprite);
  await p.waitForTimeout(1500);
  const names = clipNames();
  const data = await p.evaluate(
    ([names, FPS, modes, deckTop]) => {
      const g = window.game;
      g.loop.advance = () => {};
      const s = g.sprite;
      s.baked.clear(); // pose from the code clips, not the Blender actions baked from them last time
      const round = (m) => m.elements.map((v) => Math.round(v * 1e5) / 1e5);
      const model = s.mesh.children.find((c) => c.getObjectByProperty('isSkinnedMesh', true));
      const skinned = model.getObjectByProperty('isSkinnedMesh', true);
      const bones = skinned.skeleton.bones.filter((b) => b.name !== 'Board'); // that one comes from the board itself
      const armature = bones[0].parent;
      let board;
      s.mesh.traverse((o) => (board ??= o.name === 'Board' && !o.isBone ? o : undefined));
      const sk = { mode: 'air', hsp: 0, fakie: false };
      const rel = (o) => {
        s.mesh.updateMatrixWorld(true);
        return armature.matrixWorld.clone().invert().multiply(o.matrixWorld);
      };
      // rest pose, from the skin's inverse bind matrices (bind space = armature space here)
      const rest = {};
      const all = skinned.skeleton.bones;
      for (const bone of bones) rest[bone.name] = round(skinned.skeleton.boneInverses[all.indexOf(bone)].clone().invert());
      const clips = {};
      for (const name of names) {
        s.fakie = false;
        s.clipName = s.shown = '';
        s.play(name, 0);
        const clip = s.clip;
        const len = clip.keys[clip.keys.length - 1].t;
        sk.mode = modes[name];
        const n = Math.max(1, Math.round(len * FPS));
        const frames = [];
        for (let f = 0; f <= n; f++) {
          // regular stance every frame: replaying a 180 would otherwise settle its spin, flip the rig to fakie and pick
          // the switch twin on every other frame
          s.fakie = false;
          s.clipName = s.shown = '';
          // and the board the right way round: a frame past a half turn would flip its facing for the next (faceBoard)
          s.pose = { ...s.pose, boardYaw: 0 };
          s.boardBack = false;
          s.boardFace.rotation.y = 0;
          s.play(name, 0);
          s.t = clip.loop && f === n ? 0 : Math.min(f / FPS, len - 1e-4); // a loop ends where it starts
          s.hold?.(name === 'idle' || name === 'busted' ? name : null); // held clips: the rig would leave them otherwise
          s.update(0, sk, 0);
          const fr = {};
          for (const bone of bones) fr[bone.name] = round(rel(bone));
          // the Board bone carries the board's move from its rest pose; the game adds the deck height back on
          // (SkaterRig.applyBaked), so record the board at its ground point, not its deck top
          fr.Board = round(rel(board).multiply(new board.matrix.constructor().makeTranslation(0, -deckTop, 0)));
          frames.push(fr);
        }
        clips[name] = { loop: clip.loop, length: len, frames };
      }
      return { fps: FPS, rest, clips };
    },
    [names, FPS, Object.fromEntries(names.map((n) => [n, modeFor(n)])), deckTop()],
  );
  await b.close();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data));
  const frames = Object.values(data.clips).reduce((a, c) => a + c.frames.length, 0);
  console.log(`baked ${Object.keys(data.clips).length} clips, ${frames} frames -> ${path.relative(ROOT, OUT)}`);
})();
