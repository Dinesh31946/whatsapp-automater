const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { sendMessage, sendMedia, delay } = require('../lib/whatsapp/client');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const { initializeWhatsApp, getClient } = require('../lib/whatsapp/client');
const { parseExcel } = require('../lib/whatsapp/excel-parser');

let mainWindow;
// PERSISTENT GLOBAL STATE
let globalState = {
    status: "Initializing...",
    qr: ""
};

let currentWhatsappStatus = "Initializing...";
let currentQrCode = "";

// 🔥 CENTRALIZED SENDER
    function sendToRenderer() {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('whatsapp-update', {
            status: currentWhatsappStatus,
            qr: currentQrCode
            });
        }
    }

function createWindow() {
    const preloadPath = path.resolve(process.cwd(), 'electron', 'preload.js');
    
    console.log("👉 ATTEMPTING TO LOAD PRELOAD AT:", preloadPath); 

    mainWindow = new BrowserWindow({
        width: 1300,
        height: 900,
        webPreferences: {
            preload: preloadPath, // Guaranteed absolute path
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    const url = isDev
        ? 'http://localhost:3000'
        : `file://${path.join(__dirname, '../out/index.html')}`;

    mainWindow.loadURL(url);

    // Ensure WhatsApp initialization stays exactly as you had it
    initializeWhatsApp(
        (qrCode) => {
            currentWhatsappStatus = "Scan QR";
            currentQrCode = qrCode;
            sendToRenderer();
        },
        () => {
            currentWhatsappStatus = "Authenticated";
            sendToRenderer();
        },
        () => {
            currentWhatsappStatus = "Ready";
            currentQrCode = "";
            sendToRenderer();
        }
    );

    setInterval(() => {
        const client = getClient();
        if (client && client.info) {
            if (currentWhatsappStatus !== "Ready") {
                currentWhatsappStatus = "Ready";
                currentQrCode = "";
                sendToRenderer();
            }
        }
    }, 3000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---

// GUARANTEED STATUS POLLING
ipcMain.handle('get-whatsapp-status', async () => {
  return {
    status: currentWhatsappStatus,
    qr: currentQrCode
  };
});

ipcMain.handle('start-campaign', async (event, { contacts, message, filePath }) => {
    const results = [];
    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        const personalizedMessage = message.replace(/{{name}}/g, contact.name);
        let res;
        try {
            if (filePath) {
                res = await sendMedia(contact.number, filePath, personalizedMessage);
            } else {
                res = await sendMessage(contact.number, personalizedMessage);
            }
            results.push({ number: contact.number, success: res.success });
        } catch (err) {
            results.push({ number: contact.number, success: false, error: err.message });
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('campaign-progress', {
                current: i + 1,
                total: contacts.length
            });
        }

        if (i < contacts.length - 1) {
            await delay(30000);
        }
    }
    return results;
});

ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Media', extensions: ['jpg', 'png', 'pdf', 'docx', 'mp4'] }]
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('upload-contacts', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls', 'csv'] }]
    });
    return result.canceled ? null : parseExcel(result.filePaths[0]);
});

ipcMain.handle('send-test-message', async (event, { number, message }) => {
    return await sendMessage(number, message);
});

ipcMain.handle('send-media-message', async (event, { number, filePath, caption }) => {
    return await sendMedia(number, filePath, caption);
});

ipcMain.handle('get-preview-data', async (event, filePath) => {
    try {
        const stats = fs.statSync(filePath);
        if (stats.size > 10 * 1024 * 1024) return { error: "File too large for preview" };
        const data = fs.readFileSync(filePath);
        const base64 = data.toString('base64');
        const extension = path.extname(filePath).toLowerCase();
        let mimeType = "image/jpeg";
        if (extension === ".png") mimeType = "image/png";
        if (extension === ".gif") mimeType = "image/gif";
        if (extension === ".pdf") mimeType = "application/pdf";
        return { success: true, base64: `data:${mimeType};base64,${base64}`, mimeType };
    } catch (e) {
        return { success: false, error: e.message };
    }
});