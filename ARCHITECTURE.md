# PageObjectModelTW — Framework Architecture

Mobile test automation framework for the **Way2Automation MediShop** Android app, built on
**Taqwright** (Playwright's test runner driving Appium 3) with **TypeScript** and the
**Page Object Model (POM)** design pattern.

---

## 1. Tech Stack

| Concern | Technology |
|--------|------------|
| Test runner | [`@taqwright/taqwright`](https://www.npmjs.com/package/@taqwright/taqwright) (Playwright runner) |
| Automation engine | Appium 3 — UiAutomator2 (Android) / XCUITest (iOS) |
| Core API | the flat `mobile` fixture (`Mobile`) + chainable `Locator` |
| Language | TypeScript 5.x, ESM (`"type": "module"`) |
| Design pattern | Page Object Model + fixtures |
| Target platform | Android (emulator/simulator, real device, BrowserStack) — iOS designed in but disabled (no build checked in) |
| App under test | `com.way2automation.medishop` (MediShop, Jetpack Compose) |
| Reporting | Playwright HTML reporter + trace viewer + video |
| Node | ≥ 24 |

Taqwright *is* the Playwright runner — `test`, `expect`, fixtures, projects, retries, sharding,
reporters and the CLI flags are Playwright's. What changes is the thing being driven: instead of a
`page` in a browser you get a `mobile` fixture that owns a WebDriver/Appium session against a
phone. Anyone who knows Playwright web testing already knows 90% of this repo.

---

## 2. Directory Layout

```
PageObjectModelTW/
├── taqwright.config.ts        # Global runner + device configuration (4 active Android
│                               # projects; 4 iOS projects commented out)
├── package.json               # Scripts & dependencies
├── tsconfig.json              # Typecheck-only TS config
│
├── app/
│   ├── way2automation.apk     # The Android build under test (installed by the runner)
│   ├── way2automation.app     # iOS simulator build — not checked in; `ios`/`ios-ci` are commented out until it exists
│   └── way2automation.ipa     # iOS device build — not checked in; `ios-device`/`browserstack-ios` are commented out until it exists
│
├── pages/                     # Page Object Model classes (the core abstraction)
│   ├── LoginPage.ts
│   ├── HomePage.ts
│   └── CartPage.ts
│
├── fixtures/
│   └── test.ts                # Custom test fixture wiring page objects
│
├── testData/
│   └── loginData.json         # External data for data-driven tests
│
├── tests/                     # Production specs (use POM + fixtures)
│   ├── login.spec.ts
│   └── datadriven.spec.ts
│
├── .github/workflows/         # ci.yml (Android; iOS job commented out), browserstack.yml (Android; iOS job commented out)
├── bitrise.yml                # emulator/browserstack (Android); ios-simulator/browserstack-ios commented out
├── playwright-report/         # Generated HTML report output
└── test-results/              # Generated run artifacts (traces, videos)
```

---

## 3. Architecture Overview

Four layers. Test specs never touch the device directly — they go through page objects, which are
injected by fixtures, which are configured by the runner config.

```
┌────────────────────────────────────────────────────────────┐
│  taqwright.config.ts                                        │
│  platform, device/provider, buildPath, appBundleId,         │
│  appium, timeout, reporter, trace/video, projects[]         │
└───────────────────────────┬────────────────────────────────┘
                            │ provides the base { mobile } fixture
                            ▼
┌────────────────────────────────────────────────────────────┐
│  fixtures/test.ts   (base.extend<Pages>)                    │
│  Injects loginPage / homePage / cartPage as fixtures        │
└───────────────────────────┬────────────────────────────────┘
                            │ constructs page objects with (mobile)
                            ▼
┌────────────────────────────────────────────────────────────┐
│  pages/*.ts   (Page Object Model)                           │
│  Locators (private getters) + Actions (async methods)       │
│  Wraps every Mobile / Locator interaction                   │
└───────────────────────────┬────────────────────────────────┘
                            │ used by
                            ▼
┌────────────────────────────────────────────────────────────┐
│  tests/*.spec.ts   +   testData/*.json                      │
│  Business-readable scenarios; data-driven via JSON          │
└────────────────────────────────────────────────────────────┘
```

**Key principle:** `pages/` + `fixtures/` + `tests/` keep every locator and interaction out of the
test body — refactored into the Page Object Model instead of inlined.

---

## 4. What Each File Does

### 4.1 `taqwright.config.ts` — Runner Configuration

Single source of truth, passed to `defineConfig()`. Top-level settings:

| Setting | Value | Purpose |
|--------|-------|---------|
| `testDir` | `'./tests'` | where the maintained suite lives |
| `timeout` | `90_000` | per-test timeout (mobile is slow) |
| `expectTimeout` | `30_000` | how long auto-retrying assertions poll |
| `reporter` | `[['list'], ['html', { open: 'never' }]]` | console + `playwright-report/` |
| `retries` | `1` on CI, `0` locally | absorb infra flake without hiding real failures |
| `forbidOnly` | `!!process.env.CI` | a stray `test.only` fails the build |
| `workers` | `1` | serial: one Appium, one device |

Then four **active** projects, each with its own `use` block:

| Project | `device` | Notes |
|---------|----------|-------|
| `android` | `provider: 'emulator'`, `name: ANDROID_AVD` | `appium.autoStartDevice: true` cold-boots the AVD |
| `android-ci` | `provider: 'emulator'`, `udid: ANDROID_UDID` | `autoStartDevice: false` — the CI step already booted it; `retries: 2` |
| `android-device` | `provider: 'local-device'`, `udid: DEVICE_UDID` | physical handset over adb |
| `browserstack-android` | `provider: 'browserstack'`, `name`, `osVersion` | `buildPath` takes a `bs://` id; `workers` = parallel cloud sessions |

Plus four **iOS projects, commented out** (no iOS build exists yet — uncomment along with the
backing `IOS_*` consts once one does):

| Project | `device` | Notes |
|---------|----------|-------|
| `ios` | `provider: 'emulator'`, `name: SIMULATOR_NAME` | `appium.autoStartDevice: true` boots the named simulator; `platform: Platform.IOS` |
| `ios-ci` | `provider: 'emulator'`, `udid: CI_IOS_UDID` | `autoStartDevice: false` — the CI step already booted it; `retries: 2` |
| `ios-device` | `provider: 'local-device'`, `udid: IOS_DEVICE_UDID` | physical iPhone over usbmuxd; `buildPath` is a signed `.ipa` |
| `browserstack-ios` | `provider: 'browserstack'`, `name`, `osVersion` | same shape as `browserstack-android`, `.ipa`-based |

Three settings are **type-required together** and are what give us isolation:

```ts
resetBetweenTests: true,                       // clean install + relaunch per test
buildPath: './app/way2automation.apk',         // or way2automation.app / .ipa for iOS
appBundleId: 'com.way2automation.medishop',
```

`trace` and `video` (`'off' | 'on' | 'on-failure' | 'retain-on-failure'`) attach a per-action
screenshot/page-source timeline and a screen recording to the HTML report. Everything device- or
credential-specific is read from env vars (`ANDROID_AVD`, `ANDROID_UDID`, `DEVICE_UDID`,
`BS_DEVICE`, `BROWSERSTACK_APP_ID`, `IOS_SIMULATOR_NAME`, `IOS_UDID`, `IOS_DEVICE_UDID`,
`BS_IOS_DEVICE`, `BROWSERSTACK_IOS_APP_ID`, …) so the same file works on every machine and in CI.

iOS and Android otherwise share every other setting (`resetBetweenTests`, `trace`, `video`,
`appium.host`/`port`) — only `platform` and `device` differ, exactly as the "adding a device target
means adding a project" rule in CLAUDE.md intends. `platformName` and `appium:automationName`
(`UiAutomator2` vs `XCUITest`) are derived automatically from `platform`, not set by hand.

### 4.2 `fixtures/test.ts` — Dependency Injection Layer

The glue between the runner and the page objects. Taqwright exposes **one** flat base fixture,
`mobile`, which owns the session: locators, gestures, app lifecycle, device controls. We extend it:

```ts
export const test = base.extend<Pages>({
    loginPage: async ({ mobile }, use) => { await use(new LoginPage(mobile)); },
    homePage:  async ({ mobile }, use) => { await use(new HomePage(mobile)); },
    cartPage:  async ({ mobile }, use) => { await use(new CartPage(mobile)); },
});
export { expect };
```

- Consumes the built-in `mobile` fixture (a `rawDriver` fixture is also available as an escape hatch).
- Constructs each page object, injecting that dependency, and hands the instance over via `use()`.
- A fresh page object per test, so tests stay isolated.
- Re-exports `expect`, so specs import `test` + `expect` from one place.

Every page takes exactly `mobile` — there is no separate device object to thread through.

### 4.3 `pages/` — Page Object Model

One class per screen. Convention:

- **Locators** = `private get`ters returning a `Locator` (or private methods when parameterized).
  Lazy — nothing touches the device until an action or assertion runs, and never cached in fields.
- **Actions** = `public async` methods named for user intent, not UI mechanics.
- **Assertions** = optional `expect*` methods wrapping auto-retrying assertions, so specs can read
  `await homePage.expectLoaded()`.
- Dependencies injected via a `private readonly` constructor parameter — no globals.

#### `LoginPage.ts` (login + app lifecycle)

Exports `APP_PACKAGE = 'com.way2automation.medishop'`, reused by the specs.

Locators: `emailField` (`getById('email_id')`), `passwordField` (`getById('password_id')`),
`termsCheckbox` (`getByType('android.widget.CheckBox')`), `signInButton` (`getByText('Sign In')`).

Actions:
- `open()` — asserts the login screen is up. `resetBetweenTests` already installed and launched a
  clean app, so there is nothing to launch; `toBeVisible()` auto-retries, which replaces the fixed
  sleep the MobileWright version needed.
- `relaunch()` — explicit `mobile.launchApp()` for tests that background or terminate the app.
- `enterEmail()` / `enterPassword()` — one-line `fill()`. `fill` focuses, clears, and sends real
  key events, so no select-all/cut workaround is needed to replace a pre-filled value.
- `dismissKeyboard()` — `isKeyboardShown()` → `hideKeyboard()`, so the soft keyboard can't cover
  the checkbox or Sign In button.
- `acceptTermsAndSubmit()` — dismiss keyboard, `check()` the terms box (idempotent — only acts if
  not already checked), `click()` Sign In.
- `login(email, password)` — the high-level orchestration composing all of the above.

#### `HomePage.ts` (product listing / navigation)

Locators: `medicineList` (`getById('list_id')`), `category(name)` and `medicine(name)`
(parameterized `getByText`, the latter with `{ exact: false }`), `cartTab` (`getByText('Cart')`).

Actions:
- `expectLoaded()` — the list is visible.
- `selectCategory(name)` — taps a category chip (e.g. "Fever").
- `swipeList(direction)` — element-scoped swipe (`swipeLeft/Right/Up/Down`), i.e. inside the list's
  own bounding box rather than across the whole screen.
- `openMedicine(name)` — `scrollIntoView({ maxAttempts })` then `click()`. Replaces the hand-rolled
  "swipe until `isVisible()`" loop: Taqwright uses the native scroll where available and falls back
  to a gesture.
- `goToCart()` — opens the Cart tab.

#### `CartPage.ts` (cart management)

Locator: `removeButtons` (`getByLabel('Remove')`) — matches every Remove button in the cart.

Actions: `itemCount()` (via `.count()`), `emptyCart(maxRounds)` (tap the first Remove until the
count reaches zero — no sleeps, `click()` auto-waits; throws if a stuck UI exceeds `maxRounds`),
`expectEmpty()` / `expectItemCount(n)` (via `toHaveCount`).

### 4.4 `testData/loginData.json` — External Test Data

An array of `{ email, password }` objects. Decouples data from logic so the same flow runs against
multiple inputs without code changes. Consumed two ways: `tests/login.spec.ts` uses `testData[0]`
for its shared login; `tests/datadriven.spec.ts` iterates the whole array to generate one test per
record.

> ESM note: JSON imports need an import attribute — `import testData from '../testData/loginData.json' with { type: 'json' };`

### 4.5 `tests/` — Production Specs (the intended pattern)

```ts
import { test } from '../fixtures/test';          // custom fixture, not the base runner
import { APP_PACKAGE } from '../pages/LoginPage';
import testData from '../testData/loginData.json' with { type: 'json' };

const login = testData[0];

test.beforeEach(async ({ loginPage }) => {
    await loginPage.open();
    await loginPage.login(login.email, login.password);
});

test.afterEach(async ({ mobile }) => {
    await mobile.terminateApp(APP_PACKAGE);
});

test('Search Medicine Test', async ({ homePage }) => {
    await homePage.expectLoaded();
    await homePage.selectCategory('Fever');
    await homePage.openMedicine('Antibiotic');
});

test('Empty Cart Test', async ({ homePage, cartPage }) => {
    await homePage.goToCart();
    await cartPage.emptyCart();
    await cartPage.expectEmpty();
});
```

No locators, no sleeps, no Android quirks in the test body — all of that lives in the page objects.
`beforeEach` logs in fresh before every test; `resetBetweenTests` plus `afterEach` keep tests
independent. `datadriven.spec.ts` is the parameterized variant.

---

## 5. Core Concepts Reference

### Fixtures (dependency injection)

Taqwright provides `mobile` (the whole session), plus `rawDriver` (the underlying WebDriver client)
and `networkProxy`. `fixtures/test.ts` builds page-object fixtures on top. Requesting a fixture in
a test signature (`{ homePage, cartPage }`) constructs it automatically.

### `mobile` query API (Playwright-style locators)

| Method | Selects by | Android strategy |
|--------|-----------|------------------|
| `getById(id)` / `getByTestId(id)` | resource id | `id` |
| `getByLabel(label)` | accessibility label | `accessibility id` |
| `getByText(text, { exact })` | visible text | `xpath` on `@text` |
| `getByPlaceholder(text)` | hint text | `xpath` on `@hint` |
| `getByRole(role, { name })` | mapped widget class | `class name` |
| `getByType('android.widget.CheckBox')` | native class | `class name` |
| `getByXpath` / `getByUiSelector` | raw escape hatches | — |

On iOS the same methods resolve to the XCUITest equivalents (`accessibility id`, `-ios predicate
string`, `-ios class chain`) instead of the Android strategies above — the page-object API doesn't
change, only what Appium does underneath. The page objects in this repo (`getById`, `getByType`)
were written and inspected against the Android build only; porting them to run against the iOS
build will likely need `npm run inspect --project ios` to find the equivalent iOS locators, per the
"Locator strategy for Jetpack Compose" gotcha in CLAUDE.md.

Chaining and filtering: `.filter({ hasText, has, hasNot, visible })`, `.first()`, `.last()`,
`.nth(n)`, `.locator(child)`, `.and()`, `.or()`, `.count()`, `.all()`.

### `Locator` actions

`click()`/`tap()`, `doubleClick()`, `longPress({ duration })`, `fill()`, `clear()`,
`pressSequentially(text, { delay })`, `press(key)`, `check()`/`uncheck()`/`isChecked()`,
`selectOption()`, `focus()`/`blur()`, `swipeLeft/Right/Up/Down()`, `pinchIn()`/`pinchOut()`,
`dragTo(target)`, `scrollIntoView()`, `screenshot()`, plus queries
(`isVisible`, `isEnabled`, `getText`, `getValue`, `boundingBox`, `getAttribute`).

Every action auto-waits for the element to be visible and actionable and accepts `{ timeout }`.

### Assertions

Two interchangeable styles over the same engine:

```ts
await expect(locator).toBeVisible();     // Playwright-style wrapper
await locator.assertVisible();           // method on the Locator
```

Matchers: `toBeVisible/Hidden/Enabled/Disabled/Checked/Editable/Focused/Attached/InViewport/Empty`,
`toHaveText`, `toContainText`, `toHaveValue`, `toHaveCount`, `toHaveAttribute`, and `.not`.
All poll until they pass or `expectTimeout` elapses.

### `Mobile` device API

App lifecycle: `installApp`, `launchApp`, `activateApp`, `terminateApp`, `backgroundApp(s)`,
`openDeepLink`, `queryAppState`, `isAppInstalled`.
Screen & input: `swipe`, `scroll`, `scrollIntoView`, `click({x,y})`, `clickByPercent`, `dragAndDrop`,
`gesture({ pointers })`, `press`, `pressButton('BACK')`, `goBack`, `hideKeyboard`, `isKeyboardShown`.
Device: `setOrientation`, `getClipboard`/`setClipboard`, `setLocation`, `setPermission`,
`setNetworkConnection`, `getDeviceLogs`, `pushFile`/`pullFile`, `screenshot`, `viewTree`,
`startScreenRecording`, `acceptAlert`/`dismissAlert`, `switchToWebView`/`switchToNative`,
`waitForTimeout`, `pause()`.

### Artifacts

`trace` produces a self-contained per-action screenshot + page-source timeline
(`npx taqwright show-report` → open the trace); `video` records the screen. Both support
`on-failure`, so green runs stay cheap.

---

## 6. How to Run

```bash
npm run setup:android    # one-time toolchain + AVD
npm run doctor           # environment check
npm test                 # local Android emulator
npm run test:report      # run + open the HTML report
npm run test:device      # physical Android handset (DEVICE_UDID=...)
npm run test:bs          # BrowserStack Android (BROWSERSTACK_USERNAME/ACCESS_KEY)
```

**Android prerequisites:** a JDK + Android SDK (`npm run setup:android` installs both), and either
an AVD whose id matches `ANDROID_AVD` or a handset visible to `adb devices`. The APK is installed
by the runner via `buildPath`, so nothing needs to be pre-installed.

**iOS is disabled.** There is no `.app`/`.ipa` checked into `app/`, and the `ios*` projects,
`test:ios*`/`setup:ios` scripts, and iOS CI jobs have all been commented out or removed rather than
left to fail. To bring it back: add `app/way2automation.app` (simulator) and
`app/way2automation.ipa` (device/BrowserStack), or point `IOS_APP_PATH`/`IOS_IPA_PATH` at builds
produced elsewhere; re-add the `test:ios*`/`setup:ios` scripts to `package.json`; and uncomment the
`ios*` projects in `taqwright.config.ts` and the iOS jobs in `ci.yml` / `browserstack.yml` /
`bitrise.yml`. On macOS you'd also need full Xcode with a simulator runtime and the XCUITest driver
(`appium driver install xcuitest`).

---

## 7. Design Rationale — Why POM Here

1. **Readability** — tests read as user stories (`homePage.goToCart(); cartPage.emptyCart();`).
2. **Maintainability** — a locator change is fixed in one page object, not across every test.
3. **Reuse** — `login()`, `openMedicine()`, `emptyCart()` are shared building blocks.
4. **Isolation** — per-test page objects plus `resetBetweenTests` and `beforeEach`/`afterEach`.
5. **Separation of concerns** — config, wiring (fixtures), UI abstraction (pages), data (JSON) and
   scenarios (specs) each live in their own layer.
6. **Portability** — because only `taqwright.config.ts` knows about devices, the same specs run on
   an emulator, a handset, GitHub Actions, Bitrise, and BrowserStack unchanged.
