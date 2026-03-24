const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const { sendMessage, sendMedia } = require('../lib/whatsapp/client');
const { machineIdSync } = require('node-machine-id');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const isDev = require('electron-is-dev');
const { initializeWhatsApp, getClient } = require('../lib/whatsapp/client');
const { parseExcel } = require('../lib/whatsapp/excel-parser');

// --- 🛡️ SECURITY & PATH CONFIG ---
const SECRET_SALT = "DINESH_WHATSAPP_PRO_2026"; 
const LICENSE_PATH = path.join(app.getPath('userData'), 'license.json');

/**
 * 🚀 PRODUCTION FIX: ASAR PATH RESOLVER
 * Based on your manual check, the file is in the /electron folder.
 */
const getPreloadPath = () => {
    // This is where your asar extract showed the file is located
    const productionPath = path.join(__dirname, '..', 'electron', 'preload.js');
    const devPath = path.join(__dirname, 'preload.js');

    if (fs.existsSync(productionPath)) return productionPath;
    if (fs.existsSync(devPath)) return devPath;

    // Last ditch effort: search the whole app directory
    return path.join(app.getAppPath(), 'electron', 'preload.js');
};

// --- SECURITY LOGIC ---
function generateValidKey(machineId) {
    return crypto.createHash('sha256')
        .update(machineId + SECRET_SALT)
        .digest('hex')
        .substring(0, 16)
        .toUpperCase();
}

// --- UPDATED SECURITY LOGIC ---
function isAuthorized() {
    if (!fs.existsSync(LICENSE_PATH)) return false;
    try {
        const devId = machineIdSync();
        const saved = JSON.parse(fs.readFileSync(LICENSE_PATH, 'utf8'));
        const expectedKey = generateValidKey(devId);
        
        console.log("Checking License...");
        console.log("Device ID:", devId);
        console.log("Saved Key:", saved.key);
        console.log("Expected Key:", expectedKey);

        return saved.key === expectedKey;
    } catch (e) { 
        console.error("License Check Error:", e);
        return false; 
    }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, allowServiceWorkers: true, supportFetchAPI: true } },
  { scheme: 'auth', privileges: { standard: true, secure: true } }
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
    const devId = machineIdSync();
    
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 900,
        backgroundColor: '#0F172A',
        show: false,
        webPreferences: {
            preload: getPreloadPath(),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        },
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.once('ready-to-show', () => mainWindow.show());

    if (isAuthorized() || (isDev && !__dirname.includes('app.asar'))) {
        if (isDev && !__dirname.includes('app.asar')) {
            mainWindow.loadURL('http://localhost:3000');
        } else {
            mainWindow.loadURL('app://./index.html');
        }

        initializeWhatsApp(
            (qrCode) => { currentWhatsappStatus = "Scan QR"; currentQrCode = qrCode; sendToRenderer(); },
            () => { currentWhatsappStatus = "Authenticated"; sendToRenderer(); },
            () => { currentWhatsappStatus = "Ready"; currentQrCode = ""; sendToRenderer(); }
        );
    } else {
        mainWindow.loadURL('auth://activate');
    }

    setInterval(() => {
        const client = getClient();
        if (client && client.info && currentWhatsappStatus !== "Ready") {
            currentWhatsappStatus = "Ready";
            currentQrCode = "";
            sendToRenderer();
        }
    }, 3000);
}

app.whenReady().then(() => {
    protocol.registerFileProtocol('app', (request, callback) => {
        const url = request.url.replace('app://', '');
        const filePath = path.normalize(path.join(__dirname, '..', 'out', url));
        callback({ path: filePath });
    });

    protocol.handle('auth', () => {
        const devId = machineIdSync();
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { background:#0F172A; color:white; font-family:sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
                    .card { background:#1E293B; padding:40px; border-radius:24px; text-align:center; width:400px; border:1px solid #334155; }
                    .id-box { background:#0F172A; padding:12px; border-radius:8px; font-family:monospace; font-size:11px; border:1px solid #334155; margin:10px 0 20px; color:#38BDF8; word-break:break-all; }
                    input { width:100%; padding:14px; border-radius:10px; border:1px solid #334155; background:#0F172A; color:white; margin-bottom:20px; box-sizing:border-box; outline:none; text-align:center; font-family:monospace; }
                    button { width:100%; padding:14px; background:#2563EB; color:white; border:none; border-radius:10px; font-weight:bold; cursor:pointer; }
                    #m { color:#EF4444; font-size:12px; margin-top:15px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2 style="margin:0">Activation Required</h2>
                    <p style="color:#94A3B8; font-size:13px;">Provide this ID for your License Key</p>
                    <div class="id-box">${devId}</div>
                    <input id="k" placeholder="ENTER LICENSE KEY" maxlength="16" />
                    <button id="btn">ACTIVATE NOW</button>
                    <p id="m"></p>
                </div>
                <script>
                    const btn = document.getElementById('btn');
                    const msg = document.getElementById('m');
                    btn.onclick = async () => {
                        const key = document.getElementById('k').value.trim().toUpperCase();
                        if(!key) return;
                        btn.innerText = "Verifying...";
                        const res = await window.electronAPI.invoke('activate-license', key);
                        
                        if(res.success) { 
                            // No reload needed! The main process will change the URL for us.
                            btn.innerText = "Success! Loading...";
                        } else { 
                            msg.innerText = "Invalid License Key"; 
                            btn.innerText = "ACTIVATE NOW"; 
                        }
                    };
                </script>
            </body>
            </html>`;
        return new Response(html, { headers: { 'content-type': 'text/html' } });
    });

    createWindow();
});

// --- IPC HANDLERS ---
// --- UPDATED IPC HANDLER ---
ipcMain.handle('activate-license', async (event, key) => {
    const devId = machineIdSync();
    const expected = generateValidKey(devId);
    
    if (key.trim().toUpperCase() === expected.trim().toUpperCase()) {
        // 1. Save the license
        fs.writeFileSync(LICENSE_PATH, JSON.stringify({ key: key.trim().toUpperCase() }));
        
        // 2. INSTEAD OF RELOADING IN HTML, WE REDIRECT HERE IN MAIN
        if (isDev && !__dirname.includes('app.asar')) {
            mainWindow.loadURL('http://localhost:3000');
        } else {
            mainWindow.loadURL('app://./index.html');
        }

        // 3. Start WhatsApp logic immediately
        initializeWhatsApp(
            (qrCode) => { currentWhatsappStatus = "Scan QR"; currentQrCode = qrCode; sendToRenderer(); },
            () => { currentWhatsappStatus = "Authenticated"; sendToRenderer(); },
            () => { currentWhatsappStatus = "Ready"; currentQrCode = ""; sendToRenderer(); }
        );

        return { success: true };
    }
    return { success: false };
});

ipcMain.handle('get-whatsapp-status', async () => ({ status: currentWhatsappStatus, qr: currentQrCode }));
ipcMain.handle('stop-campaign', async () => { 
    isCampaignRunning = false; 
    // Small delay to let the loop exit before the frontend refreshes
    await new Promise(r => setTimeout(r, 500));
    return { success: true }; 
});
ipcMain.handle('start-campaign', async (event, { contacts, message, filePath }) => {
    isCampaignRunning = true;
    for (let i = 0; i < contacts.length; i++) {
        if (!isCampaignRunning) break; 
        const contact = contacts[i];
        const personalizedMessage = message.replace(/{{name}}/g, contact.name);
        try {
            if (filePath) await sendMedia(contact.number, filePath, personalizedMessage);
            else await sendMessage(contact.number, personalizedMessage);
        } catch (err) { console.error(err); }
        mainWindow.webContents.send('campaign-progress', { current: i + 1, total: contacts.length });
        if (i < contacts.length - 1 && isCampaignRunning) {
            await new Promise(r => setTimeout(r, 20000 + Math.random() * 20000));
        }
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('campaign-finished', { success: true });
    }
    isCampaignRunning = false;
    return { success: true };
});

ipcMain.handle('save-report', async (event, results) => {
    try {
        const { filePath } = await dialog.showSaveDialog({
            title: 'Save Campaign Report',
            defaultPath: path.join(app.getPath('downloads'), `whatsapp_report_${Date.now()}.xlsx`),
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        });

        if (!filePath) return { success: false };

        // Convert the campaign results array to an Excel sheet
        const worksheet = XLSX.utils.json_to_sheet(results);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Campaign Report");

        // Write the file to the chosen path
        XLSX.writeFile(workbook, filePath);

        return { success: true };
    } catch (error) {
        console.error("Export Error:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'] });
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