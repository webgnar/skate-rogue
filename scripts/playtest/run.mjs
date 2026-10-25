// npm run playtest: the playtest bot end to end. The sim runs (whole runs, many seeds, every step checked), then
// the browser runs (the real game in headless Chromium), then the report at playtest-report/index.html.
//
//   npm run playtest                          everything (about 10 minutes on 4 cores)
//   npm run playtest -- --quick               fewer seeds and four short browser runs (about 3 minutes)
//   npm run playtest -- --sim-only            just the sim runs (a few minutes)
//   npm run playtest -- --url http://localhost:5173/   use your running `npm run dev` instead of starting one
//   npm run playtest -- --strict              exit 1 if it found any bugs (for CI)
import { spawn, spawnSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { mkdirSync, rmSync } from 'node:fs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const quick = has('--quick');
const run = (cmd, argv, env = {}) => spawnSync(cmd, argv, { stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' }).status ?? 1;

rmSync('playtest-report', { recursive: true, force: true });
mkdirSync('playtest-report', { recursive: true });

//the sim sweep, split across the cores: each process skates every Nth seed
const shards = Math.max(1, Math.min(8, availableParallelism()));
console.log(`Playtest bot: sim runs (${shards} at a time)`);
const sweep = (k) =>
  new Promise((done) => {
    const env = { ...process.env, PLAYTEST: '1', PLAYTEST_SEEDS: quick ? '6' : '20', PLAYTEST_SHARD: `${k}/${shards}` };
    const p = spawn('npx', ['vitest', 'run', 'tests/playtest.test.ts', '-t', 'sweep'], { stdio: k ? 'ignore' : 'inherit', env, shell: process.platform === 'win32' });
    p.on('exit', (code) => done(code ?? 1));
  });
const codes = await Promise.all(Array.from({ length: shards }, (_, k) => sweep(k)));
if (codes.some((c) => c)) console.log("  (a sim shard didn't finish: see above; the report covers the rest)");

if (!has('--sim-only')) {
  console.log('Playtest bot: browser runs');
  const pass = args.filter((a) => a !== '--strict' && a !== '--sim-only');
  if (run('node', ['scripts/playtest/browser.mjs', ...pass])) console.log("  (the browser runs didn't finish: see above)");
}

process.exit(run('node', ['scripts/playtest/report.mjs', ...(has('--strict') ? ['--strict'] : [])]));
