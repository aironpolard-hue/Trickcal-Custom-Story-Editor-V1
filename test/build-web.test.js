'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const tempRoot = path.resolve(os.tmpdir());
const temp = fs.mkdtempSync(path.join(tempRoot, 'trickcal-build-test-'));
try {
  const project = path.join(temp, 'project');
  fs.cpSync(path.join(root, 'templates', 'minimal-demo'), project, { recursive: true });
  fs.mkdirSync(path.join(project, 'build', 'web'), { recursive: true });
  fs.writeFileSync(path.join(project, 'build', 'web', 'user-file.txt'), 'preserve');
  const electron = require('electron');
  const texture = path.join(project, 'assets', 'spine', 'standing', 'ner', 'Ner.png');
  const parkedTexture = texture + '.test-backup';
  fs.renameSync(texture, parkedTexture);
  try {
    const missing = spawnSync(electron, [root], {
      cwd: root,
      env: { ...process.env, TRICKCAL_BUILD_PROJECT: project, TRICKCAL_BUILD_TARGET: 'web' },
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
    });
    assert.notStrictEqual(missing.status, 0, 'building must fail when an atlas texture is missing');
    assert.ok((missing.stdout + missing.stderr).includes('Ner.png'), missing.stderr);
    assert.strictEqual(fs.readFileSync(path.join(project, 'build', 'web', 'user-file.txt'), 'utf8'), 'preserve');
  } finally {
    fs.renameSync(parkedTexture, texture);
  }
  const result = spawnSync(electron, [root], {
    cwd: root,
    env: { ...process.env, TRICKCAL_BUILD_PROJECT: project, TRICKCAL_BUILD_TARGET: 'web' },
    encoding: 'utf8',
    timeout: 60000,
    windowsHide: true,
  });
  assert.strictEqual(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
  const output = path.join(project, 'build', 'web');
  for (const file of ['index.html', 'app.js', 'scene-graph.js', 'scene-state.js', 'story-navigation.js', 'camera-timeline.js', 'stage-timeline.js', 'move-presets.js', 'expressions.js', 'audio-player.js', 'story.json']) {
    assert.ok(fs.existsSync(path.join(output, file)), `Missing built file: ${file}`);
  }
  assert.deepStrictEqual(fs.readFileSync(path.join(output, 'app.js')), fs.readFileSync(path.join(root, 'runtime', 'app.js')),
    'Web player must contain the current runtime');
  assert.deepStrictEqual(fs.readFileSync(path.join(output, 'expressions.js')), fs.readFileSync(path.join(root, 'runtime', 'expressions.js')),
    'Web player must contain the safe expression evaluator');
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.ok(html.indexOf('scene-graph.js') < html.indexOf('scene-state.js'));
  assert.ok(html.indexOf('scene-state.js') < html.indexOf('app.js'));
  assert.ok(html.indexOf('camera-timeline.js') < html.indexOf('app.js'));
  assert.ok(html.indexOf('camera-timeline.js') < html.indexOf('stage-timeline.js') && html.indexOf('stage-timeline.js') < html.indexOf('app.js'));
  assert.ok(html.indexOf('move-presets.js') < html.indexOf('app.js'));
  assert.ok(html.indexOf('expressions.js') < html.indexOf('app.js'));
  assert.ok(html.indexOf('audio-player.js') < html.indexOf('app.js'));
  const story = JSON.parse(fs.readFileSync(path.join(output, 'story.json'), 'utf8'));
  assert.ok(story.lines.some(line => line.mode === 'branch' && line.options.length === 2));
  assert.ok(story.lines.some(line => line.mode === 'manga' && line.purple));
  assert.ok(story.lines.some(line => line.dialogueDelay === 0.2 &&
    line.events?.some(event => event.type === 'camera' && event.delay === 0.2) &&
    line.events?.some(event => event.type === 'actor' && event.delay === 0.2)));
  assert.ok(story.lines.some(line => line.mode === 'wait' && line.timelineEnd > 0));
  assert.ok(story.lines.some(line => line.mode === 'transition' && line.kind === 'fadeblack' && line.hold === 0.8));
  assert.ok(story.lines.some(line => line.mode === 'newsTalk' && line.preset === '新闻框·主播' && line.entryDuration === 0.8));
  assert.ok(story.lines.some(line => line.mode === 'fullscreen' && line.preset === '全屏文字'));
  assert.ok(story.lines.some(line => line.cameraTracks?.some(track => track.property === 'zoom')));
  assert.ok(story.lines.some(line => line.effectTracks?.some(track => track.property === 'brightness')));
  assert.strictEqual(story.variables.saw_signal, false);
  assert.ok(story.lines.some(line => line.mode === 'condition'));
  assert.ok(!story.lines.some(line => line.mode === 'ui-op' || line.mode === 'ui-present'));
  const archive = path.join(project, 'build', 'archive', 'web');
  const saved = fs.readdirSync(archive);
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(fs.readFileSync(path.join(archive, saved[0], 'user-file.txt'), 'utf8'), 'preserve');
  console.log('build-web.test.js: ok');
} finally {
  if (path.dirname(temp) === tempRoot && path.basename(temp).startsWith('trickcal-build-test-')) {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
