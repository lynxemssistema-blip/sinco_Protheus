import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';

export const generateVerticalPendingPdf = (pendencies, filters, currentUser, groupByResource, pageBreakPerGroup = false) => {
    try {
        const doc = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const ML = 14;
        const MR = 14;

        // --- CABEÇALHO PADRÃO ---
        const drawHeader = (pageDoc, currentY) => {
            let hY = currentY || 5;
            const usableW = pageWidth - ML - MR;
            const hH = 15;

            // Box and lines
            pageDoc.setDrawColor(30, 58, 95);
            pageDoc.setLineWidth(0.3);
            pageDoc.rect(ML, hY, usableW, hH);

            const col1 = ML + 45;   // logo | logo name
            const col2 = ML + 140;  // title | info

            pageDoc.setLineWidth(0.2);
            [col1, col2].forEach(x => pageDoc.line(x, hY, x, hY + hH));

            // Logo Image
            try {
                if (logoBase64) {
                    pageDoc.addImage(logoBase64, 'PNG', ML + 2, hY + 1, 38, 13);
                } else {
                    pageDoc.setFontSize(13);
                    pageDoc.setFont('helvetica', 'bold');
                    pageDoc.setTextColor(30, 58, 95);
                    pageDoc.text('METALFISA', ML + 4, hY + 9);
                }
            } catch(e) {
                // Ignore if image fails
                pageDoc.setFontSize(13);
                pageDoc.setFont('helvetica', 'bold');
                pageDoc.setTextColor(30, 58, 95);
                pageDoc.text('METALFISA', ML + 4, hY + 9);
            }

            pageDoc.setTextColor(0, 0, 0);
            pageDoc.setFontSize(12);
            pageDoc.setFont('helvetica', 'bold');
            pageDoc.text('Relatório Analítico de Operações Pendentes', col1 + 5, hY + 9);

            pageDoc.setFontSize(8);
            pageDoc.setFont('helvetica', 'normal');
            pageDoc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, col2 + 5, hY + 6);
            pageDoc.text(`Usuário: ${currentUser?.nome || 'Sistema'}`, col2 + 5, hY + 11);

            return hY + hH + 5;
        };

        // Altura reservada para o cabeçalho em páginas subsequentes
        const HEADER_H = 25; // 5 topo + 15 box + 5 gap

        // Redesenha cabeçalho em qualquer página gerada pelo autoTable
        const onDidDrawPage = (data) => {
            if (data.pageNumber > 1) {
                drawHeader(doc, 5);
            }
        };

        let startY = drawHeader(doc, 5);

        // --- FILTROS ---
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        let filterText = [];
        if (filters.pedido) filterText.push(`Pedido: ${filters.pedido}`);
        if (filters.op) filterText.push(`OP: ${filters.op}`);
        if (filters.produto) filterText.push(`Produto: ${filters.produto}`);
        if (filters.cliente) filterText.push(`Cliente: ${filters.cliente}`);

        doc.text(`Filtros Ativos: ${filterText.length > 0 ? filterText.join(' | ') : 'Nenhum'}`, ML, startY + 2);
        startY += 8;

        const tableHead = [['Status', 'OP', 'Pedido', 'Entrega', 'Produto / Descrição', 'Progresso', 'Planejamento']];
        const colStyles = {
            0: { cellWidth: 25 },
            1: { cellWidth: 35 },
            2: { cellWidth: 25 },
            3: { cellWidth: 25 },
            4: { cellWidth: 80 },
            5: { cellWidth: 45, halign: 'center' },
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
            const planStr = row.planejamento_inicio ? formatDate(row.planejamento_inicio) : '-';
            const entregaStr = row.entrega ? formatDate(row.entrega) : '-';
            
            const qPlan = parseFloat(row.qtd_op || 0);
            const qApont = parseFloat(row.qtd_apontada || 0);
            const percent = qPlan > 0 ? Math.min(100, Math.round((qApont / qPlan) * 100)) : 0;
            const progressoStr = `${qApont.toFixed(2)} / ${qPlan.toFixed(2)}\n(${percent}%)`;

            return [
                row.status || '-',
                `${row.op || '-'}-${row.item_op || ''} (${row.sequen_op || ''})`,
                row.pedido || '-',
                entregaStr,
                `${row.produto}\n${row.desc_produto || ''}`,
                progressoStr,
                planStr
            ];
        };

        if (groupByResource) {
            // Agrupar por Operação ao invés de Recurso
            const groups = {};
            pendencies.forEach(p => {
                const opGroup = `${p.operacao_codigo || ''} - ${p.operacao_desc || 'SEM OPERAÇÃO DEFINIDA'}`;
                if (!groups[opGroup]) groups[opGroup] = [];
                groups[opGroup].push(p);
            });

            // Sort keys alphabetically
            const resources = Object.keys(groups).sort();
            let sumTotalPlan = 0;
            let sumTotalApont = 0;

            resources.forEach((rec, idx) => {
                // Print Subheader
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 58, 95);
                doc.text(`Operação: ${rec}`, ML, startY + 2);
                doc.setTextColor(0, 0, 0); // reset

                const groupPlan = groups[rec].reduce((sum, item) => sum + parseFloat(item.qtd_op || 0), 0);
                const groupApont = groups[rec].reduce((sum, item) => sum + parseFloat(item.qtd_apontada || 0), 0);
                sumTotalPlan += groupPlan;
                sumTotalApont += groupApont;

                const tableBody = groups[rec].map(mapRow);
                tableBody.push([
                    { content: `TOTAL OPERAÇÃO:`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: `${groupApont.toFixed(2)} / ${groupPlan.toFixed(2)}`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: '-', styles: { halign: 'center', fillColor: [240, 240, 240] } }
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
                    if (pageBreakPerGroup) {
                        doc.addPage();
                        startY = drawHeader(doc, 5);
                    } else if (startY > doc.internal.pageSize.getHeight() - 30) {
                        doc.addPage();
                        startY = drawHeader(doc, 5);
                    }
                }
            });

            // GERAL TOTAL IN GROUPED MODE
            if (resources.length > 1) {
                // Draw grand total box
                if (startY > doc.internal.pageSize.getHeight() - 20) {
                    doc.addPage();
                    startY = drawHeader(doc, 5);
                }
                autoTable(doc, {
                    startY: startY,
                    body: [[
                        { content: 'TOTAL GERAL (TODAS AS OPERAÇÕES):', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [220, 230, 240] } },
                        { content: `${sumTotalApont.toFixed(2)} / ${sumTotalPlan.toFixed(2)}`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [220, 230, 240] } },
                        { content: '-', styles: { halign: 'center', fillColor: [220, 230, 240] } }
                    ]],
                    theme: 'grid',
                    styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
                    columnStyles: colStyles,
                    margin: { left: ML, right: MR, top: HEADER_H, bottom: 20 },
                    didDrawPage: onDidDrawPage,
                });
            }

        } else {
            const totalPlan = pendencies.reduce((sum, item) => sum + parseFloat(item.qtd_op || 0), 0);
            const totalApont = pendencies.reduce((sum, item) => sum + parseFloat(item.qtd_apontada || 0), 0);
            
            const tableBody = pendencies.map(mapRow);
            tableBody.push([
                { content: 'TOTAL GERAL DAS OPERAÇÕES:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: `${totalApont.toFixed(2)} / ${totalPlan.toFixed(2)}`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: '-', styles: { halign: 'center', fillColor: [240, 240, 240] } }
            ]);

            // Plain list
            autoTable(doc, {
                startY: startY,
                head: tableHead,
                body: tableBody,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
                headStyles: { fillColor: [30, 58, 95], textColor: 255 },
                columnStyles: colStyles,
                margin: { left: ML, right: MR, top: HEADER_H, bottom: 20 },
                didDrawPage: onDidDrawPage,
            });
        }

        // --- FOOTER PAGINATION ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - MR, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
            // Let's add the signature at the bottom left
            doc.text(`Gerado via MetalFisa App`, ML, doc.internal.pageSize.getHeight() - 10);
        }

        doc.save(`pendencias_producao_${new Date().getTime()}.pdf`);
    } catch (err) {
        console.error('Erro ao gerar relatório com formatação padrão', err);
        throw err; // allow toast to catch it
    }
};
