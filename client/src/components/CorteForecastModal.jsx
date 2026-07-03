import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Scissors, Save, Loader2, Package, ChevronDown, ChevronRight, Search, CheckCircle, FileText, Clock, AlertTriangle, Layers } from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'react-toastify';

// ============================================================================
// [1] CONTROLLER (ALCENETIZAÇÃO - ISOLAMENTO LÓGICO)
// ============================================================================
function useCorteForecastController(items, isOpen, usuario, onSaveSuccess, onClose) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [explodedData, setExplodedData] = useState([]);
    const [selectedOps, setSelectedOps] = useState(new Set());
    const [observation, setObservation] = useState('');
    const [gerarPlanilha, setGerarPlanilha] = useState(true);
    const [activeResourceTab, setActiveResourceTab] = useState('');
    const [collapsedMats, setCollapsedMats] = useState(new Set());
    const [filterText, setFilterText] = useState('');
    const [processingStatus, setProcessingStatus] = useState('');

    useEffect(() => {
        if (isOpen && items && items.length > 0) {
            loadExplosion();
        } else {
            setExplodedData([]);
            setSelectedOps(new Set());
            setActiveResourceTab('');
            setCollapsedMats(new Set());
            setFilterText('');
            setProcessingStatus('');
        }
    }, [isOpen, items]);

    useEffect(() => {
        if (explodedData.length > 0 && !activeResourceTab) {
            const resources = [...new Set(explodedData.map(i => i.recurso_nome))];
            if (resources.length > 0) setActiveResourceTab(resources[0]);
        }
    }, [explodedData, activeResourceTab]);

    const loadExplosion = async () => {
        setLoading(true);
        try {
            const payload = items.map(t => ({
                pedido: t.pedido,
                item: t.item,
                codigo: t.codigo,
                quantidade: t.quantidade || t.qtd_faturar || 0,
                op_num: t.op_num || ''
            }));

            setProcessingStatus(`INICIANDO ANÁLISE: ${payload.length} ITENS...`);
            
            const chunkSize = 20;
            let newExploded = [];
            
            for (let i = 0; i < payload.length; i += chunkSize) {
                const chunk = payload.slice(i, i + chunkSize);
                setProcessingStatus(`ANALISANDO ESTRUTURA: ${Math.min(i + chunk.length, payload.length)} / ${payload.length}`);
                
                const res = await api.post('/corte/explosao', { items: chunk });
                newExploded = [...newExploded, ...(res.data.items || [])];
            }
            
            const uniqueMap = new Map();
            newExploded.forEach(item => {
                if (!uniqueMap.has(item.op_numero)) uniqueMap.set(item.op_numero, item);
            });
            const deduplicatedExploded = Array.from(uniqueMap.values());

            setProcessingStatus(`ORGANIZANDO ${deduplicatedExploded.length} OPERAÇÕES...`);
            setExplodedData(deduplicatedExploded);

            const initialSelected = new Set(
                deduplicatedExploded.filter(i => !i.already_loted).map(i => i.op_numero)
            );
            setSelectedOps(initialSelected);

            const initialCollapsed = new Set();
            deduplicatedExploded.forEach(item => {
                const matKey = `${item.recurso_nome}|${item.mtc_codigo} - ${item.mtc_descricao}`;
                initialCollapsed.add(matKey);
            });
            setCollapsedMats(initialCollapsed);
        } catch (err) {
            console.error('Erro na explosão:', err);
            toast.error('FALHA AO PROCESSAR ESTRUTURA DOS PRODUTOS.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const filteredData = explodedData.filter(i => selectedOps.has(i.op_numero));
        if (filteredData.length === 0) {
            toast.warning('NENHUM ITEM VÁLIDO SELECIONADO.');
            return;
        }

        setSaving(true);
        try {
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

            const res = await api.post('/corte/lotes', { lotes: lotesArray, usuario, gerar_planilha: gerarPlanilha });
            if (res.data?.success) {
                toast.success(res.data.message || 'LOTES DE CORTE GERADOS!');
                if (onSaveSuccess) onSaveSuccess();
                onClose();
            }
        } catch (err) {
            console.error('Erro ao salvar lotes:', err);
            toast.error('ERRO AO GRAVAR OS LOTES DE CORTE.');
        } finally {
            setSaving(false);
        }
    };

    const filteredExplodedData = useMemo(() => {
        return explodedData.filter(item => {
            if (!filterText.trim()) return true;
            const search = filterText.toLowerCase();
            return (
                item.componente.toLowerCase().includes(search) ||
                item.componente_descricao.toLowerCase().includes(search) ||
                item.mtc_codigo.toLowerCase().includes(search) ||
                item.mtc_descricao.toLowerCase().includes(search)
            );
        });
    }, [explodedData, filterText]);

    const renderGroups = useMemo(() => {
        const groups = {};
        filteredExplodedData.forEach(item => {
            if (!groups[item.recurso_nome]) groups[item.recurso_nome] = {};
            const matKey = `${item.mtc_codigo} - ${item.mtc_descricao}`;
            if (!groups[item.recurso_nome][matKey]) groups[item.recurso_nome][matKey] = {};
            
            if (!groups[item.recurso_nome][matKey][item.componente]) {
                groups[item.recurso_nome][matKey][item.componente] = {
                    descricao: item.componente_descricao,
                    qtd_total: 0,
                    tempo_total: 0,
                    origens: [],
                    ops: [],
                    mtc_codigo: item.mtc_codigo,
                    mtc_descricao: item.mtc_descricao,
                    has_drawing: item.has_drawing,
                    pdf_path: item.pdf_path
                };
            }
            
            groups[item.recurso_nome][matKey][item.componente].qtd_total += parseFloat(item.qtd_necessaria);
            groups[item.recurso_nome][matKey][item.componente].tempo_total += (parseFloat(item.qtd_necessaria) * parseFloat(item.tempo_unitario || 0));
            groups[item.recurso_nome][matKey][item.componente].origens.push(`${item.pedido_pai} (Item ${item.item_pai})`);
            groups[item.recurso_nome][matKey][item.componente].ops.push(item.op_numero);
        });
        return groups;
    }, [filteredExplodedData]);

    const availableResources = useMemo(() => [...new Set(explodedData.map(i => i.recurso_nome))], [explodedData]);

    return {
        state: { loading, saving, explodedData, selectedOps, observation, gerarPlanilha, activeResourceTab, collapsedMats, filterText, processingStatus, filteredExplodedData, renderGroups, availableResources },
        actions: { setObservation, setGerarPlanilha, setActiveResourceTab, setCollapsedMats, setFilterText, setSelectedOps, handleSave }
    };
}

// ============================================================================
// [2] COMPONENTES DE APRESENTAÇÃO (METALFISMO DE DESIGN)
// ============================================================================

const MetalfisaHeader = ({ title, subtitle, itemsCount, onClose }) => (
    <div className="bg-[#0b0f19] px-6 py-4 flex items-center justify-between text-white shrink-0 shadow-md">
        <div className="flex items-center gap-4">
            <div className="p-2 bg-[#10b981]/20 rounded-md border border-[#10b981]/40">
                <Scissors className="h-6 w-6 text-[#10b981]" />
            </div>
            <div className="flex flex-col">
                <h2 className="text-lg font-black font-sans tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">
                    {title}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[10px] font-bold bg-[#38bdf8]/10 text-[#38bdf8] px-2 py-0.5 rounded border border-[#38bdf8]/30">
                        {itemsCount} PV(S)
                    </span>
                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{subtitle}</span>
                </div>
            </div>
        </div>
        <button onClick={onClose} className="p-2 bg-transparent hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-transparent hover:border-red-500/30 rounded-md transition-all">
            <X className="h-5 w-5" />
        </button>
    </div>
);

const Toolbar = ({ activeResourceTab, availableResources, explodedData, selectedOps, filterText, setFilterText, setActiveResourceTab, handleSelectAllResource, handleDeselectAllResource }) => (
    <div className="bg-[#111827] border-b border-[#1f2937] px-6 py-4 shrink-0 flex flex-wrap items-center justify-between gap-4">
        {/* Resource Tabs */}
        <div className="flex gap-2 p-1 bg-[#0b0f19] rounded-md border border-[#1f2937]">
            {availableResources.map(resName => {
                const totalCount = explodedData.filter(i => i.recurso_nome === resName).length;
                const selectedCount = explodedData.filter(i => i.recurso_nome === resName && selectedOps.has(i.op_numero)).length;
                const isActive = activeResourceTab === resName;
                return (
                    <button
                        key={resName}
                        onClick={() => setActiveResourceTab(resName)}
                        className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all rounded-md ${
                            isActive
                                ? 'bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30 shadow-[0_0_10px_rgba(56,189,248,0.1)]'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-[#1f2937]/50 border border-transparent'
                        }`}
                    >
                        {resName}
                        <span className={`px-1.5 py-0.5 text-[10px] rounded-sm font-mono ${isActive ? 'bg-[#38bdf8]/20 text-[#38bdf8]' : 'bg-[#1f2937] text-gray-400'}`}>
                            {selectedCount}/{totalCount}
                        </span>
                    </button>
                );
            })}
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Component Search Filter */}
            <div className="relative flex-1 md:w-72">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-[#38bdf8]" />
                </span>
                <input
                    type="text"
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    placeholder="FILTRAR CHAPA OU PEÇA..."
                    className="w-full pl-10 pr-10 py-2 text-xs bg-[#0b0f19] text-gray-200 border border-[#1f2937] focus:border-[#38bdf8] rounded-md outline-none focus:ring-1 focus:ring-[#38bdf8] font-mono tracking-wider placeholder-gray-600 transition-all"
                />
                {filterText && (
                    <button onClick={() => setFilterText('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Bulk Actions */}
            <div className="flex gap-2">
                <button
                    onClick={() => handleSelectAllResource(activeResourceTab)}
                    className="px-3 py-2 bg-[#10b981]/10 hover:bg-[#10b981]/20 border border-[#10b981]/30 rounded-md text-[#10b981] text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                    MARCAR ABA
                </button>
                <button
                    onClick={() => handleDeselectAllResource(activeResourceTab)}
                    className="px-3 py-2 bg-[#0b0f19] hover:bg-gray-800 border border-[#1f2937] rounded-md text-gray-400 text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                    LIMPAR ABA
                </button>
            </div>
        </div>
    </div>
);

// ============================================================================
// [3] COMPONENTE PRINCIPAL
// ============================================================================
export default function CorteForecastModal({ isOpen, onClose, items, onSaveSuccess, usuario, canEdit = true }) {
    const { state, actions } = useCorteForecastController(items, isOpen, usuario, onSaveSuccess, onClose);

    if (!isOpen) return null;

    // Helper functions for render
    const handleSelectAllResource = (resource) => {
        const opsToSelect = state.explodedData.filter(i => i.recurso_nome === resource && !i.already_loted).map(i => i.op_numero);
        const newSelected = new Set(state.selectedOps);
        opsToSelect.forEach(op => newSelected.add(op));
        actions.setSelectedOps(newSelected);
    };

    const handleDeselectAllResource = (resource) => {
        const opsToRemove = state.explodedData.filter(i => i.recurso_nome === resource).map(i => i.op_numero);
        const newSelected = new Set(state.selectedOps);
        opsToRemove.forEach(op => newSelected.delete(op));
        actions.setSelectedOps(newSelected);
    };

    const toggleMatCollapse = (matKey) => {
        const next = new Set(state.collapsedMats);
        if (next.has(matKey)) next.delete(matKey);
        else next.add(matKey);
        actions.setCollapsedMats(next);
    };

    const handleOpenPDF = (e, path) => {
        e.stopPropagation();
        if (path) {
            const domain = api.defaults.baseURL ? api.defaults.baseURL.replace('/api', '') : '';
            window.open(`${domain}/api/docs/view?path=${encodeURIComponent(path)}`, '_blank');
        }
    };

    // Calculate Inspector Stats
    let selectedPiecesCount = 0;
    const affectedOrders = new Set();
    const selectedLotes = {};
    state.explodedData.forEach(item => {
        if (state.selectedOps.has(item.op_numero)) {
            const key = `${item.recurso}|${item.mtc_codigo}`;
            selectedLotes[key] = true;
            selectedPiecesCount += parseFloat(item.qtd_necessaria);
            affectedOrders.add(item.pedido_pai);
        }
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#0d111a] rounded-xl shadow-2xl w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden border border-[#1f2937]">
                
                <MetalfisaHeader 
                    title="EXPLOSÃO & GERAÇÃO DE LOTES" 
                    subtitle="AGRUPAMENTO POR MÁQUINA E CHAPA"
                    itemsCount={items?.length} 
                    onClose={onClose} 
                />

                <div className="flex flex-col md:flex-row overflow-hidden flex-1 min-h-0">
                    {state.loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-[#38bdf8] bg-[#0b0f19]">
                            <Loader2 className="h-10 w-10 animate-spin mb-6 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
                            <p className="font-bold font-sans tracking-[0.2em] text-sm uppercase">PROCESSANDO ESTRUTURAS (BOM)</p>
                            <p className="text-xs text-[#38bdf8]/60 mt-2 font-mono uppercase">{state.processingStatus}</p>
                        </div>
                    ) : state.explodedData.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-500 bg-[#0b0f19]">
                            <Package className="h-12 w-12 mb-4 text-[#1f2937]" />
                            <p className="font-bold font-sans tracking-widest text-sm uppercase">NENHUM COMPONENTE LOCALIZADO</p>
                            <p className="text-xs text-gray-600 mt-2 uppercase font-mono">OPERAÇÕES EM LASER OU PUNCIONADEIRA INEXISTENTES.</p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0 bg-[#0d111a]">
                            <Toolbar 
                                activeResourceTab={state.activeResourceTab}
                                availableResources={state.availableResources}
                                explodedData={state.explodedData}
                                selectedOps={state.selectedOps}
                                filterText={state.filterText}
                                setFilterText={actions.setFilterText}
                                setActiveResourceTab={actions.setActiveResourceTab}
                                handleSelectAllResource={handleSelectAllResource}
                                handleDeselectAllResource={handleDeselectAllResource}
                            />

                            {/* Aggregated List Panel */}
                            <div className="flex-1 overflow-y-auto p-6 min-h-0 flex flex-col gap-4 custom-scrollbar bg-[#0d111a]">
                                {state.renderGroups[state.activeResourceTab] && Object.keys(state.renderGroups[state.activeResourceTab]).length > 0 ? (
                                    Object.keys(state.renderGroups[state.activeResourceTab]).map(material => {
                                        const matKey = `${state.activeResourceTab}|${material}`;
                                        const isCollapsed = state.collapsedMats.has(matKey);
                                        const components = state.renderGroups[state.activeResourceTab][material];
                                        const materialOps = Object.values(components).flatMap(c => c.ops);
                                        const isMatSelected = materialOps.length > 0 && materialOps.every(op => state.selectedOps.has(op));
                                        
                                        const firstComp = Object.values(components)[0];
                                        const mtcCode = firstComp?.mtc_codigo || 'SEM_MTC';
                                        const mtcDesc = firstComp?.mtc_descricao || 'SEM DESCRIÇÃO';

                                        const handleMatHeaderToggle = (e) => {
                                            e.stopPropagation();
                                            const pendingOps = materialOps.filter(op => {
                                                const origItem = state.explodedData.find(i => i.op_numero === op);
                                                return !origItem?.already_loted;
                                            });
                                            if (pendingOps.length === 0) return;

                                            const isAllPendingSelected = pendingOps.every(op => state.selectedOps.has(op));
                                            const newSelected = new Set(state.selectedOps);
                                            if (isAllPendingSelected) pendingOps.forEach(op => newSelected.delete(op));
                                            else pendingOps.forEach(op => newSelected.add(op));
                                            actions.setSelectedOps(newSelected);
                                        };

                                        return (
                                            <div key={material} className="bg-[#111827] border border-[#1f2937] rounded-lg overflow-hidden transition-all duration-200 shadow-sm">
                                                {/* Material Group Header */}
                                                <div 
                                                    onClick={() => toggleMatCollapse(matKey)}
                                                    className="bg-[#1f2937]/30 hover:bg-[#1f2937]/50 px-5 py-3 border-b border-[#1f2937] flex justify-between items-center cursor-pointer select-none transition-colors"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <input 
                                                            type="checkbox" 
                                                            className="w-4 h-4 bg-[#0b0f19] border-[#38bdf8] text-[#38bdf8] rounded focus:ring-[#38bdf8] cursor-pointer focus:ring-offset-[#111827]"
                                                            checked={isMatSelected}
                                                            onClick={e => e.stopPropagation()}
                                                            onChange={handleMatHeaderToggle}
                                                        />
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <span className="font-mono text-[10px] tracking-widest font-bold text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20 px-2 py-1 rounded">
                                                                {mtcCode}
                                                            </span>
                                                            <span className="text-[11px] text-gray-300 font-bold uppercase tracking-wider">
                                                                {mtcDesc}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-mono font-bold bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20 px-2 py-0.5 rounded">
                                                            {Object.keys(components).length} PEÇAS
                                                        </span>
                                                        {isCollapsed ? <ChevronRight className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                                                    </div>
                                                </div>

                                                {/* Components Table Grid */}
                                                {!isCollapsed && (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left border-collapse">
                                                            <thead>
                                                                <tr className="bg-[#0b0f19]/50 border-b border-[#1f2937] text-gray-500 text-[9px] font-mono tracking-widest uppercase">
                                                                    <th className="pl-5 py-3 w-12">SEL</th>
                                                                    <th className="px-4 py-3">CÓDIGO</th>
                                                                    <th className="px-4 py-3">DESCRIÇÃO</th>
                                                                    <th className="px-4 py-3 text-center">TEMPO</th>
                                                                    <th className="px-4 py-3">ORIGEM</th>
                                                                    <th className="pr-6 py-3 text-right">QTD</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-[#1f2937]/50">
                                                                {Object.keys(components).map(comp => {
                                                                    const c = components[comp];
                                                                    const uniqueOrigens = [...new Set(c.origens)];
                                                                    const componentOps = c.ops;
                                                                    
                                                                    const isCompAlreadyLoted = componentOps.length > 0 && componentOps.every(op => {
                                                                        const orig = state.explodedData.find(i => i.op_numero === op);
                                                                        return orig?.already_loted;
                                                                    });
                                                                    const isCompSelected = componentOps.length > 0 && componentOps.every(op => state.selectedOps.has(op));
                                                                    
                                                                    const handleCompRowToggle = () => {
                                                                        if (isCompAlreadyLoted) return;
                                                                        const newSelected = new Set(state.selectedOps);
                                                                        if (isCompSelected) componentOps.forEach(op => newSelected.delete(op));
                                                                        else componentOps.forEach(op => newSelected.add(op));
                                                                        actions.setSelectedOps(newSelected);
                                                                    };
 
                                                                    return (
                                                                        <tr 
                                                                            key={comp} 
                                                                            onClick={handleCompRowToggle}
                                                                            className={`hover:bg-[#1f2937]/30 cursor-pointer transition-colors ${
                                                                                isCompAlreadyLoted 
                                                                                    ? 'bg-[#0b0f19] opacity-40 cursor-not-allowed' 
                                                                                    : isCompSelected 
                                                                                        ? 'bg-[#38bdf8]/5' 
                                                                                        : 'bg-transparent'
                                                                            }`}
                                                                        >
                                                                            <td className="pl-5 py-3">
                                                                                <input 
                                                                                    type="checkbox" 
                                                                                    className="w-4 h-4 bg-[#0b0f19] border-[#38bdf8] text-[#38bdf8] rounded focus:ring-[#38bdf8] cursor-pointer disabled:opacity-50 focus:ring-offset-[#111827]"
                                                                                    checked={isCompAlreadyLoted || isCompSelected}
                                                                                    disabled={isCompAlreadyLoted}
                                                                                    onChange={() => {}} 
                                                                                />
                                                                            </td>
                                                                            <td className="px-4 py-3 font-mono text-[11px] font-bold text-gray-200">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className={isCompSelected ? 'text-[#38bdf8]' : ''}>{comp}</span>
                                                                                    {c.has_drawing && (
                                                                                        <button 
                                                                                            type="button"
                                                                                            onClick={(e) => handleOpenPDF(e, c.pdf_path)}
                                                                                            className="text-[#38bdf8] hover:text-white hover:bg-[#38bdf8]/20 p-1.5 rounded transition-colors"
                                                                                        >
                                                                                            <FileText className="h-3 w-3" />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-[11px] text-gray-400 font-medium uppercase tracking-wide">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="truncate max-w-[200px]">{c.descricao}</span>
                                                                                    {isCompAlreadyLoted && (
                                                                                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded font-mono uppercase">
                                                                                            LOTEADO
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-xs text-center font-mono text-gray-500">
                                                                                <div className="flex items-center justify-center gap-1.5">
                                                                                    <Clock className="h-3 w-3" />
                                                                                    {c.tempo_total > 0 ? c.tempo_total.toFixed(2) : '-'}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-[10px] font-mono text-gray-500">
                                                                                {uniqueOrigens.slice(0, 2).join(', ')}
                                                                                {uniqueOrigens.length > 2 && (
                                                                                    <span className="bg-[#1f2937] text-gray-300 px-1.5 py-0.5 rounded ml-1 font-bold">
                                                                                        +{uniqueOrigens.length - 2}
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                            <td className="pr-6 py-3 text-right font-mono text-xs font-bold text-[#10b981]">
                                                                                {c.qtd_total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} UN
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
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-500 border border-dashed border-[#1f2937] bg-[#111827] rounded-lg">
                                        <AlertTriangle className="h-8 w-8 mb-3 text-amber-500/50" />
                                        <p className="font-mono text-xs uppercase tracking-widest text-gray-400">NENHUM REGISTRO CORRESPONDENTE</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Right Panel - Technical Inspector Panel */}
                    {!state.loading && state.explodedData.length > 0 && (
                        <div className="w-full md:w-[340px] shrink-0 border-t md:border-t-0 md:border-l border-[#1f2937] bg-[#0b0f19] flex flex-col p-6 shadow-[-4px_0_15px_rgba(0,0,0,0.5)] z-10">
                            <h3 className="font-mono text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-5 pb-3 border-b border-[#1f2937] flex items-center gap-2">
                                <Layers className="w-4 h-4 text-[#38bdf8]" />
                                RESUMO DO LOTEAMENTO
                            </h3>
                            
                            <div className="grid grid-cols-1 gap-3 mb-6">
                                <div className="bg-[#111827] border border-[#1f2937] p-4 rounded-lg flex justify-between items-center">
                                    <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider">LOTES A CRIAR</span>
                                    <span className="text-2xl font-mono font-black text-[#38bdf8]">{Object.keys(selectedLotes).length}</span>
                                </div>
                                <div className="bg-[#111827] border border-[#1f2937] p-4 rounded-lg flex justify-between items-center">
                                    <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider">PEÇAS TOTAIS</span>
                                    <span className="text-2xl font-mono font-black text-[#10b981]">
                                        {selectedPiecesCount.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="bg-[#111827] border border-[#1f2937] p-4 rounded-lg flex justify-between items-center">
                                    <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider">ORDENS AFETADAS</span>
                                    <span className="text-2xl font-mono font-black text-gray-300">{affectedOrders.size}</span>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0">
                                <h4 className="font-mono text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">OBSERVAÇÕES DO PLANO</h4>
                                <textarea 
                                    className="w-full bg-[#111827] border border-[#1f2937] text-gray-300 rounded-md p-3 text-xs focus:ring-1 focus:ring-[#38bdf8] focus:border-[#38bdf8] outline-none resize-none flex-1 min-h-[120px] font-mono tracking-wide placeholder-gray-600 transition-all shadow-inner"
                                    placeholder="DIGITE INSTRUÇÕES PARA A FÁBRICA..."
                                    value={state.observation}
                                    onChange={e => actions.setObservation(e.target.value)}
                                />
                            </div>

                            <div className="mt-5 mb-5 flex items-center gap-3 p-4 bg-[#111827] rounded-md border border-[#1f2937]">
                                <input 
                                    type="checkbox" 
                                    id="gerarPlanilha"
                                    checked={state.gerarPlanilha}
                                    onChange={(e) => actions.setGerarPlanilha(e.target.checked)}
                                    disabled={!canEdit}
                                    className="h-4 w-4 rounded bg-[#0b0f19] border-[#38bdf8] text-[#38bdf8] focus:ring-[#38bdf8] focus:ring-offset-[#111827] cursor-pointer disabled:opacity-50"
                                />
                                <label htmlFor="gerarPlanilha" className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider cursor-pointer">
                                    IMPRIMIR ESPELHO
                                </label>
                            </div>

                            {canEdit && (
                                <button 
                                    onClick={actions.handleSave}
                                    disabled={state.saving}
                                    className="w-full bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9] hover:from-[#0ea5e9] hover:to-[#0284c7] text-[#0b0f19] font-mono text-[13px] uppercase font-black py-4 rounded-md shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {state.saving ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            <span>GRAVANDO...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="h-5 w-5" /> 
                                            <span>CONFIRMAR ({Object.keys(selectedLotes).length})</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
