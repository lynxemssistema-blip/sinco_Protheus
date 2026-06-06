import React, { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import {
    UploadCloud, FileSpreadsheet, RefreshCw, Trash2,
    CheckCircle2, FileUp, Search, X, ChevronDown, ChevronRight, AlertCircle, Download, FileDown, Layers, XCircle
} from 'lucide-react';
import api from '../../services/api';
import * as XLSX from 'xlsx';
import ConfirmModal from '../../components/ConfirmModal';
import { toast } from 'react-toastify';

const fmtDate = (d) => d
    ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');

export default function WabtecDatasSolicitacaoPage({ isTab = false }) {
    // ── Upload ────────────────────────────────────────────────────────────────
    const [file, setFile] = useState(null);
    const [sheets, setSheets] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [previewMode, setPreviewMode] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);

    // ── Data ──────────────────────────────────────────────────────────────────
    const [data, setData] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [selectedLote, setSelectedLote] = useState(null);
    const [loading, setLoading] = useState(false);

    // ── View ──────────────────────────────────────────────────────────────────
    const [filterText, setFilterText] = useState('');
    const [columnFilters, setColumnFilters] = useState({ po_number: '', pedido_metal: '', cod_produto: '', item_cliente: '', saldo: '', data_pcp_cliente: '' });
    const [groupBy, setGroupBy] = useState('flat'); // 'flat' | 'pedido' | 'pedido_metal'
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [updatingSinco, setUpdatingSinco] = useState(null);
    const [fetchingSinco, setFetchingSinco] = useState(null);

    const handleUpdateSinco = async (pedido, item, dataPlanilha) => {
        if (!pedido || !item || !dataPlanilha) {
            toast.error('Pedido, Item ou Data ausentes (Verifique o PO Number).');
            return;
        }
        setUpdatingSinco(`${pedido}-${item}`);
        try {
            const res = await api.post('/wabtec-datas/update-sinco-date', {
                pedido_metal: pedido,
                item: item,
                nova_data: dataPlanilha
            });
            if (res.data.success) {
                toast.success(`Pedido ${pedido} Item ${item} atualizado no SINCO!`);
                if (selectedLote) fetchData(selectedLote);
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao atualizar SINCO.');
        } finally {
            setUpdatingSinco(null);
        }
    };

    const handleUpdateSincoBulk = async (rowsToUpdate, groupKey = 'all') => {
        setUpdatingSinco(`bulk-${groupKey}`);
        let successCount = 0;
        let fetchCount = 0;

        try {
            for (let i = 0; i < rowsToUpdate.length; i++) {
                const r = rowsToUpdate[i];
                if (!r.pedido_metal || !r.data_pcp_cliente) continue;

                let currentItem = r.sinco_item;

                // Step 1: Fetch item if missing, exactly like 'Buscar SINCO'
                if (!currentItem) {
                    try {
                        const fetchRes = await api.get('/wabtec-datas/sinco-date', {
                            params: { pedido_metal: r.pedido_metal, po_number: r.po_number, cod_produto: r.cod_produto }
                        });
                        if (fetchRes.data && fetchRes.data.item) {
                            currentItem = fetchRes.data.item;
                            fetchCount++;
                        }
                    } catch (e) {
                        console.error('Erro ao buscar item no SINCO:', e);
                    }
                }

                // Step 2: Update if we have the item, exactly like 'Enviar SINCO'
                if (currentItem) {
                    try {
                        await api.post('/wabtec-datas/update-sinco-date', {
                            pedido_metal: r.pedido_metal,
                            item: currentItem,
                            nova_data: r.data_pcp_cliente
                        });
                        successCount++;
                    } catch (e) {
                        console.error('Erro ao atualizar item no SINCO:', e);
                    }
                }
            }

            if (successCount > 0) {
                toast.success(`${successCount} itens enviados ao SINCO com sucesso! (Buscados: ${fetchCount})`);
                if (selectedLote) fetchData(selectedLote);
            } else {
                toast.warning('Nenhum item válido foi processado no lote.');
            }
        } catch (err) {
            toast.error('Erro geral ao processar lote.');
        } finally {
            setUpdatingSinco(null);
        }
    };

    const handleFetchSinco = async (pedido, po_number, cod_produto, index) => {
        if (!pedido || !po_number || !cod_produto) {
            toast.error('Pedido, PO Number ou Produto ausentes.');
            return;
        }
        setFetchingSinco(index);
        try {
            const res = await api.get('/wabtec-datas/sinco-date', {
                params: { pedido_metal: pedido, po_number: po_number, cod_produto: cod_produto }
            });
            
            // Update the specific row in the frontend state
            if (res.data.item) {
                toast.success(`Data buscada com sucesso!`);
                
                // We need to update the data state
                // Actually the cleanest way is just to re-fetch the whole lot?
                // Or update the local `filteredRows` or `data`?
                if (selectedLote) fetchData(selectedLote);
            } else {
                toast.error(res.data.msg || 'Item não encontrado.');
            }
        } catch (err) {
            toast.error('Erro ao buscar data no SINCO.');
        } finally {
            setFetchingSinco(null);
        }
    };

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchLotes = async () => {
        try {
            const res = await api.get('/wabtec-datas/lotes');
            setLotes(res.data.data || []);
        } catch (err) {
            console.error('Erro ao buscar lotes:', err);
        }
    };

    const fetchData = async (lote = null) => {
        setLoading(true);
        try {
            const url = lote ? `/wabtec-datas/demandas?lote=${lote}` : '/wabtec-datas/demandas';
            const res = await api.get(url);
            setData(res.data.data || []);
        } catch (err) {
            console.error('Erro ao buscar demandas:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLotes();
    }, []);

    const handleAtualizar = () => {
        fetchLotes();
        if (selectedLote) fetchData(selectedLote);
        else fetchData();
    };

    const handleSelectLote = (loteId) => {
        setSelectedLote(loteId);
        setFilterText('');
        setGroupBy('flat');
        fetchData(loteId);
    };

    // ── Upload handlers ───────────────────────────────────────────────────────
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setSheets([]);
        setSelectedSheet('');
        setPreviewData([]);
        setPreviewMode(false);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                setSheets(wb.SheetNames);
                if (wb.SheetNames.length > 0) {
                    setSelectedSheet(wb.SheetNames[0]);
                }
            } catch (err) {
                console.error(err);
                toast.error('Erro ao ler arquivo Excel.');
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handleUpload = () => {
        if (!file || !selectedSheet) return;
        
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const ws = wb.Sheets[selectedSheet];
                const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
                
                if (rawData.length < 2) {
                    toast.warning('A aba parece estar vazia.');
                    return;
                }

                const headers = rawData[0];
                const parsedRows = [];

                for (let i = 1; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (!row || row.length === 0) continue;
                    const hasData = row.some(cell => cell !== null && cell !== '');
                    if (!hasData) continue;

                    const mappedRow = {
                        po_number: row[1] || '',
                        pedido_metal: row[2] || '',
                        cod_produto: row[3] || '',
                        saldo: row[4] || 0,
                        item_cliente: row[12] || '',
                        data_pcp_cliente: row[24] || null,
                        raw_data: {}
                    };

                    if (mappedRow.data_pcp_cliente instanceof Date) {
                        mappedRow.data_pcp_cliente = mappedRow.data_pcp_cliente.toISOString().split('T')[0];
                    }

                    headers.forEach((header, index) => {
                        if (header) {
                            mappedRow.raw_data[header] = row[index];
                        }
                    });

                    parsedRows.push(mappedRow);
                }

                setPreviewData(parsedRows);
                setPreviewMode(true);
                toast.success('Planilha analisada com sucesso!');
            } catch (err) {
                console.error(err);
                toast.error('Erro ao processar planilha.');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleCancelPreview = () => {
        setPreviewMode(false);
        setPreviewData([]);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmSave = async () => {
        if (previewData.length === 0) return;
        setSaving(true);
        try {
            const payload = {
                fileName: file.name,
                sheetName: selectedSheet,
                rows: previewData,
                importedBy: 'Usuário WabTec'
            };

            const res = await api.post('/wabtec-datas/import', payload);
            if (res.data.success) {
                toast.success(res.data.message);
                handleCancelPreview();
                await fetchLotes();
                handleSelectLote(res.data.importId); // Select the newly imported batch
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao gravar os dados.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteLote = (loteId, nomeArquivo, e) => {
        e.stopPropagation();
        setConfirm({
            isOpen: true,
            title: 'Excluir Importação',
            message: `Tem certeza que deseja excluir a importação "${nomeArquivo}"?`,
            onConfirm: async () => {
                try {
                    await api.delete(`/wabtec-datas/lotes/${loteId}`);
                    toast.success('Lote removido.');
                    const novosLotes = lotes.filter(l => l.id !== loteId);
                    setLotes(novosLotes);
                    if (selectedLote === loteId) {
                        setSelectedLote(null);
                        setData([]);
                    }
                } catch {
                    toast.error('Erro ao remover lote.');
                }
            }
        });
    };

    // ── Derived data (memoized) ───────────────────────────────────────────────
    
    // Choose which dataset to display: previewData or DB data
    const currentData = previewMode ? previewData : data;

    // Apply text filter
    const filteredRows = useMemo(() => {
        let result = currentData;
        if (filterText.trim()) {
            const s = filterText.toLowerCase();
            result = result.filter(r =>
                String(r.po_number || '').toLowerCase().includes(s) ||
                String(r.pedido_metal || '').toLowerCase().includes(s) ||
                String(r.cod_produto || '').toLowerCase().includes(s) ||
                String(r.item_cliente || '').toLowerCase().includes(s)
            );
        }
        Object.keys(columnFilters).forEach(key => {
            if (columnFilters[key].trim()) {
                const searchStr = columnFilters[key].toLowerCase();
                result = result.filter(r => {
                    const cellVal = key === 'data_pcp_cliente' && r[key] 
                        ? fmtDate(r[key]).toLowerCase() 
                        : String(r[key] || '').toLowerCase();
                    return cellVal.includes(searchStr);
                });
            }
        });
        return result;
    }, [currentData, filterText, columnFilters]);

    // Build groups
    const grupos = useMemo(() => {
        if (groupBy === 'flat') return null;
        const map = {};
        filteredRows.forEach(r => {
            const key = groupBy === 'pedido_metal' ? (r.pedido_metal || 'Sem Pedido Metal') : (r.po_number || 'Sem PO');
            if (!map[key]) {
                map[key] = {
                    key,
                    rows: [],
                    totalSaldo: 0
                };
            }
            map[key].rows.push(r);
            map[key].totalSaldo += Number(r.saldo || 0);
        });
        return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
    }, [filteredRows, groupBy]);

    // Auto-expand all when grouping changes
    useEffect(() => {
        if (grupos) setExpandedGroups(new Set(grupos.map(g => g.key)));
    }, [grupos]);

    const toggleGroup = (key) => setExpandedGroups(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });

    // ── Export Excel ─────────────────────────────────────────────────
    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(currentData.map(r => ({
            'PO Number': r.po_number,
            'Pedido Metal': r.pedido_metal,
            'Cód. Produto': r.cod_produto,
            'Saldo': r.saldo,
            'Item Cliente': r.item_cliente,
            'Data PCP': r.data_pcp_cliente ? fmtDate(r.data_pcp_cliente) : ''
        })));
        XLSX.utils.book_append_sheet(wb, ws, 'WabTec_Dados');
        XLSX.writeFile(wb, `WabTec_Forecast_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success('Excel exportado!');
    };

    // ── Table row renderers ───────────────────────────────────────────────────
    const renderFlatRows = () => filteredRows.map((r, i) => (
        <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
            <td className="px-4 py-2 font-mono text-xs font-bold text-slate-700">{r.po_number || '-'}</td>
            <td className="px-4 py-2 font-mono text-xs text-blue-700 font-semibold">{r.pedido_metal || '-'}</td>
            <td className="px-4 py-2 text-xs text-slate-800">{r.cod_produto || '-'}</td>
            <td className="px-4 py-2 font-mono text-xs text-slate-600">{r.item_cliente || '-'}</td>
            <td className="px-4 py-2 text-center font-bold text-indigo-700 text-xs font-mono bg-slate-50">{fmtNum(r.saldo)}</td>
            <td className="px-4 py-2 text-[11px] font-bold text-slate-600">{r.data_pcp_cliente ? fmtDate(r.data_pcp_cliente) : '-'}</td>
            {!previewMode && (
                <>
                    <td className="px-4 py-2 text-center text-[11px] font-bold text-slate-500 bg-slate-50 border-l border-slate-200">
                        {r.data_sinco ? fmtDate(r.data_sinco) : '-'}
                    </td>
                    <td className="px-4 py-2 text-center flex items-center justify-center gap-2">
                        <button 
                            disabled={!r.pedido_metal || fetchingSinco === i}
                            onClick={() => handleFetchSinco(r.pedido_metal, r.po_number, r.cod_produto, i)}
                            className="bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white px-2 py-1.5 rounded text-[10px] font-bold transition disabled:opacity-50">
                            {fetchingSinco === i ? '...' : 'Buscar SINCO'}
                        </button>
                        <button 
                            disabled={!r.data_pcp_cliente || !r.pedido_metal || !r.sinco_item || updatingSinco === `${r.pedido_metal}-${r.sinco_item}`}
                            onClick={() => handleUpdateSinco(r.pedido_metal, r.sinco_item, r.data_pcp_cliente)}
                            className="bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white px-2 py-1.5 rounded text-[10px] font-bold transition disabled:opacity-50">
                            {updatingSinco === `${r.pedido_metal}-${r.sinco_item}` ? '...' : 'Enviar SINCO'}
                        </button>
                    </td>
                </>
            )}
        </tr>
    ));

    const renderGroupedRows = () => grupos.map(g => {
        const isOpen = expandedGroups.has(g.key);
        return (
            <Fragment key={g.key}>
                {/* Group header */}
                <tr className="bg-slate-100 hover:bg-slate-200/80 cursor-pointer select-none" onClick={() => toggleGroup(g.key)}>
                    <td className="px-3 py-2.5" colSpan={4}>
                        <div className="flex items-center gap-2">
                            {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                            <span className="font-bold text-xs text-slate-800 font-mono">{groupBy === 'pedido_metal' ? 'Pedido Metal' : 'PO'}: {g.key}</span>
                            <span className="bg-slate-200 text-slate-600 font-semibold px-2 py-0.5 rounded-full text-xs ml-2">
                                {g.rows.length} {g.rows.length === 1 ? 'item' : 'itens'}
                            </span>
                        </div>
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-indigo-700 text-xs font-mono bg-indigo-50">{fmtNum(g.totalSaldo)}</td>
                    <td className="px-4 py-2.5"></td>
                    {!previewMode && (
                        <>
                            <td className="px-4 py-2.5 bg-slate-50 border-l border-slate-200"></td>
                            <td className="px-4 py-2.5 text-center">
                                <button 
                                    disabled={updatingSinco === `bulk-${g.key}` || g.rows.filter(r => r.pedido_metal && r.data_pcp_cliente).length === 0}
                                    onClick={(e) => { e.stopPropagation(); handleUpdateSincoBulk(g.rows, g.key); }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-[11px] font-bold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed">
                                    {updatingSinco === `bulk-${g.key}` ? 'Enviando...' : 'Enviar Lote ao SINCO'}
                                </button>
                            </td>
                        </>
                    )}
                </tr>

                {/* Child rows */}
                {isOpen && g.rows.map((r, i) => (
                    <tr key={`${g.key}-${i}`} className="hover:bg-indigo-50/20 transition-colors border-l-2 border-indigo-300">
                        <td className="px-4 py-2 pl-9 font-mono text-xs text-slate-500">{r.po_number || '-'}</td>
                        <td className="px-4 py-2 font-mono text-xs text-blue-700 font-semibold">{r.pedido_metal || '-'}</td>
                        <td className="px-4 py-2 text-xs text-slate-800">{r.cod_produto || '-'}</td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-600">{r.item_cliente || '-'}</td>
                        <td className="px-4 py-2 text-center font-bold text-indigo-700 text-xs font-mono bg-slate-50">{fmtNum(r.saldo)}</td>
                        <td className="px-4 py-2 text-[11px] font-bold text-slate-600">{r.data_pcp_cliente ? fmtDate(r.data_pcp_cliente) : '-'}</td>
                        {!previewMode && (
                            <>
                                <td className="px-4 py-2 text-center text-[11px] font-bold text-slate-500 bg-slate-50 border-l border-slate-200">
                                    {r.data_sinco ? fmtDate(r.data_sinco) : '-'}
                                </td>
                                <td className="px-4 py-2 text-center flex items-center justify-center gap-2">
                                    <button 
                                        disabled={!r.pedido_metal || fetchingSinco === `${g.key}-${i}`}
                                        onClick={() => handleFetchSinco(r.pedido_metal, r.po_number, r.cod_produto, `${g.key}-${i}`)}
                                        className="bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white px-2 py-1.5 rounded text-[10px] font-bold transition disabled:opacity-50">
                                        {fetchingSinco === `${g.key}-${i}` ? '...' : 'Buscar SINCO'}
                                    </button>
                                    <button 
                                        disabled={!r.data_pcp_cliente || !r.pedido_metal || !r.sinco_item || updatingSinco === `${r.pedido_metal}-${r.sinco_item}`}
                                        onClick={() => handleUpdateSinco(r.pedido_metal, r.sinco_item, r.data_pcp_cliente)}
                                        className="bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white px-2 py-1.5 rounded text-[10px] font-bold transition disabled:opacity-50">
                                        {updatingSinco === `${r.pedido_metal}-${r.sinco_item}` ? '...' : 'Enviar SINCO'}
                                    </button>
                                </td>
                            </>
                        )}
                    </tr>
                ))}
            </Fragment>
        );
    });

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className={isTab ? "space-y-6" : "p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto"}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!isTab && (
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <FileSpreadsheet className="w-7 h-7 text-indigo-600" />
                            WabTec Forecast
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Importação e gestão das datas de solicitação enviadas pela WabTec.</p>
                    </div>
                )}
                <div className="flex items-center gap-3">
                    <button onClick={handleAtualizar}
                        className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                    </button>
                    {currentData.length > 0 && !previewMode && (
                        <button 
                            onClick={() => handleUpdateSincoBulk(filteredRows, 'all')}
                            disabled={updatingSinco === 'bulk-all'}
                            className="px-4 py-2 bg-indigo-600 border border-transparent hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm disabled:opacity-50">
                            {updatingSinco === 'bulk-all' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                            Enviar Tudo ao SINCO
                        </button>
                    )}
                    {currentData.length > 0 && (
                        <button onClick={handleExportExcel}
                            className="px-3 py-2 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-700 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm">
                            <Download className="w-4 h-4" /> Exportar Excel
                        </button>
                    )}
                </div>
            </div>

            {/* Upload Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2 mb-4">
                    <FileUp className="w-4 h-4 text-indigo-500" /> Importar Estrutura de Datas WabTec
                </h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="relative flex-1 max-w-xl">
                        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange}
                            ref={fileInputRef} disabled={previewMode}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors border border-slate-200 rounded-lg bg-slate-50 disabled:opacity-50" />
                    </div>
                    {sheets.length > 0 && !previewMode && (
                        <select 
                            className="border-gray-300 rounded-lg text-sm shadow-sm p-2 bg-white disabled:opacity-50"
                            value={selectedSheet}
                            onChange={(e) => setSelectedSheet(e.target.value)}
                        >
                            {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    )}
                    {!previewMode ? (
                        <button onClick={handleUpload} disabled={!file || !selectedSheet}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            <UploadCloud className="w-4 h-4" /> Ler / Prever Dados
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
                                    : <><CheckCircle2 className="w-4 h-4" /> Confirmar e Salvar</>}
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
                            const isActive = selectedLote === l.id || (!selectedLote && lotes[0]?.id === l.id);
                            return (
                                <div key={l.id}
                                    className={`flex-shrink-0 relative text-left px-4 py-3 rounded-xl border transition text-xs shadow-sm min-w-[210px] max-w-[240px] cursor-pointer ${isActive
                                        ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'}`}
                                    onClick={() => handleSelectLote(l.id)}
                                    title={`Lote: ${l.id}`}>
                                    <button
                                        onClick={(e) => handleDeleteLote(l.id, l.file_name || 'este lote', e)}
                                        title="Excluir este lote"
                                        className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition p-0.5 rounded">
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Layers className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                                        <span className={`font-bold font-mono ${isActive ? 'text-indigo-700' : 'text-slate-700'}`}>ID: {l.id}</span>
                                    </div>
                                    <div className="text-slate-500 font-semibold truncate mb-0.5">{l.file_name}</div>
                                    <div className="flex justify-between text-[10px] text-slate-400 mt-2 border-t border-slate-200/60 pt-1.5">
                                        <span>{fmtDate(l.created_at)}</span>
                                        <span className="font-mono bg-white px-1.5 rounded text-slate-500">{l.total_rows} linhas</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Data View Controls */}
            {currentData.length > 0 && (
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Buscar por PO, Pedido, Código..."
                                value={filterText}
                                onChange={e => setFilterText(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition"
                            />
                            {filterText && (
                                <button onClick={() => setFilterText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <span className="text-sm font-medium text-slate-500">Agrupar por:</span>
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                                onClick={() => setGroupBy('flat')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${groupBy === 'flat' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                Nenhum
                            </button>
                            <button
                                onClick={() => setGroupBy('pedido')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${groupBy === 'pedido' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                PO Number
                            </button>
                            <button
                                onClick={() => setGroupBy('pedido_metal')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${groupBy === 'pedido_metal' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                Pedido Metalfisa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm relative" style={{ minHeight: '300px' }}>
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
                        <div className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 rounded-xl shadow-lg text-indigo-600 font-bold">
                            <RefreshCw className="w-5 h-5 animate-spin" /> Carregando base...
                        </div>
                    </div>
                )}
                {currentData.length === 0 && !loading ? (
                    <div className="py-20 text-center text-slate-400 flex flex-col items-center">
                        <Layers className="w-12 h-12 mb-3 text-slate-200" />
                        <p className="font-medium text-slate-500">Nenhuma demanda encontrada.</p>
                        <p className="text-sm mt-1">Selecione um lote ou importe uma nova planilha.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-2 align-top text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <div className="flex flex-col gap-1.5">
                                        <span>PO Number</span>
                                        <input type="text" placeholder="Filtrar..." value={columnFilters.po_number} onChange={e => setColumnFilters({...columnFilters, po_number: e.target.value})} className="px-2 py-1 text-[10px] border border-slate-200 rounded font-normal w-full" />
                                    </div>
                                </th>
                                <th className="px-4 py-2 align-top text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <div className="flex flex-col gap-1.5">
                                        <span>Pedido Metal</span>
                                        <input type="text" placeholder="Filtrar..." value={columnFilters.pedido_metal} onChange={e => setColumnFilters({...columnFilters, pedido_metal: e.target.value})} className="px-2 py-1 text-[10px] border border-slate-200 rounded font-normal w-full" />
                                    </div>
                                </th>
                                <th className="px-4 py-2 align-top text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <div className="flex flex-col gap-1.5">
                                        <span>Cód. Produto</span>
                                        <input type="text" placeholder="Filtrar..." value={columnFilters.cod_produto} onChange={e => setColumnFilters({...columnFilters, cod_produto: e.target.value})} className="px-2 py-1 text-[10px] border border-slate-200 rounded font-normal w-full" />
                                    </div>
                                </th>
                                <th className="px-4 py-2 align-top text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <div className="flex flex-col gap-1.5">
                                        <span>Ref. Cliente</span>
                                        <input type="text" placeholder="Filtrar..." value={columnFilters.item_cliente} onChange={e => setColumnFilters({...columnFilters, item_cliente: e.target.value})} className="px-2 py-1 text-[10px] border border-slate-200 rounded font-normal w-full" />
                                    </div>
                                </th>
                                <th className="px-4 py-2 align-top text-xs font-bold text-slate-600 uppercase tracking-wider text-center border-l border-slate-200">
                                    <div className="flex flex-col gap-1.5">
                                        <span>Saldo</span>
                                        <input type="text" placeholder="Filtrar..." value={columnFilters.saldo} onChange={e => setColumnFilters({...columnFilters, saldo: e.target.value})} className="px-2 py-1 text-[10px] border border-slate-200 rounded font-normal w-full" />
                                    </div>
                                </th>
                                <th className="px-4 py-2 align-top text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <div className="flex flex-col gap-1.5">
                                        <span>Data Planilha</span>
                                        <input type="text" placeholder="Filtrar..." value={columnFilters.data_pcp_cliente} onChange={e => setColumnFilters({...columnFilters, data_pcp_cliente: e.target.value})} className="px-2 py-1 text-[10px] border border-slate-200 rounded font-normal w-full" />
                                    </div>
                                </th>
                                {!previewMode && (
                                    <>
                                        <th className="px-4 py-2 align-top text-xs font-bold text-slate-600 uppercase tracking-wider text-center border-l border-slate-200 bg-slate-100">
                                            Data PCP
                                        </th>
                                        <th className="px-4 py-2 align-top text-xs font-bold text-slate-600 uppercase tracking-wider text-center">
                                            Ação
                                        </th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {groupBy === 'flat' ? renderFlatRows() : renderGroupedRows()}
                        </tbody>
                    </table>
                )}
            </div>

            {confirm.isOpen && (
                <ConfirmModal
                    title={confirm.title}
                    message={confirm.message}
                    onConfirm={() => {
                        if (confirm.onConfirm) confirm.onConfirm();
                        setConfirm({ ...confirm, isOpen: false });
                    }}
                    onCancel={() => setConfirm({ ...confirm, isOpen: false })}
                />
            )}
        </div>
    );
}
