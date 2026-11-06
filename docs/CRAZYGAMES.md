# CrazyGames build

zack picked CrazyGames as the first web portal (2026-11-04, thread "Plan grind-or-pay monetization"). This is the
build that goes on it. The game is the same; only the build flag differs.

## Making the zip

```
npm run build:crazygames
```

It typechecks, builds with `--mode crazygames` (`.env.crazygames` sets `VITE_PORTAL=crazygames`) into
`dist-crazygames/`, then `scripts/crazygames/pack.mjs` drops what the portal never loads (the Meshy test skaters,
the home screen icons and manifest), checks the folder against CrazyGames' limits and writes
`dist-crazygames.zip` with `index.html` at its root. It fails if the build is over a limit or the page has an
absolute path.

The Vercel build (`npm run build`) is untouched: there every portal call is a no-op.

## What the portal build does differently

All of it is in `src/net/portal.ts`, read through `ON_CRAZYGAMES`.

| What | How |
| --- | --- |
| SDK | `https://sdk.crazygames.com/crazygames-sdk-v3.js`, loaded and `init()`ed at the top of `start()` in `src/main.ts`, before anything reads the save. If it can't load, or reports `disabled`, the game plays without it. |
| Loading | `loadingStart` right after init, `loadingStop` when the loading screen goes. |
| Gameplay | `gameplayStart` / `gameplayStop` on each change of "skating": no title screen, not paused, and no card up (pick, spot, shop, continue, dice, game over, unlocks). Checked every frame, reported only on a change. |
| Happy time | An escape (a win), or a new best score past act 1. Not on every floor or pickup. |
| Mute | The site's `muteAudio` zeroes the sound and music gains (`Sound.applyVolumes`), whatever the game's own sliders say. |
| Saves | `store` (save, settings, effect settings, `?reset`) writes the SDK's Data module and localStorage both, and reads the Data module first. The Data module only works with **Progress Save** ticked at submission. |
| Full screen | The pause card's FULL SCREEN switch, the auto full screen on phones and the Add to Home Screen tip are off (CrazyGames forbids a game's own full screen button). The page loses its home screen app tags. |
| Leaderboard | Off: no SCORES button, no posting. It lives on our Vercel server (`/api/leaderboard`), which the portal doesn't serve, and free-typed player tags would need moderation on a 13+ site. |
| Dev tools | The pause card's DEV TOOLS button is hidden. |
| Ads | **Paused (zack, 2026-10-31).** `breakAd` (called on the game over card) and `rewardAd` exist, but `ADS_ENABLED` is `false`, so both resolve at once and never ask the SDK. Basic Launch forbids ads anyway. Turning them on is zack's call. |

## Limits (checked 2026-11-06, docs.crazygames.com/requirements/technical)

- 1,500 files, 250 MB in all, 50 MB initial download (20 MB for the mobile homepage). Measured with the SDK, the
  initial download runs until the first `gameplayStart`.
- The build is 136 files, 22.0 MB (12.6 MB zipped). The run's music (3.8 MB) loads during play, so the download
  before the first `gameplayStart` is a little under 20 MB.
- Relative paths only (`base: './'` in `vite.config.ts`; `pack.mjs` checks the page).
- 20 seconds or less to gameplay. It loads in about 4 to 7 s in a cloud browser.
- Touch, mouse and keyboard all work (tap / click / Space). `user-select: none` and safe area padding are already in
  `src/style.css`.

## Still open

- Music rights: every track in the build has to be cleared before the game earns money (flagged 2026-11-04).
- The leaderboard on the portal: CrazyGames has its own account and (invite-only) leaderboard features; ours stays
  off there until we decide.
- Ads at Full Launch, and in-game purchases (Xsolla, invite only).
