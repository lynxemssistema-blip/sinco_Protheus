import { useState, useEffect, useMemo } from 'react';
import { getFluxoCaixa } from '../../services/api';
import {
    TrendingUp, TrendingDown, DollarSign, Calendar,
    ArrowUpCircle, ArrowDownCircle, ArrowRight,
    Search, Download, AlertTriangle, LineChart as LineChartIcon,
    LayoutList, Users, ChevronDown, ChevronUp, Filter, Target, Building2, FileText, ChevronRight, Lock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import CompanyFilter from '../../components/CompanyFilter';

// ─── Skeleton ──────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
    <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
);

// ─── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        'Atrasado': 'bg-rose-50 text-rose-600 border-rose-200',
        'Aberto':   'bg-amber-50 text-amber-700 border-amber-200',
        'Recebido': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Pago':     'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    const cls = map[status] || 'bg-slate-50 text-slate-500 border-slate-200';
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
            {status || '—'}
        </span>
    );
};

// ─── Export CSV ────────────────────────────────────────────────────────────────
const exportCSV = (rows) => {
    const header = ['Vencimento', 'Tipo', 'Título', 'Entidade', 'Valor (R$)', 'Status'];
    const csvRows = [
        header.join(';'),
        ...rows.map(r => [
            r.vencimento.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1'),
            r.fluxo,
            `"${r.titulo}"`,
            `"${r.entidade}"`,
            String(parseFloat(r.saldo || 0).toFixed(2)).replace('.', ','),
            r.status
        ].join(';'))
    ];
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluxo_caixa_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

const exportEntityCSV = (rows) => {
    const header = ['Entidade', 'A Receber (R$)', 'A Pagar (R$)', 'Saldo Líquido (R$)', 'Títulos'];
    const csvRows = [
        header.join(';'),
        ...rows.map(r => [
            `"${r.entidade}"`,
            String(r.receber.toFixed(2)).replace('.', ','),
            String(r.pagar.toFixed(2)).replace('.', ','),
            String(r.saldo.toFixed(2)).replace('.', ','),
            r.count
        ].join(';'))
    ];
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluxo_por_entidade_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ─── Main Component ────────────────────────────────────────────────────────────
const FluxoCaixa = () => {
    const { hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');
    const [data, setData] = useState({ receber: [], pagar: [] });
    const [loading, setLoading] = useState(true);
    const [initialLoading, setInitialLoading] = useState(true);
    const [selectedFiliais, setSelectedFiliais] = useState([]);
    const [dateRange, setDateRange] = useState({
        inicio: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
        fim: format(addMonths(new Date(), 6), 'yyyy-MM-dd')
    });
    const [tableTab, setTableTab]       = useState('todos');
    const [viewMode, setViewMode]       = useState('titulos'); // 'titulos' | 'entidade'
    const [searchTerm, setSearchTerm]   = useState('');
    const [activePreset, setActivePreset] = useState(null);
    const [sortEntity, setSortEntity]   = useState({ key: 'saldo', dir: 'desc' });
    const [expandedEntity, setExpandedEntity] = useState(null);

    const applyPreset = (preset) => {
        const today = new Date();
        const presets = {
            semana:      { inicio: format(today, 'yyyy-MM-dd'), fim: format(addWeeks(today, 1), 'yyyy-MM-dd') },
            mes:         { inicio: format(startOfMonth(today), 'yyyy-MM-dd'), fim: format(endOfMonth(today), 'yyyy-MM-dd') },
            proximo_mes: { inicio: format(startOfMonth(addMonths(today, 1)), 'yyyy-MM-dd'), fim: format(endOfMonth(addMonths(today, 1)), 'yyyy-MM-dd') },
            semestre:    { inicio: format(today, 'yyyy-MM-dd'), fim: format(addMonths(today, 6), 'yyyy-MM-dd') },
        };
        setActivePreset(preset);
        setDateRange(presets[preset]);
    };

    useEffect(() => { fetchData(); }, [dateRange, selectedFiliais]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getFluxoCaixa({ 
                data_inicio: dateRange.inicio, 
                data_fim: dateRange.fim,
                filiais: (selectedFiliais || []).join(',')
            });
            setData(res && (res.receber || res.pagar) ? res : { receber: [], pagar: [] });
        } catch {
            toast.error('Erro ao carregar dados do fluxo de caixa.');
        } finally {
            setLoading(false);
            setInitialLoading(false);
        }
    };

    const fmt = (val) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    // ── Gráfico (sempre sobre dados brutos, independe de filtro) ───────────────
    const chartData = useMemo(() => {
        const monthlyMap = {};
        const getKey = (d) => (!d || d.length < 6) ? '0000-00' : `${d.substring(0,4)}-${d.substring(4,6)}`;
        [...data.receber.map(i => ({...i,tipo:'RECEBER'})), ...data.pagar.map(i => ({...i,tipo:'PAGAR'}))].forEach(item => {
            const key = getKey(item.vencimento);
            if (!monthlyMap[key]) monthlyMap[key] = { month: key, entrada: 0, saida: 0 };
            const v = parseFloat(item.saldo || 0);
            if (item.tipo === 'RECEBER') monthlyMap[key].entrada += v;
            else monthlyMap[key].saida += v;
        });
        let running = 0;
        return Object.keys(monthlyMap).sort().map(key => {
            const val = monthlyMap[key];
            val.saldoMensal = val.entrada - val.saida;
            running += val.saldoMensal;
            val.acumulado = running;
            const [y, m] = key.split('-');
            try { val.label = format(new Date(parseInt(y), parseInt(m)-1), 'MMM/yy', { locale: ptBR }); } catch { val.label = key; }
            return val;
        });
    }, [data]);

    // ── Linhas filtradas ───────────────────────────────────────────────────────
    const filteredRows = useMemo(() => {
        let rows = tableTab === 'todos' ? [...data.receber, ...data.pagar]
            : tableTab === 'receber'   ? [...data.receber]
            : [...data.pagar];
        rows.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            rows = rows.filter(r => r.entidade?.toLowerCase().includes(q) || r.titulo?.toLowerCase().includes(q));
        }
        return rows;
    }, [data, tableTab, searchTerm]);

    // ── Totais SEMPRE baseados nos filteredRows ────────────────────────────────
    const totals = useMemo(() => {
        const entrada   = filteredRows.filter(r => r.fluxo === 'RECEBER').reduce((a,i) => a + parseFloat(i.saldo||0), 0);
        const saida     = filteredRows.filter(r => r.fluxo === 'PAGAR').reduce((a,i) => a + parseFloat(i.saldo||0), 0);
        const atrasadoR = filteredRows.filter(r => r.fluxo === 'RECEBER' && r.status === 'Atrasado').reduce((a,i) => a + parseFloat(i.saldo||0), 0);
        const atrasadoP = filteredRows.filter(r => r.fluxo === 'PAGAR'   && r.status === 'Atrasado').reduce((a,i) => a + parseFloat(i.saldo||0), 0);
        return { entrada, saida, saldo: entrada - saida, atrasadoR, atrasadoP };
    }, [filteredRows]);

    // ── Agrupamento por entidade ───────────────────────────────────────────────
    const entityRows = useMemo(() => {
        const map = {};
        filteredRows.forEach(r => {
            const key = r.entidade || '(Sem nome)';
            if (!map[key]) map[key] = { entidade: key, receber: 0, pagar: 0, saldo: 0, count: 0, items: [] };
            const v = parseFloat(r.saldo || 0);
            if (r.fluxo === 'RECEBER') map[key].receber += v;
            else map[key].pagar += v;
            map[key].saldo = map[key].receber - map[key].pagar;
            map[key].count++;
            map[key].items.push(r);
        });
        let rows = Object.values(map);
        rows.sort((a, b) => {
            const av = Math.abs(a[sortEntity.key] ?? a.saldo);
            const bv = Math.abs(b[sortEntity.key] ?? b.saldo);
            return sortEntity.dir === 'desc' ? bv - av : av - bv;
        });
        return rows;
    }, [filteredRows, sortEntity]);

    const toggleEntitySort = (key) => {
        setSortEntity(prev => prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
    };

    if (!canViewValues) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-8 text-center">
                <Lock className="w-16 h-16 text-gray-400 mb-4 opacity-50" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Acesso Restrito</h2>
                <p className="text-sm text-gray-500 max-w-md">Você não possui a permissão <strong>valores_financeiros</strong> necessária para visualizar o Fluxo de Caixa.</p>
            </div>
        );
    }

    // ── Skeleton (apenas na carga inicial da tela para não desmontar filtros) ──
    if (initialLoading) {
        return (
            <div className="p-6 bg-slate-50 min-h-screen">
                <Skeleton className="h-10 w-72 mb-2" /><Skeleton className="h-5 w-96 mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">{[1,2,3].map(i=><Skeleton key={i} className="h-36"/>)}</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><Skeleton className="h-96"/><Skeleton className="h-96"/></div>
                <Skeleton className="h-64"/>
            </div>
        );
    }

    const isFiltered = searchTerm.trim() || tableTab !== 'todos';

    return (
        <div className="p-6 bg-slate-50 min-h-screen animate-fadeIn">

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <TrendingUp className="text-indigo-600 w-8 h-8" /> Fluxo de Caixa Consolidado
                    </h1>
                    <p className="text-slate-500 mt-1">Visão integrada de Contas a Receber e Contas a Pagar (ERP Protheus)</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                            { key: 'semana',      label: 'Esta Semana' },
                            { key: 'mes',         label: 'Este Mês' },
                            { key: 'proximo_mes', label: 'Próx. Mês' },
                            { key: 'semestre',    label: 'Semestre' },
                        ].map(p => (
                            <button key={p.key} onClick={() => applyPreset(p.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    activePreset === p.key
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                }`}>{p.label}</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex-wrap">
                        <CompanyFilter 
                            selectedFiliais={selectedFiliais} 
                            onChange={setSelectedFiliais} 
                            defaultAll={true} 
                        />
                        <div className="h-6 w-[1px] bg-slate-200 hidden md:block"></div>
                        <div className="flex items-center gap-2 px-3 border-r border-slate-100">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <input type="date" className="text-sm border-none focus:ring-0 p-0 text-slate-600 font-bold bg-transparent"
                                value={dateRange.inicio}
                                onChange={e => { setActivePreset(null); setDateRange({...dateRange, inicio: e.target.value}); }} />
                        </div>
                        <div className="flex items-center gap-2 px-3">
                            <ArrowRight className="w-4 h-4 text-slate-300" />
                            <input type="date" className="text-sm border-none focus:ring-0 p-0 text-slate-600 font-bold bg-transparent"
                                value={dateRange.fim}
                                onChange={e => { setActivePreset(null); setDateRange({...dateRange, fim: e.target.value}); }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Cards (sempre refletem o filtro atual) ───────────────────── */}
            {isFiltered && (
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 w-fit">
                    <Search className="w-3.5 h-3.5" />
                    Totais calculados sobre {filteredRows.length} título(s) filtrado(s)
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><ArrowUpCircle className="w-20 h-20 text-emerald-600"/></div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total a Receber</span>
                    <h2 className="text-2xl font-black text-emerald-600 mt-1">{fmt(totals.entrada)}</h2>
                    <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full w-fit">
                        <TrendingUp className="w-3 h-3"/> {filteredRows.filter(r=>r.fluxo==='RECEBER').length} títulos
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><ArrowDownCircle className="w-20 h-20 text-rose-600"/></div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total a Pagar</span>
                    <h2 className="text-2xl font-black text-rose-600 mt-1">{fmt(totals.saida)}</h2>
                    <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-full w-fit">
                        <TrendingDown className="w-3 h-3"/> {filteredRows.filter(r=>r.fluxo==='PAGAR').length} títulos
                    </div>
                </div>
                <div className="bg-indigo-600 p-6 rounded-3xl shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20"><DollarSign className="w-20 h-20 text-white"/></div>
                    <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Saldo do Período</span>
                    <h2 className="text-2xl font-black text-white mt-1">{fmt(totals.saldo)}</h2>
                    <div className={`mt-3 text-[11px] font-bold px-3 py-1 rounded-full w-fit ${totals.saldo >= 0 ? 'bg-indigo-400/30 text-white' : 'bg-rose-400/30 text-white'}`}>
                        {totals.saldo >= 0 ? 'Superávit Operacional' : 'Necessidade de Caixa'}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-rose-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><AlertTriangle className="w-20 h-20 text-rose-500"/></div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Em Atraso</span>
                    <h2 className="text-2xl font-black text-rose-600 mt-1">{fmt(totals.atrasadoR + totals.atrasadoP)}</h2>
                    <div className="mt-3 flex flex-col gap-0.5">
                        <span className="text-[10px] text-rose-700 font-semibold">Receber: {fmt(totals.atrasadoR)}</span>
                        <span className="text-[10px] text-rose-500">Pagar: {fmt(totals.atrasadoP)}</span>
                    </div>
                </div>
            </div>

            {/* ── Gráficos ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-w-0">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-600"/> Entradas vs Saídas Mensais
                    </h3>
                    <div className="h-[320px] w-full min-w-0">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={320}>
                                <BarChart data={chartData} margin={{ top:10, right:20, left:0, bottom:5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:'#94a3b8',fontSize:12}} dy={10}/>
                                    <YAxis hide/>
                                    <Tooltip contentStyle={{borderRadius:'16px',border:'none',boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.1)'}} formatter={v=>fmt(v)}/>
                                    <Legend wrapperStyle={{paddingTop:'16px'}}/>
                                    <Bar dataKey="entrada" name="Entradas" fill="#10b981" radius={[6,6,0,0]} barSize={22}/>
                                    <Bar dataKey="saida"   name="Saídas"   fill="#ef4444" radius={[6,6,0,0]} barSize={22}/>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[320px] w-full flex flex-col items-center justify-center text-slate-400 text-xs">
                                <TrendingUp className="w-8 h-8 text-slate-300 mb-2 opacity-50" />
                                <span>Sem movimentações para o período selecionado</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-w-0">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <LineChartIcon className="w-5 h-5 text-indigo-600"/> Evolução do Saldo Acumulado
                    </h3>
                    <div className="h-[320px] w-full min-w-0">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={320}>
                                <AreaChart data={chartData} margin={{ top:10, right:20, left:0, bottom:5 }}>
                                    <defs>
                                        <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:'#94a3b8',fontSize:12}} dy={10}/>
                                    <YAxis hide/>
                                    <Tooltip contentStyle={{borderRadius:'16px',border:'none',boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.1)'}} formatter={v=>fmt(v)}/>
                                    <Area type="monotone" dataKey="acumulado" name="Saldo Acumulado" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSaldo)" dot={{r:4,fill:'#6366f1',strokeWidth:0}} activeDot={{r:6}}/>
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[320px] w-full flex flex-col items-center justify-center text-slate-400 text-xs">
                                <LineChartIcon className="w-8 h-8 text-slate-300 mb-2 opacity-50" />
                                <span>Sem saldo acumulado para o período selecionado</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Tabela / Entidades ────────────────────────────────────────── */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Toolbar */}
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Composição Detalhada</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {viewMode === 'titulos'
                                ? `${filteredRows.length} título(s) exibidos`
                                : `${entityRows.length} entidade(s) agrupadas`}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* View mode toggle */}
                        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                            <button onClick={() => setViewMode('titulos')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode==='titulos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <LayoutList className="w-3.5 h-3.5"/> Títulos
                            </button>
                            <button onClick={() => setViewMode('entidade')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode==='entidade' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Users className="w-3.5 h-3.5"/> Por Entidade
                            </button>
                        </div>
                        {/* Tabs tipo */}
                        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                            {[{key:'todos',label:'Todos'},{key:'receber',label:'A Receber'},{key:'pagar',label:'A Pagar'}].map(tab => (
                                <button key={tab.key} onClick={() => setTableTab(tab.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${tableTab===tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                            <input type="text" placeholder="Buscar entidade ou título..."
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-52"/>
                        </div>
                        {/* Export */}
                        <button
                            onClick={() => viewMode === 'titulos' ? exportCSV(filteredRows) : exportEntityCSV(entityRows)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm">
                            <Download className="w-4 h-4"/> CSV
                        </button>
                    </div>
                </div>

                {/* ── VIEW: TÍTULOS ─────────────────────────────────────────── */}
                {viewMode === 'titulos' && (
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-6 space-y-3">{[...Array(6)].map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
                        ) : filteredRows.length === 0 ? (
                            <div className="py-16 text-center text-slate-400 font-medium">Nenhum título encontrado.</div>
                        ) : (
                            <table className="w-full text-left whitespace-nowrap">
                                <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Vencimento</th>
                                        <th className="px-6 py-4">Tipo</th>
                                        <th className="px-6 py-4">Título</th>
                                        <th className="px-6 py-4">Entidade</th>
                                        <th className="px-6 py-4 text-right">Valor</th>
                                        <th className="px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredRows.map((item, idx) => (
                                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${item.status==='Atrasado' ? 'bg-rose-50/30' : ''}`}>
                                            <td className="px-6 py-3 text-sm font-mono font-bold text-slate-700">
                                                {item.vencimento.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')}
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.fluxo==='RECEBER' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                                                    {item.fluxo}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-sm font-medium text-slate-900">{item.titulo}</td>
                                            <td className="px-6 py-3 text-sm text-slate-500 truncate max-w-[220px]">{item.entidade}</td>
                                            <td className={`px-6 py-3 text-right text-sm font-black ${item.fluxo==='RECEBER' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {fmt(item.saldo)}
                                            </td>
                                            <td className="px-6 py-3"><StatusBadge status={item.status}/></td>
                                        </tr>
                                    ))}
                                </tbody>
                                {/* Rodapé com totais */}
                                <tfoot className="bg-slate-100 border-t-2 border-slate-200 text-sm font-black">
                                    <tr>
                                        <td colSpan={4} className="px-6 py-3 text-slate-600 uppercase text-xs tracking-wider">Totais filtrados</td>
                                        <td className="px-6 py-3 text-right">
                                            <span className="text-emerald-600">{fmt(totals.entrada)}</span>
                                            <span className="text-slate-300 mx-2">/</span>
                                            <span className="text-rose-600">-{fmt(totals.saida)}</span>
                                        </td>
                                        <td className={`px-6 py-3 text-sm font-black ${totals.saldo >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
                                            = {fmt(totals.saldo)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                )}

                {/* ── VIEW: POR ENTIDADE ────────────────────────────────────── */}
                {viewMode === 'entidade' && (
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-6 space-y-3">{[...Array(6)].map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
                        ) : entityRows.length === 0 ? (
                            <div className="py-16 text-center text-slate-400 font-medium">Nenhuma entidade encontrada.</div>
                        ) : (
                            <table className="w-full text-left whitespace-nowrap">
                                <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 w-8"></th>
                                        <th className="px-6 py-4">Entidade</th>
                                        <th className="px-6 py-4 text-right cursor-pointer select-none hover:text-emerald-600 transition-colors"
                                            onClick={() => toggleEntitySort('receber')}>
                                            <span className="flex items-center justify-end gap-1">
                                                A Receber
                                                {sortEntity.key==='receber' ? (sortEntity.dir==='desc' ? <ChevronDown className="w-3 h-3"/> : <ChevronUp className="w-3 h-3"/>) : null}
                                            </span>
                                        </th>
                                        <th className="px-6 py-4 text-right cursor-pointer select-none hover:text-rose-600 transition-colors"
                                            onClick={() => toggleEntitySort('pagar')}>
                                            <span className="flex items-center justify-end gap-1">
                                                A Pagar
                                                {sortEntity.key==='pagar' ? (sortEntity.dir==='desc' ? <ChevronDown className="w-3 h-3"/> : <ChevronUp className="w-3 h-3"/>) : null}
                                            </span>
                                        </th>
                                        <th className="px-6 py-4 text-right cursor-pointer select-none hover:text-indigo-600 transition-colors"
                                            onClick={() => toggleEntitySort('saldo')}>
                                            <span className="flex items-center justify-end gap-1">
                                                Saldo Líquido
                                                {sortEntity.key==='saldo' ? (sortEntity.dir==='desc' ? <ChevronDown className="w-3 h-3"/> : <ChevronUp className="w-3 h-3"/>) : null}
                                            </span>
                                        </th>
                                        <th className="px-6 py-4 text-center">Títulos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {entityRows.map((row) => {
                                        const isExpanded = expandedEntity === row.entidade;
                                        const barMax = Math.max(totals.entrada, totals.saida, 1);
                                        const recPct = Math.min(100, (row.receber / barMax) * 100);
                                        const pagPct = Math.min(100, (row.pagar   / barMax) * 100);
                                        return [
                                            <tr key={row.entidade}
                                                className="hover:bg-slate-50 transition-colors cursor-pointer"
                                                onClick={() => setExpandedEntity(isExpanded ? null : row.entidade)}>
                                                <td className="px-4 py-3 text-center text-slate-400">
                                                    {isExpanded ? <ChevronUp className="w-4 h-4 mx-auto"/> : <ChevronDown className="w-4 h-4 mx-auto"/>}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="font-semibold text-sm text-slate-800 mb-1">{row.entidade}</div>
                                                    {/* mini barra proporcional */}
                                                    <div className="flex gap-1 items-center h-2">
                                                        {row.receber > 0 && <div className="h-2 rounded-full bg-emerald-400 transition-all" style={{width:`${recPct}%`, minWidth:'4px', maxWidth:'120px'}}/>}
                                                        {row.pagar   > 0 && <div className="h-2 rounded-full bg-rose-400 transition-all"    style={{width:`${pagPct}%`, minWidth:'4px', maxWidth:'120px'}}/>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-right font-bold text-emerald-600 text-sm">
                                                    {fmt(row.receber)}
                                                </td>
                                                <td className="px-6 py-3 text-right font-bold text-rose-600 text-sm">
                                                    {fmt(row.pagar)}
                                                </td>
                                                <td className={`px-6 py-3 text-right font-black text-sm ${row.saldo >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
                                                    {fmt(row.saldo)}
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{row.count}</span>
                                                </td>
                                            </tr>,
                                            isExpanded && (
                                                <tr key={`${row.entidade}-detail`}>
                                                    <td colSpan={6} className="px-6 pb-4 pt-0 bg-slate-50/70">
                                                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                                                            <table className="w-full text-xs text-left whitespace-nowrap">
                                                                <thead className="bg-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                                                                    <tr>
                                                                        <th className="px-4 py-2">Vencimento</th>
                                                                        <th className="px-4 py-2">Tipo</th>
                                                                        <th className="px-4 py-2">Título</th>
                                                                        <th className="px-4 py-2 text-right">Valor</th>
                                                                        <th className="px-4 py-2">Status</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                                    {row.items.sort((a,b) => a.vencimento.localeCompare(b.vencimento)).map((item, i) => (
                                                                        <tr key={i} className={`hover:bg-slate-50 ${item.status==='Atrasado' ? 'bg-rose-50/40' : ''}`}>
                                                                            <td className="px-4 py-1.5 font-mono text-slate-600">
                                                                                {item.vencimento.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')}
                                                                            </td>
                                                                            <td className="px-4 py-1.5">
                                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${item.fluxo==='RECEBER' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                                                                                    {item.fluxo}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-4 py-1.5 text-slate-700">{item.titulo}</td>
                                                                            <td className={`px-4 py-1.5 text-right font-bold ${item.fluxo==='RECEBER' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                                {fmt(item.saldo)}
                                                                            </td>
                                                                            <td className="px-4 py-1.5"><StatusBadge status={item.status}/></td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        ];
                                    })}
                                </tbody>
                                {/* Rodapé totais */}
                                <tfoot className="bg-slate-100 border-t-2 border-slate-200 text-sm font-black">
                                    <tr>
                                        <td colSpan={2} className="px-6 py-3 text-slate-600 uppercase text-xs tracking-wider">
                                            {entityRows.length} entidade(s) — {filteredRows.length} título(s)
                                        </td>
                                        <td className="px-6 py-3 text-right text-emerald-600">{fmt(totals.entrada)}</td>
                                        <td className="px-6 py-3 text-right text-rose-600">{fmt(totals.saida)}</td>
                                        <td className={`px-6 py-3 text-right ${totals.saldo >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{fmt(totals.saldo)}</td>
                                        <td className="px-6 py-3 text-center text-slate-500">{filteredRows.length}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FluxoCaixa;
