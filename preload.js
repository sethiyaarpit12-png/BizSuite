const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Logo/signature saved to AppData files (Priority 4)
  saveLogo: (firmId, type, data) => ipcRenderer.invoke('save-logo', { firmId, type, data }),
  getLogo:  (firmId, type)       => ipcRenderer.invoke('get-logo',  { firmId, type }),
  // Manual backup trigger
  doBackup: (label) => ipcRenderer.invoke('do-backup', label),
  getBackupPath: () => ipcRenderer.invoke('get-backup-path'),
  // Invoice saved notification (triggers auto-backup)
  invoiceSaved: (invNo) => ipcRenderer.send('invoice-saved', invNo),
  // Platform info
  platform: process.platform,
  version: process.versions.electron
});
