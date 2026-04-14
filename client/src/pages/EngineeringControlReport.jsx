import React, { useState, useEffect } from 'react';
import { Package, Search, Calendar, User, FileText, ArrowLeft, Download, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import * as XLSX from 'xlsx';

const EngineeringControlReport = () => {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        pedido: '',
        projetista: ''
    });

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0
    });

    const fetchControls = async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                limit: pagination.limit,
                pedido: filters.pedido,
                projetista: filters.projetista
            });

            const res = await api.get(`/engineering-controls?${params.toString()}`);
            setData(res.data.data);
            setPagination(prev => ({
                ...prev,
                page: res.data.meta.page,
                total: res.data.meta.total
            }));
        } catch (error) {
            console.error('Erro ao carregar controles:', error);
            alert('Falha ao carregar os dados. Verifique a conexão com o banco.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchControls(1);
    }, []);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSearch = (e) => {
        if (e.key === 'Enter') {
            fetchControls(1);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('pt-BR');
    };

    const exportToExcel = () => {
        if (data.length === 0) return alert('Nenhum dado para exportar.');
        
        const exportData = data.map(item => ({
            'Pedido': item.pedido,
            'Item': item.item,
            'Produto': item.codigo_produto,
            'Descrição': item.descricao_produto,
            'Cliente': item.nome_cliente,
            
            // Engenharia
            'Tipo Projeto': item.project_type,
            'Projetista': item.designer_name,
            'Início Eng.': formatDate(item.engineering_start_date),
            'Prev. Início': formatDate(item.designer_start_forecast),
            'Prev. Fim': formatDate(item.designer_end_forecast),
            'Início Real': formatDate(item.designer_start_real),
            'Fim Real': formatDate(item.designer_end_real),
            'Tempo Gasto (h)': item.total_seconds ? (item.total_seconds / 3600).toFixed(2) : '0.00',
            'Liberação Produção': formatDate(item.designer_production_release_date),
            'Obs Engenharia': item.designer_notes,

            // PCP
            'Req. Material': formatDate(item.pcp_mat_req_date),
            'Req. Mat Usuario': item.pcp_mat_req_user,
            'Início Mecânica': formatDate(item.pcp_mech_start_date),
            'Ini. Mec. Usuario': item.pcp_mech_start_user,
            'Liberação Corte': formatDate(item.pcp_cut_rel_date),
            'Lib. Corte Usuario': item.pcp_cut_rel_user,
            'Obs PCP': item.pcp_notes
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Controle");
        XLSX.writeFile(wb, `Controle_Engenharia_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <FileText className="w-6 h-6 text-indigo-600" />
                            Relatório de Controle de Engenharia
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5 max-w-xl">
                            Acompanhamento de lançamentos e andamento dos projetos.
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg text-sm font-bold transition-colors"
                    >
                        <Download className="w-4 h-4" /> EXCEL
                    </button>
                    <button
                        onClick={() => fetchControls(1)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold transition-colors"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        ATUALIZAR
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white px-6 py-3 border-b border-gray-200 flex flex-wrap gap-4 items-end shrink-0 shadow-sm z-10">
                <div className="flex flex-col gap-1.5 min-w-[200px]">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Pedido</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            name="pedido"
                            value={filters.pedido}
                            onChange={handleFilterChange}
                            onKeyDown={handleSearch}
                            placeholder="Buscar Pedido..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>
                
                <div className="flex flex-col gap-1.5 min-w-[250px]">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Projetista</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            name="projetista"
                            value={filters.projetista}
                            onChange={handleFilterChange}
                            onKeyDown={handleSearch}
                            placeholder="Nome do Projetista..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>

                <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-bold text-gray-700">{pagination.total}</span> registros encontrados
                </div>
            </div>

            {/* Sub-Header for Groups */}
            <div className="bg-white shrink-0 shadow-sm z-10 border-b border-gray-200">
                 {/* Decorative Top Banner */}
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto bg-gray-50 relative">
                {loading && data.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-20">
                        <div className="flex flex-col items-center">
                            <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                            <p className="text-gray-500 font-medium">Buscando registros...</p>
                        </div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                                <Package className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-lg font-bold text-gray-700">Nenhum controle encontrado</p>
                            <p className="text-gray-500">Ajuste os filtros para realizar uma nova busca.</p>
                        </div>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm whitespace-nowrap min-w-max border-separate border-spacing-0">
                        <thead className="sticky top-0 z-10 font-bold uppercase text-[10px] tracking-wider text-gray-600 bg-white">
                            {/* Primeira Linha (Categorias) */}
                            <tr>
                                <th colSpan="5" className="px-4 py-2 border-b border-r border-gray-200 shrink-0 shadow-[0_1px_0_rgba(0,0,0,0.1)] text-center text-gray-700">
                                    INFORMAÇÕES GERAIS
                                </th>
                                <th colSpan="9" className="px-4 py-2 border-b border-r border-blue-200 bg-blue-50/80 shadow-[0_1px_0_rgba(0,0,0,0.1)] text-center text-blue-800">
                                    CONTROLE DE ENGENHARIA E PROJETOS
                                </th>
                                <th colSpan="3" className="px-4 py-2 border-b border-orange-200 bg-orange-50/80 shadow-[0_1px_0_rgba(0,0,0,0.1)] text-center text-orange-800">
                                    CONTROLE PCP
                                </th>
                            </tr>
                            {/* Segunda Linha (Colunas Reais) */}
                            <tr>
                                {/* Geral */}
                                <th className="px-4 py-3 border-b border-gray-200 bg-white">Pedido</th>
                                <th className="px-4 py-3 border-b border-gray-200 bg-white">Item</th>
                                <th className="px-4 py-3 border-b border-gray-200 bg-white">Produto</th>
                                <th className="px-4 py-3 border-b border-gray-200 bg-white">Descrição</th>
                                <th className="px-4 py-3 border-b border-r border-gray-200 bg-white min-w-[200px]">Cliente</th>
                                
                                {/* Engenharia */}
                                <th className="px-4 py-3 border-b border-blue-100 bg-blue-50/30 text-blue-900 border-l">Tipo Projeto</th>
                                <th className="px-4 py-3 border-b border-blue-100 bg-blue-50/30 text-blue-900 min-w-[150px]">Projetista</th>
                                <th className="px-4 py-3 border-b border-blue-100 bg-blue-50/30 text-blue-900">Início Eng.</th>
                                <th className="px-4 py-3 border-b border-blue-100 bg-blue-50/30 text-blue-900 border-l border-blue-50">Prev. Início</th>
                                <th className="px-4 py-3 border-b border-blue-100 bg-blue-50/30 text-blue-900">Prev. Fim</th>
                                <th className="px-4 py-3 border-b border-blue-100 bg-blue-50/30 text-blue-900 border-l border-blue-50">Início Real</th>
                                <th className="px-4 py-3 border-b border-blue-100 bg-blue-50/30 text-blue-900">Fim Real</th>
                                <th className="px-4 py-3 border-b border-blue-100 bg-blue-50/30 text-indigo-900 font-bold">Horas</th>
                                <th className="px-4 py-3 border-b border-r border-blue-200 bg-blue-100/50 text-blue-900 font-black">Liberação Prod.</th>
                                
                                {/* PCP */}
                                <th className="px-4 py-3 border-b border-orange-100 bg-orange-50/30 text-orange-900">Req. Material</th>
                                <th className="px-4 py-3 border-b border-orange-100 bg-orange-50/30 text-orange-900">Início Mecânica</th>
                                <th className="px-4 py-3 border-b border-orange-100 bg-orange-50/30 text-orange-900">Liberação Corte</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {data.map((item, index) => (
                                <tr key={`${item.pedido}-${item.item}-${index}`} className="hover:bg-gray-50/80 transition-colors">
                                    {/* Geral */}
                                    <td className="px-4 py-3 font-mono font-bold text-gray-700">{item.pedido}</td>
                                    <td className="px-4 py-3 font-mono text-gray-500">{item.item}</td>
                                    <td className="px-4 py-3">
                                        <span className="font-mono text-xs text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                                            {item.codigo_produto || '-'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 truncate max-w-[200px]" title={item.descricao_produto}>
                                        {item.descricao_produto || '-'}
                                    </td>
                                    <td className="px-4 py-3 border-r border-gray-100 truncate max-w-[200px]" title={item.nome_cliente}>
                                        {item.nome_cliente || '-'}
                                    </td>

                                    {/* Engenharia */}
                                    <td className="px-4 py-3 bg-blue-50/10 border-l border-blue-50">
                                        {item.project_type ? (
                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                                {item.project_type}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3 bg-blue-50/10 font-medium text-gray-800">
                                        {item.designer_name || '-'}
                                    </td>
                                    <td className="px-4 py-3 bg-blue-50/10 text-gray-600 font-mono text-xs">
                                        {formatDate(item.engineering_start_date)}
                                    </td>
                                    <td className="px-4 py-3 bg-blue-50/20 text-gray-600 font-mono text-xs border-l border-blue-50/50">
                                        {formatDate(item.designer_start_forecast)}
                                    </td>
                                    <td className="px-4 py-3 bg-blue-50/20 text-gray-600 font-mono text-xs">
                                        {formatDate(item.designer_end_forecast)}
                                    </td>
                                    <td className="px-4 py-3 bg-blue-50/30 text-gray-600 font-mono text-xs border-l border-blue-50/50">
                                        {formatDate(item.designer_start_real)}
                                    </td>
                                    <td className="px-4 py-3 bg-blue-50/30 text-gray-600 font-mono text-xs">
                                        {formatDate(item.designer_end_real)}
                                    </td>
                                    <td className="px-4 py-3 bg-indigo-50/30 text-indigo-700 font-mono text-xs font-bold border-l border-indigo-100">
                                        {item.total_seconds ? (
                                            `${(item.total_seconds / 3600).toFixed(2)}h`
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3 bg-blue-100/30 border-r border-blue-100">
                                        {item.designer_production_release_date ? (
                                             <span className="text-blue-700 font-bold font-mono text-xs bg-blue-100 px-2 py-1 rounded">
                                                {formatDate(item.designer_production_release_date)}
                                             </span>
                                        ) : <span className="text-gray-400">-</span>}
                                    </td>

                                    {/* PCP */}
                                    <td className="px-4 py-3 bg-orange-50/10 text-gray-600 font-mono text-xs">
                                        {formatDate(item.pcp_mat_req_date)}
                                    </td>
                                    <td className="px-4 py-3 bg-orange-50/10 text-gray-600 font-mono text-xs border-l border-orange-50/50">
                                        {formatDate(item.pcp_mech_start_date)}
                                    </td>
                                    <td className="px-4 py-3 bg-orange-50/10 text-gray-600 font-mono text-xs border-l border-orange-50/50">
                                        {formatDate(item.pcp_cut_rel_date)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer / Pagination */}
            <div className="bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center shrink-0 z-10">
                <span className="text-sm text-gray-500">
                    Mostrando página <span className="font-bold">{pagination.page}</span> (Total de {pagination.total} controles)
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => fetchControls(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                        Anterior
                    </button>
                    <button
                        onClick={() => fetchControls(pagination.page + 1)}
                        disabled={data.length < pagination.limit}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                        Próxima
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EngineeringControlReport;
