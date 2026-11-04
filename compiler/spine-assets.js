'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let TextureAtlas;

function atlasParser() {
  if (!TextureAtlas) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'runtime', 'assets', 'vendor', 'spine-webgl.min.js'), 'utf8');
    const context = {};
    vm.runInNewContext(source, context, { filename: 'spine-webgl.min.js' });
    TextureAtlas = context.spine.TextureAtlas;
  }
  return TextureAtlas;
}

function checkedFile(file, root, label) {
  let actual;
  try {
    actual = fs.realpathSync(file);
    if (!fs.statSync(actual).isFile()) throw new Error('不是文件');
  } catch (error) {
    throw new Error(`${label}无法读取：${error.message}`);
  }
  const relative = path.relative(root, actual);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error(`${label}路径超出允许的素材目录`);
  }
  return actual;
}

function validateSpineDirectory(directory, allowedRoot) {
  const root = fs.realpathSync(allowedRoot);
  const actualDir = fs.realpathSync(directory);
  const relative = path.relative(root, actualDir);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Spine 路径超出允许的素材目录');
  }
  if (!fs.statSync(actualDir).isDirectory()) throw new Error('Spine 路径不是文件夹');
  const files = fs.readdirSync(actualDir);
  const skeletons = files.filter(file => file.endsWith('.skel.bytes') &&
    files.includes(file.slice(0, -'.skel.bytes'.length) + '.atlas.txt'));
  if (skeletons.length !== 1) throw new Error('文件夹需要恰好一组同名 .skel.bytes 和 .atlas.txt');
  const skeleton = skeletons[0];
  const base = skeleton.slice(0, -'.skel.bytes'.length);
  checkedFile(path.join(actualDir, skeleton), root, 'Spine 骨骼文件');
  const atlas = checkedFile(path.join(actualDir, base + '.atlas.txt'), root, 'Spine atlas');
  let parsed;
  try {
    parsed = new (atlasParser())(fs.readFileSync(atlas, 'utf8'));
  } catch (error) {
    throw new Error(`Spine atlas 格式无效：${error.message}`);
  }
  if (!parsed.pages.length) throw new Error('Spine atlas 没有贴图页');
  const pages = Array.from(parsed.pages, page => {
    const name = page.name;
    if (!name || path.isAbsolute(name) || path.win32.isAbsolute(name) || /^[A-Za-z]:/.test(name)) {
      throw new Error(`Spine atlas 贴图路径无效：${name || '空路径'}`);
    }
    checkedFile(path.resolve(actualDir, name), root, `Spine atlas 贴图 ${name} `);
    return name;
  });
  return { base, pages };
}

module.exports = { validateSpineDirectory };
