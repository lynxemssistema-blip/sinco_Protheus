/**
 * Migração Idempotente para Suporte Multi-Tenant & Planos de Acesso
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../services/mysqlService');

async function runMigration() {
    console.log('🚀 [MIGRATION] Iniciando migração Multi-Tenant & Planos de Acesso...');

    try {
        // 1. Verificar e adicionar colunas na tabela empresa
        console.log('📦 [1/4] Verificando colunas da tabela `empresa`...');
        const [empCols] = await db.query('DESCRIBE empresa');
        const empFieldNames = empCols.map(c => c.Field.toLowerCase());

        if (!empFieldNames.includes('plano')) {
            console.log('  -> Adicionando coluna `plano` na tabela `empresa`...');
            await db.query("ALTER TABLE empresa ADD COLUMN plano VARCHAR(50) DEFAULT 'pro'");
        }
        if (!empFieldNames.includes('status_plano')) {
            console.log('  -> Adicionando coluna `status_plano` na tabela `empresa`...');
            await db.query("ALTER TABLE empresa ADD COLUMN status_plano VARCHAR(30) DEFAULT 'trial'");
        }
        if (!empFieldNames.includes('trial_expira_em')) {
            console.log('  -> Adicionando coluna `trial_expira_em` na tabela `empresa`...');
            await db.query("ALTER TABLE empresa ADD COLUMN trial_expira_em DATETIME NULL");
        }
        if (!empFieldNames.includes('limite_usuarios')) {
            console.log('  -> Adicionando coluna `limite_usuarios` na tabela `empresa`...');
            await db.query("ALTER TABLE empresa ADD COLUMN limite_usuarios INT DEFAULT 10");
        }
        if (!empFieldNames.includes('modulos_liberados')) {
            console.log('  -> Adicionando coluna `modulos_liberados` na tabela `empresa`...');
            await db.query("ALTER TABLE empresa ADD COLUMN modulos_liberados TEXT NULL");
        }
        console.log('✅ Tabela `empresa` atualizada.');

        // 2. Verificar e adicionar colunas na tabela usuario
        console.log('👤 [2/4] Verificando colunas da tabela `usuario`...');
        const [userCols] = await db.query('DESCRIBE usuario');
        const userFieldNames = userCols.map(c => c.Field.toLowerCase());

        if (!userFieldNames.includes('idempresa')) {
            console.log('  -> Adicionando coluna `IdEmpresa` na tabela `usuario`...');
            await db.query("ALTER TABLE usuario ADD COLUMN IdEmpresa INT DEFAULT 1");
        }
        if (!userFieldNames.includes('is_master')) {
            console.log('  -> Adicionando coluna `is_master` na tabela `usuario`...');
            await db.query("ALTER TABLE usuario ADD COLUMN is_master TINYINT(1) DEFAULT 0");
        }
        console.log('✅ Tabela `usuario` atualizada.');

        // 3. Criar tabela empresa_convites se não existir
        console.log('✉️ [3/4] Verificando tabela `empresa_convites`...');
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS empresa_convites (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    IdEmpresa INT NOT NULL,
                    email VARCHAR(150) NOT NULL,
                    tipo_usuario VARCHAR(50) DEFAULT 'operador',
                    token VARCHAR(100) NOT NULL UNIQUE,
                    status ENUM('pendente', 'aceito', 'expirado') DEFAULT 'pendente',
                    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expira_em DATETIME NOT NULL,
                    INDEX idx_convite_empresa (IdEmpresa),
                    INDEX idx_convite_token (token)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            console.log('✅ Tabela `empresa_convites` pronta.');
        } catch (createErr) {
            console.warn('⚠️ Nota sobre criação de tabela empresa_convites:', createErr.message);
        }

        // 4. Garantir que a Empresa Matriz (IdEmpresa = 1) exista
        console.log('🏢 [4/4] Verificando Empresa Matriz (ID: 1)...');
        try {
            const [matriz] = await db.query('SELECT IdEmpresa FROM empresa WHERE IdEmpresa = 1');
            if (matriz.length === 0) {
                console.log('  -> Inserindo Empresa Matriz padrão (ID: 1 - MetalFisa / Lynx)...');
                await db.query(`
                    INSERT INTO empresa (
                        IdEmpresa, RazaoSocial, NomeFantasia, Segmento, plano, status_plano, limite_usuarios
                    ) VALUES (
                        1, 'MetalFisa Industrial Ltda', 'MetalFisa / Lynx (Matriz)', 'Metalúrgica & Caldeiraria', 'enterprise', 'ativo', 9999
                    )
                `);
            } else {
                console.log('  -> Empresa Matriz já existe.');
            }

            // Atualiza usuários legados para pertencerem à Empresa Matriz
            await db.query("UPDATE usuario SET IdEmpresa = 1 WHERE IdEmpresa IS NULL OR IdEmpresa = 0");
            
            // Marca o superadmin como master e usuário privilegiado
            await db.query("UPDATE usuario SET is_master = 1 WHERE email = 'edsonmanoel2012@gmail.com' OR Login = 'edsonmanoel2012@gmail.com'");
            console.log('✅ Usuários existentes vinculados à Empresa Matriz (1).');
        } catch (dbErr) {
            console.warn('⚠️ Alerta na inserção da Matriz (verifique privilégios INSERT):', dbErr.message);
        }

        console.log('\n🎉 [MIGRATION SUCESSO] Estrutura Multi-Tenant preparada!');
        return { success: true };
    } catch (error) {
        console.error('❌ [MIGRATION ERRO]:', error);
        return { success: false, error: error.message };
    }
}

if (require.main === module) {
    runMigration().then(res => {
        if (!res.success) {
            console.log('⚠️ Caso tenha ocorrido erro de permissão INSERT/CREATE, lembre-se de habilitar as caixas no hPanel da Hostinger.');
        }
        process.exit(res.success ? 0 : 1);
    });
}

module.exports = { runMigration };
