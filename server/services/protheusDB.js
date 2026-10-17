const db = require('../db');

/**
 * Adaptador Protheus DB
 * Redireciona todas as consultas legadas para o adaptador MySQL (server/db.js),
 * garantindo compatibilidade total mesmo com o servidor PostgreSQL Protheus desativado.
 */
module.exports = {
    query: async (text, params) => {
        return db.query(text, params);
    },
    connect: async () => {
        return db.connect();
    },
    pool: db.pool
};
