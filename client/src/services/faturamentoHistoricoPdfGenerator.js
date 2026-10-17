import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';
import { getCompanyLegalName, getCompanyShortName, getCompanyAddressCnpjLine, getCompanyTagline } from './companyBranding';

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return dateStr;
};

export const generateFaturamentoHistoricoPdf = (viewMode, rows, includeValues = true) => {
    try {
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const ML = 10;
        const MR = 10;
        const usableW = pageWidth - ML - MR;

        let reportTitle = 'RELATÓRIO DE FATURAMENTO';
        if (viewMode === 'tabela_solicitacoes') reportTitle = 'RELATÓRIO DE SOLICITAÇÕES DE FATURAMENTO';
        if (viewMode === 'tabela_produtos') reportTitle = 'RELATÓRIO DE FATURAMENTO (AGRUPADO POR PRODUTO)';

        const drawHeader = () => {
            const hY = 8;
            const hH = 16;
            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.rect(ML, hY, usableW, hH);

            const col1 = ML + 45;
            const col2 = ML + 135;
            const col3 = ML + 180;
            doc.setLineWidth(0.2);
            [col1, col2, col3].forEach(x => doc.line(x, hY, x, hY + hH));

            // Logo Block
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', ML + 2, hY + 1.5, 38, 13);
            } else {
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.text(getCompanyShortName(), ML + 4, hY + 6);
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'normal');
                doc.text(getCompanyTagline(), ML + 4, hY + 10);
            }

            // Company Block
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.text(getCompanyLegalName(), col1 + 3, hY + 5.5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text(getCompanyAddressCnpjLine(), col1 + 3, hY + 9.5);
            doc.text('Faturamento Histórico', col1 + 3, hY + 13.5);

            // Emission Block
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.text('EMISSÃO:', col2 + 3, hY + 5.5);
            doc.setFont('helvetica', 'normal');
            doc.text(new Date().toLocaleDateString('pt-BR'), col2 + 20, hY + 5.5);

            // Title Block
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(reportTitle, col3 + (usableW - (col3 - ML)) / 2, hY + 5.5, { align: 'center' });
            doc.setFontSize(8);
            doc.text(`Total: ${rows.length} registros`, col3 + (usableW - (col3 - ML)) / 2, hY + 10.5, { align: 'center' });
            
            return hY + hH + 4;
        };

        const tableStartY = drawHeader();

        let tableColumns = [];
        let tableRows = [];
        let colStyles = {};

        if (viewMode === 'tabela') {
            tableColumns = includeValues 
                ? ['Data Emissão', 'NF', 'Cliente', 'Pedido', 'Cód. Produtos', 'Quantidade', 'Vlr Total', 'Status']
                : ['Data Emissão', 'NF', 'Cliente', 'Pedido', 'Cód. Produtos', 'Quantidade', 'Status'];
            tableRows = rows.map(r => {
                const base = [
                    r.emissao,
                    `${r.nota}${r.serie ? ` S.${r.serie}` : ''}`,
                    r.cliente,
                    r.pedido,
                    r.codigo_produto,
                    parseFloat(r.quantidade).toLocaleString('pt-BR')
                ];
                if (includeValues) {
                    base.push(parseFloat(r.valor_total) > 0 ? `R$ ${parseFloat(r.valor_total).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '-');
                }
                base.push(r.status);
                return base;
            });
            colStyles = includeValues ? {
                0: { halign: 'center', cellWidth: 25 },
                1: { halign: 'center', cellWidth: 30 },
                2: { halign: 'left',   cellWidth: 60 },
                3: { halign: 'center', cellWidth: 25 },
                4: { halign: 'left',   cellWidth: 40 },
                5: { halign: 'right',  cellWidth: 25 },
                6: { halign: 'right',  cellWidth: 30 },
                7: { halign: 'center', cellWidth: 30 }
            } : {
                0: { halign: 'center', cellWidth: 25 },
                1: { halign: 'center', cellWidth: 35 },
                2: { halign: 'left',   cellWidth: 70 },
                3: { halign: 'center', cellWidth: 30 },
                4: { halign: 'left',   cellWidth: 45 },
                5: { halign: 'right',  cellWidth: 30 },
                6: { halign: 'center', cellWidth: 35 }
            };
        } else if (viewMode === 'tabela_solicitacoes') {
            tableColumns = includeValues
                ? ['Número', 'Data Criação', 'Clientes', 'NFs', 'Cód. Produtos', 'Total Itens', 'Valor Total', 'Status']
                : ['Número', 'Data Criação', 'Clientes', 'NFs', 'Cód. Produtos', 'Total Itens', 'Status'];
            tableRows = rows.map(r => {
                const base = [
                    r.numero_solicitacao,
                    r.emissao,
                    r.clientes,
                    r.nfs || '-',
                    r.codigos || '-',
                    r.total_itens
                ];
                if (includeValues) {
                    base.push(r.valor_total > 0 ? `R$ ${r.valor_total.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '-');
                }
                base.push(r.status);
                return base;
            });
            colStyles = includeValues ? {
                0: { halign: 'center', cellWidth: 25 },
                1: { halign: 'center', cellWidth: 25 },
                2: { halign: 'left',   cellWidth: 60 },
                3: { halign: 'left',   cellWidth: 30 },
                4: { halign: 'left',   cellWidth: 50 },
                5: { halign: 'right',  cellWidth: 25 },
                6: { halign: 'right',  cellWidth: 30 },
                7: { halign: 'center', cellWidth: 25 }
            } : {
                0: { halign: 'center', cellWidth: 25 },
                1: { halign: 'center', cellWidth: 30 },
                2: { halign: 'left',   cellWidth: 70 },
                3: { halign: 'left',   cellWidth: 40 },
                4: { halign: 'left',   cellWidth: 60 },
                5: { halign: 'right',  cellWidth: 25 },
                6: { halign: 'center', cellWidth: 25 }
            };
        } else if (viewMode === 'tabela_produtos') {
            tableColumns = includeValues
                ? ['Cód. Produto', 'Qtd Total', 'Vlr Total', 'Pedidos', 'NFs', 'Clientes', 'Datas Emissão']
                : ['Cód. Produto', 'Qtd Total', 'Pedidos', 'NFs', 'Clientes', 'Datas Emissão'];
            tableRows = rows.map(r => {
                const base = [
                    r.codigo_produto,
                    parseFloat(r.quantidade).toLocaleString('pt-BR')
                ];
                if (includeValues) {
                    base.push(parseFloat(r.valor_total) > 0 ? `R$ ${parseFloat(r.valor_total).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '-');
                }
                base.push(r.pedidos, r.notas, r.clientes, r.emissao);
                return base;
            });
            colStyles = includeValues ? {
                0: { halign: 'left',   cellWidth: 35 },
                1: { halign: 'right',  cellWidth: 25 },
                2: { halign: 'right',  cellWidth: 30 },
                3: { halign: 'left',   cellWidth: 40 },
                4: { halign: 'left',   cellWidth: 40 },
                5: { halign: 'left',   cellWidth: 60 },
                6: { halign: 'center', cellWidth: 35 }
            } : {
                0: { halign: 'left',   cellWidth: 40 },
                1: { halign: 'right',  cellWidth: 25 },
                2: { halign: 'left',   cellWidth: 50 },
                3: { halign: 'left',   cellWidth: 50 },
                4: { halign: 'left',   cellWidth: 70 },
                5: { halign: 'center', cellWidth: 35 }
            };
        }

        autoTable(doc, {
            startY: tableStartY,
            head: [tableColumns],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 58, 138],
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
            columnStyles: colStyles,
            margin: { top: 28, left: ML, right: MR, bottom: 20 },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) {
                    drawHeader();
                }
            },
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120, 120, 120);
            doc.text(`Pág. ${i} de ${pageCount}`, pageWidth - MR, pageHeight - 5, { align: 'right' });
            doc.setTextColor(0, 0, 0);
        }

        const now = new Date();
        const dataStr = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
        const horaStr = now.toLocaleTimeString('pt-BR').replace(/:/g, '-');
        const fileName = `Relatorio_Faturamento_${dataStr}_${horaStr}.pdf`;
        doc.save(fileName);
        return true;
    } catch (error) {
        console.error('Erro ao gerar PDF do histórico de faturamento:', error);
        throw error;
    }
};
