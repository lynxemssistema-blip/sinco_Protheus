const protheusDB = require('../services/protheusDB');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function generateReport() {
    try {
        console.log('🚀 Iniciando extração dos dados no Protheus para KMI, SUPREMA e ALFATEC (Últimos 5 meses: 04/2026 a 08/2026)...');
        
        const fornecedoresFiltro = ['00000233', '00001621', '50544239'];
        const dataCorte = '20260401'; // Últimos 5 meses (Abril a Agosto de 2026)

        // 1. Consulta de todas as notas fiscais de saída dos últimos 5 meses
        const saídasQuery = await protheusDB.query(`
            SELECT 
                f2.f2_doc, f2.f2_serie, f2.f2_emissao, f2.f2_cliente, f2.f2_loja,
                TRIM(a2.a2_nome) as fornecedor_nome,
                TRIM(a2.a2_nreduz) as fornecedor_fantasia,
                TRIM(a2.a2_cgc) as fornecedor_cnpj,
                d2.d2_item, d2.d2_cod, d2.d2_quant, d2.d2_um, d2.d2_prcven, d2.d2_total, d2.d2_tes, d2.d2_cf,
                f2.f2_valbrut, f2.f2_pbruto, f2.f2_pliqui, f2.f2_tipo,
                TRIM(b1.b1_desc) as produto_descricao,
                b1.b1_tipo, b1.b1_peso, b1.b1_pesbru
            FROM sd2010 d2
            INNER JOIN sa2010 a2 ON a2.a2_cod = d2.d2_cliente AND a2.a2_loja = d2.d2_loja AND a2.d_e_l_e_t_ = ' '
            INNER JOIN sf2010 f2 ON f2.f2_doc = d2.d2_doc AND f2.f2_serie = d2.d2_serie AND f2.f2_cliente = d2.d2_cliente AND f2.f2_loja = d2.d2_loja AND f2.d_e_l_e_t_ = ' '
            LEFT JOIN sb1010 b1 ON b1.b1_cod = d2.d2_cod AND b1.d_e_l_e_t_ = ' '
            WHERE d2.d_e_l_e_t_ = ' '
              AND TRIM(d2.d2_cliente) = ANY($1::text[])
              AND f2.f2_emissao >= $2
            ORDER BY d2.d2_emissao, d2.d2_doc, d2.d2_item
        `, [fornecedoresFiltro, dataCorte]);

        console.log(`✅ Total de itens de saída extraídos (últimos 5 meses): ${saídasQuery.rows.length}`);

        // 2. Consulta de notas de entrada dos últimos 5 meses
        const entradasQuery = await protheusDB.query(`
            SELECT 
                d1.d1_doc, d1.d1_serie, d1.d1_emissao, d1.d1_dtdigit, d1.d1_fornece, d1.d1_loja,
                TRIM(a2.a2_nome) as fornecedor_nome,
                TRIM(a2.a2_cgc) as fornecedor_cnpj,
                d1.d1_item, d1.d1_cod, d1.d1_quant, d1.d1_um, d1.d1_vunit, d1.d1_total, d1.d1_tes, d1.d1_cf,
                TRIM(b1.b1_desc) as produto_descricao
            FROM sd1010 d1
            INNER JOIN sa2010 a2 ON a2.a2_cod = d1.d1_fornece AND a2.a2_loja = d1.d1_loja AND a2.d_e_l_e_t_ = ' '
            LEFT JOIN sb1010 b1 ON b1.b1_cod = d1.d1_cod AND b1.d_e_l_e_t_ = ' '
            WHERE d1.d_e_l_e_t_ = ' '
              AND TRIM(d1.d1_fornece) = ANY($1::text[])
              AND d1.d1_emissao >= $2
            ORDER BY d1.d1_emissao, d1.d1_doc, d1.d1_item
        `, [fornecedoresFiltro, dataCorte]);

        console.log(`✅ Total de itens de entrada extraídos: ${entradasQuery.rows.length}`);

        // Preparação do Excel com ExcelJS
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MetalFisa ERP - Inteligência Industrial';
        workbook.created = new Date();

        // ── ESTILOS ──
        const headerFillDark = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' } // Slate 900
        };
        const headerFillBlue = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' } // Blue 900
        };
        const subHeaderFill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF1F5F9' } // Slate 100
        };
        const totalRowFill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2E8F0' } // Slate 200
        };

        const fontHeader = {
            name: 'Calibri',
            size: 11,
            bold: true,
            color: { argb: 'FFFFFFFF' }
        };
        const fontSubHeader = {
            name: 'Calibri',
            size: 10,
            bold: true,
            color: { argb: 'FF1E293B' }
        };
        const fontTotal = {
            name: 'Calibri',
            size: 11,
            bold: true,
            color: { argb: 'FF0F172A' }
        };

        const borderThin = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
        const borderDouble = {
            top: { style: 'thin', color: { argb: 'FF94A3B8' } },
            left: { style: 'thin', color: { argb: 'FF94A3B8' } },
            bottom: { style: 'double', color: { argb: 'FF0F172A' } },
            right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };

        // ══════════════════════════════════════════════════════════════════════════
        // ABA 1: RESUMO MENSAL POR FORNECEDOR (MATRIZ KG)
        // ══════════════════════════════════════════════════════════════════════════
        const ws1 = workbook.addWorksheet('Resumo Mensal (KG)', {
            views: [{ showGridLines: true }]
        });

        ws1.addRow(['METALFISA INDUSTRIAL - RELATÓRIO DE REMESSAS DE MATERIAIS PARA FORNECEDORES DE TRATAMENTO']);
        ws1.mergeCells('A1:F1');
        ws1.getCell('A1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
        ws1.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
        ws1.getRow(1).height = 30;

        ws1.addRow(['Consolidado mensal dos Últimos 5 Meses (04/2026 a 08/2026) — Peso (KG) e Valor Faturado (CFOP 5901)']);
        ws1.mergeCells('A2:F2');
        ws1.getCell('A2').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
        ws1.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
        ws1.getRow(2).height = 20;

        ws1.addRow([]); // Linha em branco

        // Processar agregados por Mês e por Fornecedor
        const monthsSet = new Set();
        const matrixData = {}; // { '2025/06': { 'KMI': { kg, val, nfs }, 'SUPREMA': ..., 'ALFATEC': ... } }
        const fornNames = {
            '00001621': 'KMI GALVANIZACOES LTDA',
            '50544239': 'SUPREMA SERVICOS INDUSTRIA E COMERCIO LTDA',
            '00000233': 'ALFATEC TRATAMENTO DE SUPERFICIE E COMERCIO LTDA'
        };

        saídasQuery.rows.forEach(r => {
            const rawAnoMes = r.f2_emissao.substring(0, 6);
            const anoMes = `${rawAnoMes.substring(0, 4)}/${rawAnoMes.substring(4, 6)}`;
            monthsSet.add(anoMes);

            const codForn = r.f2_cliente.trim();
            const fornKey = fornNames[codForn] || r.fornecedor_nome;

            if (!matrixData[anoMes]) matrixData[anoMes] = {};
            if (!matrixData[anoMes][fornKey]) {
                matrixData[anoMes][fornKey] = { kg: 0, val: 0, nfs: new Set(), itensCount: 0 };
            }

            const quant = parseFloat(r.d2_quant) || 0;
            const val = parseFloat(r.d2_total) || 0;
            const um = (r.d2_um || '').trim().toUpperCase();

            // Se UM for KG, soma direto. Se for PC/Lote com preço por kg implícito ou peso em cadastro
            let kgReal = 0;
            if (um === 'KG') {
                kgReal = quant;
            } else if (parseFloat(r.b1_peso) > 0) {
                kgReal = quant * parseFloat(r.b1_peso);
            } else {
                // Nas NFs de 2025/início de 2026 lançadas como 1 PC com o valor total do lote
                kgReal = 0; // Indicaremos a observação de lote
            }

            matrixData[anoMes][fornKey].kg += kgReal;
            matrixData[anoMes][fornKey].val += val;
            matrixData[anoMes][fornKey].nfs.add(r.f2_doc.trim());
            matrixData[anoMes][fornKey].itensCount++;
        });

        const sortedMonths = Array.from(monthsSet).sort();

        // Cabeçalho da Tabela Matriz
        const headerRow1 = ws1.addRow([
            'MÊS / ANO',
            'KMI GALVANIZAÇÕES (KG)',
            'SUPREMA SERVIÇOS (KG)',
            'ALFATEC TRATAMENTO (KG)',
            'TOTAL GERAL (KG)',
            'VALOR TOTAL NOTAS (R$)'
        ]);
        headerRow1.height = 25;
        headerRow1.eachCell((cell) => {
            cell.fill = headerFillBlue;
            cell.font = fontHeader;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderThin;
        });

        let totKmi = 0, totSup = 0, totAlfa = 0, totGeralKg = 0, totGeralVal = 0;

        sortedMonths.forEach(m => {
            const kmiKg = matrixData[m]['KMI GALVANIZACOES LTDA']?.kg || 0;
            const supKg = matrixData[m]['SUPREMA SERVICOS INDUSTRIA E COMERCIO LTDA']?.kg || 0;
            const alfaKg = matrixData[m]['ALFATEC TRATAMENTO DE SUPERFICIE E COMERCIO LTDA']?.kg || 0;
            
            const kmiVal = matrixData[m]['KMI GALVANIZACOES LTDA']?.val || 0;
            const supVal = matrixData[m]['SUPREMA SERVICOS INDUSTRIA E COMERCIO LTDA']?.val || 0;
            const alfaVal = matrixData[m]['ALFATEC TRATAMENTO DE SUPERFICIE E COMERCIO LTDA']?.val || 0;

            const mesTotalKg = kmiKg + supKg + alfaKg;
            const mesTotalVal = kmiVal + supVal + alfaVal;

            totKmi += kmiKg;
            totSup += supKg;
            totAlfa += alfaKg;
            totGeralKg += mesTotalKg;
            totGeralVal += mesTotalVal;

            const row = ws1.addRow([
                m,
                kmiKg > 0 ? kmiKg : (kmiVal > 0 ? '(Lote)' : 0),
                supKg > 0 ? supKg : (supVal > 0 ? '(Lote)' : 0),
                alfaKg > 0 ? alfaKg : (alfaVal > 0 ? '(Lote)' : 0),
                mesTotalKg,
                mesTotalVal
            ]);
            row.height = 20;

            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(2).numFmt = typeof row.getCell(2).value === 'number' ? '#,##0.00' : '@';
            row.getCell(3).numFmt = typeof row.getCell(3).value === 'number' ? '#,##0.00' : '@';
            row.getCell(4).numFmt = typeof row.getCell(4).value === 'number' ? '#,##0.00' : '@';
            row.getCell(5).numFmt = '#,##0.00';
            row.getCell(6).numFmt = 'R$ #,##0.00';

            row.eachCell((cell) => { cell.border = borderThin; cell.font = { name: 'Calibri', size: 10 }; });
        });

        // Linha de Total Geral
        const totRow = ws1.addRow([
            'TOTAL GERAL',
            totKmi,
            totSup,
            totAlfa,
            totGeralKg,
            totGeralVal
        ]);
        totRow.height = 24;
        totRow.eachCell((cell, colNumber) => {
            cell.fill = totalRowFill;
            cell.font = fontTotal;
            cell.border = borderDouble;
            if (colNumber === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
            else if (colNumber <= 5) cell.numFmt = '#,##0.00';
            else cell.numFmt = 'R$ #,##0.00';
        });

        // Observação no rodapé da aba 1
        ws1.addRow([]);
        const obsRow = ws1.addRow(['* Nota: As notas com indicação "(Lote)" referem-se a emissões de 2025/início de 2026 emitidas no Protheus com unidade PC (lote de serviço). A partir de Março/Abril de 2026, todas as remessas passaram a ser faturadas diretamente na unidade KG com o peso exato de balança.']);
        ws1.mergeCells(`A${obsRow.number}:F${obsRow.number}`);
        obsRow.getCell(1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF475569' } };

        ws1.columns = [
            { width: 16 },
            { width: 28 },
            { width: 28 },
            { width: 28 },
            { width: 22 },
            { width: 26 }
        ];

        // ══════════════════════════════════════════════════════════════════════════
        // ABA 2: RESUMO POR FORNECEDOR E MÊS (DETALHADO)
        // ══════════════════════════════════════════════════════════════════════════
        const ws2 = workbook.addWorksheet('Consolidado por Fornecedor', {
            views: [{ showGridLines: true }]
        });

        const headerRow2 = ws2.addRow([
            'FORNECEDOR',
            'CNPJ',
            'MÊS / ANO',
            'QTD NOTAS FISCAIS',
            'QTD ITENS',
            'PESO TOTAL FATURADO (KG)',
            'VALOR TOTAL NOTAS (R$)',
            'PREÇO MÉDIO (R$/KG)'
        ]);
        headerRow2.height = 25;
        headerRow2.eachCell((cell) => {
            cell.fill = headerFillDark;
            cell.font = fontHeader;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderThin;
        });

        // Consulta agregada por Fornecedor e Mês
        const mensalQuery = await protheusDB.query(`
            SELECT 
                TRIM(a2.a2_nome) as fornecedor_nome,
                TRIM(a2.a2_cgc) as fornecedor_cnpj,
                TRIM(d2.d2_cliente) as fornecedor_cod,
                SUBSTRING(d2.d2_emissao, 1, 4) || '/' || SUBSTRING(d2.d2_emissao, 5, 2) as ano_mes,
                COUNT(DISTINCT d2.d2_doc) as qtd_nfs,
                COUNT(*) as qtd_itens,
                SUM(CASE WHEN TRIM(d2.d2_um) = 'KG' THEN d2.d2_quant ELSE 0 END) as peso_kg,
                SUM(CASE WHEN TRIM(d2.d2_um) != 'KG' THEN d2.d2_quant ELSE 0 END) as qtd_outros,
                SUM(d2.d2_total) as valor_total
            FROM sd2010 d2
            INNER JOIN sa2010 a2 ON a2.a2_cod = d2.d2_cliente AND a2.a2_loja = d2.d2_loja AND a2.d_e_l_e_t_ = ' '
            WHERE d2.d_e_l_e_t_ = ' '
              AND TRIM(d2.d2_cliente) = ANY($1::text[])
              AND d2.d2_emissao >= $2
            GROUP BY TRIM(a2.a2_nome), TRIM(a2.a2_cgc), TRIM(d2.d2_cliente), SUBSTRING(d2.d2_emissao, 1, 4) || '/' || SUBSTRING(d2.d2_emissao, 5, 2)
            ORDER BY fornecedor_nome, ano_mes
        `, [fornecedoresFiltro, dataCorte]);

        mensalQuery.rows.forEach(r => {
            const peso = parseFloat(r.peso_kg) || 0;
            const valor = parseFloat(r.valor_total) || 0;
            const precoMedio = peso > 0 ? (valor / peso) : 0;

            const row = ws2.addRow([
                r.fornecedor_nome,
                r.fornecedor_cnpj,
                r.ano_mes,
                parseInt(r.qtd_nfs, 10),
                parseInt(r.qtd_itens, 10),
                peso > 0 ? peso : (valor > 0 ? '(Lote Serviço)' : 0),
                valor,
                precoMedio > 0 ? precoMedio : '-'
            ]);
            row.height = 19;
            row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
            row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
            row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
            row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

            row.getCell(6).numFmt = typeof row.getCell(6).value === 'number' ? '#,##0.00' : '@';
            row.getCell(7).numFmt = 'R$ #,##0.00';
            row.getCell(8).numFmt = typeof row.getCell(8).value === 'number' ? 'R$ #,##0.00' : '@';

            row.eachCell(cell => { cell.border = borderThin; cell.font = { name: 'Calibri', size: 10 }; });
        });

        ws2.columns = [
            { width: 50 },
            { width: 20 },
            { width: 14 },
            { width: 20 },
            { width: 14 },
            { width: 26 },
            { width: 24 },
            { width: 22 }
        ];

        // ══════════════════════════════════════════════════════════════════════════
        // ABA 3: RELAÇÃO COMPLETA DAS NOTAS FISCAIS DE REMESSA (SAÍDAS)
        // ══════════════════════════════════════════════════════════════════════════
        const ws3 = workbook.addWorksheet('NFs de Remessa (Saída)', {
            views: [{ showGridLines: true }]
        });

        const headerRow3 = ws3.addRow([
            'NF DOC',
            'SÉRIE',
            'EMISSÃO',
            'COMPETÊNCIA',
            'CÓD. FORNECEDOR',
            'RAZÃO SOCIAL FORNECEDOR',
            'CNPJ',
            'ITEM',
            'CÓDIGO PRODUTO',
            'DESCRIÇÃO DO PRODUTO / SERVIÇO',
            'CFOP',
            'TES',
            'UM',
            'QUANTIDADE FATURADA',
            'PESO REAL (KG)',
            'VALOR UNITÁRIO (R$)',
            'VALOR TOTAL ITEM (R$)',
            'TIPO NF'
        ]);
        headerRow3.height = 25;
        headerRow3.eachCell((cell) => {
            cell.fill = headerFillBlue;
            cell.font = fontHeader;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderThin;
        });

        saídasQuery.rows.forEach(r => {
            const rawEmissao = r.f2_emissao || '';
            const dtEmissao = rawEmissao.length === 8 ? `${rawEmissao.substring(6, 8)}/${rawEmissao.substring(4, 6)}/${rawEmissao.substring(0, 4)}` : rawEmissao;
            const comp = rawEmissao.length >= 6 ? `${rawEmissao.substring(0, 4)}/${rawEmissao.substring(4, 6)}` : '';
            
            const quant = parseFloat(r.d2_quant) || 0;
            const um = (r.d2_um || '').trim().toUpperCase();
            const valUnit = parseFloat(r.d2_prcven) || 0;
            const valTotal = parseFloat(r.d2_total) || 0;
            
            let pesoKg = 0;
            if (um === 'KG') {
                pesoKg = quant;
            } else if (parseFloat(r.b1_peso) > 0) {
                pesoKg = quant * parseFloat(r.b1_peso);
            }

            const row = ws3.addRow([
                r.f2_doc.trim(),
                r.f2_serie.trim(),
                dtEmissao,
                comp,
                r.f2_cliente.trim(),
                r.fornecedor_nome,
                r.fornecedor_cnpj,
                r.d2_item.trim(),
                r.d2_cod.trim(),
                r.produto_descricao || 'TERCEIRIZACAO DE TRATAMENTO EM PECAS METALICAS',
                r.d2_cf.trim(),
                r.d2_tes.trim(),
                um,
                quant,
                pesoKg > 0 ? pesoKg : (quant > 0 && um === 'KG' ? quant : 0),
                valUnit,
                valTotal,
                r.f2_tipo.trim() === 'B' ? 'Beneficiamento' : r.f2_tipo.trim()
            ]);
            row.height = 18;

            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(12).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(18).alignment = { horizontal: 'center', vertical: 'middle' };

            row.getCell(14).numFmt = '#,##0.00';
            row.getCell(15).numFmt = '#,##0.00';
            row.getCell(16).numFmt = 'R$ #,##0.00';
            row.getCell(17).numFmt = 'R$ #,##0.00';

            row.eachCell(cell => { cell.border = borderThin; cell.font = { name: 'Calibri', size: 9 }; });
        });

        ws3.columns = [
            { width: 13 },
            { width: 8 },
            { width: 14 },
            { width: 14 },
            { width: 18 },
            { width: 45 },
            { width: 20 },
            { width: 8 },
            { width: 16 },
            { width: 45 },
            { width: 10 },
            { width: 8 },
            { width: 8 },
            { width: 20 },
            { width: 18 },
            { width: 18 },
            { width: 20 },
            { width: 16 }
        ];

        // ══════════════════════════════════════════════════════════════════════════
        // ABA 4: RETORNOS DE INDUSTRIALIZAÇÃO (ENTRADAS SF1/SD1)
        // ══════════════════════════════════════════════════════════════════════════
        const ws4 = workbook.addWorksheet('Retornos e Serviços (Entradas)', {
            views: [{ showGridLines: true }]
        });

        const headerRow4 = ws4.addRow([
            'NF ENTRADA',
            'SÉRIE',
            'EMISSÃO',
            'DIGITAÇÃO',
            'CÓD. FORNECEDOR',
            'FORNECEDOR',
            'CNPJ',
            'ITEM',
            'CÓDIGO PRODUTO',
            'DESCRIÇÃO',
            'CFOP',
            'TES',
            'UM',
            'QUANTIDADE RECEBIDA',
            'VALOR TOTAL (R$)'
        ]);
        headerRow4.height = 25;
        headerRow4.eachCell((cell) => {
            cell.fill = headerFillDark;
            cell.font = fontHeader;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderThin;
        });

        entradasQuery.rows.forEach(r => {
            const rawEmissao = r.d1_emissao || '';
            const dtEmissao = rawEmissao.length === 8 ? `${rawEmissao.substring(6, 8)}/${rawEmissao.substring(4, 6)}/${rawEmissao.substring(0, 4)}` : rawEmissao;
            const rawDigit = r.d1_dtdigit || '';
            const dtDigit = rawDigit.length === 8 ? `${rawDigit.substring(6, 8)}/${rawDigit.substring(4, 6)}/${rawDigit.substring(0, 4)}` : rawDigit;
            
            const quant = parseFloat(r.d1_quant) || 0;
            const valTotal = parseFloat(r.d1_total) || 0;

            const row = ws4.addRow([
                r.d1_doc.trim(),
                r.d1_serie.trim(),
                dtEmissao,
                dtDigit,
                r.d1_fornece.trim(),
                r.fornecedor_nome,
                r.fornecedor_cnpj,
                r.d1_item.trim(),
                r.d1_cod.trim(),
                r.produto_descricao || 'TERCEIRIZACAO DE TRATAMENTO EM PECAS METALICAS',
                r.d1_cf.trim(),
                r.d1_tes.trim(),
                (r.d1_um || '').trim().toUpperCase(),
                quant,
                valTotal
            ]);
            row.height = 18;

            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(12).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };

            row.getCell(14).numFmt = '#,##0.00';
            row.getCell(15).numFmt = 'R$ #,##0.00';

            row.eachCell(cell => { cell.border = borderThin; cell.font = { name: 'Calibri', size: 9 }; });
        });

        ws4.columns = [
            { width: 14 },
            { width: 8 },
            { width: 14 },
            { width: 14 },
            { width: 18 },
            { width: 45 },
            { width: 20 },
            { width: 8 },
            { width: 16 },
            { width: 45 },
            { width: 10 },
            { width: 8 },
            { width: 8 },
            { width: 22 },
            { width: 20 }
        ];

        // ── Salvar Arquivos ──
        const outputDir = path.join(__dirname, '..', 'exports');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const fileName = 'Relatorio_NFs_Fornecedores_Tratamento_Ultimos_5_Meses_KG.xlsx';

        const filePath1 = path.join(outputDir, fileName);
        await workbook.xlsx.writeFile(filePath1);
        console.log(`✅ Arquivo salvo em: ${filePath1}`);

        // Salvar também no diretório público do frontend para download direto
        const clientPublicDir = path.join(__dirname, '..', '..', 'client', 'public', 'downloads');
        if (!fs.existsSync(clientPublicDir)) fs.mkdirSync(clientPublicDir, { recursive: true });
        const filePath2 = path.join(clientPublicDir, fileName);
        await workbook.xlsx.writeFile(filePath2);
        console.log(`✅ Arquivo salvo no client public: ${filePath2}`);

        // Salvar na raiz do projeto
        const rootPath = path.join(__dirname, '..', '..', fileName);
        await workbook.xlsx.writeFile(rootPath);
        console.log(`✅ Arquivo salvo na raiz: ${rootPath}`);

        // Tentar salvar também no nome padrão caso não esteja travado
        try {
            const rootPathDefault = path.join(__dirname, '..', '..', 'Relatorio_NFs_Fornecedores_Tratamento_KG.xlsx');
            await workbook.xlsx.writeFile(rootPathDefault);
        } catch (e) {
            console.log('⚠️ Arquivo padrão estava aberto no Excel, salvo com sucesso no nome dos 5 meses.');
        }

        console.log('\n🎉 Relatório dos últimos 5 meses gerado com sucesso!');

    } catch (err) {
        console.error('❌ Erro gerando relatório Excel:', err);
    } finally {
        process.exit();
    }
}

generateReport();
