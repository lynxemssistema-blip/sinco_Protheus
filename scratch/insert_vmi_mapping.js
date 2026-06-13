const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysql = require('../server/services/mysqlService');

async function main() {
    try {
        const query = `
            INSERT INTO app_demanda_vmi_map (codigo_produto_cliente, b1_cod, descricao_protheus, z1_revisao)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE b1_cod = VALUES(b1_cod), descricao_protheus = VALUES(descricao_protheus), z1_revisao = VALUES(z1_revisao)
        `;
        
        const [result] = await mysql.query(query, [
            '33.03.10235.01', 
            'MT6-6240', 
            'PROTECAO MOTOPOLIA ESQUERDA', 
            '01'
        ]);
        console.log('Insert/Update result:', result);
    } catch (err) {
        console.error('Error inserting mapping:', err);
    } finally {
        process.exit(0);
    }
}
main();
