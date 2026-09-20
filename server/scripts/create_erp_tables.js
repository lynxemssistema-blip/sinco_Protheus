const pool = require('../services/mysqlService');

async function createErpTables() {
    console.log('🚀 Criando tabelas do ERP Nativo no banco MySQL u494795077_SINCO...');

    const tables = [
        // 1. Clientes
        `CREATE TABLE IF NOT EXISTS erp_clientes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            codigo VARCHAR(20) NOT NULL UNIQUE,
            loja VARCHAR(10) DEFAULT '01',
            razao_social VARCHAR(255) NOT NULL,
            nome_fantasia VARCHAR(255),
            cnpj_cpf VARCHAR(25),
            inscricao_estadual VARCHAR(30),
            tipo_pessoa CHAR(1) DEFAULT 'J',
            endereco VARCHAR(255),
            bairro VARCHAR(100),
            cidade VARCHAR(100),
            uf VARCHAR(2),
            cep VARCHAR(15),
            telefone VARCHAR(30),
            email VARCHAR(150),
            contato VARCHAR(100),
            condicao_pagamento_padrao VARCHAR(50),
            status VARCHAR(20) DEFAULT 'ativo',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_cli_codigo (codigo),
            INDEX idx_cli_cnpj (cnpj_cpf),
            INDEX idx_cli_nome (razao_social)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 2. Fornecedores
        `CREATE TABLE IF NOT EXISTS erp_fornecedores (
            id INT AUTO_INCREMENT PRIMARY KEY,
            codigo VARCHAR(20) NOT NULL UNIQUE,
            loja VARCHAR(10) DEFAULT '01',
            razao_social VARCHAR(255) NOT NULL,
            nome_fantasia VARCHAR(255),
            cnpj_cpf VARCHAR(25),
            inscricao_estadual VARCHAR(30),
            endereco VARCHAR(255),
            bairro VARCHAR(100),
            cidade VARCHAR(100),
            uf VARCHAR(2),
            cep VARCHAR(15),
            telefone VARCHAR(30),
            email VARCHAR(150),
            contato VARCHAR(100),
            status VARCHAR(20) DEFAULT 'ativo',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_forn_codigo (codigo),
            INDEX idx_forn_cnpj (cnpj_cpf)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 3. Produtos
        `CREATE TABLE IF NOT EXISTS erp_produtos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            codigo VARCHAR(50) NOT NULL UNIQUE,
            descricao VARCHAR(255) NOT NULL,
            tipo VARCHAR(20) DEFAULT 'PA',
            unidade_medida VARCHAR(10) DEFAULT 'UN',
            ncm VARCHAR(20),
            armazem_padrao VARCHAR(10) DEFAULT '01',
            peso_liquido DECIMAL(12,4) DEFAULT 0,
            peso_bruto DECIMAL(12,4) DEFAULT 0,
            custo_standard DECIMAL(14,4) DEFAULT 0,
            preco_venda DECIMAL(14,4) DEFAULT 0,
            revisao_atual VARCHAR(20) DEFAULT '00',
            lead_time_dias INT DEFAULT 0,
            lote_minimo DECIMAL(12,2) DEFAULT 1,
            status VARCHAR(20) DEFAULT 'ativo',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_prod_codigo (codigo),
            INDEX idx_prod_tipo (tipo),
            INDEX idx_prod_desc (descricao)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 4. Estrutura BOM
        `CREATE TABLE IF NOT EXISTS erp_estruturas_bom (
            id INT AUTO_INCREMENT PRIMARY KEY,
            produto_pai_codigo VARCHAR(50) NOT NULL,
            produto_filho_codigo VARCHAR(50) NOT NULL,
            quantidade DECIMAL(14,6) NOT NULL DEFAULT 1,
            unidade VARCHAR(10) DEFAULT 'UN',
            perda_percentual DECIMAL(6,2) DEFAULT 0,
            revisao VARCHAR(20) DEFAULT '00',
            ordem_sequencia INT DEFAULT 10,
            ativo TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_bom_pai (produto_pai_codigo),
            INDEX idx_bom_filho (produto_filho_codigo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 5. Roteiros de Operações
        `CREATE TABLE IF NOT EXISTS erp_roteiros_operacoes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            codigo_produto VARCHAR(50) NOT NULL,
            operacao_seq VARCHAR(10) NOT NULL,
            codigo_recurso VARCHAR(50) NOT NULL,
            descricao_operacao VARCHAR(255),
            tempo_setup_minutos DECIMAL(10,2) DEFAULT 0,
            tempo_operacao_minutos DECIMAL(10,4) DEFAULT 0,
            unidade_tempo VARCHAR(10) DEFAULT 'MIN',
            centro_custo VARCHAR(30),
            instrucoes_trabalho TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_rot_prod (codigo_produto),
            INDEX idx_rot_rec (codigo_recurso)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 6. Pedidos de Venda (Cabeçalho)
        `CREATE TABLE IF NOT EXISTS erp_pedidos_venda (
            id INT AUTO_INCREMENT PRIMARY KEY,
            numero_pedido VARCHAR(30) NOT NULL UNIQUE,
            cliente_codigo VARCHAR(20) NOT NULL,
            data_emissao DATE NOT NULL,
            condicao_pagamento VARCHAR(50),
            valor_total DECIMAL(15,2) DEFAULT 0,
            peso_total DECIMAL(12,4) DEFAULT 0,
            tipo_frete VARCHAR(20) DEFAULT 'FOB',
            transportadora VARCHAR(150),
            status VARCHAR(30) DEFAULT 'aberto',
            observacoes TEXT,
            created_by VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_ped_num (numero_pedido),
            INDEX idx_ped_cli (cliente_codigo),
            INDEX idx_ped_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 7. Pedidos de Venda (Itens)
        `CREATE TABLE IF NOT EXISTS erp_pedidos_itens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pedido_numero VARCHAR(30) NOT NULL,
            item_seq VARCHAR(10) NOT NULL,
            produto_codigo VARCHAR(50) NOT NULL,
            quantidade DECIMAL(12,4) NOT NULL,
            quantidade_entregue DECIMAL(12,4) DEFAULT 0,
            quantidade_saldo DECIMAL(12,4) GENERATED ALWAYS AS (quantidade - quantidade_entregue) STORED,
            preco_unitario DECIMAL(14,4) NOT NULL DEFAULT 0,
            valor_total DECIMAL(15,2) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
            data_entrega_prevista DATE,
            numero_op_gerada VARCHAR(30),
            status VARCHAR(30) DEFAULT 'aberto',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_item_ped (pedido_numero),
            INDEX idx_item_prod (produto_codigo),
            INDEX idx_item_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 8. Ordens de Produção
        `CREATE TABLE IF NOT EXISTS erp_ordens_producao (
            id INT AUTO_INCREMENT PRIMARY KEY,
            numero_op VARCHAR(30) NOT NULL UNIQUE,
            produto_codigo VARCHAR(50) NOT NULL,
            quantidade_planejada DECIMAL(12,4) NOT NULL,
            quantidade_produzida DECIMAL(12,4) DEFAULT 0,
            quantidade_perdida DECIMAL(12,4) DEFAULT 0,
            pedido_venda VARCHAR(30),
            item_pedido VARCHAR(10),
            data_emissao DATE NOT NULL,
            data_inicio_prevista DATE,
            data_fim_prevista DATE,
            data_inicio_real DATETIME,
            data_fim_real DATETIME,
            prioridade INT DEFAULT 5,
            status VARCHAR(30) DEFAULT 'aberta',
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_op_num (numero_op),
            INDEX idx_op_prod (produto_codigo),
            INDEX idx_op_status (status),
            INDEX idx_op_ped (pedido_venda)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 9. Apontamentos Chão de Fábrica
        `CREATE TABLE IF NOT EXISTS erp_apontamentos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            numero_op VARCHAR(30) NOT NULL,
            operacao_seq VARCHAR(10) NOT NULL,
            codigo_recurso VARCHAR(50) NOT NULL,
            operador_id INT,
            operador_nome VARCHAR(100),
            data_apontamento DATE NOT NULL,
            hora_inicio TIME,
            hora_fim TIME,
            tempo_total_minutos DECIMAL(10,2) DEFAULT 0,
            quantidade_produzida DECIMAL(12,4) NOT NULL DEFAULT 0,
            quantidade_refugo DECIMAL(12,4) DEFAULT 0,
            motivo_refugo VARCHAR(150),
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_apont_op (numero_op),
            INDEX idx_apont_rec (codigo_recurso),
            INDEX idx_apont_data (data_apontamento)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 10. Saldos de Estoque
        `CREATE TABLE IF NOT EXISTS erp_estoque_saldos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            produto_codigo VARCHAR(50) NOT NULL,
            armazem VARCHAR(10) NOT NULL DEFAULT '01',
            saldo_atual DECIMAL(14,4) NOT NULL DEFAULT 0,
            saldo_empenhado DECIMAL(14,4) NOT NULL DEFAULT 0,
            saldo_disponivel DECIMAL(14,4) GENERATED ALWAYS AS (saldo_atual - saldo_empenhado) STORED,
            custo_medio DECIMAL(14,4) DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_prod_armazem (produto_codigo, armazem),
            INDEX idx_est_prod (produto_codigo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 11. Movimentações de Estoque (Kardex)
        `CREATE TABLE IF NOT EXISTS erp_estoque_movimentos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            produto_codigo VARCHAR(50) NOT NULL,
            armazem VARCHAR(10) NOT NULL DEFAULT '01',
            tipo_movimento VARCHAR(30) NOT NULL,
            quantidade DECIMAL(14,4) NOT NULL,
            documento_referencia VARCHAR(50),
            data_movimento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            usuario_responsavel VARCHAR(50),
            motivo VARCHAR(255),
            INDEX idx_mov_prod (produto_codigo),
            INDEX idx_mov_tipo (tipo_movimento),
            INDEX idx_mov_data (data_movimento)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 12. Materiais / Componentes Empenhados da OP (SD4010)
        `CREATE TABLE IF NOT EXISTS erp_ordens_producao_materiais (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 13. Operações do Roteiro da OP (SH6010)
        `CREATE TABLE IF NOT EXISTS erp_ordens_producao_operacoes (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    ];

    try {
        for (let i = 0; i < tables.length; i++) {
            await pool.query(tables[i]);
            console.log(`  ✅ [${i + 1}/${tables.length}] Tabela criada/verificada com sucesso.`);
        }
        console.log('\n🎉 TODAS AS TABELAS CORE DO ERP NATIVO CRIADAS COM SUCESSO!');
    } catch (err) {
        console.error('❌ Erro ao criar tabelas ERP:', err);
    } finally {
        process.exit(0);
    }
}

createErpTables();
