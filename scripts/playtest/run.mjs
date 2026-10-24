// npm run playtest: the playtest bot end to end. The sim runs (whole runs, many seeds, every step checked), then
// the browser runs (the real game in headless Chromium), then the report at playtest-report/index.html.
//
//   npm run playtest                          everything (about 10 minutes)
//   npm run playtest -- --quick               fewer seeds and four short browser runs (about 3 minutes)
//   npm run playtest -- --sim-only            just the sim runs (under a minute)
//   npm run playtest -- --url http://localhost:5173/   use your running `npm run dev` instead of starting one
//   npm run playtest -- --strict              exit 1 if it found any bugs (for CI)
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const quick = has('--quick');
const run = (cmd, argv, env = {}) => spawnSync(cmd, argv, { stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' }).status ?? 1;

rmSync('playtest-report', { recursive: true, force: true });
mkdirSync('playtest-report', { recursive: true });

console.log('Playtest bot: sim runs');
if (run('npx', ['vitest', 'run', 'tests/playtest.test.ts'], { PLAYTEST: '1', PLAYTEST_SEEDS: quick ? '8' : '30' })) console.log('  (the sim smoke test failed: see above; the report still covers it)');

if (!has('--sim-only')) {
  console.log('Playtest bot: browser runs');
  const pass = args.filter((a) => a !== '--strict' && a !== '--sim-only');
  if (run('node', ['scripts/playtest/browser.mjs', ...pass])) console.log("  (the browser runs didn't finish: see above)");
}

process.exit(run('node', ['scripts/playtest/report.mjs', ...(has('--strict') ? ['--strict'] : [])]));
