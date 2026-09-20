const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysqlService = require('../services/mysqlService');

async function main() {
    console.log('🚀 Iniciando migração das tabelas de Engenharia e Explosão de OPs no MySQL...');

    // 1. Tabela de Materiais / Componentes Empenhados da OP (Equivalente ao SD4010 Protheus)
    await mysqlService.query(`
        CREATE TABLE IF NOT EXISTS erp_ordens_producao_materiais (
            id INT AUTO_INCREMENT PRIMARY KEY,
            numero_op VARCHAR(30) NOT NULL,
            produto_pai VARCHAR(50) NOT NULL,
            componente_codigo VARCHAR(50) NOT NULL,
            descricao_componente VARCHAR(255),
            tipo_componente VARCHAR(10) DEFAULT 'MP',
            quantidade_base DECIMAL(14,6) NOT NULL DEFAULT 1,
            quantidade_necessaria DECIMAL(14,6) NOT NULL,
            quantidade_empenhada DECIMAL(14,6) NOT NULL,
            quantidade_consumida DECIMAL(14,6) DEFAULT 0,
            unidade_medida VARCHAR(10) DEFAULT 'UN',
            armazem VARCHAR(10) DEFAULT '01',
            operacao_destino VARCHAR(10) DEFAULT NULL,
            nivel_estrutura INT DEFAULT 1,
            sub_op_gerada VARCHAR(30) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_op_mat_num (numero_op),
            INDEX idx_op_mat_comp (componente_codigo),
            INDEX idx_op_mat_pai (produto_pai)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabela `erp_ordens_producao_materiais` criada/verificada com sucesso.');

    // 2. Tabela de Operações do Roteiro da OP (Equivalente às Operações instanciadas da OP / SH6010)
    await mysqlService.query(`
        CREATE TABLE IF NOT EXISTS erp_ordens_producao_operacoes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            numero_op VARCHAR(30) NOT NULL,
            produto_codigo VARCHAR(50) NOT NULL,
            operacao_seq VARCHAR(10) NOT NULL,
            codigo_recurso VARCHAR(50) NOT NULL,
            descricao_operacao VARCHAR(255),
            tempo_setup_minutos DECIMAL(10,2) DEFAULT 0,
            tempo_operacao_minutos DECIMAL(10,4) DEFAULT 0,
            tempo_total_minutos DECIMAL(12,2) DEFAULT 0,
            quantidade_planejada DECIMAL(12,4) NOT NULL,
            quantidade_produzida DECIMAL(12,4) DEFAULT 0,
            quantidade_refugo DECIMAL(12,4) DEFAULT 0,
            status VARCHAR(20) DEFAULT 'pendente',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_op_oper_num (numero_op),
            INDEX idx_op_oper_rec (codigo_recurso),
            INDEX idx_op_oper_seq (operacao_seq)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabela `erp_ordens_producao_operacoes` criada/verificada com sucesso.');

    // 3. Adicionar colunas de hierarquia na tabela erp_ordens_producao se não existirem
    try {
        await mysqlService.query(`
            ALTER TABLE erp_ordens_producao 
            ADD COLUMN IF NOT EXISTS op_pai VARCHAR(30) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS is_sub_op TINYINT(1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS nivel INT DEFAULT 0
        `);
        console.log('✅ Colunas de hierarquia em `erp_ordens_producao` verificadas com sucesso.');
    } catch (e) {
        // Se MariaDB / MySQL antigo não suportar ADD COLUMN IF NOT EXISTS:
        const [cols] = await mysqlService.query("SHOW COLUMNS FROM erp_ordens_producao LIKE 'op_pai'");
        if (cols.length === 0) {
            await mysqlService.query("ALTER TABLE erp_ordens_producao ADD COLUMN op_pai VARCHAR(30) DEFAULT NULL");
            await mysqlService.query("ALTER TABLE erp_ordens_producao ADD COLUMN is_sub_op TINYINT(1) DEFAULT 0");
            await mysqlService.query("ALTER TABLE erp_ordens_producao ADD COLUMN nivel INT DEFAULT 0");
            console.log('✅ Colunas `op_pai`, `is_sub_op` e `nivel` adicionadas em `erp_ordens_producao`.');
        }
    }

    console.log('🎉 Migração concluída com sucesso!');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro na migração:', err);
    process.exit(1);
});
