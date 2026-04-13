const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

let mainWindow;
let mobileServer;
let mobileServerPort = 9876;

// ── FIND index.html — works in dev AND after install ──
function getHTMLPath() {
  const candidates = [
    path.join(__dirname, 'src', 'index.html'),
    path.join(process.resourcesPath, 'src', 'index.html'),
    path.join(app.getAppPath(), 'src', 'index.html'),
    path.join(__dirname, 'index.html'),
    path.join(process.resourcesPath, 'index.html'),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch(e) {}
  }
  return null;
}

const DATA_DIR = path.join(app.getPath('userData'), 'BizSuiteData');
const DATA_FILE = path.join(DATA_DIR, 'bizsuite_data.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readData() {
  try { if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e) {}
  return {};
}
function writeData(data) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch(e) {}
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function startMobileServer() {
  const htmlPath = getHTMLPath();
  if (!htmlPath) return;
  const appHTML = fs.readFileSync(htmlPath, 'utf8');
  const ip = getLocalIP();

  const syncScript = `<script>
(function() {
  const PC = 'http://${ip}:${mobileServerPort}';
  let t = null;
  async function load() {
    try { const r = await fetch(PC+'/data'); const d = await r.json(); Object.keys(d).forEach(k=>localStorage.setItem(k,JSON.stringify(d[k]))); window.location.reload(); } catch(e) {}
  }
  const orig = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(k,v){ orig(k,v); clearTimeout(t); t=setTimeout(push,500); };
  async function push() {
    const s={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);try{s[k]=JSON.parse(localStorage.getItem(k));}catch(e){s[k]=localStorage.getItem(k);}}
    try{await fetch(PC+'/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)});}catch(e){}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const b=document.createElement('div');
    b.style.cssText='position:fixed;bottom:0;left:0;right:0;background:#2563eb;color:white;font-size:12px;padding:6px 12px;z-index:9999;display:flex;justify-content:space-between;align-items:center;font-family:sans-serif';
    b.innerHTML='<span>BizSuite Mobile | '+PC+'</span><button onclick="load()" style="background:white;color:#2563eb;border:none;border-radius:4px;padding:3px 10px;cursor:pointer">Sync</button>';
    document.body.appendChild(b); load();
  });
})();
</script>`;

  const mobileHTML = appHTML.replace('</head>', syncScript + '</head>');

  mobileServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(mobileHTML);
    } else if (req.url === '/data' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(readData()));
    } else if (req.url === '/data' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try { const d = JSON.parse(body); writeData(d); if (mainWindow) mainWindow.webContents.send('sync-from-mobile', d); res.writeHead(200); res.end('ok'); }
        catch(e) { res.writeHead(400); res.end('err'); }
      });
    } else { res.writeHead(404); res.end('404'); }
  });
  mobileServer.listen(mobileServerPort, '0.0.0.0');
  mobileServer.on('error', () => { mobileServerPort++; mobileServer.listen(mobileServerPort, '0.0.0.0'); });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: 'BizSuite — Invoice & Tender Manager',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
    },
    backgroundColor: '#f0f2f5', show: false,
  });

  const htmlPath = getHTMLPath();
  if (htmlPath) {
    mainWindow.loadFile(htmlPath);
  } else {
    mainWindow.loadURL('data:text/html,<body style="font-family:sans-serif;padding:40px"><h2 style="color:red">Error: index.html not found</h2><p>Path checked: ' + JSON.stringify([
      path.join(__dirname, 'src', 'index.html'),
      path.join(process.resourcesPath, 'src', 'index.html'),
    ]) + '</p></body>');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    const ip = getLocalIP();
    mainWindow.webContents.executeJavaScript(`
      (function(){
        if(document.getElementById('bs-bar')) return;
        const b=document.createElement('div');
        b.id='bs-bar';
        b.style.cssText='position:fixed;bottom:0;left:0;right:0;background:#1e40af;color:white;font-size:12px;padding:5px 16px;z-index:9999;display:flex;justify-content:space-between;font-family:sans-serif;align-items:center';
        b.innerHTML='<span>BizSuite Desktop &nbsp;|&nbsp; Mobile: <b>http://${ip}:${mobileServerPort}</b> (same WiFi)</span>';
        document.body.appendChild(b);
      })();
    `).catch(()=>{});
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const saved = readData();
    if (Object.keys(saved).length > 0) {
      mainWindow.webContents.executeJavaScript(
        `(function(){const d=${JSON.stringify(saved)};Object.keys(d).forEach(k=>{if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify(d[k]));});})();`
      ).catch(()=>{});
    }
    setInterval(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.executeJavaScript(
        `(function(){const s={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);try{s[k]=JSON.parse(localStorage.getItem(k));}catch(e){s[k]=localStorage.getItem(k);}}return s;})();`
      ).then(d => { if(d && Object.keys(d).length>0) writeData(d); }).catch(()=>{});
    }, 3000);
  });

  ipcMain.on('sync-from-mobile', (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(
        `(function(){const d=${JSON.stringify(data)};Object.keys(d).forEach(k=>localStorage.setItem(k,JSON.stringify(d[k])));})();`
      ).catch(()=>{});
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  const ip = getLocalIP();
  const menu = Menu.buildFromTemplate([
    { label: 'BizSuite', submenu: [
      { label: 'About', click: () => dialog.showMessageBox(mainWindow, { title:'BizSuite v2.0', message:'BizSuite v2.0\nOffline Desktop + Mobile Sync', buttons:['OK'] }) },
      { type: 'separator' },
      { label: 'Open Data Folder', click: () => shell.openPath(DATA_DIR) },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
    ]},
    { label: 'Invoice', submenu: [
      { label: 'New Invoice', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.executeJavaScript("showPage('create')").catch(()=>{}) },
      { label: 'Records', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.executeJavaScript("showPage('records')").catch(()=>{}) },
    ]},
    { label: 'Mobile Sync', submenu: [
      { label: 'Show Mobile URL', click: () => {
        dialog.showMessageBox(mainWindow, { title:'Mobile URL', message:`Open on phone browser:\n\nhttp://${ip}:${mobileServerPort}\n\nSame WiFi required!`, buttons:['OK','Copy'] })
          .then(r => { if(r.response===1) require('electron').clipboard.writeText(`http://${ip}:${mobileServerPort}`); });
      }}
    ]},
    { label: 'View', submenu: [
      { label: 'Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow?.reload() },
      { label: 'DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() },
      { type: 'separator' },
      { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => mainWindow?.webContents.setZoomFactor(mainWindow.webContents.getZoomFactor()+0.1) },
      { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => mainWindow?.webContents.setZoomFactor(mainWindow.webContents.getZoomFactor()-0.1) },
      { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => mainWindow?.webContents.setZoomFactor(1.0) },
      { type: 'separator' },
      { label: 'Full Screen', accelerator: 'F11', click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
    ]},
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  startMobileServer();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (mobileServer) mobileServer.close();
  if (process.platform !== 'darwin') app.quit();
});
