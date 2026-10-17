const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'server', '.env') });
async function test() {
    const pool = mysql.createPool({ host: '192.168.1.77', user: 'sinco', password: process.env.SINCO_MYSQL_PASSWORD || 'Pro1042@sm', database: 'metalfisa' });
    try {
        const [r1] = await pool.query('INSERT INTO app_faturamento_solicitacoes (numero_solicitacao, usuario) VALUES (?, ?)', ['FAT-DIRECT-001', 'TESTE']);
        const solId = r1.insertId;
        
        await pool.query('INSERT INTO app_faturamento_solicitacao_itens (solicitacao_id, pedido, item, codigo_produto, quantidade_solicitada, saldo_faturar_momentaneo, pedido_cliente, desenho_cliente) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [solId, '001', '01', 'A', 1, 0, 'MY-PED', 'MY-REF']);
        
        const [r2] = await pool.query('SELECT * FROM app_faturamento_solicitacao_itens WHERE solicitacao_id = ?', [solId]);
        console.log('RESULTADO DIRETO DB:', r2[0]);
    } catch(e) { console.error('ERRO:', e); } finally { pool.end(); }
}
test();
