import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Loader2, Package, ChevronDown, ChevronRight, Search, CheckCircle, FileText, Clock, AlertTriangle, Layers, Settings, Plus, Trash2, Edit2 } from 'lucide-react';
import { api, getProcessList } from '../services/api';
import { toast } from 'react-toastify';

function evaluateLogic(expression, contextSet) {
    if (!expression) return false;
    let jsExpr = String(expression).toUpperCase();
    
    // Substituir operadores lógicos
    jsExpr = jsExpr.replace(/\bAND\b/g, '&&');
    jsExpr = jsExpr.replace(/\bOR\b/g, '||');
    jsExpr = jsExpr.replace(/\bNOT\b/g, '!');
    
    // Substituir códigos de recurso por true/false
    jsExpr = jsExpr.replace(/[A-Z0-9_]+/g, match => {
        if (match === 'TRUE' || match === 'FALSE') return match.toLowerCase();
        return contextSet.has(match) ? ' true ' : ' false ';
    });

    // Limpar caracteres perigosos, mantendo apenas o necessário para eval booleano
    jsExpr = jsExpr.replace(/[^truefals\s\(\)\&\|!]/g, '');

    try {
        // eslint-disable-next-line no-new-func
        return new Function(`return !!(${jsExpr});`)();
    } catch (e) {
        return false;
    }
}

// ============================================================================
// [1] MANAGE ROUTING GROUPS MODAL
// ============================================================================
function RoutingGroupManager({ isOpen, onClose, onUpdated }) {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const [expression, setExpression] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [processList, setProcessList] = useState([]);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const res = await api.get('/corte/routing-groups');
            if (res.data?.success) setGroups(res.data.groups);
            const pRes = await getProcessList();
            setProcessList(Array.isArray(pRes) ? pRes : (pRes?.data || []));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (isOpen) fetchGroups(); }, [isOpen]);

    const appendToExpr = (str) => {
        setExpression(prev => (prev + ' ' + str).trim().replace(/\s+/g, ' '));
    };

    const handleEdit = (group) => {
        setEditingId(group.id);
        setName(group.name);
        setExpression(group.rules?.expression || group.rules?.includes?.join(' OR '));
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setName('');
        setExpression('');
    };

    const handleSave = async () => {
        if (!name.trim()) return toast.warning('Nome do grupo é obrigatório.');
        if (!expression.trim()) return toast.warning('Defina a expressão lógica.');
        
        setSaving(true);
        try {
            if (editingId) {
                await api.put(`/corte/routing-groups/${editingId}`, { name, rules: { expression } });
                toast.success('Grupo atualizado!');
            } else {
                await api.post('/corte/routing-groups', { name, rules: { expression } });
                toast.success('Grupo criado!');
            }
            handleCancelEdit();
            fetchGroups();
            if (onUpdated) onUpdated();
        } catch (e) {
            const msg = e.response?.data?.error || 'Erro ao salvar.';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/corte/routing-groups/${id}`);
            toast.success('Excluído!');
            fetchGroups();
            if (onUpdated) onUpdated();
        } catch (e) {
            toast.error('Erro ao excluir.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
                <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-white font-bold text-lg">Gerenciar Grupos de Roteiro</h2>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-4 bg-slate-50 overflow-y-auto max-h-[70vh]">
                    {/* Criação de novo grupo */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-700 mb-3">{editingId ? 'Editar Grupo' : 'Novo Grupo'}</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <input
                                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                placeholder="Nome do grupo (Ex: Somente Corte)"
                                value={name} onChange={e => setName(e.target.value)}
                            />

                            <div>
                                <p className="text-xs font-bold text-slate-500 mb-2 uppercase">
                                    Expressão Lógica do Grupo
                                </p>
                                
                                <textarea
                                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none mb-2 font-mono uppercase"
                                    placeholder="Ex: (MO0013 OR MO0002) AND MO0003"
                                    rows={3}
                                    value={expression}
                                    onChange={e => setExpression(e.target.value.toUpperCase())}
                                />
                                
                                <div className="flex flex-wrap gap-2 mb-3">
                                    <button onClick={() => appendToExpr('AND')} className="text-[10px] px-3 py-1 bg-blue-100 text-blue-700 font-bold rounded hover:bg-blue-200">E (AND)</button>
                                    <button onClick={() => appendToExpr('OR')} className="text-[10px] px-3 py-1 bg-amber-100 text-amber-700 font-bold rounded hover:bg-amber-200">OU (OR)</button>
                                    <button onClick={() => appendToExpr('(')} className="text-[10px] px-3 py-1 bg-slate-200 text-slate-700 font-bold rounded hover:bg-slate-300">(</button>
                                    <button onClick={() => appendToExpr(')')} className="text-[10px] px-3 py-1 bg-slate-200 text-slate-700 font-bold rounded hover:bg-slate-300">)</button>
                                    <button onClick={() => setExpression('')} className="text-[10px] px-3 py-1 bg-red-50 text-red-600 font-bold rounded hover:bg-red-100 ml-auto">Limpar</button>
                                </div>

                                <p className="text-xs font-bold text-slate-500 mb-2 uppercase mt-4">
                                    Adicionar Recursos à Expressão
                                </p>
                                <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                                    {processList.map(p => {
                                        const code = p.codigo.toUpperCase();
                                        return (
                                            <button
                                                key={code}
                                                onClick={() => appendToExpr(code)}
                                                className="text-[10px] px-2 py-1 rounded-full font-bold border transition-colors bg-white text-slate-500 border-slate-300 hover:border-emerald-400 hover:text-emerald-600"
                                            >
                                                {code} - <span className="font-normal truncate max-w-[120px] inline-block align-bottom">{p.descricao}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {editingId && (
                                    <button
                                        onClick={handleCancelEdit}
                                        disabled={saving}
                                        className="bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 text-sm font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        Cancelar
                                    </button>
                                )}
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !name.trim() || !expression.trim()}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                                    {editingId ? 'Atualizar Grupo' : 'Adicionar Grupo'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Lista de grupos existentes */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-bold text-slate-700">Grupos Existentes</h3>
                        {loading ? (
                            <p className="text-sm text-slate-500">Carregando...</p>
                        ) : groups.length === 0 ? (
                            <p className="text-sm text-slate-500">Nenhum grupo criado.</p>
                        ) : (
                            groups.map((g, idx) => (
                                <div key={g.id} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center">{idx + 1}</span>
                                        <div>
                                            <p className="font-bold text-slate-700 text-sm">{g.name}</p>
                                            <div className="mt-1">
                                                <code className="text-[10px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded font-bold break-all">
                                                    {g.rules?.expression || g.rules?.includes?.join(' OR ')}
                                                </code>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <button onClick={() => handleEdit(g)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(g.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// [2] COMPONENTES DE APRESENTAÇÃO
// ============================================================================
const MetalfisaHeader = ({ title, subtitle, itemsCount, onClose }) => (
    <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between shadow-md z-10 shrink-0">
        <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
                <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
                <h2 className="text-white font-bold text-lg leading-tight uppercase">
                    {title}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded border border-white/10">
                        {itemsCount} PV(S)
                    </span>
                    <span className="text-indigo-100 text-[11px] font-semibold">{subtitle}</span>
                </div>
            </div>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg">
            <X className="w-5 h-5" />
        </button>
    </div>
);

// ============================================================================
// [3] MAIN MODAL
// ============================================================================
export default function CorteForecastModal({ isOpen, onClose, items, onSaveSuccess, usuario, canEdit = true, lpfCodigo = null }) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [explodedData, setExplodedData] = useState([]);
    const [groups, setGroups] = useState([]);
    const [activeTabId, setActiveTabId] = useState('ALL');
    const [selectedOps, setSelectedOps] = useState(new Set());
    const [observation, setObservation] = useState('');
    const [gerarPlanilha, setGerarPlanilha] = useState(true);
    const [collapsedMats, setCollapsedMats] = useState(new Set());
    const [filterText, setFilterText] = useState('');
    const [processingStatus, setProcessingStatus] = useState('');
    const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);

    useEffect(() => {
        if (isOpen && items && items.length > 0) {
            fetchRoutingGroups();
            loadExplosion();
        } else {
            setExplodedData([]);
            setGroups([]);
            setSelectedOps(new Set());
            setActiveTabId('ALL');
            setCollapsedMats(new Set());
            setFilterText('');
            setProcessingStatus('');
        }
    }, [isOpen, items]);

    const fetchRoutingGroups = async () => {
        try {
            const res = await api.get('/corte/routing-groups');
            if (res.data?.success) setGroups(res.data.groups);
        } catch (e) {
            console.error('Erro ao buscar grupos:', e);
        }
    };

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
            const deduplicated = Array.from(uniqueMap.values());

            setExplodedData(deduplicated);
            setSelectedOps(new Set(deduplicated.filter(i => !i.already_loted).map(i => i.op_numero)));
        } catch (err) {
            console.error('Erro explosão:', err);
            toast.error('FALHA AO PROCESSAR ESTRUTURA.');
        } finally {
            setLoading(false);
        }
    };

    // ── Mutual exclusivity: each piece is assigned to the FIRST matching group ──
    // Groups are ordered by priority (backend returns them sorted).
    // A piece matches a group if its roteiro_str contains ANY of the group's includes.
    // Once assigned, it won't appear in other groups.
    // Step 1: for each op_numero, collect ALL cut resources that appear in explodedData
    const opResourcesMap = useMemo(() => {
        const map = new Map(); // op_numero -> Set<resource_code_uppercase>
        explodedData.forEach(item => {
            if (!map.has(item.op_numero)) map.set(item.op_numero, new Set());
            const set = map.get(item.op_numero);
            
            if (item.recurso) set.add(String(item.recurso).trim().toUpperCase());
            
            if (item.roteiro) {
                item.roteiro.split('->').forEach(r => {
                    const t = r.trim().toUpperCase();
                    if (t) set.add(t);
                });
            }
        });
        return map;
    }, [explodedData]);

    // Condition: Advanced Expression Logic with Best Fit
    const pieceGroupMap = useMemo(() => {
        const map = new Map(); // op_numero -> groupId string (or null = unassigned)
        if (groups.length === 0) return map;

        explodedData.forEach(item => {
            if (map.has(item.op_numero)) return; // already assigned
            
            const opResources = opResourcesMap.get(item.op_numero) || new Set();

            let bestGroup = null;
            let bestScore = { intersection: -1, ands: -1, priority: 999 };

            for (const group of groups) {
                const expr = group.rules?.expression;
                if (!expr) continue;

                if (evaluateLogic(expr, opResources)) {
                    // Calculate how many resources from the expression exist in the piece
                    const groupIncludes = group.rules?.includes || [];
                    let intersectionSize = 0;
                    for (const inc of groupIncludes) {
                        if (opResources.has(inc)) {
                            intersectionSize++;
                        }
                    }
                    
                    // Tie-breaker: groups with more ANDs are more restrictive
                    const ands = (expr.match(/\bAND\b/ig) || []).length;
                    const priority = group.priority || 999;

                    let isBetter = false;
                    if (intersectionSize > bestScore.intersection) {
                        isBetter = true; // Mais recursos correspondentes = melhor
                    } else if (intersectionSize === bestScore.intersection) {
                        if (ands > bestScore.ands) {
                            isBetter = true; // Mais restritivo = melhor
                        } else if (ands === bestScore.ands) {
                            if (priority < bestScore.priority) {
                                isBetter = true; // Prioridade no DB
                            }
                        }
                    }

                    if (isBetter) {
                        bestScore = { intersection: intersectionSize, ands, priority };
                        bestGroup = group;
                    }
                }
            }

            if (bestGroup) {
                map.set(item.op_numero, String(bestGroup.id));
            } else {
                map.set(item.op_numero, null); // unassigned
            }
        });
        return map;
    }, [explodedData, groups, opResourcesMap]);


    // Filter based on active tab using the assignment map
    const filteredExplodedData = useMemo(() => {
        let filtered = explodedData;

        if (activeTabId !== 'ALL') {
            const activeIdStr = String(activeTabId);
            filtered = explodedData.filter(item => pieceGroupMap.get(item.op_numero) === activeIdStr);
        }

        // Apply text filter
        if (filterText.trim()) {
            const s = filterText.toLowerCase();
            filtered = filtered.filter(item =>
                (item.componente || '').toLowerCase().includes(s) ||
                (item.componente_descricao || '').toLowerCase().includes(s) ||
                (item.mtc_codigo || '').toLowerCase().includes(s)
            );
        }

        return filtered;
    }, [explodedData, groups, activeTabId, filterText, pieceGroupMap]);

    // Flat map of components (disregarding materials as requested)
    const renderItems = useMemo(() => {
        const byComponent = {}; // componente -> compData
        filteredExplodedData.forEach(item => {
            const comp = item.componente || '?';
            if (!byComponent[comp]) {
                byComponent[comp] = {
                    descricao: item.componente_descricao || '',
                    recurso_code: item.recurso || '—',
                    recurso_nome: item.recurso_nome || item.recurso || '—',
                    roteiro: item.roteiro,
                    qtd_total: 0,
                    tempo_total: 0,
                    ops: [],
                    mtc_codigo: item.mtc_codigo,
                    mtc_descricao: item.mtc_descricao,
                };
            }

            byComponent[comp].qtd_total += parseFloat(item.qtd_necessaria) || 0;
            byComponent[comp].tempo_total += (parseFloat(item.qtd_necessaria) || 0) * (parseFloat(item.tempo_unitario) || 0);
            byComponent[comp].ops.push(item.op_numero);
        });
        return byComponent;
    }, [filteredExplodedData]);

    const handleSave = async () => {
        const toSave = filteredExplodedData.filter(i => selectedOps.has(i.op_numero));
        if (toSave.length === 0) return toast.warning('NENHUM ITEM VÁLIDO SELECIONADO.');

        setSaving(true);
        try {
            const groupedLotes = {};
            
            toSave.forEach(item => {
                const itemGroupId = pieceGroupMap.get(item.op_numero);
                let gName = 'Geral';
                let gCode = 'GERAL';
                
                if (itemGroupId) {
                    const g = groups.find(x => String(x.id) === String(itemGroupId));
                    if (g) {
                        gName = g.name;
                        gCode = gName.toUpperCase().replace(/\s+/g, '_').substring(0, 30);
                    }
                }

                const key = String(itemGroupId || 'GERAL');

                if (!groupedLotes[key]) {
                    groupedLotes[key] = {
                        recurso: gName,
                        material_codigo: gCode,
                        material_descricao: `Lote Agrupado: ${gName}`,
                        observacao: observation,
                        items: []
                    };
                }
                groupedLotes[key].items.push(item);
            });

            const res = await api.post('/corte/lotes', { 
                lotes: Object.values(groupedLotes), 
                usuario, 
                gerar_planilha: gerarPlanilha,
                lpf_codigo: lpfCodigo 
            });
            if (res.data?.success) {
                toast.success('LOTES GERADOS COM SUCESSO!');
                if (onSaveSuccess) onSaveSuccess();
                onClose();
            }
        } catch (err) {
            toast.error('ERRO AO GRAVAR OS LOTES.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    let selectedPiecesCount = 0;
    const affectedOrders = new Set();
    filteredExplodedData.forEach(item => {
        if (selectedOps.has(item.op_numero)) {
            selectedPiecesCount += parseFloat(item.qtd_necessaria);
            affectedOrders.add(item.pedido_pai);
        }
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
                <MetalfisaHeader 
                    title="Estratégia de Lotes (Plano de Fabricação)" 
                    subtitle="Agrupamento inteligente por Grupos de Recursos"
                    itemsCount={items?.length} 
                    onClose={onClose} 
                />

                <div className="flex flex-col md:flex-row overflow-hidden flex-1 min-h-0">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-indigo-600 bg-slate-50">
                            <Loader2 className="h-10 w-10 animate-spin mb-4" />
                            <p className="font-bold text-sm text-slate-700">PROCESSANDO ESTRUTURAS (BOM)</p>
                            <p className="text-xs text-slate-500 mt-2 font-mono uppercase">{processingStatus}</p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-slate-50">
                            
                            {/* Toolbar */}
                            <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200 overflow-x-auto max-w-[60%]">
                                    <button
                                        onClick={() => setActiveTabId('ALL')}
                                        className={`whitespace-nowrap flex items-center gap-2 px-4 py-1.5 text-xs font-bold transition-all rounded-md ${
                                            activeTabId === 'ALL' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:bg-slate-200/50'
                                        }`}
                                    >
                                        TODAS AS PEÇAS
                                        <span className="bg-slate-200 text-slate-500 px-1.5 py-0.5 text-[10px] rounded-md">{explodedData.length}</span>
                                    </button>
                                    {groups.map(g => {
                                        const gIdStr = String(g.id);
                                        // Use pieceGroupMap for accurate count (mutual exclusivity)
                                        const count = Array.from(pieceGroupMap.values()).filter(v => v === gIdStr).length;
                                        const isActive = String(activeTabId) === gIdStr;
                                        return (
                                            <button
                                                key={g.id}
                                                onClick={() => setActiveTabId(g.id)}
                                                className={`whitespace-nowrap flex items-center gap-2 px-4 py-1.5 text-xs font-bold transition-all rounded-md ${
                                                    isActive ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:bg-slate-200/50'
                                                }`}
                                            >
                                                {g.name}
                                                <span className={`px-1.5 py-0.5 text-[10px] rounded-md ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}

                                </div>

                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setIsGroupManagerOpen(true)}
                                        className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 border border-slate-200 bg-slate-50 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors"
                                    >
                                        <Settings className="w-4 h-4" /> CONFIGURAR ABAS
                                    </button>
                                    <div className="relative w-64">
                                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                                        <input
                                            type="text" value={filterText} onChange={e => setFilterText(e.target.value)}
                                            placeholder="Filtrar chapa ou peça..."
                                            className="w-full pl-9 pr-3 py-2 text-sm bg-white text-slate-700 border border-slate-300 focus:border-indigo-500 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* List Panel */}
                            <div className="flex-1 overflow-auto bg-slate-100 p-3">
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="overflow-auto max-h-[500px]">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="sticky top-0 z-[1]">
                                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                                    <th className="pl-4 py-2 w-10"></th>
                                                    <th className="px-3 py-2 w-28">CÓDIGO</th>
                                                    <th className="px-3 py-2">DESCRIÇÃO</th>
                                                    <th className="px-3 py-2">ROTEIRO</th>
                                                    <th className="px-3 py-2 text-right w-20">TEMPO</th>
                                                    <th className="pr-4 py-2 text-right w-20">QTD</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 bg-white">
                                                {Object.keys(renderItems).length > 0 ? Object.keys(renderItems).sort().map(comp => {
                                                    const c = renderItems[comp];
                                                    const isCompSelected = c.ops.length > 0 && c.ops.every(op => selectedOps.has(op));
                                                    const hasRoteiro = c.roteiro && c.roteiro.trim() !== '';
                                                    return (
                                                        <tr
                                                            key={comp}
                                                            onClick={() => {
                                                                const newSelected = new Set(selectedOps);
                                                                if (isCompSelected) c.ops.forEach(op => newSelected.delete(op));
                                                                else c.ops.forEach(op => newSelected.add(op));
                                                                setSelectedOps(newSelected);
                                                            }}
                                                            className={`cursor-pointer transition-colors ${isCompSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-slate-50'}`}
                                                        >
                                                            <td className="pl-4 py-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isCompSelected}
                                                                    onChange={() => {}}
                                                                    className="w-3.5 h-3.5 border-slate-300 text-indigo-600 rounded"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className={`text-xs font-bold font-mono ${isCompSelected ? 'text-indigo-600' : 'text-slate-700'}`}>{comp || '—'}</span>
                                                            </td>
                                                            <td className="px-3 py-2 text-xs text-slate-600 max-w-[220px] truncate">{c.descricao || <span className="text-slate-300 italic">sem descrição</span>}</td>
                                                            <td className="px-3 py-2">
                                                                {hasRoteiro ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {c.roteiro.split('->').map((r, i) => (
                                                                            <span key={i} className="bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-mono px-1.5 py-0.5 rounded">
                                                                                {r.trim()}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-300 italic">sem roteiro</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-xs text-right text-slate-500 tabular-nums">
                                                                {c.tempo_total > 0 ? c.tempo_total.toFixed(2) : <span className="text-slate-300">—</span>}
                                                            </td>
                                                            <td className="pr-4 py-2 text-right">
                                                                <span className="text-xs font-bold text-emerald-600 tabular-nums">
                                                                    {c.qtd_total.toLocaleString('pt-BR')} UN
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                }) : (
                                                    <tr>
                                                        <td colSpan={7}>
                                                            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                                                <AlertTriangle className="h-8 w-8 mb-3 text-slate-300" />
                                                                <p className="text-sm font-semibold text-slate-500">NENHUMA PEÇA ENCONTRADA NESSE FILTRO</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Inspector */}

                    {!loading && explodedData.length > 0 && (
                        <div className="w-full md:w-[320px] shrink-0 border-l border-slate-200 bg-white flex flex-col p-6 z-10">
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-500" />
                                Resumo da Seleção
                            </h3>
                            
                            <div className="grid grid-cols-1 gap-3 mb-6">
                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Peças Totais</span>
                                    <span className="text-xl font-black text-emerald-600">{selectedPiecesCount.toLocaleString('pt-BR')}</span>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Ordens Afetadas</span>
                                    <span className="text-xl font-black text-slate-700">{affectedOrders.size}</span>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0">
                                <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Observações para Fábrica</h4>
                                <textarea 
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none flex-1 min-h-[120px] placeholder-slate-400"
                                    placeholder="Ex: Liberar urgente para solda..."
                                    value={observation}
                                    onChange={e => setObservation(e.target.value)}
                                />
                            </div>

                            <div className="mt-5 mb-5 flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <input 
                                    type="checkbox" 
                                    checked={gerarPlanilha}
                                    onChange={(e) => setGerarPlanilha(e.target.checked)}
                                    disabled={!canEdit}
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                                />
                                <label className="text-xs font-bold text-slate-700 cursor-pointer uppercase">Imprimir Espelho de Produção</label>
                            </div>

                            {canEdit && (
                                <button 
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-3.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? <><Loader2 className="h-5 w-5 animate-spin" /><span>GERANDO...</span></> : <><CheckCircle className="h-5 w-5" /><span>GERAR LOTE</span></>}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <RoutingGroupManager 
                isOpen={isGroupManagerOpen} 
                onClose={() => setIsGroupManagerOpen(false)} 
                onUpdated={fetchRoutingGroups}
            />
        </div>
    );
}
