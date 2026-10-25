// Turns the playtest bot's runs (playtest-report/sim-N.json and browser.json) into playtest-report/index.html: what
// it found, grouped by kind, each with its test URL (on your Mac's dev server and on the live site) and a screenshot.
// Also writes summary.md (the CI job summary) and prints the short version.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'playtest-report';
const LOCAL = 'http://localhost:5173/';
const LIVE = 'https://skate-rogue.vercel.app/';

// what each kind of finding means, how bad it is, and which part of the game it belongs to
export const KINDS = {
  'fell-through': ['bug', 'physics', 'Fell through something solid', 'A step started on or above a roof, ledge, bank, rail or car top and ended under it.'],
  'through-street': ['bug', 'physics', 'Dropped through the street', 'Went below the street with street under the skater.'],
  'off-surface': ['bug', 'physics', 'Rolled off the line of a surface', "Rolling or grinding with the feet more than 2 px off the surface's line."],
  nan: ['bug', 'physics', 'Position went NaN', ''],
  'out-of-world': ['bug', 'physics', 'Left the world', 'Past either end of the floor.'],
  stuck: ['bug', 'physics', 'Stuck', 'No progress for 4 seconds while skating.'],
  'game-coupling': ['bug', 'gameplay', "A validated floor the bot can't clear in the real game", "The floor validator's bot clears it, but the same bot bails once the game's gnar state speeds it up (the validator leaves that out)."],
  unclearable: ['bug', 'gameplay', 'A floor nobody can clear', "Even the validator's own bot fails it."],
  'stuck-menu': ['bug', 'gameplay', 'Stuck on a menu', ''],
  'feet-in-deck': ['bug', 'models', 'Feet sinking into the deck', 'A foot below the deck top while riding or grinding.'],
  'feet-off-board': ['bug', 'models', 'Feet off the board', 'A foot off the deck while riding or grinding.'],
  'leg-stretch': ['bug', 'models', 'Leg bones stretching', 'A leg bone longer than its bind length.'],
  'model-fallback': ['bug', 'models', 'Missing or fallback models', "A Blender model didn't load, or a part was drawn with the code-built stand-in."],
  'asset-missing': ['bug', 'models', 'Files that 404', ''],
  'skater-offscreen': ['bug', 'camera', 'Skater off the screen', ''],
  'page-error': ['bug', 'game', 'Page errors', 'Uncaught exceptions in the game.'],
  'console-error': ['bug', 'game', 'Console errors', ''],
  'no-start': ['bug', 'game', "The game didn't start", ''],
  timeout: ['warn', 'gameplay', 'Floor took over 2.5 minutes', ''],
  'sky-high': ['warn', 'gameplay', 'Climbed far above the level', "30+ tiles over the highest thing on the floor (Sky Line's ghost rails stair-step you up)."],
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const read = (f) => (existsSync(`${OUT}/${f}`) ? JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')) : null);

export function collect() {
  //the sim's shards (sim-0.json, sim-1.json...), one per core, as one
  const parts = existsSync(OUT) ? readdirSync(OUT).filter((f) => /^sim(-\d+)?\.json$/.test(f)).map(read) : [];
  const sim = parts.length ? { at: parts[0].at, seconds: Math.max(...parts.map((p) => p.seconds)), runs: parts.flatMap((p) => p.runs).sort((a, b) => a.seed - b.seed) } : null;
  const browser = read('browser.json');
  const items = []; // { kind, where, message, url, shot, from }
  if (sim) {
    for (const run of sim.runs) {
      for (const f of run.floors) {
        for (const x of f.findings) items.push({ kind: x.kind, where: `${f.label}${f.twist ? ` · ${f.twist}` : ''}`, message: `${x.message} at column ${x.col}`, url: f.url, from: `sim, ${run.pilot} bot` });
        if (f.cause === 'game-coupling' || f.cause === 'unclearable') items.push({ kind: f.cause, where: `${f.label}${f.twist ? ` · ${f.twist}` : ''}`, message: f.result, url: f.url, from: 'sim, ref bot' });
      }
    }
  }
  if (browser) {
    for (const s of browser.scenarios) {
      for (const f of s.findings) {
        const url = f.url ? (f.url.startsWith('http') ? '?' + f.url.split('?')[1] : f.url) : '?' + s.url.split('?')[1];
        items.push({ kind: f.kind, where: f.label ? `${f.label} (${s.id})` : s.id, message: f.message, url, shot: f.shot, from: 'browser' });
      }
    }
  }
  return { sim, browser, items };
}

function simStats(sim) {
  const floors = sim.runs.flatMap((r) => r.floors.map((f) => ({ ...f, pilot: r.pilot })));
  const by = (p) => floors.filter((f) => f.pilot === p);
  const rate = (fs) => (fs.length ? Math.round((100 * fs.filter((f) => f.result === 'exit').length) / fs.length) : 0);
  const causes = {};
  for (const f of floors) if (f.cause) causes[f.cause] = (causes[f.cause] ?? 0) + 1;
  return { runs: sim.runs.length, floors: floors.length, ref: rate(by('ref')), mash: rate(by('mash')), causes, seconds: Math.round(sim.seconds) };
}

function links(url) {
  if (!url) return '';
  return `<a href="${esc(LOCAL + url)}">your Mac</a> · <a href="${esc(LIVE + url)}">live</a> · <code>${esc(url)}</code>`;
}

function html({ sim, browser, items }) {
  const groups = {};
  for (const it of items) (groups[it.kind] ??= []).push(it);
  const order = Object.keys(groups).sort((a, b) => (KINDS[a]?.[0] === 'bug' ? 0 : 1) - (KINDS[b]?.[0] === 'bug' ? 0 : 1) || groups[b].length - groups[a].length);
  const bugs = order.filter((k) => KINDS[k]?.[0] !== 'warn').reduce((n, k) => n + groups[k].length, 0);
  const section = (k) => {
    const [sev, owner, title, about] = KINDS[k] ?? ['bug', 'game', k, ''];
    const rows = groups[k].slice(0, 12).map((it) => `<li><b>${esc(it.where)}</b>: ${esc(it.message)} <span class="from">${esc(it.from)}</span><br>${links(it.url)}${it.shot ? `<br><a href="${esc(it.shot)}"><img src="${esc(it.shot)}" loading="lazy"></a>` : ''}</li>`);
    const more = groups[k].length > 12 ? `<li class="from">…and ${groups[k].length - 12} more in the JSON</li>` : '';
    return `<section class="${sev}"><h2>${esc(title)} <span class="n">${groups[k].length}</span> <span class="tag">${sev} · ${owner}</span></h2>${about ? `<p class="about">${esc(about)}</p>` : ''}<ul>${rows.join('')}${more}</ul></section>`;
  };
  const st = sim ? simStats(sim) : null;
  const simBlock = st
    ? `<p>${st.runs} runs, ${st.floors} floors in ${st.seconds} s. The reference bot cleared ${st.ref}% of floors with the boons it picked, the button-masher ${st.mash}%.
       Where the reference bot didn't get through: ${Object.entries(st.causes).map(([c, n]) => `${n} ${c === 'boons' ? 'because of its boon build' : c}`).join(', ') || 'nowhere'}.</p>`
    : '<p>No sim runs in this report.</p>';
  const scen = browser
    ? `<table><tr><th>scenario</th><th>what</th><th>floors</th><th>fps</th><th>findings</th></tr>${browser.scenarios
        .map((s) => `<tr><td><a href="${esc(LOCAL + '?' + s.url.split('?')[1])}">${esc(s.id)}</a></td><td>${esc(s.what)}</td><td>${s.floors.map((f) => `${esc(f.label)}: ${esc(f.result)}`).join('<br>')}</td><td>${s.fps ? `${s.fps.avg} (min ${s.fps.min})` : ''}</td><td>${s.findings.length}</td></tr>`)
        .join('')}</table>`
    : '<p>No browser runs in this report.</p>';
  const gallery = browser ? browser.scenarios.flatMap((s) => s.shots.map((g) => `<figure><a href="${esc(g.file)}"><img src="${esc(g.file)}" loading="lazy"></a><figcaption>${esc(s.id)}: ${esc(g.label)}</figcaption></figure>`)).join('') : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gnar Run playtest</title>
<style>
:root{--bg:#14121c;--fg:#eee;--dim:#9a96a8;--bug:#ff5a6a;--warn:#ffc34a;--card:#1f1c2b}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif;max-width:1100px}
h1{margin:0 0 4px}h2{font-size:17px;margin:0 0 6px}.n{color:var(--dim)}.tag{font-size:12px;color:var(--dim);font-weight:400}
section{background:var(--card);border-left:4px solid var(--bug);padding:12px 14px;margin:12px 0;border-radius:6px}section.warn{border-color:var(--warn)}
ul{padding-left:18px;margin:0}li{margin:6px 0}a{color:#7cc8ff}code{font-size:12px;color:var(--dim);word-break:break-all}
.from,.about{color:var(--dim);font-size:13px}img{max-width:320px;border-radius:4px;margin-top:4px}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #333;padding:4px 6px;text-align:left;vertical-align:top}
.gallery{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0;width:240px}figure img{max-width:240px}figcaption{font-size:12px;color:var(--dim)}
</style></head><body>
<h1>Gnar Run playtest</h1>
<p class="from">${esc(sim?.at ?? browser?.at ?? '')} · ${bugs} bug findings, ${items.length - bugs} warnings. Links open the floor with <code>?bot</code> so the bot replays it; take <code>&amp;bot</code> off to skate it yourself.</p>
${order.map(section).join('') || '<section class="warn"><h2>Nothing found</h2></section>'}
<h2>Sim runs</h2>${simBlock}
<h2>Browser runs</h2>${scen}
<h2>Floors the browser bot saw</h2><div class="gallery">${gallery}</div>
</body></html>`;
}

function summary({ sim, items }) {
  const groups = {};
  for (const it of items) (groups[it.kind] ??= []).push(it);
  const lines = ['## Gnar Run playtest', ''];
  if (!items.length) lines.push('Nothing found.');
  for (const [k, list] of Object.entries(groups)) {
    const [sev, owner, title] = KINDS[k] ?? ['bug', 'game', k];
    lines.push(`- **${title}** (${sev}, ${owner}): ${list.length}. First: ${list[0].where}, ${list[0].message} \`${list[0].url ?? ''}\``);
  }
  if (sim) {
    const st = simStats(sim);
    lines.push('', `Sim: ${st.floors} floors, reference bot cleared ${st.ref}%, masher ${st.mash}%.`);
  }
  return lines.join('\n') + '\n';
}

const data = collect();
writeFileSync(`${OUT}/index.html`, html(data));
const md = summary(data);
writeFileSync(`${OUT}/summary.md`, md);
process.stdout.write('\n' + md + `\nReport: ${OUT}/index.html\n`);
const bugs = data.items.filter((it) => (KINDS[it.kind]?.[0] ?? 'bug') === 'bug').length;
if (process.argv.includes('--strict') && bugs) process.exit(1);
