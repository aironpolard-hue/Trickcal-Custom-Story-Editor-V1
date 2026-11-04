'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const tempRoot = path.resolve(os.tmpdir());
const temp = fs.mkdtempSync(path.join(tempRoot, 'trickcal-check-ipc-'));
try {
  const result = spawnSync(require('electron'), [path.join(__dirname, 'check-ipc-main.electron.js')], {
    cwd: root, env: { ...process.env, TRICKCAL_CHECK_TEST_DIR: temp },
    encoding: 'utf8', timeout: 60000, windowsHide: true,
  });
  assert.strictEqual(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes('check-ipc.electron.js: ok'), result.stdout);
  console.log('check-ipc.test.js: ok');
} finally {
  if (path.dirname(temp) === tempRoot && path.basename(temp).startsWith('trickcal-check-ipc-')) {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
