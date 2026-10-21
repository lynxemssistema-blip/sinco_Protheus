/**
 * tests/unit/tenantQueryRewriter.test.js
 * Testes Unitários da injeção de IdEmpresa em INSERTs (server/services/tenantQueryRewriter.js)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { injectTenantSql } = require('../../server/services/tenantQueryRewriter');

const norm = (sql) => String(sql).replace(/\s+/g, ' ').trim();

describe('Tenant Query Rewriter: INSERT com IdEmpresa', () => {
    it('deve manter o ON DUPLICATE KEY UPDATE ... VALUES(col) intacto (Prioridade de OP)', () => {
        const sql = `
            INSERT INTO app_op_priorities (op_numero, prioridade, atualizado_por)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE prioridade = VALUES(prioridade), atualizado_por = VALUES(atualizado_por)
        `;
        assert.strictEqual(
            norm(injectTenantSql(sql, 1)),
            'INSERT INTO app_op_priorities (op_numero, prioridade, atualizado_por, IdEmpresa) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE prioridade = VALUES(prioridade), atualizado_por = VALUES(atualizado_por)'
        );
    });

    it('deve tratar funções dentro da tupla de VALUES', () => {
        const sql = 'INSERT INTO app_pcp_releases (codigo_liberacao, data_hora) VALUES (?, NOW())';
        assert.strictEqual(
            norm(injectTenantSql(sql, 7)),
            'INSERT INTO app_pcp_releases (codigo_liberacao, data_hora, IdEmpresa) VALUES (?, NOW(), 7)'
        );
    });

    it('deve acrescentar IdEmpresa em todas as tuplas de um INSERT de várias linhas', () => {
        const sql = 'INSERT INTO app_op_priorities (op_numero, prioridade) VALUES (?, ?), (?, ?)';
        assert.strictEqual(
            norm(injectTenantSql(sql, 2)),
            'INSERT INTO app_op_priorities (op_numero, prioridade, IdEmpresa) VALUES (?, ?, 2), (?, ?, 2)'
        );
    });

    it('não deve descartar ON DUPLICATE KEY UPDATE sem parênteses', () => {
        const sql = 'INSERT INTO app_op_priorities (op_numero, prioridade) VALUES (?, ?) ON DUPLICATE KEY UPDATE prioridade = prioridade + 1';
        assert.strictEqual(
            norm(injectTenantSql(sql, 1)),
            'INSERT INTO app_op_priorities (op_numero, prioridade, IdEmpresa) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE prioridade = prioridade + 1'
        );
    });

    it('deve ignorar parênteses dentro de textos entre aspas', () => {
        const sql = "INSERT INTO app_op_priorities (op_numero, atualizado_por) VALUES (?, 'PCP (turno 2) d''Ávila')";
        assert.strictEqual(
            norm(injectTenantSql(sql, 1)),
            "INSERT INTO app_op_priorities (op_numero, atualizado_por, IdEmpresa) VALUES (?, 'PCP (turno 2) d''Ávila', 1)"
        );
    });

    it('deve reescrever o planejamento por recurso gravado no fracionamento de OP', () => {
        const sql = `
            INSERT INTO app_production_planning
                (op_numero, op_item, recurso_codigo)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                recurso_codigo = VALUES(recurso_codigo)
        `;
        assert.strictEqual(
            norm(injectTenantSql(sql, 3)),
            'INSERT INTO app_production_planning (op_numero, op_item, recurso_codigo, IdEmpresa) VALUES (?, ?, ?, 3) ON DUPLICATE KEY UPDATE recurso_codigo = VALUES(recurso_codigo)'
        );
    });

    it('não deve alterar tabelas fora do controle por empresa, nem sem empresa ativa, nem quando IdEmpresa já foi informado', () => {
        const fora = 'INSERT INTO usuario (login) VALUES (?)';
        assert.strictEqual(injectTenantSql(fora, 1), fora);

        const semEmpresa = 'INSERT INTO app_op_priorities (op_numero) VALUES (?)';
        assert.strictEqual(injectTenantSql(semEmpresa, null), semEmpresa);

        const jaInformado = 'INSERT INTO app_op_priorities (op_numero, IdEmpresa) VALUES (?, ?)';
        assert.strictEqual(injectTenantSql(jaInformado, 1), jaInformado);
    });
});
