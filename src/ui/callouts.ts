// The callouts at the top of the screen (trick names, banked points, floor news). Each one pops in, holds a beat
// so it reads, then floats slowly up off the top of the screen, shrinking as it goes (zack, 2026-10-30: the player
// can still read it on the way out). A new one pushes the ones still near the start up a line so they never stack
// on top of each other. Reduce motion: no float, it holds and fades where it is.
// Points (a banked combo's "+125", FLOOR CLEAR +N) don't float off: after the hold they fly up into the SCORE box,
// passing behind it, and the score counts them in as each one lands (zack, 2026-11-08). They're drawn in their own
// layer under the top bar (#pointfly) so the box covers them on the way in.

export const CALLOUT = {
  popMs: 140, // pop in, overshoot and settle
  holdMs: 650, // full size and still, the read
  floatMs: 2200, // the drift up and off the top
  endScale: 0.45, // the size it leaves the screen at
  max: 6, // more than this on screen and the oldest goes
  calmMs: 1100, // reduce motion: how long it holds before fading
  flyHoldMs: 420, // points: full size and still before they fly (a shorter read than a trick name)
  flyMs: 380, // points: the flight up into the score box
  flyScale: 0.35, // the size points reach the score box at
};

// where points fly to, and what happens when they get there
export interface Fly {
  to: HTMLElement;
  land: () => void;
}

export interface Callouts {
  show(text: string, kind: string, fly?: Fly): void;
  pause(on: boolean): void;
}

export function makeCallouts(box: HTMLElement, calm: () => boolean, flyBox: HTMLElement = box): Callouts {
  const live: { el: HTMLElement; lift: number; anim: Animation; flying: boolean; land?: () => void }[] = [];
  let paused = false;
  const drop = (el: HTMLElement) => {
    const i = live.findIndex((c) => c.el === el);
    if (i >= 0) {
      //points that never got there still count
      live[i].land?.();
      live.splice(i, 1);
    }
    el.remove();
  };
  //points: from wherever the pop sits now (pushes and all) straight up into the middle of the score box
  const flyIn = (c: (typeof live)[number], to: HTMLElement) => {
    const from = (c.el.firstElementChild ?? c.el).getBoundingClientRect();
    const at = to.getBoundingClientRect();
    //the text's own width, not the full-width row it sits in
    const dx = at.left + at.width / 2 - (from.left + from.width / 2);
    const dy = at.top + at.height / 2 - (from.top + from.height / 2);
    c.flying = true;
    c.anim = c.el.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${CALLOUT.flyScale})`, opacity: 1 },
      ],
      { duration: CALLOUT.flyMs, easing: 'cubic-bezier(0.55, 0, 0.75, 0.4)', fill: 'forwards' },
    );
    if (paused) c.anim.pause();
    c.anim.onfinish = () => drop(c.el);
  };
  return {
    show(text, kind, fly) {
      const el = document.createElement('div');
      el.className = `pop ${kind}`;
      //points shrink to the text so the flight aims from the text's middle
      if (fly && !calm()) el.innerHTML = '<span></span>';
      (el.firstElementChild ?? el).textContent = text;
      (fly && !calm() ? flyBox : box).append(el);
      const h = el.offsetHeight;
      //push the ones still on screen up a line (the push slides; the float runs on top of it). Points already in
      //flight are on their way out and keep their line.
      for (const c of live) {
        if (c.flying) continue;
        c.lift += h * 0.9;
        c.el.style.translate = `0 ${-c.lift}px`;
      }
      while (live.length >= CALLOUT.max) {
        live[0].anim.cancel();
        drop(live[0].el);
      }
      if (fly && !calm()) {
        const total = CALLOUT.popMs + CALLOUT.flyHoldMs;
        const settled = CALLOUT.popMs / total;
        const anim = el.animate(
          [
            { transform: 'scale(0.6)', opacity: 0 },
            { transform: 'scale(1.12)', opacity: 1, offset: settled * 0.6 },
            { transform: 'scale(1)', opacity: 1, offset: settled },
            { transform: 'scale(1)', opacity: 1 },
          ],
          { duration: total, fill: 'forwards' },
        );
        if (paused) anim.pause();
        const c = { el, lift: 0, anim, flying: false, land: fly.land };
        anim.onfinish = () => flyIn(c, fly.to);
        live.push(c);
        return;
      }
      //reduce motion: points count in at once, no flight
      fly?.land();
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
      live.push({ el, lift: 0, anim, flying: false });
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
