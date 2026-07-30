# PageObjectModelTW

Mobile test automation for the **Way2Automation MediShop** Android app, built on
**[Taqwright](https://www.taqwright.dev/)** (Playwright's test runner on top of Appium 3) with
**TypeScript** and the **Page Object Model**.

This is the Taqwright twin of the `PageObjectModelMW` (MobileWright) repo: same app, same three
scenarios, same layering — so the two can be demoed side by side. See
[COMPARISON.md](./COMPARISON.md) for the differences.

| | |
|---|---|
| App under test | MediShop — `com.way2automation.medishop` (Jetpack Compose, minSdk 24) |
| Runner | `@taqwright/taqwright` (Playwright runner + Appium 3 / UiAutomator2) |
| Language | TypeScript 5.x, ESM |
| Pattern | Page Object Model + fixtures |
| Node | ≥ 24 (see `.nvmrc`) |
| CI | GitHub Actions (emulator on every push) + BrowserStack + Bitrise |

---

## Quick start

```bash
nvm use                    # Node 24
npm install

npm run setup:android      # one-time: JDK + Android SDK + Appium + an AVD
npm run doctor             # verify the environment
npm run devices            # list emulators / simulators / handsets

npm test                   # run the suite on a local emulator
npm run test:report        # run, then open the HTML report
```

Taqwright starts Appium and cold-boots the AVD itself — no manual `appium` process, no
`emulator -avd` in another terminal.

## Scripts

| Script | What it does |
|--------|--------------|
| `npm test` | suite on a local emulator (`--project android`) |
| `npm run test:device` | suite on a physical handset (`--project android-device`, set `DEVICE_UDID`) |
| `npm run test:ci` | suite against an already-booted emulator (`--project android-ci`) |
| `npm run test:bs` | suite on BrowserStack real devices (`--project browserstack-android`) |
| `npm run test:rough` | the scratch specs in `rough/` (`--project android-rough`) |
| `npm run test:report` / `npm run report` | run with the HTML reporter / open the last report |
| `npm run codegen` | record a spec by tapping the app |
| `npm run inspect` | live inspector, ranks locators by stability |
| `npm run typecheck` | `tsc --noEmit` |

## Layout

```
PageObjectModelTW/
├── taqwright.config.ts        # runner + device/app config (all 5 projects)
├── app/way2automation.apk     # the build under test
├── pages/                     # Page Object Model — one class per screen
│   ├── LoginPage.ts           #   owns APP_PACKAGE
│   ├── HomePage.ts
│   └── CartPage.ts
├── fixtures/test.ts           # injects page objects on top of the `mobile` fixture
├── testData/loginData.json    # external test data
├── tests/                     # the maintained suite (POM + fixtures)
│   ├── login.spec.ts
│   └── datadriven.spec.ts
├── rough/                     # scratch specs — base runner, everything inlined
├── .github/workflows/         # ci.yml (push/PR) + browserstack.yml
├── bitrise.yml                # Bitrise emulator + BrowserStack pipelines
└── ARCHITECTURE.md CLAUDE.md SKILLS.md COMPARISON.md
```

Layer rule: **config → fixtures → pages → tests/data.** Specs never touch `mobile` directly;
`rough/` exists to show what that anti-pattern looks like.

## Runner projects

| Project | Device | Use it for |
|---------|--------|-----------|
| `android` | local AVD, booted by Taqwright | day-to-day local runs |
| `android-rough` | local AVD | the `rough/` reference specs |
| `android-ci` | an emulator already running (`ANDROID_UDID`) | GitHub Actions, Bitrise |
| `android-device` | physical handset (`DEVICE_UDID`) | real-device smoke |
| `browserstack-android` | BrowserStack cloud | cross-device matrix, nightly |

## CI

**GitHub Actions — `.github/workflows/ci.yml`** runs on every push and PR:

1. `static` — `npm ci`, `tsc --noEmit`, and `taqwright test --list` to prove the config loads.
2. `android-emulator` — boots an API 34 x86_64 emulator (with a cached AVD snapshot), runs
   `--project android-ci`, uploads `playwright-report/` + `test-results/` as an artifact.

**GitHub Actions — `.github/workflows/browserstack.yml`** runs on pushes to `main`, nightly at
02:00 UTC, and on demand. It uploads the APK once, reuses the returned `bs://` id, then runs
`--project browserstack-android`.

Repository secrets to add (Settings → Secrets and variables → Actions):

| Secret | Used by |
|--------|---------|
| `BROWSERSTACK_USERNAME` | browserstack.yml |
| `BROWSERSTACK_ACCESS_KEY` | browserstack.yml |

**Bitrise — `bitrise.yml`** covers the same two paths (`emulator`, `browserstack`) using
`avd-manager` + `wait-for-android-emulator` and `deploy-to-bitrise-io` for the report. Add the
same two BrowserStack values under App settings → Secrets.

Credentials are read from the environment only — never from `taqwright.config.ts`.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — layers, file-by-file walkthrough, API reference.
- [CLAUDE.md](./CLAUDE.md) — conventions + gotchas for future work (AI or human).
- [SKILLS.md](./SKILLS.md) — rebuild this framework from scratch for any app.
- [COMPARISON.md](./COMPARISON.md) — MobileWright vs Taqwright, side by side.
