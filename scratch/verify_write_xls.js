const path = require('path');
const xlsxPath = path.resolve(__dirname, '../server/node_modules/xlsx');
const xlsx = require(xlsxPath);

const outputPath = path.resolve(__dirname, 'test_output_espelho.xls');

try {
  console.log('Lendo arquivo de saida...');
  const workbook = xlsx.readFile(outputPath);
  console.log('SheetNames:', workbook.SheetNames);
  const sheet = workbook.Sheets['Import XLS'];
  if (!sheet) {
    console.error('Planilha Import XLS nao encontrada!');
    process.exit(1);
  }
  console.log('Ref range:', sheet['!ref']);
  
  // Imprimir primeiras 10 linhas
  for (let r = 0; r < 12; r++) {
    const rowNum = r + 1;
    console.log(`Row ${rowNum}: A=${sheet['A' + rowNum]?.v || ''}, B=${sheet['B' + rowNum]?.v || ''}, H=${sheet['H' + rowNum]?.v || ''}, K=${sheet['K' + rowNum]?.v || ''}`);
  }
} catch (err) {
  console.error('Erro ao ler:', err);
}
