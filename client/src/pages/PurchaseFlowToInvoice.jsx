import React, { useState, useEffect } from 'react';
import useStickyState from '../hooks/useStickyState';
import { Search, Loader2, FileText, Filter, X, ArrowRightCircle } from 'lucide-react';
import { getPurchaseFlowToInvoice, getCompanySettings } from '../services/api';

export default function PurchaseFlowToInvoice() {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [filters, setFilters] = useStickyState({
        filial: '',
        sc_numero: '',
        sc_numero_de: '',
        sc_numero_ate: '',
        produto: '',
        descricao: '',
        pc_numero: '',
        fornecedor: '',
        fornecedor_nome: '',
        sc_emissao_de: '',
        sc_emissao_ate: '',
        pc_emissao_de: '',
        pc_emissao_ate: '',
        nf_recebimento_ate: '',
        tem_nf: '',
        comprador: ''
    }, '@metalfisa:purchase_flow_filters');
    const [showValues, setShowValues] = useState(false);

    useEffect(() => {
        getCompanySettings().then(settings => {
            if (settings?.general_config) {
                const config = typeof settings.general_config === 'string' ? JSON.parse(settings.general_config) : settings.general_config;
                setShowValues(!!config.show_purchase_values);
            }
        }).catch(err => console.error("Falha ao carregar configurações:", err));
    }, []);

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
            const data = await getPurchaseFlowToInvoice(params);
            // Ensure data is always an array
            setResults(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Erro ao buscar fluxo de compras:', err);
            setResults([]); // Ensure empty array on error
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
            sc_numero: '',
            sc_numero_de: '',
            sc_numero_ate: '',
            produto: '',
            descricao: '',
            pc_numero: '',
            fornecedor: '',
            fornecedor_nome: '',
            sc_emissao_de: '',
            sc_emissao_ate: '',
            pc_emissao_de: '',
            pc_emissao_ate: '',
            nf_recebimento_de: '',
            nf_recebimento_ate: '',
            tem_nf: '',
            comprador: ''
        });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR');
    };

    const getStatusBadge = (status) => {
        const styles = {
            'SEM_PC': 'bg-gray-100 text-gray-700 border-gray-200',
            'COM_PC': 'bg-blue-50 text-blue-700 border-blue-200',
            'ENTREGUE': 'bg-green-50 text-green-700 border-green-200'
        };
        const labels = {
            'SEM_PC': 'Sem Pedido',
            'COM_PC': 'Com Pedido',
            'ENTREGUE': 'Entregue'
        };
        return (
            <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[status] || styles.SEM_PC}`}>
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
                        <ArrowRightCircle className="h-6 w-6 text-blue-600" />
                        Da Solicitação de Compra à NF de Entrada
                    </h1>
                    <p className="text-slate-500">
                        Acompanhe o fluxo completo: SC → PC → NF Entrada
                    </p>
                </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <form onSubmit={handleSearch} className="space-y-4">
                    {/* Primeira linha de filtros */}
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
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nº SC</label>
                            <input
                                type="text"
                                value={filters.sc_numero}
                                onChange={(e) => handleFilterChange('sc_numero', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="000123"
                            />
                        </div>

                        {/* SC De */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nº SC De</label>
                            <input
                                type="text"
                                value={filters.sc_numero_de}
                                onChange={(e) => handleFilterChange('sc_numero_de', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="000001"
                            />
                        </div>

                        {/* SC Até */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nº SC Até</label>
                            <input
                                type="text"
                                value={filters.sc_numero_ate}
                                onChange={(e) => handleFilterChange('sc_numero_ate', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="000999"
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
                    </div>

                    {/* Segunda linha de filtros */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
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

                        {/* Cód. Fornecedor */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Cód. Fornecedor</label>
                            <input
                                type="text"
                                value={filters.fornecedor}
                                onChange={(e) => handleFilterChange('fornecedor', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="F001"
                            />
                        </div>

                        {/* Nome Fornecedor */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nome Fornecedor</label>
                            <input
                                type="text"
                                value={filters.fornecedor_nome}
                                onChange={(e) => handleFilterChange('fornecedor_nome', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="Nome do fornecedor"
                            />
                        </div>

                        {/* Tem NF */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Tem NF?</label>
                            <select
                                value={filters.tem_nf}
                                onChange={(e) => handleFilterChange('tem_nf', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            >
                                <option value="">Todos</option>
                                <option value="SIM">Sim</option>
                                <option value="NAO">Não</option>
                            </select>
                        </div>
                    </div>



                    {/* Terceira linha - Datas & Comprador */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {/* Comprador Filter */}
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Comprador</label>
                            <input
                                type="text"
                                value={filters.comprador}
                                onChange={(e) => handleFilterChange('comprador', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="Nome..."
                            />
                        </div>

                        {/* Data SC De */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data SC De</label>
                            <input
                                type="date"
                                value={filters.sc_emissao_de}
                                onChange={(e) => handleFilterChange('sc_emissao_de', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>

                        {/* Data SC Até */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data SC Até</label>
                            <input
                                type="date"
                                value={filters.sc_emissao_ate}
                                onChange={(e) => handleFilterChange('sc_emissao_ate', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>

                        {/* Data PC De */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data PC De</label>
                            <input
                                type="date"
                                value={filters.pc_emissao_de}
                                onChange={(e) => handleFilterChange('pc_emissao_de', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>

                        {/* Data PC Até */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data PC Até</label>
                            <input
                                type="date"
                                value={filters.pc_emissao_ate}
                                onChange={(e) => handleFilterChange('pc_emissao_ate', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>

                        {/* Data NF Receb. De */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">NF Receb. De</label>
                            <input
                                type="date"
                                value={filters.nf_recebimento_de}
                                onChange={(e) => handleFilterChange('nf_recebimento_de', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>

                        {/* Data NF Receb. Até */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">NF Receb. Até</label>
                            <input
                                type="date"
                                value={filters.nf_recebimento_ate}
                                onChange={(e) => handleFilterChange('nf_recebimento_ate', e.target.value)}
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
            </div >

            {/* Results Table */}
            < div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" >
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                                <th className="px-3 py-3">Filial</th>
                                <th className="px-3 py-3">SC Nº/Item</th>
                                <th className="px-3 py-3">Data SC</th>
                                <th className="px-3 py-3">Produto</th>
                                <th className="px-3 py-3 text-right">Qtd SC</th>
                                <th className="px-3 py-3">PC Nº/Item</th>
                                <th className="px-3 py-3">Data PC</th>
                                <th className="px-3 py-3">Fornecedor</th>
                                <th className="px-3 py-3">Prev. Chegada</th>
                                <th className="px-3 py-3">NF Entrada</th>
                                <th className="px-3 py-3">Data Receb.</th>
                                <th className="px-3 py-3">Comprador</th>
                                <th className="px-3 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="12" className="px-4 py-12 text-center text-slate-500">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                                        Carregando fluxo de compras...
                                    </td>
                                </tr>
                            ) : results.length === 0 ? (
                                <tr>
                                    <td colSpan="12" className="px-4 py-12 text-center text-slate-500">
                                        {hasSearched
                                            ? 'Nenhum registro encontrado.'
                                            : 'Use os filtros acima e clique em Buscar.'}
                                    </td>
                                </tr>
                            ) : (
                                results.map((row, index) => (
                                    <tr
                                        key={index}
                                        className={`hover:bg-slate-50 transition-colors ${row.status_fluxo === 'ENTREGUE' ? 'bg-green-50/30' : ''}`}
                                    >
                                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.filial}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-blue-700">{row.sc_numero}</span>
                                                <span className="text-xs text-slate-400">Item: {row.sc_item}</span>
                                            </div>
                                        </td>
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
                                            {Number(row.sc_quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 py-2">
                                            {row.pc_numero ? (
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded inline-block w-fit">
                                                        {row.pc_numero}
                                                    </span>
                                                    <span className="text-xs text-slate-400">Item: {row.pc_item}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600">{formatDate(row.pc_data_emissao)}</td>
                                        <td className="px-3 py-2">
                                            {row.fornecedor_nome ? (
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-slate-600 truncate block max-w-[150px]" title={row.fornecedor_nome}>
                                                        {row.fornecedor_nome}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {row.fornecedor_codigo}/{row.fornecedor_loja}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600">{formatDate(row.pc_prev_chegada)}</td>
                                        <td className="px-3 py-2">
                                            {row.nf_documentos ? (
                                                <div className="relative group cursor-default">
                                                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded inline-block ${
                                                        // Check if partial receive (sum received < ordered)
                                                        (row.details_json || []).reduce((acc, nf) => acc + Number(nf.qtd || 0), 0) < Number(row.pc_quantidade || 0)
                                                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                                            : 'bg-green-100 text-green-800'
                                                        }`}>
                                                        {row.nf_documentos}
                                                        {(row.details_json || []).length > 1 && <span className="ml-1 text-[10px] text-gray-500">({row.details_json.length})</span>}
                                                    </span>

                                                    {/* Detail Tooltip */}
                                                    <div className="hidden group-hover:block absolute z-50 right-0 top-full mt-1 min-w-[450px] bg-white border border-slate-200 shadow-xl rounded-lg p-2 text-xs">
                                                        <table className="w-full text-left">
                                                            <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                                                                <tr>
                                                                    <th className="p-1">Doc/Série</th>
                                                                    <th className="p-1">Data</th>
                                                                    <th className="p-1 text-right">Qtd</th>
                                                                    {showValues && <th className="p-1 text-right">V. Unit</th>}
                                                                    {showValues && <th className="p-1 text-right">Total</th>}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y">
                                                                {(row.details_json || []).map((det, i) => (
                                                                    <tr key={i}>
                                                                        <td className="p-1 font-mono">{det.doc}/{det.serie}</td>
                                                                        <td className="p-1">{det.recbmto ? formatDate(det.recbmto) : '-'}</td>
                                                                        <td className="p-1 text-right font-medium">{Number(det.qtd).toLocaleString('pt-BR')}</td>
                                                                        {showValues && (
                                                                            <td className="p-1 text-right text-slate-600">
                                                                                {Number(det.vunit || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                            </td>
                                                                        )}
                                                                        {showValues && (
                                                                            <td className="p-1 text-right font-medium text-slate-900">
                                                                                {Number(det.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                                {/* Total Row */}
                                                                <tr className="bg-slate-50 font-bold border-t">
                                                                    <td className="p-1" colSpan="2">Total</td>
                                                                    <td className="p-1 text-right">
                                                                        {(row.details_json || []).reduce((acc, nf) => acc + Number(nf.qtd || 0), 0).toLocaleString('pt-BR')}
                                                                    </td>
                                                                    {showValues && (
                                                                        <td className="p-1 text-right" colSpan="2">
                                                                            {(row.details_json || []).reduce((acc, nf) => acc + Number(nf.total || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600">{formatDate(row.nf_data_recebimento)}</td>
                                        <td className="px-3 py-2 text-slate-600 font-mono text-xs">{row.comprador || '-'}</td>
                                        <td className="px-3 py-2 text-center">{getStatusBadge(row.status_fluxo)}</td>
                                    </tr >
                                ))
                            )
                            }
                        </tbody >
                    </table >
                </div >

                {
                    results.length > 0 && (
                        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-sm text-slate-600">
                            <span className="font-medium">{results.length}</span> registro(s) encontrado(s)
                        </div>
                    )
                }
            </div >
        </div >
    );
}
