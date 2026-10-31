import { afterEach, describe, expect, it } from 'vitest';
import { buildFloor, type FloorOptions } from '../src/gen/descent';
import { floorRecipe, hillDials, recipe, RECIPES, stretches } from '../src/gen/hills';
import { SAVED_EDITS, useLevelEdits, type LevelEdits } from '../src/gen/level-edits';
import { CLOUDS } from '../src/gen/clouds';
import { SEWER } from '../src/gen/sewer';
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
    //the finale's street; each street chase between stretches of hill brings its own pieces on top
    const chases = (stretches(2026, 2).length - 1) * hillDials(2).chasePieces;
    expect(L.layout.pieces.filter((p) => p.tier > 0).length).toBe(5 + chases);
  });

  it('stretches the chases and the cable car climbs', () => {
    useLevelEdits(none);
    const a = buildFloor(2026, 7, PIECES, opts);
    expect(a.hillSpans!.length).toBeGreaterThan(1);
    useLevelEdits({ floors: { '7': { chasePieces: hillDials(7).chasePieces + 2, climbTop: 30 } } });
    const b = buildFloor(2026, 7, PIECES, opts);
    expect(hillDials(7).climbTop).toBe(30);
    expect(b.hillSpans![1][0] - a.hillSpans![1][0]).toBe(2 * 16 * TILE);
    expect(sectionNotes(b).some((n) => n.text === 'cable car ↑30')).toBe(true);
  });

  it('moves the top route\'s power line and spaces its rooftops', () => {
    useLevelEdits(none);
    const a = buildFloor(2026, 7, PIECES, opts);
    const firstWire = (L: typeof a) => L.rails.find((r) => r.top)!.x0;
    useLevelEdits({ floors: { '7': { topStart: 0.1, roofGap: [5, 5], flocks: 0 } } });
    const b = buildFloor(2026, 7, PIECES, opts);
    expect(firstWire(b)).toBeLessThan(firstWire(a));
    expect(b.flocks ?? []).toHaveLength(0);
    const roofs = b.surfaces.filter((s) => s.top).sort((x, y) => x.x0 - y.x0);
    const gaps = roofs.slice(1).map((r, i) => r.x0 - roofs[i].x1).filter((g) => g < 6 * TILE);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((g) => g === 5 * TILE)).toBe(true);
    expect(floorSVG(b, 0.3)).toContain('TOP ROUTE');
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

  it('turns the cloud layer and the sewer on and off per floor, and puts their dials back', () => {
    const before = JSON.stringify([CLOUDS, SEWER]);
    useLevelEdits(none);
    const code = buildFloor(2026, 7, PIECES, opts);
    expect(code.sewers?.length).toBeGreaterThan(0);
    useLevelEdits({ floors: { '7': { sewer: { on: false }, clouds: { on: false } } } });
    const off = buildFloor(2026, 7, PIECES, opts);
    expect(off.sewers).toBeUndefined();
    expect(off.surfaces.some((s) => s.sky === 'cloud' || s.sky === 'step')).toBe(false);
    useLevelEdits({ floors: { '3': { clouds: { on: true, room: 40, mix: ['puff'] }, sewer: { pipes: 0, stoken: 0.5 } } } });
    const on = buildFloor(2026, 3, PIECES, opts);
    expect(on.surfaces.some((s) => s.sky === 'cloud')).toBe(true);
    expect(on.rails.some((r) => r.sky === 'rainbow') || on.rails.some((r) => r.sewer)).toBe(false);
    expect(JSON.stringify([CLOUDS, SEWER])).toBe(before);
    expect(isLevelEdits({ floors: { '3': { sewer: { len: [30, 40], on: true } } } })).toBe(true);
    expect(isLevelEdits({ floors: { '3': { sewer: { len: 'long' } } } })).toBe(false);
    expect(floorSVG(on, 0.3)).toContain('SEWER');
  });
});
