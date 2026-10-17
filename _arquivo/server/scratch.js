const mysqlPool = require('./services/mysqlService'); 
async function main() { 
    try { 
        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS pcp_manutencao_checklists_preenchidos ( 
            id INT AUTO_INCREMENT PRIMARY KEY, 
            modelo_id INT NOT NULL, 
            maquina_id INT NOT NULL, 
            operador_id INT, 
            operador_nome VARCHAR(255), 
            data_preenchimento DATETIME DEFAULT CURRENT_TIMESTAMP, 
            respostas JSON, 
            status VARCHAR(50) DEFAULT 'CONFORME', 
            observacoes TEXT 
        )`); 
        console.log('Tabela criada!'); 
        process.exit(0); 
    } catch(e) { 
        console.error(e); 
        process.exit(1); 
    } 
} 
main();
