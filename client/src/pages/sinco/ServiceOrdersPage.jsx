import React, { useState, useEffect } from 'react';
import {
    Search, Filter, Calendar, ClipboardList, ChevronDown, ChevronRight,
    RefreshCw, AlertCircle, CheckCircle, Clock, File, FileText
} from 'lucide-react';
import api from '../../services/api';
import ServiceOrderItems from '../../components/sinco/ServiceOrderItems';

const resolvePdfPath = (filePath) => {
    if (!filePath) return null;
    const replaced = filePath.replace(/\.[^./\\]+$/, '.pdf');
    return replaced === filePath ? `${filePath}.pdf` : replaced;
};

const openDoc = (filePath) => {
    if (!filePath) return;
    window.open(`/api/docs/view?path=${encodeURIComponent(filePath)}`, '_blank', 'noopener,noreferrer');
};

const ServiceOrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState({});

    // Filters
    const [filters, setFilters] = useState({
        cliente: '',
        id: '',
        data_inicio: '',
        data_fim: '',
        status: 'todos'
    });

    const fetchOrders = async () => {
        try {
            setLoading(true);

            // Build query params
            const params = new URLSearchParams();
            if (filters.cliente) params.append('cliente', filters.cliente);
            if (filters.id) params.append('id', filters.id);
            if (filters.data_inicio) params.append('data_inicio', filters.data_inicio);
            if (filters.data_fim) params.append('data_fim', filters.data_fim);
            if (filters.status && filters.status !== 'todos') params.append('status', filters.status);

            // Dynamically determine the base URL
            const response = await api.get(`/sinco/os?${params.toString()}`);

            setOrders(response.data);
        } catch (error) {
            console.error('Erro ao buscar OS:', error);
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchOrders();
    }, []);

    // Handle filter change
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    // Handle search submit
    const handleSearch = (e) => {
        e.preventDefault();
        fetchOrders();
    };

    const toggleRow = (id) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Status Badge Component
    const StatusBadge = ({ os }) => {
        // Logic based on 'Finalizado' fields
        const isFinalized = os.FinalizadoOs === 'S';

        if (isFinalized) {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Finalizado
                </span>
            );
        }

        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <Clock className="w-3 h-3 mr-1" />
                Em Aberto
            </span>
        );
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ClipboardList className="h-8 w-8 text-blue-600" />
                        Ordens de Serviço (Sinco)
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gerenciamento e consulta de Ordens de Serviço
                    </p>
                </div>
                <button
                    onClick={fetchOrders}
                    className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Nº OS</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="id"
                                value={filters.id}
                                onChange={handleFilterChange}
                                placeholder="ID..."
                                className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Cliente</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                name="cliente"
                                value={filters.cliente}
                                onChange={handleFilterChange}
                                placeholder="Buscar por cliente..."
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                        <select
                            name="status"
                            value={filters.status}
                            onChange={handleFilterChange}
                            className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                            <option value="todos">Todos</option>
                            <option value="aberto">Em Aberto</option>
                            <option value="finalizado">Finalizado</option>
                        </select>
                    </div>

                    <div className="md:col-span-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Data Início (Venda)</label>
                        <input
                            type="date"
                            name="data_inicio"
                            value={filters.data_inicio}
                            onChange={handleFilterChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div className="md:col-span-1">
                        <button
                            type="submit"
                            className="w-full flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <Filter className="h-4 w-4 mr-2" />
                            Filtrar
                        </button>
                    </div>
                </form>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OS #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Venda</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Entrega</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10">PDF</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-sm text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                                            Carregando dados...
                                        </div>
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-sm text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
                                            Nenhuma Ordem de Serviço encontrada.
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                orders.map((os) => (
                                    <React.Fragment key={os.IdOrdemServico}>
                                        <tr
                                            className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedRows[os.IdOrdemServico] ? 'bg-blue-50/50' : ''}`}
                                            onClick={() => toggleRow(os.IdOrdemServico)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {expandedRows[os.IdOrdemServico] ?
                                                    <ChevronDown className="h-4 w-4 text-blue-600" /> :
                                                    <ChevronRight className="h-4 w-4" />
                                                }
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                                {os.IdOrdemServico}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                {os.Cliente}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={os.Descricao}>
                                                {os.Descricao || '-'}
                                                <div className="text-xs text-gray-400">
                                                    Projeto: {os.Projeto} | Tag: {os.Tag}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {os.DataCriacao ? new Date(os.DataCriacao).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {os.DataFinalizacao ? new Date(os.DataFinalizacao).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {resolvePdfPath(os.EnderecoOrdemServico) ? (
                                                    <button onClick={(e) => { e.stopPropagation(); openDoc(resolvePdfPath(os.EnderecoOrdemServico)); }} className="p-1 rounded hover:bg-red-50 transition-colors mx-auto block">
                                                        <FileText className="h-4 w-4 text-red-500" />
                                                    </button>
                                                ) : (
                                                    <FileText className="h-4 w-4 text-gray-200 mx-auto" title="Sem PDF" />
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <StatusBadge os={os} />
                                            </td>
                                        </tr>
                                        {expandedRows[os.IdOrdemServico] && (
                                            <tr className="bg-gray-50/50 animate-fadeIn">
                                                <td colSpan="7" className="px-4 py-4 md:px-6">
                                                    <ServiceOrderItems osId={os.IdOrdemServico} />
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ServiceOrdersPage;
