import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Save, CheckSquare, Square, ChevronDown, ChevronRight, AlertTriangle, Clock } from 'lucide-react';

export default function ProductionMacroModal({ op, operations, onClose, onSaveBatch }) {

    const [operationPlans, setOperationPlans] = useState({}); // { operacao: { start: '', end: '', selected: true, duracao: 0 } }
    const [expandedOps, setExpandedOps] = useState({});
    const [loading, setLoading] = useState(false);
    const [targetEndDate, setTargetEndDate] = useState('');

    // Group operations by operation code
    const groupedByOperation = useMemo(() => {
        const groups = {};
        operations.forEach(o => {
            // Skip operations without a valid operation code
            if (!o.operacao) return;

            if (!groups[o.operacao]) {
                groups[o.operacao] = {
                    code: o.operacao,
                    desc: o.desc_operacao || '',
                    items: [],
                    min_sequen: 999999
                };
            }
            groups[o.operacao].items.push(o);
            const seq = Number(o.sequen) || 999999;
            if (seq < groups[o.operacao].min_sequen) {
                groups[o.operacao].min_sequen = seq;
            }
        });
        return Object.values(groups).sort((a, b) => a.min_sequen - b.min_sequen);
    }, [operations]);

    // Initialize state for each operation
    useEffect(() => {
        const initialPlans = {};
        const initialExpanded = {};
        let maxEndDate = '';

        groupedByOperation.forEach(group => {
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

        if (maxEndDate) {
            setTargetEndDate(maxEndDate);
        }
    }, [groupedByOperation]);

    const calculateBackward = (endDate, currentPlans) => {
        if (!endDate) return currentPlans;

        const newPlans = { ...currentPlans };

        // Reverse sorted codes (from last to first)
        const sortedCodesDesc = [...groupedByOperation]
            .sort((a, b) => b.min_sequen - a.min_sequen)
            .map(g => g.code);

        let lastStart = new Date(endDate);

        sortedCodesDesc.forEach(code => {
            const plan = newPlans[code];
            if (plan.selected) {
                const dur = parseInt(plan.duracao) || 0;
                const currentEnd = new Date(lastStart);
                const currentStart = new Date(currentEnd);
                currentStart.setDate(currentEnd.getDate() - dur);

                plan.start = currentStart.toISOString().split('T')[0];
                plan.end = currentEnd.toISOString().split('T')[0];

                lastStart = new Date(currentStart);
            }
        });

        return newPlans;
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
        const val = parseInt(value) || 0;
        setOperationPlans(prev => {
            const updated = {
                ...prev,
                [code]: { ...prev[code], duracao: val }
            };
            return targetEndDate ? calculateBackward(targetEndDate, updated) : updated;
        });
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

            // For each selected operation, create plans for all its items
            Object.entries(operationPlans).forEach(([code, plan]) => {
                if (plan.selected && plan.start && plan.end) {
                    const group = groupedByOperation.find(g => g.code === code);
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
            console.log('First 3 plans:', plansToSave.slice(0, 3));
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

            console.log(`📦 Splitting into ${chunks.length} chunks of max ${CHUNK_SIZE} records`);

            // Send chunks sequentially
            for (let i = 0; i < chunks.length; i++) {
                console.log(`🚀 Sending chunk ${i + 1}/${chunks.length} (${chunks[i].length} records)...`);
                await onSaveBatch(chunks[i]);
                console.log(`✅ Chunk ${i + 1}/${chunks.length} saved successfully`);
            }

            console.log('✅ All chunks completed successfully');
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
            const group = groupedByOperation.find(g => g.code === code);
            return sum + (group?.items.length || 0);
        }, 0);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-slate-600" />
                                Planejamento por Operação
                            </h2>
                            <p className="text-sm text-slate-500">
                                OP: <span className="font-mono font-bold text-slate-700">{op.op}</span> - {op.nome_cliente}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                                Defina datas para cada tipo de operação. Todas as ocorrências receberão as mesmas datas.
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* Header and Controls */}
                <div className="p-4 bg-slate-50 border-b space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-slate-600">
                            <span className="font-bold text-slate-800">{selectedCount}</span> de {groupedByOperation.length} operações selecionadas
                            {totalOpsToSave > 0 && <span className="ml-2 text-xs">({totalOpsToSave} registros serão salvos)</span>}
                        </div>
                        <button
                            onClick={toggleSelectAll}
                            className="text-xs font-bold text-slate-700 hover:text-slate-900 hover:underline"
                        >
                            {Object.values(operationPlans).every(p => p.selected) ? 'Desmarcar Todas' : 'Selecionar Todas'}
                        </button>
                    </div>

                    {/* Planejamento Inteligente Input */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Data de Entrega / Finalização OP
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="w-full pl-10 pr-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium transition-all shadow-sm"
                                    value={targetEndDate}
                                    onChange={(e) => handleTargetDateChange(e.target.value)}
                                />
                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-blue-400" />
                            </div>
                            <p className="mt-1 text-[10px] text-slate-400">Define o prazo final para o cálculo retroativo.</p>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100/50 h-fit self-end">
                            <AlertTriangle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                            <p className="text-[11px] text-blue-700 leading-tight">
                                As datas são calculadas de trás para frente. <br />
                                Ajuste os dias de cada etapa abaixo para recalcular.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Operations List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {groupedByOperation.map(group => {
                        const plan = operationPlans[group.code] || { start: '', end: '', selected: false };
                        const isExpanded = expandedOps[group.code];
                        const hasValidDates = plan.start && plan.end;

                        return (
                            <div
                                key={group.code}
                                className={`border rounded-lg overflow-hidden transition-all ${plan.selected ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'
                                    }`}
                            >
                                {/* Operation Header */}
                                <div className="p-3 bg-white">
                                    <div className="flex items-start gap-3">
                                        {/* Checkbox */}
                                        <div
                                            className="mt-1 cursor-pointer"
                                            onClick={() => toggleOperation(group.code)}
                                        >
                                            {plan.selected ?
                                                <CheckSquare className="w-5 h-5 text-slate-700" /> :
                                                <Square className="w-5 h-5 text-slate-300" />
                                            }
                                        </div>

                                        {/* Operation Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-mono font-bold text-lg text-slate-800">{group.code}</span>
                                                <span className="text-slate-600">{group.desc}</span>
                                                <button
                                                    onClick={() => toggleExpand(group.code)}
                                                    className="ml-auto text-xs text-slate-600 hover:text-slate-800 flex items-center gap-1 hover:underline"
                                                >
                                                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                    {group.items.length} ocorrência{group.items.length > 1 ? 's' : ''}
                                                </button>
                                            </div>

                                            {/* Date Inputs */}
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        <Clock className="w-3 h-3 inline mr-1" />
                                                        Dias
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="w-full border border-slate-200 rounded p-2 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                                                        value={plan.duracao}
                                                        onChange={e => updateOperationDuration(group.code, e.target.value)}
                                                        disabled={!plan.selected}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        <Calendar className="w-3 h-3 inline mr-1" />
                                                        Data Início
                                                    </label>
                                                    <input
                                                        type="date"
                                                        className="w-full border border-slate-200 rounded p-2 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                                                        value={plan.start ? plan.start.split('T')[0] : ''}
                                                        onChange={e => updateOperationDates(group.code, 'start', e.target.value)}
                                                        disabled={!plan.selected}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        <Calendar className="w-3 h-3 inline mr-1" />
                                                        Data Fim
                                                    </label>
                                                    <input
                                                        type="date"
                                                        className="w-full border border-slate-200 rounded p-2 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                                                        value={plan.end ? plan.end.split('T')[0] : ''}
                                                        onChange={e => updateOperationDates(group.code, 'end', e.target.value)}
                                                        disabled={!plan.selected}
                                                    />
                                                </div>
                                            </div>

                                            {plan.selected && !hasValidDates && (
                                                <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                                                    ⚠️ Defina ambas as datas para incluir esta operação
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Items */}
                                {isExpanded && (
                                    <div className="border-t border-slate-200 bg-slate-50">
                                        <div className="p-3">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Itens afetados:</h4>
                                            <div className="space-y-1">
                                                {group.items.map((item, idx) => (
                                                    <div key={idx} className="text-xs bg-white p-2 rounded border border-slate-100 flex justify-between">
                                                        <span>
                                                            <span className="font-mono font-bold text-slate-700">
                                                                Item {item.item_op}/{item.sequen}
                                                            </span>
                                                            <span className="text-slate-500 ml-2">{item.cod_produto_op}</span>
                                                        </span>
                                                        {item.data_planejada_inicio && (
                                                            <span className="text-green-600 font-medium">✓ Já planejado</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="text-sm text-slate-600">
                        {totalOpsToSave > 0 ? (
                            <span className="text-green-600 font-medium">
                                ✓ Pronto para salvar {totalOpsToSave} operação{totalOpsToSave > 1 ? 'ões' : ''}
                            </span>
                        ) : (
                            <span className="text-amber-600">
                                Selecione operações e defina datas
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || totalOpsToSave === 0}
                            className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {loading ? 'Salvando...' : (
                                <>
                                    <Save className="w-4 h-4" /> Aplicar Planejamento
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
