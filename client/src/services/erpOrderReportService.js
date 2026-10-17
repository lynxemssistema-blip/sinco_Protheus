import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import ExcelJS from 'exceljs';
import api from './api';
import { downloadBlob } from '../utils/downloadHelper';
import {
    getCompanyLegalName,
    getCompanyCnpjIeLine,
    getCompanyAddressLine,
    getCompanyContactLine,
    getCompanyLogoBase64
} from './companyBranding';

// ── Helpers de Formatação ───────────────────────────────────────────────────
const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumber = (val, decimals = 2) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const formatDateBR = (val) => {
    if (!val) return '-';
    const s = String(val).split('T')[0];
    const parts = s.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return s;
};

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

// ── Injetor de Cabeçalho Institucional Padrão (jsPDF) ────────────────────────
const drawPdfHeader = (doc, title = 'PEDIDO DE VENDA', subtitle = '') => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36; // 0.5 in

    // Logo da Empresa Ativa
    try {
        const logoBase64 = getCompanyLogoBase64();
        if (logoBase64 && logoBase64.startsWith('data:image')) {
            const format = logoBase64.includes('image/png') ? 'PNG' : 'JPEG';
            doc.addImage(logoBase64, format, margin, 24, 60, 32, undefined, 'FAST');
        }
    } catch (e) {
        console.warn('[PDF] Erro ao desenhar logo:', e);
    }

    // Dados Institucionais da Empresa
    const textX = margin + 68;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95); // #1E3A5F
    doc.text(getCompanyLegalName(), textX, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // #475569
    const cnpjLine = getCompanyCnpjIeLine();
    if (cnpjLine) doc.text(cnpjLine, textX, 42);

    const addrLine = getCompanyAddressLine();
    if (addrLine) doc.text(addrLine, textX, 51);

    const contactLine = getCompanyContactLine();
    if (contactLine) doc.text(contactLine, textX, 60);

    // Linha divisória corporativa
    doc.setDrawColor(203, 213, 225); // #CBD5E1
    doc.setLineWidth(0.8);
    doc.line(margin, 68, pageWidth - margin, 68);

    // Título do Relatório
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // #0F172A
    doc.text(title, margin, 84);

    if (subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(subtitle, margin, 94);
    }

    // Carimbo de Emissão
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    const dateStr = `Emissão: ${new Date().toLocaleString('pt-BR')}`;
    doc.text(dateStr, pageWidth - margin - doc.getTextWidth(dateStr), 84);

    return subtitle ? 104 : 96;
};

// ── Injetor de Rodapé com Numeração de Páginas (jsPDF) ────────────────────────
const drawPdfFooter = (doc) => {
    const pageCount = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 26, pageWidth - margin, pageHeight - 26);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`${getCompanyLegalName()} — Sistema SINCO ERP`, margin, pageHeight - 15);

        const pageStr = `Página ${i} de ${pageCount}`;
        doc.text(pageStr, pageWidth - margin - doc.getTextWidth(pageStr), pageHeight - 15);
    }
};

// ============================================================================
// 1. RELATÓRIO INDIVIDUAL DE PEDIDO DE VENDA (PDF)
// ============================================================================
export const generateSingleOrderPdf = async (pedido, itens = [], options = {}) => {
    const { tipo = 'detalhado', includeAttachments = false, anexos = [] } = options;
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36;

    const title = `PEDIDO DE VENDA: ${pedido.numero_pedido || ''}`;
    const subtitle = `Status: ${(pedido.status || 'ORÇAMENTO').toUpperCase()} | Pedido do Cliente: ${pedido.pedido_cliente || 'N/A'}`;
    let currentY = drawPdfHeader(doc, title, subtitle);

    // Bloco de Dados do Cliente e Condições
    const clienteData = [
        [
            { content: 'DADOS DO CLIENTE', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 58, 95] } },
            { content: 'CONDIÇÕES COMERCIAIS', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 58, 95] } }
        ],
        [
            { content: `Razão Social: ${pedido.cliente_nome || '-'}`, styles: { fontStyle: 'bold' } },
            `Código: ${pedido.cliente_codigo || '-'}`,
            `Condição de Pagto: ${pedido.condicao_pagamento || '-'}`,
            `Tipo de Frete: ${pedido.tipo_frete || 'FOB'}`
        ],
        [
            `CNPJ/CPF: ${pedido.cnpj_cpf || '-'}`,
            `Cidade/UF: ${[pedido.cidade, pedido.uf].filter(Boolean).join('/') || '-'}`,
            `Transportadora: ${pedido.transportadora || 'A DEFINIR'}`,
            `Data de Emissão: ${formatDateBR(pedido.data_emissao)}`
        ]
    ];

    if (pedido.pasta_servidor) {
        clienteData.push([
            { content: `Pasta no Servidor: ${pedido.pasta_servidor}`, colSpan: 4, styles: { textColor: [37, 99, 235], fontStyle: 'italic' } }
        ]);
    }

    autoTable(doc, {
        startY: currentY,
        body: clienteData,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 3, textColor: [51, 65, 85] },
        margin: { left: margin, right: margin }
    });

    currentY = doc.lastAutoTable.finalY + 12;

    // Tabela de Itens (se detalhado)
    if (tipo === 'detalhado' && itens.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 58, 95);
        doc.text(`ITENS DO PEDIDO (${itens.length})`, margin, currentY);
        currentY += 6;

        const tableHead = [['#', 'Código', 'Descrição do Produto', 'Qtd', 'UM', 'Preço Un.', 'Subtotal', 'Entrega', 'OP']];
        const tableBody = itens.map((item, idx) => {
            const seq = item.item_seq || String(idx + 1).padStart(2, '0');
            const subtotal = item.subtotal || (parseFloat(item.quantidade) * parseFloat(item.preco_unitario));
            return [
                seq,
                item.produto_codigo || '-',
                item.produto_descricao || item.descricao || '-',
                formatNumber(item.quantidade, 2),
                item.unidade_medida || 'UN',
                formatCurrency(item.preco_unitario),
                formatCurrency(subtotal),
                formatDateBR(item.data_entrega_prevista),
                item.numero_op_efetiva || item.numero_op_gerada || '-'
            ];
        });

        autoTable(doc, {
            startY: currentY,
            head: tableHead,
            body: tableBody,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 58, 95], // #1E3A5F
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { halign: 'center', cellWidth: 20 },
                1: { fontStyle: 'bold', cellWidth: 70 },
                2: { cellWidth: 160 },
                3: { halign: 'right', cellWidth: 40 },
                4: { halign: 'center', cellWidth: 24 },
                5: { halign: 'right', cellWidth: 55 },
                6: { halign: 'right', fontStyle: 'bold', cellWidth: 60 },
                7: { halign: 'center', cellWidth: 50 },
                8: { halign: 'center', cellWidth: 45 }
            },
            margin: { left: margin, right: margin }
        });

        currentY = doc.lastAutoTable.finalY + 12;
    }

    // Totais e Observações
    const totalItensQtd = itens.reduce((acc, it) => acc + (parseFloat(it.quantidade) || 0), 0);
    const totalValor = parseFloat(pedido.valor_total) || itens.reduce((acc, it) => acc + ((parseFloat(it.quantidade) || 0) * (parseFloat(it.preco_unitario) || 0)), 0);

    const totaisData = [
        [
            { content: `Total de Itens: ${itens.length} linha(s) | Qtd Total de Peças: ${formatNumber(totalItensQtd, 0)}`, styles: { fontStyle: 'bold' } },
            { content: `VALOR TOTAL DO PEDIDO: ${formatCurrency(totalValor)}`, styles: { fontStyle: 'bold', halign: 'right', textColor: [30, 58, 95], fontSize: 10 } }
        ]
    ];

    autoTable(doc, {
        startY: currentY,
        body: totaisData,
        theme: 'plain',
        styles: { fillColor: [241, 245, 249], cellPadding: 6, textColor: [30, 41, 59] },
        margin: { left: margin, right: margin }
    });

    currentY = doc.lastAutoTable.finalY + 10;

    if (pedido.observacoes) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text('OBSERVAÇÕES:', margin, currentY);
        currentY += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);
        const splitObs = doc.splitTextToSize(pedido.observacoes, pageWidth - (margin * 2));
        doc.text(splitObs, margin, currentY);
    }

    // Finaliza páginas básicas do relatório
    drawPdfFooter(doc);

    // Se NÃO for Caderno Completo ou não tiver anexos, baixa diretamente o PDF do pedido
    if (!includeAttachments || !anexos || anexos.length === 0) {
        const pdfBlob = doc.output('blob');
        const filename = `Pedido_Venda_${pedido.numero_pedido || '000000'}.pdf`;
        downloadBlob(pdfBlob, filename, 'application/pdf');
        return;
    }

    // ========================================================================
    // CADERNO COMPLETO COM ANEXOS MESCLADOS (pdf-lib)
    // ========================================================================
    try {
        const basePdfBytes = doc.output('arraybuffer');
        const mergedPdf = await PDFDocument.load(basePdfBytes);

        // Página de Índice de Anexos
        const anexosDoc = new jsPDF('p', 'pt', 'a4');
        let anexoY = drawPdfHeader(anexosDoc, `CADERNO DE ANEXOS — PEDIDO ${pedido.numero_pedido}`, 'Documentos técnicos e arquivos complementares anexados');

        const anexosTableHead = [['#', 'Nome do Arquivo', 'Tamanho', 'Tipo / Formato', 'Status no Caderno']];
        const anexosTableBody = anexos.map((anx, i) => {
            const kb = (anx.tamanho ? (anx.tamanho / 1024).toFixed(1) + ' KB' : '-');
            const mime = anx.mime || '';
            const isPdf = mime.includes('pdf') || (anx.nome_original || '').toLowerCase().endsWith('.pdf');
            const isImg = mime.includes('image') || /\.(png|jpe?g)$/i.test(anx.nome_original || '');
            const statusCaderno = (isPdf || isImg) ? 'Páginas Anexadas a Seguir' : 'Arquivo Técnico (Acesse na Pasta)';
            return [String(i + 1), anx.nome_original || '-', kb, mime || 'Arquivo', statusCaderno];
        });

        autoTable(anexosDoc, {
            startY: anexoY,
            head: anexosTableHead,
            body: anexosTableBody,
            theme: 'striped',
            headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 7.5 },
            margin: { left: margin, right: margin }
        });

        drawPdfFooter(anexosDoc);
        const indexPdfBytes = anexosDoc.output('arraybuffer');
        const indexPdf = await PDFDocument.load(indexPdfBytes);
        const indexPages = await mergedPdf.copyPages(indexPdf, indexPdf.getPageIndices());
        indexPages.forEach(p => mergedPdf.addPage(p));

        // Mesclar anexos reais
        for (const anexo of anexos) {
            try {
                const res = await api.get(`/erp/pedidos-anexos/${anexo.id}/download?inline=1`, { responseType: 'arraybuffer' });
                const arrayBuf = res.data;
                const nome = (anexo.nome_original || '').toLowerCase();

                if (nome.endsWith('.pdf')) {
                    const loadedPdf = await PDFDocument.load(arrayBuf, { ignoreEncryption: true });
                    const copiedPages = await mergedPdf.copyPages(loadedPdf, loadedPdf.getPageIndices());
                    copiedPages.forEach(p => mergedPdf.addPage(p));
                } else if (nome.endsWith('.jpg') || nome.endsWith('.jpeg')) {
                    const image = await mergedPdf.embedJpg(arrayBuf);
                    const page = mergedPdf.addPage([595.28, 841.89]); // A4 em pt
                    const { width, height } = image.scaleToFit(515, 760);
                    page.drawImage(image, {
                        x: (595.28 - width) / 2,
                        y: (841.89 - height) / 2,
                        width,
                        height
                    });
                } else if (nome.endsWith('.png')) {
                    const image = await mergedPdf.embedPng(arrayBuf);
                    const page = mergedPdf.addPage([595.28, 841.89]);
                    const { width, height } = image.scaleToFit(515, 760);
                    page.drawImage(image, {
                        x: (595.28 - width) / 2,
                        y: (841.89 - height) / 2,
                        width,
                        height
                    });
                }
            } catch (errAnexo) {
                console.warn(`[CadernoPDF] Não foi possível embutir anexo ${anexo.nome_original}:`, errAnexo.message);
            }
        }

        const mergedBytes = await mergedPdf.save();
        const mergedBlob = new Blob([mergedBytes], { type: 'application/pdf' });
        const finalFilename = `Caderno_Pedido_Venda_${pedido.numero_pedido || '000000'}.pdf`;
        downloadBlob(mergedBlob, finalFilename, 'application/pdf');
    } catch (errCaderno) {
        console.error('[CadernoPDF] Falha ao mesclar anexos, baixando PDF básico:', errCaderno);
        const pdfBlob = doc.output('blob');
        downloadBlob(pdfBlob, `Pedido_Venda_${pedido.numero_pedido || '000000'}.pdf`, 'application/pdf');
    }
};

// ============================================================================
// 2. RELATÓRIO INDIVIDUAL DE PEDIDO DE VENDA (EXCEL .XLSX)
// ============================================================================
export const generateSingleOrderExcel = async (pedido, itens = [], options = {}) => {
    const wb = new ExcelJS.Workbook();
    wb.creator = `${getCompanyLegalName()} - SINCO ERP`;
    wb.created = new Date();

    const ws = wb.addWorksheet(`Pedido ${pedido.numero_pedido}`, {
        views: [{ state: 'frozen', ySplit: 7, showGridLines: true }]
    });

    const NAVY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const SLATE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    const ZEBRA_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

    const THIN_BORDER = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // Colunas da Planilha
    const columns = [
        { header: 'Seq', key: 'seq', width: 8, align: 'center' },
        { header: 'Código do Produto', key: 'codigo', width: 22, align: 'left', fontBold: true },
        { header: 'Descrição do Produto', key: 'descricao', width: 44, align: 'left' },
        { header: 'Qtd', key: 'quantidade', width: 14, align: 'right', numFmt: '#,##0.00' },
        { header: 'UM', key: 'unidade', width: 8, align: 'center' },
        { header: 'Preço Un. (R$)', key: 'preco_unitario', width: 18, align: 'right', numFmt: 'R$ #,##0.00' },
        { header: 'Subtotal (R$)', key: 'subtotal', width: 20, align: 'right', numFmt: 'R$ #,##0.00', isSum: true },
        { header: 'Entrega Prev.', key: 'entrega', width: 16, align: 'center' },
        { header: 'Nº OP', key: 'op', width: 14, align: 'center' },
        { header: 'Observação da Linha', key: 'observacao', width: 36, align: 'left' }
    ];

    ws.columns = columns.map(c => ({ key: c.key, width: c.width }));

    // Linha 1: Marca da Empresa
    ws.mergeCells('A1:J1');
    const r1 = ws.getCell('A1');
    r1.value = `${getCompanyLegalName()} — SISTEMA SINCO ERP`;
    r1.fill = NAVY_FILL;
    r1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    r1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 28;

    // Linha 2: Título do Documento
    ws.mergeCells('A2:J2');
    const r2 = ws.getCell('A2');
    r2.value = `PEDIDO DE VENDA Nº ${pedido.numero_pedido || ''}  |  STATUS: ${(pedido.status || 'ORÇAMENTO').toUpperCase()}  |  PO CLIENTE: ${pedido.pedido_cliente || 'N/A'}`;
    r2.fill = SLATE_FILL;
    r2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    r2.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(2).height = 22;

    // Linha 3 e 4: Dados do Cliente e Comercial
    ws.mergeCells('A3:E3');
    ws.getCell('A3').value = `Cliente: ${pedido.cliente_nome || '-'} (${pedido.cliente_codigo || '-'})  -  CNPJ: ${pedido.cnpj_cpf || '-'}`;
    ws.getCell('A3').font = { name: 'Arial', size: 9, bold: true };

    ws.mergeCells('F3:J3');
    ws.getCell('F3').value = `Emissão: ${formatDateBR(pedido.data_emissao)}  |  Cond. Pagto: ${pedido.condicao_pagamento || '-'}  |  Frete: ${pedido.tipo_frete || 'FOB'}`;
    ws.getCell('F3').font = { name: 'Arial', size: 9 };

    ws.mergeCells('A4:J4');
    const pastaTxt = pedido.pasta_servidor ? `  |  Pasta Servidor: ${pedido.pasta_servidor}` : '';
    ws.getCell('A4').value = `Transportadora: ${pedido.transportadora || 'A DEFINIR'}${pastaTxt}  |  Exportado em: ${new Date().toLocaleString('pt-BR')}`;
    ws.getCell('A4').font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };

    // Linha 5: Linha vazia de separação
    ws.getRow(5).height = 8;

    // Linha 6: Cabeçalho das Colunas
    const headerRow = ws.getRow(6);
    headerRow.height = 24;
    columns.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header;
        cell.fill = NAVY_FILL;
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: col.align === 'right' ? 'right' : (col.align === 'center' ? 'center' : 'left') };
        cell.border = THIN_BORDER;
    });

    // Inserção dos Itens
    let currentRowIdx = 7;
    itens.forEach((item, idx) => {
        const row = ws.getRow(currentRowIdx);
        row.height = 20;
        const subtotal = item.subtotal || (parseFloat(item.quantidade) * parseFloat(item.preco_unitario));

        row.getCell(1).value = item.item_seq || String(idx + 1).padStart(2, '0');
        row.getCell(2).value = item.produto_codigo || '-';
        row.getCell(3).value = item.produto_descricao || item.descricao || '-';
        row.getCell(4).value = parseFloat(item.quantidade) || 0;
        row.getCell(5).value = item.unidade_medida || 'UN';
        row.getCell(6).value = parseFloat(item.preco_unitario) || 0;
        row.getCell(7).value = subtotal;
        row.getCell(8).value = formatDateBR(item.data_entrega_prevista);
        row.getCell(9).value = item.numero_op_efetiva || item.numero_op_gerada || '-';
        row.getCell(10).value = item.observacao || '';

        columns.forEach((col, cIdx) => {
            const cell = row.getCell(cIdx + 1);
            cell.alignment = { vertical: 'middle', horizontal: col.align || 'left' };
            cell.font = { name: 'Arial', size: 8.5, bold: !!col.fontBold };
            cell.border = THIN_BORDER;
            if (col.numFmt) cell.numFmt = col.numFmt;
            if (idx % 2 === 1) cell.fill = ZEBRA_FILL;
        });

        currentRowIdx++;
    });

    // Linha de Totais
    const totalRow = ws.getRow(currentRowIdx);
    totalRow.height = 24;
    totalRow.getCell(1).value = 'TOTAL';
    totalRow.getCell(1).font = { name: 'Arial', size: 9, bold: true };
    totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    totalRow.getCell(4).value = { formula: `SUM(D7:D${currentRowIdx - 1})` };
    totalRow.getCell(4).numFmt = '#,##0.00';
    totalRow.getCell(4).font = { name: 'Arial', size: 9, bold: true };

    totalRow.getCell(7).value = { formula: `SUM(G7:G${currentRowIdx - 1})` };
    totalRow.getCell(7).numFmt = 'R$ #,##0.00';
    totalRow.getCell(7).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E3A5F' } };

    for (let c = 1; c <= 10; c++) {
        const cell = totalRow.getCell(c);
        cell.fill = TOTAL_FILL;
        cell.border = THIN_BORDER;
    }

    // Auto-filtro na grade de dados
    ws.autoFilter = `A6:J${currentRowIdx}`;

    // Download do Excel
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, `Pedido_Venda_${pedido.numero_pedido || '000000'}.xlsx`);
};

// ============================================================================
// 3. RELATÓRIO GERAL DE PEDIDOS DE VENDA (PDF)
// ============================================================================
export const generateAllOrdersPdf = async (pedidos = [], options = {}) => {
    const { tipo = 'resumido' } = options;
    const doc = new jsPDF('l', 'pt', 'a4'); // Paisagem para caber mais colunas
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36;

    const title = 'RELATÓRIO GERAL DE PEDIDOS DE VENDA';
    const subtitle = `Total de Pedidos Listados: ${pedidos.length}  |  Modo: ${tipo.toUpperCase()}`;
    const startY = drawPdfHeader(doc, title, subtitle);

    const tableHead = [['Nº Pedido', 'PO Cliente', 'Emissão', 'Código', 'Cliente / Razão Social', 'CNPJ', 'Itens', 'Cond. Pagto', 'Frete', 'Status', 'Valor Total']];
    let totalSoma = 0;

    const tableBody = pedidos.map(p => {
        const v = parseFloat(p.valor_total) || 0;
        totalSoma += v;
        return [
            p.numero_pedido || '-',
            p.pedido_cliente || '-',
            formatDateBR(p.data_emissao),
            p.cliente_codigo || '-',
            p.cliente_nome || p.cliente_fantasia || '-',
            p.cnpj_cpf || '-',
            String(p.total_itens || 0),
            p.condicao_pagamento || '-',
            p.tipo_frete || 'FOB',
            (p.status || 'orcamento').toUpperCase(),
            formatCurrency(v)
        ];
    });

    // Linha de Totalização Global
    tableBody.push([
        { content: 'TOTAL GERAL', colSpan: 6, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
        { content: `${pedidos.length} pedidos`, styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 245, 249] } },
        { content: '', colSpan: 3, styles: { fillColor: [241, 245, 249] } },
        { content: formatCurrency(totalSoma), styles: { fontStyle: 'bold', halign: 'right', textColor: [30, 58, 95], fillColor: [241, 245, 249] } }
    ]);

    autoTable(doc, {
        startY,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        headStyles: {
            fillColor: [30, 58, 95],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 55 },
            1: { halign: 'center', cellWidth: 60 },
            2: { halign: 'center', cellWidth: 55 },
            3: { halign: 'center', cellWidth: 45 },
            4: { cellWidth: 170 },
            5: { halign: 'center', cellWidth: 80 },
            6: { halign: 'center', cellWidth: 35 },
            7: { cellWidth: 70 },
            8: { halign: 'center', cellWidth: 40 },
            9: { halign: 'center', cellWidth: 55 },
            10: { halign: 'right', fontStyle: 'bold', cellWidth: 75 }
        },
        margin: { left: margin, right: margin }
    });

    drawPdfFooter(doc);

    const pdfBlob = doc.output('blob');
    downloadBlob(pdfBlob, `Relatorio_Pedidos_Venda_${tipo}.pdf`, 'application/pdf');
};

// ============================================================================
// 4. RELATÓRIO GERAL DE TODOS OS PEDIDOS (EXCEL .XLSX — FLAT OU RESUMIDO)
// ============================================================================
export const generateAllOrdersExcel = async (pedidos = [], options = {}, itens = []) => {
    const { tipo = 'detalhado' } = options;
    const wb = new ExcelJS.Workbook();
    wb.creator = `${getCompanyLegalName()} - SINCO ERP`;
    wb.created = new Date();

    const NAVY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const SLATE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    const ZEBRA_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

    const THIN_BORDER = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    if (tipo === 'resumido') {
        // ABA RESUMIDA (1 Linha por Pedido)
        const ws = wb.addWorksheet('Pedidos de Venda', {
            views: [{ state: 'frozen', ySplit: 4, showGridLines: true }]
        });

        const columns = [
            { header: 'Nº Pedido', key: 'numero_pedido', width: 14, align: 'center', fontBold: true },
            { header: 'PO Cliente', key: 'pedido_cliente', width: 16, align: 'center' },
            { header: 'Emissão', key: 'data_emissao', width: 14, align: 'center' },
            { header: 'Cód. Cliente', key: 'cliente_codigo', width: 14, align: 'center' },
            { header: 'Razão Social do Cliente', key: 'cliente_nome', width: 38, align: 'left' },
            { header: 'CNPJ/CPF', key: 'cnpj_cpf', width: 20, align: 'center' },
            { header: 'Qtd Itens', key: 'total_itens', width: 12, align: 'center', numFmt: '#,##0' },
            { header: 'Cond. Pagto', key: 'condicao_pagamento', width: 20, align: 'left' },
            { header: 'Frete', key: 'tipo_frete', width: 10, align: 'center' },
            { header: 'Transportadora', key: 'transportadora', width: 24, align: 'left' },
            { header: 'Status', key: 'status', width: 14, align: 'center' },
            { header: 'Valor Total (R$)', key: 'valor_total', width: 20, align: 'right', numFmt: 'R$ #,##0.00', isSum: true },
            { header: 'Pasta Servidor', key: 'pasta_servidor', width: 32, align: 'left' }
        ];

        ws.columns = columns.map(c => ({ key: c.key, width: c.width }));

        // Linha 1: Marca da Empresa
        const lastCol = getColLetter(columns.length);
        ws.mergeCells(`A1:${lastCol}1`);
        const r1 = ws.getCell('A1');
        r1.value = `${getCompanyLegalName()} — RELATÓRIO GERAL DE PEDIDOS DE VENDA`;
        r1.fill = NAVY_FILL;
        r1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        r1.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(1).height = 28;

        // Linha 2: Subtítulo
        ws.mergeCells(`A2:${lastCol}2`);
        const r2 = ws.getCell('A2');
        r2.value = `Exportado em: ${new Date().toLocaleString('pt-BR')}  |  Total de Registros: ${pedidos.length}`;
        r2.fill = SLATE_FILL;
        r2.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
        r2.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(2).height = 20;

        ws.getRow(3).height = 6;

        // Cabeçalho
        const hRow = ws.getRow(4);
        hRow.height = 24;
        columns.forEach((col, idx) => {
            const cell = hRow.getCell(idx + 1);
            cell.value = col.header;
            cell.fill = NAVY_FILL;
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle', horizontal: col.align || 'left' };
            cell.border = THIN_BORDER;
        });

        let curRow = 5;
        pedidos.forEach((p, pIdx) => {
            const row = ws.getRow(curRow);
            row.height = 20;

            row.getCell(1).value = p.numero_pedido || '-';
            row.getCell(2).value = p.pedido_cliente || '-';
            row.getCell(3).value = formatDateBR(p.data_emissao);
            row.getCell(4).value = p.cliente_codigo || '-';
            row.getCell(5).value = p.cliente_nome || p.cliente_fantasia || '-';
            row.getCell(6).value = p.cnpj_cpf || '-';
            row.getCell(7).value = parseInt(p.total_itens) || 0;
            row.getCell(8).value = p.condicao_pagamento || '-';
            row.getCell(9).value = p.tipo_frete || 'FOB';
            row.getCell(10).value = p.transportadora || '-';
            row.getCell(11).value = (p.status || 'orcamento').toUpperCase();
            row.getCell(12).value = parseFloat(p.valor_total) || 0;
            row.getCell(13).value = p.pasta_servidor || '';

            columns.forEach((col, cIdx) => {
                const cell = row.getCell(cIdx + 1);
                cell.alignment = { vertical: 'middle', horizontal: col.align || 'left' };
                cell.font = { name: 'Arial', size: 8.5, bold: !!col.fontBold };
                cell.border = THIN_BORDER;
                if (col.numFmt) cell.numFmt = col.numFmt;
                if (pIdx % 2 === 1) cell.fill = ZEBRA_FILL;
            });

            curRow++;
        });

        // Totais
        const totRow = ws.getRow(curRow);
        totRow.height = 24;
        totRow.getCell(1).value = 'TOTAL GERAL';
        totRow.getCell(1).font = { name: 'Arial', size: 9, bold: true };
        totRow.getCell(12).value = { formula: `SUM(L5:L${curRow - 1})` };
        totRow.getCell(12).numFmt = 'R$ #,##0.00';
        totRow.getCell(12).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E3A5F' } };

        for (let c = 1; c <= columns.length; c++) {
            const cell = totRow.getCell(c);
            cell.fill = TOTAL_FILL;
            cell.border = THIN_BORDER;
        }

        ws.autoFilter = `A4:${lastCol}${curRow}`;
    } else {
        // ABA DETALHADA FLAT (1 LINHA POR ITEM COM DADOS DO PEDIDO — Conforme Escolha Recomendada)
        const ws = wb.addWorksheet('Itens dos Pedidos (Flat)', {
            views: [{ state: 'frozen', ySplit: 4, showGridLines: true }]
        });

        const columns = [
            { header: 'Nº Pedido', key: 'numero_pedido', width: 14, align: 'center', fontBold: true },
            { header: 'PO Cliente', key: 'pedido_cliente', width: 16, align: 'center' },
            { header: 'Data Emissão', key: 'data_emissao', width: 14, align: 'center' },
            { header: 'Status Pedido', key: 'status', width: 14, align: 'center' },
            { header: 'Cód. Cliente', key: 'cliente_codigo', width: 12, align: 'center' },
            { header: 'Razão Social do Cliente', key: 'cliente_nome', width: 34, align: 'left' },
            { header: 'CNPJ/CPF', key: 'cnpj_cpf', width: 18, align: 'center' },
            { header: 'Seq', key: 'item_seq', width: 6, align: 'center' },
            { header: 'Código do Produto', key: 'produto_codigo', width: 22, align: 'left', fontBold: true },
            { header: 'Descrição do Produto', key: 'produto_descricao', width: 40, align: 'left' },
            { header: 'UM', key: 'unidade_medida', width: 6, align: 'center' },
            { header: 'Quantidade', key: 'quantidade', width: 14, align: 'right', numFmt: '#,##0.00' },
            { header: 'Preço Un. (R$)', key: 'preco_unitario', width: 16, align: 'right', numFmt: 'R$ #,##0.00' },
            { header: 'Subtotal Item (R$)', key: 'valor_total', width: 18, align: 'right', numFmt: 'R$ #,##0.00', isSum: true },
            { header: 'Entrega Prevista', key: 'data_entrega_prevista', width: 16, align: 'center' },
            { header: 'Nº OP Vinculada', key: 'numero_op_gerada', width: 14, align: 'center' },
            { header: 'Observação da Linha', key: 'observacao', width: 30, align: 'left' }
        ];

        ws.columns = columns.map(c => ({ key: c.key, width: c.width }));

        const lastCol = getColLetter(columns.length);
        ws.mergeCells(`A1:${lastCol}1`);
        const r1 = ws.getCell('A1');
        r1.value = `${getCompanyLegalName()} — RELATÓRIO ANALÍTICO DE PEDIDOS E ITENS`;
        r1.fill = NAVY_FILL;
        r1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        r1.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(1).height = 28;

        ws.mergeCells(`A2:${lastCol}2`);
        const r2 = ws.getCell('A2');
        r2.value = `Exportado em: ${new Date().toLocaleString('pt-BR')}  |  Total de Linhas: ${itens.length}  |  Pedidos Envolvidos: ${pedidos.length}`;
        r2.fill = SLATE_FILL;
        r2.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
        r2.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(2).height = 20;

        ws.getRow(3).height = 6;

        // Cabeçalho
        const hRow = ws.getRow(4);
        hRow.height = 24;
        columns.forEach((col, idx) => {
            const cell = hRow.getCell(idx + 1);
            cell.value = col.header;
            cell.fill = NAVY_FILL;
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle', horizontal: col.align || 'left' };
            cell.border = THIN_BORDER;
        });

        // Cria mapa rápido de pedidos por numero_pedido para cruzar dados
        const pedidosMap = new Map();
        pedidos.forEach(p => pedidosMap.set(String(p.numero_pedido), p));

        let curRow = 5;
        itens.forEach((it, itIdx) => {
            const ped = pedidosMap.get(String(it.pedido_numero)) || {};
            const row = ws.getRow(curRow);
            row.height = 20;
            const subtotal = it.valor_total || (parseFloat(it.quantidade) * parseFloat(it.preco_unitario));

            row.getCell(1).value = it.pedido_numero || '-';
            row.getCell(2).value = ped.pedido_cliente || '-';
            row.getCell(3).value = formatDateBR(ped.data_emissao);
            row.getCell(4).value = (ped.status || 'orcamento').toUpperCase();
            row.getCell(5).value = ped.cliente_codigo || '-';
            row.getCell(6).value = ped.cliente_nome || ped.cliente_fantasia || '-';
            row.getCell(7).value = ped.cnpj_cpf || '-';
            row.getCell(8).value = it.item_seq || String(itIdx + 1).padStart(2, '0');
            row.getCell(9).value = it.produto_codigo || '-';
            row.getCell(10).value = it.produto_descricao || '-';
            row.getCell(11).value = it.unidade_medida || 'UN';
            row.getCell(12).value = parseFloat(it.quantidade) || 0;
            row.getCell(13).value = parseFloat(it.preco_unitario) || 0;
            row.getCell(14).value = subtotal;
            row.getCell(15).value = formatDateBR(it.data_entrega_prevista);
            row.getCell(16).value = it.numero_op_gerada || '-';
            row.getCell(17).value = it.observacao || '';

            columns.forEach((col, cIdx) => {
                const cell = row.getCell(cIdx + 1);
                cell.alignment = { vertical: 'middle', horizontal: col.align || 'left' };
                cell.font = { name: 'Arial', size: 8.5, bold: !!col.fontBold };
                cell.border = THIN_BORDER;
                if (col.numFmt) cell.numFmt = col.numFmt;
                if (itIdx % 2 === 1) cell.fill = ZEBRA_FILL;
            });

            curRow++;
        });

        // Totais
        const totRow = ws.getRow(curRow);
        totRow.height = 24;
        totRow.getCell(1).value = 'TOTAL GERAL';
        totRow.getCell(1).font = { name: 'Arial', size: 9, bold: true };
        totRow.getCell(12).value = { formula: `SUM(L5:L${curRow - 1})` };
        totRow.getCell(12).numFmt = '#,##0.00';
        totRow.getCell(14).value = { formula: `SUM(N5:N${curRow - 1})` };
        totRow.getCell(14).numFmt = 'R$ #,##0.00';
        totRow.getCell(14).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E3A5F' } };

        for (let c = 1; c <= columns.length; c++) {
            const cell = totRow.getCell(c);
            cell.fill = TOTAL_FILL;
            cell.border = THIN_BORDER;
        }

        ws.autoFilter = `A4:${lastCol}${curRow}`;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, `Relatorio_Pedidos_Venda_${tipo}.xlsx`);
};
