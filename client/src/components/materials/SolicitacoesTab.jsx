import React, { useState, useEffect } from 'react';
import { Plus, Filter, Package, User, Calendar, CheckCircle, Clock, Truck } from 'lucide-react';
import api from '../../services/api';

const SolicitacoesTab = () => {
    const [solicitacoes, setSolicitacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        fetchSolicitacoes();
    }, [statusFilter]);

    const fetchSolicitacoes = async () => {
        setLoading(true);
        try {
            const params = statusFilter ? { status: statusFilter } : {};
            const response = await api.get('/almoxarifado/solicitacoes', { params });
            setSolicitacoes(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleEntregar = async (id) => {
        if (!confirm('Confirmar entrega desta solicitação?')) return;
        try {
            await api.put(`/almoxarifado/solicitacoes/${id}/entregar`, { usuario: 'Mário PCP' }); // User hardcoded for now
            fetchSolicitacoes();
        } catch (err) {
            alert('Erro ao entregar solicitação');
        }
    };

    const getStatusInfo = (status) => {
        switch (status) {
            case 'PENDENTE': return { color: 'bg-yellow-100 text-yellow-700', icon: Clock };
            case 'SEPARADO': return { color: 'bg-blue-100 text-blue-700', icon: Package };
            case 'ENTREGUE': return { color: 'bg-green-100 text-green-700', icon: CheckCircle };
            default: return { color: 'bg-gray-100 text-gray-700', icon: Filter };
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                    {['', 'PENDENTE', 'SEPARADO', 'ENTREGUE'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === status
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {status || 'Todas'}
                        </button>
                    ))}
                </div>
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Solicitação Avulsa
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400">Carregando solicitações...</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Número</th>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Origem (OP/Operação)</th>
                                <th className="px-6 py-4">Solicitante</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {solicitacoes.map((sol) => {
                                const StatusIcon = getStatusInfo(sol.status).icon;
                                return (
                                    <tr key={sol.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-mono font-medium text-gray-700">{sol.numero}</td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {new Date(sol.data_solicitacao).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-800">OP {sol.op}</span>
                                                <span className="text-xs text-gray-500">
                                                    {sol.operacao} - {sol.operacao_descricao}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center text-gray-600">
                                                <User className="h-3 w-3 mr-1.5" />
                                                {sol.solicitante}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusInfo(sol.status).color}`}>
                                                <StatusIcon className="w-3 h-3 mr-1.5" />
                                                {sol.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {sol.status !== 'ENTREGUE' && (
                                                <button
                                                    onClick={() => handleEntregar(sol.id)}
                                                    className="text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 rounded px-2 py-1 bg-blue-50"
                                                >
                                                    Marcar Entregue
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {solicitacoes.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <Package className="h-10 w-10 mb-2 opacity-50" />
                            <p>Nenhuma solicitação encontrada.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SolicitacoesTab;
