const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  onUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('whatsapp-update', subscription);
    return () => ipcRenderer.removeListener('whatsapp-update', subscription);
  },
  // ADD THIS: New listener for progress updates
  onProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('campaign-progress', subscription);
    return () => ipcRenderer.removeListener('campaign-progress', subscription);
  },

  saveReport: (data) => ipcRenderer.invoke('save-report', data),
});