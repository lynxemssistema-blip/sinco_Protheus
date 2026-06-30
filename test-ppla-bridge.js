const net = require('net');

// PPLA puro: ESC@ + Q + q + A + P (sem N, OT, JF, ZB que são PPLB exclusivos)
const packet = Buffer.concat([
    Buffer.from([0x1B, 0x40, 0x0D, 0x0A]),         // ESC @ \r\n  (reset PPLA)
    Buffer.from('Q440,24\r\n', 'latin1'),
    Buffer.from('q600\r\n', 'latin1'),
    Buffer.from('A50,80,0,4,1,1,N,"BRIDGE V3 PPLA"\r\n', 'latin1'),
    Buffer.from('A50,140,0,3,1,1,N,"OS-214 Direto USB"\r\n', 'latin1'),
    Buffer.from('P1\r\n', 'latin1'),
]);

console.log('=== TESTE PPLA via Bridge v3 ===');
console.log('Bytes:', packet.length);

const s = new net.Socket();
s.setTimeout(6000);
s.connect(9100, '127.0.0.1', () => {
    console.log('Conectado. Enviando...');
    s.write(packet, () => {
        console.log('Enviado! Aguarde impressao...');
        s.end();
    });
});
s.on('error', (e) => console.error('ERRO:', e.message));
s.on('timeout', () => { console.error('Timeout'); s.destroy(); });
s.on('close', () => console.log('Conexao fechada.'));
