// The skate shop as a card game (openspec/changes/ui2-card-shop): drag a card from the hand onto your board or gear
// to buy it, or a board slot onto another to swap them. A press that doesn't move is a tap, so tap then tap still
// works. Shop presses stop here and never reach the one button.
//
// While dragging, a copy of the card (the ghost) follows the thumb with a transform; the shop gets data-drag set to
// what's being dragged so the CSS can light the places it can go.

export interface ShopActions {
  tap(el: HTMLElement): void;
  drop(card: HTMLElement, target: HTMLElement): void;
  // the card is held over a slot (or, with null, over nothing): show what it would fire there
  preview?(card: HTMLElement, target: HTMLElement | null): void;
}

const DRAG_FROM = 8; // px of movement before a press becomes a drag
const CARD = '[data-stock],[data-gear],[data-grip],[data-buyslot],[data-slot]';

// what a card is, for the CSS and for where it may land
export function dragKind(el: HTMLElement): 'mod' | 'slot' | 'buyslot' | 'gear' | 'grip' {
  if (el.dataset.stock !== undefined) return 'mod';
  if (el.dataset.grip !== undefined) return 'grip';
  if (el.dataset.gear !== undefined) return 'gear';
  if (el.dataset.buyslot !== undefined) return 'buyslot';
  return 'slot';
}

// the drop zone under a point for a kind of card, or null
export function dropTarget(kind: ReturnType<typeof dragKind>, under: Element | null): HTMLElement | null {
  if (!under) return null;
  if (kind === 'mod' || kind === 'slot') return under.closest<HTMLElement>('[data-slot]');
  if (kind === 'buyslot' || kind === 'grip') return under.closest<HTMLElement>('[data-drop="board"]');
  return under.closest<HTMLElement>('[data-drop="gear"]');
}

export function bindShopDrag(shop: HTMLElement, actions: ShopActions, calm: () => boolean): void {
  let press: { el: HTMLElement; id: number; x: number; y: number } | null = null;
  let ghost: HTMLElement | null = null;
  let over: HTMLElement | null = null;
  let dx = 0;
  let dy = 0;

  const setOver = (t: HTMLElement | null) => {
    if (t === over) return;
    over?.classList.remove('over');
    over = t;
    over?.classList.add('over');
    shop.toggleAttribute('data-over', !!over); // the ghost fades so the wires under it show
    if (press && (t === null || t.dataset.slot !== undefined)) actions.preview?.(press.el, t);
  };

  const end = () => {
    setOver(null);
    delete shop.dataset.drag;
    press?.el.classList.remove('lifted');
    press = null;
  };

  shop.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); // not an ollie
    e.preventDefault();
    if (press || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>(`${CARD},[data-restock],[data-done]`);
    if (!el || (el as HTMLButtonElement).disabled) return;
    press = { el, id: e.pointerId, x: e.clientX, y: e.clientY };
  });

  window.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    if (!ghost) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_FROM || !press.el.matches(CARD)) return;
      if (press.el.classList.contains('poor') || press.el.classList.contains('sold')) {
        press.el.classList.remove('shake');
        void press.el.offsetWidth;
        press.el.classList.add('shake');
        press = null;
        return;
      }
      //lift: a copy of the card follows the thumb, the card itself dims in the hand
      const r = press.el.getBoundingClientRect();
      ghost = press.el.cloneNode(true) as HTMLElement;
      ghost.classList.add('ghost');
      ghost.classList.remove('pop', 'shake');
      Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, transformOrigin: `${press.x - r.left}px ${press.y - r.top}px` });
      shop.appendChild(ghost);
      press.el.classList.add('lifted');
      shop.dataset.drag = dragKind(press.el);
    }
    dx = e.clientX - press.x;
    dy = e.clientY - press.y;
    ghost.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${Math.max(-8, Math.min(8, dx / 30))}deg) scale(0.72)`; // small, so the slot under it shows
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const t = dropTarget(dragKind(press.el), under);
    setOver(t && t !== press.el ? t : null);
  });

  const release = (e: PointerEvent, cancelled: boolean) => {
    if (!press || e.pointerId !== press.id) return;
    const { el } = press;
    if (!ghost) {
      //a press that didn't move: a tap
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      end();
      if (!cancelled && hit && el.contains(hit)) actions.tap(el);
      return;
    }
    const target = cancelled ? null : over;
    const g = ghost;
    ghost = null;
    end();
    if (target) {
      g.remove();
      actions.drop(el, target);
      return;
    }
    //a miss: the card flies back to the hand
    if (calm()) {
      g.remove();
      return;
    }
    g.style.transition = 'transform 0.18s ease-in';
    g.style.transform = 'translate3d(0, 0, 0)';
    window.setTimeout(() => g.remove(), 190);
  };
  window.addEventListener('pointerup', (e) => release(e, false));
  window.addEventListener('pointercancel', (e) => release(e, true));
}
