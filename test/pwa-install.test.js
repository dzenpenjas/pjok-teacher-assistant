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
  getPwaDiagnostics,
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

test('Targeted Test: Tombol Instal Aplikasi PJOK selalu terlihat saat belum standalone (prompt tersedia maupun tidak)', () => {
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
  const dummyActions = { exportData: () => {}, importData: () => {} };

  // Case 1: Prompt TIDAK tersedia (canPrompt = false)
  const screenWithoutPrompt = renderSettingsScreen(dummyState, dummyActions, { activeTab: 'backup' });
  const installBtnWithoutPrompt = screenWithoutPrompt.querySelector('.pwa-install-btn');
  assert.ok(installBtnWithoutPrompt, 'Tombol utama Instal Aplikasi PJOK harus selalu ada meski prompt belum tersedia');
  assert.ok(
    installBtnWithoutPrompt.textContent.includes('Instal Aplikasi PJOK'),
    'Label tombol harus tetap Instal Aplikasi PJOK'
  );

  // Secondary guide button must be present as a secondary option
  const guideBtnWithoutPrompt = screenWithoutPrompt.querySelector('.pwa-guide-btn');
  assert.ok(guideBtnWithoutPrompt, 'Tombol petunjuk harus menjadi opsi sekunder, bukan menggantikan tombol instalasi');

  // Case 2: Prompt TERSEDIA (canPrompt = true)
  _setDeferredPromptForTesting({
    prompt: async () => {},
    userChoice: Promise.resolve({ outcome: 'accepted' })
  });

  const screenWithPrompt = renderSettingsScreen(dummyState, dummyActions, { activeTab: 'backup' });
  const installBtnWithPrompt = screenWithPrompt.querySelector('.pwa-install-btn');
  assert.ok(installBtnWithPrompt, 'Tombol utama Instal Aplikasi PJOK harus tampil saat prompt tersedia');
  assert.ok(
    installBtnWithPrompt.textContent.includes('Instal Aplikasi PJOK'),
    'Label tombol utama harus tetap Instal Aplikasi PJOK'
  );
});

test('Targeted Test: Prompt tersedia — tombol langsung memanggil prompt() dan menangani accepted/dismissed', async () => {
  _resetPwaInstallServiceForTesting();
  installReportTestEnvironment({});
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

  // Trigger through UI click on primary button
  const dummyState = { settingsActiveTab: 'backup', school: {}, teacher: {}, academicYears: [], semesters: [], tags: [], assessmentDefinitions: [] };
  const dummyActions = { exportData: () => {}, importData: () => {} };
  const screen = renderSettingsScreen(dummyState, dummyActions, { activeTab: 'backup' });
  const installBtn = screen.querySelector('.pwa-install-btn');
  assert.ok(installBtn);

  await installBtn.click();
  assert.equal(promptCalls, 1, 'prompt() must be called directly upon clicking install button');

  // Event must be consumed and not reused
  const secondCallResult = await promptPwaInstall();
  assert.equal(secondCallResult.outcome, 'unavailable');
  assert.equal(promptCalls, 1, 'prompt() must not be invoked a second time');
});

test('Targeted Test: Prompt tidak tersedia — tombol tetap dapat diklik, menampilkan info diagnostik & membuka petunjuk', async () => {
  _resetPwaInstallServiceForTesting();
  installReportTestEnvironment({});

  const state = getPwaInstallState();
  assert.equal(state.canPrompt, false);
  assert.equal(state.status, 'unsupported');

  const dummyState = { settingsActiveTab: 'backup', school: {}, teacher: {}, academicYears: [], semesters: [], tags: [], assessmentDefinitions: [] };
  const dummyActions = { exportData: () => {}, importData: () => {} };
  const screen = renderSettingsScreen(dummyState, dummyActions, { activeTab: 'backup' });

  const installBtn = screen.querySelector('.pwa-install-btn');
  assert.ok(installBtn, 'Tombol instalasi harus tetap terlihat saat prompt tidak tersedia');

  const guideBox = screen.querySelector('.pwa-guide-box');
  assert.ok(guideBox, 'Kotak petunjuk & diagnostik harus ada di DOM');
  assert.equal(guideBox.classList.contains('is-open'), false, 'Awalnya guideBox tertutup');

  // Click install button when prompt is not available
  await installBtn.click();

  // Guide box should automatically expand to inform user and show alternatives
  assert.equal(guideBox.classList.contains('is-open'), true, 'Klik tombol instal saat prompt tidak ada harus membuka petunjuk & diagnostik');

  // Direct service call outcome
  const res = await promptPwaInstall();
  assert.equal(res.outcome, 'unavailable');
});

test('Targeted Test: Status sudah terpasang (Standalone Mode) — menampilkan status terinstal dan tidak menawarkan instalasi ulang', async () => {
  _resetPwaInstallServiceForTesting();
  installReportTestEnvironment({});

  _setInstalledForTesting(true);

  const state = getPwaInstallState();
  assert.equal(state.isInstalled, true);
  assert.equal(state.status, 'installed');
  assert.equal(state.canPrompt, false);

  const dummyState = { settingsActiveTab: 'backup', school: {}, teacher: {}, academicYears: [], semesters: [], tags: [], assessmentDefinitions: [] };
  const dummyActions = { exportData: () => {}, importData: () => {} };
  const screen = renderSettingsScreen(dummyState, dummyActions, { activeTab: 'backup' });

  // Badge must indicate already installed
  const installedBadge = screen.querySelector('.is-installed');
  assert.ok(installedBadge, 'Badge harus menampilkan status terinstal');
  assert.ok(installedBadge.textContent.includes('Aplikasi sudah terinstal'));

  // Install button should NOT be rendered when already installed
  const installBtn = screen.querySelector('.pwa-install-btn');
  assert.equal(installBtn, null, 'Tombol instalasi tidak boleh ditawarkan saat aplikasi sudah terinstal');

  const promptResult = await promptPwaInstall();
  assert.equal(promptResult.outcome, 'already_installed');
});

test('Targeted Test: getPwaDiagnostics mengaudit kesiapan PWA secara faktual', () => {
  _resetPwaInstallServiceForTesting();
  installReportTestEnvironment({});

  const diag = getPwaDiagnostics();
  assert.ok(diag);
  assert.equal(typeof diag.isSecure, 'boolean');
  assert.equal(typeof diag.promptAvailable, 'boolean');
  assert.ok(Array.isArray(diag.checks));
  assert.ok(diag.checks.length >= 5);

  const checkIds = diag.checks.map(c => c.id);
  assert.ok(checkIds.includes('standalone'));
  assert.ok(checkIds.includes('secure'));
  assert.ok(checkIds.includes('manifest'));
  assert.ok(checkIds.includes('icons'));
  assert.ok(checkIds.includes('service_worker'));
  assert.ok(checkIds.includes('prompt'));
});

test('Targeted Test: Tidak ada listener ganda setelah membuka ulang Pengaturan', () => {
  _resetPwaInstallServiceForTesting();
  installReportTestEnvironment({});

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

  assert.equal(getPwaListenerCount(), 0);

  for (let i = 0; i < 5; i++) {
    const screen = renderSettingsScreen(dummyState, dummyActions, { activeTab: 'backup' });
    assert.ok(screen);
  }

  assert.equal(getPwaListenerCount(), 1, 'Expected at most 1 active settings listener without accumulation');
});

test('Targeted Test: Manifest dan daftar aset offline mencakup modul yang diperlukan', () => {
  const rootDir = process.cwd();

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
