import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getEstruturaProduto } from '../../services/api';
import StockModal from '../../components/StockModal';
import { useDebounce } from '../../hooks/useDebounce';
import { 
    Package, Plus, Search, RefreshCw, Layers, CheckCircle2, AlertCircle, 
    ArrowDownToLine, Tag, DollarSign, Scale, X, Database, Sparkles, 
    Clock, Building2, ShieldCheck, ChevronLeft, ChevronRight, Hash,
    Eye, ExternalLink, Box, FileText, Check, Camera, Image, Paperclip,
    FileCode, Upload, Download, Trash2, Edit2, ZoomIn
} from 'lucide-react';

export default function ErpProdutosPage() {
    const [produtos, setProdutos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 350);
    const [tipoFilter, setTipoFilter] = useState('');
    const [stats, setStats] = useState({ produtos: 0, pa: 0, pi: 0, mp: 0, clientes: 0, fornecedores: 0, pedidos: 0, ops_ativas: 0 });
    const [page, setPage] = useState(0);
    const limit = 50;

    // Modal de Estoque e Saldos
    const [selectedProductForStock, setSelectedProductForStock] = useState(null);

    // Modal de Pré-visualização Rápida da Estrutura (BOM)
    const [quickStructureProduct, setQuickStructureProduct] = useState(null);
    const [quickStructureLoading, setQuickStructureLoading] = useState(false);
    const [quickStructureData, setQuickStructureData] = useState([]);
    const [quickStructureError, setQuickStructureError] = useState(null);

    // Modal de Zoom da Imagem do Produto
    const [previewImage, setPreviewImage] = useState(null);

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
    const [isEditing, setIsEditing] = useState(false);
    const [modalError, setModalError] = useState(null);
    const [modalSuccess, setModalSuccess] = useState(null);
    const [saving, setSaving] = useState(false);
    const [generatingCode, setGeneratingCode] = useState(false);

    // Form state com campos completos Protheus (SB1)
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
        status: 'ativo',
        foto_url: '',
        desenho_url: '',
        desenho_nome: '',
        desenho_tipo: '',
        b1_xrevm: '0',
        b1_xproc1: '',
        b1_xrevc: '0'
    });

    // Helper para converter string decimal (com vírgula ou ponto) em float seguro
    const parseDecimal = (val) => {
        if (val === null || val === undefined || val === '') return 0;
        const str = String(val).trim().replace(/\s/g, '').replace(',', '.');
        const parsed = parseFloat(str);
        return isNaN(parsed) ? 0 : parsed;
    };

    // Helper para permitir digitação natural de números com vírgula ou ponto no Brasil
    const handleDecimalChange = (field, value) => {
        let cleaned = value.replace(/[^0-9.,]/g, '');
        const matches = cleaned.match(/[.,]/g);
        if (matches && matches.length > 1) {
            let first = true;
            cleaned = cleaned.replace(/[.,]/g, (match) => {
                if (first) {
                    first = false;
                    return match;
                }
                return '';
            });
        }
        setFormData(prev => ({ ...prev, [field]: cleaned }));
    };

    // Upload da foto do produto (Base64)
    const handleFotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('A foto deve ter no máximo 5MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            setFormData(prev => ({ ...prev, foto_url: event.target.result }));
        };
        reader.readAsDataURL(file);
    };

    // Upload de desenho técnico (PDF, DWG, DXF)
    const handleDesenhoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 25 * 1024 * 1024) {
            alert('O arquivo de desenho deve ter no máximo 25MB.');
            return;
        }
        const ext = file.name.split('.').pop().toLowerCase();
        let tipo = 'outro';
        if (ext === 'pdf') tipo = 'pdf';
        else if (ext === 'dwg') tipo = 'dwg';
        else if (ext === 'dxf') tipo = 'dxf';
        else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) tipo = 'image';

        const reader = new FileReader();
        reader.onload = (event) => {
            setFormData(prev => ({
                ...prev,
                desenho_url: event.target.result,
                desenho_nome: file.name,
                desenho_tipo: tipo
            }));
        };
        reader.readAsDataURL(file);
    };

    // Visualizar ou baixar desenho técnico
    const handleOpenDrawing = (p) => {
        if (!p.desenho_url) return;
        if (p.desenho_url.startsWith('data:')) {
            const parts = p.desenho_url.split(',');
            const byteCharacters = atob(parts[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const mime = p.desenho_tipo === 'pdf' ? 'application/pdf' : 'application/octet-stream';
            const blob = new Blob([byteArray], { type: mime });
            const blobUrl = URL.createObjectURL(blob);
            
            if (p.desenho_tipo === 'pdf') {
                window.open(blobUrl, '_blank');
            } else {
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = p.desenho_nome || `${p.codigo}-desenho.${p.desenho_tipo || 'dwg'}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        } else {
            window.open(p.desenho_url, '_blank');
        }
    };

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
        fetchCadastrosBasicos();
    }, [debouncedSearch, tipoFilter, page]);

    // Cadastros Básicos (Prefixos, Tipos, Unidades e Armazéns)
    const [cadastrosBasicos, setCadastrosBasicos] = useState({
        prefixos: [],
        tipos: [],
        unidades: [],
        armazens: []
    });

    const fetchCadastrosBasicos = async () => {
        try {
            const res = await api.get('/cadastros-basicos/todos');
            if (res.data) {
                setCadastrosBasicos(res.data);
            }
        } catch (err) {
            console.warn('Falha ao carregar cadastros básicos unificados:', err);
        }
    };

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

    // Função para gerar automaticamente o próximo código com base no prefixo (mínimo 4 dígitos)
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

    // Ao abrir o modal para criação de novo produto
    const handleOpenCreateModal = () => {
        setIsEditing(false);
        setFormData({
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
            status: 'ativo',
            foto_url: '',
            desenho_url: '',
            desenho_nome: '',
            desenho_tipo: '',
            b1_xrevm: '0',
            b1_xproc1: '',
            b1_xrevc: '0'
        });
        setModalError(null);
        setModalSuccess(null);
        setIsModalOpen(true);
        fetchCadastrosBasicos();
        fetchAvailablePrefixos();
        fetchNextProductCode(selectedPrefixo);
    };

    // Ao abrir o modal para edição de produto existente
    const handleOpenEditModal = (p) => {
        setIsEditing(true);
        setFormData({
            codigo: p.codigo || '',
            descricao: p.descricao || '',
            tipo: p.tipo || 'PA',
            unidade_medida: p.unidade_medida || 'UN',
            ncm: p.ncm || '',
            armazem_padrao: p.armazem_padrao || '01',
            origem: p.origem || '0',
            peso_liquido: p.peso_liquido !== undefined && p.peso_liquido !== null ? String(p.peso_liquido).replace('.', ',') : '',
            peso_bruto: p.peso_bruto !== undefined && p.peso_bruto !== null ? String(p.peso_bruto).replace('.', ',') : '',
            custo_standard: p.custo_standard !== undefined && p.custo_standard !== null ? String(p.custo_standard).replace('.', ',') : '',
            preco_venda: p.preco_venda !== undefined && p.preco_venda !== null ? String(p.preco_venda).replace('.', ',') : '',
            lead_time_dias: p.lead_time_dias !== undefined && p.lead_time_dias !== null ? String(p.lead_time_dias) : '5',
            status: p.status || 'ativo',
            foto_url: p.foto_url || '',
            desenho_url: p.desenho_url || '',
            desenho_nome: p.desenho_nome || '',
            desenho_tipo: p.desenho_tipo || '',
            b1_xrevm: p.b1_xrevm !== undefined && p.b1_xrevm !== null && String(p.b1_xrevm).trim() !== '' ? String(p.b1_xrevm) : '0',
            b1_xproc1: p.b1_xproc1 || '',
            b1_xrevc: p.b1_xrevc !== undefined && p.b1_xrevc !== null && String(p.b1_xrevc).trim() !== '' ? String(p.b1_xrevc) : '0'
        });
        setModalError(null);
        setModalSuccess(null);
        setIsModalOpen(true);
        fetchCadastrosBasicos();
    };

    // Ao mudar o tipo no formulário
    const handleTipoChange = (newTipo) => {
        setFormData(prev => ({ ...prev, tipo: newTipo }));
    };

    const handleSaveProduct = async (e) => {
        e.preventDefault();
        setSaving(true);
        setModalError(null);
        setModalSuccess(null);

        const payload = {
            ...formData,
            peso_liquido: parseDecimal(formData.peso_liquido),
            peso_bruto: parseDecimal(formData.peso_bruto),
            custo_standard: parseDecimal(formData.custo_standard),
            preco_venda: parseDecimal(formData.preco_venda),
            lead_time_dias: parseInt(formData.lead_time_dias, 10) || 0
        };

        try {
            if (isEditing) {
                await api.put(`/erp/produtos/${encodeURIComponent(formData.codigo)}`, payload);
                setModalSuccess(`Produto ${formData.codigo} atualizado com sucesso!`);
            } else {
                await api.post('/erp/produtos', payload);
                setModalSuccess(`Produto ${formData.codigo} cadastrado com sucesso!`);
            }

            setTimeout(() => {
                setIsModalOpen(false);
                setFormData({
                    codigo: '', descricao: '', tipo: 'PA', unidade_medida: 'UN',
                    ncm: '', armazem_padrao: '01', origem: '0', peso_liquido: '', peso_bruto: '',
                    custo_standard: '', preco_venda: '', lead_time_dias: '5', status: 'ativo',
                    foto_url: '', desenho_url: '', desenho_nome: '', desenho_tipo: ''
                });
                loadData();
            }, 1000);
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
                                Cadastro de Produtos
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
                        onClick={handleOpenCreateModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Produto
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
                <button
                    type="button"
                    onClick={() => { setTipoFilter(''); setPage(0); }}
                    className={`bg-white p-4 rounded-xl shadow-sm border transition text-left flex items-center gap-3 cursor-pointer ${
                        tipoFilter === '' ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20' : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Cadastrado</span>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">
                            {(stats.produtos ?? 0).toLocaleString('pt-BR')}
                        </p>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => { setTipoFilter('PA'); setPage(0); }}
                    className={`bg-white p-4 rounded-xl shadow-sm border transition text-left flex items-center gap-3 cursor-pointer ${
                        tipoFilter === 'PA' ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20' : 'border-gray-200 hover:border-emerald-300'
                    }`}
                >
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Produtos Acabados (PA)</span>
                        <p className="text-xl font-bold text-emerald-600 mt-0.5">
                            {(stats.pa ?? 0).toLocaleString('pt-BR')}
                        </p>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => { setTipoFilter('PI'); setPage(0); }}
                    className={`bg-white p-4 rounded-xl shadow-sm border transition text-left flex items-center gap-3 cursor-pointer ${
                        tipoFilter === 'PI' ? 'border-amber-500 ring-2 ring-amber-100 bg-amber-50/20' : 'border-gray-200 hover:border-amber-300'
                    }`}
                >
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                        <Tag className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Intermediários (PI)</span>
                        <p className="text-xl font-bold text-amber-600 mt-0.5">
                            {(stats.pi ?? 0).toLocaleString('pt-BR')}
                        </p>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => { setTipoFilter('MP'); setPage(0); }}
                    className={`bg-white p-4 rounded-xl shadow-sm border transition text-left flex items-center gap-3 cursor-pointer ${
                        tipoFilter === 'MP' ? 'border-slate-500 ring-2 ring-slate-100 bg-slate-50/50' : 'border-gray-200 hover:border-slate-300'
                    }`}
                >
                    <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
                        <Database className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Matéria-Prima (MP)</span>
                        <p className="text-xl font-bold text-slate-800 mt-0.5">
                            {(stats.mp ?? 0).toLocaleString('pt-BR')}
                        </p>
                    </div>
                </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por código, descrição, ref. cliente, revisão ou NCM..."
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
                                <th className="py-3 px-3 text-center">Rev. Prod.</th>
                                <th className="py-3 px-3">Ref. Cliente</th>
                                <th className="py-3 px-3 text-center">Rev. Cli.</th>
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
                                    <td colSpan="13" className="py-12 text-center text-gray-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                                        Carregando cadastro de produtos do Protheus...
                                    </td>
                                </tr>
                            ) : produtos.length === 0 ? (
                                <tr>
                                    <td colSpan="13" className="py-12 text-center text-gray-500">
                                        Nenhum produto encontrado com os filtros informados.
                                    </td>
                                </tr>
                            ) : (
                                produtos.map((p) => (
                                    <tr key={p.id || p.codigo} className="hover:bg-gray-50/80 transition group">
                                        <td className="py-3 px-4 font-mono font-bold text-blue-700">
                                            <div className="flex items-center gap-3">
                                                {/* Thumbnail da Foto com preview */}
                                                {p.foto_url ? (
                                                    <div
                                                        onClick={() => setPreviewImage(p.foto_url)}
                                                        className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 bg-white shrink-0 shadow-xs cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all flex items-center justify-center group/thumb"
                                                        title="Clique para ampliar foto"
                                                    >
                                                        <img src={p.foto_url} alt={p.codigo} className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform" />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg border border-dashed border-gray-200 bg-gray-50 shrink-0 flex items-center justify-center text-gray-400">
                                                        <Package className="w-5 h-5 text-gray-300" />
                                                    </div>
                                                )}

                                                <div>
                                                    <Link
                                                        to={`/estrutura/${encodeURIComponent(p.codigo)}`}
                                                        state={{ from: '/erp/produtos' }}
                                                        className="text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1.5 group/code"
                                                        title="Abrir Estrutura Técnica do Produto (BOM)"
                                                    >
                                                        <span>{p.codigo}</span>
                                                        <Layers className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover/code:opacity-100 transition-opacity" />
                                                    </Link>

                                                    {/* Badge de Desenho Técnico se existir */}
                                                    {p.desenho_url && (
                                                        <div className="mt-0.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenDrawing(p)}
                                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                                                                    p.desenho_tipo === 'pdf' ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' :
                                                                    p.desenho_tipo === 'dwg' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200' :
                                                                    p.desenho_tipo === 'dxf' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' :
                                                                    'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                                                                }`}
                                                                title={`Abrir/Baixar Desenho: ${p.desenho_nome || 'Arquivo Técnico'}`}
                                                            >
                                                                <FileCode className="w-3 h-3" />
                                                                <span>{p.desenho_tipo || 'DESENHO'}</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-3 text-center">
                                            <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200" title="Revisão Interna do Produto (C6_XREVM / B1_XREVM)">
                                                {p.b1_xrevm || '0'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-3">
                                            {p.b1_xproc1 ? (
                                                <span className="px-2 py-0.5 rounded font-mono font-semibold text-xs bg-amber-50 text-amber-900 border border-amber-200" title="Número do Desenho / Referência do Cliente">
                                                    {p.b1_xproc1}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 font-mono text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-3 text-center">
                                            <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-purple-50 text-purple-700 border border-purple-200" title="Revisão do Desenho do Cliente">
                                                {p.b1_xrevc || '0'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 font-medium text-gray-900">
                                            {p.descricao}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <button
                                                type="button"
                                                onClick={() => { setTipoFilter(p.tipo); setPage(0); }}
                                                className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 font-mono transition cursor-pointer"
                                                title={`Filtrar por Tipo ${p.tipo}`}
                                            >
                                                {p.tipo}
                                            </button>
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
                                                {/* Botão Editar Produto */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditModal(p)}
                                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition inline-flex items-center justify-center cursor-pointer"
                                                    title="Editar Produto, Foto e Desenho Técnico"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>

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

            {/* Modal de Inclusão de Produto com Código Automático */}
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
                                    <h2 className="text-base font-bold text-gray-900">
                                        {isEditing ? `Editar Produto: ${formData.codigo}` : 'Novo Produto'}
                                    </h2>
                                    <p className="text-xs text-gray-500">
                                        {isEditing ? 'Atualização cadastral, fotos e desenhos de engenharia' : 'Filosofia de cadastro Protheus com código automático'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link
                                    to="/cadastros/basicos"
                                    target="_blank"
                                    className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition flex items-center gap-1"
                                    title="Abrir módulo de Cadastros Básicos em nova aba"
                                >
                                    <Database className="w-3.5 h-3.5" />
                                    <span>Cadastros Básicos</span>
                                </Link>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
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
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                Prefixo do Código (Família) *
                                            </label>
                                            <Link
                                                to="/cadastros/basicos?tab=prefixos"
                                                target="_blank"
                                                className="text-[10px] text-blue-600 hover:underline"
                                            >
                                                + Configurar
                                            </Link>
                                        </div>
                                        <select
                                            value={selectedPrefixo}
                                            onChange={(e) => handlePrefixoChange(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {cadastrosBasicos.prefixos && cadastrosBasicos.prefixos.length > 0 ? (
                                                cadastrosBasicos.prefixos.map(p => (
                                                    <option key={p.sigla} value={p.sigla}>
                                                        {p.sigla} - {p.descricao}
                                                    </option>
                                                ))
                                            ) : (
                                                <>
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
                                                </>
                                            )}
                                            {availablePrefixos
                                                .filter(g => !['MT2', 'MT3', 'MT4', 'MT5', 'MT6', 'SCL', 'MTA', 'MPT', 'MTF', 'SEG', 'DIV', 'ESC'].includes(g.sigla) && !cadastrosBasicos.prefixos?.some(p => p.sigla === g.sigla))
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
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                Tipo (B1_TIPO) *
                                            </label>
                                            <Link
                                                to="/cadastros/basicos?tab=tipos"
                                                target="_blank"
                                                className="text-[10px] text-blue-600 hover:underline"
                                            >
                                                + Tipos
                                            </Link>
                                        </div>
                                        <select
                                            value={formData.tipo}
                                            onChange={(e) => handleTipoChange(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-sm text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {cadastrosBasicos.tipos && cadastrosBasicos.tipos.length > 0 ? (
                                                cadastrosBasicos.tipos.map(t => (
                                                    <option key={t.codigo} value={t.codigo}>
                                                        {t.codigo} - {t.descricao}
                                                    </option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="PI">PI - Produto Intermediário</option>
                                                    <option value="PA">PA - Produto Acabado</option>
                                                    <option value="MP">MP - Matéria-Prima</option>
                                                    <option value="MC">MC - Material de Consumo</option>
                                                    <option value="SL">SL - Subconjunto</option>
                                                    <option value="SV">SV - Serviço</option>
                                                    <option value="EM">EM - Embalagem</option>
                                                    <option value="ME">ME - Revenda</option>
                                                </>
                                            )}
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
                                    {(cadastrosBasicos.prefixos && cadastrosBasicos.prefixos.length > 0
                                        ? cadastrosBasicos.prefixos.filter(p => p.rapido === 1 || p.rapido === true).map(p => p.sigla)
                                        : ['MT2', 'MT3', 'MT4', 'MT5', 'MT6', 'SCL', 'MPT', 'MTA', 'MTF']
                                    ).map((sigla) => (
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

                            {/* REVISÃO DO PRODUTO (C6_XREVM), NÚMERO DO DESENHO (REF. CLIENTE) E REVISÃO DO CLIENTE */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                        Revisão do Produto (C6_XREVM)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="0"
                                        value={formData.b1_xrevm}
                                        onChange={(e) => setFormData({ ...formData, b1_xrevm: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-[10px] text-gray-400 mt-0.5 block">Padrão: 0</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                        Ref. Cliente (Desenho do Cliente)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: DES-10492 / REF-001"
                                        value={formData.b1_xproc1}
                                        onChange={(e) => setFormData({ ...formData, b1_xproc1: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-[10px] text-gray-400 mt-0.5 block">Cód. / Desenho cliente</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                        Rev. Cliente (Revisão do Cliente)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="0"
                                        value={formData.b1_xrevc}
                                        onChange={(e) => setFormData({ ...formData, b1_xrevc: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-[10px] text-gray-400 mt-0.5 block">Padrão: 0</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Unidade (B1_UM) *
                                        </label>
                                        <Link
                                            to="/cadastros/basicos?tab=unidades"
                                            target="_blank"
                                            className="text-[10px] text-blue-600 hover:underline"
                                        >
                                            + UMs
                                        </Link>
                                    </div>
                                    <select
                                        value={formData.unidade_medida}
                                        onChange={(e) => setFormData({ ...formData, unidade_medida: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {cadastrosBasicos.unidades && cadastrosBasicos.unidades.length > 0 ? (
                                            cadastrosBasicos.unidades.map(u => (
                                                <option key={u.codigo} value={u.codigo}>
                                                    {u.codigo} - {u.descricao}
                                                </option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="UN">UN - Unidade</option>
                                                <option value="PC">PC - Peça</option>
                                                <option value="KG">KG - Quilograma</option>
                                                <option value="MT">MT - Metro</option>
                                                <option value="M2">M2 - Metro Quadrado</option>
                                                <option value="M3">M3 - Metro Cúbico</option>
                                                <option value="L">L - Litro</option>
                                                <option value="CX">CX - Caixa</option>
                                                <option value="PR">PR - Par</option>
                                            </>
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Armazém (B1_LOCPAD)
                                        </label>
                                        <Link
                                            to="/cadastros/basicos?tab=armazens"
                                            target="_blank"
                                            className="text-[10px] text-blue-600 hover:underline"
                                        >
                                            + Armazéns
                                        </Link>
                                    </div>
                                    <select
                                        value={formData.armazem_padrao}
                                        onChange={(e) => setFormData({ ...formData, armazem_padrao: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {cadastrosBasicos.armazens && cadastrosBasicos.armazens.length > 0 ? (
                                            cadastrosBasicos.armazens.map(a => (
                                                <option key={a.codigo} value={a.codigo}>
                                                    {a.codigo} - {a.descricao}
                                                </option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="01">01 - Almoxarifado Central</option>
                                                <option value="99">99 - Chão de Fábrica / Linha</option>
                                                <option value="02">02 - Matéria-Prima</option>
                                                <option value="03">03 - Expedição</option>
                                            </>
                                        )}
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

                            {/* 4 Campos Numéricos com suporte total a decimais */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Peso Líq. (kg)
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,000"
                                        value={formData.peso_liquido}
                                        onChange={(e) => handleDecimalChange('peso_liquido', e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Peso Bruto (kg)
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,000"
                                        value={formData.peso_bruto}
                                        onChange={(e) => handleDecimalChange('peso_bruto', e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Custo Standard (R$)
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        value={formData.custo_standard}
                                        onChange={(e) => handleDecimalChange('custo_standard', e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Preço Venda (R$)
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        value={formData.preco_venda}
                                        onChange={(e) => handleDecimalChange('preco_venda', e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* SEÇÃO: FOTO DO PRODUTO E ANEXO DE DESENHO TÉCNICO (PDF / DWG / DXF) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                {/* 1. Foto do Produto */}
                                <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <Camera className="w-4 h-4 text-blue-600" />
                                                Foto do Produto
                                            </label>
                                            {formData.foto_url && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, foto_url: '' }))}
                                                    className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    Remover Foto
                                                </button>
                                            )}
                                        </div>

                                        {formData.foto_url ? (
                                            <div className="relative group w-full h-32 bg-white border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
                                                <img
                                                    src={formData.foto_url}
                                                    alt="Foto do Produto"
                                                    className="max-h-full max-w-full object-contain"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewImage(formData.foto_url)}
                                                        className="p-1.5 bg-white text-gray-900 rounded-lg shadow text-xs font-semibold flex items-center gap-1 hover:bg-gray-100"
                                                    >
                                                        <ZoomIn className="w-3.5 h-3.5" />
                                                        Ampliar
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-white hover:bg-blue-50/50 hover:border-blue-400 transition group">
                                                <div className="flex flex-col items-center justify-center pt-2.5 pb-2.5 text-center px-2">
                                                    <div className="p-2 bg-blue-50 rounded-full text-blue-600 mb-1 group-hover:scale-110 transition-transform">
                                                        <Upload className="w-4 h-4" />
                                                    </div>
                                                    <p className="text-xs font-medium text-gray-700">Clique para enviar foto</p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">PNG, JPG ou WEBP (máx. 5MB)</p>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={handleFotoUpload}
                                                />
                                            </label>
                                        )}
                                    </div>

                                    {/* Campo alternativo de URL direta */}
                                    <div className="mt-2">
                                        <input
                                            type="text"
                                            placeholder="Ou cole a URL da imagem (https://...)"
                                            value={formData.foto_url?.startsWith('data:') ? '' : formData.foto_url}
                                            onChange={(e) => setFormData(prev => ({ ...prev, foto_url: e.target.value }))}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* 2. Desenho Técnico (PDF / DWG / DXF) */}
                                <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <FileCode className="w-4 h-4 text-indigo-600" />
                                                Desenho Técnico (PDF / DWG / DXF)
                                            </label>
                                            {formData.desenho_url && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, desenho_url: '', desenho_nome: '', desenho_tipo: '' }))}
                                                    className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    Remover Desenho
                                                </button>
                                            )}
                                        </div>

                                        {formData.desenho_url ? (
                                            <div className="w-full h-32 bg-white border border-gray-200 rounded-lg p-2.5 flex flex-col justify-between shadow-inner">
                                                <div className="flex items-start gap-2.5">
                                                    <div className={`p-2 rounded-lg text-white font-bold text-xs uppercase ${
                                                        formData.desenho_tipo === 'pdf' ? 'bg-red-600' :
                                                        formData.desenho_tipo === 'dwg' ? 'bg-blue-600' :
                                                        formData.desenho_tipo === 'dxf' ? 'bg-emerald-600' : 'bg-indigo-600'
                                                    }`}>
                                                        {formData.desenho_tipo?.toUpperCase() || 'ARQ'}
                                                    </div>
                                                    <div className="overflow-hidden flex-1">
                                                        <p className="text-xs font-bold text-gray-900 truncate" title={formData.desenho_nome}>
                                                            {formData.desenho_nome || 'Desenho do Produto'}
                                                        </p>
                                                        <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded text-[10px] font-mono uppercase">
                                                            Formato {formData.desenho_tipo?.toUpperCase() || 'Engenharia'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 pt-1.5 border-t border-gray-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDrawing(formData)}
                                                        className="flex-1 py-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                        Visualizar / Baixar Desenho
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-white hover:bg-indigo-50/50 hover:border-indigo-400 transition group">
                                                <div className="flex flex-col items-center justify-center pt-2.5 pb-2.5 text-center px-2">
                                                    <div className="p-2 bg-indigo-50 rounded-full text-indigo-600 mb-1 group-hover:scale-110 transition-transform">
                                                        <Paperclip className="w-4 h-4" />
                                                    </div>
                                                    <p className="text-xs font-medium text-gray-700">Anexar Desenho Técnico</p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">.PDF, .DWG ou .DXF (máx. 25MB)</p>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept=".pdf,.dwg,.dxf,image/*"
                                                    className="hidden"
                                                    onChange={handleDesenhoUpload}
                                                />
                                            </label>
                                        )}
                                    </div>

                                    {/* Campo alternativo de URL direta */}
                                    <div className="mt-2">
                                        <input
                                            type="text"
                                            placeholder="Ou link para o desenho (SharePoint, Drive, etc.)"
                                            value={formData.desenho_url?.startsWith('data:') ? '' : formData.desenho_url}
                                            onChange={(e) => {
                                                const url = e.target.value;
                                                const ext = url.split('.').pop()?.split(/[?#]/)[0]?.toLowerCase();
                                                setFormData(prev => ({
                                                    ...prev,
                                                    desenho_url: url,
                                                    desenho_nome: url ? (url.split('/').pop()?.split(/[?#]/)[0] || 'desenho-externo') : '',
                                                    desenho_tipo: ['pdf', 'dwg', 'dxf'].includes(ext) ? ext : 'outro'
                                                }));
                                            }}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
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
                                    className="px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Salvando...</span>
                                        </>
                                    ) : (
                                        <span>{isEditing ? 'Atualizar Produto' : 'Gravar Produto'}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Zoom da Foto do Produto */}
            {previewImage && (
                <div 
                    onClick={() => setPreviewImage(null)}
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
                >
                    <div className="relative max-w-2xl max-h-[85vh] bg-white p-2 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black text-white rounded-full transition shadow"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <img src={previewImage} alt="Visualização ampliada" className="max-h-[80vh] w-auto mx-auto rounded-xl object-contain" />
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
