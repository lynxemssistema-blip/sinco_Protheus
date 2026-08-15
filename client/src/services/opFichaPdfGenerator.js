import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;


/**
 * Generates what we call "Fichas de Operação" (Operation Tickets).
 * This prints one single operation per page, acting as an instruction
 * card and a form for the factory floor operator to fill out.
 * @param {Object} mirrorData - Data returned by /api/pedidos/op-mirror/:id
 */
export const generateOPFichaPdf = (mirrorData) => {
    try {
        if (!mirrorData || !mirrorData.pedido) {
            console.error("Invalid data provided to PDF generator");
            alert("Dados inválidos para geração do PDF de Fichas.");
            return;
        }

        const doc = new jsPDF('portrait', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let pageAdded = false;

        // Loop through each product from the Sales Order
        mirrorData.itens.forEach((itemGroup) => {
            const headerItem = itemGroup.produto_principal;
            if (!headerItem) return;

            // Helper function to draw one Ficha per operation
            const drawFicha = (node, op) => {
                if (!node.op_num || String(node.op_num).trim() === '') return; // Skip if no valid OP

                if (pageAdded) {
                    doc.addPage();
                }
                pageAdded = true;

                // --- HEADER ---
                // Logo Block (Text placeholder)
                doc.setFillColor(30, 58, 95);
                doc.rect(10, 5, 40, 15, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(12);
                doc.text("METALFISA", 30, 14, { align: 'center' });
                doc.setTextColor(0, 0, 0);

                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 58, 95);
                doc.text("FICHA DE OPERAÇÃO", pageWidth / 2, 14, { align: 'center' });

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);
                doc.text(`Data Impressão: ${new Date().toLocaleDateString('pt-BR')}`, 200, 10, { align: 'right' });
                doc.text(`Criado via App MetalFisa`, 200, 15, { align: 'right' });

                doc.setLineWidth(0.5);
                doc.line(10, 22, pageWidth - 10, 22);

                let startY = 28;

                // --- ORDEM DE PRODUÇÃO INFO ---
                doc.setFillColor(240, 240, 240);
                doc.rect(10, startY, pageWidth - 20, 8, 'F');
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text("DADOS DA OP E PEDIDO VINCULADO", 12, startY + 5.5);

                doc.setFont('helvetica', 'normal');
                startY += 12;

                doc.setFont('helvetica', 'bold');
                doc.text("Ordem de Produção (OP):", 12, startY);
                doc.setFont('helvetica', 'normal');
                doc.text(`${node.op_num}`, 60, startY);

                doc.setFont('helvetica', 'bold');
                doc.text("Pedido de Venda (Capa):", 120, startY);
                doc.setFont('helvetica', 'normal');
                doc.text(`${mirrorData.pedido?.pedido || '-'} (Emissão: ${mirrorData.pedido?.emissao || '-'})`, 165, startY);

                startY += 8;

                doc.setFont('helvetica', 'bold');
                doc.text("Cliente:", 12, startY);
                doc.setFont('helvetica', 'normal');
                doc.text(`${mirrorData.pedido?.nome_cliente || '-'}`, 30, startY);

                startY += 12;

                // --- PRODUTO / COMPONENTE ---
                doc.setFillColor(240, 240, 240);
                doc.rect(10, startY, pageWidth - 20, 8, 'F');
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text("PRODUTO E COMPONENTE ALVO", 12, startY + 5.5);

                startY += 12;

                // Shows the final PV product
                doc.setFont('helvetica', 'bold');
                doc.text("Produto Final (Item Pedido):", 12, startY);
                doc.setFont('helvetica', 'normal');
                doc.text(`${headerItem.codigo} - ${headerItem.descricao}`, 65, startY);

                startY += 8;

                // Details the exact component that this operation runs on
                doc.setFont('helvetica', 'bold');
                doc.text("Peça a Operar:", 12, startY);
                doc.setFont('helvetica', 'normal');
                if (node.codigo === headerItem.codigo) {
                    doc.text(`Mesmo produto final acima`, 45, startY);
                } else {
                    doc.text(`[Nível ${node.nivel}] ${node.codigo} - ${node.descricao}`, 45, startY);
                }

                startY += 8;

                // Calculate the QTY logic
                const requiredQty = parseFloat(node.quantidade_calculada || 0).toFixed(2);
                doc.setFont('helvetica', 'bold');
                doc.text("Qtd. a Produzir (Pç/Kg):", 12, startY);
                // Highlight quantity physically
                doc.setFillColor(255, 240, 240);
                doc.rect(55, startY - 4, 30, 6, 'F');
                doc.setTextColor(200, 0, 0); // Red highlighting
                doc.text(`${requiredQty} ${node.unidade}`, 58, startY);
                doc.setTextColor(0, 0, 0);

                startY += 12;

                // --- DETALHES DA OPERAÇÃO ---
                doc.setFillColor(30, 58, 95);
                doc.rect(10, startY, pageWidth - 20, 8, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(`DETALHES DA TAREFA / OPERAÇÃO: [${op.seq}]`, 12, startY + 5.5);
                doc.setTextColor(0, 0, 0);

                startY += 14;

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text("Recurso Associado:", 12, startY);
                doc.setFont('helvetica', 'normal');
                doc.text(`${op.recurso || '-'}`, 50, startY);

                startY += 8;
                doc.setFont('helvetica', 'bold');
                doc.text("Descrição da Operação:", 12, startY);
                doc.setFont('helvetica', 'normal');
                doc.text(`${op.desc_operacao || '-'}`, 55, startY);

                startY += 8;
                doc.setFont('helvetica', 'bold');
                doc.text("Ferramenta Sugerida:", 12, startY);
                doc.setFont('helvetica', 'normal');
                doc.text(`${op.ferramenta && op.ferramenta.trim() !== '' ? op.ferramenta : '- N/A -'}`, 50, startY);

                startY += 12;

                // Tempos Box
                doc.setDrawColor(200, 200, 200);
                doc.rect(10, startY, 90, 15);

                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text("Tempos Padrão do Roteiro (Ref.)", 15, startY + 5);

                doc.setFont('helvetica', 'normal');
                doc.text(`Setup Estimado:     ${op.setup || 0} h`, 15, startY + 11);
                doc.text(`Tempo Padrão:       ${op.tempo_padrao || 0} h`, 55, startY + 11);

                startY += 25;

                // --- CAMPOS PARA PREENCHIMENTO DO OPERADOR ---
                doc.setFillColor(240, 240, 240);
                doc.setDrawColor(0, 0, 0);
                doc.rect(10, startY, pageWidth - 20, 8, 'F');
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text("PREENCHIMENTO DE FÁBRICA (APONTAMENTO)", 12, startY + 5.5);

                startY += 15;

                // Input boxes
                const fieldHeight = 8;

                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');

                doc.text("Data Início:", 12, startY + 5);
                doc.rect(32, startY, 35, fieldHeight);

                doc.text("Hora Início:", 80, startY + 5);
                doc.rect(100, startY, 35, fieldHeight);

                doc.text("Máquina/CC:", 145, startY + 5);
                doc.rect(165, startY, 35, fieldHeight);

                startY += 12;

                doc.text("Data Fim:", 12, startY + 5);
                doc.rect(32, startY, 35, fieldHeight);

                doc.text("Hora Fim:", 80, startY + 5);
                doc.rect(100, startY, 35, fieldHeight);

                startY += 16;
                doc.setLineWidth(0.3);
                doc.line(10, startY - 2, pageWidth - 10, startY - 2); // separator

                doc.setFont('helvetica', 'bold');
                doc.text("Qtd. de Peças Aprovadas:", 12, startY + 5);
                doc.rect(55, startY, 40, fieldHeight);

                doc.text("Qtd. de Refugo (Peças):", 120, startY + 5);
                doc.rect(160, startY, 40, fieldHeight);

                startY += 16;

                doc.setFont('helvetica', 'normal');
                doc.text("Observações na Execução / Motivo Refugo:", 12, startY + 5);
                doc.rect(12, startY + 8, pageWidth - 24, 25);

                startY += 45;

                doc.text("Nome do Operador:", 12, startY);
                doc.line(45, startY, 120, startY);

                doc.text("Matrícula:", 135, startY);
                doc.line(152, startY, 190, startY);

                startY += 15;
                doc.text("Assinatura / Visto:", 12, startY);
                doc.line(45, startY, 120, startY);
            };

            // Process Parent operations
            if (Array.isArray(headerItem.operacoes)) {
                headerItem.operacoes.forEach(op => drawFicha(headerItem, op));
            }

            // Process Child components' operations
            if (Array.isArray(itemGroup.estrutura_linear)) {
                itemGroup.estrutura_linear.forEach((child) => {
                    if (Array.isArray(child.operacoes)) {
                        child.operacoes.forEach(op => drawFicha(child, op));
                    }
                });
            }
        });

        // If no pages were generated, there are no valid OPs or standard operations.
        if (!pageAdded) {
            alert("Nenhuma ficha de operação pôde ser gerada. Verifique se os itens contêm OPs válidas e Roteiros configurados.");
            return;
        }

        const opNumRaw = mirrorData.opNumFromTable || ((mirrorData.items && mirrorData.items.length > 0) ? (mirrorData.items[0].op_num_completa || mirrorData.items[0].op_num || '') : '');
        const opSuffix = opNumRaw ? `_OP_${opNumRaw.replace(/[^a-zA-Z0-9]/g, '')}` : '';
        doc.save(`Fichas_de_Operacao_Pedido_${mirrorData.pedido?.pedido || '000'}${opSuffix}.pdf`);

    } catch (e) {
        console.error("Error drawing OP Fichas PDF:", e);
        alert(`Falha visual no PDF de Fichas: ${e.message}`);
    }
};
