import React, { useState, useEffect } from 'react';
import useStickyState from '../hooks/useStickyState';
import { Search, Loader2, FileText, Filter, X, ArrowRightCircle, Download } from 'lucide-react';
import { getPurchaseFlowToInvoice, getCompanySettings } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

export default function PurchaseFlowToInvoice() {
    const { hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(null);
    const [filters, setFilters] = useStickyState({
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
        sc_necessidade_de: '',
        sc_necessidade_ate: '',
        pc_emissao_de: '',
        pc_emissao_ate: '',
        nf_recebimento_de: '',
        nf_recebimento_ate: '',
        tem_nf: '',
        comprador: '',
        sc_solicitante: '',
        cliente: '',
        op_numero: ''
    }, '@lynxems:purchase_flow_filters');
    const [showValues, setShowValues] = useState(false);

    useEffect(() => {
        getCompanySettings().then(settings => {
            if (settings?.general_config) {
                const config = typeof settings.general_config === 'string' ? JSON.parse(settings.general_config) : settings.general_config;
                setShowValues(!!config.show_purchase_values && canViewValues);
            }
        }).catch(err => console.error("Falha ao carregar configurações:", err));
    }, []);

    const handleSearch = async (e) => {
        e?.preventDefault();
        setLoading(true);
        setHasSearched(true);
        setResults([]);
        setLoadingProgress('Iniciando busca...');

        try {
            const baseParams = {};
            Object.entries(filters).forEach(([key, value]) => {
                if (value) baseParams[key] = value;
            });

            const limit = 1000;
            let offset = 0;
            let allResults = [];
            let keepFetching = true;

            while (keepFetching) {
                const params = { ...baseParams, limit, offset };
                const data = await getPurchaseFlowToInvoice(params);
                const batch = Array.isArray(data) ? data : [];
                
                allResults = [...allResults, ...batch];
                setLoadingProgress(`Carregados ${allResults.length} registros...`);

                if (batch.length < limit) {
                    keepFetching = false;
                } else {
                    offset += limit;
                }
            }
            setResults(allResults);
            setLoadingProgress(null);
        } catch (err) {
            console.error('Erro ao buscar fluxo de compras:', err);
            setLoadingProgress(null);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const clearFilters = () => {
        setFilters({
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
            sc_necessidade_de: '',
            sc_necessidade_ate: '',
            pc_emissao_de: '',
            pc_emissao_ate: '',
            nf_recebimento_de: '',
            nf_recebimento_ate: '',
            tem_nf: '',
            comprador: '',
            sc_solicitante: '',
            cliente: '',
            op_numero: ''
        });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR');
    };

    const formatCurrency = (value) => {
        if (!value && value !== 0) return '-';
        return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatNumber = (value, decimals = 2) => {
        if (!value && value !== 0) return '-';
        return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: decimals });
    };

    const getStatusLabel = (status) => {
        const labels = { 'SEM_PC': 'Sem Pedido', 'COM_PC': 'Com Pedido', 'ENTREGUE': 'Entregue' };
        return labels[status] || status || '-';
    };

    const exportToExcel = () => {
        if (!results.length) return;

        const wb = XLSX.utils.book_new();

        // ---- ABA 1: FLUXO PRINCIPAL ----
        const mainHeaders = [
            'Filial',
            'SC Número', 'SC Item',
            'Data Emissão SC',
            'Data Necessidade SC',
            'Solicitante SC',
            'OP Nº Origem SC',
            'OP Item Origem SC',
            'PV Nº Origem SC',
            'PV Item Origem SC',
            'Cliente',
            'Cód. Produto', 'Descrição Produto',
            'Qtd SC', 'UM',
            'PC Número', 'PC Item',
            'Data Emissão PC',
            'Cód. Fornecedor', 'Loja Fornecedor', 'Nome Fornecedor',
            'Prev. Chegada',
            'NF(s) de Entrada',
            'Data Último Recebimento',
            'Qtd Total Recebida',
            'Comprador',
            'Status',
            ...(showValues ? ['Valor Unit. PC', 'Valor Total PC', 'Valor Total NFs Recebidas'] : [])
        ];

        const mainRows = results.map(row => {
            const totalQtdRecebida = (row.details_json || []).reduce((acc, nf) => acc + Number(nf.qtd || 0), 0);
            const totalValorRecebido = (row.details_json || []).reduce((acc, nf) => acc + Number(nf.total || 0), 0);
            const nfDocs = (row.details_json || []).map(nf => `${nf.doc}/${nf.serie}`).join('; ');

            return [
                row.filial || '',
                row.sc_numero || '',
                row.sc_item || '',
                formatDate(row.sc_data_emissao),
                formatDate(row.sc_prev_necessidade),
                row.sc_solicitante || '',
                row.sc_op_numero || '',
                row.sc_op_item || '',
                row.sc_pedido_origem || '',
                row.sc_pv_item || '',
                row.cliente_nome || '',
                row.produto_codigo || '',
                row.produto_descricao || '',
                Number(row.sc_quantidade || 0),
                row.sc_unidade || '',
                row.pc_numero || '',
                row.pc_item || '',
                formatDate(row.pc_data_emissao),
                row.fornecedor_codigo || '',
                row.fornecedor_loja || '',
                row.fornecedor_nome || '',
                formatDate(row.pc_prev_chegada),
                nfDocs || '',
                formatDate(row.nf_data_recebimento),
                totalQtdRecebida,
                row.comprador || '',
                getStatusLabel(row.status_fluxo),
                ...(showValues ? [
                    Number(row.pc_valor_unitario || 0),
                    Number(row.pc_valor_total || 0),
                    totalValorRecebido
                ] : [])
            ];
        });

        const ws1 = XLSX.utils.aoa_to_sheet([mainHeaders, ...mainRows]);

        // Estilo cabeçalho (larguras de colunas)
        ws1['!cols'] = [
            { wch: 8 },  // Filial
            { wch: 12 }, // SC Número
            { wch: 8 },  // SC Item
            { wch: 14 }, // Data Emissão SC
            { wch: 16 }, // Data Necessidade SC
            { wch: 18 }, // Solicitante SC
            { wch: 15 }, // OP Nº Origem SC
            { wch: 10 }, // OP Item Origem SC
            { wch: 15 }, // PV Nº Origem SC
            { wch: 10 }, // PV Item Origem SC
            { wch: 35 }, // Cliente
            { wch: 16 }, // Cód. Produto
            { wch: 40 }, // Descrição
            { wch: 12 }, // Qtd SC
            { wch: 6 },  // UM
            { wch: 12 }, // PC Número
            { wch: 8 },  // PC Item
            { wch: 14 }, // Data Emissão PC
            { wch: 14 }, // Cód. Fornecedor
            { wch: 8 },  // Loja
            { wch: 35 }, // Nome Fornecedor
            { wch: 14 }, // Prev. Chegada
            { wch: 30 }, // NFs
            { wch: 22 }, // Data Recebimento
            { wch: 16 }, // Qtd Recebida
            { wch: 20 }, // Comprador
            { wch: 14 }, // Status
            ...(showValues ? [{ wch: 16 }, { wch: 16 }, { wch: 18 }] : [])
        ];

        XLSX.utils.book_append_sheet(wb, ws1, 'Fluxo SC-PC-NF');

        // ---- ABA 2: DETALHES DAS NFs ----
        const nfHeaders = [
            'Filial',
            'SC Número', 'SC Item',
            'Data Necessidade SC',
            'Solicitante SC',
            'OP Nº Origem SC',
            'OP Item Origem SC',
            'PV Nº Origem SC',
            'PV Item Origem SC',
            'Cliente',
            'Cód. Produto', 'Descrição Produto', 'UM',
            'PC Número', 'PC Item',
            'Nome Fornecedor',
            'NF Documento', 'NF Série',
            'Data Recebimento NF',
            'Qtd Recebida NF',
            ...(showValues ? ['Valor Unitário NF', 'Valor Total NF'] : []),
            'Comprador',
            'Status'
        ];

        const nfRows = [];
        results.forEach(row => {
            const details = row.details_json || [];
            if (details.length === 0) {
                // Linha sem NF
                nfRows.push([
                    row.filial || '',
                    row.sc_numero || '',
                    row.sc_item || '',
                    formatDate(row.sc_prev_necessidade),
                    row.sc_solicitante || '',
                    row.sc_op_numero || '',
                    row.sc_op_item || '',
                    row.sc_pedido_origem || '',
                    row.sc_pv_item || '',
                    row.cliente_nome || '',
                    row.produto_codigo || '',
                    row.produto_descricao || '',
                    row.sc_unidade || '',
                    row.pc_numero || '',
                    row.pc_item || '',
                    row.fornecedor_nome || '',
                    '', '',
                    '',
                    0,
                    ...(showValues ? [0, 0] : []),
                    row.comprador || '',
                    getStatusLabel(row.status_fluxo)
                ]);
            } else {
                details.forEach(nf => {
                    nfRows.push([
                        row.filial || '',
                        row.sc_numero || '',
                        row.sc_item || '',
                        formatDate(row.sc_prev_necessidade),
                        row.sc_solicitante || '',
                        row.sc_op_numero || '',
                        row.sc_op_item || '',
                        row.sc_pedido_origem || '',
                        row.sc_pv_item || '',
                        row.cliente_nome || '',
                        row.produto_codigo || '',
                        row.produto_descricao || '',
                        row.sc_unidade || '',
                        row.pc_numero || '',
                        row.pc_item || '',
                        row.fornecedor_nome || '',
                        nf.doc || '',
                        nf.serie || '',
                        formatDate(nf.recbmto),
                        Number(nf.qtd || 0),
                        ...(showValues ? [Number(nf.vunit || 0), Number(nf.total || 0)] : []),
                        row.comprador || '',
                        getStatusLabel(row.status_fluxo)
                    ]);
                });
            }
        });

        const ws2 = XLSX.utils.aoa_to_sheet([nfHeaders, ...nfRows]);
        ws2['!cols'] = [
            { wch: 8 }, { wch: 12 }, { wch: 8 },
            { wch: 16 }, // Data Necessidade SC
            { wch: 18 }, // Solicitante SC
            { wch: 15 }, // OP Nº Origem SC
            { wch: 10 }, // OP Item Origem SC
            { wch: 15 }, // PV Nº Origem SC
            { wch: 10 }, // PV Item Origem SC
            { wch: 35 }, // Cliente
            { wch: 16 }, { wch: 40 }, { wch: 6 },
            { wch: 12 }, { wch: 8 },
            { wch: 35 },
            { wch: 14 }, { wch: 10 },
            { wch: 18 }, { wch: 14 },
            ...(showValues ? [{ wch: 16 }, { wch: 16 }] : []),
            { wch: 20 }, { wch: 14 }
        ];
        XLSX.utils.book_append_sheet(wb, ws2, 'Detalhes NFs');

        // ---- ABA 3: RESUMO POR FORNECEDOR ----
        const fornecedorMap = {};
        results.forEach(row => {
            const key = `${row.fornecedor_codigo || 'SEM'}/${row.fornecedor_loja || ''}`;
            if (!fornecedorMap[key]) {
                fornecedorMap[key] = {
                    codigo: row.fornecedor_codigo || '',
                    loja: row.fornecedor_loja || '',
                    nome: row.fornecedor_nome || '',
                    totalSCs: 0,
                    totalPCs: 0,
                    totalEntregues: 0,
                    qtdSC: 0,
                    qtdRecebida: 0,
                    valorTotal: 0
                };
            }
            fornecedorMap[key].totalSCs++;
            if (row.pc_numero) fornecedorMap[key].totalPCs++;
            if (row.status_fluxo === 'ENTREGUE') fornecedorMap[key].totalEntregues++;
            fornecedorMap[key].qtdSC += Number(row.sc_quantidade || 0);
            const qtdRec = (row.details_json || []).reduce((a, n) => a + Number(n.qtd || 0), 0);
            fornecedorMap[key].qtdRecebida += qtdRec;
            if (showValues) {
                const valTotal = (row.details_json || []).reduce((a, n) => a + Number(n.total || 0), 0);
                fornecedorMap[key].valorTotal += valTotal;
            }
        });

        const resumoHeaders = [
            'Cód. Fornecedor', 'Loja', 'Nome Fornecedor',
            'Total SCs', 'Total PCs', 'Total Entregues',
            'Qtd SC Total', 'Qtd Recebida Total',
            ...(showValues ? ['Valor Total Recebido'] : [])
        ];
        const resumoRows = Object.values(fornecedorMap).map(f => [
            f.codigo, f.loja, f.nome,
            f.totalSCs, f.totalPCs, f.totalEntregues,
            f.qtdSC, f.qtdRecebida,
            ...(showValues ? [f.valorTotal] : [])
        ]);

        const ws3 = XLSX.utils.aoa_to_sheet([resumoHeaders, ...resumoRows]);
        ws3['!cols'] = [
            { wch: 16 }, { wch: 8 }, { wch: 35 },
            { wch: 12 }, { wch: 12 }, { wch: 16 },
            { wch: 16 }, { wch: 18 },
            ...(showValues ? [{ wch: 20 }] : [])
        ];
        XLSX.utils.book_append_sheet(wb, ws3, 'Resumo por Fornecedor');

        // Gerar nome de arquivo com data/hora
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        const fileName = `FluxoCompras_SC_PC_NF_${timestamp}.xlsx`;

        XLSX.writeFile(wb, fileName);
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
                {results.length > 0 && (
                    <button
                        onClick={exportToExcel}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-lg shadow transition-all duration-150"
                        title={`Exportar ${results.length} registro(s) para Excel`}
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
                    {/* Primeira linha de filtros */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {/* Cliente */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Cliente</label>
                            <input
                                type="text"
                                value={filters.cliente}
                                onChange={(e) => handleFilterChange('cliente', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="Nome do cliente..."
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

                        {/* Nº OP */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nº OP</label>
                            <input
                                type="text"
                                value={filters.op_numero}
                                onChange={(e) => handleFilterChange('op_numero', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                placeholder="004159..."
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



                    {/* Terceira linha - Datas & Comprador & Solicitante */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-3">
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

                        {/* Solicitante Filter */}
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Solicitante SC</label>
                            <input
                                type="text"
                                value={filters.sc_solicitante}
                                onChange={(e) => handleFilterChange('sc_solicitante', e.target.value)}
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

                        {/* Necess. SC De */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Necess. SC De</label>
                            <input
                                type="date"
                                value={filters.sc_necessidade_de}
                                onChange={(e) => handleFilterChange('sc_necessidade_de', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>

                        {/* Necess. SC Até */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Necess. SC Até</label>
                            <input
                                type="date"
                                value={filters.sc_necessidade_ate}
                                onChange={(e) => handleFilterChange('sc_necessidade_ate', e.target.value)}
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
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loadingProgress && results.length > 0 && (
                    <div className="bg-blue-50 text-blue-700 px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b border-blue-100">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                        <span>{loadingProgress}</span>
                    </div>
                )}
                <div className="overflow-auto max-h-[calc(100vh-380px)]">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead className="sticky top-0 bg-slate-50 z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                            <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                                <th className="px-3 py-3">Filial</th>
                                <th className="px-3 py-3">SC Nº</th>
                                <th className="px-3 py-3">SC Item</th>
                                <th className="px-3 py-3">Data SC</th>
                                <th className="px-3 py-3">Necess. SC</th>
                                <th className="px-3 py-3">OP Nº</th>
                                <th className="px-3 py-3">OP Item</th>
                                <th className="px-3 py-3">PV Nº</th>
                                <th className="px-3 py-3">PV Item</th>
                                <th className="px-3 py-3">Cliente</th>
                                <th className="px-3 py-3">Solicitante</th>
                                <th className="px-3 py-3">Produto</th>
                                <th className="px-3 py-3 text-right">Qtd SC</th>
                                <th className="px-3 py-3 text-center">UM</th>
                                <th className="px-3 py-3">PC Nº</th>
                                <th className="px-3 py-3">PC Item</th>
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
                            {loading && results.length === 0 ? (
                                <tr>
                                    <td colSpan="23" className="px-4 py-12 text-center text-slate-500">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                                        {loadingProgress || 'Carregando fluxo de compras...'}
                                    </td>
                                </tr>
                            ) : results.length === 0 ? (
                                <tr>
                                    <td colSpan="23" className="px-4 py-12 text-center text-slate-500">
                                        {hasSearched
                                            ? 'Nenhum registro encontrado.'
                                            : 'Use os filtros acima e clique em Buscar.'}
                                    </td>
                                </tr>
                            ) : (
                                results.slice(0, 1000).map((row, index) => (
                                    <tr
                                        key={index}
                                        className={`hover:bg-slate-50 transition-colors ${row.status_fluxo === 'ENTREGUE' ? 'bg-green-50/30' : ''}`}
                                    >
                                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.filial}</td>
                                        <td className="px-3 py-2 font-medium text-blue-700">
                                            <span>{row.sc_numero}</span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 font-mono text-xs">{row.sc_item}</td>
                                        <td className="px-3 py-2 text-slate-600">{formatDate(row.sc_data_emissao)}</td>
                                        <td className="px-3 py-2 text-slate-600">{formatDate(row.sc_prev_necessidade)}</td>
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {row.sc_op_numero ? (
                                                <span className="bg-orange-50 text-orange-800 border border-orange-200 px-1.5 py-0.5 rounded font-mono">
                                                    {row.sc_op_numero}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 font-mono text-xs text-center">
                                            {row.sc_op_item || <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {row.sc_pedido_origem ? (
                                                <span className="bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded font-mono">
                                                    {row.sc_pedido_origem}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 font-mono text-xs text-center">
                                            {row.sc_pv_item || <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 font-medium truncate max-w-[150px]" title={row.cliente_nome}>
                                            {row.cliente_nome || <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 font-medium">{row.sc_solicitante || '-'}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs text-slate-700">{row.produto_codigo}</span>
                                                <span className="text-xs text-slate-500" title={row.produto_descricao}>
                                                    {row.produto_descricao}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                            {Number(row.sc_quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                                {row.sc_unidade || '-'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {row.pc_numero ? (
                                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono">
                                                    {row.pc_numero}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 font-mono text-xs">
                                            {row.pc_item || <span className="text-slate-300">-</span>}
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
                            {results.length > 1000 && (
                                <span className="text-slate-400 font-normal ml-2">
                                    (Exibindo os primeiros 1000 registros na tela para melhor performance. Exportação para Excel trará todos os {results.length} registros).
                                </span>
                            )}
                        </div>
                    )
                }
            </div >
        </div >
    );
}
