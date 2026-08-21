import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';

export const generateEngetronPdf = ({
    items = [],
    results = [],
    fileName = 'Demanda_Engetron'
}) => {
    try {
        const doc = new jsPDF('p', 'mm', 'a4'); // Portrait A4
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const ML = 10;
        const MR = 10;
        const usableW = pageWidth - ML - MR;

        const subtitleText = 'RELATÓRIO DE IMPORTAÇÃO DE PLANILHA ENGETRON';

        const drawHeader = () => {
            const hY = 8;
            const hH = 16;
            doc.setDrawColor(30, 41, 59);
            doc.setLineWidth(0.3);
            doc.rect(ML, hY, usableW, hH);

            const col1 = ML + 48;
            const col2 = ML + 120;
            doc.setLineWidth(0.2);
            [col1, col2].forEach(x => doc.line(x, hY, x, hY + hH));

            // 1. Logo Metalfisa
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', ML + 3, hY + 1.5, 40, 13);
            } else {
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.text('METALFISA', ML + 4, hY + 6);
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'normal');
                doc.text('Transformando metais em excelência', ML + 4, hY + 10);
            }

            // 2. Dados da Empresa
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.text('METALFISA METALURGICA LTDA', col1 + 3, hY + 5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text('R. Américo Santiago Piacenza, 516 — CNPJ: 23.881.592/0001-01', col1 + 3, hY + 9);
            doc.text(`Módulo PCP · Cliente: Engetron`, col1 + 3, hY + 13);

            // 3. Emissão e Resumo
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.text('EMISSÃO:', col2 + 3, hY + 5);
            doc.setFont('helvetica', 'normal');
            doc.text(new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), col2 + 18, hY + 5);
            
            doc.setFont('helvetica', 'bold');
            doc.text('TOTAL DE LINHAS:', col2 + 3, hY + 9.5);
            doc.setFont('helvetica', 'normal');
            doc.text(`${items.length}`, col2 + 28, hY + 9.5);

            const successCount = results.filter(r => r && r.status === 'success').length;
            doc.setFont('helvetica', 'bold');
            doc.text('LINHAS OK:', col2 + 3, hY + 14);
            doc.setFont('helvetica', 'normal');
            doc.text(`${successCount}`, col2 + 22, hY + 14);

            return hY + hH + 4;
        };

        const tableStartY = drawHeader();

        // Montar Colunas da Tabela
        const tableColumns = [
            'Pedido',
            'Item',
            'Produto',
            'Data PCP',
            'Status de Processamento'
        ];

        const formatDate = (val) => {
            if (!val) return '-';
            if (val instanceof Date) return val.toLocaleDateString('pt-BR');
            return String(val);
        };

        // Montar Linhas da Tabela
        const tableRows = items.map((item, idx) => {
            const res = results[idx] || null;
            return [
                item.pedido || '-',
                item.item || '-',
                item.produto || '-',
                formatDate(item.data_pcp),
                res ? res.reason : '-'
            ];
        });

        const colStyles = {
            0: { halign: 'left', cellWidth: 25, fontStyle: 'bold' },
            1: { halign: 'center', cellWidth: 15 },
            2: { halign: 'left', cellWidth: 35 },
            3: { halign: 'center', cellWidth: 30, fontStyle: 'bold', textColor: [67, 56, 202] }, // Indigo 700
            4: { halign: 'left' }
        };

        autoTable(doc, {
            head: [tableColumns],
            body: tableRows,
            startY: tableStartY,
            margin: { left: ML, right: MR, bottom: 12 },
            styles: {
                fontSize: 7.5,
                cellPadding: 2,
                lineColor: [203, 213, 225],
                lineWidth: 0.1,
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: [30, 41, 59], // Slate 800 Metalfisa
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 8
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252] // Slate 50
            },
            columnStyles: colStyles,
            didParseCell: (data) => {
                if (data.section === 'body') {
                    // Coluna de Status (verde ou âmbar/vermelho)
                    if (data.column.index === 4) {
                        const rowIndex = data.row.index;
                        const resLine = results[rowIndex];
                        if (resLine) {
                            if (resLine.status === 'success') {
                                data.cell.styles.textColor = [16, 122, 68];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (resLine.status === 'error') {
                                data.cell.styles.textColor = [185, 28, 28];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (resLine.status === 'warning') {
                                data.cell.styles.textColor = [180, 83, 9];
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                    }
                }
            },
            didDrawPage: (data) => {
                // Rodapé padrão Metalfisa
                const str = `Página ${data.pageNumber} de ${doc.internal.getNumberOfPages()}`;
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100);
                doc.text(str, pageWidth - MR, pageHeight - 5, { align: 'right' });
                doc.text('Metalfisa PCP - Relatório de Importação Engetron', ML, pageHeight - 5);
            }
        });

        doc.save(`${fileName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        throw error;
    }
};
