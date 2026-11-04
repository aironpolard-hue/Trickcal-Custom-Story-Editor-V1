'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const tempRoot = path.resolve(os.tmpdir());
const temp = fs.mkdtempSync(path.join(tempRoot, 'trickcal-windows-test-'));
try {
  const project = path.join(temp, 'project');
  fs.cpSync(path.join(root, 'templates', 'minimal-demo'), project, { recursive: true });
  fs.mkdirSync(path.join(project, 'build', 'windows'), { recursive: true });
  fs.writeFileSync(path.join(project, 'build', 'windows', 'user-file.txt'), 'preserve');
  const result = spawnSync(require('electron'), [root], {
    cwd: root,
    env: { ...process.env, TRICKCAL_BUILD_PROJECT: project, TRICKCAL_BUILD_TARGET: 'windows' },
    encoding: 'utf8',
    timeout: 180000,
    windowsHide: true,
  });
  assert.strictEqual(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
  const output = path.join(project, 'build', 'windows', 'TrickcalStory-win32-x64');
  const fd = fs.openSync(path.join(output, 'TrickcalStory.exe'), 'r');
  const header = Buffer.alloc(2);
  try { fs.readSync(fd, header, 0, header.length, 0); } finally { fs.closeSync(fd); }
  assert.strictEqual(header.toString(), 'MZ');
  const web = path.join(output, 'resources', 'app', 'web');
  for (const file of ['index.html', 'app.js', 'scene-graph.js', 'scene-state.js', 'story-navigation.js', 'camera-timeline.js', 'move-presets.js', 'expressions.js', 'audio-player.js', 'story.json']) {
    assert.ok(fs.existsSync(path.join(web, file)), `Missing Windows player file: ${file}`);
  }
  assert.deepStrictEqual(fs.readFileSync(path.join(web, 'app.js')), fs.readFileSync(path.join(root, 'runtime', 'app.js')),
    'Windows player must contain the current runtime');
  assert.deepStrictEqual(fs.readFileSync(path.join(web, 'stage-timeline.js')), fs.readFileSync(path.join(root, 'runtime', 'stage-timeline.js')),
    'Windows player must contain the stage timeline sampler');
  assert.deepStrictEqual(fs.readFileSync(path.join(web, 'expressions.js')), fs.readFileSync(path.join(root, 'runtime', 'expressions.js')),
    'Windows player must contain the safe expression evaluator');
  const story = JSON.parse(fs.readFileSync(path.join(web, 'story.json'), 'utf8'));
  assert.strictEqual(story.variables.saw_signal, false);
  assert.ok(story.lines.some(line => line.mode === 'condition'));
  assert.ok(story.lines.some(line => line.mode === 'newsTalk' && line.entryDuration === 0.8),
    'Windows story must contain the tutorial news entry duration');
  assert.ok(!story.lines.some(line => line.mode === 'ui-op' || line.mode === 'ui-present'),
    'Windows tutorial must not contain independent UI');
  const saved = fs.readdirSync(path.join(project, 'build', 'archive', 'windows'));
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(fs.readFileSync(path.join(project, 'build', 'archive', 'windows', saved[0], 'user-file.txt'), 'utf8'), 'preserve');
  console.log('build-windows.test.js: ok');
} finally {
  if (path.dirname(temp) === tempRoot && path.basename(temp).startsWith('trickcal-windows-test-')) {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
