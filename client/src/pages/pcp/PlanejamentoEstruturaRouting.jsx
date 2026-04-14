import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
    GitMerge, Box, Layers, ListTodo, ChevronDown, ChevronRight,
    Workflow, AlertCircle, ArrowRight, CheckSquare, Search, Filter,
    Calendar, User, Package, RefreshCw, X, ChevronLeft, Loader2,
    Building2, Hash, Clock, AlertTriangle
} from 'lucide-react';
import { searchProductionOps, getProductionStructureRouting } from '../../services/api';
// ─── Helpers ────────────────────────────────────────────────────────────────

const formatPrazo = (iso) => {
    if (!iso) return '—';
    try {
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    } catch {
        return iso;
    }
};

const prazoColor = (iso) => {
    if (!iso) return 'text-slate-400';
    const diff = (new Date(iso) - new Date()) / 86400000;
    if (diff < 0) return 'text-red-600 font-bold';
    if (diff <= 3) return 'text-orange-500 font-bold';
    if (diff <= 7) return 'text-yellow-600 font-semibold';
    return 'text-green-700';
};

// ─── Componente Recursivo da Árvore ─────────────────────────────────────────

const ArvoreNode = ({ item, level = 0 }) => {
    const [expanded, setExpanded] = useState(true);
    const isParent = item.tipo === 'PAI';
    const hasOps = item.operacoes?.length > 0;
    const hasFilhos = item.filhos?.length > 0;

    return (
        <div className="relative mt-2">
            {level > 0 && (
                <>
                    <div className="absolute -left-6 top-0 bottom-0 border-l-2 border-slate-200" />
                    <div className="absolute -left-6 top-6 w-6 border-t-2 border-slate-200" />
                </>
            )}
            <div className={`border rounded-xl overflow-hidden shadow-sm transition-all ${isParent ? 'border-blue-200 bg-white' : 'border-slate-200 bg-white ml-2'}`}>
                {/* Cabeçalho */}
                <div
                    className={`p-3 flex items-center gap-3 cursor-pointer select-none ${isParent ? 'bg-blue-50/50 hover:bg-blue-100/50' : 'hover:bg-slate-50'}`}
                    onClick={() => setExpanded(e => !e)}
                >
                    <button className="p-1 rounded hover:bg-slate-200/50 text-slate-500 shrink-0">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className={`p-2 rounded-lg shrink-0 ${isParent ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {isParent ? <Box className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-slate-800 text-sm">{item.codigo}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${isParent ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>
                                {isParent ? 'Conjunto Pai' : 'Componente Filho'}
                            </span>
                            {!hasOps && (
                                <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                    Sem roteiro cadastrado
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{item.descricao || '—'}</div>
                    </div>
                    <div className="text-right bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shrink-0">
                        <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Qtd</div>
                        <div className="font-black text-lg text-slate-800 leading-none mt-0.5">
                            {isParent
                                ? item.qtd_produzir
                                : `${item.qtd_por_pai}`}
                        </div>
                        {!isParent && (
                            <div className="text-[9px] text-slate-400">un/pai</div>
                        )}
                    </div>
                </div>

                {/* Corpo expandido */}
                {expanded && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50/40">
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Workflow className="w-3.5 h-3.5 text-slate-400" />
                            {isParent ? 'Roteiro do Conjunto PAI' : 'Roteiro da Peça FILHA'}
                        </h4>

                        {hasOps ? (
                            <div className="flex flex-wrap gap-2">
                                {item.operacoes.map((op, i) => (
                                    <div key={i} className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm text-xs pr-3 overflow-hidden">
                                        <div className="bg-slate-800 text-white font-mono font-bold px-2.5 py-2 border-r border-slate-700 text-[11px]">
                                            {String(op.seq).padStart(2, '0')}
                                        </div>
                                        <div className="font-black text-slate-700 px-2.5 py-2 uppercase tracking-wide text-[11px]">
                                            {op.recurso}
                                        </div>
                                        {op.desc && (
                                            <div className="text-slate-400 pl-2 border-l border-slate-100 py-2 text-[10px]">
                                                {op.desc}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 w-fit">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                Nenhuma operação de roteiro encontrada no SG2 para este produto.
                            </div>
                        )}

                        {hasFilhos && (
                            <div className="mt-5 ml-6 relative">
                                <h4 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <GitMerge className="w-3.5 h-3.5" />
                                    Pré-requisitos — fabricar antes de montar o PAI
                                </h4>
                                {item.filhos.map(filho => (
                                    <ArvoreNode key={filho.id} item={filho} level={level + 1} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Painel de Busca de OPs ─────────────────────────────────────────────────

const SearchPanel = ({ onSelectOp }) => {
    const [filters, setFilters] = useState({ op: '', cliente: '', produto: '', prazo_de: '', prazo_ate: '' });
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState(null);
    const debounceRef = useRef(null);

    const hasFilters = Object.values(filters).some(v => v.trim());

    const doSearch = useCallback(async (f) => {
        const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim()));
        if (!Object.keys(params).length) return;

        setLoading(true);
        setError(null);
        try {
            const data = await searchProductionOps({ ...params, limit: 80 });
            setResults(data.data || data);
            setSearched(true);
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleChange = (field, value) => {
        const next = { ...filters, [field]: value };
        setFilters(next);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(next), 600);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        clearTimeout(debounceRef.current);
        doSearch(filters);
    };

    const clearFilters = () => {
        setFilters({ op: '', cliente: '', produto: '', prazo_de: '', prazo_ate: '' });
        setResults([]);
        setSearched(false);
        setError(null);
    };

    return (
        <div className="space-y-4">
            {/* Filtros */}
            <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Buscar Ordem de Produção</h2>
                    {hasFilters && (
                        <button type="button" onClick={clearFilters} className="ml-auto text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
                            <X className="w-3.5 h-3.5" /> Limpar
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            value={filters.op}
                            onChange={e => handleChange('op', e.target.value)}
                            placeholder="Nº da OP"
                            className="w-full pl-8 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            value={filters.cliente}
                            onChange={e => handleChange('cliente', e.target.value)}
                            placeholder="Cliente"
                            className="w-full pl-8 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            value={filters.produto}
                            onChange={e => handleChange('produto', e.target.value)}
                            placeholder="Produto / Código"
                            className="w-full pl-8 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="date"
                            value={filters.prazo_de}
                            onChange={e => handleChange('prazo_de', e.target.value)}
                            className="w-full pl-8 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-600"
                        />
                        <span className="absolute -top-2 left-2 text-[9px] bg-white px-1 text-slate-400 font-bold uppercase tracking-wide">Prazo de</span>
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="date"
                            value={filters.prazo_ate}
                            onChange={e => handleChange('prazo_ate', e.target.value)}
                            className="w-full pl-8 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-600"
                        />
                        <span className="absolute -top-2 left-2 text-[9px] bg-white px-1 text-slate-400 font-bold uppercase tracking-wide">Prazo até</span>
                    </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={!hasFilters || loading}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Buscar
                    </button>
                    <span className="text-xs text-slate-400">Ou digite para buscar automaticamente (debounce 600ms)</span>
                </div>
            </form>

            {/* Erro */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {/* Resultados */}
            {searched && !loading && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700">
                            {results.length === 0 ? 'Nenhuma OP encontrada' : `${results.length} resultado${results.length > 1 ? 's' : ''}`}
                        </span>
                    </div>
                    {results.length > 0 && (
                        <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                            {results.map((r, i) => (
                                <button
                                    key={i}
                                    onClick={() => onSelectOp(r)}
                                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50 transition-colors text-left group"
                                >
                                    <div className="bg-slate-100 group-hover:bg-blue-600 text-slate-600 group-hover:text-white rounded-lg p-2.5 transition-colors shrink-0">
                                        <Box className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono font-black text-slate-900 text-sm group-hover:text-blue-700">
                                                {r.op}
                                            </span>
                                            <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[180px]">
                                                {r.produto}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 truncate mt-0.5">
                                            {r.descricao || '—'} {r.cliente ? `• ${r.cliente}` : ''}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className={`text-xs font-bold ${prazoColor(r.prazo)}`}>
                                            {r.prazo ? formatPrazo(r.prazo) : '—'}
                                        </div>
                                        <div className="text-[10px] text-slate-400">Qtd: {r.qtd_op}</div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Visão por Máquina ───────────────────────────────────────────────────────

const FilasMaquina = ({ conjuntos }) => {
    const filas = useMemo(() => {
        const maquinas = {};
        const extrair = (produto, paiCtx = null) => {
            (produto.operacoes || []).forEach(op => {
                if (!maquinas[op.recurso]) maquinas[op.recurso] = [];
                const qtd = produto.tipo === 'PAI'
                    ? produto.qtd_produzir
                    : produto.qtd_por_pai * paiCtx.qtd_produzir;
                maquinas[op.recurso].push({
                    ...op,
                    peca_codigo: produto.codigo,
                    peca_desc: produto.descricao,
                    tipo_peca: produto.tipo,
                    qtd_fabricar: qtd,
                    pai_destino: paiCtx ? paiCtx.codigo : 'Expedição/Final'
                });
            });
            (produto.filhos || []).forEach(f => extrair(f, produto));
        };
        conjuntos.forEach(c => extrair(c));
        return Object.entries(maquinas)
            .map(([nome, ops]) => ({ nome, ops: ops.sort((a, b) => a.seq - b.seq) }))
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [conjuntos]);

    if (filas.length === 0) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                <div>
                    <h3 className="font-bold text-amber-900 text-sm">Sem operações de roteiro</h3>
                    <p className="text-sm text-amber-700 mt-1">
                        Nenhum produto desta OP possui roteiro cadastrado no SG2.
                        Verifique o Protheus.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filas.map((maq, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-slate-800 px-5 py-3.5 flex items-center justify-between">
                        <h2 className="text-base font-black text-white uppercase tracking-wider">{maq.nome}</h2>
                        <span className="bg-slate-700 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-slate-600 uppercase tracking-widest">
                            {maq.ops.length} taref{maq.ops.length > 1 ? 'as' : 'a'}
                        </span>
                    </div>
                    <div className="overflow-x-auto flex-1 p-2">
                        <table className="w-full text-left border-collapse min-w-[560px]">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-widest text-slate-400 border-b-2 border-slate-100">
                                    <th className="p-2.5 font-bold">Seq</th>
                                    <th className="p-2.5 font-bold">Peça</th>
                                    <th className="p-2.5 font-bold text-center">Operação</th>
                                    <th className="p-2.5 font-bold text-center">Qtd Total</th>
                                    <th className="p-2.5 font-bold">Destino</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {maq.ops.map((op, j) => (
                                    <tr key={j} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-2.5">
                                            <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                                {op.seq}
                                            </span>
                                        </td>
                                        <td className="p-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono font-black text-sm text-slate-800">{op.peca_codigo}</span>
                                                {op.tipo_peca === 'PAI' && (
                                                    <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Conj.</span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-400 truncate max-w-[180px]" title={op.peca_desc}>{op.peca_desc}</div>
                                        </td>
                                        <td className="p-2.5 text-center">
                                            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                                {op.desc || '—'}
                                            </span>
                                        </td>
                                        <td className="p-2.5 text-center">
                                            <span className="bg-green-100 text-green-800 font-black text-sm px-3 py-1 rounded-lg border border-green-200 shadow-sm tabular-nums">
                                                {op.qtd_fabricar % 1 === 0 ? op.qtd_fabricar : op.qtd_fabricar.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-2.5">
                                            {op.tipo_peca === 'PAI' ? (
                                                <span className="text-[10px] font-bold text-slate-400 italic bg-slate-100 border border-slate-200 px-2 py-1.5 rounded-lg flex items-center gap-1.5 w-fit">
                                                    <CheckSquare className="w-3.5 h-3.5" /> FIM
                                                </span>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-1.5 rounded-lg w-fit border border-orange-200 shadow-sm group-hover:bg-orange-100 transition-colors">
                                                    <ArrowRight className="w-3 h-3 shrink-0" />
                                                    <span className="font-mono truncate max-w-[130px]">{op.pai_destino}</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ─── Página Principal ────────────────────────────────────────────────────────

export default function PlanejamentoEstruturaRouting() {
    const [view, setView] = useState('search'); // 'search' | 'detail'
    const [activeTab, setActiveTab] = useState('queue'); // 'tree' | 'queue'
    const [opData, setOpData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedOpRef, setSelectedOpRef] = useState(null);

    const loadOp = async (opInfo) => {
        setLoading(true);
        setError(null);
        setSelectedOpRef(opInfo);
        try {
            const resp = await getProductionStructureRouting(opInfo.op);
            setOpData(resp.data || resp);
            setView('detail');
            setActiveTab('queue');
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setView('search');
        setOpData(null);
        setError(null);
    };

    const handleReload = () => {
        if (selectedOpRef) loadOp(selectedOpRef);
    };

    return (
        <div className="bg-slate-100 min-h-screen p-4 md:p-6 font-sans">
            <div className="max-w-[1600px] mx-auto space-y-5">

                {/* Header da Página */}
                <div className="flex items-center gap-4 flex-wrap">
                    {view === 'detail' && (
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-sm transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Voltar
                        </button>
                    )}
                    <div>
                        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <GitMerge className="w-5 h-5 text-blue-600" />
                            Explosão BOM + Roteiro
                            <span className="text-sm font-semibold text-slate-400 normal-case">— Pull System</span>
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Visualize a árvore de componentes e as filas de máquina por Ordem de Produção
                        </p>
                    </div>
                </div>

                {/* Loading global */}
                {loading && (
                    <div className="bg-white border border-blue-200 rounded-2xl p-6 flex items-center justify-center gap-3 shadow-sm">
                        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                        <span className="text-sm font-semibold text-blue-700">Carregando estrutura da OP...</span>
                    </div>
                )}

                {/* Erro global */}
                {error && !loading && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-red-700">{error}</p>
                        </div>
                        {selectedOpRef && (
                            <button onClick={handleReload} className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-bold">
                                <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
                            </button>
                        )}
                    </div>
                )}

                {/* VIEW: Busca */}
                {view === 'search' && !loading && (
                    <SearchPanel onSelectOp={loadOp} />
                )}

                {/* VIEW: Detalhe da OP */}
                {view === 'detail' && opData && !loading && (
                    <>
                        {/* Cabeçalho da OP */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h2 className="text-2xl font-black text-slate-800">{opData.op}</h2>
                                    {opData.pedido_venda && (
                                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                            PV: {opData.pedido_venda}
                                        </span>
                                    )}
                                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                                        Planejamento Estrutural
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm text-slate-500">
                                    {opData.cliente && (
                                        <span className="flex items-center gap-1">
                                            <Building2 className="w-3.5 h-3.5" /> {opData.cliente}
                                        </span>
                                    )}
                                    {opData.prazo && (
                                        <span className={`flex items-center gap-1 ${prazoColor(opData.prazo)}`}>
                                            <Clock className="w-3.5 h-3.5" />
                                            Prazo: <strong>{formatPrazo(opData.prazo)}</strong>
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1 text-slate-400">
                                        <Package className="w-3.5 h-3.5" />
                                        {opData.conjuntos?.length} conjunto{opData.conjuntos?.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleReload}
                                    title="Recarregar dados"
                                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>

                                {/* Seletor de Visão */}
                                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                                    <button
                                        onClick={() => setActiveTab('tree')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tree' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <GitMerge className="w-4 h-4" /> Árvore
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('queue')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'queue' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <ListTodo className="w-4 h-4" /> Por Máquina
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ABA: Árvore */}
                        {activeTab === 'tree' && (
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="mb-5 bg-blue-50/60 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-blue-800 leading-relaxed">
                                        <strong>Lógica de Dependência:</strong> As peças filhas possuem seus próprios roteiros
                                        e devem ser concluídas <strong>antes</strong> que o roteiro do Pai (Solda, Tratamento, Montagem) seja iniciado.
                                    </p>
                                </div>
                                {opData.conjuntos?.length > 0
                                    ? opData.conjuntos.map(c => <ArvoreNode key={c.id} item={c} />)
                                    : <p className="text-sm text-slate-500 text-center py-8">Nenhum conjunto encontrado.</p>
                                }
                            </div>
                        )}

                        {/* ABA: Por Máquina */}
                        {activeTab === 'queue' && (
                            <FilasMaquina conjuntos={opData.conjuntos || []} />
                        )}
                    </>
                )}

            </div>
        </div>
    );
}
