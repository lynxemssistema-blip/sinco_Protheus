import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { logoBase64 } from './metalfisaLogoBase64';
import { getCompanyShortName } from './companyBranding';

const NAVY = [15, 23, 42];      // #0f172a
const BLUE = [30, 58, 95];      // #1e3a5f
const GREEN = [16, 185, 129];   // #10b981
const EMERALD_DARK = [6, 95, 70];
const ML = 10;
const MR = 10;

/**
 * Cabeçalho Padrão Lynx para PDF
 */
const drawHeader = (doc, pageWidth, meta, user) => {
    const hY = 6;
    const usableW = pageWidth - ML - MR;
    const hH = 22;

    const col1 = ML + 45;   // logo | dados produto
    const col2 = pageWidth - MR - 50;  // info data/usuario

    // Borda externa
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.4);
    doc.rect(ML, hY, usableW, hH);

    // Divisórias verticais
    doc.setLineWidth(0.2);
    doc.line(col1, hY, col1, hY + hH);
    doc.line(col2, hY, col2, hY + hH);

    // ── Logo ──
    try {
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', ML + 2, hY + 2, 40, 18);
        } else {
            throw new Error('no logo');
        }
    } catch {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...BLUE);
        doc.text(getCompanyShortName(), ML + 5, hY + 13);
    }

    // ── Título central & Dados do Produto ──
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ESTOQUE DA ESTRUTURA DO PRODUTO (BOM)', (col1 + col2) / 2, hY + 6, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BLUE);
    doc.text(`PRODUTO: ${meta.productCode || '—'} - ${meta.productDesc || ''}`.substring(0, 75), (col1 + col2) / 2, hY + 12, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    let subInfo = [];
    if (meta.orderNum) subInfo.push(`Pedido: ${meta.orderNum}${meta.orderItem ? ` (It. ${meta.orderItem})` : ''}`);
    if (meta.orderQty) subInfo.push(`Demanda: ${meta.orderQty} un`);
    if (meta.clientName) subInfo.push(`Cliente: ${meta.clientName}`);
    doc.text(subInfo.join('  |  ') || 'Estrutura Completa', (col1 + col2) / 2, hY + 18, { align: 'center' });

    // ── Info direita ──
    const now = new Date();
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(`Emissão: ${now.toLocaleDateString('pt-BR')}`, col2 + 3, hY + 7);
    doc.text(`Hora: ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, col2 + 3, hY + 12);
    doc.text(`Usuário: ${(user?.nome || user?.login || 'Sistema').substring(0, 18)}`, col2 + 3, hY + 17);

    return hY + hH + 4;
};

/**
 * Rodapé Padrão Lynx
 */
const drawFooters = (doc, pageWidth) => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(130, 130, 130);
        doc.text(`Gerado via Lynx App — SINCO PCP / Controle de Estoque`, ML, pageH - 4);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - MR, pageH - 4, { align: 'right' });
    }
};

/**
 * Exportar Relatório em PDF no Padrão Lynx
 * @param {Array} items Lista de itens da estrutura
 * @param {Object} meta Metadados (código, descrição, pedido, etc.)
 * @param {Object} user Usuário logado
 * @param {boolean} returnBytes Se true, retorna o ArrayBuffer para merge sem disparar o download
 */
export const exportProductStructureStockPDF = (items, meta = {}, user = null, returnBytes = false) => {
    if (!items || items.length === 0) return null;

    // Orientação paisagem (landscape) para caber com elegância todas as colunas
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Cabeçalho
    let startY = drawHeader(doc, pageWidth, meta, user);

    // 2. Quadro Resumo de KPIs no PDF
    const totalItens = items.length;
    const comFabrica = items.filter(i => i.saldo_fabrica > 0).length;
    const comProtheus = items.filter(i => i.saldo_protheus > 0).length;
    const semEstoque = items.filter(i => !i.tem_estoque).length;

    const usableW = pageWidth - ML - MR;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(ML, startY, usableW, 10, 1.5, 1.5, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(`TOTAL COMPONENTES: ${totalItens}`, ML + 8, startY + 6.5);

    doc.setTextColor(6, 95, 70);
    doc.text(`SALDO EM FÁBRICA: ${comFabrica} item(ns)`, ML + 75, startY + 6.5);

    doc.setTextColor(30, 58, 138);
    doc.text(`SALDO PROTHEUS ERP: ${comProtheus} item(ns)`, ML + 150, startY + 6.5);

    doc.setTextColor(100, 116, 139);
    doc.text(`SEM ESTOQUE: ${semEstoque} item(ns)`, ML + 225, startY + 6.5);

    startY += 13;

    // 3. Montagem das linhas da tabela
    const hasOrderQty = !!meta.orderQty;
    const orderQtyNum = parseFloat(meta.orderQty) || 1;

    const tableBody = items.map(item => {
        const totalReq = hasOrderQty ? (orderQtyNum * item.qtd_unitaria).toLocaleString('pt-BR', { maximumFractionDigits: 4 }) : '-';
        const saldoFabStr = item.saldo_fabrica > 0 ? `${item.saldo_fabrica.toLocaleString('pt-BR')} ${item.unidade}` : `0 ${item.unidade}`;
        const saldoProtStr = item.saldo_protheus !== 0 ? `${Number(item.saldo_protheus.toFixed(2)).toLocaleString('pt-BR')} ${item.unidade}` : `0 ${item.unidade}`;

        let statusText = 'Pendente';
        if (item.saldo_fabrica > 0) statusText = 'Pronto em Fábrica';
        else if (item.saldo_protheus > 0) statusText = 'Disponível ERP';

        const indent = '  '.repeat(item.nivel || 0);

        return [
            item.nivel === 0 ? '0 (Pai)' : `${item.nivel}`,
            `${indent}${item.codigo}`,
            item.descricao || '',
            item.tipo || 'PI',
            item.unidade || 'UN',
            item.qtd_unitaria.toLocaleString('pt-BR', { maximumFractionDigits: 4 }),
            ...(hasOrderQty ? [totalReq] : []),
            saldoFabStr,
            saldoProtStr,
            statusText
        ];
    });

    const headColumns = [
        'Nív.',
        'Código Componente',
        'Descrição',
        'Tipo',
        'UM',
        'Qtd Unit.',
        ...(hasOrderQty ? ['Nec. Pedido'] : []),
        'Saldo Fábrica',
        'Saldo Protheus',
        'Status Estoque'
    ];

    autoTable(doc, {
        startY: startY,
        head: [headColumns],
        body: tableBody,
        theme: 'grid',
        margin: { left: ML, right: MR, bottom: 10 },
        styles: {
            fontSize: 7.5,
            cellPadding: 1.8,
            textColor: [30, 41, 59],
            valign: 'middle',
            lineWidth: 0.1,
            lineColor: [226, 232, 240]
        },
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [248, 250, 252],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 15 },
            1: { halign: 'left', fontStyle: 'bold', cellWidth: 42 },
            2: { halign: 'left' },
            3: { halign: 'center', cellWidth: 14 },
            4: { halign: 'center', cellWidth: 14 },
            5: { halign: 'right', cellWidth: 20 },
            ...(hasOrderQty ? { 6: { halign: 'right', cellWidth: 24, fontStyle: 'bold' } } : {}),
            [hasOrderQty ? 7 : 6]: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
            [hasOrderQty ? 8 : 7]: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
            [hasOrderQty ? 9 : 8]: { halign: 'center', cellWidth: 32 }
        },
        didParseCell: function (data) {
            if (data.section === 'body') {
                const item = items[data.row.index];
                if (!item) return;

                // Linha do produto pai em destaque suave
                if (item.nivel === 0) {
                    data.cell.styles.fillColor = [238, 242, 255];
                    data.cell.styles.fontStyle = 'bold';
                }

                // Coluna Saldo Fábrica
                const colIdxFab = hasOrderQty ? 7 : 6;
                if (data.column.index === colIdxFab && item.saldo_fabrica > 0) {
                    data.cell.styles.textColor = [6, 95, 70];
                    data.cell.styles.fillColor = [209, 250, 229];
                }

                // Coluna Saldo Protheus
                const colIdxProt = hasOrderQty ? 8 : 7;
                if (data.column.index === colIdxProt && item.saldo_protheus > 0) {
                    data.cell.styles.textColor = [30, 58, 138];
                    data.cell.styles.fillColor = [219, 234, 254];
                }

                // Coluna Status
                const colIdxStatus = hasOrderQty ? 9 : 8;
                if (data.column.index === colIdxStatus) {
                    if (item.saldo_fabrica > 0) {
                        data.cell.styles.textColor = [6, 95, 70];
                        data.cell.styles.fontStyle = 'bold';
                    } else if (item.saldo_protheus > 0) {
                        data.cell.styles.textColor = [30, 58, 138];
                        data.cell.styles.fontStyle = 'bold';
                    } else {
                        data.cell.styles.textColor = [100, 116, 139];
                    }
                }
            }
        },
        didDrawPage: function (data) {
            // Se passar para nova página, redesenhar cabeçalho
            if (data.pageNumber > 1) {
                drawHeader(doc, pageWidth, meta, user);
            }
        }
    });

    // 4. Rodapé
    drawFooters(doc, pageWidth);

    if (returnBytes) {
        return doc.output('arraybuffer');
    }

    // Salvar/Baixar PDF
    const filename = `Estoque_Estrutura_${(meta.productCode || 'PRODUTO').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
};

/**
 * Exportar Relatório em Excel (XLSX) no Padrão Lynx
 */
export const exportProductStructureStockExcel = (items, meta = {}, user = null) => {
    if (!items || items.length === 0) return;

    const hasOrderQty = !!meta.orderQty;
    const orderQtyNum = parseFloat(meta.orderQty) || 1;

    // 1. Dados formatados para planilha
    const rows = items.map(item => {
        const totalReq = hasOrderQty ? Number((orderQtyNum * item.qtd_unitaria).toFixed(4)) : '';
        let statusText = 'Pendente';
        if (item.saldo_fabrica > 0) statusText = 'Pronto em Fábrica';
        else if (item.saldo_protheus > 0) statusText = 'Disponível ERP';

        const rowObj = {
            'Nível': item.nivel,
            'Código Componente': item.codigo,
            'Descrição': item.descricao || '',
            'Tipo': item.tipo || 'PI',
            'UM': item.unidade || 'UN',
            'Qtd Unitária': item.qtd_unitaria,
        };

        if (hasOrderQty) {
            rowObj['Necessidade Pedido'] = totalReq;
        }

        rowObj['Saldo em Fábrica'] = item.saldo_fabrica;
        rowObj['Saldo Protheus ERP'] = item.saldo_protheus;
        rowObj['Status Disponibilidade'] = statusText;

        return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Ajuste de largura das colunas
    const colWidths = [
        { wch: 8 },   // Nível
        { wch: 22 },  // Código
        { wch: 45 },  // Descrição
        { wch: 8 },   // Tipo
        { wch: 8 },   // UM
        { wch: 14 },  // Qtd Unitária
        ...(hasOrderQty ? [{ wch: 18 }] : []),
        { wch: 18 },  // Saldo Fábrica
        { wch: 20 },  // Saldo Protheus
        { wch: 22 }   // Status
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estoque da Estrutura');

    const filename = `Estoque_Estrutura_${(meta.productCode || 'PRODUTO').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
};
