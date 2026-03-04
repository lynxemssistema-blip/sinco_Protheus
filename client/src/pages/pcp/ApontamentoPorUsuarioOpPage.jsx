import { useState, useEffect, useCallback } from 'react';
import { User, Calendar, ChevronDown, ChevronRight, BarChart2, RefreshCw, AlertCircle, Package } from 'lucide-react';
import api from '../../services/api';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (s) => {
    if (!s) return '—';
    const d = new Date(s + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const PROCESS_COLORS = [
    'bg-sky-100 text-sky-800 border-sky-200',
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-cyan-100 text-cyan-800 border-cyan-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-pink-100 text-pink-800 border-pink-200',
];
const processColor = (idx) => PROCESS_COLORS[idx % PROCESS_COLORS.length];

const USER_BG = [
    'from-sky-500 to-sky-700',
    'from-emerald-500 to-emerald-700',
    'from-amber-500 to-amber-700',
    'from-cyan-500 to-cyan-700',
    'from-rose-500 to-rose-700',
    'from-teal-500 to-teal-700',
    'from-orange-500 to-orange-700',
    'from-pink-500 to-pink-700',
];
const userBg = (idx) => USER_BG[idx % USER_BG.length];

// ─── sub-componentes ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'text-slate-700' }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className={`p-2.5 rounded-lg bg-slate-50 ${color}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
                <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
                {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

function DiaRow({ dia, processColorMap }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-slate-100 last:border-0">
            {/* linha do dia */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
            >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {fmt(dia.data)}
                </span>
                <span className="flex items-center gap-3">
                    {dia.detalhes?.map((p, i) => (
                        <span
                            key={i}
                            className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${processColor(processColorMap[p.identificador] ?? i)}`}
                        >
                            {p.identificador} · {p.total_produzido.toFixed(0)} pç
                        </span>
                    ))}
                    <span className="ml-2 text-sm font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {dia.total_dia.toFixed(0)} pç
                    </span>
                </span>
            </button>

            {/* detalhe do dia */}
            {open && (
                <div className="px-6 pb-3 pt-1 grid gap-2">
                    {dia.detalhes?.map((p, i) => (
                        <div
                            key={i}
                            className={`flex flex-wrap items-start gap-3 rounded-lg border px-3 py-2.5 ${processColor(processColorMap[p.identificador] ?? i)}`}
                        >
                            <div className="flex-1 min-w-[160px]">
                                <p className="text-xs font-bold">{p.nome}</p>
                                {p.amostras_pecas && (
                                    <p className="text-[10px] mt-0.5 opacity-75 truncate max-w-xs">{p.amostras_pecas}</p>
                                )}
                                {p.os_ids?.length > 0 && (
                                    <p className="text-[10px] opacity-60 mt-0.5">
                                        OS: {p.os_ids.slice(0, 5).join(', ')}{p.os_ids.length > 5 ? ` +${p.os_ids.length - 5}` : ''}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                                <div className="text-right">
                                    <p className="text-[10px] opacity-70">Produzido</p>
                                    <p className="text-lg font-extrabold">{p.total_produzido.toFixed(0)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] opacity-70">Previsto</p>
                                    <p className="text-sm font-semibold opacity-80">{p.total_previsto.toFixed(0)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] opacity-70">Aponts.</p>
                                    <p className="text-sm font-semibold opacity-80">{p.qtd_apontamentos}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function GroupCard({ grupo, idx, processColorMap }) {
    const [open, setOpen] = useState(true);
    const initials = (grupo.chave || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const numDias = grupo.dias?.length || 0;
    const numAponts = grupo.dias?.reduce((s, d) => s + (d.detalhes?.reduce((ss, p) => ss + (p.qtd_apontamentos || 0), 0) || 0), 0) || 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* header do grupo */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/80 transition-colors group"
            >
                <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${userBg(idx)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md`}>
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-base truncate">{grupo.chave}</p>
                    <p className="text-xs text-slate-500">{numDias} dia{numDias !== 1 ? 's' : ''} · {numAponts} apontamento{numAponts !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-medium">TOTAL PRODUZIDO</p>
                        <p className="text-xl font-extrabold text-slate-800">{grupo.total_geral.toFixed(0)} <span className="text-xs text-slate-400 font-normal">pç</span></p>
                    </div>
                    {open
                        ? <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
                        : <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
                    }
                </div>
            </button>

            {/* dias */}
            {open && (
                <div className="border-t border-slate-100">
                    {grupo.dias?.map((dia, di) => (
                        <DiaRow key={di} dia={dia} processColorMap={processColorMap} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── página principal ──────────────────────────────────────────────────────────
export default function ApontamentoPorUsuarioOpPage() {
    const [data_inicio, setDataInicio] = useState(daysAgo(30));
    const [data_fim, setDataFim] = useState(today());
    const [usuarioFiltro, setUsuarioFiltro] = useState('');
    const [processoFiltro, setProcessoFiltro] = useState('');
    const [grupoPor, setGrupoPor] = useState('usuario');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { data_inicio, data_fim, grupo_por: grupoPor };
            if (usuarioFiltro) params.usuario = usuarioFiltro;
            if (processoFiltro) params.processo = processoFiltro;
            const res = await api.get('/production/analytics/apontamento-usuario', { params });
            setResult(res.data);
        } catch (e) {
            setError(e?.response?.data?.error || e.message || 'Erro ao carregar');
        } finally {
            setLoading(false);
        }
    }, [data_inicio, data_fim, usuarioFiltro, processoFiltro, grupoPor]);

    useEffect(() => { load(); }, [load]);

    // mapa de cor
    const processColorMap = {};
    if (result?.grupos) {
        const detailKeys = [...new Set(
            result.grupos.flatMap(g => g.dias?.flatMap(d => d.detalhes?.map(p => p.identificador) || []) || [])
        )].sort();
        detailKeys.forEach((k, i) => { processColorMap[k] = i; });
    }

    const totalGrupos = result?.grupos?.length ?? 0;
    const totalDias = result?.grupos ? [...new Set(result.grupos.flatMap(g => g.dias?.map(d => d.data) || []))].length : 0;
    const totalPecas = result?.grupos?.reduce((s, g) => s + (g.total_geral || 0), 0) ?? 0;
    const totalAponts = result?.grupos?.reduce((s, g) =>
        s + (g.dias?.reduce((ss, d) => ss + (d.detalhes?.reduce((sss, p) => sss + (p.qtd_apontamentos || 0), 0) || 0), 0) || 0), 0) ?? 0;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* topo */}
            <div className="bg-white border-b border-slate-200 px-6 py-5 flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow">
                        <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Apontamento por Usuário (OP)</h1>
                        <p className="text-sm text-slate-500">Produção diária por colaborador — Ordens de Produção</p>
                    </div>
                </div>

                {/* filtros */}
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">De</label>
                        <input
                            type="date"
                            value={data_inicio}
                            onChange={e => setDataInicio(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Até</label>
                        <input
                            type="date"
                            value={data_fim}
                            onChange={e => setDataFim(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Agrupar por</label>
                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
                            <button
                                onClick={() => setGrupoPor('usuario')}
                                className={`px-4 py-1.5 text-sm font-semibold transition-colors ${grupoPor === 'usuario' ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50'}`}
                            >Usuário</button>
                            <div className="w-px h-5 bg-slate-300"></div>
                            <button
                                onClick={() => setGrupoPor('processo')}
                                className={`px-4 py-1.5 text-sm font-semibold transition-colors ${grupoPor === 'processo' ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50'}`}
                            >Processo</button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Usuário</label>
                        <select
                            value={usuarioFiltro}
                            onChange={e => setUsuarioFiltro(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 min-w-[140px]"
                        >
                            <option value="">Todos</option>
                            {result?.usuarios_lista?.map(u => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Processo</label>
                        <select
                            value={processoFiltro}
                            onChange={e => setProcessoFiltro(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 min-w-[140px]"
                        >
                            <option value="">Todos</option>
                            {result?.processos_lista?.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={load}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold shadow transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Carregando…' : 'Atualizar'}
                    </button>
                </div>
            </div>

            <div className="px-6 py-6 space-y-6 max-w-6xl mx-auto">
                {/* erro */}
                {error && (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* cards de totais */}
                {result && !loading && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard icon={User} label={grupoPor === 'usuario' ? "Colaboradores" : "Processos"} value={totalGrupos} color="text-sky-600" />
                        <StatCard icon={Calendar} label="Dias com apontamento" value={totalDias} color="text-indigo-600" />
                        <StatCard icon={Package} label="Peças produzidas" value={totalPecas.toFixed(0)} color="text-emerald-600" />
                        <StatCard icon={BarChart2} label="Total de apontamentos" value={totalAponts} color="text-amber-600" />
                    </div>
                )}

                {/* skeleton */}
                {loading && (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-pulse">
                                <div className="flex items-center gap-4">
                                    <div className="h-11 w-11 rounded-full bg-slate-200" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-slate-200 rounded w-1/4" />
                                        <div className="h-3 bg-slate-100 rounded w-1/6" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* sem dados */}
                {!loading && result?.grupos?.length === 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-16 text-center">
                        <BarChart2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">Nenhum apontamento encontrado no período</p>
                        <p className="text-slate-400 text-sm mt-1">Tente ampliar as datas ou trocar o filtro</p>
                    </div>
                )}

                {/* cards por grupo */}
                {!loading && result?.grupos?.map((g, i) => (
                    <GroupCard key={g.chave} grupo={g} idx={i} processColorMap={processColorMap} />
                ))}
            </div>
        </div>
    );
}
