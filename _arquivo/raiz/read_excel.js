const fs = require('fs');
const xlsx = require('./server/node_modules/xlsx');

try {
    const filePath = 'C:\\Users\\adm\\Downloads\\FALTANTES JUNHO-METALFISA (1).xlsx';
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log('Row 1:', data[1].slice(10, 30));
    console.log('Row 2:', data[2].slice(10, 30));
    console.log('Row 3:', data[3].slice(10, 30));
} catch (error) {
    console.error('Error reading Excel:', error);
}
