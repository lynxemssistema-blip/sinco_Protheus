import React, { useState, useEffect, useMemo } from 'react';
import api, { getFileUrl } from '../services/api';
import { 
    ClipboardList, Search, Calendar, User, Package, 
    Download, Mail, Filter, Loader2, AlertCircle, 
    Inbox, Factory, ChevronDown, ChevronRight, Layers, FileText
} from 'lucide-react';
import { toast } from 'react-toastify';
import { generateSingleRNCPdf } from '../services/rncPdfGenerator';
import RNCSendEmailModal from '../components/RNCSendEmailModal';


// ─── Aba Engenharia ───────────────────────────────────────────────────────────
const EngineeringTab = () => {
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', product: '', user: '', pedido: '', item: '' });

    const fetchReleases = async (params = filters) => {
        setLoading(true);
        try {
            const { data } = await api.get('/engineering-releases', { params });
            setReleases(data);
        } catch {
            toast.error('Falha ao carregar liberações de engenharia.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReleases(); }, []);

    const handleChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));
    const clearFilters = () => { const c = { startDate:'',endDate:'',product:'',user:'',pedido:'',item:'' }; setFilters(c); fetchReleases(c); };

    const formatDate = dateStr => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('pt-BR', { day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit' });
    };

    const groupedReleases = useMemo(() => {
        const ObjectGroups = {};
        releases.forEach(r => {
            const key = r.codigo_produto || 'SEM_PRODUTO';
            if (!ObjectGroups[key]) ObjectGroups[key] = { codigo_produto: key, descricao_produto: r.descricao_produto, items: [] };
            ObjectGroups[key].items.push(r);
        });
        return Object.values(ObjectGroups);
    }, [releases]);

    return (
        <div className="space-y-5">
            {/* Filtros */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-red-600" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Filtros</h2>
                    <span className="ml-auto text-xs text-slate-400 font-medium">{releases.length} registros</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                        { name:'product', label:'Cód. Produto', icon: Package, placeholder:'Código...' },
                        { name:'pedido',  label:'Pedido',       icon: ClipboardList, placeholder:'Nº pedido...' },
                        { name:'item',    label:'Item',         icon: Search, placeholder:'Item...' },
                        { name:'user',    label:'Usuário',      icon: User, placeholder:'Nome...' },
                    ].map(f => (
                        <div key={f.name} className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">{f.label}</label>
                            <div className="relative">
                                <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" name={f.name} placeholder={f.placeholder} value={filters[f.name]}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                            </div>
                        </div>
                    ))}
                    {['startDate','endDate'].map((n,i) => (
                        <div key={n} className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">{i===0?'De':'Até'}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="date" name={n} value={filters[n]} onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-3 pt-1">
                    <button onClick={clearFilters} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Limpar</button>
                    <button onClick={() => fetchReleases()} className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-xl text-sm font-bold shadow shadow-red-200 hover:bg-red-700 transition-all">
                        <Search className="w-4 h-4" /> Aplicar
                    </button>
                </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {['Cód. Lib.','Ação / Data','Pedido / Item','Usuário','Detalhes'].map(h => (
                                    <th key={h} className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={5} className="py-16 text-center"><Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto" /></td></tr>
                            ) : groupedReleases.length === 0 ? (
                                <tr><td colSpan={5} className="py-16 text-center text-slate-400 text-sm"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />Nenhum registro encontrado.</td></tr>
                            ) : groupedReleases.map(group => (
                                <React.Fragment key={group.codigo_produto}>
                                    <tr className="bg-red-50/50 border-t border-b border-red-100">
                                        <td colSpan={5} className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-red-100 rounded-lg"><Package className="w-4 h-4 text-red-600" /></div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-slate-800 font-mono">{group.codigo_produto}</h3>
                                                    <p className="text-[11px] text-slate-500">{group.descricao_produto}</p>
                                                </div>
                                                <div className="ml-auto flex items-center gap-2 text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                                                    {group.items.length} registro(s)
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    {group.items.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-4 pl-8">
                                                {r.codigo_liberacao
                                                    ? <span className="text-xs font-bold font-mono px-2 py-1 bg-red-100 text-red-800 border border-red-200 rounded-lg tracking-wider">{r.codigo_liberacao}</span>
                                                    : <span className="text-xs text-slate-300 italic">—</span>}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg ${r.tipo_acao==='EMAIL'?'bg-blue-50 text-blue-500':'bg-orange-50 text-orange-500'}`}>
                                                        {r.tipo_acao==='EMAIL'?<Mail className="w-3.5 h-3.5"/>:<Download className="w-3.5 h-3.5"/>}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700">{r.tipo_acao==='EMAIL'?'E-mail':'PDF'}</p>
                                                        <p className="text-[11px] text-slate-400">{formatDate(r.data_hora)}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                {r.pedido ? <div className="flex gap-1.5 flex-wrap">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-bold font-mono">PED: {r.pedido}</span>
                                                    {r.item && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-bold font-mono">ITEM: {r.item}</span>}
                                                </div> : <span className="text-xs text-slate-300">—</span>}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold border border-indigo-100">
                                                        {r.usuario?.substring(0,2).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-600">{r.usuario}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${r.modo==='FULL'?'bg-cyan-50 text-cyan-600 border border-cyan-100':'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                                            {r.modo==='FULL'?'COMPLETO':'NÍVEL 1'}
                                                        </span>
                                                        {r.destinatarios && <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[220px]">Para: {r.destinatarios}</p>}
                                                    </div>
                                                    {r.caminho_arquivo && (
                                                        <button
                                                            onClick={() => window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(r.caminho_arquivo)}`), '_blank')}
                                                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-100 ml-auto"
                                                            title="Abrir PDF salvo na rede"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ─── Aba PCP / Lote ───────────────────────────────────────────────────────────
const PCPTab = () => {
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(new Set());
    const [filters, setFilters] = useState({ startDate:'',endDate:'',lote:'',usuario:'',pedido:'',produto:'',codigo:'' });

    const fetchReleases = async (params = filters) => {
        setLoading(true);
        try {
            const { data } = await api.get('/pcp-releases', { params });
            setReleases(data);
        } catch {
            toast.error('Falha ao carregar liberações PCP.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReleases(); }, []);

    const handleChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));
    const clearFilters = () => { const c = {startDate:'',endDate:'',lote:'',usuario:'',pedido:'',produto:'',codigo:''}; setFilters(c); fetchReleases(c); };
    const toggleExpand = id => setExpanded(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

    const formatDate = dateStr => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('pt-BR', { day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit' });
    };

    return (
        <div className="space-y-5">
            {/* Filtros */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-green-600" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Filtros</h2>
                    <span className="ml-auto text-xs text-slate-400 font-medium">{releases.length} registros</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                        { name:'lote',    label:'Lote / OP',      icon: Layers,        placeholder:'Buscar lote...' },
                        { name:'pedido',  label:'Pedido de Venda', icon: ClipboardList, placeholder:'Nº pedido...' },
                        { name:'produto', label:'Produto/Código',  icon: Package,       placeholder:'Cód. produto...' },
                        { name:'usuario', label:'Usuário',         icon: User,          placeholder:'Nome...' },
                        { name:'codigo',  label:'Cód. Liberação',  icon: Search,        placeholder:'LPF-2026-...' },
                    ].map(f => (
                        <div key={f.name} className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">{f.label}</label>
                            <div className="relative">
                                <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" name={f.name} placeholder={f.placeholder} value={filters[f.name]}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                            </div>
                        </div>
                    ))}
                    {['startDate','endDate'].map((n,i) => (
                        <div key={n} className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">{i===0?'De':'Até'}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="date" name={n} value={filters[n]} onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-3 pt-1">
                    <button onClick={clearFilters} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Limpar</button>
                    <button onClick={() => fetchReleases()} className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-bold shadow shadow-green-200 hover:bg-green-700 transition-all">
                        <Search className="w-4 h-4" /> Aplicar
                    </button>
                </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {['','Cód. Liberação','Data / Hora','Lote (OPs)','Data PCP','Usuário','Qtd. OPs'].map((h,i) => (
                                    <th key={i} className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={6} className="py-16 text-center"><Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto" /></td></tr>
                            ) : releases.length === 0 ? (
                                <tr><td colSpan={6} className="py-16 text-center text-slate-400 text-sm"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />Nenhuma liberação PCP registrada.</td></tr>
                            ) : releases.map(r => (
                                <React.Fragment key={r.id}>
                                    <tr className="hover:bg-slate-50/60 transition-colors cursor-pointer" onClick={() => toggleExpand(r.id)}>
                                        <td className="px-4 py-4 w-8">
                                            {expanded.has(r.id)
                                                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                                : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                {r.codigo_liberacao
                                                    ? <span className="text-xs font-bold font-mono px-2 py-1 bg-green-100 text-green-800 border border-green-200 rounded-lg tracking-wider">{r.codigo_liberacao}</span>
                                                    : <span className="text-xs text-slate-300 italic">—</span>}
                                                {r.caminho_arquivo && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(r.caminho_arquivo)}`), '_blank'); }}
                                                        className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors border border-green-100"
                                                        title="Abrir PDF salvo na rede"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-green-50 text-green-600 rounded-lg">
                                                    <Factory className="w-3.5 h-3.5" />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">LOTE PCP</span>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(r.data_hora)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 max-w-[250px]">
                                            <p className="text-xs font-bold text-slate-700 font-mono truncate" title={r.lote_info}>{r.lote_info}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-sm font-semibold text-slate-600">{r.data_pcp || '—'}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-[10px] font-bold border border-green-100">
                                                    {r.usuario?.substring(0,2).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-semibold text-slate-600">{r.usuario}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{r.qtd_ops} OP(s)</span>
                                        </td>
                                    </tr>
                                    {/* Expandable detail row */}
                                    {expanded.has(r.id) && r.ops && r.ops.length > 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-8 pb-4 bg-green-50/30">
                                                <div className="rounded-xl border border-green-100 overflow-hidden mt-1">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="bg-green-50 border-b border-green-100">
                                                                {['Pedido','Item','OP/Lote','Produto','Descrição','Qtd'].map(h => (
                                                                    <th key={h} className="px-4 py-2 text-[10px] font-bold text-green-700 uppercase">{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-green-50">
                                                            {r.ops.map((op, i) => (
                                                                <tr key={i} className="hover:bg-green-50/50 transition-colors">
                                                                    <td className="px-4 py-2 text-xs font-mono font-bold text-slate-700">{op.pedido}</td>
                                                                    <td className="px-4 py-2 text-xs text-slate-500">{op.item}</td>
                                                                    <td className="px-4 py-2 text-xs font-mono text-green-700 font-bold">{op.visual_op}</td>
                                                                    <td className="px-4 py-2 text-xs font-mono text-slate-600">{op.produto}</td>
                                                                    <td className="px-4 py-2 text-xs text-slate-500 max-w-[180px] truncate">{op.descricao}</td>
                                                                    <td className="px-4 py-2 text-xs font-bold text-slate-700">{op.qtd}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ─── Aba Controle Romaneio ───────────────────────────────────────────────────
const RomaneioHistoryTab = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', search: '' });

    const fetchHistory = async (params = filters) => {
        setLoading(true);
        try {
            const { data } = await api.get('/romaneios/revisions/all', { params });
            setHistory(data);
        } catch {
            toast.error('Falha ao carregar histórico de romaneios.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchHistory(); }, []);

    const handleChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));
    const clearFilters = () => { const c = { startDate: '', endDate: '', search: '' }; setFilters(c); fetchHistory(c); };

    const formatDate = dateStr => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-5">
            {/* Filtros */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Filtros</h2>
                    <span className="ml-auto text-xs text-slate-400 font-medium">{history.length} registros</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Busca Geral</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="text" name="search" placeholder="ID ou Cliente..." value={filters.search}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>
                    {['startDate', 'endDate'].map((n, i) => (
                        <div key={n} className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">{i === 0 ? 'De' : 'Até'}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="date" name={n} value={filters[n]} onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-3 pt-1">
                    <button onClick={clearFilters} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Limpar</button>
                    <button onClick={() => fetchHistory()} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow shadow-blue-200 hover:bg-blue-700 transition-all">
                        <Search className="w-4 h-4" /> Aplicar
                    </button>
                </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {['Romaneio', 'Cliente', 'Mudança / Motivo', 'Data / Hora', 'Usuário', 'Status Atual', 'PDF'].map(h => (
                                    <th key={h} className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" /></td></tr>
                            ) : history.length === 0 ? (
                                <tr><td colSpan={7} className="py-16 text-center text-slate-400 text-sm"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />Nenhuma alteração registrada.</td></tr>
                            ) : history.map(h => (
                                <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-5 py-4 text-center">
                                        <span className="text-xs font-bold font-mono px-2 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg">#{h.romaneio_id}</span>
                                    </td>
                                    <td className="px-5 py-4 font-semibold text-sm text-slate-700">{h.cliente_nome}</td>
                                    <td className="px-5 py-4">
                                        <p className="text-xs font-bold text-slate-800">{h.reason}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Rev: {h.revision_number}</p>
                                    </td>
                                    <td className="px-5 py-4 text-[11px] text-slate-500">{formatDate(h.created_at)}</td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold border border-blue-100">
                                                {h.usuario?.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-600">{h.usuario}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.current_status === 'Finalizado' ? 'bg-green-100 text-green-700' : h.current_status === 'Cancelado' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {h.current_status?.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <button
                                            onClick={() => {
                                                const token = localStorage.getItem('@MetalFisa:token');
                                                window.open(`${api.defaults.baseURL}/romaneios/${h.romaneio_id}/generate-bundle?token=${token}`, '_blank');
                                            }}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group"
                                            title="Abrir Caderno PDF"
                                        >
                                            <FileText className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ─── Aba E-mails RNC ──────────────────────────────────────────────────────────
const RNCEmailsTab = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', search: '', rncId: '', product: '' });
    const [emailRncTarget, setEmailRncTarget] = useState(null);

    const fetchHistory = async (params = filters) => {
        setLoading(true);
        try {
            const { data } = await api.get('/email/rnc-history', { params });
            setHistory(data.data || []);
        } catch (err) {
            toast.error('Falha ao carregar histórico de e-mails da RNC.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));
    
    const clearFilters = () => {
        const c = { startDate: '', endDate: '', search: '', rncId: '', product: '' };
        setFilters(c);
        fetchHistory(c);
    };

    const formatDate = dateStr => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleViewPdf = async (rnc) => {
        if (!rnc) {
            toast.error('Dados da RNC não integrados neste registro de e-mail.');
            return;
        }
        try {
            await generateSingleRNCPdf(rnc);
            toast.success(`PDF da RNC #${rnc.id} gerado com sucesso!`);
        } catch (err) {
            toast.error('Erro ao gerar o PDF da RNC.');
        }
    };

    return (
        <div className="space-y-5">
            {/* Filtros */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Filtros</h2>
                    <span className="ml-auto text-xs text-slate-400 font-medium">{history.length} registros</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">ID da RNC</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="number"
                                name="rncId"
                                placeholder="ID..."
                                value={filters.rncId}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Produto (Cód.)</label>
                        <div className="relative">
                            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                name="product"
                                placeholder="Código..."
                                value={filters.product}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-1 md:col-span-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Buscar Destinatário</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                name="search"
                                placeholder="E-mail ou nome..."
                                value={filters.search}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    {['startDate', 'endDate'].map((n, i) => (
                        <div key={n} className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">{i === 0 ? 'De' : 'Até'}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="date"
                                    name={n}
                                    value={filters[n]}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-3 pt-1">
                    <button onClick={clearFilters} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Limpar</button>
                    <button onClick={() => fetchHistory()} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow shadow-indigo-200 hover:bg-indigo-700 transition-all">
                        <Search className="w-4 h-4" /> Aplicar
                    </button>
                </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {[
                                    'RNC ID',
                                    'Status RNC',
                                    'Data / Hora Envio',
                                    'Destinatários',
                                    'Produto',
                                    'Rastreabilidade',
                                    'Anexo Desenho',
                                    'Ações'
                                ].map(h => (
                                    <th key={h} className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={8} className="py-16 text-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" /></td></tr>
                            ) : history.length === 0 ? (
                                <tr><td colSpan={8} className="py-16 text-center text-slate-400 text-sm"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />Nenhum e-mail de RNC encontrado.</td></tr>
                            ) : history.map(row => (
                                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-5 py-4">
                                        {row.rncId ? (
                                            <span className="text-xs font-bold font-mono px-2 py-1 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg tracking-wider">
                                                #{row.rncId}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-300 italic">Desconhecido</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        {row.rnc ? (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                row.rnc.status === 'CONCLUIDO' 
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                    : row.rnc.status === 'EM ANDAMENTO' 
                                                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                            }`}>
                                                {row.rnc.status}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg">
                                                <Mail className="w-3.5 h-3.5" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-700">Enviado</p>
                                                <p className="text-[11px] text-slate-400">{formatDate(row.date)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 max-w-[220px]">
                                        <p className="text-xs text-slate-700 font-medium truncate" title={row.recipient_email}>
                                            {row.recipient_email}
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate">Por: {row.sender_name || row.sender_email}</p>
                                    </td>
                                    <td className="px-5 py-4">
                                        {row.rnc ? (
                                            <div>
                                                <p className="text-xs font-mono font-bold text-slate-800">{row.rnc.produto}</p>
                                                <p className="text-[10px] text-slate-500 max-w-[150px] truncate">{row.rnc.desc_produto}</p>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 truncate max-w-[150px]" title={row.subject}>{row.subject}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        {row.rnc ? (
                                            <div className="flex gap-1 flex-wrap max-w-[150px]">
                                                {row.rnc.op && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold font-mono">OP: {row.rnc.op}</span>}
                                                {row.rnc.pedido && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold font-mono">PV: {row.rnc.pedido}</span>}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        {row.has_attachments ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-bold">
                                                Sim
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-400 border border-slate-200 rounded text-[10px]">
                                                Não
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            {row.rnc && (
                                                <>
                                                    <button
                                                        onClick={() => handleViewPdf(row.rnc)}
                                                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-100"
                                                        title="Visualizar Relatório PDF F 097-22"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEmailRncTarget(row.rnc)}
                                                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors border border-indigo-100"
                                                        title="Reenviar Relatório por E-mail"
                                                    >
                                                        <Mail className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de reenvio de e-mail */}
            {emailRncTarget && (
                <RNCSendEmailModal
                    isOpen={!!emailRncTarget}
                    rnc={emailRncTarget}
                    onClose={() => {
                        setEmailRncTarget(null);
                        fetchHistory();
                    }}
                />
            )}
        </div>
    );
};

// ─── Aba E-mails NFe (Fiscal) ───────────────────────────────────────────────
const NFEReceiptsTab = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/nfe-recebimento/emails/todos');
            setHistory(data);
        } catch (err) {
            toast.error('Falha ao carregar histórico de e-mails da NFe.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const formatDate = dateStr => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="space-y-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-purple-600" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Registro de Comunicação (Fiscal / Almoxarifado)</h2>
                </div>
                <button onClick={fetchHistory} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-lg text-sm font-bold shadow-sm hover:bg-purple-100 transition-all">Atualizar</button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            {['NF', 'Fornecedor', 'Data / Hora', 'Remetente', 'Destinatários', 'Assunto', 'Status'].map(h => (
                                <th key={h} className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto" /></td></tr>
                        ) : history.length === 0 ? (
                            <tr><td colSpan={7} className="py-16 text-center text-slate-400 text-sm"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />Nenhum e-mail de NFe encontrado.</td></tr>
                        ) : history.map(row => (
                            <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-5 py-4 font-bold font-mono text-slate-700">{row.numero_nf}</td>
                                <td className="px-5 py-4 font-medium text-slate-800 text-sm max-w-[200px] truncate">{row.emitente_nome}</td>
                                <td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.created_at)}</td>
                                <td className="px-5 py-4 text-xs font-semibold text-slate-700">{row.remetente}</td>
                                <td className="px-5 py-4 text-[11px] text-slate-500 max-w-[200px] truncate" title={row.destinatarios}>{row.destinatarios}</td>
                                <td className="px-5 py-4 text-xs text-slate-600 max-w-[200px] truncate" title={row.assunto}>{row.assunto}</td>
                                <td className="px-5 py-4">
                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{row.status}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── Página principal ─────────────────────────────────────────────────────────
const EngineeringReleaseReport = () => {
    const [activeTab, setActiveTab] = useState('engenharia');

    const tabs = [
        { id: 'engenharia', label: 'Engenharia', icon: ClipboardList, color: 'red' },
        { id: 'pcp',        label: 'PCP / Lote Aglutinado', icon: Factory,       color: 'green' },
        { id: 'romaneio',   label: 'Controle Romaneio', icon: Package,       color: 'blue' },
        { id: 'rnc_emails', label: 'Controle Envios RNC', icon: Mail,          color: 'indigo' },
        { id: 'nfe_emails', label: 'Recebimentos Fiscais', icon: FileText,     color: 'purple' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-200">
                        <ClipboardList className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Relatório de Liberação</h1>
                        <p className="text-slate-500 text-sm font-medium">Engenharia e PCP — Liberações para fabricação</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
                {tabs.map(tab => {
                    const active = activeTab === tab.id;
                    const colorMap = {
                        red:   { active: 'bg-white text-red-600 shadow-sm border border-red-100',   inactive: 'text-slate-500 hover:text-red-500' },
                        green: { active: 'bg-white text-green-600 shadow-sm border border-green-100', inactive: 'text-slate-500 hover:text-green-500' },
                        blue:  { active: 'bg-white text-blue-600 shadow-sm border border-blue-100',  inactive: 'text-slate-500 hover:text-blue-500' },
                        indigo:{ active: 'bg-white text-indigo-600 shadow-sm border border-indigo-100', inactive: 'text-slate-500 hover:text-indigo-500' },
                        purple:{ active: 'bg-white text-purple-600 shadow-sm border border-purple-100', inactive: 'text-slate-500 hover:text-purple-500' },
                    };
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${active ? colorMap[tab.color].active : colorMap[tab.color].inactive}`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {activeTab === 'engenharia' ? <EngineeringTab /> : 
             activeTab === 'pcp' ? <PCPTab /> : 
             activeTab === 'rnc_emails' ? <RNCEmailsTab /> : 
             activeTab === 'nfe_emails' ? <NFEReceiptsTab /> : <RomaneioHistoryTab />}
        </div>
    );
};

export default EngineeringReleaseReport;

