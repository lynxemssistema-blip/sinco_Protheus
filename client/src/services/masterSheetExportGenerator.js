import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { logoBase64 } from './metalfisaLogoBase64.js';

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

const parseToDate = (val) => {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    const str = String(val).trim();
    if (/^\d{8}$/.test(str)) {
        const y = parseInt(str.substring(0, 4), 10);
        const m = parseInt(str.substring(4, 6), 10) - 1;
        const d = parseInt(str.substring(6, 8), 10);
        return new Date(Date.UTC(y, m, d, 12, 0, 0));
    }
    if (str.includes('T') || str.includes('-')) {
        const parts = str.split('T')[0].split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            return new Date(Date.UTC(y, m, d, 12, 0, 0));
        }
    }
    const dt = new Date(val);
    return isNaN(dt.getTime()) ? null : dt;
};

const normalizeToISO = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr.toISOString().split('T')[0];
    const s = String(dateStr).trim();
    if (/^\d{8}$/.test(s)) return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    if (s.includes('T')) return s.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    return null;
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

const filterInactiveAndInvoiced = (rawData) => {
    if (!rawData) return rawData;
    const data = JSON.parse(JSON.stringify(rawData)); // deep clone
    
    if (data.itens) {
        data.itens = data.itens.filter(i => {
            const isFaturado = Number(i.qtd_faturar || 0) <= 0;
            const isInativo = (i.b1_msblql === '1' || i.b1_msblql === 'S' || i.b1_msblql === 'T' || i.b1_msblql === 'Y' || i.op_status === 'C' || i.status_projeto === 'Inativo');
            return !isFaturado && !isInativo;
        });
    }
    
    const validPedidos = new Set((data.itens || []).map(i => i.pedido));
    const validProds = new Set((data.itens || []).map(i => i.produto));
    
    if (data.pedidos) data.pedidos = data.pedidos.filter(p => validPedidos.has(p.pedido));
    if (data.resumo) data.resumo = data.resumo.filter(r => validProds.has(r.produto));
    if (data.carga) data.carga = data.carga.filter(c => validProds.has(c.produto));
    if (data.execucao_op) data.execucao_op = data.execucao_op.filter(op => validPedidos.has(op.pedido));
    
    return data;
};

/**
 * EXPORT TO EXCEL (.XLSX) — ESTILO METALFISA
 * Exports multi-sheet Excel file with official headers, dynamic formulas and proper date types
 */
export const exportMasterSheetExcel = (rawData, filterParams = {}) => {
    if (!rawData) throw new Error('Nenhum dado disponível para exportar.');
    const data = filterInactiveAndInvoiced(rawData);

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

        const ws = XLSX.utils.aoa_to_sheet(metaHeader, { cellDates: true });

        // Auto-format dates
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = 4; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = ws[cellRef];
                if (cell && cell.t === 'd') {
                    cell.z = 'dd/mm/yyyy';
                }
            }
        }

        // Auto-fit column widths
        const colWidths = headerRow.map((h, colIdx) => {
            let maxLen = String(h).length;
            dataRows.forEach(row => {
                const rawVal = row[colIdx];
                let cellVal = '';
                if (rawVal instanceof Date) {
                    cellVal = '00/00/0000';
                } else if (rawVal != null) {
                    cellVal = String(rawVal);
                }
                if (cellVal.length > maxLen) maxLen = cellVal.length;
            });
            return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
        });
        ws['!cols'] = colWidths;

        return ws;
    };

    // 1. Aba: Resumo (com carga por recurso em horas)
    if (data.resumo && data.resumo.length > 0) {
        const productLoads = {};
        if (data.carga) {
            data.carga.forEach(item => {
                const prod = item.produto;
                if (!productLoads[prod]) productLoads[prod] = {};
                (data.recursos || []).forEach(r => {
                    productLoads[prod][r] = (productLoads[prod][r] || 0) + (Number(item['rec_' + r]) || 0);
                });
            });
        }

        const resumoHeader = [
            'Produto', 'Descrição', 'UM', 'Qtd Total a Produzir',
            ...(data.recursos || []).map(r => `${data.recursoNomeMap?.[r] || r} (h)`)
        ];

        const resumoRows = data.resumo.map(r => {
            const loads = productLoads[r.produto] || {};
            const row = [
                r.produto,
                r.descricao || '-',
                r.um || '-',
                Number(r.qtd_total || 0)
            ];
            (data.recursos || []).forEach(rec => {
                const valHoras = (loads[rec] || 0) / 50; // 50 min/hora padrão MetalFisa
                row.push(valHoras > 0 ? Number(valHoras.toFixed(2)) : 0);
            });
            return row;
        });
        const wsResumo = createMetalFisaSheet('Resumo de Produtos', resumoHeader, resumoRows);
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
    }

    // 2. Aba: Pedidos (com 1ª Data PCP, Últ. Data PCP e Horas por Recurso)
    if (data.pedidos && data.pedidos.length > 0) {
        const pedHeader = [
            'Pedido', 'Emissão', 'Cliente', 'Qtde Itens', 'Soma QTD',
            'Próx. Entrega', '1ª Data PCP', 'Últ. Data PCP',
            ...(data.recursos || []).map(r => `${data.recursoNomeMap?.[r] || r} (h)`)
        ];
        const pedRows = data.pedidos.map(p => {
            const row = [
                p.pedido,
                parseToDate(p.emissao),
                p.cliente,
                Number(p.item_count || p.itens_count || 0),
                Number(p.soma_qtd || 0),
                parseToDate(p.proxima_entrega),
                parseToDate(p.pcp_inicio),
                parseToDate(p.pcp_fim)
            ];
            (data.recursos || []).forEach(r => {
                row.push(Number(p['rec_' + r] || 0));
            });
            return row;
        });
        const wsPedidos = createMetalFisaSheet('Lista de Pedidos', pedHeader, pedRows);
        XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos');
    }

    // 3. Aba: Itens Detalhados (com Grupo de Prioridade, Data PCP, Nova Data PCP e Qtde PCP)
    if (data.itens && data.itens.length > 0) {
        const itensHeader = [
            'Pedido', 'Cliente', 'Item', 'Produto', 'Descrição', 'UM',
            'Grupo Prioridade', 'Qtd Pedido', 'Qtd Faturada', 'Qtd Faturar',
            'Entrega', 'Data PCP', 'Nova Data PCP', 'Qtde PCP', 'OP', 'Ped. Cliente'
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
            parseToDate(i.entrega),
            parseToDate(i.data_pcp),
            parseToDate(i.nova_data_pcp),
            i.qtde_pcp != null && i.qtde_pcp !== '' ? Number(i.qtde_pcp) : '',
            i.op || '-',
            i.ped_cli || '-'
        ]);
        const wsItens = createMetalFisaSheet('Itens Detalhados com Prioridade', itensHeader, itensRows);
        XLSX.utils.book_append_sheet(wb, wsItens, 'Itens Detalhados');
    }

    // 4. Aba: Estrutura BOM
    if (data.estruturas && data.estruturas.length > 0) {
        const baseCalculo = options?.baseCalculo || 'saldo';
        const parentQtyMap = {};
        if (data.itens) {
            data.itens.forEach(item => {
                const p = (item.produto || '').trim();
                const qty = baseCalculo === 'pedido' ? Number(item.qtd || 0) : Number(item.qtd_faturar || 0);
                parentQtyMap[p] = (parentQtyMap[p] || 0) + qty;
            });
        }

        const bomHeader = ['Produto Pai (Raiz)', 'Componente', 'Descrição Componente', 'UM', 'Tipo', 'Qtd Unitária', 'Qtd Total'];
        const bomRows = data.estruturas.map(b => {
            const parentQty = parentQtyMap[b.raiz] || 0;
            const qtdTotal = Number(b.quant || 0) * parentQty;
            return [
                b.raiz,
                b.comp,
                b.desc || '-',
                b.um || '-',
                b.tipo || '-',
                Number(b.quant || 0),
                qtdTotal
            ];
        });
        const wsBom = createMetalFisaSheet('Estrutura de Produtos (BOM)', bomHeader, bomRows);
        XLSX.utils.book_append_sheet(wb, wsBom, 'Estrutura BOM');
    }

    // 5. Aba: Necessidade de Materiais (com Data Entrega, Data PCP, Qtde PCP e Opções Dinâmicas)
    if (data.itens && data.estruturas && data.itens.length > 0 && data.estruturas.length > 0) {
        const exibirCustos = !!options.exibirCustos;
        const filtroTipo = options.filtroTipo || 'MP';
        const baseCalculo = options.baseCalculo || 'saldo';

        const matHeader = [
            'Pedido', 'Cliente', 'Prod. Final', 'Descrição Prod. Final',
            'Data Entrega', 'Data PCP', 'Qtde PCP',
            baseCalculo === 'pedido' ? 'Qtd Pedido' : 'Qtd Faturar',
            'Cód. Material', 'Descrição do Material', 'UM', 'Tipo', 'Qtd Unitária (BOM)', 'Qtd Necessária'
        ];

        if (exibirCustos) {
            matHeader.push('Custo Unitário', 'Custo Total');
        }

        const matRows = [];
        data.itens.forEach(item => {
            const parentProd = (item.produto || '').trim();
            const parentQtd = baseCalculo === 'pedido'
                ? Number(item.qtd || 0)
                : Number(item.qtd_faturar || 0);

            const comps = data.estruturas.filter(e => e.raiz === parentProd);

            comps.forEach(c => {
                const compTipo = (c.tipo || '').trim().toUpperCase();
                const matchesTipo = filtroTipo === 'Todos' || compTipo === filtroTipo.toUpperCase();
                if (!matchesTipo) return;

                const totalQtd = parentQtd * (Number(c.quant) || 0);
                const row = [
                    item.pedido,
                    item.cliente,
                    parentProd,
                    item.descricao || '-',
                    parseToDate(item.entrega),
                    parseToDate(item.data_pcp),
                    item.qtde_pcp != null && item.qtde_pcp !== '' ? Number(item.qtde_pcp) : '',
                    parentQtd,
                    c.comp,
                    c.desc || '-',
                    c.um || '-',
                    c.tipo || '-',
                    Number(c.quant || 0),
                    Number(totalQtd)
                ];

                if (exibirCustos) {
                    const custoUnit = Number(c.custo_unitario || 0);
                    const custoTotal = totalQtd * custoUnit;
                    row.push(custoUnit, custoTotal);
                }

                matRows.push(row);
            });
        });
        const wsMat = createMetalFisaSheet('Necessidade de Materiais', matHeader, matRows);
        XLSX.utils.book_append_sheet(wb, wsMat, 'Necessidade de Materiais');
    }

    // 6. Aba: Carga por Recurso (com Fórmulas Dinâmicas Padrão e Painel de Capacidade)
    if (data.carga && data.carga.length > 0 && data.recursos) {
        const recursos = data.recursos;
        const capacidades = data.capacidades || {};
        const recursoNomeMap = data.recursoNomeMap || {};

        const baseHeaders = [
            'Pedido', 'Emissão', 'Cliente', 'Item', 'Produto', 'Descrição',
            'Saldo a Faturar', 'Entrega', 'Data PCP', 'Nova Data PCP', 'Qtde PCP', 'Prioridade'
        ];
        const recursoHeaders = recursos.map(r => recursoNomeMap[r] || `Rec ${r} (min)`);
        const fullHeader = [...baseHeaders, ...recursoHeaders];

        const aoa = [];
        // Linhas 1 a 8 reservadas para o painel de fórmulas e indicadores
        for (let r = 0; r < 8; r++) aoa.push([]);

        // Linha 9: Cabeçalhos das Colunas
        aoa.push(fullHeader);

        // Linha 10 em diante: Dados das Cargas dos Pedidos
        data.carga.forEach(c => {
            const row = [
                c.pedido,
                parseToDate(c.emissao),
                c.cliente,
                c.item,
                c.produto,
                c.descricao || '-',
                Number(c.qtd_faturar || 0),
                parseToDate(c.entrega),
                parseToDate(c.data_pcp),
                parseToDate(c.nova_data_pcp),
                c.qtde_pcp != null && c.qtde_pcp !== '' ? Number(c.qtde_pcp) : '',
                c.op_prioridade ? `Grupo ${c.op_prioridade}` : '-'
            ];

            recursos.forEach(r => {
                row.push(Number(c['rec_' + r] || 0));
            });

            aoa.push(row);
        });

        const wsCarga = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
        const startDataRow = 10;
        const endDataRow = aoa.length; // Sempre a última linha com dados exatos!
        const maxCol = XLSX.utils.encode_col(fullHeader.length - 1);
        wsCarga['!ref'] = `A1:${maxCol}${Math.max(startDataRow, endDataRow)}`;

        // Injetar Fórmulas Padrão no Topo (Linhas 3 a 8)
        wsCarga['K3'] = { v: 'Numero de Dias com base no filtro DATA PCP', t: 's' };
        
        wsCarga['H5'] = { v: 'Data Maxima', t: 's' };
        wsCarga['I5'] = { f: `SUBTOTAL(104, $I$${startDataRow}:$I$${endDataRow})`, z: 'yyyy-mm-dd' };
        wsCarga['J5'] = { v: 'CAPACIDADE', t: 's' };
        wsCarga['K5'] = { f: 'NETWORKDAYS(I6,I5)', z: '#,##0.00' };

        wsCarga['H6'] = { v: 'Data Minima', t: 's' };
        wsCarga['I6'] = { f: 'TODAY()', z: 'yyyy-mm-dd' };

        wsCarga['H7'] = { v: 'Data Minima', t: 's' };
        wsCarga['I7'] = { f: `SUBTOTAL(105, $I$${startDataRow}:$I$${endDataRow})`, z: 'yyyy-mm-dd' };
        wsCarga['L7'] = { v: 'CARGA -Total em hh/m', t: 's' };

        wsCarga['L8'] = { v: 'Total Minutos', t: 's' };

        // Fórmulas Dinâmicas para cada Recurso / Máquina considerando a última linha exata
        recursos.forEach((r, idx) => {
            const colIdx = baseHeaders.length + idx;
            const colLetter = XLSX.utils.encode_col(colIdx);
            const capDiariaMin = capacidades[r.toUpperCase()] || 480;
            const capHoras = Math.round((capDiariaMin / 60) * 100) / 100;

            // Saldo de Capacidade em Horas: Linha 3 = Linha 5 (Capacidade) - Linha 7 (Carga)
            wsCarga[`${colLetter}3`] = { f: `${colLetter}5-${colLetter}7`, z: '#,##0.00' };
            // Capacidade Total no Período em Horas: Linha 5 = Dias Úteis ($K$5) * Horas Diárias da Máquina
            wsCarga[`${colLetter}5`] = { f: `$K$5*${capHoras}`, z: '#,##0.00' };
            // Carga Total em Horas: Linha 7 = Total Minutos (Linha 8) / 50 (horas padrão MetalFisa)
            wsCarga[`${colLetter}7`] = { f: `${colLetter}8/50`, z: '#,##0.00' };
            // Total Minutos com Subtotal dinâmico até a última linha: Linha 8 = SUBTOTAL(9, Col10:ColEnd)
            wsCarga[`${colLetter}8`] = { f: `SUBTOTAL(9,${colLetter}${startDataRow}:${colLetter}${endDataRow})`, z: '#,##0.00' };
        });

        // Formatar datas das linhas de dados
        for (let r = startDataRow; r <= endDataRow; r++) {
            ['B', 'H', 'I', 'J'].forEach(col => {
                const cellRef = `${col}${r}`;
                if (wsCarga[cellRef] && wsCarga[cellRef].t === 'd') {
                    wsCarga[cellRef].z = 'yyyy-mm-dd';
                }
            });
        }

        // Largura automática das colunas
        const colWidths = fullHeader.map((h, colIdx) => {
            return { wch: Math.min(Math.max(String(h).length + 3, 12), 40) };
        });
        wsCarga['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, wsCarga, 'Carga por Recurso');
    }

    // 7. Aba: Capacidade do Período
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

    // 8. Aba: Execução OP
    if (data.execucao_op && data.execucao_op.length > 0 && data.recursos) {
        const execHeader = [
            'Pedido', 'Cliente', 'OP', 'Produto', 'Qtd Planejada', 'Data PCP', 'Qtde PCP',
            ...data.recursos.flatMap(r => [`${r} Prev (min)`, `${r} Apon (min)`, `${r} Qtd Apon (un)`])
        ];
        const execRows = data.execucao_op.map(e => [
            e.pedido,
            e.cliente,
            e.op,
            e.produto,
            Number(e.qtd_planejada || 0),
            parseToDate(e.data_pcp),
            e.qtde_pcp != null && e.qtde_pcp !== '' ? Number(e.qtde_pcp) : '',
            ...data.recursos.flatMap(r => [
                Number(e['previsto_' + r] || 0),
                Number(e['apontado_' + r] || 0),
                Number(e['qtd_apontada_' + r] || 0)
            ])
        ]);
        const wsExec = createMetalFisaSheet('Execução e Apontamentos de OP', execHeader, execRows);
        XLSX.utils.book_append_sheet(wb, wsExec, 'Execução OP');
    }

    // 9. Aba: Prog. Entregas (Distribuição por Data PCP dos Próximos 14 Dias)
    if (data.itens && data.itens.length > 0) {
        const dHoje = new Date();
        dHoje.setHours(0, 0, 0, 0);

        const dateCols = [];
        const dayNames = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
        const monthNames = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

        for (let i = 0; i < 14; i++) {
            const d = new Date(dHoje.getTime() + i * 86400000);
            const iso = d.toISOString().split('T')[0];
            const label = `${dayNames[d.getDay()]} - ${d.getDate()} de ${monthNames[d.getMonth()]}`;
            dateCols.push({ iso, label });
        }

        const progHeader = [
            'Pedido', 'Cliente', 'Código Produto', 'Descrição Produto', 'OPs',
            'Qtd Total OP', 'Total Saldo Prod', ...dateCols.map(dc => dc.label)
        ];

        const progRows = data.itens.map(it => {
            const itemPcpDate = normalizeToISO(it.data_pcp || it.entrega);
            const qtdFaturar = Number(it.qtd_faturar || 0);

            const row = [
                it.pedido,
                it.cliente,
                it.produto,
                it.descricao || '-',
                it.op || '-',
                Number(it.qtd || 0),
                qtdFaturar
            ];

            dateCols.forEach(dc => {
                if (itemPcpDate === dc.iso) {
                    row.push(qtdFaturar);
                } else {
                    row.push('');
                }
            });

            return row;
        });

        const wsProg = createMetalFisaSheet('Programação de Entregas (14 Dias)', progHeader, progRows);
        XLSX.utils.book_append_sheet(wb, wsProg, 'Prog. Entregas');
    }

    const fileName = `Planilha_Mestra_MetalFisa_${getTodayDateStr()}.xlsx`;
    XLSX.writeFile(wb, fileName);
};

/**
 * EXPORT TO PDF (.PDF) — ESTILO METALFISA
 * Exports Planilha Mestra data into formatted PDF report
 */
export const exportMasterSheetPdf = (rawData, activeTab = 'itens', filterParams = {}) => {
    if (!rawData) throw new Error('Nenhum dado disponível para exportar.');
    const data = filterInactiveAndInvoiced(rawData);

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
        headers = [['Produto Pai (Raiz)', 'Componente', 'Descrição Componente', 'UM', 'Tipo', 'Qtd Unitária', 'Qtd Total']];
        const baseCalculo = filterParams?.baseCalculo || 'saldo';
        const parentQtyMap = {};
        if (data.itens) {
            data.itens.forEach(item => {
                const p = (item.produto || '').trim();
                const qty = baseCalculo === 'pedido' ? Number(item.qtd || 0) : Number(item.qtd_faturar || 0);
                parentQtyMap[p] = (parentQtyMap[p] || 0) + qty;
            });
        }
        rows = data.estruturas.map(b => {
            const parentQty = parentQtyMap[b.raiz] || 0;
            const qtdTotal = Number(b.quant || 0) * parentQty;
            return [b.raiz, b.comp, b.desc || '-', b.um || '-', b.tipo || '-', formatNum(b.quant), formatNum(qtdTotal)];
        });
    } else if (activeTab === 'materiais_necessarios' && data.itens && data.estruturas) {
        tabLabel = 'Necessidade Detalhada de Materiais';
        headers = [['Pedido', 'Cliente', 'Prod. Final', 'Data Entrega', 'Data PCP', 'Qtde PCP', 'Qtd Faturar', 'Cód. Material', 'Descrição do Material', 'UM', 'Qtd Unit.', 'Qtd Necessária']];
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
                    formatDate(item.entrega),
                    formatDate(item.data_pcp),
                    item.qtde_pcp != null ? formatNum(item.qtde_pcp) : '-',
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
        // Default: Itens Detalhados com Prioridades e Data PCP
        tabLabel = 'Itens Detalhados com Grupos de Prioridades';
        headers = [['Pedido', 'Cliente', 'Item', 'Produto', 'Descrição', 'UM', 'Prioridade', 'Qtd Pedido', 'Qtd Faturar', 'Entrega', 'Data PCP', 'Nova Data PCP']];
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
            formatDate(i.data_pcp),
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
