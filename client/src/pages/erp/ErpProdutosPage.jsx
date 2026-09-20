import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getEstruturaProduto } from '../../services/api';
import StockModal from '../../components/StockModal';
import { useDebounce } from '../../hooks/useDebounce';
import { 
    Package, Plus, Search, RefreshCw, Layers, CheckCircle2, AlertCircle, 
    ArrowDownToLine, Tag, DollarSign, Scale, X, Database, Sparkles, 
    Clock, Building2, ShieldCheck, ChevronLeft, ChevronRight, Hash,
    Eye, ExternalLink, Box, FileText, Check
} from 'lucide-react';

export default function ErpProdutosPage() {
    const [produtos, setProdutos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 350);
    const [tipoFilter, setTipoFilter] = useState('');
    const [stats, setStats] = useState({ produtos: 0, clientes: 0, fornecedores: 0, pedidos: 0, ops_ativas: 0 });
    const [page, setPage] = useState(0);
    const limit = 50;

    // Modal de Estoque e Saldos
    const [selectedProductForStock, setSelectedProductForStock] = useState(null);

    // Modal de Pré-visualização Rápida da Estrutura (BOM)
    const [quickStructureProduct, setQuickStructureProduct] = useState(null);
    const [quickStructureLoading, setQuickStructureLoading] = useState(false);
    const [quickStructureData, setQuickStructureData] = useState([]);
    const [quickStructureError, setQuickStructureError] = useState(null);

    const handleOpenQuickStructure = async (prod) => {
        setQuickStructureProduct(prod);
        setQuickStructureLoading(true);
        setQuickStructureError(null);
        setQuickStructureData([]);
        try {
            const data = await getEstruturaProduto(prod.codigo);
            setQuickStructureData(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Erro ao carregar estrutura rápida:', err);
            setQuickStructureError('Não foi possível carregar a estrutura técnica deste produto.');
        } finally {
            setQuickStructureLoading(false);
        }
    };

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalError, setModalError] = useState(null);
    const [modalSuccess, setModalSuccess] = useState(null);
    const [saving, setSaving] = useState(false);
    const [generatingCode, setGeneratingCode] = useState(false);

    // Form state com campos completos da filosofia MATA010 Protheus (SB1)
    const [formData, setFormData] = useState({
        codigo: '',
        descricao: '',
        tipo: 'PA',
        unidade_medida: 'UN',
        ncm: '',
        armazem_padrao: '01',
        origem: '0',
        peso_liquido: '',
        peso_bruto: '',
        custo_standard: '',
        preco_venda: '',
        lead_time_dias: '5',
        status: 'ativo'
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [prodRes, statsRes] = await Promise.all([
                api.get(`/erp/produtos?search=${encodeURIComponent(debouncedSearch)}&tipo=${encodeURIComponent(tipoFilter)}&limit=${limit}&offset=${page * limit}`),
                api.get('/erp/stats')
            ]);
            setProdutos(prodRes.data || []);
            setStats(statsRes.data || {});
        } catch (err) {
            console.error('Erro ao carregar dados do ERP:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [debouncedSearch, tipoFilter, page]);

    // Prefixos do Produto (Padrão Protheus MT2, MT3, MT4, SCL...)
    const [selectedPrefixo, setSelectedPrefixo] = useState('MT2');
    const [customPrefixo, setCustomPrefixo] = useState('');
    const [availablePrefixos, setAvailablePrefixos] = useState([]);

    const fetchAvailablePrefixos = async () => {
        try {
            const res = await api.get('/erp/produtos/grupos');
            if (res.data && Array.isArray(res.data)) {
                setAvailablePrefixos(res.data);
            }
        } catch (err) {
            console.error('Erro ao carregar prefixos de produtos:', err);
        }
    };

    // Função para gerar automaticamente o próximo código no padrão Protheus (MATA010) com base no prefixo (mínimo 4 dígitos)
    const fetchNextProductCode = async (prefixoEscolhido = selectedPrefixo) => {
        setGeneratingCode(true);
        try {
            const cleanPref = (prefixoEscolhido === 'OUTRO' ? customPrefixo : prefixoEscolhido) || 'MT2';
            const res = await api.get(`/erp/produtos/proximo-codigo?prefixo=${encodeURIComponent(cleanPref)}&tipo=${encodeURIComponent(formData.tipo)}`);
            if (res.data?.proximoCodigo) {
                setFormData(prev => ({ ...prev, codigo: res.data.proximoCodigo }));
            }
        } catch (err) {
            console.warn('Falha ao gerar código automático:', err);
        } finally {
            setGeneratingCode(false);
        }
    };

    const handlePrefixoChange = (newPref) => {
        setSelectedPrefixo(newPref);
        if (newPref !== 'OUTRO') {
            fetchNextProductCode(newPref);
        }
    };

    // Ao abrir o modal, carregar prefixos e gerar automaticamente o próximo código
    const handleOpenModal = () => {
        setModalError(null);
        setModalSuccess(null);
        setIsModalOpen(true);
        fetchAvailablePrefixos();
        fetchNextProductCode(selectedPrefixo);
    };

    // Ao mudar o tipo no formulário
    const handleTipoChange = (newTipo) => {
        setFormData(prev => ({ ...prev, tipo: newTipo }));
    };

    const handleCreateProduct = async (e) => {
        e.preventDefault();
        setSaving(true);
        setModalError(null);
        setModalSuccess(null);

        try {
            await api.post('/erp/produtos', {
                ...formData,
                peso_liquido: parseFloat(formData.peso_liquido) || 0,
                peso_bruto: parseFloat(formData.peso_bruto) || 0,
                custo_standard: parseFloat(formData.custo_standard) || 0,
                preco_venda: parseFloat(formData.preco_venda) || 0,
                lead_time_dias: parseInt(formData.lead_time_dias, 10) || 0
            });

            setModalSuccess(`Produto ${formData.codigo} cadastrado com sucesso no padrão Protheus!`);
            setTimeout(() => {
                setIsModalOpen(false);
                setFormData({
                    codigo: '', descricao: '', tipo: 'PA', unidade_medida: 'UN',
                    ncm: '', armazem_padrao: '01', origem: '0', peso_liquido: '', peso_bruto: '',
                    custo_standard: '', preco_venda: '', lead_time_dias: '5', status: 'ativo'
                });
                loadData();
            }, 1200);
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.erros?.join(', ') || err.message;
            setModalError(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 p-2 md:p-4 font-sans text-gray-900">
            {/* Top Bar Header */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
                        <Package className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                                Cadastro de Produtos (MATA010)
                            </h1>
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                Protheus Nativo
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                            Gestão de produtos, matérias-primas e componentes com geração automática de código e integridade de engenharia.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleOpenModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Produto (MATA010)
                    </button>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition shadow-sm"
                        title="Atualizar lista"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Cadastrado</span>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">
                            {(stats.produtos || 153322).toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Produtos Acabados (PA)</span>
                        <p className="text-xl font-bold text-emerald-600 mt-0.5">
                            {(46666).toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                        <Tag className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Intermediários (PI)</span>
                        <p className="text-xl font-bold text-amber-600 mt-0.5">
                            {(84089).toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
                        <Database className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Matéria-Prima (MP)</span>
                        <p className="text-xl font-bold text-slate-800 mt-0.5">
                            {(13805).toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por código, descrição ou NCM..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                        className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <select
                    value={tipoFilter}
                    onChange={(e) => { setTipoFilter(e.target.value); setPage(0); }}
                    className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Todos os Tipos Protheus</option>
                    <option value="PA">PA - Produto Acabado</option>
                    <option value="PI">PI - Produto Intermediário</option>
                    <option value="MP">MP - Matéria-Prima</option>
                    <option value="MC">MC - Material de Consumo</option>
                    <option value="SV">SV - Serviço</option>
                    <option value="EM">EM - Embalagem</option>
                    <option value="ME">ME - Mercadoria p/ Revenda</option>
                    <option value="GG">GG - Gastos Gerais</option>
                </select>
            </div>

            {/* Products Table Container */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-600">
                            <tr>
                                <th className="py-3 px-4">Código (B1_COD)</th>
                                <th className="py-3 px-4">Descrição (B1_DESC)</th>
                                <th className="py-3 px-4">Tipo</th>
                                <th className="py-3 px-4">U.M.</th>
                                <th className="py-3 px-4">Armazém</th>
                                <th className="py-3 px-4">NCM</th>
                                <th className="py-3 px-4 text-right">Peso Líq.</th>
                                <th className="py-3 px-4 text-right">Preço Venda</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="py-12 text-center text-gray-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                                        Carregando cadastro de produtos do Protheus...
                                    </td>
                                </tr>
                            ) : produtos.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="py-12 text-center text-gray-500">
                                        Nenhum produto encontrado com os filtros informados.
                                    </td>
                                </tr>
                            ) : (
                                produtos.map((p) => (
                                    <tr key={p.id || p.codigo} className="hover:bg-gray-50/80 transition group">
                                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                                            <Link
                                                to={`/estrutura/${encodeURIComponent(p.codigo)}`}
                                                state={{ from: '/erp/produtos' }}
                                                className="text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1.5 group/code"
                                                title="Abrir Estrutura Técnica do Produto (BOM)"
                                            >
                                                <span>{p.codigo}</span>
                                                <Layers className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover/code:opacity-100 transition-opacity" />
                                            </Link>
                                        </td>
                                        <td className="py-3.5 px-4 font-medium text-gray-900">
                                            {p.descricao}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 font-mono">
                                                {p.tipo}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-xs text-gray-600">
                                            {p.unidade_medida || 'UN'}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-xs text-gray-600">
                                            {p.armazem_padrao || '01'}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-xs text-gray-500">
                                            {p.ncm || '-'}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono text-gray-700">
                                            {p.peso_liquido ? `${parseFloat(p.peso_liquido).toFixed(3)} kg` : '-'}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-900">
                                            {p.preco_venda ? `R$ ${parseFloat(p.preco_venda).toFixed(2)}` : '-'}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                p.status === 'inativo' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                                            }`}>
                                                {p.status || 'ativo'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {/* Botão Estrutura (BOM) Tela Completa */}
                                                <Link
                                                    to={`/estrutura/${encodeURIComponent(p.codigo)}`}
                                                    state={{ from: '/erp/produtos' }}
                                                    className={`p-1.5 rounded-lg transition inline-flex items-center justify-center cursor-pointer ${
                                                        p.tem_estrutura
                                                            ? 'text-blue-700 bg-blue-50 hover:bg-blue-100 ring-1 ring-blue-200'
                                                            : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                                    }`}
                                                    title={p.tem_estrutura ? "Ver Estrutura Completa (BOM)" : "Abrir Estrutura Técnica"}
                                                >
                                                    <Layers className="w-4 h-4" />
                                                </Link>

                                                {/* Botão Pré-visualização Rápida no Modal */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenQuickStructure(p)}
                                                    className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition inline-flex items-center justify-center cursor-pointer"
                                                    title="Pré-visualizar Estrutura sem sair da página"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>

                                                {/* Botão Estoque e Saldos */}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedProductForStock(p)}
                                                    className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 ring-1 ring-emerald-200 rounded-lg transition inline-flex items-center justify-center cursor-pointer"
                                                    title="Ver Saldos e Movimentações de Estoque"
                                                >
                                                    <Database className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação Simples */}
                <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                    <div>
                        Exibindo {produtos.length} produtos (Página {page + 1})
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0 || loading}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1 font-semibold"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                        </button>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={produtos.length < limit || loading}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1 font-semibold"
                        >
                            Próxima <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Inclusão de Produto MATA010 com Código Automático */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden my-8">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-gray-900">Novo Produto (MATA010)</h2>
                                    <p className="text-xs text-gray-500">Filosofia de cadastro Protheus com código automático</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
                            {modalError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            {modalSuccess && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>{modalSuccess}</span>
                                </div>
                            )}

                            {/* SELEÇÃO OBRIGATÓRIA DE PREFIXO (MT2, MT3, MT4, SCL, ETC.) E CÓDIGO SEQUENCIAL */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                    {/* 1. Seleção de Prefixo */}
                                    <div className="sm:col-span-5">
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                            Prefixo do Código (Família) *
                                        </label>
                                        <select
                                            value={selectedPrefixo}
                                            onChange={(e) => handlePrefixoChange(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="MT2">MT2 - Componentes / Cabines (MT2)</option>
                                            <option value="MT3">MT3 - Conjuntos Soldados / Weldments (MT3)</option>
                                            <option value="MT4">MT4 - Perfis e Estruturas Maiores (MT4)</option>
                                            <option value="MT5">MT5 - Chaparias e Caldeiraria (MT5)</option>
                                            <option value="MT6">MT6 - Componentes Auxiliares (MT6)</option>
                                            <option value="SCL">SCL - Produtos Acabados Gerais (SCL)</option>
                                            <option value="MTA">MTA - Acessórios e Montagens (MTA)</option>
                                            <option value="MPT">MPT - Matérias-Primas Tratadas (MPT)</option>
                                            <option value="MTF">MTF - Ferramentais e Fixadores (MTF)</option>
                                            <option value="SEG">SEG - Itens de Segurança (SEG)</option>
                                            <option value="DIV">DIV - Diversos (DIV)</option>
                                            <option value="ESC">ESC - Escadas e Estruturas (ESC)</option>
                                            {availablePrefixos
                                                .filter(g => !['MT2', 'MT3', 'MT4', 'MT5', 'MT6', 'SCL', 'MTA', 'MPT', 'MTF', 'SEG', 'DIV', 'ESC'].includes(g.sigla))
                                                .map(g => (
                                                    <option key={g.sigla} value={g.sigla}>
                                                        {g.sigla} - {g.sigla} ({g.total} itens cadastrados)
                                                    </option>
                                                ))
                                            }
                                            <option value="OUTRO">+ Outro Prefixo Personalizado</option>
                                        </select>
                                    </div>

                                    {/* 2. Tipo do Produto */}
                                    <div className="sm:col-span-3">
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                            Tipo (B1_TIPO) *
                                        </label>
                                        <select
                                            value={formData.tipo}
                                            onChange={(e) => handleTipoChange(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-sm text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="PI">PI - Produto Intermediário</option>
                                            <option value="PA">PA - Produto Acabado</option>
                                            <option value="MP">MP - Matéria-Prima</option>
                                            <option value="MC">MC - Material de Consumo</option>
                                            <option value="SL">SL - Subconjunto</option>
                                            <option value="SV">SV - Serviço</option>
                                            <option value="EM">EM - Embalagem</option>
                                            <option value="ME">ME - Revenda</option>
                                        </select>
                                    </div>

                                    {/* 3. Código Gerado Automaticamente (Sequencial mín. 4 dígitos) */}
                                    <div className="sm:col-span-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                Código Gerado (B1_COD) *
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => fetchNextProductCode(selectedPrefixo)}
                                                disabled={generatingCode}
                                                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition"
                                                title="Recalcular próximo sequencial no banco de dados"
                                            >
                                                <Sparkles className={`w-3 h-3 ${generatingCode ? 'animate-spin' : ''}`} />
                                                {generatingCode ? 'Gerando...' : 'Recalcular'}
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ex: MT2-0001"
                                                value={formData.codigo}
                                                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                                                className="w-full bg-white border border-gray-300 rounded-lg pl-3 pr-20 py-2 text-sm text-gray-900 font-mono font-black focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase tracking-wide"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                                MÍN. 4 DIG.
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Campo customizado se selecionou "OUTRO" */}
                                {selectedPrefixo === 'OUTRO' && (
                                    <div className="flex items-center gap-2 p-2 bg-blue-50/70 border border-blue-200 rounded-lg animate-fadeIn">
                                        <span className="text-xs font-bold text-gray-700">Digite a Sigla/Prefixo Desejado:</span>
                                        <input
                                            type="text"
                                            placeholder="Ex: GAB, SUP, CJT"
                                            value={customPrefixo}
                                            onChange={(e) => setCustomPrefixo(e.target.value.toUpperCase().trim())}
                                            className="bg-white border border-gray-300 rounded px-2.5 py-1 text-xs font-mono font-bold uppercase w-32"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fetchNextProductCode(customPrefixo)}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
                                        >
                                            Aplicar Prefixo
                                        </button>
                                    </div>
                                )}

                                {/* Chips de Acesso Rápido para Prefixos Frequentes */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
                                    <span className="text-[11px] font-bold text-gray-500 uppercase mr-1">Prefixos Rápidos:</span>
                                    {['MT2', 'MT3', 'MT4', 'MT5', 'MT6', 'SCL', 'MPT', 'MTA', 'MTF'].map((sigla) => (
                                        <button
                                            key={sigla}
                                            type="button"
                                            onClick={() => handlePrefixoChange(sigla)}
                                            className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer border ${
                                                selectedPrefixo === sigla
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700'
                                            }`}
                                        >
                                            {sigla}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                    Descrição Completa (B1_DESC) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Descrição técnica detalhada da peça ou item"
                                    value={formData.descricao}
                                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Unidade (B1_UM) *
                                    </label>
                                    <select
                                        value={formData.unidade_medida}
                                        onChange={(e) => setFormData({ ...formData, unidade_medida: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="UN">UN - Unidade</option>
                                        <option value="PC">PC - Peça</option>
                                        <option value="KG">KG - Quilograma</option>
                                        <option value="MT">MT - Metro</option>
                                        <option value="M2">M2 - Metro Quadrado</option>
                                        <option value="M3">M3 - Metro Cúbico</option>
                                        <option value="L">L - Litro</option>
                                        <option value="CX">CX - Caixa</option>
                                        <option value="PR">PR - Par</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Armazém (B1_LOCPAD)
                                    </label>
                                    <select
                                        value={formData.armazem_padrao}
                                        onChange={(e) => setFormData({ ...formData, armazem_padrao: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="01">01 - Almoxarifado Central</option>
                                        <option value="99">99 - Chão de Fábrica / Linha</option>
                                        <option value="02">02 - Matéria-Prima</option>
                                        <option value="03">03 - Expedição</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        NCM (B1_POSIPI)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: 85177900"
                                        value={formData.ncm}
                                        onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Lead Time (Dias)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="5"
                                        value={formData.lead_time_dias}
                                        onChange={(e) => setFormData({ ...formData, lead_time_dias: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Peso Líq. (kg)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        placeholder="0.000"
                                        value={formData.peso_liquido}
                                        onChange={(e) => setFormData({ ...formData, peso_liquido: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Peso Bruto (kg)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        placeholder="0.000"
                                        value={formData.peso_bruto}
                                        onChange={(e) => setFormData({ ...formData, peso_bruto: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Custo Standard (R$)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formData.custo_standard}
                                        onChange={(e) => setFormData({ ...formData, custo_standard: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Preço Venda (R$)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formData.preco_venda}
                                        onChange={(e) => setFormData({ ...formData, preco_venda: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50"
                                >
                                    {saving ? 'Gravando no Protheus...' : 'Gravar Produto (MATA010)'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Pré-visualização Rápida da Estrutura (BOM) */}
            {quickStructureProduct && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
                        {/* Header do Modal */}
                        <div className="p-4 sm:p-5 bg-slate-50 border-b border-gray-200 flex items-center justify-between gap-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                                    <Layers className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-bold text-gray-900">
                                            Estrutura Técnica (BOM)
                                        </h2>
                                        <span className="px-2 py-0.5 text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                                            {quickStructureProduct.codigo}
                                        </span>
                                        <span className="px-2 py-0.5 text-xs font-mono bg-gray-100 text-gray-600 rounded">
                                            {quickStructureProduct.tipo}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                        {quickStructureProduct.descricao}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Link
                                    to={`/estrutura/${encodeURIComponent(quickStructureProduct.codigo)}`}
                                    state={{ from: '/erp/produtos' }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                    title="Abrir página completa com roteiros, custos e relatórios técnicos"
                                >
                                    <span>Tela Completa</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setQuickStructureProduct(null)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Corpo do Modal */}
                        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
                            {quickStructureLoading ? (
                                <div className="py-16 text-center text-gray-500">
                                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
                                    <p className="font-medium text-sm">Explodindo árvore de estrutura do produto...</p>
                                    <p className="text-xs text-gray-400 mt-1">Consultando componentes e matérias-primas no Protheus</p>
                                </div>
                            ) : quickStructureError ? (
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                                    <div>
                                        <p className="font-semibold">{quickStructureError}</p>
                                        <p className="text-xs text-amber-700 mt-0.5">
                                            Este item pode ser uma matéria-prima pura ou ainda não ter componentes cadastrados no SG1.
                                        </p>
                                    </div>
                                </div>
                            ) : quickStructureData.length === 0 ? (
                                <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                                    <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                    <p className="font-semibold text-gray-700">Nenhum componente cadastrado</p>
                                    <p className="text-xs text-gray-500 mt-1">Este produto não possui estrutura técnica (BOM) registrada no momento.</p>
                                    <div className="mt-4">
                                        <Link
                                            to={`/estrutura/${encodeURIComponent(quickStructureProduct.codigo)}`}
                                            state={{ from: '/erp/produtos' }}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Cadastrar Componentes na Tela Completa
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Métricas Resumidas */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-blue-50/60 border border-blue-100 p-3 rounded-xl">
                                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total Componentes</span>
                                            <p className="text-lg font-bold text-blue-900 mt-0.5">{quickStructureData.length}</p>
                                        </div>
                                        <div className="bg-emerald-50/60 border border-emerald-100 p-3 rounded-xl">
                                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Matéria-Prima (MP)</span>
                                            <p className="text-lg font-bold text-emerald-900 mt-0.5">
                                                {quickStructureData.filter(i => (i.tipo_produto || i.tipo) === 'MP').length}
                                            </p>
                                        </div>
                                        <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl">
                                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Subconjuntos (PI)</span>
                                            <p className="text-lg font-bold text-amber-900 mt-0.5">
                                                {quickStructureData.filter(i => (i.tipo_produto || i.tipo) === 'PI').length}
                                            </p>
                                        </div>
                                        <div className="bg-purple-50/60 border border-purple-100 p-3 rounded-xl">
                                            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Níveis da Árvore</span>
                                            <p className="text-lg font-bold text-purple-900 mt-0.5">
                                                {Math.max(...quickStructureData.map(i => i.nivel || 0)) + 1}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Tabela de Componentes */}
                                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-100/80 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                                                <tr>
                                                    <th className="py-2.5 px-3">Nível</th>
                                                    <th className="py-2.5 px-3">Código</th>
                                                    <th className="py-2.5 px-3">Descrição</th>
                                                    <th className="py-2.5 px-3 text-center">Tipo</th>
                                                    <th className="py-2.5 px-3 text-right">Qtd Necessária</th>
                                                    <th className="py-2.5 px-3 text-center">U.M.</th>
                                                    <th className="py-2.5 px-3 text-center">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {quickStructureData.map((item, idx) => {
                                                    const nivel = item.nivel || 0;
                                                    return (
                                                        <tr key={`${item.codigo}-${idx}`} className="hover:bg-blue-50/30 transition">
                                                            <td className="py-2 px-3 font-mono font-bold text-gray-500">
                                                                <span 
                                                                    style={{ marginLeft: `${nivel * 14}px` }}
                                                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                                                                        nivel === 0 ? 'bg-blue-100 text-blue-800 font-bold' :
                                                                        nivel === 1 ? 'bg-slate-100 text-slate-700' :
                                                                        'bg-gray-100 text-gray-600'
                                                                    }`}
                                                                >
                                                                    N{nivel}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-3 font-mono font-bold text-gray-900">
                                                                <Link
                                                                    to={`/estrutura/${encodeURIComponent(item.codigo)}`}
                                                                    state={{ from: '/erp/produtos' }}
                                                                    className="hover:text-blue-600 hover:underline"
                                                                >
                                                                    {item.codigo}
                                                                </Link>
                                                            </td>
                                                            <td className="py-2 px-3 text-gray-700">
                                                                {item.descricao}
                                                            </td>
                                                            <td className="py-2 px-3 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                                                                    (item.tipo_produto || item.tipo) === 'MP' ? 'bg-green-100 text-green-800' :
                                                                    (item.tipo_produto || item.tipo) === 'PI' ? 'bg-amber-100 text-amber-800' :
                                                                    (item.tipo_produto || item.tipo) === 'PA' ? 'bg-blue-100 text-blue-800' :
                                                                    'bg-gray-100 text-gray-700'
                                                                }`}>
                                                                    {item.tipo_produto || item.tipo || '-'}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                                                                {parseFloat(item.qtd_necessaria || 1).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                                            </td>
                                                            <td className="py-2 px-3 text-center font-mono text-gray-500">
                                                                {item.unidade || 'UN'}
                                                            </td>
                                                            <td className="py-2 px-3 text-center">
                                                                <Link
                                                                    to={`/estrutura/${encodeURIComponent(item.codigo)}`}
                                                                    state={{ from: '/erp/produtos' }}
                                                                    className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded inline-flex items-center"
                                                                    title="Abrir estrutura deste componente"
                                                                >
                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                </Link>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer do Modal */}
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
                            <span className="text-xs text-gray-500">
                                Fonte oficial: Engenharia Protheus (SG1010 / MATA200)
                            </span>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setQuickStructureProduct(null)}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition cursor-pointer"
                                >
                                    Fechar
                                </button>
                                <Link
                                    to={`/estrutura/${encodeURIComponent(quickStructureProduct.codigo)}`}
                                    state={{ from: '/erp/produtos' }}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                    Abrir Tela Completa de Engenharia
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Estoque e Movimentações (StockModal) */}
            <StockModal
                isOpen={!!selectedProductForStock}
                onClose={() => setSelectedProductForStock(null)}
                productCode={selectedProductForStock?.codigo}
                productName={selectedProductForStock?.descricao}
            />
        </div>
    );
}
