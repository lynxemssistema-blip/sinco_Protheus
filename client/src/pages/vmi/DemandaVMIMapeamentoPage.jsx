import { useState, useEffect, useMemo } from 'react';
import { Layers, Search, Save, CheckCircle, RefreshCcw, AlertCircle, X, Link2Off, Download, FileText } from 'lucide-react';
import { api, getFileUrl } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';

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
        'Novo': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
        'Revisão': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
        'Restrição': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
        'PCP': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' }
    };
    const c = cfgs[type] || cfgs['PCP'];
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${c.bg} ${c.text} ${c.border} cursor-help whitespace-nowrap`}
              title={detail || ''}>
            {String(type).toUpperCase()}
        </span>
    );
};
import * as XLSX from 'xlsx';

const SCORE_META = {
    5: { label: 'Base + Rev',  bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300',  ring: 'ring-green-400' },
    4: { label: 'Base Exata',  bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300',   ring: 'ring-blue-400'  },
    3: { label: 'Rev. Match',  bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', ring: 'ring-orange-400'},
    2: { label: 'Contém',      bg: 'bg-slate-100',  text: 'text-slate-500',  border: 'border-slate-300',  ring: 'ring-slate-400' },
    1: { label: 'Parcial',     bg: 'bg-slate-100',  text: 'text-slate-500',  border: 'border-slate-300',  ring: 'ring-slate-400' },
};

export default function DemandaVMIMapeamentoPage({ isTab = false }) {
    const [toast, setToast] = useState('');
    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

    const [loading, setLoading]     = useState(false);
    const [demandas, setDemandas]   = useState([]);
    const [mapeamentos, setMapeamentos] = useState({});
    const [sugestoes, setSugestoes] = useState({});
    const [bases, setBases]         = useState({});
    const [buscando, setBuscando]   = useState(false);
    const [salvando, setSalvando]   = useState({});
    const [selecoes, setSelecoes]   = useState({});
    const [progresso, setProgresso] = useState(null);

    const [filterText, setFilterText]     = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    useEffect(() => {
        // Não carrega dados automaticamente ao entrar na página/aba
    }, []);

    const carregarDados = async () => {
        setLoading(true);
        try {
            const [resDemanda, resMap] = await Promise.all([
                api.get('/vmi/demandas'),
                api.get('/vmi/mapeamento/atual')
            ]);
            const dataDemanda = resDemanda.data.data || [];
            const prodsMap = {};
            dataDemanda.forEach(d => {
                if (!prodsMap[d.codigo_produto_cliente]) {
                    prodsMap[d.codigo_produto_cliente] = {
                        codigo_cliente:   d.codigo_produto_cliente,
                        descricao_cliente: d.descricao_produto_cliente,
                        ordem_compra:     d.ordem_compra_cliente
                    };
                }
            });
            setDemandas(Object.values(prodsMap));

            const mapDb = {};
            (resMap.data.data || []).forEach(m => {
                mapDb[m.codigo_produto_cliente] = {
                    b1_cod: m.b1_cod,
                    descricao_protheus: m.descricao_protheus,
                    status_tipo_item: m.status_tipo_item,
                    status_tipo_detalhe: m.status_tipo_detalhe,
                    pdf_url: m.pdf_url || null
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

    const demandasFiltradas = useMemo(() => {
        let list = demandas;
        if (filterStatus === 'mapped')   list = list.filter(d =>  mapeamentos[d.codigo_cliente]);
        if (filterStatus === 'unmapped') list = list.filter(d => !mapeamentos[d.codigo_cliente]);
        if (filterText.trim()) {
            const s = filterText.toLowerCase();
            list = list.filter(d =>
                d.codigo_cliente?.toLowerCase().includes(s) ||
                d.descricao_cliente?.toLowerCase().includes(s) ||
                mapeamentos[d.codigo_cliente]?.b1_cod?.toLowerCase().includes(s) ||
                bases[d.codigo_cliente]?.searchCode?.toLowerCase().includes(s)
            );
        }
        return list;
    }, [demandas, mapeamentos, filterStatus, filterText, bases]);

    const stats = useMemo(() => ({
        total:       demandas.length,
        mapeados:    demandas.filter(d =>  mapeamentos[d.codigo_cliente]).length,
        comSugestao: demandas.filter(d => (sugestoes[d.codigo_cliente]?.length ?? 0) > 0).length,
    }), [demandas, mapeamentos, sugestoes]);

    // ── Buscar sugestões ──────────────────────────────────────────────────────
    const BATCH_SIZE = 25;
    const handleBuscarSugestoes = async () => {
        setBuscando(true);
        try {
            // Monta mapa codigo_cliente -> descricao_cliente para fallback por descrição
            const descMap = {};
            demandas.forEach(d => {
                if (d.codigo_cliente && d.descricao_cliente)
                    descMap[d.codigo_cliente] = d.descricao_cliente;
            });

            const codigosBuscar = [...new Set(
                demandas.map(d => d.codigo_cliente).filter(cod => !mapeamentos[cod])
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
                // Envia itens com descricao para ativar fallback por palavras-chave
                const itens = chunk.map(cod => ({ cod, descricao: descMap[cod] || '' }));
                try {
                    const res = await api.post('/vmi/mapeamento/sugerir', { itens });
                    const novasSugestoes = res.data.sugestoes || {};
                    const novasBases     = res.data.bases     || {};
                    const autoSelecoes   = {};
                    for (const [cod, opts] of Object.entries(novasSugestoes)) {
                        if (opts.length === 1) autoSelecoes[cod] = opts[0];
                        else if (opts.length > 0 && opts[0].score >= 4) autoSelecoes[cod] = opts[0]; // auto-seleciona score alto
                    }
                    setSugestoes(prev => ({ ...prev, ...novasSugestoes }));
                    setBases(prev => ({ ...prev, ...novasBases }));
                    if (Object.keys(autoSelecoes).length > 0)
                        setSelecoes(prev => ({ ...prev, ...autoSelecoes }));
                } catch (e) {
                    console.error(`Erro no lote ${i + 1}-${i + chunk.length}:`, e);
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

    const [salvandoTodos, setSalvandoTodos] = useState(false);
    const [desvinculandoTodos, setDesvinculandoTodos] = useState(false);

    const handleSalvarTodos = async () => {
        // Monta a lista: para cada item sem mapeamento que tenha sugestão ou seleção manual
        const vinculos = demandas
            .filter(d => !mapeamentos[d.codigo_cliente])
            .map(d => {
                const cod  = d.codigo_cliente;
                // Usa seleção manual se houver, senão a primeira sugestão (melhor score)
                const opt  = selecoes[cod] || (sugestoes[cod]?.[0] ?? null);
                if (!opt) return null;
                return { 
                    codigo_cliente:      d.codigo_cliente, 
                    b1_cod:              opt.b1_cod, 
                    descricao_protheus:  opt.b1_desc, 
                    status_tipo_item:    opt.status_tipo_item,
                    status_tipo_detalhe: opt.status_tipo_detalhe,
                    z1_revisao:          opt.z1_revisao || null,
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

            // Atualiza estado local para todos que foram salvos
            setMapeamentos(prev => {
                const next = { ...prev };
                vinculos.forEach(v => {
                    if (!erros?.includes(v.codigo_cliente))
                        next[v.codigo_cliente] = { 
                            b1_cod: v.b1_cod, 
                            descricao_protheus: v.descricao_protheus, 
                            status_tipo_item: v.status_tipo_item,
                            status_tipo_detalhe: v.status_tipo_detalhe,
                            z1_revisao: v.z1_revisao || null,
                            pdf_url: v.pdf_url || null 
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

    const handleDesvincularTodos = () => {
        const mapeadosAtuais = Object.keys(mapeamentos);
        if (mapeadosAtuais.length === 0) {
            showToast('Nenhum item mapeado para desvincular.');
            return;
        }

        setConfirm({
            isOpen: true,
            title: 'Desvincular Todos',
            message: `Tem certeza que deseja remover o vínculo de TODOS os ${mapeadosAtuais.length} itens mapeados?`,
            onConfirm: async () => {
                setDesvinculandoTodos(true);
                try {
                    await api.post('/vmi/mapeamento/desvincular-lote', { codigos: mapeadosAtuais });
                    setMapeamentos({});
                    showToast(`${mapeadosAtuais.length} vínculos removidos.`);
                } catch (err) {
                    showToast('Erro ao remover vínculos em lote.');
                    console.error(err);
                } finally {
                    setDesvinculandoTodos(false);
                }
            }
        });
    };

    const handleConfirmarVinculo = async (codigo_cliente) => {
        const selected = selecoes[codigo_cliente];
        if (!selected) { showToast('Selecione uma sugestão válida.'); return; }
        setSalvando(prev => ({ ...prev, [codigo_cliente]: true }));
        try {
            await api.post('/vmi/mapeamento/confirmar', {
                codigo_cliente,
                b1_cod: selected.b1_cod,
                descricao_protheus: selected.b1_desc,
                z1_revisao: selected.z1_revisao || null
            });
            setMapeamentos(prev => ({
                ...prev,
                [codigo_cliente]: {
                    b1_cod: selected.b1_cod,
                    descricao_protheus: selected.b1_desc,
                    status_tipo_item: selected.status_tipo_item,
                    status_tipo_detalhe: selected.status_tipo_detalhe,
                    z1_revisao: selected.z1_revisao || null,
                    pdf_url: selected.pdf_url || null 
                }
            }));
            showToast('Vínculo salvo!');
        } catch {
            showToast('Erro ao salvar vínculo.');
        } finally {
            setSalvando(prev => ({ ...prev, [codigo_cliente]: false }));
        }
    };

    const handleExportExcel = () => {
        const rows = demandas.map(d => {
            const mapeado  = mapeamentos[d.codigo_cliente];
            const opts     = sugestoes[d.codigo_cliente] || [];
            const baseInfo = bases[d.codigo_cliente] || {};
            const melhor   = opts[0];

            return {
                'Código Cliente':          d.codigo_cliente,
                'Descrição Planilha':      d.descricao_cliente || '',
                'Base Pesquisada':         baseInfo.searchCode || '',
                'Revisão Extraída':        baseInfo.revCode    || '',
                'Status':                  mapeado ? 'Mapeado' : opts.length > 0 ? 'Com Sugestão' : 'Pendente',
                'B1_COD Vinculado':        mapeado?.b1_cod              || '',
                'Tipo Vinculado':          mapeado?.status_tipo_item    || '',
                'Desc. Protheus Vinculado':mapeado?.descricao_protheus  || '',
                'Melhor Sugestão B1_COD':  !mapeado && melhor ? melhor.b1_cod  : '',
                'Melhor Sugestão Tipo':    !mapeado && melhor ? melhor.status_tipo_item : '',
                'Melhor Sugestão Desc.':   !mapeado && melhor ? melhor.b1_desc : '',
                'Rev. Protheus (Sugestão)':!mapeado && melhor ? (melhor.z1_revisao || '') : '',
                'Score Sugestão':          !mapeado && melhor ? (SCORE_META[melhor.score]?.label || melhor.score) : '',
                'Total Sugestões':         opts.length,
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);

        // Larguras das colunas
        ws['!cols'] = [
            { wch: 20 }, { wch: 40 }, { wch: 16 }, { wch: 14 },
            { wch: 14 }, { wch: 16 }, { wch: 40 },
            { wch: 16 }, { wch: 40 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
        ];

        // Estilo do cabeçalho
        const headerRange = XLSX.utils.decode_range(ws['!ref']);
        for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
            const cell = XLSX.utils.encode_cell({ r: 0, c });
            if (ws[cell]) {
                ws[cell].s = {
                    font:    { bold: true, color: { rgb: 'FFFFFF' } },
                    fill:    { fgColor: { rgb: '7C3AED' } },
                    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                    border: {
                        bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                        right:  { style: 'thin', color: { rgb: 'CCCCCC' } },
                    }
                };
            }
        }

        // Cor das linhas por status
        for (let r = 1; r <= rows.length; r++) {
            const status = rows[r - 1]['Status'];
            const bgRGB  = status === 'Mapeado' ? 'F0FDF4' : status === 'Com Sugestão' ? 'FFF7ED' : 'FFF1F2';
            for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
                const cell = XLSX.utils.encode_cell({ r, c });
                if (!ws[cell]) ws[cell] = { t: 's', v: '' };
                ws[cell].s = {
                    fill:      { fgColor: { rgb: bgRGB } },
                    alignment: { vertical: 'center', wrapText: false },
                    border: {
                        bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
                        right:  { style: 'thin', color: { rgb: 'E2E8F0' } },
                    }
                };
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Mapeamento VMI');

        const date = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Mapeamento_VMI_${date}.xlsx`, { cellStyles: true });
        showToast('Excel exportado com sucesso!');
    };

    const handleDesvincular = (codigo_cliente) => {
        setConfirm({
            isOpen: true,
            title: 'Remover Vínculo',
            message: `Tem certeza que deseja remover o vínculo do item "${codigo_cliente}"? Esta ação removerá a associação com o produto Protheus.`,
            onConfirm: async () => {
                try {
                    await api.delete(`/vmi/mapeamento/${encodeURIComponent(codigo_cliente)}`);
                    setMapeamentos(prev => { const n = { ...prev }; delete n[codigo_cliente]; return n; });
                    showToast('Vínculo removido. Buscando sugestão...');
                    
                    // Busca sugestão automaticamente após desvincular
                    setBuscando(true);
                    try {
                        const res = await api.post('/vmi/mapeamento/sugerir', { codigos: [codigo_cliente] });
                        const novasSugs = res.data.sugestoes || {};
                        const novasBases = res.data.bases || {};
                        const autoSel = {};
                        for (const [cod, opts] of Object.entries(novasSugs)) {
                            if (opts.length === 1) autoSel[cod] = opts[0];
                            else if (opts.length > 1 && opts[0].score >= 4) autoSel[cod] = opts[0];
                        }
                        setSugestoes(prev => ({ ...prev, ...novasSugs }));
                        setBases(prev => ({ ...prev, ...novasBases }));
                        if (Object.keys(autoSel).length > 0) setSelecoes(prev => ({ ...prev, ...autoSel }));
                    } catch (e) {
                         console.error('Erro ao buscar sugestão pós-desvinculo', e);
                    } finally {
                        setBuscando(false);
                    }
                } catch {
                    // fallback local (se endpoint não existir ainda)
                    setMapeamentos(prev => { const n = { ...prev }; delete n[codigo_cliente]; return n; });
                }
            }
        });
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <div className={isTab ? "space-y-3" : "w-full px-2 sm:px-4 py-2 space-y-3"}>

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {!isTab && (
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                <Layers className="w-6 h-6 text-cyan-600" />
                                Mapeamento VMI x Protheus
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">
                                Associe os códigos da planilha VMI com o <code>B1_COD</code> do Protheus.
                            </p>
                        </div>
                    )}
                    <div className="flex gap-2 ml-auto">
                        <button onClick={carregarDados}
                            className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded shadow-sm hover:bg-slate-50 font-medium flex items-center gap-2 text-sm">
                            <RefreshCcw className="w-4 h-4" /> Recarregar
                        </button>
                        <button onClick={handleExportExcel} disabled={demandas.length === 0}
                            className="px-4 py-2 border border-emerald-300 bg-emerald-50 text-emerald-700 rounded shadow-sm hover:bg-emerald-100 font-medium flex items-center gap-2 text-sm disabled:opacity-40">
                            <Download className="w-4 h-4" /> Exportar Excel
                        </button>
                        <button onClick={handleSalvarTodos}
                            disabled={salvandoTodos || demandas.filter(d => !mapeamentos[d.codigo_cliente] && (selecoes[d.codigo_cliente] || sugestoes[d.codigo_cliente]?.[0])).length === 0}
                            className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 font-medium flex items-center gap-2 text-sm disabled:opacity-40">
                            {salvandoTodos
                                ? <><RefreshCcw className="w-4 h-4 animate-spin" /> Salvando...</>
                                : <><Save className="w-4 h-4" /> Salvar Todos ({demandas.filter(d => !mapeamentos[d.codigo_cliente] && (selecoes[d.codigo_cliente] || sugestoes[d.codigo_cliente]?.[0])).length})</>
                            }
                        </button>
                        <button onClick={handleDesvincularTodos} disabled={desvinculandoTodos || Object.keys(mapeamentos).length === 0}
                            className="px-4 py-2 border border-red-300 bg-red-50 text-red-700 rounded shadow-sm hover:bg-red-100 font-medium flex items-center gap-2 text-sm disabled:opacity-40">
                            {desvinculandoTodos
                                ? <><RefreshCcw className="w-4 h-4 animate-spin" /> ...</>
                                : <><Link2Off className="w-4 h-4" /> Desvincular Todos ({Object.keys(mapeamentos).length})</>}
                        </button>
                        <button onClick={handleBuscarSugestoes} disabled={loading || buscando}
                            className="px-4 py-2 bg-cyan-600 text-white rounded shadow hover:bg-cyan-700 font-medium flex items-center gap-2 text-sm disabled:opacity-50">
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
                        <div className="bg-cyan-500 h-2 transition-all duration-300"
                            style={{ width: `${(progresso.atual / progresso.total) * 100}%` }} />
                    </div>
                )}

                {/* Toolbar Filtros + Stats */}
                {!loading && demandas.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap gap-3 items-center shadow-sm">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input type="text"
                                placeholder="Pesquisar código, descrição, B1_COD..."
                                value={filterText}
                                onChange={e => setFilterText(e.target.value)}
                                className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-cyan-300" />
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
                                    className={`px-3 py-1.5 transition ${filterStatus === id ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        <span className="text-xs text-slate-400 ml-auto">
                            {stats.comSugestao > 0 && (
                                <span className="text-cyan-600 font-semibold">{stats.comSugestao} com sugestão • </span>
                            )}
                            Exibindo <strong>{demandasFiltradas.length}</strong> de {stats.total}
                            {(filterText || filterStatus !== 'all') && (
                                <button onClick={() => { setFilterText(''); setFilterStatus('all'); }}
                                    className="ml-2 text-cyan-600 underline">Limpar</button>
                            )}
                        </span>
                    </div>
                )}

                {/* Legenda dos scores */}
                {stats.comSugestao > 0 && (
                    <div className="flex flex-wrap gap-2 text-[11px]">
                        {Object.entries(SCORE_META).slice(0, 4).map(([score, m]) => (
                            <span key={score} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${m.bg} ${m.text} ${m.border}`}>
                                {score === '5' ? '★' : score === '4' ? '●' : score === '3' ? '◑' : '○'} {m.label}
                            </span>
                        ))}
                        <span className="text-slate-400 italic self-center">— relevância da sugestão encontrada no Protheus</span>
                    </div>
                )}

                {/* Conteúdo */}
                {loading ? (
                    <div className="flex items-center justify-center p-12 text-slate-500">
                        <RefreshCcw className="w-8 h-8 animate-spin" />
                    </div>
                ) : demandas.length === 0 ? (
                    <div className="bg-white border rounded py-12 px-6 flex flex-col items-center text-center">
                        <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-slate-600 font-medium">Nenhum lote VMI ativo encontrado.</p>
                        <p className="text-slate-400 text-sm">Importe uma planilha em "1. Importação e Base" primeiro.</p>
                    </div>
                ) : demandasFiltradas.length === 0 ? (
                    <div className="bg-white border rounded py-10 px-6 flex flex-col items-center text-center">
                        <AlertCircle className="w-10 h-10 text-slate-300 mb-2" />
                        <p className="text-slate-500 text-sm">Nenhum resultado para os filtros aplicados.</p>
                        <button onClick={() => { setFilterText(''); setFilterStatus('all'); }}
                            className="mt-2 text-xs text-cyan-600 underline">Limpar filtros</button>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold w-36">Código Cliente</th>
                                        <th className="px-4 py-3 font-semibold">Descrição na Planilha</th>
                                        <th className="px-4 py-3 font-semibold text-center w-28">🔍 Pesquisado</th>
                                        <th className="px-4 py-3 font-semibold border-l border-slate-200">Sugestões Protheus (clique para selecionar)</th>
                                        <th className="px-4 py-3 font-semibold text-center w-24">Tipo</th>
                                        <th className="px-4 py-3 font-semibold text-center w-14">PDF</th>
                                        <th className="px-4 py-3 font-semibold text-center w-28">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {demandasFiltradas.map((d, index) => {
                                        const jaMapeado = mapeamentos[d.codigo_cliente];
                                        const options   = sugestoes[d.codigo_cliente] || [];
                                        const baseInfo  = bases[d.codigo_cliente] || {};
                                        const baseCode  = baseInfo.searchCode || '';
                                        const revCode   = baseInfo.revCode    || null;
                                        const selecionado = selecoes[d.codigo_cliente];

                                        return (
                                            <tr key={index} className={`hover:bg-slate-50/40 transition-colors ${jaMapeado ? 'bg-green-50/30' : ''}`}>

                                                {/* Código cliente */}
                                                <td className="px-4 py-3 align-top">
                                                    <span className="font-mono text-sm font-bold text-blue-700 break-all">
                                                        {d.codigo_cliente}
                                                    </span>
                                                </td>

                                                {/* Descrição */}
                                                <td className="px-4 py-3 align-top">
                                                    <span className="text-xs text-slate-600 line-clamp-2" title={d.descricao_cliente}>
                                                        {d.descricao_cliente || '—'}
                                                    </span>
                                                </td>

                                                {/* Base pesquisada + Revisão */}
                                                <td className="px-4 py-3 align-top text-center">
                                                    {baseCode ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="font-mono text-[11px] text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded"
                                                                title="Código base usado na pesquisa (9 dígitos)">
                                                                {baseCode}
                                                            </span>
                                                            {revCode && (
                                                                <span className="font-mono text-[10px] text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded"
                                                                    title="Revisão extraída do código (dígitos após posição 9)">
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
                                                        /* Já mapeado */
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                                    <span className="font-mono text-sm font-bold text-green-700">{jaMapeado.b1_cod}</span>
                                                                    {jaMapeado.z1_revisao && (
                                                                        <span className="font-mono text-[10px] font-semibold text-green-700 bg-green-50 border border-green-300 px-1.5 py-0.5 rounded" title="Revisão no Protheus">
                                                                            Rev. Protheus: {jaMapeado.z1_revisao}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                 <span className="text-xs text-slate-500 pl-6" title={jaMapeado.descricao_protheus}>
                                                                    {jaMapeado.descricao_protheus}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : options.length > 0 ? (
                                                        /* Cards de sugestões */
                                                        <div className="flex flex-col gap-1.5">
                                                            {options.map((opt, i) => {
                                                                const meta    = SCORE_META[opt.score] || SCORE_META[1];
                                                                const isSelected = selecionado?.b1_cod === opt.b1_cod;
                                                                return (
                                                                    <button key={i}
                                                                        onClick={() => setSelecoes(prev => ({ ...prev, [d.codigo_cliente]: opt }))}
                                                                        className={`w-full text-left border rounded-lg px-3 py-2 transition-all
                                                                            ${isSelected
                                                                                ? `border-cyan-400 bg-cyan-50 ring-1 ring-cyan-400`
                                                                                : `border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50`
                                                                            }`}>
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            {/* Score badge */}
                                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${meta.bg} ${meta.text} ${meta.border}`}>
                                                                                {meta.label}
                                                                            </span>
                                                                            {/* B1_COD */}
                                                                            <span className="font-mono text-sm font-bold text-slate-800">{opt.b1_cod}</span>
                                                                            {/* Revisão Protheus */}
                                                                            {opt.z1_revisao && (
                                                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0
                                                                                    ${revCode && opt.z1_revisao === revCode
                                                                                        ? 'bg-green-50 text-green-700 border-green-300'
                                                                                        : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                                                                                    title="Revisão registrada no Protheus (z1_revisao)">
                                                                                    Rev. Protheus: {opt.z1_revisao}
                                                                                    {revCode && opt.z1_revisao === revCode && ' ✓'}
                                                                                </span>
                                                                            )}
                                                                            {/* Tipo Sugestão */}
                                                                            <TypeBadge type={opt.status_tipo_item} detail={opt.status_tipo_detalhe} />
                                                                            {/* Selecionado */}
                                                                            {isSelected && (
                                                                                <span className="ml-auto text-[10px] font-bold text-cyan-600">✓ Selecionado</span>
                                                                            )}
                                                                        </div>
                                                                        {/* Descrição */}
                                                                        <p className="text-xs text-slate-500 mt-0.5 truncate pl-0.5" title={opt.b1_desc}>
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

                                                 {/* Tipo Vinculado */}
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
                                                    {jaMapeado ? (
                                                        <PdfCell url={jaMapeado.pdf_url} />
                                                    ) : (
                                                        <PdfCell url={selecionado?.pdf_url ?? options[0]?.pdf_url ?? null} />
                                                    )}
                                                </td>

                                                {/* Ação */}
                                                <td className="px-4 py-3 text-center align-top">
                                                    {jaMapeado ? (
                                                        <button
                                                            onClick={() => handleDesvincular(d.codigo_cliente)}
                                                            title="Clique para remover este vínculo"
                                                            className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-300 rounded text-xs font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors flex items-center justify-center gap-1 w-full max-w-[110px] mx-auto group">
                                                            <CheckCircle className="w-3.5 h-3.5 group-hover:hidden" />
                                                            <Link2Off className="w-3.5 h-3.5 hidden group-hover:block" />
                                                            <span className="group-hover:hidden">Vinculado</span>
                                                            <span className="hidden group-hover:block">Desvincular</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleConfirmarVinculo(d.codigo_cliente)}
                                                            disabled={salvando[d.codigo_cliente] || !selecionado}
                                                            className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-medium hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 w-full max-w-[110px] mx-auto">
                                                            {salvando[d.codigo_cliente]
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
