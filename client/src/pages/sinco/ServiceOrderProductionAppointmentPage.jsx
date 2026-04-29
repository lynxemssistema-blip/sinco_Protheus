import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw, Search, Factory, ListChecks, History, FileText, File, Truck, FileSearch, X } from 'lucide-react';
import {
    getSincoOsItemsEnriched,
    getSincoItemProcessos,
    getSincoProcessoHistorico,
    apontarSincoProcesso,
    solicitarSincoMaterial,
    marcarChegadaSincoMaterial,
    entregarSincoMaterial,
    getSincoPedidoBom
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const formatDateTime = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
};

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const StatusBadge = ({ status }) => {
    const s = (status || '').toUpperCase();
    const style =
        s === 'CONCLUIDO' ? 'bg-green-100 text-green-800 border-green-200' :
            s === 'EM_ANDAMENTO' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                'bg-gray-100 text-gray-700 border-gray-200';
    const label = s || 'PENDENTE';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
            {label}
        </span>
    );
};

const isMaterialTipo = (tipo) => String(tipo || '').trim().toUpperCase() === 'MATERIAL';

const DeliveryBadge = ({ status }) => {
    const s = String(status || 'NAO_SOLICITADO').trim().toUpperCase();
    const style =
        s === 'ENTREGUE' ? 'bg-green-100 text-green-800 border-green-200' :
            s === 'CHEGOU' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                s === 'SOLICITADO' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    'bg-gray-100 text-gray-700 border-gray-200';

    const label =
        s === 'ENTREGUE' ? 'Entregue' :
            s === 'CHEGOU' ? 'Chegou' :
                s === 'SOLICITADO' ? 'Solicitado' :
                    'Não solicitado';

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
            {label}
        </span>
    );
};

const resolvePdfPath = (filePath) => {
    if (!filePath) return null;
    const replaced = filePath.replace(/\.[^./\\]+$/, '.pdf');
    return replaced === filePath ? `${filePath}.pdf` : replaced;
};

const openDoc = (filePath) => {
    if (!filePath) return;
    window.open(`/api/docs/view?path=${encodeURIComponent(filePath)}`, '_blank', 'noopener,noreferrer');
};

export default function ServiceOrderProductionAppointmentPage() {
    const { user } = useAuth();

    const [osId, setOsId] = useState('');
    const [items, setItems] = useState([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [itemsError, setItemsError] = useState('');

    const [selectedItemId, setSelectedItemId] = useState(null);
    const [processes, setProcesses] = useState([]);
    const [processesLoading, setProcessesLoading] = useState(false);

    const [selectedProcessId, setSelectedProcessId] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [qtd, setQtd] = useState('');
    const [observacao, setObservacao] = useState('');
    const [finalizar, setFinalizar] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [materialPrevistaChegada, setMaterialPrevistaChegada] = useState('');
    const [materialEntregarPara, setMaterialEntregarPara] = useState('');
    const [materialObs, setMaterialObs] = useState('');
    const [materialSaving, setMaterialSaving] = useState(false);
    const [materialError, setMaterialError] = useState('');

    const [showBomModal, setShowBomModal] = useState(false);
    const [bomPedido, setBomPedido] = useState('');
    const [bomData, setBomData] = useState([]);
    const [bomLoading, setBomLoading] = useState(false);
    const [bomError, setBomError] = useState('');

    const selectedItem = useMemo(
        () => items.find(i => String(i.IdOrdemServicoItem) === String(selectedItemId)) || null,
        [items, selectedItemId]
    );

    const selectedProcess = useMemo(
        () => processes.find(p => String(p.IdOSItemProcesso) === String(selectedProcessId)) || null,
        [processes, selectedProcessId]
    );

    const loadItems = async ({ resetSelection = true } = {}) => {
        if (!osId) return;
        try {
            setItemsError('');
            setItemsLoading(true);

            if (resetSelection) {
                setSelectedItemId(null);
                setProcesses([]);
                setSelectedProcessId(null);
                setHistory([]);
            }

            const data = await getSincoOsItemsEnriched(osId);
            const nextItems = Array.isArray(data) ? data : [];
            setItems(nextItems);

            if (!resetSelection && selectedItemId) {
                const stillExists = nextItems.some(i => String(i.IdOrdemServicoItem) === String(selectedItemId));
                if (!stillExists) {
                    setSelectedItemId(null);
                    setProcesses([]);
                    setSelectedProcessId(null);
                    setHistory([]);
                }
            }
        } catch (e) {
            console.error(e);
            setItems([]);
            setItemsError(e?.response?.data?.error || e?.message || 'Falha ao buscar itens da OS.');
        } finally {
            setItemsLoading(false);
        }
    };

    const fetchItems = async () => loadItems({ resetSelection: true });

    const fetchProcesses = async (itemId) => {
        if (!itemId) return;
        try {
            setProcessesLoading(true);
            setSelectedProcessId(null);
            setHistory([]);
            const data = await getSincoItemProcessos(itemId);
            setProcesses(data);
            if (data.length > 0) setSelectedProcessId(data[0].IdOSItemProcesso);
        } catch (e) {
            console.error(e);
            setProcesses([]);
        } finally {
            setProcessesLoading(false);
        }
    };

    const fetchHistory = async (processId) => {
        if (!processId) return;
        try {
            setHistoryLoading(true);
            const data = await getSincoProcessoHistorico(processId);
            setHistory(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (selectedItemId) fetchProcesses(selectedItemId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedItemId]);

    useEffect(() => {
        setMaterialError('');
        if (!selectedItem || !isMaterialTipo(selectedItem.txtTipoDesenho)) {
            setMaterialPrevistaChegada('');
            setMaterialEntregarPara('');
            setMaterialObs('');
            return;
        }

        const prev = selectedItem.EntregaChegadaPrevistaEm;
        if (prev) {
            const asString = String(prev);
            setMaterialPrevistaChegada(asString.length >= 10 ? asString.slice(0, 10) : '');
        } else {
            setMaterialPrevistaChegada('');
        }
        setMaterialEntregarPara(selectedItem.EntregaEntreguePara || '');
        setMaterialObs(selectedItem.EntregaObservacao || '');
    }, [selectedItem]);

    useEffect(() => {
        if (selectedProcessId) fetchHistory(selectedProcessId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProcessId]);

    const onSubmitApontamento = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!selectedProcessId) return;

        const quantidade = Number(qtd);
        if (!Number.isFinite(quantidade) || quantidade <= 0) {
            setFormError('Informe uma quantidade maior que 0.');
            return;
        }

        try {
            setSaving(true);
            await apontarSincoProcesso(selectedProcessId, {
                usuario: user?.login || 'DESCONHECIDO',
                quantidade,
                observacao: observacao || null,
                finalizar
            });

             setQtd('');
             setObservacao('');
             setFinalizar(false);
 
             await fetchProcesses(selectedItemId);
             await fetchHistory(selectedProcessId);
             await loadItems({ resetSelection: false });
         } catch (e2) {
             console.error(e2);
             setFormError(e2?.response?.data?.error || e2?.message || 'Falha ao registrar apontamento.');
         } finally {
             setSaving(false);
        }
    };

    const onSolicitarMaterial = async () => {
        if (!selectedItemId || !selectedItem) return;
        try {
            setMaterialError('');
            setMaterialSaving(true);
            await solicitarSincoMaterial(selectedItemId, {
                usuario: user?.login || 'DESCONHECIDO',
                chegada_prevista_em: materialPrevistaChegada || null,
                observacao: materialObs || null
            });
            await loadItems({ resetSelection: false });
        } catch (e) {
            console.error(e);
            setMaterialError(e?.response?.data?.error || e?.message || 'Falha ao solicitar material.');
        } finally {
            setMaterialSaving(false);
        }
    };

    const onMarcarChegadaMaterial = async () => {
        if (!selectedItemId || !selectedItem) return;
        try {
            setMaterialError('');
            setMaterialSaving(true);
            await marcarChegadaSincoMaterial(selectedItemId, {
                usuario: user?.login || 'DESCONHECIDO',
                observacao: materialObs || null
            });
            await loadItems({ resetSelection: false });
        } catch (e) {
            console.error(e);
            setMaterialError(e?.response?.data?.error || e?.message || 'Falha ao marcar chegada do material.');
        } finally {
            setMaterialSaving(false);
        }
    };

    const onEntregarMaterial = async () => {
        if (!selectedItemId || !selectedItem) return;
        if (!materialEntregarPara) {
            setMaterialError('Informe para quem foi entregue.');
            return;
        }

        try {
            setMaterialError('');
            setMaterialSaving(true);
            await entregarSincoMaterial(selectedItemId, {
                usuario: user?.login || 'DESCONHECIDO',
                entregue_para: materialEntregarPara,
                observacao: materialObs || null
            });
            await loadItems({ resetSelection: false });
        } catch (e) {
            console.error(e);
            setMaterialError(e?.response?.data?.error || e?.message || 'Falha ao registrar entrega do material.');
        } finally {
            setMaterialSaving(false);
        }
    };

    return (
        <div className="flex flex-col min-h-[calc(100vh-120px)] space-y-4 animate-fadeIn">
            <div className="flex-1 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <ClipboardCheck className="h-8 w-8 text-blue-600" />
                            Apontamento de Produção - OS (Sinco)
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Selecione uma OS, escolha o item e registre apontamentos por processo.
                        </p>
                    </div>
                    <button
                        onClick={fetchItems}
                        disabled={!osId || itemsLoading}
                        className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${itemsLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <form
                        onSubmit={(e) => { e.preventDefault(); fetchItems(); }}
                        className="flex flex-col md:flex-row gap-3 md:items-end"
                    >
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Número da OS</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    value={osId}
                                    onChange={(e) => setOsId(e.target.value)}
                                    placeholder="Ex: 12345"
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={!osId || itemsLoading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Buscar itens
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowBomModal(true)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm flex items-center gap-2"
                            >
                                <FileSearch className="w-4 h-4" />
                                BOM do Pedido
                            </button>
                        </div>
                    </form>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                <Factory className="h-4 w-4 text-gray-600" />
                                Itens da OS
                            </div>
                            <div className="text-xs text-gray-500">{items.length} itens</div>
                        </div>
                        {itemsError ? (
                            <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">
                                {itemsError}
                            </div>
                        ) : null}
                        <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                            <table className="min-w-full divide-y divide-gray-200 sticky-header">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Arquivos</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entrega</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qtde</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {itemsLoading ? (
                                        <tr><td colSpan="6" className="px-4 py-8 text-center text-sm text-gray-500">Carregando...</td></tr>
                                    ) : items.length === 0 ? (
                                        <tr><td colSpan="6" className="px-4 py-8 text-center text-sm text-gray-500">Nenhum item carregado.</td></tr>
                                    ) : (
                                        items.map((it) => {
                                            const active = String(selectedItemId) === String(it.IdOrdemServicoItem);
                                            const nivel = Number.isFinite(Number(it.Nivel)) ? Number(it.Nivel) : 0;
                                            const indentPx = Math.max(0, nivel) * 16;
                                            const materialPath = it.EnderecoArquivoMaterial || it.EnderecoArquivoOS || null;
                                            const pdfPath = resolvePdfPath(materialPath);
                                            const isMaterial = isMaterialTipo(it.txtTipoDesenho);
                                            const entregaStatus = it.EntregaStatus || (isMaterial ? 'NAO_SOLICITADO' : null);
                                            return (
                                                <tr
                                                    key={it.IdOrdemServicoItem}
                                                    onClick={() => setSelectedItemId(it.IdOrdemServicoItem)}
                                                    className={`cursor-pointer hover:bg-gray-50 ${active ? 'bg-blue-50/50' : ''}`}
                                                >
                                                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                                        <span className="inline-flex items-center gap-2">
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                                                                N{nivel}
                                                            </span>
                                                            {it.IdOrdemServicoItem}
                                                            <StatusBadge status={it.ItemStatus} />
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-700">
                                                        <div style={{ paddingLeft: `${indentPx}px` }} className="flex items-center gap-2">
                                                            {nivel > 0 ? <span className="text-slate-300">└</span> : null}
                                                            <div>
                                                                {it.CodMatFabricante || '-'}
                                                                <div className="text-xs text-gray-400">{it.txtTipoDesenho || ''}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-500 max-w-sm truncate" title={it.DescResumo}>
                                                        {it.DescResumo || '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-700">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); openDoc(materialPath); }}
                                                                disabled={!materialPath}
                                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 bg-white text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                title={materialPath || 'Sem caminho de desenho'}
                                                            >
                                                                <File className="h-3 w-3" />
                                                                Desenho
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); openDoc(pdfPath); }}
                                                                disabled={!pdfPath}
                                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 bg-white text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                title={pdfPath || 'Sem caminho de PDF'}
                                                            >
                                                                <FileText className="h-3 w-3" />
                                                                PDF
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-700">
                                                        {isMaterial ? <DeliveryBadge status={entregaStatus} /> : <span className="text-xs text-gray-400">-</span>}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-right text-gray-700">{it.QtdeTotal ?? it.qtde ?? '-'}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {selectedItem && isMaterialTipo(selectedItem.txtTipoDesenho) ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                        <Truck className="h-4 w-4 text-gray-600" />
                                        Controle de Entrega (Material)
                                    </div>
                                    <DeliveryBadge status={selectedItem.EntregaStatus || 'NAO_SOLICITADO'} />
                                </div>

                                <div className="p-4 space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600">
                                        <div>Solicitado em: <span className="font-semibold">{formatDateTime(selectedItem.EntregaSolicitadoEm)}</span></div>
                                        <div>Solicitado por: <span className="font-semibold">{selectedItem.EntregaSolicitadoPor || '-'}</span></div>
                                        <div>Chegada prevista: <span className="font-semibold">{selectedItem.EntregaChegadaPrevistaEm ? String(selectedItem.EntregaChegadaPrevistaEm).slice(0, 10) : '-'}</span></div>
                                        <div>Chegada em: <span className="font-semibold">{formatDateTime(selectedItem.EntregaChegadaEm)}</span></div>
                                        <div>Recebido por: <span className="font-semibold">{selectedItem.EntregaRecebidoPor || '-'}</span></div>
                                        <div>Entregue em: <span className="font-semibold">{formatDateTime(selectedItem.EntregaEntregueEm)}</span></div>
                                        <div>Entregue por: <span className="font-semibold">{selectedItem.EntregaEntreguePor || '-'}</span></div>
                                        <div>Entregue para: <span className="font-semibold">{selectedItem.EntregaEntreguePara || '-'}</span></div>
                                    </div>

                                    {materialError ? (
                                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                            {materialError}
                                        </div>
                                    ) : null}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Chegada prevista</label>
                                            <input
                                                type="date"
                                                value={materialPrevistaChegada}
                                                onChange={(e) => setMaterialPrevistaChegada(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                disabled={materialSaving}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Entregar para</label>
                                            <input
                                                value={materialEntregarPara}
                                                onChange={(e) => setMaterialEntregarPara(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Login / Nome"
                                                disabled={materialSaving}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Observação</label>
                                        <input
                                            value={materialObs}
                                            onChange={(e) => setMaterialObs(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Opcional"
                                            disabled={materialSaving}
                                        />
                                    </div>

                                    <div className="flex flex-wrap gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={onSolicitarMaterial}
                                            disabled={materialSaving || String(selectedItem.EntregaStatus || 'NAO_SOLICITADO').toUpperCase() !== 'NAO_SOLICITADO'}
                                            className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Solicitar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onMarcarChegadaMaterial}
                                            disabled={materialSaving || String(selectedItem.EntregaStatus || 'NAO_SOLICITADO').toUpperCase() !== 'SOLICITADO'}
                                            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Marcar Chegada
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onEntregarMaterial}
                                            disabled={materialSaving || String(selectedItem.EntregaStatus || 'NAO_SOLICITADO').toUpperCase() !== 'CHEGOU'}
                                            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Entregar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                    <ListChecks className="h-4 w-4 text-gray-600" />
                                    Processos do item
                                </div>
                                <div className="text-xs text-gray-500">{processes.length} processos</div>
                            </div>
                            <div className="overflow-x-auto overflow-y-auto max-h-[35vh]">
                                <table className="min-w-full divide-y divide-gray-200 sticky-header">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seq</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Processo</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Prev.</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Prod.</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Início</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fim</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {!selectedItemId ? (
                                            <tr><td colSpan="8" className="px-4 py-8 text-center text-sm text-gray-500">Selecione um item.</td></tr>
                                        ) : processesLoading ? (
                                            <tr><td colSpan="8" className="px-4 py-8 text-center text-sm text-gray-500">Carregando...</td></tr>
                                        ) : processes.length === 0 ? (
                                            <tr><td colSpan="8" className="px-4 py-8 text-center text-sm text-gray-500">Nenhum processo encontrado.</td></tr>
                                        ) : (
                                            processes.map((p) => {
                                                const active = String(selectedProcessId) === String(p.IdOSItemProcesso);
                                                return (
                                                    <tr
                                                        key={p.IdOSItemProcesso}
                                                        onClick={() => setSelectedProcessId(p.IdOSItemProcesso)}
                                                        className={`cursor-pointer hover:bg-gray-50 ${active ? 'bg-blue-50/50' : ''}`}
                                                    >
                                                        <td className="px-4 py-2 text-sm text-gray-700">{p.SequenciaExecucao ?? '-'}</td>
                                                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.CodigoProcessoFabricacao || '-'}</td>
                                                        <td className="px-4 py-2 text-sm text-gray-600">{p.NomeProcesso || ''}</td>
                                                        <td className="px-4 py-2 text-sm text-right text-gray-700">{toNumber(p.QtdePrevista)}</td>
                                                        <td className="px-4 py-2 text-sm text-right text-gray-700">{toNumber(p.QtdeProduzida)}</td>
                                                        <td className="px-4 py-2 text-sm"><StatusBadge status={p.Situacao} /></td>
                                                        <td className="px-4 py-2 text-xs text-gray-500">{formatDateTime(p.DataInicio)}</td>
                                                        <td className="px-4 py-2 text-xs text-gray-500">{formatDateTime(p.DataFim)}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50/50">
                                <form onSubmit={onSubmitApontamento} className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-semibold text-gray-800">Registrar apontamento</div>
                                        <div className="text-xs text-gray-500">
                                            Processo selecionado: {selectedProcess ? `${selectedProcess.CodigoProcessoFabricacao || ''} - ${selectedProcess.NomeProcesso || ''}` : '-'}
                                        </div>
                                    </div>

                                    {selectedProcess ? (
                                        <div className="text-xs text-gray-600 grid grid-cols-1 md:grid-cols-3 gap-2">
                                            <div>Prevista: <span className="font-semibold">{toNumber(selectedProcess.QtdePrevista)}</span></div>
                                            <div>Produzida: <span className="font-semibold">{toNumber(selectedProcess.QtdeProduzida)}</span></div>
                                            <div>Status: <StatusBadge status={selectedProcess.Situacao} /></div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-500">Selecione um processo para apontar.</div>
                                    )}

                                    {formError ? (
                                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                            {formError}
                                        </div>
                                    ) : null}

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Quantidade</label>
                                            <input
                                                type="number"
                                                step="0.001"
                                                value={qtd}
                                                onChange={(e) => setQtd(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Ex: 1"
                                                disabled={!selectedProcessId || saving}
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Observação (opcional)</label>
                                            <input
                                                value={observacao}
                                                onChange={(e) => setObservacao(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Ex: apontamento parcial / ajuste / motivo"
                                                disabled={!selectedProcessId || saving}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                            <input
                                                type="checkbox"
                                                checked={finalizar}
                                                onChange={(e) => setFinalizar(e.target.checked)}
                                                disabled={!selectedProcessId || saving}
                                            />
                                            Finalizar processo após apontar
                                        </label>

                                        <button
                                            type="submit"
                                            disabled={!selectedProcessId || saving}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {saving ? 'Registrando...' : 'Registrar'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-4 pb-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                <History className="h-4 w-4 text-gray-600" />
                                Histórico do processo
                            </div>
                            <div className="text-xs text-gray-500">{history.length} registros</div>
                        </div>
                        <div className="overflow-x-auto overflow-y-auto max-h-[40vh]">
                            <table className="min-w-full divide-y divide-gray-200 sticky-header">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qtde</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Faltante</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Obs</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Situação</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origem</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {!selectedProcessId ? (
                                        <tr><td colSpan="7" className="px-4 py-8 text-center text-sm text-gray-500">Selecione um processo.</td></tr>
                                    ) : historyLoading ? (
                                        <tr><td colSpan="7" className="px-4 py-8 text-center text-sm text-gray-500">Carregando...</td></tr>
                                    ) : history.length === 0 ? (
                                        <tr><td colSpan="7" className="px-4 py-8 text-center text-sm text-gray-500">Sem registros.</td></tr>
                                    ) : (
                                        history.map((h) => (
                                            <tr key={h.IdOrdemServicoItemControle || `${h.DataCriacao}-${Math.random()}`}>
                                                <td className="px-4 py-2 text-xs text-gray-600">{formatDateTime(h.DataCriacao)}</td>
                                                <td className="px-4 py-2 text-sm text-gray-700">{h.CriadoPor || '-'}</td>
                                                <td className="px-4 py-2 text-sm text-right text-gray-700">{toNumber(h.QtdeProduzida)}</td>
                                                <td className="px-4 py-2 text-sm text-right text-gray-700">{toNumber(h.QtdeFaltante)}</td>
                                                <td className="px-4 py-2 text-xs text-gray-500 max-w-[150px] truncate" title={h.Observacao}>{h.Observacao || '-'}</td>
                                                <td className="px-4 py-2 text-sm"><StatusBadge status={h.Situacao} /></td>
                                                <td className="px-4 py-2 text-xs text-gray-500">{h.Origem || '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {showBomModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <FileSearch className="w-5 h-5 text-blue-600" />
                                Estrutura do Pedido (BOM)
                            </h2>
                            <button
                                onClick={() => setShowBomModal(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-4 border-b bg-white flex items-center gap-3">
                            <div className="flex-1 max-w-sm">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Número do Pedido</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input
                                        value={bomPedido}
                                        onChange={(e) => setBomPedido(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && fetchBom()}
                                        placeholder="Ex: 003731"
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={fetchBom}
                                disabled={!bomPedido || bomLoading}
                                className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                            >
                                {bomLoading ? 'Buscando...' : 'Buscar BOM'}
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-50 p-4">
                            {bomError ? (
                                <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
                                    {bomError}
                                </div>
                            ) : null}

                            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">OP</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Produto Final</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Componente</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Descrição</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">UM</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Qtd Unit</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Total Nec.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {bomLoading ? (
                                            <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">Buscando estrutura no Protheus...</td></tr>
                                        ) : bomData.length === 0 ? (
                                            <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">Nenhum componente encontrado ou pedido não informado.</td></tr>
                                        ) : (
                                            bomData.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 text-sm font-mono text-slate-800">{row.OP}</td>
                                                    <td className="px-4 py-2 text-sm font-mono text-slate-600">{row.Produto_Final}</td>
                                                    <td className="px-4 py-2 text-sm font-mono font-bold text-blue-700">{row.Cod_Componente}</td>
                                                    <td className="px-4 py-2 text-sm text-slate-700">{row.Descricao_Componente}</td>
                                                    <td className="px-4 py-2 text-sm text-right text-slate-600">{row.UM}</td>
                                                    <td className="px-4 py-2 text-sm text-right font-medium text-slate-700">{toNumber(row.Qtd_Por_Unidade)}</td>
                                                    <td className="px-4 py-2 text-sm text-right font-bold text-emerald-700">{toNumber(row.Total_Necessario)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
