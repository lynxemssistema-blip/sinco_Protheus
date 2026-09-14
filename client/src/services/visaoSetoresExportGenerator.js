import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { logoBase64 } from './metalfisaLogoBase64.js';
import { toast } from 'react-toastify';

// ─── Helpers de Formatação ───────────────────────────────────────────────────

const formatDateBR = (iso) => {
    if (!iso) return '—';
    try {
        const str = String(iso).trim().split('T')[0];
        if (str.includes('-')) {
            const [y, m, d] = str.split('-');
            return `${d}/${m}/${y}`;
        }
        if (str.length === 8 && /^\d+$/.test(str)) {
            const y = str.substring(0, 4);
            const m = str.substring(4, 6);
            const d = str.substring(6, 8);
            return `${d}/${m}/${y}`;
        }
        return str;
    } catch {
        return iso;
    }
};

const formatNumberBR = (num, decimals = 0) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

const getAgrupamentoLabel = (agrupamento) => {
    switch (agrupamento) {
        case 'item': return 'Produto / Item';
        case 'pai': return 'Produto Pai';
        case 'op': return 'Ordem de Produção (OP)';
        default: return 'Pedido de Venda';
    }
};

// ─── Processamento dos Dados da Matriz ───────────────────────────────────────

export const processMatrizData = (data, agrupamento = 'pedido') => {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return { setoresHeaders: [], pedidosRows: [], setoresRaw: [] };
    }

    const headers = data.map(s => ({
        id: s.id,
        nome: s.nome,
        cor: s.cor || '#3b82f6'
    }));

    const map = {};
    data.forEach(setor => {
        (setor.ops || []).forEach(op => {
            let groupKey;
            let displayTitle;
            let displaySubtitle;

            const codProd = (op.cod_produto_op || '').trim();
            const descProd = (op.desc_produto || '').trim();
            const codPai = (op.produto_pai || '').trim();
            const descPai = (op.desc_produto_pai || '').trim();
            const numOp = (op.op || '').trim();
            const numPv = (op.pedido_venda || '').trim();
            const nomeCli = (op.nome_cliente || '').trim();

            if (agrupamento === 'item') {
                groupKey = `OP${numOp}_IT${op.item_op || '01'}_${codProd}`;
                displayTitle = codProd || `Produto Desconhecido`;
                displaySubtitle = `OP: ${numOp} | Item: ${op.item_op || '01'} | ${descProd}`;
            } else if (agrupamento === 'pai') {
                groupKey = `OP${numOp}_PAI_${codPai || codProd}`;
                displayTitle = codPai || codProd || `Pai Desconhecido`;
                displaySubtitle = `OP: ${numOp} | ${descPai || descProd}`;
            } else if (agrupamento === 'op') {
                groupKey = `OP_${numOp}`;
                displayTitle = `OP ${numOp} — ${codProd}`;
                displaySubtitle = `${descProd ? descProd + ' | ' : ''}Ped: ${numPv || 'N/A'} - ${nomeCli || 'Sem cliente'}`;
            } else {
                groupKey = numPv || `OP-${numOp}`;
                displayTitle = numPv ? `Pedido ${numPv}` : `OP ${numOp}`;
                displaySubtitle = nomeCli || 'Sem cliente associado';
            }

            if (!map[groupKey]) {
                map[groupKey] = {
                    groupKey,
                    title: displayTitle,
                    subtitle: displaySubtitle,
                    pedido: numPv || '—',
                    cliente: nomeCli || '—',
                    prazo: op.prazo_entrega_pedido,
                    setoresData: {},
                    romaneios: [],
                    produtosMap: {}, // cod -> desc
                    paisMap: {}, // cod -> desc
                    opsSet: new Set()
                };
            }

            if (codProd) map[groupKey].produtosMap[codProd] = descProd || map[groupKey].produtosMap[codProd] || '';
            if (codPai) map[groupKey].paisMap[codPai] = descPai || map[groupKey].paisMap[codPai] || '';
            if (numOp) map[groupKey].opsSet.add(numOp);

            if (op.romaneios && op.romaneios.length > 0) {
                op.romaneios.forEach(r => {
                    if (!map[groupKey].romaneios.some(x => x.romaneio_id === r.romaneio_id)) {
                        map[groupKey].romaneios.push(r);
                    }
                });
            }

            if (!map[groupKey].setoresData[setor.id]) {
                map[groupKey].setoresData[setor.id] = { esperada: 0, apontada: 0 };
            }

            map[groupKey].setoresData[setor.id].esperada += (Number(op.qtd_esperada_setor) || 0);
            map[groupKey].setoresData[setor.id].apontada += (Number(op.qtd_apontada_setor) || 0);
        });
    });

    const rows = Object.values(map).map(r => {
        const prodEntries = Object.entries(r.produtosMap);
        const paiEntries = Object.entries(r.paisMap);
        const prodsStr = prodEntries.map(([c, d]) => d ? `${c} (${d})` : c).join('; ');
        const prodsCodes = prodEntries.map(([c]) => c).join(', ');
        const prodsDescs = prodEntries.map(([, d]) => d).filter(Boolean).join('; ');
        const paisStr = paiEntries.map(([c, d]) => d ? `${c} (${d})` : c).join('; ');
        const opsStr = Array.from(r.opsSet).join(', ');

        return {
            ...r,
            produtosDetalhes: prodsStr || '—',
            produtosCodigos: prodsCodes || '—',
            produtosDescricoes: prodsDescs || '—',
            paisDetalhes: paisStr || '—',
            opsTexto: opsStr || '—'
        };
    }).sort((a, b) => String(a.title).localeCompare(String(b.title)));

    return { setoresHeaders: headers, pedidosRows: rows, setoresRaw: data };
};

// ─── GERADOR DE PDF (jsPDF) ───────────────────────────────────────────────────

export const exportVisaoSetoresPdf = async (rawSetoresData, filters = {}, targetSetorId = null) => {
    try {
        const { setoresHeaders, pedidosRows, setoresRaw } = processMatrizData(rawSetoresData, filters.agrupamento);

        if (pedidosRows.length === 0) {
            toast.warning('Nenhum dado para exportação em PDF.');
            return;
        }

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const ML = 8;
        const MR = 8;
        const HDR_H = 22;
        const BRAND_W = 44;
        const LOGO_W = 12;
        const LOGO_H = 12;

        const isSpecificSetor = targetSetorId && targetSetorId !== 'all';
        const targetSetorObj = isSpecificSetor ? setoresRaw.find(s => String(s.id) === String(targetSetorId)) : null;

        const reportTitle = targetSetorObj 
            ? `PCP - DIRECIONAMENTO DO SETOR: ${targetSetorObj.nome.toUpperCase()}`
            : `PCP - VISÃO DE DIRECIONAMENTO DE PRODUTOS POR SETORES (FÁBRICA)`;

        const filterSummary = [
            `Agrupamento: ${getAgrupamentoLabel(filters.agrupamento)}`,
            filters.pedido ? `Pedidos: ${filters.pedido}` : null,
            filters.cliente ? `Cliente: ${filters.cliente}` : null,
            filters.produto ? `Produto: ${filters.produto}` : null,
            filters.data_inicio ? `De: ${formatDateBR(filters.data_inicio)}` : null,
            filters.data_fim ? `Até: ${formatDateBR(filters.data_fim)}` : null,
            filters.status ? `Status: ${filters.status}` : null
        ].filter(Boolean).join(' | ');

        const drawHeader = (docInstance, pageNum, totalPages) => {
            const y0 = 6;

            // Brand block (Dark Navy #1E3A5F)
            docInstance.setFillColor(30, 58, 95);
            docInstance.rect(ML, y0, BRAND_W, HDR_H, 'F');

            if (logoBase64) {
                try {
                    docInstance.addImage(logoBase64, 'PNG', ML + 2, y0 + 2, LOGO_W, LOGO_H);
                } catch (e) {}
            }

            docInstance.setFont('helvetica', 'bold');
            docInstance.setFontSize(9);
            docInstance.setTextColor(255, 255, 255);
            docInstance.text('METALFISA', ML + 16, y0 + 9);
            docInstance.setFont('helvetica', 'normal');
            docInstance.setFontSize(6.5);
            docInstance.text('Metalúrgica Ltda', ML + 16, y0 + 13.5);

            // Title block (#F8FAFC)
            docInstance.setFillColor(248, 250, 252);
            docInstance.rect(ML + BRAND_W, y0, pageWidth - ML - MR - BRAND_W, HDR_H, 'F');
            docInstance.setDrawColor(226, 232, 240);
            docInstance.rect(ML + BRAND_W, y0, pageWidth - ML - MR - BRAND_W, HDR_H, 'S');

            const blockCenter = ML + BRAND_W + (pageWidth - ML - MR - BRAND_W) / 2;
            docInstance.setFont('helvetica', 'bold');
            docInstance.setFontSize(11);
            docInstance.setTextColor(30, 58, 95);
            docInstance.text(reportTitle, blockCenter, y0 + 8.5, { align: 'center' });

            docInstance.setFont('helvetica', 'normal');
            docInstance.setFontSize(7.5);
            docInstance.setTextColor(100, 116, 139);
            docInstance.text(filterSummary || 'Todos os registros filtrados', blockCenter, y0 + 15, { align: 'center' });

            // Timestamp and Page
            docInstance.setFontSize(7);
            docInstance.setTextColor(148, 163, 184);
            const dataEmissao = new Date().toLocaleString('pt-BR');
            docInstance.text(`Gerado em: ${dataEmissao}`, pageWidth - MR - 4, y0 + 8.5, { align: 'right' });
            if (totalPages) {
                docInstance.text(`Pág. ${pageNum} / ${totalPages}`, pageWidth - MR - 4, y0 + 15, { align: 'right' });
            }
        };

        if (isSpecificSetor && targetSetorObj) {
            // ─────────────────────────────────────────────────────────────────
            // MODO 1: VISÃO ESPECÍFICA DO SETOR SELECIONADO
            // ─────────────────────────────────────────────────────────────────
            const opsSetor = targetSetorObj.ops || [];
            const tableColumns = [
                { header: 'Pedido', dataKey: 'pedido' },
                { header: 'Cliente', dataKey: 'cliente' },
                { header: 'OP', dataKey: 'op' },
                { header: 'Item', dataKey: 'item' },
                { header: 'Cód. Produto', dataKey: 'produto' },
                { header: 'Descrição do Produto', dataKey: 'descricao' },
                { header: 'Produto Pai', dataKey: 'pai' },
                { header: 'Qtd Esp.', dataKey: 'esperada' },
                { header: 'Qtd Apt.', dataKey: 'apontada' },
                { header: 'Saldo', dataKey: 'saldo' },
                { header: '% Avanço', dataKey: 'progresso' },
                { header: 'Prazo', dataKey: 'prazo' },
                { header: 'Romaneio', dataKey: 'romaneio' }
            ];

            let totEsp = 0;
            let totApt = 0;

            const tableRows = opsSetor.map(op => {
                const esp = Number(op.qtd_esperada_setor) || 0;
                const apt = Number(op.qtd_apontada_setor) || 0;
                const saldo = Math.max(0, esp - apt);
                const prog = esp > 0 ? Math.round((apt / esp) * 100) : 0;
                totEsp += esp;
                totApt += apt;

                const romaneiosStr = (op.romaneios || []).map(r => `#${r.romaneio_id}`).join(', ') || '—';

                return {
                    pedido: op.pedido_venda || '—',
                    cliente: op.nome_cliente || '—',
                    op: op.op,
                    item: op.item_op || '01',
                    produto: op.cod_produto_op || '—',
                    descricao: op.desc_produto || '—',
                    pai: op.produto_pai ? `${op.produto_pai}${op.desc_produto_pai ? ' (' + op.desc_produto_pai + ')' : ''}` : '—',
                    esperada: formatNumberBR(esp),
                    apontada: formatNumberBR(apt),
                    saldo: formatNumberBR(saldo),
                    progresso: `${prog}%`,
                    prazo: formatDateBR(op.prazo_entrega_pedido),
                    romaneio: romaneiosStr
                };
            });

            const totSaldo = Math.max(0, totEsp - totApt);
            const totProg = totEsp > 0 ? Math.round((totApt / totEsp) * 100) : 0;

            autoTable(doc, {
                columns: tableColumns,
                body: tableRows,
                startY: 32,
                margin: { left: ML, right: MR, bottom: 12 },
                theme: 'grid',
                headStyles: {
                    fillColor: [30, 58, 95],
                    textColor: [255, 255, 255],
                    fontSize: 7.2,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                styles: {
                    fontSize: 6.8,
                    cellPadding: 1.6,
                    valign: 'middle',
                    overflow: 'linebreak'
                },
                columnStyles: {
                    pedido: { cellWidth: 16, fontStyle: 'bold', textColor: [30, 58, 95] },
                    cliente: { cellWidth: 28 },
                    op: { cellWidth: 16, fontStyle: 'bold', halign: 'center' },
                    item: { cellWidth: 9, halign: 'center' },
                    produto: { cellWidth: 24, fontStyle: 'bold' },
                    descricao: { cellWidth: 'auto' },
                    pai: { cellWidth: 26, fontSize: 6.2 },
                    esperada: { cellWidth: 15, halign: 'right' },
                    apontada: { cellWidth: 15, halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] },
                    saldo: { cellWidth: 15, halign: 'right', fontStyle: 'bold', textColor: [239, 68, 68] },
                    progresso: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
                    prazo: { cellWidth: 16, halign: 'center' },
                    romaneio: { cellWidth: 16, halign: 'center', fontSize: 6.2 }
                },
                foot: [[
                    { content: 'TOTAL DO SETOR', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: formatNumberBR(totEsp), styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: formatNumberBR(totApt), styles: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] } },
                    { content: formatNumberBR(totSaldo), styles: { halign: 'right', fontStyle: 'bold', textColor: [239, 68, 68] } },
                    { content: `${totProg}%`, styles: { halign: 'center', fontStyle: 'bold' } },
                    { content: '', colSpan: 2 }
                ]],
                footStyles: {
                    fillColor: [241, 245, 249],
                    textColor: [15, 23, 42],
                    fontSize: 7.2
                },
                didDrawPage: (dataObj) => {
                    drawHeader(doc, dataObj.pageNumber);
                }
            });

        } else {
            // ─────────────────────────────────────────────────────────────────
            // MODO 2: MATRIZ GERAL DA FÁBRICA (TODOS OS SETORES COM PRODUTOS)
            // ─────────────────────────────────────────────────────────────────
            const tableColumns = [
                { header: getAgrupamentoLabel(filters.agrupamento), dataKey: 'identificador' },
                { header: 'Produto(s) / Detalhes', dataKey: 'produto_info' },
                { header: 'Entrega', dataKey: 'entrega' },
                ...setoresHeaders.map(s => ({
                    header: s.nome,
                    dataKey: `setor_${s.id}`
                })),
                { header: 'Evolução Total', dataKey: 'evolucao_total' }
            ];

            let globalEsp = 0;
            let globalApt = 0;

            const tableRows = pedidosRows.map(ped => {
                let totalEsp = 0;
                let totalApt = 0;

                const rowObj = {
                    identificador: `${ped.title}\n${ped.subtitle || ''}`,
                    produto_info: ped.produtosDetalhes !== '—' ? ped.produtosDetalhes : (ped.paisDetalhes !== '—' ? `Pai: ${ped.paisDetalhes}` : '—'),
                    entrega: formatDateBR(ped.prazo)
                };

                setoresHeaders.forEach(s => {
                    const d = ped.setoresData[s.id];
                    if (d && d.esperada > 0) {
                        totalEsp += d.esperada;
                        totalApt += d.apontada;
                        const pct = Math.round((d.apontada / d.esperada) * 100);
                        rowObj[`setor_${s.id}`] = `${pct}%\n(${formatNumberBR(d.apontada)}/${formatNumberBR(d.esperada)})`;
                    } else {
                        rowObj[`setor_${s.id}`] = '—';
                    }
                });

                globalEsp += totalEsp;
                globalApt += totalApt;

                const progGeral = totalEsp > 0 ? Math.round((totalApt / totalEsp) * 100) : 0;
                rowObj.evolucao_total = `${progGeral}%\n(${formatNumberBR(totalApt)}/${formatNumberBR(totalEsp)})`;

                return rowObj;
            });

            const progressoFabrica = globalEsp > 0 ? Math.round((globalApt / globalEsp) * 100) : 0;

            const colStyles = {
                identificador: { cellWidth: 42, fontStyle: 'bold', textColor: [30, 58, 95] },
                produto_info: { cellWidth: 48, fontSize: 6.2 },
                entrega: { cellWidth: 16, halign: 'center' },
                evolucao_total: { cellWidth: 22, halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] }
            };

            setoresHeaders.forEach(s => {
                colStyles[`setor_${s.id}`] = { halign: 'center', cellWidth: 'auto', fontStyle: 'bold' };
            });

            autoTable(doc, {
                columns: tableColumns,
                body: tableRows,
                startY: 32,
                margin: { left: ML, right: MR, bottom: 12 },
                theme: 'grid',
                headStyles: {
                    fillColor: [30, 58, 95],
                    textColor: [255, 255, 255],
                    fontSize: 7.2,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                styles: {
                    fontSize: 6.5,
                    cellPadding: 1.6,
                    valign: 'middle',
                    overflow: 'linebreak'
                },
                columnStyles: colStyles,
                foot: [[
                    { content: 'TOTAL CONSOLIDADO DA FÁBRICA', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
                    ...setoresHeaders.map(s => {
                        let sEsp = 0;
                        let sApt = 0;
                        pedidosRows.forEach(p => {
                            const d = p.setoresData[s.id];
                            if (d) {
                                sEsp += d.esperada;
                                sApt += d.apontada;
                            }
                        });
                        const sPct = sEsp > 0 ? Math.round((sApt / sEsp) * 100) : 0;
                        return {
                            content: `${sPct}%\n(${formatNumberBR(sApt)}/${formatNumberBR(sEsp)})`,
                            styles: { halign: 'center', fontStyle: 'bold' }
                        };
                    }),
                    {
                        content: `${progressoFabrica}%\n(${formatNumberBR(globalApt)}/${formatNumberBR(globalEsp)})`,
                        styles: { halign: 'center', fontStyle: 'bold', textColor: [16, 185, 129] }
                    }
                ]],
                footStyles: {
                    fillColor: [241, 245, 249],
                    textColor: [15, 23, 42],
                    fontSize: 7
                },
                didDrawPage: (dataObj) => {
                    drawHeader(doc, dataObj.pageNumber);
                }
            });
        }

        // Add total page numbers on all pages
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text(`Página ${i} de ${totalPages}`, pageWidth - MR - 4, 15 + 6, { align: 'right' });
            
            // Bottom footer
            doc.setFontSize(6.5);
            doc.setTextColor(160, 174, 192);
            doc.text(`MetalFisa Antigravity ERP - Relatório Gerencial de Direcionamento por Setores`, ML, pageHeight - 5);
        }

        const fileName = targetSetorObj 
            ? `Direcionamento_Setor_${targetSetorObj.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
            : `Direcionamento_Fabrica_Setores_${new Date().toISOString().split('T')[0]}.pdf`;

        doc.save(fileName);
        toast.success('Relatório PDF gerado com sucesso!');

    } catch (err) {
        console.error('Erro ao gerar PDF de Visão por Setores:', err);
        toast.error('Erro ao gerar arquivo PDF.');
    }
};

// ─── GERADOR DE EXCEL (ExcelJS) ──────────────────────────────────────────────

export const exportVisaoSetoresExcel = async (rawSetoresData, filters = {}) => {
    try {
        const { setoresHeaders, pedidosRows, setoresRaw } = processMatrizData(rawSetoresData, filters.agrupamento);

        if (pedidosRows.length === 0) {
            toast.warning('Nenhum dado para exportação em Excel.');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MetalFisa ERP';
        workbook.created = new Date();

        // Estilos Padrão
        const navyHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
        const blueHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D6EFD' } };
        const headerFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        const regularFont = { name: 'Segoe UI', size: 9 };
        const boldFont = { name: 'Segoe UI', size: 9, bold: true };
        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // ─────────────────────────────────────────────────────────────────────
        // ABA 1: MATRIZ GERAL DA FÁBRICA (COM CAMPOS EXCLUSIVOS DE PRODUTO)
        // ─────────────────────────────────────────────────────────────────────
        const wsGeral = workbook.addWorksheet('Direcionamento Geral Fábrica', {
            views: [{ showGridLines: true, state: 'frozen', ySplit: 4, xSplit: 2 }]
        });

        // Banner Superior
        wsGeral.mergeCells('A1:F1');
        const cellA1 = wsGeral.getCell('A1');
        cellA1.value = 'METALFISA - RELATÓRIO DE DIRECIONAMENTO DE PRODUTOS POR SETORES (FÁBRICA)';
        cellA1.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E3A5F' } };

        wsGeral.mergeCells('A2:F2');
        const cellA2 = wsGeral.getCell('A2');
        cellA2.value = `Agrupamento: ${getAgrupamentoLabel(filters.agrupamento)} | Data de Geração: ${new Date().toLocaleString('pt-BR')}`;
        cellA2.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };

        // Linha 4: Cabeçalhos da Tabela
        const colsMatriz = [
            { header: getAgrupamentoLabel(filters.agrupamento), key: 'identificador', width: 26 },
            { header: 'Cliente', key: 'cliente', width: 28 },
            { header: 'OP(s)', key: 'ops', width: 18 },
            { header: 'Cód. Produto(s)', key: 'cod_produtos', width: 24 },
            { header: 'Descrição do Produto', key: 'desc_produtos', width: 36 },
            { header: 'Produto Pai / Conjunto', key: 'pais', width: 24 },
            { header: 'Prazo Entrega', key: 'prazo', width: 15 },
            { header: 'Romaneios', key: 'romaneios', width: 18 }
        ];

        setoresHeaders.forEach(s => {
            colsMatriz.push(
                { header: `${s.nome} (Esp)`, key: `s_${s.id}_esp`, width: 14 },
                { header: `${s.nome} (Apt)`, key: `s_${s.id}_apt`, width: 14 },
                { header: `${s.nome} (%)`, key: `s_${s.id}_pct`, width: 12 }
            );
        });

        colsMatriz.push(
            { header: 'Total Esperado', key: 'tot_esp', width: 16 },
            { header: 'Total Apontado', key: 'tot_apt', width: 16 },
            { header: 'Evolução Total (%)', key: 'tot_pct', width: 18 }
        );

        wsGeral.columns = colsMatriz;

        // Estiliza cabeçalho na linha 4
        const headerRowGeral = wsGeral.getRow(4);
        headerRowGeral.values = colsMatriz.map(c => c.header);
        headerRowGeral.height = 24;
        headerRowGeral.eachCell((cell, colNumber) => {
            cell.fill = navyHeaderFill;
            cell.font = headerFont;
            cell.alignment = { vertical: 'middle', horizontal: colNumber > 6 ? 'center' : 'left' };
            cell.border = thinBorder;
        });

        // Adiciona Linhas de Dados
        pedidosRows.forEach((ped, idx) => {
            let totalEsp = 0;
            let totalApt = 0;

            const rowData = {
                identificador: ped.title,
                cliente: ped.cliente || '',
                ops: ped.opsTexto || '—',
                cod_produtos: ped.produtosCodigos || '—',
                desc_produtos: ped.produtosDescricoes || '—',
                pais: ped.paisDetalhes || '—',
                prazo: formatDateBR(ped.prazo),
                romaneios: (ped.romaneios || []).map(r => `#${r.romaneio_id}`).join(', ') || '—'
            };

            setoresHeaders.forEach(s => {
                const d = ped.setoresData[s.id] || { esperada: 0, apontada: 0 };
                totalEsp += d.esperada;
                totalApt += d.apontada;
                const pct = d.esperada > 0 ? (d.apontada / d.esperada) : 0;

                rowData[`s_${s.id}_esp`] = d.esperada;
                rowData[`s_${s.id}_apt`] = d.apontada;
                rowData[`s_${s.id}_pct`] = pct;
            });

            const progGeral = totalEsp > 0 ? (totalApt / totalEsp) : 0;
            rowData.tot_esp = totalEsp;
            rowData.tot_apt = totalApt;
            rowData.tot_pct = progGeral;

            const row = wsGeral.addRow(rowData);
            row.height = 20;

            const isEven = idx % 2 === 0;
            row.eachCell((cell, colNumber) => {
                cell.font = regularFont;
                cell.border = thinBorder;
                if (!isEven) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }

                // Formatando colunas numéricas e de porcentagem
                if (colNumber > 8) {
                    const colKey = colsMatriz[colNumber - 1].key;
                    if (colKey.endsWith('_pct') || colKey === 'tot_pct') {
                        cell.numFmt = '0.0%';
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.font = boldFont;
                    } else {
                        cell.numFmt = '#,##0';
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    }
                } else if (colNumber === 7) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
            });
        });

        // ─────────────────────────────────────────────────────────────────────
        // ABAS 2..N: DETALHAMENTO INDIVIDUAL POR SETOR
        // ─────────────────────────────────────────────────────────────────────
        setoresRaw.forEach(setor => {
            const ops = setor.ops || [];
            const safeSheetName = `Setor - ${setor.nome}`.replace(/[:\\/?*\[\]]/g, '').slice(0, 31);
            const wsSetor = workbook.addWorksheet(safeSheetName, {
                views: [{ showGridLines: true, state: 'frozen', ySplit: 4 }]
            });

            // Banner do Setor
            wsSetor.mergeCells('A1:E1');
            const cA1 = wsSetor.getCell('A1');
            cA1.value = `SETOR: ${setor.nome.toUpperCase()}`;
            cA1.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E3A5F' } };

            wsSetor.mergeCells('A2:E2');
            const cA2 = wsSetor.getCell('A2');
            cA2.value = `Total de Ordens no Setor: ${ops.length} | Exportado em: ${new Date().toLocaleString('pt-BR')}`;
            cA2.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };

            const setorCols = [
                { header: 'Pedido', key: 'pedido', width: 14 },
                { header: 'Cliente', key: 'cliente', width: 28 },
                { header: 'OP', key: 'op', width: 16 },
                { header: 'Item OP', key: 'item', width: 10 },
                { header: 'Cód. Produto', key: 'produto', width: 22 },
                { header: 'Descrição do Produto', key: 'descricao', width: 34 },
                { header: 'Produto Pai', key: 'pai', width: 20 },
                { header: 'Qtd Esperada', key: 'esperada', width: 16 },
                { header: 'Qtd Apontada', key: 'apontada', width: 16 },
                { header: 'Saldo Restante', key: 'saldo', width: 16 },
                { header: '% Conclusão', key: 'progresso', width: 14 },
                { header: 'Prazo Entrega', key: 'prazo', width: 15 },
                { header: 'Romaneios', key: 'romaneio', width: 18 }
            ];

            wsSetor.columns = setorCols;

            const headerRowSetor = wsSetor.getRow(4);
            headerRowSetor.values = setorCols.map(c => c.header);
            headerRowSetor.height = 22;
            headerRowSetor.eachCell((cell, colNumber) => {
                cell.fill = blueHeaderFill;
                cell.font = headerFont;
                cell.alignment = { vertical: 'middle', horizontal: colNumber >= 8 ? 'center' : 'left' };
                cell.border = thinBorder;
            });

            ops.forEach((op, idx) => {
                const esp = Number(op.qtd_esperada_setor) || 0;
                const apt = Number(op.qtd_apontada_setor) || 0;
                const saldo = Math.max(0, esp - apt);
                const prog = esp > 0 ? (apt / esp) : 0;

                const row = wsSetor.addRow({
                    pedido: op.pedido_venda || '—',
                    cliente: op.nome_cliente || '—',
                    op: op.op,
                    item: op.item_op || '01',
                    produto: op.cod_produto_op || '—',
                    descricao: op.desc_produto || '—',
                    pai: op.produto_pai || '—',
                    esperada: esp,
                    apontada: apt,
                    saldo: saldo,
                    progresso: prog,
                    prazo: formatDateBR(op.prazo_entrega_pedido),
                    romaneio: (op.romaneios || []).map(r => `#${r.romaneio_id}`).join(', ') || '—'
                });

                row.height = 19;
                const isEven = idx % 2 === 0;
                row.eachCell((cell, colNumber) => {
                    cell.font = regularFont;
                    cell.border = thinBorder;
                    if (!isEven) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    }

                    if (colNumber === 8 || colNumber === 9 || colNumber === 10) {
                        cell.numFmt = '#,##0';
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    } else if (colNumber === 11) {
                        cell.numFmt = '0.0%';
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.font = boldFont;
                    } else if (colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 12) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                });
            });
        });

        // Gera o buffer e dispara o download no navegador
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Direcionamento_Setores_MetalFisa_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success('Planilha Excel gerada com sucesso!');

    } catch (err) {
        console.error('Erro ao exportar Visão por Setores para Excel:', err);
        toast.error('Erro ao gerar arquivo Excel.');
    }
};
