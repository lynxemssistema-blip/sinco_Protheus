import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Metafisa logo (Base64) or basic text fallback if image is hard to encode directly here
// For now, we will use a text header similar to the logo, but you can replace this with a base64 string
const METALFISA_LOGO_B64 = ""; // Add base64 here if needed

export const generateOrderPDF = async (orderData) => {
    try {
        // orderData should contain the full order details (capa + itens)
        // Assume orderData = { capa: {...}, itens: [...] }

        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more columns

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // 1. Cabecalho Principal
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);

        // Caixa do cabecalho (x, y, w, h)
        doc.rect(10, 10, pageWidth - 20, 25);

        // Divider linhas verticais cabecalho
        doc.line(60, 10, 60, 35);
        doc.line(160, 10, 160, 35);
        doc.line(220, 10, 220, 35);

        // Logo Area (Left)
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("METALFISA", 15, 20);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text("Transformando metais em excelência", 12, 24);

        // Title Area (Center-Left)
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("PEDIDO DE VENDA", 110, 15, { align: 'center' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text("METALFISA METALURGICA LTDA", 65, 20);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text("END.: R AMERICO SANTIAGO PIACENZA, 516", 65, 24);
        doc.text("CNPJ: 23.881.592/0001-01", 65, 27);
        doc.text("CONTATO: Junia Martins", 65, 30);
        doc.text("E-MAIL: comercial@metalfisa.com.br", 65, 33);

        // Info Area (Center-Right)
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`EMISSÃO: ${formatDate(orderData.capa?.emissao)}`, 165, 15);

        // Add Total counts
        const totalItems = orderData.itens?.length || 0;
        const totalQtd = orderData.itens?.reduce((sum, item) => sum + (Number(item.qtd) || 0), 0) || 0;
        doc.text(`TOTAL ITENS: ${totalItems}`, 165, 20);
        doc.text(`TOTAL PRODUTOS: ${totalQtd}`, 165, 25);

        // Number Area (Right)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`NÚMERO: ${orderData.capa?.pedido || ''}`, 225, 15);
        doc.setFontSize(8);

        // Pedido do Cliente (Client PO)
        doc.text(`PED. CLIENTE: ${orderData.capa?.pedido_cliente || '-'}`, 225, 20);

        // 2. Dados do Cliente
        let yOffset = 38;

        // Cliente Box (Simplified)
        doc.rect(10, yOffset, pageWidth - 20, 10);

        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text("CLIENTE", 12, yOffset + 3);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(String(orderData.capa?.nome_cliente || orderData.capa?.cliente || '').trim(), 12, yOffset + 7.5);

        yOffset += 15;

        // 3. Tabela de Itens (Com Informações Estendidas)
        const tableColumns = [
            "Item",
            "Código",
            "C6_XREVM",
            "Descrição",
            "Situação", // Status
            "OP",
            "Qtd.",
            "UM",
            "Entregue",
            "Saldo",
            "Ped. Cli.",
            "Cód. Prod. Cliente",
            "Rev. Cliente"
        ];

        const tableRows = (orderData.itens || []).map(item => [
            Number(item.item) || item.item, // 01, 02
            item.codigo,
            item.rev_codigo || item.revisao || '', // Metalfisa Rev -> agora C6_XREVM
            item.descricao,
            item.status_tipo_item || 'PCP',
            item.op_num || '-',
            item.qtd,
            item.unidade || 'UN',
            item.qtd_entreg || '0',
            item.qtd_faturar || '0',
            item.ped_cliente || '',
            item.ref_cliente || item.desenho || '', // Cod Cliente -> agora Cód. Prod. Cliente
            item.c6_rev_cliente || item.rev_cliente || '' // Rev Cliente
        ]);

        autoTable(doc, {
            startY: yOffset,
            head: [tableColumns],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                lineColor: [0, 0, 0],
                lineWidth: 0.2,
                fontSize: 6,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle'
            },
            bodyStyles: {
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                fontSize: 6,
                textColor: [0, 0, 0]
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 8 }, // Item
                1: { cellWidth: 30 }, // Codigo
                2: { halign: 'center', cellWidth: 15 }, // XREVM
                3: { cellWidth: 'auto' }, // Descricao
                4: { halign: 'center', cellWidth: 12 }, // Situacao
                5: { halign: 'center', cellWidth: 15 }, // OP
                6: { halign: 'right', cellWidth: 10 }, // Qtd
                7: { halign: 'center', cellWidth: 8 }, // UM
                8: { halign: 'right', cellWidth: 12 }, // Entregue
                9: { halign: 'right', cellWidth: 12 }, // Saldo
                10: { halign: 'center', cellWidth: 15 }, // Ped. Cli.
                11: { halign: 'center', cellWidth: 30 }, // Cod Cliente
                12: { halign: 'center', cellWidth: 15 } // Rev Cliente
            },
            margin: { top: 10, left: 10, right: 10, bottom: 45 }, // Leave room for footer
            didDrawPage: function (data) {
                // Keep footer logic for pagination if needed
            }
        });

        // Current Y position after table
        let finalY = doc.lastAutoTable.finalY + 3;

        // Check if we need a new page for the footer block (takes ~45mm)
        if (finalY + 45 > pageHeight - 10) {
            doc.addPage();
            finalY = 15;
        }

        // 4. Rodapé / Observações (SEM TOTAIS!)
        doc.rect(10, finalY, pageWidth - 20, 40);

        // Small header row inside the box
        doc.line(10, finalY + 8, pageWidth - 10, finalY + 8);

        // Vertical lines for the header row
        doc.line(100, finalY, 100, finalY + 8);
        doc.line(200, finalY, 200, finalY + 8); // Seperador para os títulos vazios e tipo frete

        // Títulos (Transportadora, Cond Pgto, Tipo Frete/Blank)
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text("TRANSPORTADORA", 12, finalY + 4);
        doc.text("COND PGTO", 102, finalY + 4);

        let tpFreteTitle = "TIPO FRETE";
        if (orderData.capa?.tipo_frete === 'C') tpFreteTitle += ": CIF";
        if (orderData.capa?.tipo_frete === 'F') tpFreteTitle += ": FOB";
        doc.text(tpFreteTitle, 202, finalY + 4);

        doc.setFont('helvetica', 'normal');
        doc.text(truncate(orderData.capa?.nome_transportadora || 'PROPRIO CLIENTE', 60), 12, finalY + 7);
        doc.text(truncate(orderData.capa?.condicao_pagamento || '-', 60), 102, finalY + 7);

        // Sidebar for blank boxes - we omit the large right-side columns to keep it clean, but keep a vertical line
        doc.line(pageWidth - 40, finalY + 8, pageWidth - 40, finalY + 40);

        doc.setFont('helvetica', 'bold');
        doc.text("Observações Gerais:", 12, finalY + 12);
        doc.setFont('helvetica', 'normal');

        // Handle long observations
        const obsGerais = String(orderData.capa?.observacoes_gerais || orderData.capa?.obs_nf || orderData.capa?.msg_nota || '').trim();
        const obsLines = doc.splitTextToSize(obsGerais, pageWidth - 60);
        doc.text(obsLines, 12, finalY + 15);

        let nextY = finalY + 16 + (obsLines.length * 3);
        if (nextY < finalY + 22) nextY = finalY + 22;

        doc.setFont('helvetica', 'bold');
        doc.text("Observações:", 12, nextY);
        doc.setFont('helvetica', 'normal');

        // Gather item-level PCP notes
        const itemObsRaw = (orderData.itens || [])
            .filter(i => i.pcp_notes && i.pcp_notes.trim() !== '')
            .map(i => `Item ${Number(i.item) || i.item}: ${i.pcp_notes}`)
            .join(' | ');

        const combinedObs = `PI ${orderData.capa?.pedido || ''} ${itemObsRaw ? '\\n' + itemObsRaw : ''}`;
        const itemObsLines = doc.splitTextToSize(combinedObs.trim(), pageWidth - 60);
        doc.text(itemObsLines, 12, nextY + 3);

        // 5. Ata de Reunião (Project Notes)
        if (orderData.notes && orderData.notes.length > 0) {
            doc.addPage();

            // Header ATA
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("ATA DE REUNIÃO / PENDÊNCIAS DO PROJETO", 15, 20);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`PEDIDO: ${orderData.capa?.pedido || ''} - CLIENTE: ${orderData.capa?.nome_cliente || ''}`, 15, 28);

            doc.line(15, 32, pageWidth - 15, 32);

            let ataY = 40;

            // Group notes by Item
            const dictNotes = {};
            orderData.notes.forEach(note => {
                const key = note.item_number || 'GERAL';
                if (!dictNotes[key]) dictNotes[key] = [];
                dictNotes[key].push(note);
            });

            const keys = Object.keys(dictNotes).sort();

            keys.forEach(k => {
                const groupTitle = k === 'GERAL' ? 'PENDÊNCIAS GERAIS' : `ITEM ${k}`;

                if (ataY > pageHeight - 30) {
                    doc.addPage();
                    ataY = 20;
                }

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setFillColor(230, 230, 230);
                doc.rect(15, ataY, pageWidth - 30, 8, 'F');
                doc.text(groupTitle, 18, ataY + 6);
                ataY += 15;

                const notes = dictNotes[k];
                // Sort by date desc
                notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                notes.forEach(note => {
                    if (ataY > pageHeight - 30) {
                        doc.addPage();
                        ataY = 20;
                    }

                    doc.setFontSize(8);

                    // Meta: Date, Author, Status
                    const strDate = new Date(note.created_at).toLocaleString('pt-BR');
                    const isRes = !!note.is_resolved;
                    const metaText = `${strDate} | Autor: ${note.created_by} | Status: ${isRes ? 'RESOLVIDO' : 'PENDENTE'}`;

                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(isRes ? 40 : 200, isRes ? 140 : 40, 40); // Green if resolved, Red if pending
                    doc.text(metaText, 20, ataY);

                    doc.setTextColor(0, 0, 0);
                    doc.setFont('helvetica', 'normal');
                    ataY += 5;

                    // Body text
                    const noteLines = doc.splitTextToSize(note.note_text || '', pageWidth - 40);
                    doc.text(noteLines, 20, ataY);

                    ataY += (noteLines.length * 4) + 6;
                });

                ataY += 5;
            });
        }

        // Return doc to be downloaded by caller
        doc.save(`Pedido_Venda_${orderData.capa?.pedido || 'relatorio'}.pdf`);

        return true;
    } catch (error) {
        console.error('Error in generateOrderPDF:', error);
        throw error;
    }
};

// Utilities
const formatDate = (val) => {
    if (!val) return '';
    const raw = String(val).trim();
    if (/^\d{8}$/.test(raw)) return raw.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1');
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const [y, m, d] = raw.split('T')[0].split('-');
        return `${d}/${m}/${y}`;
    }
    return raw;
};

const truncate = (str, len) => {
    if (!str) return '';
    const stringified = String(str);
    if (stringified.length <= len) return stringified;
    return stringified.substring(0, len - 3) + '...';
};
