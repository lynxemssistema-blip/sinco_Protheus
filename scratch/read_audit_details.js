const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function readAudit() {
    try {
        console.log('--- Reading faturamento audit details ---');
        const [rows] = await mysqlPool.query(
            "SELECT * FROM app_faturamento_auditoria WHERE acao = 'APONTAMENTO_PROTHEUS_ERRO' ORDER BY id DESC LIMIT 5"
        );
        rows.forEach(r => {
            console.log(`\nID: ${r.id} | Solicitacao ID: ${r.solicitacao_id} | Usuario: ${r.usuario} | Data: ${r.criado_em}`);
            let details = r.detalhes;
            if (typeof details === 'string') {
                try {
                    details = JSON.parse(details);
                } catch(e) {}
            }
            console.log(JSON.stringify(details, null, 2));
        });
    } catch (err) {
        console.error('Error reading audit:', err);
    } finally {
        process.exit(0);
    }
}

readAudit();
