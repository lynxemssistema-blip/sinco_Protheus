import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Search, ChevronDown, ChevronRight, Package, AlertTriangle,
    CheckCircle, Clock, TrendingUp, Factory
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); }
    catch { return '—'; }
};

const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function StatusBadge({ pct }) {
    if (pct >= 100) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3" /> Concluído
        </span>
    );
    if (pct > 0) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" /> Em andamento
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <TrendingUp className="w-3 h-3" /> Não iniciado
        </span>
    );
}

// ─── main component ────────────────────────────────────────────────────────────
export default function ConsolidadoView({ ops = [] }) {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('produto');   // 'produto' | 'pct' | 'entrega'
    const [sortDir, setSortDir] = useState('asc');
    const [expanded, setExpanded] = useState({});

    // 1. Agrupa por produto (cod_produto_op)
    const grouped = useMemo(() => {
        const map = new Map();

        ops.forEach(op => {
            const cod  = (op.cod_produto_op || '').trim();
            const desc = (op.desc_produto   || '').trim();

            if (!cod) return;

            if (!map.has(cod)) {
                map.set(cod, {
                    cod,
                    desc,
                    qtd_planejada_total: 0,
                    qtd_produzida_total: 0,
                    ops_list: [],
                    pedidos: new Set(),
                    recursos: new Set(),
                    datas_entrega: [],
                });
            }

            const g = map.get(cod);
            const planejada = Number(op.qtd_planejada  || 0);
            const produzida = Number(op.qtd_produzida  || 0);

            g.qtd_planejada_total += planejada;
            g.qtd_produzida_total += produzida;
            g.ops_list.push(op);

            if (op.pedido_venda) g.pedidos.add(op.pedido_venda);
            const rec = (op.desc_recurso || op.recurso || '').trim();
            if (rec) g.recursos.add(rec);
            if (op.data_entrega_pcp) g.datas_entrega.push(op.data_entrega_pcp);
        });

        return Array.from(map.values()).map(g => ({
            ...g,
            pedidos:       [...g.pedidos],
            recursos:      [...g.recursos],
            data_mais_cedo: g.datas_entrega.length
                ? g.datas_entrega.sort()[0]
                : null,
            pct: g.qtd_planejada_total > 0
                ? Math.min(100, Math.round((g.qtd_produzida_total / g.qtd_planejada_total) * 100))
                : 0,
        }));
    }, [ops]);

    // 2. Filtra por texto
    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return grouped;
        return grouped.filter(g =>
            g.cod.toLowerCase().includes(q)  ||
            g.desc.toLowerCase().includes(q) ||
            g.pedidos.some(p => p.toLowerCase().includes(q)) ||
            g.recursos.some(r => r.toLowerCase().includes(q))
        );
    }, [grouped, search]);

    // 3. Ordena
    const sorted = useMemo(() => {
        const arr = [...filtered];
        const dir = sortDir === 'asc' ? 1 : -1;
        arr.sort((a, b) => {
            if (sortBy === 'pct')     return dir * (a.pct - b.pct);
            if (sortBy === 'entrega') return dir * ((a.data_mais_cedo || '9999') > (b.data_mais_cedo || '9999') ? 1 : -1);
            return dir * a.cod.localeCompare(b.cod);
        });
        return arr;
    }, [filtered, sortBy, sortDir]);

    const toggleSort = (col) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir('asc'); }
    };

    const toggleRow = (cod) => setExpanded(p => ({ ...p, [cod]: !p[cod] }));

    const SortIcon = ({ col }) => sortBy !== col ? null : (
        <span className="ml-0.5 text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
    );

    // ── stats cards ─────────────────────────────────────────────────────────
    const totalProd     = grouped.length;
    const concluidos    = grouped.filter(g => g.pct >= 100).length;
    const emAndamento   = grouped.filter(g => g.pct > 0 && g.pct < 100).length;
    const naoIniciados  = grouped.filter(g => g.pct === 0).length;

    return (
        <div className="flex flex-col gap-4 p-4 h-full min-h-0">

            {/* ── Título + KPIs ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-base font-bold text-slate-900">Visão Consolidada por Produto</h2>
                    <span className="ml-auto text-xs text-slate-400">
                        Agrupamento de {ops.length} operações em {totalProd} produtos
                    </span>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { label: 'Produtos únicos',   val: totalProd,   color: 'bg-slate-50 border-slate-200 text-slate-700' },
                        { label: 'Concluídos',         val: concluidos,  color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                        { label: 'Em andamento',       val: emAndamento, color: 'bg-blue-50 border-blue-200 text-blue-700' },
                        { label: 'Não iniciados',      val: naoIniciados,color: 'bg-amber-50 border-amber-200 text-amber-700' },
                    ].map(k => (
                        <div key={k.label} className={`rounded-xl border p-3 flex flex-col gap-0.5 ${k.color}`}>
                            <span className="text-xl font-bold">{k.val}</span>
                            <span className="text-xs font-medium">{k.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Search bar ───────────────────────────────────────────── */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por produto, descrição, pedido ou recurso..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* ── Tabela consolidada ───────────────────────────────────── */}
            <div className="flex-1 rounded-xl border border-slate-200 overflow-y-auto bg-white shadow-sm">
                {sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-400">
                        <Factory className="w-10 h-10" />
                        <p className="text-sm font-medium">Nenhum produto encontrado.</p>
                        {search && <p className="text-xs">Tente limpar o filtro de busca.</p>}
                        {!search && ops.length === 0 && <p className="text-xs">Aplique filtros na aba "Tabela de Operações" e os dados aparecerão aqui.</p>}
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-left sticky top-0 z-10 shadow-sm">
                                <th className="p-3 w-8"></th>
                                <th
                                    className="p-3 font-semibold text-slate-600 text-xs uppercase tracking-wide cursor-pointer select-none hover:text-slate-900"
                                    onClick={() => toggleSort('produto')}
                                >
                                    Produto <SortIcon col="produto" />
                                </th>
                                <th className="p-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Pedidos</th>
                                <th className="p-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Recursos</th>
                                <th
                                    className="p-3 font-semibold text-slate-600 text-xs uppercase tracking-wide text-center cursor-pointer select-none hover:text-slate-900"
                                    onClick={() => toggleSort('entrega')}
                                >
                                    Entrega <SortIcon col="entrega" />
                                </th>
                                <th className="p-3 font-semibold text-slate-600 text-xs uppercase tracking-wide text-right">Planejado</th>
                                <th className="p-3 font-semibold text-slate-600 text-xs uppercase tracking-wide text-right">Produzido</th>
                                <th
                                    className="p-3 font-semibold text-slate-600 text-xs uppercase tracking-wide text-center cursor-pointer select-none hover:text-slate-900"
                                    onClick={() => toggleSort('pct')}
                                >
                                    Progresso <SortIcon col="pct" />
                                </th>
                                <th className="p-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sorted.map((g, idx) => {
                                const isOpen = !!expanded[g.cod];
                                const isAlerta = g.pct < 100 && g.data_mais_cedo && new Date(g.data_mais_cedo) < new Date();

                                return (
                                    <React.Fragment key={g.cod}>
                                        {/* ── Linha do produto ── */}
                                        <tr
                                            className={`cursor-pointer transition-colors hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} ${isAlerta ? 'border-l-2 border-l-red-400' : ''}`}
                                            onClick={() => toggleRow(g.cod)}
                                        >
                                            {/* expand */}
                                            <td className="p-3 text-slate-400">
                                                {isOpen
                                                    ? <ChevronDown className="w-4 h-4" />
                                                    : <ChevronRight className="w-4 h-4" />
                                                }
                                            </td>

                                            {/* produto */}
                                            <td className="p-3">
                                                <div className="flex items-center gap-1.5">
                                                    {isAlerta && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                                    <div>
                                                        <Link
                                                            to={`/estrutura/${encodeURIComponent(g.cod)}`}
                                                            onClick={e => e.stopPropagation()}
                                                            className="font-mono text-xs font-bold text-blue-600 hover:underline"
                                                            title="Abrir BOM do produto"
                                                        >
                                                            {g.cod}
                                                        </Link>
                                                        <div className="text-xs text-slate-500 max-w-[260px] truncate" title={g.desc}>{g.desc}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* pedidos */}
                                            <td className="p-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {g.pedidos.slice(0, 3).map(p => (
                                                        <span key={p} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded font-mono">
                                                            {p}
                                                        </span>
                                                    ))}
                                                    {g.pedidos.length > 3 && (
                                                        <span className="text-xs text-slate-400">+{g.pedidos.length - 3}</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* recursos */}
                                            <td className="p-3">
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {g.recursos.slice(0, 2).map(r => (
                                                        <span key={r} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={r}>
                                                            {r}
                                                        </span>
                                                    ))}
                                                    {g.recursos.length > 2 && (
                                                        <span className="text-xs text-slate-400">+{g.recursos.length - 2}</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* entrega */}
                                            <td className="p-3 text-center">
                                                <span className={`text-xs font-semibold ${isAlerta ? 'text-red-600' : 'text-slate-700'}`}>
                                                    {fmtDate(g.data_mais_cedo)}
                                                </span>
                                            </td>

                                            {/* planejado */}
                                            <td className="p-3 text-right font-mono text-sm font-semibold text-slate-700">
                                                {fmtNum(g.qtd_planejada_total)}
                                            </td>

                                            {/* produzido */}
                                            <td className="p-3 text-right font-mono text-sm font-semibold text-slate-700">
                                                {fmtNum(g.qtd_produzida_total)}
                                            </td>

                                            {/* progresso */}
                                            <td className="p-3 text-center min-w-[120px]">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-xs font-bold text-slate-700">{g.pct}%</span>
                                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${g.pct >= 100 ? 'bg-emerald-500' : g.pct > 0 ? 'bg-blue-500' : 'bg-slate-300'}`}
                                                            style={{ width: `${g.pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* status */}
                                            <td className="p-3">
                                                <StatusBadge pct={g.pct} />
                                            </td>
                                        </tr>

                                        {/* ── Expansão: lista de OPs ── */}
                                        {isOpen && (
                                            <tr>
                                                <td colSpan={9} className="bg-slate-50 border-b border-slate-200">
                                                    <div className="px-8 py-3">
                                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                            Operações ({g.ops_list.length})
                                                        </p>
                                                        <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden bg-white">
                                                            <thead>
                                                                <tr className="bg-slate-100 text-slate-600 text-left">
                                                                    <th className="px-3 py-2">OP</th>
                                                                    <th className="px-3 py-2">Seq</th>
                                                                    <th className="px-3 py-2">Pedido</th>
                                                                    <th className="px-3 py-2">Recurso</th>
                                                                    <th className="px-3 py-2 text-center">Entrega</th>
                                                                    <th className="px-3 py-2 text-right">Plan.</th>
                                                                    <th className="px-3 py-2 text-right">Prod.</th>
                                                                    <th className="px-3 py-2 text-center">%</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {g.ops_list.map((op, i) => {
                                                                    const plan = Number(op.qtd_planejada || 0);
                                                                    const prod = Number(op.qtd_produzida || 0);
                                                                    const pct  = plan > 0 ? Math.min(100, Math.round((prod / plan) * 100)) : 0;
                                                                    return (
                                                                        <tr key={`${op.op}-${op.item_op}-${op.sequen}-${i}`} className="hover:bg-slate-50">
                                                                            <td className="px-3 py-2 font-mono font-semibold text-slate-800">{op.op}/{op.item_op}</td>
                                                                            <td className="px-3 py-2 text-slate-500">{op.sequen}</td>
                                                                            <td className="px-3 py-2 font-mono text-indigo-700">{op.pedido_venda || '—'}</td>
                                                                            <td className="px-3 py-2 text-blue-700 truncate max-w-[150px]" title={op.desc_recurso || op.recurso}>
                                                                                {op.desc_recurso || op.recurso || '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-center">{fmtDate(op.data_entrega_pcp)}</td>
                                                                            <td className="px-3 py-2 text-right font-mono">{fmtNum(plan)}</td>
                                                                            <td className="px-3 py-2 text-right font-mono">{fmtNum(prod)}</td>
                                                                            <td className="px-3 py-2 text-center">
                                                                                <span className={`font-bold ${pct >= 100 ? 'text-emerald-600' : pct > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                                                                    {pct}%
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Rodapé ──────────────────────────────────────────────── */}
            {sorted.length > 0 && (
                <p className="text-xs text-slate-400 text-right">
                    Exibindo {sorted.length} de {grouped.length} produtos · Os dados refletem as operações carregadas na aba "Tabela de Operações"
                </p>
            )}
        </div>
    );
}
