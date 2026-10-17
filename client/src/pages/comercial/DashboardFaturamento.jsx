import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, CartesianGrid,
    AreaChart, Area
} from 'recharts';
import {
    TrendingUp, FileText, Lock, Filter, RefreshCw,
    CheckCircle2, Clock, XCircle, DollarSign, Hash,
    Users, Package, Calendar, ChevronDown, ChevronUp,
    BarChart2, Activity, AlertCircle,
    Layers, Target, SlidersHorizontal, X, Check
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { format, subDays, subMonths, startOfYear, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/api';

// ─── Constantes & Paleta Lynx Precision (Anti-Purple Ban) ─────────────────────

const STATUS_CONFIG = {
    'Pendente':  { color: '#d97706', bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200/80', icon: Clock,        label: 'Pendente' },
    'Atendido':  { color: '#0284c7', bg: 'bg-sky-500/10',   text: 'text-sky-700 dark:text-sky-400',     border: 'border-sky-200/80',   icon: CheckCircle2, label: 'Atendido' },
    'Cancelado': { color: '#e11d48', bg: 'bg-rose-500/10',  text: 'text-rose-700 dark:text-rose-400',   border: 'border-rose-200/80',  icon: XCircle,      label: 'Cancelado' },
};

const FATURADO_NF_CONFIG = {
    color: '#059669',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200/80',
    icon: CheckCircle2,
    label: 'Faturado (NF)'
};

const GROUP_OPTIONS = [
    { value: 'cliente',        label: 'Por Cliente',        icon: Users },
    { value: 'produto',        label: 'Por Produto',        icon: Package },
    { value: 'usuario',        label: 'Por Solicitante',    icon: Users },
    { value: 'status',         label: 'Por Status',         icon: Activity },
    { value: 'mes',            label: 'Por Mês',            icon: Calendar },
    { value: 'pedido_cliente', label: 'Por Pedido Cliente', icon: FileText },
];

const PERIOD_PRESETS = [
    { label: '7d',    days: 7 },
    { label: '30d',   days: 30 },
    { label: '3m',    months: 3 },
    { label: '6m',    months: 6 },
    { label: '12m',   months: 12 },
    { label: 'Ano',   year: true },
    { label: 'Tudo',  all: true },
];

// Paleta industrial refinada (Sem tons de roxo/índigo genéricos)
const CHART_COLORS = [
    '#0284c7', // Sky Pro
    '#059669', // Emerald
    '#d97706', // Amber
    '#0f766e', // Teal
    '#ea580c', // Orange
    '#2563eb', // Technical Blue
    '#475569', // Slate
    '#0891b2', // Cyan
    '#65a30d', // Lime Dark
    '#b45309'  // Warm Amber
];

// ─── Formatadores ─────────────────────────────────────────────────────────────

const fmtMoney = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const fmtMoneyK = v => {
    const abs = Math.abs(v || 0);
    if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}k`;
    return fmtMoney(v);
};

const fmtNum = v => new Intl.NumberFormat('pt-BR').format(v || 0);

const fmtMes = mes => {
    try { return format(parseISO(`${mes}-01`), 'MMM/yy', { locale: ptBR }); } catch { return mes; }
};

const fmtDia = dia => {
    try { return format(typeof dia === 'string' ? parseISO(dia) : dia, 'dd/MM', { locale: ptBR }); } catch { return dia; }
};

// ─── Sub-componentes Ergonômicos ──────────────────────────────────────────────

const ValueDisplay = ({ value, isMonetary, canView, loading }) => {
    if (loading) return <span className="h-5 w-24 bg-slate-200 dark:bg-zinc-700 rounded animate-pulse inline-block" />;
    if (!canView && isMonetary) {
        return (
            <span className="inline-flex items-center gap-1 text-slate-400 select-none text-sm">
                <Lock className="h-3.5 w-3.5" />
                <span className="blur-xs select-none">R$ ••••••</span>
            </span>
        );
    }
    return <span className="tabular-nums font-mono font-semibold tracking-tight">{isMonetary ? fmtMoneyK(value) : fmtNum(value)}</span>;
};

// Skeletons estruturados
const SkeletonKpiCard = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-3 shadow-xs animate-pulse">
        <div className="flex items-center justify-between">
            <div className="h-3 w-20 bg-slate-200 rounded" />
            <div className="w-8 h-8 rounded-md bg-slate-100" />
        </div>
        <div className="space-y-1.5 mt-1">
            <div className="h-7 w-28 bg-slate-200 rounded" />
            <div className="h-3.5 w-20 bg-slate-100 rounded" />
        </div>
    </div>
);

const KpiCard = ({ label, icon: Icon, color, bg, border, text, qtd_solicitacoes, qtd_itens, valor_total, loading, canViewValues, activeMetric }) => {
    if (loading) return <SkeletonKpiCard />;

    return (
        <div className={`rounded-lg border ${border} ${bg} p-4 flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-sm hover:translate-y-[-1px]`}>
            <div>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}</span>
                    <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: color + '1a' }}>
                        <Icon className="h-4 w-4" style={{ color }} />
                    </span>
                </div>
                <div className="mt-2.5">
                    <div className="text-2xl font-bold text-slate-900 tracking-tight flex items-baseline gap-1">
                        {activeMetric === 'valor' ? (
                            <ValueDisplay value={valor_total} isMonetary canView={canViewValues} loading={loading} />
                        ) : (
                            <>
                                <span className="tabular-nums font-mono">{fmtNum(qtd_itens)}</span>
                                <span className="text-xs font-medium text-slate-500">itens</span>
                            </>
                        )}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span>{fmtNum(qtd_solicitacoes)} {qtd_solicitacoes === 1 ? 'solicitação' : 'solicitações'}</span>
                        {activeMetric === 'qtd' && canViewValues && valor_total > 0 && (
                            <span className="font-mono tabular-nums text-[11px] font-medium text-slate-600">
                                {fmtMoneyK(valor_total)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="absolute top-0 right-0 w-1 h-full" style={{ backgroundColor: color }} />
        </div>
    );
};

const CustomTooltip = ({ active, payload, label, isMonetary, canView }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-800 text-white rounded-lg shadow-xl px-3.5 py-2.5 text-xs min-w-[180px] z-50">
            <p className="font-medium text-slate-300 mb-2 truncate max-w-[220px] pb-1 border-b border-slate-800">{label}</p>
            <div className="space-y-1.5">
                {payload.map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
                            <span className="text-slate-400 truncate max-w-[120px]">{p.name}</span>
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-white">
                            {isMonetary && canView ? fmtMoneyK(p.value) : isMonetary ? '••••••' : fmtNum(p.value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function DashboardFaturamento() {
    const { hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');

    // Filtros
    const [filters, setFilters] = useState({
        dataInicial: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
        dataFinal:   format(new Date(), 'yyyy-MM-dd'),
        status:      [],
        groupBy:     'cliente',
        cliente:     '',
        produto:     '',
    });
    const [activePeriod, setActivePeriod] = useState('3m');
    const [showFilters, setShowFilters]   = useState(false);
    const [activeMetric, setActiveMetric] = useState('qtd'); // 'qtd' | 'valor'
    const [activeTab, setActiveTab]       = useState('tendencia'); // 'tendencia' | 'diario'

    // Dados e estados de requisição
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    // Contagem de filtros ativos para badge
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (filters.status.length > 0) count += filters.status.length;
        if (filters.cliente.trim()) count += 1;
        if (filters.produto.trim()) count += 1;
        if (activePeriod === 'custom') count += 1;
        return count;
    }, [filters, activePeriod]);

    // Fetch API
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                groupBy:  filters.groupBy,
                ...(filters.dataInicial && { dataInicial: filters.dataInicial }),
                ...(filters.dataFinal   && { dataFinal:   filters.dataFinal }),
                ...(filters.status.length && { status: filters.status.join(',') }),
                ...(filters.cliente.trim() && { cliente: filters.cliente.trim() }),
                ...(filters.produto.trim() && { produto: filters.produto.trim() }),
            };
            const res = await api.get('/faturamento/dashboard', { params });
            setData(res.data);
        } catch (err) {
            console.error(err);
            setError('Falha ao comunicar com o Protheus. Verifique os filtros ou tente novamente.');
            toast.error('Erro ao atualizar dashboard de faturamento.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Manipulação de Período
    const applyPeriod = (preset) => {
        const today = new Date();
        let ini, fim = format(today, 'yyyy-MM-dd');
        setActivePeriod(preset.label);
        if (preset.all) {
            setFilters(f => ({ ...f, dataInicial: '', dataFinal: '' }));
            return;
        }
        if (preset.year) {
            ini = format(startOfYear(today), 'yyyy-MM-dd');
        } else if (preset.months) {
            ini = format(subMonths(today, preset.months), 'yyyy-MM-dd');
        } else {
            ini = format(subDays(today, preset.days), 'yyyy-MM-dd');
        }
        setFilters(f => ({ ...f, dataInicial: ini, dataFinal: fim }));
    };

    const toggleStatus = (s) => {
        setFilters(f => ({
            ...f,
            status: f.status.includes(s) ? f.status.filter(x => x !== s) : [...f.status, s]
        }));
    };

    const resetFilters = () => {
        applyPeriod(PERIOD_PRESETS[2]); // 3m
        setFilters(f => ({
            ...f,
            status: [],
            cliente: '',
            produto: ''
        }));
    };

    // Cálculos de KPIs
    // BUGFIX (IA): Normalização de chaves de status para garantir compatibilidade entre backend (minúsculo) e STATUS_CONFIG (TitleCase)
    const kpiTotais = useMemo(() => {
        if (!data?.kpis) return {};
        const map = {};
        let total = { qtd_solicitacoes: 0, qtd_itens: 0, qtd_total: 0, valor_total: 0 };
        data.kpis.forEach(r => {
            const rawStatus = String(r.status || '').trim();
            const lower = rawStatus.toLowerCase();
            const title = lower.charAt(0).toUpperCase() + lower.slice(1);
            map[rawStatus] = r;
            map[lower] = r;
            map[title] = r;
            total.qtd_solicitacoes += Number(r.qtd_solicitacoes || 0);
            total.qtd_itens        += Number(r.qtd_itens || 0);
            total.qtd_total        += Number(r.qtd_total || 0);
            total.valor_total      += Number(r.valor_total || 0);
        });
        return { map, total };
    }, [data]);

    // Tendência Mensal
    const trendChartData = useMemo(() => {
        if (!data?.tendenciaMensal) return [];
        const pivot = {};
        data.tendenciaMensal.forEach(r => {
            if (!pivot[r.mes]) pivot[r.mes] = { mes: r.mes, label: fmtMes(r.mes) };
            const val = activeMetric === 'valor' ? Number(r.valor_total || 0) : Number(r.qtd_itens || 0);
            pivot[r.mes][r.status] = (pivot[r.mes][r.status] || 0) + val;
        });
        return Object.values(pivot).sort((a, b) => a.mes.localeCompare(b.mes));
    }, [data?.tendenciaMensal, activeMetric]);

    const trendStatuses = useMemo(() => {
        const s = new Set(data?.tendenciaMensal?.map(r => r.status) || []);
        return [...s];
    }, [data?.tendenciaMensal]);

    // Gráfico de Agrupamento
    const agrupChartData = useMemo(() => {
        if (!data?.agrupamento) return [];
        return data.agrupamento.slice(0, 10).map(r => ({
            label: r.label?.length > 20 ? r.label.slice(0, 19) + '…' : (r.label || '—'),
            fullLabel: r.label || '—',
            value: activeMetric === 'valor' ? Number(r.valor_total || 0) : Number(r.qtd_itens || 0),
            qtd_solicitacoes: Number(r.qtd_solicitacoes || 0),
        })).reverse();
    }, [data?.agrupamento, activeMetric]);

    // Donut de Status
    const pieData = useMemo(() => {
        if (!data?.kpis) return [];
        return data.kpis.map(r => {
            const raw = String(r.status || '').trim();
            const title = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
            // BUGFIX (IA): Suporte a cores de status case-insensitive no gráfico Donut
            const color = STATUS_CONFIG[raw]?.color || STATUS_CONFIG[title]?.color || (raw.toLowerCase() === 'faturado' ? FATURADO_NF_CONFIG.color : '#94a3b8');
            return {
                name:  raw,
                value: activeMetric === 'valor' ? Number(r.valor_total || 0) : Number(r.qtd_itens || 0),
                color,
            };
        }).filter(r => r.value > 0);
    }, [data?.kpis, activeMetric]);

    // Evolução Diária
    const dailyChartData = useMemo(() => {
        if (!data?.evolucaoDiaria) return [];
        const pivot = {};
        data.evolucaoDiaria.forEach(r => {
            const dia = fmtDia(r.dia);
            if (!pivot[dia]) pivot[dia] = { label: dia };
            const val = activeMetric === 'valor' ? Number(r.valor_total || 0) : Number(r.qtd_itens || 0);
            pivot[dia][r.status] = (pivot[dia][r.status] || 0) + val;
        });
        return Object.values(pivot);
    }, [data?.evolucaoDiaria, activeMetric]);

    const dailyStatuses = useMemo(() => {
        const s = new Set(data?.evolucaoDiaria?.map(r => r.status) || []);
        return [...s];
    }, [data?.evolucaoDiaria]);

    // Taxa de Conversão em NF
    const taxaConversao = useMemo(() => {
        const fat   = Number(data?.kpiFaturadoNF?.qtd_itens || 0);
        const total = kpiTotais.total?.qtd_itens || 0;
        return total > 0 ? Math.round((fat / total) * 100) : 0;
    }, [data?.kpiFaturadoNF, kpiTotais]);

    const currentGroup = GROUP_OPTIONS.find(g => g.value === filters.groupBy) || GROUP_OPTIONS[0];

    return (
        <div className="p-3.5 sm:p-5 md:p-6 space-y-4 sm:space-y-5 min-h-screen bg-slate-50 text-slate-900">

            {/* ── Header de Controle Principal ─────────────────────────────── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                            <BarChart2 className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                Dashboard de Faturamento
                                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Protheus Sync
                                </span>
                            </h1>
                            <p className="text-xs text-slate-500">Métricas analíticas de solicitações, pendências e faturamentos reais</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* Toggle de Métrica (Quantidade vs Valor) com alvos ergonômicos */}
                    <div className="flex rounded-lg border border-slate-300/80 bg-white p-0.5 text-xs shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setActiveMetric('qtd')}
                            className={`h-10 sm:h-9 px-3 sm:px-3.5 rounded-md flex items-center gap-1.5 font-medium transition-all ${
                                activeMetric === 'qtd'
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                        >
                            <Hash className="h-3.5 w-3.5" />
                            <span>Itens</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (canViewValues) {
                                    setActiveMetric('valor');
                                } else {
                                    toast.warning('Você não possui permissão para visualizar valores monetários.');
                                }
                            }}
                            className={`h-10 sm:h-9 px-3 sm:px-3.5 rounded-md flex items-center gap-1.5 font-medium transition-all ${
                                activeMetric === 'valor'
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                        >
                            {canViewValues ? <DollarSign className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-amber-500" />}
                            <span>Valores (R$)</span>
                        </button>
                    </div>

                    {/* Botão de Filtros com Badge numérico */}
                    <button
                        type="button"
                        onClick={() => setShowFilters(f => !f)}
                        className={`h-10 sm:h-9 flex items-center gap-2 px-3.5 rounded-lg border text-xs font-medium transition-all shadow-2xs ${
                            showFilters
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>Filtros</span>
                        {activeFiltersCount > 0 && (
                            <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                                showFilters ? 'bg-emerald-400 text-slate-950' : 'bg-slate-900 text-white'
                            }`}>
                                {activeFiltersCount}
                            </span>
                        )}
                        {showFilters ? <ChevronUp className="h-3.5 w-3.5 ml-0.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-0.5" />}
                    </button>

                    {/* Botão de Atualizar */}
                    <button
                        type="button"
                        onClick={fetchData}
                        disabled={loading}
                        className="h-10 sm:h-9 flex items-center gap-1.5 px-3.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium transition-all shadow-2xs disabled:opacity-60"
                        title="Atualizar dados do Protheus"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
                        <span className="hidden sm:inline">Atualizar</span>
                    </button>
                </div>
            </div>

            {/* ── Painel de Filtros Adaptativo (Desktop & Mobile) ─────────── */}
            {showFilters && (
                <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-slate-600" />
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Parâmetros de Pesquisa</span>
                        </div>
                        {activeFiltersCount > 0 && (
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                            >
                                <X className="h-3 w-3" /> Limpar filtros
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Período */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Período Predefinido</label>
                            <div className="flex flex-wrap gap-1">
                                {PERIOD_PRESETS.map(p => (
                                    <button
                                        key={p.label}
                                        type="button"
                                        onClick={() => applyPeriod(p)}
                                        className={`h-8 px-2.5 rounded-md text-xs font-medium border transition-colors ${
                                            activePeriod === p.label
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <div>
                                    <span className="text-[10px] text-slate-400 block mb-0.5">Data Inicial</span>
                                    <input
                                        type="date"
                                        value={filters.dataInicial}
                                        onChange={e => { setFilters(f => ({ ...f, dataInicial: e.target.value })); setActivePeriod('custom'); }}
                                        className="w-full h-9 text-xs border border-slate-200 rounded-md px-2.5 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block mb-0.5">Data Final</span>
                                    <input
                                        type="date"
                                        value={filters.dataFinal}
                                        onChange={e => { setFilters(f => ({ ...f, dataFinal: e.target.value })); setActivePeriod('custom'); }}
                                        className="w-full h-9 text-xs border border-slate-200 rounded-md px-2.5 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Status Operacional</label>
                            <div className="flex flex-wrap gap-1.5">
                                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                                    const active = filters.status.includes(key);
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => toggleStatus(key)}
                                            className={`h-9 px-3 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                                active
                                                    ? 'text-white border-transparent shadow-xs'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                            }`}
                                            style={active ? { backgroundColor: cfg.color } : {}}
                                        >
                                            {active ? <Check className="h-3 w-3" /> : <cfg.icon className="h-3 w-3 text-slate-400" />}
                                            {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {filters.status.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFilters(f => ({ ...f, status: [] }))}
                                    className="text-[11px] text-slate-400 hover:text-slate-600 block mt-1"
                                >
                                    Exibir todos os status
                                </button>
                            )}
                        </div>

                        {/* Busca & Agrupamento */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Filtro de Entidade & Visão</label>
                            <div className="space-y-1.5">
                                <input
                                    type="text"
                                    placeholder="Filtrar por nome do cliente..."
                                    value={filters.cliente}
                                    onChange={e => setFilters(f => ({ ...f, cliente: e.target.value }))}
                                    className="w-full h-9 text-xs border border-slate-200 rounded-md px-3 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none"
                                />
                                <input
                                    type="text"
                                    placeholder="Filtrar por código/descrição do produto..."
                                    value={filters.produto}
                                    onChange={e => setFilters(f => ({ ...f, produto: e.target.value }))}
                                    className="w-full h-9 text-xs border border-slate-200 rounded-md px-3 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none"
                                />
                            </div>
                            <div className="flex flex-wrap gap-1 pt-1">
                                {GROUP_OPTIONS.map(g => (
                                    <button
                                        key={g.value}
                                        type="button"
                                        onClick={() => setFilters(f => ({ ...f, groupBy: g.value }))}
                                        className={`h-7 px-2 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                                            filters.groupBy === g.value
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <g.icon className="h-3 w-3" />
                                        {g.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Alerta de Erro ───────────────────────────────────────────── */}
            {error && (
                <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3.5 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span className="flex-1">{error}</span>
                    <button
                        type="button"
                        onClick={fetchData}
                        className="underline font-bold hover:text-rose-900"
                    >
                        Tentar novamente
                    </button>
                </div>
            )}

            {/* ── Cockpit de KPIs (Grid Responsivo de 1 a 5 Colunas) ────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-3.5">

                {/* Card Executivo - Total Geral */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-white flex flex-col justify-between relative shadow-xs">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Solicitado</span>
                            <Target className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="mt-2.5">
                            <p className="text-2xl font-bold tracking-tight text-white flex items-baseline gap-1 font-mono tabular-nums">
                                {loading ? (
                                    <span className="h-7 w-28 bg-slate-800 rounded animate-pulse inline-block" />
                                ) : (
                                    fmtNum(kpiTotais.total?.qtd_itens || 0)
                                )}
                                <span className="text-xs font-normal text-slate-400 ml-1">itens</span>
                            </p>
                            <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                                <span>{fmtNum(kpiTotais.total?.qtd_solicitacoes || 0)} solicitações</span>
                                {canViewValues && (
                                    <span className="font-mono tabular-nums text-slate-300 font-semibold">
                                        {fmtMoneyK(kpiTotais.total?.valor_total || 0)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-800">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-slate-400">Efetivação Protheus</span>
                            <span className="font-mono font-bold text-emerald-400">{taxaConversao}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, taxaConversao))}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Cards por Status Operacional */}
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                    // BUGFIX (IA): Matching resiliente do status pelo nome TitleCase ou minúsculo
                    const row = kpiTotais.map?.[key] || kpiTotais.map?.[key.toLowerCase()];
                    return (
                        <KpiCard
                            key={key}
                            label={cfg.label}
                            icon={cfg.icon}
                            color={cfg.color}
                            bg={cfg.bg}
                            border={cfg.border}
                            text={cfg.text}
                            qtd_solicitacoes={row?.qtd_solicitacoes || 0}
                            qtd_itens={row?.qtd_itens || 0}
                            valor_total={row?.valor_total || 0}
                            loading={loading}
                            canViewValues={canViewValues}
                            activeMetric={activeMetric}
                        />
                    );
                })}

                {/* Card Faturado Efetivo (NF Protheus com fallback para solicitações faturadas) */}
                {(() => {
                    // BUGFIX (IA): Fallback para solicitações com status 'faturado' se kpiFaturadoNF vier zerado
                    const faturadoRow = (data?.kpiFaturadoNF && Number(data.kpiFaturadoNF.qtd_itens) > 0)
                        ? data.kpiFaturadoNF
                        : (kpiTotais.map?.['faturado'] || kpiTotais.map?.['Faturado'] || {});
                    return (
                        <KpiCard
                            label={FATURADO_NF_CONFIG.label}
                            icon={FATURADO_NF_CONFIG.icon}
                            color={FATURADO_NF_CONFIG.color}
                            bg={FATURADO_NF_CONFIG.bg}
                            border={FATURADO_NF_CONFIG.border}
                            text={FATURADO_NF_CONFIG.text}
                            qtd_solicitacoes={faturadoRow?.qtd_solicitacoes || 0}
                            qtd_itens={faturadoRow?.qtd_itens || 0}
                            valor_total={faturadoRow?.valor_total || 0}
                            loading={loading}
                            canViewValues={canViewValues}
                            activeMetric={activeMetric}
                        />
                    );
                })()}
            </div>

            {/* ── Seção de Gráficos e Analytics ───────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                {/* Donut de Distribuição por Status */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Activity className="h-3.5 w-3.5 text-slate-500" />
                                Distribuição de Status
                            </h3>
                            <span className="text-[11px] font-mono text-slate-400">
                                {activeMetric === 'valor' ? 'R$' : 'Itens'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">Proporção relativa no período selecionado</p>
                    </div>

                    {loading ? (
                        <div className="h-56 flex flex-col items-center justify-center gap-2">
                            <div className="w-28 h-28 rounded-full border-4 border-slate-100 border-t-slate-800 animate-spin" />
                            <span className="text-xs text-slate-400">Calculando proporções...</span>
                        </div>
                    ) : pieData.length === 0 ? (
                        <div className="h-56 flex items-center justify-center text-slate-400 text-xs">
                            Nenhum registro encontrado para este filtro.
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row xl:flex-col items-center justify-center gap-4">
                            <div className="w-full h-48 sm:h-52">
                                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={48}
                                            outerRadius={74}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            content={<CustomTooltip isMonetary={activeMetric === 'valor'} canView={canViewValues} />}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Legenda Customizada em Grid Tabular */}
                            <div className="w-full space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                                {pieData.map(d => {
                                    const total = pieData.reduce((s, r) => s + r.value, 0);
                                    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                                    return (
                                        <div key={d.name} className="flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                                                <span className="text-slate-600 font-medium">{d.name}</span>
                                            </span>
                                            <div className="flex items-center gap-2 font-mono tabular-nums">
                                                <span className="text-slate-400 text-[11px]">
                                                    {activeMetric === 'valor' && canViewValues ? fmtMoneyK(d.value) : fmtNum(d.value)}
                                                </span>
                                                <span className="font-bold text-slate-800 w-8 text-right">{pct}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Ranking de Agrupamento (Barra Horizontal) */}
                <div className="xl:col-span-2 bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <currentGroup.icon className="h-3.5 w-3.5 text-slate-500" />
                                Ranking: {currentGroup.label}
                                <span className="text-slate-400 font-normal ml-1">
                                    (Top {agrupChartData.length})
                                </span>
                            </h3>
                            {!canViewValues && activeMetric === 'valor' && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                    <Lock className="h-3 w-3" /> Ocultado por permissão
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 mb-3">Maiores volumes ordenados por grandeza</p>
                    </div>

                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-2">
                            <div className="w-8 h-8 rounded-full border-3 border-slate-200 border-t-slate-800 animate-spin" />
                            <span className="text-xs text-slate-400">Carregando dados agregados...</span>
                        </div>
                    ) : agrupChartData.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                            Nenhum registro encontrado para este agrupamento.
                        </div>
                    ) : (
                        <div className="w-full h-64 sm:h-72">
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                <BarChart
                                    data={agrupChartData}
                                    layout="vertical"
                                    margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
                                >
                                    <CartesianGrid strokeDasharray="2 2" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis
                                        type="number"
                                        tick={{ fontSize: 10, fill: '#64748b' }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={v => activeMetric === 'valor' ? (canViewValues ? fmtMoneyK(v) : '••••') : fmtNum(v)}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="label"
                                        tick={{ fontSize: 10, fill: '#334155' }}
                                        width={110}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        content={<CustomTooltip isMonetary={activeMetric === 'valor'} canView={canViewValues} />}
                                    />
                                    <Bar
                                        dataKey="value"
                                        name={activeMetric === 'valor' ? 'Valor (R$)' : 'Quantidade Itens'}
                                        radius={[0, 4, 4, 0]}
                                    >
                                        {agrupChartData.map((_, i) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Séries Temporais: Tendência Mensal / Diário ─────────────── */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 sm:px-4 bg-slate-50/50">
                    <div className="flex gap-1">
                        {[
                            { key: 'tendencia', label: 'Tendência Mensal', icon: TrendingUp },
                            { key: 'diario',    label: 'Evolução Últimos 30 Dias', icon: Activity },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className={`h-11 px-3 sm:px-4 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
                                    activeTab === tab.key
                                        ? 'border-slate-900 text-slate-900 bg-white shadow-2xs'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <tab.icon className="h-3.5 w-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4">
                    {activeTab === 'tendencia' && (
                        <>
                            {loading ? (
                                <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                                    Carregando série mensal...
                                </div>
                            ) : trendChartData.length === 0 ? (
                                <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                                    Sem dados para o período selecionado.
                                </div>
                            ) : (
                                <div className="w-full h-64 sm:h-72">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                        <BarChart data={trendChartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                            <YAxis
                                                tick={{ fontSize: 10, fill: '#64748b' }}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={v => activeMetric === 'valor' ? (canViewValues ? fmtMoneyK(v) : '••••') : fmtNum(v)}
                                            />
                                            <Tooltip content={<CustomTooltip isMonetary={activeMetric === 'valor'} canView={canViewValues} />} />
                                            {trendStatuses.map((s, i) => (
                                                <Bar
                                                    key={s}
                                                    dataKey={s}
                                                    stackId="statusStack"
                                                    radius={i === trendStatuses.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                                    fill={STATUS_CONFIG[s]?.color || CHART_COLORS[i % CHART_COLORS.length]}
                                                />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'diario' && (
                        <>
                            {loading ? (
                                <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                                    Carregando série diária...
                                </div>
                            ) : dailyChartData.length === 0 ? (
                                <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                                    Sem dados diários no intervalo.
                                </div>
                            ) : (
                                <div className="w-full h-64 sm:h-72">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                        <AreaChart data={dailyChartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                                            <defs>
                                                {dailyStatuses.map((s, i) => {
                                                    const baseColor = STATUS_CONFIG[s]?.color || CHART_COLORS[i % CHART_COLORS.length];
                                                    return (
                                                        <linearGradient key={s} id={`gradientStatus-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor={baseColor} stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor={baseColor} stopOpacity={0.0} />
                                                        </linearGradient>
                                                    );
                                                })}
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                            <YAxis
                                                tick={{ fontSize: 10, fill: '#64748b' }}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={v => activeMetric === 'valor' ? (canViewValues ? fmtMoneyK(v) : '••••') : fmtNum(v)}
                                            />
                                            <Tooltip content={<CustomTooltip isMonetary={activeMetric === 'valor'} canView={canViewValues} />} />
                                            {dailyStatuses.map((s, i) => (
                                                <Area
                                                    key={s}
                                                    type="monotone"
                                                    dataKey={s}
                                                    stackId="dailyStack"
                                                    stroke={STATUS_CONFIG[s]?.color || CHART_COLORS[i % CHART_COLORS.length]}
                                                    fill={`url(#gradientStatus-${i})`}
                                                    strokeWidth={1.5}
                                                />
                                            ))}
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── Tabela de Alta Densidade com Sticky Column para Mobile ───── */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/50 gap-2">
                    <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-slate-700" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Detalhamento: {currentGroup.label}
                        </h3>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                        {data?.agrupamento?.length || 0} registros encontrados
                    </span>
                </div>

                <div className="overflow-x-auto relative">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold">
                                <th className="text-left px-3.5 py-2.5 w-12 sticky left-0 bg-slate-100 z-10">#</th>
                                <th className="text-left px-3.5 py-2.5 min-w-[180px] sticky left-12 bg-slate-100 z-10 shadow-[1px_0_0_rgba(226,232,240,1)]">
                                    {currentGroup.label}
                                </th>
                                <th className="text-right px-3.5 py-2.5">Solicitações</th>
                                <th className="text-right px-3.5 py-2.5">Itens</th>
                                <th className="text-right px-3.5 py-2.5">Qtd. Total</th>
                                {canViewValues && (
                                    <th className="text-right px-3.5 py-2.5 font-bold text-slate-800">Valor Total</th>
                                )}
                                {canViewValues && (
                                    <th className="text-right px-3.5 py-2.5 w-32">% Representatividade</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-3.5 py-3 sticky left-0 bg-white z-10">
                                            <div className="h-3 w-4 bg-slate-200 rounded" />
                                        </td>
                                        <td className="px-3.5 py-3 sticky left-12 bg-white z-10">
                                            <div className="h-3.5 w-36 bg-slate-200 rounded" />
                                        </td>
                                        <td className="px-3.5 py-3 text-right"><div className="h-3 w-12 bg-slate-100 rounded ml-auto" /></td>
                                        <td className="px-3.5 py-3 text-right"><div className="h-3 w-14 bg-slate-100 rounded ml-auto" /></td>
                                        <td className="px-3.5 py-3 text-right"><div className="h-3 w-14 bg-slate-100 rounded ml-auto" /></td>
                                        {canViewValues && (
                                            <td className="px-3.5 py-3 text-right"><div className="h-3 w-20 bg-slate-200 rounded ml-auto" /></td>
                                        )}
                                        {canViewValues && (
                                            <td className="px-3.5 py-3 text-right"><div className="h-3 w-16 bg-slate-100 rounded ml-auto" /></td>
                                        )}
                                    </tr>
                                ))
                            ) : !data?.agrupamento?.length ? (
                                <tr>
                                    <td colSpan={canViewValues ? 7 : 5} className="text-center py-8 text-slate-400">
                                        Nenhum registro encontrado para este filtro.
                                    </td>
                                </tr>
                            ) : (() => {
                                const totalValor = data.agrupamento.reduce((s, r) => s + Number(r.valor_total || 0), 0);
                                return data.agrupamento.map((row, idx) => {
                                    const pct = totalValor > 0 ? ((Number(row.valor_total || 0) / totalValor) * 100).toFixed(1) : '0.0';
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                            {/* Colunas Sticky para manter contexto no mobile */}
                                            <td className="px-3.5 py-2.5 text-slate-400 font-mono sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                                                {idx + 1}
                                            </td>
                                            <td className="px-3.5 py-2.5 font-medium text-slate-800 max-w-[240px] truncate sticky left-12 bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_rgba(226,232,240,1)]">
                                                {row.label || '—'}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-600">
                                                {fmtNum(row.qtd_solicitacoes)}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-800">
                                                {fmtNum(row.qtd_itens)}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-600">
                                                {fmtNum(Number(row.qtd_total || 0).toFixed(0))}
                                            </td>
                                            {canViewValues && (
                                                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                                                    {fmtMoney(row.valor_total)}
                                                </td>
                                            )}
                                            {canViewValues && (
                                                <td className="px-3.5 py-2.5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                            <div className="bg-slate-800 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <span className="font-mono tabular-nums text-[11px] text-slate-500 w-10 text-right">
                                                            {pct}%
                                                        </span>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                        {!loading && !!data?.agrupamento?.length && (
                            <tfoot>
                                <tr className="bg-slate-100/90 border-t-2 border-slate-200 font-bold text-slate-900">
                                    <td className="px-3.5 py-2.5 sticky left-0 bg-slate-100 z-10" />
                                    <td className="px-3.5 py-2.5 sticky left-12 bg-slate-100 z-10 shadow-[1px_0_0_rgba(226,232,240,1)]">
                                        Total Geral
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                                        {fmtNum(kpiTotais.total?.qtd_solicitacoes || 0)}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                                        {fmtNum(kpiTotais.total?.qtd_itens || 0)}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                                        {fmtNum(Number(kpiTotais.total?.qtd_total || 0).toFixed(0))}
                                    </td>
                                    {canViewValues && (
                                        <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-950 font-extrabold">
                                            {fmtMoney(kpiTotais.total?.valor_total)}
                                        </td>
                                    )}
                                    {canViewValues && (
                                        <td className="px-3.5 py-2.5 text-right font-mono text-slate-600">
                                            100.0%
                                        </td>
                                    )}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* ── Aviso de Permissão Financeira ────────────────────────────── */}
            {!canViewValues && (
                <div className="flex items-center gap-2.5 bg-slate-100 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600">
                    <Lock className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>
                        Você está no modo de visualização operacional. Para acessar os valores financeiros em Reais (R$), solicite ao administrador a liberação do perfil financeiro.
                    </span>
                </div>
            )}
        </div>
    );
}
