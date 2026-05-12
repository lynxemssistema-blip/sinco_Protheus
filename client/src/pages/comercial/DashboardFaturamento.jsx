import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, CartesianGrid,
    AreaChart, Area, LineChart, Line
} from 'recharts';
import {
    TrendingUp, FileText, Lock, Filter, RefreshCw,
    CheckCircle2, Clock, XCircle, DollarSign, Hash,
    Users, Package, Calendar, ChevronDown, ChevronUp,
    BarChart2, Activity, AlertCircle, ArrowUpRight, ArrowDownRight,
    Layers, Eye, EyeOff, Download, Target
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/api';

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    'Pendente':    { color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200', icon: Clock,        label: 'Pendente' },
    'Em Análise':  { color: '#3b82f6', bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',  icon: Activity,     label: 'Em Análise' },
    'Aprovado':    { color: '#14b8a6', bg: 'bg-cyan-50',  text: 'text-cyan-700',  border: 'border-cyan-200',icon: CheckCircle2, label: 'Aprovado' },
    'Faturado':    { color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',icon: CheckCircle2, label: 'Faturado' },
    'Cancelado':   { color: '#ef4444', bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',   icon: XCircle,      label: 'Cancelado' },
    'Rejeitado':   { color: '#f97316', bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',icon: XCircle,      label: 'Rejeitado' },
};
const STATUS_COLORS_LIST = Object.values(STATUS_CONFIG).map(s => s.color);

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

const CHART_COLORS = ['#6366f1','#14b8a6','#ec4899','#f59e0b','#10b981','#3b82f6','#14b8a6','#f97316','#2DD4BF','#06b6d4'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMoney  = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtMoneyK = v => {
    const abs = Math.abs(v || 0);
    if (abs >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `R$ ${(v/1_000).toFixed(0)}k`;
    return fmtMoney(v);
};
const fmtNum = v => new Intl.NumberFormat('pt-BR').format(v || 0);
const fmtMes = mes => {
    try { return format(parseISO(`${mes}-01`), 'MMM/yy', { locale: ptBR }); } catch { return mes; }
};
const fmtDia = dia => {
    try { return format(typeof dia === 'string' ? parseISO(dia) : dia, 'dd/MM', { locale: ptBR }); } catch { return dia; }
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const ValueDisplay = ({ value, isMonetary, canView, loading }) => {
    if (loading) return <span className="h-5 w-24 bg-slate-200 rounded animate-pulse inline-block" />;
    if (!canView && isMonetary) {
        return (
            <span className="inline-flex items-center gap-1 text-slate-400 select-none">
                <Lock className="h-3.5 w-3.5" />
                <span className="blur-sm select-none">R$ ••••••</span>
            </span>
        );
    }
    return <span>{isMonetary ? fmtMoneyK(value) : fmtNum(value)}</span>;
};

const KpiCard = ({ label, icon: Icon, color, bg, border, text, qtd_solicitacoes, qtd_itens, valor_total, loading, canViewValues, activeMetric }) => (
    <div className={`rounded-xl border ${border} ${bg} p-4 flex flex-col gap-2 relative overflow-hidden`}>
        <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wide ${text}`}>{label}</span>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center`} style={{ backgroundColor: color + '22' }}>
                <Icon className="h-4 w-4" style={{ color }} />
            </span>
        </div>
        <div className="flex flex-col gap-0.5">
            {activeMetric === 'valor' ? (
                <p className={`text-xl font-bold ${text}`}>
                    <ValueDisplay value={valor_total} isMonetary canView={canViewValues} loading={loading} />
                </p>
            ) : (
                <p className={`text-xl font-bold ${text}`}>
                    {loading ? <span className="h-6 w-16 bg-slate-200 rounded animate-pulse inline-block" /> : fmtNum(qtd_itens)}
                    <span className="text-xs font-normal ml-1">itens</span>
                </p>
            )}
            <p className="text-xs text-slate-500">
                {loading ? '—' : `${fmtNum(qtd_solicitacoes)} solicitaç${qtd_solicitacoes === 1 ? 'ão' : 'ões'}`}
            </p>
        </div>
        <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-full opacity-10" style={{ backgroundColor: color }} />
    </div>
);

const CustomTooltip = ({ active, payload, label, isMonetary, canView }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[160px]">
            <p className="font-semibold text-slate-700 mb-2 truncate max-w-[200px]">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
                        <span className="text-slate-500">{p.name}</span>
                    </span>
                    <span className="font-semibold text-slate-800">
                        {isMonetary && canView ? fmtMoneyK(p.value) : isMonetary ? '••••' : fmtNum(p.value)}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function DashboardFaturamento() {
    const { user, hasPermission, isAdmin } = useAuth();
    const canViewValues = isAdmin || hasPermission('valores_financeiros', 'view');

    // Estado de filtros
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
    const [activeTab, setActiveTab]       = useState('tendencia'); // 'tendencia' | 'agrupamento' | 'diario'

    // Estado de dados
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    // Fetch
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                groupBy:  filters.groupBy,
                ...(filters.dataInicial && { dataInicial: filters.dataInicial }),
                ...(filters.dataFinal   && { dataFinal:   filters.dataFinal }),
                ...(filters.status.length && { status: filters.status.join(',') }),
                ...(filters.cliente     && { cliente: filters.cliente }),
                ...(filters.produto     && { produto: filters.produto }),
            };
            const res = await api.get('/faturamento/dashboard', { params });
            setData(res.data);
        } catch (err) {
            console.error(err);
            setError('Erro ao carregar dashboard. Verifique a conexão.');
            toast.error('Erro ao carregar dashboard de faturamento.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Filtros rápidos ──────────────────────────────────────────────────────
    const applyPeriod = (preset) => {
        const today = new Date();
        let ini, fim = format(today, 'yyyy-MM-dd');
        setActivePeriod(preset.label);
        if (preset.all)   { setFilters(f => ({ ...f, dataInicial: '', dataFinal: '' })); return; }
        if (preset.year)  { ini = format(startOfYear(today), 'yyyy-MM-dd'); }
        else if (preset.months) { ini = format(subMonths(today, preset.months), 'yyyy-MM-dd'); }
        else               { ini = format(subDays(today, preset.days), 'yyyy-MM-dd'); }
        setFilters(f => ({ ...f, dataInicial: ini, dataFinal: fim }));
    };

    const toggleStatus = (s) => {
        setFilters(f => ({
            ...f,
            status: f.status.includes(s) ? f.status.filter(x => x !== s) : [...f.status, s]
        }));
    };

    // ── KPI totais ────────────────────────────────────────────────────────────
    const kpiTotais = useMemo(() => {
        if (!data?.kpis) return {};
        const map = {};
        let total = { qtd_solicitacoes: 0, qtd_itens: 0, qtd_total: 0, valor_total: 0 };
        data.kpis.forEach(r => {
            map[r.status] = r;
            total.qtd_solicitacoes += Number(r.qtd_solicitacoes);
            total.qtd_itens        += Number(r.qtd_itens);
            total.qtd_total        += Number(r.qtd_total);
            total.valor_total      += Number(r.valor_total);
        });
        return { map, total };
    }, [data]);

    // ── Gráfico de tendência mensal (pivô) ────────────────────────────────────
    const trendChartData = useMemo(() => {
        if (!data?.tendenciaMensal) return [];
        const pivot = {};
        data.tendenciaMensal.forEach(r => {
            if (!pivot[r.mes]) pivot[r.mes] = { mes: r.mes, label: fmtMes(r.mes) };
            const val = activeMetric === 'valor' ? Number(r.valor_total) : Number(r.qtd_itens);
            pivot[r.mes][r.status] = (pivot[r.mes][r.status] || 0) + val;
        });
        return Object.values(pivot).sort((a, b) => a.mes.localeCompare(b.mes));
    }, [data?.tendenciaMensal, activeMetric]);

    const trendStatuses = useMemo(() => {
        const s = new Set(data?.tendenciaMensal?.map(r => r.status) || []);
        return [...s];
    }, [data?.tendenciaMensal]);

    // ── Gráfico de agrupamento ────────────────────────────────────────────────
    const agrupChartData = useMemo(() => {
        if (!data?.agrupamento) return [];
        return data.agrupamento.slice(0, 12).map(r => ({
            label: r.label?.length > 22 ? r.label.slice(0, 21) + '…' : (r.label || '—'),
            fullLabel: r.label || '—',
            value: activeMetric === 'valor' ? Number(r.valor_total) : Number(r.qtd_itens),
            qtd_solicitacoes: Number(r.qtd_solicitacoes),
        })).reverse(); // reverso p/ horizontal bar ficar em ordem decrescente
    }, [data?.agrupamento, activeMetric]);

    // ── Gráfico de pizza (status) ─────────────────────────────────────────────
    const pieData = useMemo(() => {
        if (!data?.kpis) return [];
        return data.kpis.map(r => ({
            name:  r.status,
            value: activeMetric === 'valor' ? Number(r.valor_total) : Number(r.qtd_itens),
            color: STATUS_CONFIG[r.status]?.color || '#94a3b8',
        })).filter(r => r.value > 0);
    }, [data?.kpis, activeMetric]);

    // ── Evolução diária ───────────────────────────────────────────────────────
    const dailyChartData = useMemo(() => {
        if (!data?.evolucaoDiaria) return [];
        const pivot = {};
        data.evolucaoDiaria.forEach(r => {
            const dia = fmtDia(r.dia);
            if (!pivot[dia]) pivot[dia] = { label: dia };
            const val = activeMetric === 'valor' ? Number(r.valor_total) : Number(r.qtd_itens);
            pivot[dia][r.status] = (pivot[dia][r.status] || 0) + val;
        });
        return Object.values(pivot);
    }, [data?.evolucaoDiaria, activeMetric]);

    const dailyStatuses = useMemo(() => {
        const s = new Set(data?.evolucaoDiaria?.map(r => r.status) || []);
        return [...s];
    }, [data?.evolucaoDiaria]);

    // ── Taxa de conversão ─────────────────────────────────────────────────────
    const taxaConversao = useMemo(() => {
        if (!kpiTotais.map) return 0;
        const fat  = Number(kpiTotais.map['Faturado']?.qtd_itens   || 0);
        const total = kpiTotais.total?.qtd_itens || 0;
        return total > 0 ? Math.round((fat / total) * 100) : 0;
    }, [kpiTotais]);

    // ─────────────────────────────────────────────────────────────────────────
    const currentGroup = GROUP_OPTIONS.find(g => g.value === filters.groupBy);

    return (
        <div className="p-4 md:p-6 space-y-5 min-h-screen bg-slate-50">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <BarChart2 className="h-5 w-5 text-indigo-600" />
                        Dashboard de Faturamento
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">Visão gerencial de solicitações, pendências e faturamentos</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Toggle métrica */}
                    <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-sm">
                        <button
                            onClick={() => setActiveMetric('qtd')}
                            className={`px-3 py-1.5 flex items-center gap-1.5 font-medium transition-colors ${activeMetric === 'qtd' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Hash className="h-3.5 w-3.5" /> Quantidade
                        </button>
                        <button
                            onClick={() => canViewValues ? setActiveMetric('valor') : toast.warning('Você não tem permissão para visualizar valores financeiros.')}
                            className={`px-3 py-1.5 flex items-center gap-1.5 font-medium transition-colors ${activeMetric === 'valor' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            {canViewValues ? <DollarSign className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                            Valor (R$)
                        </button>
                    </div>
                    <button
                        onClick={() => setShowFilters(f => !f)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Filter className="h-4 w-4" />
                        Filtros
                        {(filters.status.length > 0 || filters.cliente || filters.produto) && (
                            <span className="w-4 h-4 bg-indigo-600 text-white rounded-full text-[10px] flex items-center justify-center">
                                {filters.status.length + (filters.cliente ? 1 : 0) + (filters.produto ? 1 : 0)}
                            </span>
                        )}
                        {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* ── Painel de Filtros ────────────────────────────────────────── */}
            {showFilters && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Período */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Período</label>
                            <div className="flex flex-wrap gap-1.5">
                                {PERIOD_PRESETS.map(p => (
                                    <button
                                        key={p.label}
                                        onClick={() => applyPeriod(p)}
                                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${activePeriod === p.label ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input type="date" value={filters.dataInicial}
                                    onChange={e => { setFilters(f => ({ ...f, dataInicial: e.target.value })); setActivePeriod('custom'); }}
                                    className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-300 outline-none"
                                />
                                <input type="date" value={filters.dataFinal}
                                    onChange={e => { setFilters(f => ({ ...f, dataFinal: e.target.value })); setActivePeriod('custom'); }}
                                    className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-300 outline-none"
                                />
                            </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</label>
                            <div className="flex flex-wrap gap-1.5">
                                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                                    const active = filters.status.includes(key);
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => toggleStatus(key)}
                                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1 ${active ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                            style={active ? { backgroundColor: cfg.color, borderColor: cfg.color } : {}}
                                        >
                                            <cfg.icon className="h-3 w-3" />
                                            {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {filters.status.length > 0 && (
                                <button onClick={() => setFilters(f => ({ ...f, status: [] }))} className="text-xs text-slate-400 hover:text-slate-600">
                                    Limpar filtro de status
                                </button>
                            )}
                        </div>

                        {/* Busca + Agrupamento */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Busca & Agrupamento</label>
                            <input
                                type="text"
                                placeholder="Filtrar por cliente..."
                                value={filters.cliente}
                                onChange={e => setFilters(f => ({ ...f, cliente: e.target.value }))}
                                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-300 outline-none"
                            />
                            <input
                                type="text"
                                placeholder="Filtrar por produto..."
                                value={filters.produto}
                                onChange={e => setFilters(f => ({ ...f, produto: e.target.value }))}
                                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-300 outline-none"
                            />
                            <div className="flex flex-wrap gap-1.5">
                                {GROUP_OPTIONS.map(g => (
                                    <button
                                        key={g.value}
                                        onClick={() => setFilters(f => ({ ...f, groupBy: g.value }))}
                                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1 ${filters.groupBy === g.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
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

            {/* ── Erro ─────────────────────────────────────────────────────── */}
            {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* ── KPI Cards ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {/* Card Total */}
                <div className="col-span-2 md:col-span-3 xl:col-span-2 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-xl p-4 text-white flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Total Geral</span>
                        <Target className="h-5 w-5 opacity-70" />
                    </div>
                    <div>
                        <p className="text-3xl font-bold mt-2">
                            {loading ? <span className="h-8 w-20 bg-white/20 rounded animate-pulse inline-block" /> : fmtNum(kpiTotais.total?.qtd_itens || 0)}
                            <span className="text-sm font-normal ml-1 opacity-70">itens</span>
                        </p>
                        <p className="text-sm opacity-70 mt-1">
                            {loading ? '—' : `${fmtNum(kpiTotais.total?.qtd_solicitacoes || 0)} solicitações`}
                        </p>
                        {canViewValues && (
                            <p className="text-sm font-semibold opacity-90 mt-1">
                                {loading ? '—' : fmtMoneyK(kpiTotais.total?.valor_total || 0)}
                            </p>
                        )}
                        <div className="mt-3 flex items-center gap-2">
                            <div className="flex-1 bg-white/20 rounded-full h-1.5">
                                <div className="bg-white rounded-full h-1.5" style={{ width: `${taxaConversao}%` }} />
                            </div>
                            <span className="text-xs font-bold">{taxaConversao}% faturado</span>
                        </div>
                    </div>
                </div>

                {/* Cards por status */}
                {Object.entries(STATUS_CONFIG).slice(0, 4).map(([key, cfg]) => {
                    const row = kpiTotais.map?.[key];
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
            </div>

            {/* ── Gráficos principais ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                {/* Pizza de status */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                        <Activity className="h-4 w-4 text-indigo-500" />
                        Distribuição por Status
                        <span className="text-xs font-normal text-slate-400 ml-1">({activeMetric === 'valor' ? 'R$' : 'itens'})</span>
                    </h3>
                    {loading ? (
                        <div className="h-56 flex items-center justify-center">
                            <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        </div>
                    ) : pieData.length === 0 ? (
                        <div className="h-56 flex items-center justify-center text-slate-400 text-sm">Sem dados no período</div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                                        paddingAngle={3} dataKey="value"
                                    >
                                        {pieData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-2 text-xs">
                                                <p className="font-semibold" style={{ color: d.color }}>{d.name}</p>
                                                <p className="text-slate-600">
                                                    {activeMetric === 'valor' && canViewValues ? fmtMoney(d.value) : activeMetric === 'valor' ? '••••' : fmtNum(d.value) + ' itens'}
                                                </p>
                                            </div>
                                        );
                                    }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-1 mt-1">
                                {pieData.map(d => {
                                    const total = pieData.reduce((s, r) => s + r.value, 0);
                                    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                                    return (
                                        <div key={d.name} className="flex items-center justify-between text-xs">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                                                <span className="text-slate-600">{d.name}</span>
                                            </span>
                                            <span className="font-semibold text-slate-700">{pct}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Gráfico de agrupamento (barra horizontal) */}
                <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                        <currentGroup.icon className="h-4 w-4 text-indigo-500" />
                        {currentGroup.label}
                        <span className="text-xs font-normal text-slate-400 ml-1">
                            ({activeMetric === 'valor' ? 'R$' : 'itens'}) — Top {agrupChartData.length}
                        </span>
                        {!canViewValues && activeMetric === 'valor' && (
                            <span className="ml-auto flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <Lock className="h-3 w-3" /> Valores ocultados
                            </span>
                        )}
                    </h3>
                    {loading ? (
                        <div className="h-64 flex items-center justify-center">
                            <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        </div>
                    ) : agrupChartData.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Sem dados no período</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={Math.max(200, agrupChartData.length * 30 + 40)}>
                            <BarChart data={agrupChartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                                    tickFormatter={v => activeMetric === 'valor' ? (canViewValues ? fmtMoneyK(v) : '•••') : fmtNum(v)}
                                />
                                <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} width={110} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip isMonetary={activeMetric === 'valor'} canView={canViewValues} />} />
                                <Bar dataKey="value" name={activeMetric === 'valor' ? 'Valor' : 'Itens'} radius={[0, 4, 4, 0]}>
                                    {agrupChartData.map((_, i) => (
                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── Tabs: Tendência / Diário ─────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-200">
                    {[
                        { key: 'tendencia', label: 'Tendência Mensal', icon: TrendingUp },
                        { key: 'diario',    label: 'Últimos 30 Dias',  icon: Activity },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <tab.icon className="h-3.5 w-3.5" />
                            {tab.label}
                        </button>
                    ))}
                    <div className="ml-auto flex items-center px-4 text-xs text-slate-400">
                        {!canViewValues && activeMetric === 'valor' && (
                            <span className="flex items-center gap-1 text-amber-600">
                                <Lock className="h-3 w-3" /> Valores sem permissão
                            </span>
                        )}
                    </div>
                </div>

                <div className="p-4">
                    {activeTab === 'tendencia' && (
                        <>
                            {loading ? (
                                <div className="h-64 flex items-center justify-center">
                                    <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                </div>
                            ) : trendChartData.length === 0 ? (
                                <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Sem dados no período</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={trendChartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                                            tickFormatter={v => activeMetric === 'valor' ? (canViewValues ? fmtMoneyK(v) : '•••') : fmtNum(v)}
                                        />
                                        <Tooltip content={<CustomTooltip isMonetary={activeMetric === 'valor'} canView={canViewValues} />} />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                        {trendStatuses.map((s, i) => (
                                            <Bar key={s} dataKey={s} stackId="a" radius={i === trendStatuses.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                                fill={STATUS_CONFIG[s]?.color || CHART_COLORS[i % CHART_COLORS.length]}
                                            />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </>
                    )}

                    {activeTab === 'diario' && (
                        <>
                            {loading ? (
                                <div className="h-64 flex items-center justify-center">
                                    <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                </div>
                            ) : dailyChartData.length === 0 ? (
                                <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Sem movimentação nos últimos 30 dias</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={dailyChartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                                        <defs>
                                            {dailyStatuses.map((s, i) => (
                                                <linearGradient key={s} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%"  stopColor={STATUS_CONFIG[s]?.color || CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor={STATUS_CONFIG[s]?.color || CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.02} />
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                                            tickFormatter={v => activeMetric === 'valor' ? (canViewValues ? fmtMoneyK(v) : '•••') : fmtNum(v)}
                                        />
                                        <Tooltip content={<CustomTooltip isMonetary={activeMetric === 'valor'} canView={canViewValues} />} />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                        {dailyStatuses.map((s, i) => (
                                            <Area key={s} type="monotone" dataKey={s} stackId="1"
                                                stroke={STATUS_CONFIG[s]?.color || CHART_COLORS[i % CHART_COLORS.length]}
                                                fill={`url(#grad-${i})`}
                                                strokeWidth={2}
                                            />
                                        ))}
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── Tabela de Agrupamento ────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-indigo-500" />
                        Detalhamento — {currentGroup.label}
                    </h3>
                    <span className="text-xs text-slate-400">Top {data?.agrupamento?.length || 0} registros</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">#</th>
                                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">{currentGroup.label}</th>
                                <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Solicitações</th>
                                <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Itens</th>
                                <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Qtd. Total</th>
                                {canViewValues && (
                                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Valor Total</th>
                                )}
                                {canViewValues && (
                                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600">% do Total</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="border-b border-slate-100">
                                        {[...Array(canViewValues ? 7 : 5)].map((__, j) => (
                                            <td key={j} className="px-4 py-2.5">
                                                <div className="h-3.5 bg-slate-100 rounded animate-pulse" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : !data?.agrupamento?.length ? (
                                <tr><td colSpan={canViewValues ? 7 : 5} className="text-center py-8 text-slate-400">Sem dados no período</td></tr>
                            ) : (() => {
                                const totalValor = data.agrupamento.reduce((s, r) => s + Number(r.valor_total), 0);
                                return data.agrupamento.map((row, idx) => {
                                    const pct = totalValor > 0 ? ((Number(row.valor_total) / totalValor) * 100).toFixed(1) : '0.0';
                                    return (
                                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                                            <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[220px] truncate">
                                                {row.label || '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-slate-600">{fmtNum(row.qtd_solicitacoes)}</td>
                                            <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmtNum(row.qtd_itens)}</td>
                                            <td className="px-4 py-2.5 text-right text-slate-600">{fmtNum(Number(row.qtd_total).toFixed(0))}</td>
                                            {canViewValues && (
                                                <td className="px-4 py-2.5 text-right font-semibold text-indigo-700">{fmtMoney(row.valor_total)}</td>
                                            )}
                                            {canViewValues && (
                                                <td className="px-4 py-2.5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <span className="text-slate-500 w-10 text-right">{pct}%</span>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Footer com aviso de permissão ───────────────────────────── */}
            {!canViewValues && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                    <Lock className="h-4 w-4 flex-shrink-0" />
                    <span>Você não tem permissão para visualizar valores financeiros. Solicite ao administrador o acesso à permissão <strong>Visualizar Valores Financeiros (R$)</strong>.</span>
                </div>
            )}
        </div>
    );
}
