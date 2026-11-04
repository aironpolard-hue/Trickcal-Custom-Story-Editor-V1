'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const temp = process.env.TRICKCAL_CHECK_TEST_DIR;
if (!temp) throw new Error('缺少测试目录。');
const project = path.join(temp, 'project');
fs.mkdirSync(path.join(project, 'story'), { recursive: true });
fs.writeFileSync(path.join(project, 'trickcal.project.json'), JSON.stringify({ id: 'check-test', title: '检查测试', entry: 'story/main.trickcal' }));
fs.writeFileSync(path.join(project, 'story', 'main.trickcal'), 'narration "原始内容"\n');
app.setPath('userData', path.join(temp, 'electron-user-data'));
require('../main');

app.whenReady().then(async () => {
  try {
    let launcher;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      launcher = BrowserWindow.getAllWindows()[0];
      if (launcher && !launcher.webContents.isLoading() && launcher.webContents.getURL().includes('/launcher/')) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(launcher && !launcher.webContents.isLoading(), 'Launcher did not load');
    const manifestFile = path.join(project, 'trickcal.project.json');
    const entryFile = path.join(project, 'story', 'main.trickcal');
    const beforeManifest = fs.readFileSync(manifestFile, 'utf8');
    const beforeEntry = fs.readFileSync(entryFile, 'utf8');
    const result = await launcher.webContents.executeJavaScript(`window.engine.compile({
      projectPath: ${JSON.stringify(project)}, source: 'narration "后台检查"'
    })`);
    assert.deepStrictEqual(result.diagnostics, []);
    assert.strictEqual(result.story.lines[0].text, '后台检查');
    assert.strictEqual(fs.readFileSync(manifestFile, 'utf8'), beforeManifest);
    assert.strictEqual(fs.readFileSync(entryFile, 'utf8'), beforeEntry);
    assert.ok(!fs.existsSync(path.join(project, '.preview')));
    assert.ok(!fs.existsSync(path.join(project, 'presets')));
    const concurrent = await launcher.webContents.executeJavaScript(`(async () => {
      const projectPath = ${JSON.stringify(project)};
      const longSource = Array.from({ length: 30000 }, (_, i) => 'narration "测试 ' + i + '"').join('\\n');
      const request = source => window.engine.compile({ projectPath, source });
      const all = await Promise.all([request(longSource), request('narration "旧版本"'), request('narration "最新版本"')]);
      return { count: all[0].story.lines.length, superseded: all[1].superseded, latest: all[2].story.lines[0].text };
    })()`);
    assert.deepStrictEqual(concurrent, { count: 30000, superseded: true, latest: '最新版本' });
    const concurrentPreview = await launcher.webContents.executeJavaScript(`(async () => {
      const projectPath = ${JSON.stringify(project)};
      const longSource = Array.from({ length: 30000 }, (_, i) => 'narration "测试 ' + i + '"').join('\\n');
      const request = (source, purpose) => window.engine.compile({ projectPath, source, purpose });
      const all = await Promise.all([
        request(longSource), request('narration "剧本检查"'),
        request('narration "旧预览"', 'presetPreview'),
        request('narration "新预览"', 'presetPreview')
      ]);
      return { busy: all[0].story.lines.length, story: all[1].story.lines[0].text,
        oldPreview: all[2].superseded, newPreview: all[3].story.lines[0].text };
    })()`);
    assert.deepStrictEqual(concurrentPreview, { busy: 30000, story: '剧本检查', oldPreview: true, newPreview: '新预览' });
    const bootstrap = await launcher.webContents.executeJavaScript('window.engine.bootstrap()');
    assert.ok(bootstrap.platform);
    const created = await launcher.webContents.executeJavaScript(`window.engine.createProject({
      parentDir: ${JSON.stringify(temp)}, folderName: 'new-project', title: '新手测试', chapterNo: 7
    })`);
    const newStory = fs.readFileSync(path.join(created.projectPath, 'story', 'main.trickcal'), 'utf8');
    assert.ok(newStory.includes('opening 7 "新手测试"'), 'new project should use configured title and chapter');
    assert.ok(!/^\s*ui\s+(?:show|bind|write|move|present|remove)\b/m.test(newStory), 'new tutorial should not use independent UI');
    const newPresets = fs.readdirSync(path.join(created.projectPath, 'presets'));
    assert.ok(!newPresets.some(file => /^ui_.*\.json$/.test(file)),
      'new project should not include independent UI presets');
    const checked = await launcher.webContents.executeJavaScript(`window.engine.compile({
      projectPath: ${JSON.stringify(created.projectPath)}, source: ${JSON.stringify(newStory)}
    })`);
    assert.deepStrictEqual(checked.diagnostics.filter(item => item.severity === 'error'), []);
    const badPosition = await launcher.webContents.executeJavaScript(`window.engine.compile({
      projectPath: ${JSON.stringify(created.projectPath)},
      source: 'define ner = Spine("assets/spine/standing/ner")\\nparallel:\\n  after 200ms:\\n    show ner at lefft\\n  wait 1s'
    })`);
    assert.ok(badPosition.diagnostics.some(item => item.severity === 'error' &&
      item.line === 4 && item.message.includes('位置')), JSON.stringify(badPosition.diagnostics));
    const spineDir = path.join(created.projectPath, 'assets', 'spine', 'standing', 'ner');
    const texture = path.join(spineDir, 'Ner.png'), parked = texture + '.test-backup';
    fs.renameSync(texture, parked);
    try {
      const broken = await launcher.webContents.executeJavaScript(`window.engine.compile({
        projectPath: ${JSON.stringify(created.projectPath)}, source: ${JSON.stringify(newStory)}
      })`);
      assert.ok(broken.diagnostics.some(item => item.severity === 'error' && item.message.includes('Ner.png')));
      const originalDialog = dialog.showOpenDialog;
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [spineDir] });
      try {
        const error = await launcher.webContents.executeJavaScript(`window.engine.importAsset({
          projectPath: ${JSON.stringify(created.projectPath)}, kind: 'spine', alias: 'incomplete'
        }).then(() => '', error => error.message)`);
        assert.ok(error.includes('Ner.png'), error);
        assert.ok(!fs.existsSync(path.join(created.projectPath, 'assets', 'imported', 'incomplete')));
      } finally {
        dialog.showOpenDialog = originalDialog;
      }
    } finally {
      fs.renameSync(parked, texture);
    }
    const originalDialog = dialog.showOpenDialog;
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [spineDir] });
    try {
      const imported = await launcher.webContents.executeJavaScript(`window.engine.importAsset({
        projectPath: ${JSON.stringify(created.projectPath)}, kind: 'spine', alias: 'complete'
      })`);
      assert.strictEqual(imported.manifest.spines.complete.file, 'Ner');
      assert.ok(fs.existsSync(path.join(created.projectPath, 'assets', 'imported', 'complete', 'Ner.png')));
    } finally {
      dialog.showOpenDialog = originalDialog;
    }
    console.log('check-ipc.electron.js: ok');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    for (const window of BrowserWindow.getAllWindows()) window.destroy();
    app.exit(process.exitCode || 0);
  }
}).catch(error => { console.error(error); app.exit(1); });
