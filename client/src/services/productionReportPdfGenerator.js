import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getProductionReportData } from './api';

const safeDate = (dateVal) => {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date) return new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate(), 12, 0, 0);
    const str = String(dateVal);
    const ymd = str.split('T')[0];
    if (ymd.length === 10) return new Date(ymd + 'T12:00:00');
    return new Date(dateVal);
};

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    if (String(dateStr).length === 8 && !String(dateStr).includes('-')) {
        const str = String(dateStr);
        return `${str.substr(6, 2)}/${str.substr(4, 2)}/${str.substr(0, 4)}`;
    }
    const d = safeDate(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}/${m}/${y}`;
};

export const generateProductionReportPdf = async (filters) => {
    try {
        const { rows } = await getProductionReportData({ ...filters, page: 1, limit: 10000 });

        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4 = 297 × 210 mm

        const pageWidth  = doc.internal.pageSize.getWidth();  // 297
        const pageHeight = doc.internal.pageSize.getHeight(); // 210
        const ML = 10;
        const MR = 10;
        const usableW = pageWidth - ML - MR;

        const drawHeader = () => {
            const hY = 8;
            const hH = 16;
            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.rect(ML, hY, usableW, hH);

            const col1 = ML + 52;
            const col2 = ML + 165;
            const col3 = ML + 222;
            doc.setLineWidth(0.2);
            [col1, col2, col3].forEach(x => doc.line(x, hY, x, hY + hH));

            // Logo Block
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('METALFISA', ML + 4, hY + 6);
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.text('Transformando metais em excelência', ML + 4, hY + 10);

            // Company Block
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.text('METALFISA METALURGICA LTDA', col1 + 3, hY + 5.5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text('R. Américo Santiago Piacenza, 516  —  CNPJ: 23.881.592/0001-01', col1 + 3, hY + 9.5);
            doc.text('PCP - Planejamento e Controle de Produção', col1 + 3, hY + 13.5);

            // Emission Block
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.text('EMISSÃO:', col2 + 3, hY + 5.5);
            doc.setFont('helvetica', 'normal');
            doc.text(formatDate(new Date()), col2 + 20, hY + 5.5);

            // Title Block
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('RELATÓRIO DE PRODUÇÃO', col3 + (usableW - (col3 - ML)) / 2, hY + 5.5, { align: 'center' });
            doc.setFontSize(8);
            doc.text(`Total: ${rows.length} registros`, col3 + (usableW - (col3 - ML)) / 2, hY + 10.5, { align: 'center' });
            
            return hY + hH + 4;
        };

        const tableStartY = drawHeader();

        const tableColumns = [
            'OP Completa',
            'Produto',
            'Descrição',
            'Cliente',
            'Pedido',
            'Entrega',
            'Qtd Plan',
            'Qtd Prod',
            '%',
            'Status'
        ];

        const tableRows = rows.map((r) => [
            r.op_completa || r.op,
            r.produto,
            r.descricao,
            r.cliente,
            r.pedido,
            formatDate(r.data_entrega),
            r.qtd_plan,
            r.qtd_prod,
            `${parseFloat(r.progresso).toFixed(1)}%`,
            r.status
        ]);

        autoTable(doc, {
            startY: tableStartY,
            head: [tableColumns],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 30, 30],
                textColor: [255, 255, 255],
                lineColor: [0, 0, 0],
                lineWidth: 0.2,
                fontSize: 7,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                cellPadding: 1.5,
            },
            bodyStyles: {
                lineColor: [180, 180, 180],
                lineWidth: 0.1,
                fontSize: 7,
                textColor: [0, 0, 0],
                cellPadding: 1.5,
            },
            alternateRowStyles: {
                fillColor: [248, 249, 250],
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 20 },
                1: { halign: 'center', cellWidth: 25 },
                2: { halign: 'left',   cellWidth: 60 },
                3: { halign: 'left',   cellWidth: 55 },
                4: { halign: 'center', cellWidth: 20 },
                5: { halign: 'center', cellWidth: 20 },
                6: { halign: 'center', cellWidth: 15 },
                7: { halign: 'center', cellWidth: 15 },
                8: { halign: 'center', cellWidth: 15 },
                9: { halign: 'center', cellWidth: 20 },
            },
            margin: { top: 8, left: ML, right: MR, bottom: 20 },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) {
                    drawHeader();
                    data.settings.margin.top = 28;
                }
                const pgStr = `Pág. ${doc.internal.getCurrentPageInfo().pageNumber}`;
                doc.setFontSize(6);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(120, 120, 120);
                doc.text(pgStr, pageWidth - MR, pageHeight - 5, { align: 'right' });
                doc.setTextColor(0, 0, 0);
            },
        });

        // Open in new tab
        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        window.open(url, '_blank');
        return true;
    } catch (error) {
        console.error('Erro ao gerar PDF de Produção:', error);
        throw error;
    }
};
