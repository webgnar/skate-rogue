// How much a landing throws up, from the sim's impact into the surface (px/frame) and its FEEL thresholds: a kiss
// barely puffs, a normal landing dusts, a heavy one bursts and kicks the camera a little more the harder it hits.
import { FEEL } from '../physics/feel';

// dust amount for particles.dust
export function landDust(impact: number): number {
  return Math.min(1.5, Math.max(0.35, impact / FEEL.heavy));
}

// camera shake: none under heavy, then growing to a cap (well under a slam's)
export function landKick(impact: number): number {
  return impact < FEEL.heavy ? 0 : Math.min(0.2, 0.06 + 0.04 * (impact - FEEL.heavy));
}
