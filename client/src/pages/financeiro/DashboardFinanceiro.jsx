import React from 'react';
import api from '../../services/api';
import {
    DollarSign, TrendingUp, AlertCircle, CheckCircle2,
    ArrowDownRight, Clock, Box, Search, ChevronDown, ChevronRight, BarChart2, Calendar, Lock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { format, subMonths, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import CompanyFilter from '../../components/CompanyFilter';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, CartesianGrid
} from 'recharts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatMoney = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const formatMoneyShort = (v) => {
    const abs = Math.abs(v || 0);
    if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
    return formatMoney(v);
};

const formatDate = (s) => {
    if (!s || s.length !== 8) return s || '-';
    return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
};

const STATUS_COLOR = { Pago: '#10b981', Aberto: '#f59e0b', Atrasado: '#ef4444' };
const CHART_COLORS = ['#6366f1', '#14b8a6', '#ec4899', '#f59e0b', '#10b981',
    '#3b82f6', '#14b8a6', '#f97316', '#2DD4BF', '#06b6d4'];

// ─── Tooltip customizado ──────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs max-w-[220px]">
            <p className="font-semibold text-slate-700 mb-1 break-words whitespace-normal">{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color }} className="font-medium">
                    {p.name}: {formatMoney(p.value)}
                </p>
            ))}
        </div>
    );
};

// ─── Linha de documento expansível ───────────────────────────────────────────

const DocRow = ({ doc, formatMoney, formatDate, renderStatus }) => {
    const [open, setOpen] = React.useState(false);
    const statusGeral = doc.parcelas.every(p => p.status === 'Pago') ? 'Pago'
        : doc.parcelas.some(p => p.status === 'Atrasado') ? 'Atrasado' : 'Aberto';

    return (
        <>
            <tr
                onClick={() => setOpen(o => !o)}
                className="hover:bg-slate-50 cursor-pointer border-b border-slate-100 group"
            >
                <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                        {open
                            ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                        <div>
                            <span className="font-semibold text-slate-800 text-sm">{doc.titulo}</span>
                            <span className="text-xs text-slate-400 ml-2">{doc.tipo} / {doc.prefixo}</span>
                        </div>
                    </div>
                </td>
                <td className="px-5 py-3 text-sm text-slate-700 max-w-[180px] truncate" title={doc.fornecedor}>
                    {doc.fornecedor}
                </td>
                <td className="px-5 py-3 text-sm text-slate-600 truncate max-w-[150px]" title={doc.natureza_desc}>
                    {doc.natureza_desc}
                    <span className="block text-[11px] text-slate-400 font-mono">{doc.natureza_cod}</span>
                </td>
                <td className="px-5 py-3 text-sm text-slate-500 text-center">{formatDate(doc.data_emissao)}</td>
                <td className="px-5 py-3 text-center">
                    <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {doc.parcelas.length} parcela{doc.parcelas.length > 1 ? 's' : ''}
                    </span>
                </td>
                <td className="px-5 py-3 text-sm font-semibold text-slate-600 text-right">{formatMoney(doc.total_valor)}</td>
                <td className="px-5 py-3 text-sm font-bold text-slate-800 text-right">{formatMoney(doc.total_saldo)}</td>
                <td className="px-5 py-3 text-center">{renderStatus(statusGeral)}</td>
            </tr>
            {open && doc.parcelas.map((p, i) => (
                <tr key={i} className="bg-indigo-50/40 border-b border-indigo-100/50">
                    <td className="pl-14 pr-5 py-2 text-xs text-slate-500">
                        Parcela <span className="font-semibold text-indigo-700">{p.parcela || '—'}</span>
                    </td>
                    <td className="px-5 py-2 text-xs text-slate-500" colSpan={2}>
                        Venc. <span className="font-medium text-slate-700">{formatDate(p.vencimento)}</span>
                    </td>
                    <td className="px-5 py-2 text-xs text-slate-500 text-center">{formatDate(p.data_emissao)}</td>
                    <td />
                    <td className="px-5 py-2 text-xs font-semibold text-slate-600 text-right">{formatMoney(p.valor_original)}</td>
                    <td className="px-5 py-2 text-xs font-bold text-slate-800 text-right">{formatMoney(p.saldo)}</td>
                    <td className="px-5 py-2 text-center">{renderStatus(p.status)}</td>
                </tr>
            ))}
        </>
    );
};

// ─── Componente principal ─────────────────────────────────────────────────────

const DashboardFinanceiro = () => {
    const { hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');
    const [data, setData] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [selectedFiliais, setSelectedFiliais] = React.useState([]);
    const [periodFilter, setPeriodFilter] = React.useState('mes_atual');
    const [customDates, setCustomDates] = React.useState({
        inicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        fim: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    });
    const [filters, setFilters] = React.useState({ busca: '', status: 'TODOS', tipo: 'TODOS', natureza: 'TODOS' });
    const [activeTab, setActiveTab] = React.useState('faturas'); // 'faturas' | 'documentos'

    // ── Carga de dados ──────────────────────────────────────────────────────
    const loadData = React.useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date();
            let dateParams = { inicio: customDates.inicio, fim: customDates.fim };

            if (periodFilter !== 'custom') {
                switch (periodFilter) {
                    case 'semana':
                        dateParams = { inicio: format(startOfWeek(today), 'yyyy-MM-dd'), fim: format(endOfWeek(today), 'yyyy-MM-dd') };
                        break;
                    case 'mes_atual':
                        dateParams = { inicio: format(startOfMonth(today), 'yyyy-MM-dd'), fim: format(endOfMonth(today), 'yyyy-MM-dd') };
                        break;
                    case 'prox_mes':
                        const nextMonth = addMonths(today, 1);
                        dateParams = { inicio: format(startOfMonth(nextMonth), 'yyyy-MM-dd'), fim: format(endOfMonth(nextMonth), 'yyyy-MM-dd') };
                        break;
                    case 'todo_futuro':
                        dateParams = { inicio: format(today, 'yyyy-MM-dd'), fim: format(new Date(today.getFullYear() + 2, 11, 31), 'yyyy-MM-dd') };
                        break;
                    case '2_meses':
                        dateParams = { inicio: format(subMonths(today, 2), 'yyyy-MM-dd'), fim: format(today, 'yyyy-MM-dd') };
                        break;
                    case '6_meses':
                        dateParams = { inicio: format(today, 'yyyy-MM-dd'), fim: format(addMonths(today, 6), 'yyyy-MM-dd') };
                        break;
                    case 'proximo_ano':
                        dateParams = { inicio: format(today, 'yyyy-MM-dd'), fim: format(addMonths(today, 12), 'yyyy-MM-dd') };
                        break;
                    default: break;
                }
                setCustomDates(prev => (prev.inicio === dateParams.inicio && prev.fim === dateParams.fim) ? prev : dateParams);
            }

            const response = await api.get('/financeiro/dashboard', {
                params: {
                    data_inicio: dateParams.inicio,
                    data_fim: dateParams.fim,
                    date_filter_type: activeTab === 'documentos' ? 'emissao' : 'vencimento',
                    filiais: selectedFiliais.join(',')
                },
            });
            setData(response.data);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar dados financeiros.');
        } finally {
            setLoading(false);
        }
    }, [periodFilter, activeTab, customDates, selectedFiliais]);

    React.useEffect(() => {
        if (periodFilter !== 'custom') {
            loadData();
        }
    }, [periodFilter, activeTab, loadData]);

    // ── Filtros ─────────────────────────────────────────────────────────────
    const filteredData = React.useMemo(() => data.filter(item => {
        const matchBusca = !filters.busca ||
            item.fornecedor?.toLowerCase().includes(filters.busca.toLowerCase()) ||
            item.titulo?.toLowerCase().includes(filters.busca.toLowerCase());
        const matchStatus = filters.status === 'TODOS' || item.status === filters.status;
        const matchTipo = filters.tipo === 'TODOS' || item.tipo === filters.tipo;
        const matchNatureza = filters.natureza === 'TODOS' || item.natureza_desc === filters.natureza;
        return matchBusca && matchStatus && matchTipo && matchNatureza;
    }), [data, filters]);

    // ── Totalizadores ───────────────────────────────────────────────────────
    const totals = React.useMemo(() => {
        let comprometido = 0, pago = 0, aPagar = 0, multaJuros = 0, totalAtrasado = 0;
        filteredData.forEach(item => {
            const valor = parseFloat(item.valor_original) || 0;
            const saldo = parseFloat(item.saldo) || 0;
            const mj = (parseFloat(item.multa) || 0) + (parseFloat(item.juros) || 0);
            comprometido += valor;
            aPagar += saldo;
            pago += (valor - saldo);
            multaJuros += mj;
            if (item.status === 'Atrasado') totalAtrasado += saldo;
        });
        return { comprometido, pago, aPagar, multaJuros, totalAtrasado };
    }, [filteredData]);

    // ── Dados dos gráficos ──────────────────────────────────────────────────
    const chartStatus = React.useMemo(() => {
        const map = { Pago: 0, Aberto: 0, Atrasado: 0 };
        filteredData.forEach(item => { map[item.status] = (map[item.status] || 0) + (parseFloat(item.saldo) || 0); });
        return Object.entries(map).map(([name, value]) => ({ name, value })).filter(x => x.value > 0);
    }, [filteredData]);

    const chartNatureza = React.useMemo(() => {
        const map = {};
        filteredData.forEach(item => {
            const key = item.natureza_desc || 'SEM NATUREZA';
            if (!map[key]) map[key] = { name: key, saldo: 0 };
            map[key].saldo += parseFloat(item.saldo) || 0;
        });
        return Object.values(map).sort((a, b) => b.saldo - a.saldo).slice(0, 10);
    }, [filteredData]);

    const chartFornecedor = React.useMemo(() => {
        const map = {};
        filteredData.forEach(item => {
            const key = item.fornecedor || 'SEM FORNECEDOR';
            if (!map[key]) map[key] = { name: key, saldo: 0 };
            map[key].saldo += parseFloat(item.saldo) || 0;
        });
        return Object.values(map).sort((a, b) => b.saldo - a.saldo).slice(0, 10);
    }, [filteredData]);

    const chartTimeline = React.useMemo(() => {
        const map = {};
        filteredData.forEach(item => {
            if (!item.vencimento || item.vencimento.length < 6) return;
            const monthKey = item.vencimento.substring(0, 6);
            if (!map[monthKey]) map[monthKey] = { name: `${monthKey.substring(4, 6)}/${monthKey.substring(0, 4)}`, raw: monthKey, saldo: 0 };
            map[monthKey].saldo += parseFloat(item.saldo) || 0;
        });
        return Object.values(map).sort((a, b) => a.raw.localeCompare(b.raw));
    }, [filteredData]);

    // ── Documentos agrupados com parcelas ───────────────────────────────────
    const documentosAgrupados = React.useMemo(() => {
        const map = {};
        filteredData.forEach(item => {
            const key = `${item.titulo}||${item.prefixo}||${item.tipo}||${item.fornecedor}`;
            if (!map[key]) map[key] = {
                titulo: item.titulo, prefixo: item.prefixo, tipo: item.tipo,
                fornecedor: item.fornecedor, natureza_desc: item.natureza_desc,
                natureza_cod: item.natureza_cod, data_emissao: item.data_emissao,
                parcelas: [], total_valor: 0, total_saldo: 0,
            };
            map[key].parcelas.push(item);
            map[key].total_valor += parseFloat(item.valor_original) || 0;
            map[key].total_saldo += parseFloat(item.saldo) || 0;
        });
        return Object.values(map).sort((a, b) => b.total_valor - a.total_valor);
    }, [filteredData]);

    // ── Opções de dropdowns ─────────────────────────────────────────────────
    const tiposDisponiveis = [...new Set(data.map(i => i.tipo))].filter(Boolean).sort();
    const naturezasDisponiveis = [...new Set(data.map(i => i.natureza_desc))].filter(Boolean).sort();

    // ── Render helpers ──────────────────────────────────────────────────────
    const renderStatus = (status) => {
        if (status === 'Pago') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Pago</span>;
        if (status === 'Atrasado') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />Atraso</span>;
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Aberto</span>;
    };

    // ── JSX ─────────────────────────────────────────────────────────────────
    if (!canViewValues) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-8 text-center">
                <Lock className="w-16 h-16 text-gray-400 mb-4 opacity-50" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Acesso Restrito</h2>
                <p className="text-sm text-gray-500 max-w-md">Você não possui a permissão <strong>valores_financeiros</strong> necessária para visualizar o Dashboard Financeiro.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">

            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
                            <DollarSign className="w-7 h-7 mr-2 text-indigo-600" />
                            Dashboard Financeiro
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5 ml-9">Contas a pagar, projeções e acompanhamento de faturas.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <CompanyFilter 
                            selectedFiliais={selectedFiliais} 
                            onChange={setSelectedFiliais} 
                            defaultAll={true} 
                        />
                        <div className="bg-slate-100 p-1 rounded-lg inline-flex overflow-x-auto max-w-full">
                            {[
                                { id: 'semana', label: 'Semana' },
                                { id: 'mes_atual', label: 'Mês Atual' },
                                { id: 'prox_mes', label: 'Próx. Mês' },
                                { id: '6_meses', label: 'Próx. Semestre' },
                                { id: 'proximo_ano', label: 'Próximo Ano' },
                                { id: 'todo_futuro', label: 'Total' },
                                { id: '2_meses', label: 'Últ. 2 Meses' },
                                { id: 'custom', label: 'Custom' },
                            ].map(f => (
                                <button key={f.id} onClick={() => setPeriodFilter(f.id)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${periodFilter === f.id ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {periodFilter === 'custom' && (
                            <div className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm">
                                <input type="date" value={customDates.inicio} onChange={e => setCustomDates(d => ({ ...d, inicio: e.target.value }))} className="border-none outline-none bg-transparent text-slate-700 font-medium" />
                                <span className="text-slate-400">até</span>
                                <input type="date" value={customDates.fim} onChange={e => setCustomDates(d => ({ ...d, fim: e.target.value }))} className="border-none outline-none bg-transparent text-slate-700 font-medium" />
                                <button onClick={() => loadData()} className="bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 font-medium ml-1">Ir</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Conteúdo scrollável */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

                {/* ── Cards Totalizadores ── */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
                    {[
                        { label: 'Comprometido', value: totals.comprometido, color: 'indigo', Icon: Box },
                        { label: 'Total Pago', value: totals.pago, color: 'emerald', Icon: CheckCircle2 },
                        { label: 'A Pagar (Saldo)', value: totals.aPagar, color: 'blue', Icon: ArrowDownRight },
                        { label: 'Em Atraso', value: totals.totalAtrasado, color: 'red', Icon: AlertCircle },
                        { label: 'Juros e Multas', value: totals.multaJuros, color: 'amber', Icon: TrendingUp },
                    ].map(({ label, value, color, Icon }) => (
                        <div key={label} className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-${color}-300 transition-colors`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-medium text-slate-500">{label}</p>
                                    <h3 className={`text-xl font-bold text-${color}-600 mt-1`}>{formatMoney(value)}</h3>
                                </div>
                                <div className={`p-2 bg-${color}-50 rounded-lg text-${color}-600`}><Icon className="w-5 h-5" /></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Gráficos ── */}
                {!loading && filteredData.length > 0 && (
                    <>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
                            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-500" /> Projeção de Pagamentos por Mês
                            </h3>
                            <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
                                <BarChart data={chartTimeline} margin={{ bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10 }} tickFormatter={formatMoneyShort} axisLine={false} tickLine={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Bar dataKey="saldo" name="Saldo a Pagar" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">

                            {/* Gráfico: Status */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-indigo-500" /> Por Status (Saldo)
                                </h3>
                                <ResponsiveContainer width="100%" height={200} minWidth={1} minHeight={1}>
                                    <PieChart>
                                        <Pie data={chartStatus} dataKey="value" nameKey="name"
                                            cx="50%" cy="50%" outerRadius={70} innerRadius={40}
                                            paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            labelLine={false}>
                                            {chartStatus.map((entry) => (
                                                <Cell key={entry.name} fill={STATUS_COLOR[entry.name] || '#94a3b8'} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(v) => formatMoney(v)} />
                                        <Legend iconType="circle" iconSize={8}
                                            formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Gráfico: Natureza (top 10) */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-indigo-500" /> Top Naturezas (Saldo Aberto)
                                </h3>
                                <ResponsiveContainer width="100%" height={200} minWidth={1} minHeight={1}>
                                    <BarChart data={chartNatureza} layout="vertical" margin={{ left: 0, right: 8 }}>
                                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatMoneyShort} width={60} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100}
                                            tickFormatter={v => v.length > 16 ? v.slice(0, 15) + '…' : v} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Bar dataKey="saldo" name="Saldo" fill="#6366f1" radius={[0, 3, 3, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Gráfico: Fornecedor (top 10) */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-indigo-500" /> Top Fornecedores (Saldo Aberto)
                                </h3>
                                <ResponsiveContainer width="100%" height={200} minWidth={1} minHeight={1}>
                                    <BarChart data={chartFornecedor} layout="vertical" margin={{ left: 0, right: 8 }}>
                                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatMoneyShort} width={60} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100}
                                            tickFormatter={v => v.length > 16 ? v.slice(0, 15) + '…' : v} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Bar dataKey="saldo" name="Saldo" fill="#14b8a6" radius={[0, 3, 3, 0]}>
                                            {chartFornecedor.map((_, i) => (
                                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}

                {/* ── Filtros + Tabela ── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">

                    {/* Filtros */}
                    <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input type="text" placeholder="Buscar fornecedor ou título..."
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                                value={filters.busca} onChange={e => setFilters(f => ({ ...f, busca: e.target.value }))} />
                        </div>

                        <select className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                            value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                            <option value="TODOS">Todos Status</option>
                            <option value="Aberto">Em Aberto</option>
                            <option value="Atrasado">Atrasado</option>
                            <option value="Pago">Pago</option>
                        </select>

                        <select className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                            value={filters.tipo} onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))}>
                            <option value="TODOS">Todos Tipos</option>
                            {tiposDisponiveis.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>

                        <select className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 max-w-[180px]"
                            value={filters.natureza} onChange={e => setFilters(f => ({ ...f, natureza: e.target.value }))}>
                            <option value="TODOS">Todas Naturezas</option>
                            {naturezasDisponiveis.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>

                        {/* Abas */}
                        <div className="ml-auto bg-slate-100 p-1 rounded-lg inline-flex">
                            <button onClick={() => setActiveTab('faturas')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'faturas' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}
                                title="Filtragem referenciada pela data de Vencimento de cada parcela"
                            >
                                Parcelas (Vencimentos)
                            </button>
                            <button onClick={() => setActiveTab('documentos')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'documentos' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}
                                title="Filtragem referenciada pela data de Emissão da Nota de Entrada"
                            >
                                Notas de Entrada (Emissão)
                            </button>
                        </div>
                    </div>

                    {/* ── Tabela de Faturas ── */}
                    {activeTab === 'faturas' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap min-w-max">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        {['Documento', 'Fornecedor', 'Natureza', 'Emissão', 'Vencimento', 'Valor Original', 'Saldo', 'Status'].map((h, i) => (
                                            <th key={h} className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i >= 5 ? 'text-right' : i >= 3 ? 'text-center' : ''}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr><td colSpan={8} className="px-5 py-16 text-center text-slate-400">
                                            <div className="flex flex-col items-center"><div className="h-6 w-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin mb-3" />Carregando...</div>
                                        </td></tr>
                                    ) : filteredData.length === 0 ? (
                                        <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">Nenhuma fatura encontrada.</td></tr>
                                    ) : filteredData.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-5 py-3">
                                                <span className="font-semibold text-slate-800 text-sm">{row.titulo}-{row.parcela}</span>
                                                <span className="block text-xs text-slate-400">{row.tipo} / {row.prefixo}</span>
                                            </td>
                                            <td className="px-5 py-3 text-sm text-slate-700 max-w-[200px] truncate" title={row.fornecedor}>{row.fornecedor}</td>
                                            <td className="px-5 py-3">
                                                <span className="text-sm text-slate-700 truncate max-w-[150px] block" title={row.natureza_desc}>{row.natureza_desc}</span>
                                                <span className="text-[11px] text-slate-400 font-mono">{row.natureza_cod}</span>
                                            </td>
                                            <td className="px-5 py-3 text-sm text-slate-600 text-center">{formatDate(row.data_emissao)}</td>
                                            <td className="px-5 py-3 text-sm text-center">
                                                <span className={row.status === 'Atrasado' ? 'text-red-600 font-bold' : 'text-slate-600'}>{formatDate(row.vencimento)}</span>
                                            </td>
                                            <td className="px-5 py-3 text-sm font-semibold text-slate-600 text-right">{formatMoney(row.valor_original)}</td>
                                            <td className="px-5 py-3 text-sm font-bold text-slate-800 text-right">{formatMoney(row.saldo)}</td>
                                            <td className="px-5 py-3 text-center">{renderStatus(row.status)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── Tabela Por Documento ── */}
                    {activeTab === 'documentos' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap min-w-max">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        {['Documento', 'Fornecedor', 'Natureza', 'Emissão', 'Parcelas', 'Valor Total', 'Saldo Total', 'Status'].map((h, i) => (
                                            <th key={h} className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i >= 5 ? 'text-right' : i >= 3 ? 'text-center' : ''}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={8} className="px-5 py-16 text-center text-slate-400">
                                            <div className="flex flex-col items-center"><div className="h-6 w-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin mb-3" />Carregando...</div>
                                        </td></tr>
                                    ) : documentosAgrupados.length === 0 ? (
                                        <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">Nenhum documento encontrado.</td></tr>
                                    ) : documentosAgrupados.map((doc, i) => (
                                        <DocRow key={i} doc={doc} formatMoney={formatMoney} formatDate={formatDate} renderStatus={renderStatus} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Rodapé da tabela */}
                    {!loading && (
                        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium rounded-b-xl">
                            {activeTab === 'faturas'
                                ? <span>Mostrando <strong className="text-slate-700">{filteredData.length}</strong> fatura(s)</span>
                                : <span><strong className="text-slate-700">{documentosAgrupados.length}</strong> documento(s) · <strong className="text-slate-700">{filteredData.length}</strong> parcela(s)</span>
                            }
                            <span>{formatMoney(totals.aPagar)} em saldo aberto</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardFinanceiro;
