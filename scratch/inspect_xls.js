const path = require('path');
const xlsxPath = path.resolve(__dirname, '../server/node_modules/xlsx');
const xlsx = require(xlsxPath);

const filePath = '\\\\192.168.1.253\\Estrutura Lynx\\023-SGQ\\023-001-FORMULARIOS\\Espelho OS-Corte.xls';

try {
  const workbook = xlsx.readFile(filePath);
  console.log('SheetNames:', workbook.SheetNames);
  const sheet = workbook.Sheets['Import XLS'];
  if (!sheet) {
    console.error('Planilha Import XLS nao encontrada!');
    process.exit(1);
  }
  console.log('Ref range:', sheet['!ref']);
  
  // Print rows 1 to 20 to see the structure
  for (let r = 0; r < 20; r++) {
    const rowNum = r + 1;
    const aVal = sheet['A' + rowNum]?.v || '';
    const bVal = sheet['B' + rowNum]?.v || '';
    const hVal = sheet['H' + rowNum]?.v || '';
    const kVal = sheet['K' + rowNum]?.v || '';
    if (aVal || bVal || hVal || kVal) {
      console.log(`Row ${rowNum}: A=${aVal}, B=${bVal}, H=${hVal}, K=${kVal}`);
    }
  }
} catch (err) {
  console.error('Erro ao ler com xlsx:', err);
}
