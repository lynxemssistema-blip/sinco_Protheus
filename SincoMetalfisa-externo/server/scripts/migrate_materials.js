const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../services/mysqlService');

async function createTables() {
    console.log('🚀 Iniciando criação das tabelas de Gestão de Materiais...');

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Tabela de Necessidades de Materiais
        console.log('📦 Criando tabela app_material_necessidades...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_material_necessidades (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido VARCHAR(20) NOT NULL,
                item_pedido VARCHAR(10) NOT NULL,
                produto_final VARCHAR(30) NOT NULL,
                produto_final_descricao VARCHAR(100),
                material_codigo VARCHAR(30) NOT NULL,
                material_descricao VARCHAR(100),
                material_tipo VARCHAR(5),
                material_unidade VARCHAR(5),
                operacao VARCHAR(10),
                operacao_descricao VARCHAR(50),
                qtd_necessaria DECIMAL(15,3) NOT NULL,
                qtd_disponivel DECIMAL(15,3) DEFAULT 0,
                qtd_faltante DECIMAL(15,3) DEFAULT 0,
                data_necessidade DATE,
                data_planejada_processo DATE,
                dias_ate_necessidade INT,
                custo_unitario_estimado DECIMAL(15,2),
                custo_total_estimado DECIMAL(15,2),
                custo_unitario_real DECIMAL(15,2),
                custo_total_real DECIMAL(15,2),
                status_compra ENUM('PENDENTE', 'SOLICITACAO', 'PEDIDO_COMPRA', 'RECEBIDO') DEFAULT 'PENDENTE',
                criticidade ENUM('CRITICO', 'ATENCAO', 'OK') DEFAULT 'OK',
                sc_numero VARCHAR(20),
                pc_numero VARCHAR(20),
                nf_numero VARCHAR(20),
                fornecedor VARCHAR(100),
                data_prevista_entrega DATE,
                solicitacao_almox_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_pedido (pedido),
                INDEX idx_material (material_codigo),
                INDEX idx_operacao (operacao),
                INDEX idx_criticidade (criticidade),
                INDEX idx_data_necessidade (data_necessidade),
                INDEX idx_status (status_compra)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. Tabela de Solicitações
        console.log('📋 Criando tabela app_solicitacoes_almoxarifado...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_solicitacoes_almoxarifado (
                id INT AUTO_INCREMENT PRIMARY KEY,
                numero VARCHAR(30) UNIQUE NOT NULL,
                data_solicitacao DATE NOT NULL,
                tipo ENUM('REQUISICAO', 'DEVOLUCAO') DEFAULT 'REQUISICAO',
                pedido VARCHAR(20),
                op VARCHAR(20),
                operacao VARCHAR(10),
                operacao_descricao VARCHAR(50),
                solicitante VARCHAR(50) NOT NULL,
                departamento VARCHAR(30),
                status ENUM('PENDENTE', 'SEPARADO', 'ENTREGUE', 'CANCELADO') DEFAULT 'PENDENTE',
                prioridade ENUM('NORMAL', 'URGENTE', 'CRITICO') DEFAULT 'NORMAL',
                observacao TEXT,
                data_separacao DATETIME,
                data_entregue DATETIME,
                usuario_separacao VARCHAR(50),
                usuario_entrega VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_numero (numero),
                INDEX idx_pedido (pedido),
                INDEX idx_op (op),
                INDEX idx_operacao (operacao),
                INDEX idx_status (status),
                INDEX idx_data (data_solicitacao)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 3. Tabela de Itens da Solicitação
        console.log('📋 Criando tabela app_solicitacoes_almoxarifado_itens...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_solicitacoes_almoxarifado_itens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                solicitacao_id INT NOT NULL,
                material_codigo VARCHAR(30) NOT NULL,
                material_descricao VARCHAR(100),
                material_tipo VARCHAR(5),
                qtd_solicitada DECIMAL(15,3) NOT NULL,
                qtd_separada DECIMAL(15,3) DEFAULT 0,
                qtd_entregue DECIMAL(15,3) DEFAULT 0,
                almoxarifado VARCHAR(10),
                lote VARCHAR(20),
                endereco VARCHAR(30),
                observacao TEXT,
                FOREIGN KEY (solicitacao_id) REFERENCES app_solicitacoes_almoxarifado(id) ON DELETE CASCADE,
                INDEX idx_material (material_codigo),
                INDEX idx_almoxarifado (almoxarifado)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. Alteração na tabela de Apontamentos
        console.log('🛠️ Verificando coluna materiais_utilizados em app_production_appointments...');
        const [columns] = await connection.query(`
            SHOW COLUMNS FROM app_production_appointments LIKE 'materiais_utilizados'
        `);

        if (columns.length === 0) {
            console.log('➕ Adicionando coluna materiais_utilizados...');
            await connection.query(`
                ALTER TABLE app_production_appointments
                ADD COLUMN materiais_utilizados TEXT COMMENT 'Array de {codigo, descricao, qtd, lote, solicitacao_id}'
            `);
        } else {
            console.log('✅ Coluna materiais_utilizados já existe.');
        }

        await connection.commit();
        console.log('✅ Todas as tabelas foram criadas/atualizadas com sucesso!');

    } catch (error) {
        await connection.rollback();
        console.error('❌ Erro ao criar tabelas:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

createTables();
