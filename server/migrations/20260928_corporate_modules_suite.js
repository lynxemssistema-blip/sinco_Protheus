/**
 * Migração Idempotente para Provisionamento da Suíte de Módulos Corporativos
 * (SST, Cesta Básica, Salas de Reunião, RH Dossiê 360°, Suporte e Backup)
 * Suporte nativo a Multi-Tenant (IdEmpresa).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../services/mysqlService');

async function runCorporateMigration() {
    console.log('🚀 [MIGRATION CORPORATIVA] Iniciando provisionamento das tabelas 100% MySQL...');

    const queries = [
        // 1. MÓDULO SST (NR-06)
        `CREATE TABLE IF NOT EXISTS sst_epis_catalogo (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            produto_codigo VARCHAR(50) NOT NULL,
            descricao VARCHAR(255) NOT NULL,
            unidade VARCHAR(10) DEFAULT 'UN',
            ca_numero VARCHAR(50) NOT NULL,
            ca_validade DATE DEFAULT NULL,
            categoria_protecao VARCHAR(50) DEFAULT 'membros_superiores',
            periodicidade_dias INT DEFAULT 30,
            instrucoes_uso TEXT DEFAULT NULL,
            saldo_atual DECIMAL(10,2) DEFAULT 0.00,
            estoque_minimo DECIMAL(10,2) DEFAULT 0.00,
            localizacao VARCHAR(100) DEFAULT NULL,
            custo_unitario DECIMAL(10,2) DEFAULT 0.00,
            ativo TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_sst_empresa (IdEmpresa),
            INDEX idx_sst_produto (produto_codigo),
            INDEX idx_sst_ca (ca_numero),
            INDEX idx_sst_categoria (categoria_protecao),
            INDEX idx_sst_ativo (ativo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS sst_fichas_epi (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            usuario_id INT NOT NULL,
            data_abertura DATE NOT NULL,
            observacoes TEXT DEFAULT NULL,
            status VARCHAR(20) DEFAULT 'ativo',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_sst_fichas_empresa (IdEmpresa),
            INDEX idx_sst_fichas_usuario (usuario_id),
            UNIQUE KEY uk_sst_fichas_emp_usr (IdEmpresa, usuario_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS sst_fichas_entregas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            ficha_id INT NOT NULL,
            epi_id INT NOT NULL,
            ca_numero VARCHAR(50) NOT NULL,
            ca_validade DATE DEFAULT NULL,
            quantidade DECIMAL(10,2) DEFAULT 1.00,
            unidade VARCHAR(10) DEFAULT 'UN',
            motivo VARCHAR(50) DEFAULT 'periodico',
            data_entrega DATE NOT NULL,
            previsao_troca DATE DEFAULT NULL,
            lote_fabricante VARCHAR(50) DEFAULT NULL,
            validade_fabricante DATE DEFAULT NULL,
            entregue_por VARCHAR(100) NOT NULL,
            status_entrega VARCHAR(30) DEFAULT 'em_uso',
            data_devolucao DATE DEFAULT NULL,
            motivo_devolucao VARCHAR(255) DEFAULT NULL,
            termo_aceite_digital TINYINT(1) DEFAULT 0,
            ultimo_alerta_enviado_em DATETIME DEFAULT NULL,
            alerta_whatsapp_status VARCHAR(50) DEFAULT NULL,
            alerta_email_status VARCHAR(50) DEFAULT NULL,
            observacoes TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_sst_entregas_emp (IdEmpresa),
            INDEX idx_sst_entregas_ficha (ficha_id),
            INDEX idx_sst_entregas_epi (epi_id),
            INDEX idx_sst_entregas_status (status_entrega),
            INDEX idx_sst_entregas_previsao (previsao_troca)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS sst_epis_movimentacoes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            epi_id INT NOT NULL,
            tipo_movimentacao ENUM('entrada_compra', 'saida_entrega', 'devolucao_reaproveitamento', 'descarte', 'ajuste_inventario') NOT NULL,
            quantidade DECIMAL(10,2) NOT NULL,
            saldo_anterior DECIMAL(10,2) NOT NULL,
            saldo_novo DECIMAL(10,2) NOT NULL,
            custo_unitario DECIMAL(10,2) DEFAULT 0.00,
            documento_referencia VARCHAR(100) DEFAULT NULL,
            usuario_id INT DEFAULT NULL,
            usuario_responsavel VARCHAR(100) NOT NULL,
            motivo_observacao TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mov_empresa (IdEmpresa),
            INDEX idx_mov_epi (epi_id),
            INDEX idx_mov_tipo (tipo_movimentacao),
            INDEX idx_mov_data (created_at),
            INDEX idx_mov_usuario (usuario_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS sst_configuracoes_alertas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            notificar_whatsapp TINYINT(1) DEFAULT 1,
            notificar_email TINYINT(1) DEFAULT 1,
            dias_antecedencia INT DEFAULT 7,
            destinatario_colaborador TINYINT(1) DEFAULT 1,
            destinatario_tst TINYINT(1) DEFAULT 1,
            email_tst VARCHAR(255) DEFAULT 'seguranca@empresa.com.br',
            whatsapp_tst VARCHAR(100) DEFAULT '',
            notificar_ao_entregar TINYINT(1) DEFAULT 0,
            mensagem_whatsapp_template TEXT DEFAULT NULL,
            mensagem_email_template TEXT DEFAULT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_sst_cfg_empresa (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // 2. MÓDULO CESTA BÁSICA & BENEFÍCIOS
        `CREATE TABLE IF NOT EXISTS sst_cesta_periodos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            competencia VARCHAR(7) NOT NULL,
            descricao VARCHAR(100) DEFAULT NULL,
            data_liberacao DATE NOT NULL,
            data_limite_retirada DATE DEFAULT NULL,
            status VARCHAR(20) DEFAULT 'liberado',
            observacoes TEXT DEFAULT NULL,
            created_by VARCHAR(100) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_cesta_emp_comp (IdEmpresa, competencia),
            INDEX idx_cesta_empresa (IdEmpresa),
            INDEX idx_cesta_competencia (competencia),
            INDEX idx_cesta_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS sst_cesta_entregas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            periodo_id INT NOT NULL,
            usuario_id INT NOT NULL,
            elegivel TINYINT(1) DEFAULT 1,
            motivo_inaptidao VARCHAR(255) DEFAULT NULL,
            status VARCHAR(20) DEFAULT 'pendente',
            data_hora_entrega DATETIME DEFAULT NULL,
            entregue_por VARCHAR(100) DEFAULT NULL,
            observacoes TEXT DEFAULT NULL,
            assinado_digitalmente TINYINT(1) DEFAULT 0,
            data_hora_assinatura DATETIME DEFAULT NULL,
            assinante_login VARCHAR(100) DEFAULT NULL,
            assinante_ip VARCHAR(50) DEFAULT NULL,
            assinatura_hash VARCHAR(128) DEFAULT NULL,
            notificado_whatsapp TINYINT(1) DEFAULT 0,
            data_hora_notificacao DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_cesta_periodo_usuario (periodo_id, usuario_id),
            INDEX idx_cesta_emp (IdEmpresa),
            INDEX idx_cesta_entrega_periodo (periodo_id),
            INDEX idx_cesta_entrega_usuario (usuario_id),
            INDEX idx_cesta_entrega_status (status),
            INDEX idx_cesta_entrega_elegivel (elegivel)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // 3. MÓDULO SALAS DE REUNIÃO & TOTEM KIOSK
        `CREATE TABLE IF NOT EXISTS salas_reuniao (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            nome VARCHAR(100) NOT NULL,
            descricao VARCHAR(255) NULL,
            localizacao VARCHAR(100) NULL,
            capacidade INT NOT NULL DEFAULT 6,
            recursos_json JSON NULL,
            foto_url VARCHAR(500) NULL,
            cor_etiqueta VARCHAR(20) DEFAULT '#1E3A5F',
            exige_aprovacao TINYINT(1) DEFAULT 0,
            aprovador_id INT NULL,
            ativo TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_salas_emp (IdEmpresa),
            INDEX idx_salas_ativo (ativo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS reservas_salas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            codigo VARCHAR(20) NOT NULL,
            sala_id INT NOT NULL,
            organizador_id INT NOT NULL,
            titulo VARCHAR(150) NOT NULL,
            pauta TEXT NULL,
            data_reserva DATE NOT NULL,
            hora_inicio TIME NOT NULL,
            hora_fim TIME NOT NULL,
            data_hora_inicio DATETIME NOT NULL,
            data_hora_fim DATETIME NOT NULL,
            status ENUM('confirmada', 'em_andamento', 'concluida', 'cancelada') DEFAULT 'confirmada',
            motivo_cancelamento VARCHAR(255) NULL,
            cancelado_por INT NULL,
            cancelado_em DATETIME NULL,
            recursos_solicitados VARCHAR(255) NULL,
            checkin_realizado TINYINT(1) DEFAULT 0,
            checkin_em DATETIME NULL,
            liberada_antecipadamente TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_reserva_emp_cod (IdEmpresa, codigo),
            INDEX idx_res_emp (IdEmpresa),
            INDEX idx_sala_data (sala_id, data_reserva, status),
            INDEX idx_intervalo (data_hora_inicio, data_hora_fim)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS reservas_participantes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            reserva_id INT NOT NULL,
            usuario_id INT NOT NULL,
            confirmou_presenca TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_reserva_usuario (reserva_id, usuario_id),
            INDEX idx_usuario_part (usuario_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS reservas_historico (
            id INT AUTO_INCREMENT PRIMARY KEY,
            reserva_id INT NOT NULL,
            usuario_id INT NOT NULL,
            acao VARCHAR(50) NOT NULL,
            descricao TEXT NOT NULL,
            dados_anteriores JSON NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_reserva_hist (reserva_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // 4. MÓDULO RH & DOSSIÊ DA PASTA DO COLABORADOR
        `CREATE TABLE IF NOT EXISTS rh_colaboradores_detalhes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            usuario_id INT NOT NULL,
            regime_contratacao VARCHAR(20) DEFAULT 'CLT',
            cpf_cnpj VARCHAR(25) DEFAULT NULL,
            rg VARCHAR(25) DEFAULT NULL,
            data_nascimento DATE DEFAULT NULL,
            data_admissao DATE DEFAULT NULL,
            salario_base DECIMAL(12,2) DEFAULT NULL,
            valor_hora DECIMAL(10,2) DEFAULT NULL,
            dados_bancarios_json TEXT DEFAULT NULL,
            contato_emergencia VARCHAR(150) DEFAULT NULL,
            telefone_emergencia VARCHAR(30) DEFAULT NULL,
            gestor_imediato_id INT DEFAULT NULL,
            status_funcional VARCHAR(20) DEFAULT 'ativo',
            observacoes_rh TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_rh_det_emp_usr (IdEmpresa, usuario_id),
            INDEX idx_rh_emp (IdEmpresa),
            INDEX idx_rh_usuario_id (usuario_id),
            INDEX idx_rh_status (status_funcional)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS rh_pasta_ocorrencias (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            usuario_id INT NOT NULL,
            tipo VARCHAR(50) NOT NULL DEFAULT 'feedback',
            titulo VARCHAR(200) NOT NULL,
            descricao TEXT NOT NULL,
            data_ocorrencia DATE NOT NULL,
            registrado_por INT NOT NULL,
            anexo_base64 LONGTEXT NULL,
            anexo_nome VARCHAR(255) NULL,
            anexo_tipo VARCHAR(100) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_rh_ocorrencias_emp (IdEmpresa),
            INDEX idx_rh_pasta_ocorrencias_usr (usuario_id),
            INDEX idx_rh_pasta_ocorrencias_dt (data_ocorrencia)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS rh_pasta_atestados (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            usuario_id INT NOT NULL,
            data_emissao DATE NOT NULL,
            data_inicio DATE NOT NULL,
            dias_afastamento INT NOT NULL DEFAULT 1,
            data_retorno DATE NOT NULL,
            medico_nome VARCHAR(150) NULL,
            crm VARCHAR(50) NULL,
            cid10 VARCHAR(50) NULL,
            motivo_resumo VARCHAR(255) NULL,
            tipo_afastamento VARCHAR(50) DEFAULT 'medico_comum',
            foto_atestado_base64 LONGTEXT NULL,
            anexo_nome VARCHAR(255) NULL,
            anexo_tipo VARCHAR(100) NULL,
            abona_falta TINYINT(1) DEFAULT 1,
            impacta_inss TINYINT(1) DEFAULT 0,
            registrado_por INT NOT NULL,
            observacoes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_rh_atestados_emp (IdEmpresa),
            INDEX idx_rh_pasta_atestados_usr (usuario_id),
            INDEX idx_rh_pasta_atestados_dt (data_inicio)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS rh_pasta_faltas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            usuario_id INT NOT NULL,
            data_falta DATE NOT NULL,
            tipo_falta VARCHAR(50) NOT NULL DEFAULT 'injustificada',
            minutos_atraso INT DEFAULT 0,
            justificativa TEXT NULL,
            atestado_id INT NULL,
            impacta_cesta_basica TINYINT(1) DEFAULT 1,
            descontar_folha TINYINT(1) DEFAULT 1,
            registrado_por INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_rh_faltas_emp (IdEmpresa),
            INDEX idx_rh_pasta_faltas_usr (usuario_id),
            INDEX idx_rh_pasta_faltas_dt (data_falta)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS rh_pasta_avaliacoes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            usuario_id INT NOT NULL,
            data_avaliacao DATE NOT NULL,
            avaliador_id INT NOT NULL,
            nota_comprometimento TINYINT NOT NULL DEFAULT 5,
            nota_pontualidade TINYINT NOT NULL DEFAULT 5,
            nota_qualidade_trabalho TINYINT NOT NULL DEFAULT 5,
            nota_relacionamento_equipe TINYINT NOT NULL DEFAULT 5,
            nota_conservacao_uniforme_5s TINYINT NOT NULL DEFAULT 5,
            media_geral DECIMAL(3,1) NOT NULL DEFAULT 5.0,
            pontos_fortes TEXT NULL,
            pontos_melhoria TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_rh_avaliacoes_emp (IdEmpresa),
            INDEX idx_rh_pasta_avaliacoes_usr (usuario_id),
            INDEX idx_rh_pasta_avaliacoes_dt (data_avaliacao)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS rh_pasta_uniformes_epis (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            usuario_id INT NOT NULL,
            data_inspecao DATE NOT NULL,
            inspetor_id INT NOT NULL,
            estado_camisa VARCHAR(50) DEFAULT 'bom',
            estado_calca VARCHAR(50) DEFAULT 'bom',
            estado_botina VARCHAR(50) DEFAULT 'bom',
            uso_epi_obrigatorio VARCHAR(50) DEFAULT 'conforme_100',
            necessita_reposicao TINYINT(1) DEFAULT 0,
            itens_reposicao VARCHAR(255) NULL,
            foto_inspecao_base64 LONGTEXT NULL,
            anexo_nome VARCHAR(255) NULL,
            observacoes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_rh_uniformes_emp (IdEmpresa),
            INDEX idx_rh_pasta_uniformes_usr (usuario_id),
            INDEX idx_rh_pasta_uniformes_dt (data_inspecao)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS rh_autoatendimento_solicitacoes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            usuario_id INT NOT NULL,
            colaborador_nome VARCHAR(100) NOT NULL,
            tipo_solicitacao VARCHAR(50) NOT NULL,
            status ENUM('pendente', 'aprovado', 'recusado') DEFAULT 'pendente',
            data_solicitacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            dados_json JSON NULL,
            foto_nome VARCHAR(255) NULL,
            foto_base64 LONGTEXT NULL,
            observacao_colaborador TEXT NULL,
            ip_envio VARCHAR(50) NULL,
            dispositivo VARCHAR(255) NULL,
            imutavel TINYINT(1) DEFAULT 0,
            resposta_rh TEXT NULL,
            avaliado_por INT NULL,
            avaliador_nome VARCHAR(100) NULL,
            avaliado_em DATETIME NULL,
            vinculado_id INT NULL,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_rh_auto_emp (IdEmpresa),
            INDEX idx_rh_auto_usr (usuario_id),
            INDEX idx_rh_auto_status (status),
            INDEX idx_rh_auto_tipo (tipo_solicitacao)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // 5. MÓDULO SUPORTE & HELPDESK DE TI / MANUTENÇÃO
        `CREATE TABLE IF NOT EXISTS suporte_chamados (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            codigo VARCHAR(20) NOT NULL,
            titulo VARCHAR(150) NOT NULL,
            descricao TEXT NOT NULL,
            erros_console MEDIUMTEXT NULL,
            modulo VARCHAR(50) NOT NULL,
            tipo_solicitacao ENUM('problema', 'duvida', 'melhoria') DEFAULT 'problema',
            prioridade ENUM('baixa', 'media', 'alta', 'critica') DEFAULT 'media',
            status ENUM('aberto', 'em_analise', 'aguardando_usuario', 'em_correcao', 'resolvido', 'fechado') DEFAULT 'aberto',
            visibilidade ENUM('privado', 'compartilhado', 'publico') DEFAULT 'privado',
            solicitante_id INT NOT NULL,
            solicitante_nome VARCHAR(100) NOT NULL,
            solicitante_setor VARCHAR(50) NULL,
            responsavel_id INT NULL,
            responsavel_nome VARCHAR(100) NULL,
            planejamento_texto TEXT NULL,
            planejamento_etapas JSON NULL,
            planejamento_prazo VARCHAR(100) NULL,
            planejamento_status ENUM('nenhum', 'em_elaboracao', 'enviado_ao_usuario', 'aprovado', 'ajuste_solicitado') DEFAULT 'nenhum',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            closed_at DATETIME NULL,
            UNIQUE KEY uk_suporte_emp_cod (IdEmpresa, codigo),
            INDEX idx_suporte_emp (IdEmpresa),
            INDEX idx_solicitante (solicitante_id),
            INDEX idx_status (status),
            INDEX idx_prioridade (prioridade),
            INDEX idx_modulo (modulo),
            INDEX idx_visibilidade (visibilidade)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS suporte_compartilhamentos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            chamado_id INT NOT NULL,
            usuario_id INT NOT NULL,
            pode_interagir TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_comp_chamado (chamado_id),
            INDEX idx_comp_usuario (usuario_id),
            UNIQUE KEY unq_chamado_usuario (chamado_id, usuario_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS suporte_mensagens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            chamado_id INT NOT NULL,
            usuario_id INT NOT NULL,
            usuario_nome VARCHAR(100) NOT NULL,
            is_suporte TINYINT(1) DEFAULT 0,
            mensagem TEXT NOT NULL,
            tipo ENUM('mensagem', 'mudanca_status', 'nota_interna') DEFAULT 'mensagem',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_msg_chamado (chamado_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS suporte_anexos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            chamado_id INT NOT NULL,
            mensagem_id INT NULL,
            nome_original VARCHAR(255) NOT NULL,
            mimetype VARCHAR(100) NOT NULL,
            dados_base64 LONGTEXT NOT NULL,
            tamanho_bytes INT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_anexo_chamado (chamado_id),
            INDEX idx_anexo_mensagem (mensagem_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // 6. MÓDULO BACKUP MYSQL
        `CREATE TABLE IF NOT EXISTS app_backup_config (
            id INT PRIMARY KEY AUTO_INCREMENT,
            IdEmpresa INT NOT NULL DEFAULT 1,
            ativo TINYINT(1) DEFAULT 1,
            hora VARCHAR(5) DEFAULT '00:00',
            dias_semana VARCHAR(50) DEFAULT '0,1,2,3,4,5,6',
            ultimo_backup DATETIME NULL,
            ultimo_status VARCHAR(50) DEFAULT 'SUCESSO',
            ultimo_arquivo VARCHAR(255) NULL,
            ultimo_tamanho_mb DECIMAL(10,2) NULL,
            em_execucao TINYINT(1) DEFAULT 0,
            atualizado_por VARCHAR(100) NULL,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_backup_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];

    let successCount = 0;
    for (const sql of queries) {
        try {
            await db.query(sql);
            successCount++;
        } catch (err) {
            console.error('❌ Erro na query:', err.message);
        }
    }

    console.log(`✅ [MIGRATION CORPORATIVA] ${successCount} de ${queries.length} tabelas/estruturas provisionadas com sucesso!`);
    process.exit(0);
}

runCorporateMigration().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});
