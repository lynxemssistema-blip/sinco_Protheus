import React, { useState, useEffect } from 'react';
import { X, Calendar, Save, History, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';

const QuickDateEditModal = ({ isOpen, onClose, pedido, item, fieldKey, fieldLabel, currentValue, onSave, batchItems }) => {
    const [date, setDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setDate(currentValue ? currentValue.split('T')[0] : '');
        setShowHistory(false);
        setHistory([]);
    }, [isOpen, currentValue, fieldKey]);

    const loadHistory = async () => {
        if (historyLoading) return;
        setHistoryLoading(true);
        try {
            const res = await api.get(`/pedidos/${pedido}/items/${item}/notes/history`);
            const rows = Array.isArray(res.data) ? res.data : [];
            const filtered = rows.filter(h => h.field_changed === fieldKey);
            setHistory(filtered);
        } catch {
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleToggleHistory = () => {
        const next = !showHistory;
        setShowHistory(next);
        if (next && history.length === 0) loadHistory();
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (batchItems && batchItems.length > 0) {
                const res = await api.post('/pedidos/batch/items/notes', {
                    items: batchItems,
                    formData: { [fieldKey]: date }
                });
                const { errors: batchErrors } = res.data;
                if (batchErrors && batchErrors.length > 0) {
                    console.error('Batch errors:', batchErrors);
                    alert(`Salvo com ${batchErrors.length} erro(s). Verifique o console.`);
                }
                if (onSave) onSave({ [fieldKey]: date }, true);
            } else {
                await api.post(`/pedidos/${pedido}/items/${item}/notes`, {
                    [fieldKey]: date
                });
                if (onSave) onSave({ [fieldKey]: date }, false);
            }
            onClose();
        } catch (err) {
            alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const fmtDate = (d) => {
        if (!d) return '-';
        const parsed = new Date(d);
        return isNaN(parsed) ? d : parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    };

    const fmtTimestamp = (d) => {
        if (!d) return '-';
        const parsed = new Date(d);
        return isNaN(parsed) ? d : parsed.toLocaleString('pt-BR');
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Header */}
                <div className="bg-blue-50 px-5 py-4 border-b border-blue-100 flex justify-between items-start">
                    <div>
                        <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Editar: {fieldLabel} {batchItems && batchItems.length > 0 && '(Em Lote)'}
                        </h3>
                        <p className="text-xs text-blue-600 mt-0.5">
                            {batchItems && batchItems.length > 0 
                                ? `Aplicando a ${batchItems.length} itens selecionados`
                                : <>Pedido: <span className="font-mono font-bold">{pedido}</span> · Item: <span className="font-mono font-bold">{item}</span></>
                            }
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-blue-200 rounded-full transition-colors">
                        <X className="w-4 h-4 text-blue-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-600">Selecione a Data</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="pl-9 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                            />
                        </div>
                    </div>

                    {/* History toggle */}
                    <div className="border border-gray-100 rounded-lg overflow-hidden">
                        <button
                            type="button"
                            onClick={handleToggleHistory}
                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                            <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5" /> Histórico de alterações
                            </span>
                            {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>
                        {showHistory && (
                            <div className="p-3 max-h-40 overflow-y-auto space-y-2">
                                {historyLoading ? (
                                    <p className="text-xs text-gray-400 text-center py-2">Carregando...</p>
                                ) : history.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic text-center py-2">Nenhum histórico disponível.</p>
                                ) : (
                                    history.map((h, i) => (
                                        <div key={h.id || i} className="text-xs border-l-2 border-blue-200 pl-2 py-1">
                                            <div className="flex items-center gap-1 text-gray-500">
                                                <span className="font-semibold text-gray-800">{h.user_name || 'Sistema'}</span>
                                                <span>·</span>
                                                <span>{fmtTimestamp(h.action_timestamp)}</span>
                                            </div>
                                            <div className="text-gray-600 mt-0.5">
                                                {h.old_value ? (
                                                    <>
                                                        <span className="line-through text-red-400">{fmtDate(h.old_value)}</span>
                                                        {' → '}
                                                    </>
                                                ) : null}
                                                <span className="font-semibold text-emerald-600">{fmtDate(h.new_value)}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-70"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Salvando...' : (batchItems && batchItems.length > 0 ? `Aplicar em ${batchItems.length} itens` : 'Salvar')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickDateEditModal;
