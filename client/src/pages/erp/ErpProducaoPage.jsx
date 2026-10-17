import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import {
    Factory, Plus, Search, RefreshCw, CheckCircle2, AlertCircle,
    Calendar, Layers, Tag, Box, AlertTriangle, ArrowRight,
    TrendingUp, Clock, X, FileText
} from 'lucide-react';

export default function ErpProducaoPage() {
    const [ordens, setOrdens] = useState([]);
    const [totalOps, setTotalOps] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 350);
    const [statusFilter, setStatusFilter] = useState('');
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalError, setModalError] = useState(null);
    const [modalSuccess, setModalSuccess] = useState(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const today = new Date().toISOString().split('T')[0];
    const initialForm = {
        numero_op: '',
        produto_codigo: '',
        quantidade_planejada: 1,
        pedido_venda: '',
        item_pedido: '',
        data_emissao: today,
        data_inicio_prevista: today,
        data_fim_prevista: today,
        prioridade: 'media',
        observacoes: ''
    };
    const [formData, setFormData] = useState(initialForm);

    // Product search & BOM preview inside modal
    const [prodQuery, setProdQuery] = useState('');
    const [prodOptions, setProdOptions] = useState([]);
    const [selectedProd, setSelectedProd] = useState(null);
    const [bomComponents, setBomComponents] = useState([]);
    const [loadingBom, setLoadingBom] = useState(false);

    const loadOrdens = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/erp/ordens-producao?search=${encodeURIComponent(debouncedSearch)}&status=${encodeURIComponent(statusFilter)}&limit=100`);
            setOrdens(res.data?.rows || []);
            setTotalOps(res.data?.total || 0);
        } catch (err) {
            console.error('Erro ao carregar ordens de produção:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrdens();
    }, [debouncedSearch, statusFilter]);

    // Busca de produto com debounce
    useEffect(() => {
        if (!prodQuery || prodQuery.length < 2) {
            setProdOptions([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await api.get(`/erp/produtos/lookup?q=${encodeURIComponent(prodQuery)}`);
                setProdOptions(res.data || []);
            } catch (err) {
                console.error('Erro no lookup de produtos:', err);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [prodQuery]);

    // Seleção de produto e carga da estrutura (BOM)
    const handleSelectProduct = async (prod) => {
        setSelectedProd(prod);
        setFormData(prev => ({ ...prev, produto_codigo: prod.codigo }));
        setProdQuery(prod.codigo);
        setProdOptions([]);

        // Buscar árvore de estrutura (BOM)
        setLoadingBom(true);
        try {
            const res = await api.get(`/erp/estruturas/${encodeURIComponent(prod.codigo)}`);
            setBomComponents(res.data || []);
        } catch (err) {
            console.error('Erro ao buscar BOM:', err);
            setBomComponents([]);
        } finally {
            setLoadingBom(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setModalError(null);
        setModalSuccess(null);

        try {
            const res = await api.post('/erp/ordens-producao', formData);
            setModalSuccess(res.data.message || 'Ordem de Produção aberta com sucesso!');
            setTimeout(() => {
                setIsModalOpen(false);
                setFormData(initialForm);
                setSelectedProd(null);
                setBomComponents([]);
                setProdQuery('');
                loadOrdens();
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
            {/* Top Bar Header Container */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
                        <Factory className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Ordens de Produção (MATA650)</h1>
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                ERP Nativo
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                            Abertura e controle de OPs integradas com explosão de BOM e regras Protheus.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadOrdens}
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
                        <Factory className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de OPs</span>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{totalOps.toLocaleString('pt-BR')}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Abertas (Planejadas)</span>
                        <p className="text-xl font-bold text-amber-600 mt-0.5">
                            {ordens.filter(o => o.status === 'aberta' || !o.status).length.toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Em Fabricação</span>
                        <p className="text-xl font-bold text-blue-600 mt-0.5">
                            {ordens.filter(o => o.status === 'em_producao' || o.status === 'em_andamento').length.toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Encerradas</span>
                        <p className="text-xl font-bold text-emerald-600 mt-0.5">
                            {ordens.filter(o => o.status === 'encerrada' || o.status === 'concluida').length.toLocaleString('pt-BR')}
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
                        placeholder="Buscar por Número de OP, Código do Produto, Descrição ou Pedido de Venda..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Todos os Status</option>
                    <option value="aberta">Abertas</option>
                    <option value="em_producao">Em Produção</option>
                    <option value="encerrada">Encerradas</option>
                    <option value="cancelada">Canceladas</option>
                </select>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-600">
                            <tr>
                                <th className="py-3 px-4">Número da OP</th>
                                <th className="py-3 px-4">Produto / Descrição</th>
                                <th className="py-3 px-4 text-right">Qtd Planejada</th>
                                <th className="py-3 px-4 text-right">Qtd Produzida</th>
                                <th className="py-3 px-4">Pedido / Item</th>
                                <th className="py-3 px-4">Emissão</th>
                                <th className="py-3 px-4">Previsão Fim</th>
                                <th className="py-3 px-4">Prioridade</th>
                                <th className="py-3 px-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="py-12 text-center text-gray-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                                        Carregando ordens de produção...
                                    </td>
                                </tr>
                            ) : ordens.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="py-12 text-center text-gray-500">
                                        Nenhuma ordem de produção encontrada.
                                    </td>
                                </tr>
                            ) : (
                                ordens.map((op) => (
                                    <tr key={op.id || op.numero_op} className="hover:bg-gray-50/80 transition">
                                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                                            {op.numero_op}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="font-semibold text-gray-900 font-mono">{op.produto_codigo}</div>
                                            <div className="text-xs text-gray-500">{op.produto_descricao || 'Produto do Catálogo'}</div>
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                                            {parseFloat(op.quantidade_planejada).toLocaleString('pt-BR')} <span className="text-xs text-gray-500 font-normal">{op.unidade_medida || 'UN'}</span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono text-emerald-600 font-bold">
                                            {parseFloat(op.quantidade_produzida || 0).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="py-3.5 px-4 text-xs font-mono text-gray-600">
                                            {op.pedido_venda ? `${op.pedido_venda}${op.item_pedido ? ` / ${op.item_pedido}` : ''}` : '-'}
                                        </td>
                                        <td className="py-3.5 px-4 text-xs text-gray-600 font-mono">
                                            {op.data_emissao ? String(op.data_emissao).split('T')[0] : '-'}
                                        </td>
                                        <td className="py-3.5 px-4 text-xs text-gray-600 font-mono">
                                            {op.data_fim_prevista ? String(op.data_fim_prevista).split('T')[0] : '-'}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                op.prioridade === 'urgente' ? 'bg-red-50 text-red-700 border border-red-200' :
                                                op.prioridade === 'alta' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                'bg-gray-100 text-gray-700 border border-gray-200'
                                            }`}>
                                                {op.prioridade || 'media'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                op.status === 'cancelada' ? 'bg-red-50 text-red-700 border border-red-200' :
                                                op.status === 'encerrada' || op.status === 'concluida' ? 'bg-green-50 text-green-700 border border-green-200' :
                                                op.status === 'em_producao' || op.status === 'em_andamento' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                'bg-amber-50 text-amber-700 border border-amber-200'
                                            }`}>
                                                {op.status || 'aberta'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Abertura de OP (MATA650) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl overflow-hidden my-8">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Factory className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-gray-900">Nova Ordem de Produção (MATA650)</h2>
                                    <p className="text-xs text-gray-500">
                                        Validação de produto fabricável, geração de número de OP e explosão de BOM.
                                    </p>
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
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

                            {/* Seleção do Produto Fabricável */}
                            <div className="relative">
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                    Produto a Fabricar * (PA / PI)
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        placeholder="Digite o código ou descrição do produto..."
                                        value={prodQuery}
                                        onChange={(e) => {
                                            setProdQuery(e.target.value);
                                            setSelectedProd(null);
                                        }}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {selectedProd && (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                                            {selectedProd.tipo} | {selectedProd.unidade_medida}
                                        </span>
                                    )}
                                </div>

                                {/* Autocomplete Dropdown */}
                                {prodOptions.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 max-h-52 overflow-y-auto">
                                        {prodOptions.map((p, idx) => (
                                            <div
                                                key={`${p.codigo}-${idx}`}
                                                onClick={() => handleSelectProduct(p)}
                                                className="p-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-none flex items-center justify-between"
                                            >
                                                <div>
                                                    <div className="font-bold text-gray-900 text-sm font-mono">{p.codigo}</div>
                                                    <div className="text-xs text-gray-500">{p.descricao}</div>
                                                </div>
                                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                                                    {p.tipo}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Visualização de Explosão da BOM */}
                            {selectedProd && (
                                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                                            Explosão de Estrutura (BOM Protheus)
                                        </span>
                                        <span className="text-xs text-gray-500 font-mono">
                                            {bomComponents.length} componente(s)
                                        </span>
                                    </div>

                                    {loadingBom ? (
                                        <p className="text-xs text-gray-500 italic py-1">Consultando componentes da engenharia...</p>
                                    ) : bomComponents.length === 0 ? (
                                        <p className="text-xs text-amber-700 py-1 flex items-center gap-1.5 bg-amber-50 p-2 rounded border border-amber-200">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                            Este produto não possui vínculos cadastrados na tabela de estruturas (BOM).
                                        </p>
                                    ) : (
                                        <div className="max-h-36 overflow-y-auto space-y-1">
                                            {bomComponents.map((b, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-white border border-gray-200">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-blue-700">{b.produto_filho_codigo}</span>
                                                        <span className="text-gray-600 truncate max-w-[220px]">{b.componente_descricao || '-'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 font-mono">
                                                        <span className="text-gray-700">Qtd: {b.quantidade} {b.unidade}</span>
                                                        <span className={`text-[11px] px-1.5 py-0.2 rounded font-semibold ${
                                                            b.saldo_estoque > 0 ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'
                                                        }`}>
                                                            Estoque: {b.saldo_estoque}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Quantidade e Número da OP */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Número da OP
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Automático (OP-xxxxxx)"
                                        value={formData.numero_op}
                                        onChange={(e) => setFormData({ ...formData, numero_op: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Quantidade Planejada *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0.001"
                                        step="any"
                                        value={formData.quantidade_planejada}
                                        onChange={(e) => setFormData({ ...formData, quantidade_planejada: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Prioridade
                                    </label>
                                    <select
                                        value={formData.prioridade}
                                        onChange={(e) => setFormData({ ...formData, prioridade: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="baixa">Baixa</option>
                                        <option value="media">Média (Normal)</option>
                                        <option value="alta">Alta</option>
                                        <option value="urgente">Urgente</option>
                                    </select>
                                </div>
                            </div>

                            {/* Vínculo Comercial: Pedido e Item */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Pedido de Venda (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: PED-000001 ou 004523"
                                        value={formData.pedido_venda}
                                        onChange={(e) => setFormData({ ...formData, pedido_venda: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Item do Pedido
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="01"
                                        value={formData.item_pedido}
                                        onChange={(e) => setFormData({ ...formData, item_pedido: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Datas: Emissão, Início e Previsão Fim */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Data de Emissão *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.data_emissao}
                                        onChange={(e) => setFormData({ ...formData, data_emissao: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Início Previsto
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.data_inicio_prevista}
                                        onChange={(e) => setFormData({ ...formData, data_inicio_prevista: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Entrega / Fim Previsto
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.data_fim_prevista}
                                        onChange={(e) => setFormData({ ...formData, data_fim_prevista: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Observações */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                    Observações da Produção
                                </label>
                                <textarea
                                    rows="2"
                                    placeholder="Instruções de fabricação, corte, dobra ou acabamento..."
                                    value={formData.observacoes}
                                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
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
                                    disabled={saving || !selectedProd}
                                    className="px-6 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? 'Abrindo OP...' : 'Abrir Ordem de Produção'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
