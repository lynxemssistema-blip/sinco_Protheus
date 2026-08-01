import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import {
    UploadCloud, FileSpreadsheet, RefreshCw, Trash2, ChevronDown, ChevronRight,
    CheckCircle2, AlertCircle, Package, Search, X, Download,
    ShoppingCart, Save, Layers, List, Info, FileText, Zap, DollarSign
} from 'lucide-react';
import { api, getFileUrl } from '../../services/api';
import * as XLSX from 'xlsx';
import ConfirmModal from '../../components/ConfirmModal';
import { useAuth } from '../../contexts/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtNum    = (n) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtMoney  = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate   = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const fmtDT     = (d) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

// ── Subcomponentes ────────────────────────────────────────────────────────────
// Ícone PDF — mesmo padrão de toda a aplicação (DemandaVMIMapeamentoPage, ConferenciaPage)
function PdfCell({ url }) {
    if (url) {
        return (
            <a
                href={getFileUrl(`/api/docs/view?path=${encodeURIComponent(url)}`)}
                target="_blank" rel="noopener noreferrer"
                title="Abrir desenho PDF"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center justify-center"
            >
                <FileText className="w-4 h-4 text-red-500 hover:text-red-700 transition-colors" />
            </a>
        );
    }
    return <FileText className="w-4 h-4 text-slate-200" title="Sem PDF vinculado" />;
}
function CoberturaBar({ qtde_oc, saldo_vmi }) {
    const s = Number(saldo_vmi || 0);
    if (s <= 0) return <span className="text-slate-300 text-[10px]">—</span>;
    const pct = Math.min(100, Math.round((Number(qtde_oc) / s) * 100));
    const cor = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-500';
    const txt = pct >= 100 ? 'text-emerald-700' : pct >= 60 ? 'text-amber-700' : 'text-red-600';
    return (
        <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-[10px] font-bold ${txt}`}>{pct}%</span>
        </div>
    );
}

function SituacaoBadge({ s }) {
    const cfgs = {
        'APROVADO':  'bg-emerald-50 text-emerald-700 border-emerald-200',
        'BLOQUEADO': 'bg-red-50 text-red-700 border-red-200',
    };
    return <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap ${cfgs[s] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>{s || '—'}</span>;
}

function B1Chip({ b1_cod }) {
    if (!b1_cod) return <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Não localizado</span>;
    return <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">{b1_cod}</span>;
}

function DiffBadge({ custoOC, custoProtheus }) {
    if (!custoOC || !custoProtheus || custoProtheus <= 0) return <span className="text-slate-300 text-[10px]">—</span>;
    const diff = ((custoOC - custoProtheus) / custoProtheus) * 100;
    const abs  = Math.abs(diff);
    const cor  = abs < 2  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
               : abs < 10 ? 'bg-amber-50   text-amber-700   border-amber-200'
               :             'bg-red-50     text-red-700     border-red-200';
    return (
        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap ${cor}`}
              title={`OC: ${fmtMoney(custoOC)} | Protheus: ${fmtMoney(custoProtheus)}`}>
            {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
        </span>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function VMIOcFornecedoresPage({ isTab = false }) {
    const { hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');

    // Upload
    const [file, setFile]           = useState(null);
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview]     = useState(null);
    const [saving, setSaving]       = useState(false);
    const [dragOver, setDragOver]   = useState(false);
    const fileInputRef              = useRef(null);

    // Dados
    const [lotes, setLotes]               = useState([]);
    const [selectedLote, setSelectedLote] = useState(null);
    const [grupos, setGrupos]             = useState([]);
    const [totais, setTotais]             = useState(null);
    const [loading, setLoading]           = useState(false);

    // View
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [viewMode, setViewMode]             = useState('group');
    const [searchText, setSearchText]         = useState('');
    const [filterFornecedor, setFilterFornecedor] = useState('');
    const [showSemB1, setShowSemB1]           = useState(false);
    const [confirm, setConfirm]               = useState({ isOpen: false });
    const [toast, setToast]                   = useState({ msg: '', type: 'ok' });
    const [resyncing, setResyncing]           = useState(false);
    const [syncingPrices, setSyncingPrices]   = useState(false);

    const showToast = (msg, type = 'ok') => {
        setToast({ msg, type });
        setTimeout(() => setToast({ msg: '', type: 'ok' }), 4000);
    };

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchLotes = useCallback(async () => {
        try {
            const res = await api.get('/vmi/oc-fornecedores/lotes');
            setLotes(res.data.data || []);
        } catch {}
    }, []);

    const fetchData = useCallback(async (loteId) => {
        if (!loteId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ lote: loteId });
            if (filterFornecedor) params.set('fornecedor', filterFornecedor);
            const res = await api.get(`/vmi/oc-fornecedores?${params.toString()}`);
            setGrupos(res.data.data  || []);
            setTotais(res.data.totais || null);
        } catch { showToast('Erro ao carregar dados.', 'error'); }
        finally { setLoading(false); }
    }, [filterFornecedor]);

    useEffect(() => { fetchLotes(); }, [fetchLotes]);

    // ── Resync Protheus ───────────────────────────────────────────────────────
    const handleResync = async (force = false) => {
        if (!selectedLote || resyncing) return;
        setResyncing(true);
        try {
            const url = `/vmi/oc-fornecedores/lotes/${selectedLote}/resync${force ? '?force=true' : ''}`;
            const res = await api.post(url);
            showToast(res.data.msg || 'Resync concluído!');
            await fetchData(selectedLote);
        } catch (err) {
            showToast(err.response?.data?.error || 'Erro ao re-sincronizar.', 'error');
        } finally {
            setResyncing(false);
        }
    };

    // ── Sync Preços Protheus ──────────────────────────────────────────────
    const handleSyncPrices = async () => {
        if (!selectedLote || syncingPrices) return;
        setSyncingPrices(true);
        try {
            const res = await api.post(`/vmi/oc-fornecedores/lotes/${selectedLote}/sync-prices`);
            showToast(res.data.msg || 'Preços atualizados!');
            await fetchData(selectedLote);
        } catch (err) {
            showToast(err.response?.data?.error || 'Erro ao sincronizar preços.', 'error');
        } finally {
            setSyncingPrices(false);
        }
    };

    // ── Upload ────────────────────────────────────────────────────────────────
    const processFile = useCallback(async (f) => {
        if (!f) return;
        setFile(f);
        setUploading(true);
        const formData = new FormData();
        formData.append('file', f);
        try {
            const res = await api.post('/vmi/oc-fornecedores/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setPreview(res.data);
            showToast(`${res.data.stats.total_linhas} itens lidos — ${res.data.stats.mapeados} com b1_cod`);
        } catch (err) {
            const data = err.response?.data || {};
            if (data.modelo_invalido) alert(`⚠️ Formato inválido!\n\n${data.error}`);
            else showToast(data.error || 'Erro ao processar arquivo.', 'error');
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } finally { setUploading(false); }
    }, []);

    const handleFileChange = (e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); };
    const handleDrop = (e) => {
        e.preventDefault(); setDragOver(false);
        if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
    };

    const handleCancelPreview = () => {
        setPreview(null); setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSave = async () => {
        if (!preview) return;
        setSaving(true);
        try {
            await api.post('/vmi/oc-fornecedores/save', {
                itens: preview.preview,
                nome_arquivo: preview.nome_arquivo,
                sheet_name: preview.sheet_name
            });
            showToast('Planilha salva com sucesso!');
            handleCancelPreview();
            setTimeout(async () => {
                const res = await api.get('/vmi/oc-fornecedores/lotes');
                const novos = res.data.data || [];
                setLotes(novos);
                if (novos[0]) { setSelectedLote(novos[0].lote_id); fetchData(novos[0].lote_id); }
            }, 400);
        } catch (err) { showToast(err.response?.data?.error || 'Erro ao salvar.', 'error'); }
        finally { setSaving(false); }
    };

    const handleSelectLote = (loteId) => {
        setSelectedLote(loteId);
        setSearchText(''); setFilterFornecedor('');
        setExpandedGroups(new Set());
        fetchData(loteId);
    };

    const handleDeleteLote = (loteId, nome, e) => {
        e.stopPropagation();
        setConfirm({
            isOpen: true, title: 'Excluir Importação', confirmText: 'Excluir', danger: true,
            message: `Excluir "${nome}"? Todos os dados serão removidos.`,
            onConfirm: async () => {
                try {
                    await api.delete(`/vmi/oc-fornecedores/lotes/${loteId}`);
                    showToast('Removido com sucesso.');
                    setLotes(prev => prev.filter(l => l.lote_id !== loteId));
                    if (selectedLote === loteId) { setSelectedLote(null); setGrupos([]); setTotais(null); }
                } catch { showToast('Erro ao remover.', 'error'); }
            }
        });
    };

    const toggleGroup = (key) => setExpandedGroups(prev => {
        const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
    });
    const expandAll   = () => setExpandedGroups(new Set(gruposFiltrados.map(g => g.produto)));
    const collapseAll = () => setExpandedGroups(new Set());

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExport = () => {
        // Colunas: mesmo formato da planilha original + B1_COD_METALFISA e CUSTO_UNI_PROTHEUS
        const COLS = [
            { key: 'OC',                label: 'OC',                 w: 14 },
            { key: 'ITEM_OC',           label: 'ITEM_OC',            w: 10 },
            { key: 'PRODUTO',           label: 'PRODUTO',            w: 18 },
            { key: 'B1_COD_METALFISA',  label: 'B1_COD_METALFISA',   w: 18 },
            { key: 'DESC_PRODUTO',      label: 'DESC_PRODUTO',       w: 40 },
            { key: 'NOME_FORNECEDOR',   label: 'NOME_FORNECEDOR',    w: 30 },
            { key: 'DT_EMISSAO',        label: 'DT_EMISSAO',         w: 14 },
            { key: 'DT_NEG',            label: 'DT_NEG',             w: 14 },
            { key: 'RESPONSAVEL',       label: 'RESPONSAVEL',        w: 22 },
            { key: 'QTDE_EM_ABERTO',   label: 'QTDE_EM_ABERTO',     w: 16 },
            ...(canViewValues ? [
                { key: 'CUSTO_UNI',         label: 'CUSTO_UNI',          w: 16 },
                { key: 'CUSTO_UNI_PROTHEUS',label: 'CUSTO_UNI_PROTHEUS', w: 20 },
                { key: 'CUSTO_TOTAL',       label: 'CUSTO_TOTAL',        w: 16 },
            ] : []),
            { key: 'SITUACAO',          label: 'SITUACAO',           w: 14 },
            { key: 'ARM',               label: 'ARM',                w: 10 },
        ];

        const fmtDtExcel = (d) => {
            if (!d) return '';
            const s = String(d).trim();
            // já no formato YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                const [y, m, day] = s.split('-');
                return `${day}/${m}/${y}`;
            }
            return s;
        };

        const dataRows = [];
        gruposFiltrados.forEach(g => {
            g.itens.forEach(item => {
                dataRows.push({
                    OC:                 item.oc            || '',
                    ITEM_OC:            item.item_oc       || '',
                    PRODUTO:            item.produto       || '',
                    B1_COD_METALFISA:   item.b1_cod        || '',
                    DESC_PRODUTO:       item.desc_produto  || '',
                    NOME_FORNECEDOR:    item.nome_fornecedor || '',
                    DT_EMISSAO:         fmtDtExcel(item.dt_emissao),
                    DT_NEG:             fmtDtExcel(item.dt_neg),
                    RESPONSAVEL:        item.responsavel   || '',
                    QTDE_EM_ABERTO:     Number(item.qtde_em_aberto || 0),
                    ...(canViewValues ? {
                        CUSTO_UNI:          Number(item.custo_uni      || 0),
                        // Preço Protheus: prefere valor salvo no item (banco), fallback ao grupo (on-the-fly)
                        CUSTO_UNI_PROTHEUS: item.custo_protheus != null
                                                ? Number(item.custo_protheus)
                                                : (g.custo_protheus?.custo_medio != null
                                                    ? Number(g.custo_protheus.custo_medio)
                                                    : ''),
                        CUSTO_TOTAL:        Number(item.custo_total    || 0),
                    } : {}),
                    SITUACAO:           item.situacao      || '',
                    ARM:                item.arm           || '',
                });
            });
        });

        // Constrói a planilha usando array-of-arrays para controle total do header
        const headerRow = COLS.map(c => c.label);
        const aoa = [headerRow, ...dataRows.map(r => COLS.map(c => r[c.key]))];

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // Larguras das colunas
        ws['!cols'] = COLS.map(c => ({ wch: c.w }));

        // Congela a primeira linha (cabeçalho)
        ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', sqref: 'A2' };

        const wb = XLSX.utils.book_new();
        const loteAtualNome = loteAtual?.nome_arquivo?.replace(/\.[^.]+$/, '') || 'OC_Fornecedores';
        XLSX.utils.book_append_sheet(wb, ws, 'OCs');
        XLSX.writeFile(wb, `${loteAtualNome}_metalfisa_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    // ── Filtros ───────────────────────────────────────────────────────────────
    const gruposFiltrados = useMemo(() => {
        let list = grupos;
        if (showSemB1) list = list.filter(g => !g.b1_cod);
        if (searchText.trim()) {
            const s = searchText.toLowerCase();
            list = list.filter(g =>
                g.produto?.toLowerCase().includes(s) ||
                g.desc_produto?.toLowerCase().includes(s) ||
                g.b1_cod?.toLowerCase().includes(s) ||
                (g.ocs||[]).some(o => o.toLowerCase().includes(s))
            );
        }
        return list;
    }, [grupos, searchText, showSemB1]);

    const itensFlatFiltrados = useMemo(() =>
        gruposFiltrados.flatMap(g => g.itens.map(i => ({ ...i, _grupo: g }))),
    [gruposFiltrados]);

    const fornecedoresUnicos = useMemo(() =>
        [...new Set(grupos.flatMap(g => g.fornecedores || []).filter(Boolean))].sort(),
    [grupos]);

    const loteAtual = useMemo(() => lotes.find(l => l.lote_id === selectedLote), [lotes, selectedLote]);

    // ═════════════════════════════════════════════════════════════════════════
    return (
        <div className="space-y-4">

            {/* Toast */}
            {toast.msg && (
                <div className={`fixed top-4 right-4 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium
                    ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}

            <ConfirmModal
                isOpen={confirm.isOpen}
                title={confirm.title || ''}
                message={confirm.message || ''}
                confirmText={confirm.confirmText || 'Confirmar'}
                danger={confirm.danger}
                onConfirm={() => { confirm.onConfirm?.(); setConfirm(c => ({ ...c, isOpen: false })); }}
                onCancel={() => setConfirm(c => ({ ...c, isOpen: false }))}
            />

            {/* ═══ SEÇÃO UPLOAD ═══════════════════════════════════════════ */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                {/* Header upload */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <div className="w-7 h-7 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                        <UploadCloud className="w-4 h-4 text-cyan-600" />
                    </div>
                    <span className="font-semibold text-slate-700 text-sm">Importar Planilha de OC's</span>
                    <div className="ml-auto group relative">
                        <Info className="w-4 h-4 text-slate-400 cursor-help" />
                        <div className="absolute right-0 top-6 hidden group-hover:block z-50 w-80 bg-slate-800 text-white text-[10px] rounded-lg p-2.5 shadow-xl">
                            Colunas esperadas: OC · ITEM_OC · PRODUTO · DESC_PRODUTO · NOME_FORNECEDOR · DT_EMISSAO · DT_NEG · RESPONSAVEL · QTDE_EM_ABERTO · CUSTO_UNI · CUSTO_TOTAL · SITUACAO · ARM
                        </div>
                    </div>
                </div>

                {!preview ? (
                    /* Drop zone compacta */
                    <div
                        className={`m-4 border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all
                            ${dragOver ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 hover:border-cyan-300 hover:bg-slate-50/60'}`}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                    >
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                        {uploading ? (
                            <div className="flex flex-col items-center gap-2 text-cyan-600">
                                <RefreshCw className="w-7 h-7 animate-spin" />
                                <p className="font-semibold text-sm">Processando e localizando produtos no Protheus...</p>
                                <p className="text-xs text-slate-400">Aguarde, pode levar alguns segundos</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-1.5">
                                <FileSpreadsheet className="w-9 h-9 text-slate-300" />
                                <p className="font-medium text-slate-600 text-sm">
                                    Arraste o arquivo ou <span className="text-cyan-600 underline underline-offset-2">clique aqui</span>
                                </p>
                                <p className="text-xs text-slate-400">Relação de OC's Emitidas (.xlsx)</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Preview */
                    <div className="p-4 space-y-3">

                        {/* KPIs */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Linhas',     val: fmtNum(preview.stats.total_linhas),   color: 'text-slate-800' },
                                { label: 'Produtos',   val: fmtNum(preview.stats.total_produtos),  color: 'text-slate-800' },
                                { label: 'Com b1_cod', val: fmtNum(preview.stats.mapeados),        color: 'text-emerald-600',
                                  sub: `de ${fmtNum(preview.stats.total_linhas)} itens` },
                                { label: 'Sem b1_cod', val: fmtNum(preview.stats.sem_b1cod),
                                  color: preview.stats.sem_b1cod > 0 ? 'text-amber-600' : 'text-slate-400' },
                            ].map(({ label, val, color, sub }) => (
                                <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                                    <div className={`text-2xl font-bold tabular-nums ${color}`}>{val}</div>
                                    <div className="text-[11px] text-slate-500 font-medium">{label}</div>
                                    {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
                                </div>
                            ))}
                        </div>

                        {/* Aviso sem b1_cod */}
                        {preview.stats.sem_b1cod > 0 && (
                            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                <span><strong>{preview.stats.sem_b1cod}</strong> produto(s) não localizados no Protheus. Serão salvos sem b1_cod — verifique depois em "Mapeamento Protheus".</span>
                            </div>
                        )}

                        {/* Tabela preview com scroll */}
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex justify-between items-center">
                                <span className="text-xs font-semibold text-slate-500">
                                    Pré-visualização — {Math.min(preview.preview?.length || 0, 50)} de {preview.stats.total_linhas} linhas
                                </span>
                                <span className="text-[10px] text-slate-400 truncate max-w-[260px]">{preview.nome_arquivo}</span>
                            </div>
                            <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="border-b border-slate-200 bg-slate-50">
                                            <th className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">OC</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">Produto (Col C)</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">B1_COD Localizado</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-500">Descrição</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">Qtde Aberto</th>
                                            {canViewValues && <th className="px-3 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">Custo Total</th>}
                                            <th className="px-3 py-2 text-left font-semibold text-slate-500">Situação</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(preview.preview || []).slice(0, 50).map((item, i) => (
                                            <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                                <td className="px-3 py-1.5 font-mono text-slate-500">{item.oc}</td>
                                                <td className="px-3 py-1.5 font-mono font-semibold text-slate-700 whitespace-nowrap">{item.produto}</td>
                                                <td className="px-3 py-1.5"><B1Chip b1_cod={item.b1_cod} /></td>
                                                <td className="px-3 py-1.5 text-slate-500 max-w-[220px]">
                                                    <span className="block truncate" title={item.desc_produto}>{item.desc_produto}</span>
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-700">{fmtNum(item.qtde_em_aberto)}</td>
                                                {canViewValues && <td className="px-3 py-1.5 text-right font-mono text-slate-500">{fmtMoney(item.custo_total)}</td>}
                                                <td className="px-3 py-1.5"><SituacaoBadge s={item.situacao} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Ações */}
                        <div className="flex justify-end gap-3 pt-1">
                            <button onClick={handleCancelPreview}
                                className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60 shadow-sm transition-colors">
                                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Salvando...' : 'Confirmar e Salvar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ LOTES SALVOS ════════════════════════════════════════════ */}
            {lotes.length > 0 && !preview && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                        <span className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4 text-cyan-600" />
                            Importações Salvas
                        </span>
                        <button onClick={fetchLotes} className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors">
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="p-3 flex flex-wrap gap-2">
                        {lotes.map(l => (
                            <div key={l.lote_id} onClick={() => handleSelectLote(l.lote_id)}
                                role="button" tabIndex={0}
                                className={`group relative flex flex-col gap-0.5 px-4 py-2.5 rounded-xl border text-left transition-all cursor-pointer
                                    ${selectedLote === l.lote_id
                                        ? 'border-cyan-500 bg-cyan-50 shadow-sm shadow-cyan-100'
                                        : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white'}`}
                            >
                                <span className="font-semibold text-slate-700 text-xs truncate max-w-[200px]">{l.nome_arquivo}</span>
                                <span className="text-[10px] text-slate-400">{fmtDT(l.created_at)}</span>
                                <div className="flex gap-2 text-[10px] text-slate-500 mt-0.5">
                                    <span>{l.total_linhas} itens</span>·
                                    <span>{l.total_produtos} produtos</span>·
                                    <span className="font-semibold text-slate-600">{fmtNum(l.qtde_total)} pçs</span>
                                </div>
                                <button onClick={(e) => handleDeleteLote(l.lote_id, l.nome_arquivo, e)}
                                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-0.5 rounded transition-all">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ PAINEL DE DADOS ═════════════════════════════════════════ */}
            {selectedLote && !preview && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                    {/* Toolbar */}
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center gap-2">

                        {/* KPIs rápidos */}
                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-1 min-w-0">
                            {loteAtual && (<>
                                <span><strong className="text-slate-800">{totais?.total_grupos ?? loteAtual.total_produtos}</strong> grupos</span>
                                <span className="text-slate-300">|</span>
                                <span><strong className="text-slate-800 tabular-nums">{totais ? fmtNum(totais.qtde_total) : fmtNum(loteAtual.qtde_total)}</strong> pçs</span>
                                {canViewValues && (<>
                                    <span className="text-slate-300">|</span>
                                    <span className="font-semibold text-slate-700">{totais ? fmtMoney(totais.custo_total) : fmtMoney(loteAtual.custo_total)}</span>
                                </>)}
                            </>)}
                        </div>

                        {/* Controles */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Busca */}
                            <div className="relative">
                                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input value={searchText} onChange={e => setSearchText(e.target.value)}
                                    placeholder="Produto, OC, b1_cod..."
                                    className="pl-7 pr-6 py-1.5 text-xs border border-slate-200 rounded-lg w-40 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-400" />
                                {searchText && (
                                    <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>

                            {/* Fornecedor */}
                            {fornecedoresUnicos.length > 1 && (
                                <select value={filterFornecedor}
                                    onChange={e => { setFilterFornecedor(e.target.value); setTimeout(() => fetchData(selectedLote), 50); }}
                                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-400">
                                    <option value="">Todos fornecedores</option>
                                    {fornecedoresUnicos.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            )}

                            {/* Sem b1_cod */}
                            <button onClick={() => setShowSemB1(!showSemB1)}
                                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                                    ${showSemB1 ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                <AlertCircle className="w-3.5 h-3.5" /> Sem b1_cod
                            </button>

                            {/* Re-buscar Protheus */}
                            <button
                                onClick={() => handleResync(false)}
                                onContextMenu={e => { e.preventDefault(); handleResync(true); }}
                                disabled={resyncing}
                                title="Clique: resolve somente itens sem b1_cod | Clique direito: força re-resolve TODOS"
                                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                                    ${resyncing
                                        ? 'border-cyan-300 bg-cyan-50 text-cyan-500 cursor-wait'
                                        : 'border-cyan-200 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 hover:border-cyan-400'}`}>
                                {resyncing
                                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    : <Zap className="w-3.5 h-3.5" />}
                                {resyncing ? 'Buscando...' : 'Re-buscar Protheus'}
                            </button>

                            {/* Preços Protheus */}
                            <button
                                onClick={handleSyncPrices}
                                disabled={syncingPrices}
                                title="Busca o custo médio (B1_CUSTD) de todos os itens com b1_cod no Protheus e salva no banco"
                                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                                    ${syncingPrices
                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-500 cursor-wait'
                                        : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400'}`}>
                                {syncingPrices
                                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    : <DollarSign className="w-3.5 h-3.5" />}
                                {syncingPrices ? 'Buscando preços...' : 'Preços Protheus'}
                            </button>

                            <div className="w-px h-4 bg-slate-200" />


                            {/* Modo visualização */}
                            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                                <button onClick={() => setViewMode('group')}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors
                                        ${viewMode === 'group' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                                    <Layers className="w-3.5 h-3.5" /> Grupos
                                </button>
                                <button onClick={() => setViewMode('flat')}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 border-l border-slate-200 transition-colors
                                        ${viewMode === 'flat' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                                    <List className="w-3.5 h-3.5" /> Plano
                                </button>
                            </div>

                            {/* Expandir/recolher */}
                            {viewMode === 'group' && (<>
                                <button onClick={expandAll}   className="text-xs text-slate-500 hover:text-cyan-600 px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap">+ Tudo</button>
                                <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-cyan-600 px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap">− Tudo</button>
                            </>)}

                            <button onClick={handleExport}
                                className="flex items-center gap-1.5 text-xs text-slate-600 px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap">
                                <Download className="w-3.5 h-3.5" /> Excel
                            </button>
                        </div>
                    </div>

                    {/* Tabela — scroll aqui */}
                    <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)', minHeight: '200px' }}>
                        {loading ? (
                            <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
                                <RefreshCw className="w-5 h-5 animate-spin" /> Carregando...
                            </div>
                        ) : gruposFiltrados.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                                <Package className="w-8 h-8 text-slate-200" />
                                <p className="text-sm">Nenhum produto encontrado</p>
                            </div>
                        ) : viewMode === 'group' ? (
                            /* MODO AGRUPADO */
                            <table className="w-full text-xs border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="border-b-2 border-slate-200">
                                        <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-left w-8" />
                                        <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-left">Produto (Col C)</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-left">B1_COD Metalfisa</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-center w-10">PDF</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-left">Descrição</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-right">Qtde em Aberto</th>
                                        {canViewValues && <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-right">Vlr. Unit. OC</th>}
                                        {canViewValues && <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-right">Vlr. Padrão</th>}
                                        {canViewValues && <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-center">Δ%</th>}
                                        {canViewValues && <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-right">Custo Total</th>}
                                        <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-left">OC(s)</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-left">Saldo VMI</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-600 bg-slate-100 text-left">Cobertura</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gruposFiltrados.map((grupo, gi) => {
                                        const key      = grupo.produto || `_${gi}`;
                                        const expanded = expandedGroups.has(key);
                                        const saldoVMI = grupo.demanda_vmi?.saldo_vmi;
                                        return (
                                            <Fragment key={`g-${key}`}>
                                                <tr key={`g-${key}`} onClick={() => toggleGroup(key)}
                                                    className="border-b border-slate-100 bg-slate-50/40 hover:bg-cyan-50/40 cursor-pointer select-none transition-colors">
                                                    <td className="px-2 py-2.5 text-center">
                                                        <ChevronRight className={`w-3.5 h-3.5 text-slate-400 inline transition-transform ${expanded ? 'rotate-90' : ''}`} />
                                                    </td>
                                                    <td className="px-3 py-2.5 font-mono font-bold text-slate-700 whitespace-nowrap">{grupo.produto}</td>
                                                    <td className="px-3 py-2.5"><B1Chip b1_cod={grupo.b1_cod} /></td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <PdfCell url={grupo.pdf_url} />
                                                    </td>
                                                    <td className="px-3 py-2.5 text-slate-500 max-w-[220px]">
                                                        <span className="block truncate" title={grupo.desc_produto}>{grupo.desc_produto}</span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">{fmtNum(grupo.qtde_total)}</td>
                                                    {/* Vlr. Unit. OC */}
                                                    {canViewValues && (
                                                        <td className="px-3 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                                                            {grupo.custo_uni > 0 ? fmtMoney(grupo.custo_uni) : <span className="text-slate-300">—</span>}
                                                        </td>
                                                    )}
                                                    {/* Vlr. Padrão Protheus */}
                                                    {canViewValues && (
                                                        <td className="px-3 py-2.5 text-right font-mono text-slate-500 whitespace-nowrap">
                                                            {grupo.custo_protheus?.custo_medio > 0
                                                                ? fmtMoney(grupo.custo_protheus.custo_medio)
                                                                : <span className="text-slate-300">—</span>}
                                                        </td>
                                                    )}
                                                    {/* Δ% */}
                                                    {canViewValues && (
                                                        <td className="px-3 py-2.5 text-center">
                                                            <DiffBadge custoOC={grupo.custo_uni} custoProtheus={grupo.custo_protheus?.custo_medio} />
                                                        </td>
                                                    )}
                                                    {canViewValues && (
                                                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 whitespace-nowrap">{fmtMoney(grupo.custo_total)}</td>
                                                    )}
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex flex-wrap gap-0.5">
                                                            {(grupo.ocs||[]).map(oc => (
                                                                <span key={oc} className="font-mono text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600 whitespace-nowrap">{oc}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-mono text-slate-500 whitespace-nowrap">
                                                        {saldoVMI != null ? fmtNum(saldoVMI) : <span className="text-slate-200">—</span>}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <CoberturaBar qtde_oc={grupo.qtde_total} saldo_vmi={saldoVMI} />
                                                    </td>
                                                </tr>

                                                {expanded && grupo.itens.map((item, idx) => (
                                                    <tr key={`i-${key}-${idx}`}
                                                        className="border-b border-slate-50 bg-white hover:bg-slate-50/60 transition-colors">
                                                        <td className="px-2 py-1.5" />
                                                        <td className="px-3 py-1.5 pl-7 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                                            OC {item.oc} · {item.item_oc}
                                                        </td>
                                                        <td className="px-3 py-1.5">
                                                            {item.b1_cod
                                                                ? <span className="font-mono text-[10px] text-emerald-600">{item.b1_cod}</span>
                                                                : <span className="text-slate-200 text-[10px]">—</span>}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center">
                                                            {/* PDF herdado do grupo — não repete o ícone */}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-[11px]">
                                                            <div className="flex items-center gap-3 text-slate-400">
                                                                {item.nome_fornecedor && <span className="text-slate-500 truncate max-w-[140px]">{item.nome_fornecedor}</span>}
                                                                {item.dt_neg && <span className="whitespace-nowrap">Neg: {fmtDate(item.dt_neg)}</span>}
                                                                {item.arm && <span>Arm: {item.arm}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 whitespace-nowrap">{fmtNum(item.qtde_em_aberto)}</td>
                                                        {/* Vlr. Unit. item OC */}
                                                        {canViewValues && (
                                                            <td className="px-3 py-1.5 text-right font-mono text-slate-600 whitespace-nowrap">
                                                                {item.custo_uni > 0 ? fmtMoney(item.custo_uni) : <span className="text-slate-300">—</span>}
                                                            </td>
                                                        )}
                                                        {/* Vlr. Padrão (herdado do grupo) */}
                                                        {canViewValues && <td className="px-3 py-1.5" />}
                                                        {canViewValues && <td className="px-3 py-1.5" />}
                                                        {canViewValues && (
                                                            <td className="px-3 py-1.5 text-right font-mono text-slate-500 whitespace-nowrap">{fmtMoney(item.custo_total)}</td>
                                                        )}
                                                        <td className="px-3 py-1.5"><SituacaoBadge s={item.situacao} /></td>
                                                        <td className="px-3 py-1.5" /><td className="px-3 py-1.5" />
                                                    </tr>
                                                ))}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>

                                {/* Rodapé */}
                                {totais && (
                                    <tfoot className="sticky bottom-0 z-10">
                                        <tr className="border-t-2 border-slate-300 bg-slate-100">
                                            {canViewValues ? (
                                                <>
                                                    <td colSpan={4} className="px-3 py-2.5 font-bold text-slate-700 text-xs whitespace-nowrap">
                                                        TOTAL — {totais.total_grupos} grupos · {totais.total_itens} linhas
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-bold font-mono text-slate-800 whitespace-nowrap">{fmtNum(totais.qtde_total)}</td>
                                                    <td colSpan={3} />
                                                    <td className="px-3 py-2.5 text-right font-bold font-mono text-slate-800 whitespace-nowrap">{fmtMoney(totais.custo_total)}</td>
                                                    <td colSpan={3} />
                                                </>
                                            ) : (
                                                <>
                                                    <td colSpan={5} className="px-3 py-2.5 font-bold text-slate-700 text-xs whitespace-nowrap">
                                                        TOTAL — {totais.total_grupos} grupos · {totais.total_itens} linhas
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-bold font-mono text-slate-800 whitespace-nowrap">{fmtNum(totais.qtde_total)}</td>
                                                    <td colSpan={3} />
                                                </>
                                            )}
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        ) : (
                            /* MODO PLANO */
                            <table className="w-full text-xs border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="border-b-2 border-slate-200">
                                        {['OC','Item','Produto (Col C)','B1_COD','Descrição','Fornecedor','Qtde Aberto'].map(h => (
                                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap bg-slate-100">{h}</th>
                                        ))}
                                        {canViewValues && ['Vlr. Unit. OC','Custo Total'].map(h => (
                                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap bg-slate-100">{h}</th>
                                        ))}
                                        {['Data Neg.','Situação'].map(h => (
                                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap bg-slate-100">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {itensFlatFiltrados.map((item, i) => (
                                        <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                                            <td className="px-3 py-1.5 font-mono text-slate-500 whitespace-nowrap">{item.oc}</td>
                                            <td className="px-3 py-1.5 font-mono text-slate-400 text-center">{item.item_oc}</td>
                                            <td className="px-3 py-1.5 font-mono font-semibold text-slate-700 whitespace-nowrap">{item.produto}</td>
                                            <td className="px-3 py-1.5 whitespace-nowrap"><B1Chip b1_cod={item.b1_cod} /></td>
                                            <td className="px-3 py-1.5 text-slate-500 max-w-[200px]">
                                                <span className="block truncate" title={item.desc_produto}>{item.desc_produto}</span>
                                            </td>
                                            <td className="px-3 py-1.5 text-slate-500 max-w-[150px]">
                                                <span className="block truncate">{item.nome_fornecedor}</span>
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-700 whitespace-nowrap">{fmtNum(item.qtde_em_aberto)}</td>
                                            {canViewValues && (
                                                <td className="px-3 py-1.5 text-right font-mono text-cyan-700 whitespace-nowrap">
                                                    {item.custo_uni > 0 ? fmtMoney(item.custo_uni) : <span className="text-slate-300">—</span>}
                                                </td>
                                            )}
                                            {canViewValues && (
                                                <td className="px-3 py-1.5 text-right font-mono text-slate-500 whitespace-nowrap">{fmtMoney(item.custo_total)}</td>
                                            )}
                                            <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">{fmtDate(item.dt_neg)}</td>
                                            <td className="px-3 py-1.5"><SituacaoBadge s={item.situacao} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                                {totais && (
                                    <tfoot className="sticky bottom-0 z-10">
                                        <tr className="border-t-2 border-slate-300 bg-slate-100">
                                            <td colSpan={6} className="px-3 py-2.5 font-bold text-slate-700 text-xs">
                                                TOTAL — {itensFlatFiltrados.length} linhas
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-bold font-mono text-slate-800 whitespace-nowrap">
                                                {fmtNum(itensFlatFiltrados.reduce((s,i) => s + Number(i.qtde_em_aberto||0), 0))}
                                            </td>
                                            {canViewValues && (
                                                <td className="px-3 py-2.5 text-right font-bold font-mono text-slate-800 whitespace-nowrap">
                                                    {fmtMoney(itensFlatFiltrados.reduce((s,i) => s + Number(i.custo_total||0), 0))}
                                                </td>
                                            )}
                                            <td colSpan={2} />
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Estado vazio */}
            {!selectedLote && !preview && lotes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 bg-white rounded-2xl border border-slate-200">
                    <ShoppingCart className="w-10 h-10 text-slate-200" />
                    <p className="text-sm font-medium text-slate-500">Nenhuma planilha de OC's importada</p>
                    <p className="text-xs">Faça o upload acima para começar</p>
                </div>
            )}
        </div>
    );
}
