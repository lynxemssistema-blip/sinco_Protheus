const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pgPool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

const mysqlPool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
});

const parseDateObj = (val) => {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    const str = String(val).trim();
    if (/^\d{8}$/.test(str)) {
        const y = parseInt(str.substring(0, 4), 10);
        const m = parseInt(str.substring(4, 6), 10) - 1;
        const d = parseInt(str.substring(6, 8), 10);
        return new Date(y, m, d, 12, 0, 0);
    }
    if (str.includes('T') || str.includes('-')) {
        const parts = str.split('T')[0].split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            return new Date(y, m, d, 12, 0, 0);
        }
    }
    const dt = new Date(val);
    return isNaN(dt.getTime()) ? null : dt;
};

async function generateVmiBicromatReport() {
    console.log('⏳ Iniciando geração consolidada do Relatório de Bicromatização & Zincagens VMI (Estrutura Completa)...');
    const pg = await pgPool.connect();

    try {
        // 1. Itens em aberto de pedidos VMI (todos com saldo a faturar)
        const sc6 = await pg.query(`
            SELECT TRIM(sc6.c6_num) as pedido, TRIM(sc6.c6_item) as item,
                   TRIM(sc6.c6_cli) as cli_cod, TRIM(sa1.a1_nome) as cliente,
                   TRIM(sc6.c6_produto) as produto, TRIM(sb1.b1_desc) as desc,
                   TRIM(sb1.b1_um) as um,
                   sc6.c6_qtdven::numeric as qtd_ped, sc6.c6_qtdent::numeric as qtd_entreg,
                   (sc6.c6_qtdven::numeric - sc6.c6_qtdent::numeric) as saldo,
                   sc6.c6_entreg as entrega
            FROM sc6010 sc6
            JOIN sa1010 sa1 ON sa1.a1_cod = sc6.c6_cli AND sa1.a1_loja = sc6.c6_loja AND COALESCE(sa1.d_e_l_e_t_, '') = ''
            JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sc6.c6_produto) AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            WHERE (sa1.a1_nome ILIKE '%VMI%' OR sc6.c6_cli = '000001')
              AND (sc6.c6_qtdven::numeric - sc6.c6_qtdent::numeric) > 0
              AND COALESCE(sc6.d_e_l_e_t_, '') = ''
              AND sc6.c6_blq <> 'R'
            ORDER BY sc6.c6_entreg, sc6.c6_num
        `);
        console.log(`✓ Total de itens VMI com saldo a faturar: ${sc6.rows.length}`);

        // 2. Buscar PCP Delivery Forecasts no MySQL
        const [pcpRows] = await mysqlPool.query(`
            SELECT TRIM(pedido) as pedido, TRIM(item) as item,
                   DATE_FORMAT(data_entrega_pcp, '%Y%m%d') as data_pcp,
                   quantidade_pcp as qtde_pcp
            FROM app_pcp_delivery_forecasts
        `);
        const pcpMap = {};
        pcpRows.forEach(r => {
            const k = `${r.pedido}_${r.item}`;
            if (!pcpMap[k]) pcpMap[k] = r;
        });

        // 3. Obter BOM recursiva completa de todos os produtos
        const uniqueProds = [...new Set(sc6.rows.map(it => it.produto))];
        await pg.query("SET client_encoding TO 'WIN1252'");
        const bomQuery = await pg.query(`
            WITH RECURSIVE bom AS (
                SELECT TRIM(g1_cod) AS raiz, TRIM(g1_comp) AS comp, g1_quant::numeric AS quant, 1 AS nivel
                FROM sg1010
                WHERE TRIM(g1_cod) = ANY($1::text[]) AND COALESCE(d_e_l_e_t_, '') = ''
                UNION ALL
                SELECT bom.raiz, TRIM(sg1.g1_comp), bom.quant * sg1.g1_quant::numeric, bom.nivel + 1
                FROM sg1010 sg1
                JOIN bom ON TRIM(sg1.g1_cod) = bom.comp
                WHERE COALESCE(sg1.d_e_l_e_t_, '') = '' AND bom.nivel < 15
            )
            SELECT bom.raiz, bom.comp, SUM(bom.quant) as quant_total, 
                   TRIM(MAX(sb1.b1_desc)) as desc, TRIM(MAX(sb1.b1_um)) as um, TRIM(MAX(sb1.b1_tipo)) as tipo
            FROM bom 
            LEFT JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = bom.comp AND COALESCE(sb1.d_e_l_e_t_, '') = '' 
            GROUP BY bom.raiz, bom.comp 
            ORDER BY bom.raiz, bom.comp
        `, [uniqueProds]);
        await pg.query("SET client_encoding TO 'UTF8'");

        const bomMap = {};
        const allCodes = new Set(uniqueProds);
        bomQuery.rows.forEach(r => {
            allCodes.add(r.comp);
            if (!bomMap[r.raiz]) bomMap[r.raiz] = [];
            bomMap[r.raiz].push({
                comp: r.comp,
                quant: parseFloat(r.quant_total) || 0,
                desc: r.desc || '',
                um: r.um || '',
                tipo: r.tipo || ''
            });
        });

        // 4. Buscar roteiro SG2 de todos os códigos (pais e filhos)
        await pg.query("SET client_encoding TO 'WIN1252'");
        const sg2 = await pg.query(`
            SELECT TRIM(g2_produto) as produto, TRIM(g2_recurso) as recurso, TRIM(sh1.h1_descri) as recurso_nome
            FROM sg2010 sg2
            JOIN sh1010 sh1 ON TRIM(sh1.h1_codigo) = TRIM(sg2.g2_recurso)
            WHERE TRIM(g2_produto) = ANY($1::text[]) AND COALESCE(sg2.d_e_l_e_t_, '') = ''
        `, [[...allCodes]]);
        await pg.query("SET client_encoding TO 'UTF8'");

        const stTargetCodes = [
            'ST0001', 'ST0038', 'ST0047', 'ST0040', 'ST0003',
            'ST0013', 'ST0011', 'ST0020', 'ST0036', 'ST0041',
            'ST0058', 'MST040'
        ];

        const prodRoutingMap = {};
        sg2.rows.forEach(r => {
            if (!prodRoutingMap[r.produto]) prodRoutingMap[r.produto] = [];
            prodRoutingMap[r.produto].push(r);
        });

        const getTreatmentResource = (cod) => {
            const routes = prodRoutingMap[cod] || [];
            return routes.find(r => {
                const isTargetCode = stTargetCodes.includes(r.recurso);
                const desc = (r.recurso_nome || '').toUpperCase();
                const isTargetDesc = desc.includes('BICROM') || desc.includes('ZINC') || desc.includes('CROMAT') || desc.includes('GALVANIZ') || desc.includes('PASSIV') || desc.includes('IR.AMARELO') || desc.includes('IR.AZUL');
                return isTargetCode || isTargetDesc;
            });
        };

        // 5. Montar Linhas Analíticas e Mapas de Agrupamento
        const detailedRows = [];
        const dateGroupingMap = {};
        const monthGroupingMap = {};
        const chapaGroupingMap = {};
        const recursoGroupingMap = {};

        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        sc6.rows.forEach(it => {
            const pcp = pcpMap[`${it.pedido}_${it.item}`];
            const dataRef = pcp?.data_pcp || it.entrega;
            const isPcpDate = !!pcp?.data_pcp;
            const qtdBase = pcp?.qtde_pcp ? Number(pcp.qtde_pcp) : Number(it.saldo);

            // Verifica se o produto pai passa por recurso de tratamento
            const paiRes = getTreatmentResource(it.produto);
            const comps = bomMap[it.produto] || [];

            // Identificar todas as matérias-primas de chapa (MTC-*, tipo MP com UM KG ou descrição CHAPA)
            const chapas = comps.filter(c => {
                return c.tipo === 'MP' && (c.comp.startsWith('MTC-') || c.um === 'KG' || c.desc.includes('CHAPA'));
            });

            if (paiRes && chapas.length > 0) {
                const recursoDesc = `${paiRes.recurso} - ${paiRes.recurso_nome || 'TRATAMENTO'}`;
                const parsedDate = parseDateObj(dataRef);

                chapas.forEach(chapa => {
                    const kgUnit = Number(chapa.quant) || 0;
                    const kgTotal = qtdBase * kgUnit;

                    const row = {
                        pedido: it.pedido,
                        item: it.item,
                        cliente: it.cliente,
                        produtoPai: it.produto,
                        descPai: it.desc,
                        dataRef: parsedDate,
                        dataRefRaw: dataRef,
                        origemData: isPcpDate ? 'Data PCP' : 'Data de Entrega',
                        qtdPecas: qtdBase,
                        chapaCod: chapa.comp,
                        chapaDesc: chapa.desc,
                        chapaUM: chapa.um || 'KG',
                        kgUnitario: kgUnit,
                        kgTotal: kgTotal,
                        recursoST: recursoDesc,
                        recursoCod: paiRes.recurso
                    };
                    detailedRows.push(row);

                    // Agrupamento por Data
                    const dKey = String(dataRef);
                    if (!dateGroupingMap[dKey]) {
                        dateGroupingMap[dKey] = {
                            dataRef: parsedDate,
                            dataRefRaw: dKey,
                            origemData: isPcpDate ? 'Data PCP' : 'Data de Entrega',
                            qtdTotalPecas: 0,
                            kgTotalChapa: 0,
                            produtos: new Set(),
                            pedidos: new Set(),
                            itensCount: 0
                        };
                    }
                    dateGroupingMap[dKey].qtdTotalPecas += qtdBase;
                    dateGroupingMap[dKey].kgTotalChapa += kgTotal;
                    dateGroupingMap[dKey].produtos.add(it.produto);
                    dateGroupingMap[dKey].pedidos.add(it.pedido);
                    dateGroupingMap[dKey].itensCount++;

                    // Agrupamento por Mês
                    const mKey = (() => {
                        if (!parsedDate) return 'Sem Data';
                        const y = parsedDate.getFullYear();
                        const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
                        return `${y}-${m}`;
                    })();

                    if (!monthGroupingMap[mKey]) {
                        let label = mKey;
                        if (parsedDate) {
                            label = `${monthNames[parsedDate.getMonth()]}/${parsedDate.getFullYear()}`;
                        }
                        monthGroupingMap[mKey] = {
                            mesKey: mKey,
                            mesLabel: label,
                            qtdTotalPecas: 0,
                            kgTotalChapa: 0,
                            kgST0001: 0,
                            kgST0038: 0,
                            kgST0040: 0,
                            kgOutrosST: 0,
                            produtos: new Set(),
                            pedidos: new Set(),
                            itensCount: 0
                        };
                    }
                    monthGroupingMap[mKey].qtdTotalPecas += qtdBase;
                    monthGroupingMap[mKey].kgTotalChapa += kgTotal;
                    if (paiRes.recurso === 'ST0001') monthGroupingMap[mKey].kgST0001 += kgTotal;
                    else if (paiRes.recurso === 'ST0038') monthGroupingMap[mKey].kgST0038 += kgTotal;
                    else if (paiRes.recurso === 'ST0040') monthGroupingMap[mKey].kgST0040 += kgTotal;
                    else monthGroupingMap[mKey].kgOutrosST += kgTotal;

                    monthGroupingMap[mKey].produtos.add(it.produto);
                    monthGroupingMap[mKey].pedidos.add(it.pedido);
                    monthGroupingMap[mKey].itensCount++;

                    // Agrupamento por Chapa
                    const cKey = chapa.comp;
                    if (!chapaGroupingMap[cKey]) {
                        chapaGroupingMap[cKey] = {
                            chapaCod: chapa.comp,
                            chapaDesc: chapa.desc,
                            chapaUM: chapa.um || 'KG',
                            qtdTotalPecas: 0,
                            kgTotalChapa: 0,
                            produtos: new Set(),
                            pedidos: new Set()
                        };
                    }
                    chapaGroupingMap[cKey].qtdTotalPecas += qtdBase;
                    chapaGroupingMap[cKey].kgTotalChapa += kgTotal;
                    chapaGroupingMap[cKey].produtos.add(it.produto);
                    chapaGroupingMap[cKey].pedidos.add(it.pedido);

                    // Agrupamento por Recurso
                    const rKey = recursoDesc;
                    if (!recursoGroupingMap[rKey]) {
                        recursoGroupingMap[rKey] = {
                            recursoST: recursoDesc,
                            recursoCod: paiRes.recurso,
                            qtdTotalPecas: 0,
                            kgTotalChapa: 0,
                            produtos: new Set(),
                            pedidos: new Set(),
                            itensCount: 0
                        };
                    }
                    recursoGroupingMap[rKey].qtdTotalPecas += qtdBase;
                    recursoGroupingMap[rKey].kgTotalChapa += kgTotal;
                    recursoGroupingMap[rKey].produtos.add(it.produto);
                    recursoGroupingMap[rKey].pedidos.add(it.pedido);
                    recursoGroupingMap[rKey].itensCount++;
                });
            }
        });

        console.log(`✓ Total de registros analíticos gerados: ${detailedRows.length}`);

        // ── CRIAR WORKBOOK EXCELJS ESTILO METALFISA ──
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MetalFisa Industrial';
        workbook.created = new Date();
        workbook.modified = new Date();

        const NAVY   = 'FF1E3A5F';
        const BLUE   = 'FF0D6EFD';
        const WHITE  = 'FFFFFFFF';
        const GRAY   = 'FFF5F7FA';
        const DGRAY  = 'FFD0D7E2';
        const BLACK  = 'FF1A1A2E';
        const ACCENT = 'FF00B4D8';

        const setFill = (c, argb) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; };
        const setFont = (c, opts) => { c.font = { name: 'Calibri', ...opts }; };
        const setAlign = (c, h, v = 'middle') => { c.alignment = { horizontal: h, vertical: v, wrapText: false }; };
        const setBorder = (c, style = 'thin', color = DGRAY) => {
            const s = { style, color: { argb: color } };
            c.border = { top: s, left: s, bottom: s, right: s };
        };

        const applyMetalFisaTableStyle = (sheet, numFixedCols = sheet.columnCount) => {
            const totalCols = sheet.columnCount;
            const lastRow   = sheet.rowCount;

            const hdr = sheet.getRow(1);
            hdr.height = 22;
            for (let c = 1; c <= totalCols; c++) {
                const cell = hdr.getCell(c);
                const isFixed = c <= numFixedCols;
                setFill(cell, isFixed ? NAVY : BLUE);
                setFont(cell, { bold: true, size: 9.5, color: { argb: WHITE } });
                setAlign(cell, 'center', 'middle');
                cell.border = {
                    top: { style: 'thin', color: { argb: WHITE } },
                    bottom: { style: 'thin', color: { argb: WHITE } },
                    left: { style: 'thin', color: { argb: WHITE } },
                    right: { style: 'thin', color: { argb: WHITE } }
                };
            }

            for (let r = 2; r <= lastRow; r++) {
                const row = sheet.getRow(r);
                const bg = (r % 2 === 0) ? GRAY : WHITE;
                row.height = 18;
                for (let c = 1; c <= totalCols; c++) {
                    const cell = row.getCell(c);
                    setFill(cell, bg);
                    setFont(cell, { size: 9, color: { argb: BLACK } });
                    if (!cell.alignment) {
                        setAlign(cell, c <= 2 ? 'center' : 'left', 'middle');
                    }
                    setBorder(cell, 'hair', DGRAY);
                }
            }

            sheet.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: 1, column: totalCols }
            };
        };

        // ══════════════════════════════════════════════════════════════════════════
        // 1. ABA: CAPA
        // ══════════════════════════════════════════════════════════════════════════
        const sheetCapa = workbook.addWorksheet('Capa');
        sheetCapa.views = [{ showGridLines: false }];
        [4, 22, 22, 18, 18, 18, 18, 18, 18, 14].forEach((w, i) => { sheetCapa.getColumn(i + 1).width = w; });

        sheetCapa.mergeCells('A1:J3');
        const titleCell = sheetCapa.getCell('A1');
        titleCell.value = 'METALFISA INDÚSTRIA E COMÉRCIO LTDA';
        setFill(titleCell, NAVY);
        setFont(titleCell, { bold: true, size: 18, color: { argb: WHITE } });
        setAlign(titleCell, 'center', 'middle');

        sheetCapa.mergeCells('A4:J4');
        const subCell = sheetCapa.getCell('A4');
        subCell.value = 'Estudo de Demanda de Bicromatização & Zincagens (ST) — Peso de Chapas (KG) por Data PCP / Entrega';
        setFill(subCell, BLUE);
        setFont(subCell, { bold: false, size: 11, italic: true, color: { argb: WHITE } });
        setAlign(subCell, 'center', 'middle');

        sheetCapa.mergeCells('A5:J5');
        setFill(sheetCapa.getCell('A5'), ACCENT);
        sheetCapa.getRow(5).height = 4;

        const totalKgGeral = detailedRows.reduce((s, r) => s + r.kgTotal, 0);
        const totalPecasGeral = [...new Set(detailedRows.map(r => `${r.pedido}_${r.item}`))].reduce((s, k) => {
            const row = detailedRows.find(r => `${r.pedido}_${r.item}` === k);
            return s + (row ? row.qtdPecas : 0);
        }, 0);
        const totalPedidosGeral = new Set(detailedRows.map(r => r.pedido)).size;
        const totalRecursosGeral = Object.keys(recursoGroupingMap).length;
        const totalMesesGeral = Object.keys(monthGroupingMap).length;

        const infoList = [
            ['Cliente Alvo:', 'VMI SISTEMAS DE SEGURANÇA LTDA'],
            ['Status de Produção:', 'Saldo Total a Faturar (Inclui itens com e sem apontamento)'],
            ['Recursos Considerados:', 'Bicromatização, Passivação e Zincagem (ST0001, ST0038, ST0040, etc.)'],
            ['Explosão da Estrutura:', 'Abertura total da BOM multinível até matérias-primas de chapa (MTC-*)'],
            ['Regra de Data:', 'Data de Programação do PCP (fallback para Data de Entrega do Pedido)'],
            ['Data de Emissão:', new Date().toLocaleString('pt-BR')],
        ];

        infoList.forEach(([label, val], idx) => {
            const r = 7 + idx;
            sheetCapa.mergeCells(`B${r}:D${r}`);
            sheetCapa.mergeCells(`E${r}:J${r}`);
            const lc = sheetCapa.getCell(`B${r}`);
            const vc = sheetCapa.getCell(`E${r}`);
            lc.value = label; vc.value = val;
            setFont(lc, { bold: true, size: 10, color: { argb: NAVY } });
            setFont(vc, { size: 10, color: { argb: BLACK } });
            setFill(lc, idx % 2 === 0 ? GRAY : WHITE);
            setFill(vc, idx % 2 === 0 ? GRAY : WHITE);
            sheetCapa.getRow(r).height = 18;
        });

        sheetCapa.getRow(14).height = 14;
        sheetCapa.mergeCells('A14:J14');
        setFill(sheetCapa.getCell('A14'), DGRAY);

        const kpis = [
            ['PESO TOTAL DE CHAPA (KG)', totalKgGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' KG'],
            ['TOTAL DE PEÇAS (PAI)', totalPecasGeral.toLocaleString('pt-BR')],
            ['TOTAL DE PEDIDOS', totalPedidosGeral],
            ['MESES PROGRAMADOS', totalMesesGeral]
        ];

        sheetCapa.getRow(15).height = 16;
        sheetCapa.getRow(16).height = 26;
        kpis.forEach(([label, val], idx) => {
            const col = idx * 2 + 2;
            sheetCapa.mergeCells(15, col, 15, col + 1);
            sheetCapa.mergeCells(16, col, 16, col + 1);
            const lc = sheetCapa.getCell(15, col);
            const vc = sheetCapa.getCell(16, col);
            lc.value = label; vc.value = val;
            setFont(lc, { bold: true, size: 9, color: { argb: WHITE } });
            setFont(vc, { bold: true, size: 14, color: { argb: NAVY } });
            setFill(lc, NAVY);
            setFill(vc, GRAY);
            setAlign(lc, 'center', 'middle');
            setAlign(vc, 'center', 'middle');
            setBorder(lc, 'thin', NAVY);
            setBorder(vc, 'thin', DGRAY);
        });

        // ══════════════════════════════════════════════════════════════════════════
        // 2. ABA: CONSOLIDADO POR RECURSO / BANHO
        // ══════════════════════════════════════════════════════════════════════════
        const sheetRecursos = workbook.addWorksheet('Resumo por Recurso');
        sheetRecursos.columns = [
            { header: 'Recurso de Terceiro (ST)', key: 'recursoST', width: 35 },
            { header: 'Peso Total Chapa (KG)', key: 'kgTotalChapa', width: 24 },
            { header: 'Qtd Peças Atendidas', key: 'qtdTotalPecas', width: 22 },
            { header: 'Qtd Pedidos', key: 'pedidosCount', width: 14 },
            { header: 'Qtd Itens Distintos', key: 'itensCount', width: 18 },
            { header: 'Produtos Atendidos', key: 'produtosList', width: 45 }
        ];

        const sortedRecursos = Object.values(recursoGroupingMap).sort((a, b) => b.kgTotalChapa - a.kgTotalChapa);
        sortedRecursos.forEach(r => {
            sheetRecursos.addRow({
                recursoST: r.recursoST,
                kgTotalChapa: r.kgTotalChapa,
                qtdTotalPecas: r.qtdTotalPecas,
                pedidosCount: r.pedidos.size,
                itensCount: r.itensCount,
                produtosList: [...r.produtos].join(', ')
            });
        });

        sheetRecursos.getColumn('kgTotalChapa').numFmt = '#,##0.00';
        sheetRecursos.getColumn('qtdTotalPecas').numFmt = '#,##0';
        sheetRecursos.getColumn('pedidosCount').numFmt = '#,##0';
        sheetRecursos.getColumn('itensCount').numFmt = '#,##0';
        applyMetalFisaTableStyle(sheetRecursos, 1);

        // ══════════════════════════════════════════════════════════════════════════
        // 3. ABA: RESUMO POR MÊS (Visão Mensal de Carga)
        // ══════════════════════════════════════════════════════════════════════════
        const sheetMes = workbook.addWorksheet('Resumo por Mês');
        sheetMes.columns = [
            { header: 'Mês / Ano', key: 'mesLabel', width: 20 },
            { header: 'Total Peso Chapa (KG)', key: 'kgTotalChapa', width: 24 },
            { header: 'ST0001 - Bicromatização (KG)', key: 'kgST0001', width: 28 },
            { header: 'ST0038 - Iridite Amarelo (KG)', key: 'kgST0038', width: 28 },
            { header: 'ST0040 - Passivação Azul (KG)', key: 'kgST0040', width: 28 },
            { header: 'Outros Banhos (KG)', key: 'kgOutrosST', width: 20 },
            { header: 'Qtd Peças a Produzir', key: 'qtdTotalPecas', width: 22 },
            { header: 'Qtd Pedidos', key: 'pedidosCount', width: 14 },
            { header: 'Qtd Itens Distintos', key: 'itensCount', width: 18 }
        ];

        const sortedMonthGroups = Object.values(monthGroupingMap).sort((a, b) => String(a.mesKey).localeCompare(String(b.mesKey)));
        sortedMonthGroups.forEach(m => {
            sheetMes.addRow({
                mesLabel: m.mesLabel,
                kgTotalChapa: m.kgTotalChapa,
                kgST0001: m.kgST0001,
                kgST0038: m.kgST0038,
                kgST0040: m.kgST0040,
                kgOutrosST: m.kgOutrosST,
                qtdTotalPecas: m.qtdTotalPecas,
                pedidosCount: m.pedidos.size,
                itensCount: m.itensCount
            });
        });

        sheetMes.getColumn('kgTotalChapa').numFmt = '#,##0.00';
        sheetMes.getColumn('kgST0001').numFmt = '#,##0.00';
        sheetMes.getColumn('kgST0038').numFmt = '#,##0.00';
        sheetMes.getColumn('kgST0040').numFmt = '#,##0.00';
        sheetMes.getColumn('kgOutrosST').numFmt = '#,##0.00';
        sheetMes.getColumn('qtdTotalPecas').numFmt = '#,##0';
        sheetMes.getColumn('pedidosCount').numFmt = '#,##0';
        sheetMes.getColumn('itensCount').numFmt = '#,##0';
        applyMetalFisaTableStyle(sheetMes, 1);

        // ══════════════════════════════════════════════════════════════════════════
        // 3. ABA: RESUMO POR DATA (Cronograma de Envio)
        // ══════════════════════════════════════════════════════════════════════════
        const sheetResumoData = workbook.addWorksheet('Resumo por Data');
        sheetResumoData.columns = [
            { header: 'Data Referência', key: 'dataRef', width: 16 },
            { header: 'Origem da Data', key: 'origemData', width: 16 },
            { header: 'Qtd Peças a Produzir', key: 'qtdTotalPecas', width: 22 },
            { header: 'Total Peso Chapa (KG)', key: 'kgTotalChapa', width: 24 },
            { header: 'Qtd Pedidos', key: 'pedidosCount', width: 14 },
            { header: 'Qtd Itens Distintos', key: 'itensCount', width: 18 },
            { header: 'Produtos Atendidos', key: 'produtosList', width: 45 }
        ];

        const sortedDateGroups = Object.values(dateGroupingMap).sort((a, b) => String(a.dataRefRaw).localeCompare(String(b.dataRefRaw)));
        sortedDateGroups.forEach(d => {
            sheetResumoData.addRow({
                dataRef: d.dataRef,
                origemData: d.origemData,
                qtdTotalPecas: d.qtdTotalPecas,
                kgTotalChapa: d.kgTotalChapa,
                pedidosCount: d.pedidos.size,
                itensCount: d.itensCount,
                produtosList: [...d.produtos].join(', ')
            });
        });

        sheetResumoData.getColumn('dataRef').numFmt = 'dd/mm/yyyy';
        sheetResumoData.getColumn('qtdTotalPecas').numFmt = '#,##0';
        sheetResumoData.getColumn('kgTotalChapa').numFmt = '#,##0.00';
        sheetResumoData.getColumn('pedidosCount').numFmt = '#,##0';
        sheetResumoData.getColumn('itensCount').numFmt = '#,##0';
        applyMetalFisaTableStyle(sheetResumoData, 2);

        // ══════════════════════════════════════════════════════════════════════════
        // 4. ABA: CONSOLIDADO POR CHAPA (MP)
        // ══════════════════════════════════════════════════════════════════════════
        const sheetChapas = workbook.addWorksheet('Consolidado por Chapa');
        sheetChapas.columns = [
            { header: 'Cód. Matéria-Prima (Chapa)', key: 'chapaCod', width: 25 },
            { header: 'Descrição da Chapa Metálica', key: 'chapaDesc', width: 40 },
            { header: 'UM', key: 'chapaUM', width: 8 },
            { header: 'Peso Total Necessário (KG)', key: 'kgTotalChapa', width: 26 },
            { header: 'Qtd Peças Finais Atendidas', key: 'qtdTotalPecas', width: 24 },
            { header: 'Produtos Finais Vinculados', key: 'produtosList', width: 45 }
        ];

        const sortedChapaGroups = Object.values(chapaGroupingMap).sort((a, b) => b.kgTotalChapa - a.kgTotalChapa);
        sortedChapaGroups.forEach(c => {
            sheetChapas.addRow({
                chapaCod: c.chapaCod,
                chapaDesc: c.chapaDesc,
                chapaUM: c.chapaUM,
                kgTotalChapa: c.kgTotalChapa,
                qtdTotalPecas: c.qtdTotalPecas,
                produtosList: [...c.produtos].join(', ')
            });
        });

        sheetChapas.getColumn('kgTotalChapa').numFmt = '#,##0.00';
        sheetChapas.getColumn('qtdTotalPecas').numFmt = '#,##0';
        applyMetalFisaTableStyle(sheetChapas, 2);

        // ══════════════════════════════════════════════════════════════════════════
        // 5. ABA: DETALHAMENTO DE DEMANDA (Analítico)
        // ══════════════════════════════════════════════════════════════════════════
        const sheetDetalhe = workbook.addWorksheet('Detalhamento de Demanda');
        sheetDetalhe.columns = [
            { header: 'Pedido', key: 'pedido', width: 12 },
            { header: 'Item', key: 'item', width: 8 },
            { header: 'Cliente', key: 'cliente', width: 32 },
            { header: 'Produto Pai', key: 'produtoPai', width: 16 },
            { header: 'Descrição Produto Pai', key: 'descPai', width: 38 },
            { header: 'Data Referência', key: 'dataRef', width: 15 },
            { header: 'Origem Data', key: 'origemData', width: 14 },
            { header: 'Qtd a Produzir', key: 'qtdPecas', width: 14 },
            { header: 'Cód. Chapa (MP)', key: 'chapaCod', width: 18 },
            { header: 'Descrição da Chapa', key: 'chapaDesc', width: 38 },
            { header: 'UM', key: 'chapaUM', width: 8 },
            { header: 'Consumo Unit. (KG)', key: 'kgUnitario', width: 18 },
            { header: 'Peso Total Chapa (KG)', key: 'kgTotal', width: 22 },
            { header: 'Recurso Terceiro', key: 'recursoST', width: 35 }
        ];

        detailedRows.forEach(r => {
            sheetDetalhe.addRow({
                pedido: r.pedido,
                item: r.item,
                cliente: r.cliente,
                produtoPai: r.produtoPai,
                descPai: r.descPai,
                dataRef: r.dataRef,
                origemData: r.origemData,
                qtdPecas: r.qtdPecas,
                chapaCod: r.chapaCod,
                chapaDesc: r.chapaDesc,
                chapaUM: r.chapaUM,
                kgUnitario: r.kgUnitario,
                kgTotal: r.kgTotal,
                recursoST: r.recursoST
            });
        });

        sheetDetalhe.getColumn('dataRef').numFmt = 'dd/mm/yyyy';
        sheetDetalhe.getColumn('qtdPecas').numFmt = '#,##0';
        sheetDetalhe.getColumn('kgUnitario').numFmt = '#,##0.0000';
        sheetDetalhe.getColumn('kgTotal').numFmt = '#,##0.00';
        applyMetalFisaTableStyle(sheetDetalhe, 5);

        // ── GRAVAÇÃO DO ARQUIVO ──
        const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const outFileName = `Relatorio_Bicromatizacao_VMI_${todayStr}.xlsx`;
        
        const downloadsPath = path.join('C:\\Users\\lynx\\Downloads', outFileName);
        const localPath = path.join(__dirname, '../../', outFileName);

        await workbook.xlsx.writeFile(downloadsPath);
        console.log(`✅ Arquivo atualizado em: ${downloadsPath}`);

        try {
            await workbook.xlsx.writeFile(localPath);
            console.log(`✅ Cópia salva no projeto em: ${localPath}`);
        } catch (e) {}

        return {
            downloadsPath,
            totalKg: totalKgGeral,
            totalPecas: totalPecasGeral,
            totalPedidos: totalPedidosGeral,
            totalRecursos: totalRecursosGeral,
            totalLinhas: detailedRows.length
        };

    } finally {
        pg.release();
        if (require.main === module) {
            await pgPool.end();
            await mysqlPool.end();
        }
    }
}

if (require.main === module) {
    generateVmiBicromatReport()
        .then((res) => {
            console.log('🎉 Relatório gerado com sucesso com a estrutura completa e todos os saldos!');
            console.log(`📦 Total de KG: ${res.totalKg.toFixed(2)} KG | Peças: ${res.totalPecas} | Pedidos: ${res.totalPedidos} | Recursos: ${res.totalRecursos}`);
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Erro na geração:', err);
            process.exit(1);
        });
}

module.exports = { generateVmiBicromatReport };
