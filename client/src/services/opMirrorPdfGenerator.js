import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';


/**
 * Generates what we call "Espelho da Ordem de Produção" (OP Mirror).
 * This prints the structural BOM and standard Routing Operations (SG2) 
 * multiplied by the Sales order Quantity.
 * @param {Object} mirrorData - Data returned by /api/pedidos/op-mirror/:id
 */
export const generateOPMirrorPdf = (mirrorData) => {
    try {
        if (!mirrorData || !mirrorData.pedido) {
            console.error("Invalid data provided to PDF generator");
            alert("Dados inválidos para geração do PDF.");
            return;
        }

        const doc = new jsPDF('portrait', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();

        // 1. HEADER (Same as Sales Order)
        // Logo Block (Text placeholder)
        doc.setFillColor(30, 58, 95);
        doc.rect(10, 5, 40, 15, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text("METALFISA", 30, 14, { align: 'center' });
        doc.setTextColor(0, 0, 0);

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("ESPELHO DA ORDEM DE PRODUÇÃO", pageWidth / 2, 12, { align: 'center' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`EMISSÃO: ${mirrorData.pedido?.emissao || ''}`, 225, 10);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`NÚMERO PEDIDO: ${mirrorData.pedido?.pedido || ''}`, 225, 15);

        // 2. CLIENT DATA
        let yOffset = 25;

        // Cliente Box
        doc.rect(10, yOffset, pageWidth - 20, 10);

        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text("CLIENTE", 12, yOffset + 3);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        let clientStr = String(mirrorData.pedido?.nome_cliente || '').trim();
        if (mirrorData.pedido?.cgc_cliente) clientStr += ` - CNPJ: ${mirrorData.pedido.cgc_cliente.trim()}`;
        doc.text(clientStr, 12, yOffset + 7.5);

        yOffset += 15;

        // 3. RENDER EACH FINISHED GOOD (ITEM PV) AND ITS BOM/OPS
        mirrorData.itens.forEach((itemGroup, idx) => {
            if (idx > 0) {
                // Determine if we need a page break before the next item
                if (yOffset > 240) {
                    doc.addPage();
                    yOffset = 20;
                } else {
                    yOffset += 10;
                }
            }

            const headerItem = itemGroup.produto_principal;
            if (!headerItem) return;

            // Header Section for the Final Product
            doc.setFillColor(30, 58, 95); // Metalfisa blue
            doc.rect(10, yOffset, pageWidth - 20, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`Item ${itemGroup.item_pedido}: ${headerItem.codigo} - ${headerItem.descricao}`, 12, yOffset + 5.5);

            const opText = headerItem.op_num ? `[OP: ${headerItem.op_num}] ` : '';
            doc.text(`${opText}Qtd. a Produzir: ${headerItem.quantidade_venda} ${headerItem.unidade}`, pageWidth - 12, yOffset + 5.5, { align: 'right' });

            yOffset += 8;
            doc.setTextColor(0, 0, 0); // Reset

            // Format table data for this item structure
            const tableColumns = [
                "Nível",
                "Componente / Operação",
                "Descrição",
                "Qtd. Un",
                "Qtd. Total",
                "UM",
            ];

            const tableRows = [];

            // Helper to recursively add rows (Actually in our query they come flattened and ordered by level/parent)
            // But we can build them visually here:

            const addOperations = (operacoes, levelString, opNum) => {
                if (Array.isArray(operacoes) && operacoes.length > 0) {
                    operacoes.forEach(op => {
                        const opText = opNum && opNum.trim() !== '' ? `   ➜ [OP ${op.seq}] [NumOP: ${opNum}] ${op.recurso || ''}` : `   ➜ [OP ${op.seq}] ${op.recurso || ''}`;
                        tableRows.push([
                            "", // Nivel empty for operation
                            { content: opText, styles: { fontStyle: 'italic', textColor: [50, 100, 150] } },
                            { content: op.desc_operacao || '-', styles: { fontStyle: 'italic', textColor: [50, 100, 150] } },
                            // Just info columns for Operations
                            { content: `S: ${op.setup || 0}h`, styles: { fontStyle: 'italic', halign: 'center', textColor: [50, 100, 150] } },
                            { content: `T: ${op.tempo_padrao || 0}h`, styles: { fontStyle: 'italic', halign: 'center', textColor: [50, 100, 150] } },
                            ""
                        ]);
                    });
                }
            };

            // 1. Add Parent product operations
            addOperations(headerItem.operacoes, "0", headerItem.op_num);

            // 2. Add Children recursively
            itemGroup.estrutura_linear.forEach((child) => {
                let prefix = "";
                for (let i = 0; i < child.nivel; i++) prefix += "   "; // Indentation

                // BOM Line
                tableRows.push([
                    child.nivel.toString(),
                    { content: prefix + (child.nivel > 1 ? "└ " : "") + child.codigo, styles: { fontStyle: child.nivel === 1 ? 'bold' : 'normal' } },
                    { content: child.descricao, styles: { fontStyle: child.nivel === 1 ? 'bold' : 'normal' } },
                    { content: (parseFloat(child.quantidade_calculada) / parseFloat(headerItem.quantidade_venda)).toFixed(2), styles: { halign: 'right' } },
                    { content: parseFloat(child.quantidade_calculada).toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: child.unidade, styles: { halign: 'center' } }
                ]);

                // Ops Line for this child
                addOperations(child.operacoes, child.nivel.toString(), child.op_num);
            });

            if (tableRows.length === 0) {
                tableRows.push([{ content: "Nenhuma estrutura (BOM) ou roteiro encontrados para este produto.", colSpan: 6, styles: { halign: 'center', fontStyle: 'italic', textColor: [100, 100, 100] } }]);
            }

            autoTable(doc, {
                startY: yOffset,
                head: [tableColumns],
                body: tableRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [240, 240, 240], // Light gray header
                    textColor: [50, 50, 50],
                    lineColor: [200, 200, 200],
                    lineWidth: 0.1,
                    fontSize: 7,
                    fontStyle: 'bold',
                    halign: 'center',
                    valign: 'middle'
                },
                bodyStyles: {
                    lineColor: [200, 200, 200],
                    lineWidth: 0.1,
                    fontSize: 7,
                    textColor: [0, 0, 0]
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 }, // Nivel
                    1: { cellWidth: 50 }, // Componente
                    2: { cellWidth: 'auto' }, // Descricao
                    3: { halign: 'right', cellWidth: 20 }, // Qtd Un
                    4: { halign: 'right', cellWidth: 20 }, // Qtd Tot
                    5: { halign: 'center', cellWidth: 10 }, // UM
                },
                margin: { top: 10, left: 10, right: 10, bottom: 20 }
            });

            // Update yOffset for the next Item PV
            yOffset = doc.lastAutoTable.finalY + 5;
        });

        // Add page numbers at the bottom right
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - 20, doc.internal.pageSize.getHeight() - 10);

            // Signature / Report date
            const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            doc.text(`MetalFisa - App Gerado em: ${dataGeracao}`, 10, doc.internal.pageSize.getHeight() - 10);
        }

        doc.save(`Espeho_OP_Pedido_${mirrorData.pedido?.pedido || 'desconhecido'}.pdf`);

    } catch (e) {
        console.error("Error drawing OP Mirror PDF:", e);
        alert(`Falha visual no PDF: ${e.message}`);
    }
};
