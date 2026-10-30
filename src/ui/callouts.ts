// The callouts at the top of the screen (trick names, banked points, floor news). Each one pops in, holds a beat
// so it reads, then floats slowly up off the top of the screen, shrinking as it goes (zack, 2026-10-30: the player
// can still read it on the way out). A new one pushes the ones still near the start up a line so they never stack
// on top of each other. Reduce motion: no float, it holds and fades where it is.

export const CALLOUT = {
  popMs: 140, // pop in, overshoot and settle
  holdMs: 650, // full size and still, the read
  floatMs: 2200, // the drift up and off the top
  endScale: 0.45, // the size it leaves the screen at
  max: 6, // more than this on screen and the oldest goes
  calmMs: 1100, // reduce motion: how long it holds before fading
};

export interface Callouts {
  show(text: string, kind: string): void;
  pause(on: boolean): void;
}

export function makeCallouts(box: HTMLElement, calm: () => boolean): Callouts {
  const live: { el: HTMLElement; lift: number; anim: Animation }[] = [];
  let paused = false;
  const drop = (el: HTMLElement) => {
    const i = live.findIndex((c) => c.el === el);
    if (i >= 0) live.splice(i, 1);
    el.remove();
  };
  return {
    show(text, kind) {
      const el = document.createElement('div');
      el.className = `pop ${kind}`;
      el.textContent = text;
      box.append(el);
      const h = el.offsetHeight;
      //push the ones still on screen up a line (the push slides; the float runs on top of it)
      for (const c of live) {
        c.lift += h * 0.9;
        c.el.style.translate = `0 ${-c.lift}px`;
      }
      while (live.length >= CALLOUT.max) {
        live[0].anim.cancel();
        drop(live[0].el);
      }
      const total = CALLOUT.popMs + CALLOUT.holdMs + CALLOUT.floatMs;
      const settled = CALLOUT.popMs / total;
      const still = (CALLOUT.popMs + CALLOUT.holdMs) / total;
      //far enough that the top of the screen is behind it, whatever pushes it gets on the way
      const rise = box.getBoundingClientRect().top + h * 2;
      const anim = calm()
        ? el.animate(
            [
              { opacity: 1 },
              { opacity: 1, offset: CALLOUT.calmMs / (CALLOUT.calmMs + 300) },
              { opacity: 0 },
            ],
            { duration: CALLOUT.calmMs + 300, fill: 'forwards' },
          )
        : el.animate(
            [
              { transform: 'translateY(0) scale(0.6)', opacity: 0 },
              { transform: 'translateY(0) scale(1.12)', opacity: 1, offset: settled * 0.6 },
              { transform: 'translateY(0) scale(1)', opacity: 1, offset: settled },
              { transform: 'translateY(0) scale(1)', opacity: 1, offset: still, easing: 'cubic-bezier(0.45, 0, 0.8, 0.6)' },
              { transform: `translateY(${-rise}px) scale(${CALLOUT.endScale})`, opacity: 0.85 },
            ],
            { duration: total, fill: 'forwards' },
          );
      if (paused) anim.pause();
      anim.onfinish = () => drop(el);
      live.push({ el, lift: 0, anim });
    },
    //the pause card stops them where they are
    pause(on) {
      paused = on;
      for (const c of live) {
        if (on) c.anim.pause();
        else c.anim.play();
      }
    },
  };
}
