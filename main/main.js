const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { sendMessage, sendMedia, delay } = require('../lib/whatsapp/client'); // Added delay here
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const { initializeWhatsApp } = require('../lib/whatsapp/client');
const { parseExcel } = require('../lib/whatsapp/excel-parser');
const { getClient } = require('../lib/whatsapp/client');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300, // Slightly wider for the new dashboard
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, 
    },
  });

  const url = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../out/index.html')}`;
  
  mainWindow.loadURL(url);

  // Initialize WhatsApp and send status updates to the Frontend
  initializeWhatsApp(
    (qrCode) => mainWindow.webContents.send('whatsapp-qr', qrCode),
    () => mainWindow.webContents.send('whatsapp-status', 'Authenticated'),
    () => mainWindow.webContents.send('whatsapp-status', 'Ready')
  );
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---

// 1. Bulk Campaign Handler (The Core Logic)
ipcMain.handle('start-campaign', async (event, { contacts, message, filePath }) => {
    const results = [];
    
    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        
        // Personalize: Replace {{name}} with the name from Excel
        const personalizedMessage = message.replace(/{{name}}/g, contact.name);
        
        let res;
        try {
            if (filePath) {
                // Send as Media with caption
                res = await sendMedia(contact.number, filePath, personalizedMessage);
            } else {
                // Send as plain text
                res = await sendMessage(contact.number, personalizedMessage);
            }
            results.push({ number: contact.number, success: res.success });
        } catch (err) {
            results.push({ number: contact.number, success: false, error: err.message });
        }

        // Send progress update to UI
        mainWindow.webContents.send('campaign-progress', { 
            current: i + 1, 
            total: contacts.length 
        });

        // 30-Second Security Delay (Don't wait after the last message)
        if (i < contacts.length - 1) {
            console.log(`Message ${i+1} sent. Waiting 30 seconds...`);
            await delay(30000); 
        }
    }
    return results;
});

// 2. Handler to Pick a File
ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Media', extensions: ['jpg', 'png', 'pdf', 'docx', 'mp4'] }
        ]
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

// 3. Handler to select and parse Excel
ipcMain.handle('upload-contacts', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls', 'csv'] }]
    });
    if (result.canceled) return null;
    return parseExcel(result.filePaths[0]);
});

// 4. Legacy/Test Handlers (Kept for debugging)
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

ipcMain.handle('get-whatsapp-status', async () => {
  const client = getClient();
  // Check if client exists and is authenticated
  if (client && client.info) {
    return "Ready";
  }
  return "Initializing...";
});