// The crew aboard the ship (src/ship/hub-scene.ts): a rig for every skater, loaded once, in the background, the
// first time the hub is wanted. The models are the ones the game already ships (public/models/<skater>.glb).
import { SKATERS, SkaterRig, type SkaterId } from '../render/skater-rig';

let crew: Promise<Partial<Record<SkaterId, SkaterRig>>> | null = null;

export function loadCrew(base: string, meshy: boolean): Promise<Partial<Record<SkaterId, SkaterRig>>> {
  crew ??= Promise.all(
    SKATERS.map(async (id) => {
      try {
        return [id, await SkaterRig.create(base, id, meshy)] as const;
      } catch (err) {
        console.warn('crew model', id, err);
        return [id, null] as const;
      }
    }),
  ).then((list) => Object.fromEntries(list.filter(([, r]) => r)) as Partial<Record<SkaterId, SkaterRig>>);
  return crew;
}
