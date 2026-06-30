const net = require('net');

// Teste PPLB simples - apenas texto, sem bitmap
const pplb = Buffer.from(
    'N\r\n' +
    'OT\r\n' +
    'Q440,24\r\n' +
    'q600\r\n' +
    'A50,50,0,4,1,1,N,"TESTE METALFISA"\r\n' +
    'A50,100,0,3,1,1,N,"Argox OS-214 Plus"\r\n' +
    'P1\r\n',
    'latin1'
);

console.log('=== DIAGNÓSTICO DO MOTOR DE IMPRESSÃO ===');
console.log('Tamanho do pacote PPLB:', pplb.length, 'bytes');
console.log('Conteúdo:');
console.log(pplb.toString('ascii'));
console.log('========================================');
console.log('Conectando em 127.0.0.1:9100...');

const s = new net.Socket();
s.setTimeout(5000);

s.connect(9100, '127.0.0.1', () => {
    console.log('✅ Conectado! Enviando dados PPLB...');
    s.write(pplb, (err) => {
        if (err) {
            console.error('❌ Erro ao escrever:', err.message);
        } else {
            console.log('✅ Dados enviados com sucesso!');
        }
        s.end();
    });
});

s.on('data', (d) => console.log('Resposta da impressora:', d.toString('hex')));
s.on('error', (e) => console.error('❌ Erro de socket:', e.message));
s.on('close', () => console.log('Socket fechado. Verifique se a impressora imprimiu!'));
s.on('timeout', () => { console.error('❌ Timeout!'); s.destroy(); });
