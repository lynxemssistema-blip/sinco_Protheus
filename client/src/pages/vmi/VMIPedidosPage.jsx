import { useState, useEffect, useRef, useMemo } from 'react';
import {
    UploadCloud, ListOrdered, RefreshCw, Layers, Trash2,
    CheckCircle2, FileUp, Search, X, Download, XCircle, FileDown
} from 'lucide-react';
import { api, getFileUrl } from '../../services/api';
import * as XLSX from 'xlsx';
import ConfirmModal from '../../components/ConfirmModal';

const fmtDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    // Para não ter erro de timezone, adiciona offset local
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateFull = (d) => d
    ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');


export default function VMIPedidosPage({ isTab = false }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [importMeta, setImportMeta] = useState(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);

    const [data, setData] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [selectedLote, setSelectedLote] = useState(null);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ msg: '', type: 'ok' });
    const [filterText, setFilterText] = useState('');
    const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    const showToast = (msg, type = 'ok') => {
        setToast({ msg, type });
        setTimeout(() => setToast({ msg: '', type: 'ok' }), 4500);
    };

    const fetchLotes = async () => {
        try {
            const res = await api.get('/vmi-pedidos/lotes');
            setLotes(res.data.data || []);
        } catch (err) {
            console.error('Erro:', err);
        }
    };

    const fetchData = async (lote = null) => {
        setLoading(true);
        try {
            const url = lote ? `/vmi-pedidos?lote=${lote}` : '/vmi-pedidos';
            const res = await api.get(url);
            setData(res.data.data || []);
        } catch (err) {
            console.error('Erro ao buscar pedidos:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLotes();
    }, []);

    const handleAtualizar = () => {
        fetchLotes();
        fetchData(selectedLote);
    };

    const handleSelectLote = (loteId) => {
        setSelectedLote(loteId);
        setFilterText('');
        fetchData(loteId);
    };

    const handleFileChange = (e) => {
        if (e.target.files?.[0]) setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post('/vmi-pedidos/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast(res.data.msg);
            setPreviewData(res.data.preview_data || []);
            setImportMeta(res.data._import_meta || null);
            setPreviewMode(true);
        } catch (err) {
            const data = err.response?.data || {};
            showToast(data.error || 'Erro de conexão.', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleCancelPreview = () => {
        setPreviewMode(false);
        setPreviewData([]);
        setImportMeta(null);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDownloadModelo = async () => {
        try {
            const res = await api.get('/vmi-pedidos/modelo', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Modelo_VMI_Pedido.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            showToast('Erro ao baixar modelo.', 'error');
        }
    };

    const handleConfirmSave = async () => {
        setSaving(true);
        try {
            const res = await api.post('/vmi-pedidos/save-lote', {
                records: previewData,
                _import_meta: importMeta
            });
            showToast(res.data.msg);
            handleCancelPreview();
            await fetchLotes();
            await fetchData();
        } catch (err) {
            const msg = err.response?.data?.error || 'Erro ao gravar dados aprovados.';
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleClearAll = () => {
        setConfirm({
            isOpen: true,
            title: 'Limpar Todos os Pedidos',
            message: 'Tem certeza que deseja limpar TODAS as linhas? Ação irreversível.',
            onConfirm: async () => {
                try {
                    await api.delete('/vmi-pedidos/all');
                    showToast('Base limpa com sucesso.');
                    setLotes([]);
                    setSelectedLote(null);
                    setData([]);
                } catch {
                    showToast('Erro ao limpar.', 'error');
                }
            }
        });
    };

    const handleDeleteLote = (loteId, nomeArquivo, e) => {
        e.stopPropagation();
        setConfirm({
            isOpen: true,
            title: 'Excluir Lote',
            message: `Tem certeza que deseja excluir o lote "${nomeArquivo}"?`,
            onConfirm: async () => {
                try {
                    await api.delete(`/vmi-pedidos/lotes/${loteId}`);
                    showToast('Lote removido.');
                    const novos = lotes.filter(l => l.lote_id !== loteId);
                    setLotes(novos);
                    if (selectedLote === loteId) {
                        setSelectedLote(null);
                        setData([]);
                    }
                } catch {
                    showToast('Erro ao remover.', 'error');
                }
            }
        });
    };

    const filteredRows = useMemo(() => {
        const source = previewMode ? previewData : data;
        if (!filterText.trim()) return source;
        const s = filterText.toLowerCase();
        return source.filter(r =>
            (r.codigo_produto_cliente || '').toLowerCase().includes(s) ||
            (r.descricao_produto_cliente || '').toLowerCase().includes(s) ||
            (r.ordem_compra || '').toLowerCase().includes(s) ||
            (r.b1_cod || '').toLowerCase().includes(s)
        );
    }, [data, previewData, previewMode, filterText]);

    const stats = useMemo(() => {
        const totalQtd = filteredRows.reduce((s, r) => s + Number(r.quantidade || 0), 0);
        return {
            itens: filteredRows.length,
            uniqueProds: new Set(filteredRows.map(r => r.codigo_base)).size,
            uniqueOrders: new Set(filteredRows.map(r => r.ordem_compra)).size,
            totalQtd
        };
    }, [filteredRows]);

    const handleExportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredRows.map(r => ({
            'Pedido Cliente': r.ordem_compra,
            'Item OC': r.item_oc,
            'Data Entrega': fmtDate(r.data_entrega),
            'Cód. Original': r.codigo_produto_cliente,
            'Cód. Base (9)': r.codigo_base,
            'Revisão': r.revisao_cliente,
            'Descrição Produto': r.descricao_produto_cliente,
            'Quantidade': r.quantidade,
            'Tipo Mapeamento': r.status_tipo_item || 'PCP',
            'Cód. Protheus': r.b1_cod || '',
            'Status Detalhe': r.status_tipo_detalhe || ''
        })));

        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = XLSX.utils.encode_cell({ r: 0, c });
            if (ws[cell]) ws[cell].s = {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '3730A3' } },
                alignment: { horizontal: 'center', vertical: 'center' },
            };
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'VMI Pedidos');
        const date = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `VMI_Pedidos_${date}.xlsx`, { cellStyles: true });
        showToast('Excel exportado!');
    };

    const toastBg = { ok: 'bg-slate-900', error: 'bg-red-700', warning: 'bg-amber-600' }[toast.type] || 'bg-slate-900';

    return (
        <div className={isTab ? 'space-y-3' : 'w-full px-2 sm:px-4 py-2 space-y-3'}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!isTab && (
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <ListOrdered className="w-7 h-7 text-indigo-600" />
                            VMI Pedido
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Integração de pedidos baseados em datas de entrega e itens exatos das ordens de compra.</p>
                    </div>
                )}
                <div className="flex items-center gap-3">
                    <button onClick={handleAtualizar}
                        className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                    </button>
                    {data.length > 0 && !previewMode && (
                        <button onClick={handleExportExcel}
                            className="px-3 py-2 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-700 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm">
                            <Download className="w-4 h-4" /> Exportar Planilha
                        </button>
                    )}
                    {data.length > 0 && !previewMode && (
                        <button onClick={handleClearAll}
                            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm">
                            <Trash2 className="w-4 h-4" /> Limpar Base
                        </button>
                    )}
                </div>
            </div>

            {/* Upload Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2 mb-4">
                    <FileUp className="w-4 h-4 text-indigo-500" /> Importar Pedidos de Compra (Excel)
                </h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <button onClick={handleDownloadModelo}
                        type="button"
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                        title="Baixar planilha modelo para preenchimento">
                        <FileDown className="w-3.5 h-3.5" /> Baixar Modelo
                    </button>
                    <div className="relative flex-1 max-w-xl">
                        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange}
                            ref={fileInputRef} disabled={previewMode}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors border border-slate-200 rounded-lg bg-slate-50 disabled:opacity-50" />
                    </div>
                    {!previewMode ? (
                        <button onClick={handleUpload} disabled={!file || uploading}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            {uploading
                                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processando...</>
                                : <><UploadCloud className="w-4 h-4" /> Ler / Prever Dados</>}
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button onClick={handleCancelPreview} disabled={saving}
                                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50">
                                Cancelar
                            </button>
                            <button onClick={handleConfirmSave} disabled={saving}
                                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm font-bold transition shadow-sm disabled:opacity-50">
                                {saving
                                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Gravando...</>
                                    : <><CheckCircle2 className="w-4 h-4" /> Confirmar e Salvar Lote</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Lote Selector */}
            {lotes.length > 0 && !previewMode && (
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Importações Registradas ({lotes.length})
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {lotes.map(l => {
                            const isActive = selectedLote === l.lote_id
                                || (!selectedLote && lotes[0]?.lote_id === l.lote_id);
                            return (
                                <div key={l.lote_id}
                                    className={`flex-shrink-0 relative text-left px-4 py-3 rounded-xl border transition text-xs shadow-sm min-w-[210px] max-w-[240px] cursor-pointer ${isActive
                                        ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'}`}
                                    onClick={() => handleSelectLote(l.lote_id)}
                                    title={`Lote: ${l.lote_id}`}>
                                    <button
                                        onClick={(e) => handleDeleteLote(l.lote_id, l.nome_arquivo || 'este lote', e)}
                                        title="Excluir este lote"
                                        className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition p-0.5 rounded">
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                    <div className="font-bold text-slate-800 truncate pr-5" title={l.nome_arquivo}>
                                        📄 {l.nome_arquivo || 'Sem nome'}
                                    </div>
                                    <div className="text-slate-500 mt-0.5">🗓 {fmtDateFull(l.created_at)}</div>
                                    <div className="flex gap-3 mt-1.5 text-slate-400 font-medium flex-wrap">
                                        <span>{l.total_linhas} linhas mapeadas</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Main Data Table */}
            <div className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col ${previewMode ? 'border-orange-300 ring-4 ring-orange-50' : 'border-slate-200'}`}>
                {/* Section Header + Toolbar */}
                <div className={`p-4 border-b space-y-3 ${previewMode ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
                    <h3 className={`font-bold ${previewMode ? 'text-orange-800' : 'text-slate-700'}`}>
                        {previewMode ? '⚠️ Pré-visualização — Ainda NÃO SALVO' : 'Pedidos Mapeados (Ativos)'}
                    </h3>

                    {(previewMode || data.length > 0) && (
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="relative flex-1 min-w-[200px] max-w-sm">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input type="text"
                                    placeholder="Pesquisar OC, Cód, Descrição..."
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
                        </div>
                    )}

                    {/* Stats */}
                    {filteredRows.length > 0 && (
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 items-center">
                            <span className="font-semibold text-slate-700">{fmtNum(stats.itens)} linhas</span>
                            <span className="text-slate-300">|</span>
                            <span>{fmtNum(stats.uniqueProds)} produtos base únicos</span>
                            <span className="text-slate-300">|</span>
                            <span>{fmtNum(stats.uniqueOrders)} pedidos listados</span>
                            <span className="text-slate-300">|</span>
                            <span>Total Qtd: <strong className="text-indigo-700">{fmtNum(stats.totalQtd)}</strong> pçs</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                {loading && !previewMode ? (
                    <div className="p-12 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                    </div>
                ) : (!previewMode && data.length === 0) ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                        <Layers className="w-12 h-12 mb-3 opacity-30" />
                        <p className="font-medium text-slate-600">Nenhum pedido importado.</p>
                        <p className="text-sm mt-1">Carregue a planilha na guia "ORDENS DE COMPRA".</p>
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">Nenhum resultado encontrado.</div>
                ) : (
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-slate-100 text-slate-600 text-xs font-bold border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 min-w-[100px]">Pedido OC</th>
                                    <th className="px-4 py-3 min-w-[80px]">Item</th>
                                    <th className="px-4 py-3 min-w-[150px]">Cód. Original</th>
                                    <th className="px-4 py-3 min-w-[110px]">Cód. Base (9)</th>
                                    <th className="px-4 py-3 min-w-[60px]">Rev</th>
                                    <th className="px-4 py-3 min-w-[240px]">Descrição Cliente</th>
                                    <th className="px-4 py-3 min-w-[110px]">Data Entrega</th>
                                    <th className="px-4 py-3 min-w-[90px] text-right">Qtd</th>
                                    <th className="px-4 py-3">Cód. Protheus</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {filteredRows.map((r, i) => (
                                    <tr key={i} className={`hover:bg-indigo-50/20 transition-colors ${previewMode ? 'hover:bg-orange-50' : ''}`}>
                                        <td className="px-4 py-2 font-mono text-xs font-bold text-slate-800">{r.ordem_compra}</td>
                                        <td className="px-4 py-2 font-mono text-xs text-slate-500">{r.item_oc}</td>
                                        <td className="px-4 py-2 font-mono text-[11px] text-slate-500 truncate max-w-[150px]" title={r.codigo_produto_cliente}>{r.codigo_produto_cliente}</td>
                                        <td className="px-4 py-2 font-mono text-xs font-semibold text-blue-700">{r.codigo_base}</td>
                                        <td className="px-4 py-2 font-mono text-xs font-bold text-slate-600">{r.revisao_cliente || '-'}</td>
                                        <td className="px-4 py-2 text-[11px] text-slate-500 truncate max-w-[280px]" title={r.descricao_produto_cliente}>{r.descricao_produto_cliente}</td>
                                        <td className="px-4 py-2 font-mono text-[11px] text-slate-600 font-semibold">{fmtDate(r.data_entrega)}</td>
                                        <td className="px-4 py-2 text-right font-mono text-xs font-bold text-slate-800">{fmtNum(r.quantidade)}</td>
                                        <td className="px-4 py-2 font-mono text-xs text-slate-600">{r.b1_cod || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {toast.msg && (
                <div className={`fixed bottom-6 right-6 ${toastBg} shadow-2xl rounded-xl text-white px-5 py-3 text-sm font-bold z-[100] flex items-center gap-3`}>
                    <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0" />
                    <span>{toast.msg}</span>
                </div>
            )}

            <ConfirmModal
                isOpen={confirm.isOpen}
                onClose={() => setConfirm(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => {
                    if (confirm.onConfirm) confirm.onConfirm();
                    setConfirm(prev => ({ ...prev, isOpen: false }));
                }}
                title={confirm.title}
                message={confirm.message}
            />
        </div>
    );
}
