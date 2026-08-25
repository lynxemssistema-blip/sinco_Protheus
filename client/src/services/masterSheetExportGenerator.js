import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { logoBase64 } from './metalfisaLogoBase64.js';

// Layout Constants
const ML = 8;
const MR = 8;
const HDR_H = 22;
const BRAND_W = 44;
const LOGO_W = 12;
const LOGO_H = 12;

// Draw standard MetalFisa Header for PDF
const drawHeader = (doc, pageWidth, title, subtitle = '') => {
    const y0 = 5;

    // Dark Navy Blue Brand Block ([30, 58, 95] - #1E3A5F)
    doc.setFillColor(30, 58, 95);
    doc.rect(ML, y0, BRAND_W, HDR_H, 'F');
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', ML + 2, y0 + 2, LOGO_W, LOGO_H);
        } catch (e) {}
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('METALFISA', ML + 16, y0 + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Metalúrgica Ltda', ML + 16, y0 + 13.5);

    // Light Gray Title Block (#F5F7FA)
    doc.setFillColor(245, 247, 250);
    doc.rect(ML + BRAND_W, y0, pageWidth - ML - MR - BRAND_W, HDR_H, 'F');

    const blockCenter = ML + BRAND_W + (pageWidth - ML - MR - BRAND_W) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(30, 58, 95);
    doc.text(title, blockCenter, y0 + 8.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(subtitle, blockCenter, y0 + 15.5, { align: 'center' });

    // Date (right corner)
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, pageWidth - MR - 2, y0 + 5.5, { align: 'right' });

    // Border
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.rect(ML, y0, pageWidth - ML - MR, HDR_H);

    return y0 + HDR_H + 4;
};

// Formatter helpers
const formatNum = (val) => {
    if (val == null || val === '' || isNaN(val)) return '-';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const formatDate = (val) => {
    if (!val) return '-';
    const str = String(val).trim();
    if (str.length === 8 && !str.includes('-')) {
        return `${str.substring(6, 8)}/${str.substring(4, 6)}/${str.substring(0, 4)}`;
    }
    if (str.includes('-')) {
        const parts = str.split('T')[0].split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return str;
};

const parseToDate = (val) => {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    const str = String(val).trim();
    if (/^\d{8}$/.test(str)) {
        const y = parseInt(str.substring(0, 4), 10);
        const m = parseInt(str.substring(4, 6), 10) - 1;
        const d = parseInt(str.substring(6, 8), 10);
        return new Date(Date.UTC(y, m, d, 12, 0, 0));
    }
    if (str.includes('T') || str.includes('-')) {
        const parts = str.split('T')[0].split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            return new Date(Date.UTC(y, m, d, 12, 0, 0));
        }
    }
    const dt = new Date(val);
    return isNaN(dt.getTime()) ? null : dt;
};

const normalizeToISO = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr.toISOString().split('T')[0];
    const s = String(dateStr).trim();
    if (/^\d{8}$/.test(s)) return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    if (s.includes('T')) return s.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    return null;
};

const buildFilterLabel = (filterParams = {}) => {
    const parts = [];
    if (filterParams.cliente) parts.push(`Cliente: ${filterParams.cliente}`);
    if (filterParams.pedido) parts.push(`Pedido: ${filterParams.pedido}`);
    if (filterParams.produto) parts.push(`Produto: ${filterParams.produto}`);
    const prio = filterParams.prioridade || filterParams.somente_prioridades;
    if (prio && prio !== 'false') parts.push(`Prioridade: Grupo ${prio}`);
    if (filterParams.only_active === 'true') parts.push(`Apenas Ativos`);
    return parts.length > 0 ? parts.join(' | ') : 'Todos os Registros';
};

const filterInactiveAndInvoiced = (rawData) => {
    if (!rawData) return rawData;
    const data = JSON.parse(JSON.stringify(rawData)); // deep clone
    
    if (data.itens) {
        data.itens = data.itens.filter(i => {
            const isFaturado = Number(i.qtd_faturar || 0) <= 0;
            const isInativo = (i.b1_msblql === '1' || i.b1_msblql === 'S' || i.b1_msblql === 'T' || i.b1_msblql === 'Y' || i.op_status === 'C' || i.status_projeto === 'Inativo');
            return !isFaturado && !isInativo;
        });
    }
    
    const validPedidos = new Set((data.itens || []).map(i => i.pedido));
    const validProds = new Set((data.itens || []).map(i => i.produto));
    
    if (data.pedidos) data.pedidos = data.pedidos.filter(p => validPedidos.has(p.pedido));
    if (data.resumo) data.resumo = data.resumo.filter(r => validProds.has(r.produto));
    if (data.carga) data.carga = data.carga.filter(c => validProds.has(c.produto));
    if (data.execucao_op) data.execucao_op = data.execucao_op.filter(op => validPedidos.has(op.pedido));
    
    return data;
};

const createMetalFisaSheet = (title, headerRow, dataRows, dateStr = new Date().toLocaleString('pt-BR'), filterLabel = '') => {
    const metaHeader = [
        ['METALFISA METALÚRGICA LTDA — SISTEMA INTEGRADO DE GESTÃO (S&OP)'],
        [`RELATÓRIO: ${title.toUpperCase()}`],
        [`Data de Emissão: ${dateStr}${filterLabel ? `  |  Filtros: ${filterLabel}` : ''}`],
        [], // linha em branco
        headerRow,
        ...dataRows
    ];

    const ws = XLSX.utils.aoa_to_sheet(metaHeader, { cellDates: true });

    // Auto-format dates and numbers
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 4; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[cellRef];
            if (cell) {
                if (cell.t === 'd') {
                    cell.z = 'dd/mm/yyyy';
                } else if (cell.t === 'n') {
                    if (Number.isInteger(cell.v)) {
                        cell.z = '#,##0';
                    } else {
                        cell.z = '#,##0.00';
                    }
                }
            }
        }
    }

    // Auto-fit column widths
    const colWidths = headerRow.map((h, colIdx) => {
        let maxLen = String(h).length;
        dataRows.forEach(row => {
            const rawVal = row[colIdx];
            let cellVal = '';
            if (rawVal instanceof Date) {
                cellVal = '00/00/0000';
            } else if (typeof rawVal === 'number') {
                cellVal = rawVal.toLocaleString('pt-BR');
            } else if (rawVal != null) {
                cellVal = String(rawVal);
            }
            if (cellVal.length > maxLen) maxLen = cellVal.length;
        });
        return { wch: Math.min(Math.max(maxLen + 4, 12), 60) };
    });
    ws['!cols'] = colWidths;

    return ws;
};

/**
 * EXPORT TO EXCEL (.XLSX) — ESTILO OFICIAL METALFISA (EXCELJS)
 * Exports multi-sheet Excel file with corporate branding, styled headers, zebra striping, borders and proportional loads
 */
export const exportMasterSheetExcel = async (rawData, filterParams = {}, fractionalItems = null) => {
    if (!rawData) throw new Error('Nenhum dado disponível para exportar.');
    const data = filterInactiveAndInvoiced(rawData);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MetalFisa System';
    wb.created = new Date();

    const filterLabel = buildFilterLabel(filterParams);
    const dateStr = new Date().toLocaleString('pt-BR');

    const NAVY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const BLUE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    const SLATE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const ZEBRA_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    const WHITE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    const AMBER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    const GREEN_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
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

    const addStyledMetalFisaSheet = (sheetName, title, columnsConfig, dataRows, totalConfig = null) => {
        const ws = wb.addWorksheet(sheetName, {
            views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
        });

        const colCount = columnsConfig.length;
        const getColLetter = (n) => {
            let s = '';
            while (n > 0) {
                let m = (n - 1) % 26;
                s = String.fromCharCode(65 + m) + s;
                n = Math.floor((n - m) / 26);
            }
            return s;
        };
        const lastCol = getColLetter(colCount);

        // 1. Linha 1: Marca Corporativa
        ws.mergeCells(`A1:${lastCol}1`);
        const r1 = ws.getCell('A1');
        r1.value = 'METALFISA METALÚRGICA LTDA — SISTEMA INTEGRADO DE GESTÃO (S&OP)';
        r1.fill = NAVY_FILL;
        r1.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        r1.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 26;

        // 2. Linha 2: Título do Relatório
        ws.mergeCells(`A2:${lastCol}2`);
        const r2 = ws.getCell('A2');
        r2.value = `RELATÓRIO: ${title.toUpperCase()}`;
        r2.fill = BLUE_FILL;
        r2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        r2.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(2).height = 20;

        // 3. Linha 3: Metadados
        ws.mergeCells(`A3:${lastCol}3`);
        const r3 = ws.getCell('A3');
        r3.value = `Emissão: ${dateStr}${filterLabel ? `   |   Filtros Aplicados: ${filterLabel}` : ''}`;
        r3.fill = SLATE_FILL;
        r3.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF334155' } };
        r3.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(3).height = 18;

        // 4. Linha 4: Espaçador
        ws.getRow(4).height = 8;

        // 5. Linha 5: Cabeçalhos da Tabela
        const headerRow = ws.getRow(5);
        headerRow.height = 24;
        columnsConfig.forEach((col, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = col.header;
            cell.fill = NAVY_FILL;
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: col.align || 'center', vertical: 'middle', wrapText: true };
            cell.border = THIN_BORDER;
        });

        // 6. Linhas de Dados
        dataRows.forEach((rowObj, rIdx) => {
            const row = ws.getRow(6 + rIdx);
            row.height = 20;
            const isZebra = rIdx % 2 === 1;

            columnsConfig.forEach((col, cIdx) => {
                const cell = row.getCell(cIdx + 1);
                const val = rowObj[col.key];

                cell.value = val !== undefined && val !== null ? val : '-';
                cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF1E293B' } };
                cell.alignment = { horizontal: col.align || 'left', vertical: 'middle' };
                cell.border = THIN_BORDER;
                cell.fill = isZebra ? ZEBRA_FILL : WHITE_FILL;

                // Highlight fracionada
                if (rowObj.is_fraction && (col.key === 'visual_op' || col.key === 'lote_ident' || col.key === 'op')) {
                    cell.fill = AMBER_FILL;
                    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF78350F' } };
                }

                // Formatos
                if (col.type === 'number') {
                    if (typeof val === 'number') {
                        cell.numFmt = Number.isInteger(val) ? '#,##0' : '#,##0.00';
                    }
                } else if (col.type === 'date') {
                    if (val instanceof Date) {
                        cell.numFmt = 'dd/mm/yyyy';
                    }
                }
            });
        });

        // 7. Linha de Totais
        if (totalConfig && dataRows.length > 0) {
            const totRowIdx = 6 + dataRows.length;
            const totRow = ws.getRow(totRowIdx);
            totRow.height = 22;

            columnsConfig.forEach((col, cIdx) => {
                const cell = totRow.getCell(cIdx + 1);
                cell.fill = TOTAL_FILL;
                cell.border = TOTAL_BORDER;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
                cell.alignment = { horizontal: col.align || 'left', vertical: 'middle' };

                if (cIdx === 0) {
                    cell.value = 'TOTAL GERAL';
                } else if (totalConfig[col.key]) {
                    const sum = dataRows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
                    cell.value = sum;
                    cell.numFmt = Number.isInteger(sum) ? '#,##0' : '#,##0.00';
                } else {
                    cell.value = '';
                }
            });
        }

        // Auto-filtro
        ws.autoFilter = {
            from: { row: 5, column: 1 },
            to: { row: 5, column: colCount }
        };

        // Auto-largura de colunas
        columnsConfig.forEach((col, idx) => {
            let maxLen = (col.header || '').length;
            dataRows.forEach(r => {
                const v = r[col.key];
                let s = '';
                if (v instanceof Date) s = '00/00/0000';
                else if (typeof v === 'number') s = v.toLocaleString('pt-BR');
                else if (v != null) s = String(v);
                if (s.length > maxLen) maxLen = s.length;
            });
            ws.getColumn(idx + 1).width = Math.min(Math.max(maxLen + 4, col.minWidth || 12), col.maxWidth || 50);
        });

        return ws;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 1. ABA: RESUMO (com carga por recurso em horas)
    // ─────────────────────────────────────────────────────────────────────────
    if (data.resumo && data.resumo.length > 0) {
        const productLoads = {};
        if (data.carga) {
            data.carga.forEach(item => {
                const prod = item.produto;
                if (!productLoads[prod]) productLoads[prod] = {};
                (data.recursos || []).forEach(r => {
                    productLoads[prod][r] = (productLoads[prod][r] || 0) + (Number(item['rec_' + r]) || 0);
                });
            });
        }

        const resumoColumns = [
            { header: 'Cód. Produto', key: 'produto', align: 'left', minWidth: 18 },
            { header: 'Descrição do Produto', key: 'descricao', align: 'left', minWidth: 38 },
            { header: 'UM', key: 'um', align: 'center', minWidth: 8 },
            { header: 'Qtd Total a Produzir', key: 'qtd_total', align: 'right', type: 'number', minWidth: 18 },
            ...(data.recursos || []).map(r => ({
                header: `${data.recursoNomeMap?.[r] || r} (h)`,
                key: `rec_${r}`,
                align: 'right',
                type: 'number',
                minWidth: 14
            }))
        ];

        const resumoTotals = { qtd_total: true };
        (data.recursos || []).forEach(r => { resumoTotals[`rec_${r}`] = true; });

        const resumoData = data.resumo.map(r => {
            const loads = productLoads[r.produto] || {};
            const row = {
                produto: r.produto,
                descricao: r.descricao || '-',
                um: r.um || '-',
                qtd_total: Number(r.qtd_total || 0)
            };
            (data.recursos || []).forEach(rec => {
                const valHoras = (loads[rec] || 0) / 50; // 50 min/hora padrão MetalFisa
                row[`rec_${rec}`] = valHoras > 0 ? Number(valHoras.toFixed(2)) : 0;
            });
            return row;
        });

        addStyledMetalFisaSheet('Resumo', 'Resumo de Produtos a Produzir', resumoColumns, resumoData, resumoTotals);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ABA: PEDIDOS
    // ─────────────────────────────────────────────────────────────────────────
    if (data.pedidos && data.pedidos.length > 0) {
        const pedColumns = [
            { header: 'Pedido', key: 'pedido', align: 'center', minWidth: 12 },
            { header: 'Emissão', key: 'emissao', align: 'center', type: 'date', minWidth: 14 },
            { header: 'Cliente', key: 'cliente', align: 'left', minWidth: 28 },
            { header: 'Qtde Itens', key: 'item_count', align: 'right', type: 'number', minWidth: 12 },
            { header: 'Soma QTD', key: 'soma_qtd', align: 'right', type: 'number', minWidth: 14 },
            { header: 'Próx. Entrega', key: 'proxima_entrega', align: 'center', type: 'date', minWidth: 14 },
            { header: '1ª Data PCP', key: 'pcp_inicio', align: 'center', type: 'date', minWidth: 14 },
            { header: 'Últ. Data PCP', key: 'pcp_fim', align: 'center', type: 'date', minWidth: 14 },
            ...(data.recursos || []).map(r => ({
                header: `${data.recursoNomeMap?.[r] || r} (h)`,
                key: `rec_${r}`,
                align: 'right',
                type: 'number',
                minWidth: 14
            }))
        ];

        const pedTotals = { item_count: true, soma_qtd: true };
        (data.recursos || []).forEach(r => { pedTotals[`rec_${r}`] = true; });

        const pedData = data.pedidos.map(p => {
            const row = {
                pedido: p.pedido,
                emissao: parseToDate(p.emissao),
                cliente: p.cliente,
                item_count: Number(p.item_count || p.itens_count || 0),
                soma_qtd: Number(p.soma_qtd || 0),
                proxima_entrega: parseToDate(p.proxima_entrega),
                pcp_inicio: parseToDate(p.pcp_inicio),
                pcp_fim: parseToDate(p.pcp_fim)
            };
            (data.recursos || []).forEach(r => {
                row[`rec_${r}`] = Number(p['rec_' + r] || 0);
            });
            return row;
        });

        addStyledMetalFisaSheet('Pedidos', 'Lista de Pedidos de Venda', pedColumns, pedData, pedTotals);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. ABA: ITENS DETALHADOS
    // ─────────────────────────────────────────────────────────────────────────
    if (data.itens && data.itens.length > 0) {
        const itensColumns = [
            { header: 'Pedido', key: 'pedido', align: 'center', minWidth: 12 },
            { header: 'Cliente', key: 'cliente', align: 'left', minWidth: 26 },
            { header: 'Item', key: 'item', align: 'center', minWidth: 8 },
            { header: 'Produto', key: 'produto', align: 'left', minWidth: 18 },
            { header: 'Descrição', key: 'descricao', align: 'left', minWidth: 35 },
            { header: 'UM', key: 'um', align: 'center', minWidth: 8 },
            { header: 'Grupo Prioridade', key: 'prioridade', align: 'center', minWidth: 16 },
            { header: 'Qtd Pedido', key: 'qtd', align: 'right', type: 'number', minWidth: 14 },
            { header: 'Qtd Faturada', key: 'qtd_entreg', align: 'right', type: 'number', minWidth: 14 },
            { header: 'Qtd Faturar', key: 'qtd_faturar', align: 'right', type: 'number', minWidth: 14 },
            { header: 'Entrega', key: 'entrega', align: 'center', type: 'date', minWidth: 14 },
            { header: 'Data PCP', key: 'data_pcp', align: 'center', type: 'date', minWidth: 14 },
            { header: 'Nova Data PCP', key: 'nova_data_pcp', align: 'center', type: 'date', minWidth: 14 },
            { header: 'Qtde PCP', key: 'qtde_pcp', align: 'right', type: 'number', minWidth: 14 },
            { header: 'OP', key: 'op', align: 'center', minWidth: 16 },
            { header: 'Ped. Cliente', key: 'ped_cli', align: 'center', minWidth: 16 }
        ];

        const itensTotals = { qtd: true, qtd_entreg: true, qtd_faturar: true, qtde_pcp: true };

        const itensData = data.itens.map(i => ({
            pedido: i.pedido,
            cliente: i.cliente,
            item: i.item,
            produto: i.produto,
            descricao: i.descricao || '-',
            um: i.um || '-',
            prioridade: i.op_prioridade ? `Grupo ${i.op_prioridade}` : '-',
            qtd: Number(i.qtd || 0),
            qtd_entreg: Number(i.qtd_entreg || 0),
            qtd_faturar: Number(i.qtd_faturar || 0),
            entrega: parseToDate(i.entrega),
            data_pcp: parseToDate(i.data_pcp),
            nova_data_pcp: parseToDate(i.nova_data_pcp),
            qtde_pcp: i.qtde_pcp != null && i.qtde_pcp !== '' ? Number(i.qtde_pcp) : '',
            op: i.op || '-',
            ped_cli: i.ped_cli || '-'
        }));

        addStyledMetalFisaSheet('Itens Detalhados', 'Itens Detalhados com Prioridade e PCP', itensColumns, itensData, itensTotals);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. ABA: ESTRUTURA BOM
    // ─────────────────────────────────────────────────────────────────────────
    if (data.estruturas && data.estruturas.length > 0) {
        const baseCalculo = filterParams?.baseCalculo || 'saldo';
        const parentQtyMap = {};
        if (data.itens) {
            data.itens.forEach(item => {
                const p = (item.produto || '').trim();
                const qty = baseCalculo === 'pedido' ? Number(item.qtd || 0) : Number(item.qtd_faturar || 0);
                parentQtyMap[p] = (parentQtyMap[p] || 0) + qty;
            });
        }

        const bomColumns = [
            { header: 'Produto Pai (Raiz)', key: 'raiz', align: 'left', minWidth: 18 },
            { header: 'Componente', key: 'comp', align: 'left', minWidth: 18 },
            { header: 'Descrição Componente', key: 'desc', align: 'left', minWidth: 35 },
            { header: 'UM', key: 'um', align: 'center', minWidth: 8 },
            { header: 'Tipo', key: 'tipo', align: 'center', minWidth: 8 },
            { header: 'Qtd Unitária (BOM)', key: 'quant', align: 'right', type: 'number', minWidth: 16 },
            { header: 'Qtd Total Consolidada', key: 'qtdTotal', align: 'right', type: 'number', minWidth: 18 }
        ];

        const bomData = data.estruturas.map(b => {
            const parentQty = parentQtyMap[b.raiz] || 0;
            return {
                raiz: b.raiz,
                comp: b.comp,
                desc: b.desc || '-',
                um: b.um || '-',
                tipo: b.tipo || '-',
                quant: Number(b.quant || 0),
                qtdTotal: Number((Number(b.quant || 0) * parentQty).toFixed(4))
            };
        });

        addStyledMetalFisaSheet('Estrutura BOM', 'Estrutura de Produtos Consolidada (BOM)', bomColumns, bomData, { qtdTotal: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. ABA: NECESSIDADE DE MATERIAIS
    // ─────────────────────────────────────────────────────────────────────────
    if (data.itens && data.estruturas && data.itens.length > 0 && data.estruturas.length > 0) {
        const matColumns = [
            { header: 'Pedido', key: 'pedido', align: 'center', minWidth: 12 },
            { header: 'Cliente', key: 'cliente', align: 'left', minWidth: 26 },
            { header: 'Prod. Final', key: 'parentProd', align: 'left', minWidth: 18 },
            { header: 'Descrição Prod. Final', key: 'descricao', align: 'left', minWidth: 32 },
            { header: 'Data Entrega', key: 'entrega', align: 'center', type: 'date', minWidth: 14 },
            { header: 'Data PCP', key: 'data_pcp', align: 'center', type: 'date', minWidth: 14 },
            { header: 'Qtde PCP', key: 'qtde_pcp', align: 'right', type: 'number', minWidth: 14 },
            { header: 'Qtd Faturar', key: 'parentQtd', align: 'right', type: 'number', minWidth: 14 },
            { header: 'Cód. Material', key: 'comp', align: 'left', minWidth: 18 },
            { header: 'Descrição do Material', key: 'desc', align: 'left', minWidth: 35 },
            { header: 'UM', key: 'um', align: 'center', minWidth: 8 },
            { header: 'Tipo', key: 'tipo', align: 'center', minWidth: 8 },
            { header: 'Qtd Unitária (BOM)', key: 'quant', align: 'right', type: 'number', minWidth: 16 },
            { header: 'Qtd Necessária', key: 'totalQtd', align: 'right', type: 'number', minWidth: 18 }
        ];

        const matData = [];
        data.itens.forEach(item => {
            const parentProd = (item.produto || '').trim();
            const parentQtd = Number(item.qtd_faturar || 0);
            const comps = data.estruturas.filter(e => e.raiz === parentProd);

            comps.forEach(c => {
                matData.push({
                    pedido: item.pedido,
                    cliente: item.cliente,
                    parentProd: parentProd,
                    descricao: item.descricao || '-',
                    entrega: parseToDate(item.entrega),
                    data_pcp: parseToDate(item.data_pcp),
                    qtde_pcp: item.qtde_pcp != null && item.qtde_pcp !== '' ? Number(item.qtde_pcp) : '',
                    parentQtd: parentQtd,
                    comp: c.comp,
                    desc: c.desc || '-',
                    um: c.um || '-',
                    tipo: c.tipo || '-',
                    quant: Number(c.quant || 0),
                    totalQtd: Number((parentQtd * (Number(c.quant) || 0)).toFixed(4))
                });
            });
        });

        addStyledMetalFisaSheet('Necessidade de Materiais', 'Necessidade de Materiais por Pedido', matColumns, matData, { totalQtd: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. ABA: CARGA POR RECURSO
    // ─────────────────────────────────────────────────────────────────────────
    if (data.carga && data.carga.length > 0 && data.recursos) {
        const cargaColumns = [
            { header: 'Pedido', key: 'pedido', align: 'center', minWidth: 12 },
            { header: 'Emissão', key: 'emissao', align: 'center', type: 'date', minWidth: 14 },
            { header: 'Cliente', key: 'cliente', align: 'left', minWidth: 26 },
            { header: 'Item', key: 'item', align: 'center', minWidth: 8 },
            { header: 'Produto', key: 'produto', align: 'left', minWidth: 18 },
            { header: 'Descrição', key: 'descricao', align: 'left', minWidth: 32 },
            { header: 'Saldo a Faturar', key: 'qtd_faturar', align: 'right', type: 'number', minWidth: 14 },
            { header: 'Entrega', key: 'entrega', align: 'center', type: 'date', minWidth: 14 },
            { header: 'Data PCP', key: 'data_pcp', align: 'center', type: 'date', minWidth: 14 },
            { header: 'Prioridade', key: 'prioridade', align: 'center', minWidth: 14 },
            ...(data.recursos || []).map(r => ({
                header: `${data.recursoNomeMap?.[r] || r} (min)`,
                key: `rec_${r}`,
                align: 'right',
                type: 'number',
                minWidth: 14
            }))
        ];

        const cargaTotals = { qtd_faturar: true };
        (data.recursos || []).forEach(r => { cargaTotals[`rec_${r}`] = true; });

        const cargaData = data.carga.map(c => {
            const row = {
                pedido: c.pedido,
                emissao: parseToDate(c.emissao),
                cliente: c.cliente,
                item: c.item,
                produto: c.produto,
                descricao: c.descricao || '-',
                qtd_faturar: Number(c.qtd_faturar || 0),
                entrega: parseToDate(c.entrega),
                data_pcp: parseToDate(c.data_pcp),
                prioridade: c.op_prioridade ? `Grupo ${c.op_prioridade}` : '-'
            };
            (data.recursos || []).forEach(r => {
                row[`rec_${r}`] = Number(c['rec_' + r] || 0);
            });
            return row;
        });

        addStyledMetalFisaSheet('Carga por Recurso', 'Carga de Máquinas por Pedido', cargaColumns, cargaData, cargaTotals);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. ABA: CAPACIDADE DO PERÍODO
    // ─────────────────────────────────────────────────────────────────────────
    if (data.carga && data.carga.length > 0 && data.recursos && data.capacidades) {
        let dIni = filterParams.dataInicial ? new Date(filterParams.dataInicial) : null;
        let dFim = filterParams.dataFinal ? new Date(filterParams.dataFinal) : null;

        let days = 1;
        if (dIni && dFim) {
            let count = 0;
            let cur = new Date(dIni.getTime());
            cur.setHours(0,0,0,0);
            const end = new Date(dFim.getTime());
            end.setHours(23,59,59,999);

            while (cur <= end) {
                const day = cur.getDay();
                if (day !== 0 && day !== 6) count++;
                cur.setDate(cur.getDate() + 1);
            }
            days = count || 1;
        }

        const capColumns = [
            { header: 'Recurso / Máquina', key: 'recurso_nome', align: 'left', minWidth: 22 },
            { header: 'Capacidade Diária (h)', key: 'cap_diaria_h', align: 'right', type: 'number', minWidth: 18 },
            { header: 'Capacidade Total (h)', key: 'cap_total_h', align: 'right', type: 'number', minWidth: 18 },
            { header: 'Carga Prevista (h)', key: 'carga_prevista_h', align: 'right', type: 'number', minWidth: 18 },
            { header: 'Saldo Capacidade (h)', key: 'saldo_h', align: 'right', type: 'number', minWidth: 18 },
            { header: '% Ocupação', key: 'ocupacao_pct', align: 'right', type: 'number', minWidth: 14 }
        ];

        const capTotals = { cap_total_h: true, carga_prevista_h: true, saldo_h: true };

        const capData = data.recursos.map(r => {
            const cod = r.trim().toUpperCase();
            const capDiaria = data.capacidades[cod] || 0;
            const capTotal = capDiaria * days;

            const cargaPrevista = data.carga.reduce((sum, item) => sum + (Number(item['rec_' + r]) || 0), 0);
            const MIN_POR_HORA = 55;
            const capDiariaHrs = Number((capDiaria / MIN_POR_HORA).toFixed(2));
            const capTotalHrs = Number((capTotal / MIN_POR_HORA).toFixed(2));
            const cargaPrevistaHrs = Number((cargaPrevista / MIN_POR_HORA).toFixed(2));
            const saldoHrs = Number(((capTotal - cargaPrevista) / MIN_POR_HORA).toFixed(2));
            const ocupacao = capTotal > 0 ? (cargaPrevista / capTotal) * 100 : 0;

            return {
                recurso_nome: data.recursoNomeMap?.[r] || r,
                cap_diaria_h: capDiariaHrs,
                cap_total_h: capTotalHrs,
                carga_prevista_h: cargaPrevistaHrs,
                saldo_h: saldoHrs,
                ocupacao_pct: Number(ocupacao.toFixed(2))
            };
        });

        addStyledMetalFisaSheet('Capacidade do Período', `Capacidade do Período (${days} dias úteis)`, capColumns, capData, capTotals);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. ABA: EXECUÇÃO OP
    // ─────────────────────────────────────────────────────────────────────────
    if (data.execucao_op && data.execucao_op.length > 0 && data.recursos) {
        const execColumns = [
            { header: 'Pedido', key: 'pedido', align: 'center', minWidth: 12 },
            { header: 'Cliente', key: 'cliente', align: 'left', minWidth: 26 },
            { header: 'OP', key: 'op', align: 'center', minWidth: 16 },
            { header: 'Produto', key: 'produto', align: 'left', minWidth: 18 },
            { header: 'Qtd Planejada', key: 'qtd_planejada', align: 'right', type: 'number', minWidth: 14 },
            { header: 'Data PCP', key: 'data_pcp', align: 'center', type: 'date', minWidth: 14 },
            { header: 'Qtde PCP', key: 'qtde_pcp', align: 'right', type: 'number', minWidth: 14 },
            ...data.recursos.flatMap(r => [
                { header: `${r} Prev (min)`, key: `prev_${r}`, align: 'right', type: 'number', minWidth: 14 },
                { header: `${r} Apon (min)`, key: `apon_${r}`, align: 'right', type: 'number', minWidth: 14 },
                { header: `${r} Qtd Apon (un)`, key: `qtd_apon_${r}`, align: 'right', type: 'number', minWidth: 14 }
            ])
        ];

        const execData = data.execucao_op.map(e => {
            const row = {
                pedido: e.pedido,
                cliente: e.cliente,
                op: e.op,
                produto: e.produto,
                qtd_planejada: Number(e.qtd_planejada || 0),
                data_pcp: parseToDate(e.data_pcp),
                qtde_pcp: e.qtde_pcp != null && e.qtde_pcp !== '' ? Number(e.qtde_pcp) : ''
            };
            data.recursos.forEach(r => {
                row[`prev_${r}`] = Number(e['previsto_' + r] || 0);
                row[`apon_${r}`] = Number(e['apontado_' + r] || 0);
                row[`qtd_apon_${r}`] = Number(e['qtd_apontada_' + r] || 0);
            });
            return row;
        });

        addStyledMetalFisaSheet('Execução OP', 'Execução e Apontamentos de OP', execColumns, execData, { qtd_planejada: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. ABA: PROG. ENTREGAS (14 Dias)
    // ─────────────────────────────────────────────────────────────────────────
    if (data.itens && data.itens.length > 0) {
        const dHoje = new Date();
        dHoje.setHours(0, 0, 0, 0);

        const dateCols = [];
        const dayNames = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
        const monthNames = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

        for (let i = 0; i < 14; i++) {
            const d = new Date(dHoje.getTime() + i * 86400000);
            const iso = d.toISOString().split('T')[0];
            const label = `${dayNames[d.getDay()]} - ${d.getDate()} de ${monthNames[d.getMonth()]}`;
            dateCols.push({ iso, label, key: `day_${i}` });
        }

        const progColumns = [
            { header: 'Pedido', key: 'pedido', align: 'center', minWidth: 12 },
            { header: 'Cliente', key: 'cliente', align: 'left', minWidth: 26 },
            { header: 'Código Produto', key: 'produto', align: 'left', minWidth: 18 },
            { header: 'Descrição Produto', key: 'descricao', align: 'left', minWidth: 32 },
            { header: 'OPs', key: 'op', align: 'center', minWidth: 16 },
            { header: 'Qtd Total OP', key: 'qtd', align: 'right', type: 'number', minWidth: 14 },
            { header: 'Total Saldo Prod', key: 'qtd_faturar', align: 'right', type: 'number', minWidth: 14 },
            ...dateCols.map(dc => ({
                header: dc.label,
                key: dc.key,
                align: 'right',
                type: 'number',
                minWidth: 14
            }))
        ];

        const progTotals = { qtd: true, qtd_faturar: true };
        dateCols.forEach(dc => { progTotals[dc.key] = true; });

        const progData = data.itens.map(it => {
            const itemPcpDate = normalizeToISO(it.data_pcp || it.entrega);
            const qtdFaturar = Number(it.qtd_faturar || 0);

            const row = {
                pedido: it.pedido,
                cliente: it.cliente,
                produto: it.produto,
                descricao: it.descricao || '-',
                op: it.op || '-',
                qtd: Number(it.qtd || 0),
                qtd_faturar: qtdFaturar
            };

            dateCols.forEach(dc => {
                row[dc.key] = (itemPcpDate === dc.iso) ? qtdFaturar : '';
            });

            return row;
        });

        addStyledMetalFisaSheet('Prog. Entregas', 'Programação de Entregas (14 Dias)', progColumns, progData, progTotals);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. ABA: DETALHAMENTO ESTRUTURA (OP / Lote) — ÁRVORE MULTINÍVEL
    // ─────────────────────────────────────────────────────────────────────────
    const itemsForStructure = fractionalItems && fractionalItems.length > 0 ? fractionalItems : data.itens;
    if (itemsForStructure && itemsForStructure.length > 0 && (data.estruturas_hierarquicas || data.estruturas)) {
        const formatOperations = (compCode) => {
            const ops = data.routingSequenceMap?.[compCode] || [];
            if (!ops || ops.length === 0) return '-';
            return ops.map(o => `${o.operac}${o.recurso ? ` (${o.recurso})` : ''}`).join(' ➔ ');
        };

        const treeColumns = [
            { header: 'Pedido', key: 'pedido', align: 'center', minWidth: 12 },
            { header: 'Cliente', key: 'cliente', align: 'left', minWidth: 26 },
            { header: 'OP / Fração', key: 'visual_op', align: 'center', minWidth: 18 },
            { header: 'Identificação Lote', key: 'lote_ident', align: 'left', minWidth: 18 },
            { header: 'Nível', key: 'nivel_label', align: 'center', minWidth: 16 },
            { header: 'Produto Pai (Nível)', key: 'pai', align: 'left', minWidth: 18 },
            { header: 'Cód. Peça / Insumo', key: 'comp', align: 'left', minWidth: 18 },
            { header: 'Descrição da Peça / Material', key: 'desc', align: 'left', minWidth: 38 },
            { header: 'Tipo', key: 'tipo', align: 'center', minWidth: 10 },
            { header: 'UM', key: 'um', align: 'center', minWidth: 8 },
            { header: 'Qtd. Unit. Estrutura', key: 'quant_acumulada', align: 'right', type: 'number', minWidth: 16 },
            { header: 'Qtd. no Lote / Fração (PCP)', key: 'qtd_lote', align: 'right', type: 'number', minWidth: 20 },
            { header: 'Roteiro de Operações / Recursos', key: 'roteiro_str', align: 'left', minWidth: 32 },
            { header: 'Data PCP (Lote)', key: 'data_pcp', align: 'center', type: 'date', minWidth: 15 },
            { header: 'Ref. Cliente', key: 'ref_cliente', align: 'left', minWidth: 18 },
            { header: 'PC (Ped. Cliente)', key: 'ped_cliente', align: 'center', minWidth: 18 }
        ];

        const treeDataMap = {};
        if (data.estruturas_hierarquicas && data.estruturas_hierarquicas.length > 0) {
            data.estruturas_hierarquicas.forEach(node => {
                const raiz = (node.raiz || '').trim();
                if (!treeDataMap[raiz]) treeDataMap[raiz] = [];
                treeDataMap[raiz].push(node);
            });
        } else if (data.estruturas) {
            data.estruturas.forEach(node => {
                const raiz = (node.raiz || '').trim();
                if (!treeDataMap[raiz]) treeDataMap[raiz] = [];
                treeDataMap[raiz].push({
                    raiz: node.raiz,
                    pai: node.raiz,
                    comp: node.comp,
                    nivel: 1,
                    quant_unitaria: node.quant,
                    quant_acumulada: node.quant,
                    desc: node.desc,
                    um: node.um,
                    tipo: node.tipo
                });
            });
        }

        const treeRows = [];
        itemsForStructure.forEach(item => {
            const prod = (item.codigo || item.produto || '').trim();
            const fracQtd = Number(item.visual_qtd || item.quantidade_pcp || item.qtd_faturar || item.qtd || 0);
            const opDisplay = item.visual_op || item.op || item.op_num || '-';
            const loteIdent = item.is_fraction 
                ? `Fração ${item.fraction_letter || item.numero_lote || ''}`
                : (item.numero_lote || item.lote ? `Lote ${item.numero_lote || item.lote}` : 'Lote Único');

            // Nível 0: PA Principal
            treeRows.push({
                is_fraction: item.is_fraction,
                pedido: item.pedido,
                cliente: item.nome_cliente || item.cliente || '-',
                visual_op: opDisplay,
                lote_ident: loteIdent,
                nivel_label: '0 - PA (Principal)',
                pai: '-',
                comp: prod,
                desc: item.descricao || '-',
                tipo: 'PA',
                um: item.unidade || item.um || 'UN',
                quant_acumulada: 1.0,
                qtd_lote: fracQtd,
                roteiro_str: formatOperations(prod),
                data_pcp: parseToDate(item.data_entrega_pcp || item.pcp_delivery_forecast_date || item.data_pcp || item.entrega),
                ref_cliente: item.ref_cliente || '-',
                ped_cliente: item.ped_cliente || item.pedcli || '-'
            });

            // Níveis 1..N: Subconjuntos e MPs
            const subNodes = treeDataMap[prod] || [];
            subNodes.forEach(node => {
                const nivelNum = Number(node.nivel || 1);
                const tipoLabel = node.tipo === 'PI' ? 'PI (Intermediário)' : node.tipo === 'MP' ? 'MP (Insumo)' : node.tipo || 'COMP';
                const nivelLabel = `${nivelNum} - ${tipoLabel}`;
                const qtdAcum = Number(node.quant_acumulada || node.quant_unitaria || 0);
                const qtdTotalLote = Number((qtdAcum * fracQtd).toFixed(4));

                treeRows.push({
                    is_fraction: item.is_fraction,
                    pedido: item.pedido,
                    cliente: item.nome_cliente || item.cliente || '-',
                    visual_op: opDisplay,
                    lote_ident: loteIdent,
                    nivel_label: nivelLabel,
                    pai: node.pai || prod,
                    comp: node.comp,
                    desc: node.desc || '-',
                    tipo: node.tipo || '-',
                    um: node.um || '-',
                    quant_acumulada: qtdAcum,
                    qtd_lote: qtdTotalLote,
                    roteiro_str: formatOperations(node.comp),
                    data_pcp: parseToDate(item.data_entrega_pcp || item.pcp_delivery_forecast_date || item.data_pcp || item.entrega),
                    ref_cliente: item.ref_cliente || '-',
                    ped_cliente: item.ped_cliente || item.pedcli || '-'
                });
            });
        });

        addStyledMetalFisaSheet('Detalhamento Estrutura', 'Árvore Multinível de Fabricação por Fração / Lote de OP', treeColumns, treeRows, { qtd_lote: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Exportação do Buffer via Navegador
    // ─────────────────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Planilha_Mestra_MetalFisa_${getTodayDateStr()}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
};

/**
 * EXPORT TO PDF (.PDF) — ESTILO METALFISA
 * Exports Planilha Mestra data into formatted PDF report
 */
export const exportMasterSheetPdf = (rawData, activeTab = 'itens', filterParams = {}) => {
    if (!rawData) throw new Error('Nenhum dado disponível para exportar.');
    const data = filterInactiveAndInvoiced(rawData);

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const filterLabel = buildFilterLabel(filterParams);

    let tabLabel = 'Relatório Geral';
    let headers = [];
    let rows = [];

    if (activeTab === 'resumo' && data.resumo) {
        tabLabel = 'Resumo de Produtos a Produzir';
        headers = [['Produto', 'Descrição', 'UM', 'Qtd Total a Produzir']];
        rows = data.resumo.map(r => [r.produto, r.descricao || '-', r.um || '-', formatNum(r.qtd_total)]);
    } else if (activeTab === 'pedidos' && data.pedidos) {
        tabLabel = 'Lista de Pedidos de Venda';
        headers = [['Pedido', 'Emissão', 'Cliente', 'Qtde Itens', 'Qtd Total Pedido', 'Início PCP', 'Fim PCP']];
        rows = data.pedidos.map(p => [p.pedido, formatDate(p.emissao), p.cliente, p.item_count, formatNum(p.soma_qtd), formatDate(p.pcp_inicio), formatDate(p.pcp_fim)]);
    } else if (activeTab === 'capacidade_periodo' && data.recursos && data.capacidades) {
        tabLabel = 'Capacidade do Período Filtrado';
        
        let dIni = filterParams.dataInicial ? new Date(filterParams.dataInicial) : null;
        let dFim = filterParams.dataFinal ? new Date(filterParams.dataFinal) : null;

        if (!dIni || !dFim) {
            const pcpDates = data.carga.map(c => {
                const dateVal = c.data_pcp || c.entrega;
                if (!dateVal) return null;
                const str = String(dateVal).trim();
                let d;
                if (str.length === 8 && !str.includes('-')) {
                    d = new Date(str.substring(0, 4) + '-' + str.substring(4, 6) + '-' + str.substring(6, 8));
                } else {
                    d = new Date(str);
                }
                return isNaN(d.getTime()) ? null : d;
            }).filter(Boolean);

            if (pcpDates.length > 0) {
                if (!dIni) dIni = new Date(Math.min(...pcpDates));
                if (!dFim) dFim = new Date(Math.max(...pcpDates));
            }
        }

        let days = 1;
        if (dIni && dFim) {
            let count = 0;
            let cur = new Date(dIni.getTime());
            cur.setHours(0,0,0,0);
            const end = new Date(dFim.getTime());
            end.setHours(23,59,59,999);

            while (cur <= end) {
                const day = cur.getDay();
                if (day !== 0 && day !== 6) { // Exclude Sunday (0) and Saturday (6)
                    count++;
                }
                cur.setDate(cur.getDate() + 1);
            }
            days = count || 1;
        }

        headers = [['Recurso / Máquina', 'Capacidade Diária (h)', 'Capacidade Total (h)', 'Carga Prevista (h)', 'Saldo Capacidade (h)', '% Ocupação']];
        
        rows = data.recursos.map(r => {
            const cod = r.trim().toUpperCase();
            const capDiaria = data.capacidades[cod] || 0;
            const capTotal = capDiaria * days;

            const cargaPrevista = data.carga.reduce((sum, item) => {
                if (dIni && dFim) {
                    const itemDateVal = item.data_pcp || item.entrega;
                    if (itemDateVal) {
                        const str = String(itemDateVal).trim();
                        let d;
                        if (str.length === 8 && !str.includes('-')) {
                            d = new Date(str.substring(0, 4) + '-' + str.substring(4, 6) + '-' + str.substring(6, 8) + 'T00:00:00');
                        } else {
                            d = new Date(str);
                        }
                        if (!isNaN(d.getTime())) {
                            if (d < dIni || d > dFim) return sum;
                        }
                    }
                }
                return sum + (Number(item['rec_' + r]) || 0);
            }, 0);

            const MIN_POR_HORA = 55;
            const capDiariaHrs = capDiaria / MIN_POR_HORA;
            const capTotalHrs = capTotal / MIN_POR_HORA;
            const cargaPrevistaHrs = cargaPrevista / MIN_POR_HORA;
            const saldoHrs = (capTotal - cargaPrevista) / MIN_POR_HORA;
            const ocupacao = capTotal > 0 ? (cargaPrevista / capTotal) * 100 : 0;

            return [
                data.recursoNomeMap[r] || r,
                formatNum(capDiariaHrs),
                formatNum(capTotalHrs),
                formatNum(cargaPrevistaHrs),
                formatNum(saldoHrs),
                `${formatNum(ocupacao)}%`
            ];
        });
    } else if (activeTab === 'estruturas' && data.estruturas) {
        tabLabel = 'Estrutura dos Produtos (Engenharia BOM)';
        headers = [['Produto Pai (Raiz)', 'Componente', 'Descrição Componente', 'UM', 'Tipo', 'Qtd Unitária', 'Qtd Total']];
        const baseCalculo = filterParams?.baseCalculo || 'saldo';
        const parentQtyMap = {};
        if (data.itens) {
            data.itens.forEach(item => {
                const p = (item.produto || '').trim();
                const qty = baseCalculo === 'pedido' ? Number(item.qtd || 0) : Number(item.qtd_faturar || 0);
                parentQtyMap[p] = (parentQtyMap[p] || 0) + qty;
            });
        }
        rows = data.estruturas.map(b => {
            const parentQty = parentQtyMap[b.raiz] || 0;
            const qtdTotal = Number(b.quant || 0) * parentQty;
            return [b.raiz, b.comp, b.desc || '-', b.um || '-', b.tipo || '-', formatNum(b.quant), formatNum(qtdTotal)];
        });
    } else if (activeTab === 'materiais_necessarios' && data.itens && data.estruturas) {
        tabLabel = 'Necessidade Detalhada de Materiais';
        headers = [['Pedido', 'Cliente', 'Prod. Final', 'Data Entrega', 'Data PCP', 'Qtde PCP', 'Qtd Faturar', 'Cód. Material', 'Descrição do Material', 'UM', 'Qtd Unit.', 'Qtd Necessária']];
        rows = [];
        data.itens.forEach(item => {
            const parentProd = (item.produto || '').trim();
            const parentQtd = Number(item.qtd_faturar || 0);
            const comps = data.estruturas.filter(e => e.raiz === parentProd);

            comps.forEach(c => {
                rows.push([
                    item.pedido,
                    item.cliente,
                    parentProd,
                    formatDate(item.entrega),
                    formatDate(item.data_pcp),
                    item.qtde_pcp != null ? formatNum(item.qtde_pcp) : '-',
                    formatNum(parentQtd),
                    c.comp,
                    c.desc || '-',
                    c.um || '-',
                    formatNum(c.quant),
                    formatNum(parentQtd * c.quant)
                ]);
            });
        });
    } else {
        // Default: Itens Detalhados com Prioridades e Data PCP
        tabLabel = 'Itens Detalhados com Grupos de Prioridades';
        headers = [['Pedido', 'Cliente', 'Item', 'Produto', 'Descrição', 'UM', 'Prioridade', 'Qtd Pedido', 'Qtd Faturar', 'Entrega', 'Data PCP', 'Nova Data PCP']];
        rows = (data.itens || []).map(i => [
            i.pedido,
            i.cliente,
            i.item,
            i.produto,
            i.descricao || '-',
            i.um || '-',
            i.op_prioridade ? `Grupo ${i.op_prioridade}` : '-',
            formatNum(i.qtd),
            formatNum(i.qtd_faturar),
            formatDate(i.entrega),
            formatDate(i.data_pcp),
            formatDate(i.nova_data_pcp) || '-'
        ]);
    }

    const startY = drawHeader(doc, pageWidth, 'Planilha Mestra - Planejamento S&OP', `Visualização: ${tabLabel}  |  ${filterLabel}`);

    autoTable(doc, {
        startY: startY,
        head: headers,
        body: rows,
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: ML, right: MR },
        didParseCell: (cellData) => {
            // Apply priority badge colors in PDF column 'Prioridade'
            if (cellData.section === 'body' && cellData.column.index === 6 && activeTab === 'itens') {
                const val = String(cellData.cell.raw || '');
                if (val.includes('Grupo 1')) {
                    cellData.cell.styles.fillColor = [254, 226, 226]; // Soft red
                    cellData.cell.styles.textColor = [185, 28, 28]; // Red bold
                    cellData.cell.styles.fontStyle = 'bold';
                } else if (val.includes('Grupo 2')) {
                    cellData.cell.styles.fillColor = [255, 237, 213]; // Soft orange
                    cellData.cell.styles.textColor = [194, 65, 12]; // Orange bold
                    cellData.cell.styles.fontStyle = 'bold';
                } else if (val.includes('Grupo 3')) {
                    cellData.cell.styles.fillColor = [254, 249, 195]; // Soft yellow
                    cellData.cell.styles.textColor = [161, 98, 7]; // Yellow bold
                    cellData.cell.styles.fontStyle = 'bold';
                } else if (val.includes('Grupo')) {
                    cellData.cell.styles.fillColor = [219, 234, 254]; // Soft blue
                    cellData.cell.styles.textColor = [29, 78, 216]; // Blue bold
                    cellData.cell.styles.fontStyle = 'bold';
                }
            }
        },
        didDrawPage: (d) => {
            // Footer
            doc.setFontSize(7);
            doc.setTextColor(140, 140, 140);
            doc.text(`Página ${d.pageNumber}`, pageWidth - MR, pageHeight - 4.5, { align: 'right' });
            doc.text('MetalFisa System — Sistema Integrado de Gestão & Planejamento S&OP', ML, pageHeight - 4.5);
        }
    });

    const fileName = `Planilha_Mestra_MetalFisa_${activeTab}_${getTodayDateStr()}.pdf`;
    doc.save(fileName);
};

/**
 * EXPORT MASTER SHEET BASED ON FRACTIONAL OPS (.XLSX) — ESTILO OFICIAL METALFISA
 * Exports multi-sheet Excel file with corporate navy branding, styled headers, zebra striping, borders and proportional loads
 */
export const exportFractionalMasterSheetExcel = async (fractionalItems, masterData = {}, filterParams = {}) => {
    if (!fractionalItems || fractionalItems.length === 0) {
        throw new Error('Nenhuma OP / fração disponível para exportar.');
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MetalFisa System';
    wb.created = new Date();

    const filterLabel = buildFilterLabel(filterParams);
    const dateStr = new Date().toLocaleString('pt-BR');

    const NAVY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const BLUE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    const SLATE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const ZEBRA_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    const WHITE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    const AMBER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    const GREEN_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
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

    const addStyledMetalFisaSheet = (sheetName, title, columnsConfig, dataRows, totalConfig = null) => {
        const ws = wb.addWorksheet(sheetName, {
            views: [{ state: 'frozen', ySplit: 5, showGridLines: true }]
        });

        const colCount = columnsConfig.length;
        const getColLetter = (n) => {
            let s = '';
            while (n > 0) {
                let m = (n - 1) % 26;
                s = String.fromCharCode(65 + m) + s;
                n = Math.floor((n - m) / 26);
            }
            return s;
        };
        const lastCol = getColLetter(colCount);

        // 1. Linha 1: Marca Corporativa
        ws.mergeCells(`A1:${lastCol}1`);
        const r1 = ws.getCell('A1');
        r1.value = 'METALFISA METALÚRGICA LTDA — SISTEMA INTEGRADO DE GESTÃO (S&OP)';
        r1.fill = NAVY_FILL;
        r1.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        r1.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 26;

        // 2. Linha 2: Título do Relatório
        ws.mergeCells(`A2:${lastCol}2`);
        const r2 = ws.getCell('A2');
        r2.value = `RELATÓRIO: ${title.toUpperCase()}`;
        r2.fill = BLUE_FILL;
        r2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        r2.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(2).height = 20;

        // 3. Linha 3: Metadados
        ws.mergeCells(`A3:${lastCol}3`);
        const r3 = ws.getCell('A3');
        r3.value = `Emissão: ${dateStr}${filterLabel ? `   |   Filtros Aplicados: ${filterLabel}` : ''}`;
        r3.fill = SLATE_FILL;
        r3.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF334155' } };
        r3.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(3).height = 18;

        // 4. Linha 4: Espaçador
        ws.getRow(4).height = 8;

        // 5. Linha 5: Cabeçalhos da Tabela
        const headerRow = ws.getRow(5);
        headerRow.height = 24;
        columnsConfig.forEach((col, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = col.header;
            cell.fill = NAVY_FILL;
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: col.align || 'center', vertical: 'middle', wrapText: true };
            cell.border = THIN_BORDER;
        });

        // 6. Linhas de Dados
        dataRows.forEach((rowObj, rIdx) => {
            const row = ws.getRow(6 + rIdx);
            row.height = 20;
            const isZebra = rIdx % 2 === 1;

            columnsConfig.forEach((col, cIdx) => {
                const cell = row.getCell(cIdx + 1);
                const val = rowObj[col.key];

                cell.value = val !== undefined && val !== null ? val : '-';
                cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF1E293B' } };
                cell.alignment = { horizontal: col.align || 'left', vertical: 'middle' };
                cell.border = THIN_BORDER;
                cell.fill = isZebra ? ZEBRA_FILL : WHITE_FILL;

                // Highlight fracionada
                if (rowObj.is_fraction && (col.key === 'visual_op' || col.key === 'lote_ident' || col.key === 'tipo_lote')) {
                    cell.fill = AMBER_FILL;
                    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF78350F' } };
                }

                // Status badges
                if (col.key === 'status') {
                    if (val === 'Entregue') {
                        cell.fill = GREEN_FILL;
                        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF166534' } };
                    } else if (val === 'Fracionada') {
                        cell.fill = AMBER_FILL;
                        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF78350F' } };
                    }
                }

                // Formatos
                if (col.type === 'number') {
                    if (typeof val === 'number') {
                        cell.numFmt = Number.isInteger(val) ? '#,##0' : '#,##0.00';
                    }
                } else if (col.type === 'date') {
                    if (val instanceof Date) {
                        cell.numFmt = 'dd/mm/yyyy';
                    }
                }
            });
        });

        // 7. Linha de Totais
        if (totalConfig && dataRows.length > 0) {
            const totRowIdx = 6 + dataRows.length;
            const totRow = ws.getRow(totRowIdx);
            totRow.height = 22;

            columnsConfig.forEach((col, cIdx) => {
                const cell = totRow.getCell(cIdx + 1);
                cell.fill = TOTAL_FILL;
                cell.border = TOTAL_BORDER;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
                cell.alignment = { horizontal: col.align || 'left', vertical: 'middle' };

                if (cIdx === 0) {
                    cell.value = 'TOTAL GERAL';
                } else if (totalConfig[col.key]) {
                    const sum = dataRows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
                    cell.value = sum;
                    cell.numFmt = Number.isInteger(sum) ? '#,##0' : '#,##0.00';
                } else {
                    cell.value = '';
                }
            });
        }

        // Auto-filtro
        ws.autoFilter = {
            from: { row: 5, column: 1 },
            to: { row: 5, column: colCount }
        };

        // Auto-largura de colunas
        columnsConfig.forEach((col, idx) => {
            let maxLen = (col.header || '').length;
            dataRows.forEach(r => {
                const v = r[col.key];
                let s = '';
                if (v instanceof Date) s = '00/00/0000';
                else if (typeof v === 'number') s = v.toLocaleString('pt-BR');
                else if (v != null) s = String(v);
                if (s.length > maxLen) maxLen = s.length;
            });
            ws.getColumn(idx + 1).width = Math.min(Math.max(maxLen + 4, col.minWidth || 12), col.maxWidth || 50);
        });

        return ws;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // ABA 1: OPs Fracionadas (Detalhadas com numeração completa)
    // ─────────────────────────────────────────────────────────────────────────
    const opsColumns = [
        { header: 'Pedido', key: 'pedido', align: 'center', minWidth: 12 },
        { header: 'Cliente', key: 'cliente', align: 'left', minWidth: 28 },
        { header: 'Item', key: 'item', align: 'center', minWidth: 8 },
        { header: 'Tipo Lote', key: 'tipo_lote', align: 'center', minWidth: 14 },
        { header: 'OP / Fração', key: 'visual_op', align: 'center', minWidth: 18 },
        { header: 'Identificação Lote', key: 'lote_ident', align: 'left', minWidth: 20 },
        { header: 'Cód. Produto', key: 'codigo', align: 'left', minWidth: 18 },
        { header: 'Descrição do Produto', key: 'descricao', align: 'left', minWidth: 35 },
        { header: 'UM', key: 'um', align: 'center', minWidth: 8 },
        { header: 'Qtd. Fração (PCP)', key: 'visual_qtd', align: 'right', type: 'number', minWidth: 16 },
        { header: 'Saldo Fat. Total', key: 'qtd_faturar', align: 'right', type: 'number', minWidth: 16 },
        { header: 'Data PCP (Lote)', key: 'data_pcp', align: 'center', type: 'date', minWidth: 15 },
        { header: 'Emissão Pedido', key: 'emissao', align: 'center', type: 'date', minWidth: 15 },
        { header: 'Ref. Cliente', key: 'ref_cliente', align: 'left', minWidth: 18 },
        { header: 'PC (Ped. Cliente)', key: 'ped_cliente', align: 'center', minWidth: 18 },
        { header: 'Status', key: 'status', align: 'center', minWidth: 14 }
    ];

    const opsData = fractionalItems.map(item => ({
        is_fraction: item.is_fraction,
        pedido: item.pedido,
        cliente: item.nome_cliente || item.cliente || '-',
        item: item.item,
        tipo_lote: item.is_fraction ? 'Fracionada' : 'Lote Único',
        visual_op: item.visual_op || item.op_num || '-',
        lote_ident: item.is_fraction ? `Fração ${item.fraction_letter || item.numero_lote || ''} (Lote ${item.fraction_letter || item.numero_lote || ''})` : 'Lote Principal',
        codigo: item.codigo || item.produto || '-',
        descricao: item.descricao || '-',
        um: item.unidade || item.um || 'UN',
        visual_qtd: Number(item.visual_qtd || item.quantidade_pcp || item.qtd_faturar || 0),
        qtd_faturar: Number(item.qtd_faturar || 0),
        data_pcp: parseToDate(item.data_entrega_pcp || item.pcp_delivery_forecast_date),
        emissao: parseToDate(item.emissao),
        ref_cliente: item.ref_cliente || '-',
        ped_cliente: item.ped_cliente || item.pedcli || '-',
        status: parseFloat(item.qtd_faturar) <= 0 ? 'Entregue' : (item.is_fraction ? 'Fracionada' : 'Pendente')
    }));

    addStyledMetalFisaSheet('OPs Fracionadas', 'OPs e Frações de Produção Detalhadas', opsColumns, opsData, { visual_qtd: true, qtd_faturar: true });

    // ─────────────────────────────────────────────────────────────────────────
    // ABA 2: DETALHAMENTO DE PEÇAS DA OP (ÁRVORE MULTINÍVEL DE FABRICAÇÃO)
    // ─────────────────────────────────────────────────────────────────────────
    const formatOperations = (compCode) => {
        const ops = masterData.routingSequenceMap?.[compCode] || [];
        if (!ops || ops.length === 0) return '-';
        return ops.map(o => `${o.operac}${o.recurso ? ` (${o.recurso})` : ''}`).join(' ➔ ');
    };

    const treeColumns = [
        { header: 'Pedido', key: 'pedido', align: 'center', minWidth: 12 },
        { header: 'Cliente', key: 'cliente', align: 'left', minWidth: 26 },
        { header: 'OP / Fração', key: 'visual_op', align: 'center', minWidth: 18 },
        { header: 'Identificação Lote', key: 'lote_ident', align: 'left', minWidth: 18 },
        { header: 'Nível', key: 'nivel_label', align: 'center', minWidth: 16 },
        { header: 'Produto Pai (Nível)', key: 'pai', align: 'left', minWidth: 18 },
        { header: 'Cód. Peça / Insumo', key: 'comp', align: 'left', minWidth: 18 },
        { header: 'Descrição da Peça / Material', key: 'desc', align: 'left', minWidth: 38 },
        { header: 'Tipo', key: 'tipo', align: 'center', minWidth: 10 },
        { header: 'UM', key: 'um', align: 'center', minWidth: 8 },
        { header: 'Qtd. Unit. Estrutura', key: 'quant_acumulada', align: 'right', type: 'number', minWidth: 16 },
        { header: 'Qtd. Fabricar no Lote (PCP)', key: 'qtd_lote', align: 'right', type: 'number', minWidth: 20 },
        { header: 'Roteiro de Operações / Recursos', key: 'roteiro_str', align: 'left', minWidth: 32 },
        { header: 'Data PCP (Lote)', key: 'data_pcp', align: 'center', type: 'date', minWidth: 15 },
        { header: 'Ref. Cliente', key: 'ref_cliente', align: 'left', minWidth: 18 },
        { header: 'PC (Ped. Cliente)', key: 'ped_cliente', align: 'center', minWidth: 18 }
    ];

    const treeDataMap = {};
    (masterData.estruturas_hierarquicas || []).forEach(node => {
        const raiz = (node.raiz || '').trim();
        if (!treeDataMap[raiz]) treeDataMap[raiz] = [];
        treeDataMap[raiz].push(node);
    });

    const treeData = [];
    fractionalItems.forEach(item => {
        const prod = (item.codigo || item.produto || '').trim();
        const fracQtd = Number(item.visual_qtd || item.quantidade_pcp || item.qtd_faturar || 0);

        // 1. Nível 0: Produto Acabado Principal
        treeData.push({
            is_fraction: item.is_fraction,
            pedido: item.pedido,
            cliente: item.nome_cliente || item.cliente || '-',
            visual_op: item.visual_op || item.op_num || '-',
            lote_ident: item.is_fraction ? `Fração ${item.fraction_letter || item.numero_lote || ''}` : 'Lote Único',
            nivel_label: '0 - PA (Principal)',
            pai: '-',
            comp: prod,
            desc: item.descricao || '-',
            tipo: 'PA',
            um: item.unidade || item.um || 'UN',
            quant_acumulada: 1.0,
            qtd_lote: fracQtd,
            roteiro_str: formatOperations(prod),
            data_pcp: parseToDate(item.data_entrega_pcp || item.pcp_delivery_forecast_date),
            ref_cliente: item.ref_cliente || '-',
            ped_cliente: item.ped_cliente || item.pedcli || '-'
        });

        // 2. Níveis 1..N: Subconjuntos PI e Matérias-Primas MP
        const subNodes = treeDataMap[prod] || [];
        subNodes.forEach(node => {
            const nivelNum = Number(node.nivel || 1);
            const tipoLabel = node.tipo === 'PI' ? 'PI (Intermediário)' : node.tipo === 'MP' ? 'MP (Insumo)' : node.tipo || 'COMP';
            const nivelLabel = `${nivelNum} - ${tipoLabel}`;
            const qtdAcum = Number(node.quant_acumulada || node.quant_unitaria || 0);
            const qtdTotalLote = Number((qtdAcum * fracQtd).toFixed(4));

            treeData.push({
                is_fraction: item.is_fraction,
                pedido: item.pedido,
                cliente: item.nome_cliente || item.cliente || '-',
                visual_op: item.visual_op || item.op_num || '-',
                lote_ident: item.is_fraction ? `Fração ${item.fraction_letter || item.numero_lote || ''}` : 'Lote Único',
                nivel_label: nivelLabel,
                pai: node.pai || prod,
                comp: node.comp,
                desc: node.desc || '-',
                tipo: node.tipo || '-',
                um: node.um || '-',
                quant_acumulada: qtdAcum,
                qtd_lote: qtdTotalLote,
                roteiro_str: formatOperations(node.comp),
                data_pcp: parseToDate(item.data_entrega_pcp || item.pcp_delivery_forecast_date),
                ref_cliente: item.ref_cliente || '-',
                ped_cliente: item.ped_cliente || item.pedcli || '-'
            });
        });
    });

    addStyledMetalFisaSheet('Detalhamento Peças OP', 'Árvore Multinível de Peças e Fabricação por Fração de OP', treeColumns, treeData, { qtd_lote: true });

    // ─────────────────────────────────────────────────────────────────────────
    // ABA 3: Resumo por Produto Acabado
    // ─────────────────────────────────────────────────────────────────────────
    const prodSummaryMap = new Map();
    fractionalItems.forEach(item => {
        const prod = (item.codigo || item.produto || '').trim();
        if (prod) {
            if (!prodSummaryMap.has(prod)) {
                prodSummaryMap.set(prod, {
                    produto: prod,
                    descricao: item.descricao || '-',
                    um: item.unidade || item.um || 'UN',
                    qtd_total_pcp: 0,
                    qtd_fracoes: 0,
                    pedidos: new Set()
                });
            }
            const pEntry = prodSummaryMap.get(prod);
            pEntry.qtd_total_pcp += Number(item.visual_qtd || item.quantidade_pcp || item.qtd_faturar || 0);
            pEntry.qtd_fracoes += 1;
            if (item.pedido) pEntry.pedidos.add(item.pedido);
        }
    });

    const resumoColumns = [
        { header: 'Cód. Produto', key: 'produto', align: 'left', minWidth: 18 },
        { header: 'Descrição do Produto', key: 'descricao', align: 'left', minWidth: 40 },
        { header: 'UM', key: 'um', align: 'center', minWidth: 8 },
        { header: 'Qtd Total PCP', key: 'qtd_total_pcp', align: 'right', type: 'number', minWidth: 16 },
        { header: 'Total de Frações/Lotes', key: 'qtd_fracoes', align: 'right', type: 'number', minWidth: 18 },
        { header: 'Pedidos Vinculados', key: 'pedidos_str', align: 'left', minWidth: 30 }
    ];

    const resumoData = Array.from(prodSummaryMap.values()).map(r => ({
        produto: r.produto,
        descricao: r.descricao,
        um: r.um,
        qtd_total_pcp: r.qtd_total_pcp,
        qtd_fracoes: r.qtd_fracoes,
        pedidos_str: Array.from(r.pedidos).join(', ')
    }));

    addStyledMetalFisaSheet('Resumo Produtos', 'Resumo Consolidado por Produto Acabado', resumoColumns, resumoData, { qtd_total_pcp: true, qtd_fracoes: true });

    // ─────────────────────────────────────────────────────────────────────────
    // ABA 4: Carga por Recurso (Horas Máquina Proporcionais)
    // ─────────────────────────────────────────────────────────────────────────
    if (masterData.recursos && masterData.recursos.length > 0 && masterData.carga) {
        const tempoUnitarioRecPorProd = {};
        (masterData.carga || []).forEach(c => {
            const p = (c.produto || '').trim();
            const q = Number(c.qtd_faturar || 1);
            if (p && q > 0 && !tempoUnitarioRecPorProd[p]) {
                tempoUnitarioRecPorProd[p] = {};
                masterData.recursos.forEach(r => {
                    const min = Number(c['rec_' + r] || 0);
                    tempoUnitarioRecPorProd[p][r] = min / q;
                });
            }
        });

        const cargaColumns = [
            { header: 'Pedido', key: 'pedido', align: 'center', minWidth: 12 },
            { header: 'Cliente', key: 'cliente', align: 'left', minWidth: 26 },
            { header: 'Item', key: 'item', align: 'center', minWidth: 8 },
            { header: 'OP Fração', key: 'visual_op', align: 'center', minWidth: 18 },
            { header: 'Cód. Produto', key: 'produto', align: 'left', minWidth: 18 },
            { header: 'Descrição', key: 'descricao', align: 'left', minWidth: 32 },
            { header: 'Qtd. Fração (PCP)', key: 'fracQtd', align: 'right', type: 'number', minWidth: 16 },
            { header: 'Data PCP', key: 'data_pcp', align: 'center', type: 'date', minWidth: 15 },
            ...masterData.recursos.map(r => ({
                header: `${masterData.recursoNomeMap?.[r] || r} (h)`,
                key: `rec_${r}`,
                align: 'right',
                type: 'number',
                minWidth: 14
            }))
        ];

        const cargaTotals = { fracQtd: true };
        masterData.recursos.forEach(r => { cargaTotals[`rec_${r}`] = true; });

        const cargaData = fractionalItems.map(item => {
            const prod = (item.codigo || item.produto || '').trim();
            const fracQtd = Number(item.visual_qtd || item.quantidade_pcp || item.qtd_faturar || 0);
            const tUnit = tempoUnitarioRecPorProd[prod] || {};

            const row = {
                is_fraction: item.is_fraction,
                pedido: item.pedido,
                cliente: item.nome_cliente || item.cliente || '-',
                item: item.item,
                visual_op: item.visual_op || item.op_num || '-',
                produto: prod,
                descricao: item.descricao || '-',
                fracQtd: fracQtd,
                data_pcp: parseToDate(item.data_entrega_pcp || item.pcp_delivery_forecast_date)
            };

            masterData.recursos.forEach(r => {
                const minUnit = tUnit[r] || 0;
                const horasFrac = (minUnit * fracQtd) / 60;
                row[`rec_${r}`] = Number(horasFrac.toFixed(2));
            });

            return row;
        });

        addStyledMetalFisaSheet('Carga por Recurso', 'Carga Máquina por Fração de OP', cargaColumns, cargaData, cargaTotals);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ABA 5: Necessidade de Componentes / Materiais (BOM Proporcional)
    // ─────────────────────────────────────────────────────────────────────────
    if (masterData.estruturas && masterData.estruturas.length > 0) {
        const bomMap = {};
        masterData.estruturas.forEach(b => {
            const raiz = (b.raiz || '').trim();
            if (!bomMap[raiz]) bomMap[raiz] = [];
            bomMap[raiz].push(b);
        });

        const matColumns = [
            { header: 'Pedido', key: 'pedido', align: 'center', minWidth: 12 },
            { header: 'Cliente', key: 'cliente', align: 'left', minWidth: 26 },
            { header: 'Item', key: 'item', align: 'center', minWidth: 8 },
            { header: 'OP Fração', key: 'visual_op', align: 'center', minWidth: 18 },
            { header: 'Identificação Lote', key: 'lote_ident', align: 'left', minWidth: 18 },
            { header: 'Produto Pai', key: 'produto', align: 'left', minWidth: 18 },
            { header: 'Qtd. Fração (PCP)', key: 'fracQtd', align: 'right', type: 'number', minWidth: 16 },
            { header: 'Data PCP', key: 'data_pcp', align: 'center', type: 'date', minWidth: 15 },
            { header: 'Cód. Componente / MP', key: 'comp', align: 'left', minWidth: 18 },
            { header: 'Descrição Componente', key: 'desc', align: 'left', minWidth: 35 },
            { header: 'UM', key: 'um', align: 'center', minWidth: 8 },
            { header: 'Tipo', key: 'tipo', align: 'center', minWidth: 8 },
            { header: 'Qtd Unit. (BOM)', key: 'qtdUnit', align: 'right', type: 'number', minWidth: 14 },
            { header: 'Qtd Necessária Fração', key: 'qtdTotalFrac', align: 'right', type: 'number', minWidth: 18 }
        ];

        const matData = [];
        fractionalItems.forEach(item => {
            const prod = (item.codigo || item.produto || '').trim();
            const fracQtd = Number(item.visual_qtd || item.quantidade_pcp || item.qtd_faturar || 0);
            const comps = bomMap[prod] || [];

            comps.forEach(c => {
                const qtdUnit = Number(c.quant || 0);
                matData.push({
                    is_fraction: item.is_fraction,
                    pedido: item.pedido,
                    cliente: item.nome_cliente || item.cliente || '-',
                    item: item.item,
                    visual_op: item.visual_op || item.op_num || '-',
                    lote_ident: item.is_fraction ? `Fração ${item.fraction_letter || item.numero_lote || ''}` : 'Lote Único',
                    produto: prod,
                    fracQtd: fracQtd,
                    data_pcp: parseToDate(item.data_entrega_pcp || item.pcp_delivery_forecast_date),
                    comp: c.comp,
                    desc: c.desc || '-',
                    um: c.um || '-',
                    tipo: c.tipo || '-',
                    qtdUnit: qtdUnit,
                    qtdTotalFrac: Number((qtdUnit * fracQtd).toFixed(4))
                });
            });
        });

        if (matData.length > 0) {
            addStyledMetalFisaSheet('Necessidade BOM', 'Necessidade de Materiais por Fração de OP', matColumns, matData, { qtdTotalFrac: true });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Exportação do Buffer via Navegador
    // ─────────────────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Planilha_Mestra_OPs_Fracionadas_${getTodayDateStr()}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
};

const getTodayDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
