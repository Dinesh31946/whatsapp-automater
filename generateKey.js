const crypto = require('crypto');

// MUST be the exact same salt as in your main.js
const SECRET_SALT = 'DINESH_WHATSAPP_PRO_2026'; 

function generateValidKey(machineId) {
    return crypto.createHash('sha256')
        .update(machineId + SECRET_SALT)
        .digest('hex')
        .substring(0, 16)
        .toUpperCase();
}

// PASTE THE MACHINE ID FROM YOUR SCREEN HERE:
const userMachineId = '7aba2ae688ac0802a77544360ae37f4cd7e37c1380d79a9bbdfb9c61a4f0ac86'; 
console.log("The License Key is:", generateValidKey(userMachineId));