const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printInvoice: (options) => ipcRenderer.invoke('print-invoice', options),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  isDesktop: true
});

