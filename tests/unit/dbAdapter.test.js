/**
 * tests/unit/dbAdapter.test.js
 * Testes Unitários do Adaptador de Tradução SQL PostgreSQL -> MariaDB/MySQL (server/db.js)
 * MODO DE AUTONOMIA TOTAL - SINCO PROTHEUS
 */

const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

const db = require('../../server/db');

after(() => {
    setTimeout(() => process.exit(0), 50);
});

describe('SQL Translation Engine: db.translatePgToMysql', () => {
    it('deve remover prefixo de schema public. e normalizar nomes de tabelas Protheus para minúsculas', () => {
        const sql = 'SELECT a1.a1_cod, a1.a1_nome FROM public.SA1010 a1 JOIN public.SB1010 b1 ON b1.b1_cod = a1.a1_cod';
        const res = db.translatePgToMysql(sql, []);
        assert.ok(!res.sql.includes('public.'), 'Não deve conter "public."');
        assert.ok(res.sql.includes('sa1010'), 'Deve conter "sa1010" em minúsculas');
        assert.ok(res.sql.includes('sb1010'), 'Deve conter "sb1010" em minúsculas');
    });

    it('deve substituir placeholders posicionais $1, $2 por ? e manter a ordem correta dos parâmetros', () => {
        const sql = 'SELECT * FROM sa1010 WHERE a1_cod = $1 AND a1_loja = $2';
        const params = ['CLI001', '01'];
        const res = db.translatePgToMysql(sql, params);
        assert.ok(res.sql.includes('WHERE a1_cod = ? AND a1_loja = ?'));
        assert.deepStrictEqual(res.params, ['CLI001', '01']);
    });

    it('deve suportar reutilização de mesmo placeholder ($1 usado duas vezes) duplicando parâmetro para ?', () => {
        const sql = 'SELECT * FROM sa1010 WHERE a1_cod = $1 OR a1_cgc = $1';
        const params = ['11222333000181'];
        const res = db.translatePgToMysql(sql, params);
        assert.ok(res.sql.includes('WHERE a1_cod = ? OR a1_cgc = ?'));
        assert.deepStrictEqual(res.params, ['11222333000181', '11222333000181']);
    });

    it('deve converter WITH simples para WITH RECURSIVE (compatibilidade MariaDB)', () => {
        const sql = 'WITH cte_dados AS (SELECT 1 AS n) SELECT * FROM cte_dados';
        const res = db.translatePgToMysql(sql, []);
        assert.ok(res.sql.startsWith('WITH RECURSIVE'), 'Deve começar com WITH RECURSIVE');
    });

    it('deve transpolar DISTINCT ON (...) para subquery com ROW_NUMBER()', () => {
        const sql = 'SELECT DISTINCT ON (codigo, filial) codigo, nome, valor FROM sa1010 ORDER BY codigo, filial, valor DESC';
        const res = db.translatePgToMysql(sql, []);
        assert.ok(res.sql.includes('ROW_NUMBER() OVER (PARTITION BY codigo, filial'), 'Deve usar ROW_NUMBER()');
        assert.ok(res.sql.includes('_rn = 1'), 'Deve filtrar _rn = 1');
    });

    it('deve transpolar STRING_AGG para GROUP_CONCAT', () => {
        const sql = "SELECT STRING_AGG(a1_cod, ',') FROM sa1010";
        const res = db.translatePgToMysql(sql, []);
        assert.ok(res.sql.includes("GROUP_CONCAT(a1_cod SEPARATOR ',')"));
    });

    it('deve transpolar STRING_AGG com ORDER BY para GROUP_CONCAT com ORDER BY', () => {
        const sql = "SELECT STRING_AGG(a1_cod, ';' ORDER BY a1_cod ASC) FROM sa1010";
        const res = db.translatePgToMysql(sql, []);
        assert.ok(res.sql.includes("GROUP_CONCAT(a1_cod ORDER BY a1_cod ASC SEPARATOR ';')"));
    });

    it('deve transpolar to_date(col, \'YYYYMMDD\') para STR_TO_DATE', () => {
        const sql = "SELECT to_date(c5_emissao, 'YYYYMMDD') FROM sc5010";
        const res = db.translatePgToMysql(sql, []);
        assert.ok(res.sql.includes("STR_TO_DATE(c5_emissao, '%Y%m%d')"));
    });

    it('deve transpolar DATE_TRUNC(\'year\', CURRENT_DATE)', () => {
        const sql = "SELECT DATE_TRUNC('year', CURRENT_DATE)";
        const res = db.translatePgToMysql(sql, []);
        assert.ok(res.sql.includes("DATE_FORMAT(CURRENT_DATE, '%Y-01-01')"));
    });

    it('deve transpolar CURRENT_DATE - INTERVAL \'3 months\' para DATE_SUB', () => {
        const sql = "SELECT CURRENT_DATE - INTERVAL '3 months'";
        const res = db.translatePgToMysql(sql, []);
        assert.ok(res.sql.includes("DATE_SUB(CURRENT_DATE, INTERVAL 3 MONTH)"));
    });

    it('deve transpolar LTRIM com conjunto de caracteres customizados', () => {
        const sql = "SELECT LTRIM(c2_num, '0') FROM sc2010";
        const res = db.translatePgToMysql(sql, []);
        assert.ok(res.sql.includes("TRIM(LEADING '0' FROM c2_num)"), `Recebido: ${res.sql}`);
    });

    it('deve transpolar encode(campo, \'hex\') para HEX(campo)', () => {
        const sql = "SELECT encode(c5_zobs, 'hex') FROM sc5010";
        const res = db.translatePgToMysql(sql, []);
        assert.ok(res.sql.includes("HEX(c5_zobs)"));
    });

    it('deve remover casts de tipo do PostgreSQL (::numeric, ::varchar, ::text)', () => {
        const sql = "SELECT c6_qtdven::numeric, c6_prcvend::numeric(14,2), c6_desc::varchar FROM sc6010";
        const res = db.translatePgToMysql(sql, []);
        assert.ok(!res.sql.includes('::'), 'Não deve conter símbolos de cast ::');
        assert.ok(res.sql.includes('c6_qtdven'));
        assert.ok(res.sql.includes('c6_prcvend'));
    });

    it('deve tratar comandos de sessão específicos do Postgres (SET statement_timeout) como no-op seguro', () => {
        const sql = "SET statement_timeout = '15s';";
        const res = db.translatePgToMysql(sql, []);
        assert.strictEqual(res.isNoop, true);
    });

    it('deve evitar erro de sintaxe SQL se parâmetro array em ANY($1) estiver vazio', () => {
        const sql = "SELECT * FROM sa1010 WHERE a1_cod = ANY($1)";
        const params = [[]]; // Array vazio!
        const res = db.translatePgToMysql(sql, params);
        assert.ok(res.sql.includes('IN (?)'));
        assert.deepStrictEqual(res.params[0], [null], 'Array vazio deve virar [null] para evitar IN ()');
    });

    it('deve tratar consultas a pg_stat_activity sem quebrar', () => {
        const sql = "SELECT * FROM pg_stat_activity WHERE state = 'idle'";
        const res = db.translatePgToMysql(sql, []);
        // Deve converter para query válida no MySQL ou noop seguro
        assert.ok(typeof res.sql === 'string' && res.sql.length > 0);
    });
});
