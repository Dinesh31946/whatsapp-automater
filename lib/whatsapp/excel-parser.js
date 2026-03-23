const XLSX = require('xlsx');

const parseExcel = (filePath) => {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        // Extract numbers (Assuming column name is "Number" or "Phone")
        const contacts = data.map(row => {
            const rawNumber = row.Number || row.Phone || row.phone || row.number || Object.values(row)[0];
            return {
                name: row.Name || row.name || "Customer",
                number: String(rawNumber).replace(/\D/g, '') // Clean it immediately
            };
        }).filter(c => c.number.length >= 10); // Basic validation

        return { success: true, contacts };
    } catch (error) {
        console.error("Excel Parse Error:", error);
        return { success: false, error: error.message };
    }
};

module.exports = { parseExcel };