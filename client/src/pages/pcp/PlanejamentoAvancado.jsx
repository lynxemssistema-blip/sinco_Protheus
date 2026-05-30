import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Search, GitMerge, ChevronRight, ChevronDown, Save, FastForward, Info, Play, AlertTriangle, PlayCircle, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import { getProductionDashboard, saveProductionPlanBatch, getPlanningPrefs } from '../../services/api';
import { toast } from 'react-toastify';

const formatDate = (d) => d.toISOString().substring(0, 10);

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
                // Expandir tudo por padrão
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

    // Agrupar dados: Pedido -> OP -> Operações
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
                    operacoesMap: new Map() // Agrupa por recurso
                });
            }

            const opNode = pedidoNode.ops.get(opKey);
            const recursoKey = op.recurso || op.operacao; // Usa recurso, fallback para operacao

            if (!opNode.operacoesMap.has(recursoKey)) {
                opNode.operacoesMap.set(recursoKey, {
                    recurso: recursoKey,
                    desc_recurso: op.desc_recurso || op.desc_operacao,
                    items: []
                });
            }
            opNode.operacoesMap.get(recursoKey).items.push(op);
        });

        // Ordenar e formatar operações agrupadas
        const result = Array.from(pedidosMap.values()).map(ped => {
            const opsArray = Array.from(ped.ops.values()).map(opNode => {
                
                const groupedOperacoes = Array.from(opNode.operacoesMap.values()).map(group => {
                    // Ordena itens internos pela sequencia
                    group.items.sort((a, b) => a.sequen.localeCompare(b.sequen));
                    
                    const seqs = Array.from(new Set(group.items.map(i => i.sequen))).join(', ');
                    const totalPlan = group.items.reduce((sum, i) => sum + (Number(i.qtd_planejada_op) || 0), 0);
                    const totalProd = group.items.reduce((sum, i) => sum + (Number(i.qtd_produzida_real) || 0), 0);
                    
                    return {
                        id: `${opNode.op}_${opNode.item_op}_${group.recurso}`,
                        recurso: group.recurso,
                        desc_recurso: group.desc_recurso,
                        sequen_display: seqs,
                        qtd_planejada_op: totalPlan,
                        qtd_produzida_real: totalProd,
                        items: group.items
                    };
                });

                // Ordena os grupos pela customOrder se existir, senao pela primeira sequência
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

        // Se estiver expandindo, busca as preferências salvas no banco para restaurar a ordem
        if (isExpanding) {
            const ped = treeData.find(p => p.id === id);
            if (ped) {
                for (const opNode of ped.ops) {
                    try {
                        const prefs = await getPlanningPrefs(opNode.op);
                        if (prefs && prefs.ordemRecursos) {
                            const parsed = typeof prefs.ordemRecursos === 'string' ? JSON.parse(prefs.ordemRecursos) : prefs.ordemRecursos;
                            // parsed = { "OP_123_01": ["MO0013", ...] }
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
            toast.warning('Preencha a data de in\u00EDcio e fim primeiro.');
            return;
        }
        
        let count = 0;
        setDraftPlans(prev => {
            const newDrafts = { ...prev };
            treeData.forEach(opNode => {
                opNode.operacoes.forEach(op => {
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
            return newDrafts;
        });
        toast.success(`Datas aplicadas para todas as ${count} opera\u00E7\u00F5es com o recurso ${groupedOp.recurso}.`);
    };

    // Aplica planejamento em cascata a partir de uma OP específica
    const confirmCascata = (modalState) => {
        const { opNode, baseDate, direction } = modalState;
        if (!baseDate) {
            toast.warning('Defina uma data base para a cascata.');
            return;
        }

        const newDrafts = { ...draftPlans };
        let currentDate = new Date(`${baseDate}T12:00:00`);

        if (direction === 'inicio') {
            opNode.operacoes.forEach((groupedOp) => {
                const dias = parseInt(diasPorOp[groupedOp.id], 10) || 1;
                const startStr = formatDate(currentDate);
                // For a 1-day task, it should end on the same day it starts.
                const endStr = formatDate(addBusinessDays(currentDate, Math.max(0, dias - 1)));
                
                groupedOp.items.forEach(oper => {
                    const key = `${oper.op}_${oper.item_op}_${oper.sequen}_${oper.operacao}`;
                    newDrafts[key] = { inicio: startStr, fim: endStr };
                });
                
                // Next operation starts on the next business day after the end of this operation
                currentDate = addBusinessDays(new Date(`${endStr}T12:00:00`), 1);
            });
        } else {
            // Regressão (A partir da Data de Entrega/Fim)
            const opsReversed = [...opNode.operacoes].reverse();
            opsReversed.forEach((groupedOp) => {
                const dias = parseInt(diasPorOp[groupedOp.id], 10) || 1;
                const endStr = formatDate(currentDate);
                // For a 1-day task, it starts on the same day it ends.
                const startStr = formatDate(subtractBusinessDays(currentDate, Math.max(0, dias - 1)));
                
                groupedOp.items.forEach(oper => {
                    const key = `${oper.op}_${oper.item_op}_${oper.sequen}_${oper.operacao}`;
                    newDrafts[key] = { inicio: startStr, fim: endStr };
                });
                
                // Next (previous in flow) operation ends on the business day before this one starts
                currentDate = subtractBusinessDays(new Date(`${startStr}T12:00:00`), 1);
            });
        }

        setDraftPlans(prev => ({ ...prev, ...newDrafts }));
        setCascataModal(null);
        toast.success(`Cascata calculada para ${opNode.op}!`);
    };

    const handleDiasChange = (groupedOp, value) => {
        const dias = parseInt(value, 10) || 1;
        setDiasPorOp(prev => ({ ...prev, [groupedOp.id]: dias }));

        // Atualiza a data de fim automaticamente se a data de início já estiver preenchida
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
            handleSearch(); // Recarregar
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
            
            // Limpa do draft apenas os itens desta OP
            const newDrafts = { ...draftPlans };
            Object.keys(newDrafts).forEach(key => {
                if (key.startsWith(opNode.op + '_')) delete newDrafts[key];
            });
            setDraftPlans(newDrafts);
            
            handleSearch(); // Recarrega os dados para mostrar o salvo
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
                                {/* Cabeçalho do Pedido */}
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

                                {/* OPs do Pedido */}
                                {expandedNodes[pedido.id] && (
                                    <div className="p-3 bg-slate-50 space-y-3 border-t border-slate-200">
                                        {pedido.ops.map(opNode => (
                                            <div key={opNode.id} className="border border-slate-200 bg-white rounded-lg overflow-hidden shadow-sm">
                                                <div 
                                                    className="bg-indigo-50 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-indigo-100 transition-colors border-b border-indigo-100"
                                                >
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
                                                        <div className="relative group flex gap-2">
                                                            <button 
                                                                className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors shadow-sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setCascataModal({ opNode, baseDate: new Date().toISOString().substring(0, 10), direction: 'inicio' });
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
                                                </div>

                                                {/* Operações da OP */}
                                                {expandedNodes[opNode.id] && (
                                                    <div className="p-0">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                                                <tr>
                                                                    <th className="px-2 py-2 w-8"></th>
                                                                    <th className="px-4 py-2 font-semibold w-16">Seq</th>
                                                                    <th className="px-4 py-2 font-semibold w-32">Recurso</th>
                                                                    <th className="px-4 py-2 font-semibold">Operação</th>
                                                                    <th className="px-4 py-2 font-semibold text-center w-24">Qtd</th>
                                                                    <th className="px-4 py-2 font-semibold text-center w-24" title="Dias para a Cascata Auto">Dias Prev.</th>
                                                                    <th className="px-4 py-2 font-semibold w-40">Início Previsto</th>
                                                                    <th className="px-4 py-2 font-semibold w-40">Fim Previsto</th>
                                                                    <th className="px-2 py-2 font-semibold w-12 text-center" title="Ações Rápidas">Ações</th>
                                                                    <th className="px-4 py-2 font-semibold w-32">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {opNode.operacoes.map((groupedOp, idx) => {
                                                                    // Usa o draft do primeiro item para exibir
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
                                                                                    <button disabled={idx === 0} onClick={(e) => handleMove(e, opNode, idx, -1)} className="text-slate-300 hover:text-indigo-600 disabled:opacity-20 transition-colors" title="Subir na fila"><ArrowUp className="w-3.5 h-3.5" /></button>
                                                                                    <button disabled={idx === opNode.operacoes.length - 1} onClick={(e) => handleMove(e, opNode, idx, 1)} className="text-slate-300 hover:text-indigo-600 disabled:opacity-20 transition-colors" title="Descer na fila"><ArrowDown className="w-3.5 h-3.5" /></button>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-2 font-mono text-xs font-bold text-slate-500">
                                                                                {groupedOp.sequen_display}
                                                                            </td>
                                                                            <td className="px-4 py-2 font-bold text-slate-700">
                                                                                {groupedOp.recurso}
                                                                                {groupedOp.items.length > 1 && (
                                                                                    <span className="ml-2 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full" title="Operações agrupadas">
                                                                                        {groupedOp.items.length} ops
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-xs text-slate-600 truncate max-w-[150px]" title={groupedOp.desc_recurso}>
                                                                                {groupedOp.desc_recurso}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-center text-xs font-medium text-slate-600">
                                                                                {qtdProduzida} / {qtdPlanejada}
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                <input 
                                                                                    type="number" 
                                                                                    min="1"
                                                                                    placeholder="1"
                                                                                    value={valDias}
                                                                                    onChange={e => handleDiasChange(groupedOp, e.target.value)}
                                                                                    className={`w-full px-2 py-1 text-center text-sm rounded border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors`}
                                                                                    disabled={isConcluido}
                                                                                />
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                <input 
                                                                                    type="date" 
                                                                                    value={valInicio}
                                                                                    onChange={e => handleDateChange(groupedOp, 'inicio', e.target.value)}
                                                                                    className={`w-full px-2 py-1 text-sm rounded border ${isModified ? 'border-indigo-300 bg-indigo-50 text-indigo-900 font-bold' : 'border-slate-200 bg-white text-slate-700'} focus:ring-2 focus:ring-indigo-500 outline-none transition-colors`}
                                                                                    disabled={isConcluido}
                                                                                />
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                <input 
                                                                                    type="date" 
                                                                                    value={valFim}
                                                                                    onChange={e => handleDateChange(groupedOp, 'fim', e.target.value)}
                                                                                    className={`w-full px-2 py-1 text-sm rounded border ${isModified ? 'border-indigo-300 bg-indigo-50 text-indigo-900 font-bold' : 'border-slate-200 bg-white text-slate-700'} focus:ring-2 focus:ring-indigo-500 outline-none transition-colors`}
                                                                                    disabled={isConcluido}
                                                                                />
                                                                            </td>
                                                                            <td className="px-2 py-2 text-center">
                                                                                <button 
                                                                                    onClick={() => applyDatesToAllIdentical(groupedOp, valInicio, valFim)}
                                                                                    disabled={isConcluido || !valInicio || !valFim}
                                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 transition-colors"
                                                                                    title="Aplicar estas datas a TODAS as operações idênticas nesta página"
                                                                                >
                                                                                    <Copy className="w-4 h-4" />
                                                                                </button>
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                {isConcluido ? (
                                                                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">CONCLUÍDO</span>
                                                                                ) : qtdProduzida > 0 ? (
                                                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">ANDAMENTO</span>
                                                                                ) : (
                                                                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">AGUARDANDO</span>
                                                                                )}
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

            {/* Modal de Cascata */}
            {cascataModal && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
                            <h3 className="font-bold text-indigo-900">Cascata Auto: OP {cascataModal.opNode.op}</h3>
                            <button onClick={() => setCascataModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Base do Planejamento</label>
                                <select 
                                    value={cascataModal.direction} 
                                    onChange={e => setCascataModal(prev => ({ ...prev, direction: e.target.value }))}
                                    className="w-full border border-slate-200 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="inicio">A partir da Data de Início</option>
                                    <option value="fim">A partir da Data de Entrega (Retroativo)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    {cascataModal.direction === 'inicio' ? 'Data de Início da OP' : 'Data de Entrega da OP'}
                                </label>
                                <input 
                                    type="date" 
                                    value={cascataModal.baseDate}
                                    onChange={e => setCascataModal(prev => ({ ...prev, baseDate: e.target.value }))}
                                    className="w-full border border-slate-200 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button onClick={() => setCascataModal(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded">Cancelar</button>
                            <button onClick={() => confirmCascata(cascataModal)} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded">Calcular</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
