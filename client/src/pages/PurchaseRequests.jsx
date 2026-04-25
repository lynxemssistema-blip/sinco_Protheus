import React, { useState } from 'react';
import useStickyState from '../hooks/useStickyState';
import { Search, Loader2, Package, FileText, Calendar, Filter, X, ShoppingCart } from 'lucide-react';
import { getPurchaseRequests } from '../services/api';

export default function PurchaseRequests() {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [filters, setFilters] = useStickyState({
        filial: '',
        numero_sc: '',
        produto: '',
        descricao: '',
        status: '',
        numero_pedido: '',
        data_de: '',
        data_ate: '',
        limit: 500
    }, '@metalfisa:purchase_requests_filters');

    const handleSearch = async (e) => {
        e?.preventDefault();
        setLoading(true);
        setHasSearched(true);
        setResults([]);

        try {
            const params = {};
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params[key] = value;
            });
            const data = await getPurchaseRequests(params);
            setResults(data);
        } catch (err) {
            console.error('Erro ao buscar solicitações:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const clearFilters = () => {
        setFilters({
            filial: '',
            numero_sc: '',
            produto: '',
            descricao: '',
            status: '',
            numero_pedido: '',
            data_de: '',
            data_ate: '',
            limit: 500
        });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR');
    };

    const getStatusBadge = (status) => {
        const styles = {
            'ABERTA': 'bg-gray-100 text-gray-700 border-gray-200',
            'EM_APROVACAO': 'bg-yellow-50 text-yellow-700 border-yellow-200',
            'EM_COTACAO': 'bg-blue-50 text-blue-700 border-blue-200',
            'GEROU_PEDIDO': 'bg-green-50 text-green-700 border-green-200'
        };
        const labels = {
            'ABERTA': 'Aberta',
            'EM_APROVACAO': 'Em Aprovação',
            'EM_COTACAO': 'Em Cotação',
            'GEROU_PEDIDO': 'Com Pedido'
        };
        return (
            <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[status] || styles.ABERTA}`}>
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
                        <ShoppingCart className="h-6 w-6 text-blue-600" />
                        Solicitações de Compras
                    </h1>
                    <p className="text-slate-500">
                        Visualize solicitações (SC) e seus pedidos de compras (PC).
                    </p>
                </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <form onSubmit={handleSearch} className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {/* Filial */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Filial</label>
                            <input
                                type="text"
                                value={filters.filial}
                                onChange={(e) => handleFilterChange('filial', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="01"
                            />
                        </div>

                        {/* Número SC */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nº Solicitação</label>
                            <input
                                type="text"
                                value={filters.numero_sc}
                                onChange={(e) => handleFilterChange('numero_sc', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="000123"
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

                        {/* Status */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            >
                                <option value="">Todos</option>
                                <option value="ABERTA">Aberta</option>
                                <option value="EM_APROVACAO">Em Aprovação</option>
                                <option value="EM_COTACAO">Em Cotação</option>
                                <option value="GEROU_PEDIDO">Com Pedido</option>
                            </select>
                        </div>

                        {/* Nº Pedido */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nº Pedido Compras</label>
                            <input
                                type="text"
                                value={filters.numero_pedido}
                                onChange={(e) => handleFilterChange('numero_pedido', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="000456"
                            />
                        </div>

                        {/* Data De */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data SC De</label>
                            <input
                                type="date"
                                value={filters.data_de}
                                onChange={(e) => handleFilterChange('data_de', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>

                        {/* Data Até */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data SC Até</label>
                            <input
                                type="date"
                                value={filters.data_ate}
                                onChange={(e) => handleFilterChange('data_ate', e.target.value)}
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

            {/* Results Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                                <th className="px-3 py-3">Filial</th>
                                <th className="px-3 py-3">Nº SC</th>
                                <th className="px-3 py-3">Item</th>
                                <th className="px-3 py-3">Data SC</th>
                                <th className="px-3 py-3">Produto</th>
                                <th className="px-3 py-3 text-right">Qtd</th>
                                <th className="px-3 py-3">UM</th>
                                <th className="px-3 py-3 text-center">Status</th>
                                <th className="px-3 py-3">Nº Pedido Compras</th>
                                <th className="px-3 py-3">Fornecedor</th>
                                <th className="px-3 py-3">Data Ped.</th>
                                <th className="px-3 py-3">Previsão</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="12" className="px-4 py-12 text-center text-slate-500">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                                        Carregando solicitações...
                                    </td>
                                </tr>
                            ) : results.length === 0 ? (
                                <tr>
                                    <td colSpan="12" className="px-4 py-12 text-center text-slate-500">
                                        {hasSearched
                                            ? 'Nenhuma solicitação encontrada.'
                                            : 'Use os filtros acima e clique em Buscar.'}
                                    </td>
                                </tr>
                            ) : (
                                results.map((row, index) => (
                                    <tr
                                        key={index}
                                        className={`hover:bg-slate-50 transition-colors ${row.sc_status === 'GEROU_PEDIDO' ? 'bg-green-50/30' : ''}`}
                                    >
                                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.filial}</td>
                                        <td className="px-3 py-2 font-medium text-blue-700">{row.sc_numero}</td>
                                        <td className="px-3 py-2 text-slate-500">{row.sc_item}</td>
                                        <td className="px-3 py-2 text-slate-600">{formatDate(row.sc_data_emissao)}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs text-slate-700">{row.produto_codigo}</span>
                                                <span className="text-xs text-slate-500 truncate max-w-[200px]" title={row.produto_descricao}>
                                                    {row.produto_descricao}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                            {Number(row.sc_quantidade).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500">{row.sc_unidade}</td>
                                        <td className="px-3 py-2 text-center">{getStatusBadge(row.sc_status)}</td>
                                        <td className="px-3 py-2">
                                            {row.pedido_numero ? (
                                                <span className="font-mono text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                                                    {row.pedido_numero}/{row.pedido_item}
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
                                        <td className="px-3 py-2 text-slate-600">{formatDate(row.pedido_data_emissao)}</td>
                                        <td className="px-3 py-2 text-slate-600">{formatDate(row.pedido_data_prevista)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {results.length > 0 && (
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-sm text-slate-600">
                        <span className="font-medium">{results.length}</span> solicitação(ões) encontrada(s)
                    </div>
                )}
            </div>
        </div>
    );
}
