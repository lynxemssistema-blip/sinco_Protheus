import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import {
    UploadCloud, FileSpreadsheet, RefreshCw, Layers, Trash2,
    CheckCircle2, FileUp, Search, X, ChevronDown, ChevronRight, AlertCircle, Download, XCircle, FileDown, ClipboardList, FileText
} from 'lucide-react';
import { api, getFileUrl } from '../../services/api';
import * as XLSX from 'xlsx';
import ConfirmModal from '../../components/ConfirmModal';
import VMIBomModal from './VMIBomModal';
import VMIOpMirrorModal from './VMIOpMirrorModal';

const fmtDate = (d) => d
    ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');

const TypeBadge = ({ type, detail }) => {
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
            {String(type || 'PCP').toUpperCase()}
        </span>
    );
};

export default function DemandaVMIPage({ isTab = false }) {
    // ── Upload ────────────────────────────────────────────────────────────────
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [importMeta, setImportMeta] = useState(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [previewMeses, setPreviewMeses] = useState([]);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);

    // ── Data ──────────────────────────────────────────────────────────────────
    const [data, setData] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [selectedLote, setSelectedLote] = useState(null);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ msg: '', type: 'ok' });
    const [mapeamentos, setMapeamentos] = useState({});

    // ── View ──────────────────────────────────────────────────────────────────
    const [filterText, setFilterText] = useState('');
    const [groupBy, setGroupBy] = useState('flat'); // 'flat' | 'produto_pai' | 'pedido'
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [bomModal, setBomModal] = useState(null); // modo único: { codigo_cliente, descricao_cliente, b1_cod, totalQty }
    const [bomModalMulti, setBomModalMulti] = useState(null); // modo multi: { produtos: [...], titulo }
    const [openBomDropdown, setOpenBomDropdown] = useState(null); // key do grupo com dropdown aberto
    const [opMirrorModal, setOpMirrorModal] = useState(null); // { b1cod, label, defaultQty }

    const showToast = (msg, type = 'ok') => {
        setToast({ msg, type });
        setTimeout(() => setToast({ msg: '', type: 'ok' }), 4500);
    };

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchLotes = async () => {
        try {
            const res = await api.get('/vmi/lotes');
            setLotes(res.data.data || []);
        } catch (err) {
            console.error('Erro ao buscar lotes:', err);
        }
    };

    const fetchData = async (lote = null) => {
        setLoading(true);
        try {
            const url = lote ? `/vmi/demandas?lote=${lote}` : '/vmi/demandas';
            const res = await api.get(url);
            setData(res.data.data || []);
        } catch (err) {
            console.error('Erro ao buscar demandas:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMappings = async () => {
        try {
            const res = await api.get('/vmi/mapeamento/atual');
            const map = {};
            (res.data.data || []).forEach(m => { map[m.codigo_produto_cliente] = m; });
            setMapeamentos(map);
        } catch (err) {
            console.error('Erro ao buscar mapeamentos:', err);
        }
    };

    useEffect(() => {
        fetchLotes(); // Carrega os cards de importações, mas não os dados da tabela
    }, []);

    const handleAtualizar = () => {
        fetchLotes();
        if (selectedLote) fetchData(selectedLote);
        else fetchData();
        fetchMappings();
    };

    const handleSelectLote = (loteId) => {
        setSelectedLote(loteId);
        setFilterText('');
        setGroupBy('flat');
        fetchData(loteId);
        fetchMappings();
    };

    // Lote atualmente ativo (para passar nome_arquivo e data ao Espelho OP)
    const loteAtivo = useMemo(() => {
        if (!lotes.length) return null;
        if (selectedLote) return lotes.find(l => l.lote_id === selectedLote) || lotes[0];
        return lotes[0];
    }, [lotes, selectedLote]);

    // ── Upload handlers ───────────────────────────────────────────────────────
    const handleFileChange = (e) => {
        if (e.target.files?.[0]) setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post('/vmi/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast(res.data.msg || 'Planilha processada!');
            setPreviewData(res.data.preview_data || []);
            setPreviewMeses(res.data.meses || []);
            setImportMeta(res.data._import_meta || null);
            setPreviewMode(true);
        } catch (err) {
            const data = err.response?.data || {};
            const errMsg = data.error || 'Erro de conexão ao enviar o arquivo.';
            const tipo = data.duplicado ? 'warning' : 'error';
            if (data.modelo_invalido) {
                // Exibe alerta detalhado para planilha fora do modelo
                alert(`⚠️ Planilha com formato inválido!\n\n${errMsg}`);
            } else {
                showToast(errMsg, tipo);
            }
        } finally {
            setUploading(false);
        }
    };

    const handleCancelPreview = () => {
        setPreviewMode(false);
        setPreviewData([]);
        setPreviewMeses([]);
        setImportMeta(null);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDownloadModelo = async () => {
        try {
            const res = await api.get('/vmi/modelo', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Modelo_Demanda_VMI.xlsx');
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
            const res = await api.post('/vmi/save-lote', {
                records: previewData,
                _import_meta: importMeta
            });
            showToast(res.data.msg);
            handleCancelPreview();
            await fetchLotes();
            await fetchData();
        } catch {
            showToast('Erro ao gravar os dados aprovados.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleClearAll = () => {
        setConfirm({
            isOpen: true,
            title: 'Limpar Todas as Demandas',
            message: 'Tem certeza que deseja limpar TODAS as demandas cadastradas? Esta ação não pode ser desfeita.',
            onConfirm: async () => {
                try {
                    await api.delete('/vmi/all');
                    showToast('Dados limpos com sucesso.');
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
            message: `Tem certeza que deseja excluir a importação "${nomeArquivo}"? Todos os dados deste lote serão removidos permanentemente.`,
            onConfirm: async () => {
                try {
                    await api.delete(`/vmi/lotes/${loteId}`);
                    showToast('Lote removido.');
                    const novosLotes = lotes.filter(l => l.lote_id !== loteId);
                    setLotes(novosLotes);
                    if (selectedLote === loteId) {
                        setSelectedLote(null);
                        setData([]);
                    }
                } catch {
                    showToast('Erro ao remover lote.', 'error');
                }
            }
        });
    };

    // ── Derived data (memoized) ───────────────────────────────────────────────
    const MONTH_ORDER = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const meses = useMemo(() => {
        const unique = [...new Set(data.map(d => d.mes_referencia))];
        return unique.sort((a, b) => {
            const ia = MONTH_ORDER.indexOf(a);
            const ib = MONTH_ORDER.indexOf(b);
            if (ia !== -1 && ib !== -1) return ia - ib;
            return a.localeCompare(b);
        });
    }, [data]);

    // Pivot: one row per (pedido × produto)
    const rows = useMemo(() => {
        const map = {};
        data.forEach(d => {
            const key = `${d.ordem_compra_cliente}||${d.codigo_produto_cliente}`;
            if (!map[key]) {
                map[key] = {
                    ordem_compra_cliente: d.ordem_compra_cliente,
                    produto_pai: d.produto_pai,
                    descricao_equipamento: d.descricao_equipamento,
                    codigo_produto_cliente: d.codigo_produto_cliente,
                    descricao_produto_cliente: d.descricao_produto_cliente,
                    rev_cliente: d.rev_cliente,
                    status_tipo_item: d.status_tipo_item,
                    status_tipo_detalhe: d.status_tipo_detalhe,
                    b1_cod: d.b1_cod || null,
                    b1_desc: d.b1_desc || null,
                    b1_cod_pai: d.b1_cod_pai || null,
                    meses: {}
                };
            }
            // Atualiza b1_cod / b1_cod_pai se ainda não tiver
            if (!map[key].b1_cod && d.b1_cod) {
                map[key].b1_cod = d.b1_cod;
                map[key].b1_desc = d.b1_desc || null;
            }
            if (!map[key].b1_cod_pai && d.b1_cod_pai) {
                map[key].b1_cod_pai = d.b1_cod_pai;
            }
            map[key].meses[d.mes_referencia] = (map[key].meses[d.mes_referencia] || 0) + Number(d.quantidade);
        });
        return Object.values(map);
    }, [data]);

    // Apply text filter
    const filteredRows = useMemo(() => {
        if (!filterText.trim()) return rows;
        const s = filterText.toLowerCase();
        return rows.filter(r =>
            r.codigo_produto_cliente?.toLowerCase().includes(s) ||
            r.descricao_produto_cliente?.toLowerCase().includes(s) ||
            r.ordem_compra_cliente?.toLowerCase().includes(s) ||
            r.produto_pai?.toLowerCase().includes(s) ||
            r.descricao_equipamento?.toLowerCase().includes(s)
        );
    }, [rows, filterText]);

    // Build groups
    const grupos = useMemo(() => {
        if (groupBy === 'flat') return null;
        const map = {};
        filteredRows.forEach(r => {
            const key = groupBy === 'produto_pai'
                ? (r.produto_pai || '—')
                : r.ordem_compra_cliente;
            if (!map[key]) {
                // Para produto_pai: busca cód. Protheus do produto pai via mapeamentos
                // b1_cod_pai vem direto do backend (enriquecido via app_demanda_vmi_map pelo produto_pai)
                const b1CodPai = (groupBy === 'produto_pai' && key !== '—')
                    ? (r.b1_cod_pai || null)
                    : null;
                map[key] = {
                    key,
                    label: groupBy === 'produto_pai'
                        ? (r.descricao_equipamento || r.produto_pai || '—')
                        : r.ordem_compra_cliente,
                    rows: [],
                    totalMeses: {},
                    totalQtd: 0,
                    b1CodPai
                };
            }
            map[key].rows.push(r);
            // Propaga b1_cod_pai caso a primeira row não tivesse ainda
            if (groupBy === 'produto_pai' && !map[key].b1CodPai && r.b1_cod_pai) {
                map[key].b1CodPai = r.b1_cod_pai;
            }
            if (groupBy === 'produto_pai') {
                // Lógica de mínimo: o componente com menor quantidade limita o produto pai
                meses.forEach(m => {
                    const q = r.meses[m] || 0;
                    if (q > 0) {
                        map[key].totalMeses[m] = map[key].totalMeses[m] === undefined
                            ? q
                            : Math.min(map[key].totalMeses[m], q);
                    }
                });
            } else {
                meses.forEach(m => {
                    const q = r.meses[m] || 0;
                    map[key].totalMeses[m] = (map[key].totalMeses[m] || 0) + q;
                    map[key].totalQtd += q;
                });
            }
        });
        // Para produto_pai: finaliza totalQtd a partir dos mínimos calculados
        if (groupBy === 'produto_pai') {
            Object.values(map).forEach(g => {
                g.totalQtd = meses.reduce((s, m) => s + (g.totalMeses[m] || 0), 0);
            });
        }
        return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
    }, [filteredRows, groupBy, meses, mapeamentos]);

    // Auto-expand all when grouping changes
    useEffect(() => {
        if (grupos) setExpandedGroups(new Set(grupos.map(g => g.key)));
    }, [grupos]);

    const toggleGroup = (key) => setExpandedGroups(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });

    const toggleAllGroups = () => {
        if (!grupos) return;
        setExpandedGroups(expandedGroups.size === grupos.length
            ? new Set()
            : new Set(grupos.map(g => g.key)));
    };

    // Summary stats
    const stats = useMemo(() => {
        const totalQtd = filteredRows.reduce((s, r) =>
            s + Object.values(r.meses).reduce((a, b) => a + b, 0), 0);
        return {
            itens: filteredRows.length,
            uniqueProds: new Set(filteredRows.map(r => r.codigo_produto_cliente)).size,
            uniqueOrders: new Set(filteredRows.map(r => r.ordem_compra_cliente)).size,
            totalQtd
        };
    }, [filteredRows]);

    // ── Export Excel (3 abas) ─────────────────────────────────────────────────
    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        const date = new Date().toISOString().slice(0, 10);

        const addSheet = (name, sheetRows) => {
            const ws = XLSX.utils.json_to_sheet(sheetRows);
            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
            // Header style
            for (let c = range.s.c; c <= range.e.c; c++) {
                const cell = XLSX.utils.encode_cell({ r: 0, c });
                if (ws[cell]) ws[cell].s = {
                    font: { bold: true, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: '3730A3' } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: { bottom: { style: 'thin', color: { rgb: 'CCCCCC' } } }
                };
            }
            XLSX.utils.book_append_sheet(wb, ws, name);
        };

        // ── Aba 1: Dados Completos (formato original + colunas Protheus) ──
        const flatRows = rows.map(r => {
            const map = mapeamentos[r.codigo_produto_cliente];
            const row = {
                'Pedido Cliente':     r.ordem_compra_cliente,
                'Produto Pai':        r.produto_pai || '',
                'Equipamento':        r.descricao_equipamento || '',
                'Cód. Produto':       r.codigo_produto_cliente,
                'Descrição Produto':  r.descricao_produto_cliente || '',
                'Rev. Cliente':       r.rev_cliente || '',
                'Tipo':               r.status_tipo_item || 'PCP',
                'Cód. Protheus':      r.b1_cod || '',
                'Status Detalhe':     r.status_tipo_detalhe || '',
                'Desc. Protheus':     r.b1_desc || '',
            };
            meses.forEach(m => { row[m] = r.meses[m] || 0; });
            row['TOTAL'] = meses.reduce((s, m) => s + (r.meses[m] || 0), 0);
            return row;
        });
        addSheet('Dados Completos', flatRows);

        // ── Aba 2: Por Produto Pai ──
        const sheet2 = [];
        const grpPai = {};
        rows.forEach(r => {
            const key = r.produto_pai || '(Sem Produto Pai)';
            if (!grpPai[key]) grpPai[key] = { label: r.descricao_equipamento || key, rows: [], tot: {} };
            grpPai[key].rows.push(r);
            meses.forEach(m => { grpPai[key].tot[m] = (grpPai[key].tot[m] || 0) + (r.meses[m] || 0); });
        });
        Object.entries(grpPai).sort(([a],[b]) => a.localeCompare(b)).forEach(([key, g]) => {
            // Linha de totais do grupo
            const hdr = { 'Produto Pai': key, 'Equipamento': g.label, 'Cód. Produto': '', 'Descrição': '', 'Rev.': '', 'Tipo': '', 'Cód. Protheus': '', 'Desc. Protheus': '' };
            meses.forEach(m => { hdr[m] = g.tot[m] || 0; });
            hdr['TOTAL'] = meses.reduce((s, m) => s + (g.tot[m] || 0), 0);
            sheet2.push(hdr);
            // Itens do grupo
            g.rows.forEach(r => {
                const row = { 
                    'Produto Pai': '', 
                    'Equipamento': '', 
                    'Cód. Produto': r.codigo_produto_cliente, 
                    'Descrição': r.descricao_produto_cliente || '', 
                    'Rev.': r.rev_cliente || '', 
                    'Tipo': r.status_tipo_item || 'PCP',
                    'Cód. Protheus': r.b1_cod || '', 
                    'Desc. Protheus': r.b1_desc || '' 
                };
                meses.forEach(m => { row[m] = r.meses[m] || 0; });
                row['TOTAL'] = meses.reduce((s, m) => s + (r.meses[m] || 0), 0);
                sheet2.push(row);
            });
        });
        addSheet('Por Produto Pai', sheet2);

        // ── Aba 3: Por Pedido ──
        const sheet3 = [];
        const grpPed = {};
        rows.forEach(r => {
            const key = r.ordem_compra_cliente;
            if (!grpPed[key]) grpPed[key] = { rows: [], tot: {} };
            grpPed[key].rows.push(r);
            meses.forEach(m => { grpPed[key].tot[m] = (grpPed[key].tot[m] || 0) + (r.meses[m] || 0); });
        });
        Object.entries(grpPed).sort(([a],[b]) => a.localeCompare(b)).forEach(([key, g]) => {
            const hdr = { 'Pedido': key, 'Produto Pai': '', 'Cód. Produto': '', 'Descrição': '', 'Rev.': '', 'Tipo': '', 'Cód. Protheus': '', 'Desc. Protheus': '' };
            meses.forEach(m => { hdr[m] = g.tot[m] || 0; });
            hdr['TOTAL'] = meses.reduce((s, m) => s + (g.tot[m] || 0), 0);
            sheet3.push(hdr);
            g.rows.forEach(r => {
                const row = { 
                    'Pedido': '', 
                    'Produto Pai': r.produto_pai || '', 
                    'Cód. Produto': r.codigo_produto_cliente, 
                    'Descrição': r.descricao_produto_cliente || '', 
                    'Rev.': r.rev_cliente || '', 
                    'Tipo': r.status_tipo_item || 'PCP',
                    'Cód. Protheus': r.b1_cod || '', 
                    'Desc. Protheus': r.b1_desc || '' 
                };
                meses.forEach(m => { row[m] = r.meses[m] || 0; });
                row['TOTAL'] = meses.reduce((s, m) => s + (r.meses[m] || 0), 0);
                sheet3.push(row);
            });
        });
        addSheet('Por Pedido', sheet3);

        XLSX.writeFile(wb, `VMI_Forecast_${date}.xlsx`, { cellStyles: true });
        showToast('Excel exportado com 3 abas!');
    };

    // ── Table row renderers ───────────────────────────────────────────────────
    const renderFlatRows = () => filteredRows.map((r, i) => {
        let rowTotal = 0;
        // Pre-compute rowTotal for BOM modal
        meses.forEach(m => { rowTotal += r.meses[m] || 0; });
        let rowTotalCell = 0;
        return (
            <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                <td className="px-4 py-2 font-mono text-xs font-bold text-slate-700">{r.ordem_compra_cliente}</td>
                <td className="px-4 py-2 font-mono text-xs text-blue-700 font-semibold">{r.codigo_produto_cliente}</td>
                <td className="px-4 py-2 text-[11px] text-slate-500 truncate max-w-[240px]" title={r.descricao_produto_cliente}>{r.descricao_produto_cliente}</td>
                <td className="px-4 py-2 text-center">
                    <TypeBadge type={r.status_tipo_item} detail={r.status_tipo_detalhe} />
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                        <span>{r.b1_cod || '-'}</span>
                        {r.b1_cod && (
                            <button
                                title="Gerar Lista de Material"
                                onClick={() => setBomModal({ codigo_cliente: r.codigo_produto_cliente, descricao_cliente: r.descricao_produto_cliente, b1_cod: r.b1_cod, totalQty: rowTotal })}
                                className="p-0.5 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 transition-colors">
                                <ClipboardList className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {r.b1_cod && (
                            <button
                                title="Espelho do Produto (PDF)"
                                onClick={() => setOpMirrorModal({ b1cod: r.b1_cod, label: r.descricao_produto_cliente, defaultQty: rowTotal })}
                                className="p-0.5 rounded hover:bg-purple-100 text-purple-400 hover:text-purple-600 transition-colors">
                                <FileText className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </td>
                <td className="px-4 py-2 text-[11px] text-slate-500 truncate max-w-[140px]" title={r.descricao_equipamento}>{r.descricao_equipamento}</td>
                <td className="px-4 py-2 text-[11px] font-bold text-slate-600">{r.rev_cliente || '-'}</td>
                <td className="px-4 py-2 text-[10px] text-slate-400 border-r border-slate-100 truncate max-w-[180px]" title={r.produto_pai}>{r.produto_pai}</td>
                {meses.map(m => {
                    const v = r.meses[m] || 0;
                    rowTotalCell += v;
                    return <td key={m} className={`px-4 py-2 text-center border-r border-slate-50 font-mono text-xs ${v > 0 ? 'font-bold text-slate-800' : 'text-slate-300'}`}>{v > 0 ? fmtNum(v) : '-'}</td>;
                })}
                <td className="px-4 py-2 text-center font-bold text-indigo-700 text-xs font-mono bg-slate-50">{fmtNum(rowTotalCell)}</td>
            </tr>
        );
    });

    const renderGroupedRows = () => grupos.map(g => {
        const isOpen = expandedGroups.has(g.key);
        const groupTotal = meses.reduce((s, m) => s + (g.totalMeses[m] || 0), 0);
        return (
            <Fragment key={g.key}>
                {/* Group header */}
                <tr
                    className="bg-slate-100 hover:bg-slate-200/80 cursor-pointer select-none"
                    onClick={() => toggleGroup(g.key)}>
                    <td className="px-3 py-2.5" colSpan={2}>
                        <div className="flex items-center gap-2">
                            {isOpen
                                ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                            <span className="font-bold text-xs text-slate-800 font-mono">{g.key}</span>
                            {g.label !== g.key && (
                                <span className="text-xs text-slate-500 truncate max-w-[220px]" title={g.label}>— {g.label}</span>
                            )}
                        </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500" colSpan={6}>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-slate-200 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                                {g.rows.length} {g.rows.length === 1 ? 'item' : 'itens'}
                            </span>
                            {groupBy === 'produto_pai' && g.b1CodPai && (
                                <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 font-mono font-bold px-2 py-0.5 rounded text-[11px]"
                                      title="Cód. Protheus do produto pai">
                                    {g.b1CodPai}
                                </span>
                            )}
                            {groupBy === 'produto_pai' && (
                                <span className="text-[10px] text-slate-400 italic" title="Qtd. = mínimo entre componentes (peça limitante)">
                                    ⚡ qtd. limitante
                                </span>
                            )}
                            {groupBy === 'produto_pai' && (
                                <div className="relative" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => setOpenBomDropdown(openBomDropdown === g.key ? null : g.key)}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-semibold hover:bg-indigo-700 transition">
                                        <ClipboardList className="w-3 h-3" />
                                        Lista de Material
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                    {openBomDropdown === g.key && (
                                        <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[220px] overflow-hidden">
                                            {g.b1CodPai && (
                                                <button
                                                    onClick={() => { setOpenBomDropdown(null); setBomModal({ codigo_cliente: g.key, descricao_cliente: g.label, b1_cod: g.b1CodPai, totalQty: groupTotal }); }}
                                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-indigo-50 flex flex-col gap-0.5">
                                                    <span className="font-semibold text-slate-800">BOM do Produto Pai</span>
                                                    <span className="text-slate-400">Estrutura de <span className="font-mono text-indigo-600">{g.b1CodPai}</span> × {fmtNum(groupTotal)}</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setOpenBomDropdown(null);
                                                    // Consolida todos os componentes do grupo com suas qtds individuais
                                                    const produtos = g.rows
                                                        .filter(r => r.b1_cod)
                                                        .map(r => ({
                                                            b1_cod: r.b1_cod,
                                                            label: r.descricao_produto_cliente || r.codigo_produto_cliente,
                                                            qty: meses.reduce((s, m) => s + (r.meses[m] || 0), 0)
                                                        }));
                                                    setBomModalMulti({ produtos, titulo: `BOM Consolidado — ${g.label || g.key}` });
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-indigo-50 flex flex-col gap-0.5 border-t border-slate-100">
                                                <span className="font-semibold text-slate-800">BOM Consolidado dos Componentes</span>
                                                <span className="text-slate-400">Explode e consolida {g.rows.filter(r => r.b1_cod).length} componentes mapeados</span>
                                            </button>
                                            {g.b1CodPai && (
                                                <button
                                                    onClick={() => {
                                                        setOpenBomDropdown(null);
                                                        setOpMirrorModal({ b1cod: g.b1CodPai, label: g.label || g.key, defaultQty: groupTotal });
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-purple-50 flex flex-col gap-0.5 border-t border-slate-100">
                                                    <span className="font-semibold text-slate-800">Espelho do Produto</span>
                                                    <span className="text-slate-400">Roteiro de produção de <span className="font-mono text-purple-600">{g.b1CodPai}</span></span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </td>
                    {meses.map(m => (
                        <td key={m} className="px-4 py-2.5 text-center font-mono text-xs font-bold text-slate-700 border-r border-slate-200">
                            {(g.totalMeses[m] || 0) > 0 ? fmtNum(g.totalMeses[m]) : <span className="text-slate-300">-</span>}
                        </td>
                    ))}
                    <td className="px-4 py-2.5 text-center font-bold text-indigo-700 text-xs font-mono bg-indigo-50">{fmtNum(groupTotal)}</td>
                </tr>

                {/* Child rows */}
                {isOpen && g.rows.map((r, i) => {
                    let rowTotal = 0;
                    return (
                        <tr key={`${g.key}-${i}`} className="hover:bg-indigo-50/20 transition-colors border-l-2 border-indigo-300">
                            <td className="px-4 py-2 pl-9 font-mono text-xs text-slate-500">
                                {groupBy === 'produto_pai' ? r.ordem_compra_cliente : (r.produto_pai || '—')}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-blue-700 font-semibold">{r.codigo_produto_cliente}</td>
                            <td className="px-4 py-2 text-[11px] text-slate-500 truncate max-w-[240px]" title={r.descricao_produto_cliente}>{r.descricao_produto_cliente}</td>
                            <td className="px-4 py-2 text-center">
                                <TypeBadge type={r.status_tipo_item} detail={r.status_tipo_detalhe} />
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-slate-600">
                                <div className="flex items-center gap-1.5">
                                    <span>{r.b1_cod || '-'}</span>
                                    {r.b1_cod && (() => {
                                        const qty = meses.reduce((s, m) => s + (r.meses[m] || 0), 0);
                                        return (<>
                                            <button
                                                title="Gerar Lista de Material"
                                                onClick={() => setBomModal({ codigo_cliente: r.codigo_produto_cliente, descricao_cliente: r.descricao_produto_cliente, b1_cod: r.b1_cod, totalQty: qty })}
                                                className="p-0.5 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 transition-colors">
                                                <ClipboardList className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                title="Espelho do Produto (PDF)"
                                                onClick={() => setOpMirrorModal({ b1cod: r.b1_cod, label: r.descricao_produto_cliente, defaultQty: qty })}
                                                className="p-0.5 rounded hover:bg-purple-100 text-purple-400 hover:text-purple-600 transition-colors">
                                                <FileText className="w-3.5 h-3.5" />
                                            </button>
                                        </>);
                                    })()}
                                </div>
                            </td>
                            <td className="px-4 py-2 text-[11px] text-slate-500 truncate max-w-[140px]" title={r.descricao_equipamento}>{r.descricao_equipamento}</td>
                            <td className="px-4 py-2 text-[11px] font-bold text-slate-600">{r.rev_cliente || '-'}</td>
                            <td className="px-4 py-2 text-[10px] text-slate-400 border-r border-slate-100 truncate max-w-[180px]">
                                {groupBy === 'produto_pai' ? '' : r.produto_pai}
                            </td>
                            {meses.map(m => {
                                const v = r.meses[m] || 0;
                                rowTotal += v;
                                return <td key={m} className={`px-4 py-2 text-center border-r border-slate-50 font-mono text-xs ${v > 0 ? 'font-bold text-slate-800' : 'text-slate-300'}`}>{v > 0 ? fmtNum(v) : '-'}</td>;
                            })}
                            <td className="px-4 py-2 text-center font-bold text-indigo-700 text-xs font-mono bg-slate-50">{fmtNum(rowTotal)}</td>
                        </tr>
                    );
                })}
            </Fragment>
        );
    });

    // ── Toast color ───────────────────────────────────────────────────────────
    const toastBg = { ok: 'bg-slate-900', error: 'bg-red-700', warning: 'bg-amber-600' }[toast.type] || 'bg-slate-900';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className={isTab ? "space-y-6" : "p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto"}>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!isTab && (
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <FileSpreadsheet className="w-7 h-7 text-indigo-600" />
                            VMI Forecast
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Importação e gestão das demandas futuras enviadas pelo cliente via planilha.</p>
                    </div>
                )}
                <div className="flex items-center gap-3">
                    <button onClick={handleAtualizar}
                        className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                    </button>
                    {rows.length > 0 && (
                        <button onClick={handleExportExcel}
                            className="px-3 py-2 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-700 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm">
                            <Download className="w-4 h-4" /> Exportar Excel
                        </button>
                    )}
                    {data.length > 0 && (
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
                    <FileUp className="w-4 h-4 text-indigo-500" /> Importar Planilha de Demanda
                </h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <a href={getFileUrl('/api/vmi/modelo')}
                        download="Modelo_Demanda_VMI.xlsx"
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                        title="Baixar planilha modelo para preenchimento">
                        <FileDown className="w-3.5 h-3.5" /> Baixar Modelo
                    </a>
                    <div className="relative flex-1 max-w-xl">
                        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange}
                            ref={fileInputRef} disabled={previewMode}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors border border-slate-200 rounded-lg bg-slate-50 disabled:opacity-50" />
                    </div>
                    {!previewMode ? (
                        <button onClick={handleUpload} disabled={!file || uploading}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            {uploading
                                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Lendo...</>
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
                                    : <><CheckCircle2 className="w-4 h-4" /> Confirmar e Salvar</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Lote Selector — only shown when there are registered imports */}
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
                                    <div className="text-slate-500 mt-0.5">{fmtDate(l.created_at)}</div>
                                    <div className="flex gap-3 mt-1.5 text-slate-400 flex-wrap">
                                        <span>{l.total_produtos} produtos</span>
                                        <span>•</span>
                                        <span>{l.total_pedidos} pedidos</span>
                                        <span>•</span>
                                        <span>{l.total_linhas} linhas</span>
                                    </div>
                                    {l.meses_referencia && (
                                        <div className="text-slate-400 mt-0.5 truncate" title={l.meses_referencia}>
                                            📅 {l.meses_referencia}
                                        </div>
                                    )}
                                    {l.usuario_nome && (
                                        <div className="text-slate-400 mt-0.5 truncate" title={l.usuario_nome}>
                                            👤 {l.usuario_nome}
                                        </div>
                                    )}
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
                    <div className="flex justify-between items-center">
                        <h3 className={`font-bold ${previewMode ? 'text-orange-800' : 'text-slate-700'}`}>
                            {previewMode ? '⚠️ Pré-visualização — Ainda NÃO SALVO' : 'Demanda Mapeada (Ativa)'}
                        </h3>
                    </div>

                    {/* Toolbar — only in active mode */}
                    {!previewMode && rows.length > 0 && (
                        <div className="flex flex-wrap gap-2 items-center">
                            {/* Text search */}
                            <div className="relative flex-1 min-w-[200px] max-w-sm">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input type="text"
                                    placeholder="Pesquisar produto, pedido, equipamento..."
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

                            {/* Group by toggle */}
                            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                                {[
                                    { id: 'flat', label: 'Por Linha' },
                                    { id: 'produto_pai', label: 'Produto Pai' },
                                    { id: 'pedido', label: 'Pedido' }
                                ].map(({ id, label }) => (
                                    <button key={id} onClick={() => setGroupBy(id)}
                                        className={`px-3 py-1.5 transition ${groupBy === id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Expand/Collapse all (grouped modes only) */}
                            {grupos && (
                                <button onClick={toggleAllGroups}
                                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 font-medium">
                                    {expandedGroups.size === grupos.length ? 'Recolher tudo' : 'Expandir tudo'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Stats bar */}
                    {!previewMode && rows.length > 0 && (
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 items-center">
                            <span className="font-semibold text-slate-700">{fmtNum(stats.itens)} itens</span>
                            <span className="text-slate-300">|</span>
                            <span>{fmtNum(stats.uniqueProds)} produtos únicos</span>
                            <span className="text-slate-300">|</span>
                            <span>{fmtNum(stats.uniqueOrders)} pedidos</span>
                            <span className="text-slate-300">|</span>
                            <span>Total: <strong className="text-indigo-700">{fmtNum(stats.totalQtd)}</strong> pçs</span>
                            {grupos && (
                                <>
                                    <span className="text-slate-300">|</span>
                                    <span>{grupos.length} grupos</span>
                                </>
                            )}
                            {filterText && (
                                <span className="text-amber-600 font-semibold ml-1">• Filtro ativo</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Table content */}
                {loading && !previewMode ? (
                    <div className="p-12 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                    </div>
                ) : (!previewMode && rows.length === 0) ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                        <Layers className="w-12 h-12 mb-3 opacity-30" />
                        <p className="font-medium text-slate-600">Nenhuma demanda registrada.</p>
                        <p className="text-sm mt-1">Importe uma planilha VMI para visualizar os dados.</p>
                    </div>
                ) : (previewMode && previewData.length === 0) ? (
                    <div className="p-12 flex justify-center text-orange-500 font-bold">Lendo planilha...</div>
                ) : filteredRows.length === 0 && !previewMode ? (
                    <div className="p-8 text-center flex flex-col items-center gap-2 text-slate-400">
                        <AlertCircle className="w-8 h-8 opacity-40" />
                        <p className="text-sm">Nenhum resultado para "<strong className="text-slate-600">{filterText}</strong>"</p>
                        <button onClick={() => setFilterText('')} className="text-xs text-indigo-600 underline">
                            Limpar filtro
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-slate-100 text-slate-600 text-xs font-bold border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 min-w-[120px]">
                                        {groupBy === 'pedido' ? 'Pedido' : 'Ped. Cliente'}
                                    </th>
                                    <th className="px-4 py-3 min-w-[150px]">Cód. Produto</th>
                                    <th className="px-4 py-3 min-w-[240px]">Descrição</th>
                                    <th className="px-4 py-3 text-center w-20">Tipo</th>
                                    <th className="px-4 py-3 min-w-[120px]">Cód. Protheus</th>
                                    <th className="px-4 py-3 min-w-[140px]">Equipamento</th>
                                    <th className="px-4 py-3 min-w-[60px]">Rev.</th>
                                    <th className="px-4 py-3 border-r border-slate-200 min-w-[120px]">Produto Pai</th>
                                    {(previewMode ? previewMeses : meses).map(m => (
                                        <th key={m} className="px-4 py-3 text-center bg-indigo-50 border-r border-white min-w-[80px]">{m}</th>
                                    ))}
                                    {!previewMode && (
                                        <th className="px-4 py-3 text-center bg-slate-200 font-extrabold text-slate-800 min-w-[70px]">Total</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {previewMode ? (
                                    previewData.map((r, i) => (
                                        <tr key={i} className="hover:bg-orange-50 transition-colors">
                                            <td className="px-4 py-2 font-mono text-xs font-bold border-l-4 border-orange-400">{r.ordem_compra_cliente}</td>
                                            <td className="px-4 py-2 font-mono text-xs text-blue-700 font-semibold">{r.codigo_produto_cliente}</td>
                                            <td className="px-4 py-2 text-[11px] text-slate-500 truncate max-w-[240px]">{r.descricao_produto_cliente}</td>
                                            <td className="px-4 py-2 text-[11px] text-slate-500 truncate max-w-[140px]">{r.descricao_equipamento}</td>
                                            <td className="px-4 py-2 text-[11px] font-bold text-slate-600">{r.rev_cliente || '-'}</td>
                                            <td className="px-4 py-2 text-[10px] text-slate-400 border-r border-slate-100 truncate max-w-[180px]">{r.produto_pai}</td>
                                            {previewMeses.map(m => {
                                                const v = r.meses[m] || 0;
                                                return <td key={m} className={`px-4 py-2 text-center border-r border-slate-50 font-mono text-xs ${v > 0 ? 'font-bold text-slate-800' : 'text-slate-300'}`}>{v > 0 ? v : '-'}</td>;
                                            })}
                                        </tr>
                                    ))
                                ) : grupos ? renderGroupedRows() : renderFlatRows()}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Toast */}
            {toast.msg && (
                <div className={`fixed bottom-6 right-6 ${toastBg} shadow-2xl rounded-xl text-white px-5 py-3 text-sm font-bold z-[100] flex items-center gap-3`}>
                    <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0" />
                    <span className="max-w-xs">{toast.msg}</span>
                </div>
            )}

            <ConfirmModal
                isOpen={confirm.isOpen}
                onClose={() => setConfirm(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirm.onConfirm}
                title={confirm.title}
                message={confirm.message}
            />

            {bomModal && (
                <VMIBomModal
                    produto={bomModal}
                    onClose={() => setBomModal(null)}
                />
            )}
            {bomModalMulti && (
                <VMIBomModal
                    produtos={bomModalMulti.produtos}
                    titulo={bomModalMulti.titulo}
                    onClose={() => setBomModalMulti(null)}
                />
            )}
            {openBomDropdown && (
                <div className="fixed inset-0 z-20" onClick={() => setOpenBomDropdown(null)} />
            )}
            {opMirrorModal && (
                <VMIOpMirrorModal
                    b1cod={opMirrorModal.b1cod}
                    label={opMirrorModal.label}
                    defaultQty={opMirrorModal.defaultQty}
                    sheetName={loteAtivo?.nome_arquivo || ''}
                    sheetDate={loteAtivo ? fmtDate(loteAtivo.created_at) : ''}
                    onClose={() => setOpMirrorModal(null)}
                />
            )}
        </div>
    );
}
