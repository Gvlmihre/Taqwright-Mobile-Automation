import { defineConfig, Platform } from '@taqwright/taqwright';

/**
 * Taqwright runner configuration — the single source of truth for
 * platform / device / app / timeout / reporter.
 *
 * App under test: Way2Automation MediShop (Jetpack Compose, minSdk 24).
 *
 * Projects:
 *   android              → local emulator, Taqwright boots the AVD for you
 *   android-rough        → the scratch specs in rough/ (reference, not maintained)
 *   android-ci           → an emulator that is *already* running (GitHub Actions / Bitrise)
 *   android-device       → a physical handset plugged into adb
 *   browserstack-android → BrowserStack real-device cloud
 *
 * Run one with:  npx taqwright test --project <name>
 */

const APP_PACKAGE = 'com.way2automation.medishop';
const APP_PATH = './app/way2automation.apk';

/** AVD id from `emulator -list-avds`. Created by `npm run setup:android`. */
const AVD_NAME = process.env.ANDROID_AVD ?? 'taqwright_api34';
/** adb serial of an already-booted emulator (CI) — see `npx taqwright devices`. */
const CI_UDID = process.env.ANDROID_UDID ?? 'emulator-5554';
/** adb serial of the physical device (MobileWright repo used 'R3CT204N57L'). */
const DEVICE_UDID = process.env.DEVICE_UDID ?? 'R3CT204N57L';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expectTimeout: 30_000,
  outputDir: './test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  // Serial by default: one Appium, one device. See docs/parallelism before raising this —
  // workers > 1 on a local provider requires device.pool or device.autoDiscover.
  workers: 1,

  projects: [
    /* ── Local emulator: Taqwright starts Appium AND cold-boots the AVD ────────── */
    {
      name: 'android',
      use: {
        platform: Platform.ANDROID,
        device: {
          provider: 'emulator',
          name: AVD_NAME,
          orientation: 'portrait',
          // pool: [                                   // parallel across emulators
          //   { udid: 'emulator-5554', name: 'Pixel_7_API_34' },
          //   { udid: 'emulator-5556', name: 'Pixel_7_API_34_2' },
          // ],
          // autoDiscover: true,                       // or let Taqwright find them
        },
        appium: {
          autoStart: true,
          autoStartDevice: true, // cold-boots AVD_NAME
          host: 'localhost',
          port: 4723,
          path: '/', // Appium 3 default (1.x used '/wd/hub')
          logLevel: 'warn',
        },
        // Reinstall + relaunch a clean app before every test. All three are
        // type-required together — this is what gives us test isolation.
        resetBetweenTests: true,
        buildPath: APP_PATH,
        appBundleId: APP_PACKAGE,
        capabilities: {
          'appium:autoGrantPermissions': true,
        },
        trace: 'on-failure',
        video: 'on-failure',
      },
    },

    /* ── The scratch specs in rough/ — reference only, not the maintained suite ── */
    {
      name: 'android-rough',
      testDir: './rough',
      use: {
        platform: Platform.ANDROID,
        device: { provider: 'emulator', name: AVD_NAME },
        appium: { autoStart: true, autoStartDevice: true, host: 'localhost', port: 4723, path: '/' },
        resetBetweenTests: true,
        buildPath: APP_PATH,
        appBundleId: APP_PACKAGE,
      },
    },

    /* ── CI: emulator is already booted by the runner, don't try to boot one ───── */
    {
      name: 'android-ci',
      use: {
        platform: Platform.ANDROID,
        device: {
          provider: 'emulator',
          udid: CI_UDID,
        },
        appium: {
          autoStart: true,
          autoStartDevice: false, // the CI step already booted it
          host: 'localhost',
          port: 4723,
          path: '/',
          logLevel: 'warn',
          newCommandTimeout: 240,
        },
        resetBetweenTests: true,
        buildPath: APP_PATH,
        appBundleId: APP_PACKAGE,
        capabilities: {
          'appium:autoGrantPermissions': true,
        },
        trace: 'on',
        video: 'on-failure',
      },
      retries: 2,
    },

    /* ── Physical handset over adb ─────────────────────────────────────────────── */
    {
      name: 'android-device',
      use: {
        platform: Platform.ANDROID,
        device: {
          provider: 'local-device',
          udid: DEVICE_UDID,
        },
        appium: { autoStart: true, host: 'localhost', port: 4723, path: '/' },
        resetBetweenTests: true,
        buildPath: APP_PATH,
        appBundleId: APP_PACKAGE,
        trace: 'on-failure',
        video: 'on-failure',
      },
    },

    /* ── BrowserStack real devices ─────────────────────────────────────────────── */
    /* Credentials come from the environment, never from this file:
     *   export BROWSERSTACK_USERNAME=...
     *   export BROWSERSTACK_ACCESS_KEY=...
     * Pre-upload the APK once and set BROWSERSTACK_APP_ID=bs://<id> so each worker
     * doesn't re-upload the 20 MB build.
     */
    {
      name: 'browserstack-android',
      use: {
        platform: Platform.ANDROID,
        device: {
          provider: 'browserstack',
          name: process.env.BS_DEVICE ?? 'Google Pixel 8',
          osVersion: process.env.BS_OS_VERSION ?? '14.0',
          orientation: 'portrait',
        },
        resetBetweenTests: true,
        buildPath: process.env.BROWSERSTACK_APP_ID ?? APP_PATH,
        appBundleId: APP_PACKAGE,
        trace: 'on',
        video: 'off', // BrowserStack records server-side
        capabilities: {
          'bstack:options': {
            projectName: 'PageObjectModelTW',
            buildName: process.env.BROWSERSTACK_BUILD_NAME ?? 'local',
            appiumVersion: '2.19.0',
          },
        },
      },
      // Cloud parallelism is plain workers — no device.pool needed. Keep this at or
      // below your plan's parallel-session limit; override per run with --workers N.
      workers: Number(process.env.BS_WORKERS ?? 2),
    },
  ],
});
