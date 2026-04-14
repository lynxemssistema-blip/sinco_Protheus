import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Save, CheckSquare, Square, ChevronDown, ChevronRight, AlertTriangle, Clock, ArrowUp, ArrowDown, Link, Link2Off, Globe, Briefcase, Plus, Minus } from 'lucide-react';

export default function ProductionMacroModal({ op, operations, onClose, onSaveBatch }) {

    const [operationPlans, setOperationPlans] = useState({}); // Agora guarda por Recurso: { 'MO0013': { start: '', end: '', selected: true, duracao: 0 } }
    const [expandedOps, setExpandedOps] = useState({});
    const [loading, setLoading] = useState(false);
    const [targetEndDate, setTargetEndDate] = useState('');
    const [orderedGroups, setOrderedGroups] = useState([]);
    const [joinedIndices, setJoinedIndices] = useState(new Set()); 
    const [daysMode, setDaysMode] = useState('calendar'); // 'calendar' ou 'business'

    // ✅ MUDANÇA 1: Agrupa pelo RECURSO da máquina em vez do Sequencial
    const groupedByRecurso = useMemo(() => {
        const groups = {};
        operations.forEach(o => {
            // Se não tiver recurso definido no banco, usa a operação como fallback para não perder a linha
            const recursoCode = (o.recurso && o.recurso.trim() !== '') ? o.recurso.trim() : (o.operacao ? `OP-${o.operacao}` : 'S/R');

            if (!groups[recursoCode]) {
                groups[recursoCode] = {
                    code: recursoCode,
                    desc: o.desc_operacao || '',
                    items: [],
                    min_sequen: 999999
                };
            }
            groups[recursoCode].items.push(o);
            
            const seq = Number(o.sequen) || 999999;
            if (seq < groups[recursoCode].min_sequen) {
                groups[recursoCode].min_sequen = seq;
            }
        });
        
        // Junta descrições caso o mesmo recurso faça tarefas diferentes na mesma OP
        Object.values(groups).forEach(g => {
            const descricoes = Array.from(new Set(g.items.map(i => i.desc_operacao).filter(Boolean)));
            g.desc = descricoes.join(' + ') || 'Sem descrição';
        });

        // Ordena de acordo com o fluxo cronológico original onde a máquina entra pela 1ª vez
        return Object.values(groups).sort((a, b) => a.min_sequen - b.min_sequen);
    }, [operations]);

    // Initialize state for each grouped operation
    useEffect(() => {
        const initialPlans = {};
        const initialExpanded = {};
        let maxEndDate = '';

        groupedByRecurso.forEach(group => {
            let existingStart = '';
            let existingEnd = '';
            let dur = 0;

            const plannedItem = group.items.find(i => i.data_planejada_inicio && i.data_planejada_fim);
            if (plannedItem) {
                existingStart = new Date(plannedItem.data_planejada_inicio).toISOString().split('T')[0];
                existingEnd = new Date(plannedItem.data_planejada_fim).toISOString().split('T')[0];
                const s = new Date(existingStart);
                const e = new Date(existingEnd);
                dur = Math.max(0, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));

                if (existingEnd > maxEndDate) maxEndDate = existingEnd;
            }

            initialPlans[group.code] = {
                start: existingStart,
                end: existingEnd,
                duracao: dur,
                selected: true
            };
            initialExpanded[group.code] = false;
        });

        setOperationPlans(initialPlans);
        setExpandedOps(initialExpanded);
        setOrderedGroups(groupedByRecurso);

        if (maxEndDate) {
            setTargetEndDate(maxEndDate);
        }
    }, [groupedByRecurso]);

    const subtractDays = (date, days, mode) => {
        const result = new Date(date);
        let count = 0;
        while (count < days) {
            result.setDate(result.getDate() - 1);
            if (mode === 'business') {
                const day = result.getDay();
                if (day !== 0 && day !== 6) { // Ignora Sábado (6) e Domingo (0)
                    count++;
                }
            } else {
                count++;
            }
        }
        return result;
    };

    const calculateBackward = (endDate, currentPlans) => {
        if (!endDate) return currentPlans;

        const newPlans = { ...currentPlans };

        // Processamos de trás para frente.
        const reversedIndices = [...Array(orderedGroups.length).keys()].reverse();
        
        let currentDate = new Date(endDate);
        let i = 0;

        while (i < reversedIndices.length) {
            const idx = reversedIndices[i];
            const group = orderedGroups[idx];
            
            // Identifica o bloco de operações juntas
            const blockIndices = [idx];
            let lookAhead = i + 1;
            while (lookAhead < reversedIndices.length && joinedIndices.has(reversedIndices[lookAhead - 1])) {
                blockIndices.push(reversedIndices[lookAhead]);
                lookAhead++;
            }

            // O fim do bloco é a currentDate atual
            const blockEndDate = new Date(currentDate);
            let maxDur = 0;

            blockIndices.forEach(bIdx => {
                const g = orderedGroups[bIdx];
                const plan = newPlans[g.code];
                if (plan && plan.selected) {
                    maxDur = Math.max(maxDur, parseInt(plan.duracao) || 0);
                }
            });

            // O início do bloco
            const blockStartDate = subtractDays(blockEndDate, maxDur, daysMode);

            // Aplica as datas para todos no bloco
            blockIndices.forEach(bIdx => {
                const g = orderedGroups[bIdx];
                const plan = newPlans[g.code];
                if (plan && plan.selected) {
                    plan.start = blockStartDate.toISOString().split('T')[0];
                    plan.end = blockEndDate.toISOString().split('T')[0];
                }
            });

            // O próximo bloco começa no início deste bloco
            currentDate = new Date(blockStartDate);
            
            // Pula os índices processados no bloco
            i = lookAhead;
        }

        return newPlans;
    };

    const moveGroup = (index, direction) => {
        const newGroups = [...orderedGroups];
        const targetIndex = index + direction;
        
        if (targetIndex < 0 || targetIndex >= newGroups.length) return;
        
        // Swap
        [newGroups[index], newGroups[targetIndex]] = [newGroups[targetIndex], newGroups[index]];
        
        setOrderedGroups(newGroups);
        
        // Recalculate if we have a target date
        if (targetEndDate) {
            setOperationPlans(prev => calculateBackward(targetEndDate, prev));
        }
    };

    const toggleJoin = (index) => {
        const newJoined = new Set(joinedIndices);
        if (newJoined.has(index)) {
            newJoined.delete(index);
        } else {
            newJoined.add(index);
        }
        setJoinedIndices(newJoined);
        if (targetEndDate) {
            setOperationPlans(prev => calculateBackward(targetEndDate, prev));
        }
    };

    const toggleDaysMode = (mode) => {
        setDaysMode(mode);
        if (targetEndDate) {
            setOperationPlans(prev => calculateBackward(targetEndDate, prev));
        }
    };

    const handleTargetDateChange = (val) => {
        setTargetEndDate(val);
        if (val) {
            setOperationPlans(prev => calculateBackward(val, prev));
        }
    };

    const toggleOperation = (code) => {
        setOperationPlans(prev => {
            const updated = {
                ...prev,
                [code]: {
                    ...prev[code],
                    selected: !prev[code]?.selected
                }
            };
            return targetEndDate ? calculateBackward(targetEndDate, updated) : updated;
        });
    };

    const toggleExpand = (code) => {
        setExpandedOps(prev => ({
            ...prev,
            [code]: !prev[code]
        }));
    };

    const updateOperationDates = (code, field, value) => {
        setOperationPlans(prev => ({
            ...prev,
            [code]: {
                ...prev[code],
                [field]: value
            }
        }));
    };

    const updateOperationDuration = (code, value) => {
        const val = Math.max(0, parseInt(value) || 0);
        setOperationPlans(prev => {
            const updated = {
                ...prev,
                [code]: { ...prev[code], duracao: val }
            };
            return targetEndDate ? calculateBackward(targetEndDate, updated) : updated;
        });
    };

    const adjustDuration = (code, delta) => {
        const currentDur = parseInt(operationPlans[code]?.duracao) || 0;
        updateOperationDuration(code, currentDur + delta);
    };

    const toggleSelectAll = () => {
        const allSelected = Object.values(operationPlans).every(p => p.selected);
        const newPlans = {};
        Object.keys(operationPlans).forEach(code => {
            newPlans[code] = {
                ...operationPlans[code],
                selected: !allSelected
            };
        });
        setOperationPlans(newPlans);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const plansToSave = [];

            // A lógica aqui continua injetando op_numero, op_item e operacao_codigo originais, 
            // então a API e o ERP continuarão processando os dados corretamente sem quebrar nada.
            Object.entries(operationPlans).forEach(([code, plan]) => {
                if (plan.selected && plan.start && plan.end) {
                    const group = orderedGroups.find(g => g.code === code);
                    if (group) {
                        group.items.forEach(item => {
                            plansToSave.push({
                                op_numero: item.op,
                                op_item: item.item_op,
                                op_sequencia: item.sequen,
                                operacao_codigo: item.operacao,
                                data_inicio: plan.start.includes('T') ? plan.start : `${plan.start} 00:00:00`,
                                data_fim: plan.end.includes('T') ? plan.end : `${plan.end} 23:59:59`
                            });
                        });
                    }
                }
            });

            console.log('=========== FRONTEND: SAVING BATCH PLANS ===========');
            console.log('Total plans to save:', plansToSave.length);
            console.log('====================================================');

            if (plansToSave.length === 0) {
                alert('Nenhuma operação selecionada com datas definidas.');
                setLoading(false);
                return;
            }

            // Split into chunks to avoid payload size issues
            const CHUNK_SIZE = 100;
            const chunks = [];
            for (let i = 0; i < plansToSave.length; i += CHUNK_SIZE) {
                chunks.push(plansToSave.slice(i, i + CHUNK_SIZE));
            }

            // Send chunks sequentially
            for (let i = 0; i < chunks.length; i++) {
                await onSaveBatch(chunks[i]);
            }

            alert(`✅ ${plansToSave.length} operações salvas com sucesso!`);
            onClose();
        } catch (error) {
            console.error('❌ Erro em handleSave:', error);
            alert(`Erro ao salvar planejamento em lote: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    };

    const selectedCount = Object.values(operationPlans).filter(p => p.selected).length;
    const totalOpsToSave = Object.entries(operationPlans)
        .filter(([code, plan]) => plan.selected && plan.start && plan.end)
        .reduce((sum, [code]) => {
            const group = orderedGroups.find(g => g.code === code);
            return sum + (group?.items.length || 0);
        }, 0);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]">

                {/* Header */}
                <div className="p-2 border-b border-slate-100 bg-slate-50">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-slate-600" />
                                Planejamento Automático por Recurso
                            </h2>
                            <p className="text-[10px] text-slate-500">
                                OP: <span className="font-mono font-bold text-slate-700">{op.op}</span> - {op.nome_cliente}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-white/50 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Header and Controls */}
                <div className="p-2 bg-slate-50 border-b space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                        <div className="text-slate-600">
                            <span className="font-bold text-slate-800">{selectedCount}</span> de {orderedGroups.length} recursos selecionados
                        </div>
                        <button
                            onClick={toggleSelectAll}
                            className="font-bold text-slate-500 hover:text-slate-900 hover:underline"
                        >
                            {Object.values(operationPlans).every(p => p.selected) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </button>
                    </div>

                    {/* Planejamento Inteligente Input */}
                    <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm items-center">
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                                Data de Entrega OP
                            </label>
                            <div className="relative group/date">
                                <input
                                    type="date"
                                    className="w-full pl-7 pr-2 py-1 border border-blue-100 rounded bg-blue-50/10 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-[11px] font-bold text-blue-900 transition-all shadow-sm"
                                    value={targetEndDate}
                                    onChange={(e) => handleTargetDateChange(e.target.value)}
                                />
                                <Calendar className="absolute left-2 top-1.5 h-3 w-3 text-blue-500 group-focus-within/date:scale-110 transition-transform" />
                            </div>
                        </div>

                        {/* Mode Selector */}
                        <div className="flex bg-slate-100 p-0.5 rounded">
                            <button
                                onClick={() => toggleDaysMode('calendar')}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-all ${
                                    daysMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <Globe className="w-3 h-3" /> DIAS CORRIDOS
                            </button>
                            <button
                                onClick={() => toggleDaysMode('business')}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-all ${
                                    daysMode === 'business' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <Briefcase className="w-3 h-3" /> DIAS ÚTEIS
                            </button>
                        </div>
                    </div>
                </div>

                {/* Operations List Grouped by Resource */}
                <div className="flex-1 overflow-y-auto p-3">
                    {orderedGroups.map((group, index) => {
                        const plan = operationPlans[group.code] || { start: '', end: '', selected: false };
                        const isExpanded = expandedOps[group.code];
                        const isJoined = joinedIndices.has(index);
                        const isNextJoined = index + 1 < orderedGroups.length && joinedIndices.has(index + 1);

                        return (
                            <React.Fragment key={group.code}>
                                {/* Join Indicator - Integrated */}
                                {index > 0 && (
                                    <div className="relative h-0 flex justify-center z-20">
                                        <button 
                                            onClick={() => toggleJoin(index)}
                                            className={`absolute -top-2.5 p-0.5 rounded-full border transition-all shadow-sm ${
                                                isJoined 
                                                ? 'bg-blue-600 border-blue-600 text-white rotate-90 scale-90' 
                                                : 'bg-white border-slate-200 text-slate-400 hover:text-blue-500 hover:border-blue-200 scale-75'
                                            }`}
                                            title={isJoined ? "Desagrupar" : "Juntar"}
                                        >
                                            <Link className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                )}

                                <div
                                    className={`relative border transition-all duration-300 flex group/item hover:shadow-md ${
                                        isJoined ? 'mt-0 border-t-0 rounded-t-none' : 'mt-1.5 rounded-t-lg shadow-sm'
                                    } ${
                                        isNextJoined ? 'border-b-0 rounded-b-none' : 'rounded-b-lg shadow-sm'
                                    } ${plan.selected ? 'border-blue-300 bg-slate-50' : 'border-slate-100 bg-white'} ${isJoined || isNextJoined ? 'bg-blue-50/5' : ''}`}
                                >
                                    {/* Visual Grouping Accent */}
                                    {isJoined && (
                                        <div className="w-1 bg-blue-500 self-stretch flex-shrink-0" />
                                    )}

                                    <div className="flex-1">
                                        <div className={`p-1.5 border-b border-transparent ${plan.selected ? 'bg-blue-50/20' : ''}`}>
                                            <div className="flex items-start gap-2.5">
                                                {/* Move Controls */}
                                                <div className="flex flex-col gap-0 mt-0.5 opacity-40 group-hover/item:opacity-100 transition-opacity">
                                                    <button 
                                                        disabled={index === 0}
                                                        onClick={() => moveGroup(index, -1)}
                                                        className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-0"
                                                    >
                                                        <ArrowUp className="w-3 h-3 text-slate-500" />
                                                    </button>
                                                    <button 
                                                        disabled={index === orderedGroups.length - 1}
                                                        onClick={() => moveGroup(index, 1)}
                                                        className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-0"
                                                    >
                                                        <ArrowDown className="w-3 h-3 text-slate-500" />
                                                    </button>
                                                </div>

                                                {/* Checkbox */}
                                                <div
                                                    className="mt-1 cursor-pointer hover:scale-110 transition-transform active:scale-95 px-0.5"
                                                    onClick={() => toggleOperation(group.code)}
                                                >
                                                    {plan.selected ?
                                                        <CheckSquare className="w-3.5 h-3.5 text-blue-600 drop-shadow-[0_1px_2px_rgba(37,99,235,0.2)]" /> :
                                                        <Square className="w-3.5 h-3.5 text-slate-300" />
                                                    }
                                                </div>

                                                {/* ✅ MUDANÇA 2: Design da Etiqueta "MO0013" */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                        <span className="font-mono font-bold text-[11px] text-blue-900 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded shadow-sm text-center min-w-[65px]" title={group.code}>
                                                            {group.code}
                                                        </span>
                                                        <span className="text-slate-600 text-[10px] font-medium truncate max-w-[200px]" title={group.desc}>
                                                            {group.desc}
                                                        </span>
                                                        <button
                                                            onClick={() => toggleExpand(group.code)}
                                                            className="ml-auto text-[9px] text-slate-500 hover:text-slate-800 bg-slate-200/50 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1"
                                                        >
                                                            {group.items.length} {group.items.length > 1 ? 'operações' : 'operação'}
                                                            {isExpanded ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <div className="flex items-center gap-0.5 bg-slate-100/80 px-1 py-0.5 rounded border border-slate-200 shadow-inner">
                                                            <span className="text-[7px] font-bold text-slate-500 uppercase px-0.5">Dias</span>
                                                            <button 
                                                                onClick={() => adjustDuration(group.code, -1)}
                                                                disabled={!plan.selected || plan.duracao <= 0}
                                                                className="p-0.5 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-30"
                                                            >
                                                                <Minus className="w-2.5 h-2.5" />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                className="w-7 bg-transparent text-xs font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                value={plan.duracao}
                                                                onChange={e => updateOperationDuration(group.code, e.target.value)}
                                                                disabled={!plan.selected}
                                                            />
                                                            <button 
                                                                onClick={() => adjustDuration(group.code, 1)}
                                                                disabled={!plan.selected}
                                                                className="p-0.5 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-30"
                                                            >
                                                                <Plus className="w-2.5 h-2.5" />
                                                            </button>
                                                        </div>
                                                        
                                                        <div className="flex-1 grid grid-cols-2 gap-1.5">
                                                            <div className="relative">
                                                                <input
                                                                    type="date"
                                                                    className="w-full border border-slate-100 rounded px-1.5 py-0.5 text-[10px] focus:ring-1 focus:ring-blue-500 outline-none"
                                                                    value={plan.start ? plan.start.split('T')[0] : ''}
                                                                    onChange={e => updateOperationDates(group.code, 'start', e.target.value)}
                                                                    disabled={!plan.selected}
                                                                />
                                                                <span className="absolute -top-2 left-1 bg-white px-0.5 text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Início</span>
                                                            </div>
                                                            <div className="relative">
                                                                <input
                                                                    type="date"
                                                                    className="w-full border border-slate-100 rounded px-1.5 py-0.5 text-[10px] focus:ring-1 focus:ring-blue-500 outline-none"
                                                                    value={plan.end ? plan.end.split('T')[0] : ''}
                                                                    onChange={e => updateOperationDates(group.code, 'end', e.target.value)}
                                                                    disabled={!plan.selected}
                                                                />
                                                                <span className="absolute -top-2 left-1 bg-white px-0.5 text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Fim</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ✅ MUDANÇA 3: Adicionado "Op XX" na gaveta de itens agrupados para rastreabilidade */}
                                        {isExpanded && (
                                            <div className="bg-blue-50/30 p-1.5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                                {group.items.map((item, idx) => (
                                                    <div key={idx} className="text-[9px] bg-white border border-blue-100/50 p-1 px-1.5 rounded flex justify-between items-center shadow-xs">
                                                        <span className="truncate text-slate-600 font-medium" title={item.desc_operacao}>
                                                            <strong className="text-slate-800">Op {item.operacao}</strong> - {item.item_op}/{item.sequen}
                                                        </span>
                                                        {item.data_planejada_inicio && <span className="text-blue-500 font-bold text-[10px] leading-none">●</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="p-2 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="text-[10px]">
                        {totalOpsToSave > 0 ? (
                            <span className="text-green-600 font-bold uppercase tracking-tight">
                                ✓ {totalOpsToSave} registros atrelados
                            </span>
                        ) : (
                            <span className="text-slate-400 italic">Selecione recursos</span>
                        )}
                    </div>
                    <div className="flex gap-1.5">
                        <button
                            onClick={onClose}
                            className="px-2.5 py-1 text-slate-500 hover:bg-slate-200 rounded text-[10px] font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || totalOpsToSave === 0}
                            className="px-3.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-[10px] font-bold transition-colors flex items-center gap-1 disabled:opacity-50 shadow-sm"
                        >
                            {loading ? 'Salvando...' : (
                                <>
                                    <Save className="w-3 h-3" /> Aplicar Planejamento
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}