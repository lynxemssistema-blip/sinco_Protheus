const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const db = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        const fotos = [ { data: 'base64...', observacao: 'Teste' } ];
        const [result] = await db.query(`
            INSERT INTO pcp_manutencao_ordens 
            (id_maquina, solicitante_id, sintoma, tipo, prioridade, fotos) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            1,
            1,
            'Descrição teste',
            'CORRETIVA',
            'MEDIA',
            JSON.stringify(fotos)
        ]);
        console.log('INSERT ok, id:', result.insertId);
        await db.query('DELETE FROM pcp_manutencao_ordens WHERE id = ?', [result.insertId]);
    } catch(e) {
        console.error('SQL ERROR:', e.message);
    } finally {
        await db.end();
    }
}
run();
