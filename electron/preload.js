const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (channel, data) => {
        // Array of allowed channels for security
        const validChannels = [
            'activate-license', 
            'get-whatsapp-status', 
            'start-campaign', 
            'stop-campaign', 
            'upload-contacts', 
            'select-file', 
            'save-report', 
            'get-preview-data'
        ];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
    },
    onUpdate: (callback) => {
        ipcRenderer.on('whatsapp-update', (event, value) => callback(value));
    },
    onProgress: (callback) => {
        ipcRenderer.on('campaign-progress', (event, value) => callback(value));
    }
});