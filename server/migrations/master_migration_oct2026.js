/**
 * Migração Mestre - Outubro 2026
 * Módulos: CIPA Digital (NR-05), Portaria WebRTC, User Preferences, SST Brigada de Incêndio (NBR 14276 / NR-23)
 * Todos 100% nativos em MySQL com suporte Multi-Tenant (IdEmpresa).
 */
const db = require('../services/mysqlService');

async function runMasterMigration() {
    console.log('🚀 Iniciando Migração Mestre (DDL MySQL Nativo)...');

    // ─── 1. CIPA DIGITAL (NR-05) ───────────────────────────────────────────────
    await db.query(`
        CREATE TABLE IF NOT EXISTS cipa_gestoes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            ano_inicio INT NOT NULL,
            ano_fim INT NOT NULL,
            descricao VARCHAR(150) NOT NULL,
            data_inicio_mandato DATE DEFAULT NULL,
            data_fim_mandato DATE DEFAULT NULL,
            status ENUM('planejamento', 'inscricoes', 'eleicao', 'apurada', 'empossada', 'concluida') DEFAULT 'planejamento',
            vagas_titulares_eleitos INT DEFAULT 4,
            vagas_suplentes_eleitos INT DEFAULT 3,
            vagas_titulares_indicados INT DEFAULT 4,
            vagas_suplentes_indicados INT DEFAULT 3,
            total_eleitores_aptos INT DEFAULT 0,
            total_votos_apurados INT DEFAULT 0,
            quorum_atingido TINYINT(1) DEFAULT 0,
            data_apuracao DATETIME DEFAULT NULL,
            observacoes TEXT DEFAULT NULL,
            created_by VARCHAR(100) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_cipa_empresa (IdEmpresa),
            INDEX idx_cipa_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS cipa_cronograma_prazos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            gestao_id INT NOT NULL,
            fase_codigo VARCHAR(50) NOT NULL,
            descricao_etapa VARCHAR(255) NOT NULL,
            dias_prazo_nr05 INT NOT NULL,
            data_prevista DATE NOT NULL,
            data_realizada DATE DEFAULT NULL,
            status ENUM('pendente', 'em_andamento', 'concluido', 'atrasado') DEFAULT 'pendente',
            responsavel VARCHAR(100) DEFAULT NULL,
            documento_anexo_url VARCHAR(255) DEFAULT NULL,
            observacoes TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_cipa_cronograma_gestao (gestao_id),
            INDEX idx_cronograma_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS cipa_candidatos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            gestao_id INT NOT NULL,
            usuario_id INT NOT NULL,
            numero_chapa INT NOT NULL,
            nome_urna VARCHAR(150) NOT NULL,
            cargo_setor VARCHAR(150) DEFAULT NULL,
            foto_url TEXT DEFAULT NULL,
            data_inscricao DATETIME DEFAULT CURRENT_TIMESTAMP,
            status ENUM('pendente', 'deferido', 'indeferido') DEFAULT 'pendente',
            total_votos INT DEFAULT 0,
            classificacao INT DEFAULT NULL,
            resultado ENUM('titular_eleito', 'suplente_eleito', 'nao_eleito') DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_cipa_candidato_gestao (gestao_id, usuario_id),
            UNIQUE KEY uq_cipa_chapa_gestao (gestao_id, numero_chapa),
            INDEX idx_candidatos_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS cipa_eleitores_votaram (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            gestao_id INT NOT NULL,
            usuario_id INT NOT NULL,
            data_hora_voto DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_origem VARCHAR(50) DEFAULT NULL,
            dispositivo VARCHAR(100) DEFAULT 'web',
            UNIQUE KEY uq_eleitor_gestao (gestao_id, usuario_id),
            INDEX idx_votaram_gestao (gestao_id),
            INDEX idx_eleitores_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS cipa_cedulas_votos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            gestao_id INT NOT NULL,
            candidato_id INT DEFAULT NULL,
            tipo_voto ENUM('valido', 'branco', 'nulo') NOT NULL,
            hash_comprovante VARCHAR(128) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cedula_gestao (gestao_id),
            INDEX idx_cedula_candidato (candidato_id),
            INDEX idx_cedula_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS cipa_reunioes_atas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            gestao_id INT NOT NULL,
            numero_ata VARCHAR(50) NOT NULL,
            tipo ENUM('ordinaria', 'extraordinaria', 'eleicao_apuracao', 'instalacao_posse') NOT NULL,
            mes_competencia VARCHAR(20) DEFAULT NULL,
            data_reuniao DATE NOT NULL,
            horario_inicio TIME DEFAULT NULL,
            horario_fim TIME DEFAULT NULL,
            local VARCHAR(100) DEFAULT 'Sala de Reuniões Principal',
            pauta TEXT NOT NULL,
            conteudo_ata MEDIUMTEXT NOT NULL,
            deliberacoes_seguranca TEXT DEFAULT NULL,
            acoes_combate_assedio TEXT DEFAULT NULL,
            plano_trabalho_5w2h JSON DEFAULT NULL,
            status ENUM('rascunho', 'aguardando_assinaturas', 'fechada') DEFAULT 'rascunho',
            redigido_por VARCHAR(100) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_atas_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS cipa_membros_gestao (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            gestao_id INT NOT NULL,
            usuario_id INT NOT NULL,
            origem VARCHAR(20) NOT NULL DEFAULT 'indicado',
            tipo_vaga VARCHAR(20) DEFAULT 'titular',
            cargo_cipa VARCHAR(30) DEFAULT 'membro',
            data_posse DATE DEFAULT NULL,
            ativo TINYINT(1) DEFAULT 1,
            observacoes TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_cipa_membro (gestao_id, usuario_id),
            INDEX idx_cipa_membros_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ─── 2. PORTARIA & CONTROLE DE ACESSO ──────────────────────────────────────
    await db.query(`
        CREATE TABLE IF NOT EXISTS portaria_turnos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            nome VARCHAR(100) NOT NULL,
            hora_inicio TIME NOT NULL,
            hora_fim TIME NOT NULL,
            descricao VARCHAR(255) NULL,
            ativo TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_port_turnos_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS portaria_porteiros (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            usuario_id INT NULL,
            nome VARCHAR(150) NOT NULL,
            cpf VARCHAR(20) NULL,
            turno_id INT NULL,
            status ENUM('ATIVO', 'INATIVO') DEFAULT 'ATIVO',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_port_porteiros_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS portaria_acessos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            tipo_acesso ENUM('visitante', 'prestador', 'veiculo_carga', 'colaborador') NOT NULL,
            nome_pessoa VARCHAR(150) NOT NULL,
            documento VARCHAR(30) NULL,
            empresa VARCHAR(150) NULL,
            setor_destino VARCHAR(100) NULL,
            pessoa_contato VARCHAR(150) NULL,
            placa_veiculo VARCHAR(20) NULL,
            modelo_veiculo VARCHAR(50) NULL,
            motivo TEXT NULL,
            foto_entrada_url VARCHAR(500) NULL,
            foto_saida_url VARCHAR(500) NULL,
            porteiro_entrada_id INT NULL,
            porteiro_saida_id INT NULL,
            data_hora_entrada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            data_hora_saida DATETIME NULL,
            tempo_permanencia_minutos INT NULL,
            status ENUM('no_patio', 'concluido', 'bloqueado') DEFAULT 'no_patio',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_portaria_status (status),
            INDEX idx_portaria_entrada (data_hora_entrada),
            INDEX idx_port_acessos_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ─── 3. PREFERÊNCIAS DO USUÁRIO (Favoritos Drag & Drop) ───────────────────
    await db.query(`
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            user_id INT NOT NULL,
            preference_key VARCHAR(100) NOT NULL,
            preference_value JSON NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_pref (user_id, preference_key),
            INDEX idx_user_pref_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ─── 4. SST BRIGADA DE INCÊNDIO & EXTINTORES ──────────────────────────────
    await db.query(`
        CREATE TABLE IF NOT EXISTS sst_brigada_config (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            planta_nome VARCHAR(150) NOT NULL,
            grau_risco ENUM('baixo', 'medio', 'alto') DEFAULT 'medio',
            populacao_fixa_total INT DEFAULT 100,
            populacao_1_turno INT DEFAULT 50,
            populacao_2_turno INT DEFAULT 35,
            populacao_3_turno INT DEFAULT 15,
            minimo_brigadistas_1_turno INT DEFAULT 4,
            minimo_brigadistas_2_turno INT DEFAULT 3,
            minimo_brigadistas_3_turno INT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_brig_cfg_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS sst_brigada_membros (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            usuario_id INT NOT NULL,
            papel ENUM('coordenador_geral', 'chefe_brigada', 'lider_setor', 'brigadista_operacional') DEFAULT 'brigadista_operacional',
            turno ENUM('1_turno', '2_turno', '3_turno', 'administrativo', 'geral') DEFAULT '1_turno',
            setor_atuacao VARCHAR(100) NULL,
            data_admissao_brigada DATE NOT NULL,
            status ENUM('ativo', 'afastado', 'inativo') DEFAULT 'ativo',
            observacoes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_usuario (usuario_id),
            INDEX idx_status_turno (status, turno),
            INDEX idx_brig_membros_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS sst_brigada_treinamentos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            membro_id INT NOT NULL,
            nivel ENUM('basico', 'intermediario', 'avancado') DEFAULT 'basico',
            entidade_formadora VARCHAR(150) NOT NULL,
            instrutor_responsavel VARCHAR(120) NULL,
            carga_horaria_horas INT DEFAULT 16,
            data_conclusao DATE NOT NULL,
            data_validade DATE NOT NULL,
            certificado_url VARCHAR(255) NULL,
            status_validade ENUM('vigente', 'proximo_vencimento', 'vencido') DEFAULT 'vigente',
            observacoes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_membro (membro_id),
            INDEX idx_validade (data_validade),
            INDEX idx_brig_trein_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS sst_brigada_equipamentos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            codigo_identificador VARCHAR(50) NOT NULL,
            tipo ENUM('extintor_agua', 'extintor_pqs_abc', 'extintor_pqs_bc', 'extintor_co2', 'hidrante_abrigo', 'alarme_botoeira', 'luz_emergencia', 'porta_corta_fogo') NOT NULL,
            capacidade_carga VARCHAR(50) DEFAULT '6kg / 10L',
            setor_localizacao VARCHAR(120) NOT NULL,
            ponto_referencia VARCHAR(200) NULL,
            data_fabricacao DATE NULL,
            data_ultima_recarga DATE NULL,
            data_proxima_recarga DATE NULL,
            data_ultimo_teste_hidrostatico DATE NULL,
            data_proximo_teste_hidrostatico DATE NULL,
            qr_code_hash VARCHAR(100) NOT NULL UNIQUE,
            status_operacional ENUM('operacional', 'em_manutencao', 'vencido', 'interditado') DEFAULT 'operacional',
            observacoes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_tipo_status (tipo, status_operacional),
            INDEX idx_brig_equip_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS sst_brigada_inspecoes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            equipamento_id INT NOT NULL,
            inspetor_usuario_id INT NOT NULL,
            data_inspecao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            lacre_intacto TINYINT(1) DEFAULT 1,
            manometro_pressao_conforme TINYINT(1) DEFAULT 1,
            desobstruido TINYINT(1) DEFAULT 1,
            sinalizacao_visivel TINYINT(1) DEFAULT 1,
            mangueira_bico_ok TINYINT(1) DEFAULT 1,
            carga_no_prazo TINYINT(1) DEFAULT 1,
            resultado_final ENUM('conforme', 'nao_conforme') DEFAULT 'conforme',
            os_corretiva_gerada TINYINT(1) DEFAULT 0,
            observacoes TEXT NULL,
            INDEX idx_equipamento_data (equipamento_id, data_inspecao),
            INDEX idx_resultado (resultado_final),
            INDEX idx_brig_insp_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS sst_brigada_simulados (
            id INT AUTO_INCREMENT PRIMARY KEY,
            IdEmpresa INT NOT NULL DEFAULT 1,
            titulo VARCHAR(150) NOT NULL,
            data_simulado DATE NOT NULL,
            horario_inicio TIME NOT NULL,
            horario_termino TIME NOT NULL,
            tempo_evacuacao_segundos INT NOT NULL,
            turno_exercitado ENUM('1_turno', '2_turno', '3_turno', 'geral') DEFAULT '1_turno',
            total_evacuados INT DEFAULT 0,
            total_brigadistas_atuantes INT DEFAULT 0,
            cenario_simulado TEXT NOT NULL,
            pontos_fortes TEXT NULL,
            oportunidades_melhoria TEXT NULL,
            avaliacao_eficacia ENUM('excelente', 'bom', 'regular', 'insatisfatorio') DEFAULT 'bom',
            ata_anexo_url VARCHAR(255) NULL,
            fotos_anexo_url VARCHAR(255) NULL,
            responsavel_usuario_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_brig_simulados_emp (IdEmpresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('✅ Todas as tabelas DDL criadas com sucesso no MySQL com IdEmpresa!');
}

runMasterMigration().then(() => process.exit(0)).catch(err => {
    console.error('❌ Erro na migração:', err);
    process.exit(1);
});
