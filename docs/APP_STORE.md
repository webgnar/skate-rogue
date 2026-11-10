# The iPhone app (App Store)

zack (2026-11-10): "i feel like i should throw it up there for free". This is the build that goes on the App Store: the
same game in a Capacitor shell. Free, no in-app purchases, no ads. The paid chapters and Stoken bundles (GDD,
Monetization) come later as an update, with StoreKit.

## Building it

```
npm run build:ios
```

It typechecks, builds with `--mode ios` (`.env.ios` sets `VITE_PORTAL=ios`) into `dist-ios/`, then
`scripts/ios/pack.mjs` drops what the app never loads (the Meshy test skaters, the home screen icons and manifest,
the web site's privacy and support pages, the old worlds' backdrops) and `cap sync ios` copies the rest into the Xcode
project at `ios/App/App/public` (not in git; every build makes it fresh). About 23 MB of game.

The Vercel build (`npm run build`) and the CrazyGames build are untouched.

On zack's Mac, after `git pull` and `npm ci`:

```
npm run build:ios
npx cap open ios        # opens ios/App/App.xcodeproj in Xcode
```

Xcode fetches Capacitor itself (Swift Package Manager; no CocoaPods). In Xcode: the App target, Signing & Capabilities,
pick the team; then Product > Archive, and Distribute App > App Store Connect > Upload. The full list, with the store
listing, is in the project files (`app-store/checklist.md`).

## What the app build does differently

| What | How |
| --- | --- |
| Flag | `ON_IOS_APP` in `src/net/portal.ts`. `STORE_BUILD` (the portal or the app) is what the shared rules read. |
| Dev tools | The pause card's DEV TOOLS button is hidden, the five taps on PAUSED do nothing, and the dev keys are off. The `?` test links still work, but an app has no address bar to type them in. |
| Full screen | The app is full screen already: no FULL SCREEN switch, no Add to Home Screen tip, no home screen tags in the page. |
| Leaderboard | Off: it is our Vercel server's (`/api/leaderboard`), which the app doesn't serve, and free-typed player tags would need a report and block flow under the App Store's rules for user content. So the app sends nothing anywhere. |
| Safe areas | `viewport-fit=cover` and the `env(safe-area-inset-*)` padding already in `src/style.css`; `capacitor.config.ts` sets `contentInset: 'never'` so the web view runs under the notch and home bar and the page does the padding. |
| Orientation | Portrait and both landscapes (`Info.plist`), as on the web. |
| System chrome | The status bar is hidden (`Info.plist`), the home bar fades and an edge swipe needs a second swipe (`GameViewController` in `ios/App/App/SceneDelegate.swift`), so a tap at the bottom of the screen never leaves the game. |
| Audio | Unlocked on the first tap, as on the web (`Sound.unlock`). After a phone call, an alarm or Siri iOS leaves the audio "interrupted"; the game wakes it like a suspended one. The silent switch mutes the game (iOS does that to web audio by default). |
| Icon and launch screen | `node scripts/make-icons.mjs` renders the 1024 px icon (no alpha, as App Store Connect wants) and the launch screen, drawn like the loading screen so the hand-off doesn't jump. |
| Devices | iPhone only (`TARGETED_DEVICE_FAMILY = 1`), iOS 15 and up. iPads can still run it as an iPhone app. Turning on iPad needs iPad screenshots too. |
| Export rules | `ITSAppUsesNonExemptEncryption` is false (no encryption beyond the system's), so no export questions at upload. |
| Privacy | `ios/App/App/PrivacyInfo.xcprivacy`: no tracking, no data collected. The policy is `public/privacy.html`, at https://skate-rogue.vercel.app/privacy.html, and the support page `public/support.html`. |

## Screenshots

```
node scripts/ios/screenshots.mjs      # after npm run build:ios
```

Serves `dist-ios/`, lets the autopilot skate the title, act 1, act 2, act 3 and act 5 on an iPhone-sized page and saves
each at 3x into `app-store/screenshots/` (not in git; about 25 minutes in a cloud session with no GPU): 6.9" (1320 x 2868, the one size App Store Connect requires) and
6.5" (1284 x 2778), portrait and landscape. It fails if any shot shows DEV TOOLS, FULL SCREEN or SCORES.

## Still open

- The contact email on the support page (`CONTACT_EMAIL` in `public/support.html`). App Store Connect wants a support
  URL with a way to reach the developer.
- Music rights: both tracks have to be cleared for the store, even free.
- The age rating: street dice are simulated gambling (for in-game coins only) in Apple's questionnaire.
- iPad, Android (Capacitor does Android the same way), in-app purchases, Game Center for the leaderboard.
