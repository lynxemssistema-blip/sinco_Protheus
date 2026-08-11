import React, { useState, useEffect } from 'react';
import { Package, Search, Calendar, User, FileText, ArrowLeft, Download, RefreshCcw, Layers } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getFileUrl } from '../services/api';
import * as XLSX from 'xlsx';

const EngineeringControlReport = () => {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        pedido: '',
        projetista: '',
        cliente: '',
        project_type: '',
        dateType: 'engineering_start_date',
        startDate: '',
        endDate: '',
        release_status: 'unreleased'
    });

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 100,
        total: 0
    });

    const [appliedFilters, setAppliedFilters] = useState(filters);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchControls = async (page = 1, currentFilters = appliedFilters, append = false) => {
        if (page === 1 && !append) {
            setLoading(true);
            setLoadingMore(false);
            setData([]);
        } else {
            setLoadingMore(true);
        }
        
        try {
            const params = new URLSearchParams({
                page,
                limit: 100, // Load in batches of 100
                pedido: currentFilters.pedido || '',
                projetista: currentFilters.projetista || '',
                cliente: currentFilters.cliente || '',
                project_type: currentFilters.project_type || '',
                dateType: currentFilters.dateType || 'engineering_start_date',
                startDate: currentFilters.startDate || '',
                endDate: currentFilters.endDate || '',
                release_status: currentFilters.release_status || 'unreleased'
            });

            const res = await api.get(`/engineering-controls?${params.toString()}`);
            const newItems = res.data.data;
            const meta = res.data.meta;

            setData(prev => append ? [...prev, ...newItems] : newItems);
            
            setPagination({
                page: meta.page,
                limit: meta.limit,
                total: meta.total
            });

            const totalLoadedSoFar = (page - 1) * 100 + newItems.length;
            if (totalLoadedSoFar < meta.total && newItems.length > 0) {
                // Load next page
                fetchControls(page + 1, currentFilters, true);
            } else {
                setLoading(false);
                setLoadingMore(false);
            }
        } catch (error) {
            console.error('Erro ao carregar controles:', error);
            alert('Falha ao carregar os dados. Verifique a conexão com o banco.');
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchControls(1, filters);
    }, []);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApplyFilters = () => {
        setAppliedFilters(filters);
        fetchControls(1, filters);
    };

    const handleClearFilters = () => {
        const cleared = {
            pedido: '',
            projetista: '',
            cliente: '',
            project_type: '',
            dateType: 'engineering_start_date',
            startDate: '',
            endDate: '',
            release_status: 'unreleased'
        };
        setFilters(cleared);
        setAppliedFilters(cleared);
        fetchControls(1, cleared);
    };

    const handleSearch = (e) => {
        if (e.key === 'Enter') {
            handleApplyFilters();
        }
    };

    const [sortConfig, setSortConfig] = useState(null);

    const sortedData = React.useMemo(() => {
        let sortableItems = [...data];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];
                
                if (aVal === null || aVal === undefined) aVal = '';
                if (bVal === null || bVal === undefined) bVal = '';

                if (sortConfig.key === 'total_seconds') {
                    const numA = Number(aVal) || 0;
                    const numB = Number(bVal) || 0;
                    return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
                }
                
                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }

                if (aVal < bVal) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aVal > bVal) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [data, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig && sortConfig.key === key) {
            if (sortConfig.direction === 'asc') {
                direction = 'desc';
            } else {
                setSortConfig(null);
                return;
            }
        }
        setSortConfig({ key, direction });
    };

    const renderSortableHeader = (label, key, extraClasses = '') => {
        const isSorted = sortConfig && sortConfig.key === key;
        const direction = isSorted ? sortConfig.direction : null;
        
        return (
            <th 
                className={`px-4 py-3 border-b cursor-pointer hover:brightness-95 select-none transition-all ${extraClasses}`}
                onClick={() => requestSort(key)}
            >
                <div className="flex items-center justify-between gap-1">
                    <span>{label}</span>
                    <span className="text-[10px] opacity-60">
                        {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '⇅'}
                    </span>
                </div>
            </th>
        );
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
            'Ref. Cliente': item.ref_cliente,
            
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
                        onClick={handleApplyFilters}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold transition-colors"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        ATUALIZAR
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white px-6 py-3 border-b border-gray-200 flex flex-wrap gap-4 items-end shrink-0 shadow-sm z-10">
                <div className="flex flex-col gap-1.5 min-w-[150px]">
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
                
                <div className="flex flex-col gap-1.5 min-w-[180px]">
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
                            placeholder="Projetista..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 min-w-[180px]">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Cliente</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            name="cliente"
                            value={filters.cliente}
                            onChange={handleFilterChange}
                            onKeyDown={handleSearch}
                            placeholder="Buscar Cliente..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 min-w-[120px]">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Tipo Projeto</label>
                    <select
                        name="project_type"
                        value={filters.project_type}
                        onChange={handleFilterChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-gray-700"
                    >
                        <option value="">Todos</option>
                        <option value="PCP">PCP</option>
                        <option value="Novo">Novo</option>
                        <option value="Revisão">Revisão</option>
                        <option value="Restrição">Restrição</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1.5 min-w-[140px]">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Liberação</label>
                    <select
                        name="release_status"
                        value={filters.release_status}
                        onChange={handleFilterChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-gray-700"
                    >
                        <option value="unreleased">Não Liberados</option>
                        <option value="released">Liberados</option>
                        <option value="all">Todos</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1.5 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Filtrar Data Por</label>
                    <select
                        name="dateType"
                        value={filters.dateType}
                        onChange={handleFilterChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-gray-700"
                    >
                        <option value="engineering_start_date">Início Engenharia</option>
                        <option value="designer_production_release_date">Liberação Produção</option>
                        <option value="designer_start_forecast">Previsão Início</option>
                        <option value="designer_end_forecast">Previsão Fim</option>
                        <option value="designer_start_real">Início Real</option>
                        <option value="designer_end_real">Fim Real</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">De</label>
                    <input
                        type="date"
                        name="startDate"
                        value={filters.startDate}
                        onChange={handleFilterChange}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Até</label>
                    <input
                        type="date"
                        name="endDate"
                        value={filters.endDate}
                        onChange={handleFilterChange}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <button
                        type="button"
                        onClick={handleApplyFilters}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Filtrar"
                    >
                        Filtrar
                    </button>
                </div>

                <div className="flex flex-col gap-1.5">
                    <button
                        type="button"
                        onClick={handleClearFilters}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Limpar todos os filtros"
                    >
                        Limpar
                    </button>
                </div>

                <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-bold text-gray-700">{pagination.total}</span> registros
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
                                <th colSpan="6" className="px-4 py-2 border-b border-r border-gray-200 shrink-0 shadow-[0_1px_0_rgba(0,0,0,0.1)] text-center text-gray-700">
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
                                {renderSortableHeader('Pedido', 'pedido', 'border-gray-200 bg-white')}
                                {renderSortableHeader('Item', 'item', 'border-gray-200 bg-white')}
                                {renderSortableHeader('Produto', 'codigo_produto', 'border-gray-200 bg-white')}
                                {renderSortableHeader('Descrição', 'descricao_produto', 'border-gray-200 bg-white')}
                                {renderSortableHeader('Cliente', 'nome_cliente', 'border-gray-200 bg-white min-w-[200px]')}
                                {renderSortableHeader('Ref. Cliente', 'ref_cliente', 'border-r border-gray-200 bg-white min-w-[120px]')}
                                
                                {/* Engenharia */}
                                {renderSortableHeader('Tipo Projeto', 'project_type', 'border-blue-100 bg-blue-50/30 text-blue-900 border-l')}
                                {renderSortableHeader('Projetista', 'designer_name', 'border-blue-100 bg-blue-50/30 text-blue-900 min-w-[150px]')}
                                {renderSortableHeader('Início Eng.', 'engineering_start_date', 'border-blue-100 bg-blue-50/30 text-blue-900')}
                                {renderSortableHeader('Prev. Início', 'designer_start_forecast', 'border-blue-100 bg-blue-50/30 text-blue-900 border-l border-blue-50')}
                                {renderSortableHeader('Prev. Fim', 'designer_end_forecast', 'border-blue-100 bg-blue-50/30 text-blue-900')}
                                {renderSortableHeader('Início Real', 'designer_start_real', 'border-blue-100 bg-blue-50/30 text-blue-900 border-l border-blue-50')}
                                {renderSortableHeader('Fim Real', 'designer_end_real', 'border-blue-100 bg-blue-50/30 text-blue-900')}
                                {renderSortableHeader('Horas', 'total_seconds', 'border-blue-100 bg-blue-50/30 text-indigo-900 font-bold')}
                                {renderSortableHeader('Liberação Prod.', 'designer_production_release_date', 'border-r border-blue-200 bg-blue-100/50 text-blue-900 font-black')}
                                
                                {/* PCP */}
                                {renderSortableHeader('Req. Material', 'pcp_mat_req_date', 'border-orange-100 bg-orange-50/30 text-orange-900')}
                                {renderSortableHeader('Início Mecânica', 'pcp_mech_start_date', 'border-orange-100 bg-orange-50/30 text-orange-900')}
                                {renderSortableHeader('Liberação Corte', 'pcp_cut_rel_date', 'border-orange-100 bg-orange-50/30 text-orange-900')}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {sortedData.map((item, index) => (
                                <tr key={`${item.pedido}-${item.item}-${index}`} className="hover:bg-gray-50/80 transition-colors">
                                    {/* Geral */}
                                    <td className="px-4 py-3 font-mono font-bold text-gray-700">{item.pedido}</td>
                                    <td className="px-4 py-3 font-mono text-gray-500">{item.item}</td>
                                     <td className="px-4 py-3">
                                         <div className="flex items-center gap-2">
                                             {item.codigo_produto ? (
                                                 <Link 
                                                     to={`/estrutura/${encodeURIComponent(item.codigo_produto)}?pedido=${encodeURIComponent(item.pedido || '')}&item=${encodeURIComponent(item.item || '')}`}
                                                     className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-bold bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                                                     title="Ver Estrutura do Produto"
                                                 >
                                                     {item.codigo_produto}
                                                     <Layers className="w-3 h-3 text-indigo-400" />
                                                 </Link>
                                             ) : '-'}

                                             {item.has_docs && (
                                                 <button
                                                     onClick={() => {
                                                         if (item.has_drawing && item.drawing_url) {
                                                             window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.drawing_url)}`), '_blank');
                                                         } else if (item.docs_count === 1 && item.first_doc) {
                                                             window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.first_doc)}`), '_blank');
                                                         }
                                                     }}
                                                     className={`p-1 rounded transition-all cursor-pointer ${
                                                         item.has_drawing 
                                                             ? 'text-red-600 hover:bg-red-50 hover:scale-105' 
                                                             : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                                                     }`}
                                                     title={
                                                         item.has_drawing 
                                                             ? 'Abrir Desenho Técnico (PDF)' 
                                                             : 'Abrir Documento'
                                                     }
                                                 >
                                                     <FileText className="w-3.5 h-3.5" />
                                                 </button>
                                             )}
                                         </div>
                                     </td>
                                    <td className="px-4 py-3 truncate max-w-[200px]" title={item.descricao_produto}>
                                        {item.descricao_produto || '-'}
                                    </td>
                                    <td className="px-4 py-3 truncate max-w-[200px]" title={item.nome_cliente}>
                                        {item.nome_cliente || '-'}
                                    </td>
                                    <td className="px-4 py-3 border-r border-gray-100 font-mono text-xs text-gray-600 truncate max-w-[150px]" title={item.ref_cliente}>
                                        {item.ref_cliente || '-'}
                                    </td>

                                    {/* Engenharia */}
                                     <td className="px-4 py-3 bg-blue-50/10 border-l border-blue-50 text-center">
                                         {(() => {
                                             const tipoConfig = {
                                                 Novo: { label: 'NOVO', bg: 'bg-blue-100 text-blue-700 border-blue-200' },
                                                 'Revisão': { label: 'REVISÃO', bg: 'bg-orange-100 text-orange-700 border-orange-200' },
                                                 'Restrição': { label: 'RESTRIÇÃO', bg: 'bg-red-100 text-red-700 border-red-200' },
                                                 PCP: { label: 'PCP', bg: 'bg-gray-100 text-gray-700 border-gray-200' }
                                             };
                                             const tipoCfg = tipoConfig[item.project_type] || { label: '-', bg: 'text-gray-400' };
                                             if (tipoCfg.label === '-') return '-';
                                             return (
                                                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${tipoCfg.bg}`}>
                                                     {tipoCfg.label}
                                                 </span>
                                             );
                                         })()}
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

            {/* Footer / Status */}
            <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-between items-center shrink-0 z-10">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                    {loadingMore ? (
                        <>
                            <RefreshCcw className="w-4 h-4 text-indigo-600 animate-spin" />
                            <span>Carregando dados... {data.length} de {pagination.total}</span>
                        </>
                    ) : (
                        <span>Exibindo todos os <span className="font-bold text-gray-700">{data.length}</span> registros</span>
                    )}
                </span>
            </div>
        </div>
    );
};

export default EngineeringControlReport;
