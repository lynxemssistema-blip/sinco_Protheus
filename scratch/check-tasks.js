const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const mysqlPool = require('../server/services/mysqlService');

async function checkTasks() {
    try {
        console.log('Consultando status das tarefas do Hermes no MySQL...');
        const [rows] = await mysqlPool.query('SELECT id, nome, status_last_run, last_run, cron_expression, ativo FROM hermes_tasks');
        console.log('\n--- STATUS DAS TAREFAS ---');
        console.table(rows.map(r => ({
            ID: r.id,
            Nome: r.nome,
            Ativo: r.ativo ? 'SIM' : 'NÃO',
            Status: r.status_last_run || 'NUNCA EXECUTADO',
            'Última Execução': r.last_run ? r.last_run.toLocaleString('pt-BR') : '-'
        })));
    } catch (err) {
        console.error('Erro ao consultar tarefas:', err.stack || err.message);
    } finally {
        // give pool time to close if needed, but process.exit is fine
        process.exit(0);
    }
}

checkTasks();
