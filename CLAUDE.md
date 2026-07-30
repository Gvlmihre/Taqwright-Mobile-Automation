# CLAUDE.md

Guidance for AI models (Claude Code) working in this repository. Read this first, then
`ARCHITECTURE.md` for the full picture, `SKILLS.md` for the step-by-step build blueprint, and
`COMPARISON.md` for how this differs from the MobileWright twin repo.

---

## What this project is

A **mobile test-automation framework** for the Way2Automation **MediShop** Android app
(`com.way2automation.medishop`), built on **Taqwright** (Playwright's test runner over Appium 3)
using **TypeScript** (ESM) and the **Page Object Model** pattern.

## Commands

```bash
npm test                # suite on a local emulator (--project android)
npm run test:ci         # against an already-booted emulator (--project android-ci)
npm run test:device     # physical handset (--project android-device)
npm run test:bs         # BrowserStack (--project browserstack-android)
npm run test:rough      # the rough/ reference specs (--project android-rough)
npm run test:report     # run with the HTML reporter, then open it
npm run typecheck       # tsc --noEmit  ← run this after any code change
npm run doctor          # environment readiness check
npm run devices         # list emulators / simulators / handsets
npm run codegen         # record a spec against a live device
```

There is no unit-test layer — every spec is an on-device e2e test. `npm run typecheck` is the only
check that runs without a device; always run it before committing.

## Prerequisites (must hold before tests pass)

- **Node ≥ 24** (`nvm use` reads `.nvmrc`). The package refuses older majors.
- A JDK + Android SDK + Appium 3 with the UiAutomator2 driver — `npm run setup:android` installs
  all of it, `npm run doctor` verifies it.
- Either an AVD whose id matches `ANDROID_AVD` (default `taqwright_api34`) or a handset visible to
  `adb devices` with its serial in `DEVICE_UDID`.
- The APK at `app/way2automation.apk`. It is installed by the runner via `buildPath` — do not
  assume a pre-installed app.

---

## Layout & where things go

| Path | Contains | Rule |
|------|----------|------|
| `taqwright.config.ts` | runner + device config | single source of truth for platform/device/app/timeout/reporter |
| `pages/` | Page Object Model classes | one class per app screen |
| `fixtures/test.ts` | custom fixtures wiring page objects | the only place page objects are constructed |
| `testData/*.json` | external test data | no data literals hardcoded in specs |
| `tests/*.spec.ts` | maintained production specs | import from `../fixtures/test`, never the base runner |
| `rough/*.spec.ts` | scratch / reference specs | import base `@taqwright/taqwright`; NOT maintained |
| `app/` | the `.apk` binary | referenced by `buildPath` |
| `.github/workflows/`, `bitrise.yml` | CI | see the CI section below |
| `playwright-report/`, `test-results/` | generated output | do not edit; safe to delete |

---

## Conventions (follow these exactly when adding code)

### Page objects (`pages/`)

- **One class per screen.** Class name = `<Screen>Page` (`LoginPage`, `HomePage`, `CartPage`).
- **Dependency via constructor injection**, declared `private readonly`:
  ```ts
  constructor(private readonly mobile: Mobile) {}
  ```
  There is only one dependency to inject — `mobile` owns locators, gestures, and app lifecycle.
  Import it as a type: `import { expect, type Mobile } from '@taqwright/taqwright';`
- **Locators = `private get`ters** returning a `Locator`. Lazy, never cached in fields.
  Parameterized locators are `private` methods, e.g. `private category(name: string)`.
- **Actions = `public async` methods** named in business language (`login`, `goToCart`, `emptyCart`,
  `openMedicine`).
- **Assertions** may live on the page as `expect*` methods (`expectLoaded`, `expectEmpty`) wrapping
  auto-retrying matchers, so specs stay declarative.
- Compose low-level actions into high-level ones (`login()` calls `enterEmail` + `enterPassword` +
  `acceptTermsAndSubmit`).
- Group with `// ----Locators------`, `// ----Actions----`, `// ----Assertions----` banners.
- Export shared constants like `APP_PACKAGE` from the page that owns them (currently `LoginPage.ts`).

### Fixtures (`fixtures/test.ts`)

- Extend the base test: `base.extend<Pages>({...})`.
- One typed entry per page object: add it to the `Pages` type **and** the `extend` object.
- Every page takes `({ mobile }, use) => use(new XPage(mobile))`.
- Re-export `expect` so specs import `test` + `expect` from `../fixtures/test`.

### Tests (`tests/`)

- Import `{ test }` from `../fixtures/test` (NOT from `@taqwright/taqwright`).
- Request page objects by name in the destructured signature: `async ({ homePage, cartPage }) => {}`.
- Keep bodies free of locators, sleeps, and platform quirks — those belong in page objects.
- `beforeEach` reaches a known state (assert loaded + log in); `afterEach` resets
  (`mobile.terminateApp(APP_PACKAGE)`). `resetBetweenTests: true` already reinstalls + relaunches.
- Park unfinished tests with `test.skip(...)` rather than deleting them. Never commit `test.only` —
  `forbidOnly` fails the CI build.
- File suffix is `.spec.ts` (Playwright's default `testMatch`), not `.test.ts`.

### Test data

- Add inputs to `testData/*.json` as arrays of objects and `import` them. Never inline data in specs.
- **ESM requires an import attribute**:
  ```ts
  import testData from '../testData/loginData.json' with { type: 'json' };
  ```
  Without `with { type: 'json' }` the run fails with *"needs an import attribute of type: json"*.

### Config

- Never hardcode a device serial, AVD id, or credential. Read from env with a sensible default
  (`process.env.ANDROID_UDID ?? 'emulator-5554'`).
- Cloud credentials (`BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY`) come from the environment
  only — putting them in the config is a bug.
- Adding a device target means adding a **project**, not editing an existing one.

---

## Taqwright API cheat-sheet

Locators on `mobile`: `getById` / `getByTestId` (resource id), `getByLabel` (accessibility id),
`getByText(text, { exact })`, `getByPlaceholder`, `getByRole(role, { name })`, `getByType('android.widget.X')`,
`getByXpath`, `getByUiSelector`.

`Locator` chaining: `.filter({ hasText, has, hasNot, visible })`, `.first()`, `.last()`, `.nth(n)`,
`.locator(child)`, `.and()`, `.or()`, `.count()`, `.all()`.

`Locator` actions: `click()`/`tap()`, `doubleClick()`, `longPress({duration})`, `fill()`, `clear()`,
`pressSequentially(text,{delay})`, `press(key)`, `check()`/`uncheck()`/`isChecked()`, `selectOption()`,
`focus()`/`blur()`, `swipeLeft/Right/Up/Down()`, `pinchIn()`/`pinchOut()`, `dragTo()`,
`scrollIntoView({direction,maxAttempts})`, `screenshot()`, `isVisible()`, `getText()`, `boundingBox()`.

Assertions: `expect(loc).toBeVisible()/toBeHidden()/toBeEnabled()/toBeChecked()/toHaveText()/toContainText()/toHaveValue()/toHaveCount()/toHaveAttribute()` and `.not`;
or the equivalent `loc.assertVisible()`, `loc.assertText()`, … Both auto-retry until `expectTimeout`.

`mobile` device API: `launchApp`, `terminateApp`, `activateApp`, `backgroundApp(s)`, `installApp`,
`openDeepLink`, `queryAppState`, `swipe`, `scroll`, `pressButton('BACK')`, `goBack`, `hideKeyboard`,
`isKeyboardShown`, `setOrientation`, `getDeviceLogs`, `viewTree`, `screenshot`, `waitForTimeout`,
`pause()`.

Types come from `@taqwright/taqwright`: `Mobile`, `Locator`, `Platform`, `ScrollDirection`,
`SwipeDirection`, `HardwareButton`, `TaqwrightConfig`. `test`, `expect` and `defineConfig` come from
the same package.

---

## Known gotchas (do not "fix" naively)

- **`fill()` already clears the field.** It focuses, clears, then sends real key events. Do *not*
  port the MobileWright tap → longPress → "Select all"/"Cut" workaround here; it is unnecessary and
  makes the flow fragile.
- **Dismiss the keyboard before tapping controls it may cover.** Use
  `if (await mobile.isKeyboardShown()) await mobile.hideKeyboard();` — not `pressButton('BACK')`,
  which can also navigate.
- **`check()` / `uncheck()` are idempotent.** Don't wrap them in an `isChecked()` conditional.
- **Prefer `scrollIntoView()` over hand-rolled swipe loops.** It uses the native scroll and falls
  back to a gesture. Only write a loop if `scrollIntoView` genuinely can't reach the element.
- **No `setTimeout` sleeps.** Actions auto-wait and `expect` auto-retries. If something needs
  waiting, use `await expect(locator).toBeVisible({ timeout })` or `locator.waitFor({ state })`.
  `mobile.waitForTimeout()` exists but is a smell — justify it in a comment.
- **`workers > 1` on a local provider is rejected at config load** unless the project declares
  `device.pool` (≥ `workers` entries) or `device.autoDiscover: true`. Cloud projects are exempt.
- **Locator strategy for Jetpack Compose:** `getById` maps to Android `resource-id`. MediShop is a
  Compose app, so ids only appear there when the app sets `testTagsAsResourceId`. If a `getById`
  locator can't be found, run `npm run inspect`, look at how the node is actually exposed, and fall
  back to `getByLabel('...')` (content-desc) — or combine them:
  `mobile.getById('email_id').or(mobile.getByLabel('email_id'))`.
- **JSON imports need `with { type: 'json' }`** (see Test data above).
- **`--list` still starts an Appium server.** It's slow but harmless; that's why CI uses it as a
  config-validation step rather than a fast unit check.
- **The positional filter is a regex, not a glob.** `taqwright test 'rough/**/*.spec.ts'` throws;
  use `--project android-rough` (a project with its own `testDir`) instead.

---

## CI

- `.github/workflows/ci.yml` — every push and PR: `static` (npm ci → typecheck → `--list`) then
  `android-emulator` (KVM + cached AVD snapshot → API 34 x86_64 emulator → `--project android-ci`
  → upload `playwright-report/` + `test-results/`).
- `.github/workflows/browserstack.yml` — pushes to `main`, nightly cron, and `workflow_dispatch`:
  upload the APK once, export `BROWSERSTACK_APP_ID=bs://…`, run `--project browserstack-android`.
  Requires the `BROWSERSTACK_USERNAME` / `BROWSERSTACK_ACCESS_KEY` repository secrets.
- `bitrise.yml` — the same two paths as Bitrise workflows (`emulator`, `browserstack`) sharing a
  `_setup` workflow, publishing the report through `deploy-to-bitrise-io`.

When editing CI: the runner needs **Node 24**, a **JDK 17**, and **Appium with the uiautomator2
driver**; the emulator must already be booted for `--project android-ci` (`autoStartDevice: false`),
and `ANDROID_UDID` must match its adb serial.

---

## When adding a new screen/feature

1. Create `pages/<Name>Page.ts` following the conventions above.
2. Register it as a fixture in `fixtures/test.ts` (add to the `Pages` type + an `extend` entry).
3. Write the spec in `tests/`, driving only through the page object.
4. Put any new data in `testData/`.
5. Prototype freely in `rough/` if useful, then refactor into the POM layers.
6. Run `npm run typecheck`, then the suite on a device.

Keep the layer boundaries intact: **config → fixtures → pages → tests/data.** Specs must never touch
`mobile` directly (that's what `rough/` shows as the anti-pattern).
