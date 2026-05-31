import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Calendar, Search, GitMerge, ChevronRight, ChevronDown, Save, FastForward, Info, Play, AlertTriangle, PlayCircle, ArrowUp, ArrowDown, Copy, Network, X, Layers, Filter, FileText, Clock, CheckCircle2, User, Printer, Package, FileCheck, HelpCircle, FileBox, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import api, { getProductionDashboard, saveProductionPlanBatch, getPlanningPrefs, getSincoArvore } from '../../services/api';
import { toast } from 'react-toastify';

const formatDate = (d) => d.toISOString().substring(0, 10);
const formatDateToHTML = (val) => {
    if (!val || val === '-') return '';
    if (typeof val === 'string') return val.substring(0, 10);
    if (val instanceof Date) return val.toISOString().substring(0, 10);
    return '';
};

const addBusinessDays = (date, days) => {
    let result = new Date(date);
    let added = 0;
    while (added < days) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 0 && result.getDay() !== 6) added++;
    }
    return result;
};

const subtractBusinessDays = (date, days) => {
    let result = new Date(date);
    let subtracted = 0;
    while (subtracted < days) {
        result.setDate(result.getDate() - 1);
        if (result.getDay() !== 0 && result.getDay() !== 6) subtracted++;
    }
    return result;
};

export default function PlanejamentoAvancado() {
    const [searchType, setSearchType] = useState('pedido');
    const [searchValue, setSearchValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [rawData, setRawData] = useState([]);
    const [draftPlans, setDraftPlans] = useState({});
    const [expandedNodes, setExpandedNodes] = useState({});
    const [customOrder, setCustomOrder] = useState({});
    const [diasPorOp, setDiasPorOp] = useState({});
    const [cascataModal, setCascataModal] = useState(null);
    const [structureModal, setStructureModal] = useState(null);
    const [structureFilter, setStructureFilter] = useState('');
    const [structureTree, setStructureTree] = useState(null);
    const [structureExpanded, setStructureExpanded] = useState({});
    const [occupancyData, setOccupancyData] = useState(null);
    const [loadingTree, setLoadingTree] = useState(false);
    const [batchInicio, setBatchInicio] = useState('');
    const [batchFim, setBatchFim] = useState('');

    const fetchTaxaOcupacao = async () => {
        try {
            const response = await api.get('/pcp-refinado/taxa-ocupacao');
            const occMap = {};
            if (Array.isArray(response.data)) {
                response.data.forEach(item => {
                    if (!occMap[item.data]) occMap[item.data] = {};
                    occMap[item.data][item.recurso_codigo] = item;
                });
            }
            setOccupancyData(occMap);
        } catch(err) {
            console.error('Erro ao carregar taxa de ocupação:', err);
        }
    };

    useEffect(() => {
        fetchTaxaOcupacao();
    }, []);

    useEffect(() => {
        if (structureModal && structureModal.produto) {
            setLoadingTree(true);
            getSincoArvore(structureModal.produto).then(data => {
                const levels = {};
                if (Array.isArray(data)) {
                    data.forEach(d => {
                        const comp = d.componente || d.B1_COD || d.Arquivo || d.codigo;
                        if (comp) levels[comp] = d.nivel !== undefined ? d.nivel : (d.Nivel !== undefined ? d.Nivel : (d.NIVEL !== undefined ? d.NIVEL : 0));
                    });
                }
                setStructureTree(levels);
                
                const allExpanded = {};
                if (rawData) {
                    rawData.filter(r => r.op === structureModal.op).forEach(r => {
                        allExpanded[`${r.item_op}_${r.sequen}`] = true;
                    });
                }
                setStructureExpanded(allExpanded);
            }).catch(err => {
                console.error("Erro ao buscar árvore:", err);
                setStructureTree({});
            }).finally(() => {
                setLoadingTree(false);
            });
        } else {
            setStructureTree(null);
        }
    }, [structureModal?.produto, structureModal?.op, rawData]);

    const handleSearch = async () => {
        if (!searchValue.trim()) {
            toast.warning('Informe um valor para buscar.');
            return;
        }

        setLoading(true);
        try {
            const params = { limit: 5000 };
            params[searchType] = searchValue.trim();
            
            const res = await getProductionDashboard(params);
            if (!res.data || res.data.length === 0) {
                toast.info('Nenhuma operação encontrada para esta busca.');
                setRawData([]);
            } else {
                setRawData(res.data);
                const initialExpanded = {};
                res.data.forEach(op => {
                    const pedKey = `PED_${op.pedido_venda || 'SEM_PEDIDO'}`;
                    const opKey = `OP_${op.op}_${op.item_op}`;
                    initialExpanded[pedKey] = true;
                    initialExpanded[opKey] = true;
                });
                setExpandedNodes(initialExpanded);
            }
        } catch (err) {
            console.error(err);
            toast.error('Erro ao buscar dados.');
        } finally {
            setLoading(false);
        }
    };

    const treeData = useMemo(() => {
        if (rawData.length === 0) return [];
        
        const pedidosMap = new Map();

        rawData.forEach(op => {
            const pedKey = `PED_${op.pedido_venda || 'SEM_PEDIDO'}`;
            if (!pedidosMap.has(pedKey)) {
                pedidosMap.set(pedKey, {
                    id: pedKey,
                    type: 'pedido',
                    pedido: op.pedido_venda,
                    cliente: op.nome_cliente,
                    data_entrega: op.data_entrega,
                    ops: new Map()
                });
            }

            const pedidoNode = pedidosMap.get(pedKey);
            const opKey = `OP_${op.op}_${op.item_op}`;
            
            if (!pedidoNode.ops.has(opKey)) {
                pedidoNode.ops.set(opKey, {
                    id: opKey,
                    type: 'op',
                    op: op.op,
                    item_op: op.item_op,
                    produto: op.cod_produto_op,
                    desc_produto: op.desc_produto,
                    operacoesMap: new Map()
                });
            }

            const opNode = pedidoNode.ops.get(opKey);
            const recursoKey = op.recurso || op.operacao;

            if (!opNode.operacoesMap.has(recursoKey)) {
                opNode.operacoesMap.set(recursoKey, {
                    recurso: recursoKey,
                    desc_recurso: op.desc_recurso || op.desc_operacao,
                    items: []
                });
            }
            opNode.operacoesMap.get(recursoKey).items.push(op);
        });

        const result = Array.from(pedidosMap.values()).map(ped => {
            const opsArray = Array.from(ped.ops.values()).map(opNode => {
                const groupedOperacoes = Array.from(opNode.operacoesMap.values()).map(group => {
                    group.items.sort((a, b) => a.sequen.localeCompare(b.sequen));
                    
                    const seqs = Array.from(new Set(group.items.map(i => i.sequen))).join(', ');
                    const ops = Array.from(new Set(group.items.map(i => i.operacao))).join(', ');
                    const totalPlan = group.items.reduce((sum, i) => sum + (Number(i.qtd_planejada_op) || 0), 0);
                    const totalProd = group.items.reduce((sum, i) => sum + (Number(i.qtd_produzida_real) || 0), 0);
                    
                    return {
                        id: `${opNode.op}_${opNode.item_op}_${group.recurso}`,
                        recurso: group.recurso,
                        desc_recurso: group.desc_recurso,
                        sequen_display: seqs,
                        operacoes_display: ops,
                        qtd_planejada_op: totalPlan,
                        qtd_produzida_real: totalProd,
                        items: group.items
                    };
                });

                const opKeyStr = `${opNode.op}_${opNode.item_op}`;
                if (customOrder[opKeyStr]) {
                    const orderArr = customOrder[opKeyStr];
                    groupedOperacoes.sort((a, b) => {
                        let idxA = orderArr.indexOf(a.recurso);
                        let idxB = orderArr.indexOf(b.recurso);
                        if(idxA === -1) idxA = 999;
                        if(idxB === -1) idxB = 999;
                        return idxA - idxB;
                    });
                } else {
                    groupedOperacoes.sort((a, b) => a.items[0].sequen.localeCompare(b.items[0].sequen));
                }

                return { ...opNode, operacoes: groupedOperacoes };
            });
            return { ...ped, ops: opsArray };
        });

        return result;
    }, [rawData, customOrder]);

    const toggleNode = async (id) => {
        const isExpanding = !expandedNodes[id];
        setExpandedNodes(prev => ({ ...prev, [id]: isExpanding }));

        if (isExpanding) {
            const ped = treeData.find(p => p.id === id);
            if (ped) {
                for (const opNode of ped.ops) {
                    try {
                        const prefs = await getPlanningPrefs(opNode.op);
                        if (prefs && prefs.ordemRecursos) {
                            const parsed = typeof prefs.ordemRecursos === 'string' ? JSON.parse(prefs.ordemRecursos) : prefs.ordemRecursos;
                            setCustomOrder(prev => ({ ...prev, ...parsed }));
                        }
                    } catch (e) {
                        console.error('Falha ao buscar preferências para a OP', opNode.op, e);
                    }
                }
            }
        }
    };

    const handleMove = (e, opNode, currentIndex, direction) => {
        e.stopPropagation();
        const opKeyStr = `${opNode.op}_${opNode.item_op}`;
        setCustomOrder(prev => {
            const currentOrder = prev[opKeyStr] || opNode.operacoes.map(g => g.recurso);
            const newOrder = [...currentOrder];
            
            const targetIndex = currentIndex + direction;
            if (targetIndex < 0 || targetIndex >= newOrder.length) return prev;
            
            const temp = newOrder[currentIndex];
            newOrder[currentIndex] = newOrder[targetIndex];
            newOrder[targetIndex] = temp;
            
            return { ...prev, [opKeyStr]: newOrder };
        });
    };

    const handleDateChange = (groupedOp, field, value) => {
        setDraftPlans(prev => {
            const newDrafts = { ...prev };
            groupedOp.items.forEach(opOriginal => {
                const key = `${opOriginal.op}_${opOriginal.item_op}_${opOriginal.sequen}_${opOriginal.operacao}`;
                const current = newDrafts[key] || { 
                    inicio: opOriginal.data_planejada_inicio?.substring(0,10) || '', 
                    fim: opOriginal.data_planejada_fim?.substring(0,10) || '' 
                };
                newDrafts[key] = { ...current, [field]: value };
            });
            return newDrafts;
        });
    };

    const applyDatesToAllIdentical = (groupedOp, valInicio, valFim) => {
        if (!valInicio || !valFim) {
            toast.warning('Preencha a data de início e fim primeiro.');
            return;
        }
        
        let count = 0;
        setDraftPlans(prev => {
            const newDrafts = { ...prev };
            treeData.forEach(opNode => {
                opNode.ops.forEach(opNodeItem => {
                    opNodeItem.operacoes.forEach(op => {
                        if (op.recurso === groupedOp.recurso) {
                            op.items.forEach(item => {
                                const key = `${item.op}_${item.item_op}_${item.sequen}_${item.operacao}`;
                                const current = newDrafts[key] || {
                                    inicio: item.data_planejada_inicio?.substring(0,10) || '',
                                    fim: item.data_planejada_fim?.substring(0,10) || ''
                                };
                                newDrafts[key] = { ...current, inicio: valInicio, fim: valFim };
                            });
                            count++;
                        }
                    });
                });
            });
            return newDrafts;
        });
        toast.success(`Datas aplicadas para todas as ${count} operações com o recurso ${groupedOp.recurso}.`);
    };

    const getOccupationColor = (percent) => {
        if (percent >= 100) return 'bg-red-100 text-red-800 border-red-300';
        if (percent >= 80) return 'bg-amber-100 text-amber-800 border-amber-300';
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    };

    const handleApplyBatchToVisible = async () => {
        if (!batchInicio || !batchFim) {
            toast.warning('Preencha Início e Fim para aplicar em lote.');
            return;
        }
        
        const filteredRows = rawData
            .filter(r => r.op === structureModal?.op)
            .filter(r => !structureFilter || 
                r.operacao?.toLowerCase().includes(structureFilter.toLowerCase()) || 
                r.desc_operacao?.toLowerCase().includes(structureFilter.toLowerCase()) || 
                r.recurso?.toLowerCase().includes(structureFilter.toLowerCase()) ||
                r.cod_produto_op?.toLowerCase().includes(structureFilter.toLowerCase())
            );

        if(filteredRows.length === 0) return;

        setDraftPlans(prev => {
            const newDrafts = { ...prev };
            filteredRows.forEach(r => {
                const key = `${r.op}_${r.item_op}_${r.sequen}_${r.operacao}`;
                newDrafts[key] = { inicio: batchInicio, fim: batchFim };
            });
            return newDrafts;
        });

        toast.success(`Datas aplicadas para ${filteredRows.length} operações filtradas!`);
    };

    const handleModalDateChange = (r, type, value) => {
        setDraftPlans(prev => {
            const key = `${r.op}_${r.item_op}_${r.sequen}_${r.operacao}`;
            const current = prev[key] || {
                inicio: r.data_planejada_inicio?.substring(0,10) || '',
                fim: r.data_planejada_fim?.substring(0,10) || ''
            };
            return { ...prev, [key]: { ...current, [type]: value } };
        });
    };
    const confirmCascata = (modalState) => {
        const { opNode, baseDate, direction, scope } = modalState;
        if (!baseDate) {
            toast.warning('Defina uma data base para a cascata.');
            return;
        }

        const newDrafts = { ...draftPlans };
        
        const calculateCascataForNode = (nodeToCalc, startBaseDate) => {
            let currentDate = new Date(`${startBaseDate}T12:00:00`);
            let minStart = null;
            let maxEnd = null;

            if (direction === 'inicio') {
                nodeToCalc.operacoes.forEach((groupedOp) => {
                    const dias = parseInt(diasPorOp[groupedOp.id], 10) || 1;
                    const startStr = formatDate(currentDate);
                    const endStr = formatDate(addBusinessDays(currentDate, Math.max(0, dias - 1)));
                    
                    if (!minStart || startStr < minStart) minStart = startStr;
                    if (!maxEnd || endStr > maxEnd) maxEnd = endStr;

                    groupedOp.items.forEach(oper => {
                        const key = `${oper.op}_${oper.item_op}_${oper.sequen}_${oper.operacao}`;
                        newDrafts[key] = { inicio: startStr, fim: endStr };
                    });
                    
                    currentDate = addBusinessDays(new Date(`${endStr}T12:00:00`), 1);
                });
            } else {
                const opsReversed = [...nodeToCalc.operacoes].reverse();
                opsReversed.forEach((groupedOp) => {
                    const dias = parseInt(diasPorOp[groupedOp.id], 10) || 1;
                    const endStr = formatDate(currentDate);
                    const startStr = formatDate(subtractBusinessDays(currentDate, Math.max(0, dias - 1)));
                    
                    if (!minStart || startStr < minStart) minStart = startStr;
                    if (!maxEnd || endStr > maxEnd) maxEnd = endStr;

                    groupedOp.items.forEach(oper => {
                        const key = `${oper.op}_${oper.item_op}_${oper.sequen}_${oper.operacao}`;
                        newDrafts[key] = { inicio: startStr, fim: endStr };
                    });
                    
                    currentDate = subtractBusinessDays(new Date(`${startStr}T12:00:00`), 1);
                });
            }
            return { minStart, maxEnd };
        };

        if (scope === 'individual') {
            calculateCascataForNode(opNode, baseDate);
            toast.success(`Cascata calculada para o item ${opNode.item_op}!`);
        } 
        else if (scope === 'global') {
            let count = 0;
            treeData.forEach(ped => {
                ped.ops.forEach(siblingNode => {
                    if (siblingNode.op === opNode.op) {
                        calculateCascataForNode(siblingNode, baseDate);
                        count++;
                    }
                });
            });
            toast.success(`Cascata global aplicada a ${count} itens da OP ${opNode.op}!`);
        }
        else if (scope === 'replicar') {
            const { minStart, maxEnd } = calculateCascataForNode(opNode, baseDate);
            
            let count = 0;
            treeData.forEach(ped => {
                ped.ops.forEach(siblingNode => {
                    if (siblingNode.op === opNode.op && siblingNode.item_op !== opNode.item_op) {
                        siblingNode.operacoes.forEach(groupedOp => {
                            groupedOp.items.forEach(oper => {
                                const key = `${oper.op}_${oper.item_op}_${oper.sequen}_${oper.operacao}`;
                                newDrafts[key] = { inicio: minStart, fim: maxEnd };
                            });
                        });
                        count++;
                    }
                });
            });
            toast.success(`Cronograma do item ${opNode.item_op} replicado para ${count} outros itens!`);
        }

        setDraftPlans(prev => ({ ...prev, ...newDrafts }));
        setCascataModal(null);
    };

    const handleDiasChange = (groupedOp, value) => {
        const dias = parseInt(value, 10) || 1;
        setDiasPorOp(prev => ({ ...prev, [groupedOp.id]: dias }));

        setDraftPlans(prev => {
            const newDrafts = { ...prev };
            groupedOp.items.forEach(oper => {
                const key = `${oper.op}_${oper.item_op}_${oper.sequen}_${oper.operacao}`;
                const currentDraft = newDrafts[key] || { 
                    inicio: oper.data_planejada_inicio?.substring(0,10) || '', 
                    fim: oper.data_planejada_fim?.substring(0,10) || '' 
                };

                if (currentDraft.inicio) {
                    const startDate = new Date(`${currentDraft.inicio}T12:00:00`);
                    const endStr = formatDate(addBusinessDays(startDate, Math.max(0, dias - 1)));
                    newDrafts[key] = { ...currentDraft, fim: endStr };
                }
            });
            return newDrafts;
        });
    };

    const handleSaveBatch = async () => {
        const payload = [];
        
        rawData.forEach(op => {
            const key = `${op.op}_${op.item_op}_${op.sequen}_${op.operacao}`;
            const draft = draftPlans[key];
            if (draft) {
                payload.push({
                    op_numero: op.op,
                    op_item: op.item_op,
                    op_sequencia: op.sequen,
                    operacao_codigo: op.operacao,
                    data_planejada_inicio: draft.inicio || null,
                    data_planejada_fim: draft.fim || null
                });
            }
        });

        if (payload.length === 0) {
            toast.info('Nenhuma data foi alterada para salvar.');
            return;
        }

        setLoading(true);
        try {
            await saveProductionPlanBatch(
                payload, 
                "Salvo em lote pelo Planejador Avançado", 
                "calendar", 
                { ordemRecursos: customOrder }
            );
            toast.success(`${payload.length} operações salvas com sucesso!`);
            setDraftPlans({});
            handleSearch();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao salvar planejamento.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveOP = async (opNode) => {
        const payload = [];
        
        rawData.forEach(op => {
            if (op.op !== opNode.op) return;
            
            const key = `${op.op}_${op.item_op}_${op.sequen}_${op.operacao}`;
            const draft = draftPlans[key];
            if (draft) {
                payload.push({
                    op_numero: op.op,
                    op_item: op.item_op,
                    op_sequencia: op.sequen,
                    operacao_codigo: op.operacao,
                    data_planejada_inicio: draft.inicio || null,
                    data_planejada_fim: draft.fim || null
                });
            }
        });

        if (payload.length === 0) {
            toast.info(`Nenhuma alteração pendente para a OP ${opNode.op}.`);
            return;
        }

        setLoading(true);
        try {
            await saveProductionPlanBatch(
                payload, 
                `Planejamento salvo para OP ${opNode.op}`, 
                "calendar", 
                { ordemRecursos: customOrder }
            );
            toast.success(`${payload.length} operações salvas com sucesso na OP ${opNode.op}!`);
            
            const newDrafts = { ...draftPlans };
            Object.keys(newDrafts).forEach(key => {
                if (key.startsWith(opNode.op + '_')) delete newDrafts[key];
            });
            setDraftPlans(newDrafts);
            
            handleSearch();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || `Erro ao salvar OP ${opNode.op}.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <GitMerge className="w-7 h-7 text-indigo-600" />
                        Planejamento Estratégico (Smart Planner)
                    </h1>
                    <p className="text-slate-500 mt-1">Planeje Pedidos e OPs de forma estruturada e em cascata.</p>
                </div>
                {Object.keys(draftPlans).length > 0 && (
                    <button 
                        onClick={handleSaveBatch}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold shadow flex items-center gap-2 transition-all transform hover:scale-105"
                    >
                        <Save className="w-5 h-5" />
                        Salvar Alterações ({Object.keys(draftPlans).length})
                    </button>
                )}
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 shrink-0">
                <div className="flex gap-3 max-w-3xl">
                    <div className="w-1/4">
                        <select 
                            value={searchType} 
                            onChange={e => setSearchType(e.target.value)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        >
                            <option value="pedido">Pedido de Venda</option>
                            <option value="op">Ordem de Produção (OP)</option>
                            <option value="produto">Produto (Código)</option>
                        </select>
                    </div>
                    <div className="flex-1 relative">
                        <input 
                            type="text" 
                            placeholder={`Digite o ${searchType}...`} 
                            value={searchValue}
                            onChange={e => setSearchValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            className="w-full px-4 py-2.5 pl-10 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    </div>
                    <button 
                        onClick={handleSearch}
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <Search className="w-4 h-4" />
                        Buscar
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0 relative">
                {loading && (
                    <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600"></div>
                    </div>
                )}
                
                {treeData.length === 0 && !loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <GitMerge className="w-16 h-16 mb-4 text-slate-200" />
                        <h3 className="text-lg font-medium text-slate-600">Nenhum planejamento carregado</h3>
                        <p className="text-sm">Use a busca acima para carregar o escopo de planejamento.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto p-4 bg-slate-50">
                        {treeData.map(pedido => (
                            <div key={pedido.id} className="mb-4 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                                <div 
                                    className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors"
                                    onClick={() => toggleNode(pedido.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedNodes[pedido.id] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                        <div>
                                            <span className="font-bold text-lg">PV: {pedido.pedido || 'SEM PEDIDO'}</span>
                                            {pedido.cliente && <span className="ml-3 text-sm text-slate-300 font-medium">{pedido.cliente}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        {pedido.data_entrega && (
                                            <span className="flex items-center gap-1.5 bg-slate-700 px-3 py-1 rounded-full text-emerald-300 font-bold">
                                                <Calendar className="w-4 h-4" />
                                                Entrega: {pedido.data_entrega.split('-').reverse().join('/')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {expandedNodes[pedido.id] && (
                                    <div className="p-3 bg-slate-50 space-y-3 border-t border-slate-200">
                                        {pedido.ops.map(opNode => (
                                            <div key={opNode.id} className="border border-slate-200 bg-white rounded-lg overflow-hidden shadow-sm">
                                                <div className="bg-indigo-50 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-indigo-100 transition-colors border-b border-indigo-100">
                                                    <div className="flex items-center gap-3 flex-1" onClick={() => toggleNode(opNode.id)}>
                                                        {expandedNodes[opNode.id] ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4 text-indigo-600" />}
                                                        <div>
                                                            <span className="font-bold text-indigo-900">OP {opNode.op}</span>
                                                            <span className="text-slate-400 mx-2">|</span>
                                                            <span className="text-sm font-semibold text-slate-700">{opNode.produto}</span>
                                                            <span className="text-xs text-slate-500 ml-2 truncate max-w-[200px] inline-block align-bottom">{opNode.desc_produto}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                const opRows = rawData.filter(r => r.op === opNode.op).sort((a, b) => a.item_op.localeCompare(b.item_op));
                                                                const rootProd = opRows.length > 0 ? opRows[0].cod_produto_op : opNode.produto;
                                                                setStructureModal({ op: opNode.op, item_op: opNode.item_op, produto: rootProd }); 
                                                                setStructureFilter(''); 
                                                            }}
                                                            className="text-xs flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded hover:bg-slate-50 transition-colors shadow-sm font-semibold"
                                                        >
                                                            <Network className="w-3.5 h-3.5" /> Ver Estrutura
                                                        </button>
                                                        <button 
                                                            className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors shadow-sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCascataModal({ opNode, baseDate: new Date().toISOString().substring(0, 10), direction: 'inicio', scope: 'individual' });
                                                            }}
                                                        >
                                                            <FastForward className="w-3.5 h-3.5" />
                                                            Cascata Auto
                                                        </button>
                                                        
                                                        <button 
                                                            className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-700 transition-colors shadow-sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSaveOP(opNode);
                                                            }}
                                                        >
                                                            <Save className="w-3.5 h-3.5" />
                                                            Salvar OP
                                                        </button>
                                                    </div>
                                                </div>

                                                {expandedNodes[opNode.id] && (
                                                    <div className="p-0">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                                                <tr>
                                                                    <th className="px-2 py-2 w-8"></th>
                                                                    <th className="px-4 py-2 font-semibold w-24">Seq / Op</th>
                                                                    <th className="px-4 py-2 font-semibold w-32">Recurso</th>
                                                                    <th className="px-4 py-2 font-semibold">Operação</th>
                                                                    <th className="px-4 py-2 font-semibold text-center w-24">Qtd</th>
                                                                    <th className="px-4 py-2 font-semibold text-center w-24">Dias</th>
                                                                    <th className="px-4 py-2 font-semibold w-40">Início</th>
                                                                    <th className="px-4 py-2 font-semibold w-40">Fim</th>
                                                                    <th className="px-2 py-2 font-semibold w-12 text-center">Ações</th>
                                                                    <th className="px-4 py-2 font-semibold w-32">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {opNode.operacoes.map((groupedOp, idx) => {
                                                                    const firstItem = groupedOp.items[0];
                                                                    const firstKey = `${firstItem.op}_${firstItem.item_op}_${firstItem.sequen}_${firstItem.operacao}`;
                                                                    const draft = draftPlans[firstKey];
                                                                    const valInicio = draft !== undefined ? draft.inicio : (firstItem.data_planejada_inicio?.substring(0,10) || '');
                                                                    const valFim = draft !== undefined ? draft.fim : (firstItem.data_planejada_fim?.substring(0,10) || '');
                                                                    const valDias = diasPorOp[groupedOp.id] || '';
                                                                    const isModified = draft !== undefined;
                                                                    const qtdPlanejada = groupedOp.qtd_planejada_op;
                                                                    const qtdProduzida = groupedOp.qtd_produzida_real;
                                                                    const isConcluido = qtdProduzida > 0 && qtdProduzida >= qtdPlanejada;

                                                                    return (
                                                                        <tr key={groupedOp.id} className={`hover:bg-slate-50 ${isModified ? 'bg-indigo-50/30' : ''}`}>
                                                                            <td className="px-2 py-2">
                                                                                <div className="flex flex-col items-center gap-1">
                                                                                    <button disabled={idx === 0} onClick={(e) => handleMove(e, opNode, idx, -1)} className="text-slate-300 hover:text-indigo-600 disabled:opacity-20"><ArrowUp className="w-3.5 h-3.5" /></button>
                                                                                    <button disabled={idx === opNode.operacoes.length - 1} onClick={(e) => handleMove(e, opNode, idx, 1)} className="text-slate-300 hover:text-indigo-600 disabled:opacity-20"><ArrowDown className="w-3.5 h-3.5" /></button>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-2 font-mono text-xs font-bold text-slate-500">{groupedOp.sequen_display} / {groupedOp.operacoes_display}</td>
                                                                            <td className="px-4 py-2 font-bold text-slate-700">{groupedOp.recurso}</td>
                                                                            <td className="px-4 py-2 text-xs text-slate-600">{groupedOp.desc_recurso}</td>
                                                                            <td className="px-4 py-2 text-center text-xs font-medium text-slate-600">{qtdProduzida} / {qtdPlanejada}</td>
                                                                            <td className="px-4 py-2">
                                                                                <input type="number" min="1" value={valDias} onChange={e => handleDiasChange(groupedOp, e.target.value)} className="w-full px-2 py-1 text-center text-sm rounded border border-slate-200 bg-white" disabled={isConcluido} />
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                <input type="date" value={valInicio} onChange={e => handleDateChange(groupedOp, 'inicio', e.target.value)} className={`w-full px-2 py-1 text-sm rounded border ${isModified ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`} disabled={isConcluido} />
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                <input type="date" value={valFim} onChange={e => handleDateChange(groupedOp, 'fim', e.target.value)} className={`w-full px-2 py-1 text-sm rounded border ${isModified ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`} disabled={isConcluido} />
                                                                            </td>
                                                                            <td className="px-2 py-2 text-center">
                                                                                <button onClick={() => applyDatesToAllIdentical(groupedOp, valInicio, valFim)} disabled={isConcluido || !valInicio || !valFim} className="p-1.5 text-slate-400 hover:text-indigo-600"><Copy className="w-4 h-4" /></button>
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                {isConcluido ? <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">CONCLUÍDO</span> : <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">ANDAMENTO</span>}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {cascataModal && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50">
                            <h3 className="font-bold text-indigo-900">Cascata Auto: OP {cascataModal.opNode.op}</h3>
                            <button onClick={() => setCascataModal(null)} className="text-slate-400">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1">Escopo</label>
                                <select value={cascataModal.scope} onChange={e => setCascataModal(prev => ({ ...prev, scope: e.target.value }))} className="w-full border p-2 rounded">
                                    <option value="individual">Este Item</option>
                                    <option value="global">Global (Todos Itens da OP)</option>
                                    <option value="replicar">Replicar Cronograma</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Base</label>
                                <select value={cascataModal.direction} onChange={e => setCascataModal(prev => ({ ...prev, direction: e.target.value }))} className="w-full border p-2 rounded">
                                    <option value="inicio">Data de Início</option>
                                    <option value="fim">Data de Entrega</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Data</label>
                                <input type="date" value={cascataModal.baseDate} onChange={e => setCascataModal(prev => ({ ...prev, baseDate: e.target.value }))} className="w-full border p-2 rounded" />
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
                            <button onClick={() => setCascataModal(null)} className="px-4 py-2 text-sm bg-slate-200 rounded">Cancelar</button>
                            <button onClick={() => confirmCascata(cascataModal)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded">Calcular</button>
                        </div>
                    </div>
                </div>
            )}

            {structureModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-[1800px] flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Estrutura do Produto: <span className="text-indigo-700">{structureModal.produto}</span> <span className="text-slate-400 text-sm font-normal">(OP {structureModal.op})</span></h3>
                                <p className="text-sm text-slate-500">Visão geral de todos os componentes e operações que formam este produto</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Filtrar operação ou recurso..." 
                                        value={structureFilter}
                                        onChange={(e) => setStructureFilter(e.target.value)}
                                        className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-56 bg-white shadow-sm"
                                    />
                                </div>
                                <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                                    <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Aplicar aos visíveis:</span>
                                    <input 
                                        type="date" 
                                        value={batchInicio} 
                                        onChange={e => setBatchInicio(e.target.value)} 
                                        className="px-2 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-indigo-500 w-32 shadow-sm" 
                                    />
                                    <input 
                                        type="date" 
                                        value={batchFim} 
                                        onChange={e => setBatchFim(e.target.value)} 
                                        className="px-2 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-indigo-500 w-32 shadow-sm" 
                                    />
                                    <button 
                                        onClick={handleApplyBatchToVisible}
                                        disabled={!batchInicio || !batchFim}
                                        className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1 shadow-sm"
                                        title="Aplica estas datas a TODAS as operações que estão aparecendo na tabela abaixo"
                                    >
                                        <Copy className="w-3.5 h-3.5" /> Lote
                                    </button>
                                </div>
                                <button onClick={() => { setStructureModal(null); setStructureFilter(''); }} className="text-slate-400 hover:text-slate-600 transition-colors ml-2">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                                        <th className="p-2 w-12 text-center"></th>
                                        <th className="p-2">Seq</th>
                                        <th className="p-2">Operação</th>
                                        <th className="p-2">Recurso</th>
                                        <th className="p-2">Planejado (Início - Fim)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const filteredRows = rawData
                                            .filter(r => r.op === structureModal.op)
                                            .filter(r => !structureFilter || 
                                                r.operacao?.toLowerCase().includes(structureFilter.toLowerCase()) || 
                                                r.desc_operacao?.toLowerCase().includes(structureFilter.toLowerCase()) || 
                                                r.recurso?.toLowerCase().includes(structureFilter.toLowerCase()) ||
                                                r.cod_produto_op?.toLowerCase().includes(structureFilter.toLowerCase())
                                            );
                                            
                                        const grouped = {};
                                        filteredRows.forEach(r => {
                                            const groupKey = `${r.item_op}_${r.sequen}`;
                                            if (!grouped[groupKey]) grouped[groupKey] = {
                                                item_op: r.item_op,
                                                sequen: r.sequen,
                                                produto: r.cod_produto_op,
                                                desc: r.desc_produto,
                                                operacoes: []
                                            };
                                            grouped[groupKey].operacoes.push(r);
                                        });

                                        return Object.entries(grouped)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([groupKey, data]) => {
                                                const isExpanded = structureExpanded[groupKey] !== false;
                                                const nivel = (structureTree && structureTree[data.produto]) ? structureTree[data.produto] : 0;
                                                const indentPx = nivel * 16;
                                                
                                                return (
                                                <React.Fragment key={groupKey}>
                                                    <tr 
                                                        className="bg-slate-100 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors"
                                                        onClick={() => setStructureExpanded(prev => ({ ...prev, [groupKey]: !isExpanded }))}
                                                    >
                                                        <td colSpan="5" className="p-2 font-bold text-slate-800">
                                                            <div className="flex items-center gap-2" style={{ paddingLeft: `${indentPx}px` }}>
                                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                                                {nivel > 0 && <span className="text-slate-300 font-mono text-[10px] mt-0.5 shrink-0 select-none">└─</span>}
                                                                <span className="bg-slate-600 text-white px-2 py-0.5 rounded text-xs font-mono">
                                                                    Item {data.item_op} {data.sequen !== '001' ? `/ Seq ${data.sequen}` : ''}
                                                                </span>
                                                                <span className="font-bold text-indigo-900">{data.produto}</span>
                                                                <span className="text-slate-500 text-xs font-normal border-l border-slate-400 pl-2 ml-2 truncate max-w-md">{data.desc}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    
                                                    {isExpanded && data.operacoes.sort((a,b) => a.sequen.localeCompare(b.sequen)).map((r, opIdx) => {
                                                        const key = `${r.op}_${r.item_op}_${r.sequen}_${r.operacao}`;
                                                        const draft = draftPlans[key];
                                                        const htmlInicio = formatDateToHTML(draft ? draft.inicio : r.data_planejada_inicio);
                                                        const htmlFim = formatDateToHTML(draft ? draft.fim : r.data_planejada_fim);
                                                        const occ = htmlInicio && occupancyData && occupancyData[htmlInicio] ? occupancyData[htmlInicio][r.recurso] : null;
                                                        const isModified = draft !== undefined;

                                                        return (
                                                            <tr key={`${groupKey}_${opIdx}`} className="border-b hover:bg-slate-50 border-l-4 border-l-transparent hover:border-l-indigo-400 group">
                                                                <td className="p-2 font-mono text-xs text-slate-300 text-center">↳</td>
                                                                <td className="p-2 font-mono text-xs">{r.operacao}</td>
                                                                <td className="p-2 text-indigo-600 font-bold text-xs">{r.operacao} - {r.desc_operacao}</td>
                                                                <td className="p-2 text-xs font-semibold">{r.recurso}</td>
                                                                <td className="p-2 font-mono text-xs">
                                                                    <div className="flex flex-col gap-1 w-full max-w-[140px]">
                                                                        <div className="flex items-center gap-1">
                                                                            <input 
                                                                                type="date" 
                                                                                value={htmlInicio}
                                                                                onChange={e => handleModalDateChange(r, 'inicio', e.target.value)}
                                                                                className={`w-[115px] px-1.5 py-1 text-xs rounded border ${isModified ? 'border-indigo-300 bg-indigo-50 font-bold text-indigo-800' : 'border-slate-200 bg-white text-slate-700'} focus:ring-1 focus:ring-indigo-500 outline-none transition-colors shadow-sm`}
                                                                            />
                                                                            <span className="text-slate-400 px-1">até</span>
                                                                            <input 
                                                                                type="date" 
                                                                                value={htmlFim}
                                                                                onChange={e => handleModalDateChange(r, 'fim', e.target.value)}
                                                                                className={`w-[115px] px-1.5 py-1 text-xs rounded border ${isModified ? 'border-indigo-300 bg-indigo-50 font-bold text-indigo-800' : 'border-slate-200 bg-white text-slate-700'} focus:ring-1 focus:ring-indigo-500 outline-none transition-colors shadow-sm`}
                                                                            />
                                                                            {draft && <span className="text-orange-500 font-bold ml-1" title="Alteração não salva">*</span>}
                                                                        </div>
                                                                        {occ && (
                                                                            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center justify-between shadow-sm cursor-help transition-all hover:brightness-95 mt-1 ${getOccupationColor(occ.taxa_ocupacao)}`} title={`Capacidade Diária: ${occ.capacidade_diaria} min | Já ocupado: ${occ.minutos_consumidos} min`}>
                                                                                <span>Carga: {occ.taxa_ocupacao > 999 ? '>999' : occ.taxa_ocupacao.toFixed(0)}%</span>
                                                                                <span className="opacity-75">{occ.minutos_consumidos}m / {occ.capacidade_diaria}m</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            )});
                                    })()}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t bg-slate-50 text-xs text-slate-500 flex justify-between rounded-b-xl">
                            <span>* Indica que as datas são um rascunho e ainda não foram salvas no banco.</span>
                            <span className="font-semibold">Total de Operações: {rawData.filter(r => r.op === structureModal).length}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
