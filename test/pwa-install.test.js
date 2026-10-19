import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isStandaloneMode,
  detectDevicePlatform,
  getPwaInstallState,
  initPwaInstallService
} from '../src/services/pwa-install-service.js';

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
