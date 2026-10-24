// The leaderboards between runs: a SCORES button on the run-over screen opens today's daily board (on a daily run)
// or the top scores, with a tab for the deepest floor. A finished run posts itself once you've set a tag; the
// first time, the screen asks for one. Hidden entirely when there's no board to reach.
import { cleanTag, type BoardId, type Entry, type Row } from '../net/board-rules';
import { postScore, topRows } from '../net/leaderboard';
import { loadSave, writeSave } from '../run/save';

const TITLES: Record<BoardId, string> = { score: 'TOP SCORES', floor: 'DEEPEST RUNS', daily: "TODAY'S DAILY" };

export class BoardPanel {
  private pending: Entry | null = null; // the last run, waiting for a tag
  private board: BoardId = 'score';
  private day: string | undefined;
  private ranks: Partial<Record<BoardId, number | null>> = {};
  private online = false;

  constructor(
    private readonly el: HTMLElement, // the #scores overlay
    private readonly button: HTMLElement, // SCORES on the run-over screen
  ) {
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const t = e.target instanceof Element ? e.target : null;
      const tab = t?.closest<HTMLElement>('[data-board]');
      if (tab) this.open(tab.dataset.board as BoardId);
      else if (t?.closest('[data-post]')) void this.saveTag();
      else if (t?.closest('[data-close-scores]')) el.hidden = true;
    });
    el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    el.querySelector('input')!.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') void this.saveTag();
    });
    //is there a board at all? one quiet read decides whether the button shows
    void topRows('score').then((rows) => {
      this.online = rows !== null;
      this.button.hidden = !this.online;
    });
  }

  // a run just ended: post it if we have a tag, else keep it for when one is set
  async runEnded(entry: Omit<Entry, 'tag'>): Promise<void> {
    this.day = entry.day;
    this.board = entry.day ? 'daily' : 'score';
    this.ranks = {};
    this.button.textContent = 'SCORES';
    if (!this.online) return;
    const tag = loadSave().tag;
    if (!tag) {
      this.pending = { ...entry, tag: '' };
      return;
    }
    await this.post({ ...entry, tag });
  }

  private async post(entry: Entry): Promise<void> {
    this.pending = null;
    const ranks = await postScore(entry);
    if (!ranks) return;
    this.ranks = ranks;
    const r = ranks[entry.day ? 'daily' : 'score'];
    if (r) this.button.textContent = `SCORES · #${r}`;
  }

  async open(board: BoardId = this.board): Promise<void> {
    this.board = board;
    this.el.hidden = false;
    const tag = loadSave().tag;
    const tagRow = this.el.querySelector<HTMLElement>('.tagrow')!;
    tagRow.hidden = !!tag;
    this.el.querySelector('.tabs')!.innerHTML = (['score', 'floor', ...(this.day ? ['daily'] : [])] as BoardId[])
      .map((b) => `<button data-board="${b}" class="${b === board ? 'on' : ''}">${TITLES[b]}</button>`)
      .join('');
    const list = this.el.querySelector('ol')!;
    list.innerHTML = '<li class="none">loading…</li>';
    const rows = await topRows(board, board === 'daily' ? this.day : undefined);
    list.innerHTML = rows === null ? '<li class="none">The board is offline</li>' : rows.length ? rows.map((r) => this.row(r, tag)).join('') : '<li class="none">No scores yet. Be the first</li>';
    const mine = this.ranks[board];
    this.el.querySelector('.you')!.textContent = mine ? `Your last run: #${mine}` : mine === null ? 'Your last run missed the top 100' : '';
  }

  private row(r: Row, tag: string | undefined): string {
    return `<li class="${r.tag === tag ? 'me' : ''}"><b>${r.rank}</b><span class="tag">${r.tag}</span><span class="fl">F${r.floor}</span><span class="sc">${r.score.toLocaleString()}</span></li>`;
  }

  private async saveTag(): Promise<void> {
    const input = this.el.querySelector('input')!;
    const tag = cleanTag(input.value);
    if (!tag) {
      input.value = '';
      input.placeholder = '3 TO 10 LETTERS';
      return;
    }
    const save = loadSave();
    save.tag = tag;
    writeSave(save);
    input.blur();
    if (this.pending) await this.post({ ...this.pending, tag });
    await this.open(this.board);
  }
}
