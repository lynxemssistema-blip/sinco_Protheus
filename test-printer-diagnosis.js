/**
 * test-printer-diagnosis.js
 * Envia 4 variantes de comando para identificar o modo da impressora.
 *
 * Hipóteses testadas:
 *   A - Minimal (sem N, sem OT) — compatível com PPLA e PPLB
 *   B - PPLB + OD (Direct Thermal, sem ribbon)
 *   C - PPLB + OT (Thermal Transfer, com ribbon)  — padrão atual do sistema
 *   D - PPLA nativo (ESC@ reset + comandos PPLA)
 */

const net = require('net');

const HOST = '127.0.0.1';
const PORT = 9100;
const DELAY_MS = 4000; // espera entre testes (impressora precisa de tempo)

const TESTS = [
    {
        label: 'A — Minimal (sem N, sem O*, PPLA+PPLB compatível)',
        data: Buffer.from(
            'Q440,24\r\n' +
            'q600\r\n' +
            'A50,50,0,4,1,1,N,"TESTE A - MINIMAL"\r\n' +
            'P1\r\n',
            'latin1'
        ),
    },
    {
        label: 'B — PPLB + OD (Direct Thermal, SEM ribbon)',
        data: Buffer.from(
            'N\r\n' +
            'OD\r\n' +
            'Q440,24\r\n' +
            'q600\r\n' +
            'A50,50,0,4,1,1,N,"TESTE B - DIRECT THERMAL"\r\n' +
            'P1\r\n',
            'latin1'
        ),
    },
    {
        label: 'C — PPLB + OT (Thermal Transfer, COM ribbon) [modo atual]',
        data: Buffer.from(
            'N\r\n' +
            'OT\r\n' +
            'Q440,24\r\n' +
            'q600\r\n' +
            'A50,50,0,4,1,1,N,"TESTE C - THERMAL TRANSFER"\r\n' +
            'P1\r\n',
            'latin1'
        ),
    },
    {
        label: 'D — PPLA nativo (ESC @ reset)',
        data: Buffer.concat([
            Buffer.from([0x1B, 0x40]),          // ESC @ = reset PPLA
            Buffer.from('\r\n', 'latin1'),
            Buffer.from('Q440,024\r\n', 'latin1'),
            Buffer.from('q600\r\n', 'latin1'),
            Buffer.from('A50,50,0,4,1,1,N,"TESTE D - PPLA"\r\n', 'latin1'),
            Buffer.from('P1\r\n', 'latin1'),
        ]),
    },
];

function sendTest(test, index) {
    return new Promise((resolve) => {
        console.log(`\n[Teste ${String.fromCharCode(65+index)}] ${test.label}`);
        console.log(`  Bytes: ${test.data.length}`);
        console.log(`  Conteúdo: ${test.data.toString('latin1').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '?').split('\n').join('\\n')}`);

        const s = new net.Socket();
        s.setTimeout(5000);

        s.connect(PORT, HOST, () => {
            s.write(test.data, () => {
                console.log(`  → Enviado. Aguardando ${DELAY_MS/1000}s...`);
                s.end();
            });
        });

        s.on('error', (e) => {
            console.error(`  ❌ Erro: ${e.message}`);
        });

        s.on('close', () => {
            setTimeout(resolve, DELAY_MS);
        });
    });
}

async function runAll() {
    console.log('=================================================');
    console.log('  DIAGNÓSTICO COMPLETO DA IMPRESSORA ARGOX');
    console.log('=================================================');
    console.log(`Host: ${HOST}:${PORT}`);
    console.log('');
    console.log('INSTRUÇÕES:');
    console.log('  Observe QUAL etiqueta imprime (A, B, C ou D).');
    console.log('  Haverá 4 segundos entre cada teste.');
    console.log('  Se NENHUMA imprimir, o problema é no DIP switch.');
    console.log('=================================================\n');

    for (let i = 0; i < TESTS.length; i++) {
        await sendTest(TESTS[i], i);
    }

    console.log('\n=================================================');
    console.log('  RESULTADO ESPERADO:');
    console.log('');
    console.log('  Se A imprimiu → passe para instruções DIP Switch');
    console.log('  Se B imprimiu → impressora é Direct Thermal (sem ribbon)');
    console.log('  Se C imprimiu → já estava funcionando (verify ribbon)');
    console.log('  Se D imprimiu → impressora está em modo PPLA');
    console.log('  Se NADA imprimiu → DIP switch em modo errado ou problema USB');
    console.log('=================================================\n');
}

runAll();
