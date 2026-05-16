const mysql = require('../services/mysqlService');

/**
 * Retorna uma string SQL para ser concatenada numa query do Postgres
 * contendo o filtro de pedidos desativados.
 * 
 * Exemplo de uso:
 * const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');
 * const filter = await getInactiveOrdersFilter();
 * const sql = `SELECT * FROM sc2010 WHERE 1=1 ${filter('c2_pedido')}`;
 */
async function getInactiveOrdersFilter() {
    try {
        // Primeiro, verificar se a feature está ativada no app_settings
        const [settings] = await mysql.query(
            "SELECT setting_value FROM app_settings WHERE setting_key = 'hide_inactive_orders'"
        );
        
        let isEnabled = true; // Por padrão, esconde
        if (settings && settings.length > 0) {
            isEnabled = settings[0].setting_value === 'true';
        }

        if (!isEnabled) {
            // Retorna função que não adiciona filtro
            return (columnName) => '';
        }

        // Buscar pedidos inativos
        const [rows] = await mysql.query("SELECT pedido_numero FROM app_pedidos_inativos");
        
        if (!rows || rows.length === 0) {
            return (columnName) => '';
        }

        const pedidos = rows.map(r => `'${r.pedido_numero.trim()}'`);
        
        return (columnName) => ` AND TRIM(BOTH FROM ${columnName}) <> ALL (ARRAY[${pedidos.join(', ')}]::text[]) `;

    } catch (err) {
        // Se a tabela não existir ou erro de conexão, falha silenciosamente
        console.error('Erro ao buscar pedidos inativos:', err.message);
        return (columnName) => '';
    }
}

/**
 * Cria as tabelas se não existirem
 */
async function initInactiveOrdersTables() {
    try {
        await mysql.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value VARCHAR(255) NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        await mysql.query(`
            CREATE TABLE IF NOT EXISTS app_pedidos_inativos (
                pedido_numero VARCHAR(20) PRIMARY KEY,
                data_desativacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                usuario VARCHAR(100)
            );
        `);
        await mysql.query(`
            INSERT IGNORE INTO app_settings (setting_key, setting_value) 
            VALUES ('hide_inactive_orders', 'true');
        `);
        console.log('✅ Inactive orders tables and settings initialized.');
    } catch (err) {
        console.error('❌ Erro ao inicializar tabelas inativos:', err.message);
    }
}

module.exports = {
    getInactiveOrdersFilter,
    initInactiveOrdersTables
};
