// The board's wiring, drawn under its slots (openspec ui7-board-wires; zack: "we need visualization for this in
// desktop AND mobile"): a wire in the trigger's colour from each trigger along to the last effect it fires, with a
// drop to every slot it feeds; a slot nothing fires is dimmed and crossed. Used by the shop and the in-run HUD.
import { chain, type Slots } from '../board/mods';

const drawn = new Map<HTMLElement, Slots>();
const redraw = () => drawn.forEach((slots, box) => draw(box, slots));
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => requestAnimationFrame(redraw));
  void document.fonts?.ready.then(redraw); // the slots' widths change when Bangers arrives
}

// draw now and again after layout settles (and on every resize): the wires are measured off the slots
export function drawWires(box: HTMLElement, slots: Slots): void {
  drawn.set(box, slots);
  draw(box, slots);
  requestAnimationFrame(() => drawn.get(box) === slots && draw(box, slots));
}

// `box` holds the slots (each with data-slot or in order) and gets the wires as absolutely placed children
function draw(box: HTMLElement, slots: Slots): void {
  box.querySelectorAll(':scope > .wire').forEach((w) => w.remove());
  const els = [...box.querySelectorAll<HTMLElement>(':scope > .slot')];
  const links = chain(slots);
  els.forEach((el, i) => {
    const l = links[i];
    el.classList.toggle('dead', !!slots[i] && !l?.live);
    el.classList.toggle('wired', !!l?.wire);
  });
  if (!box.offsetParent) return; // hidden: drawn on the next update
  const at = (el: HTMLElement) => ({ x: el.offsetLeft + el.offsetWidth / 2, bottom: el.offsetTop + el.offsetHeight });
  links.forEach((l, t) => {
    if (l.wire !== 'start') return;
    let end = t;
    while (end + 1 < links.length && links[end + 1].wire && links[end + 1].wire !== 'start') end++;
    const a = at(els[t]);
    const b = at(els[end]);
    const wire = document.createElement('i');
    wire.className = 'wire';
    wire.style.left = `${a.x}px`;
    wire.style.width = `${b.x - a.x}px`;
    wire.style.top = `${Math.max(a.bottom, b.bottom)}px`;
    //a drop up into each slot the trigger feeds
    wire.innerHTML = links
      .slice(t + 1, end + 1)
      .map((x, k) => (x.live ? `<b style="left:${at(els[t + 1 + k]).x - a.x}px"></b>` : ''))
      .join('');
    box.appendChild(wire);
  });
}
