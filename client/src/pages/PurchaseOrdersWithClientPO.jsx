import React, { useState } from 'react';
import useStickyState from '../hooks/useStickyState';
import { Search, Loader2, Package, FileText, Calendar, Filter, X, ShoppingCart, TrendingUp } from 'lucide-react';
import { getPurchaseOrdersWithClientPO } from '../services/api';

export default function PurchaseOrdersWithClientPO() {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [warning, setWarning] = useState(null);
    const [filters, setFilters] = useStickyState({
        pv_numero: '',
        pedido_cliente: '',
        produto: '',
        descricao: '',
        sc_numero: '',
        pc_numero: '',
        fornecedor: '',
        data_pv_de: '',
        data_pv_ate: ''
    }, '@metalfisa:purchase_with_client_po_filters');

    const handleSearch = async (e) => {
        e?.preventDefault();
        setLoading(true);
        setHasSearched(true);
        setResults([]);
        setWarning(null);

        try {
            const params = {};
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params[key] = value;
            });
            const response = await getPurchaseOrdersWithClientPO(params);

            // Verificar se resposta tem formato novo (com wrapper) ou antigo (array direto)
            if (response.data && Array.isArray(response.data)) {
                setResults(response.data);
                setWarning(response.warning);
            } else if (Array.isArray(response)) {
                setResults(response);
            }
        } catch (err) {
            console.error('Erro ao buscar pedidos:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const clearFilters = () => {
        setFilters({
            pv_numero: '',
            pedido_cliente: '',
            produto: '',
            descricao: '',
            sc_numero: '',
            pc_numero: '',
            fornecedor: '',
            data_pv_de: '',
            data_pv_ate: ''
        });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR');
    };

    const getStatusBadge = (status) => {
        const styles = {
            'COM_PC': 'bg-blue-50 text-blue-700 border-blue-200',
            'COM_SC': 'bg-yellow-50 text-yellow-700 border-yellow-200',
            'SOMENTE_PV': 'bg-gray-100 text-gray-600 border-gray-200'
        };
        const labels = {
            'COM_PC': 'Com Pedido Compra',
            'COM_SC': 'Com Solicitação',
            'SOMENTE_PV': 'Somente PV'
        };
        return (
            <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[status] || styles.SOMENTE_PV}`}>
                {labels[status] || status}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-blue-600" />
                        PC com Nº Pedido Cliente
                    </h1>
                    <p className="text-slate-500">
                        Rastreamento: PV → SC (via observação) → PC
                    </p>
                </div>
            </div>

            {/* Info Alert */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <div className="flex items-center gap-2 font-semibold mb-1">
                    <Filter className="h-4 w-4" />
                    <span>Dica de Performance</span>
                </div>
                <p className="text-blue-700/90 text-xs">
                    Para resultados <strong>mais rápidos</strong>, use filtros específicos como <strong>Nº PV, Produto ou Pedido Cliente</strong>.
                    Evite períodos muito longos (mais de 3 meses) usando apenas filtro de data.
                </p>
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <form onSubmit={handleSearch} className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {/* Nº PV */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nº PV</label>
                            <input
                                type="text"
                                value={filters.pv_numero}
                                onChange={(e) => handleFilterChange('pv_numero', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="003716"
                            />
                        </div>

                        {/* Pedido Cliente */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nº Ped. Cliente</label>
                            <input
                                type="text"
                                value={filters.pedido_cliente}
                                onChange={(e) => handleFilterChange('pedido_cliente', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="PED-2024-001"
                            />
                        </div>

                        {/* Código Produto */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Cód. Produto</label>
                            <input
                                type="text"
                                value={filters.produto}
                                onChange={(e) => handleFilterChange('produto', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="MTA-001"
                            />
                        </div>

                        {/* Descrição */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
                            <input
                                type="text"
                                value={filters.descricao}
                                onChange={(e) => handleFilterChange('descricao', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="Parafuso..."
                            />
                        </div>

                        {/* Nº SC */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nº SC</label>
                            <input
                                type="text"
                                value={filters.sc_numero}
                                onChange={(e) => handleFilterChange('sc_numero', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="073610"
                            />
                        </div>

                        {/* Nº PC */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nº PC</label>
                            <input
                                type="text"
                                value={filters.pc_numero}
                                onChange={(e) => handleFilterChange('pc_numero', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="000456"
                            />
                        </div>

                        {/* Fornecedor */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Cód. Fornecedor</label>
                            <input
                                type="text"
                                value={filters.fornecedor}
                                onChange={(e) => handleFilterChange('fornecedor', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="FOR001"
                            />
                        </div>

                        {/* Data PV De */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data PV De</label>
                            <input
                                type="date"
                                value={filters.data_pv_de}
                                onChange={(e) => handleFilterChange('data_pv_de', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>

                        {/* Data PV Até */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data PV Até</label>
                            <input
                                type="date"
                                value={filters.data_pv_ate}
                                onChange={(e) => handleFilterChange('data_pv_ate', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                        >
                            <X className="h-4 w-4" /> Limpar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            Buscar
                        </button>
                    </div>
                </form>
            </div>

            {/* Warning Banner */}
            {warning && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-yellow-800">Muitos Resultados</h3>
                        <p className="text-sm text-yellow-700 mt-1">{warning}</p>
                    </div>
                </div>
            )}

            {/* Results Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                                <th className="px-3 py-3">Nº PV</th>
                                <th className="px-3 py-3">Item</th>
                                <th className="px-3 py-3">Data PV</th>
                                <th className="px-3 py-3">Ped. Cliente</th>
                                <th className="px-3 py-3">Produto</th>
                                <th className="px-3 py-3 text-right">Qtd</th>
                                <th className="px-3 py-3">Nº SC</th>
                                <th className="px-3 py-3">Nº PC</th>
                                <th className="px-3 py-3">Fornecedor</th>
                                <th className="px-3 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="px-4 py-12 text-center text-slate-500">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                                        Carregando pedidos...
                                    </td>
                                </tr>
                            ) : results.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="px-4 py-12 text-center text-slate-500">
                                        {hasSearched
                                            ? 'Nenhum pedido encontrado.'
                                            : 'Use os filtros acima e clique em Buscar.'}
                                    </td>
                                </tr>
                            ) : (
                                results.map((row, index) => (
                                    <tr
                                        key={index}
                                        className={`hover:bg-slate-50 transition-colors ${row.status_rastreamento === 'COM_PC' ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <td className="px-3 py-2 font-medium text-blue-700">{row.pv_numero}</td>
                                        <td className="px-3 py-2 text-slate-500">{row.pv_item}</td>
                                        <td className="px-3 py-2 text-slate-600">{formatDate(row.pv_data_emissao)}</td>
                                        <td className="px-3 py-2">
                                            {row.pedido_cliente_numero ? (
                                                <span className="font-mono text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                                                    {row.pedido_cliente_numero}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs text-slate-700">{row.produto_codigo}</span>
                                                <span className="text-xs text-slate-500 truncate max-w-[200px]" title={row.produto_descricao}>
                                                    {row.produto_descricao}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                            {Number(row.pv_quantidade).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-3 py-2">
                                            {row.sc_numero ? (
                                                <span className="font-mono text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                                    {row.sc_numero}/{row.sc_item}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            {row.pc_numero ? (
                                                <span className="font-mono text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                                                    {row.pc_numero}/{row.pc_item}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            {row.fornecedor_nome ? (
                                                <span className="text-xs text-slate-600 truncate block max-w-[120px]" title={row.fornecedor_nome}>
                                                    {row.fornecedor_nome}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-center">{getStatusBadge(row.status_rastreamento)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {results.length > 0 && (
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-sm text-slate-600">
                        <span className="font-medium">{results.length}</span> pedido(s) encontrado(s)
                    </div>
                )}
            </div>
        </div>
    );
}
