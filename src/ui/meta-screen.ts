// The unlock tree between runs: opened from the run-over screen. Tap a locked unlock to buy it with banked Stoken,
// tap an owned skater or deck to ride it. A change takes effect on the next run; a new skater needs the page
// reloaded (its model loads at start), so closing after a change reloads.
import { BRANCH_NAMES, buy, has, UNLOCKS, type Branch, type Unlock, type UnlockId } from '../run/meta';
import { loadSave, writeSave, type Save } from '../run/save';

const BRANCHES: Branch[] = ['skater', 'deck', 'library', 'spot'];

export class MetaScreen {
  private changed = false;

  constructor(
    private readonly el: HTMLElement,
    private readonly all: boolean, // ?unlockall: everything open, nothing spent
    private readonly onClose: (changed: boolean) => void,
  ) {
    //taps here never reach the one button, so nothing starts a run behind the screen
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const t = e.target instanceof Element ? e.target : null;
      const item = t?.closest<HTMLElement>('[data-unlock]');
      if (item) this.tap(item.dataset.unlock as UnlockId);
      else if (t?.closest('[data-close-meta]')) this.close();
    });
    el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  }

  open(): void {
    this.el.hidden = false;
    this.render(loadSave(), '');
  }

  private close(): void {
    this.el.hidden = true;
    this.onClose(this.changed);
    this.changed = false;
  }

  private owned(save: Save, id: UnlockId): boolean {
    return this.all || has(save.unlocked, id);
  }

  private tap(id: UnlockId): void {
    const save = loadSave();
    const u = UNLOCKS.find((x) => x.id === id)!;
    let note = '';
    if (!this.owned(save, id)) {
      const got = buy(save.unlocked, save.stoken, id);
      if (!got) return this.render(save, `Need ◆${u.cost - save.stoken} more Stoken`);
      Object.assign(save, got);
      note = `${u.name} unlocked`;
      this.changed = true;
    }
    //owned skaters and decks: ride it
    if (u.branch === 'skater' && save.skater !== id) {
      save.skater = id as Save['skater'];
      note ||= `Riding as ${u.name} next run`;
      this.changed = true;
    } else if (u.branch === 'deck' && save.deck !== id) {
      save.deck = id as Save['deck'];
      note ||= `${u.name} deck next run`;
      this.changed = true;
    }
    writeSave(save);
    this.render(save, note);
  }

  private render(save: Save, note: string): void {
    this.el.querySelector('.bank')!.textContent = this.all ? '◆ all unlocked (?unlockall)' : `◆ ${save.stoken} Stoken`;
    this.el.querySelector('.note')!.textContent = note || 'Tap to unlock with Stoken, or to ride an unlocked skater or deck';
    this.el.querySelector('.branches')!.innerHTML = BRANCHES.map(
      (b) => `<div class="branch"><h3>${BRANCH_NAMES[b]}</h3>${UNLOCKS.filter((u) => u.branch === b).map((u) => this.item(save, u)).join('')}</div>`,
    ).join('');
  }

  private item(save: Save, u: Unlock): string {
    const owned = this.owned(save, u.id);
    const on = (u.branch === 'skater' && save.skater === u.id) || (u.branch === 'deck' && save.deck === u.id);
    const cls = ['item', owned ? 'owned' : '', on ? 'on' : '', !owned && save.stoken < u.cost ? 'poor' : ''].filter(Boolean).join(' ');
    const tag = on ? 'RIDING' : owned ? (u.branch === 'skater' || u.branch === 'deck' ? 'RIDE' : 'OWNED') : `◆${u.cost}`;
    return `<button class="${cls}" data-unlock="${u.id}"><span class="name">${u.name}<span class="tag">${tag}</span></span><span class="line">${u.line}</span></button>`;
  }
}
