// zack's hand-drawn card pictures (src/ui/shop-art.ts handArt): every boon, curse, duo and board mod, and the
// shop's slot card, has its picture in public/sprites/cards/art, small enough for the CrazyGames 20 MB build
import { describe, expect, it } from 'vitest';
import { BOONS } from '../src/boons/defs';
import { MOD_DEFS } from '../src/board/mods';
import { DRAWN } from '../src/ui/boon-art';

const file = (id: string) => `public/sprites/cards/art/${id}.webp`;

describe('hand-drawn card art', () => {
  it('every boon is drawn', () => {
    for (const b of BOONS) expect(DRAWN.has(b.id), b.id).toBe(true);
  });

  it('every card has its picture, under 40 KB', async () => {
    const fsId = 'node:fs';
    const { existsSync, statSync } = (await import(/* @vite-ignore */ fsId)) as {
      existsSync(p: string): boolean;
      statSync(p: string): { size: number };
    };
    const ids = [...BOONS.map((b) => b.id), ...MOD_DEFS.map((m) => m.id), 'extraSlot'];
    for (const id of ids) {
      expect(existsSync(file(id)), file(id)).toBe(true);
      expect(statSync(file(id)).size, id).toBeLessThan(40 * 1024);
    }
  });
});
