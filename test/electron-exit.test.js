'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const electron = require('electron');

for (const file of ['editor.electron.js', 'ui-runtime.electron.js']) {
  const result = spawnSync(electron, [path.join(__dirname, file)], {
    env: { ...process.env, TRICKCAL_TEST_FORCE_FAILURE: '1' },
    encoding: 'utf8', timeout: 30000, windowsHide: true,
  });
  assert.strictEqual(result.status, 1, `${file}: ${result.error || ''}\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stderr.includes('intentional test harness failure'), file);
}
console.log('electron-exit.test.js: ok');
