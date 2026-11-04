'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { compile } = require('../compiler/trickcal');
const { validateSpineDirectory } = require('../compiler/spine-assets');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'trickcal-spine-test-'));
try {
  const assets = path.join(temp, 'assets');
  const directory = path.join(assets, 'spine', 'model');
  fs.mkdirSync(path.join(directory, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'hero.skel.bytes'), 'fixture');
  const atlas = path.join(directory, 'hero.atlas.txt');
  const atlasText = 'first.png\nsize: 16,16\nfilter: Linear,Linear\n\npages/second.png\nsize: 16,16\nfilter: Linear,Linear\n';
  fs.writeFileSync(atlas, atlasText);
  fs.writeFileSync(path.join(directory, 'first.png'), 'fixture');
  fs.writeFileSync(path.join(directory, 'pages', 'second.png'), 'fixture');
  assert.deepStrictEqual(validateSpineDirectory(directory, assets), {
    base: 'hero', pages: ['first.png', 'pages/second.png'],
  });
  const source = 'define hero = Spine("assets/spine/model")\nshow hero\nhero normal "你好"\n';
  assert.deepStrictEqual(compile(source, { projectRoot: temp }).diagnostics, []);

  fs.unlinkSync(path.join(directory, 'pages', 'second.png'));
  const missing = compile(source, { projectRoot: temp }).diagnostics;
  assert.ok(missing.some(item => item.line === 1 && item.severity === 'error' &&
    item.message.includes('pages/second.png')), JSON.stringify(missing));
  assert.throws(() => validateSpineDirectory(directory, directory), /pages\/second\.png/);

  fs.writeFileSync(atlas, '');
  assert.throws(() => validateSpineDirectory(directory, assets), /没有贴图页/);

  fs.writeFileSync(path.join(temp, 'outside.png'), 'fixture');
  fs.writeFileSync(atlas, '../../../outside.png\nsize: 16,16\n');
  assert.throws(() => validateSpineDirectory(directory, assets), /超出允许/);

  fs.writeFileSync(path.join(assets, 'shared.png'), 'fixture');
  fs.writeFileSync(atlas, '../../shared.png\nsize: 16,16\n');
  assert.deepStrictEqual(validateSpineDirectory(directory, assets).pages, ['../../shared.png']);
  assert.throws(() => validateSpineDirectory(directory, directory), /超出允许/);

  fs.writeFileSync(atlas, '/absolute.png\nsize: 16,16\n');
  assert.throws(() => validateSpineDirectory(directory, assets), /路径无效/);
  console.log('spine-assets.test.js: ok');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
