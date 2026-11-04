'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { compile } = require('../compiler/trickcal');

const root = path.resolve(__dirname, '..');
const project = path.join(root, 'templates', 'minimal-demo');
const manifest = JSON.parse(fs.readFileSync(path.join(project, 'trickcal.project.json'), 'utf8'));
const presets = fs.readdirSync(path.join(project, 'presets')).filter(file => file.endsWith('.json')).map(file => ({
  file, ...JSON.parse(fs.readFileSync(path.join(project, 'presets', file), 'utf8')),
}));
// An existing project may still contain an old experimental preset.
presets.push({ file: 'legacy-ui.json', name: '独立漫画气泡', type: 'ui-bubble',
  fields: { width: 760, height: 320, style: 'manga', tail: 'bl', maxHeight: 900 } });
let source = 'ui show bubble frame at 200,300\nui present\nend\n';
const compileSource = value => compile(value, { ...manifest, projectRoot: project, presets });

app.whenReady().then(async () => {
  let baseUrl = '';
  ipcMain.handle('project:read', () => ({ projectPath: project, manifest, source, presets }));
  ipcMain.handle('project:presets', () => presets);
  ipcMain.handle('project:assets', () => []);
  ipcMain.handle('project:compile', async (_, payload) => {
    if (payload.source.includes('旧检查')) await new Promise(resolve => setTimeout(resolve, 800));
    if (payload.source.includes('新检查')) await new Promise(resolve => setTimeout(resolve, 20));
    return compileSource(payload.source);
  });
  ipcMain.handle('project:saveStory', (_, payload) => { source = payload.source; return compileSource(source); });
  ipcMain.handle('project:previewUrl', () => `${baseUrl}/runtime/index.html?embed=1&editorPreview=1&autoStart=1&assetRoot=/project/&storyUrl=/live-story.json`);
  ipcMain.handle('project:presetPreviewUrl', () => `${baseUrl}/runtime/index.html?embed=1&editorPreview=1&interactive=0&assetRoot=/project/&storyUrl=/empty.json`);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/empty.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"lines":[]}'); return; }
    if (url.pathname === '/live-story.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(compileSource(source).story)); return; }
    const prefix = ['/monaco/', '/runtime/', '/project/'].find(item => url.pathname.startsWith(item)) || '/editor/';
    const base = prefix === '/monaco/' ? path.join(root, 'node_modules', 'monaco-editor', 'min')
      : prefix === '/runtime/' ? path.join(root, 'runtime') : prefix === '/project/' ? project : path.join(root, 'editor');
    const file = path.resolve(base, decodeURIComponent(url.pathname.slice(prefix.length)));
    if (!file.startsWith(base + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    });
  });
  let win;
  let failed = false;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    win = new BrowserWindow({
      show: false, width: 1440, height: 900,
      webPreferences: { preload: path.join(root, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false },
    });
    if (process.env.TRICKCAL_TEST_FORCE_FAILURE === '1') throw new Error('intentional test harness failure');
    const errors = [];
    win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/editor/index.html?project=${encodeURIComponent(project)}`);
    const deadline = Date.now() + 30000;
    let ready = false;
    while (Date.now() < deadline) {
      ready = await win.webContents.executeJavaScript('Boolean(window.__studio.story && document.querySelector("#stageLineSelect option"))');
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Editor did not load: ${errors.join('\n')}`);
    const layout = await win.webContents.executeJavaScript(`(() => ({
      tree: Boolean(document.getElementById('projectTree')), assets: Boolean(document.getElementById('assetList')),
      independent: [...document.querySelectorAll('.preset-item b')].some(node => node.textContent.includes('独立')),
      count: document.querySelectorAll('.preset-item').length
    }))()`);
    assert.deepStrictEqual(layout.tree, false);
    assert.deepStrictEqual(layout.assets, false);
    assert.deepStrictEqual(layout.independent, false);
    assert.ok(layout.count >= 8);
    assert.strictEqual(await win.webContents.executeJavaScript('Boolean(document.querySelector(\'[data-file="legacy-ui.json"]\'))'), false);
    for (const [file, kind] of [
      ['transition_fade.json', 'fadeblack'],
      ['transition_circle.json', 'circle'],
      ['transition_push.json', 'rightpush'],
      ['transition_bars.json', 'colorbars'],
    ]) {
      await win.webContents.executeJavaScript(`document.querySelector(${JSON.stringify('[data-file="' + file + '"]')}).click()`);
      let transition = null;
      while (Date.now() < deadline) {
        transition = await win.webContents.executeJavaScript(`(() => {
          const frame = document.getElementById('presetPreviewFrame');
          const demo = frame.contentWindow?.__demo;
          if (demo?.STORY[0]?.mode !== 'transition' || demo.STORY[0].kind !== ${JSON.stringify(kind)}) return null;
          const canvas = frame.contentDocument.getElementById('view'), ctx = canvas.getContext('2d');
          const start = demo.state.lineStart;
          demo.drawScene(start + 100);
          const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          demo.drawScene(start + 700);
          const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let changed = 0;
          for (let i = 0; i < before.length; i += 4)
            if (Math.abs(before[i] - after[i]) + Math.abs(before[i+1] - after[i+1]) + Math.abs(before[i+2] - after[i+2]) > 30) changed++;
          demo.updateState(start + 2000);
          return { changed, kind: demo.STORY[0].kind, ended: demo.state.endShown,
            duration: Boolean(document.querySelector('[data-field="hold"]')) };
        })()`);
        if (transition?.changed > 100) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.ok(transition && transition.kind === kind && transition.changed > 100 && !transition.ended && transition.duration, JSON.stringify({ file, transition }));
    }
    for (const [file, mode] of [
      ['opening_chapter.json', 'title'],
      ['opening_clean.json', 'title'],
      ['location_label.json', 'location'],
    ]) {
      await win.webContents.executeJavaScript(`document.querySelector(${JSON.stringify('[data-file="' + file + '"]')}).click()`);
      let openingPreview = null;
      while (Date.now() < deadline) {
        openingPreview = await win.webContents.executeJavaScript(`(() => {
          const demo = document.getElementById('presetPreviewFrame').contentWindow?.__demo;
          if (demo?.STORY[0]?.mode !== ${JSON.stringify(mode)}) return null;
          if (${JSON.stringify(mode)} === 'title' && demo.STORY[0].cinema !== ${file === 'opening_clean.json' ? 'false' : 'true'}) return null;
          const runtime = demo.modeRuntime[${JSON.stringify(mode)}];
          const canvas = document.getElementById('presetPreviewFrame').contentDocument.getElementById('view');
          const ctx = canvas.getContext('2d');
          const now = demo.state.lineStart + 2500;
          demo.updateState(now);
          demo.drawScene(now);
          const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          demo.STORY[0].uiX = 180;
          demo.drawScene(now);
          const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let changed = 0;
          for (let i = 0; i < before.length; i += 4) {
            if (Math.abs(before[i] - after[i]) + Math.abs(before[i+1] - after[i+1]) + Math.abs(before[i+2] - after[i+2]) > 40) changed++;
          }
          delete demo.STORY[0].uiX;
          return {
            mode: demo.STORY[0].mode,
            clip: runtime.clips.some(clip => clip.key === (${JSON.stringify(mode)} === 'title' ? 'title.Start' : 'location.Start')),
            cinema: ${JSON.stringify(mode)} === 'title' ? demo.findNode(runtime.root, 'Panel/CinemaFrameGroup').hidden : null,
            transform: Boolean(document.querySelector('[data-field="uiScale"]')),
            changed,
          };
        })()`);
        if (openingPreview) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.ok(openingPreview && openingPreview.mode === mode && openingPreview.clip && openingPreview.transform &&
        openingPreview.cinema === (mode === 'title' ? file === 'opening_clean.json' : null) &&
        openingPreview.changed > 50, JSON.stringify({ file, openingPreview }));
    }
    await win.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-file="opening_clean.json"]').click();
      const select = document.querySelector('[data-field="cinema"]');
      select.value = 'true';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    let changedCinema = null;
    while (Date.now() < deadline) {
      changedCinema = await win.webContents.executeJavaScript(`(() => {
        const demo = document.getElementById('presetPreviewFrame').contentWindow?.__demo;
        return demo?.STORY[0]?.mode === 'title' && demo.STORY[0].cinema === true
          ? { cinema: demo.STORY[0].cinema, hidden: demo.findNode(demo.modeRuntime.title.root, 'Panel/CinemaFrameGroup').hidden } : null;
      })()`);
      if (changedCinema) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepStrictEqual(changedCinema, { cinema: true, hidden: false });
    for (const [file, mode] of [
      ['news_anchor.json', 'newsTalk'],
      ['news_summary.json', 'newsSummary'],
      ['fullscreen_text.json', 'fullscreen'],
    ]) {
      await win.webContents.executeJavaScript(`(() => {
        document.querySelector(${JSON.stringify('[data-file="' + file + '"]')}).click();
        for (const [key, value] of [['fontSize', '70'], ['textColor', '#ff0000'], ['textOffsetX', '50']]) {
          const input = document.querySelector('[data-field="' + key + '"]');
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const duration = document.querySelector('[data-field="entryDuration"]');
        if (duration) {
          duration.value = '1';
          duration.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`);
      let result = null;
      while (Date.now() < deadline) {
        result = await win.webContents.executeJavaScript(`(() => {
          const frame = document.getElementById('presetPreviewFrame'), demo = frame.contentWindow?.__demo;
          const line = demo?.STORY[0];
          if (line?.mode !== ${JSON.stringify(mode)} || line.fontSize !== 70 || line.textColor !== '#ff0000' || line.textOffsetX !== 50) return null;
          demo.updateState(demo.state.typingStart + demo.state.typingPlan.total + 1);
          demo.drawScene(demo.state.lineStart + 3000);
          const canvas = frame.contentDocument.getElementById('view');
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let red = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (pixels[i] > 150 && pixels[i+1] < 90 && pixels[i+2] < 90) red++;
          const runtime = demo.modeRuntime[line.mode];
          const clip = runtime.clips.find(item => item.key === 'news.Entry');
          const entryScale = clip ? demo.collectOverrides(runtime, clip.start + 1000 / 6).ov.get('')?.sx : null;
          return { red, sender: line.speakerName, shadow: Boolean(document.querySelector('[data-field="shadowX"]')),
            duration: line.entryDuration ?? null, entryScale };
        })()`);
        if (result?.red > 5) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.ok(result && result.red > 5 && result.shadow === (mode !== 'fullscreen') &&
        result.sender === (mode === 'newsTalk' ? '新闻主播' : ''), JSON.stringify({ file, result }));
      if (mode === 'fullscreen') assert.strictEqual(result.duration, null);
      else assert.ok(result.duration === 1 && Math.abs(result.entryScale - 0.55) < 1e-4, JSON.stringify({ file, result }));
    }
    const newsShadow = await win.webContents.executeJavaScript(`(() => {
      const frame = document.getElementById('presetPreviewFrame'), demo = frame.contentWindow.__demo;
      demo.showPreset({ mode: 'newsTalk', text: '测试新闻', speakerName: '新闻主播', stage: [], bg: null,
        shadowColor: '#ff00ff', shadowX: 80, shadowY: 70, shadowAlpha: 0 });
      demo.updateState(demo.state.typingStart + demo.state.typingPlan.total + 1);
      const canvas = frame.contentDocument.getElementById('view'), ctx = canvas.getContext('2d');
      const now = demo.state.lineStart + 3000;
      demo.drawScene(now);
      const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      demo.STORY[0].shadowAlpha = 1;
      demo.drawScene(now);
      const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let changed = 0;
      for (let i = 0; i < before.length; i += 4)
        if (Math.abs(before[i] - after[i]) + Math.abs(before[i+1] - after[i+1]) + Math.abs(before[i+2] - after[i+2]) > 40) changed++;
      return changed;
    })()`);
    assert.ok(newsShadow > 100, `News shadow did not affect pixels: ${newsShadow}`);
    await win.webContents.executeJavaScript(`document.querySelector('[data-file="bubble_manga.json"]').click()`);
    let preview;
    while (Date.now() < deadline) {
      preview = await win.webContents.executeJavaScript(`(() => {
        const frame = document.getElementById('presetPreviewFrame');
        const demo = frame.contentWindow?.__demo;
        return demo?.state.started ? { mode: demo.STORY[0]?.mode, visible: document.getElementById('presetPreviewEmpty').classList.contains('hidden') } : null;
      })()`);
      if (preview?.visible) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepStrictEqual(preview, { mode: 'manga', visible: true }, JSON.stringify(errors));
    const bubbleFields = await win.webContents.executeJavaScript(`(() => ({
      fontSize: document.querySelector('[data-field="fontSize"]')?.value,
      typeSpeed: document.querySelector('[data-field="typeSpeed"]')?.value,
      tail: document.querySelector('[data-field="tail"]')?.value,
      purple: document.querySelector('[data-field="purple"]')?.value
    }))()`);
    assert.deepStrictEqual(bubbleFields, { fontSize: '52', typeSpeed: '1', tail: 'bl', purple: 'false' });
    await win.webContents.executeJavaScript(`(() => {
      for (const [key, value] of [['fontSize', '72'], ['textColor', '#ff0000'], ['uiX', '40']]) {
        const input = document.querySelector('[data-field="' + key + '"]');
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      for (const [key, value] of [['tail', 'tr'], ['purple', 'true']]) {
        const select = document.querySelector('[data-field="' + key + '"]');
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    let bubbleChanged = null;
    while (Date.now() < deadline) {
      bubbleChanged = await win.webContents.executeJavaScript(`(() => {
        const demo = document.getElementById('presetPreviewFrame').contentWindow?.__demo;
        const line = demo?.STORY[0];
        if (line?.fontSize !== 72 || line.textColor !== '#ff0000' || line.uiX !== 40 || line.tail !== 'tr' || line.purple !== true) return null;
        demo.updateState(demo.state.lineStart + 3000);
        demo.drawScene(demo.state.lineStart + 3000);
        const canvas = document.getElementById('presetPreviewFrame').contentDocument.getElementById('view');
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let red = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 150 && pixels[i + 1] < 90 && pixels[i + 2] < 90) red++;
        return { fontSize: line.fontSize, tail: line.tail, purple: line.purple, red };
      })()`);
      if (bubbleChanged?.red > 5) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(bubbleChanged && bubbleChanged.fontSize === 72 && bubbleChanged.tail === 'tr' && bubbleChanged.purple === true && bubbleChanged.red > 5, JSON.stringify(bubbleChanged));
    await win.webContents.executeJavaScript(`document.querySelector('[data-file="bubble_thought_purple.json"]').click()`);
    let changed;
    while (Date.now() < deadline) {
      changed = await win.webContents.executeJavaScript(`(() => {
        const demo = document.getElementById('presetPreviewFrame').contentWindow?.__demo;
        return { mode: demo?.STORY[0]?.mode, purple: demo?.STORY[0]?.purple };
      })()`);
      if (changed.purple) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepStrictEqual(changed, { mode: 'manga', purple: true });
    await win.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('[data-field="overflow"]');
      select.value = 'scroll';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    let scrollPreview = null;
    while (Date.now() < deadline) {
      scrollPreview = await win.webContents.executeJavaScript(`(() => {
        const demo = document.getElementById('presetPreviewFrame').contentWindow?.__demo;
        return demo?.STORY[0]?.overflow === 'scroll' ? {
          mode: demo.modeRuntime.manga.bubbleSize.overflow,
          longText: demo.STORY[0].text.length > 30
        } : null;
      })()`);
      if (scrollPreview) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepStrictEqual(scrollPreview, { mode: 'scroll', longText: true });
    const tails = await win.webContents.executeJavaScript(`(() => {
      const demo = document.getElementById('presetPreviewFrame').contentWindow.__demo;
      const mode = demo.modeRuntime.manga;
      return { arrowHidden: demo.findNode(mode.root, 'Base/BubbleTail/NormalTail').hidden,
        circlesHidden: demo.findNode(mode.root, 'Base/BubbleTail/ThinkingTail').hidden };
    })()`);
    assert.deepStrictEqual(tails, { arrowHidden: false, circlesHidden: true });
    await win.webContents.executeJavaScript(`document.querySelector('[data-file="typewriter_normal.json"]').click()`);
    await win.webContents.executeJavaScript(`(() => {
      for (const [key, value] of [['speed', '0.1'], ['punctuationPause', '0.5'], ['typeSpeed', '2']]) {
        const input = document.querySelector('[data-field="' + key + '"]');
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    let typingPreview = null;
    while (Date.now() < deadline) {
      typingPreview = await win.webContents.executeJavaScript(`(() => {
        const demo = document.getElementById('presetPreviewFrame').contentWindow?.__demo;
        if (demo?.STORY[0]?.speed !== 0.1 || demo.STORY[0].punctuationPause !== 0.5 || demo.STORY[0].typeSpeed !== 2) return null;
        return { text: demo.STORY[0].text, firstInterval: demo.state.typingPlan.times[1],
          punctuationInterval: demo.state.typingPlan.times[4] - demo.state.typingPlan.times[3] };
      })()`);
      if (typingPreview) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepStrictEqual(typingPreview, { text: '雨停了，末班车到了。', firstInterval: 50, punctuationInterval: 550 });
    for (const [file, mode, shadow] of [
      ['narration_story.json', 'narration', false],
      ['sfx_sound.json', 'sfx', true],
      ['anime_caption.json', 'anime', false],
    ]) {
      await win.webContents.executeJavaScript(`document.querySelector(${JSON.stringify('[data-file="' + file + '"]')}).click()`);
      let special = null;
      while (Date.now() < deadline) {
        special = await win.webContents.executeJavaScript(`(() => {
          const demo = document.getElementById('presetPreviewFrame').contentWindow?.__demo;
          return demo?.STORY[0]?.mode === ${JSON.stringify(mode)} ? {
            mode: demo.STORY[0].mode, visible: demo.modeRuntime[${JSON.stringify(mode)}].visible,
            shadow: Boolean(document.querySelector('[data-field="shadowX"]'))
          } : null;
        })()`);
        if (special) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.deepStrictEqual(special, { mode, visible: true, shadow }, file);
    }
    for (const [file, variant] of [
      ['dialogue_normal_noname.json', 'normalNoName'],
      ['dialogue_cloud_name.json', 'cloudName'],
      ['dialogue_blast_noname.json', 'blastNoName'],
    ]) {
      await win.webContents.executeJavaScript(`document.querySelector(${JSON.stringify('[data-file="' + file + '"]')}).click()`);
      let actual = null;
      while (Date.now() < deadline) {
        actual = await win.webContents.executeJavaScript(`document.getElementById('presetPreviewFrame').contentWindow?.__demo?.STORY[0]?.dialogueVariant`);
        if (actual === variant) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.strictEqual(actual, variant, file);
    }
    await win.webContents.executeJavaScript(`document.querySelector('[data-file="move_run_in.json"]').click()`);
    let movePreview = null;
    while (Date.now() < deadline) {
      movePreview = await win.webContents.executeJavaScript(`(() => {
        const demo = document.getElementById('presetPreviewFrame').contentWindow?.__demo;
        return { mode: demo?.STORY[0]?.mode, from: demo?.STORY[0]?.actions?.[0]?.from,
          visible: document.getElementById('presetPreviewEmpty').classList.contains('hidden'),
          direction: Boolean(document.querySelector('[data-field="from"]')),
          scaleField: Boolean(document.querySelector('[data-field="scaleX"]')) };
      })()`);
      if (movePreview.mode === 'preview-move' && movePreview.visible) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepStrictEqual(movePreview, { mode: 'preview-move', from: -320, visible: true, direction: true, scaleField: false });
    await win.webContents.executeJavaScript(`(() => {
      const direction = document.querySelector('[data-field="from"]');
      direction.value = 'right';
      direction.dispatchEvent(new Event('change', { bubbles: true }));
      const duration = document.querySelector('[data-field="duration"]');
      duration.value = '0.4';
      duration.dispatchEvent(new Event('input', { bubbles: true }));
      const ease = document.querySelector('[data-field="ease"]');
      ease.value = 'Linear';
      ease.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    let moved = null;
    while (Date.now() < deadline) {
      moved = await win.webContents.executeJavaScript(`(() => {
        const demo = document.getElementById('presetPreviewFrame').contentWindow?.__demo;
        const action = demo?.STORY[0]?.actions?.[0];
        if (!action || action.from !== 2240 || action.duration !== 0.4 || action.ease !== 'Linear') return null;
        demo.drawScene(demo.state.lineStart + 200);
        const midpoint = demo.stageImages.get('preset_motion')?.x;
        const canvas = document.getElementById('presetPreviewFrame').contentDocument.getElementById('view');
        const context = canvas.getContext('2d');
        const first = context.getImageData(0, 0, canvas.width, canvas.height).data;
        demo.drawScene(demo.state.lineStart + 400);
        const last = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let changed = 0;
        for (let i = 0; i < first.length; i += 4)
          if (Math.abs(first[i] - last[i]) + Math.abs(first[i+1] - last[i+1]) + Math.abs(first[i+2] - last[i+2]) > 30) changed++;
        return { midpoint, end: demo.stageImages.get('preset_motion')?.x, changed };
      })()`);
      if (moved?.changed > 100) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(moved && Math.abs(moved.midpoint - 1600) < 0.01 && Math.abs(moved.end - 960) < 0.01 && moved.changed > 100, JSON.stringify(moved));
    await win.webContents.executeJavaScript(`document.querySelector('[data-file="move_stretch.json"]').click()`);
    let stretched = null;
    while (Date.now() < deadline) {
      stretched = await win.webContents.executeJavaScript(`(() => {
        const demo = document.getElementById('presetPreviewFrame').contentWindow?.__demo;
        const actions = demo?.STORY[0]?.actions;
        if (!actions?.some(action => action.property === 'sx')) return null;
        return { direction: Boolean(document.querySelector('[data-field="from"]')),
          scale: Boolean(document.querySelector('[data-field="scaleX"]')), target: actions.find(action => action.property === 'sx').to };
      })()`);
      if (stretched) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepStrictEqual(stretched, { direction: false, scale: true, target: 1.08 });
    await win.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-itab="stage"]').click();
      const select = document.getElementById('stageLineSelect');
      select.value = '0';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const input = document.querySelector('[data-stage-key="width"]');
      if (!input) throw new Error('UI width field missing');
      input.value = '800';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    while (Date.now() < deadline && !source.includes('size 800,320')) await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(source.includes('ui show bubble frame at 200,300 size 800,320'), source);
    assert.deepStrictEqual(compileSource(source).diagnostics, []);
    const style = await win.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('[data-stage-key="style"]');
      if (!select) throw new Error('UI style control missing');
      select.value = 'thought';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select.value;
    })()`);
    assert.strictEqual(style, 'thought');
    while (Date.now() < deadline && !source.includes('style thought')) await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(source.includes('style thought'), source);
    assert.deepStrictEqual(compileSource(source).diagnostics, []);
    await win.webContents.executeJavaScript(`(() => {
      monaco.editor.getModels()[0].setValue([
        'ui show bubble parent at 100,200',
        'ui show bubble frame preset "独立漫画气泡" sx 0.5 scale 2 at 200,300 # 保留注释',
        'ui bind frame to parent offset 20,30',
        'ui present'
      ].join('\\n'));
      document.getElementById('checkBtn').click();
    })()`);
    const uiEditDeadline = Date.now() + 10000;
    while (Date.now() < uiEditDeadline &&
      !await win.webContents.executeJavaScript('window.__studio.story?.lines[1]?.operation?.node?.id === "frame"')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await win.webContents.executeJavaScript(`(() => {
      const select = document.getElementById('stageLineSelect');
      select.value = '1'; select.dispatchEvent(new Event('change', { bubbles: true }));
      const input = document.querySelector('[data-stage-key="sx"]');
      input.value = '0.75'; input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    while (Date.now() < uiEditDeadline && !source.includes('sx 0.75 # 保留注释')) await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(source.includes('scale 2 at 200,300 sx 0.75 # 保留注释'), source);
    let editedUi = compileSource(source);
    assert.deepStrictEqual(editedUi.diagnostics.filter(item => item.severity === 'error'), []);
    assert.deepStrictEqual([editedUi.story.lines[1].operation.node.sx, editedUi.story.lines[1].operation.node.sy], [0.75, 2]);
    assert.deepStrictEqual([editedUi.story.lines[2].operation.x, editedUi.story.lines[2].operation.y], [20, 30]);
    assert.ok(await win.webContents.executeJavaScript('document.getElementById("stageFields").textContent.includes("ui bind")'));
    await win.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('[data-stage-key="height"]');
      input.value = '901'; input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.ok(!source.includes('size 760,901'), source);
    assert.ok(await win.webContents.executeJavaScript('document.getElementById("modeStatus").textContent.includes("最大高度")'));
    await win.webContents.executeJavaScript(`(() => {
      monaco.editor.getModels()[0].setValue('ui show text words color "#112233" # 文字颜色\\nui write words "测试"\\nui present');
      document.getElementById('checkBtn').click();
    })()`);
    while (Date.now() < uiEditDeadline &&
      !await win.webContents.executeJavaScript('window.__studio.story?.lines[0]?.operation?.node?.id === "words"')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await win.webContents.executeJavaScript(`(() => {
      const select = document.getElementById('stageLineSelect');
      select.value = '0'; select.dispatchEvent(new Event('change', { bubbles: true }));
      const color = document.querySelector('[data-stage-key="color"]');
      color.value = '#aabbcc'; color.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    while (Date.now() < uiEditDeadline && !source.includes('color "#aabbcc" # 文字颜色')) await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(source.includes('color "#aabbcc" # 文字颜色'), source);
    editedUi = compileSource(source);
    assert.deepStrictEqual(editedUi.diagnostics.filter(item => item.severity === 'error'), []);
    assert.strictEqual(editedUi.story.lines[0].operation.node.color, '#aabbcc');
    await win.webContents.executeJavaScript(`(() => {
      monaco.editor.getModels()[0].setValue('错误的旧检查');
      document.getElementById('checkBtn').click();
    })()`);
    await new Promise(resolve => setTimeout(resolve, 80));
    await win.webContents.executeJavaScript(`(() => {
      monaco.editor.getModels()[0].setValue('narration "新检查"');
      document.getElementById('checkBtn').click();
    })()`);
    await new Promise(resolve => setTimeout(resolve, 1100));
    const latest = await win.webContents.executeJavaScript(`(() => ({
      text: window.__studio.story.lines[0]?.text,
      status: document.getElementById('diagStatus').textContent,
      dirty: document.getElementById('saveState').textContent,
      source: monaco.editor.getModels()[0].getValue()
    }))()`);
    assert.deepStrictEqual(latest, { text: '新检查', status: '0 个错误', dirty: '未保存', source: 'narration "新检查"' });
    assert.ok(source.includes('color "#aabbcc" # 文字颜色'), 'background check must not save source');
    await win.webContents.executeJavaScript(`(() => {
      monaco.editor.getModels()[0].setValue([
        'define ner = Spine("assets/spine/standing/ner")', 'define emoticon = Spine("assets/spine/emoticon")', 'parallel:', '  camera zoom 1 -> 2 in 2s ease Linear',
        '  effect brightness 1 -> 0.5 in 1s ease Linear',
        '  after 1.5s:', '    effect saturation 0.8',
        '  after 0.5s:', '    say ner normal "测试"',
        '  after 0.75s:', '    oneshot spine emoticon anim Idea at 960,560 scale 0.8'
      ].join('\\n'));
      document.getElementById('checkBtn').click();
      document.querySelector('[data-itab="timeline"]').click();
    })()`);
    let timeline = null;
    const timelineDeadline = Date.now() + 10000;
    while (Date.now() < timelineDeadline) {
      timeline = await win.webContents.executeJavaScript(`(() => ({
        labels: [...document.querySelectorAll('#timelineTracks .timeline-label')].map(node => node.textContent),
        range: document.getElementById('timelineRange').textContent,
        events: document.querySelectorAll('#timelineTracks .timeline-bar.event').length
      }))()`);
      if (timeline.labels.includes('效果 · brightness') && timeline.labels.includes('镜头 · zoom') && timeline.labels.includes('一次性表情 · Idea')) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(timeline.labels.includes('效果 · brightness') && timeline.labels.includes('镜头 · zoom') &&
      timeline.labels.includes('效果设置') && timeline.labels.includes('台词出现') &&
      timeline.labels.includes('一次性表情 · Idea') && timeline.events === 3 && timeline.range === '2.00s', JSON.stringify(timeline));
    await win.webContents.executeJavaScript(`(() => {
      monaco.editor.getModels()[0].setValue([
        'parallel:', '  ui present', '  after 500ms:',
        '    ui show text words', '    ui write words "延时文字"',
        '    ui move words x by 50 in 1s'
      ].join('\\n'));
      document.getElementById('checkBtn').click();
      document.querySelector('[data-itab="timeline"]').click();
    })()`);
    let uiTimeline = null;
    const uiTimelineDeadline = Date.now() + 10000;
    while (Date.now() < uiTimelineDeadline) {
      uiTimeline = await win.webContents.executeJavaScript(`(() => ({
        labels: [...document.querySelectorAll('#timelineTracks .timeline-label')].map(node => node.textContent),
        events: [...document.querySelectorAll('#timelineTracks .timeline-bar.event')].map(node => node.textContent),
        range: document.getElementById('timelineRange').textContent
      }))()`);
      if (uiTimeline.labels.includes('UI · words') && uiTimeline.labels.includes('UI · words · x') &&
          uiTimeline.events.includes('create') && uiTimeline.events.includes('set')) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(uiTimeline.labels.includes('UI · words') && uiTimeline.labels.includes('UI · words · x') &&
      uiTimeline.events.includes('create') && uiTimeline.events.includes('set') &&
      uiTimeline.range === '1.50s', JSON.stringify(uiTimeline));
    await win.webContents.executeJavaScript(`(() => {
      monaco.editor.getModels()[0].setValue([
        'image station = "assets/bg/elf_city_night.png"',
        'parallel:',
        '  scene bg station in 500ms ease Linear',
        '  wait 500ms',
        'narration "背景渐变时间轴"',
      ].join('\\n'));
      document.getElementById('checkBtn').click();
      document.querySelector('[data-itab="timeline"]').click();
    })()`);
    let sceneFadeTimeline = null;
    const sceneFadeTimelineDeadline = Date.now() + 10000;
    while (Date.now() < sceneFadeTimelineDeadline) {
      sceneFadeTimeline = await win.webContents.executeJavaScript(`(() => ({
        range: document.getElementById('timelineRange').textContent,
        labels: [...document.querySelectorAll('#timelineTracks .timeline-label')].map(node => node.textContent),
        bars: [...document.querySelectorAll('#timelineTracks .timeline-bar')].map(node => ({
          width: node.style.width, title: node.title, event: node.classList.contains('event')
        }))
      }))()`);
      if (sceneFadeTimeline.labels.includes('背景渐变') && sceneFadeTimeline.range === '0.50s') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(sceneFadeTimeline.labels.includes('背景渐变') &&
      sceneFadeTimeline.bars.some(bar => bar.width === '100%' && bar.title.includes('持续 0.5s') && bar.event),
    JSON.stringify(sceneFadeTimeline));
    await win.webContents.executeJavaScript(`document.getElementById('runBtn').click()`);
    const previewDeadline = Date.now() + 10000;
    let previewReady = false;
    while (Date.now() < previewDeadline) {
      previewReady = await win.webContents.executeJavaScript(`(() => {
        const frame = document.getElementById('previewFrame');
        const demo = frame.contentWindow?.__demo;
        return Boolean(demo?.state?.started && demo.STORY?.length && frame.contentDocument?.getElementById('view'));
      })()`);
      if (previewReady) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(previewReady, 'story preview did not load');
    await win.webContents.executeJavaScript(`(() => {
      document.querySelector('.tab[data-tab="preview"]').click();
      document.querySelector('.itab[data-itab="preset"]').click();
    })()`);
    await new Promise(resolve => setTimeout(resolve, 250));
    const renderingProbe = await win.webContents.executeJavaScript(`(() => {
      const preview = document.getElementById('previewFrame').contentWindow.__demo;
      const preset = document.getElementById('presetPreviewFrame').contentWindow.__demo;
      if (!preview || !preset) return null;
      return { preview: preview.state.renderCount, preset: preset.state.renderCount,
        previewUpdates: preview.state.updateCount, presetUpdates: preset.state.updateCount };
    })()`);
    assert.ok(renderingProbe, 'preview runtimes must be available');
    await win.webContents.executeJavaScript(`(() => {
      const now = performance.now();
      for (let i = 1; i <= 12; i++) {
        document.getElementById('previewFrame').contentWindow.__demo.tick(now + i * 16);
        document.getElementById('presetPreviewFrame').contentWindow.__demo.tick(now + i * 16);
      }
    })()`);
    const visibleRendering = await win.webContents.executeJavaScript(`(() => ({
      preview: document.getElementById('previewFrame').contentWindow.__demo.state.renderCount,
      preset: document.getElementById('presetPreviewFrame').contentWindow.__demo.state.renderCount,
      previewEnabled: document.getElementById('previewFrame').contentWindow.__demo.state.renderingEnabled,
      presetEnabled: document.getElementById('presetPreviewFrame').contentWindow.__demo.state.renderingEnabled
    }))()`);
    assert.ok(visibleRendering.preview > renderingProbe.preview && visibleRendering.preset > renderingProbe.preset, JSON.stringify({ renderingProbe, visibleRendering }));
    await win.webContents.executeJavaScript(`(() => {
      document.querySelector('.tab[data-tab="code"]').click();
      document.querySelector('.itab[data-itab="diagnostics"]').click();
    })()`);
    const hiddenStart = await win.webContents.executeJavaScript(`(() => ({
      preview: document.getElementById('previewFrame').contentWindow.__demo.state.renderCount,
      preset: document.getElementById('presetPreviewFrame').contentWindow.__demo.state.renderCount,
      previewUpdates: document.getElementById('previewFrame').contentWindow.__demo.state.updateCount,
      presetUpdates: document.getElementById('presetPreviewFrame').contentWindow.__demo.state.updateCount
    }))()`);
    await win.webContents.executeJavaScript(`(() => {
      const now = performance.now();
      for (let i = 1; i <= 12; i++) {
        document.getElementById('previewFrame').contentWindow.__demo.tick(now + i * 16);
        document.getElementById('presetPreviewFrame').contentWindow.__demo.tick(now + i * 16);
      }
    })()`);
    const hiddenRendering = await win.webContents.executeJavaScript(`(() => ({
      preview: document.getElementById('previewFrame').contentWindow.__demo.state.renderCount,
      preset: document.getElementById('presetPreviewFrame').contentWindow.__demo.state.renderCount,
      previewUpdates: document.getElementById('previewFrame').contentWindow.__demo.state.updateCount,
      presetUpdates: document.getElementById('presetPreviewFrame').contentWindow.__demo.state.updateCount,
      previewEnabled: document.getElementById('previewFrame').contentWindow.__demo.state.renderingEnabled,
      presetEnabled: document.getElementById('presetPreviewFrame').contentWindow.__demo.state.renderingEnabled
    }))()`);
    assert.strictEqual(hiddenRendering.preview, hiddenStart.preview);
    assert.strictEqual(hiddenRendering.preset, hiddenStart.preset);
    assert.ok(hiddenRendering.previewUpdates > hiddenStart.previewUpdates && hiddenRendering.presetUpdates > hiddenStart.presetUpdates, JSON.stringify({ hiddenStart, hiddenRendering }));
    assert.strictEqual(hiddenRendering.previewEnabled, false);
    assert.strictEqual(hiddenRendering.presetEnabled, false);
    await win.webContents.executeJavaScript(`(() => {
      document.querySelector('.tab[data-tab="preview"]').click();
      document.querySelector('.itab[data-itab="preset"]').click();
    })()`);
    await new Promise(resolve => setTimeout(resolve, 250));
    const visibleAgain = await win.webContents.executeJavaScript(`(() => ({
      preview: document.getElementById('previewFrame').contentWindow.__demo.state.renderingEnabled,
      preset: document.getElementById('presetPreviewFrame').contentWindow.__demo.state.renderingEnabled
    }))()`);
    assert.deepStrictEqual(visibleAgain, { preview: true, preset: true });
    await win.webContents.executeJavaScript(`(() => {
      monaco.editor.getModels()[0].setValue('narration "' + '隐藏预览仍然推进打字。'.repeat(40) + '"');
      document.getElementById('runBtn').click();
    })()`);
    const typingDeadline = Date.now() + 10000;
    let typingProbe = null;
    while (Date.now() < typingDeadline) {
      typingProbe = await win.webContents.executeJavaScript(`(() => {
        const demo = document.getElementById('previewFrame').contentWindow?.__demo;
        if (!demo?.state.started || demo.STORY[0]?.mode !== 'narration') return null;
        const m = demo.modeRuntime.narration;
        return { reveal: m?.reveal || 0, total: demo.state.typingPlan?.charCount || 0 };
      })()`);
      if (typingProbe && typingProbe.total > 100) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(typingProbe && typingProbe.total > 100, JSON.stringify(typingProbe));
    await win.webContents.executeJavaScript(`(() => {
      document.querySelector('.tab[data-tab="code"]').click();
      document.querySelector('.itab[data-itab="diagnostics"]').click();
    })()`);
    const typingBefore = await win.webContents.executeJavaScript(`document.getElementById('previewFrame').contentWindow.__demo.modeRuntime.narration.reveal`);
    await win.webContents.executeJavaScript(`(() => {
      const demo = document.getElementById('previewFrame').contentWindow.__demo;
      const now = performance.now();
      for (let i = 1; i <= 20; i++) demo.tick(now + i * 40);
    })()`);
    const typingAfter = await win.webContents.executeJavaScript(`document.getElementById('previewFrame').contentWindow.__demo.modeRuntime.narration.reveal`);
    assert.ok(typingAfter > typingBefore, JSON.stringify({ typingBefore, typingAfter }));
    const indexProbe = await win.webContents.executeJavaScript(`(() => {
      const lines = Array.from({ length: 5000 }, (_, i) => 'narration "第 ' + i + ' 行"');
      const model = monaco.editor.getModels()[0];
      model.setValue(lines.join('\\n'));
      document.getElementById('checkBtn').click();
      return true;
    })()`);
    assert.strictEqual(indexProbe, true);
    const indexDeadline = Date.now() + 10000;
    let indexReady = false;
    while (Date.now() < indexDeadline) {
      indexReady = await win.webContents.executeJavaScript('window.__studio.story?.lines?.length === 5000');
      if (indexReady) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(indexReady, 'large story did not compile');
    const cursorProbe = await win.webContents.executeJavaScript(`(() => {
      const story = window.__studio.story;
      let calls = 0;
      const original = story.lines.findIndex;
      story.lines.findIndex = function(...args) { calls++; return original.apply(this, args); };
      const codeEditor = monaco.editor.getEditors()[0];
      for (const lineNumber of [5000, 4999, 5000, 4999, 5000]) {
        codeEditor.setPosition({ lineNumber, column: 1 });
      }
      const result = { calls, stageIndex: window.__studio.stageIndex };
      story.lines.findIndex = original;
      return result;
    })()`);
    assert.deepStrictEqual(cursorProbe, { calls: 0, stageIndex: 4999 });
    await win.webContents.executeJavaScript(`document.getElementById('previewFrame').contentWindow.eval(
      'parent.postMessage({type:"trickcal:warning",line:2,message:"测试 shader 兼容警告"},location.origin)'
    )`);
    const warningDeadline = Date.now() + 3000;
    let editorWarning = '';
    while (Date.now() < warningDeadline) {
      editorWarning = await win.webContents.executeJavaScript(`document.getElementById('diagnosticsList').textContent`);
      if (editorWarning.includes('测试 shader 兼容警告')) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(editorWarning.includes('运行时警告：测试 shader 兼容警告'), editorWarning);
    const presetIndent = await win.webContents.executeJavaScript(`(() => {
      const item = document.querySelector('.preset-item[data-file="dialogue_normal.json"]');
      if (!item) throw new Error('Dialogue preset missing from editor');
      item.click();
      const model = monaco.editor.getModels()[0];
      const codeEditor = monaco.editor.getEditors()[0];
      model.setValue('parallel:\\n  \\n');
      codeEditor.setPosition({ lineNumber: 2, column: 3 });
      document.getElementById('applyPreset').click();
      return model.getValue();
    })()`);
    assert.ok(presetIndent.startsWith('parallel:\n  preset "普通对话框" '), presetIndent);
    assert.ok(presetIndent.includes('fontSize ') && presetIndent.includes('textColor "') && presetIndent.includes('shadowX '), presetIndent);
    assert.deepStrictEqual(compileSource('define ner = Spine("assets/spine/standing/ner")\n' + presetIndent + '  ner normal "测试"\n').diagnostics.filter(item => item.severity === 'error'), []);
    const insertedBubble = await win.webContents.executeJavaScript(`(() => {
      document.querySelector('.preset-item[data-file="bubble_thought_purple.json"]').click();
      const tail = document.querySelector('#presetFields [data-field="tail"]');
      tail.value = 'tr'; tail.dispatchEvent(new Event('change'));
      const model = monaco.editor.getModels()[0], codeEditor = monaco.editor.getEditors()[0];
      model.setValue('ner manga "测试"\\n');
      codeEditor.setPosition({ lineNumber: 1, column: 1 });
      document.getElementById('applyPreset').click();
      return model.getValue();
    })()`);
    assert.ok(insertedBubble.includes('tail tr') && insertedBubble.includes('purple true') && insertedBubble.includes('overflow '), insertedBubble);
    assert.deepStrictEqual(compileSource('define ner = Spine("assets/spine/standing/ner")\n' + insertedBubble).diagnostics.filter(item => item.severity === 'error'), []);
    const allInserted = await win.webContents.executeJavaScript(`(() => {
      const model = monaco.editor.getModels()[0], codeEditor = monaco.editor.getEditors()[0];
      return [...document.querySelectorAll('.preset-item')].map(item => {
        const file = item.dataset.file;
        item.click();
        model.setValue('define ner = Spine("assets/spine/standing/ner")\\nshow ner\\n');
        codeEditor.setPosition({ lineNumber: 3, column: 1 });
        document.getElementById('applyPreset').click();
        return { file, source: model.getValue() };
      });
    })()`);
    for (const item of allInserted) {
      const preset = presets.find(entry => entry.file === item.file);
      const next = { bubble: 'ner manga "测试"', dialogue: 'ner normal "测试"', typewriter: 'ner normal "测试"',
        opening: 'opening 1 "测试" hold 0', location: 'location "测试" hold 0',
        transition: 'transition', news: 'news anchor "测试"', fullscreen: 'fullscreen "测试"', move: 'ner normal "测试"' }[preset.type];
      assert.ok(next, item.file);
      const checked = compileSource(item.source + next + '\n');
      assert.deepStrictEqual(checked.diagnostics.filter(entry => entry.severity === 'error'), [], item.file + ': ' + JSON.stringify(checked.diagnostics));
    }
    await win.webContents.executeJavaScript(`(() => {
      monaco.editor.getModels()[0].setValue('define ner = Spine("assets/spine/standing/ner")\\njump target\\nshow ner at left\\nlabel target:\\nner normal "继续"');
      document.getElementById('checkBtn').click();
    })()`);
    const syncDeadline = Date.now() + 10000;
    while (Date.now() < syncDeadline &&
      !await win.webContents.executeJavaScript('Boolean(window.__studio.story?.lines.some(line => line.mode === "stage-sync"))')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const syncPanel = await win.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-itab="stage"]').click();
      const index = window.__studio.story.lines.findIndex(line => line.mode === 'stage-sync');
      const select = document.getElementById('stageLineSelect');
      select.value = String(index);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return { index, label: select.selectedOptions[0]?.textContent,
        name: document.getElementById('stageLineName').textContent,
        objects: document.getElementById('stageObjects').textContent };
    })()`);
    assert.ok(syncPanel.index >= 0 && syncPanel.label.includes('状态更新') && syncPanel.name === '状态更新' &&
      !syncPanel.objects.includes('当前对话'), JSON.stringify(syncPanel));
    assert.deepStrictEqual(errors, []);
    console.log('editor.electron.js: ok');
  } catch (error) {
    console.error(error);
    failed = true;
  } finally {
    server.close();
    if (win) win.destroy();
    app.exit(failed ? 1 : 0);
  }
}).catch(error => { console.error(error); app.exit(1); });
