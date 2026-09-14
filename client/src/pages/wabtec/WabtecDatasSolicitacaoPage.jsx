import React, { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import {
    UploadCloud, FileSpreadsheet, RefreshCw, Trash2,
    CheckCircle2, FileUp, Search, X, ChevronDown, ChevronRight, AlertCircle, Download, FileDown, Layers, XCircle, Copy
} from 'lucide-react';
import api from '../../services/api';
import * as XLSX from 'xlsx';
import ConfirmModal from '../../components/ConfirmModal';
import { toast } from 'react-toastify';

const fmtDate = (d) => {
    if (!d) return '';
    try {
        if (d instanceof Date) {
            return d.toLocaleDateString('pt-BR');
        }
        const s = String(d).split('T')[0].split(' ')[0].trim();
        if (s.length === 8 && /^\d{8}$/.test(s)) {
            return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const [y, m, day] = s.split('-');
            return `${day}/${m}/${y}`;
        }
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
            return s;
        }
        const dObj = new Date(d);
        if (!isNaN(dObj.getTime())) {
            return dObj.toLocaleDateString('pt-BR');
        }
    } catch(e) {}
    return String(d).substring(0, 10);
};

const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');

const normalizeSearch = (s) => {
    if (s === null || s === undefined) return '';
    return String(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase()
        .trim();
};

const parseExcelDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return null;
        return val.toISOString().split('T')[0];
    }
    if (typeof val === 'number') {
        // Excel serial date
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    }
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return s;
    }
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
        const dia = dmy[1].padStart(2, '0');
        const mes = dmy[2].padStart(2, '0');
        const ano = dmy[3];
        return `${ano}-${mes}-${dia}`;
    }
    return null;
};

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
    const [progress, setProgress] = useState({
        isOpen: false,
        title: '',
        status: '', // 'reading' | 'saving' | 'syncing' | 'completed' | 'error'
        currentStep: 0,
        totalSteps: 0,
        percentage: 0,
        message: '',
        errors: []
    });

    const [contextMenu, setContextMenu] = useState({
        isOpen: false,
        x: 0,
        y: 0,
        row: null,
        rowIndex: null,
        groupKey: null
    });

    useEffect(() => {
        const handleClick = () => setContextMenu(prev => ({ ...prev, isOpen: false }));
        const handleScroll = () => setContextMenu(prev => ({ ...prev, isOpen: false }));
        
        document.addEventListener('click', handleClick);
        document.addEventListener('scroll', handleScroll, true);
        
        return () => {
            document.removeEventListener('click', handleClick);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, []);

    const handleUpdateSinco = async (pedido, item, dataPlanilha, saldo) => {
        if (!pedido || !item || !dataPlanilha) {
            toast.error('Pedido, Item ou Data ausentes (Verifique o PO Number).');
            return;
        }
        setUpdatingSinco(`${pedido}-${item}`);
        try {
            const res = await api.post('/wabtec-datas/update-sinco-date', {
                pedido_metal: pedido,
                item: item,
                nova_data: dataPlanilha,
                saldo: saldo
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
        const total = rowsToUpdate.length;

        setProgress({
            isOpen: true,
            title: 'Sincronizando com SINCO',
            status: 'syncing',
            currentStep: 0,
            totalSteps: total,
            percentage: 0,
            message: `Iniciando sincronização de ${total} itens...`,
            errors: []
        });

        try {
            const updates = [];

            for (let i = 0; i < total; i++) {
                const r = rowsToUpdate[i];
                const itemNum = i + 1;
                const pct = Math.round((i / total) * 100);

                setProgress(prev => ({
                    ...prev,
                    currentStep: itemNum,
                    percentage: pct,
                    message: `[${itemNum}/${total}] Processando: PO ${r.po_number || '-'} | Pedido: ${r.pedido_metal || '-'}`
                }));

                if (!r.pedido_metal || !r.data_pcp_cliente) {
                    continue;
                }

                let currentItem = r.sinco_item;

                // Se faltar item, busca rapidamente
                if (!currentItem) {
                    try {
                        const fetchRes = await api.get('/wabtec-datas/sinco-date', {
                            params: { pedido_metal: r.pedido_metal, po_number: r.po_number, cod_produto: r.cod_produto, item_cliente: r.item_cliente }
                        });
                        if (fetchRes.data && fetchRes.data.item) {
                            currentItem = fetchRes.data.item;
                            fetchCount++;
                        }
                    } catch (e) {
                        console.error('Erro ao buscar item no SINCO:', e);
                    }
                }

                if (currentItem) {
                    updates.push({
                        pedido_metal: r.pedido_metal,
                        item: currentItem,
                        nova_data: r.data_pcp_cliente,
                        saldo: r.saldo
                    });
                }
            }

            if (updates.length > 0) {
                setProgress(prev => ({
                    ...prev,
                    message: `Enviando ${updates.length} itens validados para o banco de dados...`
                }));
                const bulkRes = await api.post('/wabtec-datas/update-sinco-date-bulk', {
                    updates,
                    usuario: 'Wabtec Datas Bulk'
                });
                successCount = bulkRes.data?.successCount || updates.length;
            }

            setProgress(prev => ({
                ...prev,
                currentStep: total,
                status: 'completed',
                percentage: 100,
                message: `Sincronização concluída! ${successCount} de ${total} itens sincronizados.`
            }));

            if (successCount > 0) {
                toast.success(`${successCount} itens enviados ao SINCO em lote com sucesso! (Buscados: ${fetchCount})`);
                if (selectedLote) fetchData(selectedLote);
            } else {
                toast.warning('Nenhum item válido foi processado no lote.');
            }
        } catch (err) {
            setProgress(prev => ({
                ...prev,
                status: 'error',
                message: 'Falha durante o processo de envio em lote.',
                errors: [err.message || 'Erro desconhecido']
            }));
            toast.error('Erro geral ao processar lote.');
        } finally {
            setUpdatingSinco(null);
        }
    };

    const handleFetchSinco = async (pedido, po_number, cod_produto, item_cliente, index) => {
        if (!pedido) {
            toast.error('Pedido Metalfisa ausente.');
            return;
        }
        setFetchingSinco(index);
        try {
            const res = await api.get('/wabtec-datas/sinco-date', {
                params: { pedido_metal: pedido, po_number: po_number, cod_produto: cod_produto, item_cliente: item_cliente }
            });
            
            // Update the specific row in the frontend state
            if (res.data.item) {
                toast.success(`Item ${res.data.item} localizado no Protheus/SINCO!`);
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

        setProgress({
            isOpen: true,
            title: 'Analisando Planilha',
            status: 'reading',
            currentStep: 0,
            totalSteps: 4,
            percentage: 10,
            message: 'Carregando arquivo na memória...',
            errors: []
        });

        setTimeout(() => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                setProgress(prev => ({ ...prev, currentStep: 1, percentage: 30, message: 'Processando estrutura da planilha...' }));
                
                setTimeout(() => {
                    try {
                        const bstr = evt.target.result;
                        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                        
                        setProgress(prev => ({ ...prev, currentStep: 2, percentage: 60, message: `Lendo aba "${selectedSheet}"...` }));
                        
                        setTimeout(() => {
                            const ws = wb.Sheets[selectedSheet];
                            const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
                            
                            if (rawData.length < 2) {
                                setProgress({ isOpen: false });
                                toast.warning('A aba parece estar vazia.');
                                return;
                            }

                            setProgress(prev => ({ ...prev, currentStep: 3, percentage: 80, message: `Mapeando ${rawData.length - 1} linhas de dados...` }));

                            setTimeout(() => {
                                const headers = rawData[0] || [];
                                const normHeaders = headers.map(h => normalizeSearch(h));

                                // Localizador inteligente de índice por palavras-chave com fallback
                                const findCol = (keywords, fallback) => {
                                    const normKeywords = keywords.map(k => normalizeSearch(k));
                                    const found = normHeaders.findIndex(h => normKeywords.some(k => h === k || h.includes(k) || k.includes(h)));
                                    return found !== -1 ? found : fallback;
                                };

                                const colPo = findCol(['numeropo', 'ponumber', 'po', 'pedidocliente'], 1);
                                const colItemCliente = findCol(['numerodeitem', 'itemcliente', 'partnumber'], 2);
                                const colSincoDate = findCol(['sinco', 'datapcp', 'necessariopordata', 'dataentrega'], 9); // Col J ("SINCO")
                                const colPedidoMetal = findCol(['pedido', 'pedidometal', 'numpedido'], 12); // Col M ("PEDIDO")
                                const colCodProduto = findCol(['cod', 'codproduto', 'produto', 'codigoproduto'], 13); // Col N ("COD")
                                const colSaldo = findCol(['saldo', 'quantidadeaberta', 'qtdtotal'], 14); // Col O ("SALDO")

                                const parsedRows = [];

                                for (let i = 1; i < rawData.length; i++) {
                                    const row = rawData[i];
                                    if (!row || row.length === 0) continue;
                                    const hasData = row.some(cell => cell !== null && cell !== '');
                                    if (!hasData) continue;

                                    const rawSincoDate = row[colSincoDate];
                                    // Se Col J estiver vazia, tenta Col 10 (Necessario por Data)
                                    const parsedDate = parseExcelDate(rawSincoDate) || (row[10] ? parseExcelDate(row[10]) : null);

                                    const mappedRow = {
                                        po_number: String(row[colPo] || '').trim(),
                                        pedido_metal: String(row[colPedidoMetal] || '').trim(),
                                        cod_produto: String(row[colCodProduto] || '').trim(),
                                        saldo: Number(row[colSaldo]) || 0,
                                        item_cliente: String(row[colItemCliente] || '').trim(),
                                        data_pcp_cliente: parsedDate,
                                        raw_data: {}
                                    };

                                    headers.forEach((header, index) => {
                                        if (header) {
                                            mappedRow.raw_data[header] = row[index];
                                        }
                                    });

                                    parsedRows.push(mappedRow);
                                }

                                setPreviewData(parsedRows);
                                setPreviewMode(true);
                                
                                setProgress({
                                    isOpen: true,
                                    title: 'Planilha Analisada',
                                    status: 'completed',
                                    currentStep: 4,
                                    totalSteps: 4,
                                    percentage: 100,
                                    message: `Sucesso! ${parsedRows.length} linhas carregadas para pré-visualização.`,
                                    errors: []
                                });
                                toast.success('Planilha analisada com sucesso!');
                            }, 300);
                        }, 300);
                    } catch (err) {
                        console.error(err);
                        setProgress(prev => ({
                            ...prev,
                            status: 'error',
                            message: 'Falha ao processar arquivo.',
                            errors: [err.message]
                        }));
                        toast.error('Erro ao processar planilha.');
                    }
                }, 300);
            };
            reader.readAsBinaryString(file);
        }, 300);
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
        
        setProgress({
            isOpen: true,
            title: 'Salvando Importação',
            status: 'saving',
            currentStep: 0,
            totalSteps: 3,
            percentage: 20,
            message: 'Preparando lote de dados...',
            errors: []
        });

        try {
            const payload = {
                fileName: file.name,
                sheetName: selectedSheet,
                rows: previewData,
                importedBy: 'Usuário WabTec'
            };

            setProgress(prev => ({ ...prev, currentStep: 1, percentage: 50, message: 'Enviando ao servidor e gravando registros...' }));

            const res = await api.post('/wabtec-datas/import', payload);
            if (res.data.success) {
                setProgress(prev => ({ 
                    ...prev, 
                    currentStep: 3, 
                    status: 'completed',
                    percentage: 100, 
                    message: `Lote gravado com sucesso! ${res.data.message}` 
                }));
                toast.success(res.data.message);
                handleCancelPreview();
                await fetchLotes();
                handleSelectLote(res.data.importId); // Select the newly imported batch
            }
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'Erro ao gravar os dados.';
            setProgress(prev => ({
                ...prev,
                status: 'error',
                message: 'Falha ao salvar no banco de dados.',
                errors: [errorMsg]
            }));
            toast.error(errorMsg);
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

    // Apply text filter with robust normalization (ignoring accents, special chars and extra spaces)
    const filteredRows = useMemo(() => {
        let result = currentData;
        if (filterText.trim()) {
            const normFilter = normalizeSearch(filterText);
            result = result.filter(r =>
                normalizeSearch(r.po_number).includes(normFilter) ||
                normalizeSearch(r.pedido_metal).includes(normFilter) ||
                normalizeSearch(r.cod_produto).includes(normFilter) ||
                normalizeSearch(r.item_cliente).includes(normFilter) ||
                normalizeSearch(r.saldo).includes(normFilter) ||
                (r.data_pcp_cliente && normalizeSearch(fmtDate(r.data_pcp_cliente)).includes(normFilter)) ||
                (r.data_sinco && normalizeSearch(fmtDate(r.data_sinco)).includes(normFilter))
            );
        }
        Object.keys(columnFilters).forEach(key => {
            if (columnFilters[key].trim()) {
                const normColFilter = normalizeSearch(columnFilters[key]);
                result = result.filter(r => {
                    const rawVal = key === 'data_pcp_cliente' && r[key] 
                        ? fmtDate(r[key]) 
                        : (key === 'data_sinco' && r[key] ? fmtDate(r[key]) : String(r[key] || ''));
                    return normalizeSearch(rawVal).includes(normColFilter);
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
    const handleContextMenu = (e, row, rowIndex, groupKey = null) => {
        e.preventDefault();
        setContextMenu({
            isOpen: true,
            x: e.clientX,
            y: e.clientY,
            row,
            rowIndex,
            groupKey
        });
    };

    const renderContextMenu = () => {
        if (!contextMenu.isOpen || !contextMenu.row) return null;
        
        const { x, y, row, rowIndex, groupKey } = contextMenu;
        const isGroupChild = groupKey !== null;
        const fetchId = isGroupChild ? `${groupKey}-${rowIndex}` : rowIndex;

        const copyToClipboard = (text, label) => {
            navigator.clipboard.writeText(text);
            toast.info(`${label} copiado!`);
            setContextMenu(prev => ({ ...prev, isOpen: false }));
        };

        return (
            <div 
                className="fixed z-[1000] bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-2xl py-2 w-64 text-sm font-medium transition-all"
                style={{ top: Math.min(y, window.innerHeight - 300), left: Math.min(x, window.innerWidth - 250) }}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
            >
                <div className="px-3 pb-2 mb-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Ações da Linha</span>
                </div>
                
                <button 
                    disabled={!row.pedido_metal || fetchingSinco === fetchId}
                    onClick={() => {
                        handleFetchSinco(row.pedido_metal, row.po_number, row.cod_produto, row.item_cliente, fetchId);
                        setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Search className="w-4 h-4 text-slate-400" /> 
                    {fetchingSinco === fetchId ? 'Buscando...' : 'Buscar Item no SINCO'}
                </button>

                <button 
                    disabled={!row.data_pcp_cliente || !row.pedido_metal || !row.sinco_item || updatingSinco === `${row.pedido_metal}-${row.sinco_item}`}
                    onClick={() => {
                        handleUpdateSinco(row.pedido_metal, row.sinco_item, row.data_pcp_cliente, row.saldo);
                        setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                    {updatingSinco === `${row.pedido_metal}-${row.sinco_item}` ? 'Enviando...' : 'Sincronizar Data (SINCO)'}
                </button>

                <div className="px-3 pt-2 mt-2 mb-1 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Copiar Dados</span>
                </div>
                
                <button onClick={() => copyToClipboard(row.po_number || '', 'PO Number')} className="w-full text-left px-4 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-600">
                    <Copy className="w-3.5 h-3.5 text-slate-400" /> PO Number
                </button>
                <button onClick={() => copyToClipboard(row.pedido_metal || '', 'Pedido Metalfisa')} className="w-full text-left px-4 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-600">
                    <Copy className="w-3.5 h-3.5 text-slate-400" /> Pedido Metalfisa
                </button>
                <button onClick={() => copyToClipboard(row.cod_produto || '', 'Código Produto')} className="w-full text-left px-4 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-600">
                    <Copy className="w-3.5 h-3.5 text-slate-400" /> Código Produto
                </button>
                <button onClick={() => copyToClipboard(row.item_cliente || '', 'Ref. Cliente')} className="w-full text-left px-4 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-600">
                    <Copy className="w-3.5 h-3.5 text-slate-400" /> Ref. Cliente
                </button>

                {row.sinco_item && (
                    <>
                        <div className="px-3 pt-2 mt-2 mb-1 border-t border-slate-100">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Informações SINCO</span>
                        </div>
                        <div className="px-4 py-1.5 text-xs text-slate-600 bg-slate-50/50 flex flex-col gap-1 rounded mx-2">
                            <div className="flex justify-between"><span className="font-semibold">Item ERP:</span> <span className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded border border-indigo-100">{row.sinco_item}</span></div>
                            <div className="flex justify-between"><span className="font-semibold">Data ERP:</span> <span className="font-mono">{row.data_sinco ? fmtDate(row.data_sinco) : '-'}</span></div>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const renderFlatRows = () => filteredRows.map((r, i) => (
        <tr 
            key={i} 
            className="hover:bg-indigo-50/30 transition-colors"
            onContextMenu={(e) => handleContextMenu(e, r, i)}
        >
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
                            onClick={() => handleFetchSinco(r.pedido_metal, r.po_number, r.cod_produto, r.item_cliente, i)}
                            className="bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white px-2 py-1.5 rounded text-[10px] font-bold transition disabled:opacity-50">
                            {fetchingSinco === i ? '...' : 'Buscar SINCO'}
                        </button>
                        <button 
                            disabled={!r.data_pcp_cliente || !r.pedido_metal || !r.sinco_item || updatingSinco === `${r.pedido_metal}-${r.sinco_item}`}
                            onClick={() => handleUpdateSinco(r.pedido_metal, r.sinco_item, r.data_pcp_cliente, r.saldo)}
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
                    <tr 
                        key={`${g.key}-${i}`} 
                        className="hover:bg-indigo-50/20 transition-colors border-l-2 border-indigo-300"
                        onContextMenu={(e) => handleContextMenu(e, r, i, g.key)}
                    >
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
                                        onClick={() => handleFetchSinco(r.pedido_metal, r.po_number, r.cod_produto, r.item_cliente, `${g.key}-${i}`)}
                                        className="bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white px-2 py-1.5 rounded text-[10px] font-bold transition disabled:opacity-50">
                                        {fetchingSinco === `${g.key}-${i}` ? '...' : 'Buscar SINCO'}
                                    </button>
                                    <button 
                                        disabled={!r.data_pcp_cliente || !r.pedido_metal || !r.sinco_item || updatingSinco === `${r.pedido_metal}-${r.sinco_item}`}
                                        onClick={() => handleUpdateSinco(r.pedido_metal, r.sinco_item, r.data_pcp_cliente, r.saldo)}
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
        <div className={isTab ? "space-y-3" : "w-full px-2 sm:px-4 py-2 space-y-3"}>
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
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[350px] border border-slate-200 rounded-xl bg-white shadow-sm relative">
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
                                        <span>Data Planilha (Col J)</span>
                                        <input type="text" placeholder="Filtrar..." value={columnFilters.data_pcp_cliente} onChange={e => setColumnFilters({...columnFilters, data_pcp_cliente: e.target.value})} className="px-2 py-1 text-[10px] border border-slate-200 rounded font-normal w-full" />
                                    </div>
                                </th>
                                {!previewMode && (
                                    <>
                                        <th className="px-4 py-2 align-top text-xs font-bold text-slate-600 uppercase tracking-wider text-center border-l border-slate-200 bg-slate-100">
                                            Data Atual SINCO
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

            {/* Progress Modal */}
            {progress.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-6 transform transition-all">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                {progress.status === 'reading' && <FileSpreadsheet className="w-5 h-5 text-indigo-500 animate-pulse" />}
                                {progress.status === 'saving' && <UploadCloud className="w-5 h-5 text-indigo-500 animate-bounce" />}
                                {progress.status === 'syncing' && <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />}
                                {progress.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                {progress.status === 'error' && <XCircle className="w-5 h-5 text-rose-500" />}
                                {progress.title}
                            </h3>
                            {['completed', 'error'].includes(progress.status) && (
                                <button 
                                    onClick={() => setProgress(prev => ({ ...prev, isOpen: false }))} 
                                    className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {/* Progress Body */}
                        <div className="space-y-4">
                            {/* Loader or Status Indicator */}
                            <div className="flex flex-col items-center justify-center py-4 text-center space-y-3">
                                {['reading', 'saving', 'syncing'].includes(progress.status) ? (
                                    <div className="relative w-24 h-24 flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                                        <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                                        <span className="text-sm font-bold font-mono text-slate-700">{progress.percentage}%</span>
                                    </div>
                                ) : progress.status === 'completed' ? (
                                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500">
                                        <CheckCircle2 className="w-10 h-10" />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
                                        <XCircle className="w-10 h-10" />
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-slate-500">{progress.message}</p>
                                    {progress.totalSteps > 0 && ['reading', 'saving', 'syncing'].includes(progress.status) && (
                                        <p className="text-xs text-slate-400 font-mono">Etapa {progress.currentStep} de {progress.totalSteps}</p>
                                    )}
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-300 ${
                                        progress.status === 'error' 
                                            ? 'bg-rose-500' 
                                            : progress.status === 'completed' 
                                                ? 'bg-emerald-500' 
                                                : 'bg-indigo-600'
                                    }`}
                                    style={{ width: `${progress.percentage}%` }}
                                />
                            </div>

                            {/* Error Log */}
                            {progress.errors.length > 0 && (
                                <div className="bg-rose-50 text-rose-800 p-3 rounded-lg text-xs space-y-1 border border-rose-100 max-h-32 overflow-y-auto">
                                    <p className="font-bold flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5" /> Erros detectados:
                                    </p>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                        {progress.errors.map((err, idx) => (
                                            <li key={idx} className="font-mono">{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end pt-3 border-t border-slate-100">
                            {['completed', 'error'].includes(progress.status) ? (
                                <button 
                                    onClick={() => setProgress(prev => ({ ...prev, isOpen: false }))}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold shadow-sm transition"
                                >
                                    Fechar
                                </button>
                            ) : (
                                <span className="text-xs text-slate-400 font-medium italic animate-pulse">Aguarde, processando dados...</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Context Menu Render */}
            {renderContextMenu()}
        </div>
    );
}
