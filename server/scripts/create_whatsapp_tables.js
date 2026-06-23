const pool = require('../services/mysqlService');

async function run() {
    try {
        console.log('Criando tabela app_whatsapp_grupos_monitorados...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_whatsapp_grupos_monitorados (
                id INT AUTO_INCREMENT PRIMARY KEY,
                grupo_nome VARCHAR(191) NOT NULL UNIQUE,
                grupo_jid VARCHAR(191) DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_grupo_nome (grupo_nome)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('Tabela app_whatsapp_grupos_monitorados criada/verificada com sucesso.');

        console.log('Criando tabela app_whatsapp_mensagens_recebidas...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_whatsapp_mensagens_recebidas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                grupo_nome VARCHAR(191) NOT NULL,
                grupo_jid VARCHAR(191) DEFAULT NULL,
                remetente_nome VARCHAR(255) DEFAULT NULL,
                remetente_fone VARCHAR(50) DEFAULT NULL,
                mensagem TEXT,
                tipo_midia VARCHAR(50) DEFAULT 'text',
                midia_url VARCHAR(255) DEFAULT NULL,
                recebido_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                id_mensagem VARCHAR(191) DEFAULT NULL UNIQUE,
                INDEX idx_grupo_recebido (grupo_nome, recebido_em)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('Tabela app_whatsapp_mensagens_recebidas criada/verificada com sucesso.');

        console.log('Verificando/adicionando coluna midia_url se necessário...');
        try {
            await pool.query(`
                ALTER TABLE app_whatsapp_mensagens_recebidas 
                ADD COLUMN midia_url VARCHAR(255) DEFAULT NULL AFTER tipo_midia
            `);
            console.log('Coluna midia_url adicionada com sucesso.');
        } catch (alterErr) {
            if (alterErr.code === 'ER_DUP_FIELDNAME' || alterErr.errno === 1060) {
                console.log('Coluna midia_url já existe na tabela.');
            } else {
                console.error('Erro ao adicionar coluna midia_url:', alterErr.message);
            }
        }
    } catch (err) {
        console.error('Erro ao criar tabelas do WhatsApp:', err);
    } finally {
        process.exit(0);
    }
}
run();
