import React, { useState, useEffect } from 'react';
import { X, History, User, Clock, AlertCircle } from 'lucide-react';
import { getProductStatusHistory } from '../services/api';

const ProductStatusHistoryModal = ({ isOpen, onClose, codigo }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && codigo) {
            fetchHistory();
        }
    }, [isOpen, codigo]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await getProductStatusHistory(codigo);
            setHistory(data);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl border w-full max-w-4xl overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <History className="h-5 w-5 text-blue-600" />
                        Histórico de Status - {codigo}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            {error}
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                            Nenhum histórico encontrado para este produto.
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">De</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Para</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {history.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    <Clock className="h-4 w-4 text-gray-400" />
                                                    {new Date(item.data_hora).toLocaleString('pt-BR')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    <User className="h-4 w-4 text-gray-400" />
                                                    {item.usuario}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                {item.acao === 'LIBERACAO_ENGENHARIA' ? (
                                                    <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-md">Liberação de Engenharia</span>
                                                ) : item.acao === 'MARCACAO_MANUAL' ? (
                                                    <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded-md">Marcação Manual</span>
                                                ) : (
                                                    <span className="text-gray-600 bg-gray-100 px-2 py-1 rounded-md">{item.acao}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-full 
                                                    ${item.estado_anterior === 'NOVO' ? 'bg-green-100 text-green-800' : 
                                                      item.estado_anterior === 'REVISAO' ? 'bg-yellow-100 text-yellow-800' : 
                                                      item.estado_anterior === 'RESTRICAO' ? 'bg-red-100 text-red-800' : 
                                                      'bg-gray-100 text-gray-800'}`}>
                                                    {item.estado_anterior}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-full shadow-sm
                                                    ${item.estado_novo === 'NOVO' ? 'bg-green-500 text-white' : 
                                                      item.estado_novo === 'REVISAO' ? 'bg-yellow-400 text-yellow-900' : 
                                                      item.estado_novo === 'RESTRICAO' ? 'bg-red-500 text-white' : 
                                                      'bg-gray-200 text-gray-800'}`}>
                                                    {item.estado_novo}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductStatusHistoryModal;
