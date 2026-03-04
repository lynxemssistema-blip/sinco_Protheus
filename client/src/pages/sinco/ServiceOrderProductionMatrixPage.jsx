import React, { useEffect, useMemo, useState } from 'react';
import {
    Grid3x3, Search, X, Save, File, FileText, Calendar, Clock,
    CheckSquare, CheckCircle, ChevronRight, History, ChevronDown, ChevronUp, AlertTriangle, FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
    apontarSincoProcesso, getSincoOsMatrix, getSincoProcessoHistorico,
    getSincoOsProcessosPlanejamento, saveSincoOsProcessosPlanejamento
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
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

const formatDateShort = (dateStr) => {
    if (!dateStr) return null;
    try {
        const parts = dateStr.split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}`;
        }
        return null;
    } catch (e) {
        return null;
    }
};

const getCellStyle = (status) => {
    if (status === 'done') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'in_progress') return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    return 'bg-gray-50 text-gray-500 border-gray-200';
};

const getNivelColor = (nivel) => {
    if (nivel === 0) return 'bg-blue-100 text-blue-700';
    if (nivel === 1) return 'bg-green-100 text-green-700';
    if (nivel === 2) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
};

function AppointmentModal({ open, onClose, onSave, selected }) {
    const { user } = useAuth();

    const opData = selected?.opData;
    const item = selected?.item;
    const opMeta = selected?.opMeta;

    const planned = toNumber(opData?.qtd_planejada);
    const produced = toNumber(opData?.qtd_produzida);
    const saldo = Math.max(0, planned - produced);

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [formData, setFormData] = useState({
        quantidade: '',
        observacao: '',
        data_inicio: oneHourAgo.toISOString().split('T')[0],
        hora_inicio: oneHourAgo.toTimeString().slice(0, 5),
        data_fim: now.toISOString().split('T')[0],
        hora_fim: now.toTimeString().slice(0, 5),
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [showHistory, setShowHistory] = useState(true);

    useEffect(() => {
        if (!open || !opData?.id) return;
        const n = new Date();
        const h = new Date(n.getTime() - 60 * 60 * 1000);
        setFormData({
            quantidade: '',
            observacao: '',
            data_inicio: h.toISOString().split('T')[0],
            hora_inicio: h.toTimeString().slice(0, 5),
            data_fim: n.toISOString().split('T')[0],
            hora_fim: n.toTimeString().slice(0, 5),
        });
        setError('');
        setSaving(false);
        setHistory([]);
        setShowHistory(true);

        setLoadingHistory(true);
        getSincoProcessoHistorico(opData.id)
            .then(data => setHistory(Array.isArray(data) ? data : []))
            .catch(() => setHistory([]))
            .finally(() => setLoadingHistory(false));
    }, [open, opData?.id]);

    if (!open || !selected) return null;

    const isLastOp = !opMeta?.nextOpName;

    const onSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const qtd = Number(formData.quantidade);
        if (!Number.isFinite(qtd) || qtd <= 0) {
            setError('Informe uma quantidade maior que 0.');
            return;
        }
        if (planned > 0 && qtd > saldo) {
            setError('Quantidade excede o saldo planejado.');
            return;
        }
        try {
            setSaving(true);
            await onSave({
                usuario: user?.login || user?.nome || 'DESCONHECIDO',
                quantidade: qtd,
                observacao: formData.observacao || null,
                data_inicio: `${formData.data_inicio} ${formData.hora_inicio}:00`,
                data_fim: `${formData.data_fim} ${formData.hora_fim}:00`,
            });
            onClose();
        } catch (e2) {
            setError(e2?.response?.data?.error || e2?.message || 'Falha ao registrar apontamento.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <CheckSquare className="w-5 h-5 text-green-600" />
                        Apontar Produção
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* OP Info */}
                    <div className="bg-slate-50 p-3 rounded text-sm border border-slate-200">
                        <p><strong>OS:</strong> {item?.IdOrdemServico} — {item?.CodMatFabricante || '-'}</p>
                        <p><strong>Operação:</strong> {opData?.sequencia} — {opMeta?.code} — {opMeta?.name || '-'}</p>
                        <p className="mt-1 text-slate-600 text-xs">Apontando como: <strong>{user?.nome || user?.login}</strong></p>
                    </div>

                    {/* Process Flow Indicator */}
                    {isLastOp ? (
                        <div className="bg-green-50 border border-green-100 p-3 rounded flex items-start gap-3">
                            <div className="bg-green-100 p-1.5 rounded-full mt-0.5">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-green-800 uppercase tracking-wide">Processo Final</h4>
                                <p className="text-sm font-medium text-green-900">Esta é a última operação. Enviar para Estoque/Expedição.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded flex items-start gap-3">
                            <div className="bg-blue-100 p-1.5 rounded-full mt-0.5">
                                <ChevronRight className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-0.5">Fluxo de Produção</h4>
                                <div className="text-sm text-blue-900">
                                    <span className="text-blue-500 text-xs block mb-1">Próximo Processo:</span>
                                    <span className="font-bold">{opMeta?.nextOpName}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* History Section */}
                    {loadingHistory ? (
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded text-center text-sm text-slate-500">
                            <History className="w-4 h-4 inline-block mr-2 animate-pulse" />
                            Carregando histórico...
                        </div>
                    ) : history.length > 0 ? (
                        <div className="bg-slate-50 border border-slate-200 rounded overflow-hidden">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-100 transition-colors"
                            >
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                    <History className="w-4 h-4 text-slate-500" />
                                    Histórico ({history.length} apontamento{history.length !== 1 ? 's' : ''})
                                </span>
                                {showHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </button>
                            {showHistory && (
                                <div className="max-h-48 overflow-y-auto border-t border-slate-200">
                                    {history.slice(0, 10).map((h, idx) => {
                                        const dt = h.DataCriacao ? new Date(h.DataCriacao) : null;
                                        const isToday = dt && dt.toDateString() === new Date().toDateString();
                                        return (
                                            <div key={idx} className="p-3 border-b border-slate-100 last:border-b-0 hover:bg-white transition-colors">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold text-sm">
                                                            {parseFloat(h.QtdeProduzida || 0).toFixed(2)} pc
                                                        </div>
                                                        <span className="text-xs text-slate-600 font-medium">{h.CriadoPor || '-'}</span>
                                                    </div>
                                                    {dt && (
                                                        <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                                                            {isToday ? 'Hoje' : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                            {' '}{dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                                {h.Observacao && (
                                                    <div className="text-xs text-slate-500 italic bg-slate-50 px-2 py-1 rounded mt-1">
                                                        "{h.Observacao}"
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded text-sm text-blue-700 flex items-center gap-2">
                            <History className="w-4 h-4" />
                            <span>Nenhum apontamento anterior encontrado</span>
                        </div>
                    )}

                    <form onSubmit={onSubmit} className="space-y-4">
                        {/* Quantity */}
                        <div className="bg-slate-50 p-3 rounded border">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-slate-700">Quantidade Produzida</label>
                                <span className="text-xs font-bold text-slate-500">Saldo: {saldo}</span>
                            </div>
                            <input
                                type="number" step="0.01" required
                                max={planned > 0 ? saldo : undefined}
                                className="w-full border rounded p-2 font-mono text-lg text-slate-900 border-slate-300 focus:border-green-500 outline-none"
                                value={formData.quantidade}
                                onChange={e => setFormData({ ...formData, quantidade: e.target.value })}
                                placeholder={`Máx: ${saldo}`}
                                autoFocus
                            />
                            <div className="mt-1 flex justify-between text-xs">
                                <span className="text-slate-400">Pedido: {planned} | Já Prod: {produced}</span>
                                {Number(formData.quantidade) > saldo && (
                                    <span className="text-red-600 font-bold flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> Excede o saldo!
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Date/Time Start */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Data Início Real</label>
                                <input type="date" required className="w-full border rounded p-2 text-sm"
                                    value={formData.data_inicio} onChange={e => setFormData({ ...formData, data_inicio: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Hora Início</label>
                                <input type="time" required className="w-full border rounded p-2 text-sm"
                                    value={formData.hora_inicio} onChange={e => setFormData({ ...formData, hora_inicio: e.target.value })} />
                            </div>
                        </div>

                        {/* Date/Time End */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Data Fim Real</label>
                                <input type="date" required className="w-full border rounded p-2 text-sm"
                                    value={formData.data_fim} onChange={e => setFormData({ ...formData, data_fim: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Hora Fim</label>
                                <input type="time" required className="w-full border rounded p-2 text-sm"
                                    value={formData.hora_fim} onChange={e => setFormData({ ...formData, hora_fim: e.target.value })} />
                            </div>
                        </div>

                        {/* Observation */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Observação</label>
                            <textarea className="w-full border rounded p-2 text-sm" rows="2"
                                value={formData.observacao} onChange={e => setFormData({ ...formData, observacao: e.target.value })} />
                        </div>

                        {error && <div className="text-sm text-red-600 font-medium">{error}</div>}

                        <button
                            type="submit"
                            disabled={saving || Number(formData.quantidade) > saldo || Number(formData.quantidade) <= 0}
                            className="w-full bg-green-600 text-white rounded-lg p-2 font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-sm"
                        >
                            <CheckSquare className="w-4 h-4" />
                            {saving ? 'Salvando...' : 'Confirmar Apontamento'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

function PlanningModal({ open, onClose, osId, onSaveSuccess }) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [processos, setProcessos] = useState([]);
    const [targetEndDate, setTargetEndDate] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open && osId) {
            loadPlanning();
        }
    }, [open, osId]);

    const loadPlanning = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getSincoOsProcessosPlanejamento(osId);

            // Inicializa durações baseadas nas datas existentes
            const processedData = data.map(p => {
                let duration = 0;
                if (p.DataPlanejadaInicio && p.DataPlanejadaFim) {
                    const start = new Date(p.DataPlanejadaInicio);
                    const end = new Date(p.DataPlanejadaFim);
                    duration = Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
                }
                return { ...p, duracao: duration };
            });

            setProcessos(processedData);

            // Define data final alvo como a maior data final encontrada
            const maxEndDate = processedData.reduce((max, p) => {
                if (!p.DataPlanejadaFim) return max;
                return p.DataPlanejadaFim > max ? p.DataPlanejadaFim : max;
            }, '');

            if (maxEndDate) {
                setTargetEndDate(maxEndDate.split('T')[0]);
            }
        } catch (err) {
            setError('Erro ao carregar processos.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const calculateBackward = (endDate, currentProcessos) => {
        if (!endDate) return currentProcessos;

        // Ordena por sequência decrescente para cálculo retroativo
        const sorted = [...currentProcessos].sort((a, b) => b.Sequencia - a.Sequencia);
        let lastStart = new Date(endDate);

        const updated = sorted.map((p, index) => {
            const dur = parseInt(p.duracao) || 0;
            const currentEnd = new Date(lastStart);
            const currentStart = new Date(currentEnd);
            currentStart.setDate(currentEnd.getDate() - dur);

            lastStart = new Date(currentStart);

            return {
                ...p,
                DataPlanejadaInicio: currentStart.toISOString().split('T')[0],
                DataPlanejadaFim: currentEnd.toISOString().split('T')[0]
            };
        });

        // Retorna ordenado pela sequência original
        return updated.sort((a, b) => a.Sequencia - b.Sequencia);
    };

    const handleTargetDateChange = (val) => {
        setTargetEndDate(val);
        if (val) {
            setProcessos(prev => calculateBackward(val, prev));
        }
    };

    const handleDurationChange = (idProcesso, dur) => {
        const val = parseInt(dur) || 0;
        setProcessos(prev => {
            const updated = prev.map(p => p.IdProcesso === idProcesso ? { ...p, duracao: val } : p);
            return targetEndDate ? calculateBackward(targetEndDate, updated) : updated;
        });
    };

    const handleDateChange = (idProcesso, field, value) => {
        setProcessos(prev => prev.map(p =>
            p.IdProcesso === idProcesso ? { ...p, [field]: value } : p
        ));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            await saveSincoOsProcessosPlanejamento(osId, { processos });
            onSaveSuccess();
            onClose();
        } catch (err) {
            alert('Erro ao salvar planejamento: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scaleIn flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-800">Planejamento Inteligente (Lote)</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">Carregando processos...</div>
                    ) : error ? (
                        <div className="text-center py-10 text-red-500">{error}</div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Data de Entrega / Finalização OS
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            className="w-full pl-10 pr-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium transition-all shadow-sm"
                                            value={targetEndDate}
                                            onChange={(e) => handleTargetDateChange(e.target.value)}
                                        />
                                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-blue-400" />
                                    </div>
                                    <p className="mt-1 text-[10px] text-slate-400">Define o prazo final para o cálculo retroativo.</p>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100/50 h-fit self-end">
                                    <AlertTriangle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                    <p className="text-[11px] text-blue-700 leading-tight">
                                        As datas são calculadas de trás para frente. <br />
                                        Ajuste os dias de cada etapa para recalcular.
                                    </p>
                                </div>
                            </div>

                            <div className="border rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold text-slate-600 w-16">Seq</th>
                                            <th className="px-4 py-3 text-left font-bold text-slate-600">Processo</th>
                                            <th className="px-4 py-3 text-center font-bold text-slate-600 w-24">Dias</th>
                                            <th className="px-4 py-3 text-left font-bold text-slate-600">Início Planejado</th>
                                            <th className="px-4 py-3 text-left font-bold text-slate-600">Fim Planejado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {processos.map(proc => (
                                            <tr key={proc.IdProcesso} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-4 py-4 text-slate-400 text-center font-mono">{proc.Sequencia}</td>
                                                <td className="px-4 py-4">
                                                    <div className="font-bold text-slate-800">{proc.NomeProcesso || 'N/A'}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{proc.CodigoProcessoFabricacao}</div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className="w-16 h-9 border border-slate-300 rounded-lg px-2 text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                                                            value={proc.duracao}
                                                            onChange={(e) => handleDurationChange(proc.IdProcesso, e.target.value)}
                                                        />
                                                        <Clock className="h-3.5 w-3.5 text-slate-300" />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="date"
                                                        className="border border-slate-300 rounded-lg px-3 py-1.5 w-full focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs"
                                                        value={proc.DataPlanejadaInicio ? proc.DataPlanejadaInicio.split('T')[0] : ''}
                                                        onChange={(e) => handleDateChange(proc.IdProcesso, 'DataPlanejadaInicio', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="date"
                                                        className="border border-slate-300 rounded-lg px-3 py-1.5 w-full focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs"
                                                        value={proc.DataPlanejadaFim ? proc.DataPlanejadaFim.split('T')[0] : ''}
                                                        onChange={(e) => handleDateChange(proc.IdProcesso, 'DataPlanejadaFim', e.target.value)}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || loading}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-200 flex items-center gap-2 transition-all active:scale-95"
                    >
                        {saving ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Salvar Planejamento
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}


export default function ServiceOrderProductionMatrixPage() {
    const [osId, setOsId] = useState('');
    const [q, setQ] = useState('');
    const [projeto, setProjeto] = useState('');
    const [tag, setTag] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState({ operations: [], items: [] });

    const [selected, setSelected] = useState(null); // { item, opKey, opMeta, opData }
    const [planningOpen, setPlanningOpen] = useState(false);

    // Estados para debounce
    const [debouncedQ, setDebouncedQ] = useState(q);
    const [debouncedProjeto, setDebouncedProjeto] = useState(projeto);
    const [debouncedTag, setDebouncedTag] = useState(tag);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQ(q);
            setDebouncedProjeto(projeto);
            setDebouncedTag(tag);
        }, 400);
        return () => clearTimeout(timer);
    }, [q, projeto, tag]);

    const canSearch = Boolean(osId || projeto || tag || q);

    const loadData = async () => {
        if (!canSearch) return;
        try {
            setError('');
            setLoading(true);
            const targetOsId = osId || 'all';
            const result = await getSincoOsMatrix(targetOsId, {
                q: q || undefined,
                projeto: projeto || undefined,
                tag: tag || undefined
            });
            setData({
                operations: Array.isArray(result?.operations) ? result.operations : [],
                items: Array.isArray(result?.items) ? result.items : []
            });
        } catch (e) {
            console.error(e);
            setData({ operations: [], items: [] });
            setError(e?.response?.data?.error || e?.message || 'Falha ao carregar matriz da OS.');
        } finally {
            setLoading(false);
        }
    };

    const allItems = useMemo(() => data.items || [], [data.items]);
    const operations = useMemo(() => data.operations || [], [data.operations]);

    // Client-side filter: applies q, projeto, tag over already-loaded data
    const items = useMemo(() => {
        let res = allItems;
        const term = String(debouncedQ || '').trim().toLowerCase();
        const termProjeto = String(debouncedProjeto || '').trim().toLowerCase();
        const termTag = String(debouncedTag || '').trim().toLowerCase();
        if (term) {
            res = res.filter(i =>
                String(i.CodMatFabricante || '').toLowerCase().includes(term) ||
                String(i.DescResumo || '').toLowerCase().includes(term)
            );
        }
        if (termProjeto) {
            res = res.filter(i => String(i.Projeto || '').toLowerCase().includes(termProjeto));
        }
        if (termTag) {
            res = res.filter(i => String(i.Tag || '').toLowerCase().includes(termTag));
        }
        return res;
    }, [allItems, debouncedQ, debouncedProjeto, debouncedTag]);

    const handleCellClick = (item, opMeta) => {
        const opKey = opMeta.key;
        const opData = item.operations?.[opKey];
        if (!opData) return;
        // Find the next operation for the process flow indicator
        const currentIdx = operations.findIndex(o => o.key === opKey);
        const nextOp = currentIdx >= 0 && currentIdx < operations.length - 1 ? operations[currentIdx + 1] : null;
        const enrichedOpMeta = { ...opMeta, nextOpName: nextOp ? (nextOp.name || nextOp.code) : null };
        setSelected({ item, opKey, opMeta: enrichedOpMeta, opData });
    };

    const handleSave = async (payload) => {
        if (!selected?.opData?.id) return;

        const opId = selected.opData.id;
        const beforeProduced = toNumber(selected.opData.qtd_produzida);
        const planned = toNumber(selected.opData.qtd_planejada);

        await apontarSincoProcesso(opId, payload);

        // Atualização otimista do estado da matriz
        setData(prev => {
            const nextItems = (prev.items || []).map(it => {
                if (String(it.IdOrdemServicoItem) !== String(selected.item.IdOrdemServicoItem)) return it;

                const updatedOps = { ...(it.operations || {}) };
                const current = updatedOps[selected.opKey];
                if (!current) return it;

                const added = toNumber(payload.quantidade);
                const nextProduced = beforeProduced + added;
                const percent = planned > 0 ? Math.min(100, Math.round((nextProduced / planned) * 100)) : (nextProduced > 0 ? 100 : 0);
                const done = planned > 0 ? nextProduced >= planned : Boolean(payload.finalizar); // Note: 'finalizar' is removed from new modal, consider its impact
                const status = done ? 'done' : (nextProduced > 0 ? 'in_progress' : 'pending');

                updatedOps[selected.opKey] = {
                    ...current,
                    qtd_produzida: nextProduced,
                    percentual: percent,
                    status
                };

                const opsArr = Object.values(updatedOps);
                const total = opsArr.length;
                const concluidos = opsArr.filter(o => o.status === 'done').length;

                let itemStatus = 'PENDENTE';
                if (String(it.OrdemServicoItemFinalizado || '').toUpperCase() === 'S') itemStatus = 'CONCLUIDO';
                else if (total > 0 && concluidos === total) itemStatus = 'CONCLUIDO';
                else if (opsArr.some(o => o.status !== 'pending')) itemStatus = 'EM_ANDAMENTO';

                return {
                    ...it,
                    operations: updatedOps,
                    TotalProcessos: total,
                    ProcessosConcluidos: concluidos,
                    ItemStatus: itemStatus
                };
            });

            return { ...prev, items: nextItems };
        });
    };

    const exportToExcel = () => {
        if (!items.length) return;

        const exportData = items.map(item => {
            // Calcular porcentagem de conclusão (média das operações existentes)
            let totalPct = 0;
            let countOps = 0;

            operations.forEach(op => {
                const opData = item.operations?.[op.key];
                if (opData) {
                    const planned = toNumber(opData.qtd_planejada);
                    const produced = toNumber(opData.qtd_produzida);
                    let p = 0;
                    if (planned > 0) p = (produced / planned) * 100;
                    else if (produced > 0) p = 100;
                    if (p > 100) p = 100; // Limita a 100% para o cálculo da média
                    totalPct += p;
                    countOps++;
                }
            });

            const row = {
                'Item': item.CodMatFabricante,
                'Descrição': item.DescResumo,
                'Projeto': item.Projeto || '',
                'Tag': item.Tag || '',
                'Nível': item.Nivel,
                'Status': item.ItemStatus,
                '% Conclusão': countOps > 0 ? `${(totalPct / countOps).toFixed(1)}%` : '0.0%'
            };

            operations.forEach(op => {
                const opData = item.operations?.[op.key];
                // Formato: Produzido / Planejado
                const val = opData ? `${toNumber(opData.qtd_produzida)} / ${toNumber(opData.qtd_planejada)}` : '-';
                row[op.code] = val;
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Matriz");
        XLSX.writeFile(wb, `Matriz_OS_${osId}.xlsx`);
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Grid3x3 className="h-6 w-6 text-blue-600" />
                            <h1 className="text-2xl font-bold text-gray-900">Apontamento Matriz - OS (SINCO)</h1>
                        </div>
                        <p className="text-sm text-gray-500">
                            Clique em uma célula para apontar produção do processo do item.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="w-full md:w-40">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nº OS</label>
                            <input
                                type="text"
                                value={osId}
                                onChange={(e) => setOsId(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && canSearch && loadData()}
                                placeholder="Ex: 8 (opcional)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex-1 md:w-56">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Filtro</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="CodMat / descrição..."
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex-1 md:w-32">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Projeto</label>
                            <input
                                type="text"
                                value={projeto}
                                onChange={(e) => setProjeto(e.target.value)}
                                placeholder="Projeto..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="flex-1 md:w-32">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tag</label>
                            <input
                                type="text"
                                value={tag}
                                onChange={(e) => setTag(e.target.value)}
                                placeholder="Tag..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={loadData}
                            disabled={!canSearch || loading}
                            className="h-10 mt-5 md:mt-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 rounded-lg text-sm font-medium transition-colors"
                            title={!canSearch ? 'Preencha ao menos um filtro para buscar' : 'Buscar dados'}
                        >
                            {loading ? 'Buscando...' : 'Buscar'}
                        </button>
                        <button
                            type="button"
                            onClick={exportToExcel}
                            disabled={!osId || loading || items.length === 0}
                            className="h-10 mt-5 md:mt-0 bg-green-50 border border-green-200 hover:bg-green-100 text-green-700 px-4 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            title="Exportar Matriz para Excel"
                        >
                            <FileDown className="h-4 w-4" />
                            Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => setPlanningOpen(true)}
                            disabled={!osId || loading}
                            className="h-10 mt-5 md:mt-0 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 px-4 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            title="Planejamento de Datas (Lote)"
                        >
                            <Calendar className="h-4 w-4" />
                            Planejamento
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-10 text-center text-gray-500">Carregando...</div>
                ) : error ? (
                    <div className="p-10 text-center text-red-600 font-medium">{error}</div>
                ) : items.length === 0 ? (
                    <div className="p-10 text-center text-gray-400">Nenhum item encontrado.</div>
                ) : (
                    <div className="bg-white overflow-hidden">
                        <div className="overflow-auto h-[calc(100vh-260px)]">
                            <table className="w-full border-collapse min-w-max">
                                <thead className="bg-slate-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="border-b border-r px-4 py-3 text-left text-xs font-bold text-slate-700 bg-slate-100 sticky left-0 z-20 min-w-[280px]">
                                            Item / Material
                                        </th>
                                        <th className="border-b border-r px-3 py-3 text-left text-xs font-bold text-slate-700 bg-slate-100 sticky left-[280px] z-20 min-w-[90px]">
                                            Projeto
                                        </th>
                                        <th className="border-b border-r px-3 py-3 text-left text-xs font-bold text-slate-700 bg-slate-100 sticky left-[370px] z-20 min-w-[80px]">
                                            Tag
                                        </th>
                                        <th className="border-b border-r px-3 py-3 text-left text-xs font-bold text-slate-700 bg-slate-100 sticky left-[450px] z-20 min-w-[90px]">
                                            Tipo
                                        </th>
                                        {operations.map(op => (
                                            <th key={op.key} className="border-b px-3 py-3 text-center text-xs font-bold text-slate-700 min-w-[140px]">
                                                <div className="flex flex-col items-center">
                                                    <span>{op.sequencia} - {op.code}</span>
                                                    {op.name && (
                                                        <span className="text-[10px] text-slate-500 font-normal mt-0.5" title={op.name}>
                                                            {op.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => {
                                        const nivel = Number(item.Nivel || 0);
                                        const indentPx = nivel * 18;
                                        const desenhoPath = item.EnderecoArquivoMaterial || item.EnderecoArquivoOS || null;
                                        const pdfPath = resolvePdfPath(desenhoPath);

                                        return (
                                            <tr key={`${item.IdOrdemServicoItem}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                                {/* Coluna Item / Material */}
                                                <td className="border-b border-r px-4 py-3 bg-white sticky left-0 z-10">
                                                    <div className="flex items-start gap-3">
                                                        <span className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${getNivelColor(nivel)}`}>
                                                            {nivel}
                                                        </span>
                                                        <div style={{ paddingLeft: `${indentPx}px` }} className="min-w-0 flex-1">
                                                            <div className="font-semibold text-slate-900 truncate" title={item.CodMatFabricante}>
                                                                {item.CodMatFabricante || '-'}
                                                            </div>
                                                            <div className="text-xs text-slate-500 truncate" title={item.DescResumo}>
                                                                {item.DescResumo || '-'}
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-1.5">
                                                                {pdfPath ? (
                                                                    <button type="button" onClick={() => openDoc(pdfPath)} className="p-0.5 rounded hover:bg-red-50 transition-colors" title={`Abrir PDF: ${pdfPath}`}>
                                                                        <FileText className="h-3.5 w-3.5 text-red-500" />
                                                                    </button>
                                                                ) : (
                                                                    <FileText className="h-3.5 w-3.5 text-gray-300" title="Sem PDF" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Coluna Projeto */}
                                                <td className="border-b border-r px-3 py-3 bg-white sticky left-[280px] z-10">
                                                    {item.Projeto ? (
                                                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold uppercase border border-blue-100 whitespace-nowrap">
                                                            {item.Projeto}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">—</span>
                                                    )}
                                                </td>

                                                {/* Coluna Tag */}
                                                <td className="border-b border-r px-3 py-3 bg-white sticky left-[370px] z-10">
                                                    {item.Tag ? (
                                                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-bold uppercase border border-amber-100 whitespace-nowrap">
                                                            {item.Tag}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">—</span>
                                                    )}
                                                </td>

                                                {/* Coluna Tipo Desenho */}
                                                <td className="border-b border-r px-3 py-3 bg-white sticky left-[450px] z-10">
                                                    <span className="text-[10px] text-slate-600 font-medium">
                                                        {item.txtTipoDesenho || '—'}
                                                    </span>
                                                </td>

                                                {operations.map(op => {
                                                    const opData = item.operations?.[op.key];
                                                    if (!opData) {
                                                        return <td key={op.key} className="border-b px-3 py-3 bg-white/40" />;
                                                    }

                                                    const planned = toNumber(opData.qtd_planejada);
                                                    const produced = toNumber(opData.qtd_produzida);
                                                    const percent = toNumber(opData.percentual);

                                                    return (
                                                        <td
                                                            key={op.key}
                                                            className="border-b px-3 py-3"
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCellClick(item, op)}
                                                                className={`w-full text-left rounded-lg border px-2 py-2 transition-colors hover:shadow-sm ${getCellStyle(opData.status)}`}
                                                                title="Clique para apontar"
                                                            >
                                                                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                                                                    <span className="font-mono bg-white/50 px-1 rounded text-[10px]">Seq {opData.sequencia}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between text-xs font-semibold">
                                                                    <span className="font-mono">{produced}/{planned}</span>
                                                                    <span className="font-mono">{percent}%</span>
                                                                </div>
                                                                <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mt-2">
                                                                    <div
                                                                        className="h-full bg-current transition-all"
                                                                        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                                                                    />
                                                                </div>

                                                                {(opData.dates?.plan_start || opData.dates?.plan_end) && (
                                                                    <div className="mt-1 flex items-center justify-center gap-1 text-[10px] opacity-70 font-medium">
                                                                        <Calendar className="h-2.5 w-2.5" />
                                                                        <span>
                                                                            {formatDateShort(opData.dates.plan_start) || '?'}
                                                                            {opData.dates.plan_start !== opData.dates.plan_end && ` - ${formatDateShort(opData.dates.plan_end) || '?'}`}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <AppointmentModal
                open={Boolean(selected)}
                onClose={() => setSelected(null)}
                onSave={handleSave}
                selected={selected}
            />

            <PlanningModal
                open={planningOpen}
                onClose={() => setPlanningOpen(false)}
                osId={osId}
                onSaveSuccess={loadData}
            />
        </div>
    );
}
