const db = require('./services/mysqlService'); 
async function createTables() { 
    try { 
        await db.query(`CREATE TABLE IF NOT EXISTS app_wabtec_bom (
            id INT AUTO_INCREMENT PRIMARY KEY, 
            lote_id INT NOT NULL, 
            estrutura_id INT NOT NULL, 
            desenho_cliente VARCHAR(100), 
            protheus_cod VARCHAR(50), 
            nivel INT, 
            componente_cod VARCHAR(50), 
            descricao VARCHAR(255), 
            um VARCHAR(10), 
            quantidade DECIMAL(15,4), 
            quantidade_total DECIMAL(15,4), 
            data_extracao TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
            FOREIGN KEY (lote_id) REFERENCES app_wabtec_lotes(lote_id) ON DELETE CASCADE, 
            FOREIGN KEY (estrutura_id) REFERENCES app_wabtec_estruturas(id) ON DELETE CASCADE
        )`); 
        console.log('Table app_wabtec_bom created successfully.'); 
        process.exit(0); 
    } catch(e) { 
        console.error(e); 
        process.exit(1); 
    } 
} 
createTables();
