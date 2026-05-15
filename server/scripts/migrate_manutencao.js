const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function migrate() {
    const db = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    const addCol = async (sql) => db.query(sql).catch(() => {});

    try {
        console.log("=== Módulo de Manutenção: criando/atualizando tabelas ===\n");

        // ── 1. CATEGORIAS ──────────────────────────────────────────
        await db.query(`
            CREATE TABLE IF NOT EXISTS pcp_manutencao_categorias (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                nome        VARCHAR(100) NOT NULL,
                descricao   TEXT,
                criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8
        `);
        console.log("✓ pcp_manutencao_categorias");

        // ── 2. MÁQUINAS / EQUIPAMENTOS / VEÍCULOS ──────────────────
        await db.query(`
            CREATE TABLE IF NOT EXISTS pcp_manutencao_maquinas (
                id                    INT AUTO_INCREMENT PRIMARY KEY,
                nome                  VARCHAR(150) NOT NULL,
                numero_serie          VARCHAR(100),
                tag_identificacao     VARCHAR(50),
                tipo                  VARCHAR(20)  DEFAULT 'MAQUINA',
                propriedade           VARCHAR(50)  DEFAULT 'PROPRIO',
                id_categoria          INT,
                id_setor              INT,
                status                VARCHAR(20)  DEFAULT 'ATIVO',
                status_operacional    VARCHAR(40)  DEFAULT 'OPERANDO',
                fotos                 LONGTEXT,
                documentos_pdf        LONGTEXT,
                checklists_vinculados LONGTEXT,
                operadores_vinculados LONGTEXT,
                dados_aluguel         LONGTEXT,
                criado_em             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8
        `);
        await addCol("ALTER TABLE pcp_manutencao_maquinas ADD COLUMN numero_serie VARCHAR(100)");
        await addCol("ALTER TABLE pcp_manutencao_maquinas ADD COLUMN tipo VARCHAR(20) DEFAULT 'MAQUINA'");
        await addCol("ALTER TABLE pcp_manutencao_maquinas ADD COLUMN documentos_pdf LONGTEXT");
        await addCol("ALTER TABLE pcp_manutencao_maquinas ADD COLUMN checklists_vinculados LONGTEXT");
        await addCol("ALTER TABLE pcp_manutencao_maquinas ADD COLUMN operadores_vinculados LONGTEXT");
        await addCol("ALTER TABLE pcp_manutencao_maquinas ADD COLUMN propriedade VARCHAR(50) DEFAULT 'PROPRIO'");
        await addCol("ALTER TABLE pcp_manutencao_maquinas ADD COLUMN dados_aluguel LONGTEXT");
        console.log("✓ pcp_manutencao_maquinas");

        // ── 3. MODELOS DE CHECKLIST ─────────────────────────────────
        await db.query(`
            CREATE TABLE IF NOT EXISTS pcp_manutencao_checklists_modelos (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                nome        VARCHAR(150) NOT NULL,
                observacoes TEXT,
                tipo        VARCHAR(50)  DEFAULT 'DIARIO',
                frequencia_dia VARCHAR(50) DEFAULT NULL,
                turnos      LONGTEXT,
                responsavel VARCHAR(50)  DEFAULT 'OPERADOR',
                status      VARCHAR(20)  DEFAULT 'ATIVO',
                itens       LONGTEXT NOT NULL,
                criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8
        `);
        await addCol("ALTER TABLE pcp_manutencao_checklists_modelos ADD COLUMN observacoes TEXT");
        await addCol("ALTER TABLE pcp_manutencao_checklists_modelos ADD COLUMN frequencia_dia VARCHAR(50) DEFAULT NULL");
        await addCol("ALTER TABLE pcp_manutencao_checklists_modelos ADD COLUMN turnos LONGTEXT");
        await addCol("ALTER TABLE pcp_manutencao_checklists_modelos ADD COLUMN responsavel VARCHAR(50) DEFAULT 'OPERADOR'");
        console.log("✓ pcp_manutencao_checklists_modelos");

        // ── 4. OPERADORES ───────────────────────────────────────────
        await db.query(`
            CREATE TABLE IF NOT EXISTS pcp_manutencao_operadores (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                id_usuario  INT NOT NULL,
                id_maquina  INT NOT NULL,
                criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8
        `);
        console.log("✓ pcp_manutencao_operadores");

        // ── 5. CHECKLISTS DIÁRIOS ───────────────────────────────────
        await db.query(`
            CREATE TABLE IF NOT EXISTS pcp_manutencao_checklists_diarios (
                id                  INT AUTO_INCREMENT PRIMARY KEY,
                id_maquina          INT NOT NULL,
                id_modelo_checklist INT,
                id_operador         INT,
                data_verificacao    DATE NOT NULL,
                status_geral        VARCHAR(20) NOT NULL,
                respostas           LONGTEXT NOT NULL,
                criado_em           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8
        `);
        await addCol("ALTER TABLE pcp_manutencao_checklists_diarios ADD COLUMN id_modelo_checklist INT");
        await addCol("ALTER TABLE pcp_manutencao_checklists_diarios MODIFY COLUMN id_operador INT");
        await addCol("ALTER TABLE pcp_manutencao_checklists_diarios ADD COLUMN turno VARCHAR(50) DEFAULT NULL");
        console.log("✓ pcp_manutencao_checklists_diarios");

        // ── 6. ATIVIDADES ───────────────────────────────────────────
        await db.query(`
            CREATE TABLE IF NOT EXISTS pcp_manutencao_atividades (
                id                      INT AUTO_INCREMENT PRIMARY KEY,
                codigo                  VARCHAR(50),
                descricao               VARCHAR(255) NOT NULL,
                tipo                    VARCHAR(30) DEFAULT 'OUTROS',
                tempo_estimado_minutos  INT,
                criado_em               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8
        `);
        console.log("✓ pcp_manutencao_atividades");

        // ── 7. TÉCNICOS ─────────────────────────────────────────────
        await db.query(`
            CREATE TABLE IF NOT EXISTS pcp_manutencao_tecnicos (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                id_usuario   INT NOT NULL,
                especialidade VARCHAR(100) DEFAULT 'GERAL',
                ativo        TINYINT DEFAULT 1,
                criado_em    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_usuario (id_usuario)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8
        `);
        console.log("✓ pcp_manutencao_tecnicos");

        // ── 8. ORDENS DE MANUTENÇÃO ─────────────────────────────────
        await db.query(`
            CREATE TABLE IF NOT EXISTS pcp_manutencao_ordens (
                id                       INT AUTO_INCREMENT PRIMARY KEY,
                id_maquina               INT NOT NULL,
                solicitante_id           INT,
                tecnico_id               INT,
                tecnicos_execucao        LONGTEXT,
                tipo                     VARCHAR(20) NOT NULL DEFAULT 'CORRETIVA',
                status                   VARCHAR(30) DEFAULT 'SOLICITADA',
                sintoma                  TEXT,
                prioridade               VARCHAR(10) DEFAULT 'MEDIA',
                fotos                    LONGTEXT,
                fotos_execucao           LONGTEXT,
                resolvido                TINYINT DEFAULT 0,
                tempo_execucao_segundos  INT DEFAULT 0,
                data_solicitacao         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                data_inicio              DATETIME,
                data_fim                 DATETIME,
                observacoes_tecnicas     TEXT,
                atividades_realizadas    LONGTEXT,
                custo_materiais          DECIMAL(10,2) DEFAULT 0,
                custo_servico            DECIMAL(10,2) DEFAULT 0
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8
        `);
        await addCol("ALTER TABLE pcp_manutencao_ordens ADD COLUMN fotos LONGTEXT");
        await addCol("ALTER TABLE pcp_manutencao_ordens MODIFY COLUMN solicitante_id INT");
        await addCol("ALTER TABLE pcp_manutencao_ordens ADD COLUMN tecnicos_execucao LONGTEXT");
        await addCol("ALTER TABLE pcp_manutencao_ordens ADD COLUMN fotos_execucao LONGTEXT");
        await addCol("ALTER TABLE pcp_manutencao_ordens ADD COLUMN resolvido TINYINT DEFAULT 0");
        await addCol("ALTER TABLE pcp_manutencao_ordens ADD COLUMN tempo_execucao_segundos INT DEFAULT 0");
        await addCol("ALTER TABLE pcp_manutencao_ordens ADD COLUMN custo_materiais DECIMAL(10,2) DEFAULT 0");
        await addCol("ALTER TABLE pcp_manutencao_ordens ADD COLUMN custo_servico DECIMAL(10,2) DEFAULT 0");
        console.log("✓ pcp_manutencao_ordens");

        // ── 9. HISTÓRICO DE ORDENS ──────────────────────────────────
        await db.query(`
            CREATE TABLE IF NOT EXISTS pcp_manutencao_ordens_historico (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                ordem_id     INT NOT NULL,
                usuario_id   INT,
                usuario_nome VARCHAR(150),
                acao         VARCHAR(100),
                detalhes     TEXT,
                data_hora    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8
        `);
        console.log("✓ pcp_manutencao_ordens_historico");

        // ── 10. MATERIAIS DE ORDEM ──────────────────────────────────
        await db.query(`
            CREATE TABLE IF NOT EXISTS pcp_manutencao_materiais (
                id                      INT AUTO_INCREMENT PRIMARY KEY,
                ordem_id                INT NOT NULL,
                codigo                  VARCHAR(50),
                descricao               VARCHAR(255) NOT NULL,
                quantidade              DECIMAL(10,3) NOT NULL DEFAULT 1,
                unidade                 VARCHAR(20) DEFAULT 'UN',
                observacao              TEXT,
                foto                    LONGTEXT,
                is_novo                 TINYINT DEFAULT 0,
                criado_por              VARCHAR(150),
                criado_em               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status                  VARCHAR(50) DEFAULT 'PENDENTE',
                data_prevista_compras   DATE,
                data_prevista_chegada   DATE,
                data_prevista_montagem  DATE,
                obs_compras             TEXT,
                obs_chegada             TEXT,
                obs_montagem            TEXT,
                descricao_planejamento  TEXT,
                custo_unitario          DECIMAL(10,2) DEFAULT 0,
                custo_total             DECIMAL(10,2) DEFAULT 0
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8
        `);
        console.log("✓ pcp_manutencao_materiais");

        // ── 11. SOLICITAÇÕES DE COMPRAS ─────────────────────────────
        await db.query(`
            CREATE TABLE IF NOT EXISTS pcp_manutencao_solicitacoes_compras (
                id                   INT AUTO_INCREMENT PRIMARY KEY,
                numero_solicitacao   VARCHAR(50) NOT NULL,
                destinatarios        TEXT,
                assunto              VARCHAR(255),
                corpo                LONGTEXT,
                materiais_ids        LONGTEXT,
                criado_por           VARCHAR(150),
                criado_em            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8
        `);
        console.log("✓ pcp_manutencao_solicitacoes_compras");

        console.log("\n✅ Todas as tabelas criadas/atualizadas com sucesso!");
    } catch (err) {
        console.error("❌ Erro na migration:", err);
    } finally {
        await db.end();
    }
}

migrate();
