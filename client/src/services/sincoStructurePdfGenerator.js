import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmtQtd = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const generateSincoStructurePdf = (structure, user) => {
    if (!structure || !structure.tree) return;

    const doc = new jsPDF('landscape');
    let currentY = 15;

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Ficha Técnica do Produto (SINCO)", 14, currentY);

    currentY += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Produto Raiz: ${structure.rootCode}`, 14, currentY);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 200, currentY);

    currentY += 5;
    doc.text(`Emitido por: ${user?.nome || user?.login || 'Usuário'}`, 14, currentY);

    currentY += 10;

    const tableData = [];
    const rowTypes = []; // Keep track of row types for styling

    structure.tree.forEach(item => {
        // Main Item Row
        const indent = "   ".repeat(item.nivel);
        tableData.push([
            item.nivel.toString(),
            indent + item.CodMatFabricante,
            item.DescResumo || '',
            item.txtTipoDesenho || '-',
            item.QtdeTotal ? fmtQtd(item.QtdeTotal) : '',
            item.Unidade || '-'
        ]);
        rowTypes.push('ITEM');

        // Processos
        if (item.processos && item.processos.length > 0) {
            item.processos.forEach(proc => {
                tableData.push([
                    '',
                    indent + `  ↳ OP: ${proc.sequence * 10}`,
                    `[PROCESSO] ${proc.processName || proc.processCode || 'INDEFINIDO'}`,
                    '-',
                    proc.timeMin ? `${parseFloat(proc.timeMin)} min` : '-',
                    '-'
                ]);
                rowTypes.push('PROCESSO');
            });
        }

        // Materiais
        if (item.materiais && item.materiais.length > 0) {
            item.materiais.forEach(mat => {
                tableData.push([
                    '',
                    indent + `  ↳ MP: ${mat.materialCode || 'S/COD'}`,
                    `[MATERIAL] ${mat.materialDescDetal || mat.materialDesc || '—'}`,
                    mat.familia || '-',
                    fmtQtd(mat.quantity),
                    mat.unidade || '-'
                ]);
                rowTypes.push('MATERIAL');
            });
        }
    });

    autoTable(doc, {
        startY: currentY,
        head: [['Nível', 'Código', 'Descrição', 'Info / Família', 'Qtde', 'UN']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        didParseCell: function (data) {
            if (data.section === 'body') {
                const type = rowTypes[data.row.index];
                if (type === 'ITEM') {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 248, 255]; // Light blue
                } else if (type === 'PROCESSO') {
                    data.cell.styles.textColor = [100, 100, 100];
                    if (data.column.index === 1 || data.column.index === 2) {
                        data.cell.styles.fontStyle = 'italic';
                    }
                } else if (type === 'MATERIAL') {
                    data.cell.styles.textColor = [50, 50, 50];
                    if (data.column.index === 1 || data.column.index === 2) {
                        data.cell.styles.fontStyle = 'italic';
                    }
                }
            }
        }
    });

    doc.save(`Ficha_Tecnica_${structure.rootCode}.pdf`);
};

export default generateSincoStructurePdf;
