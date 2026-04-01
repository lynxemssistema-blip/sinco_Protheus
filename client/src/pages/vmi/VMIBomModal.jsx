import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Layers, AlertCircle, Download, ChevronRight, Loader2, ChevronDown, Package, BookOpen } from 'lucide-react';
import { api } from '../../services/api';
import * as XLSX from 'xlsx';

const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
const NIVEL_INDENT = 18;

// ── Modo único: { produto: {codigo_cliente, descricao_cliente, b1_cod, totalQty} }
// ── Modo multi: { produtos: [{b1_cod, label, qty}], titulo }

export default function VMIBomModal({ produto, produtos, titulo, onClose }) {
    const isMulti = !!produtos;

    // ── Estado único ──────────────────────────────────────────────────────────
    const [qty, setQty] = useState(!isMulti ? (produto?.totalQty || 1) : 1);
    const [bom, setBom] = useState([]);

    // ── Estado multi ──────────────────────────────────────────────────────────
    const [bomMulti, setBomMulti] = useState([]); // [{b1_cod, label, qty, items}]
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [globalFator, setGlobalFator] = useState(1);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('consolidado'); // 'estrutura' | 'consolidado' | 'por_produto'
    const [expandedProd, setExpandedProd] = useState(new Set());
    const [generatingCaderno, setGeneratingCaderno] = useState(false);

    // ── Fetch único ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (isMulti) return;
        if (!produto?.b1_cod) return;
        setLoading(true); setError(null);
        api.get(`/produtos/${encodeURIComponent(produto.b1_cod.trim())}/estrutura`)
            .then(res => {
                const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
                setBom(items.filter(i => i.nivel > 0));
                setViewMode('estrutura');
            })
            .catch(err => setError(err.response?.data?.error || 'Erro ao buscar estrutura.'))
            .finally(() => setLoading(false));
    }, [produto?.b1_cod]);

    // ── Fetch multi ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isMulti) return;
        const lista = produtos.filter(p => p.b1_cod);
        if (!lista.length) return;

        setLoading(true); setError(null);
        setProgress({ done: 0, total: lista.length });

        const results = [];
        let done = 0;

        Promise.all(
            lista.map(p =>
                api.get(`/produtos/${encodeURIComponent(p.b1_cod.trim())}/estrutura`)
                    .then(res => {
                        const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
                        results.push({ ...p, items: items.filter(i => i.nivel > 0) });
                    })
                    .catch(() => results.push({ ...p, items: [] }))
                    .finally(() => { done++; setProgress({ done, total: lista.length }); })
            )
        ).then(() => {
            setBomMulti(results);
            setViewMode('consolidado');
        }).finally(() => setLoading(false));
    }, []);

    // ── Cálculos único ────────────────────────────────────────────────────────
    const bomComQtd = useMemo(() => {
        if (isMulti) return [];
        const fator = Number(qty) || 1;
        return bom.map(item => ({ ...item, qtd_total: (Number(item.qtd_necessaria) || 0) * fator }));
    }, [bom, qty, isMulti]);

    // ── Cálculos multi ────────────────────────────────────────────────────────
    // A quantidade é definida apenas pelo fator do produto pai.
    // p.qty (demanda VMI do componente) é exibida como referência, não entra no cálculo.
    const bomMultiComQtd = useMemo(() => {
        if (!isMulti) return [];
        const fator = Number(globalFator) || 1;
        return bomMulti.map(p => ({
            ...p,
            items: p.items.map(item => ({
                ...item,
                qtd_total: (Number(item.qtd_necessaria) || 0) * fator
            }))
        }));
    }, [bomMulti, isMulti, globalFator]);

    // ── Consolidado (ambos modos) ─────────────────────────────────────────────
    const consolidado = useMemo(() => {
        const source = isMulti
            ? bomMultiComQtd.flatMap(p => p.items)
            : bomComQtd;
        const map = {};
        source.forEach(item => {
            const key = item.codigo?.trim();
            if (!key) return;
            if (!map[key]) map[key] = { ...item, qtd_total: 0 };
            map[key].qtd_total += item.qtd_total;
        });
        return Object.values(map).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
    }, [bomComQtd, bomMultiComQtd, isMulti]);

    const totalItens = isMulti
        ? bomMulti.reduce((s, p) => s + p.items.length, 0)
        : bom.length;

    // ── Caderno PDF ───────────────────────────────────────────────────────────
    // Para cada produto no BOM consolidado, busca op-mirror e gera PDF unificado com desenhos
    const handleGerarCaderno = async () => {
        const fator = Number(globalFator) || 1;
        const lista = isMulti
            ? bomMultiComQtd.filter(p => p.b1_cod)
            : (produto?.b1_cod ? [{ b1_cod: produto.b1_cod, label: produto.descricao_cliente, qty: Number(qty) || 1 }] : []);

        if (!lista.length) { alert('Nenhum produto com código Protheus para gerar o caderno.'); return; }

        setGeneratingCaderno(true);
        try {
            const tituloDoc = isMulti ? (titulo || 'BOM Consolidado') : (produto?.descricao_cliente || produto?.b1_cod);
            const date = new Date().toLocaleDateString('pt-BR');

            // Busca op-mirror para cada produto em paralelo
            const results = await Promise.all(
                lista.map(p =>
                    api.get(`/vmi/op-mirror/${encodeURIComponent(p.b1_cod.trim())}?qty=${isMulti ? fator : (Number(qty) || 1)}&sheet=${encodeURIComponent(tituloDoc)}&data=${encodeURIComponent(date)}`)
                        .then(r => r.data)
                        .catch(() => null)
                )
            );

            // Monta mirrorData unificado com todos os itens
            const itensMerged = results
                .filter(Boolean)
                .flatMap(r => r.itens || []);

            if (!itensMerged.length) {
                alert('Nenhuma estrutura encontrada para os produtos selecionados.');
                return;
            }

            const mirrorData = {
                pedido: {
                    pedido: tituloDoc,
                    emissao: date,
                    nome_cliente: tituloDoc,
                    cgc_cliente: '',
                    municipio: '',
                    estado: ''
                },
                itens: itensMerged
            };

            const { generateOPByOperationWithDrawingsPdf } = await import('../../services/opByOperationWithDrawingsPdfGenerator');
            await generateOPByOperationWithDrawingsPdf(mirrorData, 'VMI');
        } catch (err) {
            alert('Erro ao gerar caderno PDF: ' + (err.message || err));
        } finally {
            setGeneratingCaderno(false);
        }
    };

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExport = () => {
        const wb = XLSX.utils.book_new();
        const date = new Date().toISOString().slice(0, 10);

        // Consolidado
        const ws1 = XLSX.utils.json_to_sheet(consolidado.map(item => ({
            'Cód. Protheus': item.codigo || '',
            'Descrição':     item.descricao || '',
            'Unidade':       item.unidade || '',
            'Qtd. Total':    Number(item.qtd_total) || 0,
        })));
        XLSX.utils.book_append_sheet(wb, ws1, 'Consolidado');

        if (isMulti) {
            // Por produto
            const rows = [];
            bomMultiComQtd.forEach(p => {
                rows.push({ 'Produto': `${p.b1_cod} — ${p.label}`, 'Demanda VMI (ref.)': p.qty, 'Cód. Comp.': '', 'Descrição': '', 'Unid.': '', 'Qtd. Unit.': '', 'Qtd. Total (×fator pai)': '' });
                p.items.forEach(item => rows.push({ 'Produto': '', 'Demanda VMI (ref.)': '', 'Cód. Comp.': item.codigo, 'Descrição': item.descricao, 'Unid.': item.unidade, 'Qtd. Unit.': item.qtd_necessaria, 'Qtd. Total (×fator pai)': item.qtd_total }));
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Por Produto');
        } else {
            const ws2 = XLSX.utils.json_to_sheet(bomComQtd.map(item => ({
                'Nível':         item.nivel,
                'Cód. Protheus': item.codigo || '',
                'Descrição':     item.descricao || '',
                'Unidade':       item.unidade || '',
                'Qtd. Unit.':    Number(item.qtd_necessaria) || 0,
                'Qtd. Total':    Number(item.qtd_total) || 0,
            })));
            XLSX.utils.book_append_sheet(wb, ws2, 'Estrutura Completa');
        }

        const nome = isMulti ? `BOM_Consolidado_fatorPai${Number(globalFator)||1}_${date}` : `BOM_${produto.b1_cod}_x${Number(qty)||1}_${date}`;
        XLSX.writeFile(wb, `${nome}.xlsx`);
    };

    const toggleProd = (cod) => setExpandedProd(prev => {
        const n = new Set(prev);
        n.has(cod) ? n.delete(cod) : n.add(cod);
        return n;
    });

    const tabs = isMulti
        ? ['consolidado', 'por_produto']
        : ['estrutura', 'consolidado'];
    const tabLabels = { estrutura: 'Estrutura', consolidado: 'Consolidado', por_produto: 'Por Produto' };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-slate-200">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                            {isMulti ? (titulo || 'Lista de Material Consolidada') : 'Lista de Material'}
                        </h2>
                        {!isMulti && (
                            <p className="text-sm text-slate-500 mt-0.5 truncate">
                                <span className="font-mono text-slate-700 font-semibold">{produto.codigo_cliente}</span>
                                {' — '}{produto.descricao_cliente}
                            </p>
                        )}
                        {!isMulti && produto.b1_cod && (
                            <span className="inline-block mt-1 bg-indigo-100 text-indigo-700 border border-indigo-200 font-mono font-bold px-2 py-0.5 rounded text-xs">
                                Protheus: {produto.b1_cod}
                            </span>
                        )}
                        {isMulti && (
                            <p className="text-sm text-slate-500 mt-0.5">
                                {produtos.filter(p => p.b1_cod).length} produtos · {consolidado.length} componentes únicos
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition ml-3 flex-shrink-0">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50 flex-wrap">
                    {!isMulti && (
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Quantidade (fator):</label>
                            <input
                                type="number" min="1" value={qty}
                                onChange={e => setQty(e.target.value)}
                                className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>
                    )}
                    {isMulti && (
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Fator do produto pai:</label>
                            <input
                                type="number" min="1" value={globalFator}
                                onChange={e => setGlobalFator(e.target.value)}
                                className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>
                    )}
                    <div className="flex gap-1 bg-slate-200 rounded-lg p-0.5">
                        {tabs.map(t => (
                            <button key={t} onClick={() => setViewMode(t)}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition ${viewMode === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {tabLabels[t]}
                            </button>
                        ))}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={handleGerarCaderno} disabled={loading || generatingCaderno || totalItens === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 transition">
                            {generatingCaderno ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                            Caderno PDF
                        </button>
                        <button onClick={handleExport} disabled={loading || totalItens === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition">
                            <Download className="w-3.5 h-3.5" />
                            Exportar Excel
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto">
                    {loading && (
                        <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-500">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                            {isMulti && progress.total > 0 && (
                                <div className="text-center">
                                    <p className="text-sm">Buscando estruturas... {progress.done}/{progress.total}</p>
                                    <div className="w-48 bg-slate-200 rounded-full h-1.5 mt-2">
                                        <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 m-5 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                        </div>
                    )}

                    {!isMulti && !produto?.b1_cod && !loading && (
                        <div className="flex items-center gap-2 m-5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            Produto sem código Protheus mapeado.
                        </div>
                    )}

                    {!loading && !error && totalItens === 0 && (isMulti || produto?.b1_cod) && (
                        <div className="flex items-center gap-2 m-5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {isMulti ? 'Nenhum componente encontrado nos produtos.' : 'Nenhum componente encontrado na estrutura.'}
                        </div>
                    )}

                    {/* Aba: Estrutura (único) */}
                    {!loading && !error && !isMulti && viewMode === 'estrutura' && bomComQtd.length > 0 && (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                                <tr>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Cód. Protheus</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Descrição</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Unid.</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Qtd. Unit.</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-indigo-600 uppercase">Total ×{Number(qty)||1}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bomComQtd.map((item, i) => (
                                    <tr key={i} className="border-b border-slate-50 hover:bg-indigo-50/20">
                                        <td className="px-4 py-2" style={{ paddingLeft: `${16 + (item.nivel - 1) * NIVEL_INDENT}px` }}>
                                            <div className="flex items-center gap-1">
                                                {item.nivel > 1 && <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />}
                                                <span className="font-mono text-xs font-semibold text-blue-700">{item.codigo}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-xs text-slate-600 max-w-[260px] truncate" title={item.descricao}>{item.descricao || '—'}</td>
                                        <td className="px-4 py-2 text-center text-xs text-slate-500 font-mono">{item.unidade || '—'}</td>
                                        <td className="px-4 py-2 text-right text-xs font-mono text-slate-600">{fmtNum(item.qtd_necessaria)}</td>
                                        <td className="px-4 py-2 text-right text-xs font-mono font-bold text-indigo-700">{fmtNum(item.qtd_total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Aba: Consolidado (ambos modos) */}
                    {!loading && !error && viewMode === 'consolidado' && consolidado.length > 0 && (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                                <tr>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Cód. Protheus</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Descrição</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Unid.</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-indigo-600 uppercase">Qtd. Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consolidado.map((item, i) => (
                                    <tr key={i} className="border-b border-slate-50 hover:bg-indigo-50/20">
                                        <td className="px-4 py-2 font-mono text-xs font-semibold text-blue-700">{item.codigo}</td>
                                        <td className="px-4 py-2 text-xs text-slate-600 max-w-[360px] truncate" title={item.descricao}>{item.descricao || '—'}</td>
                                        <td className="px-4 py-2 text-center text-xs text-slate-500 font-mono">{item.unidade || '—'}</td>
                                        <td className="px-4 py-2 text-right text-xs font-mono font-bold text-indigo-700">{fmtNum(item.qtd_total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Aba: Por Produto (multi) */}
                    {!loading && !error && isMulti && viewMode === 'por_produto' && bomMultiComQtd.length > 0 && (
                        <div className="divide-y divide-slate-100">
                            {bomMultiComQtd.map((p, pi) => {
                                const open = expandedProd.has(p.b1_cod);
                                return (
                                    <div key={pi}>
                                        <button
                                            onClick={() => toggleProd(p.b1_cod)}
                                            className="w-full flex items-center gap-3 px-5 py-3 bg-slate-50 hover:bg-slate-100 transition text-left">
                                            {open ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                                            <Package className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                            <span className="font-mono text-xs font-bold text-blue-700">{p.b1_cod}</span>
                                            <span className="text-xs text-slate-500 truncate">{p.label}</span>
                                            <span className="ml-auto text-xs font-mono text-slate-400 font-normal whitespace-nowrap mr-2">demanda VMI: {fmtNum(p.qty)}</span>
                                            <span className="text-xs font-mono text-indigo-600 font-semibold whitespace-nowrap">×{Number(globalFator)||1} · {p.items.length} itens</span>
                                        </button>
                                        {open && (
                                            <table className="w-full text-sm">
                                                <tbody>
                                                    {p.items.map((item, ii) => (
                                                        <tr key={ii} className="border-b border-slate-50 hover:bg-indigo-50/10">
                                                            <td className="px-8 py-1.5 font-mono text-xs text-blue-700">{item.codigo}</td>
                                                            <td className="px-4 py-1.5 text-xs text-slate-600 truncate max-w-[300px]">{item.descricao}</td>
                                                            <td className="px-4 py-1.5 text-center text-xs text-slate-400 font-mono">{item.unidade}</td>
                                                            <td className="px-4 py-1.5 text-right text-xs font-mono text-slate-500">{fmtNum(item.qtd_necessaria)}</td>
                                                            <td className="px-4 py-1.5 text-right text-xs font-mono font-bold text-indigo-700">{fmtNum(item.qtd_total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!loading && totalItens > 0 && (
                    <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        {isMulti && <span>{produtos.filter(p => p.b1_cod).length} produtos processados</span>}
                        <span>{totalItens} itens na estrutura</span>
                        <span>·</span>
                        <span>{consolidado.length} componentes únicos</span>
                        {!isMulti && <><span>·</span><span>Fator: <strong className="text-indigo-700 font-mono">×{Number(qty)||1}</strong></span></>}
                        {isMulti && <><span>·</span><span>Fator pai: <strong className="text-indigo-700 font-mono">×{Number(globalFator)||1}</strong></span></>}
                    </div>
                )}
            </div>
        </div>
    );
}
