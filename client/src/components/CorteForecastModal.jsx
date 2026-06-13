import React, { useState, useEffect } from 'react';
import { X, Scissors, Save, Loader2, Package, ChevronDown, ChevronRight, Search, CheckSquare, Square, Info, Layers, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'react-toastify';

const CorteForecastModal = ({ isOpen, onClose, items, onSaveSuccess, usuario }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [explodedData, setExplodedData] = useState([]);
    const [selectedOps, setSelectedOps] = useState(new Set());
    const [observation, setObservation] = useState('');
    const [activeResourceTab, setActiveResourceTab] = useState('');
    const [collapsedMats, setCollapsedMats] = useState(new Set());
    const [filterText, setFilterText] = useState('');

    useEffect(() => {
        if (isOpen && items && items.length > 0) {
            loadExplosion();
        } else {
            setExplodedData([]);
            setSelectedOps(new Set());
            setActiveResourceTab('');
            setCollapsedMats(new Set());
            setFilterText('');
        }
    }, [isOpen, items]);

    useEffect(() => {
        if (explodedData.length > 0 && !activeResourceTab) {
            const resources = [...new Set(explodedData.map(i => i.recurso_nome))];
            if (resources.length > 0) {
                setActiveResourceTab(resources[0]);
            }
        }
    }, [explodedData, activeResourceTab]);

    const loadExplosion = async () => {
        setLoading(true);
        try {
            const payload = items.map(t => ({
                pedido: t.pedido,
                item: t.item,
                codigo: t.codigo,
                quantidade: t.quantidade || t.qtd_faturar || 0
            }));

            const res = await api.post('/corte/explosao', { items: payload });
            const newExploded = res.data.items || [];
            setExplodedData(newExploded);

            // Apenas pré-selecionar OPs que não foram loteadas ainda
            const initialSelected = new Set(
                newExploded.filter(i => !i.already_loted).map(i => i.op_numero)
            );
            setSelectedOps(initialSelected);

            // Colapsar todos os grupos de materiais por padrão
            const initialCollapsed = new Set();
            newExploded.forEach(item => {
                const matKey = `${item.recurso_nome}|${item.mtc_codigo} - ${item.mtc_descricao}`;
                initialCollapsed.add(matKey);
            });
            setCollapsedMats(initialCollapsed);
        } catch (err) {
            console.error('Erro na explosão:', err);
            toast.error('Falha ao processar a estrutura dos produtos.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const filteredData = explodedData.filter(i => selectedOps.has(i.op_numero));
        
        if (filteredData.length === 0) {
            toast.warning('Nenhum item válido para corte foi selecionado.');
            return;
        }

        setSaving(true);
        try {
            // Agrupar itens por recurso e por material (MTC) para formar os lotes
            const groupedLotes = {};
            filteredData.forEach(item => {
                const key = `${item.recurso}|${item.mtc_codigo}`;
                if (!groupedLotes[key]) {
                    groupedLotes[key] = {
                        recurso: item.recurso,
                        material_codigo: item.mtc_codigo,
                        material_descricao: item.mtc_descricao,
                        observacao: observation,
                        items: []
                    };
                }
                groupedLotes[key].items.push(item);
            });

            const lotesArray = Object.values(groupedLotes);

            const res = await api.post('/corte/lotes', { lotes: lotesArray, usuario });
            if (res.data?.success) {
                toast.success(res.data.message || 'Lotes de Corte gerados com sucesso!');
                if (onSaveSuccess) onSaveSuccess();
                onClose();
            }
        } catch (err) {
            console.error('Erro ao salvar lotes:', err);
            toast.error('Erro ao gravar os lotes de corte.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    // Filter explodedData based on search input
    const filteredExplodedData = explodedData.filter(item => {
        if (!filterText.trim()) return true;
        const search = filterText.toLowerCase();
        return (
            item.componente.toLowerCase().includes(search) ||
            item.componente_descricao.toLowerCase().includes(search) ||
            item.mtc_codigo.toLowerCase().includes(search) ||
            item.mtc_descricao.toLowerCase().includes(search)
        );
    });

    // Processar para renderização (agrupar por Recurso -> Material -> Componente)
    const renderGroups = {};
    filteredExplodedData.forEach(item => {
        if (!renderGroups[item.recurso_nome]) renderGroups[item.recurso_nome] = {};
        const matKey = `${item.mtc_codigo} - ${item.mtc_descricao}`;
        if (!renderGroups[item.recurso_nome][matKey]) renderGroups[item.recurso_nome][matKey] = {};
        
        if (!renderGroups[item.recurso_nome][matKey][item.componente]) {
            renderGroups[item.recurso_nome][matKey][item.componente] = {
                descricao: item.componente_descricao,
                qtd_total: 0,
                origens: [],
                ops: [],
                mtc_codigo: item.mtc_codigo,
                mtc_descricao: item.mtc_descricao
            };
        }
        
        renderGroups[item.recurso_nome][matKey][item.componente].qtd_total += parseFloat(item.qtd_necessaria);
        renderGroups[item.recurso_nome][matKey][item.componente].origens.push(`${item.pedido_pai} (Item ${item.item_pai})`);
        renderGroups[item.recurso_nome][matKey][item.componente].ops.push(item.op_numero);
    });

    // List of unique resources available
    const availableResources = [...new Set(explodedData.map(i => i.recurso_nome))];

    // Compute stats based on active selection (overall)
    const selectedLotes = {};
    let selectedPiecesCount = 0;
    const affectedOrders = new Set();

    explodedData.forEach(item => {
        if (selectedOps.has(item.op_numero)) {
            const key = `${item.recurso}|${item.mtc_codigo}`;
            selectedLotes[key] = true;
            selectedPiecesCount += parseFloat(item.qtd_necessaria);
            affectedOrders.add(item.pedido_pai);
        }
    });

    const selectedLotesCount = Object.keys(selectedLotes).length;
    const affectedOrdersCount = affectedOrders.size;

    const toggleMatCollapse = (matKey) => {
        const next = new Set(collapsedMats);
        if (next.has(matKey)) {
            next.delete(matKey);
        } else {
            next.add(matKey);
        }
        setCollapsedMats(next);
    };

    const handleSelectAllResource = (resource) => {
        const opsToSelect = explodedData
            .filter(i => i.recurso_nome === resource && !i.already_loted)
            .map(i => i.op_numero);
        
        const newSelected = new Set(selectedOps);
        opsToSelect.forEach(op => newSelected.add(op));
        setSelectedOps(newSelected);
    };

    const handleDeselectAllResource = (resource) => {
        const opsToRemove = explodedData
            .filter(i => i.recurso_nome === resource)
            .map(i => i.op_numero);
        
        const newSelected = new Set(selectedOps);
        opsToRemove.forEach(op => newSelected.delete(op));
        setSelectedOps(newSelected);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header - Technical Dark Theme */}
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <Scissors className="h-5 w-5 text-slate-400" />
                        <div>
                            <h2 className="text-md font-bold font-mono tracking-tight uppercase">Explosão & Geração de Lotes de Corte</h2>
                            <p className="text-slate-400 text-xs mt-0.5">
                                <span className="font-mono text-slate-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 mr-1.5">
                                    {items?.length} PV(s)
                                </span>
                                agrupados por recurso de máquina e especificações de chapa.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Main Body */}
                <div className="flex flex-col md:flex-row overflow-hidden flex-1 min-h-0 bg-slate-50">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 animate-pulse">
                            <Loader2 className="h-8 w-8 animate-spin mb-4 text-slate-600" />
                            <p className="font-medium text-slate-700 font-mono text-sm uppercase">Processando Estruturas (BOM)...</p>
                            <p className="text-xs text-slate-500 mt-1">Explodindo roteiros de corte Protheus para Laser e Puncionadeira...</p>
                        </div>
                    ) : explodedData.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
                            <Package className="h-10 w-10 mb-3 text-slate-300" />
                            <p className="font-medium text-slate-700 font-mono text-sm uppercase">Nenhum componente de corte localizado</p>
                            <p className="text-xs text-slate-500 mt-1">Nenhum item possui operações em Laser (MO0013) ou Puncionadeira (MO0012).</p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Toolbar (Tabs, Filters, Bulk Actions) */}
                            <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-4">
                                {/* Resource Tabs */}
                                <div className="flex bg-slate-100 p-1 rounded border border-slate-200">
                                    {availableResources.map(resName => {
                                        const totalCount = explodedData.filter(i => i.recurso_nome === resName).length;
                                        const selectedCount = explodedData.filter(i => i.recurso_nome === resName && selectedOps.has(i.op_numero)).length;
                                        return (
                                            <button
                                                key={resName}
                                                type="button"
                                                onClick={() => setActiveResourceTab(resName)}
                                                className={`px-3 py-1 text-xs font-mono font-bold uppercase transition-all rounded ${
                                                    activeResourceTab === resName
                                                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                                        : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                            >
                                                {resName}
                                                <span className="ml-1.5 px-1.5 py-0.2 text-[10px] bg-slate-200 text-slate-700 rounded-full font-sans">
                                                    {selectedCount}/{totalCount}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Component Search Filter */}
                                <div className="relative w-full max-w-xs">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                                        <Search className="h-3.5 w-3.5 text-slate-400" />
                                    </span>
                                    <input
                                        type="text"
                                        value={filterText}
                                        onChange={e => setFilterText(e.target.value)}
                                        placeholder="Filtrar por chapa, peça ou código..."
                                        className="pl-8 pr-3 py-1.5 text-xs w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-slate-400 font-mono transition-all"
                                    />
                                    {filterText && (
                                        <button
                                            type="button"
                                            onClick={() => setFilterText('')}
                                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Resource Bulk Toggles */}
                                <div className="flex gap-2 text-xs font-mono">
                                    <button
                                        type="button"
                                        onClick={() => handleSelectAllResource(activeResourceTab)}
                                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-slate-700 font-bold transition-all hover:scale-95 duration-100"
                                    >
                                        Marcar Aba
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeselectAllResource(activeResourceTab)}
                                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-slate-700 font-bold transition-all hover:scale-95 duration-100"
                                    >
                                        Desmarcar Aba
                                    </button>
                                </div>
                            </div>

                            {/* Aggregated List Panel */}
                            <div className="flex-1 overflow-y-auto p-6 min-h-0 space-y-4 custom-scrollbar">
                                {renderGroups[activeResourceTab] && Object.keys(renderGroups[activeResourceTab]).length > 0 ? (
                                    Object.keys(renderGroups[activeResourceTab]).map(material => {
                                        const matKey = `${activeResourceTab}|${material}`;
                                        const isCollapsed = collapsedMats.has(matKey);
                                        const components = renderGroups[activeResourceTab][material];
                                        const materialOps = Object.values(components).flatMap(c => c.ops);
                                        const isMatSelected = materialOps.length > 0 && materialOps.every(op => selectedOps.has(op));
                                        
                                        // Retrieve MTC Code and Description from first component in the group
                                        const firstComp = Object.values(components)[0];
                                        const mtcCode = firstComp?.mtc_codigo || 'SEM_MTC';
                                        const mtcDesc = firstComp?.mtc_descricao || 'Sem descrição cadastrada';

                                        const handleMatHeaderToggle = (e) => {
                                            e.stopPropagation();
                                            const pendingOps = materialOps.filter(op => {
                                                const origItem = explodedData.find(i => i.op_numero === op);
                                                return !origItem?.already_loted;
                                            });
                                            if (pendingOps.length === 0) return;

                                            const isAllPendingSelected = pendingOps.every(op => selectedOps.has(op));
                                            const newSelected = new Set(selectedOps);
                                            if (isAllPendingSelected) {
                                                pendingOps.forEach(op => newSelected.delete(op));
                                            } else {
                                                pendingOps.forEach(op => newSelected.add(op));
                                            }
                                            setSelectedOps(newSelected);
                                        };

                                        return (
                                            <div key={material} className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden transition-all duration-200">
                                                {/* Material Group Header */}
                                                <div 
                                                    onClick={() => toggleMatCollapse(matKey)}
                                                    className="bg-slate-50 hover:bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center cursor-pointer select-none transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input 
                                                            type="checkbox" 
                                                            className="w-3.5 h-3.5 text-slate-800 border-slate-300 rounded focus:ring-slate-500 cursor-pointer"
                                                            checked={isMatSelected}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={handleMatHeaderToggle}
                                                        />
                                                        <div className="flex items-baseline gap-2 flex-wrap">
                                                            <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                                                                {mtcCode}
                                                            </span>
                                                            <span className="text-xs text-slate-600 font-medium truncate max-w-md">
                                                                {mtcDesc}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-mono font-bold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded">
                                                            {Object.keys(components).length} Peça(s)
                                                        </span>
                                                        {isCollapsed ? (
                                                            <ChevronRight className="h-4 w-4 text-slate-400" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4 text-slate-400" />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Components Table Grid */}
                                                {!isCollapsed && (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left border-collapse">
                                                            <thead>
                                                                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 text-[10px] font-mono tracking-wider uppercase">
                                                                    <th className="pl-4 py-2 w-10">Sel</th>
                                                                    <th className="px-4 py-2 w-36">Código Peça</th>
                                                                    <th className="px-4 py-2">Descrição</th>
                                                                    <th className="px-4 py-2">Ordens Origem</th>
                                                                    <th className="pr-6 py-2 text-right w-28">Qtd Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {Object.keys(components).map(comp => {
                                                                    const c = components[comp];
                                                                    const uniqueOrigens = [...new Set(c.origens)];
                                                                    const componentOps = c.ops;
                                                                    
                                                                    // Verificar se TODAS as OPs desse componente já foram loteadas
                                                                    const isCompAlreadyLoted = componentOps.length > 0 && componentOps.every(op => {
                                                                        const orig = explodedData.find(i => i.op_numero === op);
                                                                        return orig?.already_loted;
                                                                    });

                                                                    const isCompSelected = componentOps.length > 0 && componentOps.every(op => selectedOps.has(op));
                                                                    
                                                                    const handleCompRowToggle = () => {
                                                                        if (isCompAlreadyLoted) return;
                                                                        const newSelected = new Set(selectedOps);
                                                                        if (isCompSelected) {
                                                                            componentOps.forEach(op => newSelected.delete(op));
                                                                        } else {
                                                                            componentOps.forEach(op => newSelected.add(op));
                                                                        }
                                                                        setSelectedOps(newSelected);
                                                                    };
 
                                                                    return (
                                                                        <tr 
                                                                            key={comp} 
                                                                            onClick={handleCompRowToggle}
                                                                            className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${
                                                                                isCompAlreadyLoted 
                                                                                    ? 'bg-slate-100/50 opacity-60 cursor-not-allowed' 
                                                                                    : isCompSelected 
                                                                                        ? 'bg-white' 
                                                                                        : 'bg-slate-100/30 opacity-70'
                                                                            }`}
                                                                        >
                                                                            <td className="pl-4 py-2.5">
                                                                                <input 
                                                                                    type="checkbox" 
                                                                                    className="w-3.5 h-3.5 text-slate-800 border-slate-300 rounded focus:ring-slate-500 cursor-pointer disabled:opacity-50"
                                                                                    checked={isCompAlreadyLoted || isCompSelected}
                                                                                    disabled={isCompAlreadyLoted}
                                                                                    onChange={() => {}} // Handled by row click
                                                                                />
                                                                            </td>
                                                                            <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-900">
                                                                                {comp}
                                                                            </td>
                                                                            <td className="px-4 py-2.5 text-xs text-slate-600 font-medium">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span>{c.descricao}</span>
                                                                                    {isCompAlreadyLoted && (
                                                                                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 rounded font-mono uppercase">
                                                                                            Já Loteado
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-2.5 text-[10px] font-mono text-slate-400" title={uniqueOrigens.join(', ')}>
                                                                                {uniqueOrigens.slice(0, 2).join(', ')}
                                                                                {uniqueOrigens.length > 2 && (
                                                                                    <span className="bg-slate-100 text-slate-600 px-1 rounded ml-1 font-bold">
                                                                                        +{uniqueOrigens.length - 2}
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                            <td className="pr-6 py-2.5 text-right font-mono text-xs font-bold text-slate-900">
                                                                                {c.qtd_total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 border border-dashed border-slate-200 bg-white rounded">
                                        <Info className="h-8 w-8 mb-2 text-slate-300" />
                                        <p className="font-mono text-xs uppercase text-slate-600">Nenhum registro correspondente encontrado</p>
                                        {filterText && <p className="text-[10px] text-slate-400 mt-1">Remova o filtro para ver os itens.</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Right Panel - Technical Inspector Panel */}
                    {!loading && explodedData.length > 0 && (
                        <div className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-slate-200 bg-white flex flex-col p-5">
                            <h3 className="font-mono text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200">
                                Resumo do Loteamento
                            </h3>
                            
                            {/* Summary Metrics Cards */}
                            <div className="grid grid-cols-1 gap-3 mb-6">
                                <div className="bg-slate-50 border border-slate-200 p-3 rounded shadow-sm">
                                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">Lotes a Serem Criados</span>
                                    <span className="text-xl font-mono font-bold text-slate-800 block mt-0.5">{selectedLotesCount}</span>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3 rounded shadow-sm">
                                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">Total de Peças Marcadas</span>
                                    <span className="text-xl font-mono font-bold text-slate-800 block mt-0.5">
                                        {selectedPiecesCount.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3 rounded shadow-sm">
                                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">Ordens de Vendas (PV)</span>
                                    <span className="text-xl font-mono font-bold text-slate-800 block mt-0.5">{affectedOrdersCount}</span>
                                </div>
                            </div>

                            {/* Batch Configs */}
                            <div className="flex-1 flex flex-col min-h-0">
                                <h4 className="font-mono text-[10px] font-bold text-slate-500 uppercase mb-2">Observações do Planejamento</h4>
                                <textarea 
                                    className="w-full border border-slate-200 rounded p-2.5 text-xs focus:ring-1 focus:ring-slate-400 outline-none resize-none flex-1 min-h-[100px] font-sans"
                                    placeholder="Digite notas de corte, ordens especiais, prioridades para o operador, etc."
                                    value={observation}
                                    onChange={e => setObservation(e.target.value)}
                                />
                                <p className="text-[9px] text-slate-400 font-mono mt-1.5 leading-relaxed bg-slate-50 border border-slate-200 p-2 rounded">
                                    Obs: O texto será gravado em cada lote de chapa individual criado.
                                </p>
                            </div>

                            {/* Save Actions Button */}
                            <button 
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs uppercase font-bold py-3 rounded shadow transition-all flex items-center justify-center gap-2 mt-5 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Gravando Lotes...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-4 w-4" /> 
                                        <span>Confirmar Geração ({selectedLotesCount})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CorteForecastModal;

