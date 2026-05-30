import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatDateBR = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

export const generateTaxaOcupacaoPdf = async (viewMode, data) => {
    try {
        const doc = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const ML = 15;
        const MR = 15;
        const HEADER_H = 35;
        let startY = HEADER_H;

        const drawHeader = (docInstance, pageNum) => {
            const logoWidth = 25;
            docInstance.setFontSize(16);
            docInstance.setFont('helvetica', 'bold');
            docInstance.setTextColor(30, 58, 95);
            docInstance.text('MetalFisa', ML + logoWidth + 5, 20);

            docInstance.setFontSize(12);
            docInstance.setFont('helvetica', 'normal');
            docInstance.setTextColor(0, 0, 0);
            
            let title = 'Taxa de Ocupação';
            if (viewMode === 'table') title += ' - Visão Detalhada';
            else if (viewMode === 'heatmap') title += ' - Mapa de Calor';
            else if (viewMode === 'gantt') title += ' - Visão Gráfica';

            docInstance.text(title, ML + logoWidth + 5, 26);

            docInstance.setFontSize(9);
            docInstance.setTextColor(100, 100, 100);
            docInstance.text(`Data Base: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - MR - 40, 20);
            
            docInstance.setDrawColor(200, 200, 200);
            docInstance.line(ML, 32, pageWidth - MR, 32);
            return 38;
        };

        const onDidDrawPage = (dataObj) => {
            if (dataObj.pageNumber === 1) {
                drawHeader(doc, dataObj.pageNumber);
            }
        };

        startY = drawHeader(doc, 1);

        if (viewMode === 'table') {
            const groupedByDate = {};
            data.forEach(item => {
                if (!groupedByDate[item.data]) groupedByDate[item.data] = [];
                groupedByDate[item.data].push(item);
            });
            const sortedDates = Object.keys(groupedByDate).sort();

            const tableHead = [['Recurso / C.T.', 'Capacidade (Min)', 'Demanda (Min)', 'Ocupação (%)']];
            const colStyles = {
                0: { cellWidth: 100 },
                1: { cellWidth: 40, halign: 'center' },
                2: { cellWidth: 40, halign: 'center' },
                3: { cellWidth: 40, halign: 'center' }
            };

            sortedDates.forEach((dateStr, idx) => {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 58, 95);
                doc.text(`Data Início (Planejada): ${formatDateBR(dateStr)}`, ML, startY + 2);
                doc.setTextColor(0, 0, 0);

                const tableBody = groupedByDate[dateStr].map(item => [
                    `${item.recurso_descri} (Cod: ${item.recurso_codigo})`,
                    Number(item.capacidade_diaria || 0).toFixed(2),
                    Number(item.demanda_minutos || 0).toFixed(2),
                    `${Number(item.taxa_ocupacao || 0).toFixed(1)}%`
                ]);

                if (tableBody.length === 0) {
                    tableBody.push([{ content: 'Nenhuma carga programada', colSpan: 4, styles: { halign: 'center', textColor: [150,150,150] } }]);
                }

                autoTable(doc, {
                    startY: startY + 4,
                    head: tableHead,
                    body: tableBody,
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
                    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
                    columnStyles: colStyles,
                    margin: { left: ML, right: MR, top: HEADER_H, bottom: 20 },
                    didDrawPage: onDidDrawPage,
                    willDrawCell: (data) => {
                        if (data.section === 'body' && data.column.index === 3) {
                            const val = parseFloat(data.cell.raw);
                            if (val > 100) {
                                doc.setFillColor(254, 226, 226); // red-50
                            }
                        }
                    }
                });
                
                startY = doc.lastAutoTable.finalY + 8;
            });
        } 
        else if (viewMode === 'heatmap') {
            const allDatesSet = new Set();
            const allResourcesMap = {};
            data.forEach(item => {
                allDatesSet.add(item.data);
                if (!allResourcesMap[item.recurso_codigo]) {
                    allResourcesMap[item.recurso_codigo] = { descri: item.recurso_descri, dates: {} };
                }
                allResourcesMap[item.recurso_codigo].dates[item.data] = item;
            });
            
            const allDates = Array.from(allDatesSet).sort();
            const resources = Object.keys(allResourcesMap).sort((a,b) => allResourcesMap[a].descri.localeCompare(allResourcesMap[b].descri));

            const maxCols = 15; // To avoid text squishing, break into multiple tables if too many dates
            for (let chunkStart = 0; chunkStart < allDates.length; chunkStart += maxCols) {
                const datesChunk = allDates.slice(chunkStart, chunkStart + maxCols);
                
                const tableHead = [['Recurso / Máquina', ...datesChunk.map(d => formatDateBR(d).substring(0, 5))]];
                
                const tableBody = resources.map(resCode => {
                    const row = [`${allResourcesMap[resCode].descri} (${resCode})`];
                    datesChunk.forEach(d => {
                        const cellItem = allResourcesMap[resCode].dates[d];
                        row.push(cellItem ? `${Number(cellItem.taxa_ocupacao).toFixed(1)}%` : '-');
                    });
                    return row;
                });

                if (chunkStart > 0) {
                    doc.addPage();
                    startY = drawHeader(doc, doc.internal.getNumberOfPages());
                }

                autoTable(doc, {
                    startY: startY,
                    head: tableHead,
                    body: tableBody,
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 2, valign: 'middle', halign: 'center' },
                    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
                    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
                    margin: { left: ML, right: MR, top: HEADER_H, bottom: 20 },
                    didDrawPage: onDidDrawPage,
                    willDrawCell: (data) => {
                        if (data.section === 'body' && data.column.index > 0) {
                            if (data.cell.raw && data.cell.raw !== '-') {
                                const val = parseFloat(data.cell.raw);
                                if (val > 100) doc.setFillColor(254, 226, 226);
                                else if (val >= 80) doc.setFillColor(254, 240, 138); // yellow-200
                                else if (val > 0) doc.setFillColor(220, 252, 231); // green-100
                            }
                        }
                    }
                });
                
                startY = doc.lastAutoTable.finalY + 8;
            }
        }
        else if (viewMode === 'gantt') {
            const allResourcesMap = {};
            data.forEach(item => {
                if (!allResourcesMap[item.recurso_codigo]) {
                    allResourcesMap[item.recurso_codigo] = { descri: item.recurso_descri, items: [] };
                }
                allResourcesMap[item.recurso_codigo].items.push(item);
            });
        
            const resources = Object.keys(allResourcesMap).sort((a,b) => allResourcesMap[a].descri.localeCompare(allResourcesMap[b].descri));

            const tableHead = [['Data', 'Capacidade (Min)', 'Demanda (Min)', 'Ocupação (%)']];
            
            resources.forEach((resCode, idx) => {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 58, 95);
                doc.text(`Recurso: ${allResourcesMap[resCode].descri} (${resCode})`, ML, startY + 2);
                doc.setTextColor(0, 0, 0);

                const resItems = allResourcesMap[resCode].items.sort((a,b) => a.data.localeCompare(b.data));

                const tableBody = resItems.map(item => [
                    formatDateBR(item.data),
                    Number(item.capacidade_diaria || 0).toFixed(2),
                    Number(item.demanda_minutos || 0).toFixed(2),
                    `${Number(item.taxa_ocupacao || 0).toFixed(1)}%`
                ]);

                autoTable(doc, {
                    startY: startY + 4,
                    head: tableHead,
                    body: tableBody,
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
                    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
                    columnStyles: {
                        1: { halign: 'center' },
                        2: { halign: 'center' },
                        3: { halign: 'center' }
                    },
                    margin: { left: ML, right: MR, top: HEADER_H, bottom: 20 },
                    didDrawPage: onDidDrawPage,
                    willDrawCell: (data) => {
                        if (data.section === 'body' && data.column.index === 3) {
                            const val = parseFloat(data.cell.raw);
                            if (val > 100) {
                                doc.setFillColor(254, 226, 226);
                            }
                        }
                    }
                });
                
                startY = doc.lastAutoTable.finalY + 8;
                
                if (startY > doc.internal.pageSize.getHeight() - 40 && idx < resources.length - 1) {
                    doc.addPage();
                    startY = drawHeader(doc, doc.internal.getNumberOfPages());
                }
            });
        }

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - MR, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
            doc.text(`Gerado via MetalFisa App`, ML, doc.internal.pageSize.getHeight() - 10);
        }

        doc.save(`taxa_ocupacao_${viewMode}_${new Date().getTime()}.pdf`);
    } catch (err) {
        console.error('Erro ao gerar relatório', err);
        throw err;
    }
};
