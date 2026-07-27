import React, { useState, useRef } from 'react';
import useStickyState from '../hooks/useStickyState';
import { Search, Loader2, X, ShoppingCart, Download } from 'lucide-react';
import { getPurchaseRequests } from '../services/api';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 500;

export default function PurchaseRequests() {
    const [loading, setLoading]         = useState(false);
    const [results, setResults]         = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [progress, setProgress]       = useState({ loaded: 0, done: false });
    const abortRef = useRef(false);

    const [filters, setFilters] = useStickyState({
        filial: '',
        numero_sc: '',
        produto: '',
        descricao: '',
        status: '',
        numero_pedido: '',
        data_de: '',
        data_ate: '',
    }, '@metalfisa:purchase_requests_filters_v2');

    const handleSearch = async (e) => {
        e?.preventDefault();

        // Sinaliza abort para loop anterior (se houver)
        abortRef.current = true;
        await new Promise(r => setTimeout(r, 50));
        abortRef.current = false;

        setLoading(true);
        setHasSearched(true);
        setResults([]);
        setProgress({ loaded: 0, done: false });

        try {
            const baseParams = {};
            Object.entries(filters).forEach(([key, value]) => {
                if (value) baseParams[key] = value;
            });

            let offset   = 0;
            let allRows  = [];
            let keepGoing = true;

            while (keepGoing && !abortRef.current) {
                const response = await getPurchaseRequests({
                    ...baseParams,
                    page_size: PAGE_SIZE,
                    offset,
                });

                // API retorna { data, hasMore, offset, page_size }
                const batch = Array.isArray(response?.data) ? response.data
                            : Array.isArray(response)       ? response
                            : [];

                allRows = [...allRows, ...batch];
                setResults([...allRows]);
                setProgress({ loaded: allRows.length, done: false });

                keepGoing = response?.hasMore === true && batch.length === PAGE_SIZE;
                offset += PAGE_SIZE;
            }

            setProgress({ loaded: allRows.length, done: true });
        } catch (err) {
            console.error('Erro ao buscar solicitacoes:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStop = () => {
        abortRef.current = true;
        setLoading(false);
        setProgress(prev => ({ ...prev, done: true }));
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
        });
    };

    const getStatusLabel = (status) => {
        const labels = {
            'ABERTA':       'Aberta',
            'PENDENTE':     'Pendente',
            'EM_APROVACAO': 'Em Aprovacao',
            'EM_COTACAO':   'Em Cotacao',
            'GEROU_PEDIDO': 'Com Pedido',
        };
        return labels[status] || status || '-';
    };

    const exportToExcel = () => {
        if (!results.length) return;

        const wb = XLSX.utils.book_new();

        const headers = [
            'Filial',
            'Número SC',
            'Item SC',
            'Data Emissão SC',
            'Cód. Produto',
            'Descrição Produto',
            'Quantidade SC',
            'UM',
            'Status',
            'Número Pedido Compras',
            'Item Pedido',
            'Nome Fornecedor',
            'Data Emissão Pedido',
            'Previsão Chegada'
        ];

        const rows = results.map(row => [
            row.filial || '',
            row.sc_numero || '',
            row.sc_item || '',
            formatDate(row.sc_data_emissao),
            row.produto_codigo || '',
            row.produto_descricao || '',
            Number(row.sc_quantidade || 0),
            row.sc_unidade || '',
            getStatusLabel(row.sc_status),
            row.pedido_numero || '',
            row.pedido_item || '',
            row.fornecedor_nome || '',
            formatDate(row.pedido_data_emissao),
            formatDate(row.pedido_data_prevista)
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

        ws['!cols'] = [
            { wch: 8 },  // Filial
            { wch: 14 }, // Número SC
            { wch: 8 },  // Item SC
            { wch: 16 }, // Data Emissão SC
            { wch: 18 }, // Cód. Produto
            { wch: 45 }, // Descrição Produto
            { wch: 14 }, // Quantidade SC
            { wch: 8 },  // UM
            { wch: 16 }, // Status
            { wch: 22 }, // Número Pedido Compras
            { wch: 10 }, // Item Pedido
            { wch: 40 }, // Nome Fornecedor
            { wch: 18 }, // Data Emissão Pedido
            { wch: 16 }  // Previsão Chegada
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Solicitações de Compras');

        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        const fileName = `SolicitacoesCompras_${timestamp}.xlsx`;

        XLSX.writeFile(wb, fileName);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR');
    };

    const getStatusBadge = (status) => {
        const styles = {
            'ABERTA':       'bg-gray-100 text-gray-700 border-gray-200',
            'PENDENTE':     'bg-gray-100 text-gray-700 border-gray-200',
            'EM_APROVACAO': 'bg-yellow-50 text-yellow-700 border-yellow-200',
            'EM_COTACAO':   'bg-blue-50 text-blue-700 border-blue-200',
            'GEROU_PEDIDO': 'bg-green-50 text-green-700 border-green-200',
        };
        const labels = {
            'ABERTA':       'Aberta',
            'PENDENTE':     'Pendente',
            'EM_APROVACAO': 'Em Aprovacao',
            'EM_COTACAO':   'Em Cotacao',
            'GEROU_PEDIDO': 'Com Pedido',
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
                        Solicitacoes de Compras
                    </h1>
                    <p className="text-slate-500">
                        Visualize solicitacoes (SC) e seus pedidos de compras (PC).
                    </p>
                </div>
                {results.length > 0 && (
                    <button
                        onClick={exportToExcel}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-lg shadow transition-all duration-150"
                        title={`Exportar ${results.length} solicitações para Excel`}
                    >
                        <Download className="h-4 w-4" />
                        Exportar Excel
                        <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                            {results.length}
                        </span>
                    </button>
                )}
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <form onSubmit={handleSearch} className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Filial</label>
                            <input type="text" value={filters.filial}
                                onChange={(e) => handleFilterChange('filial', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="01" />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nr Solicitacao</label>
                            <input type="text" value={filters.numero_sc}
                                onChange={(e) => handleFilterChange('numero_sc', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="000123" />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Cod. Produto</label>
                            <input type="text" value={filters.produto}
                                onChange={(e) => handleFilterChange('produto', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="MTA-001" />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Descricao</label>
                            <input type="text" value={filters.descricao}
                                onChange={(e) => handleFilterChange('descricao', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="Parafuso..." />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                            <select value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                                <option value="">Todos</option>
                                <option value="ABERTA">Aberta</option>
                                <option value="EM_APROVACAO">Em Aprovacao</option>
                                <option value="EM_COTACAO">Em Cotacao</option>
                                <option value="GEROU_PEDIDO">Com Pedido</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nr Pedido Compras</label>
                            <input type="text" value={filters.numero_pedido}
                                onChange={(e) => handleFilterChange('numero_pedido', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="000456" />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data SC De</label>
                            <input type="date" value={filters.data_de}
                                onChange={(e) => handleFilterChange('data_de', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data SC Ate</label>
                            <input type="date" value={filters.data_ate}
                                onChange={(e) => handleFilterChange('data_ate', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={clearFilters}
                            className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors flex items-center gap-1">
                            <X className="h-4 w-4" /> Limpar
                        </button>
                        {loading && (
                            <button type="button" onClick={handleStop}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                                <X className="h-4 w-4" /> Parar
                            </button>
                        )}
                        <button type="submit" disabled={loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            Buscar
                        </button>
                    </div>
                </form>
            </div>

            {/* Barra de progresso */}
            {loading && (
                <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando em lotes de {PAGE_SIZE.toLocaleString('pt-BR')}...
                        </div>
                        <span className="text-sm font-bold text-blue-800">
                            {progress.loaded.toLocaleString('pt-BR')} registros carregados
                        </span>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-blue-500 h-2 rounded-full animate-pulse"
                            style={{ width: `${Math.min(95, 10 + (progress.loaded / PAGE_SIZE) * 15)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Results Table Container */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {/* Scrollable area only for the data table */}
                <div className="overflow-auto max-h-[calc(100vh-380px)] min-h-[300px]">
                    <table className="w-full text-left border-collapse text-sm relative">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase sticky top-0 z-10 shadow-sm">
                                <th className="px-3 py-3 bg-slate-50">Filial</th>
                                <th className="px-3 py-3 bg-slate-50">Nr SC</th>
                                <th className="px-3 py-3 bg-slate-50">Item</th>
                                <th className="px-3 py-3 bg-slate-50">Data SC</th>
                                <th className="px-3 py-3 bg-slate-50">Produto</th>
                                <th className="px-3 py-3 bg-slate-50 text-right">Qtd</th>
                                <th className="px-3 py-3 bg-slate-50">UM</th>
                                <th className="px-3 py-3 bg-slate-50 text-center">Status</th>
                                <th className="px-3 py-3 bg-slate-50">Nr Pedido Compras</th>
                                <th className="px-3 py-3 bg-slate-50">Fornecedor</th>
                                <th className="px-3 py-3 bg-slate-50">Data Ped.</th>
                                <th className="px-3 py-3 bg-slate-50">Previsao</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {results.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan="12" className="px-4 py-12 text-center text-slate-500">
                                        {hasSearched
                                            ? 'Nenhuma solicitacao encontrada.'
                                            : 'Use os filtros acima e clique em Buscar.'}
                                    </td>
                                </tr>
                            ) : (
                                results.map((row, index) => (
                                    <tr key={index}
                                        className={`hover:bg-slate-50 transition-colors ${row.sc_status === 'GEROU_PEDIDO' ? 'bg-green-50/30' : ''}`}>
                                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.filial}</td>
                                        <td className="px-3 py-2 font-medium text-blue-700">{row.sc_numero}</td>
                                        <td className="px-3 py-2 text-slate-500">{row.sc_item}</td>
                                        <td className="px-3 py-2 text-slate-600">{formatDate(row.sc_data_emissao)}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs text-slate-700">{row.produto_codigo}</span>
                                                <span className="text-xs text-slate-500" title={row.produto_descricao}>
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
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-sm text-slate-600 z-10">
                        <span>
                            <span className="font-medium">{results.length.toLocaleString('pt-BR')}</span> solicitacao(oes) carregada(s)
                            {loading && <span className="ml-2 text-blue-600 animate-pulse"> carregando mais...</span>}
                            {progress.done && !loading && <span className="ml-2 text-green-600 font-medium"> completo</span>}
                        </span>
                        {progress.done && !loading && (
                            <span className="text-xs text-slate-400">
                                Lotes de {PAGE_SIZE.toLocaleString('pt-BR')} registros
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
