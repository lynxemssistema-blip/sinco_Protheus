/**
 * // FEAT (IA): Motor Relatorios Lynxems
 * client/src/services/ReportGeneratorService.js
 * 
 * Motor Central de Relatórios Padronizado da Lynxems (PDF e Excel).
 * Arquitetura SaaS Multi-Tenant com injeção 100% dinâmica dos dados da Empresa Ativa,
 * paleta de cores corporativa Lynxems (Slate 900 / Tech Blue), paginação obrigatória
 * e rodapé padronizado "Desenvolvido por Lynxems".
 */

import {
    getCompany,
    loadCompanyBranding,
    getCompanyLegalName,
    getCompanyCnpj,
    getCompanyAddressLine,
    getCompanyContactLine,
    getCompanyLogoBase64
} from './companyBranding';
import { downloadBlob } from '../utils/downloadHelper';

/**
 * Invoca o plugin jspdf-autotable de forma universal e resiliente
 * (suporta tanto default export, named export autoTable ou método no protótipo doc.autoTable)
 */
const applyAutoTable = (doc, options, autoTable) => {
    if (typeof autoTable === 'function') {
        return autoTable(doc, options);
    }
    if (autoTable && typeof autoTable.default === 'function') {
        return autoTable.default(doc, options);
    }
    if (autoTable && typeof autoTable.autoTable === 'function') {
        return autoTable.autoTable(doc, options);
    }
    if (typeof doc.autoTable === 'function') {
        return doc.autoTable(options);
    }
    throw new Error('Plugin jspdf-autotable não pôde ser invocado.');
};

// ── PALETA CORPORATIVA LYNXEMS (Compliance Anti-Purple Ban) ──────────────────
const LYNX_THEME = {
    primary: '0F172A',      // Slate 900 (Cor Primária Lynxems)
    primaryRgb: [15, 23, 42],
    secondary: '1E293B',    // Slate 800
    secondaryRgb: [30, 41, 59],
    accent: '0284C7',       // Sky Pro (Acento Técnico)
    accentRgb: [2, 132, 199],
    zebra: 'F8FAFC',        // Slate 50 (Fundo alternado suave)
    zebraRgb: [248, 250, 252],
    border: 'CBD5E1',       // Slate 300
    borderRgb: [203, 213, 225],
    textDark: '0F172A',
    textMuted: '64748B',    // Slate 500
    textMutedRgb: [100, 116, 139],
    white: 'FFFFFF',
    whiteRgb: [255, 255, 255]
};

/**
 * Utilitário de formatação de valores para relatórios
 */
const formatValue = (val, formatType) => {
    if (val === null || val === undefined || val === '') return '—';
    
    switch (formatType) {
        case 'currency': {
            const num = Number(val);
            if (isNaN(num)) return String(val);
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
        }
        case 'number': {
            const num = Number(val);
            if (isNaN(num)) return String(val);
            return new Intl.NumberFormat('pt-BR').format(num);
        }
        case 'decimal': {
            const num = Number(val);
            if (isNaN(num)) return String(val);
            return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(num);
        }
        case 'percent': {
            const num = Number(val);
            if (isNaN(num)) return String(val);
            return `${num.toFixed(1)}%`;
        }
        case 'date': {
            const str = String(val).trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
                const parts = str.substring(0, 10).split('-');
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            if (/^\d{8}$/.test(str)) {
                return `${str.substring(6, 8)}/${str.substring(4, 6)}/${str.substring(0, 4)}`;
            }
            return str;
        }
        default:
            return String(val);
    }
};

/**
 * Resolução dinâmica da Empresa Ativa e Metadados do Usuário
 * Garante que NUNCA haja dados estáticos ou hardcoded.
 */
const resolveActiveContext = async (explicitCompany = null) => {
    let company = explicitCompany || getCompany();
    
    // Se a empresa ainda não estiver carregada na memória, carrega em tempo de execução
    if (!company || !company.razao_social) {
        try {
            company = await loadCompanyBranding();
        } catch (e) {
            console.warn('[ReportGeneratorService] Aviso ao carregar branding da empresa:', e.message);
        }
    }

    let user = null;
    try {
        const storedUser = localStorage.getItem('@Lynx:user');
        if (storedUser) user = JSON.parse(storedUser);
    } catch (e) {
        // ignore
    }

    const razaoSocial = (company?.razao_social || company?.nome_fantasia || getCompanyLegalName()).toUpperCase();
    const nomeFantasia = (company?.nome_fantasia || company?.razao_social || razaoSocial).toUpperCase();
    const cnpj = company?.cnpj || getCompanyCnpj();
    const endereco = getCompanyAddressLine() || (company?.cidade ? `${company.cidade}/${company.uf || ''}` : '');
    const contato = getCompanyContactLine() || company?.telefone || company?.email || '';
    const logoBase64 = company?.logo_base64 || getCompanyLogoBase64();

    const now = new Date();
    const dataEmissaoFormatada = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
    const usuarioEmissor = user?.nome || user?.login || 'Usuário Sistema';

    return {
        company,
        razaoSocial,
        nomeFantasia,
        cnpj,
        endereco,
        contato,
        logoBase64,
        usuarioEmissor,
        dataEmissaoFormatada
    };
};

export const ReportGeneratorService = {
    // FEAT (IA): Motor Relatorios Lynxems - Gerador Excel com Cabeçalho Multi-Tenant
    /**
     * Exporta dados para planilha Excel (.xlsx) profissional Lynxems com cabeçalho rico da Empresa Ativa
     * 
     * @param {Object} options
     * @param {string} options.title - Título principal do relatório (ex: 'Catálogo de Produtos')
     * @param {string} [options.subtitle] - Subtítulo descritivo ou filtros aplicados
     * @param {Array<Object>} options.columns - Definição das colunas [{ header, key, width, align, format }]
     * @param {Array<Object>} options.data - Dados brutos (linhas)
     * @param {string} [options.filename] - Nome do arquivo (sem extensão)
     * @param {string} [options.sheetName] - Nome da aba (default: 'Relatório')
     * @param {Object} [options.company] - Override opcional de empresa
     */
    async exportExcel(options = {}) {
        const {
            title = 'Relatório Geral',
            subtitle = '',
            columns = [],
            data = [],
            filename = null,
            fileName = null,
            sheetName = 'Dados',
            company: explicitCompany = null
        } = options;

        if (!columns || columns.length === 0) {
            throw new Error('É necessário fornecer ao menos uma coluna para gerar o relatório Excel.');
        }

        const context = await resolveActiveContext(explicitCompany);
        const colCount = Math.max(columns.length, 6);
        const lastColLetter = String.fromCharCode(64 + Math.min(colCount, 26));

        const { default: ExcelJS } = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Lynxems SaaS Suite';
        workbook.lastModifiedBy = context.usuarioEmissor;
        workbook.created = new Date();
        workbook.modified = new Date();

        const worksheet = workbook.addWorksheet(sheetName.substring(0, 31), {
            views: [{ showGridLines: true }]
        });

        // ── 1. CABEÇALHO DA EMPRESA ATIVA (MULTI-TENANT) ─────────────────────────
        
        // Linha 1: Banner com Nome da Empresa Ativa
        worksheet.mergeCells(`A1:${lastColLetter}1`);
        const row1 = worksheet.getCell('A1');
        row1.value = context.razaoSocial;
        row1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: LYNX_THEME.white } };
        row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LYNX_THEME.primary } };
        row1.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).height = 32;

        // Linha 2: Dados cadastrais dinâmicos da Empresa Ativa (CNPJ, Endereço, Contato)
        worksheet.mergeCells(`A2:${lastColLetter}2`);
        const row2 = worksheet.getCell('A2');
        const companyMeta = [
            context.cnpj ? `CNPJ: ${context.cnpj}` : '',
            context.endereco ? `Endereço: ${context.endereco}` : '',
            context.contato ? `Contato: ${context.contato}` : ''
        ].filter(Boolean).join('   |   ');
        row2.value = companyMeta || 'SINCO PROTHEUS — PLATAFORMA INTEGRADA';
        row2.font = { name: 'Calibri', size: 9.5, color: { argb: 'E2E8F0' } };
        row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LYNX_THEME.secondary } };
        row2.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(2).height = 20;

        // Linha 3: Título do Relatório
        worksheet.mergeCells(`A3:${lastColLetter}3`);
        const row3 = worksheet.getCell('A3');
        row3.value = `RELATÓRIO: ${title.toUpperCase()}${subtitle ? ` — ${subtitle}` : ''}`;
        row3.font = { name: 'Calibri', size: 11, bold: true, color: { argb: LYNX_THEME.textDark } };
        row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
        row3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        worksheet.getRow(3).height = 24;

        // Linha 4: Metadados da Emissão
        worksheet.mergeCells(`A4:${lastColLetter}4`);
        const row4 = worksheet.getCell('A4');
        row4.value = `Emissão: ${context.dataEmissaoFormatada}   |   Emitido por: ${context.usuarioEmissor}   |   Total de Registros: ${data.length}`;
        row4.font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: LYNX_THEME.textMuted } };
        row4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
        row4.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        worksheet.getRow(4).height = 18;

        // Linha 5: Espaçador
        worksheet.getRow(5).height = 8;

        // ── 2. LINHA DE CABEÇALHO DAS COLUNAS (LYNXEMS BRANDING) ──────────────────
        const headerRowIndex = 6;
        const headerRow = worksheet.getRow(headerRowIndex);
        headerRow.height = 28;

        columns.forEach((col, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = (col.header || col.label || col.key || '').toUpperCase();
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: LYNX_THEME.white } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LYNX_THEME.primary } };
            cell.alignment = {
                vertical: 'middle',
                horizontal: col.align || (col.format === 'currency' || col.format === 'number' || col.format === 'decimal' ? 'right' : 'left'),
                wrapText: false
            };
            cell.border = {
                top: { style: 'thin', color: { argb: '334155' } },
                bottom: { style: 'medium', color: { argb: LYNX_THEME.accent } },
                left: { style: 'thin', color: { argb: '334155' } },
                right: { style: 'thin', color: { argb: '334155' } }
            };
        });

        // ── 3. DADOS COM LINHAS ZEBRADAS E FORMATAÇÃO TIPADA ─────────────────────
        let currentRowIdx = 7;
        data.forEach((item, rowNum) => {
            const row = worksheet.getRow(currentRowIdx);
            row.height = 20;
            const isZebra = rowNum % 2 === 1;
            const bgArgb = isZebra ? LYNX_THEME.zebra : LYNX_THEME.white;

            columns.forEach((col, colIdx) => {
                const cell = row.getCell(colIdx + 1);
                const rawVal = item[col.key];

                if (col.format === 'currency' || col.format === 'decimal' || col.format === 'number') {
                    const numVal = parseFloat(rawVal);
                    if (!isNaN(numVal)) {
                        cell.value = numVal;
                        if (col.format === 'currency') cell.numFmt = '"R$" #,##0.00';
                        else if (col.format === 'decimal') cell.numFmt = '#,##0.00';
                        else cell.numFmt = '#,##0';
                    } else {
                        cell.value = rawVal ?? '—';
                    }
                } else if (col.format === 'date') {
                    cell.value = formatValue(rawVal, 'date');
                } else {
                    const strVal = rawVal !== null && rawVal !== undefined ? String(rawVal) : '—';
                    cell.value = strVal.replace(/^([=+\-@])/, "'$1");
                }

                cell.font = { name: 'Calibri', size: 9.5, color: { argb: LYNX_THEME.textDark } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: col.align || (col.format === 'currency' || col.format === 'number' || col.format === 'decimal' ? 'right' : col.align || 'left')
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'E2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                    left: { style: 'thin', color: { argb: 'E2E8F0' } },
                    right: { style: 'thin', color: { argb: 'E2E8F0' } }
                };
            });

            currentRowIdx++;
        });

        // ── 4. AUTO-FILTRO NATIVO E AUTO-AJUSTE DE LARGURA ────────────────────────
        worksheet.autoFilter = {
            from: { row: headerRowIndex, column: 1 },
            to: { row: Math.max(currentRowIdx - 1, headerRowIndex), column: columns.length }
        };

        // Auto-ajuste de largura de cada coluna
        columns.forEach((col, idx) => {
            const worksheetCol = worksheet.getColumn(idx + 1);
            let maxLen = (col.header || '').length;

            data.slice(0, 100).forEach(row => {
                const cellVal = String(row[col.key] || '');
                if (cellVal.length > maxLen) maxLen = cellVal.length;
            });

            worksheetCol.width = Math.max(col.width || 12, Math.min(maxLen + 4, 45));
        });

        // ── 5. RODAPÉ INSTITUCIONAL OBRIGATÓRIO LYNXEMS ──────────────────────────
        const footerRowIdx = currentRowIdx + 1;
        worksheet.mergeCells(`A${footerRowIdx}:${lastColLetter}${footerRowIdx}`);
        const footerCell = worksheet.getCell(`A${footerRowIdx}`);
        footerCell.value = `Desenvolvido por Lynxems — Soluções Industriais e Tecnológicas | SINCO PROTHEUS SaaS`;
        footerCell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: LYNX_THEME.textMuted } };
        footerCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(footerRowIdx).height = 20;

        // Dispara o download nativo do arquivo no navegador com garantia de extensão .xlsx
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const rawFilename = filename || fileName || 'relatorio_lynxems';
        const nameWithoutExt = String(rawFilename).trim()
            .replace(/\.xlsx$/i, '')
            .replace(/\.pdf$/i, '');
        const cleanName = nameWithoutExt.replace(/[\/\\:*?"<>|]/g, '_');
        const finalFilename = `${cleanName}.xlsx`;
        downloadBlob(blob, finalFilename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        return { success: true, filename: finalFilename, recordsCount: data.length };
    },

    // FEAT (IA): Motor Relatorios Lynxems - Gerador PDF com Cabeçalho Multi-Tenant e Rodapé Lynxems
    /**
     * Exporta dados para documento PDF estruturado Lynxems com cabeçalho da Empresa Ativa e numeração X de Y
     * 
     * @param {Object} options
     * @param {string} options.title - Título principal do relatório
     * @param {string} [options.subtitle] - Subtítulo descritivo
     * @param {Array<Object>} options.columns - Definição das colunas [{ header, key, width, align, format }]
     * @param {Array<Object>} options.data - Dados brutos (linhas)
     * @param {string} [options.filename] - Nome do arquivo (sem extensão)
     * @param {string} [options.orientation] - 'portrait' ou 'landscape' (auto-detect se omitido)
     * @param {Object} [options.company] - Override opcional de empresa
     */
    async exportPdf(options = {}) {
        const {
            title = 'Relatório Geral',
            subtitle = '',
            columns = [],
            data = [],
            filename = null,
            fileName = null,
            orientation = null,
            company: explicitCompany = null
        } = options;

        if (!columns || columns.length === 0) {
            throw new Error('É necessário fornecer ao menos uma coluna para gerar o relatório PDF.');
        }

        const context = await resolveActiveContext(explicitCompany);

        const { jsPDF } = await import('jspdf');
        const autoTableModule = await import('jspdf-autotable');
        const autoTable = autoTableModule.default || autoTableModule;

        // Auto-detecta orientação: mais de 6 colunas usa paisagem por padrão para legibilidade
        const autoOrientation = orientation || (columns.length > 6 ? 'landscape' : 'portrait');
        const doc = new jsPDF({
            orientation: autoOrientation,
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginLeft = 10;
        const marginRight = 10;
        const usableWidth = pageWidth - marginLeft - marginRight;

        // ── 1. CABEÇALHO RICO MULTI-TENANT (EMPRESA ATIVA) ────────────────────────
        let startY = 12;

        // Se houver logo base64 da empresa ativa, desenha no canto superior esquerdo
        let logoOffsetLeft = 0;
        if (context.logoBase64 && context.logoBase64.startsWith('data:image')) {
            try {
                const imgProps = doc.getImageProperties(context.logoBase64);
                const logoHeight = 14;
                const logoWidth = (imgProps.width / imgProps.height) * logoHeight;
                doc.addImage(context.logoBase64, 'PNG', marginLeft, startY, Math.min(logoWidth, 38), logoHeight);
                logoOffsetLeft = Math.min(logoWidth, 38) + 4;
            } catch (imgErr) {
                console.warn('[ReportGeneratorService] Não foi possível renderizar logotipo da empresa ativa:', imgErr.message);
            }
        }

        // Bloco de Identificação da Empresa Ativa (Dinâmico)
        const textStartX = marginLeft + logoOffsetLeft;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(LYNX_THEME.primaryRgb[0], LYNX_THEME.primaryRgb[1], LYNX_THEME.primaryRgb[2]);
        doc.text(context.razaoSocial, textStartX, startY + 4);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(LYNX_THEME.textMutedRgb[0], LYNX_THEME.textMutedRgb[1], LYNX_THEME.textMutedRgb[2]);
        
        const empresaSub = [
            context.cnpj ? `CNPJ: ${context.cnpj}` : '',
            context.endereco || '',
            context.contato || ''
        ].filter(Boolean).join(' • ');

        doc.text(empresaSub, textStartX, startY + 8.5);

        // Bloco do Título do Relatório (À Direita)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(LYNX_THEME.accentRgb[0], LYNX_THEME.accentRgb[1], LYNX_THEME.accentRgb[2]);
        doc.text(title.toUpperCase(), pageWidth - marginRight, startY + 4, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(LYNX_THEME.textMutedRgb[0], LYNX_THEME.textMutedRgb[1], LYNX_THEME.textMutedRgb[2]);
        const emissaoMeta = `Emissão: ${context.dataEmissaoFormatada} | Por: ${context.usuarioEmissor}`;
        doc.text(emissaoMeta, pageWidth - marginRight, startY + 8.5, { align: 'right' });

        if (subtitle) {
            doc.setFontSize(7);
            doc.text(subtitle, pageWidth - marginRight, startY + 12, { align: 'right' });
        }

        // Linha divisória técnica Lynxems
        const lineY = startY + 15;
        doc.setDrawColor(LYNX_THEME.primaryRgb[0], LYNX_THEME.primaryRgb[1], LYNX_THEME.primaryRgb[2]);
        doc.setLineWidth(0.6);
        doc.line(marginLeft, lineY, pageWidth - marginRight, lineY);

        doc.setDrawColor(LYNX_THEME.accentRgb[0], LYNX_THEME.accentRgb[1], LYNX_THEME.accentRgb[2]);
        doc.setLineWidth(0.8);
        doc.line(marginLeft, lineY, marginLeft + 25, lineY);

        // ── 2. MONTAGEM DA TABELA AUTOTABLE COM LINHAS ZEBRADAS ──────────────────
        const tableHeaders = columns.map(c => (c.header || c.label || c.key || '').toUpperCase());
        const tableRows = data.map(item => {
            return columns.map(c => formatValue(item[c.key], c.format));
        });

        // Configuração de alinhamento por coluna
        const columnStylesConfig = {};
        columns.forEach((c, idx) => {
            const align = c.align || (c.format === 'currency' || c.format === 'number' || c.format === 'decimal' ? 'right' : 'left');
            columnStylesConfig[idx] = {
                halign: align,
                cellWidth: c.width ? 'auto' : undefined
            };
        });

        applyAutoTable(doc, {
            head: [tableHeaders],
            body: tableRows,
            startY: lineY + 3,
            margin: { left: marginLeft, right: marginRight, top: lineY + 3, bottom: 14 },
            theme: 'grid',
            headStyles: {
                fillColor: LYNX_THEME.primaryRgb,
                textColor: [255, 255, 255],
                font: 'helvetica',
                fontStyle: 'bold',
                fontSize: 8,
                cellPadding: 2,
                halign: 'left'
            },
            bodyStyles: {
                font: 'helvetica',
                fontSize: 7.5,
                textColor: [30, 41, 59],
                cellPadding: 1.8,
                lineColor: LYNX_THEME.borderRgb,
                lineWidth: 0.15
            },
            alternateRowStyles: {
                fillColor: LYNX_THEME.zebraRgb
            },
            columnStyles: columnStylesConfig,
            didDrawPage: () => {
                // Header repetido nas páginas seguintes se quebrar
                if (doc.internal.getCurrentPageInfo().pageNumber > 1) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7);
                    doc.setTextColor(LYNX_THEME.textMutedRgb[0], LYNX_THEME.textMutedRgb[1], LYNX_THEME.textMutedRgb[2]);
                    doc.text(`${context.razaoSocial} — ${title}`, marginLeft, 8);
                    doc.text(context.dataEmissaoFormatada, pageWidth - marginRight, 8, { align: 'right' });
                    doc.setDrawColor(LYNX_THEME.borderRgb[0], LYNX_THEME.borderRgb[1], LYNX_THEME.borderRgb[2]);
                    doc.setLineWidth(0.3);
                    doc.line(marginLeft, 10, pageWidth - marginRight, 10);
                }
            }
        }, autoTable);

        // ── 3. RODAPÉ INSTITUCIONAL OBRIGATÓRIO (PAGINAÇÃO X DE Y) ─────────────────
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);

            // Linha divisória de rodapé
            const footerLineY = pageHeight - 10;
            doc.setDrawColor(LYNX_THEME.borderRgb[0], LYNX_THEME.borderRgb[1], LYNX_THEME.borderRgb[2]);
            doc.setLineWidth(0.2);
            doc.line(marginLeft, footerLineY, pageWidth - marginRight, footerLineY);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(LYNX_THEME.textMutedRgb[0], LYNX_THEME.textMutedRgb[1], LYNX_THEME.textMutedRgb[2]);

            // Assinatura Obrigatória Lynxems à esquerda
            doc.text('Desenvolvido por Lynxems', marginLeft, footerLineY + 5);

            // Identificação do Sistema & Empresa no centro
            doc.setFontSize(6.8);
            doc.text(`SINCO PROTHEUS SaaS  •  ${context.nomeFantasia}`, pageWidth / 2, footerLineY + 5, { align: 'center' });

            // Numeração de Página à direita
            doc.setFontSize(7.5);
            doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginRight, footerLineY + 5, { align: 'right' });
        }

        // Salva e descarrega o arquivo PDF no navegador com garantia de extensão .pdf
        const rawFilename = filename || fileName || 'relatorio_lynxems';
        const nameWithoutExt = String(rawFilename).trim()
            .replace(/\.xlsx$/i, '')
            .replace(/\.pdf$/i, '');
        const cleanName = nameWithoutExt.replace(/[\/\\:*?"<>|]/g, '_');
        const finalFilename = `${cleanName}.pdf`;
        const pdfBlob = doc.output('blob');
        downloadBlob(pdfBlob, finalFilename, 'application/pdf');

        return { success: true, filename: finalFilename, recordsCount: data.length, totalPages };
    }
};

export default ReportGeneratorService;
