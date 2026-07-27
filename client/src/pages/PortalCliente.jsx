import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
    MonitorSmartphone, Search, RefreshCw, AlertTriangle,
    Truck, FileText, ChevronDown, ChevronUp, BarChart2,
    Calendar, Layers, Package, Inbox, CheckCircle, Clock,
    Factory
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────
const fmtQtd = (n) =>
    Number(n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const STATUS_CONFIG = {
    ENTREGUE:           { label: 'Entregue',           color: 'text-emerald-700', bg: 'bg-emerald-100', bar: 'bg-emerald-500' },
    PRODUCAO_CONCLUIDA: { label: 'Pronto p/ Embarque', color: 'text-teal-700',   bg: 'bg-teal-100',    bar: 'bg-teal-500'   },
    EM_PRODUCAO:        { label: 'Em Produção',         color: 'text-blue-700',   bg: 'bg-blue-100',    bar: 'bg-blue-500'   },
    OP_ABERTA:          { label: 'OP Aberta',           color: 'text-sky-700',    bg: 'bg-sky-100',     bar: 'bg-sky-400'    },
    AGUARDANDO_OP:      { label: 'Em Planejamento',     color: 'text-amber-700',  bg: 'bg-amber-100',   bar: 'bg-amber-400'  },
    AGUARDANDO:         { label: 'Aguardando',          color: 'text-slate-600',  bg: 'bg-slate-100',   bar: 'bg-slate-300'  },
};

// ─── Status badge ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const s = STATUS_CONFIG[status] || STATUS_CONFIG.AGUARDANDO;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${s.bg} ${s.color}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            {s.label}
        </span>
    );
};

// ─── OP Badge (igual à Visão Geral) ─────────────────────────────────────────
const OpBadge = ({ opNum, opTipo }) => {
    if (!opNum) return <span className="text-gray-400 text-xs">-</span>;
    return (
        <div className="flex items-center justify-center gap-1">
            <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${opTipo === 'F' ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                {opNum}
            </span>
            {opTipo === 'F' && <span className="px-1 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded border border-emerald-200">F</span>}
            {opTipo === 'P' && <span className="px-1 py-0.5 text-[9px] font-bold bg-orange-100 text-orange-800 rounded border border-orange-200">P</span>}
        </div>
    );
};

// ─── Evolução OP bar ─────────────────────────────────────────────────────────
const EvolucaoBar = ({ pct, status }) => {
    const display = status === 'ENTREGUE' ? 100 : pct;
    const colorBar = display >= 100 ? 'bg-green-500' : display > 0 ? 'bg-blue-500' : 'bg-gray-300';
    const colorTxt = display >= 100 ? 'text-green-600' : display > 0 ? 'text-blue-600' : 'text-gray-500';
    return (
        <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
            <span className={`text-xs font-bold ${colorTxt}`}>{display}%</span>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div className={`h-1.5 rounded-full transition-all duration-500 ${colorBar}`} style={{ width: `${Math.max(display > 0 ? 4 : 0, display)}%` }} />
            </div>
        </div>
    );
};

// ─── KPI Card (compacto inline) ─────────────────────────────────────────────
// KPIs now rendered inline in the header bar — component removed.
// ─── Expanded NF panel ───────────────────────────────────────────────────────
const NfPanel = ({ item, entregas }) => {
    const nfs = entregas.filter(e => e.pedido === item.pedido && e.item === item.item);
    return (
        <tr className="bg-indigo-50/30">
            <td colSpan={19} className="px-5 py-3 border-b border-slate-200">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <Truck className="w-3.5 h-3.5" /> NFs emitidas para este item
                </div>
                {item.observacoes && (
                    <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2.5 py-1.5 max-w-2xl">
                        <strong>Obs:</strong> {item.observacoes}
                    </div>
                )}
                {nfs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Nenhuma NF emitida para este item ainda.</p>
                ) : (
                    <table className="min-w-max text-xs border-collapse">
                        <thead>
                            <tr className="text-slate-400 uppercase text-[10px] tracking-wide">
                                <th className="text-left pr-6 pb-1.5 font-semibold">NF / Série</th>
                                <th className="text-left pr-6 pb-1.5 font-semibold">Emissão</th>
                                <th className="text-right pr-6 pb-1.5 font-semibold">Qtd Entregue</th>
                                <th className="text-left pb-1.5 font-semibold">Transportadora</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nfs.map((nf, i) => (
                                <tr key={i} className="border-t border-indigo-100">
                                    <td className="pr-6 py-1.5 font-mono font-bold text-slate-700">
                                        {nf.nota}<span className="text-slate-400 font-normal text-[10px]">/{nf.serie}</span>
                                    </td>
                                    <td className="pr-6 py-1.5 font-semibold text-slate-600">{nf.emissao_nf || '—'}</td>
                                    <td className="pr-6 py-1.5 text-right font-bold text-emerald-700">
                                        {fmtQtd(nf.qtd_entregue)} {nf.unidade}
                                    </td>
                                    <td className="py-1.5 text-slate-500">{nf.transportadora || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </td>
        </tr>
    );
};

// ─── Item Row — grid idêntico à Visão Geral ──────────────────────────────────
const ItemRow = ({ item, entregas, isDelivered }) => {
    const [open, setOpen] = useState(false);
    const nfCount = entregas.filter(e => e.pedido === item.pedido && e.item === item.item).length;

    return (
        <>
            <tr
                onClick={() => setOpen(o => !o)}
                className={`border-b border-gray-50 cursor-pointer transition-colors text-sm
                    ${item.saldo_faturar <= 0
                        ? 'bg-green-50/40 hover:bg-green-100/50 opacity-80'
                        : 'bg-white hover:bg-slate-50'}
                    ${open ? '!bg-indigo-50/60' : ''}`}
            >
                {/* Pedido */}
                <td className="px-2 py-1.5 whitespace-nowrap sticky left-0 z-10 bg-inherit">
                    <span className="font-bold text-gray-900 text-xs">{item.pedido}</span>
                </td>

                {/* Emissão */}
                <td className="px-2 py-1.5 text-center text-xs text-gray-600 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-0.5">
                        <Calendar className="h-2.5 w-2.5 text-gray-400" />
                        {item.data_emissao || '-'}
                    </div>
                </td>

                {/* Ref. Cliente (sz1010 - código do produto no cliente) */}
                <td className="px-2 py-1.5 text-xs font-mono text-gray-600 max-w-[80px] truncate" title={item.ref_cliente}>
                    {item.ref_cliente || '-'}
                </td>

                {/* Cliente */}
                <td className="px-2 py-1.5 text-xs font-medium text-gray-700 max-w-[120px] truncate" title={item.nome_cliente}>
                    {item.nome_cliente || '-'}
                </td>

                {/* PC (c6_pedcli - pedido do cliente) */}
                <td className="px-2 py-1.5 text-xs font-mono text-indigo-700 max-w-[90px] truncate" title={item.ped_cliente}>
                    {item.ped_cliente || '-'}
                </td>

                {/* Item */}
                <td className="px-2 py-1.5 text-center text-xs text-gray-900 whitespace-nowrap">
                    {item.item}
                </td>

                {/* OP */}
                <td className="px-2 py-1.5 text-center whitespace-nowrap">
                    <OpBadge opNum={item.op_num} opTipo={item.op_tipo} />
                </td>

                {/* Cód. Produto */}
                <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap max-w-[120px] truncate" title={item.produto}>
                    {item.produto || '-'}
                </td>

                {/* Rev Produto */}
                <td className="px-2 py-1.5 text-center text-xs text-gray-500 font-mono">
                    {item.rev_produto || '-'}
                </td>

                {/* Rev Cliente */}
                <td className="px-2 py-1.5 text-center text-xs text-gray-500 font-mono">
                    {item.rev_cliente || '-'}
                </td>

                {/* Descrição */}
                <td className="px-2 py-1.5 text-xs text-gray-600 max-w-[180px] truncate" title={item.desc_produto}>
                    {item.desc_produto || '-'}
                </td>

                {/* Status */}
                <td className="px-2 py-1.5 text-center">
                    <StatusBadge status={item.status} />
                </td>

                {/* Entreg. */}
                <td className="px-2 py-1.5 text-right text-gray-600 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                        {nfCount > 0 && (
                            <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
                                <FileText className="w-2.5 h-2.5" />{nfCount}
                            </span>
                        )}
                        <span className="text-xs">{fmtQtd(item.qtd_faturada)}</span>
                    </div>
                </td>

                {/* Saldo Fat. */}
                <td className={`px-2 py-1.5 text-right text-xs font-medium whitespace-nowrap ${item.saldo_faturar <= 0 ? 'text-green-600' : 'text-orange-600 font-bold'}`}>
                    {fmtQtd(item.saldo_faturar)}
                </td>

                {/* Qtd. */}
                <td className="px-2 py-1.5 text-right text-xs font-medium whitespace-nowrap">
                    {fmtQtd(item.qtd_vendida)} <span className="text-[9px] text-gray-400">{item.unidade}</span>
                </td>

                {/* Entrega (previsão do pedido) */}
                <td className="px-2 py-1.5 text-center font-medium text-blue-800 bg-blue-50 whitespace-nowrap text-xs">
                    <div className="flex items-center justify-center gap-0.5">
                        <Calendar className="h-2.5 w-2.5 text-blue-400" />
                        {item.entrega || '-'}
                    </div>
                </td>

                {/* Data PCP */}
                <td className="px-2 py-1.5 text-center text-xs whitespace-nowrap">
                    {item.data_pcp ? (
                        <span className="px-1 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-semibold">
                            {item.data_pcp}
                        </span>
                    ) : <span className="text-gray-400">-</span>}
                </td>


                {/* Evolução OP */}
                <td className="px-2 py-1.5 text-center">
                    {item.tem_op
                        ? <EvolucaoBar pct={item.percentual_producao} status={item.status} />
                        : <span className="text-gray-400 text-xs">-</span>}
                </td>

                {/* Expand */}
                <td className="px-2 py-1.5 text-center">
                    {open
                        ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400 mx-auto" />
                        : <ChevronDown className="w-3.5 h-3.5 text-gray-300 mx-auto" />}
                </td>
            </tr>
            {open && <NfPanel item={item} entregas={entregas} />}
        </>
    );
};

// ─── Main ────────────────────────────────────────────────────────────────────
const PortalCliente = () => {
    const { user } = useAuth();
    const [items, setItems]       = useState([]);
    const [entregas, setEntregas] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError]       = useState(null);
    const [search, setSearch]     = useState('');
    const [tab, setTab]           = useState('itens');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage]         = useState(1);
    const [hasMore, setHasMore]   = useState(false);

    const fetchData = async (pageNum = 1, isLoadMore = false) => {
        try {
            if (isLoadMore) setLoadingMore(true);
            else setLoading(true);
            
            setError(null);
            const { data } = await api.get(`/pedidos/portal-cliente?page=${pageNum}&limit=100`);
            
            const newItems = Array.isArray(data.items) ? data.items : [];
            const newEntregas = Array.isArray(data.entregas) ? data.entregas : [];
            
            if (isLoadMore) {
                setItems(prev => [...prev, ...newItems]);
                setEntregas(prev => {
                    const map = new Map();
                    [...prev, ...newEntregas].forEach(e => {
                        map.set(`${e.pedido}-${e.item}-${e.nota}-${e.serie}`, e);
                    });
                    return Array.from(map.values());
                });
            } else {
                setItems(newItems);
                setEntregas(newEntregas);
            }
            
            setHasMore(data.meta ? data.meta.hasNextPage : false);
            setPage(pageNum);
        } catch (err) {
            console.error('[PortalCliente] Erro:', err);
            setError('Não foi possível carregar os dados. Tente novamente.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => { fetchData(1); }, []);

    const kpis = useMemo(() => ({
        total:      items.length,
        emProd:     items.filter(i => ['EM_PRODUCAO','OP_ABERTA','PRODUCAO_CONCLUIDA'].includes(i.status)).length,
        entregues:  items.filter(i => i.status === 'ENTREGUE').length,
        aguardando: items.filter(i => ['AGUARDANDO_OP','AGUARDANDO'].includes(i.status)).length,
        qtdTotal:   items.reduce((s, i) => s + (i.qtd_vendida || 0), 0),
        qtdFat:     items.reduce((s, i) => s + (i.qtd_faturada || 0), 0),
    }), [items]);

    const filteredItems = useMemo(() => {
        let result = items;
        if (statusFilter) result = result.filter(i => i.status === statusFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(i =>
                i.pedido.toLowerCase().includes(q) ||
                i.item.toLowerCase().includes(q) ||
                (i.produto || '').toLowerCase().includes(q) ||
                (i.desc_produto || '').toLowerCase().includes(q) ||
                (i.ped_cliente || '').toLowerCase().includes(q) ||
                (i.nome_cliente || '').toLowerCase().includes(q) ||
                (i.op_num || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [items, search, statusFilter]);

    const filteredEntregas = useMemo(() => {
        if (!search.trim()) return entregas;
        const q = search.toLowerCase();
        return entregas.filter(e =>
            e.pedido.toLowerCase().includes(q) ||
            e.nota.toLowerCase().includes(q) ||
            (e.produto || '').toLowerCase().includes(q)
        );
    }, [entregas, search]);

    // Table columns — espelhando ALL_FLAT_COLUMNS da Visão Geral
    const COLS = [
        'Pedido', 'Emissão', 'Ref. Cliente', 'Cliente', 'PC', 'It',
        'OP', 'Cód. Prod', 'Rev', 'Rev. Cli', 'Descrição',
        'Status', 'Entreg.', 'Saldo Fat.', 'Qtd.',
        'Entrega', 'Data PCP', 'Evolução OP', ''
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-2 font-sans">
            <div className="w-full space-y-2">

                {/* Header + KPIs — single compact bar */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 px-3 py-2 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center text-white shadow shadow-blue-200 flex-shrink-0">
                            <MonitorSmartphone className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-slate-800 leading-tight">Canal do Cliente</h1>
                            <p className="text-slate-400 text-[10px]">{user?.NomeCompleto || 'Cliente'}</p>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-8 bg-slate-200 flex-shrink-0" />

                    {/* KPIs inline */}
                    {[
                        { icon: Layers,      label: 'Total',         value: kpis.total,      color: 'text-slate-700',   bg: 'bg-slate-100'   },
                        { icon: BarChart2,   label: 'Em Produção',   value: kpis.emProd,     color: 'text-blue-700',    bg: 'bg-blue-100'    },
                        { icon: CheckCircle, label: 'Entregues',     value: kpis.entregues,  color: 'text-emerald-700', bg: 'bg-emerald-100' },
                        { icon: Clock,       label: 'Planejamento',  value: kpis.aguardando, color: 'text-amber-700',   bg: 'bg-amber-100'   },
                    ].map(({ icon: Icon, label, value, color, bg }) => (
                        <div key={label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${bg} flex-shrink-0`}>
                            <Icon className={`w-3.5 h-3.5 ${color}`} />
                            <span className={`text-xs font-semibold ${color}`}>{value}</span>
                            <span className="text-[10px] text-slate-500">{label}</span>
                        </div>
                    ))}

                    <div className="flex-1" />

                    <button onClick={() => fetchData(1)} disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100 disabled:opacity-50 flex-shrink-0">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                    </button>
                </div>

                {/* Main table card */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    {/* Toolbar */}
                    <div className="px-3 py-2 border-b border-slate-100 flex flex-wrap items-center gap-2">
                        {/* Tabs */}
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
                            <button onClick={() => setTab('itens')}
                                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${tab === 'itens' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Package className="w-3.5 h-3.5" /> Itens do Pedido
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded-full font-bold">{items.length}</span>
                            </button>
                            <button onClick={() => setTab('entregas')}
                                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${tab === 'entregas' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Truck className="w-3.5 h-3.5" /> Entregas (NFs)
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 rounded-full font-bold">{entregas.length}</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {tab === 'itens' && (
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/20 text-slate-600">
                                    <option value="">Todos os status</option>
                                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                    ))}
                                </select>
                            )}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input type="text" placeholder="Buscar pedido, produto, OP, cliente..." value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 w-64 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400" />
                            </div>
                        </div>
                    </div>

                    {/* Table area */}
                    <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 140px)', minHeight: 260 }}>
                        {loading && items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-56 gap-3 text-slate-400">
                                <RefreshCw className="w-7 h-7 animate-spin text-blue-500" />
                                <p className="text-sm">Carregando dados...</p>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-56 gap-3 text-red-500">
                                <AlertTriangle className="w-7 h-7" />
                                <p className="text-sm text-center max-w-xs">{error}</p>
                                <button onClick={fetchData} className="px-3 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-100">
                                    Tentar novamente
                                </button>
                            </div>
                        ) : tab === 'itens' ? (
                            filteredItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-56 gap-3 text-slate-400">
                                    <Inbox className="w-9 h-9 opacity-40" />
                                    <p className="text-sm">Nenhum item encontrado.</p>
                                </div>
                            ) : (
                                <table className="min-w-full text-sm border-collapse">
                                    <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                                        <tr>
                                            {COLS.map((h, i) => (
                                                <th key={i} className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredItems.map((item, idx) => (
                                            <ItemRow
                                                key={`${item.pedido}-${item.item}-${idx}`}
                                                item={item}
                                                entregas={entregas}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            )
                        ) : (
                            /* Tab: Entregas Realizadas */
                            filteredEntregas.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-56 gap-3 text-slate-400">
                                    <Truck className="w-9 h-9 opacity-40" />
                                    <p className="text-sm">Nenhuma entrega registrada.</p>
                                </div>
                            ) : (
                                <table className="min-w-full text-sm border-collapse">
                                    <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                                        <tr>
                                            {['Pedido / Item','NF / Série','Emissão NF','Produto','Descrição','Qtd Entregue','Transportadora'].map((h, i) => (
                                                <th key={i} className={`px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filteredEntregas.map((e, i) => (
                                            <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                                                <td className="px-3 py-2 font-mono font-bold text-gray-800 whitespace-nowrap">
                                                    {e.pedido}<span className="text-gray-300 font-normal"> / </span>{e.item}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <span className="font-bold text-gray-800">{e.nota}</span>
                                                    <span className="text-gray-400 text-xs ml-1">/{e.serie}</span>
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        <span className="font-semibold text-gray-700">{e.emissao_nf || '—'}</span>
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-xs text-gray-700">{e.produto || '—'}</td>
                                                <td className="px-3 py-2 text-xs text-gray-500 max-w-[180px] truncate" title={e.desc_produto}>{e.desc_produto || '—'}</td>
                                                <td className="px-3 py-2 text-right font-bold text-emerald-700 whitespace-nowrap">
                                                    {fmtQtd(e.qtd_entregue)} <span className="text-xs text-gray-400 font-normal">{e.unidade}</span>
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-500">{e.transportadora || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        )}
                        
                        {/* Load More Button */}
                        {hasMore && !loading && !error && (
                            <div className="flex justify-center p-4 border-t border-slate-100">
                                <button
                                    onClick={() => fetchData(page + 1, true)}
                                    disabled={loadingMore}
                                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {loadingMore ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    Carregar mais itens
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {!loading && !error && items.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                            <span><strong className="text-slate-700">{kpis.total}</strong> itens</span>
                            <span>·</span>
                            <span><strong className="text-slate-700">{fmtQtd(kpis.qtdTotal)}</strong> un. vendidas</span>
                            <span>·</span>
                            <span><strong className="text-emerald-700">{fmtQtd(kpis.qtdFat)}</strong> un. faturadas</span>
                            <span>·</span>
                            <span><strong className="text-amber-700">{fmtQtd(kpis.qtdTotal - kpis.qtdFat)}</strong> un. saldo</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PortalCliente;
