/**
 * capture-server.js
 * Servidor TCP que salva em arquivo tudo que recebe.
 * Usado para capturar o que o driver PPLA envia.
 */
const net = require('net');
const fs  = require('fs');
const OUT = __dirname + '/captured_ppla.bin';

let jobCount = 0;

const server = net.createServer((s) => {
    jobCount++;
    const id = jobCount;
    const chunks = [];
    s.on('data', c => chunks.push(c));
    s.on('end', () => {
        const buf = Buffer.concat(chunks);
        const outFile = `${__dirname}/captured_${id}.bin`;
        fs.writeFileSync(outFile, buf);
        console.log(`[Job ${id}] ${buf.length} bytes → ${outFile}`);
        // Mostra primeiros 200 bytes como hex + printable
        const hex = buf.slice(0,200).toString('hex').replace(/(..)/g,'$1 ');
        const txt = buf.slice(0,200).toString('latin1').replace(/[^\x20-\x7E\r\n]/g,'.');
        console.log('HEX:', hex);
        console.log('TXT:', txt);
    });
    s.on('error', e => console.error('Socket error:', e.message));
});

server.listen(9101, '127.0.0.1', () => {
    console.log('Captura ativa em 127.0.0.1:9101');
    console.log('Aguardando dados do driver PPLA...');
});
