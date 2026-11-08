'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const { compile } = require('./compiler/trickcal');
const { validateSpineDirectory } = require('./compiler/spine-assets');
const { CheckService } = require('./compiler/check-service');
const { androidApplicationId } = require('./packaging/android-id');

const ROOT = __dirname;
const RUNTIME_DIR = path.join(ROOT, 'runtime');
const TEMPLATE_DIR = path.join(ROOT, 'templates', 'minimal-demo');
const MONACO_DIR = path.join(ROOT, 'node_modules', 'monaco-editor', 'min');
const SHARED_USER_DATA = app.getPath('userData');
if (!app.isPackaged) app.setPath('userData', path.join(SHARED_USER_DATA, 'workspace'));
const SETTINGS_DIR = () => path.join(SHARED_USER_DATA, 'engine');
const RECENT_FILE = () => path.join(SETTINGS_DIR(), 'recent.json');

let server = null;
let baseUrl = '';
let launcherWindow = null;
let helpWindow = null;
const editorWindows = new Set();
const previewProjects = new Map(); // token -> { path, updatedAt }
const checkService = new CheckService();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.skel': 'application/octet-stream',
  '.bytes': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.atlas': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function safeJoin(rootDir, requestPath) {
  const decoded = decodeURIComponent(String(requestPath || '').split('?')[0]);
  const clean = path.normalize(decoded).replace(/^([/\\])+/, '');
  const target = path.resolve(rootDir, clean);
  const root = path.resolve(rootDir);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

function sendFile(res, file) {
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mimeFor(file),
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function readRecent() {
  return readJson(RECENT_FILE(), { projects: [] }) || { projects: [] };
}
function writeRecent(data) {
  writeJson(RECENT_FILE(), data);
}
function rememberProject(projectPath, manifest) {
  const data = readRecent();
  const entry = {
    path: projectPath,
    title: manifest?.title || path.basename(projectPath),
    chapterNo: manifest?.chapterNo ?? null,
    updatedAt: Date.now(),
  };
  data.projects = [entry, ...(data.projects || []).filter(p => p.path !== projectPath)].slice(0, 12);
  writeRecent(data);
}

function projectManifest(projectPath) {
  return readJson(path.join(projectPath, 'trickcal.project.json'));
}

function validProject(projectPath) {
  const manifest = projectManifest(projectPath);
  if (!manifest) throw new Error('不是有效的 Trickcal 项目：缺少 trickcal.project.json');
  return manifest;
}

function tokenFor(projectPath) {
  for (const [token, item] of previewProjects) {
    if (item.path === projectPath) return token;
  }
  const token = crypto.createHash('sha1').update(projectPath + Date.now()).digest('hex').slice(0, 12);
  previewProjects.set(token, { path: projectPath, updatedAt: Date.now() });
  return token;
}

function projectFromToken(token) {
  const item = previewProjects.get(token);
  return item ? item.path : null;
}

function startServer() {
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      let url;
      try { url = new URL(req.url, 'http://127.0.0.1'); } catch { res.writeHead(400); res.end(); return; }
      const pathname = url.pathname;

      if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      if (pathname === '/' || pathname === '/index.html') {
        sendFile(res, path.join(ROOT, 'launcher', 'index.html'));
        return;
      }
      if (pathname.startsWith('/launcher/')) {
        const f = safeJoin(path.join(ROOT, 'launcher'), pathname.slice('/launcher/'.length));
        if (f) sendFile(res, f); else { res.writeHead(403); res.end(); }
        return;
      }
      if (pathname.startsWith('/editor/')) {
        const f = safeJoin(path.join(ROOT, 'editor'), pathname.slice('/editor/'.length));
        if (f) sendFile(res, f); else { res.writeHead(403); res.end(); }
        return;
      }
      if (pathname.startsWith('/monaco/')) {
        const f = safeJoin(MONACO_DIR, pathname.slice('/monaco/'.length));
        if (f) sendFile(res, f); else { res.writeHead(403); res.end(); }
        return;
      }
      if (pathname.startsWith('/preview/')) {
        const rest = pathname.slice('/preview/'.length);
        const slash = rest.indexOf('/');
        const token = slash >= 0 ? rest.slice(0, slash) : rest;
        const rel = slash >= 0 ? rest.slice(slash + 1) : 'index.html';
        const projectPath = projectFromToken(token);
        if (!projectPath) { res.writeHead(404); res.end('Unknown preview'); return; }
        if (rel === 'preset-story.json') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end('{"lines":[]}');
          return;
        }
        if (rel === 'story.json') {
          sendFile(res, path.join(projectPath, '.preview', 'story.json'));
          return;
        }
        const f = safeJoin(RUNTIME_DIR, rel);
        if (f) sendFile(res, f); else { res.writeHead(403); res.end(); }
        return;
      }
      if (pathname.startsWith('/project/')) {
        const rest = pathname.slice('/project/'.length);
        const slash = rest.indexOf('/');
        const token = slash >= 0 ? rest.slice(0, slash) : rest;
        const rel = slash >= 0 ? rest.slice(slash + 1) : '';
        const projectPath = projectFromToken(token);
        if (!projectPath) { res.writeHead(404); res.end('Unknown project'); return; }
        const f = safeJoin(projectPath, rel);
        if (f) sendFile(res, f); else { res.writeHead(403); res.end(); }
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve(baseUrl);
    });
  });
}

function createLauncherWindow() {
  launcherWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: `Trickcal 剧情制作引擎${app.isPackaged ? '' : ' [源码版]'}`,
    backgroundColor: '#090b0d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  if (!app.isPackaged) {
    const win = launcherWindow;
    win.on('page-title-updated', (event, title) => {
      event.preventDefault();
      win.setTitle(`${title} [源码版]`);
    });
  }
  launcherWindow.loadURL(`${baseUrl}/launcher/index.html`);
  launcherWindow.on('closed', () => { launcherWindow = null; });
}

function createHelpWindow() {
  if (helpWindow && !helpWindow.isDestroyed()) {
    if (helpWindow.isMinimized()) helpWindow.restore();
    helpWindow.show();
    helpWindow.focus();
    return;
  }
  helpWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 420,
    minHeight: 600,
    title: '使用手册 · Trickcal 剧情制作引擎',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  helpWindow.loadFile(path.join(ROOT, 'docs', 'manual', 'index.html'));
  helpWindow.on('closed', () => { helpWindow = null; });
}

function createEditorWindow(projectPath, options = {}) {
  const manifest = validProject(projectPath);
  const win = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    title: `${manifest.title || path.basename(projectPath)} · Trickcal 剧情制作引擎${app.isPackaged ? '' : ' [源码版]'}`,
    backgroundColor: '#0b0d0f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  if (!app.isPackaged) {
    win.on('page-title-updated', (event, title) => {
      event.preventDefault();
      win.setTitle(`${title} [源码版]`);
    });
  }
  editorWindows.add(win);
  win.on('closed', () => editorWindows.delete(win));
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'mouseDown' && (input.button === 3 || input.button === 4)) event.preventDefault();
  });
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const params = new URLSearchParams({ project: projectPath });
  if (options.autoPreview) params.set('autoPreview', '1');
  if (options.autoBuild) params.set('autoBuild', '1');
  win.loadURL(`${baseUrl}/editor/index.html?${params.toString()}`);
  rememberProject(projectPath, manifest);
}

function sanitizeFolderName(name) {
  return String(name || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim() || '未命名项目';
}

function replaceOpeningMeta(source, title, chapterNo) {
  const escaped = String(title).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const no = Math.max(1, Math.min(999, Math.round(Number(chapterNo) || 1)));
  return String(source).replace(
    /^(\s*)opening\s+\d+\s+"(?:[^"\\]|\\.)*"([\s\S]*)$/m,
    `$1opening ${no} "${escaped}"$2`
  );
}

async function createProject({ parentDir, folderName, title, chapterNo }) {
  if (!parentDir) throw new Error('未选择项目父目录');
  const folder = sanitizeFolderName(folderName || title);
  ensureDir(parentDir);
  const target = path.join(parentDir, folder);
  if (fs.existsSync(target)) throw new Error('目标文件夹已存在：' + target);
  fs.cpSync(TEMPLATE_DIR, target, { recursive: true });
  const manifestPath = path.join(target, 'trickcal.project.json');
  const manifest = readJson(manifestPath, {});
  manifest.id = 'story-' + Date.now().toString(36);
  manifest.title = title || manifest.title || folder;
  manifest.openingTitle = title || manifest.openingTitle || manifest.title;
  manifest.chapterNo = Math.max(1, Math.min(999, Math.round(Number(chapterNo) || 1)));
  manifest.engineVersion = '0.1.0';
  writeJson(manifestPath, manifest);
  const storyPath = path.join(target, manifest.entry || 'story/main.trickcal');
  if (fs.existsSync(storyPath)) {
    const source = fs.readFileSync(storyPath, 'utf8');
    fs.writeFileSync(storyPath, replaceOpeningMeta(source, manifest.openingTitle, manifest.chapterNo), 'utf8');
  }
  ensureDir(path.join(target, '.preview'));
  compileProject(target);
  rememberProject(target, manifest);
  return { projectPath: target, manifest };
}

function projectCompileInput(projectPath, sourceOverride) {
  const manifest = validProject(projectPath);
  const entry = path.join(projectPath, manifest.entry || 'story/main.trickcal');
  const source = sourceOverride != null ? sourceOverride : fs.readFileSync(entry, 'utf8');
  const options = {
    ...manifest,
    projectRoot: projectPath,
    backgrounds: manifest.backgrounds || {},
    cast: manifest.cast || {},
    presets: listPresets(projectPath),
    audio: manifest.audio || {},
    images: manifest.images || {},
    title: manifest.title,
    openingTitle: manifest.openingTitle,
    chapterNo: manifest.chapterNo,
  };
  return { manifest, entry, source, options };
}

function compileProject(projectPath, sourceOverride) {
  const { manifest, entry, source, options } = projectCompileInput(projectPath, sourceOverride);
  const result = compile(source, options);
  if (result.diagnostics.some(d => d.severity === 'error')) {
    return { ...result, projectPath, entry, previewToken: tokenFor(projectPath) };
  }
  if (result.story.meta) {
    manifest.chapterNo = result.story.meta.chapterNo;
    manifest.openingTitle = result.story.meta.title;
    writeJson(path.join(projectPath, 'trickcal.project.json'), manifest);
  }
  ensureDir(path.join(projectPath, '.preview'));
  writeJson(path.join(projectPath, '.preview', 'story.json'), result.story);
  const token = tokenFor(projectPath);
  return { ...result, projectPath, entry, previewToken: token };
}

function previewUrl(projectPath) {
  const token = tokenFor(projectPath);
  return `${baseUrl}/preview/${token}/index.html?embed=1&editorPreview=1&autoStart=1&assetRoot=${encodeURIComponent(`/project/${token}/`)}&storyUrl=${encodeURIComponent(`/preview/${token}/story.json`)}&v=${Date.now()}`;
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
}

function createBuildStage(projectPath, kind) {
  const buildDir = path.join(projectPath, 'build');
  ensureDir(buildDir);
  const root = fs.realpathSync(buildDir);
  return { root, dir: fs.mkdtempSync(path.join(root, `.${kind}-`)), kind };
}

function discardBuildStage(stage) {
  if (!fs.existsSync(stage.dir)) return;
  const actual = fs.realpathSync(stage.dir);
  if (path.dirname(actual) !== stage.root || !path.basename(actual).startsWith(`.${stage.kind}-`)) {
    throw new Error('构建临时目录不在预期位置，未删除。');
  }
  fs.rmSync(actual, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

function publishBuildStage(stage, preparedDir = stage.dir) {
  const prepared = fs.realpathSync(preparedDir);
  if (prepared !== stage.dir && path.dirname(prepared) !== stage.dir) throw new Error('待发布目录不在构建临时目录内。');
  const output = path.join(stage.root, stage.kind);
  let previous = null;
  if (fs.existsSync(output)) {
    const archive = path.join(stage.root, 'archive', stage.kind);
    ensureDir(archive);
    const actualArchive = fs.realpathSync(archive);
    if (!actualArchive.startsWith(stage.root + path.sep)) throw new Error('构建归档目录不在项目 build 目录内。');
    previous = path.join(actualArchive, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
    fs.renameSync(output, previous);
  }
  try {
    fs.renameSync(prepared, output);
  } catch (e) {
    if (previous && !fs.existsSync(output)) fs.renameSync(previous, output);
    throw e;
  }
  return output;
}

function buildWeb(projectPath) {
  const result = compileProject(projectPath);
  if (result.diagnostics.some(d => d.severity === 'error')) {
    throw new Error(result.diagnostics.filter(d => d.severity === 'error').map(d => `第 ${d.line} 行：${d.message}`).join('\n'));
  }
  const manifest = validProject(projectPath);
  const stage = createBuildStage(projectPath, 'web');
  try {
    const out = stage.dir;
    for (const file of ['app.js', 'styles.css', 'scene-graph.js', 'scene-state.js', 'story-navigation.js', 'camera-timeline.js', 'stage-timeline.js', 'move-presets.js', 'expressions.js', 'audio-player.js']) {
      fs.copyFileSync(path.join(RUNTIME_DIR, file), path.join(out, file));
    }
    copyIfExists(path.join(RUNTIME_DIR, 'data'), path.join(out, 'data'));
    copyIfExists(path.join(RUNTIME_DIR, 'assets', 'vendor'), path.join(out, 'assets', 'vendor'));
    copyIfExists(path.join(RUNTIME_DIR, 'assets', 'fonts'), path.join(out, 'assets', 'fonts'));
    copyIfExists(path.join(projectPath, 'assets'), path.join(out, 'assets'));
    const index = fs.readFileSync(path.join(RUNTIME_DIR, 'index.html'), 'utf8');
    fs.writeFileSync(path.join(out, 'index.html'),
      index.replace('<script src="app.js"></script>', '<script>window.__TRICKCAL_BUILD__=true;</script>\n<script src="app.js"></script>'), 'utf8');
    fs.writeFileSync(path.join(out, 'player.html'),
      '<!doctype html><meta charset="utf-8"><script>location.replace("./index.html?embed=1&autoStart=1")</script>', 'utf8');
    fs.copyFileSync(path.join(projectPath, '.preview', 'story.json'), path.join(out, 'story.json'));
    writeJson(path.join(out, 'build-info.json'), {
      title: manifest.title,
      builtAt: new Date().toISOString(),
      target: 'web',
    });
    return { out: publishBuildStage(stage), manifest };
  } finally {
    discardBuildStage(stage);
  }
}

async function buildWindowsExe(projectPath) {
  const web = buildWeb(projectPath);
  const stage = createBuildStage(projectPath, 'windows');
  try {
    const out = path.join(stage.dir, 'TrickcalStory-win32-x64');
    const localElectron = path.join(ROOT, 'node_modules', 'electron', 'dist');
    const electronDist = fs.existsSync(localElectron) ? localElectron : path.dirname(process.execPath);
    fs.cpSync(electronDist, out, { recursive: true });
    const appDir = path.join(out, 'resources', 'app');
    if (fs.existsSync(appDir)) {
      const actualAppDir = fs.realpathSync(appDir);
      if (!actualAppDir.startsWith(stage.dir + path.sep)) throw new Error('播放器临时目录不在构建目录内。');
      fs.rmSync(actualAppDir, { recursive: true, force: true });
    }
    ensureDir(appDir);
    fs.cpSync(path.join(ROOT, 'packaging', 'player'), appDir, { recursive: true });
    fs.cpSync(web.out, path.join(appDir, 'web'), { recursive: true });
    writeJson(path.join(appDir, 'package.json'), {
      name: 'trickcal-story-player',
      productName: web.manifest.title || 'Trickcal Story',
      version: '1.0.0',
      description: 'Trickcal fan story player',
      main: 'main.js',
    });
    const targetExe = path.join(out, 'TrickcalStory.exe');
    const electronExe = path.join(out, 'electron.exe');
    const engineExe = path.join(out, 'TrickcalStoryEngine.exe');
    if (fs.existsSync(electronExe)) fs.renameSync(electronExe, targetExe);
    else if (fs.existsSync(engineExe)) fs.renameSync(engineExe, targetExe);
    else throw new Error('未找到可用于 Windows 构建的 Electron 可执行文件。');
    return { out: path.join(publishBuildStage(stage), 'TrickcalStory-win32-x64'), manifest: web.manifest };
  } finally {
    discardBuildStage(stage);
  }
}

function findJdkHome() {
  const candidates = [
    'C:/Program Files/Microsoft/jdk-21.0.12.101-hotspot',
    'C:/Program Files/Android/Android Studio/jbr',
    process.env.JAVA_HOME,
  ].filter(Boolean);
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))) return dir;
  }
  return null;
}

function findAndroidHome() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
  ].filter(Boolean);
  return candidates.find(dir => fs.existsSync(dir)) || null;
}

function buildAndroid(projectPath) {
  const signingKeys = ['TRICKCAL_ANDROID_KEYSTORE', 'TRICKCAL_ANDROID_STORE_PASSWORD', 'TRICKCAL_ANDROID_KEY_ALIAS', 'TRICKCAL_ANDROID_KEY_PASSWORD'];
  const signingProvided = signingKeys.filter(key => process.env[key]);
  if (signingProvided.length && signingProvided.length !== signingKeys.length) {
    throw new Error('Android 正式签名配置不完整：需要同时设置密钥文件、密钥库密码、别名和密钥密码。');
  }
  const isRelease = signingProvided.length === signingKeys.length;
  const signingFile = isRelease ? path.resolve(process.env.TRICKCAL_ANDROID_KEYSTORE) : null;
  if (isRelease && (!fs.existsSync(signingFile) || !fs.statSync(signingFile).isFile())) {
    throw new Error('Android 签名密钥文件不存在。');
  }
  const manifest = validProject(projectPath);
  const applicationId = androidApplicationId(manifest, projectPath);
  const jdk = findJdkHome();
  const sdk = findAndroidHome();
  if (!jdk) throw new Error('未找到 JDK 21。请安装 JDK 21 或设置 JAVA_HOME。');
  if (!sdk) throw new Error('未找到 Android SDK。请设置 ANDROID_HOME。');
  const web = buildWeb(projectPath);
  const shell = path.join(ROOT, 'packaging', 'android-shell');
  const stage = createBuildStage(projectPath, 'android');
  try {
    const out = path.join(stage.dir, 'work');
    fs.cpSync(shell, out, {
      recursive: true,
      filter: (src) => {
        const rel = path.relative(shell, src).replace(/\\/g, '/');
        if (rel === 'keystore' || rel.startsWith('keystore/')) return false;
        if (rel === 'www' || rel.startsWith('www/')) return false;
        if (rel === 'android/app/build' || rel.startsWith('android/app/build/') || rel === 'android/build' || rel.startsWith('android/build/') || rel === 'android/.gradle' || rel.startsWith('android/.gradle/')) return false;
        if (rel.toLowerCase().endsWith('.log')) return false;
        return true;
      },
    });
    fs.cpSync(web.out, path.join(out, 'www'), { recursive: true });
    const configPath = path.join(out, 'capacitor.config.json');
    const config = readJson(configPath, {});
    config.appName = manifest.title || 'Trickcal Story';
    config.appId = applicationId;
    writeJson(configPath, config);
    const stringsPath = path.join(out, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
    if (fs.existsSync(stringsPath)) {
      let strings = fs.readFileSync(stringsPath, 'utf8');
      strings = strings.replace(/<string name="app_name">.*?<\/string>/, `<string name="app_name">${String(manifest.title || 'Trickcal Story').replace(/[<&]/g, '')}</string>`);
      fs.writeFileSync(stringsPath, strings, 'utf8');
    }
    const env = { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, TRICKCAL_ANDROID_APP_ID: applicationId };
    if (signingFile) env.TRICKCAL_ANDROID_KEYSTORE = signingFile;
    const { execFileSync } = require('child_process');
    const cap = path.join(out, 'node_modules', '.bin', process.platform === 'win32' ? 'cap.cmd' : 'cap');
    if (process.platform === 'win32') execFileSync('cmd.exe', ['/c', cap, 'sync', 'android'], { cwd: out, env, stdio: 'pipe', windowsHide: true });
    else execFileSync(cap, ['sync', 'android'], { cwd: out, env, stdio: 'pipe', windowsHide: true });
    const gradle = path.join(out, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
    const task = isRelease ? 'assembleRelease' : 'assembleDebug';
    const gradleArgs = [task, '--no-daemon', '--max-workers=2', '--console=plain'];
    if (process.platform === 'win32') execFileSync('cmd.exe', ['/c', gradle, ...gradleArgs], { cwd: path.join(out, 'android'), env, stdio: 'pipe', windowsHide: true });
    else execFileSync(gradle, gradleArgs, { cwd: path.join(out, 'android'), env, stdio: 'pipe', windowsHide: true });
    const variant = isRelease ? 'release' : 'debug';
    const builtApk = path.join(out, 'android', 'app', 'build', 'outputs', 'apk', variant, `app-${variant}.apk`);
    if (!fs.existsSync(builtApk)) throw new Error(`Android 构建完成但未找到 ${variant} APK。`);
    const ready = path.join(stage.dir, 'publish');
    ensureDir(ready);
    const apkName = `TrickcalStory-${variant}.apk`;
    fs.copyFileSync(builtApk, path.join(ready, apkName));
    writeJson(path.join(ready, 'build-info.json'), {
      title: manifest.title, target: 'android', variant, applicationId, builtAt: new Date().toISOString(),
    });
    const published = publishBuildStage(stage, ready);
    return { out: published, apk: path.join(published, apkName), variant, applicationId, manifest };
  } finally {
    discardBuildStage(stage);
  }
}

function listPresets(projectPath) {
  const dir = path.join(projectPath, 'presets');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  return files.map(file => {
    const data = readJson(path.join(dir, file), {});
    return { file, ...data };
  });
}

function writePreset(projectPath, file, data) {
  const safe = sanitizeFolderName(file).replace(/\.json$/i, '') + '.json';
  const target = path.join(projectPath, 'presets', safe);
  writeJson(target, data);
  return target;
}

function deletePreset(projectPath, file) {
  const target = safeJoin(path.join(projectPath, 'presets'), file);
  if (!target) throw new Error('非法预设路径');
  if (fs.existsSync(target)) fs.unlinkSync(target);
}

function registerIpc() {
  ipcMain.handle('help:open', () => { createHelpWindow(); });
  ipcMain.handle('app:bootstrap', () => ({
    version: app.getVersion(),
    baseUrl,
    recent: readRecent().projects || [],
    template: TEMPLATE_DIR,
    projectsDir: path.join(app.getPath('documents'), 'TrickcalStoryProjects'),
    platform: process.platform,
  }));

  ipcMain.handle('dialog:chooseDirectory', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('project:create', async (event, payload) => {
    const result = await createProject(payload || {});
    createEditorWindow(result.projectPath);
    return result;
  });

  ipcMain.handle('project:open', async (event, projectPath) => {
    const manifest = validProject(projectPath);
    compileProject(projectPath);
    createEditorWindow(projectPath);
    return { projectPath, manifest };
  });

  ipcMain.handle('project:chooseAndOpen', async (event, options = {}) => {
    const r = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择 Trickcal 项目文件夹',
    });
    if (r.canceled) return null;
    const projectPath = r.filePaths[0];
    const manifest = validProject(projectPath);
    compileProject(projectPath);
    createEditorWindow(projectPath, options || {});
    return { projectPath, manifest };
  });

  ipcMain.handle('project:read', (event, projectPath) => {
    const manifest = validProject(projectPath);
    const entry = path.join(projectPath, manifest.entry || 'story/main.trickcal');
    return {
      projectPath,
      manifest,
      entry,
      source: fs.existsSync(entry) ? fs.readFileSync(entry, 'utf8') : '',
      presets: listPresets(projectPath),
    };
  });

  ipcMain.handle('project:saveStory', (event, { projectPath, source }) => {
    const manifest = validProject(projectPath);
    const entry = path.join(projectPath, manifest.entry || 'story/main.trickcal');
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.writeFileSync(entry, source, 'utf8');
    const result = compileProject(projectPath, source);
    if (!result.diagnostics.some(d => d.severity === 'error')) {
      try { rememberProject(projectPath, validProject(projectPath)); } catch (e) { /* ignore recent-list errors */ }
    }
    return result;
  });

  ipcMain.handle('project:compile', (event, { projectPath, source, purpose }) => {
    const input = projectCompileInput(projectPath, source);
    const checkKey = purpose === 'presetPreview' ? `${event.sender.id}:presetPreview` : event.sender.id;
    return checkService.check(input.source, input.options, checkKey)
      .then(result => result.superseded ? result : ({ ...result, projectPath, entry: input.entry }));
  });

  ipcMain.handle('project:previewUrl', (event, { projectPath }) => {
    compileProject(projectPath);
    return previewUrl(projectPath);
  });
  ipcMain.handle('project:presetPreviewUrl', (event, { projectPath }) => {
    validProject(projectPath);
    const token = tokenFor(projectPath);
    return `${baseUrl}/preview/${token}/index.html?embed=1&editorPreview=1&interactive=0&assetRoot=${encodeURIComponent(`/project/${token}/`)}&storyUrl=${encodeURIComponent(`/preview/${token}/preset-story.json`)}`;
  });

  ipcMain.handle('project:build', (event, { projectPath, target }) => {
    if (target === 'windows') return buildWindowsExe(projectPath);
    if (target === 'android') return buildAndroid(projectPath);
    return buildWeb(projectPath);
  });

  ipcMain.handle('project:importAsset', async (event, { projectPath, kind, alias }) => {
    const manifest = validProject(projectPath);
    const name = sanitizeFolderName(alias || kind || 'asset');
    const importedRoot = path.join(projectPath, 'assets', 'imported');
    ensureDir(importedRoot);
    let target;
    if (kind === 'spine') {
      const picked = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '选择 Spine 文件夹（skel / atlas / png）' });
      if (picked.canceled) return null;
      const src = picked.filePaths[0];
      target = path.join(importedRoot, name);
      if (fs.existsSync(target)) throw new Error('目标素材目录已存在，请使用其他引用名。');
      const { base } = validateSpineDirectory(src, src);
      fs.cpSync(src, target, { recursive: true, errorOnExist: true, force: false });
      manifest.spines = manifest.spines || {};
      manifest.spines[name] = { dir: `assets/imported/${name}/`, file: base };
      manifest.spineCatalog = manifest.spineCatalog || {};
      manifest.spineCatalog[name] = manifest.spineCatalog[name] || { skins: ['default'], animations: [] };
    } else {
      const filters = kind === 'audio'
        ? [{ name: 'Audio', extensions: ['ogg', 'mp3', 'wav', 'm4a'] }]
        : [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }];
      const picked = await dialog.showOpenDialog({ properties: ['openFile'], filters, title: kind === 'audio' ? '选择音频' : '选择图片' });
      if (picked.canceled) return null;
      const src = picked.filePaths[0];
      const ext = path.extname(src);
      target = path.join(importedRoot, name + ext);
      fs.copyFileSync(src, target, fs.constants.COPYFILE_EXCL);
      const rel = path.relative(projectPath, target).replace(/\\/g, '/');
      if (kind === 'audio') {
        manifest.audio = manifest.audio || {};
        manifest.audio[name] = rel;
      } else {
        manifest.backgrounds = manifest.backgrounds || {};
        manifest.backgrounds[name] = rel;
        manifest.images = manifest.images || {};
        manifest.images[name] = rel;
      }
    }
    writeJson(path.join(projectPath, 'trickcal.project.json'), manifest);
    return { alias: name, path: path.relative(projectPath, target).replace(/\\/g, '/'), manifest };
  });

  ipcMain.handle('project:assets', (event, projectPath) => {
    const root = path.join(projectPath, 'assets');
    const out = [];
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full);
        else {
          const rel = path.relative(projectPath, full).replace(/\\/g, '/');
          out.push({ path: rel, size: fs.statSync(full).size });
        }
      }
    };
    walk(root);
    return out.sort((a, b) => a.path.localeCompare(b.path));
  });

  ipcMain.handle('project:presets', (event, projectPath) => listPresets(projectPath));
  ipcMain.handle('project:presetWrite', (event, { projectPath, file, data }) => writePreset(projectPath, file, data));
  ipcMain.handle('project:presetDelete', (event, { projectPath, file }) => deletePreset(projectPath, file));

  ipcMain.handle('shell:openPath', async (event, p) => shell.openPath(p));
  ipcMain.handle('shell:showItem', async (event, p) => shell.showItemInFolder(p));
  ipcMain.handle('shell:openVSCode', async (event, p) => {
    const { spawn } = require('child_process');
    try {
      if (process.platform === 'win32') {
        spawn('cmd.exe', ['/c', 'code', p], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      } else {
        spawn('code', [p], { detached: true, stdio: 'ignore' }).unref();
      }
      return true;
    } catch {
      await shell.openPath(p);
      return false;
    }
  });
}

const headlessBuild = !!process.env.TRICKCAL_BUILD_PROJECT;

if (!headlessBuild) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    // A second copy of the engine must not start another HTTP server and a
    // second CDP port; focus the window the user already has instead.
    app.quit();
  } else {
    app.on('second-instance', () => {
      const win = launcherWindow || [...editorWindows][0];
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      } else if (app.isReady()) {
        createLauncherWindow();
      }
    });

    app.whenReady().then(async () => {
      await startServer();
      registerIpc();
      createLauncherWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createLauncherWindow();
      });
    });
  }
} else {
  // Automated packaging entry: `TRICKCAL_BUILD_PROJECT=<dir> TRICKCAL_BUILD_TARGET=web|windows|android electron .`
  app.whenReady().then(async () => {
    const projectPath = path.resolve(process.env.TRICKCAL_BUILD_PROJECT);
    const target = String(process.env.TRICKCAL_BUILD_TARGET || 'web').toLowerCase();
    try {
      const result = target === 'windows'
        ? await buildWindowsExe(projectPath)
        : target === 'android'
          ? buildAndroid(projectPath)
          : buildWeb(projectPath);
      console.log('TRICKCAL_BUILD_RESULT ' + JSON.stringify({
        ok: true,
        target,
        out: result.out,
        apk: result.apk || null,
        variant: result.variant || null,
        applicationId: result.applicationId || null,
      }));
      app.exit(0);
    } catch (e) {
      console.error('TRICKCAL_BUILD_FAILED ' + (e && e.stack ? e.stack : e));
      app.exit(1);
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (server) { try { server.close(); } catch {} }
  void checkService.close();
});
