const fs = require('fs');
const p1 = '\\\\192.168.1.253\\Engenharia\\desenhos\\COSTURA FLEX SOLUÇÕES EM CONFECÇÃO DE CORTINAS LTDA\\MT5-29193.pdf';
const p2 = '\\\\192.168.1.253\\Engenharia\\desenhos\\COSTURA FLEX SOLUÇÕES EM CONFECÇÃO DE CORTINAS LTDA';
console.log('Exists 1?', fs.existsSync(p1));
console.log('Exists 2?', fs.existsSync(p2));
if (fs.existsSync(p2)) {
    console.log('Files in folder:', fs.readdirSync(p2));
} else {
    // Try to find the folder "COSTURA FLEX..."
    const desenhos = '\\\\192.168.1.253\\Engenharia\\desenhos';
    if (fs.existsSync(desenhos)) {
        const folders = fs.readdirSync(desenhos).filter(f => f.toUpperCase().includes('COSTURA'));
        console.log('Similar folders:', folders);
    }
}
