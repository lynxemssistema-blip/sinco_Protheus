const mysql = require('mysql2/promise');
require('dotenv').config({path: './server/.env'});

async function run() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    const codigo = 'MT3-10132';

    const [rows] = await pool.execute(`
             SELECT p.id, p.url_arquivo, p.tipo, p.produto_codigo as origem 
             FROM produtos_docs p
             WHERE p.produto_codigo = ? 
             
             UNION ALL
             
             SELECT p.id, p.url_arquivo, p.tipo, a.produto_origem as origem
             FROM app_produto_associacoes a
             JOIN produtos_docs p ON p.produto_codigo = a.produto_destino
             WHERE a.produto_origem = ?
             
             ORDER BY CASE WHEN tipo = 'Desenho' THEN 1 ELSE 2 END, id DESC 
             LIMIT 1
             `, [codigo, codigo]);

    console.log("Raw DB Result:", rows);

    if (rows.length > 0) {
        let normalizedPath = rows[0].url_arquivo.trim();
        normalizedPath = normalizedPath.replace(/^Q:[\/\\]/i, '\\\\192.168.1.253\\Engenharia\\');
        console.log("Normalized Path passed to Gemini:", normalizedPath);
    } else {
        console.log("No document found in docs or associations table.");
    }
    
    pool.end();
}

run();
