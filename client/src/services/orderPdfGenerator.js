import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanyLegalName, getCompanyShortName, getCompanyAddressCnpjLine, getCompanyContactLine, getCompanyTagline } from './companyBranding';
// Force Vite HMR reload - 2026-07-28

export const generateOrderPDF = async (orderData, returnBuffer = false, batchContext = null) => {
    try {
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4 = 297 × 210 mm

        const pageWidth  = doc.internal.pageSize.getWidth();  // 297
        const pageHeight = doc.internal.pageSize.getHeight(); // 210
        const ML = 10; // margem esquerda
        const MR = 10; // margem direita
        const usableW = pageWidth - ML - MR; // 277 mm

        // ── 1. CABEÇALHO ──────────────────────────────────────────────────────
        // Caixa total do cabeçalho compactada (16 mm de altura)
        const hY = 8;
        const hH = 16;
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.rect(ML, hY, usableW, hH);

        // Divisórias verticais: logo | empresa | info central | nº pedido
        const col1 = ML + 52;   // logo → empresa
        const col2 = ML + 165;  // empresa → info central
        const col3 = ML + 222;  // info central → nº pedido
        doc.setLineWidth(0.2);
        [col1, col2, col3].forEach(x => doc.line(x, hY, x, hY + hH));

        // ── Bloco LOGO / Empresa curta
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(getCompanyShortName(), ML + 4, hY + 6);
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.text(getCompanyTagline(), ML + 4, hY + 10);

        // ── Bloco EMPRESA
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(getCompanyLegalName(), col1 + 3, hY + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text(getCompanyAddressCnpjLine(), col1 + 3, hY + 9.5);
        doc.text(getCompanyContactLine(), col1 + 3, hY + 13.5);

        // ── Bloco INFO CENTRAL (emissão, entrega geral, totais)
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.text('EMISSÃO:', col2 + 3, hY + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(orderData.capa?.emissao), col2 + 20, hY + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.text('ENTREGA:', col2 + 3, hY + 9.5);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(orderData.capa?.entrega), col2 + 20, hY + 9.5);

        const filteredItensForTot = (batchContext && batchContext.item) 
            ? (orderData.itens || []).filter(i => String(Number(i.item) || i.item) === String(batchContext.item))
            : (orderData.itens || []);
        const totalItems = filteredItensForTot.length || 0;
        const totalQtd   = filteredItensForTot.reduce((s, i) => s + (Number(i.qtd) || 0), 0) || 0;
        doc.setFont('helvetica', 'bold');
        doc.text(`ITENS: ${totalItems}`, col2 + 3, hY + 13.5);
        if (batchContext && batchContext.visual_qtd) {
            doc.text(`QTD LOTE: ${batchContext.visual_qtd}`, col2 + 20, hY + 13.5);
        } else {
            doc.text(`QTD TOTAL: ${totalQtd}`, col2 + 20, hY + 13.5);
        }

        // ── Bloco Nº PEDIDO / PED. CLIENTE
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(batchContext ? 'ORDEM DE PRODUÇÃO' : 'PEDIDO DE VENDA', col3 + (usableW - (col3 - ML)) / 2, hY + 5.5, { align: 'center' });
        doc.setFontSize(8);
        doc.text(`Nº ${batchContext ? batchContext.visual_op : orderData.capa?.pedido || ''}`, col3 + (usableW - (col3 - ML)) / 2, hY + 10.5, { align: 'center' });
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        
        if (batchContext && batchContext.data_pcp) {
            doc.setTextColor(200, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text(`ENTREGA PCP: ${formatDate(batchContext.data_pcp)}`, col3 + (usableW - (col3 - ML)) / 2, hY + 14.5, { align: 'center' });
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
        } else {
            doc.text(`PED. CLI: ${orderData.capa?.pedido_cliente || '-'}`, col3 + (usableW - (col3 - ML)) / 2, hY + 14.5, { align: 'center' });
        }

        // ── 2. CAIXA CLIENTE ──────────────────────────────────────────────────
        const cliY = hY + hH + 2;
        const cliH = 8;
        doc.setLineWidth(0.3);
        doc.rect(ML, cliY, usableW, cliH);

        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('CLIENTE', ML + 2, cliY + 3);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(
            String(orderData.capa?.nome_cliente || orderData.capa?.cliente || '').trim(),
            ML + 2, cliY + 6.5
        );

        // ── 3. TABELA DE ITENS ────────────────────────────────────────────────
        // A4 landscape usableW = 277 mm. Otimizado as larguras.
        const tableStartY = cliY + cliH + 2;

        const tableColumns = [
            'Item',          // 0
            'Código',        // 1
            'Rev. MF',       // 2
            'Descrição',     // 3 (auto)
            'Tipo',          // 4
            'OP',            // 5
            'Qtd.',          // 6
            'UM',            // 7
            'Dt. Entrega',   // 8
            'Entregue',      // 9
            'Saldo',         // 10
            'Ped. Cli.',     // 11
            'Cód. Cliente',  // 12
            'Rev. Cli.',     // 13
        ];

        const filteredItens = (batchContext && batchContext.item) 
            ? (orderData.itens || []).filter(i => String(Number(i.item) || i.item) === String(batchContext.item))
            : (orderData.itens || []);

        const tableRows = filteredItens.map(item => {
            let displayedQtd = item.qtd || '0';
            if (batchContext && batchContext.is_fraction && batchContext.visual_qtd && item.item === batchContext.item) {
                displayedQtd = `${batchContext.visual_qtd}`;
            }
            return [
                Number(item.item) || item.item,
                item.codigo                           || '',
                item.rev_codigo || item.revisao       || '',
                item.descricao                        || '',
                item.status_tipo_item                 || 'PCP',
                batchContext && item.item === batchContext.item ? batchContext.visual_op : (item.op_num || '-'),
                displayedQtd,
                item.unidade                          || 'UN',
                batchContext && item.item === batchContext.item ? formatDate(batchContext.data_pcp) : (formatDate(item.c6_entreg || item.entrega) || '-'),
                item.qtd_entreg                       || '0',
                item.qtd_faturar                      || '0',
                item.ped_cliente                      || '',
                item.ref_cliente || item.desenho      || '',
                item.c6_rev_cliente || item.rev_cliente || '',
            ];
        });

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
                fontSize: 6,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                cellPadding: 1.2,
            },
            bodyStyles: {
                lineColor: [180, 180, 180],
                lineWidth: 0.1,
                fontSize: 6,
                textColor: [0, 0, 0],
                cellPadding: 1.2,
            },
            alternateRowStyles: {
                fillColor: [248, 249, 250],
            },
            columnStyles: {
                0:  { halign: 'center', cellWidth: 7    },  // Item
                1:  { halign: 'left',   cellWidth: 26   },  // Código
                2:  { halign: 'center', cellWidth: 10   },  // Rev. MF
                3:  { halign: 'left',   cellWidth: 'auto' }, // Descrição — preenche restante
                4:  { halign: 'center', cellWidth: 10   },  // Tipo
                5:  { halign: 'center', cellWidth: 15   },  // OP
                6:  { halign: 'right',  cellWidth: 10   },  // Qtd
                7:  { halign: 'center', cellWidth: 8    },  // UM
                8:  { halign: 'center', cellWidth: 16   },  // Dt. Entrega
                9:  { halign: 'right',  cellWidth: 12   },  // Entregue
                10: { halign: 'right',  cellWidth: 10   },  // Saldo
                11: { halign: 'center', cellWidth: 15   },  // Ped. Cli.
                12: { halign: 'center', cellWidth: 25   },  // Cód. Cliente
                13: { halign: 'center', cellWidth: 13   },  // Rev. Cli.
            },
            margin: { top: 8, left: ML, right: MR, bottom: 38 },
            didDrawPage: (data) => {
                // Número de página no rodapé
                const pgStr = `Pág. ${doc.internal.getCurrentPageInfo().pageNumber}`;
                doc.setFontSize(6);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(120, 120, 120);
                doc.text(pgStr, pageWidth - MR, pageHeight - 5, { align: 'right' });
                
                // Data de alteração e usuário no rodapé (esquerda)
                if (orderData.capa?.data_alteracao) {
                    const dtStr = `Última Alteração: ${orderData.capa.data_alteracao}${orderData.capa.usuario_alteracao ? ' por ' + orderData.capa.usuario_alteracao : ''}`;
                    doc.text(dtStr, ML, pageHeight - 5);
                }
                doc.setTextColor(0, 0, 0);
            },
        });

        // ── 4. RODAPÉ (Transportadora / Cond. Pgto / Observações) ─────────────
        let finalY = doc.lastAutoTable.finalY + 2;

        // Observações gerais e de itens (compactado)
        const obsGerais = String(orderData.capa?.observacoes_gerais || orderData.capa?.obs_nf || orderData.capa?.msg_nota || '').trim();
        const itemObsRaw = (orderData.itens || [])
            .filter(i => i.pcp_notes && i.pcp_notes.trim())
            .map(i => `Item ${Number(i.item) || i.item}: ${i.pcp_notes}`)
            .join('  |  ');
        
        const combinedObs = `PI ${orderData.capa?.pedido || ''}${itemObsRaw ? '  ' + itemObsRaw : ''}`;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        
        const obsLines = obsGerais ? doc.splitTextToSize(obsGerais, usableW - 20) : [];
        const itemObsLines = combinedObs.trim() ? doc.splitTextToSize(combinedObs.trim(), usableW - 22) : [];
        
        // Calculate needed footer height dynamically
        const obsLineHeight = 3.0; // 3 mm per line
        let neededFooterH = 8; // Base height of the Transportadora box (7 mm + 1 mm padding)
        
        let obsHeight = 0;
        if (obsLines.length > 0) {
            obsHeight += (obsLines.length * obsLineHeight) + 3; // text height + padding
        }
        if (itemObsLines.length > 0) {
            obsHeight += (itemObsLines.length * obsLineHeight) + 3; // text height + padding
        }
        if (obsLines.length > 0 && itemObsLines.length > 0) {
            obsHeight += 2; // gap between sections
        }
        
        // Add the observation section height to neededFooterH
        if (obsHeight > 0) {
            neededFooterH += obsHeight + 2; // plus bottom margin inside box
        } else {
            neededFooterH = 15; // default fallback if no observations
        }

        const footerH = Math.max(25, neededFooterH); 
        if (finalY + footerH > pageHeight - 8) {
            doc.addPage();
            finalY = 12;
        }

        doc.setLineWidth(0.3);
        doc.rect(ML, finalY, usableW, footerH);

        // Linha horizontal separando transportadora das observacoes
        doc.setLineWidth(0.2);
        doc.line(ML, finalY + 7, ML + usableW, finalY + 7);

        // Divisórias verticais: transp | cond pgto | tipo frete
        const fc1 = ML + 95;
        const fc2 = ML + 185;
        doc.line(fc1, finalY, fc1, finalY + 7);
        doc.line(fc2, finalY, fc2, finalY + 7);

        // Labels
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text('TRANSPORTADORA', ML + 2, finalY + 4);
        doc.text('COND. PAGTO', fc1 + 2, finalY + 4);

        let freteLabel = 'TIPO FRETE';
        if (orderData.capa?.tipo_frete === 'C') freteLabel += ': CIF';
        else if (orderData.capa?.tipo_frete === 'F') freteLabel += ': FOB';
        doc.text(freteLabel, fc2 + 2, finalY + 4);

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text(truncate(orderData.capa?.nome_transportadora || 'PRÓPRIO CLIENTE', 55), ML + 2, finalY + 6);
        doc.text(truncate(orderData.capa?.condicao_pagamento || '-', 55), fc1 + 2, finalY + 6);

        // Renderiza Obs Gerais primeiro (se tiver), senão pula pra Obs Itens
        let curObsY = finalY + 11;
        doc.setFontSize(6); // Ensure font size is 6 (which matches the splitTextToSize calculation!)
        if (obsGerais) {
            doc.setFont('helvetica', 'bold');
            doc.text('Obs. Gerais:', ML + 2, curObsY);
            doc.setFont('helvetica', 'normal');
            doc.text(obsLines, ML + 20, curObsY);
            curObsY += (obsLines.length * 3) + 2;
        }

        if (combinedObs.trim()) {
            doc.setFont('helvetica', 'bold');
            doc.text('Observações:', ML + 2, curObsY);
            doc.setFont('helvetica', 'normal');
            doc.text(itemObsLines, ML + 22, curObsY);
        }


        // ── 5. ATA DE REUNIÃO ─────────────────────────────────────────────────
        if (orderData.notes && orderData.notes.length > 0) {
            doc.addPage();

            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('ATA DE REUNIÃO / PENDÊNCIAS DO PROJETO', ML, 18);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(
                `PEDIDO: ${orderData.capa?.pedido || ''}  —  CLIENTE: ${orderData.capa?.nome_cliente || ''}`,
                ML, 25
            );
            doc.setLineWidth(0.3);
            doc.line(ML, 29, pageWidth - MR, 29);

            let ataY = 36;

            const dictNotes = {};
            orderData.notes.forEach(note => {
                const key = note.item_number || 'GERAL';
                if (!dictNotes[key]) dictNotes[key] = [];
                dictNotes[key].push(note);
            });

            Object.keys(dictNotes).sort().forEach(k => {
                if (ataY > pageHeight - 30) { doc.addPage(); ataY = 20; }

                const groupTitle = k === 'GERAL' ? 'PENDÊNCIAS GERAIS' : `ITEM ${k}`;
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setFillColor(220, 220, 220);
                doc.rect(ML, ataY, usableW, 7, 'F');
                doc.text(groupTitle, ML + 3, ataY + 5);
                ataY += 12;

                const notes = dictNotes[k].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                notes.forEach(note => {
                    if (ataY > pageHeight - 30) { doc.addPage(); ataY = 20; }

                    const isRes = !!note.is_resolved;
                    const metaText = `${new Date(note.created_at).toLocaleString('pt-BR')}  |  Autor: ${note.created_by}  |  ${isRes ? 'RESOLVIDO' : 'PENDENTE'}`;
                    doc.setFontSize(7.5);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(isRes ? 30 : 180, isRes ? 120 : 30, 30);
                    doc.text(metaText, ML + 4, ataY);
                    doc.setTextColor(0, 0, 0);
                    doc.setFont('helvetica', 'normal');
                    ataY += 4;

                    const noteLines = doc.splitTextToSize(note.note_text || '', usableW - 12);
                    doc.text(noteLines, ML + 4, ataY);
                    ataY += (noteLines.length * 4) + 5;
                });
                ataY += 4;
            });
        }

        doc.save(`Pedido_Venda_${orderData.capa?.pedido || 'relatorio'}.pdf`);
        return true;
    } catch (error) {
        console.error('Erro ao gerar PDF do pedido:', error);
        throw error;
    }
};

// ── Utilitários ───────────────────────────────────────────────────────────────
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
    const s = String(str);
    return s.length <= len ? s : s.substring(0, len - 3) + '...';
};
