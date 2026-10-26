// Gyro tilt (zack, 2026-10-26): while the phone turns between upright and sideways, the world counter-tilts so it
// stays level with the real horizon in your hand, then settles once the screen flips to the new shape (the camera
// glides its framing there too, scene.ts glideFrame).
//
// The phone's roll comes from deviceorientation (beta, gamma): gravity in the screen's plane is
// (sin gamma cos beta, -sin beta), and its angle, less the angle the screen itself is turned to (window.orientation
// on iPhone, screen.orientation elsewhere), is how far the phone leans from the picture's upright. The camera rolls
// the other way by that much past a small dead zone, so holding the phone a little crooked doesn't tilt the game.
// iPhone asks permission for motion, which only a tap can request: the pause card's GYRO TILT switch does it, and
// with the switch on, the first tap of each visit asks again (iOS answers at once if it was allowed before).
import { SETTINGS, saveSettings } from '../ui/settings';

export const TILT = {
  dead: 0.1, // radians (~6 degrees) of lean that do nothing
  max: 1.3, // the most the world counter-tilts (~75 degrees)
  gain: 1, // 1: the world stays level with the real horizon
};

type PermissionFn = () => Promise<'granted' | 'denied'>;
const requestFn = (): PermissionFn | undefined =>
  (globalThis as unknown as { DeviceOrientationEvent?: { requestPermission?: PermissionFn } }).DeviceOrientationEvent?.requestPermission;

// how far the screen is turned from the phone's natural upright, in radians, counterclockwise as the player sees it
export function screenTurn(): number {
  const w = globalThis as unknown as { orientation?: number; screen?: { orientation?: { angle?: number } } };
  const deg = typeof w.orientation === 'number' ? w.orientation : (w.screen?.orientation?.angle ?? 0);
  return (deg * Math.PI) / 180;
}

// the phone's lean from the picture's upright (radians, + when it leans clockwise), from beta and gamma in degrees
export function leanOf(beta: number, gamma: number, turn: number): number {
  const b = (beta * Math.PI) / 180;
  const g = (gamma * Math.PI) / 180;
  const gx = Math.sin(g) * Math.cos(b);
  const gy = -Math.sin(b);
  if (Math.hypot(gx, gy) < 0.25) return 0; // lying flat: no sense of up
  const a = Math.atan2(gx, -gy) + turn;
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// the camera's counter-roll for a lean: nothing inside the dead zone, then the lean past it, capped
export function counterRoll(lean: number): number {
  const past = Math.max(0, Math.abs(lean) - TILT.dead);
  return Math.sign(lean) * Math.min(TILT.max, past * TILT.gain);
}

export class Tilt {
  roll = 0; // radians the camera rolls, counterclockwise from behind it (the scene eases it on a spring)
  private listening = false;

  private readonly onOrient = (e: DeviceOrientationEvent): void => {
    if (e.beta === null || e.gamma === null) return;
    //the phone leaning clockwise turns the picture clockwise with it; rolling the camera clockwise too (negative)
    //turns the world back counterclockwise on screen, level with the real ground
    this.roll = -counterRoll(leanOf(e.beta, e.gamma, screenTurn()));
  };

  // start listening if the setting is on; on iPhone, the first tap asks for motion again
  start(): void {
    if (!SETTINGS.tilt) return;
    if (requestFn()) {
      const ask = () => void this.ask();
      window.addEventListener('pointerdown', ask, { once: true, capture: true });
    } else this.listen();
  }

  // the pause card's switch: from a tap, so iPhone can show its prompt
  async toggle(): Promise<boolean> {
    if (SETTINGS.tilt) {
      SETTINGS.tilt = false;
      this.stop();
    } else SETTINGS.tilt = await this.ask();
    saveSettings();
    return SETTINGS.tilt;
  }

  private async ask(): Promise<boolean> {
    const req = requestFn();
    if (req) {
      try {
        if ((await req()) !== 'granted') return false;
      } catch {
        return false;
      }
    }
    this.listen();
    return true;
  }

  private listen(): void {
    if (this.listening || typeof window === 'undefined') return;
    window.addEventListener('deviceorientation', this.onOrient);
    this.listening = true;
  }

  private stop(): void {
    window.removeEventListener('deviceorientation', this.onOrient);
    this.listening = false;
    this.roll = 0;
  }
}

export const tilt = new Tilt();
