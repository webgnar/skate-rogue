import { afterEach, describe, expect, it } from 'vitest';
import { buildFloor, type FloorOptions } from '../src/gen/descent';
import { floorRecipe, hillDials, recipe, RECIPES } from '../src/gen/hills';
import { SAVED_EDITS, useLevelEdits, type LevelEdits } from '../src/gen/level-edits';
import { PIECES } from '../src/gen/pieces';
import { validatedFloor } from '../src/gen/validate';
import { TILE } from '../src/physics/constants';
import { formatLevelEdits, isLevelEdits } from '../src/levels/drafts';
import { sectionNotes, floorSVG } from '../src/levels/draw';

const opts: FloorOptions = { danger: 1, hills: true };
const none: LevelEdits = { floors: {} };

afterEach(() => useLevelEdits(SAVED_EDITS));

describe('level edits', () => {
  it('builds the same floor as the code when a floor has no edits', () => {
    useLevelEdits(none);
    const a = buildFloor(2026, 2, PIECES, opts);
    useLevelEdits({ floors: { '5': { top: 40 } } });
    const b = buildFloor(2026, 2, PIECES, opts);
    expect(JSON.stringify(b.surfaces)).toBe(JSON.stringify(a.surfaces));
  });

  it('starts the floor at the edited height', () => {
    useLevelEdits({ floors: { '1': { top: 30 } } });
    const L = buildFloor(2026, 1, PIECES, opts);
    expect(Math.round((L.streetY - L.startY) / TILE)).toBe(30);
  });

  it('follows an edited recipe', () => {
    const r = [['stairs'], ['gap'], ['stairs']] as const;
    useLevelEdits({ floors: { '3': { recipe: r.map((s) => [...s]) } } });
    expect(floorRecipe(3)).toEqual([['stairs'], ['gap'], ['stairs']]);
    expect(recipe(7, 3)).toEqual(['stairs', 'gap', 'stairs']);
    expect(floorRecipe(4)).toEqual(RECIPES[3]);
  });

  it('lets an edit raise the last stairway past the usual cap', () => {
    useLevelEdits({ floors: { '1': { top: 40, finalSet: 20, recipe: [['hill'], ['stairs']] } } });
    const L = buildFloor(11, 1, PIECES, opts);
    const biggest = Math.max(...L.surfaces.filter((s) => s.kind === 'stairs').map((s) => Math.round((s.x1 - s.x0) / TILE)));
    expect(biggest).toBe(20);
  });

  it('changes the street piece count', () => {
    useLevelEdits({ floors: { '2': { street: 5 } } });
    const L = buildFloor(2026, 2, PIECES, opts);
    expect(L.layout.pieces.filter((p) => p.tier > 0).length).toBe(5);
  });

  it('reads dials over the code', () => {
    useLevelEdits({ floors: { '6': { grade: 0.33, run: [10, 12] } } });
    const d = hillDials(6);
    expect(d.grade).toBe(0.33);
    expect(d.run).toEqual([10, 12]);
  });

  it('keeps the saved edits valid and every edited floor clearable', () => {
    expect(isLevelEdits(SAVED_EDITS)).toBe(true);
    useLevelEdits(SAVED_EDITS);
    for (const f of Object.keys(SAVED_EDITS.floors)) {
      expect(validatedFloor(2026, Number(f), opts).tierDrops).toBeGreaterThanOrEqual(0);
    }
  });

  it('rejects broken edits and formats the file in floor order', () => {
    expect(isLevelEdits({ floors: { '1': { recipe: [['skate']] } } })).toBe(false);
    expect(isLevelEdits({ floors: { '1': { run: [3] } } })).toBe(false);
    const text = formatLevelEdits({ floors: { '10': { top: 20 }, '2': { grade: 0.3 }, '4': {} } });
    expect(Object.keys(JSON.parse(text).floors)).toEqual(['2', '10']);
  });

  it('draws a floor and names its sections', () => {
    useLevelEdits(none);
    const L = buildFloor(2026, 1, PIECES, opts);
    expect(floorSVG(L, 0.3)).toContain('<svg');
    expect(sectionNotes(L).some((n) => n.text.includes('stairs'))).toBe(true);
  });
});
