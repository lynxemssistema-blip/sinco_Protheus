require('dotenv').config();
const mysqlPool = require('./services/mysqlService');

async function createTables() {
    try {
        const connection = await mysqlPool.getConnection();
        console.log('🔌 Conectado ao MySQL via Pool');

        // 1. Tabela de Tipos
        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_romaneio_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                description VARCHAR(100) NOT NULL
            );
        `);
        console.log('✅ Tabela app_romaneio_types verificada/criada.');

        // Inserir tipos padrão se vazia
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM app_romaneio_types');
        if (rows[0].count === 0) {
            await connection.query(`
                INSERT INTO app_romaneio_types (description) VALUES 
                ('Entrega Cliente'), 
                ('Manutenção'), 
                ('Industrialização'),
                ('Outros');
            `);
            console.log('📦 Tipos padrão inseridos.');
        }

        // 2. Tabela de Cabeçalho (Romaneios)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_romaneios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cliente_cod VARCHAR(10),
                cliente_loja VARCHAR(10),
                cliente_nome VARCHAR(255),
                tipo_id INT,
                status VARCHAR(20) DEFAULT 'Rascunho',
                observacao_geral TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (tipo_id) REFERENCES app_romaneio_types(id)
            );
        `);
        console.log('✅ Tabela app_romaneios verificada/criada.');

        // 3. Tabela de Itens
        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_romaneio_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                romaneio_id INT,
                pedido VARCHAR(20),
                item_pedido VARCHAR(10),
                codigo_produto VARCHAR(50),
                descricao_produto VARCHAR(255),
                quantidade DECIMAL(15,4),
                comentario TEXT,
                FOREIGN KEY (romaneio_id) REFERENCES app_romaneios(id) ON DELETE CASCADE
            );
        `);
        console.log('✅ Tabela app_romaneio_items verificada/criada.');

        connection.release();
        process.exit(0);

    } catch (err) {
        console.error('❌ Erro ao criar tabelas:', err);
        process.exit(1);
    }
}

createTables();
