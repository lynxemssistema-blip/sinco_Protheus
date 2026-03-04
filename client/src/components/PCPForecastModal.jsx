import React, { useState, useEffect } from 'react';
import { X, Calendar, Save, History, User, Hash, AlertCircle } from 'lucide-react';
import { savePCPForecast, getPCPForecastHistory } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const PCPForecastModal = ({ isOpen, onClose, item, onSaveSuccess }) => {
    const { user } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        data_entrega_pcp: '',
        quantidade_pcp: ''
    });

    useEffect(() => {
        if (isOpen && item) {
            loadHistory();
            // Initialize with current item values if any
            setFormData({
                data_entrega_pcp: item.pcp_delivery_forecast_date ? item.pcp_delivery_forecast_date.split('T')[0] : '',
                quantidade_pcp: item.pcp_delivery_forecast_qtd || ''
            });
        }
    }, [isOpen, item]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await getPCPForecastHistory(item.pedido || item.pedido_id, item.item);
            setHistory(data);
        } catch (error) {
            console.error('Erro ao carregar histórico PCP:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.data_entrega_pcp || !formData.quantidade_pcp) {
            alert('Por favor, preencha a data e a quantidade.');
            return;
        }

        setSaving(true);
        try {
            await savePCPForecast({
                pedido: item.pedido || item.pedido_id,
                item: item.item,
                data_entrega_pcp: formData.data_entrega_pcp,
                quantidade_pcp: parseFloat(formData.quantidade_pcp),
                usuario: user?.name || user?.login || 'Usuário'
            });

            if (onSaveSuccess) onSaveSuccess();
            onClose();
        } catch (error) {
            console.error('Erro ao salvar previsão PCP:', error);
            alert('Erro ao salvar. Verifique o console.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-6 w-6" />
                        <div>
                            <h2 className="text-xl font-bold">Planejamento PCP</h2>
                            <p className="text-indigo-100 text-xs">Pedido {item.pedido || item.pedido_id} - Item {item.item}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-indigo-500 rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Form Section */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                                <Save className="h-4 w-4 text-indigo-600" /> Nova Previsão
                            </h3>

                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1 leading-tight">Data Prevista p/ Entrega</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="date"
                                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            value={formData.data_entrega_pcp}
                                            onChange={(e) => setFormData(prev => ({ ...prev, data_entrega_pcp: e.target.value }))}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1 leading-tight">Quantidade Prevista</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            value={formData.quantidade_pcp}
                                            onChange={(e) => setFormData(prev => ({ ...prev, quantidade_pcp: e.target.value }))}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                    <p className="mt-1 text-[10px] text-gray-400">Quantidade original: {item.quantidade}</p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                                >
                                    {saving ? 'Salvando...' : 'Salvar Planejamento'}
                                </button>
                            </form>
                        </div>

                        {/* History Section */}
                        <div className="flex flex-col">
                            <h3 className="text-sm font-semibold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                                <History className="h-4 w-4 text-indigo-600" /> Histórico de Alterações
                            </h3>

                            <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 space-y-3 custom-scrollbar">
                                {loading ? (
                                    <div className="flex items-center justify-center h-full text-gray-400 italic text-sm">Carregando histórico...</div>
                                ) : history.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-300 p-4 text-center">
                                        <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                                        <span className="text-xs">Nenhum registro encontrado para este item.</span>
                                    </div>
                                ) : (
                                    history.map((log) => (
                                        <div key={log.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-indigo-200 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                                                    <Calendar className="h-3 w-3 text-indigo-500" />
                                                    {new Date(log.data_entrega_pcp).toLocaleDateString('pt-BR')}
                                                </div>
                                                <div className="text-[10px] font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                                                    Qtd: {parseFloat(log.quantidade_pcp).toLocaleString('pt-BR')}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-semibold">
                                                <div className="flex items-center gap-1">
                                                    <User className="h-2.5 w-2.5" />
                                                    {log.usuario}
                                                </div>
                                                <div>
                                                    {new Date(log.created_at).toLocaleString('pt-BR')}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 px-6 py-3 border-t flex justify-end">
                    <button onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PCPForecastModal;
