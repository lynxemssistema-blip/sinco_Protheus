import React from 'react';
import {
    Search, Filter, Calendar, AlertCircle, Package,
    AlignJustify, List, FileSpreadsheet, FileText,
    Loader2, StickyNote, HelpCircle
} from 'lucide-react';
import { useHelp } from '../../contexts/HelpContext';

/**
 * OrderFiltersBar — extracted filter form from OrdersTable.
 * Manages all filter inputs, view mode toggle, and action buttons.
 */
const OrderFiltersBar = ({
    filters,
    viewMode,
    loading = false,
    downloadingPDF,
    onFilterChange,
    onSearch,
    onViewModeChange,
    onDownloadExcel,
    onDownloadPDF,
    onOpenReport,
}) => {
    const { openHelp } = useHelp();
    return (
        <div className="border-b border-gray-100 bg-white print:hidden">
            {/* ── Top progress bar ── */}
            <div className={`h-0.5 w-full overflow-hidden transition-all duration-300 ${loading ? 'opacity-100' : 'opacity-0'}`}>
                <div className="h-full bg-blue-500 animate-[progress_1.4s_ease-in-out_infinite]" style={{ width: '100%', backgroundImage: 'linear-gradient(90deg, transparent 0%, #3b82f6 30%, #60a5fa 50%, #3b82f6 70%, transparent 100%)', backgroundSize: '200% 100%', animation: 'shimmerBar 1.4s linear infinite' }} />
            </div>
            <div className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Pedidos de Venda</h2>
                    <p className="text-sm text-gray-500">Gerencie e visualize os pedidos do Protheus</p>
                    {filters.only_active === 'true' && (
                        <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-2 py-1 inline-flex items-center gap-1.5">
                            <AlertCircle className="h-3 w-3" />
                            <span>Visualizando apenas pedidos <strong>Ativos</strong> (não entregues) e <strong>Vendas</strong> (exclui orçamentos).</span>
                        </div>
                    )}
                </div>

                {/* View Mode Toggle & Help */}
                <div className="flex items-center gap-2">
                    <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                        <button
                            onClick={() => onViewModeChange('tree')}
                            aria-label="Ver visão agrupada"
                            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'tree' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <AlignJustify className="w-4 h-4" />
                            Agrupado
                        </button>
                        <button
                            onClick={() => onViewModeChange('flat')}
                            aria-label="Ver visão de lista plana"
                            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'flat' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <List className="w-4 h-4" />
                            Lista Plana
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => openHelp('/visao-geral')}
                        title="Ajuda e Manual da Visão Geral e Planilha Mestra"
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-slate-200 bg-white"
                    >
                        <HelpCircle className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Status bar while loading ── */}
            {loading && (
                <div className="mb-3 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    <span>Buscando dados no servidor… Aguarde.</span>
                    <span className="ml-auto text-xs text-blue-400 italic">Isso pode levar alguns segundos dependendo dos filtros.</span>
                </div>
            )}
            <form onSubmit={onSearch} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-10 gap-y-4 gap-x-3 items-end">
                {/* Cliente */}
                <div className="flex flex-col gap-1 lg:col-span-2">
                    <label className="text-[11px] font-medium text-gray-600 ml-1">Cliente:</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            name="cliente"
                            placeholder="Buscar por Cliente..."
                            value={filters.cliente}
                            onChange={onFilterChange}
                            className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Pedido */}
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-gray-600 ml-1">Pedido:</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            name="pedido"
                            placeholder="Nº Pedido..."
                            value={filters.pedido}
                            onChange={onFilterChange}
                            className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* PC (Pedido Cliente) */}
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-gray-600 ml-1">PC (Ped. Cliente):</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            name="pedcli"
                            placeholder="PC Cliente..."
                            value={filters.pedcli || ''}
                            onChange={onFilterChange}
                            className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Ref. Cliente */}
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-gray-600 ml-1">Ref. Cliente:</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            name="refCliente"
                            placeholder="Ref. Cliente..."
                            value={filters.refCliente || ''}
                            onChange={onFilterChange}
                            className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Produto */}
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-gray-600 ml-1">Produto:</label>
                    <div className="relative">
                        <Package className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            name="produto"
                            placeholder="Cód. Produto..."
                            value={filters.produto}
                            onChange={onFilterChange}
                            className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Data Início */}
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-medium text-gray-600">Início:</label>
                        <select
                            name="dateType"
                            value={filters.dateType}
                            onChange={onFilterChange}
                            className="bg-transparent text-[11px] font-bold text-blue-600 outline-none cursor-pointer p-0"
                        >
                            <option value="pedido">Emissão Pedido</option>
                            <option value="entrega">Data de Entrega</option>
                            <option value="nf">Emissão NF</option>
                        </select>
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <input
                            type="date"
                            name="dataInicial"
                            value={filters.dataInicial}
                            onChange={onFilterChange}
                            aria-label={`Data inicial (${filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : 'Emissão NF'})`}
                            className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* Data Fim */}
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-medium text-gray-600">Fim:</label>
                        <span className="text-[11px] font-bold text-blue-600">
                            {filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : 'Emissão NF'}
                        </span>
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <input
                            type="date"
                            name="dataFinal"
                            value={filters.dataFinal}
                            onChange={onFilterChange}
                            aria-label={`Data final (${filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : 'Emissão NF'})`}
                            className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* Tipo de Item (Pills) */}
                <div className="flex flex-col gap-1 md:col-span-1 lg:col-span-1">
                    <label className="text-[11px] font-medium text-gray-600 ml-1">Tipo de Item:</label>
                    <div className="flex flex-wrap gap-1">
                        {['PCP', 'Restrição', 'Revisão', 'Novo'].map((tipo) => {
                            const activeTipos = filters.tipo_item ? filters.tipo_item.split(',') : [];
                            const isActive = activeTipos.includes(tipo);
                            return (
                                <button
                                    key={tipo}
                                    type="button"
                                    onClick={() => {
                                        let newTipos = [...activeTipos];
                                        if (isActive) newTipos = newTipos.filter((t) => t !== tipo);
                                        else newTipos.push(tipo);
                                        onFilterChange({ target: { name: 'tipo_item', value: newTipos.join(',') } });
                                    }}
                                    className={`px-3 py-1 flex items-center justify-center text-[11px] font-semibold rounded-full border transition-all ${
                                        isActive
                                            ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm'
                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {tipo}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="md:col-span-2 lg:col-span-2 flex gap-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className={`flex-1 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-all flex items-center justify-center gap-2 ${
                            loading
                                ? 'bg-blue-400 cursor-not-allowed text-white opacity-80'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                        {loading
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</>
                            : <><Search className="h-4 w-4" /> Filtrar</>
                        }
                    </button>

                    <button
                        type="button"
                        onClick={onDownloadExcel}
                        disabled={loading}
                        className="bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 font-medium rounded-lg text-sm px-3 py-2.5 text-center transition-colors flex items-center justify-center disabled:opacity-40"
                        title="Exportar Excel"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                    </button>

                    <button
                        type="button"
                        onClick={onDownloadPDF}
                        disabled={downloadingPDF || loading}
                        className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-medium rounded-lg text-sm px-3 py-2.5 text-center transition-colors flex items-center justify-center disabled:opacity-40"
                        title="Exportar PDF"
                    >
                        {downloadingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    </button>

                    <button
                        type="button"
                        onClick={onOpenReport}
                        disabled={loading}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-medium rounded-lg text-sm px-3 py-2.5 text-center transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                        title="Gerar Ata (Pedidos da Tela)"
                    >
                        <StickyNote className="h-4 w-4" />
                        <span>Ata</span>
                    </button>
                </div>

                {/* Footer Controls (Apenas Pendentes + Ordenação) */}
                <div className="md:col-span-4 lg:col-span-10 flex flex-col md:flex-row gap-4 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100 items-start md:items-center">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                    type="checkbox"
                                    checked={filters.only_active === 'true'}
                                    onChange={(e) =>
                                        onFilterChange({ target: { name: 'only_active', value: e.target.checked ? 'true' : 'false' } })
                                    }
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                                <span className="ml-3 text-sm font-medium text-gray-700">Apenas Pendentes (Filtro Pesado)</span>
                            </label>
                            <span className="text-[10px] text-gray-400 italic flex items-center gap-1 hidden md:flex shrink-0">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                Desative para uma busca muito mais rápida.
                            </span>
                        </div>
                        <div className="text-[10px] text-gray-400 italic">
                            Datas do filtro = <span className="font-semibold text-gray-500">Entrada/Emissão do pedido</span> (Protheus).
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600">Ordenar por:</label>
                        <div className="flex gap-2">
                            <select 
                                name="sortBy" 
                                value={filters.sortBy || 'emissao'} 
                                onChange={onFilterChange}
                                className="w-40 rounded border border-gray-200 bg-white p-1 text-[11px] outline-none"
                            >
                                <option value="pedido">Pedido/Item</option>
                                <option value="emissao">Data do Pedido</option>
                                <option value="entrega">Data de Entrega (Pedido)</option>
                                <option value="entrega_pcp">Data de Entrega PCP</option>
                                <option value="prev_fat">Prev. Fat. (Faturamento)</option>
                            </select>
                            <select 
                                name="sortOrder" 
                                value={filters.sortOrder || 'DESC'} 
                                onChange={onFilterChange}
                                className="w-24 rounded border border-gray-200 bg-white p-1 text-[11px] outline-none"
                            >
                                <option value="DESC">Recentes</option>
                                <option value="ASC">Antigos</option>
                            </select>
                        </div>
                    </div>
                </div>
            </form>
            </div>
        </div>
    );
};

export default React.memo(OrderFiltersBar);
