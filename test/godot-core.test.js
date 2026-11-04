'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { compile } = require('../compiler/trickcal');

const root = path.resolve(__dirname, '..');
const candidates = [
  process.env.GODOT_EXECUTABLE,
  'C:/Program Files/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe',
].filter(Boolean);
const godot = candidates.find(file => fs.existsSync(file));
if (!godot) throw new Error('找不到 Godot 4；请设置 GODOT_EXECUTABLE。');
const tempRoot = path.resolve(os.tmpdir());
const temp = fs.mkdtempSync(path.join(tempRoot, 'trickcal-godot-test-'));
try {
  fs.cpSync(path.join(root, 'native', 'godot-player'), temp, { recursive: true });
  const script = [
    'choice "选择"',
    '  "左" -> left',
    '  "右" -> right',
    'label left:',
    '  ui show bubble left_frame',
    '  ui show text left_text',
    '  ui bind left_text to left_frame offset 0,0',
    '  ui write left_text "左边"',
    '  ui present',
    '  ui remove left_frame',
    '  jump done',
    'label right:',
    '  ui show bubble right_frame',
    '  ui present',
    '  ui remove right_frame',
    'label done:',
    '  end',
  ].join('\n');
  const result = compile(script);
  assert.deepStrictEqual(result.diagnostics, []);
  fs.writeFileSync(path.join(temp, 'story.json'), JSON.stringify(result.story));
  const run = spawnSync(godot, ['--headless', '--path', temp, '--script', 'res://tests/core.gd'], {
    encoding: 'utf8', timeout: 60000, windowsHide: true,
  });
  assert.strictEqual(run.status, 0, `${run.error || ''}\n${run.stdout}\n${run.stderr}`);
  assert.ok(!/SCRIPT ERROR|ERROR:/.test(run.stdout + run.stderr), run.stdout + run.stderr);
  assert.ok(run.stdout.includes('godot-core.test: ok'), run.stdout + run.stderr);
  fs.cpSync(path.join(root, 'templates', 'minimal-demo', 'assets', 'dialogue'), path.join(temp, 'project', 'assets', 'dialogue'), { recursive: true });
  fs.copyFileSync(path.join(root, 'runtime', 'assets', 'fonts', 'one_mobile_pop_cjk.ttf'), path.join(temp, 'font.ttf'));
  const imported = spawnSync(godot, ['--headless', '--path', temp, '--editor', '--import', '--quit'], {
    encoding: 'utf8', timeout: 60000, windowsHide: true,
  });
  assert.strictEqual(imported.status, 0, `${imported.error || ''}\n${imported.stdout}\n${imported.stderr}`);
  assert.ok(!/SCRIPT ERROR|ERROR:/.test(imported.stdout + imported.stderr), imported.stdout + imported.stderr);
  const render = spawnSync(godot, ['--display-driver', 'windows', '--rendering-method', 'gl_compatibility', '--position', '-3000,-3000', '--resolution', '64x64', '--path', temp, '--script', 'res://tests/render.gd'], {
    encoding: 'utf8', timeout: 60000, windowsHide: true,
  });
  assert.strictEqual(render.status, 0, `${render.error || ''}\n${render.stdout}\n${render.stderr}`);
  assert.ok(!/SCRIPT ERROR|ERROR:/.test(render.stdout + render.stderr), render.stdout + render.stderr);
  assert.ok(render.stdout.includes('godot-render.test: ok'), render.stdout + render.stderr);
  console.log('godot-core.test.js: ok');
} finally {
  if (path.dirname(temp) === tempRoot && path.basename(temp).startsWith('trickcal-godot-test-')) {
    try { fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
    catch (error) { console.warn(`无法清理测试临时目录 ${temp}: ${error.message}`); }
  }
}
