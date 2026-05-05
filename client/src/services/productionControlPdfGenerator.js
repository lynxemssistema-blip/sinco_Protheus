import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateProductionControlPdf = async (ops, filterText = []) => {
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
            docInstance.text('Controle de Produção', ML + logoWidth + 5, 26);

            docInstance.setFontSize(9);
            docInstance.setTextColor(100, 100, 100);
            docInstance.text(`Data Base: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - MR - 40, 20);
            
            docInstance.setDrawColor(200, 200, 200);
            docInstance.line(ML, 32, pageWidth - MR, 32);
            return 38;
        };

        const onDidDrawPage = (data) => {
            if (data.pageNumber === 1) {
                drawHeader(doc, data.pageNumber);
            }
        };

        startY = drawHeader(doc, 1);
        doc.setFontSize(9);
        doc.text(`Filtros Ativos: ${filterText.length > 0 ? filterText.join(' | ') : 'Nenhum'}`, ML, startY + 2);
        startY += 8;

        const tableHead = [['OP / Item', 'Pedido', 'Cliente', 'Produto / Descrição', 'Recurso', 'Planejamento', 'Progresso']];
        const colStyles = {
            0: { cellWidth: 25 },
            1: { cellWidth: 20 },
            2: { cellWidth: 40 },
            3: { cellWidth: 80 },
            4: { cellWidth: 40 },
            5: { cellWidth: 30, halign: 'center' },
            6: { cellWidth: 30, halign: 'center' }
        };

        const formatDate = (dStr) => {
            if (!dStr) return '-';
            try {
                if (typeof dStr === 'string' && dStr.includes('T')) return new Date(dStr).toLocaleDateString('pt-BR');
                if (typeof dStr === 'string' && dStr.includes('-')) return dStr.substring(0, 10).split('-').reverse().join('/');
                return new Date(dStr).toLocaleDateString('pt-BR');
            } catch {
                return '-';
            }
        };

        const mapRow = (row) => {
            const planInicioStr = row.data_planejada_inicio ? formatDate(row.data_planejada_inicio) : '-';
            const planFimStr = row.data_planejada_fim ? formatDate(row.data_planejada_fim) : '-';
            
            const qPlan = parseFloat(row.qtd_planejada_op || 0);
            const qApont = parseFloat(row.qtd_produzida_real || 0);
            const percent = qPlan > 0 ? Math.min(100, Math.round((qApont / qPlan) * 100)) : 0;
            const progressoStr = `${qApont.toFixed(2)} / ${qPlan.toFixed(2)}\n(${percent}%)`;

            return [
                `${row.op || '-'}-${row.item_op || ''} (${row.sequen || ''})`,
                row.pedido_venda || '-',
                row.nome_fantasia || row.nome_cliente || '-',
                `${row.cod_produto_op}\n${row.desc_produto || ''}`,
                `${row.recurso || ''}\n${row.desc_recurso || ''}`,
                `I: ${planInicioStr}\nF: ${planFimStr}`,
                progressoStr
            ];
        };

        // Agrupar por Recurso
        const groups = {};
        ops.forEach(p => {
            const opGroup = `${p.recurso || ''} - ${p.desc_recurso || 'SEM RECURSO DEFINIDO'}`;
            if (!groups[opGroup]) groups[opGroup] = [];
            groups[opGroup].push(p);
        });

        // Ordenar alfabeticamente
        const resources = Object.keys(groups).sort();
        let sumTotalPlan = 0;
        let sumTotalApont = 0;

        resources.forEach((rec, idx) => {
            // Imprimir cabeçalho do Recurso
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 58, 95);
            doc.text(`Recurso: ${rec}`, ML, startY + 2);
            doc.setTextColor(0, 0, 0);

            const groupPlan = groups[rec].reduce((sum, item) => sum + parseFloat(item.qtd_planejada_op || 0), 0);
            const groupApont = groups[rec].reduce((sum, item) => sum + parseFloat(item.qtd_produzida_real || 0), 0);
            sumTotalPlan += groupPlan;
            sumTotalApont += groupApont;

            const tableBody = groups[rec].map(mapRow);
            tableBody.push([
                { content: `TOTAL RECURSO:`, colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: `${groupApont.toFixed(2)} / ${groupPlan.toFixed(2)}`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } }
            ]);

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
            });
            
            startY = doc.lastAutoTable.finalY + 8;
            
            if (idx < resources.length - 1) {
                // Sempre quebrar página por recurso conforme solicitado
                doc.addPage();
                startY = drawHeader(doc, 5);
            }
        });

        // TOTAL GERAL
        if (resources.length > 1) {
            if (startY > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                startY = drawHeader(doc, 5);
            }
            autoTable(doc, {
                startY: startY,
                body: [[
                    { content: 'TOTAL GERAL (TODOS OS RECURSOS):', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [220, 230, 240] } },
                    { content: `${sumTotalApont.toFixed(2)} / ${sumTotalPlan.toFixed(2)}`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [220, 230, 240] } }
                ]],
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
                columnStyles: colStyles,
                margin: { left: ML, right: MR, top: HEADER_H, bottom: 20 },
                didDrawPage: onDidDrawPage,
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

        doc.save(`controle_producao_${new Date().getTime()}.pdf`);
    } catch (err) {
        console.error('Erro ao gerar relatório', err);
        throw err;
    }
};
