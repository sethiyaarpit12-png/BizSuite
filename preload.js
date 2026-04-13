const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  onSyncFromMobile: (callback) => ipcRenderer.on('sync-from-mobile', (event, data) => callback(data)),
  platform: process.platform,
  version: process.versions.electron
});
