import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanyShortName } from './companyBranding';

const fmtQtd = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export const generateFaturamentoPdf = async (solicitacao, currentUser, returnAsBase64 = false) => {
    if (!solicitacao || !solicitacao.itens || solicitacao.itens.length === 0) return;

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const ML = 14;
    const MR = 14;

    // --- 1. CABEÇALHO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(30, 58, 95); // Deep Blue Lynx
    doc.text(getCompanyShortName(), ML, 20);

    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('Relatório de Solicitação de Faturamento', ML, 28);

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(`Solicitação Nº: `, pageWidth - 80, 20);
    doc.setFont('helvetica', 'bold');
    doc.text(solicitacao.numero_solicitacao || '', pageWidth - 45, 20);

    doc.setFont('helvetica', 'normal');
    const dateStr = formatDateTime(solicitacao.created_at);
    doc.text(`Data/Hora: ${dateStr}`, pageWidth - 80, 25);
    doc.text(`Solicitante: ${solicitacao.usuario || 'Sistema'}`, pageWidth - 80, 30);
    doc.text(`Status: `, pageWidth - 80, 35);
    
    // Status Color
    if (solicitacao.status === 'Atendido' || solicitacao.status === 'Faturado') {
        doc.setTextColor(34, 139, 34); // Green
    } else if (solicitacao.status === 'Cancelado') {
        doc.setTextColor(220, 53, 69); // Red
    } else {
        doc.setTextColor(255, 140, 0); // Orange
    }
    doc.text(solicitacao.status || 'Pendente', pageWidth - 65, 35);
    doc.setTextColor(50, 50, 50);

    if (solicitacao.nota_fiscal) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 95);
        doc.text(`NF Global: ${solicitacao.nota_fiscal}`, pageWidth - 80, 40);
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
    }

    // Linha separadora
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(ML, 45, pageWidth - MR, 45);

    // --- 2. DADOS DO CLIENTE ---
    const clientesNomes = [...new Set(solicitacao.itens.map(it => it.nome_cliente).filter(Boolean))];
    const clienteDestaque = clientesNomes.length > 0 ? clientesNomes.join(' / ') : 'Multiclientes';

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('DADOS DO CLIENTE', ML, 52);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(clienteDestaque, ML, 60);

    if (solicitacao.observacao) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text(`Observações: ${solicitacao.observacao}`, ML, 68);
    }

    let yOffset = solicitacao.observacao ? 75 : 68;

    // --- 3. TABELA DE ITENS ---
    const fmtDate = (d) => {
        if (!d) return '-';
        try { return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); } catch { return '-'; }
    };

    const tableData = solicitacao.itens.map((it, idx) => {
        const nfs = Array.isArray(it.notas_fiscais_protheus) && it.notas_fiscais_protheus.length > 0
            ? it.notas_fiscais_protheus
            : null;
        const nfStr    = nfs ? nfs.map(n => `NF ${n.nota}`).join('\n') : (it.nota_fiscal || solicitacao.nota_fiscal || '-');
        const emissao  = nfs ? (nfs[0].emissao || '-') : fmtDate(solicitacao.updated_at || solicitacao.created_at);
        return [
            (idx + 1).toString().padStart(3, '0'),
            `${it.pedido} - ${it.item}`,
            it.nome_cliente || '-',
            it.codigo_produto,
            fmtQtd(it.quantidade_solicitada),
            it.pedido_cliente || '-',
            it.desenho_cliente || '-',
            nfStr,
            emissao,
            it.pcp_serie_cliente || '-',
            it.pcp_numero_serie || '-',
            [it.pcp_lote, it.pcp_numero_lote].filter(Boolean).join('\n') || '-',
        ];
    });

    autoTable(doc, {
        startY: yOffset,
        head: [['Seq.', 'Pedido/Item', 'Cliente', 'Cód. Produto', 'Qtd', 'Ped. Cliente', 'Desenho', 'NF', 'Emissão NF', 'Série Cli.', 'Nº Série', 'Lote / Nº Lote']],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 7.5,
            cellPadding: 2.5,
            font: 'helvetica',
        },
        headStyles: {
            fillColor: [30, 58, 95],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 7,
        },
        columnStyles: {
            0:  { halign: 'center', cellWidth: 9 },
            1:  { halign: 'center', cellWidth: 16 },
            2:  { halign: 'left',   cellWidth: 32 },
            3:  { halign: 'left',   cellWidth: 26 },
            4:  { halign: 'right',  fontStyle: 'bold', textColor: [0, 0, 0], cellWidth: 12 },
            5:  { halign: 'left',   cellWidth: 18 },
            6:  { halign: 'left',   fontStyle: 'bold', textColor: [30, 58, 95], cellWidth: 20 },
            7:  { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
            8:  { halign: 'center', cellWidth: 16, textColor: [34, 139, 34] },
            9:  { halign: 'center', cellWidth: 16, textColor: [55, 65, 180] },
            10: { halign: 'center', cellWidth: 18, textColor: [55, 65, 180] },
            11: { halign: 'center', cellWidth: 18, textColor: [55, 65, 180] },
        },
        alternateRowStyles: {
            fillColor: [245, 248, 250]
        },
        margin: { top: 15, left: ML, right: MR, bottom: 20 },
        didDrawPage: function (data) {
            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            const str = `Página ${doc.internal.getCurrentPageInfo().pageNumber}`;
            doc.text(str, pageWidth - MR, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
            doc.text(`Emitido pelo App Lynx. Gerado por: ${currentUser?.nome || 'Sistema'}`, ML, doc.internal.pageSize.getHeight() - 10);
        }
    });

    // --- 4. EXPORT ---
    const fileName = `Faturamento_${solicitacao.numero_solicitacao}.pdf`;
    if (returnAsBase64) {
        // Retorna a string em base64 com pure data ou data URI
        const base64Data = doc.output('datauristring');
        return base64Data;
    } else {
        doc.save(fileName);
        return null;
    }
};

export default generateFaturamentoPdf;
