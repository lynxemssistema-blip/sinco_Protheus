import React, { useState, useEffect } from 'react';
import { Search, List, Mic, CheckCircle, Clock, AlertTriangle, Calendar, Play, History, Filter, FileText, Printer, ClipboardList, Camera, Upload, Trash2, Check, Eye, Bot, FileDown, Sheet } from 'lucide-react';
import { getProcessList, getVerticalProduction, getVerticalPendencies, saveAppointment, saveProductionPlanBatch, getFileUrl, getCompanySettings, reportSystemError, getChecklist, saveChecklist, uploadChecklistPhoto, getEstruturaProduto } from '../services/api';
import { toast } from 'react-toastify';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ProductionAppointmentModal from '../components/ProductionAppointmentModal';
import ProductionHistoryModal from '../components/ProductionHistoryModal';
import RNCModal from '../components/RNCModal';
import ErrorStateOverlay from '../components/ErrorStateOverlay';
import useStickyState from '../hooks/useStickyState';
import PCPMetalDrawer from '../components/PCPMetalDrawer';
import { generateVerticalPendingPdf } from '../services/verticalPendingPdfGenerator';
import { generateVerticalGeralPdf, generateVerticalGeralExcel } from '../services/verticalGeralReportGenerator';
import { useAuth } from '../contexts/AuthContext';
import { generateChecklistPdf } from '../services/checklistPdfGenerator';

const getStatusColor = (status) => {
    if (status === 'CONCLUIDO') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (status === 'PARCIAL') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-rose-50 text-rose-600 border-rose-200';
};

const getStatusIcon = (status) => {
    if (status === 'CONCLUIDO') return <CheckCircle className="w-4 h-4" />;
    if (status === 'PARCIAL') return <Clock className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
};

const VerticalOpRow = React.memo(({ row, opKey, isActive, onRowClick, draftDate, onOpenHistory, onOpenRnc, onOpenAppointment, onOpenChecklist, getFileUrl }) => {
    const cappedQtdApontada = Math.min(row.qtd_apontada, parseFloat(row.qtd_op) || 0);
    const percent = row.qtd_op > 0 ? Math.round((cappedQtdApontada / parseFloat(row.qtd_op)) * 100) : 0;

    return (
        <tr 
            onClick={() => onRowClick(opKey)}
            className={`border-b border-slate-100 transition-colors cursor-pointer ${
                isActive 
                    ? 'bg-indigo-50 ring-2 ring-indigo-500/50 outline-none z-10 relative' 
                    : (row.sequen_op === '001' ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-slate-50')
            }`}
        >
            <td className="p-3 sticky left-0 z-10 bg-inherit min-w-[160px]">
                <div className="font-mono text-sm font-bold text-slate-900">{row.op} - Item {row.item_op}</div>
                <div className="text-xs text-slate-400">Seq: {row.sequen_op}</div>
            </td>
            <td className="p-3 sticky left-[160px] z-10 bg-inherit min-w-[100px] border-l border-slate-100/50">
                {row.pedido ? (
                    <div>
                        <div className="font-semibold text-slate-700">{row.pedido}</div>
                        {row.item_pedido && <div className="text-xs text-slate-500">{row.item_pedido}</div>}
                    </div>
                ) : (
                    <span className="text-slate-400 text-xs">-</span>
                )}
            </td>
            <td className="p-3 sticky left-[260px] z-10 bg-inherit min-w-[180px] border-l border-slate-100/50">
                <div className="font-medium text-slate-700 max-w-[180px] truncate" title={row.nome_cliente}>{row.nome_cliente || '-'}</div>
            </td>
            <td className="p-3 sticky left-[440px] z-10 bg-inherit min-w-[260px] border-l border-slate-100/50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                <div className="font-mono text-xs text-blue-600 font-semibold" title={row.produto}>{row.produto}</div>
                <div className="text-xs text-slate-500 truncate max-w-[220px] mt-0.5" title={row.desc_produto}>{row.desc_produto}</div>
                {row.componente_buscado && (
                    <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        ⤷ {row.componente_buscado}
                    </div>
                )}
            </td>
            <td className="p-3 text-center">
                {row.tem_arquivos ? (
                    <div className="relative group flex justify-center">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (row.arquivos && row.arquivos.length === 1) {
                                    window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(row.arquivos[0].url_arquivo)}`), '_blank');
                                } else if (row.primeiro_arquivo && (!row.arquivos || row.arquivos.length === 0)) {
                                    window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(row.primeiro_arquivo)}`), '_blank');
                                }
                            }}
                            className="relative p-1 rounded hover:bg-red-50 transition-colors"
                            title={row.arquivos && row.arquivos.length > 1 ? 'Ver Arquivos' : 'Ver Desenho / PDF'}
                        >
                            <FileText className="w-4 h-4 text-red-500" />
                            {row.arquivos && row.arquivos.length > 1 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full shadow-sm ring-1 ring-white">
                                    {row.arquivos.length}
                                </span>
                            )}
                        </button>
                        {row.arquivos && row.arquivos.length > 1 && (
                            <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 flex flex-col p-1.5 gap-0.5">
                                <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Arquivos do Produto</span>
                                </div>
                                {row.arquivos.filter(arq => arq.url_arquivo && arq.url_arquivo.trim() !== '').map((arq, idx) => {
                                    const extMatch = (arq.url_arquivo || '').match(/\.([a-zA-Z0-9]+)$/);
                                    const ext = extMatch ? extMatch[1].toUpperCase() : 'DOC';
                                    let typeColor = 'bg-slate-100 text-slate-500';
                                    if (ext === 'PDF') typeColor = 'bg-red-100 text-red-600 border-red-200';
                                    else if (ext === 'DXF') typeColor = 'bg-blue-100 text-blue-600 border-blue-200';
                                    else if (ext === 'DWG') typeColor = 'bg-emerald-100 text-emerald-600 border-emerald-200';
                                    else if (ext === 'STEP' || ext === 'STP') typeColor = 'bg-indigo-100 text-indigo-600 border-indigo-200';
                                    const fileName = arq.titulo || `Arquivo ${idx + 1}`;
                                    return (
                                        <button key={idx} onClick={(e) => { e.stopPropagation(); window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(arq.url_arquivo)}`), '_blank'); }} className="text-left px-2 py-1.5 hover:bg-slate-50 rounded-md transition-colors flex flex-col group/item border border-transparent hover:border-slate-200" title={fileName}>
                                            <div className="flex items-center justify-between w-full">
                                                <span className="text-xs font-bold text-slate-700 group-hover/item:text-blue-600">{arq.tipo || 'Desenho'}</span>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${typeColor}`}>{ext}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 truncate w-full mt-0.5">{fileName}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <FileText className="w-4 h-4 text-slate-300 mx-auto" title="Sem PDF associado" />
                )}
            </td>
            <td className="p-3 text-center">
                {row.planejamento_inicio ? (
                    <div className="text-xs flex flex-col items-center gap-0.5">
                        <div className="text-green-700 font-medium whitespace-nowrap">
                            I: {row.planejamento_inicio.substring(0, 10).split('-').reverse().join('/')}
                        </div>
                        {row.dias_espera > 0 && (
                            <div className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-200" title="Dias aguardando entre recursos">
                                Espera: {row.dias_espera}d
                            </div>
                        )}
                    </div>
                ) : (
                    <span className="text-slate-400 italic text-xs">Não planejado</span>
                )}
                {row.ultima_data_apontamento && (
                    <div className="mt-1.5 text-[10px] text-slate-500 leading-tight border-t border-slate-100 pt-1.5">
                        <div className="text-slate-400 uppercase tracking-wider mb-0.5" style={{ fontSize: '9px' }}>Último Apontamento:</div>
                        <div className="font-semibold text-slate-600 truncate max-w-[130px]" title={row.usuarios_apontamento}>
                            {row.usuarios_apontamento?.split(',')[0]}
                        </div>
                        <div>{new Date(row.ultima_data_apontamento).toLocaleDateString('pt-BR')} às {new Date(row.ultima_data_apontamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                )}
            </td>
            <td className="p-3 text-center">
                <div className="flex flex-col items-center justify-center">
                    <div
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer mb-1 hover:underline"
                        title="Clique para ver histórico detalhado"
                        onClick={(e) => { e.stopPropagation(); onOpenHistory(row); }}
                    >
                        {cappedQtdApontada} / {parseFloat(row.qtd_op).toFixed(0)}
                    </div>
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full ${percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }} />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">({percent}%)</div>
                </div>
            </td>
            <td className="p-3 text-center">
                <div className="flex flex-col items-center justify-center gap-1">
                    <div className="text-[10px] text-slate-500 font-bold uppercase" title="Tempo Padrão Unitário">
                        Unid: {row.tempad > 0 ? `${Number(row.tempad).toFixed(3).replace('.', ',')} min` : '-'}
                    </div>
                    <div className="text-xs text-indigo-700 font-bold" title="Tempo Total Pendente (Unitário x Saldo + Setup)">
                        Total: {row.tempad > 0 ? `${Number((row.tempad * Math.max(0, parseFloat(row.qtd_op) - cappedQtdApontada)) + (cappedQtdApontada === 0 ? (row.setup || 0) : 0)).toFixed(2).replace('.', ',')} min` : '-'}
                    </div>
                </div>
            </td>
            <td className="p-3 text-center">
                {row.op_anterior ? (
                    <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono shadow-sm">
                            {row.op_anterior.recurso_codigo || row.op_anterior.operacao_codigo}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">Seq: {row.op_anterior.operacao_codigo}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            row.op_anterior.status === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            row.op_anterior.status === 'PARCIAL'   ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                                     'bg-rose-50 text-rose-600 border-rose-200'
                        }`}>
                            {row.op_anterior.status === 'CONCLUIDO' ? '✓ OK' :
                             row.op_anterior.status === 'PARCIAL'   ? '⚡ Parcial' : '⏳ Pendente'}
                        </span>
                        {row.op_anterior.status !== 'CONCLUIDO' && (
                            <span className="text-[9px] text-slate-400">{Math.min(row.op_anterior.qtd_apontada, parseFloat(row.qtd_op) || 0)}/{parseFloat(row.qtd_op).toFixed(0)}</span>
                        )}
                    </div>
                ) : (
                    <span className="text-slate-300 text-xs" title="Primeira operação do roteiro">—</span>
                )}
            </td>
            <td className="p-3 text-center">
                <div className="bg-blue-50 text-blue-700 inline-block px-2 py-0.5 rounded text-xs font-bold border border-blue-100 mb-1 font-mono shadow-sm">
                    {row.recurso_codigo || row.operacao_codigo}
                </div>
                <div className="text-[9px] font-mono text-slate-400">Seq: {row.operacao_codigo}</div>
                <div className="text-xs text-slate-600 truncate max-w-[140px] mx-auto" title={row.operacao_desc}>{row.operacao_desc}</div>
            </td>
            <td className="p-3 text-center">
                {row.op_proxima ? (
                    <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono shadow-sm">
                            {row.op_proxima.recurso_codigo || row.op_proxima.operacao_codigo}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">Seq: {row.op_proxima.operacao_codigo}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            row.op_proxima.status === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            row.op_proxima.status === 'PARCIAL'   ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                                     'bg-rose-50 text-rose-600 border-rose-200'
                        }`}>
                            {row.op_proxima.status === 'CONCLUIDO' ? '✓ OK' :
                             row.op_proxima.status === 'PARCIAL'   ? '⚡ Parcial' : '⏳ Pendente'}
                        </span>
                        {row.op_proxima.status !== 'CONCLUIDO' && (
                            <span className="text-[9px] text-slate-400">{Math.min(row.op_proxima.qtd_apontada, parseFloat(row.qtd_op) || 0)}/{parseFloat(row.qtd_op).toFixed(0)}</span>
                        )}
                    </div>
                ) : (
                    <span className="text-slate-300 text-xs" title="Última operação do roteiro">—</span>
                )}
            </td>
            <td className="p-3 text-center">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(row.status)}`}>
                    {getStatusIcon(row.status)}
                    <span>{row.status}</span>
                </div>
                {row.tem_pendencia_conferencia && (
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3" />
                        Conf. Pendente
                    </div>
                )}
            </td>
            <td className="p-3 text-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenChecklist(row); }}
                    className={`p-1.5 rounded transition-colors border ${
                        row.checklist_status === 'FINALIZADO'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                            : row.checklist_status === 'RASCUNHO'
                            ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={
                        row.checklist_status === 'FINALIZADO' ? 'Checklist Finalizado' :
                        row.checklist_status === 'RASCUNHO' ? 'Checklist em Rascunho' : 'Iniciar Checklist'
                    }
                >
                    <ClipboardList className="w-4 h-4" />
                </button>
            </td>
            <td className="p-3 text-right">
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenHistory(row); }}
                        className="text-sm font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded border border-slate-200 hover:border-indigo-200 transition-colors flex items-center gap-1.5"
                        title="Ver histórico de apontamentos"
                    >
                        <History className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenRnc(row); }}
                        className="text-sm font-bold text-slate-500 hover:text-amber-600 hover:bg-amber-50 px-2 py-1.5 rounded border border-slate-200 hover:border-amber-200 transition-colors flex items-center gap-1.5"
                        title="Registro de Não-Conformidade (RNC)"
                    >
                        <AlertTriangle className="w-3.5 h-3.5" /> RNC
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenAppointment(row); }}
                        className={`text-sm font-bold px-3 py-1.5 rounded shadow-sm transition-colors flex items-center justify-center gap-1.5 ${row.status === 'CONCLUIDO' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                        style={{ minWidth: '100px' }}
                    >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        APONTAR
                    </button>
                </div>
            </td>
        </tr>
    );
});

export default function VerticalAppointmentPage() {
    const { user } = useAuth();
    const [groupByResource, setGroupByResource] = useState(false);
    const [pageBreakPerGroup, setPageBreakPerGroup] = useState(false);
    const [operations, setOperations] = useState([]);
    const [selectedOp, setSelectedOp] = useStickyState('', '@metalfisa:vert_selectedOp');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState(null);
    const [wasSearched, setWasSearched] = useState(false);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ hasMore: false, total: 0, limit: 200 });

    // Filtros rápidos
    const [filterStatus, setFilterStatus] = useStickyState('ABERTOS', '@metalfisa:vert_statusFilter_v2');
    const [filters, setFilters] = useStickyState({
        op: '',
        pedido: '',
        produto: '',
        cliente: '',
        plan_inicio_ate: ''
    }, '@metalfisa:vert_mainFilters_v4');

    const [appointingOp, setAppointingOp] = useState(null);
    const [historyTarget, setHistoryTarget] = useState(null);
    const [recordingField, setRecordingField] = useState(null);
    const [activeRowKey, setActiveRowKey] = useState(null);
    const [pcpmetalOpen, setPcpmetalOpen] = useState(false);
    const [pcpmetalContext, setPcpmetalContext] = useState({});

    const handleOpenAIHelp = () => {
        setPcpmetalContext({
            page: 'apontamento-vertical',
            recurso: selectedOp || null,
            totalOps: data.length
        });
        setPcpmetalOpen(true);
    };

    useEffect(() => {
        if (!filters.plan_inicio_ate) {
            const today = new Date();
            const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            setFilters(prev => ({...prev, plan_inicio_ate: todayStr}));
        }
    }, []);

    const handleVoiceInput = (field) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error("Reconhecimento de voz não suportado neste navegador.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setRecordingField(field);
        recognition.onresult = (event) => {
            let transcript = event.results[0][0].transcript.trim().toUpperCase();
            if (field === 'op' || field === 'pedido') transcript = transcript.replace(/[^0-9]/g, '');
            setFilters(prev => ({ ...prev, [field]: transcript }));
        };
        recognition.onerror = () => setRecordingField(null);
        recognition.onend = () => setRecordingField(null);
        recognition.start();
    };
    const [rncTarget, setRncTarget] = useState(null);
    const [appointmentMode, setAppointmentMode] = useState(null);
    const [checklistTarget, setChecklistTarget] = useState(null);

    const handleOpenChecklist = (row) => {
        setChecklistTarget(row);
    };

    // Estado local para datas de planejamento em edição
    const [draftPlans, setDraftPlans] = useState({});
    const [sortConfig, setSortConfig] = useState({ key: 'planejamento_inicio', direction: 'asc' });

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <span className="ml-1 opacity-0 group-hover:opacity-50">↕</span>;
        if (sortConfig.direction === 'asc') return <span className="ml-1">↑</span>;
        return <span className="ml-1">↓</span>;
    };

    useEffect(() => {
        loadOperations();
        getCompanySettings()
            .then(d => setAppointmentMode(d?.general_config?.production_appointment_mode || 'free'))
            .catch(() => setAppointmentMode('free'));
    }, []);

    // Atualizar busca caso alterem a aba de status ou ordenação e já houver busca ativa
    useEffect(() => {
        if (wasSearched) {
            setPage(1);
            loadData(true, 1);
        }
    }, [filterStatus, sortConfig.key, sortConfig.direction]);

    const loadOperations = async () => {
        try {
            const list = await getProcessList();
            setOperations(Array.isArray(list) ? list : (list?.data || []));
        } catch (err) {
            console.error('Erro ao carregar operações', err);
        }
    };

    const loadData = async (showLoader = true, targetPage = page, append = false) => {
        if (!selectedOp) return;

        const hasFilter = filters.op || filters.pedido || filters.produto || filters.cliente || filters.plan_inicio_ate;
        if (!hasFilter) {
            setData([]);
            setWasSearched(false);
            if (showLoader) setLoading(false);
            return;
        }

        if (showLoader && !append) { setLoading(true); setData([]); }
        setApiError(null);
        try {
            const params = { 
                ...filters, 
                page: targetPage, 
                limit: 200,
                status: filterStatus,
                sort_key: sortConfig.key,
                sort_dir: sortConfig.direction
            };
            Object.keys(params).forEach(key => !params[key] && delete params[key]);

            const result = await getVerticalProduction(selectedOp, params);
            const rows = result?.data ?? (Array.isArray(result) ? result : []);
            
            if (append) {
                setData(prev => [...prev, ...rows]);
            } else {
                setData(rows);
            }
            
            if (result?.pagination) setPagination(result.pagination);
            setWasSearched(true);
            setDraftPlans({});
        } catch (err) {
            console.error('Erro ao carregar fila vertical', err);
            setApiError(err.message || 'Erro desconhecido');
            reportSystemError('Apontamento Vertical', err, { op: selectedOp, ...filters });
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const handleSearch = () => {
        if (!selectedOp) {
            toast.warning('Selecione um Recurso antes de buscar.');
            return;
        }
        if (!filters.op && !filters.pedido && !filters.produto && !filters.cliente && !filters.plan_inicio_ate) {
            toast.warning('Informe ao menos um filtro (OP, Pedido, Cliente, Produto ou Período) para buscar.');
            return;
        }
        setPage(1);
        loadData(true, 1);
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        loadData(true, newPage);
    };


    const handlePlanChange = (opKey, dateStr) => {
        setDraftPlans(prev => ({ ...prev, [opKey]: dateStr }));
    };


    const getWeekStart = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    };

    const setDateShortcut = (type) => {
        const now = new Date();
        let start = new Date(now);
        let end = new Date(now);

        const fmt = (d) => {
            const yr = d.getFullYear();
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0');
            return `${yr}-${mo}-${da}`;
        };

        if (type === 'today') {
            // now
        } else if (type === 'this_week') {
            start = getWeekStart(now);
            end = new Date(start);
            end.setDate(end.getDate() + 6);
        } else if (type === 'next_week') {
            start = getWeekStart(now);
            start.setDate(start.getDate() + 7);
            end = new Date(start);
            end.setDate(end.getDate() + 6);
        } else if (type === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        setFilters(prev => ({ ...prev, plan_inicio_ate: fmt(end) }));
    };

    const savePlan = async (row) => {
        const opKey = `${row.op}_${row.item_op}_${row.sequen_op}`;
        const newDate = draftPlans[opKey];
        if (!newDate) return;

        try {
            const planPayload = [{
                op_numero: row.op,
                op_item: row.item_op,
                op_sequencia: row.sequen_op,
                operacao_codigo: row.operacao_codigo,
                data_planejada_inicio: newDate,
                data_planejada_fim: newDate
            }];

            await saveProductionPlanBatch(planPayload);
            toast.success('Planejamento salvo com sucesso!');
            loadData(false);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao salvar planejamento');
        }
    };

    const buildOpObj = (row) => ({
        op: row.op,
        item_op: row.item_op,
        sequen: row.sequen_op,
        operacao: row.operacao_codigo,
        operacao_coluna: row.operacao_codigo,
        recurso: row.operacao_codigo,
        cod_produto_op: row.produto,
        desc_produto: row.desc_produto,
        desc_operacao: row.operacao_desc || row.operacao_codigo,
        qtd_planejada_op: parseFloat(row.qtd_op) || 0,
        qtd_produzida_real: row.qtd_apontada || 0,
        pedido: row.pedido,
        item_pedido: row.item_pedido,
        cliente: row.cliente || row.nome_cliente,
    });

    const handleOpenAppointment = (row) => {
        setAppointingOp(buildOpObj(row));
    };

    const handleOpenHistory = (row) => {
        setHistoryTarget(buildOpObj(row));
    };

    const handleOpenRnc = (row) => {
        setRncTarget(buildOpObj(row));
    };

    const handleAppointmentSave = async (dataPayload) => {
        // API chamada movida para dentro do Modal
        setAppointingOp(null);
        loadData(false);
    };

    const handleGeneratePendingReport = async () => {
        if (!filters.op && !filters.pedido && !filters.produto && !filters.cliente && !filters.plan_inicio_ate) {
            toast.warning('Informe ao menos um filtro para buscar pendências no relatório.');
            return;
        }

        try {
            toast.info('Gerando relatório...', { autoClose: 2000 });
            const params = { ...filters };
            Object.keys(params).forEach(key => !params[key] && delete params[key]);

            const pendencies = await getVerticalPendencies(params);

            if (!pendencies || pendencies.length === 0) {
                toast.warning('Não há operações pendentes no roteiro para os filtros atuais.');
                return;
            }

            generateVerticalPendingPdf(pendencies, filters, user, groupByResource, pageBreakPerGroup);

        } catch (err) {
            console.error('Erro ao gerar relatório de pendências', err);
            toast.error('Falha ao exportar PDF de Pendências.');
        }
    };

    // Filter logic memorizado
    const filteredData = React.useMemo(() => {
        return data.filter(row => {
            if (filterStatus === 'ABERTOS' && row.status === 'CONCLUIDO') return false;
            if (filterStatus !== 'ALL' && filterStatus !== 'ABERTOS' && row.status !== filterStatus) return false;
            return true;
        }).sort((a, b) => {
            if (sortConfig.key === 'planejamento_inicio') {
                const dateA = a.planejamento_inicio ? new Date(a.planejamento_inicio).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
                const dateB = b.planejamento_inicio ? new Date(b.planejamento_inicio).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
                if (dateA !== dateB) return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
                return a.op.localeCompare(b.op);
            }
            if (sortConfig.key === 'data_entrega') {
                const dateA = a.data_entrega ? new Date(a.data_entrega).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
                const dateB = b.data_entrega ? new Date(b.data_entrega).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
                return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
            }

            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            if (sortConfig.key === 'progresso') {
                aVal = a.qtd_op > 0 ? (a.qtd_apontada / a.qtd_op) : 0;
                bVal = b.qtd_op > 0 ? (b.qtd_apontada / b.qtd_op) : 0;
            }

            if (aVal === bVal) return 0;
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;
            
            if (typeof aVal === 'string') {
                return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }, [data, filterStatus, sortConfig]);

    const handleGeralPdf = () => {
        if (!filteredData || filteredData.length === 0) {
            toast.warning('Não há dados na tabela para exportar. Realize uma busca primeiro.');
            return;
        }
        try {
            toast.info('Gerando PDF...', { autoClose: 1500 });
            generateVerticalGeralPdf(filteredData, selectedOp, filters, user);
        } catch (err) {
            console.error('Erro ao gerar PDF geral', err);
            toast.error('Falha ao gerar PDF do Relatório Geral.');
        }
    };

    const handleGeralExcel = () => {
        if (!filteredData || filteredData.length === 0) {
            toast.warning('Não há dados na tabela para exportar. Realize uma busca primeiro.');
            return;
        }
        try {
            toast.info('Gerando Excel...', { autoClose: 1500 });
            generateVerticalGeralExcel(filteredData, selectedOp, filters, user);
        } catch (err) {
            console.error('Erro ao gerar Excel geral', err);
            toast.error('Falha ao gerar Excel do Relatório Geral.');
        }
    };

    return (
        <div className="p-6 space-y-4 h-[calc(100vh-4rem)] flex flex-col">
            {pcpmetalOpen && (
                <PCPMetalDrawer
                    isOpen={pcpmetalOpen}
                    onClose={() => setPcpmetalOpen(false)}
                    context={pcpmetalContext}
                    pageData={{
                        ops: data,
                        selectedOps: [],
                        filters: { ...filters, recurso: selectedOp },
                        total: data.length
                    }}
                />
            )}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <List className="w-7 h-7 text-blue-600" />
                        Fila de Produção por Setor (Vertical)
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">Selecione uma operação para planejar e apontar a fila de trabalho.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleOpenAIHelp}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-md transition-all font-semibold"
                    >
                        <Bot className="w-5 h-5 animate-pulse" />
                        PCPMetal AI
                    </button>
                    {appointmentMode && (
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                            appointmentMode === 'sequence' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            appointmentMode === 'balance'  ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                              'bg-slate-100 text-slate-500 border-slate-300'
                        }`}>
                            Apontamento: {appointmentMode === 'sequence' ? 'Sequencia' :
                                          appointmentMode === 'balance'  ? 'Saldo' : 'Livre'}
                        </span>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4 shrink-0">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="w-full md:w-[350px]">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-2" title="Filtra por código de Recurso do roteiro (ex: MO0003). Cada recurso representa um setor ou máquina.">
                                <List className="w-3.5 h-3.5 text-blue-500" />
                                Recurso <span className="text-red-500">*</span>
                                <span className="text-[10px] font-normal text-slate-400 normal-case tracking-normal">(setor/máquina)</span>
                            </label>
                            <select
                                className="w-full border-2 border-slate-100 rounded-lg p-2.5 text-sm bg-slate-50 font-bold text-slate-800 focus:border-blue-500 focus:ring-0 transition-all cursor-pointer shadow-sm"
                                value={selectedOp}
                                onChange={(e) => setSelectedOp(e.target.value)}
                            >
                                <option value="">-- Selecione o Recurso --</option>
                                {operations.map((op, index) => (
                                    <option
                                        key={op.codigo || index}
                                        value={op.codigo}
                                    >
                                        {op.codigo}{op.descricao ? ` — ${op.descricao}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-3 bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
                            <div className="relative">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">OP</label>
                                <input
                                    type="text"
                                    placeholder="Ex: 001234"
                                    value={filters.op}
                                    onChange={(e) => setFilters(prev => ({ ...prev, op: e.target.value.toUpperCase() }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleVoiceInput('op')}
                                    className={`absolute right-2 top-8 p-1.5 rounded-full transition-colors ${recordingField === 'op' ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'}`}
                                    title="Ditar OP"
                                >
                                    <Mic className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="relative">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Pedido</label>
                                <input
                                    type="text"
                                    placeholder="PV..."
                                    value={filters.pedido}
                                    onChange={(e) => setFilters(prev => ({ ...prev, pedido: e.target.value.toUpperCase() }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleVoiceInput('pedido')}
                                    className={`absolute right-2 top-8 p-1.5 rounded-full transition-colors ${recordingField === 'pedido' ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'}`}
                                    title="Ditar Pedido"
                                >
                                    <Mic className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="relative">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Produto</label>
                                <input
                                    type="text"
                                    placeholder="Nome/Código"
                                    value={filters.produto}
                                    onChange={(e) => setFilters(prev => ({ ...prev, produto: e.target.value.toUpperCase() }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleVoiceInput('produto')}
                                    className={`absolute right-2 top-8 p-1.5 rounded-full transition-colors ${recordingField === 'produto' ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'}`}
                                    title="Ditar Produto"
                                >
                                    <Mic className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="relative">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Cliente</label>
                                <input
                                    type="text"
                                    placeholder="Razão Social"
                                    value={filters.cliente}
                                    onChange={(e) => setFilters(prev => ({ ...prev, cliente: e.target.value.toUpperCase() }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleVoiceInput('cliente')}
                                    className={`absolute right-2 top-8 p-1.5 rounded-full transition-colors ${recordingField === 'cliente' ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'}`}
                                    title="Ditar Cliente"
                                >
                                    <Mic className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="col-span-2 md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Plan. Início até</label>
                                <input
                                    type="date"
                                    value={filters.plan_inicio_ate}
                                    onChange={(e) => {
                                        let val = e.target.value;
                                        if (val && val.startsWith('00')) {
                                            val = '20' + val.substring(2);
                                        }
                                        setFilters(prev => ({ ...prev, plan_inicio_ate: val }));
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm"
                                />
                            </div>
                            <div className="flex gap-2 justify-start col-span-2 md:col-span-6 w-full pt-1">
                                <button onClick={() => setDateShortcut('today')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors shadow-sm">Hoje</button>
                                <button onClick={() => setDateShortcut('this_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors shadow-sm">Semana</button>
                                <button onClick={() => setDateShortcut('next_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors shadow-sm">Próx. Sem.</button>
                                <button onClick={() => setDateShortcut('this_month')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors shadow-sm">Mês</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center pt-3 border-t gap-3">
                    <div className="flex gap-2 text-sm flex-wrap">
                        <button
                            onClick={() => setFilterStatus('ALL')}
                            className={`px-3 py-1 rounded-full border ${filterStatus === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterStatus('ABERTOS')}
                            className={`px-3 py-1 rounded-full border border-blue-200 ${filterStatus === 'ABERTOS' ? 'bg-blue-100 text-blue-800 font-medium' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            Em Aberto
                        </button>
                        <button
                            onClick={() => setFilterStatus('PENDENTE')}
                            className={`px-3 py-1 rounded-full border border-rose-200 ${filterStatus === 'PENDENTE' ? 'bg-rose-100 text-rose-800 font-medium' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            Pendentes
                        </button>
                        <button
                            onClick={() => setFilterStatus('PARCIAL')}
                            className={`px-3 py-1 rounded-full border border-amber-200 ${filterStatus === 'PARCIAL' ? 'bg-amber-100 text-amber-800 font-medium' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            Parciais
                        </button>
                        <button
                            onClick={() => setFilterStatus('CONCLUIDO')}
                            className={`px-3 py-1 rounded-full border border-emerald-200 ${filterStatus === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-800 font-medium' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            Concluídos
                        </button>
                    </div>

                    <div className="flex gap-2 items-center w-full md:w-auto mt-2 md:mt-0">
                        <button
                            onClick={() => {
                                setFilters({ op: '', pedido: '', produto: '', cliente: '', plan_inicio_ate: '' });
                                setFilterStatus('ABERTOS');
                                setData([]);
                                setWasSearched(false);
                                setPage(1);
                                setPagination({ hasMore: false, total: 0, limit: 200 });
                            }}
                            className="px-4 py-2 border rounded text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            Limpar Filtros
                        </button>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded border cursor-pointer hover:bg-slate-100 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={groupByResource} 
                                onChange={(e) => {
                                    setGroupByResource(e.target.checked);
                                    if (!e.target.checked) setPageBreakPerGroup(false);
                                }}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            Agrupar por Operação
                        </label>
                        {groupByResource && (
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded border cursor-pointer hover:bg-slate-100 transition-colors" title="Imprimir cada recurso em uma folha separada">
                                <input 
                                    type="checkbox" 
                                    checked={pageBreakPerGroup} 
                                    onChange={(e) => setPageBreakPerGroup(e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                Folhas Individuais
                            </label>
                        )}
                        <div className="flex items-center gap-1.5 flex-1 md:flex-none">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">Rel. Geral:</span>
                            <button
                                onClick={handleGeralPdf}
                                className="bg-red-700 hover:bg-red-800 text-white px-3 py-2 rounded text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                                title="Exportar Relatório Geral — PDF A4 deitado (padrão MetalFisa)"
                            >
                                <FileDown className="w-4 h-4" />
                                PDF
                            </button>
                            <button
                                onClick={handleGeralExcel}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                                title="Exportar Relatório Geral — Excel com todos os campos"
                            >
                                <FileDown className="w-4 h-4" />
                                Excel
                            </button>
                            <button
                                onClick={handleGeneratePendingReport}
                                className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                title="Relatório de Pendências do roteiro completo (ignora o Centro de Custo atual)"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                Pendências
                            </button>
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={loading || !selectedOp}
                            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 flex-1 md:flex-none"
                        >
                            <Filter className="w-4 h-4" />
                            Buscar
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            <ErrorStateOverlay error={apiError} onRetry={loadData} />

            {/* Grid */}
            {!apiError && (loading ? (
                <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                    <div className="animate-pulse text-slate-500 font-medium">Carregando fila de trabalho...</div>
                </div>
            ) : !selectedOp ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                            <List className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="font-semibold text-slate-700 text-base">Selecione um Recurso para começar</div>
                        <div className="text-sm text-slate-500">Escolha o setor/máquina no campo <strong>Recurso</strong> acima e clique em <strong>Buscar</strong>.</div>
                    </div>
                </div>
            ) : data.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-slate-500">
                    {wasSearched ? (
                        /* Buscou mas não achou nada — mostrar diagnóstico útil */
                        <>
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                                </div>
                                <div className="font-semibold text-slate-700 text-base">Nenhuma operação encontrada para estes filtros</div>
                            </div>
                            <div className="mt-4 max-w-md mx-auto text-sm text-slate-500 space-y-2 text-left bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="font-semibold text-amber-800 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> Possíveis causas:
                                </p>
                                <ul className="list-disc list-inside space-y-1.5 text-amber-700">
                                    <li>O produto do pedido/OP informado <strong>não passa pelo recurso <span className="font-mono">{selectedOp}</span></strong> em seu roteiro de fabricação (SG2010).</li>
                                    <li>O filtro <strong>PEDIDO</strong> deve conter o número do Pedido de Venda (ex: <span className="font-mono">003731</span>) — não o número da OP.</li>
                                    <li>O filtro <strong>OP</strong> deve conter o número da Ordem de Produção (ex: <span className="font-mono">005909</span>).</li>
                                    <li>O pedido pode estar <strong>inativo/arquivado</strong> no sistema.</li>
                                </ul>
                                <p className="text-amber-600 text-xs pt-1 border-t border-amber-200">💡 Dica: Verifique em qual setor/recurso esse produto é fabricado e selecione-o no campo Recurso.</p>
                            </div>
                        </>
                    ) : (
                        /* Ainda não buscou — instrução padrão */
                        <>
                            <div className="font-medium text-slate-700 text-base">Nenhuma operação em exibição</div>
                            <div className="text-sm mt-1 mb-2">Por questões de performance, a busca não é automática. <br />Verifique se selecionou um <strong>Centro de Custo</strong> e informou ao menos <strong>um Filtro</strong> para buscar.</div>
                        </>
                    )}
                </div>
            ) : filteredData.length > 0 ? (
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="overflow-auto flex-1 min-h-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                                <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-50">
                                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition-colors sticky top-0 left-0 z-30 bg-slate-50 min-w-[160px]" onClick={() => requestSort('op')}>
                                        <div className="flex items-center gap-1">Ordem de Produção {getSortIcon('op')}</div>
                                    </th>
                                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition-colors sticky top-0 left-[160px] z-30 bg-slate-50 min-w-[100px] border-l border-slate-200" onClick={() => requestSort('pedido')}>
                                        <div className="flex items-center gap-1">Pedido {getSortIcon('pedido')}</div>
                                    </th>
                                    <th className="p-3 sticky top-0 left-[260px] z-30 bg-slate-50 min-w-[180px] border-l border-slate-200">Cliente</th>
                                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition-colors sticky top-0 left-[440px] z-30 bg-slate-50 min-w-[260px] border-l border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" onClick={() => requestSort('produto')}>
                                        <div className="flex items-center gap-1">Produto {getSortIcon('produto')}</div>
                                    </th>
                                    <th className="p-3 text-center w-10 sticky top-0 z-20 bg-slate-50">PDF</th>
                                    <th className="p-3 text-center cursor-pointer hover:bg-slate-100 transition-colors sticky top-0 z-20 bg-slate-50" onClick={() => requestSort('planejamento_inicio')}>
                                        <div className="flex items-center justify-center gap-1">Planejamento {getSortIcon('planejamento_inicio')}</div>
                                    </th>
                                    <th className="p-3 text-center cursor-pointer hover:bg-slate-100 transition-colors sticky top-0 z-20 bg-slate-50" onClick={() => requestSort('progresso')}>
                                        <div className="flex items-center justify-center gap-1">Produção {getSortIcon('progresso')}</div>
                                    </th>
                                    <th className="p-3 text-center sticky top-0 z-20 bg-slate-50">Tempos</th>
                                    <th className="p-3 text-center sticky top-0 z-20 bg-slate-50" title="Status da operação anterior no roteiro do produto">
                                        <div className="flex items-center justify-center gap-1">Op. Ant.</div>
                                    </th>
                                    <th className="p-3 text-center cursor-pointer hover:bg-slate-100 transition-colors sticky top-0 z-20 bg-slate-50" onClick={() => requestSort('recurso_codigo')}>
                                        <div className="flex items-center justify-center gap-1">Op. Atual {getSortIcon('recurso_codigo')}</div>
                                    </th>
                                    <th className="p-3 text-center sticky top-0 z-20 bg-slate-50" title="Status da próxima operação no roteiro do produto">
                                        <div className="flex items-center justify-center gap-1">Op. Prox.</div>
                                    </th>
                                    <th className="p-3 text-center cursor-pointer hover:bg-slate-100 transition-colors sticky top-0 z-20 bg-slate-50" onClick={() => requestSort('status')}>
                                        <div className="flex items-center justify-center gap-1">Status {getSortIcon('status')}</div>
                                    </th>
                                    <th className="p-3 text-center sticky top-0 z-20 bg-slate-50">Checklist</th>
                                    <th className="p-3 text-right sticky top-0 z-20 bg-slate-50">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.map(row => {
                                    const opKey = `${row.op}_${row.item_op}_${row.sequen_op}`;
                                    const draftDate = draftPlans[opKey] !== undefined ? draftPlans[opKey] : (row.planejamento_inicio ? row.planejamento_inicio.substring(0, 10) : '');

                                    return (
                                        <VerticalOpRow
                                            key={opKey}
                                            row={row}
                                            opKey={opKey}
                                            isActive={activeRowKey === opKey}
                                            onRowClick={setActiveRowKey}
                                            draftDate={draftDate}
                                            onOpenHistory={handleOpenHistory}
                                            onOpenRnc={handleOpenRnc}
                                            onOpenAppointment={handleOpenAppointment}
                                            onOpenChecklist={handleOpenChecklist}
                                            getFileUrl={getFileUrl}
                                        />
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan="6" className="px-4 py-3 text-right font-bold text-slate-700">
                                        TOTAL GERAL (Exibidos na Tela):
                                    </td>
                                    <td className="px-4 py-3 font-bold text-slate-800">
                                        {filteredData.reduce((acc, row) => acc + parseFloat(row.qtd_op || 0), 0).toFixed(2)} Plan. / {filteredData.reduce((acc, row) => acc + parseFloat(row.qtd_apontada || 0), 0).toFixed(2)} Apont.
                                    </td>
                                    <td colSpan="6" />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    {/* Paginação / Carregamento em Lote */}
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50 text-sm">
                        <div className="text-slate-600">
                            {pagination.hasMore ? (
                                <span>
                                    Mostrando <strong>{filteredData.length}</strong> de <strong>{pagination.total > filteredData.length ? pagination.total : '200+'}</strong> resultados
                                    <span className="ml-2 text-amber-600 font-medium">— carregando em lotes</span>
                                </span>
                            ) : (
                                <span>
                                    <strong>{filteredData.length}</strong> resultado(s) carregado(s)
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {pagination.hasMore && (
                                <button
                                    disabled={loading}
                                    onClick={() => {
                                        const nextPage = page + 1;
                                        setPage(nextPage);
                                        loadData(false, nextPage, true); // showLoader=false, targetPage, append=true
                                    }}
                                    className="px-6 py-1.5 bg-blue-50 border border-blue-200 rounded font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
                                >
                                    {loading ? 'Carregando lote...' : 'Carregar mais resultados (Lote) ↓'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : null)}

            {/* Modals reutilizados da Matrix */}
            {appointingOp && (
                <ProductionAppointmentModal
                    op={appointingOp}
                    onClose={() => setAppointingOp(null)}
                    onSave={handleAppointmentSave}
                />
            )}

            {historyTarget && (
                <ProductionHistoryModal
                    opData={historyTarget}
                    onClose={() => setHistoryTarget(null)}
                />
            )}

            {rncTarget && (
                <RNCModal
                    op={rncTarget}
                    onClose={() => setRncTarget(null)}
                />
            )}

            {checklistTarget && (
                <ChecklistModal
                    target={checklistTarget}
                    onClose={() => setChecklistTarget(null)}
                    onSaveSuccess={() => {
                        loadData(true);
                    }}
                />
            )}
        </div>
    );
}

// --- COMPONENTE CHECKLIST MODAL ---
const ChecklistModal = ({ target, onClose, onSaveSuccess }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [itens, setItens] = useState([]);
    const [observacaoGeral, setObservacaoGeral] = useState('');
    const [qtdConjuntos, setQtdConjuntos] = useState(1);
    const [dataFinalizado, setDataFinalizado] = useState(() => {
        const d = new Date();
        return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().substring(0, 16);
    });
    const [status, setStatus] = useState('RASCUNHO');
    const [fotoUrlPai, setFotoUrlPai] = useState(null);

    useEffect(() => {
        if (!target) return;
        const loadChecklistData = async () => {
            setLoading(true);
            try {
                const response = await getChecklist(target.op, target.item_op, target.sequen_op || '001');
                if (response) {
                    setItens(response.itens || []);
                    setObservacaoGeral(response.observacao_geral || '');
                    setQtdConjuntos(response.qtd_conjuntos || 1);
                    setStatus(response.status || 'RASCUNHO');
                    setFotoUrlPai(response.foto_url_pai || null);
                    if (response.data_finalizado) {
                        const d = new Date(response.data_finalizado);
                        setDataFinalizado(new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().substring(0, 16));
                    }
                } else {
                    // Buscar estrutura
                    const bom = await getEstruturaProduto(target.produto);
                    const lvl1 = (bom || []).filter(i => i.nivel === 1);
                    setItens(lvl1.map(i => ({
                        codigo_componente: i.codigo,
                        descricao_componente: i.descricao,
                        montado: false,
                        observacao: '',
                        foto_url: null,
                        qtd_necessaria: i.qtd_necessaria || 1.0,
                        qtd_montada: 0
                    })));
                    const bal = Math.max(1, (parseFloat(target.qtd_op) || 0) - (parseFloat(target.qtd_apontada) || 0));
                    setQtdConjuntos(bal);
                    setFotoUrlPai(null);
                }
            } catch (e) {
                console.error('Erro ao carregar checklist:', e);
                toast.error('Erro ao carregar dados do checklist');
            } finally {
                setLoading(false);
            }
        };
        loadChecklistData();
    }, [target]);

    const handleItemChange = (index, field, value) => {
        if (status === 'FINALIZADO') return;
        setItens(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            
            // UX Auto-fill: Se marcou montado e a quantidade montada for 0 ou vazia, preenche com a quantidade pedida
            if (field === 'montado' && value === true) {
                const reqQtd = parseFloat(updated[index].qtd_necessaria) || 1;
                const totalReq = reqQtd * (parseFloat(target.qtd_op) || 1);
                if (!updated[index].qtd_montada || parseFloat(updated[index].qtd_montada) === 0) {
                    updated[index].qtd_montada = totalReq;
                }
            }
            // UX Auto-fill: Se desmarcou montado, zera a quantidade montada
            if (field === 'montado' && value === false) {
                updated[index].qtd_montada = 0;
            }

            return updated;
        });
    };

    const handlePhotoFileChange = async (index, e) => {
        if (status === 'FINALIZADO') return;
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        try {
            toast.info('Enviando foto...');
            const res = await uploadChecklistPhoto(formData);
            if (res && res.url) {
                handleItemChange(index, 'foto_url', res.url);
                toast.success('Foto enviada!');
            }
        } catch (err) {
            console.error('Erro no upload:', err);
            toast.error('Falha ao enviar foto');
        }
    };

    const handleRemovePhoto = (index) => {
        if (status === 'FINALIZADO') return;
        handleItemChange(index, 'foto_url', null);
    };

    const handleParentPhotoFileChange = async (e) => {
        if (status === 'FINALIZADO') return;
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        try {
            toast.info('Enviando foto do produto pai...');
            const res = await uploadChecklistPhoto(formData);
            if (res && res.url) {
                setFotoUrlPai(res.url);
                toast.success('Foto do produto pai enviada!');
            }
        } catch (err) {
            console.error('Erro no upload da foto do pai:', err);
            toast.error('Falha ao enviar foto do produto pai');
        }
    };

    const handleRemoveParentPhoto = () => {
        if (status === 'FINALIZADO') return;
        setFotoUrlPai(null);
    };

    const handleSave = async (newStatus) => {
        if (status === 'FINALIZADO') return;
        if (newStatus === 'FINALIZADO' && !window.confirm('Tem certeza que deseja FINALIZAR o checklist? Após a finalização, nenhuma alteração será permitida.')) {
            return;
        }

        setSaving(true);
        try {
            await saveChecklist({
                op: target.op,
                item_op: target.item_op,
                sequen_op: target.sequen_op || '001',
                produto_pai: target.produto,
                data_finalizado: dataFinalizado,
                qtd_conjuntos: qtdConjuntos,
                observacao_geral: observacaoGeral,
                status: newStatus,
                foto_url_pai: fotoUrlPai,
                itens
            });
            toast.success(newStatus === 'FINALIZADO' ? 'Checklist FINALIZADO com sucesso!' : 'Rascunho do checklist salvo!');
            onSaveSuccess();
            if (newStatus === 'FINALIZADO') {
                onClose();
            }
        } catch (err) {
            console.error('Erro ao salvar checklist:', err);
            toast.error(err.response?.data?.error || 'Erro ao salvar checklist');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 duration-200">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-indigo-600" />
                            Checklist de Montagem
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            OP: <strong>{target.op}-{target.item_op}</strong> | Produto: <strong>{target.produto}</strong> - {target.desc_produto}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-100 rounded-lg animate-fade-in"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {status === 'FINALIZADO' && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm font-semibold flex items-center gap-2">
                            <Check className="w-5 h-5 bg-emerald-500 text-white rounded-full p-0.5" />
                            Este checklist foi FINALIZADO e está em modo de apenas leitura.
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm font-medium text-slate-500">Carregando dados...</span>
                        </div>
                    ) : itens.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            Nenhum componente de Nível 1 encontrado na estrutura deste produto.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Itens de Verificação (Nível 1)</h3>
                            
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                                            <th className="p-3 w-16 text-center">Montado</th>
                                            <th className="p-3 w-64">Componente</th>
                                            <th className="p-3 w-16 text-center">Desenho</th>
                                            <th className="p-3 w-48 text-center">Qtd (Pedida vs Feita)</th>
                                            <th className="p-3">Observação</th>
                                            <th className="p-3 w-32 text-center">Foto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {itens.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        disabled={status === 'FINALIZADO'}
                                                        checked={!!item.montado}
                                                        onChange={(e) => handleItemChange(idx, 'montado', e.target.checked)}
                                                        className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer disabled:opacity-60"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-mono text-xs font-bold text-slate-800">{item.codigo_componente}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[220px]" title={item.descricao_componente}>
                                                        {item.descricao_componente || '-'}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    {item.arquivos && item.arquivos.length > 0 ? (
                                                        <div className="relative group inline-block">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (item.arquivos.length === 1) {
                                                                        window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.arquivos[0].url_arquivo)}`), '_blank');
                                                                    }
                                                                }}
                                                                className="relative p-1 rounded hover:bg-red-50 transition-colors"
                                                                title={item.arquivos.length > 1 ? 'Ver Arquivos' : 'Ver Desenho / PDF'}
                                                            >
                                                                <FileText className="w-4 h-4 text-red-500" />
                                                                {item.arquivos.length > 1 && (
                                                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full shadow-sm ring-1 ring-white">
                                                                        {item.arquivos.length}
                                                                    </span>
                                                                )}
                                                            </button>
                                                            {item.arquivos.length > 1 && (
                                                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 w-52 bg-white border border-slate-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[110] flex flex-col p-1.5 gap-0.5 text-left">
                                                                    <div className="px-2 py-1 border-b border-slate-100 mb-1">
                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Desenhos do Componente</span>
                                                                    </div>
                                                                    {item.arquivos.filter(arq => arq.url_arquivo && arq.url_arquivo.trim() !== '').map((arq, idx) => {
                                                                        const extMatch = (arq.url_arquivo || '').match(/\.([a-zA-Z0-9]+)$/);
                                                                        const ext = extMatch ? extMatch[1].toUpperCase() : 'DOC';
                                                                        let typeColor = 'bg-slate-100 text-slate-500';
                                                                        if (ext === 'PDF') typeColor = 'bg-red-100 text-red-600 border-red-200';
                                                                        else if (ext === 'DXF') typeColor = 'bg-blue-100 text-blue-600 border-blue-200';
                                                                        else if (ext === 'DWG') typeColor = 'bg-emerald-100 text-emerald-600 border-emerald-200';
                                                                        const fileName = arq.titulo || `Arquivo ${idx + 1}`;
                                                                        return (
                                                                            <button
                                                                                key={idx}
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(arq.url_arquivo)}`), '_blank');
                                                                                }}
                                                                                className="text-left px-1.5 py-1 hover:bg-slate-50 rounded transition-colors flex flex-col group/item border border-transparent"
                                                                                title={fileName}
                                                                            >
                                                                                <div className="flex items-center justify-between w-full">
                                                                                    <span className="text-[10px] font-bold text-slate-700 group-hover/item:text-blue-600 truncate max-w-[130px]">{arq.tipo || 'Desenho'}</span>
                                                                                    <span className={`text-[8px] font-bold px-1 py-0.2 rounded uppercase border ${typeColor}`}>{ext}</span>
                                                                                </div>
                                                                                <span className="text-[9px] text-slate-400 truncate w-full mt-0.5">{fileName}</span>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs font-mono">—</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <div className="flex flex-col items-end mr-1 text-[11px] text-slate-500" title={`Unitária: ${parseFloat(item.qtd_necessaria || 1).toLocaleString('pt-BR')} x ${parseFloat(target.qtd_op || 0).toFixed(0)} da OP`}>
                                                            <span className="font-semibold text-slate-600">
                                                                {(parseFloat(item.qtd_necessaria || 1) * (parseFloat(target.qtd_op) || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                                            </span>
                                                            <span className="text-[9px] text-slate-400">pedida</span>
                                                        </div>
                                                        <span className="text-slate-300">/</span>
                                                        <input
                                                            type="text"
                                                            disabled={status === 'FINALIZADO'}
                                                            value={item.qtd_montada !== undefined && item.qtd_montada !== null ? item.qtd_montada : ''}
                                                            onChange={(e) => handleItemChange(idx, 'qtd_montada', e.target.value)}
                                                            placeholder="0"
                                                            className="w-16 text-center text-xs px-1.5 py-1 border rounded focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:bg-slate-50 font-bold text-slate-800"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="text"
                                                        disabled={status === 'FINALIZADO'}
                                                        placeholder={status === 'FINALIZADO' ? '' : "Observações para esta peça..."}
                                                        value={item.observacao || ''}
                                                        onChange={(e) => handleItemChange(idx, 'observacao', e.target.value)}
                                                        className="w-full text-xs px-2 py-1.5 border rounded focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:bg-slate-50"
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    {item.foto_url ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <a
                                                                href={getFileUrl(item.foto_url)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="relative block w-10 h-10 rounded overflow-hidden border border-slate-200 shadow-sm hover:shadow hover:scale-105 transition-all duration-150"
                                                                title="Visualizar Foto"
                                                            >
                                                                <img
                                                                    src={getFileUrl(item.foto_url)}
                                                                    alt="Miniatura"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </a>
                                                            {status !== 'FINALIZADO' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemovePhoto(idx)}
                                                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors animate-fade-in"
                                                                    title="Remover Foto"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        status !== 'FINALIZADO' ? (
                                                            <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors">
                                                                <Upload className="w-3 h-3" />
                                                                Foto
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={(e) => handlePhotoFileChange(idx, e)}
                                                                />
                                                            </label>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 font-mono">—</span>
                                                        )
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Metadados adicionais */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Coluna da Esquerda: Inputs e Notas */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Quantidade de Conjuntos Montados</label>
                                    <input
                                        type="number"
                                        min="1"
                                        disabled={status === 'FINALIZADO'}
                                        value={qtdConjuntos}
                                        onChange={(e) => setQtdConjuntos(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-full text-sm px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:bg-slate-50 font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Data/Hora de Finalização Montagem</label>
                                    <input
                                        type="datetime-local"
                                        disabled={status === 'FINALIZADO'}
                                        value={dataFinalizado}
                                        onChange={(e) => setDataFinalizado(e.target.value)}
                                        className="w-full text-sm px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:bg-slate-50 font-mono font-semibold"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Observação / Nota Geral</label>
                                <textarea
                                    rows="3"
                                    disabled={status === 'FINALIZADO'}
                                    placeholder={status === 'FINALIZADO' ? '' : "Escreva observações gerais para este checklist..."}
                                    value={observacaoGeral}
                                    onChange={(e) => setObservacaoGeral(e.target.value)}
                                    className="w-full text-sm px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:bg-slate-50 resize-none"
                                />
                            </div>
                        </div>

                        {/* Coluna da Direita: Foto do Produto Pai */}
                        <div className="flex flex-col justify-between border border-dashed border-slate-200 rounded-lg p-4 bg-slate-50/50">
                            <div>
                                <span className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Foto do Produto Montado (Geral/Pai)</span>
                                {fotoUrlPai ? (
                                    <div className="relative group w-full h-32 rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white flex items-center justify-center">
                                        <img
                                            src={getFileUrl(fotoUrlPai)}
                                            alt="Foto do Produto Pai"
                                            className="w-full h-full object-contain"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                            <a
                                                href={getFileUrl(fotoUrlPai)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 bg-white text-slate-800 rounded-full hover:bg-slate-100 transition-colors shadow"
                                                title="Visualizar Foto"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </a>
                                            {status !== 'FINALIZADO' && (
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveParentPhoto}
                                                    className="p-1.5 bg-white text-red-600 rounded-full hover:bg-red-50 transition-colors shadow"
                                                    title="Remover Foto"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-32 rounded-lg border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-1">
                                        <Camera className="w-8 h-8 text-slate-300" />
                                        <span className="text-xs text-slate-400">Nenhuma foto inserida</span>
                                    </div>
                                )}
                            </div>
                            
                            {status !== 'FINALIZADO' && !fotoUrlPai && (
                                <div className="mt-3">
                                    <label className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-lg border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors">
                                        <Upload className="w-4 h-4" />
                                        Adicionar Foto do Produto
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleParentPhotoFileChange}
                                        />
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <div>
                        {status !== 'FINALIZADO' && (
                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                                Status: Rascunho em Edição
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={async () => {
                                const includeParent = window.confirm("Deseja associar as informações do Produto Pai (OP, Código e Descrição) ao cabeçalho do relatório PDF?");
                                await generateChecklistPdf(
                                    {
                                        op: target.op,
                                        item_op: target.item_op,
                                        sequen_op: target.sequen_op || '001',
                                        produto_pai: target.produto,
                                        data_finalizado: dataFinalizado,
                                        qtd_conjuntos: qtdConjuntos,
                                        observacao_geral: observacaoGeral,
                                        status,
                                        itens,
                                        foto_url_pai: fotoUrlPai
                                    },
                                    target,
                                    user,
                                    includeParent
                                );
                            }}
                            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-1.5"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir PDF
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border rounded-lg hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors shadow-sm"
                        >
                            Fechar
                        </button>
                        {status !== 'FINALIZADO' && (
                            <>
                                <button
                                    type="button"
                                    disabled={saving || loading}
                                    onClick={() => handleSave('RASCUNHO')}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                                >
                                    Salvar Rascunho
                                </button>
                                <button
                                    type="button"
                                    disabled={saving || loading}
                                    onClick={() => handleSave('FINALIZADO')}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                                >
                                    Finalizar Checklist
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
