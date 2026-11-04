'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { URL } = require('url');

const WEB_ROOT = path.join(__dirname, 'web');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.atlas': 'text/plain; charset=utf-8',
  '.bytes': 'application/octet-stream', '.skel': 'application/octet-stream',
};

function safeJoin(root, reqPath) {
  const clean = decodeURIComponent(String(reqPath || '').split('?')[0]).replace(/^([/\\])+/, '');
  const target = path.resolve(root, path.normalize(clean));
  return target.startsWith(path.resolve(root) + path.sep) || target === path.resolve(root) ? target : null;
}

function serve(req, res) {
  let url;
  try { url = new URL(req.url, 'http://127.0.0.1'); } catch { res.writeHead(400); res.end(); return; }
  let rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = safeJoin(WEB_ROOT, rel);
  if (!file) { res.writeHead(403); res.end(); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
}

let server;
let win;

function createWindow(base) {
  win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 960, minHeight: 540,
    backgroundColor: '#000000', autoHideMenuBar: true,
    title: 'Trickcal Story',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.loadURL(`${base}/index.html?embed=1&autoStart=1`);
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  server = http.createServer(serve);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    createWindow(`http://127.0.0.1:${port}`);
  });
});

app.on('window-all-closed', () => {
  if (server) { try { server.close(); } catch {} }
  app.quit();
});
