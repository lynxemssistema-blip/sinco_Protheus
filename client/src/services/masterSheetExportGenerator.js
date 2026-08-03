import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { logoBase64 } from './metalfisaLogoBase64';

// Layout Constants
const ML = 8;
const MR = 8;
const HDR_H = 22;
const BRAND_W = 44;
const LOGO_W = 12;
const LOGO_H = 12;

// Draw standard MetalFisa Header for PDF
const drawHeader = (doc, pageWidth, title, subtitle = '') => {
    const y0 = 5;

    // Dark Navy Blue Brand Block ([30, 58, 95] - #1E3A5F)
    doc.setFillColor(30, 58, 95);
    doc.rect(ML, y0, BRAND_W, HDR_H, 'F');
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', ML + 2, y0 + 2, LOGO_W, LOGO_H);
        } catch (e) {}
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('METALFISA', ML + 16, y0 + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Metalúrgica Ltda', ML + 16, y0 + 13.5);

    // Light Gray Title Block (#F5F7FA)
    doc.setFillColor(245, 247, 250);
    doc.rect(ML + BRAND_W, y0, pageWidth - ML - MR - BRAND_W, HDR_H, 'F');

    const blockCenter = ML + BRAND_W + (pageWidth - ML - MR - BRAND_W) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(30, 58, 95);
    doc.text(title, blockCenter, y0 + 8.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(subtitle, blockCenter, y0 + 15.5, { align: 'center' });

    // Date (right corner)
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, pageWidth - MR - 2, y0 + 5.5, { align: 'right' });

    // Border
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.rect(ML, y0, pageWidth - ML - MR, HDR_H);

    return y0 + HDR_H + 4;
};

// Formatter helpers
const formatNum = (val) => {
    if (val == null || val === '' || isNaN(val)) return '-';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const formatDate = (val) => {
    if (!val) return '-';
    const str = String(val).trim();
    if (str.length === 8 && !str.includes('-')) {
        return `${str.substring(6, 8)}/${str.substring(4, 6)}/${str.substring(0, 4)}`;
    }
    if (str.includes('-')) {
        const parts = str.split('T')[0].split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return str;
};

const buildFilterLabel = (filterParams = {}) => {
    const parts = [];
    if (filterParams.cliente) parts.push(`Cliente: ${filterParams.cliente}`);
    if (filterParams.pedido) parts.push(`Pedido: ${filterParams.pedido}`);
    if (filterParams.produto) parts.push(`Produto: ${filterParams.produto}`);
    const prio = filterParams.prioridade || filterParams.somente_prioridades;
    if (prio && prio !== 'false') parts.push(`Prioridade: Grupo ${prio}`);
    if (filterParams.only_active === 'true') parts.push(`Apenas Ativos`);
    return parts.length > 0 ? parts.join(' | ') : 'Todos os Registros';
};

/**
 * EXPORT TO EXCEL (.XLSX) — ESTILO METALFISA
 * Exports multi-sheet Excel file with official headers and formatting
 */
export const exportMasterSheetExcel = (data, filterParams = {}) => {
    if (!data) throw new Error('Nenhum dado disponível para exportar.');

    const options = filterParams;
    const wb = XLSX.utils.book_new();
    const filterLabel = buildFilterLabel(filterParams);
    const dateStr = new Date().toLocaleString('pt-BR');

    const createMetalFisaSheet = (title, headerRow, dataRows) => {
        const metaHeader = [
            ['METALFISA METALÚRGICA LTDA — SISTEMA DE GESTÃO INTEGRADO'],
            [`RELATÓRIO: ${title.toUpperCase()}`],
            [`Data de Emissão: ${dateStr}  |  Filtros Aplicados: ${filterLabel}`],
            [], // linha em branco
            headerRow,
            ...dataRows
        ];

        const ws = XLSX.utils.aoa_to_sheet(metaHeader);

        // Auto-fit column widths
        const colWidths = headerRow.map((h, colIdx) => {
            let maxLen = String(h).length;
            dataRows.forEach(row => {
                const cellVal = row[colIdx] != null ? String(row[colIdx]) : '';
                if (cellVal.length > maxLen) maxLen = cellVal.length;
            });
            return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
        });
        ws['!cols'] = colWidths;

        return ws;
    };

    // 1. Aba: Resumo
    if (data.resumo && data.resumo.length > 0) {
        const resumoHeader = ['Produto', 'Descrição', 'UM', 'Qtd Total a Produzir'];
        const resumoRows = data.resumo.map(r => [
            r.produto,
            r.descricao || '-',
            r.um || '-',
            Number(r.qtd_total || 0)
        ]);
        const wsResumo = createMetalFisaSheet('Resumo de Produtos', resumoHeader, resumoRows);
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
    }

    // 2. Aba: Pedidos
    if (data.pedidos && data.pedidos.length > 0) {
        const pedHeader = ['Pedido', 'Emissão', 'Cliente', 'Qtde Itens', 'Qtd Total Pedido', 'Início PCP', 'Fim PCP'];
        const pedRows = data.pedidos.map(p => [
            p.pedido,
            formatDate(p.emissao),
            p.cliente,
            Number(p.item_count || 0),
            Number(p.soma_qtd || 0),
            formatDate(p.pcp_inicio),
            formatDate(p.pcp_fim)
        ]);
        const wsPedidos = createMetalFisaSheet('Lista de Pedidos', pedHeader, pedRows);
        XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos');
    }

    // 3. Aba: Itens Detalhados (com Grupo de Prioridade!)
    if (data.itens && data.itens.length > 0) {
        const itensHeader = [
            'Pedido', 'Cliente', 'Item', 'Produto', 'Descrição', 'UM',
            'Grupo Prioridade', 'Qtd Pedido', 'Qtd Faturada', 'Qtd Faturar',
            'Entrega', 'Data PCP', 'Nova Data PCP', 'OP', 'Ped. Cliente'
        ];
        const itensRows = data.itens.map(i => [
            i.pedido,
            i.cliente,
            i.item,
            i.produto,
            i.descricao || '-',
            i.um || '-',
            i.op_prioridade ? `Grupo ${i.op_prioridade}` : '-',
            Number(i.qtd || 0),
            Number(i.qtd_entreg || 0),
            Number(i.qtd_faturar || 0),
            formatDate(i.entrega),
            formatDate(i.data_pcp),
            formatDate(i.nova_data_pcp),
            i.op || '-',
            i.ped_cli || '-'
        ]);
        const wsItens = createMetalFisaSheet('Itens Detalhados com Prioridade', itensHeader, itensRows);
        XLSX.utils.book_append_sheet(wb, wsItens, 'Itens Detalhados');
    }

    // 4. Aba: Estrutura BOM
    if (data.estruturas && data.estruturas.length > 0) {
        const bomHeader = ['Produto Pai (Raiz)', 'Componente', 'Descrição Componente', 'UM', 'Tipo', 'Qtd Unitária'];
        const bomRows = data.estruturas.map(b => [
            b.raiz,
            b.comp,
            b.desc || '-',
            b.um || '-',
            b.tipo || '-',
            Number(b.quant || 0)
        ]);
        const wsBom = createMetalFisaSheet('Estrutura de Produtos (BOM)', bomHeader, bomRows);
        XLSX.utils.book_append_sheet(wb, wsBom, 'Estrutura BOM');
    }

    // 5. Aba: Carga por Recurso
    if (data.carga && data.carga.length > 0 && data.recursos) {
        const cargaHeader = ['Pedido', 'Cliente', 'Item', 'Produto', 'Qtd Faturar', 'Prioridade', ...data.recursos.map(r => `Rec ${r} (min)`)];
        const cargaRows = data.carga.map(c => [
            c.pedido,
            c.cliente,
            c.item,
            c.produto,
            Number(c.qtd_faturar || 0),
            c.op_prioridade ? `Grupo ${c.op_prioridade}` : '-',
            ...data.recursos.map(r => Number(c['rec_' + r] || 0))
        ]);
        const wsCarga = createMetalFisaSheet('Carga por Recurso de Máquina', cargaHeader, cargaRows);
        XLSX.utils.book_append_sheet(wb, wsCarga, 'Carga por Recurso');
    }

    // 6. Aba: Capacidade do Período
    if (data.carga && data.carga.length > 0 && data.recursos && data.capacidades) {
        let dIni = filterParams.dataInicial ? new Date(filterParams.dataInicial) : null;
        let dFim = filterParams.dataFinal ? new Date(filterParams.dataFinal) : null;

        if (!dIni || !dFim) {
            const pcpDates = data.carga.map(c => {
                const dateVal = c.data_pcp || c.entrega;
                if (!dateVal) return null;
                const str = String(dateVal).trim();
                let d;
                if (str.length === 8 && !str.includes('-')) {
                    d = new Date(str.substring(0, 4) + '-' + str.substring(4, 6) + '-' + str.substring(6, 8));
                } else {
                    d = new Date(str);
                }
                return isNaN(d.getTime()) ? null : d;
            }).filter(Boolean);

            if (pcpDates.length > 0) {
                if (!dIni) dIni = new Date(Math.min(...pcpDates));
                if (!dFim) dFim = new Date(Math.max(...pcpDates));
            }
        }

        let days = 1;
        if (dIni && dFim) {
            let count = 0;
            let cur = new Date(dIni.getTime());
            cur.setHours(0,0,0,0);
            const end = new Date(dFim.getTime());
            end.setHours(23,59,59,999);

            while (cur <= end) {
                const day = cur.getDay();
                if (day !== 0 && day !== 6) { // Exclude Sunday (0) and Saturday (6)
                    count++;
                }
                cur.setDate(cur.getDate() + 1);
            }
            days = count || 1;
        }

        const capHeader = ['Recurso / Máquina', 'Capacidade Diária (h)', 'Capacidade Total (h)', 'Carga Prevista (h)', 'Saldo Capacidade (h)', '% Ocupação'];
        
        const capRows = data.recursos.map(r => {
            const cod = r.trim().toUpperCase();
            const capDiaria = data.capacidades[cod] || 0;
            const capTotal = capDiaria * days;

            const cargaPrevista = data.carga.reduce((sum, item) => {
                if (dIni && dFim) {
                    const itemDateVal = item.data_pcp || item.entrega;
                    if (itemDateVal) {
                        const str = String(itemDateVal).trim();
                        let d;
                        if (str.length === 8 && !str.includes('-')) {
                            d = new Date(str.substring(0, 4) + '-' + str.substring(4, 6) + '-' + str.substring(6, 8) + 'T00:00:00');
                        } else {
                            d = new Date(str);
                        }
                        if (!isNaN(d.getTime())) {
                            if (d < dIni || d > dFim) return sum;
                        }
                    }
                }
                return sum + (Number(item['rec_' + r]) || 0);
            }, 0);

            const MIN_POR_HORA = 55;
            const capDiariaHrs = Number((capDiaria / MIN_POR_HORA).toFixed(2));
            const capTotalHrs = Number((capTotal / MIN_POR_HORA).toFixed(2));
            const cargaPrevistaHrs = Number((cargaPrevista / MIN_POR_HORA).toFixed(2));
            const saldoHrs = Number(((capTotal - cargaPrevista) / MIN_POR_HORA).toFixed(2));
            const ocupacao = capTotal > 0 ? (cargaPrevista / capTotal) * 100 : 0;

            return [
                data.recursoNomeMap[r] || r,
                capDiariaHrs,
                capTotalHrs,
                cargaPrevistaHrs,
                saldoHrs,
                Number(ocupacao.toFixed(2))
            ];
        });

        const wsCapacidade = createMetalFisaSheet(`Capacidade do Período (${days} dias)`, capHeader, capRows);
        XLSX.utils.book_append_sheet(wb, wsCapacidade, 'Capacidade do Período');
    }

    // 7. Aba: Necessidade de Materiais
    if (data.itens && data.itens.length > 0 && data.estruturas && data.estruturas.length > 0) {
        const detailedDemands = [];
        const exibirCustos = !!options.exibirCustos;
        const filtroTipo = options.filtroTipo || 'MP';

        data.itens.forEach(item => {
            const parentProd = (item.produto || '').trim();
            // Define a quantidade base de acordo com a opção selecionada
            const parentQtd = options.baseCalculo === 'pedido'
                ? Number(item.qtd || 0)
                : Number(item.qtd_faturar || 0);

            // Find BOM components for this parent product
            const comps = data.estruturas.filter(e => e.raiz === parentProd);

            comps.forEach(c => {
                // Apply the Tipo filter to the exported items
                const matchesTipo = filtroTipo === 'Todos' || c.tipo.trim().toUpperCase() === filtroTipo.toUpperCase();
                if (!matchesTipo) return;

                const totalQtd = parentQtd * c.quant;
                const rowData = [
                    item.pedido,
                    item.cliente,
                    parentProd,
                    item.descricao || '-',
                    parentQtd,
                    c.comp,
                    c.desc || '-',
                    c.um || '-',
                    c.quant,
                    totalQtd
                ];

                if (exibirCustos) {
                    const custoUnit = c.custo_unitario || 0;
                    const custoTotal = totalQtd * custoUnit;
                    rowData.push(custoUnit, custoTotal);
                }

                detailedDemands.push(rowData);
            });
        });

        const matHeader = [
            'Pedido',
            'Cliente',
            'Produto Final',
            'Descrição Produto Final',
            options.baseCalculo === 'pedido' ? 'Qtd Pedido' : 'Qtd Faturar',
            'Código do Material',
            'Descrição do Material',
            'UM',
            'Qtd Unitária (BOM)',
            'Qtd Total Necessária'
        ];

        if (exibirCustos) {
            matHeader.push('Custo Unitário', 'Custo Total');
        }

        const wsMateriais = createMetalFisaSheet('Necessidade de Materiais / Componentes', matHeader, detailedDemands);
        XLSX.utils.book_append_sheet(wb, wsMateriais, 'Necessidade de Materials');
    }

    const fileName = `Planilha_Mestra_MetalFisa_${getTodayDateStr()}.xlsx`;
    XLSX.writeFile(wb, fileName);
};

/**
 * EXPORT TO PDF (.PDF) — ESTILO METALFISA
 * Exports Planilha Mestra data into formatted PDF report
 */
export const exportMasterSheetPdf = (data, activeTab = 'itens', filterParams = {}) => {
    if (!data) throw new Error('Nenhum dado disponível para exportar.');

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const filterLabel = buildFilterLabel(filterParams);

    let tabLabel = 'Relatório Geral';
    let headers = [];
    let rows = [];

    if (activeTab === 'resumo' && data.resumo) {
        tabLabel = 'Resumo de Produtos a Produzir';
        headers = [['Produto', 'Descrição', 'UM', 'Qtd Total a Produzir']];
        rows = data.resumo.map(r => [r.produto, r.descricao || '-', r.um || '-', formatNum(r.qtd_total)]);
    } else if (activeTab === 'pedidos' && data.pedidos) {
        tabLabel = 'Lista de Pedidos de Venda';
        headers = [['Pedido', 'Emissão', 'Cliente', 'Qtde Itens', 'Qtd Total Pedido', 'Início PCP', 'Fim PCP']];
        rows = data.pedidos.map(p => [p.pedido, formatDate(p.emissao), p.cliente, p.item_count, formatNum(p.soma_qtd), formatDate(p.pcp_inicio), formatDate(p.pcp_fim)]);
    } else if (activeTab === 'capacidade_periodo' && data.recursos && data.capacidades) {
        tabLabel = 'Capacidade do Período Filtrado';
        
        let dIni = filterParams.dataInicial ? new Date(filterParams.dataInicial) : null;
        let dFim = filterParams.dataFinal ? new Date(filterParams.dataFinal) : null;

        if (!dIni || !dFim) {
            const pcpDates = data.carga.map(c => {
                const dateVal = c.data_pcp || c.entrega;
                if (!dateVal) return null;
                const str = String(dateVal).trim();
                let d;
                if (str.length === 8 && !str.includes('-')) {
                    d = new Date(str.substring(0, 4) + '-' + str.substring(4, 6) + '-' + str.substring(6, 8));
                } else {
                    d = new Date(str);
                }
                return isNaN(d.getTime()) ? null : d;
            }).filter(Boolean);

            if (pcpDates.length > 0) {
                if (!dIni) dIni = new Date(Math.min(...pcpDates));
                if (!dFim) dFim = new Date(Math.max(...pcpDates));
            }
        }

        let days = 1;
        if (dIni && dFim) {
            let count = 0;
            let cur = new Date(dIni.getTime());
            cur.setHours(0,0,0,0);
            const end = new Date(dFim.getTime());
            end.setHours(23,59,59,999);

            while (cur <= end) {
                const day = cur.getDay();
                if (day !== 0 && day !== 6) { // Exclude Sunday (0) and Saturday (6)
                    count++;
                }
                cur.setDate(cur.getDate() + 1);
            }
            days = count || 1;
        }

        headers = [['Recurso / Máquina', 'Capacidade Diária (h)', 'Capacidade Total (h)', 'Carga Prevista (h)', 'Saldo Capacidade (h)', '% Ocupação']];
        
        rows = data.recursos.map(r => {
            const cod = r.trim().toUpperCase();
            const capDiaria = data.capacidades[cod] || 0;
            const capTotal = capDiaria * days;

            const cargaPrevista = data.carga.reduce((sum, item) => {
                if (dIni && dFim) {
                    const itemDateVal = item.data_pcp || item.entrega;
                    if (itemDateVal) {
                        const str = String(itemDateVal).trim();
                        let d;
                        if (str.length === 8 && !str.includes('-')) {
                            d = new Date(str.substring(0, 4) + '-' + str.substring(4, 6) + '-' + str.substring(6, 8) + 'T00:00:00');
                        } else {
                            d = new Date(str);
                        }
                        if (!isNaN(d.getTime())) {
                            if (d < dIni || d > dFim) return sum;
                        }
                    }
                }
                return sum + (Number(item['rec_' + r]) || 0);
            }, 0);

            const MIN_POR_HORA = 55;
            const capDiariaHrs = capDiaria / MIN_POR_HORA;
            const capTotalHrs = capTotal / MIN_POR_HORA;
            const cargaPrevistaHrs = cargaPrevista / MIN_POR_HORA;
            const saldoHrs = (capTotal - cargaPrevista) / MIN_POR_HORA;
            const ocupacao = capTotal > 0 ? (cargaPrevista / capTotal) * 100 : 0;

            return [
                data.recursoNomeMap[r] || r,
                formatNum(capDiariaHrs),
                formatNum(capTotalHrs),
                formatNum(cargaPrevistaHrs),
                formatNum(saldoHrs),
                `${formatNum(ocupacao)}%`
            ];
        });
    } else if (activeTab === 'estruturas' && data.estruturas) {
        tabLabel = 'Estrutura dos Produtos (Engenharia BOM)';
        headers = [['Produto Pai (Raiz)', 'Componente', 'Descrição Componente', 'UM', 'Tipo', 'Qtd Unitária']];
        rows = data.estruturas.map(b => [b.raiz, b.comp, b.desc || '-', b.um || '-', b.tipo || '-', formatNum(b.quant)]);
    } else if (activeTab === 'materiais_necessarios' && data.itens && data.estruturas) {
        tabLabel = 'Necessidade Detalhada de Materiais';
        headers = [['Pedido', 'Cliente', 'Prod. Final', 'Qtd Faturar', 'Cód. Material', 'Descrição do Material', 'UM', 'Qtd Unit.', 'Qtd Necessária']];
        rows = [];
        data.itens.forEach(item => {
            const parentProd = (item.produto || '').trim();
            const parentQtd = Number(item.qtd_faturar || 0);
            const comps = data.estruturas.filter(e => e.raiz === parentProd);

            comps.forEach(c => {
                rows.push([
                    item.pedido,
                    item.cliente,
                    parentProd,
                    formatNum(parentQtd),
                    c.comp,
                    c.desc || '-',
                    c.um || '-',
                    formatNum(c.quant),
                    formatNum(parentQtd * c.quant)
                ]);
            });
        });
    } else {
        // Default: Itens Detalhados com Prioridades
        tabLabel = 'Itens Detalhados com Grupos de Prioridades';
        headers = [['Pedido', 'Cliente', 'Item', 'Produto', 'Descrição', 'UM', 'Prioridade', 'Qtd Pedido', 'Qtd Faturar', 'Entrega', 'Nova Data PCP']];
        rows = (data.itens || []).map(i => [
            i.pedido,
            i.cliente,
            i.item,
            i.produto,
            i.descricao || '-',
            i.um || '-',
            i.op_prioridade ? `Grupo ${i.op_prioridade}` : '-',
            formatNum(i.qtd),
            formatNum(i.qtd_faturar),
            formatDate(i.entrega),
            formatDate(i.nova_data_pcp) || '-'
        ]);
    }

    const startY = drawHeader(doc, pageWidth, 'Planilha Mestra - Planejamento S&OP', `Visualização: ${tabLabel}  |  ${filterLabel}`);

    autoTable(doc, {
        startY: startY,
        head: headers,
        body: rows,
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: ML, right: MR },
        didParseCell: (cellData) => {
            // Apply priority badge colors in PDF column 'Prioridade'
            if (cellData.section === 'body' && cellData.column.index === 6 && activeTab === 'itens') {
                const val = String(cellData.cell.raw || '');
                if (val.includes('Grupo 1')) {
                    cellData.cell.styles.fillColor = [254, 226, 226]; // Soft red
                    cellData.cell.styles.textColor = [185, 28, 28]; // Red bold
                    cellData.cell.styles.fontStyle = 'bold';
                } else if (val.includes('Grupo 2')) {
                    cellData.cell.styles.fillColor = [255, 237, 213]; // Soft orange
                    cellData.cell.styles.textColor = [194, 65, 12]; // Orange bold
                    cellData.cell.styles.fontStyle = 'bold';
                } else if (val.includes('Grupo 3')) {
                    cellData.cell.styles.fillColor = [254, 249, 195]; // Soft yellow
                    cellData.cell.styles.textColor = [161, 98, 7]; // Yellow bold
                    cellData.cell.styles.fontStyle = 'bold';
                } else if (val.includes('Grupo')) {
                    cellData.cell.styles.fillColor = [219, 234, 254]; // Soft blue
                    cellData.cell.styles.textColor = [29, 78, 216]; // Blue bold
                    cellData.cell.styles.fontStyle = 'bold';
                }
            }
        },
        didDrawPage: (d) => {
            // Footer
            doc.setFontSize(7);
            doc.setTextColor(140, 140, 140);
            doc.text(`Página ${d.pageNumber}`, pageWidth - MR, pageHeight - 4.5, { align: 'right' });
            doc.text('MetalFisa System — Sistema Integrado de Gestão & Planejamento S&OP', ML, pageHeight - 4.5);
        }
    });

    const fileName = `Planilha_Mestra_MetalFisa_${activeTab}_${getTodayDateStr()}.pdf`;
    doc.save(fileName);
};

const getTodayDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
