import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isStandaloneMode,
  detectDevicePlatform,
  getPwaInstallState,
  initPwaInstallService,
  promptPwaInstall,
  subscribePwaInstallState,
  getPwaListenerCount,
  _setDeferredPromptForTesting,
  _setInstalledForTesting,
  _resetPwaInstallServiceForTesting
} from '../src/services/pwa-install-service.js';
import { renderSettingsScreen } from '../src/ui/settings-screen.js';
import { installReportTestEnvironment } from './helpers/report-test-environment.js';

test('PWA install service detects default browser environment without throwing', () => {
  const state = getPwaInstallState();
  assert.equal(typeof state.isInstalled, 'boolean');
  assert.equal(typeof state.canPrompt, 'boolean');
  assert.equal(typeof state.platform, 'object');
  assert.equal(typeof state.platform.isIOS, 'boolean');
  assert.equal(typeof state.platform.isAndroid, 'boolean');
  assert.equal(typeof state.platform.isDesktop, 'boolean');
});

test('detectDevicePlatform identifies platform attributes cleanly', () => {
  const platform = detectDevicePlatform();
  assert.ok('isIOS' in platform);
  assert.ok('isAndroid' in platform);
  assert.ok('isChrome' in platform);
  assert.ok('isSafari' in platform);
});

test('isStandaloneMode returns false in Node/headless test environment', () => {
  assert.equal(isStandaloneMode(), false);
});

test('Targeted Test 1: beforeinstallprompt tersedia dan promptPwaInstall memanggil dialog', async () => {
  _resetPwaInstallServiceForTesting();
  let promptCalls = 0;

  const mockPromptEvent = {
    prompt: async () => {
      promptCalls++;
    },
    userChoice: Promise.resolve({ outcome: 'accepted' })
  };

  _setDeferredPromptForTesting(mockPromptEvent);

  const state = getPwaInstallState();
  assert.equal(state.canPrompt, true);
  assert.equal(state.status, 'ready');

  const result = await promptPwaInstall();
  assert.equal(promptCalls, 1);
  assert.equal(result.outcome, 'accepted');
});

test('Targeted Test 2: Pengguna menerima atau membatalkan instalasi', async () => {
  _resetPwaInstallServiceForTesting();

  // Subcase A: Accepted
  const acceptedPromptEvent = {
    prompt: async () => {},
    userChoice: Promise.resolve({ outcome: 'accepted' })
  };
  _setDeferredPromptForTesting(acceptedPromptEvent);
  const acceptedResult = await promptPwaInstall();
  assert.equal(acceptedResult.outcome, 'accepted');

  // Subcase B: Dismissed
  const dismissedPromptEvent = {
    prompt: async () => {},
    userChoice: Promise.resolve({ outcome: 'dismissed' })
  };
  _setDeferredPromptForTesting(dismissedPromptEvent);
  const dismissedResult = await promptPwaInstall();
  assert.equal(dismissedResult.outcome, 'dismissed');

  const stateAfterDismiss = getPwaInstallState();
  assert.equal(stateAfterDismiss.status, 'dismissed');
});

test('Targeted Test 3: Event prompt tidak digunakan dua kali (deferredPrompt dibersihkan)', async () => {
  _resetPwaInstallServiceForTesting();
  let promptCalls = 0;

  const mockPromptEvent = {
    prompt: async () => {
      promptCalls++;
    },
    userChoice: Promise.resolve({ outcome: 'dismissed' })
  };

  _setDeferredPromptForTesting(mockPromptEvent);

  // First call consumes the prompt event
  const firstResult = await promptPwaInstall();
  assert.equal(firstResult.outcome, 'dismissed');
  assert.equal(promptCalls, 1);

  // State must reflect that canPrompt is now false
  const stateAfterFirst = getPwaInstallState();
  assert.equal(stateAfterFirst.canPrompt, false);

  // Second call must NOT call prompt() again and return unavailable
  const secondResult = await promptPwaInstall();
  assert.equal(secondResult.outcome, 'unavailable');
  assert.equal(promptCalls, 1, 'prompt() must not be called a second time');
});

test('Targeted Test 4: Browser tanpa dukungan instalasi otomatis (unsupported)', async () => {
  _resetPwaInstallServiceForTesting();

  const state = getPwaInstallState();
  assert.equal(state.canPrompt, false);
  assert.equal(state.status, 'unsupported');

  const result = await promptPwaInstall();
  assert.equal(result.outcome, 'unavailable');
});

test('Targeted Test 5: Perubahan status melalui appinstalled / standalone', async () => {
  _resetPwaInstallServiceForTesting();

  _setInstalledForTesting(true);

  const state = getPwaInstallState();
  assert.equal(state.isInstalled, true);
  assert.equal(state.status, 'installed');
  assert.equal(state.canPrompt, false);

  const result = await promptPwaInstall();
  assert.equal(result.outcome, 'already_installed');
});

test('Targeted Test 6: Tidak ada listener ganda setelah membuka ulang Pengaturan', () => {
  _resetPwaInstallServiceForTesting();
  const env = installReportTestEnvironment({});

  const dummyState = {
    settingsActiveTab: 'backup',
    school: {},
    teacher: {},
    academicYears: [],
    semesters: [],
    tags: [],
    assessmentDefinitions: []
  };

  const dummyActions = {
    exportData: () => {},
    importData: () => {}
  };

  // Initial listener count
  assert.equal(getPwaListenerCount(), 0);

  // Open settings 5 times (simulating navigating back and forth)
  for (let i = 0; i < 5; i++) {
    const screen = renderSettingsScreen(dummyState, dummyActions, { activeTab: 'backup' });
    assert.ok(screen);
  }

  // There should only be 1 active listener registered from settings screen, not 5
  assert.equal(getPwaListenerCount(), 1, 'Expected at most 1 active settings listener without accumulation');
});

test('Targeted Test 7: Manifest dan daftar aset offline mencakup modul yang diperlukan', () => {
  const rootDir = process.cwd();

  // 1. Verify manifest.webmanifest
  const manifestPath = path.join(rootDir, 'manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.ok(manifest.name, 'manifest must have a name');
  assert.ok(manifest.short_name, 'manifest must have a short_name');
  assert.ok(manifest.start_url, 'manifest must have start_url');
  assert.ok(manifest.scope, 'manifest must have scope');
  assert.equal(manifest.display, 'standalone');

  const iconSizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(iconSizes.includes('192x192'), 'manifest must include 192x192 icon');
  assert.ok(iconSizes.includes('512x512'), 'manifest must include 512x512 icon');

  manifest.icons.forEach((icon) => {
    const resolvedPath = path.join(rootDir, icon.src.replace(/^\.\//, ''));
    assert.ok(fs.existsSync(resolvedPath), `Icon file ${icon.src} must exist at ${resolvedPath}`);
  });

  // 2. Verify service-worker.js APP_ASSETS
  const swPath = path.join(rootDir, 'service-worker.js');
  assert.ok(fs.existsSync(swPath), 'service-worker.js must exist');
  const swContent = fs.readFileSync(swPath, 'utf8');

  assert.ok(
    swContent.includes('./src/services/pwa-install-service.js'),
    'service-worker.js APP_ASSETS must include ./src/services/pwa-install-service.js'
  );
  assert.ok(
    swContent.includes('./manifest.webmanifest'),
    'service-worker.js APP_ASSETS must include ./manifest.webmanifest'
  );
  assert.ok(
    swContent.includes('./icons/icon-192.png'),
    'service-worker.js APP_ASSETS must include ./icons/icon-192.png'
  );
  assert.ok(
    swContent.includes('./icons/icon-512.png'),
    'service-worker.js APP_ASSETS must include ./icons/icon-512.png'
  );
  assert.ok(
    swContent.includes('pjok-teacher-assistant-v48'),
    'service-worker.js must have cache version bumped'
  );
});
