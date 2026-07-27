import React, { useState, useEffect, useMemo } from 'react';
import { Search, Calendar, Clock, BarChart3, Layers, ChevronDown, ChevronRight, RefreshCw, Package, AlertCircle } from 'lucide-react';
import api from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
};
const fmtMin  = (m) => `${m.toLocaleString('pt-BR')} min`;
const fmtHora = (h) => `${h.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} h`;
const fmtDias = (d) => `${d} d`;

// Cor por recurso (baseada no código)
const RECURSO_COLORS = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-sky-100 text-sky-800 border-sky-200',
    'bg-cyan-100 text-cyan-800 border-cyan-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
];
let _colorIdx = {};
const getRecursoColor = (cod) => {
    if (!_colorIdx[cod]) {
        const idx = Object.keys(_colorIdx).length % RECURSO_COLORS.length;
        _colorIdx[cod] = RECURSO_COLORS[idx];
    }
    return _colorIdx[cod];
};

// ─── Barra de progresso de período ────────────────────────────────────────────
function PeriodBar({ inicio, fim, globalMin, globalMax }) {
    if (!inicio || !fim || !globalMin || !globalMax) return null;
    const total = globalMax - globalMin || 1;
    const left  = ((new Date(inicio) - globalMin) / total) * 100;
    const width = ((new Date(fim)    - new Date(inicio)) / total) * 100;
    return (
        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden w-full mt-1">
            <div
                className="absolute h-full bg-blue-500 rounded-full opacity-80"
                style={{ left: `${Math.max(0,left)}%`, width: `${Math.max(1,width)}%` }}
            />
        </div>
    );
}

// ─── Linha de recurso ──────────────────────────────────────────────────────────
function RecursoRow({ item, globalMin, globalMax }) {
    const color = getRecursoColor(item.recurso_codigo);
    return (
        <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <td className="px-4 py-2.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>
                    {item.recurso_codigo}
                </span>
            </td>
            <td className="px-4 py-2.5 text-xs text-slate-600 font-mono">{item.produto_codigo || '—'}</td>
            <td className="px-4 py-2.5 text-xs text-slate-700 font-semibold">{fmtDate(item.data_inicio)}</td>
            <td className="px-4 py-2.5 text-xs text-slate-700 font-semibold">{fmtDate(item.data_fim)}</td>
            <td className="px-4 py-2.5 text-xs text-right font-mono text-slate-600">{fmtMin(item.total_minutos)}</td>
            <td className="px-4 py-2.5 text-xs text-right font-mono text-slate-700 font-semibold">{fmtHora(item.total_horas)}</td>
            <td className="px-4 py-2.5 text-xs text-right">
                <span className="bg-slate-800 text-white px-2 py-0.5 rounded-full text-[11px] font-bold">
                    {fmtDias(item.total_dias_planejados)}
                </span>
            </td>
            <td className="px-4 py-2.5 text-center text-xs text-slate-400">{item.total_ops}</td>
            <td className="px-4 py-2.5 min-w-[160px]">
                <PeriodBar inicio={item.data_inicio} fim={item.data_fim} globalMin={globalMin} globalMax={globalMax} />
            </td>
        </tr>
    );
}

// ─── Card de pedido (visão global) ────────────────────────────────────────────
function PedidoCard({ pedido, rows, expanded, onToggle, globalMin, globalMax }) {
    const dataInicio = rows.reduce((m,r) => (!m || r.data_inicio < m ? r.data_inicio : m), null);
    const dataFim    = rows.reduce((m,r) => (!m || r.data_fim    > m ? r.data_fim    : m), null);
    const totalMin   = rows.reduce((s,r) => s + r.total_minutos, 0);
    const totalOps   = rows.reduce((s,r) => s + r.total_ops, 0);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-3">
            {/* Header do pedido */}
            <button
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                onClick={onToggle}
            >
                {expanded ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0"/> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0"/>}
                <Package className="w-4 h-4 text-blue-500 shrink-0"/>
                <span className="font-bold text-slate-800 text-sm font-mono">{pedido}</span>
                <span className="text-xs text-slate-500 ml-1">— {rows.length} recurso{rows.length !== 1 ? 's' : ''} · {totalOps} ops</span>
                <div className="ml-auto flex items-center gap-4 shrink-0">
                    <div className="text-right">
                        <div className="text-[11px] text-slate-400">Início</div>
                        <div className="text-xs font-semibold text-slate-700">{fmtDate(dataInicio)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[11px] text-slate-400">Fim</div>
                        <div className="text-xs font-bold text-blue-700">{fmtDate(dataFim)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[11px] text-slate-400">Total</div>
                        <div className="text-xs font-bold text-slate-800">{fmtHora(parseFloat((totalMin/60).toFixed(1)))} horas</div>
                    </div>
                </div>
            </button>

            {/* Tabela de recursos */}
            {expanded && (
                <div className="border-t border-slate-100">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr className="text-xs text-slate-500 uppercase tracking-wider">
                                <th className="px-4 py-2 text-left">Recurso</th>
                                <th className="px-4 py-2 text-left">Produto</th>
                                <th className="px-4 py-2 text-left">Início</th>
                                <th className="px-4 py-2 text-left">Fim</th>
                                <th className="px-4 py-2 text-right">Minutos</th>
                                <th className="px-4 py-2 text-right">Horas</th>
                                <th className="px-4 py-2 text-right">Dias</th>
                                <th className="px-4 py-2 text-center">Ops</th>
                                <th className="px-4 py-2 text-left min-w-[160px]">Linha do tempo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.sort((a,b) => (a.data_inicio||'').localeCompare(b.data_inicio||'')).map((row,i) => (
                                <RecursoRow key={i} item={row} globalMin={globalMin} globalMax={globalMax} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function ResumoPlanejamentoView({ initialFilter = '' }) {
    const [data, setData]           = useState([]);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState(null);
    const [pedidoFiltro, setPedidoFiltro] = useState(initialFilter);
    const [subView, setSubView]     = useState('individual'); // 'individual' | 'global'
    const [expanded, setExpanded]   = useState({});

    const loadData = async (ped = '') => {
        setLoading(true);
        setError(null);
        _colorIdx = {}; // reset cores
        try {
            const params = ped ? { pedido: ped } : {};
            const res = await api.get('/production/resumo-pedidos', { params });
            setData(res.data || []);
            // Auto-expande o primeiro pedido
            if (res.data?.length > 0) {
                const primeiroGrupo = res.data[0]?.pedido_venda || res.data[0]?.op_numero;
                setExpanded({ [primeiroGrupo]: true });
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(initialFilter); }, [initialFilter]);

    const handleSearch = () => loadData(pedidoFiltro.trim());

    // Agrupa por pedido_venda
    const porPedido = useMemo(() => {
        const groups = {};
        data.forEach(r => {
            const key = r.pedido_venda || r.op_numero;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });
        return groups;
    }, [data]);

    // Range global de datas para a barra de progresso
    const { globalMin, globalMax } = useMemo(() => {
        const datas = data.flatMap(r => [r.data_inicio, r.data_fim].filter(Boolean).map(d => new Date(d).getTime()));
        if (datas.length === 0) return { globalMin: null, globalMax: null };
        let min = datas[0];
        let max = datas[0];
        for (let i = 1; i < datas.length; i++) {
            if (datas[i] < min) min = datas[i];
            if (datas[i] > max) max = datas[i];
        }
        return {
            globalMin: new Date(min),
            globalMax: new Date(max),
        };
    }, [data]);

    // Sumários globais
    const totais = useMemo(() => {
        const pedidos   = new Set(data.map(r => r.pedido_venda || r.op_numero)).size;
        const recursos  = new Set(data.map(r => r.recurso_codigo)).size;
        const minutos   = data.reduce((s,r) => s + r.total_minutos, 0);
        const dataMin   = data.reduce((m,r) => (!m || r.data_inicio < m ? r.data_inicio : m), null);
        const dataMax   = data.reduce((m,r) => (!m || r.data_fim    > m ? r.data_fim    : m), null);
        return { pedidos, recursos, minutos, dataMin, dataMax };
    }, [data]);

    // Visão individual: filtra um pedido específico
    const dadosIndividual = useMemo(() => {
        if (!pedidoFiltro.trim()) return data;
        const f = pedidoFiltro.trim().toLowerCase();
        return data.filter(r => (r.pedido_venda||'').toLowerCase().includes(f) || (r.op_numero||'').toLowerCase().includes(f));
    }, [data, pedidoFiltro]);

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden">

            {/* ── BARRA SUPERIOR ── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                    {/* Busca */}
                    <div className="flex gap-2 items-center">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"/>
                            <input
                                type="text"
                                placeholder="Pedido ou OP (ex: 004618)"
                                value={pedidoFiltro}
                                onChange={e => setPedidoFiltro(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-56 transition-all"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
                            {loading ? 'Carregando...' : 'Buscar'}
                        </button>
                        <button
                            onClick={() => { setPedidoFiltro(''); loadData(); }}
                            className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Todos
                        </button>
                    </div>

                    {/* Sub-view toggle */}
                    <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
                        <button
                            onClick={() => setSubView('individual')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${subView === 'individual' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Package className="w-3.5 h-3.5"/> Por Pedido
                        </button>
                        <button
                            onClick={() => setSubView('global')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${subView === 'global' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Layers className="w-3.5 h-3.5"/> Todos os Pedidos
                        </button>
                    </div>

                    {/* Sumários */}
                    <div className="flex gap-4 shrink-0">
                        {[
                            { icon: <Package className="w-3.5 h-3.5"/>, label: 'Pedidos', value: totais.pedidos },
                            { icon: <BarChart3 className="w-3.5 h-3.5"/>, label: 'Recursos', value: totais.recursos },
                            { icon: <Clock className="w-3.5 h-3.5"/>, label: 'Total Horas', value: `${(totais.minutos/60).toFixed(0)}h` },
                            { icon: <Calendar className="w-3.5 h-3.5"/>, label: 'Conclusão', value: fmtDate(totais.dataMax) },
                        ].map((s,i) => (
                            <div key={i} className="text-center">
                                <div className="flex items-center gap-1 text-slate-400 text-[10px] uppercase tracking-wider justify-center">{s.icon}{s.label}</div>
                                <div className="text-sm font-bold text-slate-800">{s.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── CONTEÚDO ── */}
            <div className="flex-1 min-h-0 overflow-y-auto">

                {error && (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                        <AlertCircle className="w-4 h-4 shrink-0"/>
                        <span>Erro ao carregar: {error}</span>
                    </div>
                )}

                {!loading && !error && data.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                        <Calendar className="w-12 h-12 opacity-30"/>
                        <p className="text-sm font-medium">Nenhum planejamento encontrado.</p>
                        <p className="text-xs">Use o Planejamento Avançado ou o Macro para gerar planos.</p>
                    </div>
                )}

                {/* ── VISÃO: POR PEDIDO (cards expansíveis) ── */}
                {subView === 'global' && !error && (
                    <div>
                        <div className="flex items-center justify-between mb-3 px-1">
                            <span className="text-xs text-slate-500 font-medium">{Object.keys(porPedido).length} pedido(s) com planejamento</span>
                            <button
                                className="text-xs text-blue-600 hover:underline"
                                onClick={() => {
                                    const allKeys = Object.keys(porPedido);
                                    const anyOpen = allKeys.some(k => expanded[k]);
                                    setExpanded(anyOpen ? {} : Object.fromEntries(allKeys.map(k => [k, true])));
                                }}
                            >
                                Expandir / Recolher tudo
                            </button>
                        </div>
                        {Object.entries(porPedido)
                            .sort(([a],[b]) => a.localeCompare(b))
                            .map(([pedido, rows]) => (
                                <PedidoCard
                                    key={pedido}
                                    pedido={pedido}
                                    rows={rows}
                                    expanded={!!expanded[pedido]}
                                    onToggle={() => setExpanded(prev => ({ ...prev, [pedido]: !prev[pedido] }))}
                                    globalMin={globalMin}
                                    globalMax={globalMax}
                                />
                            ))}
                    </div>
                )}

                {/* ── VISÃO: INDIVIDUAL (tabela detalhada) ── */}
                {subView === 'individual' && !error && dadosIndividual.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                {pedidoFiltro ? `Pedido / OP: ${pedidoFiltro}` : 'Todos os registros'} — {dadosIndividual.length} linha(s)
                            </span>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Calendar className="w-3.5 h-3.5"/>
                                <span>{fmtDate(totais.dataMin)} → {fmtDate(totais.dataMax)}</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="text-xs text-slate-500 uppercase tracking-wider">
                                        <th className="px-4 py-2.5 text-left">Pedido</th>
                                        <th className="px-4 py-2.5 text-left">OP</th>
                                        <th className="px-4 py-2.5 text-left">Recurso</th>
                                        <th className="px-4 py-2.5 text-left">Produto</th>
                                        <th className="px-4 py-2.5 text-left">Início Planejado</th>
                                        <th className="px-4 py-2.5 text-left">Fim Planejado</th>
                                        <th className="px-4 py-2.5 text-right">Minutos</th>
                                        <th className="px-4 py-2.5 text-right">Horas</th>
                                        <th className="px-4 py-2.5 text-right">Dias</th>
                                        <th className="px-4 py-2.5 text-center">Ops</th>
                                        <th className="px-4 py-2.5 text-left min-w-[180px]">Linha do tempo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dadosIndividual
                                        .sort((a,b) => {
                                            const pp = (a.pedido_venda||'').localeCompare(b.pedido_venda||'');
                                            if (pp !== 0) return pp;
                                            return (a.data_inicio||'').localeCompare(b.data_inicio||'');
                                        })
                                        .map((row, i) => (
                                            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-2.5 font-bold text-slate-800 font-mono text-xs">{row.pedido_venda || '—'}</td>
                                                <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">{row.op_numero}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getRecursoColor(row.recurso_codigo)}`}>
                                                        {row.recurso_codigo}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs text-slate-600 font-mono">{row.produto_codigo || '—'}</td>
                                                <td className="px-4 py-2.5 text-xs text-slate-700 font-semibold">{fmtDate(row.data_inicio)}</td>
                                                <td className="px-4 py-2.5 text-xs text-slate-700 font-semibold">{fmtDate(row.data_fim)}</td>
                                                <td className="px-4 py-2.5 text-xs text-right font-mono text-slate-600">{fmtMin(row.total_minutos)}</td>
                                                <td className="px-4 py-2.5 text-xs text-right font-mono text-slate-700 font-semibold">{fmtHora(row.total_horas)}</td>
                                                <td className="px-4 py-2.5 text-xs text-right">
                                                    <span className="bg-slate-800 text-white px-2 py-0.5 rounded-full text-[11px] font-bold">
                                                        {fmtDias(row.total_dias_planejados)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-center text-xs text-slate-400">{row.total_ops}</td>
                                                <td className="px-4 py-2.5 min-w-[180px]">
                                                    <PeriodBar inicio={row.data_inicio} fim={row.data_fim} globalMin={globalMin} globalMax={globalMax}/>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
