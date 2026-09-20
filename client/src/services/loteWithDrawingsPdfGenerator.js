import jsPDFLib from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import api from './api';

const jsPDF = jsPDFLib.jsPDF || jsPDFLib;

const formatDatePCP = (dateStr) => {
    if (!dateStr) return '-';
    const str = String(dateStr).trim();
    if (str.includes('/')) return str;
    if (str.includes('-')) {
        const parts = str.split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    if (str.length === 8 && /^\d+$/.test(str)) {
        return `${str.substring(6, 8)}/${str.substring(4, 6)}/${str.substring(0, 4)}`;
    }
    return str;
};

const drawWatermark = (doc, pedidoNum, clientName) => {
    const clientFirstName = String(clientName || '').trim().split(' ')[0].toUpperCase();
    const watermarkText = `PEDIDO: ${pedidoNum || ''} - ${clientFirstName}`;
    if (typeof doc.saveGraphicsState === 'function') {
        try {
            doc.saveGraphicsState();
            if (typeof doc.GState === 'function') {
                doc.setGState(new doc.GState({ opacity: 0.1 }));
            }
        } catch (e) {}
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(242, 242, 242);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text(watermarkText, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 30 });
    if (typeof doc.restoreGraphicsState === 'function') {
        try {
            doc.restoreGraphicsState();
        } catch (e) {}
    }
};

export const generateLoteWithDrawingsPdf = async (fractionOrders, userName = 'Usuário', codigoLiberacao = null) => {
    try {
        if (!fractionOrders || fractionOrders.length === 0) {
            alert("Nenhum item selecionado para impressão.");
            return null;
        }

        const loteInfo = fractionOrders[0].lote || fractionOrders[0].raw_numero_lote || 'N/A';
        const dataPcp = fractionOrders[0].data_pcp || 'N/A';
        
        let doc = new jsPDF({ format: 'a4', orientation: 'landscape' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const ML = 10;
        const MR = 10;
        const usableW = pageWidth - ML - MR;

        // --- 1. CAPA MASTER (RESUMO DE PRODUTOS E MATERIAIS) ---
        const yOffset = 25;
        
        // Header Base function
        const drawMainHeader = (title) => {
            drawWatermark(doc, loteInfo, "LOTE AGLUTINADO");

            doc.setFillColor(30, 58, 95);
            doc.rect(10, 5, 40, 15, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.text("METALFISA", 30, 14, { align: 'center' });

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(title, pageWidth / 2, 12, { align: 'center' });

            const formattedLoteDate = dataPcp ? formatDatePCP(dataPcp) : '-';

            // Top-right: liberation code badge + user
            if (codigoLiberacao) {
                // Highlighted badge box
                doc.setFillColor(30, 58, 95);
                doc.rect(pageWidth - 62, 4, 54, 9, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8.5);
                doc.setFont('helvetica', 'bold');
                doc.text(codigoLiberacao, pageWidth - 12, 10, { align: 'right' });
                doc.setTextColor(80, 80, 80);
                doc.setFontSize(7.5);
                doc.setFont('helvetica', 'normal');
                doc.text(`Liberado por: ${userName}`, pageWidth - 12, 17, { align: 'right' });

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.text(`Data de Entrega Prevista: ${formattedLoteDate}`, pageWidth - 12, 22, { align: 'right' });
            } else {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text(`EMISSÃO: ${new Date().toLocaleString('pt-BR')}`, pageWidth - 10, 8, { align: 'right' });
                doc.setFont('helvetica', 'bold');
                doc.text(`LOTE: ${loteInfo}`, pageWidth - 10, 13, { align: 'right' });
                doc.text(`Data de Entrega Prevista: ${formattedLoteDate}`, pageWidth - 10, 18, { align: 'right' });
            }
        };

        drawMainHeader("ÍNDICE GERAL — LOTE AGLUTINADO PCP");

        const coverTableData = fractionOrders.map((order, idx) => {
            const dataPcpRaw = order.data_entrega_pcp || order.pcp_delivery_forecast_date || order.data_pcp;
            const dataPcpVal = dataPcpRaw ? new Date(dataPcpRaw).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
            const codProduto = order.cod_produto || order.codigo || order.produto || '-';
            const pedCompra = order.ped_cliente || order.pedido_cliente || order.pedido_compra || '-';
            return [
                idx + 1,
                order.pedido || '-',
                dataPcpVal,
                order.nome_cliente || '-',
                pedCompra,
                order.visual_op || order.op_num || '-',
                codProduto,
                order.descricao || order.desc_produto || '',
                order.visual_qtd || ((order.qtd_faturar || order.quantidade) + '')
            ];
        });

        autoTable(doc, {
            startY: yOffset + 5,
            head: [['#', 'Pedido Venda', 'Data PCP', 'Cliente', 'Ped. Compra', 'OP / Fração', 'Cód. Produto', 'Descrição', 'Qtd Lote']],
            body: coverTableData,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], fontSize: 9 },
            styles: { fontSize: 8 },
            margin: { left: 10, right: 10, bottom: 20 },
            didDrawPage: (data) => drawMainHeader("ÍNDICE GERAL — LOTE AGLUTINADO PCP")
        });


        const operationsMap = new Map();
        const partsWithDrawingsMap = new Map();

        for (const order of fractionOrders) {
            try {
                // Fetch FULL BOM mirror, identical to single OP print (without qtd_lote) to let JS do precise scaling
                const endpoint = `/pedidos/op-mirror/${order.pedido}?item=${order.item}`;
                const mirrorRes = await api.get(endpoint);
                const mirrorData = mirrorRes.data;

                if (mirrorData && mirrorData.itens && mirrorData.itens.length > 0) {
                    const itemGroup = mirrorData.itens.find(i => String(i.item || i.item_pedido).trim() === String(order.item).trim()) || mirrorData.itens[0];
                    
                    // quantidade_venda do nível 0 = quantidade total do pedido de vendas para este item
                    // fractionQty = quantidade_pcp da fração selecionada (order.visual_qtd)
                    const fullOrderQty = parseFloat(itemGroup?.produto_principal?.quantidade_venda || itemGroup?.quantidade_venda || order.qtd_faturar || order.quantidade || 1);
                    const fractionQty = parseFloat(order.visual_qtd || order.qtd || order.quantidade_pcp || fullOrderQty);
                    // Ratio: proporção da fração em relação ao pedido total
                    const ratio = fullOrderQty > 0 ? fractionQty / fullOrderQty : 1;

                    console.log(`[Lote Aglutinado] OP ${order.pedido} item ${order.item}: fullOrderQty=${fullOrderQty} | fractionQty=${fractionQty} | ratio=${ratio}`);

                    const processComponent = (component, parentCode = 'PRODUTO FINAL') => {
                        if (!component) return;
                        const code = component.codigo ? component.codigo.trim() : 'S/COD';
                        const isLevel0 = component.nivel === 0 || component.nivel === undefined;
                        
                        // baseQtd: quantidade total do BOM para o pedido INTEIRO (sem fração)
                        let baseQtd = isLevel0
                            ? parseFloat(component.quantidade_venda || component.quantidade_calculada || component.qtd_total || 0)
                            : parseFloat(component.quantidade_calculada || component.qtd_total || 0);

                        // Aplica o ratio da fração: se o pedido total é 10 e a fração é 3, ratio = 0.3
                        // Para nível 0: é a própria fractionQty
                        // Para filhos: é baseQtd * ratio (proporcional à fração do PCP)
                        let qtyForThisFrac = isLevel0 ? fractionQty : baseQtd * ratio;
                        
                        // Guard for fetching PDF drawings
                        if (!partsWithDrawingsMap.has(code)) {
                            partsWithDrawingsMap.set(code, {
                                codigo: code,
                                descricao: component.descricao || component.desc || component.descricao_produto || '',
                                tipo: component.tipoProduto || component.tipo_produto || component.tipo || '',
                                um: component.unidade || component.um || 'UN',
                                isLevel0,
                                isMaterial: false,
                                qtdFrac: 0,
                                parentCode,
                                nivel: isLevel0 ? 'PAI' : component.nivel,
                                pedidos: new Set()
                            });
                        }
                        const pDraw = partsWithDrawingsMap.get(code);
                        pDraw.qtdFrac += qtyForThisFrac;
                        pDraw.pedidos.add(order.pedido || '-');
                        
                        const codPrefix = code.substring(0, 4).toUpperCase();
                        const isMaterialFallback = ['MTC-', 'MTA-', 'MTT-', 'MTD-', 'MTU-', 'MTE-'].includes(codPrefix);
                        if (code === 'S/COD' || isMaterialFallback || pDraw.tipo === 'MP' || pDraw.tipo === 'MC') {
                            pDraw.isMaterial = true;
                        }

                        if (component.operacoes && Array.isArray(component.operacoes) && component.operacoes.length > 0) {
                            component.operacoes.forEach((op, index) => {
                                const recursoCode = op.recurso ? op.recurso.trim().toUpperCase() : 'S/REC';
                                const descRecurso = op.desc_operacao ? op.desc_operacao.trim().toUpperCase() : '';
                                const key = `${recursoCode} - ${descRecurso}`;

                                let proxOp = 'FINALIZADA';
                                if (index + 1 < component.operacoes.length) {
                                     const nOp = component.operacoes[index + 1];
                                     const rec = nOp.recurso ? nOp.recurso.trim().toUpperCase() : 'INDEFINIDO';
                                     const desc = nOp.desc_operacao ? nOp.desc_operacao.trim().toUpperCase() : '';
                                     proxOp = desc ? `${rec} - ${desc}` : rec;
                                }

                                if (!operationsMap.has(key)) {
                                    operationsMap.set(key, []);
                                }

                                operationsMap.get(key).push({
                                    opVisual: order.visual_op || order.op_num || '-',
                                    pedido: order.pedido,
                                    nivel: isLevel0 ? 'PAI' : component.nivel,
                                    parentCode: parentCode,
                                    codigo: component.codigo,
                                    descricao: component.descricao || component.desc,
                                    um: component.unidade || component.um || 'UN',
                                    qtdFrac: qtyForThisFrac,
                                    proxOp,
                                    operacaoDes: op.desc_operacao,
                                    recursoCode,
                                    descRecurso
                                });
                            });
                        }
                        
                        if (component.estrutura_linear && Array.isArray(component.estrutura_linear)) {
                            component.estrutura_linear.forEach(child => processComponent(child, code));
                        }
                    };
                    
                    if (itemGroup.produto_principal) {
                        processComponent(itemGroup.produto_principal, 'PRODUTO FINAL');
                    }
                    if (itemGroup.estrutura_linear && Array.isArray(itemGroup.estrutura_linear)) {
                        itemGroup.estrutura_linear.forEach(child => processComponent(child, order.produto));
                    }
                }
            } catch (e) {
                console.warn(`Error processing OP ${order.pedido}`, e);
            }
        }

        // --- 2. OPERAÇÕES (ESTILO RASTREABILIDADE) ---
        const allParts = Array.from(partsWithDrawingsMap.values());
        const sortedRecursos = Array.from(operationsMap.keys()).sort();
        
        sortedRecursos.forEach((recursoKey, index) => {
            const items = operationsMap.get(recursoKey);
            const refRecurso = items[0];
            
            // Agrupar itens com o mesmo código, operacao, proxOp
            const groupedListMap = new Map();
            items.forEach(it => {
                const mapKey = `${it.codigo}##${it.parentCode}##${it.proxOp}`;
                if (!groupedListMap.has(mapKey)) {
                    groupedListMap.set(mapKey, { ...it, opVisuais: new Set([it.opVisual]), pedidos: new Set([it.pedido]) });
                } else {
                    const ex = groupedListMap.get(mapKey);
                    ex.qtdFrac += it.qtdFrac;
                    ex.opVisuais.add(it.opVisual);
                    ex.pedidos.add(it.pedido);
                }
            });

            const mergedItems = Array.from(groupedListMap.values()).sort((a,b) => a.codigo.localeCompare(b.codigo));
            
            doc.addPage();

            const drawOpHeader = (data) => {
                // Draw watermark first
                drawWatermark(doc, loteInfo, "LOTE AGLUTINADO");

                // Base Header
                doc.setFillColor(30, 58, 95);
                doc.rect(10, 5, 40, 15, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(12);
                doc.text("METALFISA", 30, 14, { align: 'center' });
                doc.setTextColor(0, 0, 0);

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text("ESPELHO LOTE AGLUTINADO - POR OPERAÇÃO", pageWidth / 2, 12, { align: 'center' });

                const dataGeracaoStr = new Date().toLocaleString('pt-BR');
                const formattedLoteDate = dataPcp ? formatDatePCP(dataPcp) : '-';

                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text(`EMISSÃO: ${dataGeracaoStr}`, pageWidth - 10, 8, { align: 'right' });
                doc.setFont('helvetica', 'bold');
                doc.text(`LOTE ÚNICO: ${loteInfo}`, pageWidth - 10, 13, { align: 'right' });
                doc.text(`Data de Entrega Prevista: ${formattedLoteDate}`, pageWidth - 10, 18, { align: 'right' });

                const locYOffset = 25;

                // Traceability context block (Order/Client) - Persistent
                doc.setFillColor(245, 245, 245);
                doc.setDrawColor(200, 200, 200);
                doc.rect(10, locYOffset, pageWidth - 20, 10, 'FD');

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`Contexto do Lote:`, 12, locYOffset + 6.5);
                doc.setFont('helvetica', 'normal');
                doc.text(`${fractionOrders.length} OP(s) Aglutinadas | Entrega PCP Geral: ${formattedLoteDate}`, 45, locYOffset + 6.5);

                // Operation Title Bar
                doc.setFillColor(60, 141, 188);
                doc.rect(10, locYOffset + 14, pageWidth - 20, 10, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                
                const safeDescRecurso = refRecurso.descRecurso ? ` - ${refRecurso.descRecurso}` : '';
                doc.text(`OPERAÇÃO: ${refRecurso.recursoCode}${safeDescRecurso}`, 12, locYOffset + 21);
                doc.setTextColor(0, 0, 0);

                // Número de página por operação — canto inferior ESQUERDO (global fica à direita)
                if (data && data.pageNumber) {
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(80, 80, 80);
                    doc.text(`Pág. desta Operação: ${data.pageNumber}`, 12, pageHeight - 5);
                    doc.setTextColor(0, 0, 0);
                }
            };

            const tbData = mergedItems.map(c => [
                Array.from(c.pedidos).join(', '),
                c.nivel !== undefined ? c.nivel : '-',
                c.parentCode,
                Array.from(c.opVisuais).join(', '),
                c.codigo,
                c.descricao,
                c.proxOp,
                Number(c.qtdFrac).toFixed(2),
                c.um
            ]);

            autoTable(doc, {
                startY: 53,
                head: [["PVs", "Nível", "Prod. Pai (BOM)", "OPs Envolvidas", "Componente", "Descrição", "Próx. Operação", "Qtd Lote", "UM"]],
                body: tbData,
                theme: 'grid',
                headStyles: {
                    fillColor: [240, 240, 240],
                    textColor: [50, 50, 50],
                    fontStyle: 'bold',
                    fontSize: 8,
                    halign: 'center'
                },
                bodyStyles: { fontSize: 8 },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 20 },
                    1: { halign: 'center', cellWidth: 15 },
                    2: { cellWidth: 35 },
                    3: { halign: 'center', cellWidth: 35 }, // OPs
                    4: { halign: 'center', cellWidth: 25 }, // Componente
                    6: { halign: 'center', cellWidth: 45, fontStyle: 'bold', textColor: [50, 50, 200] }, // Prox Op
                    7: { halign: 'right', fontStyle: 'bold', cellWidth: 25 },
                    8: { halign: 'center', cellWidth: 15 }
                },
                didDrawPage: (data) => drawOpHeader(data),
                margin: { top: 53, left: 10, right: 10, bottom: 20 }
            });
        });

        // --- 3b. RESUMO DE MATERIAIS / INSUMOS (verde) ---
        const materials = allParts.filter(p => p.isMaterial).sort((a, b) => a.codigo.localeCompare(b.codigo));

        if (materials.length > 0) {
            doc.addPage();

            const drawGreenHeader = () => {
                // Draw watermark first
                drawWatermark(doc, loteInfo, "LOTE AGLUTINADO");

                // Barra verde de fundo
                doc.setFillColor(40, 167, 69);
                doc.rect(10, 5, pageWidth - 20, 15, 'F');
                // Logo METALFISA (bloco azul por cima da barra verde)
                doc.setFillColor(30, 58, 95);
                doc.rect(10, 5, 40, 15, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('METALFISA', 30, 14, { align: 'center' });
                // Título centralizado
                doc.setFontSize(13);
                doc.text('LOTE AGLUTINADO - RESUMO DE MATERIAIS / INSUMOS', pageWidth / 2, 12, { align: 'center' });
                
                const formattedLoteDate = dataPcp ? formatDatePCP(dataPcp) : '-';

                // Código de liberação à direita
                if (codigoLiberacao) {
                    doc.setFillColor(30, 58, 95);
                    doc.rect(pageWidth - 62, 4, 54, 9, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(8.5);
                    doc.setFont('helvetica', 'bold');
                    doc.text(codigoLiberacao, pageWidth - 12, 10, { align: 'right' });
                    doc.setTextColor(240, 240, 240);
                    doc.setFontSize(7.5);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`Liberado por: ${userName}`, pageWidth - 12, 17, { align: 'right' });
                    
                    doc.setTextColor(255, 255, 255);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(8.5);
                    doc.text(`Data de Entrega Prevista: ${formattedLoteDate}`, pageWidth - 12, 22, { align: 'right' });
                } else {
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`EMISSÃO: ${new Date().toLocaleString('pt-BR')}`, pageWidth - 12, 8, { align: 'right' });
                    doc.setFont('helvetica', 'bold');
                    doc.text(`LOTE: ${loteInfo}`, pageWidth - 12, 13, { align: 'right' });
                    doc.text(`Data de Entrega Prevista: ${formattedLoteDate}`, pageWidth - 12, 18, { align: 'right' });
                }
                doc.setTextColor(0, 0, 0);
            };

            const matTableData = materials.map(m => [
                m.codigo, m.descricao, m.um,
                Number(m.qtdFrac).toFixed(4).replace(/\.?0+$/, '')
            ]);
            autoTable(doc, {
                startY: 25,
                head: [['Código do Material', 'Descrição', 'UM', 'Qtde Total Necessária']],
                body: matTableData,
                theme: 'grid',
                headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: 'bold', fontSize: 9, halign: 'left' },
                bodyStyles: { fontSize: 8, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 45, fontStyle: 'bold' },
                    1: { cellWidth: 'auto' },
                    2: { halign: 'center', cellWidth: 20 },
                    3: { halign: 'right', cellWidth: 45, fontStyle: 'bold', textColor: [0, 100, 0] }
                },
                margin: { left: 10, right: 10, top: 25, bottom: 20 },
                didDrawPage: () => drawGreenHeader()
            });
        }

        // --- 3c. RESUMO GERAL DE PEÇAS E MATERIAIS (verde - totalizador) ---
        const allPartsSorted = allParts.filter(p => p.qtdFrac > 0).sort((a, b) => a.descricao.localeCompare(b.descricao));

        if (allPartsSorted.length > 0) {
            doc.addPage();

            const drawGreenFullHeader = () => {
                // Draw watermark first
                drawWatermark(doc, loteInfo, "LOTE AGLUTINADO");

                // Barra verde de fundo
                doc.setFillColor(40, 167, 69);
                doc.rect(10, 5, pageWidth - 20, 15, 'F');
                // Logo METALFISA (bloco azul por cima da barra verde)
                doc.setFillColor(30, 58, 95);
                doc.rect(10, 5, 40, 15, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('METALFISA', 30, 14, { align: 'center' });
                // Título centralizado
                doc.setFontSize(13);
                doc.text('RESUMO GERAL DE PEÇAS E MATERIAIS (AGLUTINADO)', pageWidth / 2, 12, { align: 'center' });
                
                const formattedLoteDate = dataPcp ? formatDatePCP(dataPcp) : '-';

                // Código de liberação à direita
                if (codigoLiberacao) {
                    doc.setFillColor(30, 58, 95);
                    doc.rect(pageWidth - 62, 4, 54, 9, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(8.5);
                    doc.setFont('helvetica', 'bold');
                    doc.text(codigoLiberacao, pageWidth - 12, 10, { align: 'right' });
                    doc.setTextColor(240, 240, 240);
                    doc.setFontSize(7.5);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`Liberado por: ${userName}`, pageWidth - 12, 17, { align: 'right' });
                    
                    doc.setTextColor(255, 255, 255);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(8.5);
                    doc.text(`Data de Entrega Prevista: ${formattedLoteDate}`, pageWidth - 12, 22, { align: 'right' });
                } else {
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`EMISSÃO: ${new Date().toLocaleString('pt-BR')}`, pageWidth - 12, 8, { align: 'right' });
                    doc.setFont('helvetica', 'bold');
                    doc.text(`LOTE: ${loteInfo}`, pageWidth - 12, 13, { align: 'right' });
                    doc.text(`Data de Entrega Prevista: ${formattedLoteDate}`, pageWidth - 12, 18, { align: 'right' });
                }
                doc.setTextColor(0, 0, 0);
            };
            drawGreenFullHeader();

            const allPartsRows = allPartsSorted.map(p => [
                p.codigo, p.descricao, p.um,
                Number(p.qtdFrac).toFixed(4).replace(/\.?0+$/, '')
            ]);
            autoTable(doc, {
                startY: 25,
                head: [['Código', 'Descrição do Material / Peça', 'UM', 'Qtde Total Necessária']],
                body: allPartsRows,
                theme: 'grid',
                headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: 'bold', fontSize: 9, halign: 'left' },
                bodyStyles: { fontSize: 8, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 40, fontStyle: 'bold' },
                    1: { cellWidth: 'auto' },
                    2: { halign: 'center', cellWidth: 20 },
                    3: { halign: 'right', cellWidth: 40, fontStyle: 'bold', textColor: [0, 100, 0] }
                },
                margin: { left: 10, right: 10, top: 25, bottom: 20 },
                didDrawPage: () => drawGreenFullHeader()
            });
        }

        // Numeração global de páginas com metadados no rodapé
        const numPages = doc.internal.getNumberOfPages();
        const emissaoStr = new Date().toLocaleString('pt-BR');
        for (let i = 1; i <= numPages; i++) {
            doc.setPage(i);
            const pgStr = `Pág. ${i} de ${numPages}`;

            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);

            // Right: page number
            doc.text(pgStr, pageWidth - 10, pageHeight - 5, { align: 'right' });

            // Left: date/time | lote | user
            doc.text(`Emissão: ${emissaoStr}   |   Lote: ${loteInfo}   |   Usuário: ${userName}`, 10, pageHeight - 5);

            doc.setTextColor(0, 0, 0);
        }

        const coverBuffer = doc.output('arraybuffer');
        
        // --- 4. MERGE DRAWINGS ---
        const mergedPdf = await PDFDocument.create();
        const fontStamp = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
        
        // Copy all cover/operation pages first
        const coverPdfDoc = await PDFDocument.load(coverBuffer, { ignoreEncryption: true });
        const coverPages = await mergedPdf.copyPages(coverPdfDoc, coverPdfDoc.getPageIndices());
        coverPages.forEach(page => mergedPdf.addPage(page));

        // Only fabricated parts (not raw materials) can have engineering drawings
        const partsSummaryArray = allParts.filter(p => !p.isMaterial);

        // Step 1: Discover which parts have PDF drawings (parallel)
        await Promise.all(partsSummaryArray.map(async (part) => {
            try {
                const docsResult = await api.get(`/docs/${encodeURIComponent(part.codigo.trim())}`);
                const drawing = docsResult.data.find(d =>
                    (d.tipo === 'Desenho' || (d.titulo && d.titulo.toLowerCase().includes('desenho')))
                    && d.url_arquivo.toLowerCase().endsWith('.pdf')
                );
                if (drawing) {
                    part.hasPdf = true;
                    part.pdfUrl = drawing.url_arquivo;
                } else {
                    part.hasPdf = false;
                }
            } catch (err) {
                part.hasPdf = false;
            }
        }));

        // Step 2: Fetch each drawing via api proxy (supports auth/network share), stamp and append
        const clientNameMap = new Map();
        fractionOrders.forEach(o => {
            if (o.pedido && o.nome_cliente) {
                const fName = String(o.nome_cliente).trim().split(' ')[0].toUpperCase();
                clientNameMap.set(String(o.pedido).trim(), fName);
            }
        });

        const dataGeracao = new Date().toLocaleString('pt-BR');
        const partsWithDrawings = partsSummaryArray.filter(p => p.hasPdf && p.pdfUrl);

        for (const part of partsWithDrawings) {
            try {
                const fileUrl = `/docs/view?path=${encodeURIComponent(part.pdfUrl)}`;
                const response = await api.get(fileUrl, { responseType: 'arraybuffer' });
                const drawingDoc = await PDFDocument.load(response.data, { ignoreEncryption: true });
                const copiedPages = await mergedPdf.copyPages(drawingDoc, drawingDoc.getPageIndices());

                const roundedQtd = Number(part.qtdFrac);
                const finalQtdStr = roundedQtd % 1 === 0 ? roundedQtd.toString() : roundedQtd.toFixed(2);
                const loteCodeSafe = codigoLiberacao || loteInfo || 'LOTE AGLUTINADO';

                // Marca d'água limpa e focada no Lote PCP
                const watermarkText = `LOTE: ${loteCodeSafe} - METALFISA PCP`;

                // Carimbo da Garantia da Qualidade: Focado no Lote e Quantidade Total Consolidada
                const textLine1 = `CÓPIA CONTROLADA | METALFISA GARANTIA DA QUALIDADE | DATA: ${dataGeracao} | USUÁRIO: ${userName}`;
                const textLine2 = `CÓD: ${part.codigo} | LOTE: ${loteCodeSafe} | DATA PCP: ${dataPcp ? formatDatePCP(dataPcp) : '-'} | QTD TOTAL A FABRICAR: ${finalQtdStr} ${part.um || 'UN'}`;

                for (const page of copiedPages) {
                    mergedPdf.addPage(page);
                    const { width, height } = page.getSize();
                    const minSide = Math.min(width, height);
                    const scale = Math.max(1, minSide / 595);

                    // Draw Watermark in the middle
                    const watermarkFontSize = 26 * scale;
                    const textWidth = fontStamp.widthOfTextAtSize(watermarkText, watermarkFontSize);
                    const textHeight = fontStamp.heightAtSize(watermarkFontSize);
                    page.drawText(watermarkText, {
                        x: (width - textWidth) / 2,
                        y: (height - textHeight) / 2,
                        size: watermarkFontSize,
                        font: fontStamp,
                        color: rgb(0.9, 0.9, 0.9),
                        opacity: 0.12,
                        rotate: degrees(30)
                    });

                    const rectWidth = 470 * scale;
                    const rectHeight = 35 * scale;
                    const fontSize = 8 * scale;
                    const offsetY = 45 * scale;

                    page.drawRectangle({
                        x: 10 * scale,
                        y: height - offsetY,
                        width: rectWidth,
                        height: rectHeight,
                        color: rgb(1, 1, 1),
                        borderColor: rgb(0.8, 0.1, 0.1),
                        borderWidth: 1 * scale,
                    });
                    page.drawText(textLine1, {
                        x: 15 * scale,
                        y: height - offsetY + (19 * scale),
                        size: fontSize,
                        font: fontStamp,
                        color: rgb(0.8, 0.1, 0.1),
                    });
                    page.drawText(textLine2, {
                        x: 15 * scale,
                        y: height - offsetY + (6 * scale),
                        size: fontSize,
                        font: fontStamp,
                        color: rgb(0.8, 0.1, 0.1),
                    });
                }
            } catch (e) {
                console.warn(`[Lote Aglutinado] Erro ao carregar desenho para ${part.codigo}:`, e.message);
            }
        }

        const pdfBytes = await mergedPdf.save();
        return pdfBytes;
    } catch (error) {
        console.error("Error generating Batch PDF:", error);
        throw error;
    }
};
