const fs = require('fs');

const path = '\\\\192.168.1.253\\Estrutura Lynx\\023-SGQ\\023-001-FORMULARIOS\\Espelho OS-Corte.xls';

console.log('Verificando arquivo no caminho:', path);
try {
  const exists = fs.existsSync(path);
  console.log('Existe?', exists);
  if (exists) {
    const stats = fs.statSync(path);
    console.log('Tamanho em bytes:', stats.size);
  }
} catch (err) {
  console.error('Erro ao acessar o arquivo:', err);
}
