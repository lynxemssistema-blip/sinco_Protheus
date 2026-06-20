import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import {
    UploadCloud, FileSpreadsheet, RefreshCw, Layers, Trash2,
    CheckCircle2, FileUp, Search, X, ChevronDown, ChevronRight, AlertCircle, Download, XCircle, FileDown, ClipboardList, FileText, Filter
} from 'lucide-react';
import { api, getFileUrl } from '../../services/api';
import * as XLSX from 'xlsx';
import ConfirmModal from '../../components/ConfirmModal';
import VMIBomModal from './VMIBomModal';
import VMIOpMirrorModal from './VMIOpMirrorModal';

const fmtDate = (d) => d
    ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
const fmtDatePT = (d) => {
    if (!d) return null;
    const s = String(d);
    if (s.length === 8 && /^\d{8}$/.test(s)) return `${s.slice(6,8)}/${s.slice(4,6)}/${s.slice(0,4)}`;
    try { return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return null; }
};
const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');
const parseJsonArr = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v.trim().startsWith('[')) { try { return JSON.parse(v); } catch { return []; } }
    return [];
};

const cleanOrderNumber = (str) => {
    if (!str) return '';
    let s = String(str).trim();
    // Desconsidera o prefixo DMC-9800- globalmente
    s = s.replace(/dmc-?9800-?/gi, '');
    // Desconsidera as revisões/sufixos comuns
    const revRegex = /([-/_.]|(\s+rev\b|\s+revis\w*))+/i;
    const match = s.match(revRegex);
    if (match && match.index !== undefined) {
        s = s.substring(0, match.index);
    }
    return s.replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '').toUpperCase();
};


const OP_STATUS_STYLE = {
    'Concluída':    { badge: 'bg-emerald-900/60 text-emerald-300 border-emerald-700', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'Em Andamento': { badge: 'bg-blue-900/60 text-blue-300 border-blue-700',         bar: 'bg-blue-500',    chip: 'bg-blue-50 text-blue-700 border-blue-200'          },
    'Em Aberto':    { badge: 'bg-slate-700/60 text-slate-400 border-slate-600',      bar: 'bg-slate-500',   chip: 'bg-slate-100 text-slate-500 border-slate-200'      },
};

const OpsCell = ({ ops }) => {
    if (!ops || ops.length === 0) return <span className="text-slate-300 text-xs">-</span>;
    return (
        <div className="flex flex-col gap-0.5">
            {ops.map((op, idx) => {
                const st = OP_STATUS_STYLE[op.status] || OP_STATUS_STYLE['Em Aberto'];
                return (
                    <div key={idx} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold ${st.chip}`} title={`${op.status || 'Em Aberto'}${op.datprf ? ' • Prev: ' + op.datprf : ''} • ${op.qtd_entregue ?? 0}/${op.qtd_total ?? 0} pçs`}>
                        <span>{op.op}</span>
                        <span className="text-[9px] font-normal opacity-70">{op.progresso}%</span>
                    </div>
                );
            })}
        </div>
    );
};


const NfTooltip = ({ notasFiscais, index }) => {
    if (!notasFiscais || notasFiscais.length === 0) return null;
    const isTopRow = typeof index === 'number' && index < 3;
    return (
        <div className={`absolute z-50 ${isTopRow ? 'top-full mt-1.5' : 'bottom-full mb-1.5'} left-1/2 -translate-x-1/2 hidden group-hover/nfte:flex flex-col items-center animate-fade-in`}>
            {isTopRow && (
                <div className="w-2.5 h-2.5 bg-slate-900 border-t border-l border-slate-800 rotate-45 -mb-1.5 z-10" />
            )}
            <div className="bg-slate-900/95 backdrop-blur-md text-slate-100 text-[10px] rounded-lg p-2.5 shadow-2xl border border-slate-800 whitespace-nowrap text-left min-w-[200px]">
                <div className="font-bold text-indigo-400 mb-1.5 border-b border-slate-800 pb-1 flex items-center justify-between">
                    <span>Notas Fiscais de Entrega</span>
                    <span className="text-[9px] text-slate-500 font-normal">{notasFiscais.length} {notasFiscais.length === 1 ? 'NF' : 'NFs'}</span>
                </div>
                <div className="max-h-[160px] overflow-y-auto pr-1 custom-scrollbar space-y-1">
                    {notasFiscais.map((nf, idx) => (
                        <div
                            key={idx}
                            className="py-1 flex justify-between gap-4 border-b border-slate-800/40 last:border-0 hover:bg-slate-800/50 rounded px-1.5 transition-all"
                        >
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-200">NF {nf.nota} <span className="text-slate-500 font-normal">({nf.serie})</span></span>
                                <span className="text-[9px] text-slate-400">Emissão: {nf.emissao || '-'}</span>
                            </div>
                            <div className="flex flex-col items-end justify-center font-mono">
                                <span className="font-bold text-emerald-400">{fmtNum(nf.qtd)} pçs</span>
                                <span className="text-[9px] text-slate-500">CFOP {nf.cfop || '-'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {!isTopRow && (
                <div className="w-2.5 h-2.5 bg-slate-900 border-b border-r border-slate-800 rotate-45 -mt-1.5" />
            )}
        </div>
    );
};

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
    const [pcFilter, setPcFilter] = useState('');
    const [groupBy, setGroupBy] = useState('flat'); // 'flat' | 'produto_pai' | 'pedido'
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', onConfirm: null, confirmText: 'Confirmar', danger: false });
    const [bomModal, setBomModal] = useState(null); // modo único: { codigo_cliente, descricao_cliente, b1_cod, totalQty }
    const [bomModalMulti, setBomModalMulti] = useState(null); // modo multi: { produtos: [...], titulo }
    const [openBomDropdown, setOpenBomDropdown] = useState(null); // key do grupo com dropdown aberto
    const [opMirrorModal, setOpMirrorModal] = useState(null); // { b1cod, label, defaultQty }

    // Sorting & Filtering
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [columnFilters, setColumnFilters] = useState({
        prioridade_cliente: '',
        ordem_compra_cliente: '',
        codigo_produto_cliente: '',
        descricao_produto_cliente: '',
        status_tipo_item: '',
        b1_cod: '',
        pedido_metalfisa: '',
        qtd_pedido: '',
        qtd_entregue: '',
        saldo_entregar: '',
        descricao_equipamento: '',
        rev_cliente: '',
        rev_metalfisa: '',
        produto_pai: ''
    });
    const [showColumnFilters, setShowColumnFilters] = useState(false);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            setSortConfig({ key: null, direction: 'asc' });
            return;
        }
        setSortConfig({ key, direction });
    };

    const clearColumnFilters = () => {
        setColumnFilters({
            prioridade_cliente: '',
            ordem_compra_cliente: '',
            codigo_produto_cliente: '',
            descricao_produto_cliente: '',
            status_tipo_item: '',
            b1_cod: '',
            pedido_metalfisa: '',
            qtd_pedido: '',
            qtd_entregue: '',
            saldo_entregar: '',
            descricao_equipamento: '',
            rev_cliente: '',
            rev_metalfisa: '',
            produto_pai: ''
        });
    };

    const hasActiveColumnFilters = Object.values(columnFilters).some(v => v !== '');

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
        setPcFilter('');
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
            confirmText: 'Limpar Tudo',
            danger: true,
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
            confirmText: 'Excluir',
            danger: true,
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

    const handleFetchMetalfisa = async () => {
        if (!data || data.length === 0) return;
        setConfirm({
            isOpen: true,
            title: 'Sincronizar Pedidos Metalfisa',
            message: 'Deseja buscar o status de faturamento (SC6) dos pedidos no Protheus para os itens mapeados?',
            confirmText: 'Sincronizar',
            danger: false,
            onConfirm: async () => {
                setLoading(true);
                try {
                    // Enriquece b1_cod via mapeamentos locais antes de enviar ao servidor
                    const rowsToSend = data.map(d => ({
                        ...d,
                        b1_cod: d.b1_cod || mapeamentos[d.codigo_produto_cliente]?.b1_cod || null
                    }));
                    const res = await api.post('/vmi/pedidos-protheus', { rows: rowsToSend }, { timeout: 300000 });
                    if (res.data.success && res.data.mappings) {
                        const cleanString = (str) => String(str || '').replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '').toUpperCase();
                        const mappings = res.data.mappings;

                        // Backend retorna { "36622": [{ b1_cod, num, qtd, qtdven, notas_fiscais, ops }] }
                        // Precisamos fazer match por OC e então filtrar pelo b1_cod do produto
                        const newData = data.map(d => {
                            const ocKey = cleanOrderNumber(d.ordem_compra_cliente);
                            const ocEntries = mappings[ocKey] || [];
                            if (ocEntries.length === 0) return d;

                            const b1Cod = d.b1_cod || mapeamentos[d.codigo_produto_cliente]?.b1_cod || null;
                            if (!b1Cod) return d;

                            const cleanB1 = cleanString(b1Cod);
                            const matching = ocEntries.filter(x => cleanString(x.b1_cod) === cleanB1);
                            if (matching.length === 0) return d;

                            const qPed = matching.reduce((s, x) => s + Number(x.qtdven || 0), 0);
                            const qEnt = matching.reduce((s, x) => s + Number(x.qtd || 0), 0);
                            const allNfs = [];
                            const allOps = [];
                            matching.forEach(x => {
                                if (x.notas_fiscais) allNfs.push(...x.notas_fiscais);
                                if (x.ops) allOps.push(...x.ops);
                            });
                            const pedidos = matching.map(x => x.num).filter((v, i, a) => a.indexOf(v) === i);
                            const items = matching.map(x => x.item).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
                            return {
                                ...d,
                                b1_cod: b1Cod,
                                pedido_metalfisa: pedidos.join(' / '),
                                item_pedido: items.join(' / '),
                                qtd_pedido: qPed,
                                qtd_entregue: qEnt,
                                saldo_entregar: Math.max(0, qPed - qEnt),
                                notas_fiscais: allNfs,
                                ops_relacionadas: allOps
                            };
                        });
                        setData(newData);
                        const matched = newData.filter(d => d.pedido_metalfisa && d.pedido_metalfisa !== '-').length;
                        showToast(`Sincronizado! ${matched} linhas com pedido Metalfisa encontrado.`, 'success');
                    }
                } catch (err) {
                    console.error(err);
                    showToast('Erro ao buscar pedidos.', 'error');
                } finally {
                    setLoading(false);
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
            const mInfo = mapeamentos[d.codigo_produto_cliente] || {};
            const key = `${d.ordem_compra_cliente}||${d.codigo_produto_cliente}`;
            if (!map[key]) {
                // Usa b1_cod do servidor; se não veio, usa o mapeamento local (mapeamentos já tem b1_cod de SZ1)
                const effectiveB1Cod = d.b1_cod || mInfo.b1_cod || null;
                const effectiveStatus = effectiveB1Cod
                    ? (mInfo.status_tipo_item || d.status_tipo_item)
                    : d.status_tipo_item;
                const effectiveDetalhe = effectiveB1Cod
                    ? (mInfo.status_tipo_detalhe || d.status_tipo_detalhe)
                    : d.status_tipo_detalhe;
                map[key] = {
                    prioridade_cliente: d.prioridade_cliente,
                    ordem_compra_cliente: d.ordem_compra_cliente,
                    produto_pai: d.produto_pai,
                    descricao_equipamento: d.descricao_equipamento,
                    codigo_produto_cliente: d.codigo_produto_cliente,
                    descricao_produto_cliente: d.descricao_produto_cliente,
                    rev_cliente: d.rev_cliente,
                    rev_metalfisa: mInfo.z1_revisao || '',
                    status_tipo_item: effectiveStatus,
                    status_tipo_detalhe: effectiveDetalhe,
                    b1_cod: effectiveB1Cod,
                    b1_desc: d.b1_desc || null,
                    pdf_url: mInfo.pdf_url || d.pdf_url || null,
                    b1_cod_pai: d.b1_cod_pai || null,
                    pedido_metalfisa: d.pedido_metalfisa || '-',
                    item_pedido: d.item_pedido || '',
                    qtd_pedido: d.qtd_pedido || 0,
                    qtd_entregue: d.qtd_entregue || 0,
                    saldo_entregar: d.saldo_entregar || 0,
                    notas_fiscais: parseJsonArr(d.notas_fiscais),
                    ops_relacionadas: parseJsonArr(d.ops_relacionadas),
                    data_entrega_comercial: d.data_entrega_comercial || '',
                    data_entrega_pcp: d.data_entrega_pcp || null,
                    data_prevista_faturamento: d.data_prevista_faturamento || null,
                    meses: {}
                };
            }
            // Atualiza b1_cod / b1_cod_pai se ainda não tiver
            if (!map[key].b1_cod && (d.b1_cod || mInfo.b1_cod)) {
                map[key].b1_cod = d.b1_cod || mInfo.b1_cod;
                map[key].b1_desc = d.b1_desc || null;
                if (!map[key].status_tipo_item || map[key].status_tipo_item === 'Restrição') {
                    map[key].status_tipo_item = mInfo.status_tipo_item || d.status_tipo_item;
                    map[key].status_tipo_detalhe = mInfo.status_tipo_detalhe || d.status_tipo_detalhe;
                }
            }
            if (!map[key].b1_cod_pai && d.b1_cod_pai) {
                map[key].b1_cod_pai = d.b1_cod_pai;
            }
            if (d.pedido_metalfisa && d.pedido_metalfisa !== '-') {
                map[key].pedido_metalfisa = d.pedido_metalfisa;
                map[key].item_pedido = d.item_pedido || '';
                map[key].qtd_pedido = d.qtd_pedido;
                map[key].qtd_entregue = d.qtd_entregue;
                map[key].saldo_entregar = d.saldo_entregar;
                map[key].notas_fiscais = parseJsonArr(d.notas_fiscais);
                map[key].ops_relacionadas = parseJsonArr(d.ops_relacionadas);
                map[key].data_entrega_comercial = d.data_entrega_comercial || '';
                map[key].data_entrega_pcp = d.data_entrega_pcp || map[key].data_entrega_pcp || null;
                map[key].data_prevista_faturamento = d.data_prevista_faturamento || map[key].data_prevista_faturamento || null;
            }
            map[key].meses[d.mes_referencia] = (map[key].meses[d.mes_referencia] || 0) + Number(d.quantidade);
        });
        return Object.values(map);
    }, [data, mapeamentos]);

    // Apply text filter & column filters
    const filteredRows = useMemo(() => {
        let result = rows;

        // Apply global search
        if (filterText.trim()) {
            const s = filterText.toLowerCase();
            result = result.filter(r =>
                r.codigo_produto_cliente?.toLowerCase().includes(s) ||
                r.descricao_produto_cliente?.toLowerCase().includes(s) ||
                r.ordem_compra_cliente?.toLowerCase().includes(s) ||
                r.produto_pai?.toLowerCase().includes(s) ||
                r.descricao_equipamento?.toLowerCase().includes(s) ||
                r.prioridade_cliente?.toString().toLowerCase().includes(s)
            );
        }

        // Apply dedicated PC search (using cleanOrderNumber)
        if (pcFilter.trim()) {
            const cleanInput = cleanOrderNumber(pcFilter);
            result = result.filter(r => {
                const cleanRowVal = cleanOrderNumber(r.ordem_compra_cliente);
                return cleanRowVal.includes(cleanInput);
            });
        }

        // Apply column-specific search
        Object.entries(columnFilters).forEach(([key, value]) => {
            if (value && value.trim()) {
                const s = value.toLowerCase().trim();
                result = result.filter(r => {
                    const val = r[key];
                    if (val === undefined || val === null) return false;
                    if (key === 'ordem_compra_cliente') {
                        return cleanOrderNumber(val).includes(cleanOrderNumber(value));
                    }
                    return String(val).toLowerCase().includes(s);
                });
            }
        });

        return result;
    }, [rows, filterText, pcFilter, columnFilters]);

    // Apply sorting
    const sortedRows = useMemo(() => {
        const sortableItems = [...filteredRows];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];

                if (valA === undefined || valA === null) valA = '';
                if (valB === undefined || valB === null) valB = '';

                // Handle numbers
                const numA = Number(valA);
                const numB = Number(valB);
                if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
                    return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
                }

                // Normal string comparison
                const strA = String(valA).trim().toLowerCase();
                const strB = String(valB).trim().toLowerCase();
                if (strA < strB) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (strA > strB) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredRows, sortConfig]);

    // Build groups
    const grupos = useMemo(() => {
        if (groupBy === 'flat') return null;
        const map = {};
        sortedRows.forEach(r => {
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
                'Prioridade':         r.prioridade_cliente || '',
                'Pedido Cliente':     r.ordem_compra_cliente,
                'Produto Pai':        r.produto_pai || '',
                'Equipamento':        r.descricao_equipamento || '',
                'Cód. Produto':       r.codigo_produto_cliente,
                'Descrição Produto':  r.descricao_produto_cliente || '',
                'Rev. Cliente':       r.rev_cliente || '',
                'Rev. Metalfisa':     r.rev_metalfisa || '',
                'Tipo':               r.status_tipo_item || 'PCP',
                'Cód. Protheus':      r.b1_cod || '',
                'Status Detalhe':     r.status_tipo_detalhe || '',
                'Desc. Protheus':     r.b1_desc || '',
                'Ped. Metalfisa':     r.pedido_metalfisa || '-',
                'Qtd. Pedido':        r.qtd_pedido || 0,
                'Qtd. Entregue':      r.qtd_entregue || 0,
                'Saldo a Entregar':   r.saldo_entregar || 0,
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
            const hdr = { 'Produto Pai': key, 'Equipamento': g.label, 'Cód. Produto': '', 'Descrição': '', 'Rev.': '', 'Rev. Metalfisa': '', 'Tipo': '', 'Cód. Protheus': '', 'Desc. Protheus': '', 'Ped. Metalfisa': '', 'Qtd. Pedido': '', 'Qtd. Entregue': '', 'Saldo a Entregar': '' };
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
                    'Rev. Metalfisa': r.rev_metalfisa || '',
                    'Tipo': r.status_tipo_item || 'PCP',
                    'Cód. Protheus': r.b1_cod || '', 
                    'Desc. Protheus': r.b1_desc || '',
                    'Ped. Metalfisa': r.pedido_metalfisa || '-',
                    'Qtd. Pedido': r.qtd_pedido || 0,
                    'Qtd. Entregue': r.qtd_entregue || 0,
                    'Saldo a Entregar': r.saldo_entregar || 0,
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
            const hdr = { 'Pedido': key, 'Produto Pai': '', 'Cód. Produto': '', 'Descrição': '', 'Rev.': '', 'Rev. Metalfisa': '', 'Tipo': '', 'Cód. Protheus': '', 'Desc. Protheus': '', 'Ped. Metalfisa': '', 'Qtd. Pedido': '', 'Qtd. Entregue': '', 'Saldo a Entregar': '' };
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
                    'Rev. Metalfisa': r.rev_metalfisa || '',
                    'Tipo': r.status_tipo_item || 'PCP',
                    'Cód. Protheus': r.b1_cod || '', 
                    'Desc. Protheus': r.b1_desc || '',
                    'Ped. Metalfisa': r.pedido_metalfisa || '-',
                    'Qtd. Pedido': r.qtd_pedido || 0,
                    'Qtd. Entregue': r.qtd_entregue || 0,
                    'Saldo a Entregar': r.saldo_entregar || 0,
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
    const renderFlatRows = () => sortedRows.map((r, i) => {
        let rowTotal = 0;
        // Pre-compute rowTotal for BOM modal
        meses.forEach(m => { rowTotal += r.meses[m] || 0; });
        let rowTotalCell = 0;
        return (
            <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                <td className="sticky left-0 z-10 bg-white px-4 py-2 text-center text-xs font-bold text-orange-600 w-[52px]">{r.prioridade_cliente || '-'}</td>
                <td className="sticky left-[52px] z-10 bg-white px-4 py-2 font-mono text-xs font-bold text-slate-700 w-[112px]">{r.ordem_compra_cliente}</td>
                <td className="sticky left-[164px] z-10 bg-white px-4 py-2 font-mono text-xs text-blue-700 font-semibold w-[160px]">{r.codigo_produto_cliente}</td>
                <td className="sticky left-[324px] z-10 bg-white px-4 py-2 font-mono text-xs text-slate-600 w-[152px]">
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
                                className="p-0.5 rounded hover:bg-cyan-100 text-cyan-400 hover:text-cyan-600 transition-colors">
                                <FileText className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {r.pdf_url && (
                            <a href={getFileUrl('/api/docs/view?path=' + encodeURIComponent(r.pdf_url))} target="_blank" rel="noreferrer" title="Abrir PDF do produto"
                                className="p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors">
                                <FileText className="w-3.5 h-3.5" />
                            </a>
                        )}
                    </div>
                </td>
                <td className="sticky left-[476px] z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] px-4 py-2 font-mono text-xs text-center text-slate-600 w-[132px]">
                    <div className="inline-flex flex-col justify-center items-center gap-0.5">
                        <span className="px-1.5 py-0.5 text-xs font-semibold font-mono">{r.pedido_metalfisa || '-'}</span>
                        {r.item_pedido && r.pedido_metalfisa && r.pedido_metalfisa !== '-' && (
                            <span className="text-[10px] text-slate-400 font-normal leading-none">item {r.item_pedido}</span>
                        )}
                    </div>
                </td>
                <td className="px-4 py-2 text-xs text-slate-600"><OpsCell ops={r.ops_relacionadas} /></td>
                <td className="px-4 py-2 font-mono text-xs text-center text-slate-600">{r.qtd_pedido ? fmtNum(r.qtd_pedido) : '-'}</td>
                <td className="px-4 py-2 font-mono text-xs text-center text-slate-600">
                    <div className="relative group/nfte inline-flex justify-center items-center">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${r.qtd_entregue > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 cursor-help' : 'text-slate-400'}`}>
                            {r.qtd_entregue ? fmtNum(r.qtd_entregue) : '-'}
                        </span>
                        {r.qtd_entregue > 0 && r.notas_fiscais && r.notas_fiscais.length > 0 && (
                            <NfTooltip notasFiscais={r.notas_fiscais} index={i} />
                        )}
                    </div>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-center font-bold text-blue-600">{r.saldo_entregar ? fmtNum(r.saldo_entregar) : '-'}</td>
                <td className="px-4 py-2 text-[11px] text-center text-slate-500">{fmtDatePT(r.data_entrega_comercial) || <span className="text-slate-300">-</span>}</td>
                <td className="px-4 py-2 text-[11px] text-center text-teal-600 font-semibold">{fmtDatePT(r.data_entrega_pcp) || <span className="text-slate-300">-</span>}</td>
                <td className="px-4 py-2 text-[11px] text-center text-emerald-600 font-semibold">{fmtDatePT(r.data_prevista_faturamento) || <span className="text-slate-300">-</span>}</td>
                <td className="px-4 py-2 text-[11px] font-bold text-indigo-600">{r.rev_metalfisa || '-'}</td>
                {/* <td className="px-4 py-2 text-[10px] text-slate-400 border-r border-slate-100 truncate max-w-[180px]" title={r.produto_pai}>{r.produto_pai}</td> */}
                {meses.map(m => {
                    const v = r.meses[m] || 0;
                    rowTotalCell += v;
                    return <td key={m} className={`px-4 py-2 text-center border-r border-slate-50 font-mono text-xs ${v > 0 ? 'font-bold text-slate-800' : 'text-slate-300'}`}>{v > 0 ? fmtNum(v) : '-'}</td>;
                })}
                <td className="px-4 py-2 text-center font-bold text-indigo-700 text-xs font-mono bg-slate-50">{fmtNum(rowTotalCell)}</td>
                <td className="px-4 py-2 text-[11px] text-slate-500 truncate max-w-[240px]" title={r.descricao_produto_cliente}>{r.descricao_produto_cliente}</td>
                <td className="px-4 py-2 text-center">
                    <TypeBadge type={r.status_tipo_item} detail={r.status_tipo_detalhe} />
                </td>
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
                    <td className="px-3 py-2.5" colSpan={3}>
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
                    <td className="px-4 py-2.5 text-xs text-slate-500" colSpan={11}>
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
                                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-cyan-50 flex flex-col gap-0.5 border-t border-slate-100">
                                                    <span className="font-semibold text-slate-800">Espelho do Produto</span>
                                                    <span className="text-slate-400">Roteiro de produção de <span className="font-mono text-cyan-600">{g.b1CodPai}</span></span>
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
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5" />
                </tr>

                {/* Child rows */}
                {isOpen && g.rows.map((r, i) => {
                    let rowTotal = 0;
                    return (
                        <tr key={`${g.key}-${i}`} className="hover:bg-indigo-50/20 transition-colors border-l-2 border-indigo-300">
                            <td className="sticky left-0 z-10 bg-white px-4 py-2 text-center text-xs font-bold text-orange-600 w-[52px]">{r.prioridade_cliente || '-'}</td>
                            <td className="sticky left-[52px] z-10 bg-white px-4 py-2 pl-9 font-mono text-xs text-slate-500 w-[112px]">
                                {groupBy === 'produto_pai' ? r.ordem_compra_cliente : (r.produto_pai || '—')}
                            </td>
                            <td className="sticky left-[164px] z-10 bg-white px-4 py-2 font-mono text-xs text-blue-700 font-semibold w-[160px]">{r.codigo_produto_cliente}</td>
                            <td className="sticky left-[324px] z-10 bg-white px-4 py-2 font-mono text-xs text-slate-600 w-[152px]">
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
                                                className="p-0.5 rounded hover:bg-cyan-100 text-cyan-400 hover:text-cyan-600 transition-colors">
                                                <FileText className="w-3.5 h-3.5" />
                                            </button>
                                        </>);
                                    })()}
                                    {r.pdf_url && (
                                        <a href={getFileUrl('/api/docs/view?path=' + encodeURIComponent(r.pdf_url))} target="_blank" rel="noreferrer" title="Abrir PDF do produto"
                                            className="p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors">
                                            <FileText className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                </div>
                            </td>
                            <td className="sticky left-[476px] z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] px-4 py-2 font-mono text-xs text-center text-slate-600 w-[132px]">
                                <div className="inline-flex flex-col justify-center items-center gap-0.5">
                                    <span className="px-1.5 py-0.5 text-xs font-semibold font-mono">{r.pedido_metalfisa || '-'}</span>
                                    {r.item_pedido && r.pedido_metalfisa && r.pedido_metalfisa !== '-' && (
                                        <span className="text-[10px] text-slate-400 font-normal leading-none">item {r.item_pedido}</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-600"><OpsCell ops={r.ops_relacionadas} /></td>
                            <td className="px-4 py-2 font-mono text-xs text-center text-slate-600">{r.qtd_pedido ? fmtNum(r.qtd_pedido) : '-'}</td>
                            <td className="px-4 py-2 font-mono text-xs text-center text-slate-600">
                                <div className="relative group/nfte inline-flex justify-center items-center">
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${r.qtd_entregue > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 cursor-help' : 'text-slate-400'}`}>
                                        {r.qtd_entregue ? fmtNum(r.qtd_entregue) : '-'}
                                    </span>
                                    {r.qtd_entregue > 0 && r.notas_fiscais && r.notas_fiscais.length > 0 && (
                                        <NfTooltip notasFiscais={r.notas_fiscais} index={i} />
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-center font-bold text-blue-600">{r.saldo_entregar ? fmtNum(r.saldo_entregar) : '-'}</td>
                            <td className="px-4 py-2 text-[11px] text-center text-slate-500">{fmtDatePT(r.data_entrega_comercial) || <span className="text-slate-300">-</span>}</td>
                            <td className="px-4 py-2 text-[11px] text-center text-teal-600 font-semibold">{fmtDatePT(r.data_entrega_pcp) || <span className="text-slate-300">-</span>}</td>
                            <td className="px-4 py-2 text-[11px] text-center text-emerald-600 font-semibold">{fmtDatePT(r.data_prevista_faturamento) || <span className="text-slate-300">-</span>}</td>
                            <td className="px-4 py-2 text-[11px] font-bold text-indigo-600">{r.rev_metalfisa || '-'}</td>
                            {/* <td className="px-4 py-2 text-[10px] text-slate-400 border-r border-slate-100 truncate max-w-[180px]">
                                {groupBy === 'produto_pai' ? '' : r.produto_pai}
                            </td> */}
                            {meses.map(m => {
                                const v = r.meses[m] || 0;
                                rowTotal += v;
                                return <td key={m} className={`px-4 py-2 text-center border-r border-slate-50 font-mono text-xs ${v > 0 ? 'font-bold text-slate-800' : 'text-slate-300'}`}>{v > 0 ? fmtNum(v) : '-'}</td>;
                            })}
                            <td className="px-4 py-2 text-center font-bold text-indigo-700 text-xs font-mono bg-slate-50">{fmtNum(rowTotal)}</td>
                            <td className="px-4 py-2 text-[11px] text-slate-500 truncate max-w-[240px]" title={r.descricao_produto_cliente}>{r.descricao_produto_cliente}</td>
                            <td className="px-4 py-2 text-center">
                                <TypeBadge type={r.status_tipo_item} detail={r.status_tipo_detalhe} />
                            </td>
                        </tr>
                    );
                })}
            </Fragment>
        );
    });

    const renderHeader = (key, label, extraClass = "") => {
        const isActive = sortConfig.key === key;
        const dir = sortConfig.direction;
        return (
            <th 
                className={`px-4 py-3 cursor-pointer hover:bg-slate-200 transition-colors select-none ${extraClass}`}
                onClick={() => requestSort(key)}
            >
                <div className="flex items-center gap-1 justify-between">
                    <span>{label}</span>
                    {isActive ? (
                        dir === 'asc' ? <span className="text-indigo-600 font-extrabold">▲</span> : <span className="text-indigo-600 font-extrabold">▼</span>
                    ) : (
                        <span className="text-slate-300 opacity-40 text-[10px]">⇅</span>
                    )}
                </div>
            </th>
        );
    };

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
                    {data.length > 0 && (
                        <button onClick={handleFetchMetalfisa}
                            className="px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sincronizar Protheus
                        </button>
                    )}
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

                            {/* Ordem de Compra (PC) filter */}
                            <div className="relative flex-1 min-w-[150px] max-w-[220px]">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input type="text"
                                    placeholder="Ordem de Compra (PC)..."
                                    value={pcFilter}
                                    onChange={e => setPcFilter(e.target.value)}
                                    className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
                                {pcFilter && (
                                    <button onClick={() => setPcFilter('')}
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

                            {/* Column Filters Toggle */}
                            <button
                                onClick={() => setShowColumnFilters(!showColumnFilters)}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
                                    showColumnFilters || hasActiveColumnFilters
                                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                                title="Filtrar por colunas específicas"
                            >
                                <Filter className="w-3.5 h-3.5" />
                                {hasActiveColumnFilters ? 'Filtros Ativos' : 'Filtrar Colunas'}
                            </button>

                            {/* Clear Column Filters */}
                            {hasActiveColumnFilters && (
                                <button
                                    onClick={clearColumnFilters}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition shadow-sm"
                                >
                                    Limpar Filtros
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
                ) : sortedRows.length === 0 && !previewMode ? (
                    <div className="p-8 text-center flex flex-col items-center gap-2 text-slate-400">
                        <AlertCircle className="w-8 h-8 opacity-40" />
                        <p className="text-sm">Nenhum resultado encontrado.</p>
                        {(filterText || hasActiveColumnFilters) && (
                            <button onClick={() => { setFilterText(''); clearColumnFilters(); }} className="text-xs text-indigo-600 underline">
                                Limpar todos os filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto h-[calc(100vh-350px)] min-h-[400px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-slate-100 text-slate-600 text-xs font-bold border-b border-slate-200 sticky top-0 z-30">
                                <tr>
                                    {renderHeader('prioridade_cliente', 'Prio', 'sticky left-0 z-20 bg-slate-50 w-[52px]')}
                                    <th className="px-4 py-3 sticky left-[52px] z-20 bg-slate-50 w-[112px] cursor-pointer hover:bg-slate-200 transition-colors select-none" onClick={() => requestSort('ordem_compra_cliente')}>
                                        <div className="flex items-center gap-1 justify-between">
                                            <span>{groupBy === 'pedido' ? 'Pedido' : 'Ped. Cliente'}</span>
                                            {sortConfig.key === 'ordem_compra_cliente' ? (
                                                sortConfig.direction === 'asc' ? <span className="text-indigo-600 font-extrabold">▲</span> : <span className="text-indigo-600 font-extrabold">▼</span>
                                            ) : (
                                                <span className="text-slate-300 opacity-40 text-[10px]">⇅</span>
                                            )}
                                        </div>
                                    </th>
                                    {renderHeader('codigo_produto_cliente', 'Cód. Produto', 'sticky left-[164px] z-20 bg-slate-50 w-[160px]')}
                                    {renderHeader('b1_cod', 'Cód. Protheus', 'sticky left-[324px] z-20 bg-slate-50 w-[152px]')}
                                    {renderHeader('pedido_metalfisa', 'Ped. Metalfisa', 'sticky left-[476px] z-20 bg-slate-50 w-[132px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]')}
                                    {renderHeader('ops_relacionadas', 'OPs', 'min-w-[140px]')}
                                    {renderHeader('qtd_pedido', 'Qtd. Pedido', 'min-w-[90px] text-center')}
                                    {renderHeader('qtd_entregue', 'Qtd. Entregue', 'min-w-[90px] text-center')}
                                    {renderHeader('saldo_entregar', 'Saldo a Entregar', 'min-w-[100px] text-center')}
                                    {renderHeader('data_entrega_comercial', 'Dt. Entrega', 'min-w-[90px] text-center')}
                                    {renderHeader('data_entrega_pcp', 'Dt. PCP', 'min-w-[90px] text-center')}
                                    {renderHeader('data_prevista_faturamento', 'Prev. Fat.', 'min-w-[90px] text-center')}
                                    {renderHeader('rev_metalfisa', 'Rev. Metalfisa', 'min-w-[60px]')}
                                    {/* {renderHeader('produto_pai', 'Produto Pai', 'border-r border-slate-200 min-w-[120px]')} */}
                                    {(previewMode ? previewMeses : meses).map(m => (
                                        <th key={m} className="px-4 py-3 text-center bg-indigo-50 border-r border-white min-w-[80px]">{m}</th>
                                    ))}
                                    {!previewMode && (
                                        <th className="px-4 py-3 text-center bg-slate-200 font-extrabold text-slate-800 min-w-[70px]">Total</th>
                                    )}
                                    {renderHeader('descricao_produto_cliente', 'Descrição', 'min-w-[200px]')}
                                    {renderHeader('status_tipo_item', 'Tipo', 'text-center min-w-[80px]')}
                                </tr>
                                {showColumnFilters && !previewMode && (
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <td className="sticky left-0 z-20 bg-slate-50 px-2 py-1 w-[52px]"><input type="text" value={columnFilters.prioridade_cliente} onChange={e => setColumnFilters({...columnFilters, prioridade_cliente: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium" placeholder="Prio..." /></td>
                                        <td className="sticky left-[52px] z-20 bg-slate-50 px-2 py-1 w-[112px]"><input type="text" value={columnFilters.ordem_compra_cliente} onChange={e => setColumnFilters({...columnFilters, ordem_compra_cliente: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="Ped. Cli..." /></td>
                                        <td className="sticky left-[164px] z-20 bg-slate-50 px-2 py-1 w-[160px]"><input type="text" value={columnFilters.codigo_produto_cliente} onChange={e => setColumnFilters({...columnFilters, codigo_produto_cliente: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="Produto..." /></td>
                                        <td className="sticky left-[324px] z-20 bg-slate-50 px-2 py-1 w-[152px]"><input type="text" value={columnFilters.b1_cod} onChange={e => setColumnFilters({...columnFilters, b1_cod: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="Protheus..." /></td>
                                        <td className="sticky left-[476px] z-20 bg-slate-50 px-2 py-1 w-[132px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"><input type="text" value={columnFilters.pedido_metalfisa} onChange={e => setColumnFilters({...columnFilters, pedido_metalfisa: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="Metalfisa..." /></td>
                                        <td className="px-2 py-1" />
                                        <td className="px-2 py-1"><input type="text" value={columnFilters.qtd_pedido} onChange={e => setColumnFilters({...columnFilters, qtd_pedido: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Qtd..." /></td>
                                        <td className="px-2 py-1"><input type="text" value={columnFilters.qtd_entregue} onChange={e => setColumnFilters({...columnFilters, qtd_entregue: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Entregue..." /></td>
                                        <td className="px-2 py-1"><input type="text" value={columnFilters.saldo_entregar} onChange={e => setColumnFilters({...columnFilters, saldo_entregar: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Saldo..." /></td>
                                        <td className="px-2 py-1" />
                                        <td className="px-2 py-1" />
                                        <td className="px-2 py-1" />
                                        <td className="px-2 py-1"><input type="text" value={columnFilters.rev_metalfisa} onChange={e => setColumnFilters({...columnFilters, rev_metalfisa: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Rev. Metalfisa..." /></td>
                                        {/* <!--<td className="px-2 py-1 border-r border-slate-200"><input type="text" value={columnFilters.produto_pai} onChange={e => setColumnFilters({...columnFilters, produto_pai: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Pai..." /></td> */}
                                        {meses.map(m => (
                                            <td key={m} className="px-4 py-2 border-r border-slate-50" />
                                        ))}
                                        <td className="px-4 py-2 bg-slate-50" />
                                        <td className="px-2 py-1"><input type="text" value={columnFilters.descricao_produto_cliente} onChange={e => setColumnFilters({...columnFilters, descricao_produto_cliente: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Descrição..." /></td>
                                        <td className="px-2 py-1"><input type="text" value={columnFilters.status_tipo_item} onChange={e => setColumnFilters({...columnFilters, status_tipo_item: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Tipo..." /></td>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {previewMode ? (
                                    previewData.map((r, i) => (
                                        <tr key={i} className="hover:bg-orange-50 transition-colors">
                                            <td className="sticky left-0 z-10 bg-white px-4 py-2 text-center text-xs font-bold text-orange-600 border-l-4 border-orange-400 w-[52px]">{r.prioridade_cliente || '-'}</td>
                                            <td className="sticky left-[52px] z-10 bg-white px-4 py-2 font-mono text-xs font-bold w-[112px]">{r.ordem_compra_cliente}</td>
                                            <td className="sticky left-[164px] z-10 bg-white px-4 py-2 font-mono text-xs text-blue-700 font-semibold w-[160px]">{r.codigo_produto_cliente}</td>
                                            <td className="sticky left-[324px] z-10 bg-white px-4 py-2 text-center text-slate-300 w-[152px]">-</td>
                                            <td className="sticky left-[476px] z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] px-4 py-2 text-center text-slate-300 w-[132px]">-</td>
                                            <td className="px-4 py-2 text-center text-slate-300">-</td>
                                            <td className="px-4 py-2 text-center text-slate-300">-</td>
                                            <td className="px-4 py-2 text-center text-slate-300">-</td>
                                            <td className="px-4 py-2 text-center text-slate-300">-</td>
                                            <td className="px-4 py-2 text-[11px] font-bold text-indigo-600">{r.rev_metalfisa || '-'}</td>
                                            {/* <td className="px-4 py-2 text-[10px] text-slate-400 border-r border-slate-100 truncate max-w-[180px]">{r.produto_pai}</td> */}
                                            {previewMeses.map(m => {
                                                const v = r.meses[m] || 0;
                                                return <td key={m} className={`px-4 py-2 text-center border-r border-slate-50 font-mono text-xs ${v > 0 ? 'font-bold text-slate-800' : 'text-slate-300'}`}>{v > 0 ? v : '-'}</td>;
                                            })}
                                            <td className="px-4 py-2 text-[11px] text-slate-500 truncate max-w-[240px]">{r.descricao_produto_cliente}</td>
                                            <td className="px-4 py-2 text-center text-slate-300">-</td>
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
                confirmText={confirm.confirmText}
                danger={confirm.danger}
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
