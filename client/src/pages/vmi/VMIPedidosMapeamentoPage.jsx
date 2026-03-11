import { useState, useEffect, useMemo } from 'react';
import { ListOrdered, Search, Save, CheckCircle, RefreshCcw, AlertCircle, X, Link2Off, Download, FileText } from 'lucide-react';
import { api, getFileUrl } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
import * as XLSX from 'xlsx';

function PdfCell({ url }) {
    if (url) {
        return (
            <a href={getFileUrl(`/api/docs/view?path=${encodeURIComponent(url)}`)}
                target="_blank" rel="noopener noreferrer"
                title="Abrir desenho PDF" onClick={e => e.stopPropagation()}>
                <FileText className="w-5 h-5 text-red-500 hover:text-red-700 transition mx-auto" />
            </a>
        );
    }
    return <FileText className="w-5 h-5 text-slate-300 mx-auto" title="Sem PDF vinculado" />;
}

const TypeBadge = ({ type, detail }) => {
    if (!type) return null;
    const cfgs = {
        'Novo':      { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
        'Revisão':   { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
        'Restrição': { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200'    },
        'PCP':       { bg: 'bg-slate-100', text: 'text-slate-600',  border: 'border-slate-200'  }
    };
    const c = cfgs[type] || cfgs['PCP'];
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${c.bg} ${c.text} ${c.border} cursor-help whitespace-nowrap`}
              title={detail || ''}>
            {String(type).toUpperCase()}
        </span>
    );
};

const SCORE_META = {
    5: { label: 'Base + Rev',  bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300'  },
    4: { label: 'Base Exata',  bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300'   },
    3: { label: 'Rev. Match',  bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
    2: { label: 'Contém',      bg: 'bg-slate-100',  text: 'text-slate-500',  border: 'border-slate-300'  },
    1: { label: 'Parcial',     bg: 'bg-slate-100',  text: 'text-slate-500',  border: 'border-slate-300'  },
};

export default function VMIPedidosMapeamentoPage({ isTab = false }) {
    const [toast, setToast] = useState('');
    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

    const [loading, setLoading]         = useState(false);
    const [produtos, setProdutos]       = useState([]);   // { codigo_base, codigo_original, descricao }
    const [mapeamentos, setMapeamentos] = useState({});
    const [sugestoes, setSugestoes]     = useState({});
    const [bases, setBases]             = useState({});
    const [buscando, setBuscando]       = useState(false);
    const [salvando, setSalvando]       = useState({});
    const [selecoes, setSelecoes]       = useState({});
    const [progresso, setProgresso]     = useState(null);
    const [salvandoTodos, setSalvandoTodos] = useState(false);

    const [filterText, setFilterText]     = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    const carregarDados = async () => {
        setLoading(true);
        try {
            const [resPedidos, resMap] = await Promise.all([
                api.get('/vmi-pedidos'),
                api.get('/vmi/mapeamento/atual')
            ]);

            // Extrai produtos únicos usando codigo_base como chave
            const prodsMap = {};
            (resPedidos.data.data || []).forEach(p => {
                const key = p.codigo_base;
                if (key && !prodsMap[key]) {
                    prodsMap[key] = {
                        codigo_base:     key,
                        codigo_original: p.codigo_produto_cliente,
                        revisao_cliente: p.revisao_cliente || '',
                        descricao:       p.descricao_produto_cliente || ''
                    };
                }
            });
            setProdutos(Object.values(prodsMap));

            const mapDb = {};
            (resMap.data.data || []).forEach(m => {
                mapDb[m.codigo_produto_cliente] = {
                    b1_cod:             m.b1_cod,
                    descricao_protheus: m.descricao_protheus,
                    status_tipo_item:   m.status_tipo_item,
                    status_tipo_detalhe:m.status_tipo_detalhe,
                    pdf_url:            m.pdf_url || null
                };
            });
            setMapeamentos(mapDb);
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            showToast('Erro ao carregar os dados de mapeamento.');
        } finally {
            setLoading(false);
        }
    };

    const produtosFiltrados = useMemo(() => {
        let list = produtos;
        if (filterStatus === 'mapped')   list = list.filter(p =>  mapeamentos[p.codigo_base]);
        if (filterStatus === 'unmapped') list = list.filter(p => !mapeamentos[p.codigo_base]);
        if (filterText.trim()) {
            const s = filterText.toLowerCase();
            list = list.filter(p =>
                p.codigo_base?.toLowerCase().includes(s) ||
                p.codigo_original?.toLowerCase().includes(s) ||
                p.descricao?.toLowerCase().includes(s) ||
                mapeamentos[p.codigo_base]?.b1_cod?.toLowerCase().includes(s)
            );
        }
        return list;
    }, [produtos, mapeamentos, filterStatus, filterText]);

    const stats = useMemo(() => ({
        total:       produtos.length,
        mapeados:    produtos.filter(p =>  mapeamentos[p.codigo_base]).length,
        comSugestao: produtos.filter(p => (sugestoes[p.codigo_base]?.length ?? 0) > 0).length,
    }), [produtos, mapeamentos, sugestoes]);

    // ── Buscar sugestões em lotes ─────────────────────────────────────────────
    const BATCH_SIZE = 25;
    const handleBuscarSugestoes = async () => {
        setBuscando(true);
        try {
            const codigosBuscar = [...new Set(
                produtos.map(p => p.codigo_base).filter(cod => !mapeamentos[cod])
            )];
            if (codigosBuscar.length === 0) {
                showToast('Todos os itens já possuem mapeamento!');
                setBuscando(false);
                return;
            }
            setProgresso({ atual: 0, total: codigosBuscar.length });
            let processados = 0;
            for (let i = 0; i < codigosBuscar.length; i += BATCH_SIZE) {
                const chunk = codigosBuscar.slice(i, i + BATCH_SIZE);
                try {
                    const res = await api.post('/vmi/mapeamento/sugerir', { codigos: chunk });
                    const novasSugestoes = res.data.sugestoes || {};
                    const novasBases     = res.data.bases     || {};
                    const autoSelecoes   = {};
                    for (const [cod, opts] of Object.entries(novasSugestoes)) {
                        if (opts.length === 1) autoSelecoes[cod] = opts[0];
                        else if (opts.length > 1 && opts[0].score >= 4) autoSelecoes[cod] = opts[0];
                        // score < 4 com múltiplas opções → não auto-seleciona, usuário escolhe
                    }
                    setSugestoes(prev => ({ ...prev, ...novasSugestoes }));
                    setBases(prev => ({ ...prev, ...novasBases }));
                    if (Object.keys(autoSelecoes).length > 0)
                        setSelecoes(prev => ({ ...prev, ...autoSelecoes }));
                } catch (e) {
                    console.error(`Erro no lote ${i}–${i + chunk.length}:`, e);
                }
                processados += chunk.length;
                setProgresso({ atual: processados, total: codigosBuscar.length });
            }
            showToast('Busca concluída.');
        } catch (err) {
            console.error(err);
            showToast('Erro ao buscar sugestões.');
        } finally {
            setBuscando(false);
            setTimeout(() => setProgresso(null), 2000);
        }
    };

    const handleSalvarTodos = async () => {
        const vinculos = produtos
            .filter(p => !mapeamentos[p.codigo_base])
            .map(p => {
                const opt = selecoes[p.codigo_base] || (sugestoes[p.codigo_base]?.[0] ?? null);
                if (!opt) return null;
                return {
                    codigo_cliente:      p.codigo_base,
                    b1_cod:              opt.b1_cod,
                    descricao_protheus:  opt.b1_desc,
                    status_tipo_item:    opt.status_tipo_item,
                    status_tipo_detalhe: opt.status_tipo_detalhe,
                    pdf_url:             opt.pdf_url || null
                };
            })
            .filter(Boolean);

        if (vinculos.length === 0) {
            showToast('Nenhum item com sugestão disponível para salvar.');
            return;
        }
        setSalvandoTodos(true);
        try {
            const res = await api.post('/vmi/mapeamento/confirmar-lote', { vinculos });
            const { salvos, erros } = res.data;
            setMapeamentos(prev => {
                const next = { ...prev };
                vinculos.forEach(v => {
                    if (!erros?.includes(v.codigo_cliente))
                        next[v.codigo_cliente] = {
                            b1_cod:             v.b1_cod,
                            descricao_protheus: v.descricao_protheus,
                            status_tipo_item:   v.status_tipo_item,
                            status_tipo_detalhe:v.status_tipo_detalhe,
                            pdf_url:            v.pdf_url || null
                        };
                });
                return next;
            });
            showToast(`${salvos} vínculo${salvos !== 1 ? 's' : ''} salvo${salvos !== 1 ? 's' : ''}!${erros?.length ? ` (${erros.length} erro${erros.length > 1 ? 's' : ''})` : ''}`);
        } catch {
            showToast('Erro ao salvar vínculos em lote.');
        } finally {
            setSalvandoTodos(false);
        }
    };

    const handleConfirmarVinculo = async (codigo_base) => {
        const selected = selecoes[codigo_base];
        if (!selected) { showToast('Selecione uma sugestão válida.'); return; }
        setSalvando(prev => ({ ...prev, [codigo_base]: true }));
        try {
            await api.post('/vmi/mapeamento/confirmar', {
                codigo_cliente:     codigo_base,
                b1_cod:             selected.b1_cod,
                descricao_protheus: selected.b1_desc
            });
            setMapeamentos(prev => ({
                ...prev,
                [codigo_base]: {
                    b1_cod:             selected.b1_cod,
                    descricao_protheus: selected.b1_desc,
                    status_tipo_item:   selected.status_tipo_item,
                    status_tipo_detalhe:selected.status_tipo_detalhe,
                    pdf_url:            selected.pdf_url || null
                }
            }));
            showToast('Vínculo salvo!');
        } catch {
            showToast('Erro ao salvar vínculo.');
        } finally {
            setSalvando(prev => ({ ...prev, [codigo_base]: false }));
        }
    };

    const handleDesvincular = (codigo_base) => {
        setConfirm({
            isOpen: true,
            title: 'Remover Vínculo',
            message: `Remover o vínculo do item "${codigo_base}"?`,
            onConfirm: async () => {
                try {
                    await api.delete(`/vmi/mapeamento/${encodeURIComponent(codigo_base)}`);
                } catch { /* fallback silencioso */ }
                setMapeamentos(prev => { const n = { ...prev }; delete n[codigo_base]; return n; });
                showToast('Vínculo removido.');
            }
        });
    };

    const handleExportExcel = () => {
        const rows = produtos.map(p => {
            const mapeado  = mapeamentos[p.codigo_base];
            const opts     = sugestoes[p.codigo_base] || [];
            const melhor   = opts[0];
            return {
                'Cód. Base (9)':           p.codigo_base,
                'Cód. Original Cliente':   p.codigo_original,
                'Descrição Planilha':      p.descricao || '',
                'Status':                  mapeado ? 'Mapeado' : opts.length > 0 ? 'Com Sugestão' : 'Pendente',
                'B1_COD Vinculado':        mapeado?.b1_cod              || '',
                'Desc. Protheus Vinculado':mapeado?.descricao_protheus  || '',
                'Melhor Sugestão B1_COD':  !mapeado && melhor ? melhor.b1_cod   : '',
                'Melhor Sugestão Desc.':   !mapeado && melhor ? melhor.b1_desc  : '',
                'Score Sugestão':          !mapeado && melhor ? (SCORE_META[melhor.score]?.label || melhor.score) : '',
                'Total Sugestões':         opts.length,
            };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 40 }, { wch: 14 }, { wch: 16 }, { wch: 40 }, { wch: 16 }, { wch: 40 }, { wch: 14 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Mapeamento VMI Pedidos');
        XLSX.writeFile(wb, `Mapeamento_VMI_Pedidos_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Excel exportado!');
    };

    const pendentesComSugestao = produtos.filter(p =>
        !mapeamentos[p.codigo_base] && (selecoes[p.codigo_base] || sugestoes[p.codigo_base]?.[0])
    ).length;

    return (
        <>
            <div className={isTab ? 'space-y-4' : 'p-4 md:p-6 max-w-screen-2xl mx-auto space-y-4'}>

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {!isTab && (
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                <ListOrdered className="w-6 h-6 text-indigo-600" />
                                Mapeamento VMI Pedidos x Protheus
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">
                                Associe os códigos base dos pedidos com o <code>B1_COD</code> do Protheus.
                            </p>
                        </div>
                    )}
                    <div className="flex gap-2 ml-auto flex-wrap">
                        <button onClick={carregarDados}
                            className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded shadow-sm hover:bg-slate-50 font-medium flex items-center gap-2 text-sm">
                            <RefreshCcw className="w-4 h-4" /> Recarregar
                        </button>
                        <button onClick={handleExportExcel} disabled={produtos.length === 0}
                            className="px-4 py-2 border border-emerald-300 bg-emerald-50 text-emerald-700 rounded shadow-sm hover:bg-emerald-100 font-medium flex items-center gap-2 text-sm disabled:opacity-40">
                            <Download className="w-4 h-4" /> Exportar Excel
                        </button>
                        <button onClick={handleSalvarTodos} disabled={salvandoTodos || pendentesComSugestao === 0}
                            className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 font-medium flex items-center gap-2 text-sm disabled:opacity-40">
                            {salvandoTodos
                                ? <><RefreshCcw className="w-4 h-4 animate-spin" /> Salvando...</>
                                : <><Save className="w-4 h-4" /> Salvar Todos ({pendentesComSugestao})</>}
                        </button>
                        <button onClick={handleBuscarSugestoes} disabled={loading || buscando}
                            className="px-4 py-2 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 font-medium flex items-center gap-2 text-sm disabled:opacity-50">
                            {buscando ? (
                                <><RefreshCcw className="w-4 h-4 animate-spin" />
                                {progresso ? `Processando ${progresso.atual} / ${progresso.total}...` : 'Buscando...'}</>
                            ) : (
                                <><Search className="w-4 h-4" /> Sugerir Vínculos Protheus</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Barra de progresso */}
                {progresso && (
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-indigo-500 h-2 transition-all duration-300"
                            style={{ width: `${(progresso.atual / progresso.total) * 100}%` }} />
                    </div>
                )}

                {/* Filtros + Stats */}
                {!loading && produtos.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap gap-3 items-center shadow-sm">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input type="text"
                                placeholder="Pesquisar código, descrição, B1_COD..."
                                value={filterText}
                                onChange={e => setFilterText(e.target.value)}
                                className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                            {filterText && (
                                <button onClick={() => setFilterText('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                            {[
                                { id: 'all',      label: `Todos (${stats.total})` },
                                { id: 'mapped',   label: `Mapeados (${stats.mapeados})` },
                                { id: 'unmapped', label: `Pendentes (${stats.total - stats.mapeados})` }
                            ].map(({ id, label }) => (
                                <button key={id} onClick={() => setFilterStatus(id)}
                                    className={`px-3 py-1.5 transition ${filterStatus === id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <span className="text-xs text-slate-400 ml-auto">
                            {stats.comSugestao > 0 && (
                                <span className="text-indigo-600 font-semibold">{stats.comSugestao} com sugestão • </span>
                            )}
                            Exibindo <strong>{produtosFiltrados.length}</strong> de {stats.total}
                            {(filterText || filterStatus !== 'all') && (
                                <button onClick={() => { setFilterText(''); setFilterStatus('all'); }}
                                    className="ml-2 text-indigo-600 underline">Limpar</button>
                            )}
                        </span>
                    </div>
                )}

                {/* Legenda scores */}
                {stats.comSugestao > 0 && (
                    <div className="flex flex-wrap gap-2 text-[11px]">
                        {Object.entries(SCORE_META).slice(0, 4).map(([score, m]) => (
                            <span key={score} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${m.bg} ${m.text} ${m.border}`}>
                                {score === '5' ? '★' : score === '4' ? '●' : score === '3' ? '◑' : '○'} {m.label}
                            </span>
                        ))}
                        <span className="text-slate-400 italic self-center">— relevância da sugestão no Protheus</span>
                    </div>
                )}

                {/* Conteúdo */}
                {loading ? (
                    <div className="flex items-center justify-center p-12 text-slate-500">
                        <RefreshCcw className="w-8 h-8 animate-spin" />
                    </div>
                ) : produtos.length === 0 ? (
                    <div className="bg-white border rounded py-12 px-6 flex flex-col items-center text-center">
                        <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-slate-600 font-medium">Nenhum pedido importado encontrado.</p>
                        <p className="text-slate-400 text-sm mt-1">Importe uma planilha em "1. Importação e Base" e clique em Recarregar.</p>
                    </div>
                ) : produtosFiltrados.length === 0 ? (
                    <div className="bg-white border rounded py-10 px-6 flex flex-col items-center text-center">
                        <AlertCircle className="w-10 h-10 text-slate-300 mb-2" />
                        <p className="text-slate-500 text-sm">Nenhum resultado para os filtros aplicados.</p>
                        <button onClick={() => { setFilterText(''); setFilterStatus('all'); }}
                            className="mt-2 text-xs text-indigo-600 underline">Limpar filtros</button>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold w-36">Cód. Base (9)</th>
                                        <th className="px-4 py-3 font-semibold w-36">Cód. Original</th>
                                        <th className="px-4 py-3 font-semibold w-16 text-center">Rev.</th>
                                        <th className="px-4 py-3 font-semibold">Descrição no Pedido</th>
                                        <th className="px-4 py-3 font-semibold text-center w-28">🔍 Pesquisado</th>
                                        <th className="px-4 py-3 font-semibold border-l border-slate-200">Sugestões Protheus (clique para selecionar)</th>
                                        <th className="px-4 py-3 font-semibold text-center w-24">Tipo</th>
                                        <th className="px-4 py-3 font-semibold text-center w-14">PDF</th>
                                        <th className="px-4 py-3 font-semibold text-center w-28">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {produtosFiltrados.map((p, index) => {
                                        const jaMapeado   = mapeamentos[p.codigo_base];
                                        const options     = sugestoes[p.codigo_base] || [];
                                        const baseInfo    = bases[p.codigo_base] || {};
                                        const baseCode    = baseInfo.searchCode || p.codigo_base;
                                        const revCode     = baseInfo.revCode || null;
                                        const selecionado = selecoes[p.codigo_base];

                                        return (
                                            <tr key={index} className={`hover:bg-slate-50/40 transition-colors ${jaMapeado ? 'bg-green-50/30' : ''}`}>

                                                {/* Código base */}
                                                <td className="px-4 py-3 align-top">
                                                    <span className="font-mono text-sm font-bold text-indigo-700">{p.codigo_base}</span>
                                                </td>

                                                {/* Código original */}
                                                <td className="px-4 py-3 align-top">
                                                    <span className="font-mono text-xs text-slate-500">{p.codigo_original}</span>
                                                </td>

                                                {/* Revisão cliente */}
                                                <td className="px-4 py-3 align-top text-center">
                                                    {p.revisao_cliente ? (
                                                        <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                                                            {p.revisao_cliente}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>

                                                {/* Descrição */}
                                                <td className="px-4 py-3 align-top">
                                                    <span className="text-xs text-slate-600 line-clamp-2" title={p.descricao}>
                                                        {p.descricao || '—'}
                                                    </span>
                                                </td>

                                                {/* Base pesquisada */}
                                                <td className="px-4 py-3 align-top text-center">
                                                    {baseCode ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="font-mono text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded"
                                                                title="Código base usado na pesquisa (9 dígitos)">
                                                                {baseCode}
                                                            </span>
                                                            {revCode && (
                                                                <span className="font-mono text-[10px] text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded"
                                                                    title="Revisão extraída">
                                                                    Rev: {revCode}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs italic">—</span>
                                                    )}
                                                </td>

                                                {/* Sugestões / Mapeado */}
                                                <td className="px-4 py-3 border-l border-slate-100 align-top">
                                                    {jaMapeado ? (
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                                    <span className="font-mono text-sm font-bold text-green-700">{jaMapeado.b1_cod}</span>
                                                                </div>
                                                                <span className="text-xs text-slate-500 pl-6" title={jaMapeado.descricao_protheus}>
                                                                    {jaMapeado.descricao_protheus}
                                                                </span>
                                                            </div>
                                                            <button onClick={() => handleDesvincular(p.codigo_base)}
                                                                title="Remover vínculo"
                                                                className="text-slate-300 hover:text-red-400 flex-shrink-0 mt-0.5">
                                                                <Link2Off className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : options.length > 0 ? (
                                                        <div className="flex flex-col gap-1.5">
                                                            {options.map((opt, i) => {
                                                                const meta       = SCORE_META[opt.score] || SCORE_META[1];
                                                                const isSelected = selecionado?.b1_cod === opt.b1_cod;
                                                                return (
                                                                    <button key={i}
                                                                        onClick={() => setSelecoes(prev => ({ ...prev, [p.codigo_base]: opt }))}
                                                                        className={`w-full text-left border rounded-lg px-3 py-2 transition-all
                                                                            ${isSelected
                                                                                ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400'
                                                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                                                            }`}>
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${meta.bg} ${meta.text} ${meta.border}`}>
                                                                                {meta.label}
                                                                            </span>
                                                                            <span className="font-mono text-sm font-bold text-slate-800">{opt.b1_cod}</span>
                                                                            {opt.z1_revisao && (
                                                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0
                                                                                    ${revCode && opt.z1_revisao === revCode
                                                                                        ? 'bg-green-50 text-green-700 border-green-300'
                                                                                        : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                                                                                    title="Revisão no Protheus">
                                                                                    Rev. Protheus: {opt.z1_revisao}
                                                                                    {revCode && opt.z1_revisao === revCode && ' ✓'}
                                                                                </span>
                                                                            )}
                                                                            <TypeBadge type={opt.status_tipo_item} detail={opt.status_tipo_detalhe} />
                                                                            {isSelected && (
                                                                                <span className="ml-auto text-[10px] font-bold text-indigo-600">✓ Selecionado</span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-slate-500 mt-0.5 truncate" title={opt.b1_desc}>
                                                                            {opt.b1_desc || '—'}
                                                                        </p>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">
                                                            {buscando ? 'Buscando...' : 'Nenhuma sugestão. Clique em "Sugerir Vínculos Protheus".'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Tipo vinculado */}
                                                <td className="px-4 py-3 text-center align-top">
                                                    {jaMapeado ? (
                                                        <TypeBadge type={jaMapeado.status_tipo_item} detail={jaMapeado.status_tipo_detalhe} />
                                                    ) : selecionado ? (
                                                        <TypeBadge type={selecionado.status_tipo_item} detail={selecionado.status_tipo_detalhe} />
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
                                                </td>

                                                {/* PDF */}
                                                <td className="px-4 py-3 text-center align-top">
                                                    <PdfCell url={jaMapeado?.pdf_url ?? selecionado?.pdf_url ?? options[0]?.pdf_url ?? null} />
                                                </td>

                                                {/* Ação */}
                                                <td className="px-4 py-3 text-center align-top">
                                                    {jaMapeado ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded">
                                                            <CheckCircle className="w-3.5 h-3.5" /> Vinculado
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleConfirmarVinculo(p.codigo_base)}
                                                            disabled={salvando[p.codigo_base] || !selecionado}
                                                            className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-medium hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 w-full max-w-[100px] mx-auto">
                                                            {salvando[p.codigo_base]
                                                                ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                                                                : <Save className="w-3.5 h-3.5" />}
                                                            Salvar
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {toast && (
                <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded shadow-lg z-50 text-sm">
                    {toast}
                </div>
            )}

            <ConfirmModal
                isOpen={confirm.isOpen}
                onClose={() => setConfirm(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirm.onConfirm}
                title={confirm.title}
                message={confirm.message}
            />
        </>
    );
}
