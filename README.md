# PageObjectModelTW

Mobile test automation for the **Way2Automation MediShop** Android app, built on
**[Taqwright](https://www.taqwright.dev/)** (Playwright's test runner on top of Appium 3) with
**TypeScript** and the **Page Object Model**. iOS support is designed in (config, CI, docs) but
currently **disabled/commented out** — see the note below.

This is the Taqwright twin of the `PageObjectModelMW` (MobileWright) repo: same app, same three
scenarios, same layering — so the two can be demoed side by side. See
[COMPARISON.md](./COMPARISON.md) for the differences.

| | |
|---|---|
| App under test | MediShop — `com.way2automation.medishop` (Jetpack Compose, minSdk 24) |
| Runner | `@taqwright/taqwright` (Playwright runner + Appium 3 / UiAutomator2 + XCUITest) |
| Language | TypeScript 5.x, ESM |
| Pattern | Page Object Model + fixtures |
| Node | ≥ 24 (see `.nvmrc`) |
| CI | GitHub Actions (Android emulator on every push) + BrowserStack + Bitrise. iOS jobs exist in each pipeline but are commented out. |

> **iOS is disabled, not just missing a build.** `app/` only ships the Android APK, and there is no
> `.app`/`.ipa` checked in. Because of that, every iOS project in `taqwright.config.ts`, every iOS
> job in `.github/workflows/ci.yml` / `browserstack.yml` / `bitrise.yml`, and the `test:ios*` npm
> scripts have been commented out / removed rather than left to fail. To bring iOS back: add
> `app/way2automation.app` (simulator build, for `ios`/`ios-ci`) and `app/way2automation.ipa`
> (signed device build, for `ios-device`/`browserstack-ios`) — or point `IOS_APP_PATH`/`IOS_IPA_PATH`
> at builds produced elsewhere — then uncomment the matching blocks in those files.

---

## Quick start

```bash
nvm use                    # Node 24
npm install

npm run setup:android      # one-time: JDK + Android SDK + Appium + an AVD
npm run doctor             # verify the environment
npm run devices            # list emulators / simulators / handsets

npm test                   # run the suite on a local Android emulator
npm run test:report        # run, then open the HTML report
```

Taqwright starts Appium and cold-boots the AVD itself — no manual `appium` process, no
`emulator -avd` in another terminal.

**iOS is disabled** (see the note above) — there are no `test:ios*` / `setup:ios` scripts right
now. Re-add them (and `appium driver install xcuitest` for the driver) once an iOS build exists;
until then, full Xcode and a simulator runtime would also be prerequisites on a macOS host.

## Scripts

| Script | What it does |
|--------|--------------|
| `npm test` | Android suite on a local emulator (`--project android`) |
| `npm run test:device` | Android suite on a physical handset (`--project android-device`, set `DEVICE_UDID`) |
| `npm run test:ci` | Android suite against an already-booted emulator (`--project android-ci`) |
| `npm run test:bs` | Android suite on BrowserStack real devices (`--project browserstack-android`) |
| `npm run test:report` / `npm run report` | run with the HTML reporter / open the last report |
| `npm run codegen` | record a spec by tapping the app |
| `npm run inspect` | live inspector, ranks locators by stability |
| `npm run typecheck` | `tsc --noEmit` |

## Layout

```
PageObjectModelTW/
├── taqwright.config.ts        # runner + device/app config (4 active Android projects;
│                               # 4 iOS projects commented out — see the note above)
├── app/way2automation.apk     # the Android build under test
│   # way2automation.app / .ipa (iOS) not checked in — iOS projects are commented out
├── pages/                     # Page Object Model — one class per screen
│   ├── LoginPage.ts           #   owns APP_PACKAGE
│   ├── HomePage.ts
│   └── CartPage.ts
├── fixtures/test.ts           # injects page objects on top of the `mobile` fixture
├── testData/loginData.json    # external test data
├── tests/                     # the maintained suite (POM + fixtures)
│   ├── login.spec.ts
│   └── datadriven.spec.ts
├── .github/workflows/         # ci.yml (push/PR, Android; iOS job commented out) + browserstack.yml
├── bitrise.yml                # Bitrise emulator + BrowserStack pipelines (iOS workflows commented out)
└── ARCHITECTURE.md CLAUDE.md SKILLS.md COMPARISON.md
```

Layer rule: **config → fixtures → pages → tests/data.** Specs never touch `mobile` directly.

## Runner projects

| Project | Device | Use it for |
|---------|--------|-----------|
| `android` | local AVD, booted by Taqwright | day-to-day local runs |
| `android-ci` | an emulator already running (`ANDROID_UDID`) | GitHub Actions, Bitrise |
| `android-device` | physical handset (`DEVICE_UDID`) | real-device smoke |
| `browserstack-android` | BrowserStack cloud | cross-device matrix, nightly |

`ios` / `ios-ci` / `ios-device` / `browserstack-ios` are defined in `taqwright.config.ts` but
commented out (no iOS build exists yet) — see the note at the top of this file.

## CI

**GitHub Actions — `.github/workflows/ci.yml`** runs on every push and PR:

1. `static` — `npm ci`, `tsc --noEmit`, and `taqwright test --list` (`android-ci`) to prove the
   config loads. The equivalent `ios-ci --list` step is commented out.
2. `android-emulator` — boots an API 34 x86_64 emulator (with a cached AVD snapshot), runs
   `--project android-ci`, uploads `playwright-report/` + `test-results/` as an artifact.
3. `ios-simulator` — commented out. Would boot an iPhone 15 simulator on a `macos-14` runner and
   run `--project ios-ci`; needs `app/way2automation.app` before it can be uncommented.

**GitHub Actions — `.github/workflows/browserstack.yml`** runs on pushes to `main`, nightly at
02:00 UTC, and on demand. `browserstack-android` uploads the APK once, reuses the returned `bs://`
id, then runs `--project browserstack-android`. `browserstack-ios` (uploads the `.ipa`, runs
`--project browserstack-ios`) is commented out for the same reason.

Repository secrets to add (Settings → Secrets and variables → Actions):

| Secret | Used by |
|--------|---------|
| `BROWSERSTACK_USERNAME` | browserstack.yml |
| `BROWSERSTACK_ACCESS_KEY` | browserstack.yml |

**Bitrise — `bitrise.yml`** actively runs two workflows: `emulator` / `browserstack` (Android,
using `avd-manager` + `wait-for-android-emulator`). `ios-simulator` / `browserstack-ios` (iOS,
using `xcrun simctl` directly) and their shared `_setup_ios` are commented out, along with their
`trigger_map` entries — uncomment and set those workflows' Stack to a macOS one with Xcode in the
Workflow Editor once an iOS build exists. All active workflows use `deploy-to-bitrise-io` for the
report. Add the same two BrowserStack values under App settings → Secrets.

Credentials are read from the environment only — never from `taqwright.config.ts`.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — layers, file-by-file walkthrough, API reference.
- [CLAUDE.md](./CLAUDE.md) — conventions + gotchas for future work (AI or human).
- [SKILLS.md](./SKILLS.md) — rebuild this framework from scratch for any app.
- [COMPARISON.md](./COMPARISON.md) — MobileWright vs Taqwright, side by side.
