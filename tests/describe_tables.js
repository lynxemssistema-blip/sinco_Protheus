const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const db = require('../server/services/mysqlService');

async function main() {
    const targets = [
        'app_faturamento_solicitacoes',
        'app_faturamento_solicitacao_itens',
        'faturamento_pre_etiquetas',
        'app_production_appointments',
        'erp_fornecedores',
        'sa2010',
        'sb2010',
        'sf2010',
        'sd2010',
        'app_sgq_rncs',
        'app_material_necessidades'
    ];

    for (const t of targets) {
        try {
            const [cols] = await db.query(`DESCRIBE \`${t}\``);
            console.log(`\n=== ${t} ===`);
            console.log(cols.map(c => `${c.Field} (${c.Type}${c.Null === 'NO' ? ' NOT NULL' : ''})`).join(', '));
        } catch (e) {
            console.log(`\n=== ${t} === ERROR: ${e.message}`);
        }
    }
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
