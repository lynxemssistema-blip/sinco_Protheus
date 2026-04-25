import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Filter, Clock, User, ClipboardList, Camera, ImagePlus, Trash2, History, FileText, ChevronDown, ChevronRight, Users, Package } from 'lucide-react';
import { getPendentesConferencia, submitConferencia, submitConferenciaBulk, getConferenciaHistorico, getFileUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STATUS_LABELS = {
    PENDENTE: { label: 'Pendente', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    OK: { label: 'Aprovado', color: 'bg-green-100 text-green-700 border-green-200' },
    DIVERGENTE: { label: 'Recusado', color: 'bg-red-100 text-red-700 border-red-200' },
};

const fmtDatetime = (d) => {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt)) return '-';
    return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

function PdfCell({ url }) {
    if (url) {
        return (
            <a
                href={getFileUrl(`/api/docs/view?path=${encodeURIComponent(url)}`)}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir desenho PDF"
                onClick={e => e.stopPropagation()}
            >
                <FileText className="w-5 h-5 text-red-500 hover:text-red-700 transition mx-auto" />
            </a>
        );
    }
    return <FileText className="w-5 h-5 text-slate-300 mx-auto" title="Sem PDF vinculado" />;
}

function OperacaoCell({ codigo, nome }) {
    return (
        <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700 font-mono">{codigo}</span>
            {nome && (
                <span className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5 max-w-[120px] truncate" title={nome}>
                    {nome}
                </span>
            )}
        </div>
    );
}

export default function ConferenciaPage() {
    const { user: loggedUser, hasPermission } = useAuth();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [toast, setToast] = useState(null);

    // Filtros — inputs (digitação livre)
    const [statusFiltro, setStatusFiltro] = useState('PENDENTE');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [filtroOP, setFiltroOP] = useState('');
    const [filtroPedido, setFiltroPedido] = useState('');
    const [filtroCliente, setFiltroCliente] = useState('');
    const [filtroProduto, setFiltroProduto] = useState('');
    const [filtroApontador, setFiltroApontador] = useState('');
    const [filtroOperacao, setFiltroOperacao] = useState('');

    // Filtros aplicados — só mudam ao clicar "Filtrar"
    const [aplicados, setAplicados] = useState({
        op: '', pedido: '', cliente: '', produto: '', apontador: '', operacao: ''
    });

    // Modal unificado: { id, acao: 'OK' | 'DIVERGENTE' }
    const [acaoModal, setAcaoModal] = useState(null);
    // Modal bulk: { ids: [], acao, grupoInfo }
    const [bulkModal, setBulkModal] = useState(null);
    const [observacao, setObservacao] = useState('');
    const [fotosModal, setFotosModal] = useState([]);
    const [fotosPreview, setFotosPreview] = useState([]);
    const fotoInputRef = useRef(null);

    // Grupos expandidos
    const [expandedGroups, setExpandedGroups] = useState(new Set());

    // Modal de histórico
    const [historicoModal, setHistoricoModal] = useState(null);
    const [loadingHistorico, setLoadingHistorico] = useState(false);


    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { 
                status: statusFiltro,
                ...aplicados
            };
            if (dataInicio) params.data_inicio = dataInicio;
            if (dataFim) params.data_fim = dataFim;
            
            const data = await getPendentesConferencia(params);
            setRows(data || []);
            setExpandedGroups(new Set());
        } catch (err) {
            console.error('Erro ao buscar apontamentos:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFiltro, dataInicio, dataFim, aplicados]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const canConferir = hasPermission('conferencia', 'edit') || hasPermission('conferencia', 'create');
    const conferidoPor = loggedUser?.nome || loggedUser?.NomeCompleto || loggedUser?.login || loggedUser?.Login || 'Conferente';

    const handleConferir = async (id, status, obs = '', fotos = []) => {
        if (!canConferir) return;
        setSavingId(id);
        try {
            await submitConferencia({ id, status, observacao: obs, conferido_por: conferidoPor, fotos });
            showToast(status === 'OK' ? 'Apontamento aprovado!' : 'Apontamento recusado!', status === 'OK' ? 'success' : 'error');
            // fetchData(); // Evitar reload total
            setRows(prev => prev.map(r => r.id === id ? {
                ...r,
                conferencia_status: status,
                conferido_por: conferidoPor,
                conferido_em: new Date().toISOString(),
                conferencia_obs: obs
            } : r));
        } catch (err) {
            console.error('Erro ao conferir:', err);
            showToast('Erro ao registrar conferência. Tente novamente.', 'error');
        } finally {
            setSavingId(null);
        }
    };

    const resetModal = () => {
        setObservacao('');
        setFotosModal([]);
        setFotosPreview([]);
    };

    const openAcaoModal = (id, acao) => {
        resetModal();
        setBulkModal(null);
        setAcaoModal({ id, acao });
    };

    const openBulkModal = (ids, acao, grupoInfo) => {
        resetModal();
        setAcaoModal(null);
        setBulkModal({ ids, acao, grupoInfo });
    };

    const handleFotosChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const novos = [...fotosModal, ...files].slice(0, 5);
        setFotosModal(novos);
        setFotosPreview(novos.map(f => URL.createObjectURL(f)));
    };

    const removerFoto = (idx) => {
        const novos = fotosModal.filter((_, i) => i !== idx);
        setFotosModal(novos);
        setFotosPreview(novos.map(f => URL.createObjectURL(f)));
    };

    const confirmAcao = async () => {
        if (acaoModal.acao === 'DIVERGENTE' && !observacao.trim()) return;
        await handleConferir(acaoModal.id, acaoModal.acao, observacao.trim(), fotosModal);
        setAcaoModal(null);
    };

    const confirmBulkAcao = async () => {
        if (bulkModal.acao === 'DIVERGENTE' && !observacao.trim()) return;
        setSavingId('bulk');
        try {
            await submitConferenciaBulk({
                ids: bulkModal.ids,
                status: bulkModal.acao,
                observacao: observacao.trim(),
                conferido_por: conferidoPor,
                fotos: fotosModal
            });
            showToast(
                `${bulkModal.ids.length} apontamento${bulkModal.ids.length !== 1 ? 's' : ''} ${bulkModal.acao === 'OK' ? 'aprovados' : 'recusados'}!`,
                bulkModal.acao === 'OK' ? 'success' : 'error'
            );
            // fetchData();
            setRows(prev => prev.map(r => bulkModal.ids.includes(r.id) ? {
                ...r,
                conferencia_status: bulkModal.acao,
                conferido_por: conferidoPor,
                conferido_em: new Date().toISOString(),
                conferencia_obs: observacao.trim()
            } : r));
            setBulkModal(null);
        } catch (err) {
            console.error('Erro no bulk conferir:', err);
            showToast('Erro ao registrar. Tente novamente.', 'error');
        } finally {
            setSavingId(null);
        }
    };

    const openHistorico = async (row) => {
        setHistoricoModal({ row, historico: [] });
        setLoadingHistorico(true);
        try {
            const data = await getConferenciaHistorico(row.id);
            setHistoricoModal({ row, historico: data || [] });
        } catch (err) {
            console.error('Erro ao buscar histórico:', err);
            setHistoricoModal({ row, historico: [] });
        } finally {
            setLoadingHistorico(false);
        }
    };

    const toggleGroup = (key) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const rowsFiltradas = rows.filter(r => {
        const f = aplicados;
        const match = (val, search) => !search || String(val || '').toLowerCase().includes(String(search).toLowerCase());

        if (!match(r.op_numero, f.op)) return false;
        if (!match(r.pedido_venda, f.pedido)) return false;
        if (!match(r.nome_cliente, f.cliente)) return false;
        if (!match(r.produto_codigo, f.produto)) return false;
        if (!match(r.usuario, f.apontador)) return false;
        if (f.operacao && !(match(r.operacao_codigo, f.operacao) || match(r.operacao_nome, f.operacao))) return false;

        return true;
    });

    // Grouped view — only for PENDENTE status
    const grupos = useMemo(() => {
        if (statusFiltro !== 'PENDENTE') return null;
        const map = {};
        rowsFiltradas.forEach(r => {
            const key = `${r.op_numero}|${r.op_item}|${r.op_sequencia}|${r.operacao_codigo}`;
            if (!map[key]) {
                map[key] = {
                    key,
                    op_numero: r.op_numero,
                    op_item: r.op_item,
                    op_sequencia: r.op_sequencia,
                    operacao_codigo: r.operacao_codigo,
                    operacao_nome: r.operacao_nome,
                    produto_codigo: r.produto_codigo,
                    pedido_venda: r.pedido_venda,
                    nome_cliente: r.nome_cliente,
                    pdf_url: r.pdf_url,
                    qtd_planejada: r.qtd_planejada,
                    rows: []
                };
            }
            map[key].rows.push(r);
        });
        return Object.values(map).map(g => ({
            ...g,
            qtd_apontada: g.rows.reduce((s, r) => s + Number(r.quantidade || 0), 0)
        }));
    }, [statusFiltro, rowsFiltradas]);

    const hasAplicados = Object.values(aplicados).some(v => v);

    const aplicarFiltros = () => setAplicados({
        op: filtroOP, pedido: filtroPedido, cliente: filtroCliente,
        produto: filtroProduto, apontador: filtroApontador, operacao: filtroOperacao
    });

    const limparFiltros = () => {
        setFiltroOP(''); setFiltroPedido(''); setFiltroCliente('');
        setFiltroProduto(''); setFiltroApontador(''); setFiltroOperacao('');
        setAplicados({ op: '', pedido: '', cliente: '', produto: '', apontador: '', operacao: '' });
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter') aplicarFiltros(); };

    const totalPendente = rows.filter(r => r.conferencia_status === 'PENDENTE').length;
    const totalAprovado = rows.filter(r => r.conferencia_status === 'OK').length;
    const totalRecusado = rows.filter(r => r.conferencia_status === 'DIVERGENTE').length;

    // Shared modal props
    const activeModal = acaoModal || bulkModal;
    const isBulk = !!bulkModal && !acaoModal;

    const renderModalContent = () => {
        if (!activeModal) return null;
        const isAprovacao = activeModal.acao === 'OK';
        const accentBg = isAprovacao ? 'bg-green-100' : 'bg-red-100';
        const accentTxt = isAprovacao ? 'text-green-600' : 'text-red-600';
        const ringColor = isAprovacao ? 'focus:ring-green-300' : 'focus:ring-red-300';
        const btnColor = isAprovacao ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';
        const canConfirm = isAprovacao ? true : observacao.trim().length > 0;
        const onConfirm = isBulk ? confirmBulkAcao : confirmAcao;
        const onCancel = isBulk ? () => setBulkModal(null) : () => setAcaoModal(null);
        const isSaving = savingId === 'bulk' || savingId === activeModal.id;

        const title = isBulk
            ? (isAprovacao ? `Aprovar ${bulkModal.ids.length} Apontamentos` : `Recusar ${bulkModal.ids.length} Apontamentos`)
            : (isAprovacao ? 'Aprovar Apontamento' : 'Recusar Apontamento');

        const subtitle = isBulk
            ? (isAprovacao
                ? `A mesma aprovação será aplicada a todos os ${bulkModal.ids.length} apontamentos do grupo`
                : `O mesmo motivo de recusa será aplicado a todos os ${bulkModal.ids.length} apontamentos do grupo — obrigatório`)
            : (isAprovacao
                ? 'Adicione uma observação (opcional) e confirme a aprovação'
                : 'Informe o motivo da recusa — obrigatório');

        return (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-full ${accentBg} flex items-center justify-center`}>
                            {isAprovacao
                                ? <CheckCircle className={`w-5 h-5 ${accentTxt}`} />
                                : <XCircle className={`w-5 h-5 ${accentTxt}`} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{title}</h3>
                            <p className="text-sm text-slate-500">{subtitle}</p>
                        </div>
                    </div>

                    {isBulk && bulkModal.grupoInfo && (
                        <div className="mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                            <span className="font-medium">OP {bulkModal.grupoInfo.op_numero}</span>
                            {bulkModal.grupoInfo.produto_codigo && <span className="ml-2 font-mono">{bulkModal.grupoInfo.produto_codigo}</span>}
                            {bulkModal.grupoInfo.operacao_codigo && <span className="ml-2 text-slate-400">— {bulkModal.grupoInfo.operacao_codigo}</span>}
                        </div>
                    )}

                    <textarea
                        className={`w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 ${ringColor}`}
                        rows={3}
                        placeholder={isAprovacao
                            ? 'Observação opcional sobre a aprovação...'
                            : 'Ex: Quantidade incorreta, operação não executada, etc.'}
                        value={observacao}
                        onChange={e => setObservacao(e.target.value)}
                        autoFocus
                    />

                    <div className="mt-3">
                        <p className="text-xs font-medium text-slate-600 mb-2">Fotos (opcional — máx. 5)</p>
                        <div className="flex flex-wrap gap-2">
                            {fotosModal.map((_, idx) => (
                                <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
                                    <img src={fotosPreview[idx]} alt={`foto ${idx + 1}`} className="w-full h-full object-cover" />
                                    <button onClick={() => removerFoto(idx)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                        <Trash2 className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            ))}
                            {fotosModal.length < 5 && (
                                <button onClick={() => fotoInputRef.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-500 transition">
                                    <Camera className="w-5 h-5" />
                                    <span className="text-[9px] font-medium">Foto</span>
                                </button>
                            )}
                        </div>
                        <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleFotosChange} />
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 leading-tight">
                            <ImagePlus className="w-3 h-3" />
                            Toque no ícone acima para tirar foto na hora ou escolher arquivo.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={onCancel} disabled={isSaving} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition disabled:opacity-50">
                            Cancelar
                        </button>
                        <button onClick={onConfirm} disabled={!canConfirm || isSaving} className={`px-4 py-2 ${btnColor} text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2`}>
                            {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            {isAprovacao ? 'Confirmar Aprovação' : 'Confirmar Recusa'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Flat table row renderer (used in non-grouped view)
    const renderFlatRow = (row) => {
        const st = STATUS_LABELS[row.conferencia_status] || STATUS_LABELS.PENDENTE;
        const isSaving = savingId === row.id;
        return (
            <tr key={row.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                <td className="px-2 py-1.5 md:px-4 md:py-3 font-bold text-blue-700 text-xs md:text-sm">{row.op_numero}</td>
                <td className="px-2 py-1.5 md:px-4 md:py-3 text-[10px] md:text-xs">
                    {row.pedido_venda
                        ? <span className="font-medium text-slate-700">{row.pedido_venda}</span>
                        : <span className="text-slate-300">—</span>}
                    {row.nome_cliente && (
                        <p className="text-[9px] md:text-[10px] text-slate-400 truncate max-w-[100px] md:max-w-[120px]" title={row.nome_cliente}>{row.nome_cliente}</p>
                    )}
                </td>
                <td className="px-2 py-1.5 md:px-4 md:py-3 font-mono text-[10px] md:text-xs text-slate-700">{row.produto_codigo || '-'}</td>
                <td className="px-2 py-1.5 md:px-4 md:py-3 text-center"><PdfCell url={row.pdf_url} /></td>
                <td className="hidden lg:table-cell px-2 py-1.5 md:px-4 md:py-3 text-slate-500 font-mono text-[10px] md:text-xs">{row.op_item}/{row.op_sequencia}</td>
                <td className="hidden sm:table-cell px-2 py-1.5 md:px-4 md:py-3"><OperacaoCell codigo={row.operacao_codigo} nome={row.operacao_nome} /></td>
                <td className="px-2 py-1.5 md:px-4 md:py-3">
                    <div className="flex items-center gap-1.5 md:gap-2">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[9px] md:text-[10px] font-bold flex-shrink-0">
                            {(row.usuario || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-slate-700 text-[10px] md:text-xs truncate max-w-[60px] md:max-w-none">{row.usuario || '-'}</span>
                    </div>
                </td>
                <td className="px-2 py-1.5 md:px-4 md:py-3">
                    <span className="bg-green-100/80 text-green-800 px-1.5 py-0.5 rounded font-bold text-[10px] md:text-xs whitespace-nowrap">
                        {Number(row.quantidade || 0).toFixed(0)} pc
                    </span>
                </td>
                <td className="hidden lg:table-cell px-2 py-1.5 md:px-4 md:py-3 text-[10px] md:text-xs text-slate-500 font-mono leading-tight whitespace-nowrap">
                    {row.data_planejada_inicio ? fmtDatetime(row.data_planejada_inicio).split(' ')[0] : '-'}
                </td>
                <td className="hidden lg:table-cell px-2 py-1.5 md:px-4 md:py-3 text-[10px] md:text-xs text-slate-500 font-mono leading-tight whitespace-nowrap">
                    {row.data_planejada_fim ? fmtDatetime(row.data_planejada_fim).split(' ')[0] : '-'}
                </td>
                <td className="hidden sm:table-cell px-2 py-1.5 md:px-4 md:py-3 text-[10px] md:text-xs text-slate-500 font-mono leading-tight">{fmtDatetime(row.criado_em)}</td>
                <td className="px-2 py-1.5 md:px-4 md:py-3">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold border ${st.color}`}>
                        {st.label}
                    </span>
                    {row.conferencia_obs && (
                        <p className="text-[9px] text-red-500 italic mt-0.5 max-w-[120px] truncate" title={row.conferencia_obs}>
                            {row.conferencia_obs}
                        </p>
                    )}
                </td>
                <td className="hidden md:table-cell px-2 py-1.5 md:px-4 md:py-3 text-[10px] md:text-xs text-slate-500">
                    {row.conferido_por ? (
                        <div>
                            <p className="font-medium text-slate-700 leading-none">{row.conferido_por}</p>
                            <p className="text-[9px] font-mono mt-0.5 opacity-60">{fmtDatetime(row.conferido_em)}</p>
                        </div>
                    ) : (
                        <span className="text-slate-300">—</span>
                    )}
                </td>
                <td className="px-2 py-1.5 md:px-4 md:py-3">
                    <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openHistorico(row)} title="Ver histórico" className="p-1 md:p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded transition">
                            <History className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </button>
                        {canConferir && (
                            <>
                                {row.conferencia_status === 'PENDENTE' && (<>
                                    <button disabled={isSaving} onClick={() => openAcaoModal(row.id, 'OK')} title="Aprovar" className="p-1 md:p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded transition disabled:opacity-50">
                                        {isSaving ? <div className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                                    </button>
                                    <button disabled={isSaving} onClick={() => openAcaoModal(row.id, 'DIVERGENTE')} title="Recusar" className="p-1 md:p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded transition disabled:opacity-50">
                                        <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    </button>
                                </>)}
                                {row.conferencia_status === 'OK' && (
                                    <button disabled={isSaving} onClick={() => openAcaoModal(row.id, 'DIVERGENTE')} title="Recusar" className="p-1 md:p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded transition disabled:opacity-50">
                                        <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    </button>
                                )}
                                {row.conferencia_status === 'DIVERGENTE' && (
                                    <button disabled={isSaving} onClick={() => openAcaoModal(row.id, 'OK')} title="Re-aprovar" className="p-1 md:p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded transition disabled:opacity-50">
                                        {isSaving ? <div className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </td>
            </tr>
        );
    };

    const TABLE_HEADERS = (
        <thead className="bg-slate-50 text-slate-500 text-[10px] md:text-xs font-bold border-b border-slate-200 sticky top-0 z-10">
            <tr>
                <th className="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">OP</th>
                <th className="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">PV / Cliente</th>
                <th className="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">Produto</th>
                <th className="px-2 py-2 md:px-4 md:py-3 text-center">PDF</th>
                <th className="hidden lg:table-cell px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">Seq</th>
                <th className="hidden sm:table-cell px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">Operação</th>
                <th className="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">Apontador</th>
                <th className="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">Qtd</th>
                <th className="hidden lg:table-cell px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">Início Plan.</th>
                <th className="hidden lg:table-cell px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">Fim Plan.</th>
                <th className="hidden sm:table-cell px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">Data</th>
                <th className="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">Status</th>
                <th className="hidden md:table-cell px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">Conferente</th>
                <th className="px-2 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">Ações</th>
            </tr>
        </thead>
    );

    return (
        <div className="p-2 md:p-6 space-y-3 max-w-screen-2xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                        Conferência de Apontamentos
                    </h1>
                    <p className="text-[11px] md:text-sm text-slate-500">
                        Aprovação de produção
                        {!canConferir && (
                            <span className="ml-2 text-orange-500 font-medium">
                                (somente visualização)
                            </span>
                        )}
                    </p>
                </div>
                <button onClick={fetchData} className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition w-full sm:w-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            {/* Cards resumo */}
            {statusFiltro === 'TODOS' && (
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-2 md:p-4 flex items-center gap-2 md:gap-3">
                        <AlertTriangle className="w-5 h-5 md:w-8 md:h-8 text-orange-400" />
                        <div><p className="text-lg md:text-2xl font-bold text-orange-600 leading-none">{totalPendente}</p><p className="text-[9px] md:text-xs text-orange-500 mt-0.5">Pendentes</p></div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-2 md:p-4 flex items-center gap-2 md:gap-3">
                        <CheckCircle className="w-5 h-5 md:w-8 md:h-8 text-green-400" />
                        <div><p className="text-lg md:text-2xl font-bold text-green-600 leading-none">{totalAprovado}</p><p className="text-[9px] md:text-xs text-green-500 mt-0.5">Aprovados</p></div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-2 md:p-4 flex items-center gap-2 md:gap-3">
                        <XCircle className="w-5 h-5 md:w-8 md:h-8 text-red-400" />
                        <div><p className="text-lg md:text-2xl font-bold text-red-600 leading-none">{totalRecusado}</p><p className="text-[9px] md:text-xs text-red-500 mt-0.5">Recusados</p></div>
                    </div>
                </div>
            )}

            {/* Filtros */}
            <div className="bg-white rounded-xl border border-slate-200 p-2 md:p-4 space-y-2 md:space-y-3">
                {/* Linha 1: Status + Datas */}
                <div className="flex flex-wrap gap-2 md:gap-3 items-end">
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] md:text-xs text-slate-500 font-medium">Status</label>
                        <select className="border rounded-lg px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm bg-white" value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
                            <option value="PENDENTE">Pendentes</option>
                            <option value="OK">Aprovados</option>
                            <option value="DIVERGENTE">Recusados</option>
                            <option value="TODOS">Todos</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] md:text-xs text-slate-500 font-medium">Início</label>
                        <input type="date" className="border rounded-lg px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] md:text-xs text-slate-500 font-medium">Fim</label>
                        <input type="date" className="border rounded-lg px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                    </div>
                </div>

                {/* Linha 2: Campos individuais + botão Filtrar */}
                <div className="flex flex-wrap gap-2 items-end">
                    {[
                        { label: 'OP', val: filtroOP, set: setFiltroOP, ph: 'OP...', w: 'w-24 md:w-32' },
                        { label: 'PV', val: filtroPedido, set: setFiltroPedido, ph: 'PV...', w: 'w-24 md:w-32' },
                        { label: 'Cliente', val: filtroCliente, set: setFiltroCliente, ph: 'Cliente...', w: 'w-28 md:w-40' },
                        { label: 'Produto', val: filtroProduto, set: setFiltroProduto, ph: 'Cód...', w: 'w-24 md:w-36' },
                        { label: 'Apt.', val: filtroApontador, set: setFiltroApontador, ph: 'User...', w: 'w-24 md:w-32' },
                        { label: 'Op.', val: filtroOperacao, set: setFiltroOperacao, ph: 'Op...', w: 'w-24 md:w-36' },
                    ].map(f => (
                        <div key={f.label} className="flex flex-col gap-0.5">
                            <label className="text-[10px] md:text-xs text-slate-500 font-medium">{f.label}</label>
                            <input
                                type="text"
                                className={`border rounded-lg px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm ${f.w}`}
                                placeholder={f.ph}
                                value={f.val}
                                onChange={e => f.set(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    ))}
                    <div className="flex gap-1.5 items-end pb-0.5">
                        <button
                            onClick={aplicarFiltros}
                            className="flex items-center gap-1.5 px-3 py-1 md:px-4 md:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs md:text-sm font-medium transition"
                        >
                            <Filter className="w-3 md:w-3.5 h-3 md:h-3.5" />
                            Filtrar
                        </button>
                        {hasAplicados && (
                            <button onClick={limparFiltros} className="px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition">
                                Limpar
                            </button>
                        )}
                    </div>
                </div>

                {/* Badge dos filtros aplicados */}
                {hasAplicados && (
                    <div className="flex flex-wrap gap-1 md:gap-1.5">
                        {Object.entries(aplicados).filter(([, v]) => v).map(([k, v]) => (
                            <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-full text-[9px] md:text-[10px] font-medium">
                                {k}: <span className="font-bold">{v}</span>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center h-48">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                ) : (grupos ? grupos.length === 0 : rowsFiltradas.length === 0) ? (
                    <div className="text-center py-16 text-slate-400">
                        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Nenhum apontamento encontrado</p>
                        <p className="text-sm mt-1">Ajuste os filtros ou aguarde novos apontamentos.</p>
                    </div>
                ) : grupos ? (
                    /* ── GROUPED VIEW (PENDENTE only) ── */
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            {TABLE_HEADERS}
                            <tbody>
                                {grupos.map(grupo => {
                                    const isExpanded = expandedGroups.has(grupo.key);
                                    const qtdPlan = grupo.qtd_planejada != null ? Number(grupo.qtd_planejada) : null;
                                    const qtdApt = grupo.qtd_apontada;

                                    // Completion badge
                                    let badge;
                                    if (qtdPlan == null) {
                                        badge = { label: `${qtdApt.toFixed(0)} pc`, color: 'bg-blue-100 text-blue-700' };
                                    } else if (qtdApt === 0) {
                                        badge = { label: 'Sem apt.', color: 'bg-slate-100 text-slate-500' };
                                    } else if (qtdApt >= qtdPlan) {
                                        badge = { label: 'Completo', color: 'bg-green-100 text-green-700' };
                                    } else {
                                        badge = { label: 'Parcial', color: 'bg-yellow-100 text-yellow-700' };
                                    }

                                    return (
                                        <Fragment key={grupo.key}>
                                            {/* Group header row */}
                                            <tr
                                                key={grupo.key}
                                                className="bg-blue-50 hover:bg-blue-100 border-b border-blue-200 cursor-pointer select-none"
                                                onClick={() => toggleGroup(grupo.key)}
                                            >
                                                <td className="px-2 py-1.5 md:px-4 md:py-2.5 font-bold text-blue-700 text-xs md:text-sm">
                                                    <div className="flex items-center gap-1">
                                                        {isExpanded
                                                            ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
                                                            : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />}
                                                        {grupo.op_numero}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 md:px-4 md:py-2.5 text-[10px] md:text-xs">
                                                    {grupo.pedido_venda
                                                        ? <span className="font-medium text-slate-700">{grupo.pedido_venda}</span>
                                                        : <span className="text-slate-300">—</span>}
                                                    {grupo.nome_cliente && (
                                                        <p className="text-[9px] md:text-[10px] text-slate-400 truncate max-w-[100px] md:max-w-[120px]" title={grupo.nome_cliente}>{grupo.nome_cliente}</p>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 md:px-4 md:py-2.5 font-mono text-[10px] md:text-xs text-slate-700">{grupo.produto_codigo || '-'}</td>
                                                <td className="px-2 py-1.5 md:px-4 md:py-2.5 text-center"><PdfCell url={grupo.pdf_url} /></td>
                                                <td className="hidden lg:table-cell px-2 py-1.5 md:px-4 md:py-2.5 text-slate-500 font-mono text-[10px] md:text-xs">{grupo.op_item}/{grupo.op_sequencia}</td>
                                                <td className="hidden sm:table-cell px-2 py-1.5 md:px-4 md:py-2.5"><OperacaoCell codigo={grupo.operacao_codigo} nome={grupo.operacao_nome} /></td>
                                                <td className="px-2 py-1.5 md:px-4 md:py-2.5">
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] md:text-xs font-medium">
                                                        <Users className="w-3 h-3" />
                                                        {grupo.rows.length}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 md:px-4 md:py-2.5">
                                                    <div className="flex flex-col text-[10px] md:text-xs gap-0">
                                                        {qtdPlan != null && (
                                                            <span className="text-slate-400 flex items-center gap-1 scale-90 origin-left">
                                                                <Package className="w-2.5 h-2.5" />
                                                                P:{qtdPlan.toFixed(0)}
                                                            </span>
                                                        )}
                                                        <span className="text-slate-600 font-bold leading-none">A:{qtdApt.toFixed(0)}</span>
                                                    </div>
                                                </td>
                                                <td className="hidden lg:table-cell px-2 py-1.5 md:px-4 md:py-2.5 text-[10px] md:text-xs text-slate-500 font-mono whitespace-nowrap">
                                                    {grupo.rows[0]?.data_planejada_inicio ? fmtDatetime(grupo.rows[0].data_planejada_inicio).split(' ')[0] : '-'}
                                                </td>
                                                <td className="hidden lg:table-cell px-2 py-1.5 md:px-4 md:py-2.5 text-[10px] md:text-xs text-slate-500 font-mono whitespace-nowrap">
                                                    {grupo.rows[0]?.data_planejada_fim ? fmtDatetime(grupo.rows[0].data_planejada_fim).split(' ')[0] : '-'}
                                                </td>
                                                <td className="hidden sm:table-cell px-2 py-1.5 md:px-4 md:py-2.5"></td>
                                                <td className="px-2 py-1.5 md:px-4 md:py-2.5">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold ${badge.color}`}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="hidden md:table-cell px-2 py-1.5 md:px-4 md:py-2.5"></td>
                                                <td className="px-2 py-1.5 md:px-4 md:py-2.5" onClick={e => e.stopPropagation()}>
                                                    {canConferir && (
                                                        <div className="flex items-center gap-1 justify-center">
                                                            <button
                                                                disabled={savingId === 'bulk'}
                                                                onClick={() => openBulkModal(grupo.rows.map(r => r.id), 'OK', grupo)}
                                                                className="flex items-center gap-1 px-1.5 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-[10px] font-bold transition disabled:opacity-50"
                                                                title="Aprovar grupo"
                                                            >
                                                                OK
                                                            </button>
                                                            <button
                                                                disabled={savingId === 'bulk'}
                                                                onClick={() => openBulkModal(grupo.rows.map(r => r.id), 'DIVERGENTE', grupo)}
                                                                className="flex items-center gap-1 px-1.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[10px] font-bold transition disabled:opacity-50"
                                                                title="Recusar grupo"
                                                            >
                                                                X
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Individual sub-rows */}
                                            {isExpanded && grupo.rows.map(row => {
                                                const isSaving = savingId === row.id;
                                                return (
                                                    <tr key={row.id} className="bg-white hover:bg-slate-50 border-b border-slate-100">
                                                        {/* Indent - smaller on mobile */}
                                                        <td className="py-1 md:py-2 pl-2 md:pl-10 pr-1 text-slate-300 text-[10px] whitespace-nowrap">└─</td>
                                                        
                                                        {/* Spacer - hidden on mobile to save space */}
                                                        <td className="hidden md:table-cell px-2 py-1 md:py-2" colSpan={7}></td>
                                                        
                                                        {/* On mobile, we might need a colSpan to fill the gap if we hidden 5 columns */}
                                                        {/* Actually, the table will collapse correctly if we just hide them. But wait, if headers are still there, alignment will break. */}
                                                        {/* Better: Use one cell for all info on mobile, and the desktop layout on md+ */}
                                                        
                                                        {/* On mobile, we merge many columns into one to avoid overflow */}
                                                        <td className="px-1 py-1 md:px-4 md:py-2" colSpan={window.innerWidth < 768 ? 8 : 1}>
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                                                {/* Apontador */}
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                                                        {(row.usuario || 'U').charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <span className="text-slate-700 text-[10px] md:text-xs truncate max-w-[80px] md:max-w-none">{row.usuario || '-'}</span>
                                                                </div>

                                                                {/* Quantidade */}
                                                                <span className="bg-green-100/60 text-green-800 px-1.5 py-0.5 rounded font-bold text-[10px] md:text-xs">
                                                                    {Number(row.quantidade || 0).toFixed(0)} pc
                                                                </span>

                                                                {/* Data - remove nowrap on small screens if needed, but here we just wrap in flex */}
                                                                <span className="text-[10px] md:text-xs text-slate-500 font-mono">{fmtDatetime(row.criado_em)}</span>

                                                                {/* Status - only on mobile */}
                                                                <span className="md:hidden inline-flex items-center px-1 py-0.5 rounded-full text-[9px] font-semibold border bg-orange-100/50 text-orange-700 border-orange-200/50">
                                                                    Pendente
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Desktop only columns */}
                                                        <td className="hidden md:table-cell px-2 py-1 md:px-4 md:py-2">
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold border bg-orange-100/50 text-orange-700 border-orange-200/50">
                                                                Pendente
                                                            </span>
                                                        </td>
                                                        <td className="hidden md:table-cell px-2 py-1 md:px-4 md:py-2 text-[10px] text-slate-400">—</td>

                                                        {/* Actions - always visible */}
                                                        <td className="px-2 py-1 md:px-4 md:py-2">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button onClick={() => openHistorico(row)} title="Histórico" className="p-1 md:p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded transition">
                                                                    <History className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                                </button>
                                                                {canConferir && (<>
                                                                    <button disabled={isSaving} onClick={() => openAcaoModal(row.id, 'OK')} title="Aprovar" className="p-1 md:p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded transition disabled:opacity-50">
                                                                        {isSaving ? <div className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                                                                    </button>
                                                                    <button disabled={isSaving} onClick={() => openAcaoModal(row.id, 'DIVERGENTE')} title="Recusar" className="p-1 md:p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded transition disabled:opacity-50">
                                                                        <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                                    </button>
                                                                </>)}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-400">
                            {grupos.length} grupo{grupos.length !== 1 ? 's' : ''} · {rowsFiltradas.length} apontamento{rowsFiltradas.length !== 1 ? 's' : ''}
                            {rowsFiltradas.length !== rows.length && ` (de ${rows.length} carregados)`}
                        </div>
                    </div>
                ) : (
                    /* ── FLAT VIEW (OK / DIVERGENTE / TODOS) ── */
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            {TABLE_HEADERS}
                            <tbody className="divide-y divide-slate-100">
                                {rowsFiltradas.map(renderFlatRow)}
                            </tbody>
                        </table>
                        <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-400">
                            {rowsFiltradas.length} registro{rowsFiltradas.length !== 1 ? 's' : ''}
                            {rowsFiltradas.length !== rows.length && ` (de ${rows.length} carregados)`}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal unificado (single + bulk) */}
            {renderModalContent()}

            {/* Modal de Histórico */}
            {historicoModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <History className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">Histórico de Conferências</h3>
                                    <p className="text-xs text-slate-500">
                                        OP {historicoModal.row.op_numero} — {historicoModal.row.operacao_codigo}
                                        {historicoModal.row.operacao_nome ? ` — ${historicoModal.row.operacao_nome}` : ''}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setHistoricoModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                        </div>

                        {/* Dados Originais do Apontamento */}
                        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Apontamento Original</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-medium">Quantidade</p>
                                    <p className="font-bold text-slate-800">{Number(historicoModal.row.quantidade || 0).toFixed(0)} pc</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-medium">Apontador</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[8px] font-bold">
                                            {(historicoModal.row.usuario || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        <p className="font-medium text-slate-700">{historicoModal.row.usuario}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-medium">Início</p>
                                    <p className="font-mono text-slate-600 text-xs mt-0.5">{fmtDatetime(historicoModal.row.data_inicio)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-medium">Fim</p>
                                    <p className="font-mono text-slate-600 text-xs mt-0.5">{fmtDatetime(historicoModal.row.criado_em)}</p>
                                </div>
                            </div>
                            {historicoModal.row.observacao && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <p className="text-[10px] text-slate-400 font-medium mb-0.5">Observação do Apontador:</p>
                                    <p className="text-xs text-slate-700 bg-white p-2 rounded border border-slate-100 italic">"{historicoModal.row.observacao}"</p>
                                </div>
                            )}
                        </div>

                        <div className="overflow-y-auto flex-1">
                            {loadingHistorico ? (
                                <div className="flex justify-center py-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                                </div>
                            ) : historicoModal.historico.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Nenhuma conferência registrada ainda.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {historicoModal.historico.map((h, idx) => {
                                        const isOk = h.status === 'OK';
                                        return (
                                            <div key={h.id} className={`rounded-lg border p-3 ${isOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        {isOk
                                                            ? <CheckCircle className="w-4 h-4 text-green-600" />
                                                            : <XCircle className="w-4 h-4 text-red-600" />
                                                        }
                                                        <span className={`text-xs font-bold ${isOk ? 'text-green-700' : 'text-red-700'}`}>
                                                            {isOk ? 'Aprovado' : 'Recusado'}
                                                        </span>
                                                        {idx === 0 && (
                                                            <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">Mais recente</span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-mono">{fmtDatetime(h.criado_em)}</span>
                                                </div>
                                                <p className="text-xs text-slate-600"><span className="font-medium">Por:</span> {h.conferido_por}</p>
                                                {h.observacao && (
                                                    <p className="text-xs text-slate-600 mt-1 italic">"{h.observacao}"</p>
                                                )}
                                                {h.fotos && (() => {
                                                    try {
                                                        const fotos = typeof h.fotos === 'string' ? JSON.parse(h.fotos) : h.fotos;
                                                        if (fotos && fotos.length > 0) {
                                                            return (
                                                                <div className="flex gap-1 mt-2 flex-wrap">
                                                                    {fotos.map((f, fi) => (
                                                                        <a key={fi} href={f} target="_blank" rel="noopener noreferrer"
                                                                            className="w-12 h-12 rounded border border-slate-200 overflow-hidden bg-white flex items-center justify-center text-[9px] text-slate-400 hover:opacity-80 transition shadow-sm">
                                                                            <img src={f} alt="conf" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                                                                            <Camera className="w-4 h-4 hidden" />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            );
                                                        }
                                                    } catch (e) { }
                                                    return null;
                                                })()}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button onClick={() => setHistoricoModal(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition">Fechar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[80] px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
