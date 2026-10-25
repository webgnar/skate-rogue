# The playtest bot

A bot that plays Gnar Run and reports what breaks, so the bugs found by hand (falling through banks, feet sinking
into the deck, models that didn't load, floors nobody can clear) turn up before you play.

## Running it

```sh
npm run playtest            # everything, about 10 minutes on 4 cores
npm run playtest:quick      # fewer seeds, four short browser runs, about 3 minutes
npm run playtest:sim        # just the sim runs, a few minutes (one process per core)
npm run playtest -- --url http://localhost:5173/   # use your running `npm run dev` instead of starting one
```

Add `--video` to record each browser run at real speed to `playtest-report/videos` (mp4 when ffmpeg is installed,
`brew install ffmpeg` on a Mac; webm otherwise), for example `node scripts/playtest/browser.mjs --video --only escape-3`.

The first time on a Mac, get the browser with `npx playwright install chromium`.

When it's done, open **playtest-report/index.html**. Each finding has a link that opens that exact floor on your
Mac's dev server or on the live site, with the boons the bot held and `?bot` on so it replays itself. Take
`&bot` off the link to skate it yourself.

GitHub runs it too (`.github/workflows/playtest.yml`): a quick pass on every pull request, the full pass on every
merge to main, and on demand from the Actions tab. The findings are in the run's summary, and the whole report
(screenshots too) is the `playtest-report` artifact. It reports and never blocks a merge; `--strict` makes it
exit 1 on any bug.

## Watching it play

Add `?bot` to any URL and the autopilot skates, picks boons, leaves the shop and starts a new run after a bail:
`localhost:5173/?seed=5&floor=4&bot`. `?bot=mash` presses at random like a new player, and `&turbo=3` runs it three
times faster.

## What it does

**Sim runs** (`src/bot/run-sim.ts`, `tests/playtest.test.ts`): whole runs, floors 1 to 15 with all five escapes, on 20
seeds, each skated by the reference bot (the floor validator's line) and by a button-masher, and at Gnar 3 every
fifth seed. After each floor it picks a boon from the cards the game would offer and takes the road it skated to.
The game's own per-step rules run alongside (score, combo, the gnar state's speed boost), which the floor validator
leaves out. Every floor starts the way its test URL starts it, so a link replays it exactly.

On every step (`src/bot/checks.ts`) it checks for:

- falling through the top of a roof, ledge, bank, stairs, rail, parked car or moving car or drone
- dropping through the street
- rolling or grinding more than 2 px off the surface's line
- NaN, leaving the world, no progress for 4 seconds, a floor that takes over 2.5 minutes
- climbing 30 tiles over everything (Sky Line)

When the reference bot doesn't clear a floor, it takes things away to say why: the boons it held, the Gnar level's
rules, the game's gnar state (a validated floor the bot can't clear once it speeds up), or the floor itself.

`npm test` keeps a small version of this: two whole runs must come back clean.

**Browser runs** (`scripts/playtest/browser.mjs`): the real game in headless Chromium with `?bot`. A whole run, the
start of every act, every escape, a button-masher, a strong boon build, and each of the other skaters. Besides the
sim checks (which run inside the game too) it watches:

- Lou's feet on the deck while riding and grinding (`SkaterRig.footCheck`): sinking into it or off it
- leg bones stretching past their bind length
- models that didn't load and parts drawn with the code-built fallback
- files that 404, page errors, console errors
- the skater leaving the screen, and menus the bot can't get out of
- frame rate

It takes a screenshot of each new floor and of the first few of every finding.

## Where findings go

The report tags each kind of finding with the part of the game it belongs to: physics, gameplay, models or camera.
The playtest thread sends them on to the thread that owns that part.
