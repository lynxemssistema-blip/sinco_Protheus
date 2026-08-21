import React, { useState, useMemo, useRef } from 'react';
import { 
    UploadCloud, FileSpreadsheet, Search, Filter, Download, 
    ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, 
    Layers, Package, AlertCircle, RefreshCw, Eye, EyeOff, FileText,
    Zap, Check, RotateCcw, Sparkles, Send, HelpCircle, Table, BookOpen, Printer
} from 'lucide-react';
import { api, getProductDocuments, getFileUrl } from '../../services/api';
import BOMStructureModal from '../../components/BOMStructureModal';
import { useHelp } from '../../contexts/HelpContext';
import { generateDemandaMesPdf } from '../../services/demandaMesPdfGenerator';
import * as XLSX from 'xlsx';

export default function DemandaMesPage() {
    const { openHelp } = useHelp();
    const [file, setFile] = useState(null);
    const [validatingFile, setValidatingFile] = useState(false);
    const [loading, setLoading] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [showHelpGuide, setShowHelpGuide] = useState(false);
    const [error, setError] = useState(null);
    const [resultData, setResultData] = useState(null);
    const [filterText, setFilterText] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, COM_SALDO, SEM_SALDO
    const [filterMonth, setFilterMonth] = useState('ALL');
    const fileInputRef = useRef(null);

    // Estado do Modal/Popover de Edição de Data PCP
    const [editingPcp, setEditingPcp] = useState(null); // { pedido, item, saldo, dataAtual, refCliente }
    const [newDateInput, setNewDateInput] = useState('');
    const [savingPcp, setSavingPcp] = useState(false);
    const [openingPdf, setOpeningPdf] = useState(null);

    // Estado do Modal de Estrutura da OP (Visão Geral)
    const [bomStructureTarget, setBomStructureTarget] = useState(null); // { op, itemPv, pedido, produto }

    // Estado de Simulação Fantasma de PCP (Propostas)
    // Map key: `${pedido_metal}_${item_pedido}` -> { pedido, item, nova_data, mes_alocado, ref_cliente, saldo, data_anterior }
    const [proposedPcp, setProposedPcp] = useState({});
    const [distributing, setDistributing] = useState(false);
    const [savingBulk, setSavingBulk] = useState(false);
    const [savingItemKey, setSavingItemKey] = useState(null);

    // Estado do Modal de Opções de Auto-Distribuição
    const [distributeModalOpen, setDistributeModalOpen] = useState(false);
    const [includeOthersInLastMonth, setIncludeOthersInLastMonth] = useState(false);
    const [fillingProgress, setFillingProgress] = useState(null); // { current, total, percentage, status, fileName, finished: bool }
    const [validationError, setValidationError] = useState(null); // { fileName, issues: [], sampleHeaders: [] }
    const templateFileInputRef = useRef(null);

    const hasProposals = Object.keys(proposedPcp).length > 0;

    // Helper: Parse mês label para { year, monthIdx (0-11) }
    const parseMonthHeader = (monthLabel) => {
        if (!monthLabel) return null;
        const clean = monthLabel.replace(/^DEM\.\s*/i, '').trim();
        const parts = clean.split('/');
        if (parts.length < 2) return null;
        
        const mStr = parts[0].trim().toLowerCase();
        const yStr = parts[1].trim();
        const year = parseInt(yStr, 10);
        if (isNaN(year)) return null;

        const monthsMap = {
            'jan': 0, 'janeiro': 0, '01': 0, '1': 0,
            'fev': 1, 'fevereiro': 1, '02': 1, '2': 1,
            'mar': 2, 'marco': 2, 'março': 2, '03': 2, '3': 2,
            'abr': 3, 'abril': 3, '04': 3, '4': 3,
            'mai': 4, 'maio': 4, '05': 4, '5': 4,
            'jun': 5, 'junho': 5, '06': 5, '6': 5,
            'jul': 6, 'julho': 6, '07': 6, '7': 6,
            'ago': 7, 'agosto': 7, '08': 7, '8': 7,
            'set': 8, 'setembro': 8, '09': 8, '9': 8,
            'out': 9, 'outubro': 9, '10': 9,
            'nov': 10, 'novembro': 10, '11': 10,
            'dez': 11, 'dezembro': 11, '12': 11
        };

        const monthIdx = monthsMap[mStr];
        if (monthIdx === undefined) return null;
        return { year, monthIdx };
    };

    // Helper: Gerar dias úteis (Segundas, Quartas e Sextas - VMI) de um determinado mês
    // REGRA CRÍTICA: Não permite datas menores ou iguais à data atual (hoje)
    const getVmiDeliveryDays = (year, monthIdx) => {
        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const date = new Date(year, monthIdx, 1);
        while (date.getMonth() === monthIdx) {
            const dayOfWeek = date.getDay(); // 1 = Seg, 3 = Qua, 5 = Sex
            // Apenas Seg, Qua, Sex e ESTRITAMENTE maior que a data atual (> hoje)
            if ((dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) && date > today) {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                days.push(`${yyyy}-${mm}-${dd}`);
            }
            date.setDate(date.getDate() + 1);
        }
        return days;
    };

    // Helper: Validar se o cliente é VMI
    const isClienteVmi = (pedidoObj) => {
        if (!pedidoObj || !pedidoObj.nome_cliente) return false;
        return String(pedidoObj.nome_cliente).toUpperCase().includes('VMI SISTEMAS');
    };

    // Algoritmo: Auto-Distribuir Carga PCP (Seg/Qua/Sex) em modo Simulação/Fantasma
    const runAutoDistribution = (includeOthers = false) => {
        if (!resultData || !resultData.itens || resultData.itens.length === 0) return;

        const mesesDemanda = resultData.mesesDemanda || [];
        if (mesesDemanda.length === 0) {
            alert('Nenhuma coluna de mês identificada na planilha.');
            return;
        }

        setDistributeModalOpen(false);
        setDistributing(true);

        // Permite ao React renderizar o estado de loading/processando antes de rodar o algoritmo síncrono
        setTimeout(() => {
            try {
                const newProposals = {};

                // Mapeia o último mês disponível da planilha e calcula o mês futuro (+5 anos)
                const lastMonthLabel = mesesDemanda[mesesDemanda.length - 1];
                const lastMonthParsed = parseMonthHeader(lastMonthLabel);
                
                // Mês futuro (+5 anos) para itens sem demanda ou excedentes
                const futureYear = lastMonthParsed ? lastMonthParsed.year + 5 : (new Date().getFullYear() + 5);
                const futureMonthIdx = lastMonthParsed ? lastMonthParsed.monthIdx : 11;
                const futureMonthDays = getVmiDeliveryDays(futureYear, futureMonthIdx);
                let futureMonthDayIndexGlobal = 0;

                resultData.itens.forEach(item => {
                    if (!item.pedidos || item.pedidos.length === 0 || !item.possui_saldo) return;

                    // Filtra para aplicar Auto-Distribuição APENAS se o cliente for VMI
                    const vmiPedidos = item.pedidos.filter(p => isClienteVmi(p));
                    if (vmiPedidos.length === 0) return;

                    // 1. Coletar e ordenar OPs/Pedidos por prioridade de entrega
                    // Regra: pedidos com OPs ativas primeiro, menor número de OP / pedido mais antigo
                    const sortedPedidos = [...vmiPedidos].sort((a, b) => {
                        const opA = a.ops?.[0]?.numero_op || '99999999999';
                        const opB = b.ops?.[0]?.numero_op || '99999999999';
                        if (opA !== opB) return opA.localeCompare(opB);
                        return (a.pedido_metal || '').localeCompare(b.pedido_metal || '');
                    });

                    // 2. Mapear demandas mensais positivas
                    const targetMonths = [];
                    mesesDemanda.forEach(mLabel => {
                        const demQty = item.demandas[mLabel] || 0;
                        if (demQty > 0) {
                            const parsed = parseMonthHeader(mLabel);
                            if (parsed) {
                                const deliveryDays = getVmiDeliveryDays(parsed.year, parsed.monthIdx);
                                if (deliveryDays.length > 0) {
                                    targetMonths.push({
                                        label: mLabel,
                                        demandQty: demQty,
                                        year: parsed.year,
                                        monthIdx: parsed.monthIdx,
                                        deliveryDays,
                                        currentDayIdx: 0,
                                        allocatedQty: 0
                                    });
                                }
                            }
                        }
                    });

                    // Se o item NÃO tem demanda em nenhum mês da planilha
                    if (targetMonths.length === 0) {
                        if (includeOthers && futureMonthDays.length > 0) {
                            // Distribui para o mês de +5 anos (Coluna 'Sem Demanda')
                            sortedPedidos.forEach(p => {
                                if (p.saldo_a_faturar <= 0) return;
                                const chosenDay = futureMonthDays[futureMonthDayIndexGlobal % futureMonthDays.length];
                                futureMonthDayIndexGlobal++;

                                const currentActualDate = p.previsoes_pcp?.[0]?.data_pcp;
                                const key = `${p.pedido_metal}_${p.item_pedido}`;

                                newProposals[key] = {
                                    pedido: p.pedido_metal,
                                    item: p.item_pedido,
                                    nova_data: chosenDay,
                                    mes_alocado: 'SEM_DEMANDA',
                                    ref_cliente: item.ref_cliente,
                                    codigo_metalfisa: item.codigo_metalfisa,
                                    saldo: p.saldo_a_faturar,
                                    ops: p.ops?.map(o => o.numero_op).join(', ') || 'SEM OP',
                                    data_anterior: currentActualDate
                                };
                            });
                        }
                        return;
                    }

                    let currentMonthIdx = 0;

                    // 3. Distribuir OPs por mês usando AGRUPAMENTO ACUMULADO.
                    //
                    //    Regra: OPs são acumuladas num buffer até que a SOMA do grupo >= demanda do mês.
                    //    Somente quando o grupo "fecha" a demanda é que todas as OPs do grupo são
                    //    enviadas para aquele mês e o ponteiro avança para o próximo.
                    //
                    //    Isso garante que um mês nunca recebe OPs insuficientes quando há mais OPs
                    //    disponíveis para completar a demanda.
                    //
                    //    Exemplo:
                    //      Outubro: demanda = 30un
                    //        OP A = 12un → buffer=[A], soma=12 (< 30, acumula)
                    //        OP B = 10un → buffer=[A,B], soma=22 (< 30, acumula)
                    //        OP C = 12un → buffer=[A,B,C], soma=34 (>= 30, flush → todas vão para Outubro)
                    //      Novembro começa com buffer vazio.

                    // Buffer de OPs para o mês atual
                    let monthBuffer = [];
                    let monthBufferSaldo = 0;

                    // Flushes o buffer: atribui datas do mês a todas as OPs acumuladas
                    const flushBufferToMonth = (monthObj, mesLabel) => {
                        monthBuffer.forEach(op => {
                            const day = monthObj.deliveryDays[monthObj.currentDayIdx % monthObj.deliveryDays.length];
                            monthObj.currentDayIdx++;
                            const opKey = `${op.pedido_metal}_${op.item_pedido}`;
                            newProposals[opKey] = {
                                pedido: op.pedido_metal,
                                item: op.item_pedido,
                                nova_data: day,
                                mes_alocado: mesLabel,
                                ref_cliente: item.ref_cliente,
                                codigo_metalfisa: item.codigo_metalfisa,
                                saldo: op.saldo_a_faturar,
                                ops: op.ops?.map(o => o.numero_op).join(', ') || 'SEM OP',
                                data_anterior: op.previsoes_pcp?.[0]?.data_pcp
                            };
                        });
                        monthObj.allocatedQty += monthBufferSaldo;
                        monthBuffer = [];
                        monthBufferSaldo = 0;
                    };

                    for (const p of sortedPedidos) {
                        if (p.saldo_a_faturar <= 0) continue;

                        // Pula meses que já atingiram a demanda
                        while (
                            currentMonthIdx < targetMonths.length &&
                            targetMonths[currentMonthIdx].allocatedQty >= targetMonths[currentMonthIdx].demandQty
                        ) {
                            currentMonthIdx++;
                        }

                        if (currentMonthIdx >= targetMonths.length) {
                            // Todos os meses com demanda estão cheios
                            if (includeOthers && futureMonthDays.length > 0) {
                                const day = futureMonthDays[futureMonthDayIndexGlobal % futureMonthDays.length];
                                futureMonthDayIndexGlobal++;
                                const opKey = `${p.pedido_metal}_${p.item_pedido}`;
                                newProposals[opKey] = {
                                    pedido: p.pedido_metal,
                                    item: p.item_pedido,
                                    nova_data: day,
                                    mes_alocado: 'SEM_DEMANDA',
                                    ref_cliente: item.ref_cliente,
                                    codigo_metalfisa: item.codigo_metalfisa,
                                    saldo: p.saldo_a_faturar,
                                    ops: p.ops?.map(o => o.numero_op).join(', ') || 'SEM OP',
                                    data_anterior: p.previsoes_pcp?.[0]?.data_pcp
                                };
                            }
                            continue;
                        }

                        const targetMonthObj = targetMonths[currentMonthIdx];

                        // Acumula esta OP no buffer do mês atual
                        monthBuffer.push(p);
                        monthBufferSaldo += p.saldo_a_faturar;

                        // Quando a soma do grupo >= demanda do mês → fecha o grupo e avança o mês
                        if (monthBufferSaldo >= targetMonthObj.demandQty) {
                            flushBufferToMonth(targetMonthObj, targetMonthObj.label);
                            currentMonthIdx++;
                        }
                        // Se ainda não atingiu a demanda → continua acumulando no próximo loop
                    }

                    // OPs restantes no buffer que não completaram a demanda de nenhum mês
                    // → aloca no mês atual (não há mais OPs para completar o grupo)
                    if (monthBuffer.length > 0) {
                        if (currentMonthIdx < targetMonths.length && targetMonths[currentMonthIdx].deliveryDays.length > 0) {
                            flushBufferToMonth(targetMonths[currentMonthIdx], targetMonths[currentMonthIdx].label);
                        } else if (includeOthers && futureMonthDays.length > 0) {
                            monthBuffer.forEach(op => {
                                const day = futureMonthDays[futureMonthDayIndexGlobal % futureMonthDays.length];
                                futureMonthDayIndexGlobal++;
                                const opKey = `${op.pedido_metal}_${op.item_pedido}`;
                                newProposals[opKey] = {
                                    pedido: op.pedido_metal,
                                    item: op.item_pedido,
                                    nova_data: day,
                                    mes_alocado: 'SEM_DEMANDA',
                                    ref_cliente: item.ref_cliente,
                                    codigo_metalfisa: item.codigo_metalfisa,
                                    saldo: op.saldo_a_faturar,
                                    ops: op.ops?.map(o => o.numero_op).join(', ') || 'SEM OP',
                                    data_anterior: op.previsoes_pcp?.[0]?.data_pcp
                                };
                            });
                        }
                    }
                });

                const totalPropostas = Object.keys(newProposals).length;
                if (totalPropostas === 0) {
                    alert('Nenhum pedido com saldo pendente elegível para distribuição automática.');
                } else {
                    setProposedPcp(newProposals);
                }
            } catch (err) {
                console.error('Erro ao auto-distribuir:', err);
                alert('Erro durante a distribuição: ' + err.message);
            } finally {
                setDistributing(false);
            }
        }, 150);
    };

    // Descartar todas as simulações
    const handleClearProposals = () => {
        setProposedPcp({});
    };

    // Descartar proposta de um único item
    const handleDiscardSingleProposal = (key) => {
        setProposedPcp(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    // Salvar proposta de um único item no SINCO
    const handleSaveSingleProposal = async (key) => {
        const prop = proposedPcp[key];
        if (!prop) return;

        setSavingItemKey(key);
        try {
            const payload = {
                pedido_metal: prop.pedido,
                item: prop.item,
                nova_data: prop.nova_data,
                saldo: prop.saldo,
                usuario: 'VMI Auto-PCP'
            };

            const res = await api.post('/wabtec-datas/update-sinco-date', payload);
            if (res.data && res.data.success) {
                applyDateUpdateLocally(prop.pedido, prop.item, prop.nova_data, prop.saldo);
                handleDiscardSingleProposal(key);
            } else {
                alert('Erro ao salvar no SINCO: ' + (res.data?.error || 'Tente novamente.'));
            }
        } catch (err) {
            console.error('Erro ao salvar proposta individual:', err);
            alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingItemKey(null);
        }
    };

    // Salvar Todas as Propostas em Lote (Bulk Update) no SINCO
    const handleSaveAllProposals = async () => {
        const proposalList = Object.values(proposedPcp);
        if (proposalList.length === 0) return;

        if (!window.confirm(`Confirma gravar todas as ${proposalList.length} datas simuladas no banco de dados do SINCO?`)) {
            return;
        }

        setSavingBulk(true);
        try {
            const updates = proposalList.map(p => ({
                pedido_metal: p.pedido,
                item: p.item,
                nova_data: p.nova_data,
                saldo: p.saldo
            }));

            const res = await api.post('/wabtec-datas/update-sinco-date-bulk', {
                updates,
                usuario: 'VMI Auto-Distribute Bulk'
            });

            if (res.data && res.data.success) {
                // Atualizar tudo localmente de uma vez
                setResultData(prev => {
                    if (!prev || !prev.itens) return prev;
                    const nextItens = prev.itens.map(it => {
                        let hasChanges = false;
                        const nextPedidos = (it.pedidos || []).map(p => {
                            const match = proposalList.find(prop => prop.pedido === p.pedido_metal && prop.item === p.item_pedido);
                            if (match) {
                                hasChanges = true;
                                return {
                                    ...p,
                                    previsoes_pcp: [{
                                        data_pcp: match.nova_data,
                                        quantidade_pcp: p.saldo_a_faturar,
                                        op_vinculada: p.ops?.[0]?.numero_op || 'SEM OP'
                                    }]
                                };
                            }
                            return p;
                        });

                        if (!hasChanges) return it;

                        const nextPcpPorMes = {};
                        nextPedidos.forEach(p => {
                            if (p.previsoes_pcp?.length > 0) {
                                p.previsoes_pcp.forEach(fc => {
                                    const mGrp = getMonthGroup(fc.data_pcp);
                                    nextPcpPorMes[mGrp] = (nextPcpPorMes[mGrp] || 0) + (Number(fc.quantidade_pcp) || p.saldo_a_faturar);
                                });
                            } else {
                                nextPcpPorMes['SEM DATA PCP'] = (nextPcpPorMes['SEM DATA PCP'] || 0) + p.saldo_a_faturar;
                            }
                        });

                        return {
                            ...it,
                            pedidos: nextPedidos,
                            pcp_por_mes: nextPcpPorMes
                        };
                    });

                    return { ...prev, itens: nextItens };
                });

                setProposedPcp({});
                alert(`Sucesso! ${res.data.successCount} previsões de entrega PCP foram atualizadas no SINCO.`);
            } else {
                alert('Erro ao processar lote: ' + (res.data?.error || 'Tente novamente.'));
            }
        } catch (err) {
            console.error('Erro no salvamento em lote:', err);
            alert('Erro ao salvar em lote: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingBulk(false);
        }
    };

    // Helper para atualizar um item localmente no resultData
    const applyDateUpdateLocally = (pedido, item, novaData, saldo) => {
        setResultData(prev => {
            if (!prev || !prev.itens) return prev;
            const nextItens = prev.itens.map(it => {
                const hasMatchingPed = it.pedidos?.some(p => p.pedido_metal === pedido && p.item_pedido === item);
                if (!hasMatchingPed) return it;

                const nextPedidos = it.pedidos.map(p => {
                    if (p.pedido_metal === pedido && p.item_pedido === item) {
                        return {
                            ...p,
                            previsoes_pcp: [{
                                data_pcp: novaData,
                                quantidade_pcp: saldo || p.saldo_a_faturar,
                                op_vinculada: p.ops?.[0]?.numero_op || 'SEM OP'
                            }]
                        };
                    }
                    return p;
                });

                const nextPcpPorMes = {};
                nextPedidos.forEach(p => {
                    if (p.previsoes_pcp?.length > 0) {
                        p.previsoes_pcp.forEach(fc => {
                            const mGrp = getMonthGroup(fc.data_pcp);
                            nextPcpPorMes[mGrp] = (nextPcpPorMes[mGrp] || 0) + (Number(fc.quantidade_pcp) || p.saldo_a_faturar);
                        });
                    } else {
                        nextPcpPorMes['SEM DATA PCP'] = (nextPcpPorMes['SEM DATA PCP'] || 0) + p.saldo_a_faturar;
                    }
                });

                return {
                    ...it,
                    pedidos: nextPedidos,
                    pcp_por_mes: nextPcpPorMes
                };
            });

            return { ...prev, itens: nextItens };
        });
    };

    const handleOpenDrawing = async (e, codigoProduto) => {
        if (e) e.stopPropagation();
        if (!codigoProduto || codigoProduto === 'NÃO MAPEADO') {
            alert('Produto não mapeado no Protheus.');
            return;
        }

        setOpeningPdf(codigoProduto);
        try {
            const docs = await getProductDocuments(codigoProduto);
            if (docs && docs.length > 0) {
                const desenho = docs.find(d => 
                    d.tipo === 'Desenho' || 
                    d.titulo_desenho || 
                    (d.url_arquivo && d.url_arquivo.toLowerCase().endsWith('.pdf')) ||
                    (d.nome_arquivo && d.nome_arquivo.toLowerCase().endsWith('.pdf'))
                ) || docs[0];

                if (desenho && (desenho.url_arquivo || desenho.id)) {
                    const targetUrl = desenho.url_arquivo 
                        ? getFileUrl(`/api/docs/view?path=${encodeURIComponent(desenho.url_arquivo)}`)
                        : getFileUrl(`/api/docs/${desenho.id}/view`);
                    window.open(targetUrl, '_blank');
                } else {
                    alert(`Nenhum arquivo PDF/Desenho encontrado para ${codigoProduto}.`);
                }
            } else {
                alert(`Nenhum documento/desenho cadastrado para o produto ${codigoProduto}.`);
            }
        } catch (err) {
            console.error('Erro ao abrir desenho:', err);
            alert(`Erro ao buscar o desenho do produto ${codigoProduto}.`);
        } finally {
            setOpeningPdf(null);
        }
    };

    const openPcpEditor = (e, { pedido, item, saldo, data_pcp, ref_cliente, isGhost = false, pedidoObj }) => {
        e.stopPropagation();
        
        // Bloqueio de funcionalidade exclusiva VMI
        if (pedidoObj && !isClienteVmi(pedidoObj)) {
            alert('Esta função é exclusiva para clientes VMI (VMI Sistemas).\n\nO cliente deste pedido é: ' + (pedidoObj.nome_cliente || 'NÃO IDENTIFICADO'));
            return;
        }

        let formattedDate = '';
        if (data_pcp) {
            try {
                const d = new Date(data_pcp);
                if (!isNaN(d.getTime())) {
                    formattedDate = d.toISOString().split('T')[0];
                } else {
                    formattedDate = String(data_pcp).split('T')[0];
                }
            } catch {
                formattedDate = '';
            }
        }
        setEditingPcp({ pedido, item, saldo, dataAtual: data_pcp, refCliente: ref_cliente, isGhost });
        setNewDateInput(formattedDate);
    };

    const handleSavePcpDate = async () => {
        if (!editingPcp || !newDateInput) return;

        // Validação estrita: Data PCP não pode ser menor ou igual a hoje
        const todayStr = new Date().toISOString().split('T')[0];
        if (newDateInput <= todayStr) {
            alert('A data PCP não pode ser menor ou igual à data de hoje. Escolha uma data futura.');
            return;
        }

        // Se estiver editando uma data que estava em proposta fantasma, atualiza a proposta ou salva direto
        if (editingPcp.isGhost) {
            const key = `${editingPcp.pedido}_${editingPcp.item}`;
            setProposedPcp(prev => ({
                ...prev,
                [key]: {
                    ...prev[key],
                    nova_data: newDateInput
                }
            }));
            setEditingPcp(null);
            return;
        }

        setSavingPcp(true);
        try {
            const payload = {
                pedido_metal: editingPcp.pedido,
                item: editingPcp.item,
                nova_data: newDateInput,
                saldo: editingPcp.saldo,
                usuario: 'Demanda Mes Web'
            };

            const res = await api.post('/wabtec-datas/update-sinco-date', payload);
            if (res.data && res.data.success) {
                applyDateUpdateLocally(editingPcp.pedido, editingPcp.item, newDateInput, editingPcp.saldo);
                // Se havia proposta fantasma desse item, remove
                const key = `${editingPcp.pedido}_${editingPcp.item}`;
                if (proposedPcp[key]) {
                    handleDiscardSingleProposal(key);
                }
                setEditingPcp(null);
            } else {
                alert('Erro ao atualizar data no SINCO: ' + (res.data?.error || 'Tente novamente.'));
            }
        } catch (err) {
            console.error('Erro ao salvar data PCP:', err);
            alert('Erro ao salvar data: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingPcp(false);
        }
    };

    const formatPcpDate = (dt) => {
        if (!dt) return 'S/D';
        try {
            const d = new Date(dt);
            if (isNaN(d.getTime())) {
                const parts = String(dt).split('T')[0].split('-');
                if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                return String(dt);
            }
            const dia = String(d.getUTCDate()).padStart(2, '0');
            const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
            const ano = d.getUTCFullYear();
            return `${dia}/${mes}/${ano}`;
        } catch {
            return String(dt);
        }
    };

    const getMonthGroup = (dt) => {
        if (!dt) return 'SEM DATA PCP';
        try {
            const d = new Date(dt);
            if (isNaN(d.getTime())) return 'SEM DATA PCP';
            const m = d.getUTCMonth() + 1;
            const y = d.getUTCFullYear();
            const mNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return `${mNames[m] || m}/${y}`;
        } catch {
            return 'SEM DATA PCP';
        }
    };

    const getMonthKeyFromDate = (dt) => {
        if (!dt) return null;
        try {
            const d = new Date(dt);
            if (isNaN(d.getTime())) return null;
            const m = d.getUTCMonth() + 1;
            const y = d.getUTCFullYear();
            const mNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return `${mNames[m] || m}/${y}`;
        } catch {
            return null;
        }
    };

    // Helper: Compara estritamente se uma data pertence a um Mês/Ano específico do cabeçalho
    const matchMonthYear = (dateStr, monthLabel) => {
        const fcMonth = getMonthKeyFromDate(dateStr); // Ex: 'Ago/2026'
        if (!fcMonth || !monthLabel) return false;
        const cleanLabel = monthLabel.replace(/^DEM\.\s*/i, '').trim().toLowerCase();
        return fcMonth.toLowerCase() === cleanLabel;
    };

    // Obter todas as previsões PCP que caem em um mês específico para um item.
    // IMPORTANTE: pedidos com proposta ativa (simulação) são EXCLUÍDOS aqui para evitar
    // duplicação — eles aparecerão apenas na coluna da data proposta via getGhostPcpItemsForMonth.
    const getPcpItemsForMonth = (item, monthLabel) => {
        if (!item?.pedidos) return [];
        const result = [];
        for (const p of item.pedidos) {
            // Pula se este pedido tem uma simulação ativa (será mostrado pela função ghost)
            const propKey = `${p.pedido_metal}_${p.item_pedido}`;
            if (proposedPcp[propKey]) continue;

            const opsStr = p.ops?.map(o => o.numero_op).join(', ') || '';
            for (const fc of (p.previsoes_pcp || [])) {
                if (matchMonthYear(fc.data_pcp, monthLabel)) {
                    result.push({
                        pedido: p.pedido_metal,
                        item: p.item_pedido,
                        data_pcp: fc.data_pcp,
                        quantidade: fc.quantidade_pcp,
                        ops: opsStr || fc.op_vinculada
                    });
                }
            }
        }
        return result;
    };

    // Obter previsões PCP FANTASMA (Simuladas) para o mês
    const getGhostPcpItemsForMonth = (item, monthLabel) => {
        if (!item?.pedidos) return [];
        const result = [];
        for (const p of item.pedidos) {
            const key = `${p.pedido_metal}_${p.item_pedido}`;
            const proposal = proposedPcp[key];
            if (proposal && proposal.mes_alocado !== 'SEM_DEMANDA') {
                if (matchMonthYear(proposal.nova_data, monthLabel)) {
                    result.push({
                        key,
                        pedido: proposal.pedido,
                        item: proposal.item,
                        data_pcp: proposal.nova_data,
                        quantidade: proposal.saldo,
                        ops: proposal.ops,
                        data_anterior: proposal.data_anterior
                    });
                }
            }
        }
        return result;
    };

    // Obter previsões PCP REAIS que NÃO estão em nenhum dos meses de demanda ou são de datas futuras (+3 a +5 anos).
    // IMPORTANTE: pedidos com proposta ativa são excluídos para evitar duplicação com getGhostNoDemandPcpItems.
    const getNoDemandPcpItems = (item, mesesDemanda = []) => {
        if (!item?.pedidos) return [];
        const result = [];

        for (const p of item.pedidos) {
            // Pula pedidos com simulação ativa (serão exibidos pela coluna ghost)
            const propKey = `${p.pedido_metal}_${p.item_pedido}`;
            if (proposedPcp[propKey]) continue;

            const opsStr = p.ops?.map(o => o.numero_op).join(', ') || '';
            for (const fc of (p.previsoes_pcp || [])) {
                // Verifica se a data PCP não dá "match" exato com nenhum dos meses de demanda do cabeçalho
                const matched = mesesDemanda.some(mLabel => matchMonthYear(fc.data_pcp, mLabel));
                
                if (!matched) {
                    result.push({
                        pedido: p.pedido_metal,
                        item: p.item_pedido,
                        data_pcp: fc.data_pcp,
                        quantidade: fc.quantidade_pcp,
                        ops: opsStr || fc.op_vinculada
                    });
                }
            }
        }
        return result;
    };

    // Obter previsões PCP FANTASMA (Simuladas) alocadas na coluna Sem Demanda (+5 anos)
    const getGhostNoDemandPcpItems = (item) => {
        if (!item?.pedidos) return [];
        const result = [];
        for (const p of item.pedidos) {
            const key = `${p.pedido_metal}_${p.item_pedido}`;
            const proposal = proposedPcp[key];
            if (proposal && proposal.mes_alocado === 'SEM_DEMANDA') {
                result.push({
                    key,
                    pedido: proposal.pedido,
                    item: proposal.item,
                    data_pcp: proposal.nova_data,
                    quantidade: proposal.saldo,
                    ops: proposal.ops,
                    data_anterior: proposal.data_anterior
                });
            }
        }
        return result;
    };

    const handleFileChange = async (e) => {
        const selected = e.target.files[0];
        if (!selected) return;

        setError(null);
        setValidationError(null);
        setValidatingFile(true);

        try {
            // Pequeno delay para a UI renderizar o estado de carregamento
            await new Promise(r => setTimeout(r, 100));

            const data = await selected.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames.find(s => s.toUpperCase().includes('METALFISA')) || workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            if (!sheet) {
                setFile(null);
                setValidationError({
                    fileName: selected.name,
                    issues: ['Nenhuma aba ou pasta de trabalho encontrada no arquivo Excel selecionado.']
                });
                return;
            }

            const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
            if (rawRows.length < 4) {
                setFile(null);
                setValidationError({
                    fileName: selected.name,
                    issues: ['A planilha possui menos de 4 linhas. Uma planilha de demanda válida deve possuir cabeçalho e linhas de itens.']
                });
                return;
            }

            // Localizar linha de cabeçalho
            let headerRowIdx = -1;
            for (let i = 0; i < Math.min(10, rawRows.length); i++) {
                const r = rawRows[i] || [];
                const str = r.map(c => String(c || '').toUpperCase()).join(' ');
                if (str.includes('DEMANDAS') && (str.includes('AGOSTO') || str.includes('SETEMBRO') || str.includes('PREVIS'))) {
                    headerRowIdx = i;
                    break;
                }
                if (str.includes('PRODUTO') && str.includes('DESCRIC')) {
                    headerRowIdx = i;
                    break;
                }
            }
            if (headerRowIdx === -1) headerRowIdx = 3;
            if (headerRowIdx < rawRows.length - 1) {
                const nextRowStr = (rawRows[headerRowIdx + 1] || []).map(c => String(c || '').toUpperCase()).join(' ');
                if (nextRowStr.includes('PRODUTO') || nextRowStr.includes('DESCRIC') || nextRowStr.includes('TOTAL')) {
                    headerRowIdx = headerRowIdx + 1;
                }
            }

            const headerRow = rawRows[headerRowIdx] || [];
            const issues = [];

            // Validação 1: Primeira coluna deve ser Código / Referência do Produto
            const colA = String(headerRow[0] || '').toUpperCase();
            if (!colA.includes('PRODUTO') && !colA.includes('REF') && !colA.includes('COD') && !colA.includes('CÓD')) {
                // Verificar se a primeira linha de dados tem código
                const firstDataRow = rawRows[headerRowIdx + 1] || [];
                if (!firstDataRow[0] || String(firstDataRow[0]).trim() === '') {
                    issues.push('A Coluna A deve conter o Código do Produto / Referência do Cliente.');
                }
            }

            // Validação 2: Verificar colunas de meses de demanda
            const monthCols = [];
            for (let c = 3; c < Math.min(headerRow.length, 25); c++) {
                const cellVal = headerRow[c];
                if (cellVal) {
                    let monthLabel = '';
                    if (cellVal instanceof Date) {
                        const m = cellVal.getUTCMonth() + 1;
                        const y = cellVal.getUTCFullYear();
                        const mNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                        monthLabel = `${mNames[m] || m}/${y}`;
                    } else {
                        const s = String(cellVal).trim();
                        if (s.toLowerCase().includes('total')) break;
                        monthLabel = s;
                    }
                    if (monthLabel && !monthLabel.toLowerCase().includes('total') && !monthLabel.toLowerCase().includes('follow')) {
                        monthCols.push({ colIdx: c, label: monthLabel });
                    }
                }
            }

            if (monthCols.length === 0) {
                issues.push('Nenhuma coluna de mês de demanda reconhecida (ex: AGO/2026, SET/2026, OUT/2026). As colunas de meses devem iniciar a partir da Coluna D.');
            }

            // Se houver divergências estruturais, bloqueia e avisa
            if (issues.length > 0) {
                setFile(null);
                setValidationError({
                    fileName: selected.name,
                    issues,
                    detectedHeaders: headerRow.filter(Boolean)
                });
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            // Estrutura 100% Compatível
            setFile(selected);
            setValidationError(null);

        } catch (err) {
            console.error('Erro na validação do arquivo:', err);
            setFile(null);
            setValidationError({
                fileName: selected.name,
                issues: ['Erro ao analisar o arquivo Excel: ' + err.message]
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
        } finally {
            setValidatingFile(false);
        }
    };

    const handleUploadAndProcess = async () => {
        if (!file) return;
        setLoading(true);
        setProcessingStep('Enviando planilha e lendo dados estruturados...');
        setError(null);
        try {
            const formData = new FormData();
            formData.append('planilha', file);

            setProcessingStep('Consultando Protheus (SC6/SC2) e cruzando previsões SINCO...');
            const res = await api.post('/vmi/demanda-mes/processar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data && res.data.success) {
                setProcessingStep('Consolidando resultados e cadência de entregas...');
                await new Promise(r => setTimeout(r, 200));
                setResultData(res.data);
            } else {
                setError(res.data?.error || 'Erro ao processar arquivo.');
            }
        } catch (err) {
            console.error('Erro ao processar:', err);
            setError(err.response?.data?.error || err.message || 'Falha na comunicação com o servidor.');
        } finally {
            setLoading(false);
            setProcessingStep('');
        }
    };

    const toggleRow = (idx) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const toggleAllRows = () => {
        if (expandedRows.size === filteredItems.length) {
            setExpandedRows(new Set());
        } else {
            setExpandedRows(new Set(filteredItems.map((_, i) => i)));
        }
    };

    // Filter items with enhanced group pills and views
    const filteredItems = useMemo(() => {
        if (!resultData?.itens) return [];
        const cleanStr = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
        const q = (filterText || '').trim().toLowerCase();
        const qClean = cleanStr(filterText);

        return resultData.itens.filter(item => {
            // Text search
            const matchText = !q || 
                item.ref_cliente.toLowerCase().includes(q) ||
                cleanStr(item.ref_cliente).includes(qClean) ||
                item.codigo_metalfisa.toLowerCase().includes(q) ||
                cleanStr(item.codigo_metalfisa).includes(qClean) ||
                item.descricao.toLowerCase().includes(q) ||
                item.pedidos.some(p => 
                    p.pedido_metal.includes(q) || 
                    cleanStr(p.pedido_metal).includes(qClean) ||
                    (p.pedido_cliente && p.pedido_cliente.toLowerCase().includes(q)) ||
                    (p.pedido_cliente && cleanStr(p.pedido_cliente).includes(qClean)) ||
                    p.ops.some(o => o.numero_op.includes(q) || cleanStr(o.numero_op).includes(qClean))
                );

            if (!matchText) return false;

            // Group Views & Status filter
            if (filterStatus === 'COM_SALDO' && !item.possui_saldo) return false;
            if (filterStatus === 'SEM_SALDO' && item.possui_saldo) return false;
            if (filterStatus === 'SOBRA_SALDO' && !(item.total_saldo_faturar > item.total_demanda)) return false;
            if (filterStatus === 'FALTA_SALDO' && !(item.total_demanda > item.total_saldo_faturar && item.possui_saldo)) return false;
            if (filterStatus === 'FORA_PLANILHA' && item.presente_na_planilha !== false) return false;

            // Month filter
            if (filterMonth !== 'ALL') {
                if (filterMonth === 'SEM_DATA_PCP') {
                    if (!item.pcp_por_mes['SEM DATA PCP']) return false;
                } else {
                    const hasMonthDemand = (item.demandas && item.demandas[filterMonth] > 0);
                    const hasMonthPcp = (item.pcp_por_mes && item.pcp_por_mes[filterMonth] > 0);
                    if (!hasMonthDemand && !hasMonthPcp) return false;
                }
            }

            return true;
        });
    }, [resultData, filterText, filterStatus, filterMonth]);

    // Export to Excel / Complementar Planilha Original do Cliente
    const handleTemplateFileSelected = async (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile || !resultData) return;

        setFillingProgress({
            current: 0,
            total: 100,
            percentage: 5,
            status: 'Carregando e analisando a planilha do cliente...',
            fileName: selectedFile.name,
            finished: false,
            processedCount: 0,
            noBalanceCount: 0,
            filledCount: 0
        });

        try {
            // Pequeno delay para renderizar o modal de progresso
            await new Promise(r => setTimeout(r, 200));

            const data = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames.find(s => s.toUpperCase().includes('METALFISA')) || workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            if (!sheet) {
                setFillingProgress(null);
                alert('Não foi possível localizar a aba de trabalho na planilha selecionada.');
                return;
            }

            const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
            if (rawRows.length < 4) {
                setFillingProgress(null);
                alert('Planilha selecionada inválida ou com poucas linhas.');
                return;
            }

            // Localizar linha de cabeçalho
            let headerRowIdx = -1;
            for (let i = 0; i < Math.min(10, rawRows.length); i++) {
                const r = rawRows[i] || [];
                const str = r.map(c => String(c || '').toUpperCase()).join(' ');
                if (str.includes('DEMANDAS') && (str.includes('AGOSTO') || str.includes('SETEMBRO') || str.includes('PREVIS'))) {
                    headerRowIdx = i;
                    break;
                }
                if (str.includes('PRODUTO') && str.includes('DESCRIC')) {
                    headerRowIdx = i;
                    break;
                }
            }
            if (headerRowIdx === -1) headerRowIdx = 3;
            if (headerRowIdx < rawRows.length - 1) {
                const nextRowStr = (rawRows[headerRowIdx + 1] || []).map(c => String(c || '').toUpperCase()).join(' ');
                if (nextRowStr.includes('PRODUTO') || nextRowStr.includes('DESCRIC') || nextRowStr.includes('TOTAL')) {
                    headerRowIdx = headerRowIdx + 1;
                }
            }

            const headerRow = rawRows[headerRowIdx] || [];
            const monthCols = [];
            for (let c = 3; c < Math.min(headerRow.length, 25); c++) {
                const cellVal = headerRow[c];
                if (cellVal) {
                    let monthLabel = '';
                    if (cellVal instanceof Date) {
                        const m = cellVal.getUTCMonth() + 1;
                        const y = cellVal.getUTCFullYear();
                        const mNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                        monthLabel = `${mNames[m] || m}/${y}`;
                    } else {
                        const s = String(cellVal).trim();
                        if (s.toLowerCase().includes('total')) break;
                        monthLabel = s;
                    }
                    if (monthLabel && !monthLabel.toLowerCase().includes('total') && !monthLabel.toLowerCase().includes('follow')) {
                        monthCols.push({ colIdx: c, label: monthLabel });
                    }
                }
            }

            const cleanCode = (str) => String(str || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

            // Mapa dos itens do app com todas as datas PCP (reais + simuladas)
            const itemLookup = new Map();
            resultData.itens.forEach(it => {
                const k1 = cleanCode(it.ref_cliente);
                const k2 = cleanCode(it.codigo_metalfisa);
                if (k1) itemLookup.set(k1, it);
                if (k2) itemLookup.set(k2, it);
            });

            const totalRows = rawRows.length - (headerRowIdx + 1);
            let processedCount = 0;
            let noBalanceCount = 0;
            let filledCount = 0;

            // Iterar sobre cada linha da planilha do cliente para complementar as informações
            for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
                const row = rawRows[r];
                if (!row || row.length === 0) continue;
                const refRaw = String(row[0] || '').trim();
                if (!refRaw || refRaw.toUpperCase() === 'PRODUTO' || refRaw.toUpperCase().includes('TOTAL')) continue;

                processedCount++;
                const matchedItem = itemLookup.get(cleanCode(refRaw));

                if (matchedItem) {
                    // 1. Se item NÃO tem saldo, preenche com 'SEM SALDO' na primeira coluna de mês
                    if (!matchedItem.possui_saldo || matchedItem.total_saldo_faturar <= 0) {
                        if (monthCols.length > 0) {
                            const firstCol = monthCols[0].colIdx;
                            const cellAddress = XLSX.utils.encode_cell({ r, c: firstCol });
                            sheet[cellAddress] = { t: 's', v: 'SEM SALDO' };
                            noBalanceCount++;
                        }
                    } else {
                        // 2. Se tem saldo e previsões PCP, preenche as colunas de cada mês com as datas PCP
                        let hasFilled = false;
                        monthCols.forEach(mObj => {
                            const cellAddress = XLSX.utils.encode_cell({ r, c: mObj.colIdx });
                            const pcpReais = getPcpItemsForMonth(matchedItem, mObj.label);
                            const pcpFantasmas = getGhostPcpItemsForMonth(matchedItem, mObj.label);
                            const allPcps = [...pcpReais, ...pcpFantasmas];

                            if (allPcps.length > 0) {
                                hasFilled = true;
                                // Formata como ex: "15/08 (500 un)" ou datas concatenadas
                                const formattedText = allPcps.map(p => {
                                    const dStr = formatPcpDate(p.data_pcp);
                                    return `${dStr} (${p.quantidade} un)`;
                                }).join(' | ');

                                sheet[cellAddress] = { t: 's', v: formattedText };
                            }
                        });
                        if (hasFilled) filledCount++;
                    }
                }

                // Atualizar progresso a cada 10 linhas
                if (processedCount % 10 === 0 || r === rawRows.length - 1) {
                    const pct = Math.min(95, Math.round(15 + (processedCount / (totalRows || 1)) * 80));
                    setFillingProgress(prev => ({
                        ...prev,
                        current: processedCount,
                        total: totalRows,
                        percentage: pct,
                        status: `Preenchendo datas PCP... (${processedCount}/${totalRows} itens)`,
                        processedCount,
                        noBalanceCount,
                        filledCount
                    }));
                }
            }

            // Gerar o arquivo final e finalizar
            const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
            const newFileName = `${originalName}_PREENCHIDO_PCP_${new Date().toISOString().slice(0, 10)}.xlsx`;
            
            setFillingProgress(prev => ({
                ...prev,
                percentage: 98,
                status: 'Gerando arquivo Excel final para download...',
                outputFileName: newFileName
            }));

            await new Promise(r => setTimeout(r, 400));
            XLSX.writeFile(workbook, newFileName);

            setFillingProgress(prev => ({
                ...prev,
                percentage: 100,
                status: 'Processamento concluído com sucesso!',
                finished: true,
                outputFileName: newFileName,
                processedCount,
                noBalanceCount,
                filledCount
            }));

        } catch (err) {
            console.error('Erro ao preencher planilha do cliente:', err);
            setFillingProgress(null);
            alert('Erro ao processar planilha: ' + err.message);
        } finally {
            if (templateFileInputRef.current) {
                templateFileInputRef.current.value = '';
            }
        }
    };

    // Exportar Excel Consolidado
    const handleExportExcel = () => {
        if (!resultData?.itens || resultData.itens.length === 0) return;

        const mesesDemanda = resultData.mesesDemanda || [];
        const exportRows = [];

        filteredItems.forEach(item => {
            const pcpMesesStr = Object.entries(item.pcp_por_mes || {})
                .map(([mes, qtd]) => `${mes}: ${qtd} un`)
                .join(' | ');

            if (item.pedidos && item.pedidos.length > 0) {
                item.pedidos.forEach(p => {
                    const opsStr = p.ops.map(o => `${o.numero_op} (saldo: ${o.saldo_op})`).join(', ') || 'SEM OP';
                    const pcpsStr = p.previsoes_pcp.map(f => `${formatPcpDate(f.data_pcp)}: ${f.quantidade_pcp} un`).join(', ') || '-';

                    const rowObj = {
                        'Ref. Cliente': item.ref_cliente,
                        'Código Metalfisa': item.codigo_metalfisa,
                        'Descrição': item.descricao,
                        'Possui Saldo': item.possui_saldo ? 'SIM' : 'NÃO',
                        'Total Saldo Faturar': item.total_saldo_faturar,
                        'Total Demanda Planilha': item.total_demanda
                    };

                    mesesDemanda.forEach(m => {
                        rowObj[`Demanda ${m}`] = item.demandas[m] || 0;
                    });

                    rowObj['PCP Agrupado por Mês'] = pcpMesesStr;
                    rowObj['Pedido Metalfisa'] = p.pedido_metal;
                    rowObj['Item'] = p.item_pedido;
                    rowObj['Pedido Cliente'] = p.pedido_cliente || '-';
                    rowObj['Saldo do Item'] = p.saldo_a_faturar;
                    rowObj['OPs Protheus'] = opsStr;
                    rowObj['Previsões PCP (SINCO)'] = pcpsStr;

                    exportRows.push(rowObj);
                });
            } else {
                const rowObj = {
                    'Ref. Cliente': item.ref_cliente,
                    'Código Metalfisa': item.codigo_metalfisa,
                    'Descrição': item.descricao,
                    'Possui Saldo': 'NÃO',
                    'Total Saldo Faturar': 0,
                    'Total Demanda Planilha': item.total_demanda
                };

                mesesDemanda.forEach(m => {
                    rowObj[`Demanda ${m}`] = item.demandas[m] || 0;
                });

                rowObj['PCP Agrupado por Mês'] = '-';
                rowObj['Pedido Metalfisa'] = '-';
                rowObj['Item'] = '-';
                rowObj['Pedido Cliente'] = '-';
                rowObj['Saldo do Item'] = 0;
                rowObj['OPs Protheus'] = '-';
                rowObj['Previsões PCP (SINCO)'] = '-';

                exportRows.push(rowObj);
            }
        });

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Demanda_Mes_Cruzamento');
        
        let filterSuffix = 'TODOS';
        if (filterStatus === 'SEM_SALDO') filterSuffix = 'SEM_SALDO';
        if (filterStatus === 'COM_SALDO') filterSuffix = 'COM_SALDO';
        if (filterStatus === 'SOBRA_SALDO') filterSuffix = 'SALDO_EXCEDENTE';
        if (filterStatus === 'FALTA_SALDO') filterSuffix = 'SALDO_INSUFICIENTE';
        if (filterStatus === 'FORA_PLANILHA') filterSuffix = 'FORA_PLANILHA';
        if (filterMonth !== 'ALL') filterSuffix += `_${filterMonth.replace(/[^a-zA-Z0-9]/g, '_')}`;

        XLSX.writeFile(wb, `Demanda_Mes_Metalfisa_${filterSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // Exportar Relatório PDF Oficial Metalfisa
    const handleExportPdf = () => {
        if (!resultData?.itens || resultData.itens.length === 0) return;
        try {
            generateDemandaMesPdf({
                items: filteredItems,
                mesesDemanda: resultData.mesesDemanda || [],
                totais: resultData.totais || {},
                filterStatus,
                filterMonth,
                sheetName: resultData.sheetName || 'METALFISA'
            });
        } catch (err) {
            alert('Erro ao gerar relatório PDF: ' + err.message);
        }
    };

    // Disparar Seleção do Arquivo Template do Cliente
    const handleTriggerFillClientExcel = () => {
        if (!resultData) {
            alert('Faça o cruzamento dos dados primeiro.');
            return;
        }
        if (templateFileInputRef.current) {
            templateFileInputRef.current.click();
        }
    };

    // Gerar e Baixar Planilha Modelo de Exemplo
    const handleDownloadSampleExcel = () => {
        const sampleHeaders = [
            ['CONTROLE DE DEMANDA MÊS - MODELO METALFISA'],
            [],
            ['DEMANDAS CLIENTE', '', '', 'DEMANDAS MENSAIS PREVISTAS', '', '', ''],
            ['PRODUTO', 'DESCRIÇÃO', 'ESTOQUE ATUAL', 'AGO/2026', 'SET/2026', 'OUT/2026', 'NOV/2026', 'DEZ/2026', 'TOTAL PREVISTO'],
            ['130300055', 'EIXO PRINCIPAL USINADO DMC 9800', 50, 1500, 2000, 2500, 1000, 1200, 8200],
            ['130300056', 'BUCHA GUIA ACO TEMPERADO', 0, 500, 600, 800, 1000, 400, 3300],
            ['130300078', 'FLANGE DE FIXACAO RETIFICADA', 120, 300, 400, 350, 500, 600, 2150],
            ['130300102', 'ANEL ESPACADOR ACO CARBONO', 10, 0, 150, 200, 300, 350, 1000],
            ['130300220', 'PINO TRAVA CONICO DMC', 0, 800, 1000, 1200, 1500, 1800, 6300]
        ];

        const ws = XLSX.utils.aoa_to_sheet(sampleHeaders);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'METALFISA');
        XLSX.writeFile(wb, 'MODELO_PLANILHA_DEMANDA_METALFISA.xlsx');
    };

    return (
        <div className="w-full px-4 sm:px-6 py-4 space-y-4 text-slate-800">
            {/* Top Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <FileSpreadsheet className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                Demanda Mês (Cruzamento VMI & PCP)
                            </h1>
                            <button
                                type="button"
                                onClick={() => openHelp('/vmi/demanda-mes')}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition shadow-2xs cursor-pointer"
                                title="Abrir Ajuda Contextual lateral detalhada da página"
                            >
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>Ajuda de Contexto</span>
                            </button>
                        </div>
                        <p className="text-sm text-slate-500">
                            Upload da planilha de demandas para rastreabilidade automática no Protheus, OPs ativas e Previsões PCP do SINCO.
                        </p>
                    </div>
                </div>

                {resultData && (
                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            onClick={() => setDistributeModalOpen(true)}
                            disabled={distributing}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-bold shadow-sm hover:shadow-md transition active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                            title="Simular auto-distribuição inteligente do PCP nos dias de entrega VMI (Seg/Qua/Sex) conforme a demanda de cada mês"
                        >
                            {distributing ? (
                                <>
                                    <RefreshCw className="w-4 h-4 text-amber-300 animate-spin" />
                                    <span>Calculando Distribuição VMI...</span>
                                </>
                            ) : (
                                <>
                                    <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                                    <span>⚡ Auto-Distribuir Carga PCP (Seg/Qua/Sex)</span>
                                </>
                            )}
                        </button>

                        {/* Input Invisível para Seleção da Planilha do Cliente a ser Complementada */}
                        <input 
                            type="file" 
                            ref={templateFileInputRef} 
                            onChange={handleTemplateFileSelected} 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                        />

                        <button
                            onClick={handleTriggerFillClientExcel}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm transition active:scale-95 cursor-pointer"
                            title="Selecionar o arquivo Excel do cliente para preencher e complementar as datas PCP nas colunas correspondentes mantendo o layout original"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Preencher Planilha do Cliente (com Datas PCP)</span>
                        </button>

                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold shadow-sm transition active:scale-95 cursor-pointer"
                            title="Exportar tabela completa com todos os detalhes e previsões consolidadas"
                        >
                            <Download className="w-4 h-4" />
                            <span>Exportar Excel Consolidado</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Painel Expansível de Ajuda de Contexto Detalhada & Modelo de Planilha */}
            {showHelpGuide && (
                <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white p-6 rounded-2xl shadow-xl border border-indigo-500/30 space-y-6 animate-in fade-in slide-in-from-top-3 duration-300">
                    <div className="flex items-start justify-between border-b border-slate-700/60 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
                                <BookOpen className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    Guia de Contexto & Estrutura da Planilha de Demanda
                                </h3>
                                <p className="text-xs text-slate-300">
                                    Entenda como o sistema cruza os dados com Protheus e SINCO e veja a estrutura exata esperada da planilha.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowHelpGuide(false)}
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                        >
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
                        {/* Passo 1 */}
                        <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-2">
                            <div className="flex items-center gap-2 font-bold text-indigo-300">
                                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                                <span>Leitura & Rastreabilidade</span>
                            </div>
                            <p className="leading-relaxed">
                                O app localiza a aba <strong>METALFISA</strong> (ou a primeira aba) e mapeia as referências do cliente com a tabela de De-Para (<strong>SZ1010 / app_demanda_vmi_map</strong>) para encontrar o código de produto Protheus (<strong>B1_COD</strong>).
                            </p>
                        </div>

                        {/* Passo 2 */}
                        <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-2">
                            <div className="flex items-center gap-2 font-bold text-amber-300">
                                <span className="w-5 h-5 rounded-full bg-amber-600 text-slate-950 flex items-center justify-center text-[10px]">2</span>
                                <span>Auto-Distribuição PCP</span>
                            </div>
                            <p className="leading-relaxed">
                                O algoritmo distribui a carga apenas em dias úteis de entrega VMI (<strong>Segundas, Quartas e Sextas</strong>), estritamente após a data atual. Itens sem demanda podem ser programados opcionalmente para o último mês.
                            </p>
                        </div>

                        {/* Passo 3 */}
                        <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-2">
                            <div className="flex items-center gap-2 font-bold text-emerald-300">
                                <span className="w-5 h-5 rounded-full bg-emerald-600 text-slate-950 flex items-center justify-center text-[10px]">3</span>
                                <span>Preencher Planilha do Cliente</span>
                            </div>
                            <p className="leading-relaxed">
                                Você seleciona a planilha original do cliente e o app <strong>preenche as células de cada mês com as Datas PCP e quantidades</strong>, gravando <code className="text-amber-300 font-mono">SEM SALDO</code> para itens sem pedidos em aberto.
                            </p>
                        </div>
                    </div>

                    {/* Tabela de Exemplo da Estrutura */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                                <Table className="w-4 h-4 text-indigo-400" />
                                <span>Estrutura Exata da Tabela de Demanda (.xlsx):</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleDownloadSampleExcel}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Baixar Planilha Modelo (.xlsx)</span>
                            </button>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/60">
                            <table className="w-full text-left text-xs font-mono">
                                <thead>
                                    <tr className="bg-slate-800/80 text-slate-300 text-[11px] border-b border-slate-700 font-sans">
                                        <th className="py-2.5 px-3">Coluna A (Ref. Cliente)</th>
                                        <th className="py-2.5 px-3">Coluna B (Descrição)</th>
                                        <th className="py-2.5 px-3">Coluna C (Estoque/Outros)</th>
                                        <th className="py-2.5 px-3 text-right bg-indigo-950/60 text-indigo-300">Coluna D (AGO/2026)</th>
                                        <th className="py-2.5 px-3 text-right bg-indigo-950/60 text-indigo-300">Coluna E (SET/2026)</th>
                                        <th className="py-2.5 px-3 text-right bg-indigo-950/60 text-indigo-300">Coluna F (OUT/2026)</th>
                                        <th className="py-2.5 px-3 text-right">Coluna G (Total)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/80 text-slate-300 text-[11px]">
                                    <tr className="hover:bg-slate-800/40">
                                        <td className="py-2 px-3 font-bold text-white">130300055</td>
                                        <td className="py-2 px-3 text-slate-400">EIXO PRINCIPAL USINADO</td>
                                        <td className="py-2 px-3 text-slate-500">50</td>
                                        <td className="py-2 px-3 text-right text-indigo-300 font-bold">1.500</td>
                                        <td className="py-2 px-3 text-right text-indigo-300 font-bold">2.000</td>
                                        <td className="py-2 px-3 text-right text-indigo-300 font-bold">2.500</td>
                                        <td className="py-2 px-3 text-right font-bold text-slate-200">6.000</td>
                                    </tr>
                                    <tr className="hover:bg-slate-800/40">
                                        <td className="py-2 px-3 font-bold text-white">130300056</td>
                                        <td className="py-2 px-3 text-slate-400">BUCHA GUIA TEMPERADA</td>
                                        <td className="py-2 px-3 text-slate-500">0</td>
                                        <td className="py-2 px-3 text-right text-indigo-300 font-bold">500</td>
                                        <td className="py-2 px-3 text-right text-indigo-300 font-bold">600</td>
                                        <td className="py-2 px-3 text-right text-indigo-300 font-bold">800</td>
                                        <td className="py-2 px-3 text-right font-bold text-slate-200">1.900</td>
                                    </tr>
                                    <tr className="hover:bg-slate-800/40">
                                        <td className="py-2 px-3 font-bold text-white">130300078</td>
                                        <td className="py-2 px-3 text-slate-400">FLANGE DE FIXACAO RETIF.</td>
                                        <td className="py-2 px-3 text-slate-500">120</td>
                                        <td className="py-2 px-3 text-right text-indigo-300 font-bold">300</td>
                                        <td className="py-2 px-3 text-right text-indigo-300 font-bold">400</td>
                                        <td className="py-2 px-3 text-right text-indigo-300 font-bold">350</td>
                                        <td className="py-2 px-3 text-right font-bold text-slate-200">1.050</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Configuração / Opções da Auto-Distribuição */}
            {distributeModalOpen && resultData && (
                <div 
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
                    onClick={() => setDistributeModalOpen(false)}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                                    <Zap className="w-5 h-5 fill-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Auto-Distribuição de Carga PCP</h3>
                                    <p className="text-xs text-slate-500">Padrão VMI (Segundas, Quartas e Sextas)</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDistributeModalOpen(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                    <span>Regra Principal de Demanda:</span>
                                </div>
                                <p>
                                    Distribui as OPs e pedidos de venda com saldo conforme as quantidades demandadas em cada mês da planilha (<strong>{resultData.mesesDemanda.join(', ')}</strong>), alocando cadenciadamente nas Segundas, Quartas e Sextas-feiras.
                                </p>
                            </div>

                            {/* Opção Adicional: Demais Itens para +5 Anos (Sem Demanda) */}
                            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-indigo-200/80 bg-indigo-50/40 hover:bg-indigo-50/80 transition cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={includeOthersInLastMonth}
                                    onChange={(e) => setIncludeOthersInLastMonth(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                />
                                <div className="space-y-0.5 select-none">
                                    <span className="font-bold text-slate-900 block text-xs">
                                        Programar itens sem demanda / saldos excedentes para +5 anos (Coluna "Sem Demanda")
                                    </span>
                                    <span className="text-[11px] text-slate-500 block">
                                        Se marcado, os produtos ou saldos que não possuem demanda na planilha receberão propostas de entrega calculadas a partir do último mês disponível somando <strong>+5 anos</strong> ({resultData.mesesDemanda[resultData.mesesDemanda.length - 1] ? `${resultData.mesesDemanda[resultData.mesesDemanda.length - 1].split('/')[0]}/${parseInt(resultData.mesesDemanda[resultData.mesesDemanda.length - 1].split('/')[1] || '2026') + 5}` : '+5 anos'}), aparecendo isolados na coluna <strong>"Sem Demanda"</strong>.
                                    </span>
                                </div>
                            </label>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setDistributeModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => runAutoDistribution(includeOthersInLastMonth)}
                                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer"
                            >
                                <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                                <span>Iniciar Simulação Fantasma</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Banner de Simulação Ativa (Modo Fantasma) */}
            {hasProposals && (
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-lg border border-indigo-500/30 animate-in fade-in slide-in-from-top-4 duration-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="p-2.5 bg-indigo-500/20 text-amber-300 rounded-xl border border-indigo-400/30">
                            <Sparkles className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    Simulação de Distribuição VMI Ativa
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                    {Object.keys(proposedPcp).length} propostas geradas
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                                As novas datas aparecem em <strong className="text-amber-300">tom fantasma cinza com borda tracejada</strong>. Você pode clicar nelas para editar, salvar item por item ou salvar tudo em lote.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <button
                            type="button"
                            onClick={handleClearProposals}
                            disabled={savingBulk}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Descartar Simulação
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveAllProposals}
                            disabled={savingBulk}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-md transition active:scale-95 cursor-pointer"
                        >
                            {savingBulk ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Gravando no SINCO...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span>Salvar Todas ({Object.keys(proposedPcp).length}) no SINCO</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Upload Area */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                            Selecione a Planilha de Demandas (.xlsx)
                        </label>
                        <div 
                            onClick={() => !validatingFile && fileInputRef.current?.click()}
                            className={`border-2 border-dashed transition rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer group relative ${
                                validatingFile 
                                    ? 'border-indigo-400 bg-indigo-50/40 cursor-wait' 
                                    : file 
                                        ? 'border-emerald-400 bg-emerald-50/20 hover:bg-emerald-50/40' 
                                        : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20'
                            }`}
                        >
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                className="hidden" 
                                disabled={validatingFile || loading}
                            />
                            
                            {validatingFile ? (
                                <div className="text-center flex flex-col items-center py-1 animate-pulse">
                                    <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mb-2" />
                                    <span className="font-bold text-indigo-900 text-sm">Lendo e validando estrutura da planilha...</span>
                                    <span className="text-xs text-indigo-600 mt-0.5">Identificando cabeçalhos e meses de demanda</span>
                                </div>
                            ) : file ? (
                                <div className="text-center flex flex-col items-center">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mb-2" />
                                    <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                        <span>{file.name}</span>
                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">ESTRUTURA VÁLIDA</span>
                                    </span>
                                    <span className="text-xs text-slate-400 block mt-0.5">{(file.size / 1024).toFixed(1)} KB · Pronto para o cruzamento</span>
                                </div>
                            ) : (
                                <div className="text-center flex flex-col items-center">
                                    <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-indigo-600 transition mb-2" />
                                    <span className="text-sm font-medium text-slate-700 block">Clique para escolher a planilha ou arraste aqui</span>
                                    <span className="text-xs text-slate-400">Suporta arquivos Excel (.xlsx) de Demanda</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full md:w-auto flex flex-col justify-end">
                        <button
                            onClick={handleUploadAndProcess}
                            disabled={!file || loading || validatingFile}
                            className={`flex flex-col items-center justify-center px-8 py-4 rounded-xl font-bold text-white shadow-md transition active:scale-95 min-w-[240px] ${
                                !file || loading || validatingFile
                                    ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    <span>Cruzando com SINCO...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Layers className="w-5 h-5" />
                                    <span>Cruzar Dados com SINCO</span>
                                </div>
                            )}
                        </button>
                    </div>
                </div>

                {/* Feedback em tempo real durante o processamento */}
                {loading && (
                    <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3 text-indigo-900 text-sm animate-pulse">
                        <RefreshCw className="w-5 h-5 animate-spin text-indigo-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <span className="font-bold block">{processingStep || 'Processando dados...'}</span>
                            <span className="text-xs text-indigo-600">Buscando pedidos no Protheus, ordens de produção ativas e alocando cadência PCP</span>
                        </div>
                    </div>
                )}

                {/* Alerta de Divergência de Estrutura da Planilha */}
                {validationError && (
                    <div className="mt-4 p-5 bg-amber-50/80 border border-amber-300 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-amber-900">
                                    Estrutura Incompatível no Arquivo: {validationError.fileName}
                                </h4>
                                <p className="text-xs text-amber-700 mt-0.5">
                                    A planilha selecionada não segue o layout esperado para o cruzamento de demandas. Por favor, verifique as divergências abaixo:
                                </p>
                            </div>
                        </div>

                        <ul className="space-y-1.5 pl-9 text-xs text-amber-800 list-disc">
                            {validationError.issues.map((issue, idx) => (
                                <li key={idx} className="font-medium">
                                    {issue}
                                </li>
                            ))}
                        </ul>

                        <div className="pl-9 pt-1 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={handleDownloadSampleExcel}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Baixar Modelo Correto (.xlsx)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowHelpGuide(true)}
                                className="text-xs font-bold text-amber-900 underline hover:text-amber-950 cursor-pointer"
                            >
                                Ver Guia de Estrutura Completo
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* Results Section */}
            {resultData && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Itens na Planilha</p>
                                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{resultData.totais.totalItens.toLocaleString('pt-BR')}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Aba: {resultData.sheetName}</p>
                            </div>
                            <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
                                <FileSpreadsheet className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Itens Com Saldo no Protheus</p>
                                <h3 className="text-2xl font-extrabold text-emerald-700 mt-1">{resultData.totais.totalComSaldo.toLocaleString('pt-BR')}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {((resultData.totais.totalComSaldo / resultData.totais.totalItens) * 100).toFixed(1)}% dos itens
                                </p>
                            </div>
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Itens Sem Saldo em Aberto</p>
                                <h3 className="text-2xl font-extrabold text-amber-700 mt-1">{resultData.totais.totalSemSaldo.toLocaleString('pt-BR')}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Sem pedidos pendentes</p>
                            </div>
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                                <XCircle className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Saldo Total em Carteira</p>
                                <h3 className="text-2xl font-extrabold text-indigo-900 mt-1">
                                    {resultData.totais.totalSaldoGeral.toLocaleString('pt-BR')} un
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Demanda: {resultData.totais.totalDemandaGeral.toLocaleString('pt-BR')} un
                                </p>
                            </div>
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Package className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Visual Group Pills & Fast View Bar */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                            {/* Group Pills */}
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Visões Rápidas:</span>
                                
                                <button
                                    type="button"
                                    onClick={() => { setFilterStatus('ALL'); setFilterMonth('ALL'); }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                        filterStatus === 'ALL' && filterMonth === 'ALL'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                >
                                    <span>📦 Todos</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                        filterStatus === 'ALL' && filterMonth === 'ALL' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
                                    }`}>
                                        {resultData.itens.length}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setFilterStatus('SEM_SALDO'); setFilterMonth('ALL'); }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                        filterStatus === 'SEM_SALDO'
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                                    }`}
                                >
                                    <span>⚠️ Sem Saldo</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                        filterStatus === 'SEM_SALDO' ? 'bg-amber-800 text-white' : 'bg-amber-200/80 text-amber-900'
                                    }`}>
                                        {resultData.totais.totalSemSaldo}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setFilterStatus('COM_SALDO'); setFilterMonth('ALL'); }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                        filterStatus === 'COM_SALDO'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    }`}
                                >
                                    <span>🟢 Com Saldo</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                        filterStatus === 'COM_SALDO' ? 'bg-emerald-800 text-white' : 'bg-emerald-200/80 text-emerald-900'
                                    }`}>
                                        {resultData.totais.totalComSaldo}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setFilterStatus('SOBRA_SALDO'); setFilterMonth('ALL'); }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                        filterStatus === 'SOBRA_SALDO'
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                                    }`}
                                >
                                    <span>📈 Saldo Excedente (Sobra)</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                        filterStatus === 'SOBRA_SALDO' ? 'bg-blue-800 text-white' : 'bg-blue-200/80 text-blue-900'
                                    }`}>
                                        {resultData.itens.filter(i => i.total_saldo_faturar > i.total_demanda).length}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setFilterStatus('FALTA_SALDO'); setFilterMonth('ALL'); }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                        filterStatus === 'FALTA_SALDO'
                                            ? 'bg-rose-600 text-white shadow-xs'
                                            : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                                    }`}
                                >
                                    <span>📉 Saldo Insuficiente</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                        filterStatus === 'FALTA_SALDO' ? 'bg-rose-800 text-white' : 'bg-rose-200/80 text-rose-900'
                                    }`}>
                                        {resultData.itens.filter(i => i.total_demanda > i.total_saldo_faturar && i.possui_saldo).length}
                                    </span>
                                </button>

                                {resultData.totais.totalItensForaPlanilha > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => { setFilterStatus('FORA_PLANILHA'); setFilterMonth('ALL'); }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                            filterStatus === 'FORA_PLANILHA'
                                                ? 'bg-purple-600 text-white shadow-xs'
                                                : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200'
                                        }`}
                                    >
                                        <span>📄 Fora da Planilha</span>
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                            filterStatus === 'FORA_PLANILHA' ? 'bg-purple-800 text-white' : 'bg-purple-200/80 text-purple-900'
                                        }`}>
                                            {resultData.totais.totalItensForaPlanilha}
                                        </span>
                                    </button>
                                )}
                            </div>

                            {/* Export Buttons (Excel & PDF) */}
                            <div className="flex items-center gap-2 ml-auto">
                                <button
                                    type="button"
                                    onClick={handleExportPdf}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                                    title="Gerar Relatório Oficial Metalfisa em PDF da visão atual com logotipo e resumo"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>Gerar PDF ({filteredItems.length})</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleExportExcel}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                                    title="Baixar relatório em Excel contendo exatamente os itens da visão filtrada atual"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Exportar Excel ({filteredItems.length})</span>
                                </button>
                            </div>
                        </div>

                        {/* Month Filter & Search Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por Ref. Cliente, Código Metalfisa, Descrição, Pedido ou OP..."
                                        value={filterText}
                                        onChange={e => setFilterText(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Month Quick Selector */}
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs font-semibold text-slate-500">Mês de Demanda:</span>
                                    <select
                                        value={filterMonth}
                                        onChange={e => setFilterMonth(e.target.value)}
                                        className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-indigo-900 focus:outline-none focus:border-indigo-500 cursor-pointer"
                                    >
                                        <option value="ALL">Todos os Meses</option>
                                        {resultData.mesesDemanda?.map(m => (
                                            <option key={m} value={m}>
                                                Com Demanda em {m} ({resultData.itens.filter(i => (i.demandas && i.demandas[m] > 0)).length})
                                            </option>
                                        ))}
                                        <option value="SEM_DATA_PCP">Itens Sem Data PCP Gravada</option>
                                    </select>
                                </div>

                                { (filterStatus !== 'ALL' || filterMonth !== 'ALL' || filterText) && (
                                    <button
                                        type="button"
                                        onClick={() => { setFilterStatus('ALL'); setFilterMonth('ALL'); setFilterText(''); }}
                                        className="text-xs font-bold text-slate-500 hover:text-indigo-600 underline cursor-pointer"
                                    >
                                        Limpar Filtros
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Table Data */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-3.5 px-3">Ref. Cliente</th>
                                        <th className="py-3.5 px-3">Cód. Metalfisa</th>
                                        <th className="py-3.5 px-4">Descrição</th>
                                        <th className="py-3.5 px-3 text-center">Status Saldo</th>
                                        {resultData.mesesDemanda.map(m => (
                                            <th key={m} className="py-3.5 px-3 text-right bg-indigo-50/40 text-indigo-900">
                                                Dem. {m}
                                            </th>
                                        ))}
                                        <th className="py-3.5 px-3 text-right bg-amber-50/70 text-amber-950 border-l border-amber-200" title="Itens sem demanda na planilha ou saldos que excederam os meses da planilha (alocados com +5 anos)">
                                            Sem Demanda
                                        </th>
                                        <th className="py-3.5 px-3 text-right font-extrabold text-slate-800">Total Demanda</th>
                                        <th className="py-3.5 px-3 text-right font-extrabold text-emerald-800 bg-emerald-50/40">Saldo Faturar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={7 + resultData.mesesDemanda.length} className="py-12 text-center text-slate-400">
                                                Nenhum item encontrado para os filtros selecionados.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map((item, idx) => {
                                            const hasOrders = item.pedidos && item.pedidos.length > 0;
                                            const noDemandPcpItems = getNoDemandPcpItems(item, resultData.mesesDemanda);
                                            const ghostNoDemandPcpItems = getGhostNoDemandPcpItems(item);

                                            return (
                                                <tr 
                                                    key={item.ref_cliente + '_' + idx}
                                                    className="hover:bg-slate-50/80 transition"
                                                >

                                                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5">
                                                                <span>{item.ref_cliente}</span>
                                                                {item.presente_na_planilha === false && (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200" title="Item em carteira VMI não presente na planilha Excel">
                                                                        FORA DA PLANILHA
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">
                                                            {item.codigo_metalfisa !== 'NÃO MAPEADO' ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-mono text-[11px] font-bold">
                                                                        {item.codigo_metalfisa}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleOpenDrawing(e, item.codigo_metalfisa)}
                                                                        disabled={openingPdf === item.codigo_metalfisa}
                                                                        className="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition shadow-2xs cursor-pointer group flex items-center gap-1"
                                                                        title={`Abrir Desenho / PDF de ${item.codigo_metalfisa}`}
                                                                    >
                                                                        {openingPdf === item.codigo_metalfisa ? (
                                                                            <RefreshCw className="w-3 h-3 animate-spin text-red-600" />
                                                                        ) : (
                                                                            <FileText className="w-3 h-3 text-red-600 group-hover:scale-110 transition" />
                                                                        )}
                                                                        <span className="text-[10px] font-bold text-red-700">PDF</span>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 italic text-[11px]">Não Mapeado</span>
                                                            )}
                                                        </td>

                                                        <td className="py-3 px-4 text-slate-600 min-w-[200px]" title={item.descricao}>
                                                            {item.descricao || '-'}
                                                        </td>

                                                        <td className="py-3 px-3 text-center">
                                                            {item.possui_saldo ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    COM SALDO
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                                    SEM SALDO
                                                                </span>
                                                            )}
                                                        </td>

                                                         {/* Demandas Mensais da Planilha + Previsões PCP do Mês (Reais + Fantasmas) */}
                                                         {resultData.mesesDemanda.map(m => {
                                                             const demVal = item.demandas[m] || 0;
                                                             const pcpItems = getPcpItemsForMonth(item, m);
                                                             const ghostItems = getGhostPcpItemsForMonth(item, m);

                                                             return (
                                                                 <td key={m} className="py-2.5 px-3 text-right font-medium text-slate-700 bg-slate-50/20 align-top">
                                                                     {/* Quantidade de Demanda */}
                                                                     <div className="flex items-center justify-end gap-1 font-bold text-slate-800">
                                                                         {demVal > 0 ? (
                                                                             <span>{demVal.toLocaleString('pt-BR')} <span className="text-[10px] font-normal text-slate-400">dem</span></span>
                                                                         ) : (
                                                                             <span className="text-slate-300">-</span>
                                                                         )}
                                                                     </div>

                                                                     {/* 1. Previsões PCP REAIS do Mês */}
                                                                     {pcpItems.length > 0 && (
                                                                         <div className="mt-1.5 flex flex-col gap-1.5 items-end">
                                                                             {pcpItems.map((pcp, pcpI) => (
                                                                                 <div 
                                                                                     key={'real_' + pcpI}
                                                                                     className="flex flex-col items-end gap-0.5 p-1.5 rounded-lg bg-purple-50/90 hover:bg-purple-100/90 text-purple-800 border border-purple-200 hover:border-purple-300 text-[10px] shadow-2xs transition group text-right"
                                                                                 >
                                                                                     <div className="flex items-center gap-1 font-bold text-indigo-900">
                                                                                         <span>Ped {pcp.pedido} (It {pcp.item}):</span>
                                                                                         <strong className="text-emerald-700 bg-white px-1 rounded border border-emerald-200">{pcp.quantidade} un</strong>
                                                                                     </div>
                                                                                     <div className="flex items-center gap-1 text-[9px] text-purple-700">
                                                                                         <button
                                                                                             type="button"
                                                                                             onClick={(e) => openPcpEditor(e, {
                                                                                                 pedido: pcp.pedido,
                                                                                                 item: pcp.item,
                                                                                                 saldo: pcp.quantidade,
                                                                                                 data_pcp: pcp.data_pcp,
                                                                                                 ref_cliente: item.ref_cliente,
                                                                                                 isGhost: false
                                                                                             })}
                                                                                             className="flex items-center gap-0.5 font-bold hover:underline cursor-pointer bg-white/80 px-1 py-0.2 rounded border border-purple-200 hover:bg-purple-200"
                                                                                             title={`Clique para alterar a data PCP deste pedido (${pcp.pedido} It ${pcp.item})`}
                                                                                         >
                                                                                             <Clock className="w-2.5 h-2.5 text-purple-500 group-hover:scale-110 transition shrink-0" />
                                                                                             <span className="font-semibold">{formatPcpDate(pcp.data_pcp)}</span>
                                                                                         </button>
                                                                                         {pcp.ops && (
                                                                                             <button
                                                                                                 type="button"
                                                                                                 onClick={(e) => {
                                                                                                     e.stopPropagation();
                                                                                                     setBomStructureTarget({
                                                                                                         op: pcp.ops,
                                                                                                         itemPv: pcp.item,
                                                                                                         pedido: pcp.pedido,
                                                                                                         produto: item.codigo_metalfisa !== 'NÃO MAPEADO' ? item.codigo_metalfisa : undefined
                                                                                                     });
                                                                                                 }}
                                                                                                 className="px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded font-mono font-bold hover:underline transition cursor-pointer flex items-center gap-0.5"
                                                                                                 title={`Ver Estrutura da OP ${pcp.ops}`}
                                                                                             >
                                                                                                 <Layers className="w-2.5 h-2.5 text-blue-700" />
                                                                                                 <span>OP: {pcp.ops}</span>
                                                                                             </button>
                                                                                         )}
                                                                                     </div>
                                                                                 </div>
                                                                             ))}
                                                                         </div>
                                                                     )}

                                                                     {/* 2. Previsões PCP FANTASMAS (Simulação Ativa - Cinza/Tracejado) */}
                                                                     {ghostItems.length > 0 && (
                                                                         <div className="mt-1.5 flex flex-col gap-1.5 items-end">
                                                                             {ghostItems.map((ghost) => (
                                                                                 <div 
                                                                                     key={'ghost_' + ghost.key}
                                                                                     className="flex flex-col items-end gap-1 p-1.5 rounded-lg bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 border-2 border-dashed border-slate-300 hover:border-indigo-400 text-[10px] shadow-2xs transition group text-right animate-in fade-in"
                                                                                 >
                                                                                     <div className="flex items-center gap-1">
                                                                                         <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-extrabold flex items-center gap-0.5">
                                                                                             <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                                                                             SIMULADO
                                                                                         </span>
                                                                                         <span className="font-bold text-slate-800">Ped {ghost.pedido} (It {ghost.item}):</span>
                                                                                         <strong className="text-emerald-700 bg-white px-1 rounded border border-emerald-200">{ghost.quantidade} un</strong>
                                                                                     </div>

                                                                                     <div className="flex items-center gap-1 text-[9px] text-slate-600">
                                                                                         <button
                                                                                             type="button"
                                                                                             onClick={(e) => openPcpEditor(e, {
                                                                                                 pedido: ghost.pedido,
                                                                                                 item: ghost.item,
                                                                                                 saldo: ghost.quantidade,
                                                                                                 data_pcp: ghost.data_pcp,
                                                                                                 ref_cliente: item.ref_cliente,
                                                                                                 isGhost: true
                                                                                             })}
                                                                                             className="flex items-center gap-0.5 text-indigo-700 hover:text-indigo-900 font-bold bg-white px-1 py-0.2 rounded border border-indigo-200 cursor-pointer"
                                                                                             title="Clique para ajustar manualmente esta data simulada"
                                                                                         >
                                                                                             <Clock className="w-2.5 h-2.5 text-indigo-600" />
                                                                                             {formatPcpDate(ghost.data_pcp)}
                                                                                         </button>
                                                                                         {ghost.ops && (
                                                                                             <button
                                                                                                 type="button"
                                                                                                 onClick={(e) => {
                                                                                                     e.stopPropagation();
                                                                                                     setBomStructureTarget({
                                                                                                         op: ghost.ops,
                                                                                                         itemPv: ghost.item,
                                                                                                         pedido: ghost.pedido,
                                                                                                         produto: item.codigo_metalfisa !== 'NÃO MAPEADO' ? item.codigo_metalfisa : undefined
                                                                                                     });
                                                                                                 }}
                                                                                                 className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded font-mono font-bold hover:underline transition cursor-pointer flex items-center gap-0.5"
                                                                                                 title={`Ver Estrutura da OP ${ghost.ops}`}
                                                                                             >
                                                                                                 <Layers className="w-2.5 h-2.5 text-slate-700" />
                                                                                                 <span>OP: {ghost.ops}</span>
                                                                                             </button>
                                                                                         )}
                                                                                     </div>

                                                                                     {/* Ações Rápidas Individuais da Proposta */}
                                                                                     <div className="flex items-center gap-1 mt-0.5 pt-1 border-t border-slate-200 w-full justify-end">
                                                                                         <button
                                                                                             type="button"
                                                                                             onClick={() => handleSaveSingleProposal(ghost.key)}
                                                                                             disabled={savingItemKey === ghost.key}
                                                                                             className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold flex items-center gap-0.5 transition cursor-pointer"
                                                                                             title="Salvar apenas esta data simulada no SINCO"
                                                                                         >
                                                                                             {savingItemKey === ghost.key ? (
                                                                                                 <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                                                                             ) : (
                                                                                                 <Check className="w-2.5 h-2.5" />
                                                                                             )}
                                                                                             Salvar
                                                                                         </button>
                                                                                         <button
                                                                                             type="button"
                                                                                             onClick={() => handleDiscardSingleProposal(ghost.key)}
                                                                                             className="p-0.5 text-slate-400 hover:text-red-600 transition rounded hover:bg-slate-200 cursor-pointer"
                                                                                             title="Descartar esta simulação"
                                                                                         >
                                                                                             <XCircle className="w-3 h-3" />
                                                                                         </button>
                                                                                     </div>
                                                                                 </div>
                                                                             ))}
                                                                         </div>
                                                                     )}
                                                                 </td>
                                                             );
                                                         })}

                                                         {/* NOVA COLUNA DEDICADA: SEM DEMANDA (+5 ANOS) */}
                                                         <td className="py-2.5 px-3 text-right font-medium text-slate-700 bg-amber-50/20 border-l border-amber-200/60 align-top">
                                                             {/* 1. Previsões PCP REAIS Sem Demanda */}
                                                             {noDemandPcpItems.length > 0 && (
                                                                 <div className="flex flex-col gap-1.5 items-end">
                                                                     {noDemandPcpItems.map((pcp, pcpI) => (
                                                                         <div 
                                                                             key={'nodem_real_' + pcpI}
                                                                             className="flex flex-col items-end gap-0.5 p-1.5 rounded-lg bg-amber-50/90 hover:bg-amber-100/90 text-amber-900 border border-amber-200 hover:border-amber-300 text-[10px] shadow-2xs transition group text-right"
                                                                         >
                                                                             <div className="flex items-center gap-1 font-bold text-amber-950">
                                                                                 <span>Ped {pcp.pedido} (It {pcp.item}):</span>
                                                                                 <strong className="text-emerald-700 bg-white px-1 rounded border border-emerald-200">{pcp.quantidade} un</strong>
                                                                             </div>
                                                                             <div className="flex items-center gap-1 text-[9px] text-amber-800">
                                                                                 <button
                                                                                     type="button"
                                                                                     onClick={(e) => openPcpEditor(e, {
                                                                                         pedido: pcp.pedido,
                                                                                         item: pcp.item,
                                                                                         saldo: pcp.quantidade,
                                                                                         data_pcp: pcp.data_pcp,
                                                                                         ref_cliente: item.ref_cliente,
                                                                                         isGhost: false
                                                                                     })}
                                                                                     className="flex items-center gap-0.5 font-bold hover:underline cursor-pointer bg-white/80 px-1 py-0.2 rounded border border-amber-200 hover:bg-amber-200"
                                                                                     title={`Clique para alterar a data PCP deste pedido (${pcp.pedido} It ${pcp.item})`}
                                                                                 >
                                                                                     <Clock className="w-2.5 h-2.5 text-amber-600 group-hover:scale-110 transition shrink-0" />
                                                                                     <span className="font-semibold">{formatPcpDate(pcp.data_pcp)}</span>
                                                                                 </button>
                                                                                 {pcp.ops && (
                                                                                     <button
                                                                                         type="button"
                                                                                         onClick={(e) => {
                                                                                             e.stopPropagation();
                                                                                             setBomStructureTarget({
                                                                                                 op: pcp.ops,
                                                                                                 itemPv: pcp.item,
                                                                                                 pedido: pcp.pedido,
                                                                                                 produto: item.codigo_metalfisa !== 'NÃO MAPEADO' ? item.codigo_metalfisa : undefined
                                                                                             });
                                                                                         }}
                                                                                         className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-mono font-bold hover:underline transition cursor-pointer flex items-center gap-0.5"
                                                                                         title={`Ver Estrutura da OP ${pcp.ops}`}
                                                                                     >
                                                                                         <Layers className="w-2.5 h-2.5 text-amber-700" />
                                                                                         <span>OP: {pcp.ops}</span>
                                                                                     </button>
                                                                                 )}
                                                                             </div>
                                                                         </div>
                                                                     ))}
                                                                 </div>
                                                             )}

                                                             {/* 2. Previsões PCP FANTASMAS Sem Demanda (+5 Anos) */}
                                                             {ghostNoDemandPcpItems.length > 0 && (
                                                                 <div className="mt-1 flex flex-col gap-1.5 items-end">
                                                                     {ghostNoDemandPcpItems.map((ghost) => (
                                                                         <div 
                                                                             key={'ghost_nodem_' + ghost.key}
                                                                             className="flex flex-col items-end gap-1 p-1.5 rounded-lg bg-amber-50/60 hover:bg-amber-100/60 text-slate-700 border-2 border-dashed border-amber-300 hover:border-amber-500 text-[10px] shadow-2xs transition group text-right animate-in fade-in"
                                                                         >
                                                                             <div className="flex items-center gap-1">
                                                                                 <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 text-[9px] font-extrabold flex items-center gap-0.5">
                                                                                     <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                                                                                     +5 ANOS
                                                                                 </span>
                                                                                 <span className="font-bold text-slate-800">Ped {ghost.pedido} (It {ghost.item}):</span>
                                                                                 <strong className="text-emerald-700 bg-white px-1 rounded border border-emerald-200">{ghost.quantidade} un</strong>
                                                                             </div>

                                                                             <div className="flex items-center gap-1 text-[9px] text-slate-600">
                                                                                 <button
                                                                                     type="button"
                                                                                     onClick={(e) => openPcpEditor(e, {
                                                                                         pedido: ghost.pedido,
                                                                                         item: ghost.item,
                                                                                         saldo: ghost.quantidade,
                                                                                         data_pcp: ghost.data_pcp,
                                                                                         ref_cliente: item.ref_cliente,
                                                                                         isGhost: true
                                                                                     })}
                                                                                     className="flex items-center gap-0.5 text-amber-800 hover:text-amber-950 font-bold bg-white px-1 py-0.2 rounded border border-amber-300 cursor-pointer"
                                                                                     title="Clique para ajustar manualmente esta data simulada (+5 anos)"
                                                                                 >
                                                                                     <Clock className="w-2.5 h-2.5 text-amber-600" />
                                                                                     {formatPcpDate(ghost.data_pcp)}
                                                                                 </button>
                                                                                 {ghost.ops && (
                                                                                     <button
                                                                                         type="button"
                                                                                         onClick={(e) => {
                                                                                             e.stopPropagation();
                                                                                             setBomStructureTarget({
                                                                                                 op: ghost.ops,
                                                                                                 itemPv: ghost.item,
                                                                                                 pedido: ghost.pedido,
                                                                                                 produto: item.codigo_metalfisa !== 'NÃO MAPEADO' ? item.codigo_metalfisa : undefined
                                                                                             });
                                                                                         }}
                                                                                         className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-mono font-bold hover:underline transition cursor-pointer flex items-center gap-0.5"
                                                                                         title={`Ver Estrutura da OP ${ghost.ops}`}
                                                                                     >
                                                                                         <Layers className="w-2.5 h-2.5 text-amber-700" />
                                                                                         <span>OP: {ghost.ops}</span>
                                                                                     </button>
                                                                                 )}
                                                                             </div>

                                                                             {/* Ações Rápidas Individuais da Proposta (+5 Anos) */}
                                                                             <div className="flex items-center gap-1 mt-0.5 pt-1 border-t border-amber-200 w-full justify-end">
                                                                                 <button
                                                                                     type="button"
                                                                                     onClick={() => handleSaveSingleProposal(ghost.key)}
                                                                                     disabled={savingItemKey === ghost.key}
                                                                                     className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold flex items-center gap-0.5 transition cursor-pointer"
                                                                                     title="Salvar esta data no SINCO"
                                                                                 >
                                                                                     {savingItemKey === ghost.key ? (
                                                                                         <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                                                                     ) : (
                                                                                         <Check className="w-2.5 h-2.5" />
                                                                                     )}
                                                                                     Salvar
                                                                                 </button>
                                                                                 <button
                                                                                     type="button"
                                                                                     onClick={() => handleDiscardSingleProposal(ghost.key)}
                                                                                     className="p-0.5 text-slate-400 hover:text-red-600 transition rounded hover:bg-slate-200 cursor-pointer"
                                                                                     title="Descartar esta simulação"
                                                                                 >
                                                                                     <XCircle className="w-3 h-3" />
                                                                                 </button>
                                                                             </div>
                                                                         </div>
                                                                     ))}
                                                                 </div>
                                                             )}

                                                             {noDemandPcpItems.length === 0 && ghostNoDemandPcpItems.length === 0 && (
                                                                 <span className="text-slate-300">-</span>
                                                             )}
                                                         </td>

                                                         <td className="py-3 px-3 text-right font-bold text-slate-900">
                                                             {item.total_demanda > 0 ? item.total_demanda.toLocaleString('pt-BR') : '-'}
                                                         </td>

                                                         <td className="py-3 px-3 text-right font-extrabold text-emerald-700 bg-emerald-50/20">
                                                             {item.total_saldo_faturar > 0 ? item.total_saldo_faturar.toLocaleString('pt-BR') : '-'}
                                                         </td>
                                                     </tr>
                                                 );
                                             })
                                         )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Edição Rápida de Data PCP */}
            {editingPcp && (
                <div 
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
                    onClick={() => !savingPcp && setEditingPcp(null)}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">Alterar Data PCP</h3>
                                    <p className="text-xs text-slate-400">Atualização em tempo real no SINCO</p>
                                </div>
                            </div>
                            <button
                                onClick={() => !savingPcp && setEditingPcp(null)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Detalhes do Pedido */}
                        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Ref. Cliente:</span>
                                <span className="font-bold text-slate-900">{editingPcp.refCliente || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Pedido Metalfisa:</span>
                                <span className="font-bold text-indigo-700">{editingPcp.pedido} (Item {editingPcp.item})</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Saldo do Item:</span>
                                <span className="font-extrabold text-emerald-700">{editingPcp.saldo} un</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Data Atual:</span>
                                <span className="font-semibold text-purple-700">{formatPcpDate(editingPcp.dataAtual)}</span>
                            </div>
                        </div>

                        {/* Input de Nova Data */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Nova Data PCP (Previsão de Entrega Futura)
                            </label>
                            <input 
                                type="date" 
                                value={newDateInput}
                                min={(() => {
                                    const tomorrow = new Date();
                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                    return tomorrow.toISOString().split('T')[0];
                                })()}
                                onChange={(e) => setNewDateInput(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                            />
                            <p className="text-[11px] text-slate-400">A data de entrega PCP deve ser estritamente posterior a hoje.</p>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                disabled={savingPcp}
                                onClick={() => setEditingPcp(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={savingPcp || !newDateInput}
                                onClick={handleSavePcpDate}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
                            >
                                {savingPcp ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Confirmar e Atualizar</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Estrutura da OP (Mesmo da Visão Geral) */}
            {bomStructureTarget && (
                <BOMStructureModal
                    opNum={bomStructureTarget.op}
                    itemPv={bomStructureTarget.itemPv}
                    pedido={bomStructureTarget.pedido}
                    produto={bomStructureTarget.produto}
                    onClose={() => setBomStructureTarget(null)}
                />
            )}

            {/* Modal de Progresso e Conclusão do Preenchimento da Planilha do Cliente */}
            {fillingProgress && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
                        {/* Cabeçalho do Modal */}
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className={`p-2.5 rounded-xl ${fillingProgress.finished ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-indigo-50 text-indigo-600 border border-indigo-200'}`}>
                                {fillingProgress.finished ? (
                                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                ) : (
                                    <FileSpreadsheet className="w-6 h-6 animate-bounce" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-slate-900 truncate">
                                    {fillingProgress.finished ? 'Preenchimento Concluído!' : 'Preenchendo Planilha do Cliente'}
                                </h3>
                                <p className="text-xs text-slate-500 truncate">
                                    Arquivo: <span className="font-semibold text-slate-700">{fillingProgress.fileName}</span>
                                </p>
                            </div>
                        </div>

                        {/* Barra de Progresso e Status */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs font-semibold">
                                <span className={fillingProgress.finished ? 'text-emerald-700' : 'text-slate-700'}>
                                    {fillingProgress.status}
                                </span>
                                <span className="font-mono text-indigo-600 font-bold">{fillingProgress.percentage}%</span>
                            </div>

                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                                <div 
                                    className={`h-full rounded-full transition-all duration-300 ${
                                        fillingProgress.finished 
                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                                            : 'bg-gradient-to-r from-indigo-500 to-violet-600'
                                    }`}
                                    style={{ width: `${fillingProgress.percentage}%` }}
                                />
                            </div>
                        </div>

                        {/* Resumo dos Itens Processados */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[11px] text-slate-400 block font-medium">Itens Lidos</span>
                                <span className="text-sm font-extrabold text-slate-800">{fillingProgress.processedCount || 0}</span>
                            </div>
                            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100">
                                <span className="text-[11px] text-emerald-600 block font-medium">Com PCP</span>
                                <span className="text-sm font-extrabold text-emerald-700">{fillingProgress.filledCount || 0}</span>
                            </div>
                            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-100">
                                <span className="text-[11px] text-amber-600 block font-medium">Sem Saldo</span>
                                <span className="text-sm font-extrabold text-amber-700">{fillingProgress.noBalanceCount || 0}</span>
                            </div>
                        </div>

                        {/* Informação do Arquivo Salvo */}
                        {fillingProgress.finished && (
                            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                                    <Download className="w-4 h-4 text-emerald-600" />
                                    <span>Arquivo Gerado e Salvo:</span>
                                </div>
                                <p className="font-mono text-[11px] text-emerald-950 font-semibold break-all">
                                    {fillingProgress.outputFileName}
                                </p>
                            </div>
                        )}

                        {/* Botão de Fechamento (Apenas quando finalizado) */}
                        <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                            {fillingProgress.finished ? (
                                <button
                                    type="button"
                                    onClick={() => setFillingProgress(null)}
                                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
                                >
                                    Concluir e Fechar
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                    <span>Processando linhas e gravando datas...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
