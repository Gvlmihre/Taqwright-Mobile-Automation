# PageObjectModelTW

Mobile test automation for the **Way2Automation MediShop** Android/iOS app, built on
**[Taqwright](https://www.taqwright.dev/)** (Playwright's test runner on top of Appium 3) with
**TypeScript** and the **Page Object Model**.

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
| CI | GitHub Actions (Android + iOS emulator/simulator on every push) + BrowserStack + Bitrise |

> **iOS build note:** `app/` only ships the Android APK. Add `app/way2automation.app` (simulator
> build, for `ios`/`ios-ci`) and `app/way2automation.ipa` (signed device build, for
> `ios-device`/`browserstack-ios`) — or point `IOS_APP_PATH`/`IOS_IPA_PATH` at builds produced
> elsewhere — before running an iOS project. Everything below is wired up and ready as soon as a
> build exists.

---

## Quick start

```bash
nvm use                    # Node 24
npm install

npm run setup:android      # one-time: JDK + Android SDK + Appium + an AVD
npm run setup:ios          # one-time: Appium's XCUITest driver (Xcode itself is manual — see below)
npm run doctor             # verify the environment (checks Xcode too)
npm run devices            # list emulators / simulators / handsets

npm test                   # run the suite on a local Android emulator
npm run test:ios           # run the suite on a local iOS simulator
npm run test:report        # run, then open the HTML report
```

Taqwright starts Appium and cold-boots the AVD/simulator itself — no manual `appium` process, no
`emulator -avd` / `xcrun simctl boot` in another terminal.

**iOS prerequisites** (macOS only): full Xcode (not just Command Line Tools — `xcode-select -p`
should point at `Xcode.app`), a simulator runtime installed via Xcode → Settings → Platforms, and
`npm run setup:ios` for the driver. `npm run doctor` reports what's missing.

## Scripts

| Script | What it does |
|--------|--------------|
| `npm test` | Android suite on a local emulator (`--project android`) |
| `npm run test:device` | Android suite on a physical handset (`--project android-device`, set `DEVICE_UDID`) |
| `npm run test:ci` | Android suite against an already-booted emulator (`--project android-ci`) |
| `npm run test:bs` | Android suite on BrowserStack real devices (`--project browserstack-android`) |
| `npm run test:ios` | iOS suite on a local simulator (`--project ios`) |
| `npm run test:ios:device` | iOS suite on a physical iPhone (`--project ios-device`, set `IOS_DEVICE_UDID`) |
| `npm run test:ios:ci` | iOS suite against an already-booted simulator (`--project ios-ci`) |
| `npm run test:ios:bs` | iOS suite on BrowserStack real devices (`--project browserstack-ios`) |
| `npm run test:report` / `npm run report` | run with the HTML reporter / open the last report |
| `npm run codegen` | record a spec by tapping the app |
| `npm run inspect` | live inspector, ranks locators by stability |
| `npm run typecheck` | `tsc --noEmit` |

## Layout

```
PageObjectModelTW/
├── taqwright.config.ts        # runner + device/app config (all 8 projects)
├── app/way2automation.apk     # the Android build under test
│   # way2automation.app / .ipa (iOS) not checked in yet — see the note above
├── pages/                     # Page Object Model — one class per screen
│   ├── LoginPage.ts           #   owns APP_PACKAGE
│   ├── HomePage.ts
│   └── CartPage.ts
├── fixtures/test.ts           # injects page objects on top of the `mobile` fixture
├── testData/loginData.json    # external test data
├── tests/                     # the maintained suite (POM + fixtures)
│   ├── login.spec.ts
│   └── datadriven.spec.ts
├── .github/workflows/         # ci.yml (push/PR, Android + iOS) + browserstack.yml
├── bitrise.yml                # Bitrise emulator/simulator + BrowserStack pipelines
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
| `ios` | local simulator, booted by Taqwright | day-to-day local runs (iOS) |
| `ios-ci` | a simulator already booted (`IOS_UDID`) | GitHub Actions, Bitrise |
| `ios-device` | physical iPhone (`IOS_DEVICE_UDID`) | real-device smoke |
| `browserstack-ios` | BrowserStack cloud | cross-device matrix, nightly |

## CI

**GitHub Actions — `.github/workflows/ci.yml`** runs on every push and PR:

1. `static` — `npm ci`, `tsc --noEmit`, and `taqwright test --list` (both `android-ci` and
   `ios-ci`) to prove the config loads.
2. `android-emulator` — boots an API 34 x86_64 emulator (with a cached AVD snapshot), runs
   `--project android-ci`, uploads `playwright-report/` + `test-results/` as an artifact.
3. `ios-simulator` — on a `macos-14` runner, boots an iPhone 15 simulator, runs
   `--project ios-ci`, uploads the report. Needs `app/way2automation.app` to actually pass.

**GitHub Actions — `.github/workflows/browserstack.yml`** runs on pushes to `main`, nightly at
02:00 UTC, and on demand. `browserstack-android` uploads the APK once, reuses the returned `bs://`
id, then runs `--project browserstack-android`; `browserstack-ios` does the same with the `.ipa`
and `--project browserstack-ios`.

Repository secrets to add (Settings → Secrets and variables → Actions):

| Secret | Used by |
|--------|---------|
| `BROWSERSTACK_USERNAME` | browserstack.yml |
| `BROWSERSTACK_ACCESS_KEY` | browserstack.yml |

**Bitrise — `bitrise.yml`** covers four workflows: `emulator` / `browserstack` (Android, using
`avd-manager` + `wait-for-android-emulator`) and `ios-simulator` / `browserstack-ios` (iOS, using
`xcrun simctl` directly — set those two workflows' Stack to a macOS one with Xcode in the Workflow
Editor). All four use `deploy-to-bitrise-io` for the report. Add the same two BrowserStack values
under App settings → Secrets.

Credentials are read from the environment only — never from `taqwright.config.ts`.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — layers, file-by-file walkthrough, API reference.
- [CLAUDE.md](./CLAUDE.md) — conventions + gotchas for future work (AI or human).
- [SKILLS.md](./SKILLS.md) — rebuild this framework from scratch for any app.
- [COMPARISON.md](./COMPARISON.md) — MobileWright vs Taqwright, side by side.
