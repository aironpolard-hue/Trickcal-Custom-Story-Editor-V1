'use strict';

const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const { compile } = require('../compiler/trickcal');

const root = path.resolve(__dirname, '..');
const manual = path.join(root, 'docs', 'manual');
const output = path.join(root, '.tmp', 'manual');
fs.mkdirSync(path.join(output, 'user-data'), { recursive: true });
app.setPath('userData', path.join(output, 'user-data'));
const project = path.join(root, 'templates', 'minimal-demo');
const manifest = JSON.parse(fs.readFileSync(path.join(project, 'trickcal.project.json'), 'utf8'));
const source = fs.readFileSync(path.join(project, manifest.entry), 'utf8');
const presets = fs.readdirSync(path.join(project, 'presets')).filter(file => file.endsWith('.json')).map(file => ({
  file, ...JSON.parse(fs.readFileSync(path.join(project, 'presets', file), 'utf8')),
}));
const options = { ...manifest, projectRoot: project, presets };
const previousClipboard = clipboard.readText();
app.on('window-all-closed', () => {});
const fixture = [
  'image ner_avatar = "assets/herohead/ner.png"',
  'image erpin_avatar = "assets/herohead/erpin.png"',
  'image station = "assets/bg/elf_city_night.png"',
  'image hall = "assets/bg/elf_arthall_night.png"',
  'define ner = Spine("assets/spine/standing/ner", name="尼尔", avatar=ner_avatar)',
  'define erpin = Spine("assets/spine/standing/erpin", name="埃尔芬", avatar=erpin_avatar)',
  'define emoticon = Spine("assets/spine/emoticon")',
  'define audio.rain = "assets/audio/silent.wav"',
];

async function waitFor(check, message, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  throw new Error(message);
}

app.whenReady().then(async () => {
  const watchdog = setTimeout(() => { console.error('Manual test exceeded 90 seconds'); app.exit(1); }, 90000);
  fs.mkdirSync(output, { recursive: true });
  let win;
  let server;
  let failed = false;
  const errors = [];
  const snippets = [];
  try {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(manual, 'content.js'), 'utf8'), sandbox);
    const pages = sandbox.window.TRICKCAL_MANUAL;
    assert.ok(pages.length >= 20);
    assert.strictEqual(new Set(pages.map(page => page.id)).size, pages.length);
    const pageIds = new Set(pages.map(page => page.id));
    let helpOpened = 0;
    ipcMain.handle('help:open', () => { helpOpened++; });
    ipcMain.handle('project:read', () => ({ projectPath: project, manifest, source, presets }));
    ipcMain.handle('project:presets', () => presets);
    ipcMain.handle('project:assets', () => []);
    ipcMain.handle('project:compile', (_, payload) => compile(payload.source, options));
    ipcMain.handle('app:bootstrap', () => ({ version: '0.1.0', recent: [], projectsDir: project }));

    server = http.createServer((req, res) => {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      const prefix = ['/editor/', '/launcher/', '/monaco/'].find(item => pathname.startsWith(item));
      if (!prefix) { res.writeHead(404); res.end(); return; }
      const base = prefix === '/monaco/' ? path.join(root, 'node_modules', 'monaco-editor', 'min') : path.join(root, prefix.slice(1, -1));
      const file = path.resolve(base, decodeURIComponent(pathname.slice(prefix.length)));
      if (!file.startsWith(base + path.sep)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, (error, data) => {
        if (error) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf' }[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    win = new BrowserWindow({
      show: false, width: 1560, height: 980, useContentSize: true,
      webPreferences: { preload: path.join(root, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false },
    });
    await win.loadURL(`${baseUrl}/editor/index.html?project=${encodeURIComponent(project)}`);
    await waitFor(() => win.webContents.executeJavaScript('Boolean(window.__studio?.story && document.getElementById("editorLoading").classList.contains("hidden"))'), 'Editor did not load');
    await win.webContents.executeJavaScript('document.fonts.ready');
    await win.webContents.executeJavaScript('document.getElementById("helpBtn").click()');
    await waitFor(() => helpOpened === 1, 'Editor help did not invoke IPC');
    if (process.env.TRICKCAL_MANUAL_CAPTURE === '1') {
      const screenshot = await win.webContents.capturePage();
      fs.writeFileSync(path.join(manual, 'assets', 'editor-overview.png'), screenshot.toPNG());
    }
    await win.loadURL(`${baseUrl}/launcher/index.html`);
    await win.webContents.executeJavaScript('document.getElementById("helpBtn").click()');
    await waitFor(() => helpOpened === 2, 'Launcher help did not invoke IPC');
    win.destroy();

    win = new BrowserWindow({
      show: false, width: 1440, height: 980, useContentSize: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: true },
    });
    win.webContents.on('console-message', event => {
      if (event.level === 'error') errors.push(event.message);
    });
    await win.loadFile(path.join(manual, 'index.html'));
    await waitFor(() => win.webContents.executeJavaScript('Boolean(document.querySelector("#article h1") && document.querySelector("svg.lucide"))'), 'Manual did not load');
    await win.webContents.executeJavaScript('document.fonts.ready');
    for (const page of pages) {
      await win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(page.id)}`);
      await waitFor(() => win.webContents.executeJavaScript(`document.querySelector('#article h1')?.textContent === ${JSON.stringify(page.title)}`), `Could not navigate to ${page.id}`);
      const content = await win.webContents.executeJavaScript(`({
        codes: [...document.querySelectorAll('#article pre code')].map(node => ({ check: node.dataset.check, source: node.textContent })),
        links: [...document.querySelectorAll('#article a[href^="#"]')].map(node => node.getAttribute('href')),
        images: [...document.querySelectorAll('#article img')].map(node => ({ src: node.src, loaded: node.complete && node.naturalWidth > 0 })),
        active: document.querySelectorAll('#navigation [aria-current="page"]').length
      })`);
      assert.strictEqual(content.active, 1, page.id);
      for (const href of content.links) assert.ok(pageIds.has(href.slice(1).split('/')[0]), `${page.id}: broken link ${href}`);
      for (const image of content.images) {
        await waitFor(() => win.webContents.executeJavaScript(`Boolean([...document.images].find(img => img.src === ${JSON.stringify(image.src)})?.naturalWidth)`), `Missing image ${image.src}`);
      }
      for (const snippet of content.codes) {
        if (snippet.check === 'none') continue;
        let checkedSource = snippet.source;
        if (snippet.check === 'scene') {
          const names = [...checkedSource.matchAll(/^\s*(?:image\s+|define\s+(?:audio\.)?)([A-Za-z_][\w.-]*)\s*=/gm)].map(match => match[1]);
          const declarations = fixture.filter(line => !names.includes(line.match(/^(?:image\s+|define\s+(?:audio\.)?)([A-Za-z_][\w.-]*)/)[1]));
          checkedSource = `${declarations.join('\n')}\nscene bg station\nshow ner at left pose Idle_1\nshow erpin at right pose Idle_1\n${checkedSource}`;
        }
        const result = compile(checkedSource, options);
        const diagnostics = result.diagnostics.filter(item => item.severity === 'error');
        snippets.push({ page: page.id, check: snippet.check, errors: diagnostics });
        assert.deepStrictEqual(diagnostics, [], `${page.id}\n${snippet.source}\n${JSON.stringify(diagnostics)}`);
      }
    }
    fs.writeFileSync(path.join(output, 'examples.json'), JSON.stringify(snippets, null, 2));

    await win.webContents.executeJavaScript(`location.hash = 'start'`);
    await waitFor(() => win.webContents.executeJavaScript('document.querySelector("#article h1").textContent === "第一次使用"'), 'Start navigation failed');
    await win.webContents.executeJavaScript(`document.getElementById('search').value = 'fadeOut'; document.getElementById('search').dispatchEvent(new Event('input'))`);
    assert.ok(await win.webContents.executeJavaScript(`document.querySelector('#navigation a[href="#audio"]') !== null`), 'Full-text command search failed');
    await win.webContents.executeJavaScript(`document.getElementById('search').value = '完全没有这个词xyz'; document.getElementById('search').dispatchEvent(new Event('input'))`);
    assert.ok(await win.webContents.executeJavaScript('Boolean(document.querySelector(".no-results"))'), 'Empty search state missing');
    await win.webContents.executeJavaScript(`document.getElementById('search').value = ''; document.getElementById('search').dispatchEvent(new Event('input'))`);
    await win.webContents.executeJavaScript('document.querySelector(".copy-code").click()', true);
    await waitFor(() => clipboard.readText().startsWith('scene bg black'), 'Copy code did not update clipboard');

    await win.webContents.executeJavaScript('document.getElementById("themeButton").click()');
    assert.strictEqual(await win.webContents.executeJavaScript('document.documentElement.dataset.theme'), 'dark');
    await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const darkScreenshot = await win.webContents.capturePage();
    const darkPixel = darkScreenshot.toBitmap();
    assert.ok(darkPixel[0] < 70 && darkPixel[3] === 255, 'Dark theme screenshot did not paint');
    fs.writeFileSync(path.join(output, 'desktop-dark.png'), darkScreenshot.toPNG());
    await win.reload();
    await waitFor(() => win.webContents.executeJavaScript('document.documentElement.dataset.theme === "dark" && Boolean(document.querySelector("#article h1"))'), 'Theme persistence failed');
    await win.webContents.executeJavaScript('document.getElementById("themeButton").click()');

    const layouts = [];
    win.webContents.debugger.attach('1.3');
    for (const width of [1440, 1024, 768, 375]) {
      await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width, height: 980, deviceScaleFactor: 1, mobile: false });
      await waitFor(() => win.webContents.executeJavaScript(`innerWidth === ${width}`), `Viewport did not resize to ${width}`);
      for (const id of ['start', 'commands', 'cases-stage', 'android']) {
        await win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(id)}`);
        await waitFor(() => win.webContents.executeJavaScript(`Boolean(document.querySelector('#navigation a[href="#${id}"][aria-current="page"]'))`), `Layout navigation ${id}`);
        await new Promise(resolve => setTimeout(resolve, 80));
        const layout = await win.webContents.executeJavaScript(`({
          width: innerWidth, scroll: document.documentElement.scrollWidth,
          article: document.getElementById('article').getBoundingClientRect().width,
          badButtons: [...document.querySelectorAll('button')].filter(node => node.offsetWidth && node.scrollWidth > node.clientWidth + 2).map(node => node.id || node.className)
        })`);
        layouts.push({ id, ...layout });
        assert.ok(layout.scroll <= width + 1, `${id}: overflow at ${width}, ${JSON.stringify(layout)}`);
        assert.deepStrictEqual(layout.badButtons, [], `${id}: button text overflow`);
        if (['start', 'commands'].includes(id) && [1440, 375].includes(width)) {
          const screenshot = await win.webContents.capturePage({ x: 0, y: 0, width, height: 980 });
          fs.writeFileSync(path.join(output, `${id}-${width}.png`), screenshot.toPNG());
        }
      }
    }
    await win.webContents.executeJavaScript('document.getElementById("menuButton").click()');
    assert.strictEqual(await win.webContents.executeJavaScript('document.getElementById("menuButton").getAttribute("aria-expanded")'), 'true');
    await win.webContents.executeJavaScript('document.querySelector("#navigation a[href=\\"#cases-branch\\"]").click()');
    await waitFor(() => win.webContents.executeJavaScript('document.querySelector("#article h1").textContent === "案例二：带条件的分支"'), 'Mobile navigation failed');
    assert.strictEqual(await win.webContents.executeJavaScript('document.getElementById("menuButton").getAttribute("aria-expanded")'), 'false');
    await win.webContents.executeJavaScript('document.getElementById("menuButton").click(); document.getElementById("scrim").click()');
    assert.strictEqual(await win.webContents.executeJavaScript('document.getElementById("menuButton").getAttribute("aria-expanded")'), 'false');
    await win.webContents.executeJavaScript(`location.hash = 'start/section-2'`);
    await waitFor(() => win.webContents.executeJavaScript('Boolean(document.getElementById("section-2") && scrollY > 100)'), 'Section deep link failed');
    await win.webContents.executeJavaScript('document.querySelector(".figure-button").click()');
    assert.strictEqual(await win.webContents.executeJavaScript('document.getElementById("imageDialog").open'), true);
    await win.webContents.executeJavaScript('document.getElementById("closeImage").click()');
    await win.webContents.executeJavaScript(`location.hash = 'audio'`);
    await waitFor(() => win.webContents.executeJavaScript('document.querySelector("#article h1").textContent === "配乐与音效"'), 'Audio navigation failed');
    await win.webContents.executeJavaScript('document.querySelector(".skip-link").click()');
    assert.strictEqual(await win.webContents.executeJavaScript('location.hash'), '#audio', 'Skip-to-content changed chapter');
    await win.webContents.executeJavaScript(`location.hash = 'unknown-page'`);
    await waitFor(() => win.webContents.executeJavaScript('location.hash === "#start"'), 'Invalid route fallback failed');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
    assert.strictEqual(await win.webContents.executeJavaScript('getComputedStyle(document.getElementById("sidebar")).display'), 'none');
    win.webContents.debugger.detach();
    fs.writeFileSync(path.join(output, 'layout.json'), JSON.stringify(layouts, null, 2));
    assert.deepStrictEqual(errors, [], `Browser errors: ${errors.join('\n')}`);
    console.log(`manual.electron.js: ok (${pages.length} chapters, ${snippets.length} compiled snippets, ${layouts.length} layouts, search/copy/theme/menu/links/help IPC)`);
  } catch (error) {
    failed = true;
    console.error(error.stack || error);
  } finally {
    clearTimeout(watchdog);
    clipboard.writeText(previousClipboard);
    if (win && !win.isDestroyed()) win.destroy();
    if (server) await new Promise(resolve => server.close(resolve));
    app.exit(failed ? 1 : 0);
  }
});
