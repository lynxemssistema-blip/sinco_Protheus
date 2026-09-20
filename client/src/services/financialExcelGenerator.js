import ExcelJS from 'exceljs';
import { downloadBlob } from '../utils/downloadHelper';

/**
 * Formata datas de múltiplos formatos do Protheus / PostgreSQL para DD/MM/AAAA
 */
const formatProtheusDate = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '-';
    if (raw.includes('T')) {
        const datePart = raw.split('T')[0];
        const d = datePart.split('-');
        if (d.length === 3) return `${d[2]}/${d[1]}/${d[0]}`;
    }
    if (/^\d{8}$/.test(raw)) return raw.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1');
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.substring(0, 10).replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
    if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw.replace(/-/g, '/');
    return raw;
};

/**
 * Converte número de coluna (1-indexed) em letra (ex: 1 -> A, 15 -> O, 27 -> AA)
 */
const getColLetter = (colIdx) => {
    let temp = colIdx;
    let letter = '';
    while (temp > 0) {
        let remainder = (temp - 1) % 26;
        letter = String.fromCharCode(65 + remainder) + letter;
        temp = Math.floor((temp - 1) / 26);
    }
    return letter;
};

/**
 * Gera e dispara o download da Planilha Financeira no Padrão Corporativo Oficial MetalFisa.
 * Inclui processamento assíncrono em lotes (chunking) com feedback de progresso em tempo real.
 *
 * @param {Array} rows - Linhas filtradas da tabela financeira
 * @param {Object} filters - Filtros ativos no momento da exportação
 * @param {string} grouping - Tipo de agrupamento ativo ('prev_fat', 'cliente', 'pedido', etc)
 * @param {Function} onProgress - Callback ({ percent, current, total, stepMessage })
 */
export const exportFinancialExcel = async (rows, filters = {}, grouping = 'prev_fat', onProgress = null) => {
    if (!rows || rows.length === 0) {
        throw new Error('Nenhum dado disponível para exportação.');
    }

    const totalRows = rows.length;

    // Etapa 1: Início
    if (onProgress) {
        onProgress({ percent: 5, current: 0, total: totalRows, stepMessage: 'Iniciando preparação dos dados...' });
    }
    await new Promise(r => setTimeout(r, 20));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MetalFisa ERP / S&OP';
    wb.created = new Date();

    const dateStr = new Date().toLocaleString('pt-BR');
    const nowStamp = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fileTimestamp = `${nowStamp.getFullYear()}${pad(nowStamp.getMonth() + 1)}${pad(nowStamp.getDate())}_${pad(nowStamp.getHours())}${pad(nowStamp.getMinutes())}`;

    // Paleta Oficial MetalFisa
    const NAVY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const BLUE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    const SLATE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    const ZEBRA_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    const WHITE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    const THIN_BORDER = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    const TOTAL_BORDER = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF1E3A5F' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
    };

    // Label descritivo dos filtros aplicados
    const filterParts = [];
    if (filters.cliente) filterParts.push(`Cliente: "${filters.cliente}"`);
    if (filters.pedido) filterParts.push(`Pedido: "${filters.pedido}"`);
    if (filters.produto) filterParts.push(`Produto: "${filters.produto}"`);
    if (filters.dataInicial || filters.dataFinal) {
        const campoData = filters.dateType === 'data_pcp' ? 'Data PCP' : 'Prev. Faturamento';
        filterParts.push(`${campoData}: ${filters.dataInicial || 'Início'} até ${filters.dataFinal || 'Fim'}`);
    }
    if (filters.showMode === 'pending') filterParts.push('Apenas Pendentes');
    if (filters.showMode === 'billed') filterParts.push('Apenas Faturados');
    const filterDesc = filterParts.length > 0 ? filterParts.join(' | ') : 'Todos os itens da carteira';

    // Label do agrupamento
    const groupingLabels = {
        'prev_fat': 'Previsão de Faturamento',
        'data_pcp': 'Data Reprogramada PCP',
        'cliente': 'Cliente',
        'pedido': 'Pedido de Venda',
        'produto': 'Código do Produto',
        'sem_agrupamento': 'Sem Agrupamento (Corrido)'
    };
    const groupingLabel = groupingLabels[grouping] || 'Previsão de Faturamento';

    // =========================================================================
    // ABA 1: VISÃO ANALÍTICA COMPLETA (EXPANDIDA)
    // =========================================================================
    const wsAnalitica = wb.addWorksheet('Visão Analítica', {
        views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
    });

    const columnsAnalitica = [
        { header: 'Pedido', key: 'pedido', width: 14, align: 'center' },
        { header: 'Item', key: 'item', width: 8, align: 'center' },
        { header: 'Cód. Produto', key: 'codigo', width: 18, align: 'left' },
        { header: 'Descrição do Produto', key: 'descricao', width: 38, align: 'left' },
        { header: 'Cliente / Razão Social', key: 'nome_cliente', width: 32, align: 'left' },
        { header: 'Qtd. Solicitada', key: 'quantidade', width: 16, align: 'right', numFmt: '#,##0' },
        { header: 'Qtd. Entregue', key: 'qtd_entreg', width: 16, align: 'right', numFmt: '#,##0' },
        { header: 'Qtd. A Faturar', key: 'qtd_faturar', width: 16, align: 'right', numFmt: '#,##0' },
        { header: 'Preço Unitário (R$)', key: 'valor_unitario', width: 19, align: 'right', numFmt: '"R$" #,##0.00' },
        { header: 'A Faturar (R$)', key: 'val_pendente', width: 20, align: 'right', numFmt: '"R$" #,##0.00' },
        { header: 'Já Faturado (R$)', key: 'val_faturado', width: 20, align: 'right', numFmt: '"R$" #,##0.00' },
        { header: 'Total Geral (R$)', key: 'val_total', width: 20, align: 'right', numFmt: '"R$" #,##0.00' },
        { header: 'Data PCP', key: 'data_entrega_pcp', width: 15, align: 'center' },
        { header: 'Prev. Faturamento', key: 'data_prevista_faturamento', width: 18, align: 'center' },
        { header: 'Status Faturamento', key: 'status_faturamento', width: 20, align: 'center' }
    ];

    const lastColLetterAnalitica = getColLetter(columnsAnalitica.length);

    // Linha 1: Marca Corporativa
    wsAnalitica.mergeCells(`A1:${lastColLetterAnalitica}1`);
    const r1A = wsAnalitica.getCell('A1');
    r1A.value = 'METALFISA METALÚRGICA LTDA — SISTEMA INTEGRADO DE GESTÃO (S&OP)';
    r1A.fill = NAVY_FILL;
    r1A.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    r1A.alignment = { horizontal: 'center', vertical: 'middle' };
    wsAnalitica.getRow(1).height = 26;

    // Linha 2: Título do Relatório
    wsAnalitica.mergeCells(`A2:${lastColLetterAnalitica}2`);
    const r2A = wsAnalitica.getCell('A2');
    r2A.value = 'RELATÓRIO DE CARTEIRA FINANCEIRA — VISÃO ANALÍTICA EXPANDIDA';
    r2A.fill = BLUE_FILL;
    r2A.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    r2A.alignment = { horizontal: 'center', vertical: 'middle' };
    wsAnalitica.getRow(2).height = 20;

    // Linha 3: Metadados e Filtros
    wsAnalitica.mergeCells(`A3:${lastColLetterAnalitica}3`);
    const r3A = wsAnalitica.getCell('A3');
    r3A.value = `Emissão: ${dateStr}   |   Agrupamento de Tela: ${groupingLabel}   |   Filtros: ${filterDesc}   |   Total de Itens: ${totalRows}`;
    r3A.fill = SLATE_FILL;
    r3A.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF334155' } };
    r3A.alignment = { horizontal: 'center', vertical: 'middle' };
    wsAnalitica.getRow(3).height = 18;

    // Linha 4: Espaçador
    wsAnalitica.getRow(4).height = 6;

    // Linha 5: Cabeçalhos
    const headerRowA = wsAnalitica.getRow(5);
    headerRowA.height = 24;
    columnsAnalitica.forEach((col, idx) => {
        const cell = headerRowA.getCell(idx + 1);
        cell.value = col.header.toUpperCase();
        cell.fill = HEADER_FILL;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: col.align, vertical: 'middle', wrapText: true };
        cell.border = THIN_BORDER;
    });

    // Auto-filtro
    wsAnalitica.autoFilter = { from: 'A5', to: `${lastColLetterAnalitica}5` };

    // Processamento em lotes da Aba Analítica
    const CHUNK_SIZE = 120;
    let currentRowIndex = 6;

    // Estrutura para acumular o resumo consolidado
    const summaryMap = {};

    for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);

        for (const row of chunk) {
            const qtyTotal = parseFloat(row.quantidade || 0);
            const precoCadastro = parseFloat(row.preco_cadastro || 0);
            let effectiveValUnit = qtyTotal > 0 ? (parseFloat(row.valor_total || 0) / qtyTotal) : parseFloat(row.valor_unitario || 0);

            if (effectiveValUnit <= 0.01 && precoCadastro > 0) {
                effectiveValUnit = precoCadastro;
            }

            const qtyFaturar = parseFloat(row.qtd_faturar || 0);
            const qtyEntreg = parseFloat(row.qtd_entreg || 0);
            const valPendente = qtyFaturar * effectiveValUnit;
            const valFaturado = qtyEntreg * effectiveValUnit;
            const valTotalItem = effectiveValUnit * qtyTotal;

            let statusFaturamento = 'A Faturar';
            if (qtyFaturar <= 0) {
                statusFaturamento = 'Faturado 100%';
            } else if (qtyEntreg > 0) {
                statusFaturamento = 'Faturamento Parcial';
            }

            const rowData = wsAnalitica.getRow(currentRowIndex);
            rowData.height = 18;
            const isZebra = (currentRowIndex % 2 === 0);
            const currentFill = isZebra ? ZEBRA_FILL : WHITE_FILL;

            const values = [
                row.pedido || '-',
                row.item || '-',
                row.codigo || '-',
                row.descricao || '-',
                row.nome_cliente || '-',
                qtyTotal,
                qtyEntreg,
                qtyFaturar,
                effectiveValUnit,
                valPendente,
                valFaturado,
                valTotalItem,
                formatProtheusDate(row.data_entrega_pcp),
                formatProtheusDate(row.data_prevista_faturamento),
                statusFaturamento
            ];

            values.forEach((val, cIdx) => {
                const cell = rowData.getCell(cIdx + 1);
                cell.value = val;
                cell.fill = currentFill;
                cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF1E293B' } };
                cell.alignment = { horizontal: columnsAnalitica[cIdx].align, vertical: 'middle' };
                cell.border = THIN_BORDER;

                if (columnsAnalitica[cIdx].numFmt && typeof val === 'number') {
                    cell.numFmt = columnsAnalitica[cIdx].numFmt;
                }
            });

            // Agregação para a Aba de Resumo Consolidado
            let groupKey = 'Geral';
            if (grouping === 'prev_fat') {
                groupKey = formatProtheusDate(row.data_prevista_faturamento);
            } else if (grouping === 'data_pcp') {
                groupKey = formatProtheusDate(row.data_entrega_pcp);
            } else if (grouping === 'cliente') {
                groupKey = row.nome_cliente || 'Sem Cliente';
            } else if (grouping === 'pedido') {
                groupKey = row.pedido || 'Sem Pedido';
            } else if (grouping === 'produto') {
                groupKey = row.codigo || 'Sem Produto';
            }

            if (!summaryMap[groupKey]) {
                summaryMap[groupKey] = {
                    key: groupKey,
                    count: 0,
                    qtySolicitada: 0,
                    qtyFaturar: 0,
                    qtyEntregue: 0,
                    valPendente: 0,
                    valFaturado: 0,
                    valTotal: 0
                };
            }
            summaryMap[groupKey].count += 1;
            summaryMap[groupKey].qtySolicitada += qtyTotal;
            summaryMap[groupKey].qtyFaturar += qtyFaturar;
            summaryMap[groupKey].qtyEntregue += qtyEntreg;
            summaryMap[groupKey].valPendente += valPendente;
            summaryMap[groupKey].valFaturado += valFaturado;
            summaryMap[groupKey].valTotal += valTotalItem;

            currentRowIndex++;
        }

        // Atualização suave do progresso em tempo real
        const processedCount = Math.min(i + CHUNK_SIZE, totalRows);
        const percentCalculated = Math.round(10 + (processedCount / totalRows) * 60);
        if (onProgress) {
            onProgress({
                percent: percentCalculated,
                current: processedCount,
                total: totalRows,
                stepMessage: `Calculando e estruturando linhas analíticas (${processedCount} de ${totalRows})...`
            });
        }
        await new Promise(r => setTimeout(r, 0));
    }

    // Linha de Totais da Aba Analítica (Fórmulas Nativas =SUM)
    const totalRowA = wsAnalitica.getRow(currentRowIndex);
    totalRowA.height = 22;

    totalRowA.getCell(1).value = 'TOTAL GERAL';
    totalRowA.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A5F' } };
    totalRowA.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRowA.getCell(1).fill = TOTAL_FILL;
    totalRowA.getCell(1).border = TOTAL_BORDER;

    for (let c = 2; c <= columnsAnalitica.length; c++) {
        const cell = totalRowA.getCell(c);
        cell.fill = TOTAL_FILL;
        cell.border = TOTAL_BORDER;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: columnsAnalitica[c - 1].align, vertical: 'middle' };

        const colLetter = getColLetter(c);
        // Colunas com soma: 6 (Qtd Sol), 7 (Qtd Entreg), 8 (Qtd Fat), 10 (Val Pend), 11 (Val Fat), 12 (Val Tot)
        if ([6, 7, 8, 10, 11, 12].includes(c)) {
            cell.value = { formula: `SUM(${colLetter}6:${colLetter}${currentRowIndex - 1})` };
            if (columnsAnalitica[c - 1].numFmt) {
                cell.numFmt = columnsAnalitica[c - 1].numFmt;
            }
        }
    }

    // Auto-ajuste de largura das colunas
    columnsAnalitica.forEach((col, idx) => {
        wsAnalitica.getColumn(idx + 1).width = col.width;
    });

    // =========================================================================
    // ABA 2: RESUMO CONSOLIDADO POR AGRUPAMENTO
    // =========================================================================
    if (onProgress) {
        onProgress({ percent: 75, current: totalRows, total: totalRows, stepMessage: 'Gerando aba de resumo consolidado...' });
    }
    await new Promise(r => setTimeout(r, 10));

    const wsConsolidado = wb.addWorksheet('Resumo Consolidado', {
        views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
    });

    const columnsConsolidado = [
        { header: `Agrupamento (${groupingLabel})`, width: 32, align: 'left' },
        { header: 'Qtd. Itens', width: 14, align: 'right', numFmt: '#,##0' },
        { header: 'Peças Solicitadas', width: 18, align: 'right', numFmt: '#,##0' },
        { header: 'Peças a Faturar', width: 18, align: 'right', numFmt: '#,##0' },
        { header: 'A Faturar (R$)', width: 22, align: 'right', numFmt: '"R$" #,##0.00' },
        { header: 'Já Faturado (R$)', width: 22, align: 'right', numFmt: '"R$" #,##0.00' },
        { header: 'Total Geral (R$)', width: 22, align: 'right', numFmt: '"R$" #,##0.00' },
        { header: '% Faturado', width: 15, align: 'center', numFmt: '0.0%' }
    ];

    const lastColLetterConsolidado = getColLetter(columnsConsolidado.length);

    wsConsolidado.mergeCells(`A1:${lastColLetterConsolidado}1`);
    const r1C = wsConsolidado.getCell('A1');
    r1C.value = 'METALFISA METALÚRGICA LTDA — SISTEMA INTEGRADO DE GESTÃO (S&OP)';
    r1C.fill = NAVY_FILL;
    r1C.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    r1C.alignment = { horizontal: 'center', vertical: 'middle' };
    wsConsolidado.getRow(1).height = 26;

    wsConsolidado.mergeCells(`A2:${lastColLetterConsolidado}2`);
    const r2C = wsConsolidado.getCell('A2');
    r2C.value = `RESUMO CONSOLIDADO POR ${groupingLabel.toUpperCase()}`;
    r2C.fill = BLUE_FILL;
    r2C.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    r2C.alignment = { horizontal: 'center', vertical: 'middle' };
    wsConsolidado.getRow(2).height = 20;

    wsConsolidado.mergeCells(`A3:${lastColLetterConsolidado}3`);
    const r3C = wsConsolidado.getCell('A3');
    r3C.value = `Emissão: ${dateStr}   |   Filtros Ativos: ${filterDesc}`;
    r3C.fill = SLATE_FILL;
    r3C.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF334155' } };
    r3C.alignment = { horizontal: 'center', vertical: 'middle' };
    wsConsolidado.getRow(3).height = 18;

    wsConsolidado.getRow(4).height = 6;

    const headerRowC = wsConsolidado.getRow(5);
    headerRowC.height = 24;
    columnsConsolidado.forEach((col, idx) => {
        const cell = headerRowC.getCell(idx + 1);
        cell.value = col.header.toUpperCase();
        cell.fill = HEADER_FILL;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: col.align, vertical: 'middle' };
        cell.border = THIN_BORDER;
    });

    wsConsolidado.autoFilter = { from: 'A5', to: `${lastColLetterConsolidado}5` };

    const summaryList = Object.values(summaryMap);
    let currentConsRow = 6;

    summaryList.forEach((item, sIdx) => {
        const rowC = wsConsolidado.getRow(currentConsRow);
        rowC.height = 18;
        const isZebra = (sIdx % 2 === 0);
        const fill = isZebra ? ZEBRA_FILL : WHITE_FILL;

        const pct = item.valTotal > 0 ? (item.valFaturado / item.valTotal) : 0;

        const rowValues = [
            item.key,
            item.count,
            item.qtySolicitada,
            item.qtyFaturar,
            item.valPendente,
            item.valFaturado,
            item.valTotal,
            pct
        ];

        rowValues.forEach((val, cIdx) => {
            const cell = rowC.getCell(cIdx + 1);
            cell.value = val;
            cell.fill = fill;
            cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF1E293B' } };
            cell.alignment = { horizontal: columnsConsolidado[cIdx].align, vertical: 'middle' };
            cell.border = THIN_BORDER;

            if (columnsConsolidado[cIdx].numFmt && typeof val === 'number') {
                cell.numFmt = columnsConsolidado[cIdx].numFmt;
            }
        });

        currentConsRow++;
    });

    // Linha de Totais da Aba Consolidada
    const totalRowC = wsConsolidado.getRow(currentConsRow);
    totalRowC.height = 22;

    totalRowC.getCell(1).value = 'TOTAL GERAL';
    totalRowC.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A5F' } };
    totalRowC.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRowC.getCell(1).fill = TOTAL_FILL;
    totalRowC.getCell(1).border = TOTAL_BORDER;

    for (let c = 2; c <= columnsConsolidado.length; c++) {
        const cell = totalRowC.getCell(c);
        cell.fill = TOTAL_FILL;
        cell.border = TOTAL_BORDER;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: columnsConsolidado[c - 1].align, vertical: 'middle' };

        const colLetter = getColLetter(c);
        if ([2, 3, 4, 5, 6, 7].includes(c)) {
            cell.value = { formula: `SUM(${colLetter}6:${colLetter}${currentConsRow - 1})` };
            if (columnsConsolidado[c - 1].numFmt) {
                cell.numFmt = columnsConsolidado[c - 1].numFmt;
            }
        } else if (c === 8) {
            // Percentual do total: Faturado (coluna 6) / Total (coluna 7)
            cell.value = { formula: `IF(G${currentConsRow}>0, F${currentConsRow}/G${currentConsRow}, 0)` };
            cell.numFmt = '0.0%';
        }
    }

    columnsConsolidado.forEach((col, idx) => {
        wsConsolidado.getColumn(idx + 1).width = col.width;
    });

    // =========================================================================
    // FINALIZAÇÃO E DOWNLOAD DO ARQUIVO
    // =========================================================================
    if (onProgress) {
        onProgress({ percent: 90, current: totalRows, total: totalRows, stepMessage: 'Compactando e gravando arquivo Excel (.xlsx)...' });
    }
    await new Promise(r => setTimeout(r, 15));

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `MetalFisa_Carteira_Financeira_${fileTimestamp}.xlsx`;

    if (onProgress) {
        onProgress({ percent: 100, current: totalRows, total: totalRows, stepMessage: 'Concluído! Baixando arquivo...' });
    }
    await new Promise(r => setTimeout(r, 10));

    downloadBlob(blob, fileName);
    return fileName;
};
