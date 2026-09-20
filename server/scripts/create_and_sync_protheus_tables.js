/**
 * create_and_sync_protheus_tables.js
 * Cria tabelas idênticas às do Protheus no MySQL e migra os dados do PostgreSQL.
 * Tabelas: sh1010, sg1010, sg2010, sc2010, sd4010, sb2010, sh6010
 */

const pgDb = require('../db');
const mysql = require('../services/mysqlService');

async function createTables() {
    console.log('🚀 Criando tabelas Protheus no MySQL...');

    // 1. sh1010 - Recursos / Centros de Trabalho
    await mysql.query(`
        CREATE TABLE IF NOT EXISTS sh1010 (
            h1_filial VARCHAR(4) DEFAULT '0101',
            h1_codigo VARCHAR(10) NOT NULL,
            h1_descri VARCHAR(100) DEFAULT '',
            h1_ccusto VARCHAR(20) DEFAULT '',
            d_e_l_e_t_ VARCHAR(1) DEFAULT '',
            r_e_c_n_o_ BIGINT NOT NULL AUTO_INCREMENT,
            PRIMARY KEY (r_e_c_n_o_),
            UNIQUE KEY uq_sh1_cod (h1_codigo, d_e_l_e_t_),
            KEY idx_sh1_codigo (h1_codigo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. sg1010 - Estrutura dos Produtos (BOM)
    await mysql.query(`
        CREATE TABLE IF NOT EXISTS sg1010 (
            g1_filial VARCHAR(4) DEFAULT '0101',
            g1_cod VARCHAR(30) NOT NULL,
            g1_comp VARCHAR(30) NOT NULL,
            g1_trt VARCHAR(10) DEFAULT '',
            g1_quant DECIMAL(15,4) DEFAULT 1.0000,
            g1_perda DECIMAL(8,2) DEFAULT 0.00,
            g1_ini VARCHAR(8) DEFAULT '',
            g1_fim VARCHAR(8) DEFAULT '',
            g1_observ VARCHAR(100) DEFAULT '',
            g1_loccons VARCHAR(10) DEFAULT '01',
            g1_fantasm VARCHAR(1) DEFAULT '',
            d_e_l_e_t_ VARCHAR(1) DEFAULT '',
            r_e_c_n_o_ BIGINT NOT NULL AUTO_INCREMENT,
            PRIMARY KEY (r_e_c_n_o_),
            KEY idx_sg1_cod (g1_cod),
            KEY idx_sg1_comp (g1_comp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. sg2010 - Roteiros e Operações
    await mysql.query(`
        CREATE TABLE IF NOT EXISTS sg2010 (
            g2_filial VARCHAR(4) DEFAULT '0101',
            g2_codigo VARCHAR(10) DEFAULT '01',
            g2_produto VARCHAR(30) NOT NULL,
            g2_operac VARCHAR(10) NOT NULL,
            g2_recurso VARCHAR(20) NOT NULL,
            g2_ferram VARCHAR(20) DEFAULT '',
            g2_descri VARCHAR(255) DEFAULT '',
            g2_setup DECIMAL(12,4) DEFAULT 0.0000,
            g2_tempad DECIMAL(12,4) DEFAULT 0.0000,
            g2_lotepad DECIMAL(12,4) DEFAULT 1.0000,
            d_e_l_e_t_ VARCHAR(1) DEFAULT '',
            r_e_c_n_o_ BIGINT NOT NULL AUTO_INCREMENT,
            PRIMARY KEY (r_e_c_n_o_),
            KEY idx_sg2_prod (g2_produto),
            KEY idx_sg2_recurso (g2_recurso),
            KEY idx_sg2_operac (g2_operac)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. sc2010 - Cabeçalho das Ordens de Produção
    await mysql.query(`
        CREATE TABLE IF NOT EXISTS sc2010 (
            c2_filial VARCHAR(4) DEFAULT '0101',
            c2_num VARCHAR(10) NOT NULL,
            c2_item VARCHAR(10) DEFAULT '01',
            c2_sequen VARCHAR(10) DEFAULT '001',
            c2_produto VARCHAR(30) NOT NULL,
            c2_local VARCHAR(10) DEFAULT '01',
            c2_quant DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
            c2_um VARCHAR(10) DEFAULT 'UN',
            c2_datpri VARCHAR(10) DEFAULT '',
            c2_datprf VARCHAR(10) DEFAULT '',
            c2_obs VARCHAR(100) DEFAULT '',
            c2_emissao VARCHAR(10) DEFAULT '',
            c2_prior VARCHAR(10) DEFAULT '500',
            c2_quje DECIMAL(15,4) DEFAULT 0.0000,
            c2_status VARCHAR(10) DEFAULT 'P',
            c2_perda DECIMAL(10,2) DEFAULT 0.00,
            c2_roteiro VARCHAR(10) DEFAULT '01',
            c2_recurso VARCHAR(20) DEFAULT '',
            c2_pedido VARCHAR(20) DEFAULT '',
            c2_itempv VARCHAR(10) DEFAULT '',
            c2_tpop VARCHAR(10) DEFAULT 'F',
            c2_op VARCHAR(20) NOT NULL,
            d_e_l_e_t_ VARCHAR(1) DEFAULT '',
            r_e_c_n_o_ BIGINT NOT NULL AUTO_INCREMENT,
            PRIMARY KEY (r_e_c_n_o_),
            KEY idx_sc2_pedido (c2_pedido),
            KEY idx_sc2_num (c2_num, c2_item, c2_sequen),
            KEY idx_sc2_op (c2_op),
            KEY idx_sc2_produto (c2_produto)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. sd4010 - Requisições Empenhadas (Empenhos)
    await mysql.query(`
        CREATE TABLE IF NOT EXISTS sd4010 (
            d4_filial VARCHAR(4) DEFAULT '0101',
            d4_cod VARCHAR(30) NOT NULL,
            d4_local VARCHAR(10) DEFAULT '01',
            d4_op VARCHAR(20) NOT NULL,
            d4_data VARCHAR(10) DEFAULT '',
            d4_qtdeori DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
            d4_quant DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
            d4_trt VARCHAR(10) DEFAULT '',
            d4_oporig VARCHAR(20) DEFAULT '',
            d4_produto VARCHAR(30) DEFAULT '',
            d4_roteiro VARCHAR(10) DEFAULT '01',
            d4_operac VARCHAR(10) DEFAULT '',
            d4_qtneces DECIMAL(15,4) DEFAULT 0.0000,
            d_e_l_e_t_ VARCHAR(1) DEFAULT '',
            r_e_c_n_o_ BIGINT NOT NULL AUTO_INCREMENT,
            PRIMARY KEY (r_e_c_n_o_),
            KEY idx_sd4_op (d4_op),
            KEY idx_sd4_cod (d4_cod),
            KEY idx_sd4_prod (d4_produto)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. sb2010 - Saldos Físicos e Financeiros
    await mysql.query(`
        CREATE TABLE IF NOT EXISTS sb2010 (
            b2_filial VARCHAR(4) DEFAULT '0101',
            b2_cod VARCHAR(30) NOT NULL,
            b2_local VARCHAR(10) DEFAULT '01',
            b2_qatu DECIMAL(15,4) DEFAULT 0.0000,
            b2_qemp DECIMAL(15,4) DEFAULT 0.0000,
            b2_reserva DECIMAL(15,4) DEFAULT 0.0000,
            b2_qpedven DECIMAL(15,4) DEFAULT 0.0000,
            d_e_l_e_t_ VARCHAR(1) DEFAULT '',
            r_e_c_n_o_ BIGINT NOT NULL AUTO_INCREMENT,
            PRIMARY KEY (r_e_c_n_o_),
            KEY idx_sb2_cod (b2_cod, b2_local)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7. sh6010 - Apontamentos de Produção
    await mysql.query(`
        CREATE TABLE IF NOT EXISTS sh6010 (
            h6_filial VARCHAR(4) DEFAULT '0101',
            h6_op VARCHAR(20) NOT NULL,
            h6_produto VARCHAR(30) NOT NULL,
            h6_operac VARCHAR(10) NOT NULL,
            h6_recurso VARCHAR(20) NOT NULL,
            h6_dataini VARCHAR(10) DEFAULT '',
            h6_horaini VARCHAR(10) DEFAULT '',
            h6_datafin VARCHAR(10) DEFAULT '',
            h6_horafin VARCHAR(10) DEFAULT '',
            h6_qtdprod DECIMAL(15,4) DEFAULT 0.0000,
            h6_qtdperd DECIMAL(15,4) DEFAULT 0.0000,
            h6_pt VARCHAR(10) DEFAULT '',
            h6_dtapont VARCHAR(10) DEFAULT '',
            d_e_l_e_t_ VARCHAR(1) DEFAULT '',
            r_e_c_n_o_ BIGINT NOT NULL AUTO_INCREMENT,
            PRIMARY KEY (r_e_c_n_o_),
            KEY idx_sh6_op (h6_op),
            KEY idx_sh6_recurso (h6_recurso),
            KEY idx_sh6_prod (h6_produto)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('✅ Tabelas criadas com sucesso no MySQL!');
}

async function syncSh1010() {
    console.log('\n--- Sincronizando SH1010 (Recursos) ---');
    const { rows } = await pgDb.query(`
        SELECT 
            TRIM(COALESCE(h1_filial, '0101')) as filial,
            TRIM(h1_codigo) as codigo,
            TRIM(COALESCE(h1_descri, '')) as descri,
            TRIM(COALESCE(h1_ccusto, '')) as ccusto,
            r_e_c_n_o_ as recno
        FROM sh1010
        WHERE COALESCE(d_e_l_e_t_, '') = ''
    `);
    console.log(`Encontrados ${rows.length} registros ativos em sh1010.`);

    for (const r of rows) {
        await mysql.query(`
            INSERT INTO sh1010 (h1_filial, h1_codigo, h1_descri, h1_ccusto, r_e_c_n_o_)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                h1_descri = VALUES(h1_descri),
                h1_ccusto = VALUES(h1_ccusto)
        `, [r.filial, r.codigo, r.descri, r.ccusto, r.recno]);
    }
    console.log('✅ SH1010 sincronizado com sucesso.');
}

async function syncSg2010() {
    console.log('\n--- Sincronizando SG2010 (Roteiros) ---');
    const [[countRow]] = await mysql.query('SELECT COUNT(*) as cnt FROM sg2010');
    if (countRow.cnt > 50000) {
        console.log(`SG2010 já possui ${countRow.cnt} registros. Pulando migração completa.`);
        return;
    }

    const batchSize = 3000;
    let offset = 0;
    while (true) {
        const { rows } = await pgDb.query(`
            SELECT 
                TRIM(COALESCE(g2_filial, '0101')) as filial,
                TRIM(COALESCE(g2_codigo, '01')) as codigo,
                TRIM(g2_produto) as produto,
                TRIM(g2_operac) as operac,
                TRIM(g2_recurso) as recurso,
                TRIM(COALESCE(g2_ferram, '')) as ferram,
                TRIM(COALESCE(g2_descri, '')) as descri,
                COALESCE(g2_setup, 0) as setup,
                COALESCE(g2_tempad, 0) as tempad,
                COALESCE(g2_lotepad, 1) as lotepad,
                r_e_c_n_o_ as recno
            FROM sg2010
            WHERE COALESCE(d_e_l_e_t_, '') = ''
            ORDER BY r_e_c_n_o_ ASC
            LIMIT $1 OFFSET $2
        `, [batchSize, offset]);

        if (!rows || rows.length === 0) break;

        const values = rows.map(r => [
            r.filial, r.codigo, r.produto, r.operac, r.recurso,
            r.ferram, r.descri, r.setup, r.tempad, r.lotepad, r.recno
        ]);

        await mysql.query(`
            INSERT INTO sg2010 (
                g2_filial, g2_codigo, g2_produto, g2_operac, g2_recurso,
                g2_ferram, g2_descri, g2_setup, g2_tempad, g2_lotepad, r_e_c_n_o_
            ) VALUES ?
            ON DUPLICATE KEY UPDATE
                g2_recurso = VALUES(g2_recurso),
                g2_setup = VALUES(g2_setup),
                g2_tempad = VALUES(g2_tempad)
        `, [values]);

        offset += rows.length;
        process.stdout.write(`SG2010 sincronizados: ${offset} registros...\r`);
    }
    console.log(`\n✅ SG2010 sincronizado: ${offset} registros.`);
}

async function syncSg1010() {
    console.log('\n--- Sincronizando SG1010 (Estruturas/BOM) ---');
    const [[countRow]] = await mysql.query('SELECT COUNT(*) as cnt FROM sg1010');
    if (countRow.cnt > 50000) {
        console.log(`SG1010 já possui ${countRow.cnt} registros. Pulando migração completa.`);
        return;
    }

    const batchSize = 3000;
    let offset = 0;
    while (true) {
        const { rows } = await pgDb.query(`
            SELECT 
                TRIM(COALESCE(g1_filial, '0101')) as filial,
                TRIM(g1_cod) as cod,
                TRIM(g1_comp) as comp,
                TRIM(COALESCE(g1_trt, '')) as trt,
                COALESCE(g1_quant, 1) as quant,
                COALESCE(g1_perda, 0) as perda,
                TRIM(COALESCE(g1_ini, '')) as ini,
                TRIM(COALESCE(g1_fim, '')) as fim,
                TRIM(COALESCE(g1_observ, '')) as observ,
                TRIM(COALESCE(g1_loccons, '01')) as loccons,
                r_e_c_n_o_ as recno
            FROM sg1010
            WHERE COALESCE(d_e_l_e_t_, '') = ''
            ORDER BY r_e_c_n_o_ ASC
            LIMIT $1 OFFSET $2
        `, [batchSize, offset]);

        if (!rows || rows.length === 0) break;

        const values = rows.map(r => [
            r.filial, r.cod, r.comp, r.trt, r.quant,
            r.perda, r.ini, r.fim, r.observ, r.loccons, r.recno
        ]);

        await mysql.query(`
            INSERT INTO sg1010 (
                g1_filial, g1_cod, g1_comp, g1_trt, g1_quant,
                g1_perda, g1_ini, g1_fim, g1_observ, g1_loccons, r_e_c_n_o_
            ) VALUES ?
            ON DUPLICATE KEY UPDATE
                g1_quant = VALUES(g1_quant),
                g1_perda = VALUES(g1_perda)
        `, [values]);

        offset += rows.length;
        process.stdout.write(`SG1010 sincronizados: ${offset} registros...\r`);
    }
    console.log(`\n✅ SG1010 sincronizado: ${offset} registros.`);
}

async function syncSc2010() {
    console.log('\n--- Sincronizando SC2010 (Ordens de Produção) ---');
    const [[countRow]] = await mysql.query('SELECT COUNT(*) as cnt FROM sc2010');
    if (countRow.cnt > 100000) {
        console.log(`SC2010 já possui ${countRow.cnt} registros. Pulando migração completa.`);
        return;
    }

    const batchSize = 3000;
    let offset = 0;
    while (true) {
        const { rows } = await pgDb.query(`
            SELECT 
                TRIM(COALESCE(c2_filial, '0101')) as filial,
                TRIM(c2_num) as num,
                TRIM(COALESCE(c2_item, '01')) as item,
                TRIM(COALESCE(c2_sequen, '001')) as sequen,
                TRIM(c2_produto) as produto,
                TRIM(COALESCE(c2_local, '01')) as local,
                COALESCE(c2_quant, 0) as quant,
                TRIM(COALESCE(c2_um, 'UN')) as um,
                TRIM(COALESCE(c2_datpri, '')) as datpri,
                TRIM(COALESCE(c2_datprf, '')) as datprf,
                TRIM(COALESCE(c2_obs, '')) as obs,
                TRIM(COALESCE(c2_emissao, '')) as emissao,
                TRIM(COALESCE(c2_prior, '500')) as prior,
                COALESCE(c2_quje, 0) as quje,
                TRIM(COALESCE(c2_status, 'P')) as status,
                COALESCE(c2_perda, 0) as perda,
                TRIM(COALESCE(c2_roteiro, '01')) as roteiro,
                TRIM(COALESCE(c2_recurso, '')) as recurso,
                TRIM(COALESCE(c2_pedido, '')) as pedido,
                TRIM(COALESCE(c2_itempv, '')) as itempv,
                TRIM(COALESCE(c2_tpop, 'F')) as tpop,
                TRIM(COALESCE(c2_op, c2_num || c2_item || c2_sequen)) as op,
                r_e_c_n_o_ as recno
            FROM sc2010
            WHERE COALESCE(d_e_l_e_t_, '') = ''
            ORDER BY r_e_c_n_o_ ASC
            LIMIT $1 OFFSET $2
        `, [batchSize, offset]);

        if (!rows || rows.length === 0) break;

        const values = rows.map(r => [
            r.filial, r.num, r.item, r.sequen, r.produto,
            r.local, r.quant, r.um, r.datpri, r.datprf,
            r.obs, r.emissao, r.prior, r.quje, r.status,
            r.perda, r.roteiro, r.recurso, r.pedido, r.itempv,
            r.tpop, r.op, r.recno
        ]);

        await mysql.query(`
            INSERT INTO sc2010 (
                c2_filial, c2_num, c2_item, c2_sequen, c2_produto,
                c2_local, c2_quant, c2_um, c2_datpri, c2_datprf,
                c2_obs, c2_emissao, c2_prior, c2_quje, c2_status,
                c2_perda, c2_roteiro, c2_recurso, c2_pedido, c2_itempv,
                c2_tpop, c2_op, r_e_c_n_o_
            ) VALUES ?
            ON DUPLICATE KEY UPDATE
                c2_quant = VALUES(c2_quant),
                c2_quje = VALUES(c2_quje),
                c2_status = VALUES(c2_status),
                c2_datprf = VALUES(c2_datprf)
        `, [values]);

        offset += rows.length;
        process.stdout.write(`SC2010 sincronizados: ${offset} registros...\r`);
    }
    console.log(`\n✅ SC2010 sincronizado: ${offset} registros.`);
}

async function syncSd4010() {
    console.log('\n--- Sincronizando SD4010 (Empenhos) ---');
    const [[countRow]] = await mysql.query('SELECT COUNT(*) as cnt FROM sd4010');
    if (countRow.cnt > 200000) {
        console.log(`SD4010 já possui ${countRow.cnt} registros. Pulando migração completa.`);
        return;
    }

    const batchSize = 3000;
    let offset = 0;
    while (true) {
        const { rows } = await pgDb.query(`
            SELECT 
                TRIM(COALESCE(d4_filial, '0101')) as filial,
                TRIM(d4_cod) as cod,
                TRIM(COALESCE(d4_local, '01')) as local,
                TRIM(d4_op) as op,
                TRIM(COALESCE(d4_data, '')) as data,
                COALESCE(d4_qtdeori, 0) as qtdeori,
                COALESCE(d4_quant, 0) as quant,
                TRIM(COALESCE(d4_trt, '')) as trt,
                TRIM(COALESCE(d4_oporig, '')) as oporig,
                TRIM(COALESCE(d4_produto, '')) as produto,
                TRIM(COALESCE(d4_roteiro, '01')) as roteiro,
                TRIM(COALESCE(d4_operac, '')) as operac,
                COALESCE(d4_qtneces, 0) as qtneces,
                r_e_c_n_o_ as recno
            FROM sd4010
            WHERE COALESCE(d_e_l_e_t_, '') = ''
            ORDER BY r_e_c_n_o_ ASC
            LIMIT $1 OFFSET $2
        `, [batchSize, offset]);

        if (!rows || rows.length === 0) break;

        const values = rows.map(r => [
            r.filial, r.cod, r.local, r.op, r.data,
            r.qtdeori, r.quant, r.trt, r.oporig, r.produto,
            r.roteiro, r.operac, r.qtneces, r.recno
        ]);

        await mysql.query(`
            INSERT INTO sd4010 (
                d4_filial, d4_cod, d4_local, d4_op, d4_data,
                d4_qtdeori, d4_quant, d4_trt, d4_oporig, d4_produto,
                d4_roteiro, d4_operac, d4_qtneces, r_e_c_n_o_
            ) VALUES ?
            ON DUPLICATE KEY UPDATE
                d4_quant = VALUES(d4_quant)
        `, [values]);

        offset += rows.length;
        process.stdout.write(`SD4010 sincronizados: ${offset} registros...\r`);
    }
    console.log(`\n✅ SD4010 sincronizado: ${offset} registros.`);
}

async function syncSb2010() {
    console.log('\n--- Sincronizando SB2010 (Saldos/Empenhos) ---');
    const [[countRow]] = await mysql.query('SELECT COUNT(*) as cnt FROM sb2010');
    if (countRow.cnt > 200000) {
        console.log(`SB2010 já possui ${countRow.cnt} registros. Pulando migração completa.`);
        return;
    }

    const batchSize = 3000;
    let offset = 0;
    while (true) {
        const { rows } = await pgDb.query(`
            SELECT 
                TRIM(COALESCE(b2_filial, '0101')) as filial,
                TRIM(b2_cod) as cod,
                TRIM(COALESCE(b2_local, '01')) as local,
                COALESCE(b2_qatu, 0) as qatu,
                COALESCE(b2_qemp, 0) as qemp,
                COALESCE(b2_reserva, 0) as reserva,
                COALESCE(b2_qpedven, 0) as qpedven,
                r_e_c_n_o_ as recno
            FROM sb2010
            WHERE COALESCE(d_e_l_e_t_, '') = ''
            ORDER BY r_e_c_n_o_ ASC
            LIMIT $1 OFFSET $2
        `, [batchSize, offset]);

        if (!rows || rows.length === 0) break;

        const values = rows.map(r => [
            r.filial, r.cod, r.local, r.qatu,
            r.qemp, r.reserva, r.qpedven, r.recno
        ]);

        await mysql.query(`
            INSERT INTO sb2010 (
                b2_filial, b2_cod, b2_local, b2_qatu,
                b2_qemp, b2_reserva, b2_qpedven, r_e_c_n_o_
            ) VALUES ?
            ON DUPLICATE KEY UPDATE
                b2_qatu = VALUES(b2_qatu),
                b2_qemp = VALUES(b2_qemp),
                b2_reserva = VALUES(b2_reserva)
        `, [values]);

        offset += rows.length;
        process.stdout.write(`SB2010 sincronizados: ${offset} registros...\r`);
    }
    console.log(`\n✅ SB2010 sincronizado: ${offset} registros.`);
}

async function run() {
    try {
        await createTables();
        await syncSh1010();
        await syncSg2010();
        await syncSg1010();
        await syncSc2010();
        await syncSd4010();
        await syncSb2010();
        console.log('\n🎉 SINCRONIZAÇÃO COMPLETA DE TODAS AS TABELAS DO PROTHEUS NO MYSQL CONCLUÍDA!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro na sincronização:', err);
        process.exit(1);
    }
}

run();
