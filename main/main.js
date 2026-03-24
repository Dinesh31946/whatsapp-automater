const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const { sendMessage, sendMedia } = require('../lib/whatsapp/client');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const isDev = require('electron-is-dev');
const { initializeWhatsApp, getClient } = require('../lib/whatsapp/client');
const { parseExcel } = require('../lib/whatsapp/excel-parser');

// 1. REGISTER PROTOCOL BEFORE APP READY
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, allowServiceWorkers: true, supportFetchAPI: true } }
]);

let mainWindow;
let currentWhatsappStatus = "Initializing...";
let currentQrCode = "";
let isCampaignRunning = false;

function sendToRenderer() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('whatsapp-update', { status: currentWhatsappStatus, qr: currentQrCode });
    }
}

function createWindow() {
    const isPackaged = __dirname.includes('app.asar');
    const preloadPath = path.join(__dirname, '..', 'electron', 'preload.js');
    
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 900,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        },
    });

    mainWindow.setMenuBarVisibility(false);

    if (isDev && !isPackaged) {
        mainWindow.loadURL('http://localhost:3000');
    } else {
        // Load the index file using the custom app protocol
        mainWindow.loadURL('app://./index.html');
    }

    initializeWhatsApp(
        (qrCode) => { currentWhatsappStatus = "Scan QR"; currentQrCode = qrCode; sendToRenderer(); },
        () => { currentWhatsappStatus = "Authenticated"; sendToRenderer(); },
        () => { currentWhatsappStatus = "Ready"; currentQrCode = ""; sendToRenderer(); }
    );

    setInterval(() => {
        const client = getClient();
        if (client && client.info && currentWhatsappStatus !== "Ready") {
            currentWhatsappStatus = "Ready";
            currentQrCode = "";
            sendToRenderer();
        }
    }, 3000);
}

// 2. THE PATH INTERCEPTOR (FIXES ERR_FILE_NOT_FOUND)
app.whenReady().then(() => {
    protocol.registerFileProtocol('app', (request, callback) => {
        const url = request.url.replace('app://', '');
        // Force path to look inside the 'out' folder
        const filePath = path.normalize(path.join(__dirname, '..', 'out', url));
        callback({ path: filePath });
    });
    createWindow();
});

// --- IPC HANDLERS ---
ipcMain.handle('get-whatsapp-status', async () => ({ status: currentWhatsappStatus, qr: currentQrCode }));
ipcMain.handle('stop-campaign', async () => { isCampaignRunning = false; return { success: true }; });
ipcMain.handle('start-campaign', async (event, { contacts, message, filePath }) => {
    if (contacts.length > 250) throw new Error("Maximum 250 contacts allowed.");
    isCampaignRunning = true;
    const results = [];
    for (let i = 0; i < contacts.length; i++) {
        if (!isCampaignRunning) break; 
        const contact = contacts[i];
        const personalizedMessage = message.replace(/{{name}}/g, contact.name);
        try {
            if (filePath) await sendMedia(contact.number, filePath, personalizedMessage);
            else await sendMessage(contact.number, personalizedMessage);
            results.push({ name: contact.name, number: contact.number, success: true, time: new Date().toLocaleTimeString() });
        } catch (err) {
            results.push({ name: contact.name, number: contact.number, success: false, error: err.message, time: new Date().toLocaleTimeString() });
        }
        mainWindow.webContents.send('campaign-progress', { current: i + 1, total: contacts.length });
        if (i < contacts.length - 1 && isCampaignRunning) {
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 20000) + 20000));
        }
    }
    isCampaignRunning = false;
    return results;
});

ipcMain.handle('save-report', async (event, results) => {
    const { filePath } = await dialog.showSaveDialog({ title: 'Save Report', defaultPath: `Report_${Date.now()}.xlsx`, filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
    if (filePath) {
        const ws = XLSX.utils.json_to_sheet(results);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Results");
        XLSX.writeFile(wb, filePath);
        return { success: true };
    }
    return { success: false };
});

ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Media', extensions: ['jpg', 'png', 'pdf', 'docx', 'mp4'] }] });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('upload-contacts', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Excel', extensions: ['xlsx', 'xls', 'csv'] }] });
    return result.canceled ? null : parseExcel(result.filePaths[0]);
});

ipcMain.handle('get-preview-data', async (event, filePath) => {
    try {
        const data = fs.readFileSync(filePath);
        return { success: true, base64: `data:image/jpeg;base64,${data.toString('base64')}` };
    } catch (e) { return { success: false }; }
});