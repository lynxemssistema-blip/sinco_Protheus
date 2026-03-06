import React, { useState, useEffect } from 'react';
import { X, Calendar, User, FileText, Package } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function RecebimentoHistoricoModal({ isOpen, onClose, selectedItem }) {
    const [historico, setHistorico] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && selectedItem) {
            carregarHistorico();
        }
    }, [isOpen, selectedItem]);

    const carregarHistorico = async () => {
        try {
            setLoading(true);
            const { data } = await api.get(`/romaneios/items/${selectedItem.item_id}/historico`);
            setHistorico(data);
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
            toast.error('Não foi possível carregar o histórico deste item.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !selectedItem) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Histórico de Recebimentos</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Item {selectedItem.codigo_produto} - {selectedItem.descricao_produto}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        </div>
                    ) : historico.length === 0 ? (
                        <div className="text-center p-8 text-slate-500">
                            Nenhum recebimento registrado para este item ainda.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {historico.map((rec) => (
                                <div key={rec.id} className="bg-white border text-sm border-slate-200 rounded-lg p-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2 text-slate-700 font-medium">
                                            <Package className="w-4 h-4 text-indigo-500" />
                                            Recebido: {Number(rec.quantidade).toLocaleString('pt-BR')} un
                                        </div>
                                        <div className="flex items-center gap-1 text-slate-500 text-xs">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(rec.data_recebimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} às {new Date(rec.data_recebimento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-slate-400" />
                                            <span>
                                                <span className="font-medium">Responsável:</span> {rec.usuario || 'Sistema'}
                                            </span>
                                        </div>
                                        {rec.observacao && (
                                            <div className="flex items-start gap-2 md:col-span-2 bg-slate-50 p-3 text-slate-600 rounded">
                                                <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                                <span>
                                                    <span className="font-medium mr-1">Obs:</span>
                                                    {rec.observacao}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
