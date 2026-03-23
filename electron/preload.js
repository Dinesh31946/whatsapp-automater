const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  onUpdate: (callback) => {
    // Strips the 'event' argument so the frontend gets clean data
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('whatsapp-update', subscription);
    return () => ipcRenderer.removeListener('whatsapp-update', subscription);
  }
});