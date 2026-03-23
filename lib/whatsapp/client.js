const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs'); // Added fs to read files
const path = require('path');
const mime = require('mime-types'); // We installed this in Phase 1

let client;

const initializeWhatsApp = (onQrReady, onAuthenticated, onReady) => {
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './sessions' // This creates a folder to save your login session
        }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    // Event: QR Code Received
    client.on('qr', async (qr) => {
        console.log('QR RECEIVED', qr);
        try {
            const qrImage = await qrcode.toDataURL(qr);
            onQrReady(qrImage); // Send the base64 image to the UI
        } catch (err) {
            console.error('Error generating QR code', err);
        }
    });

    

    // Event: Authenticated (Login success)
    client.on('authenticated', () => {
        console.log('AUTHENTICATED');
        onAuthenticated();
    });

    // Event: Ready (Client is synced and usable)
    client.on('ready', () => {
        console.log('WHATSAPP READY');
        onReady();
    });

    client.initialize();
    
    return client;
};

const getClient = () => client;

const sendMessage = async (number, message) => {
    try {
        const c = getClient();
        if (!c) throw new Error("WhatsApp client not initialized");

        // 1. Clean the number (remove +, spaces, dashes)
        let cleanedNumber = number.replace(/\D/g, '');

        // 2. Check if the number is registered on WhatsApp and get correct ID
        // This solves the "No LID for user" error
        const numberId = await c.getNumberId(cleanedNumber);

        if (!numberId) {
            throw new Error("The number is not registered on WhatsApp.");
        }

        // 3. Send using the verified ID (_serialized contains the @c.us part correctly)
        const response = await c.sendMessage(numberId._serialized, message);
        
        return { success: true, response };
    } catch (error) {
        console.error("Detailed Send Error:", error);
        return { success: false, error: error.message };
    }
};

const sendMedia = async (number, filePath, caption = "") => {
    try {
        const c = getClient();
        
        // 1. Verify Number
        let cleanedNumber = number.replace(/\D/g, '');
        const numberId = await c.getNumberId(cleanedNumber);
        if (!numberId) throw new Error("Number not found");

        // 2. Prepare Media
        // Read file from local path and convert to Base64
        const fileData = fs.readFileSync(filePath);
        const base64Data = fileData.toString('base64');
        const mimeType = mime.lookup(filePath); // Automatically finds image/png, application/pdf, etc.
        const fileName = path.basename(filePath);

        const media = new MessageMedia(mimeType, base64Data, fileName);

        // 3. Send
        const response = await c.sendMessage(numberId._serialized, media, { caption });
        return { success: true, response };
    } catch (error) {
        console.error("Media Send Error:", error);
        return { success: false, error: error.message };
    }
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

module.exports = { initializeWhatsApp, getClient, sendMessage, sendMedia, delay };