import React, { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
    Search, GitFork, ChevronDown, ChevronRight, CheckCircle, Clock,
    AlertTriangle, Package, Wrench, Layers, Calendar, History,
    Play, Filter, X, RefreshCw, Building2, FileText, Info
} from 'lucide-react';
import { getEstruturaPedido, saveAppointment, getAppointmentHistory, getCompanySettings, getProductDocs, getFileUrl } from '../services/api';
import ProductionAppointmentModal from '../components/ProductionAppointmentModal';
import ProductionHistoryModal from '../components/ProductionHistoryModal';
import ProcessLegendModal from '../components/ProcessLegendModal';
import { useTimer } from '../contexts/TimerContext';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (raw) => {
    if (!raw) return '—';
    const s = String(raw).replace(/-/g, '').trim();
    if (s.length === 8) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
    }
    // ISO date
    if (raw instanceof Date || String(raw).includes('T')) {
        const d = new Date(raw);
        if (!isNaN(d)) return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }
    return String(raw).substring(0, 10) || '—';
};

const isVencido = (dateStr) => {
    if (!dateStr) return false;
    const s = String(dateStr).replace(/-/g, '').trim();
    if (s.length !== 8) return false;
    const d = new Date(`${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`);
    return !isNaN(d) && d < new Date();
};

const STATUS_CFG = {
    done:        { label: 'Concluído',    bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300',  dot: 'bg-green-500',  icon: CheckCircle },
    in_progress: { label: 'Em Andamento', bg: 'bg-yellow-50',  text: 'text-yellow-800', border: 'border-yellow-300', dot: 'bg-yellow-400', icon: Clock },
    waiting:     { label: 'Aguardando',   bg: 'bg-slate-100',  text: 'text-slate-500',  border: 'border-slate-200',  dot: 'bg-slate-300',  icon: AlertTriangle },
};

const TIPO_CFG = {
    PI: { bg: 'bg-blue-100',   text: 'text-blue-700' },
    PA: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    MP: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const EMPTY_FILTERS = {
    op: '', pedido: '', produto: '', cliente: '', operacao: '', recurso: '',
    data_inicio: '', data_fim: '', data_entrega_inicio: '', data_entrega_fim: '',
    status: 'Todos', tipo_produto: 'Todos',
};

// ─── Sub-componente: Badge de Status ─────────────────────────────────────────
function StatusBadge({ status, size = 'sm' }) {
    const cfg = STATUS_CFG[status] || STATUS_CFG.waiting;
    const Icon = cfg.icon;
    const px = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
    return (
        <span className={`inline-flex items-center gap-1 rounded-full font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} ${px}`}>
            <Icon className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            {cfg.label}
        </span>
    );
}

// ─── Sub-componente: Barra de Progresso ──────────────────────────────────────
function ProgressBar({ pct, status, height = 'h-2' }) {
    const color = status === 'done' ? 'bg-green-500' : status === 'in_progress' ? 'bg-yellow-400' : 'bg-slate-300';
    return (
        <div className={`w-full bg-slate-100 rounded-full ${height} overflow-hidden`}>
            <div className={`${height} rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct || 0)}%` }} />
        </div>
    );
}

// ─── Sub-componente: Card de Data ─────────────────────────────────────────────
function DateCard({ icon: Icon, label, value, raw, variant = 'default' }) {
    const vencido = variant === 'prazo' && isVencido(raw);
    return (
        <div className={`flex-1 min-w-0 rounded-lg border p-3 ${vencido ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${vencido ? 'text-red-500' : 'text-slate-400'}`} />
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${vencido ? 'text-red-500' : 'text-slate-500'}`}>{label}</span>
            </div>
            <div className={`font-bold text-sm ${vencido ? 'text-red-700' : 'text-slate-800'}`}>
                {value}
                {vencido && <span className="ml-1.5 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-semibold">VENCIDO</span>}
            </div>
        </div>
    );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function BOMAppointmentPage() {
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const [showLegend, setShowLegend] = useState(false);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null); // { pedidos: [], total: 0 }
    const [expandedPedidos, setExpandedPedidos] = useState({});
    const [expandedItens, setExpandedItens] = useState({});
    const [selectedItem, setSelectedItem] = useState(null); // item object
    const [showMateriais, setShowMateriais] = useState(true);
    const [appointingOp, setAppointingOp] = useState(null);
    const [historyTarget, setHistoryTarget] = useState(null);
    const [appointmentMode, setAppointmentMode] = useState('free');

    const processedData = React.useMemo(() => {
        if (!data) return null;
        const newPedidos = data.pedidos.map(p => {
            const itens = p.itens;
            itens.forEach(i => { i.subItens = []; });
            const roots = [];
            itens.forEach(i => {
                let isChild = false;
                for (const parent of itens) {
                    if (parent === i) continue;
                    if (parent.materiais.some(m => m.codigo?.trim() === i.produto?.trim())) {
                        parent.subItens.push(i);
                        isChild = true;
                        break;
                    }
                }
                if (!isChild) roots.push(i);
            });
            return { ...p, treeItens: roots.length > 0 ? roots : itens };
        });
        return { ...data, pedidos: newPedidos };
    }, [data]);

    React.useEffect(() => {
        getCompanySettings()
            .then(d => setAppointmentMode(d?.general_config?.production_appointment_mode || 'free'))
            .catch(() => setAppointmentMode('free'));
    }, []);

    const { timers, startTimer, pauseTimer, getElapsedTime } = useTimer();

    // ── Buscar ─────────────────────────────────────────────────────────────
    const handleSearch = async () => {
        const hasFilter = Object.entries(filters).some(([k, v]) =>
            !['status', 'tipo_produto'].includes(k) && v.trim() !== ''
        );
        if (!hasFilter) {
            toast.warning('Preencha ao menos um filtro antes de buscar.');
            return;
        }
        setLoading(true);
        setSelectedItem(null);
        try {
            const result = await getEstruturaPedido(filters);
            setData(result);
            // Auto-expandir pedidos encontrados
            const exp = {};
            (result.pedidos || []).forEach(p => { exp[p.pedido] = true; });
            setExpandedPedidos(exp);
            if (!result.pedidos?.length) toast.info('Nenhum resultado encontrado.');
        } catch (err) {
            toast.error('Erro ao buscar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter') handleSearch(); };

    const handleClearFilters = () => {
        setFilters(EMPTY_FILTERS);
        setData(null);
        setSelectedItem(null);
    };

    const handleViewDrawing = async (produto) => {
        if (!produto) return;
        const toastId = toast.loading(`Buscando desenhos para ${produto}...`);
        try {
            const docs = await getProductDocs(produto);
            if (!docs || docs.length === 0) {
                toast.update(toastId, { render: `Nenhum desenho técnico cadastrado para o produto ${produto}.`, type: 'warning', isLoading: false, autoClose: 3000 });
                return;
            }
            // Procurar o primeiro desenho PDF
            const drawing = docs.find(d => 
                (d.tipo === 'Desenho' || d.titulo?.toLowerCase().includes('desenho')) && 
                d.url_arquivo?.toLowerCase().endsWith('.pdf')
            ) || docs[0]; // Fallback
            
            if (drawing && drawing.url_arquivo) {
                toast.update(toastId, { render: `Abrindo desenho de ${produto}...`, type: 'success', isLoading: false, autoClose: 1000 });
                window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(drawing.url_arquivo)}`), '_blank');
            } else {
                toast.update(toastId, { render: `Nenhum arquivo de desenho válido encontrado para ${produto}.`, type: 'warning', isLoading: false, autoClose: 3000 });
            }
        } catch (err) {
            toast.update(toastId, { render: 'Erro ao carregar desenhos: ' + err.message, type: 'error', isLoading: false, autoClose: 3000 });
        }
    };

    // ── Seleção de item ────────────────────────────────────────────────────
    const handleSelectItem = (item) => {
        setSelectedItem(item);
    };

    const handleSelectMaterial = (codigo) => {
        let found = null;
        if (data && data.pedidos) {
            for (const p of data.pedidos) {
                for (const it of p.itens) {
                    if (it.produto.trim() === codigo.trim()) {
                        found = it;
                        break;
                    }
                }
                if (found) break;
            }
        }
        if (found) {
            setSelectedItem(found);
            setExpandedPedidos(prev => ({ ...prev, [found.op]: true }));
            setExpandedItens(prev => ({ ...prev, [`${found.op}_${found.item_op}`]: true }));
        } else {
            toast.info(`Não há uma OP filha carregada para o componente ${codigo}. O componente pode não ser fabricado (comprado) ou pertencer a outro pedido.`);
        }
    };

    // ── Toggle expansão ────────────────────────────────────────────────────
    const togglePedido = (num) => setExpandedPedidos(p => ({ ...p, [num]: !p[num] }));
    const toggleItem   = (key) => setExpandedItens(p  => ({ ...p, [key]: !p[key]  }));

    // ── Apontar ────────────────────────────────────────────────────────────
    const handleApontar = (item, recurso) => {
        if (!item) return;
        setAppointingOp({
            op:               item.op,
            item_op:          item.item_op,
            sequen:           item.sequen,
            operacao:         recurso.operac,
            recurso:          recurso.recurso,
            cod_produto_op:   item.produto,
            desc_produto:     item.desc_produto,
            desc_operacao:    `${recurso.operac} - ${recurso.desc_recurso}`,
            qtd_planejada_op: recurso.qtde_planejada,
            qtd_produzida_real: recurso.qtde_produzida,
        });
    };

    const handleAppointmentSaved = useCallback(async (saved) => {
        setAppointingOp(null);
        toast.success('Apontamento salvo!');
        // Refresh apenas o item selecionado (re-fetch completo por ora)
        if (data) handleSearch();
    }, [data]);

    const modeLabel = { sequence: 'Sequência', balance: 'Saldo', free: 'Livre' };
    const modeColor = { sequence: 'bg-blue-50 text-blue-700 border-blue-200', balance: 'bg-amber-50 text-amber-700 border-amber-200', free: 'bg-slate-100 text-slate-500 border-slate-300' };

    return (
        <div className="flex flex-col h-screen max-h-screen overflow-hidden p-4 gap-3 bg-slate-50">

            {/* ── HEADER ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <GitFork className="w-7 h-7 text-blue-600" />
                        Apontamento por Estrutura de Produto
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Visualize a estrutura completa do pedido e faça apontamentos por operação
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {appointmentMode && (
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${modeColor[appointmentMode] || modeColor.free}`}>
                            Modo: {modeLabel[appointmentMode] || 'Livre'}
                        </span>
                    )}
                    <button onClick={() => setShowLegend(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <FileText className="w-3.5 h-3.5" />Legenda
                    </button>
                </div>
            </div>

            {/* ── FILTROS ── */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                {/* Linha principal */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
                    {[
                        { key: 'data_inicio', label: 'Abertura Início', type: 'date' },
                        { key: 'data_fim',    label: 'Abertura Final',  type: 'date' },
                        { key: 'op',          label: 'OP',              type: 'text', ph: 'Ex: 4618, 4619' },
                        { key: 'pedido',      label: 'Pedido',          type: 'text', ph: 'Ex: 4618, 4619' },
                        { key: 'cliente',     label: 'Cliente',         type: 'text', ph: 'Nome...' },
                        { key: 'produto',     label: 'Produto',         type: 'text', ph: 'Código ou desc...' },
                    ].map(f => (
                        <div key={f.key}>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">{f.label}</label>
                            <input
                                type={f.type}
                                placeholder={f.ph}
                                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={filters[f.key]}
                                onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    ))}
                    {/* Operação com Legenda */}
                    <div>
                        <label className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">
                            <span>Operação</span>
                            <button onClick={() => setShowLegend(true)} className="text-blue-500 hover:text-blue-700 normal-case text-[10px] font-normal">(Legenda)</button>
                        </label>
                        <input
                            type="text" placeholder="Cód..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={filters.operacao}
                            onChange={e => setFilters(p => ({ ...p, operacao: e.target.value }))}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    {/* Botão Buscar */}
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-2 font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Buscar
                    </button>
                </div>

                {/* Mais Filtros Toggle */}
                <div className="mt-3 flex items-center gap-3">
                    <button
                        onClick={() => setShowMoreFilters(p => !p)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                        <Filter className="w-3.5 h-3.5" />
                        {showMoreFilters ? '▲ Menos Filtros' : '▼ Mais Filtros'}
                    </button>
                    {Object.entries(filters).some(([k, v]) => v && v !== 'Todos' && v !== '') && (
                        <button onClick={handleClearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600">
                            <X className="w-3.5 h-3.5" /> Limpar Filtros
                        </button>
                    )}
                    {processedData && <span className="text-xs text-slate-400 ml-auto">{processedData.total} itens encontrados</span>}
                </div>

                {/* Linha de Mais Filtros */}
                {showMoreFilters && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                        {[
                            { key: 'data_entrega_inicio', label: 'Entrega Início', type: 'date' },
                            { key: 'data_entrega_fim',    label: 'Entrega Final',  type: 'date' },
                            { key: 'recurso',             label: 'Recurso',        type: 'text', ph: 'MO0013...' },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">{f.label}</label>
                                <input
                                    type={f.type} placeholder={f.ph}
                                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={filters[f.key]}
                                    onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))}
                                    onKeyDown={handleKeyDown}
                                />
                            </div>
                        ))}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">Status</label>
                            <select className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
                                {['Todos','Pendente','Em Andamento','Concluído'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">Tipo Produto</label>
                            <select className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={filters.tipo_produto} onChange={e => setFilters(p => ({ ...p, tipo_produto: e.target.value }))}>
                                {['Todos','PI','PA','MP'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <button onClick={handleClearFilters} className="flex items-center justify-center gap-1 text-sm text-slate-500 border border-slate-200 rounded-lg py-2 hover:bg-slate-50">
                            <X className="w-4 h-4" /> Limpar
                        </button>
                    </div>
                )}
            </div>

            {/* ── CONTEÚDO PRINCIPAL ── */}
            {!processedData && !loading && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-slate-400 py-16">
                        <GitFork className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium">Preencha os filtros e clique em Buscar</p>
                        <p className="text-sm mt-1">Ex: informe o número do Pedido (PV) para ver todos os itens</p>
                    </div>
                </div>
            )}

            {loading && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center py-16">
                        <RefreshCw className="w-12 h-12 mx-auto mb-3 text-blue-500 animate-spin" />
                        <p className="text-slate-500">Carregando estrutura...</p>
                    </div>
                </div>
            )}

            {processedData && !loading && (
                <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <GitFork className="w-5 h-5 text-blue-400" />
                            <span className="font-bold text-base">Árvore Matricial de OPs do Pedido</span>
                        </div>
                        <span className="text-sm text-slate-300 font-medium">{processedData.total} itens</span>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-5 py-3 text-left font-bold text-slate-700 uppercase tracking-wide text-xs w-[250px]">Item da Estrutura</th>
                                    <th className="px-5 py-3 text-left font-bold text-slate-700 uppercase tracking-wide text-xs w-[250px]">Descrição</th>
                                    <th className="px-5 py-3 text-center font-bold text-slate-700 uppercase tracking-wide text-xs w-[120px]">Status</th>
                                    <th className="px-5 py-3 text-center font-bold text-slate-700 uppercase tracking-wide text-xs w-[120px]">Qtd Plan/Prod</th>
                                    <th className="px-5 py-3 text-left font-bold text-slate-700 uppercase tracking-wide text-xs">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {processedData.pedidos.map(pedido => {
                                    
                                    const renderOpItem = (item, level = 0, path = 'root') => {
                                        const iKey = `${pedido.pedido}_${item.op}_${item.item_op}_lvl${level}_${path}`;
                                        const isExpanded = expandedItens[iKey];
                                        const cfg = STATUS_CFG[item.status] || STATUS_CFG.waiting;
                                        const pureMaterials = (item.materiais || []).filter(m => !item.subItens?.some(sub => sub.produto?.trim() === m.codigo?.trim()));
                                        const hasChildren = (item.recursos && item.recursos.length > 0) || (item.subItens && item.subItens.length > 0) || (pureMaterials.length > 0);
                                        
                                        const rows = [];
                                        
                                        // 1. PRODUTO (A linha principal da OP)
                                        rows.push(
                                            <tr key={iKey} className="hover:bg-slate-50 transition-colors group border-b border-slate-100">
                                                <td className="px-5 py-3 cursor-pointer" onClick={() => toggleItem(iKey)} style={{ paddingLeft: `${1.25 + (level * 1.5)}rem` }}>
                                                    <div className="flex items-center gap-2">
                                                        {hasChildren ? (
                                                            <button className="p-0.5 hover:bg-slate-200 rounded text-slate-500 transition-colors">
                                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                        ) : (
                                                            <div className="w-5" />
                                                        )}
                                                        <Package className="w-4 h-4 text-blue-500" />
                                                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                            {item.op}{item.item_op}{item.sequen}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 cursor-pointer" onClick={() => toggleItem(iKey)}>
                                                    <div className="flex items-center justify-between gap-2 max-w-[250px]">
                                                        <div className="font-bold text-slate-800 text-xs hover:text-blue-600 transition-colors">{item.produto}</div>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleViewDrawing(item.produto); }}
                                                            className={`p-1 hover:bg-slate-200 rounded transition-colors ${item.has_pdf ? 'text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 ring-1 ring-red-200/50' : 'text-slate-400 hover:text-blue-600'}`}
                                                            title={item.has_pdf ? "Visualizar Desenho Técnico (PDF disponível)" : "Visualizar Desenho Técnico (PDF não disponível)"}
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 truncate max-w-[220px]" title={item.desc_produto}>{item.desc_produto}</div>
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                        {item.dt_pcp && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded shadow-xs" title="Data prevista pelo PCP (Forecast)">
                                                                <Calendar className="w-3 h-3 text-indigo-600" />
                                                                Data PCP: {fmtDate(item.dt_pcp)}
                                                            </span>
                                                        )}
                                                        {item.dt_entrega_pv && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded" title="Data de Entrega do Pedido de Venda">
                                                                Entrega PV: {fmtDate(item.dt_entrega_pv)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <StatusBadge status={item.status} />
                                                    <div className="mt-1 text-[10px] font-bold text-slate-400">{item.pct_global}% Concluído</div>
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <div className="text-xs">
                                                        <span className="font-bold text-slate-700">{item.qtde}</span>
                                                        <span className="text-slate-300 mx-1">/</span>
                                                        <span className={`font-bold ${item.qtde_feita >= item.qtde ? 'text-green-600' : 'text-blue-600'}`}>{item.qtde_feita}</span>
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 uppercase font-semibold">{item.um}</div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-wider">Estrutura (OP)</span>
                                                </td>
                                            </tr>
                                        );
                                        
                                        if (isExpanded) {
                                            // 2. RECURSOS (Operações)
                                            if (item.recursos && item.recursos.length > 0) {
                                                item.recursos.forEach(r => {
                                                    const rKey = `${iKey}_rec_${r.operac}`;
                                                    rows.push(
                                                        <tr key={rKey} className="bg-slate-50/50 hover:bg-slate-100 transition-colors border-b border-slate-100">
                                                            <td className="px-5 py-2.5 text-xs" style={{ paddingLeft: `${1.25 + ((level + 1) * 1.5)}rem` }}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-5" />
                                                                    <Wrench className="w-3.5 h-3.5 text-slate-400" />
                                                                    <span className="font-mono font-bold text-slate-600">Op {r.operac}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-2.5">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[11px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">{r.recurso}</span>
                                                                    <div className="text-[11px] text-slate-700 font-medium truncate max-w-[200px]" title={r.desc_recurso}>{r.desc_recurso}</div>
                                                                </div>
                                                                {r.data_planejada_inicio && (
                                                                    <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50/80 px-1.5 py-0.5 rounded w-fit border border-blue-200" title="Data Início Planejada pelo Sequenciamento">
                                                                        <Clock className="w-3 h-3 text-blue-600" />
                                                                        Início Plan: {fmtDate(r.data_planejada_inicio)}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-2.5 text-center">
                                                                <StatusBadge status={r.status} size="xs" />
                                                            </td>
                                                            <td className="px-5 py-2.5 text-center">
                                                                <div className="text-[11px]">
                                                                    <span className="font-bold text-slate-600">{r.qtde_planejada}</span>
                                                                    <span className="text-slate-300 mx-1">/</span>
                                                                    <span className={`font-bold ${r.qtde_produzida >= r.qtde_planejada ? 'text-green-600' : 'text-blue-600'}`}>{r.qtde_produzida}</span>
                                                                </div>
                                                                <div className="text-[9px] text-slate-400 font-semibold">{r.pct}%</div>
                                                            </td>
                                                            <td className="px-5 py-2.5">
                                                                <button
                                                                    onClick={() => handleApontar(item, r)}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold shadow-sm transition-colors uppercase tracking-wider"
                                                                >
                                                                    <Play className="w-3 h-3 fill-current" />
                                                                    Apontar
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            }
                                            
                                            // 3. SUB-ITEMS (OPs Filhas)
                                            if (item.subItens && item.subItens.length > 0) {
                                                item.subItens.forEach((child, cIdx) => {
                                                    rows.push(...renderOpItem(child, level + 1, `${path}_c${cIdx}`));
                                                });
                                            }
                                            
                                            // 4. MATERIAIS — separados por tipo
                                            if (pureMaterials.length > 0) {
                                                pureMaterials.forEach((m, idx) => {
                                                    const mKey = `${iKey}_mat_${idx}`;
                                                    const nivelNum = Number(String(m.nivel).replace(/\D/g, '')) || 1;
                                                    const matPadLeft = (level + 1) * 1.5 + (nivelNum > 1 ? (nivelNum - 1) * 1.5 : 0);
                                                    const isProdutoIntermediario = m.tipo === 'PI' || m.tipo === 'PA';
                                                    const piRecursos = isProdutoIntermediario
                                                        ? (item.materiais_roteiro?.[m.codigo] || [])
                                                        : [];
                                                    const piExpanded = expandedItens[mKey];
                                                    const piHasChildren = isProdutoIntermediario && piRecursos.length > 0;

                                                    rows.push(
                                                        <tr key={mKey} className={`${isProdutoIntermediario ? 'bg-blue-50/30 hover:bg-blue-50/60' : 'bg-amber-50/10 hover:bg-amber-50/50'} transition-colors border-b border-slate-100`}>
                                                            <td className="px-5 py-2.5 text-xs" style={{ paddingLeft: `${1.25 + matPadLeft}rem` }}>
                                                                <div className="flex items-center gap-2">
                                                                    {piHasChildren ? (
                                                                        <button
                                                                            className="p-0.5 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                                                                            onClick={() => toggleItem(mKey)}
                                                                        >
                                                                            {piExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                        </button>
                                                                    ) : (
                                                                        <div className="w-5" />
                                                                    )}
                                                                    <Layers className={`w-3.5 h-3.5 ${isProdutoIntermediario ? 'text-blue-500' : 'text-amber-500 opacity-80'}`} />
                                                                    <span className={`font-mono font-bold ${isProdutoIntermediario ? 'text-blue-700' : 'text-amber-700/80'}`}>{m.codigo}</span>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleViewDrawing(m.codigo); }}
                                                                        className={`p-0.5 hover:bg-slate-200 rounded transition-colors ml-auto ${m.has_pdf ? 'text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 ring-1 ring-red-200/50' : 'text-slate-400 hover:text-blue-600'}`}
                                                                        title={m.has_pdf ? "Visualizar Desenho Técnico (PDF disponível)" : "Visualizar Desenho Técnico (PDF não disponível)"}
                                                                    >
                                                                        <FileText className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-2.5">
                                                                <div className="text-[11px] text-slate-700 font-medium truncate max-w-[250px]" title={m.descricao}>{m.descricao}</div>
                                                            </td>
                                                            <td className="px-5 py-2.5 text-center">
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isProdutoIntermediario ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{m.tipo}</span>
                                                            </td>
                                                            <td className="px-5 py-2.5 text-center">
                                                                <div className="text-[11px] font-bold text-slate-600">{m.qtde_total} <span className="font-normal text-[9px] uppercase text-slate-400">{m.um}</span></div>
                                                            </td>
                                                            <td className="px-5 py-2.5">
                                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider border ${isProdutoIntermediario ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-amber-700/60 bg-amber-50 border-amber-100'}`}>
                                                                    {isProdutoIntermediario ? 'PI (Sub-OP)' : 'Comp. BOM'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );

                                                    // Operações do PI (se expandido)
                                                    if (piHasChildren && piExpanded) {
                                                        piRecursos.forEach(r => {
                                                            const rKey = `${mKey}_rec_${r.operac}`;
                                                            rows.push(
                                                                <tr key={rKey} className="bg-blue-50/20 hover:bg-blue-50/50 transition-colors border-b border-blue-100/50">
                                                                    <td className="px-5 py-2" style={{ paddingLeft: `${1.25 + matPadLeft + 1.5}rem` }}>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-5" />
                                                                            <Wrench className="w-3.5 h-3.5 text-slate-400" />
                                                                            <span className="font-mono font-bold text-slate-600 text-xs">Op {r.operac}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-5 py-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[11px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">{r.recurso}</span>
                                                                            <div className="text-[11px] text-slate-700 font-medium truncate max-w-[200px]" title={r.desc_recurso}>{r.desc_recurso}</div>
                                                                        </div>
                                                                        {r.data_planejada_inicio && (
                                                                            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50/80 px-1.5 py-0.5 rounded w-fit border border-blue-200" title="Data Início Planejada">
                                                                                <Clock className="w-3 h-3 text-blue-600" />
                                                                                Início Plan: {fmtDate(r.data_planejada_inicio)}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-5 py-2 text-center">
                                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">—</span>
                                                                    </td>
                                                                    <td className="px-5 py-2 text-center">
                                                                        <div className="text-[11px] font-bold text-slate-600">
                                                                            <span className="text-slate-400 text-[9px]">t: {r.tempo_padrao}h</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-5 py-2">
                                                                        <span className="text-[10px] text-slate-400 italic">Roteiro PI</span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        });
                                                    }
                                                });
                                            }

                                        }
                                        
                                        return rows;
                                    };

                                    return (
                                        <React.Fragment key={pedido.pedido}>
                                            <tr className="bg-slate-800">
                                                <td colSpan={5} className="p-0">
                                                    <button
                                                        onClick={() => togglePedido(pedido.pedido)}
                                                        className="w-full flex items-center justify-between px-5 py-3 text-white hover:bg-slate-700 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {expandedPedidos[pedido.pedido] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                                            <Building2 className="w-5 h-5 text-blue-400" />
                                                            <div className="text-left">
                                                                <div className="font-bold text-sm tracking-wide">PEDIDO: {pedido.pedido}</div>
                                                                <div className="text-xs text-slate-400">{pedido.cliente}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-right">
                                                                <div className="text-sm font-bold">{pedido.pct_global}% Concluído</div>
                                                                <div className="w-32 mt-1">
                                                                    <ProgressBar pct={pedido.pct_global} status={pedido.pct_global >= 100 ? 'done' : pedido.pct_global > 0 ? 'in_progress' : 'waiting'} height="h-1.5" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedPedidos[pedido.pedido] && pedido.treeItens.map((item, idx) => (
                                                <React.Fragment key={`${pedido.pedido}_t_${idx}`}>
                                                    {renderOpItem(item, 0, `r${idx}`)}
                                                </React.Fragment>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── MODAIS ── */}
            {appointingOp && (
                <ProductionAppointmentModal
                    op={appointingOp}
                    onClose={() => setAppointingOp(null)}
                    onSaved={handleAppointmentSaved}
                    timers={timers}
                    startTimer={startTimer}
                    pauseTimer={pauseTimer}
                    getElapsedTime={getElapsedTime}
                />
            )}
            {historyTarget && (
                <ProductionHistoryModal
                    op={historyTarget.op}
                    item={historyTarget.item}
                    sequencia={historyTarget.sequen}
                    operacao={historyTarget.operacao}
                    onClose={() => setHistoryTarget(null)}
                />
            )}
            {showLegend && <ProcessLegendModal onClose={() => setShowLegend(false)} />}
        </div>
    );
}
