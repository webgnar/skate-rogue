// The three missions and Skater Rank (src/run/missions.ts), on the pause card and the run summary: each mission's
// count as a bar, and a SKIP for a little Stoken. The rank's pips fill with the missions done towards the next.
import type { MissionsView } from '../run/missions';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

export function missionsHtml(v: MissionsView): string {
  const pips = Array.from({ length: 3 }, (_, i) => `<i${i < v.toNext ? ' class="on"' : ''}></i>`).join('');
  const rows = v.rows
    .map((r, i) => {
      const share = Math.round((100 * r.count) / r.goal);
      const n = r.goal >= 1000 ? `${Math.round(share)}%` : `${r.count}/${r.goal}`;
      return `<div class="mission"><span class="txt">${esc(r.text)}</span><span class="bar"><i style="width:${share}%"></i></span><span class="n">${n}</span><button data-skip="${i}"${v.bank < v.skip ? ' disabled' : ''}>SKIP ◆${v.skip}</button></div>`;
    })
    .join('');
  return `<div class="rank"><span class="tag">SKATER RANK</span><span class="num">${v.rank}</span><span class="pips">${pips}</span></div>${rows}`;
}

// draws into every .missions box, and hands a SKIP tap to the game (a tap there never reaches the one button)
export function bindMissions(boxes: HTMLElement[], skip: (i: number) => void): (v: MissionsView) => void {
  for (const box of boxes) {
    box.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const b = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('[data-skip]') : null;
      if (b && !b.disabled) skip(Number(b.dataset.skip));
    });
  }
  return (v) => {
    const html = missionsHtml(v);
    for (const box of boxes) box.innerHTML = html;
  };
}
