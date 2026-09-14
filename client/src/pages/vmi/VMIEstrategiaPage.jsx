import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    GitMerge, Loader2, AlertCircle, ChevronDown, ChevronUp,
    Package, FileSpreadsheet, AlertTriangle, CheckCircle, Clock,
    RefreshCw, Filter, BarChart2
} from 'lucide-react';

const STATUS_CONFIG = {
    critico: {
        label: 'Crítico',
        color: 'bg-red-100 text-red-700 border-red-200',
        dot: 'bg-red-500',
        row: 'bg-red-50/40',
        icon: <AlertCircle className="w-3.5 h-3.5" />
    },
    atencao: {
        label: 'Atenção',
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        dot: 'bg-amber-400',
        row: 'bg-amber-50/40',
        icon: <AlertTriangle className="w-3.5 h-3.5" />
    },
    ok: {
        label: 'OK',
        color: 'bg-green-100 text-green-700 border-green-200',
        dot: 'bg-green-500',
        row: '',
        icon: <CheckCircle className="w-3.5 h-3.5" />
    }
};

const WK_LABEL = {
    WK01: 'Semana 1', WK02: 'Semana 2', WK03: 'Semana 3',
    WK04: 'Semana 4', WK05: 'Semana 5', SEM_SEMANA: 'Sem semana definida'
};

const WK_COLOR = {
    WK01: 'bg-red-600', WK02: 'bg-orange-500', WK03: 'bg-amber-500',
    WK04: 'bg-blue-500', WK05: 'bg-slate-500', SEM_SEMANA: 'bg-slate-400'
};

export default function VMIEstrategiaPage() {
    const [leituras, setLeituras] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [estrategia, setEstrategia] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingLeituras, setLoadingLeituras] = useState(true);
    const [error, setError] = useState(null);
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [gruposAbertos, setGruposAbertos] = useState({});

    useEffect(() => {
        fetchLeituras();
    }, []);

    const fetchLeituras = async () => {
        try {
            const { data } = await api.get('/vmi/leituras');
            setLeituras(data);
            if (data.length > 0) setSelectedId(String(data[0].id));
        } catch {
            setError('Erro ao carregar leituras.');
        } finally {
            setLoadingLeituras(false);
        }
    };

    const fetchEstrategia = async (id) => {
        if (!id) return;
        setLoading(true);
        setError(null);
        setEstrategia(null);
        try {
            const { data } = await api.get(`/vmi/estrategia/${id}`);
            setEstrategia(data);
            // Open all groups by default
            const open = {};
            Object.keys(data.grupos).forEach(k => { open[k] = true; });
            setGruposAbertos(open);
        } catch {
            setError('Erro ao gerar estratégia.');
        } finally {
            setLoading(false);
        }
    };

    const toggleGrupo = (key) => {
        setGruposAbertos(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const fmtN = (n) => {
        const v = +n;
        if (!v) return '—';
        return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    };

    // Filter items within grupos
    const filterItems = (items) => {
        if (filtroStatus === 'todos') return items;
        return items.filter(i => i.status === filtroStatus);
    };

    if (loadingLeituras) return (
        <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
    );

    return (
        <div className="w-full px-2 sm:px-4 py-2 space-y-3">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
                        <GitMerge className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Estratégia de Produção</h1>
                        <p className="text-sm text-slate-500">Sequenciamento e priorização para o PCP</p>
                    </div>
                </div>
            </div>

            {/* Selector + Generate */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Leitura VMI</label>
                    {leituras.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">Nenhuma leitura disponível.</p>
                    ) : (
                        <select
                            value={selectedId}
                            onChange={e => setSelectedId(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            {leituras.map(l => (
                                <option key={l.id} value={l.id}>
                                    {l.mes_label || l.mes_referencia} — {l.total_itens} itens
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                <button
                    onClick={() => fetchEstrategia(selectedId)}
                    disabled={!selectedId || loading}
                    className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                        : <><RefreshCw className="w-4 h-4" /> Gerar Estratégia</>
                    }
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">
                    <AlertCircle className="w-5 h-5 shrink-0" />{error}
                </div>
            )}

            {/* Results */}
            {estrategia && (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <SummaryCard
                            label="Total de Itens"
                            value={estrategia.resumo.total_itens}
                            icon={<Package className="w-4 h-4 text-slate-500" />}
                            color="text-slate-800"
                        />
                        <SummaryCard
                            label="Críticos"
                            value={estrategia.resumo.criticos}
                            icon={<AlertCircle className="w-4 h-4 text-red-500" />}
                            color="text-red-600"
                            bg="bg-red-50"
                        />
                        <SummaryCard
                            label="Atenção"
                            value={estrategia.resumo.atencao}
                            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                            color="text-amber-600"
                            bg="bg-amber-50"
                        />
                        <SummaryCard
                            label="OK"
                            value={estrategia.resumo.ok}
                            icon={<CheckCircle className="w-4 h-4 text-green-500" />}
                            color="text-green-600"
                            bg="bg-green-50"
                        />
                        <SummaryCard
                            label="Total Peças"
                            value={estrategia.resumo.total_pecas.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                            icon={<BarChart2 className="w-4 h-4 text-teal-500" />}
                            color="text-teal-700"
                            bg="bg-teal-50"
                            raw
                        />
                    </div>

                    {/* Reading info */}
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-600">
                        <FileSpreadsheet className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-medium">{estrategia.leitura.mes_label || estrategia.leitura.mes_referencia}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500 truncate">{estrategia.leitura.nome_arquivo}</span>
                    </div>

                    {/* Filter bar */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-500 font-medium">Filtrar:</span>
                        {['todos', 'critico', 'atencao', 'ok'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFiltroStatus(f)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filtroStatus === f
                                    ? f === 'todos' ? 'bg-slate-800 text-white border-slate-800'
                                        : STATUS_CONFIG[f]?.color + ' border'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                {f === 'todos' ? 'Todos' : STATUS_CONFIG[f]?.label}
                            </button>
                        ))}
                    </div>

                    {/* WK Groups */}
                    <div className="space-y-4">
                        {Object.entries(estrategia.grupos).map(([wkKey, items]) => {
                            const filtrados = filterItems(items);
                            if (filtrados.length === 0) return null;

                            const criticos = filtrados.filter(i => i.status === 'critico').length;
                            const atencao = filtrados.filter(i => i.status === 'atencao').length;
                            const aberto = gruposAbertos[wkKey];

                            return (
                                <div key={wkKey} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">

                                    {/* Group header */}
                                    <button
                                        onClick={() => toggleGrupo(wkKey)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <div className={`w-2 h-6 rounded-full ${WK_COLOR[wkKey] || 'bg-slate-400'}`} />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-slate-800 text-sm">{wkKey === 'SEM_SEMANA' ? 'Sem Semana' : wkKey}</span>
                                                <span className="text-slate-400 text-xs">{WK_LABEL[wkKey]}</span>
                                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                    {filtrados.length} {filtrados.length === 1 ? 'item' : 'itens'}
                                                </span>
                                                {criticos > 0 && (
                                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                                                        {criticos} crítico{criticos > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                {atencao > 0 && (
                                                    <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                                                        {atencao} atenção
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {aberto
                                            ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                                            : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                        }
                                    </button>

                                    {/* Group items */}
                                    {aberto && (
                                        <div className="overflow-x-auto border-t border-slate-100">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100">
                                                        <th className="text-left px-3 py-2 font-semibold text-slate-500 w-5">Status</th>
                                                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Código</th>
                                                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Descrição</th>
                                                        <th className="text-center px-3 py-2 font-semibold text-slate-500">Pedidos</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-slate-500">WK01</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-slate-500">WK02</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-slate-500">WK03</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-slate-500">WK04</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-slate-500">WK05</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-slate-800">Total</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-red-500">Faltantes</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {filtrados.map(item => {
                                                        const cfg = STATUS_CONFIG[item.status];
                                                        return (
                                                            <tr key={item.id} className={`hover:brightness-95 transition-all ${cfg.row}`}>
                                                                <td className="px-3 py-2">
                                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-medium ${cfg.color}`}>
                                                                        {cfg.icon}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 font-mono font-semibold text-slate-700 whitespace-nowrap">
                                                                    {item.codigo_produto}
                                                                </td>
                                                                <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate">
                                                                    {item.descricao || '—'}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    {item.pedidos.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1 justify-center">
                                                                            {item.pedidos.map(p => (
                                                                                <span key={p.numero} className="bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 text-xs font-mono whitespace-nowrap" title={`Pedido ${p.numero}`}>
                                                                                    {p.numero.replace(/^0+/, '') || p.numero}: {fmtN(p.quantidade)}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    ) : <span className="text-slate-300">—</span>}
                                                                </td>
                                                                {[item.qtd_wk01, item.qtd_wk02, item.qtd_wk03, item.qtd_wk04, item.qtd_wk05].map((q, j) => (
                                                                    <td key={j} className={`px-3 py-2 text-right tabular-nums ${+q > 0 ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
                                                                        {+q > 0 ? fmtN(q) : '—'}
                                                                    </td>
                                                                ))}
                                                                <td className="px-3 py-2 text-right font-bold text-slate-800 tabular-nums">
                                                                    {fmtN(item.total_geral)}
                                                                </td>
                                                                <td className={`px-3 py-2 text-right tabular-nums font-medium ${item.faltantes_firmes > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                                                                    {item.faltantes_firmes > 0 ? fmtN(item.faltantes_firmes) : '—'}
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
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <span className="font-semibold text-slate-400">Legenda:</span>
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                            <span key={key} className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                <span className="font-medium">{cfg.label}</span>
                                {key === 'critico' && '— faltantes + WK ≤ 2'}
                                {key === 'atencao' && '— faltantes ou WK 1'}
                                {key === 'ok' && '— sem urgência'}
                            </span>
                        ))}
                    </div>
                </>
            )}

            {/* Empty state */}
            {!estrategia && !loading && !error && leituras.length > 0 && (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                    <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center">
                        <GitMerge className="w-7 h-7 text-teal-400" />
                    </div>
                    <p className="text-slate-500 font-medium">Selecione uma leitura e clique em <strong>Gerar Estratégia</strong></p>
                </div>
            )}

            {leituras.length === 0 && !loadingLeituras && (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                        <FileSpreadsheet className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">Nenhuma leitura VMI disponível.</p>
                    <a href="/vmi/leitura" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        Fazer primeiro upload <Clock className="w-4 h-4" />
                    </a>
                </div>
            )}
        </div>
    );
}

function SummaryCard({ label, value, icon, color, bg = 'bg-white', raw = false }) {
    return (
        <div className={`${bg} border border-slate-200 rounded-xl p-4 flex flex-col gap-1`}>
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">{icon}{label}</div>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>
                {raw ? value : (typeof value === 'number' ? value.toLocaleString('pt-BR') : value)}
            </p>
        </div>
    );
}
