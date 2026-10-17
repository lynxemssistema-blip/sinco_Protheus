import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';
import { getCompanyLegalName, getCompanyShortName } from './companyBranding';

const NAVY = [30, 58, 95];        // #1E3A5F - Azul Corporativo MetalFisa
const ML = 8;
const MR = 8;

const formatNumber = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0,00';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Desenha o cabeçalho padrão corporativo MetalFisa
 */
const drawHeader = (doc, pageWidth, filters = {}, user = null, totalRecords = 0) => {
    const hY = 6;
    const usableW = pageWidth - ML - MR;
    const hH = 20;

    const col1 = ML + 45;              // divisória logo / título
    const col2 = pageWidth - MR - 60;  // divisória título / emissão

    // Borda externa
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.rect(ML, hY, usableW, hH);

    // Divisórias verticais
    doc.setLineWidth(0.2);
    doc.line(col1, hY, col1, hY + hH);
    doc.line(col2, hY, col2, hY + hH);

    // Logo
    try {
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', ML + 2, hY + 1.5, 40, 17);
        } else {
            throw new Error('no logo');
        }
    } catch {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...NAVY);
        doc.text(getCompanyShortName(), ML + 5, hY + 13);
    }

    // Título Central
    const midX = (col1 + col2) / 2;
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('RELATÓRIO DE SALDO DE MATERIAIS (ESTOQUE & SALDOS)', midX, hY + 6, { align: 'center' });

    // Subtítulo e Filtros Aplicados
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);

    const filterParts = [];
    if (filters.empresa) filterParts.push(`Emp: ${filters.empresa}`);
    if (filters.filial) filterParts.push(`Fil: ${filters.filial}`);
    if (filters.almoxarifado) filterParts.push(`Almox: ${filters.almoxarifado}`);
    if (filters.codigo) filterParts.push(`Cód: "${filters.codigo}"`);
    if (filters.descricao) filterParts.push(`Desc: "${filters.descricao}"`);
    if (filters.grupo) filterParts.push(`Grupo: "${filters.grupo}"`);
    if (filters.tipo) filterParts.push(`Tipo: "${filters.tipo}"`);

    const filterText = filterParts.length > 0 ? `Filtros: ${filterParts.join('  |  ')}` : 'Filtros: Todos os materiais sem restrição';
    doc.text(filterText.substring(0, 120), midX, hY + 11.5, { align: 'center' });
    
    doc.setFontSize(6.8);
    doc.setTextColor(110, 110, 110);
    doc.text(getCompanyLegalName(), midX, hY + 16.5, { align: 'center' });

    // Metadados da direita (Emissão e Total)
    const now = new Date();
    doc.setFontSize(7);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.text('EMISSÃO:', col2 + 3, hY + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, col2 + 20, hY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.text('REGISTROS:', col2 + 3, hY + 10.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${totalRecords} item(ns)`, col2 + 20, hY + 10.5);

    if (user?.NomeCompleto || user?.nome) {
        doc.setFont('helvetica', 'bold');
        doc.text('USUÁRIO:', col2 + 3, hY + 15.5);
        doc.setFont('helvetica', 'normal');
        const userName = String(user?.NomeCompleto || user?.nome || '').substring(0, 16);
        doc.text(userName, col2 + 20, hY + 15.5);
    }

    return hY + hH + 4;
};

/**
 * Desenha rodapés numerados em todas as páginas
 */
const drawFooters = (doc, pageWidth) => {
    const totalPages = doc.internal.getNumberOfPages();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableW = pageWidth - ML - MR;
    const fY = pageHeight - 7;

    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(ML, fY - 2, ML + usableW, fY - 2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(120, 120, 120);
        doc.text('MetalFisa Antigravity ERP  •  Documento gerado eletronicamente para fins de controle interno', ML, fY + 2);
        doc.text(`Página ${p} de ${totalPages}`, pageWidth - MR, fY + 2, { align: 'right' });
    }
};

/**
 * Função principal que gera o PDF de Saldo de Materiais
 */
export const generateSaldoMateriaisPdf = (items = [], filters = {}, user = null) => {
    if (!items || items.length === 0) {
        throw new Error('Nenhum item disponível para gerar o relatório.');
    }

    // 1. Inicializa documento no formato Paisagem A4 (297 x 210 mm)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // 2. Cabeçalho
    const startTableY = drawHeader(doc, pageWidth, filters, user, items.length);

    // 3. Montagem dos dados
    const headers = ['Emp', 'Fil', 'Loc', 'Código', 'Descrição do Material', 'UM', 'Saldo Atual', 'Empenho', 'Disponível'];

    const tableData = items.map(row => {
        const saldoAtual = parseFloat(row.saldo_atual) || 0;
        const empenho = parseFloat(row.empenho) || 0;
        const disponivel = saldoAtual - empenho;

        return [
            row.empresa || '-',
            row.filial || '-',
            row.almoxarifado || '-',
            row.cod_produto || row.cod_producto || '-',
            row.descricao || '-',
            row.unidade || 'UN',
            formatNumber(saldoAtual),
            formatNumber(empenho),
            formatNumber(disponivel)
        ];
    });

    // 4. Totais gerais
    const totalSaldo = items.reduce((acc, r) => acc + (parseFloat(r.saldo_atual) || 0), 0);
    const totalEmpenho = items.reduce((acc, r) => acc + (parseFloat(r.empenho) || 0), 0);
    const totalDisponivel = totalSaldo - totalEmpenho;

    const footerRow = [
        { content: `TOTAIS GERAIS (${items.length} itens listados)`, colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatNumber(totalSaldo), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatNumber(totalEmpenho), styles: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] } },
        { content: formatNumber(totalDisponivel), styles: { halign: 'right', fontStyle: 'bold', textColor: [30, 58, 138] } }
    ];

    // 5. Configuração das colunas (largura total utilizável ~ 281mm)
    const colStyles = {
        0: { halign: 'center', cellWidth: 12 }, // Emp
        1: { halign: 'center', cellWidth: 12 }, // Fil
        2: { halign: 'center', cellWidth: 14 }, // Loc
        3: { halign: 'left', cellWidth: 38, fontStyle: 'bold' }, // Código
        4: { halign: 'left', cellWidth: 'auto' }, // Descrição
        5: { halign: 'center', cellWidth: 14 }, // UM
        6: { halign: 'right', cellWidth: 26, fontStyle: 'bold' }, // Saldo Atual
        7: { halign: 'right', cellWidth: 24, textColor: [185, 28, 28] }, // Empenho
        8: { halign: 'right', cellWidth: 26, fontStyle: 'bold', textColor: [29, 78, 216] } // Disponível
    };

    // 6. Execução do autoTable
    autoTable(doc, {
        head: [headers],
        body: tableData,
        foot: [footerRow],
        startY: startTableY,
        margin: { left: ML, right: MR, bottom: 12 },
        theme: 'striped',
        styles: {
            fontSize: 7.2,
            cellPadding: 1.5,
            valign: 'middle',
            overflow: 'ellipsize',
            font: 'helvetica'
        },
        headStyles: {
            fillColor: NAVY,
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: 'bold',
            halign: 'center',
            cellPadding: 2
        },
        footStyles: {
            fillColor: [226, 232, 240],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: 1.8
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: colStyles
    });

    // 7. Rodapés numerados
    drawFooters(doc, pageWidth);

    // 8. Abrir prévia em nova aba do navegador com fallback para download
    const pad = (n) => String(n).padStart(2, '0');
    const nowStamp = new Date();
    const ts = `${nowStamp.getFullYear()}${pad(nowStamp.getMonth() + 1)}${pad(nowStamp.getDate())}_${pad(nowStamp.getHours())}${pad(nowStamp.getMinutes())}`;
    const fileName = `Saldo_Materiais_${ts}.pdf`;

    try {
        const blobUrl = doc.output('bloburl');
        const newTab = window.open(blobUrl, '_blank');
        if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
            doc.save(fileName);
        }
    } catch {
        doc.save(fileName);
    }

    return fileName;
};

export default generateSaldoMateriaisPdf;
