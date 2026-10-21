import ExcelJS from 'exceljs';
import { downloadBlob } from '../utils/downloadHelper';
import { getCompanyLegalName, getCompanyShortName, getCompanyCnpjCityLine } from './companyBranding';

/**
 * Converte número de coluna (1-indexed) em letra (ex: 1 -> A, 11 -> K)
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
 * Exporta o Relatório de Saldo de Materiais no Padrão Oficial Multi-Tenant (ExcelJS).
 * Inclui identidade visual corporativa, cabeçalho institucional dinâmico,
 * auto-filtro, zebrado suave, formatação numérica precisa, linha de totais calculada
 * e segunda aba de "Resumo por Almoxarifado").
 */
export const generateSaldoMateriaisExcel = async (items = [], filters = {}, user = null) => {
    if (!items || items.length === 0) {
        throw new Error('Nenhum dado disponível para exportar.');
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = `${getCompanyLegalName()} - SINCO Suite`;
    wb.created = new Date();

    const dateStr = new Date().toLocaleString('pt-BR');
    const nowStamp = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fileTimestamp = `${nowStamp.getFullYear()}${pad(nowStamp.getMonth() + 1)}${pad(nowStamp.getDate())}_${pad(nowStamp.getHours())}${pad(nowStamp.getMinutes())}`;

    // ── Paleta Oficial Lynx EMS ──
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

    // Label descritivo dos filtros
    const filterParts = [];
    if (filters.empresa) filterParts.push(`Empresa: ${filters.empresa}`);
    if (filters.filial) filterParts.push(`Filial: ${filters.filial}`);
    if (filters.almoxarifado) filterParts.push(`Almoxarifado: ${filters.almoxarifado}`);
    if (filters.codigo) filterParts.push(`Código: "${filters.codigo}"`);
    if (filters.descricao) filterParts.push(`Descrição: "${filters.descricao}"`);
    if (filters.grupo) filterParts.push(`Grupo: "${filters.grupo}"`);
    if (filters.tipo) filterParts.push(`Tipo: "${filters.tipo}"`);
    const filterDesc = filterParts.length > 0 ? filterParts.join(' | ') : 'Todos os materiais sem restrição de filtro';

    // =========================================================================
    // ABA 1: SALDO DE MATERIAIS (DETALHADO)
    // =========================================================================
    const wsDetalhado = wb.addWorksheet('Saldo de Materiais', {
        views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
    });

    const columnsDetalhado = [
        { header: 'Empresa', key: 'empresa', width: 12, align: 'center' },
        { header: 'Filial', key: 'filial', width: 10, align: 'center' },
        { header: 'Almox.', key: 'almoxarifado', width: 12, align: 'center' },
        { header: 'Código do Produto', key: 'cod_produto', width: 22, align: 'left', fontStyle: 'bold' },
        { header: 'Descrição do Material', key: 'descricao', width: 48, align: 'left' },
        { header: 'UM', key: 'unidade', width: 8, align: 'center' },
        { header: 'Tipo', key: 'tipo', width: 10, align: 'center' },
        { header: 'Grupo', key: 'grupo', width: 12, align: 'center' },
        { header: 'Saldo Atual', key: 'saldo_atual', width: 18, align: 'right', numFmt: '#,##0.00', isSum: true },
        { header: 'Empenho', key: 'empenho', width: 18, align: 'right', numFmt: '#,##0.00', isSum: true },
        { header: 'Disponível', key: 'disponivel', width: 18, align: 'right', numFmt: '#,##0.00', isSum: true }
    ];

    const lastColLetterDetalhado = getColLetter(columnsDetalhado.length);

    // Linha 1: Marca Corporativa
    wsDetalhado.mergeCells(`A1:${lastColLetterDetalhado}1`);
    const r1 = wsDetalhado.getCell('A1');
    r1.value = `${getCompanyLegalName()} — SISTEMA INTEGRADO DE GESTÃO (S&OP)`;
    r1.fill = NAVY_FILL;
    r1.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    r1.alignment = { horizontal: 'center', vertical: 'middle' };
    wsDetalhado.getRow(1).height = 26;

    // Linha 2: Título do Relatório
    wsDetalhado.mergeCells(`A2:${lastColLetterDetalhado}2`);
    const r2 = wsDetalhado.getCell('A2');
    r2.value = 'RELATÓRIO DE SALDO DE MATERIAIS — ESTOQUE & SALDOS PROTHEUS';
    r2.fill = BLUE_FILL;
    r2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    r2.alignment = { horizontal: 'center', vertical: 'middle' };
    wsDetalhado.getRow(2).height = 20;

    // Linha 3: Metadados e Filtros
    wsDetalhado.mergeCells(`A3:${lastColLetterDetalhado}3`);
    const r3 = wsDetalhado.getCell('A3');
    const userLabel = user?.NomeCompleto || user?.nome ? `   |   Usuário: ${user?.NomeCompleto || user?.nome}` : '';
    r3.value = `Emissão: ${dateStr}${userLabel}   |   Filtros: ${filterDesc}   |   Total de Registros: ${items.length}`;
    r3.fill = SLATE_FILL;
    r3.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF334155' } };
    r3.alignment = { horizontal: 'center', vertical: 'middle' };
    wsDetalhado.getRow(3).height = 18;

    // Linha 4: Espaçador
    wsDetalhado.getRow(4).height = 6;

    // Linha 5: Cabeçalhos da Tabela
    const headerRow = wsDetalhado.getRow(5);
    headerRow.height = 24;
    columnsDetalhado.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header.toUpperCase();
        cell.fill = HEADER_FILL;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: col.align, vertical: 'middle', wrapText: true };
        cell.border = THIN_BORDER;
    });

    // Auto-filtro
    wsDetalhado.autoFilter = { from: 'A5', to: `${lastColLetterDetalhado}5` };

    // Linhas de Dados
    let currentRowIndex = 6;
    items.forEach((row, rowIdx) => {
        const dataRow = wsDetalhado.getRow(currentRowIndex);
        dataRow.height = 20;
        const isZebra = rowIdx % 2 === 1;
        const rowFill = isZebra ? ZEBRA_FILL : WHITE_FILL;

        const saldoAtual = parseFloat(row.saldo_atual) || 0;
        const empenho = parseFloat(row.empenho) || 0;
        const disponivel = saldoAtual - empenho;

        const rowValues = [
            row.empresa || '-',
            row.filial || '-',
            row.almoxarifado || '-',
            row.cod_produto || row.cod_producto || '-',
            row.descricao || '-',
            row.unidade || 'UN',
            row.tipo || '-',
            row.grupo || '-',
            saldoAtual,
            empenho,
            disponivel
        ];

        rowValues.forEach((val, colIdx) => {
            const cell = dataRow.getCell(colIdx + 1);
            const colConfig = columnsDetalhado[colIdx];

            cell.value = val;
            cell.fill = rowFill;
            cell.border = THIN_BORDER;
            cell.alignment = { horizontal: colConfig.align, vertical: 'middle' };

            // Formatação de fonte e cores
            if (colConfig.fontStyle === 'bold') {
                cell.font = { name: 'Calibri', size: 9, bold: true };
            } else {
                cell.font = { name: 'Calibri', size: 9 };
            }

            // Destaque numérico
            if (colConfig.numFmt) {
                cell.numFmt = colConfig.numFmt;
            }

            if (colConfig.key === 'empenho' && empenho > 0) {
                cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB91C1C' } }; // Vermelho
            }

            if (colConfig.key === 'disponivel') {
                if (disponivel > 0) {
                    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1D4ED8' } }; // Azul
                } else if (disponivel < 0) {
                    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFDC2626' } }; // Vermelho negativo
                }
            }
        });

        currentRowIndex++;
    });

    // Linha de Totais da Aba 1
    const totalRow = wsDetalhado.getRow(currentRowIndex);
    totalRow.height = 24;

    for (let c = 1; c <= columnsDetalhado.length; c++) {
        const cell = totalRow.getCell(c);
        cell.fill = TOTAL_FILL;
        cell.border = TOTAL_BORDER;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: columnsDetalhado[c - 1].align, vertical: 'middle' };

        const colLetter = getColLetter(c);
        if (c === 1) {
            cell.value = `TOTAIS GERAIS (${items.length} MATERIAIS)`;
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
        } else if (columnsDetalhado[c - 1].isSum) {
            cell.value = { formula: `SUM(${colLetter}6:${colLetter}${currentRowIndex - 1})` };
            cell.numFmt = columnsDetalhado[c - 1].numFmt;

            if (columnsDetalhado[c - 1].key === 'empenho') {
                cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
            }
            if (columnsDetalhado[c - 1].key === 'disponivel') {
                cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
            }
        }
    }

    // Largura das colunas Aba 1
    columnsDetalhado.forEach((col, idx) => {
        wsDetalhado.getColumn(idx + 1).width = col.width;
    });

    // =========================================================================
    // ABA 2: RESUMO POR ALMOXARIFADO
    // =========================================================================
    const almoxMap = {};
    items.forEach(row => {
        const loc = String(row.almoxarifado || 'NÃO DEFINIDO').trim();
        if (!almoxMap[loc]) {
            almoxMap[loc] = {
                almoxarifado: loc,
                skus: 0,
                saldo_atual: 0,
                empenho: 0,
                disponivel: 0
            };
        }
        const s = parseFloat(row.saldo_atual) || 0;
        const e = parseFloat(row.empenho) || 0;

        almoxMap[loc].skus += 1;
        almoxMap[loc].saldo_atual += s;
        almoxMap[loc].empenho += e;
        almoxMap[loc].disponivel += (s - e);
    });

    const almoxList = Object.values(almoxMap).sort((a, b) => a.almoxarifado.localeCompare(b.almoxarifado));

    const wsResumo = wb.addWorksheet('Resumo por Almoxarifado', {
        views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
    });

    const columnsResumo = [
        { header: 'Almoxarifado', key: 'almoxarifado', width: 22, align: 'center' },
        { header: 'Qtd. Itens / SKUs', key: 'skus', width: 20, align: 'right', numFmt: '#,##0', isSum: true },
        { header: 'Saldo Atual Total', key: 'saldo_atual', width: 22, align: 'right', numFmt: '#,##0.00', isSum: true },
        { header: 'Empenho Total', key: 'empenho', width: 22, align: 'right', numFmt: '#,##0.00', isSum: true },
        { header: 'Saldo Disponível Total', key: 'disponivel', width: 24, align: 'right', numFmt: '#,##0.00', isSum: true }
    ];

    const lastColLetterResumo = getColLetter(columnsResumo.length);

    // Linha 1: Marca Corporativa
    wsResumo.mergeCells(`A1:${lastColLetterResumo}1`);
    const r1Res = wsResumo.getCell('A1');
    r1Res.value = `${getCompanyLegalName()} — SISTEMA INTEGRADO DE GESTÃO (S&OP)`;
    r1Res.fill = NAVY_FILL;
    r1Res.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    r1Res.alignment = { horizontal: 'center', vertical: 'middle' };
    wsResumo.getRow(1).height = 26;

    // Linha 2: Título do Resumo
    wsResumo.mergeCells(`A2:${lastColLetterResumo}2`);
    const r2Res = wsResumo.getCell('A2');
    r2Res.value = 'RESUMO GERENCIAL CONSOLIDADO POR ALMOXARIFADO';
    r2Res.fill = BLUE_FILL;
    r2Res.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    r2Res.alignment = { horizontal: 'center', vertical: 'middle' };
    wsResumo.getRow(2).height = 20;

    // Linha 3: Metadados
    wsResumo.mergeCells(`A3:${lastColLetterResumo}3`);
    const r3Res = wsResumo.getCell('A3');
    r3Res.value = `Emissão: ${dateStr}   |   Total de Almoxarifados: ${almoxList.length}`;
    r3Res.fill = SLATE_FILL;
    r3Res.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF334155' } };
    r3Res.alignment = { horizontal: 'center', vertical: 'middle' };
    wsResumo.getRow(3).height = 18;

    // Linha 4: Espaçador
    wsResumo.getRow(4).height = 6;

    // Linha 5: Cabeçalhos do Resumo
    const headerRowRes = wsResumo.getRow(5);
    headerRowRes.height = 24;
    columnsResumo.forEach((col, idx) => {
        const cell = headerRowRes.getCell(idx + 1);
        cell.value = col.header.toUpperCase();
        cell.fill = HEADER_FILL;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: col.align, vertical: 'middle', wrapText: true };
        cell.border = THIN_BORDER;
    });

    wsResumo.autoFilter = { from: 'A5', to: `${lastColLetterResumo}5` };

    let currentResRow = 6;
    almoxList.forEach((row, rowIdx) => {
        const dataRow = wsResumo.getRow(currentResRow);
        dataRow.height = 20;
        const isZebra = rowIdx % 2 === 1;
        const rowFill = isZebra ? ZEBRA_FILL : WHITE_FILL;

        const rowValues = [
            row.almoxarifado,
            row.skus,
            row.saldo_atual,
            row.empenho,
            row.disponivel
        ];

        rowValues.forEach((val, colIdx) => {
            const cell = dataRow.getCell(colIdx + 1);
            const colConfig = columnsResumo[colIdx];

            cell.value = val;
            cell.fill = rowFill;
            cell.border = THIN_BORDER;
            cell.alignment = { horizontal: colConfig.align, vertical: 'middle' };
            cell.font = { name: 'Calibri', size: 9, bold: colIdx === 0 };

            if (colConfig.numFmt) {
                cell.numFmt = colConfig.numFmt;
            }

            if (colConfig.key === 'empenho' && row.empenho > 0) {
                cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
            }
            if (colConfig.key === 'disponivel') {
                cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
            }
        });

        currentResRow++;
    });

    // Linha de Totais da Aba 2
    const totalRowRes = wsResumo.getRow(currentResRow);
    totalRowRes.height = 24;

    for (let c = 1; c <= columnsResumo.length; c++) {
        const cell = totalRowRes.getCell(c);
        cell.fill = TOTAL_FILL;
        cell.border = TOTAL_BORDER;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: columnsResumo[c - 1].align, vertical: 'middle' };

        const colLetter = getColLetter(c);
        if (c === 1) {
            cell.value = 'TOTAL GERAL CONSOLIDADO';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (columnsResumo[c - 1].isSum) {
            cell.value = { formula: `SUM(${colLetter}6:${colLetter}${currentResRow - 1})` };
            cell.numFmt = columnsResumo[c - 1].numFmt;

            if (columnsResumo[c - 1].key === 'empenho') {
                cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
            }
            if (columnsResumo[c - 1].key === 'disponivel') {
                cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
            }
        }
    }

    columnsResumo.forEach((col, idx) => {
        wsResumo.getColumn(idx + 1).width = col.width;
    });

    // =========================================================================
    // FINALIZAÇÃO E DOWNLOAD DO ARQUIVO
    // =========================================================================
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `MetalFisa_Saldo_Materiais_${fileTimestamp}.xlsx`;

    downloadBlob(blob, fileName);
    return fileName;
};

export default generateSaldoMateriaisExcel;
