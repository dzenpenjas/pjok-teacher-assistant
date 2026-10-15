import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

test('service worker precaches report detail controls and final report builder', async () => {
  const handlers = {};
  let installedAssets;
  let cacheName;
  vm.runInNewContext(readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8'), {
    self: { addEventListener(name, handler) { handlers[name] = handler; }, skipWaiting() {} },
    caches: { async open(name) { cacheName = name; return { async addAll(assets) { installedAssets = assets; } }; } }
  });
  let installation;
  handlers.install({ waitUntil(promise) { installation = promise; } });
  await installation;
  assert.notEqual(cacheName, 'pjok-teacher-assistant-v44');
  for (const asset of ['./src/ui/classes-screen.js', './src/ui/report-detail-controls.js', './src/ui/final-report-page-builder.js', './src/ui/report-pdf-layout.js', './src/services/batch-report-selection.js']) {
    assert.ok(installedAssets.includes(asset), asset);
    assert.ok(existsSync(new URL('../' + asset, import.meta.url)), asset);
  }
});
