/**
 * tests/run_all.js
 * Orquestrador Geral de Testes - MODO DE AUTONOMIA TOTAL
 * Executa todas as suítes de testes unitários e de integração
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

console.log('=====================================================');
console.log('🧪 INICIANDO SUÍTE COMPLETA DE TESTES - SINCO PROTHEUS');
console.log('=====================================================');

const testSuites = [
    './unit/erpValidation.test.js',
    './unit/dbAdapter.test.js',
    './unit/opExplosion.test.js',
    './unit/productionTracking.test.js'
];

let totalPassed = 0;
let totalFailed = 0;
const results = [];

async function runSuites() {
    for (const suitePath of testSuites) {
        console.log(`\n▶ Executando: ${suitePath}`);
        try {
            require(suitePath);
            results.push({ suite: suitePath, status: 'PASSED' });
        } catch (err) {
            console.error(`❌ Falha na suíte ${suitePath}:`, err.message);
            results.push({ suite: suitePath, status: 'FAILED', error: err.message });
            totalFailed++;
        }
    }
}

runSuites().then(() => {
    console.log('\n=====================================================');
    console.log('📊 RESUMO FINAL DA AUDITORIA DE TESTES');
    console.log('=====================================================');
    console.table(results);
    setTimeout(() => process.exit(totalFailed > 0 ? 1 : 0), 1000);
});
