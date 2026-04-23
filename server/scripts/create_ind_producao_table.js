const db = require('../services/mysqlService');

const createTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS app_ind_producao_ativa (
            id INT AUTO_INCREMENT PRIMARY KEY,
            op_base VARCHAR(15) NOT NULL COMMENT 'OP original do Protheus',
            op_fracionada VARCHAR(20) NOT NULL COMMENT 'O nome do lote fracionado ex: 10005-A',
            produto VARCHAR(50) NOT NULL,
            descricao VARCHAR(255),
            quantidade_total DECIMAL(10, 2) NOT NULL COMMENT 'Quantidade original',
            quantidade_lote DECIMAL(10, 2) NOT NULL COMMENT 'A qtde que foi destinada para este lote especifico',
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_prevista_inicio DATE,
            status VARCHAR(20) DEFAULT 'LIBERADO' COMMENT 'LIBERADO, EM_PRODUCAO, PAUSADO, FINALIZADO',
            criado_por VARCHAR(100),
            INDEX idx_op_base (op_base),
            INDEX idx_op_fracionada (op_fracionada),
            INDEX idx_status (status)
        );
    `;

    try {
        await db.query(query);
        console.log("✅ Tabela app_ind_producao_ativa criada com sucesso (se nao existia).");
        process.exit(0);
    } catch (err) {
        console.error("❌ Erro ao criar a tabela:", err);
        process.exit(1);
    }
};

createTable();
