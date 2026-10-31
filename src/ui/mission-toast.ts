// The in-run mission popup (zack, 2026-10-31: missions should appear on screen when you do something for one).
// A small card above the gear wear, bottom right, away from the trick callouts at the top: the mission, a bar and
// "3/10" when it moves on; gold with MISSION COMPLETE! when it's done. One card at a time: a new tick for a mission
// just swaps the count in; a finished one holds its beat and anything after it waits in line.
import { countText, type MissionTick } from '../run/missions';

export const TOAST = {
  tickMs: 1700, // how long a tick holds
  doneMs: 2600, // how long a finished one holds
  outMs: 260, // slide away
  queue: 4, // finished ones waiting, at most
};

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

export function toastHtml(t: MissionTick, done: boolean): string {
  const share = Math.round((100 * Math.min(t.count, t.goal)) / t.goal);
  const tag = done ? 'MISSION COMPLETE!' : 'MISSION';
  return `<span class="tag">${tag}</span><span class="txt">${esc(t.text)}</span><span class="row"><span class="bar"><i style="width:${share}%"></i></span><span class="n">${done ? '✔' : countText(t.count, t.goal, t.unit)}</span></span>`;
}

export interface MissionToast {
  tick(t: MissionTick): void;
  done(t: MissionTick): void;
}

export function makeMissionToast(el: HTMLElement): MissionToast {
  let showing: { text: string; done: boolean } | null = null;
  let timer = 0;
  const waiting: MissionTick[] = [];
  const hide = () => {
    el.classList.remove('in');
    showing = null;
    timer = window.setTimeout(next, TOAST.outMs);
  };
  const next = () => {
    const d = waiting.shift();
    if (d) show(d, true);
    else el.hidden = true;
  };
  const show = (t: MissionTick, done: boolean) => {
    window.clearTimeout(timer);
    const same = showing && showing.text === t.text && !showing.done && !done;
    el.hidden = false;
    el.classList.toggle('done', done);
    if (same) {
      //the same mission again: the count moves, the bar slides, the number bumps
      el.querySelector<HTMLElement>('.bar i')!.style.width = `${Math.round((100 * Math.min(t.count, t.goal)) / t.goal)}%`;
      const n = el.querySelector<HTMLElement>('.n')!;
      n.textContent = countText(t.count, t.goal, t.unit);
      n.classList.remove('bump');
      void n.offsetWidth;
      n.classList.add('bump');
    } else if (done && showing && showing.text === t.text) {
      //the one on screen just finished: it turns gold and its bar fills from where it was
      el.querySelector<HTMLElement>('.tag')!.textContent = 'MISSION COMPLETE!';
      el.querySelector<HTMLElement>('.n')!.textContent = '✔';
      el.querySelector<HTMLElement>('.bar i')!.style.width = '100%';
    } else {
      //a finished one fills its bar up from empty
      el.innerHTML = toastHtml(done ? { ...t, count: 0 } : t, done);
      el.classList.remove('in');
      void el.offsetWidth;
      if (done) requestAnimationFrame(() => (el.querySelector<HTMLElement>('.bar i')!.style.width = '100%'));
    }
    el.classList.add('in');
    showing = { text: t.text, done };
    timer = window.setTimeout(hide, done ? TOAST.doneMs : TOAST.tickMs);
  };
  return {
    tick(t) {
      //a finished one on screen keeps its beat; a plain tick then isn't worth the wait
      if (showing?.done || waiting.length) return;
      show(t, false);
    },
    done(t) {
      if (showing?.done || waiting.length) {
        if (waiting.length < TOAST.queue) waiting.push(t);
        return;
      }
      show(t, true);
    },
  };
}
