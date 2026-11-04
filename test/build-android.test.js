'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { androidApplicationId } = require('../packaging/android-id');

const root = path.resolve(__dirname, '..');
const tempRoot = path.resolve(os.tmpdir());
const temp = fs.mkdtempSync(path.join(tempRoot, 'trickcal-android-test-'));
const signingKeys = ['TRICKCAL_ANDROID_KEYSTORE', 'TRICKCAL_ANDROID_STORE_PASSWORD', 'TRICKCAL_ANDROID_KEY_ALIAS', 'TRICKCAL_ANDROID_KEY_PASSWORD'];
try {
  const project = path.join(temp, 'project');
  fs.cpSync(path.join(root, 'templates', 'minimal-demo'), project, { recursive: true });
  const env = { ...process.env, TRICKCAL_BUILD_PROJECT: project, TRICKCAL_BUILD_TARGET: 'android' };
  for (const key of signingKeys) delete env[key];
  const electron = require('electron');
  const partial = spawnSync(electron, [root], {
    cwd: root, env: { ...env, TRICKCAL_ANDROID_KEYSTORE: path.join(temp, 'missing.jks') },
    encoding: 'utf8', timeout: 60000, windowsHide: true,
  });
  assert.notStrictEqual(partial.status, 0);
  assert.ok(!fs.existsSync(path.join(project, 'build')), 'Invalid signing must fail before modifying build output');
  fs.mkdirSync(path.join(project, 'build', 'android'), { recursive: true });
  fs.writeFileSync(path.join(project, 'build', 'android', 'user-file.txt'), 'preserve');
  const result = spawnSync(electron, [root], {
    cwd: root, env, encoding: 'utf8', timeout: 360000, windowsHide: true,
  });
  assert.strictEqual(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
  const output = path.join(project, 'build', 'android');
  const apk = path.join(output, 'TrickcalStory-debug.apk');
  assert.ok(fs.existsSync(apk), 'Debug APK was not generated');
  assert.ok(!fs.existsSync(path.join(output, 'TrickcalStory-release.apk')));
  assert.ok(!fs.existsSync(path.join(output, 'keystore')), 'Signing key must not be copied');
  const archive = path.join(project, 'build', 'archive', 'android');
  const saved = fs.readdirSync(archive);
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(fs.readFileSync(path.join(archive, saved[0], 'user-file.txt'), 'utf8'), 'preserve');
  const listing = spawnSync('tar', ['-tf', apk], { encoding: 'utf8', timeout: 60000, windowsHide: true });
  assert.strictEqual(listing.status, 0, listing.stderr);
  assert.ok(!/\.(?:jks|keystore)$/im.test(listing.stdout), 'APK must not contain a keystore');
  assert.ok(listing.stdout.includes('assets/public/scene-graph.js'));
  assert.ok(listing.stdout.includes('assets/public/scene-state.js'));
  assert.ok(listing.stdout.includes('assets/public/story-navigation.js'));
  assert.ok(listing.stdout.includes('assets/public/camera-timeline.js'));
  assert.ok(listing.stdout.includes('assets/public/move-presets.js'));
  assert.ok(listing.stdout.includes('assets/public/expressions.js'));
  assert.ok(listing.stdout.includes('assets/public/audio-player.js'));
  const extract = name => {
    const result = spawnSync('tar', ['-xOf', apk, name], { timeout: 60000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    assert.strictEqual(result.status, 0, String(result.stderr));
    return result.stdout;
  };
  assert.deepStrictEqual(extract('assets/public/app.js'), fs.readFileSync(path.join(root, 'runtime', 'app.js')),
    'APK must contain the current runtime');
  assert.deepStrictEqual(extract('assets/public/stage-timeline.js'), fs.readFileSync(path.join(root, 'runtime', 'stage-timeline.js')),
    'APK must contain the stage timeline sampler');
  assert.deepStrictEqual(extract('assets/public/expressions.js'), fs.readFileSync(path.join(root, 'runtime', 'expressions.js')),
    'APK must contain the safe expression evaluator');
  const story = JSON.parse(extract('assets/public/story.json').toString('utf8'));
  assert.strictEqual(story.variables.saw_signal, false);
  assert.ok(story.lines.some(line => line.mode === 'condition'));
  assert.ok(story.lines.some(line => line.mode === 'newsTalk' && line.entryDuration === 0.8),
    'APK story must contain the tutorial news entry duration');
  assert.ok(!story.lines.some(line => line.mode === 'ui-op' || line.mode === 'ui-present'),
    'APK tutorial must not contain independent UI');
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || path.join(env.LOCALAPPDATA, 'Android', 'Sdk');
  const tools = fs.readdirSync(path.join(sdk, 'build-tools')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const aapt = path.join(sdk, 'build-tools', tools[0], process.platform === 'win32' ? 'aapt.exe' : 'aapt');
  const badging = spawnSync(aapt, ['dump', 'badging', apk], { encoding: 'utf8', timeout: 60000, windowsHide: true });
  assert.strictEqual(badging.status, 0, badging.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(project, 'trickcal.project.json'), 'utf8'));
  assert.ok(badging.stdout.includes(`name='${androidApplicationId(manifest, project)}'`), badging.stdout);
  console.log('build-android.test.js: ok');
} finally {
  if (path.dirname(temp) === tempRoot && path.basename(temp).startsWith('trickcal-android-test-')) {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
