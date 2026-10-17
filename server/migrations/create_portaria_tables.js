const pool = require('../services/mysqlService');

// Schema das tabelas da Portaria, extraído do banco de produção (SHOW CREATE TABLE, MariaDB 11.8).
// Collation trocada de utf8mb4_uca1400_ai_ci (exclusiva do MariaDB) para utf8mb4_unicode_ci,
// para rodar também em MySQL. Idempotente: CREATE TABLE IF NOT EXISTS.
// SINCO (multi-tenant): todas as tabelas têm IdEmpresa, exigido pelo services/tenantQueryRewriter.js,
// que injeta o filtro/valor de IdEmpresa automaticamente em toda query de portaria_*.
async function up() {
    try {
        console.log('--- Criando/verificando tabelas do módulo de Portaria ---');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS portaria_turnos (
                id INT(11) NOT NULL AUTO_INCREMENT,
                nome VARCHAR(100) NOT NULL,
                hora_inicio TIME NOT NULL,
                hora_fim TIME NOT NULL,
                descricao VARCHAR(255) DEFAULT NULL,
                ativo TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                IdEmpresa INT(11) NOT NULL DEFAULT 1,
                PRIMARY KEY (id),
                KEY idx_turnos_emp (IdEmpresa)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ portaria_turnos');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS portaria_porteiros (
                id INT(11) NOT NULL AUTO_INCREMENT,
                usuario_id INT(11) DEFAULT NULL,
                nome VARCHAR(150) NOT NULL,
                apelido VARCHAR(80) DEFAULT NULL,
                cpf VARCHAR(20) DEFAULT NULL,
                rg VARCHAR(20) DEFAULT NULL,
                telefone VARCHAR(30) DEFAULT NULL,
                telefone_emergencia VARCHAR(30) DEFAULT NULL,
                contato_emergencia_nome VARCHAR(100) DEFAULT NULL,
                foto_url TEXT DEFAULT NULL,
                turno_id INT(11) DEFAULT NULL,
                status ENUM('ATIVO','FERIAS','AFASTADO','INATIVO') DEFAULT 'ATIVO',
                observacoes TEXT DEFAULT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                IdEmpresa INT(11) NOT NULL DEFAULT 1,
                PRIMARY KEY (id),
                KEY idx_usuario_id (usuario_id),
                KEY idx_turno_id (turno_id),
                KEY idx_status (status),
                KEY idx_porteiros_emp (IdEmpresa)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ portaria_porteiros');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS portaria_acessos (
                id INT(11) NOT NULL AUTO_INCREMENT,
                tipo ENUM('VISITANTE','PRESTADOR','FORNECEDOR_CARGA','CLIENTE','COLABORADOR','OUTRO') DEFAULT 'VISITANTE',
                nome_pessoa VARCHAR(150) NOT NULL,
                documento VARCHAR(30) DEFAULT NULL,
                telefone VARCHAR(30) DEFAULT NULL,
                empresa_origem VARCHAR(150) DEFAULT NULL,
                setor_destino VARCHAR(100) DEFAULT NULL,
                responsavel_interno VARCHAR(150) DEFAULT NULL,
                tipo_veiculo ENUM('CARRETA','CAMINHAO','VUC','UTILITARIO','CARRO','MOTO','NENHUM') DEFAULT 'NENHUM',
                placa_veiculo VARCHAR(20) DEFAULT NULL,
                modelo_veiculo VARCHAR(80) DEFAULT NULL,
                cor_veiculo VARCHAR(40) DEFAULT NULL,
                numero_cracha VARCHAR(30) DEFAULT NULL,
                numero_nf VARCHAR(100) DEFAULT NULL,
                motivo_visita VARCHAR(255) DEFAULT NULL,
                foto_pessoa_url TEXT DEFAULT NULL,
                foto_veiculo_url TEXT DEFAULT NULL,
                porteiro_entrada_id INT(11) DEFAULT NULL,
                porteiro_saida_id INT(11) DEFAULT NULL,
                data_entrada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                data_saida DATETIME DEFAULT NULL,
                tempo_permanencia_min INT(11) DEFAULT NULL,
                status ENUM('NO_PATIO','FINALIZADO','CANCELADO') DEFAULT 'NO_PATIO',
                observacoes TEXT DEFAULT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                IdEmpresa INT(11) NOT NULL DEFAULT 1,
                PRIMARY KEY (id),
                KEY idx_status (status),
                KEY idx_placa (placa_veiculo),
                KEY idx_documento (documento),
                KEY idx_data_entrada (data_entrada),
                KEY idx_numero_cracha (numero_cracha),
                KEY idx_acessos_emp (IdEmpresa)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ portaria_acessos');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS portaria_ocorrencias (
                id INT(11) NOT NULL AUTO_INCREMENT,
                porteiro_saida_id INT(11) DEFAULT NULL,
                porteiro_entrada_id INT(11) DEFAULT NULL,
                turno_id INT(11) DEFAULT NULL,
                data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_veiculos_patio INT(11) DEFAULT 0,
                total_pessoas_patio INT(11) DEFAULT 0,
                descricao_ocorrencias TEXT NOT NULL,
                veiculos_pendentes_json JSON DEFAULT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                IdEmpresa INT(11) NOT NULL DEFAULT 1,
                PRIMARY KEY (id),
                KEY idx_data_registro (data_registro),
                KEY idx_ocorrencias_emp (IdEmpresa)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ portaria_ocorrencias');

        console.log('🎉 Tabelas da Portaria OK.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro na migração da Portaria:', err);
        process.exit(1);
    }
}

up();
