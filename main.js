const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

let mainWindow;
let tray;
let mobileServer;
let mobileServerPort = 9876;

// ── DATA FILE PATH (persists in user's AppData) ──
const DATA_DIR = path.join(app.getPath('userData'), 'BizSuiteData');
const DATA_FILE = path.join(DATA_DIR, 'bizsuite_data.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── READ / WRITE DATA (for mobile sync) ──
function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch(e) {}
  return {};
}

function writeData(data) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); return true; }
  catch(e) { return false; }
}

// ── GET LOCAL IP FOR MOBILE ACCESS ──
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

// ── MOBILE SYNC SERVER ──
function startMobileServer() {
  const appHTML = fs.readFileSync(path.join(__dirname, 'src', 'index.html'), 'utf8');

  // Inject sync script into the HTML for mobile
  const syncScript = `
<script>
// ── MOBILE SYNC: Override localStorage to sync with PC ──
(function() {
  const PC_URL = 'http://${getLocalIP()}:${mobileServerPort}';
  let syncTimer = null;

  // Load data from PC on start
  async function loadFromPC() {
    try {
      const res = await fetch(PC_URL + '/data');
      const data = await res.json();
      Object.keys(data).forEach(k => localStorage.setItem(k, JSON.stringify(data[k])));
      window.location.reload();
    } catch(e) { console.log('PC offline, using local data'); }
  }

  // Save data to PC whenever localStorage changes
  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    origSetItem(key, value);
    clearTimeout(syncTimer);
    syncTimer = setTimeout(pushToPC, 500);
  };

  async function pushToPC() {
    const snapshot = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      try { snapshot[k] = JSON.parse(localStorage.getItem(k)); }
      catch(e) { snapshot[k] = localStorage.getItem(k); }
    }
    try { await fetch(PC_URL + '/data', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(snapshot) }); }
    catch(e) {}
  }

  // Show sync status bar on mobile
  const bar = document.createElement('div');
  bar.id = 'sync-bar';
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#2563eb;color:white;font-size:12px;padding:6px 12px;z-index:9999;display:flex;justify-content:space-between;align-items:center;font-family:sans-serif';
  bar.innerHTML = \`<span>📱 BizSuite Mobile — Connected to PC</span><button onclick="loadFromPC()" style="background:white;color:#2563eb;border:none;border-radius:4px;padding:3px 10px;font-size:12px;cursor:pointer">🔄 Sync Now</button>\`;
  document.addEventListener('DOMContentLoaded', () => { document.body.appendChild(bar); loadFromPC(); });
})();
</script>
`;

  const mobileHTML = appHTML.replace('</head>', syncScript + '</head>');

  mobileServer = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(mobileHTML);
    }
    else if (req.url === '/data' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readData()));
    }
    else if (req.url === '/data' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          writeData(data);
          // Also push to PC's localStorage via IPC
          if (mainWindow) mainWindow.webContents.send('sync-from-mobile', data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch(e) {
          res.writeHead(400); res.end('Bad JSON');
        }
      });
    }
    else if (req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', app: 'BizSuite', version: '2.0' }));
    }
    else {
      res.writeHead(404); res.end('Not found');
    }
  });

  mobileServer.listen(mobileServerPort, '0.0.0.0', () => {
    console.log(`Mobile server running at http://${getLocalIP()}:${mobileServerPort}`);
  });

  mobileServer.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      mobileServerPort++;
      mobileServer.listen(mobileServerPort, '0.0.0.0');
    }
  });
}

// ── CREATE MAIN WINDOW ──
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'BizSuite — Invoice & Tender Manager',
    icon: path.join(__dirname, 'build-resources', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#f0f2f5',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Inject mobile server info into the page
    mainWindow.webContents.executeJavaScript(`
      (function() {
        const bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1e40af;color:white;font-size:12px;padding:5px 16px;z-index:9999;display:flex;justify-content:space-between;align-items:center;font-family:sans-serif';
        bar.innerHTML = '<span>💻 BizSuite Desktop &nbsp;|&nbsp; 📱 Mobile: Open browser on phone → <b>http://${getLocalIP()}:${mobileServerPort}</b></span><span style="opacity:0.7">Same WiFi required</span>';
        document.body.appendChild(bar);
      })();
    `);
  });

  // Sync data FROM localStorage TO file (so mobile can read it)
  mainWindow.webContents.on('did-finish-load', () => {
    // Push any existing file data INTO the page localStorage
    const saved = readData();
    if (Object.keys(saved).length > 0) {
      mainWindow.webContents.executeJavaScript(`
        (function() {
          const data = ${JSON.stringify(saved)};
          Object.keys(data).forEach(k => {
            if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(data[k]));
          });
        })();
      `);
    }

    // Periodically save localStorage to file
    setInterval(() => {
      mainWindow.webContents.executeJavaScript(`
        (function() {
          const snap = {};
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            try { snap[k] = JSON.parse(localStorage.getItem(k)); }
            catch(e) { snap[k] = localStorage.getItem(k); }
          }
          return snap;
        })();
      `).then(data => {
        if (data && Object.keys(data).length > 0) writeData(data);
      }).catch(() => {});
    }, 3000); // Save every 3 seconds
  });

  // Handle sync from mobile
  ipcMain.on('sync-from-mobile', (event, data) => {
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        (function() {
          const data = ${JSON.stringify(data)};
          Object.keys(data).forEach(k => localStorage.setItem(k, JSON.stringify(data[k])));
          window.dispatchEvent(new Event('storage'));
        })();
      `);
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Custom menu
  const menu = Menu.buildFromTemplate([
    {
      label: 'BizSuite',
      submenu: [
        { label: 'About BizSuite', click: () => dialog.showMessageBox(mainWindow, {
          title: 'BizSuite v2.0',
          message: 'BizSuite — Invoice & Tender Manager\nVersion 2.0\n\nOffline Desktop App\nMobile sync via WiFi',
          buttons: ['OK']
        })},
        { type: 'separator' },
        { label: 'Open Data Folder', click: () => shell.openPath(DATA_DIR) },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Invoice',
      submenu: [
        { label: 'New Invoice', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.executeJavaScript("showPage('create')") },
        { label: 'Records', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.executeJavaScript("showPage('records')") },
      ]
    },
    {
      label: 'Mobile Sync',
      submenu: [
        { label: 'Show Mobile QR / URL', click: showMobileInfo },
        { label: 'Copy Mobile URL', click: () => {
          const { clipboard } = require('electron');
          clipboard.writeText(`http://${getLocalIP()}:${mobileServerPort}`);
          dialog.showMessageBox(mainWindow, { message: 'Mobile URL copied to clipboard!', buttons: ['OK'] });
        }}
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow?.reload() },
        { label: 'Toggle DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => { let z = mainWindow.webContents.getZoomFactor(); mainWindow.webContents.setZoomFactor(z + 0.1); }},
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => { let z = mainWindow.webContents.getZoomFactor(); mainWindow.webContents.setZoomFactor(z - 0.1); }},
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => mainWindow?.webContents.setZoomFactor(1.0) },
        { type: 'separator' },
        { label: 'Full Screen', accelerator: 'F11', click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

function showMobileInfo() {
  const ip = getLocalIP();
  const url = `http://${ip}:${mobileServerPort}`;
  dialog.showMessageBox(mainWindow, {
    title: '📱 Open on Mobile',
    message: `Open this URL in your phone browser:\n\n${url}\n\n⚠️ Make sure your phone and PC are on the SAME WiFi network.\n\nData syncs automatically between PC and phone!`,
    buttons: ['OK', 'Copy URL'],
    defaultId: 0
  }).then(result => {
    if (result.response === 1) {
      const { clipboard } = require('electron');
      clipboard.writeText(url);
    }
  });
}

// ── APP EVENTS ──
app.whenReady().then(() => {
  startMobileServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (mobileServer) mobileServer.close();
  if (process.platform !== 'darwin') app.quit();
});
