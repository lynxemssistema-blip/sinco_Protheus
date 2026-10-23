import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getEstruturaProduto } from '../../services/api';
import StockModal from '../../components/StockModal';
import ModalCadastroProduto from '../../components/produtos/ModalCadastroProduto';
import { useDebounce } from '../../hooks/useDebounce';
// FEAT (IA): Motor Relatorios Lynxems
import { ReportGeneratorService } from '../../services/ReportGeneratorService';
import ReportExportButtons from '../../components/ReportExportButtons';
import { 
    Package, Plus, Search, RefreshCw, Layers, CheckCircle2, AlertCircle, 
    ArrowDownToLine, Tag, DollarSign, Scale, X, Database, Sparkles, 
    Clock, Building2, ShieldCheck, ChevronLeft, ChevronRight, Hash,
    Eye, ExternalLink, Box, FileText, Check, Camera, Image, Paperclip,
    FileCode, Upload, Download, Trash2, Edit2, ZoomIn, Palette
} from 'lucide-react';

// Badge visual para codificação de cores de aço / matérias-primas (Sólida ou Bicolor 50/50)
export function ProductColorBadge({ cor, showLabel = true, size = 'sm' }) {
    if (!cor || !cor.cor_primaria) return null;
    const isBicolor = cor.cor_tipo === 'bicolor' && cor.cor_secundaria;
    const bgStyle = isBicolor
        ? { background: `linear-gradient(90deg, ${cor.cor_primaria} 50%, ${cor.cor_secundaria} 50%)` }
        : { backgroundColor: cor.cor_primaria };

    const sizeClass = size === 'xs' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';

    return (
        <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 border border-slate-200 text-slate-800 shadow-2xs shrink-0"
            title={`${cor.cor_codigo || ''} - ${cor.cor_significado || ''}${isBicolor ? ' (Bicolor)' : ''}`}
        >
            <span
                className={`${sizeClass} rounded-full border border-gray-400 shadow-inner shrink-0`}
                style={bgStyle}
            />
            {showLabel && (
                <span className="font-mono font-bold text-[11px] text-slate-700">
                    {cor.cor_codigo}
                </span>
            )}
        </span>
    );
}

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

    // Modal de Confirmação de Exclusão (Soft Delete Protheus D_E_L_E_T_ = '*')
    const [productToDelete, setProductToDelete] = useState(null);
    const [deletingProduct, setDeletingProduct] = useState(false);

    const handleConfirmDelete = async () => {
        if (!productToDelete) return;
        setDeletingProduct(true);
        try {
            await api.delete(`/erp/produtos/${encodeURIComponent(productToDelete.codigo)}`);
            setProductToDelete(null);
            await loadData();
        } catch (err) {
            console.error('Erro ao excluir produto:', err);
            alert('Erro ao excluir produto: ' + (err.response?.data?.error || err.message));
        } finally {
            setDeletingProduct(false);
        }
    };

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
    const [editingProduct, setEditingProduct] = useState(null);
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
        b1_xrevc: '0',
        cor_id: '' // Padrão: VAZIO (Nenhum material tem cor por padrão)
    });

    // Gestão de Cores de Aço / Matérias-Primas (Placa de Codificação)
    const [coresList, setCoresList] = useState([]);
    const [colorFilter, setColorFilter] = useState('');
    const [isColorManagerOpen, setIsColorManagerOpen] = useState(false);
    const [editingColor, setEditingColor] = useState(null);
    const [colorFormData, setColorFormData] = useState({
        codigo: '',
        significado: '',
        tipo_cor: 'solida',
        cor_primaria: '#FFFFFF',
        cor_secundaria: '#DC2626',
        descricao: ''
    });
    const [colorSaving, setColorSaving] = useState(false);
    const [colorModalError, setColorModalError] = useState(null);
    const [colorModalSuccess, setColorModalSuccess] = useState(null);

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
            let url = `/erp/produtos?search=${encodeURIComponent(debouncedSearch)}&tipo=${encodeURIComponent(tipoFilter)}&limit=${limit}&offset=${page * limit}`;
            if (colorFilter) {
                url += `&cor_id=${encodeURIComponent(colorFilter)}`;
            }
            const [prodRes, statsRes] = await Promise.allSettled([
                api.get(url),
                api.get('/erp/stats')
            ]);
            if (prodRes.status === 'fulfilled') {
                setProdutos(prodRes.value?.data || []);
            }
            if (statsRes.status === 'fulfilled') {
                setStats(statsRes.value?.data || {});
            }
        } catch (err) {
            console.error('Erro ao carregar dados do ERP:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadCores = async () => {
        try {
            const res = await api.get('/erp/produtos/cores');
            setCoresList(res.data || []);
        } catch (err) {
            console.warn('Falha ao carregar lista de cores de aço:', err);
        }
    };

    useEffect(() => {
        loadData();
        fetchCadastrosBasicos();
        loadCores();
    }, [debouncedSearch, tipoFilter, colorFilter, page]);

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

    // Função para gerar automaticamente o próximo código com base EXCLUSIVAMENTE no prefixo/família (6 dígitos)
    const fetchNextProductCode = async (prefixoEscolhido = selectedPrefixo) => {
        setGeneratingCode(true);
        try {
            const cleanPref = (prefixoEscolhido === 'OUTRO' ? customPrefixo : prefixoEscolhido) || 'PRD-1';
            const res = await api.get(`/erp/produtos/proximo-codigo?prefixo=${encodeURIComponent(cleanPref)}`);
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

    // FEAT (IA): Motor Relatorios Lynxems - Handlers de Exportação Excel e PDF
    const handleExportExcel = async () => {
        await ReportGeneratorService.exportExcel({
            title: 'Catálogo de Produtos e Materiais',
            subtitle: tipoFilter ? `Filtro de Tipo: ${tipoFilter}` : 'Todos os Tipos Protheus (PA, PI, MP)',
            columns: [
                { header: 'Código', key: 'codigo', width: 18, align: 'center' },
                { header: 'Descrição', key: 'descricao', width: 38 },
                { header: 'Tipo', key: 'tipo', width: 10, align: 'center' },
                { header: 'U.M.', key: 'unidade_medida', width: 10, align: 'center' },
                { header: 'Armazém', key: 'armazem_padrao', width: 12, align: 'center' },
                { header: 'NCM', key: 'ncm', width: 16, align: 'center' },
                { header: 'Peso Líq. (kg)', key: 'peso_liquido', width: 15, align: 'right', format: 'decimal' },
                { header: 'Preço Venda', key: 'preco_venda', width: 16, align: 'right', format: 'currency' },
                { header: 'Status', key: 'status', width: 12, align: 'center' }
            ],
            data: produtos,
            filename: `produtos_protheus_${new Date().toISOString().slice(0, 10)}`
        });
    };

    const handleExportPdf = async () => {
        await ReportGeneratorService.exportPdf({
            title: 'Catálogo de Produtos e Materiais',
            subtitle: tipoFilter ? `Filtro de Tipo: ${tipoFilter}` : 'Todos os Tipos Protheus (PA, PI, MP)',
            columns: [
                { header: 'Código', key: 'codigo', width: 22, align: 'center' },
                { header: 'Descrição', key: 'descricao', width: 50 },
                { header: 'Tipo', key: 'tipo', width: 10, align: 'center' },
                { header: 'U.M.', key: 'unidade_medida', width: 10, align: 'center' },
                { header: 'Armazém', key: 'armazem_padrao', width: 12, align: 'center' },
                { header: 'NCM', key: 'ncm', width: 16, align: 'center' },
                { header: 'Peso Líq. (kg)', key: 'peso_liquido', width: 18, align: 'right', format: 'decimal' },
                { header: 'Preço Venda', key: 'preco_venda', width: 18, align: 'right', format: 'currency' },
                { header: 'Status', key: 'status', width: 14, align: 'center' }
            ],
            data: produtos,
            orientation: 'landscape',
            filename: `produtos_protheus_${new Date().toISOString().slice(0, 10)}`
        });
    };

    // Handlers para Gestão de Cores de Aço
    const handleSaveColor = async (e) => {
        e?.preventDefault();
        if (!colorFormData.codigo || !colorFormData.significado || !colorFormData.cor_primaria) {
            setColorModalError('Código (ex: SAE 1020), Significado e Cor Primária são obrigatórios.');
            return;
        }
        setColorSaving(true);
        setColorModalError(null);
        setColorModalSuccess(null);
        try {
            if (editingColor) {
                await api.put(`/erp/produtos/cores/${editingColor}`, colorFormData);
                setColorModalSuccess(`Cor ${colorFormData.codigo} atualizada com sucesso!`);
            } else {
                await api.post('/erp/produtos/cores', colorFormData);
                setColorModalSuccess(`Cor ${colorFormData.codigo} cadastrada com sucesso!`);
            }
            await loadCores();
            await loadData();
            setTimeout(() => {
                setEditingColor(null);
                setColorFormData({
                    codigo: '',
                    significado: '',
                    tipo_cor: 'solida',
                    cor_primaria: '#FFFFFF',
                    cor_secundaria: '#DC2626',
                    descricao: ''
                });
                setColorModalSuccess(null);
            }, 800);
        } catch (err) {
            setColorModalError(err.response?.data?.error || err.message);
        } finally {
            setColorSaving(false);
        }
    };

    const handleDeleteColor = async (id, codigo) => {
        if (!window.confirm(`Tem certeza que deseja excluir a cor "${codigo}"? Quaisquer produtos vinculados voltarão ao padrão (sem cor).`)) {
            return;
        }
        try {
            await api.delete(`/erp/produtos/cores/${id}`);
            await loadCores();
            await loadData();
            if (editingColor === id) {
                setEditingColor(null);
                setColorFormData({
                    codigo: '',
                    significado: '',
                    tipo_cor: 'solida',
                    cor_primaria: '#FFFFFF',
                    cor_secundaria: '#DC2626',
                    descricao: ''
                });
            }
        } catch (err) {
            alert('Erro ao excluir cor: ' + (err.response?.data?.error || err.message));
        }
    };

    // Ao abrir o modal para criação de novo produto
    const handleOpenCreateModal = () => {
        setIsEditing(false);
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    // Ao abrir o modal para edição de produto existente
    const handleOpenEditModal = (p) => {
        setIsEditing(true);
        setEditingProduct(p);
        setIsModalOpen(true);
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
                    {/* FEAT (IA): Motor Relatorios Lynxems - Botões de Exportação */}
                    <ReportExportButtons
                        onExportExcel={handleExportExcel}
                        onExportPdf={handleExportPdf}
                        disabled={loading || produtos.length === 0}
                    />

                    <button
                        onClick={() => {
                            setIsColorManagerOpen(true);
                            setEditingColor(null);
                            setColorFormData({
                                codigo: '',
                                significado: '',
                                tipo_cor: 'solida',
                                cor_primaria: '#FFFFFF',
                                cor_secundaria: '#DC2626',
                                descricao: ''
                            });
                            setColorModalError(null);
                            setColorModalSuccess(null);
                        }}
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-sm font-semibold transition shadow-xs cursor-pointer"
                        title="Gerenciar Tabela de Cores de Aço / Matérias-Primas"
                    >
                        <Palette className="w-4 h-4 text-indigo-600" />
                        <span>Cores de Aço</span>
                        {coresList.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {coresList.length}
                            </span>
                        )}
                    </button>

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
                <select
                    value={colorFilter}
                    onChange={(e) => { setColorFilter(e.target.value); setPage(0); }}
                    className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Filtrar por Cor de Aço (Placa de Codificação)"
                >
                    <option value="">Todas as Cores</option>
                    <option value="sem_cor">⚪ Sem cor de aço</option>
                    {coresList.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.codigo} - {c.significado}
                        </option>
                    ))}
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
                                <th className="py-3 px-3 text-center">Cor Aço</th>
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
                                    <td colSpan="14" className="py-12 text-center text-gray-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                                        Carregando cadastro de produtos do Protheus...
                                    </td>
                                </tr>
                            ) : produtos.length === 0 ? (
                                <tr>
                                    <td colSpan="14" className="py-12 text-center text-gray-500">
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
                                        <td className="py-3.5 px-3 text-center">
                                            {p.cor_primaria ? (
                                                <ProductColorBadge
                                                    cor={{
                                                        cor_codigo: p.cor_codigo,
                                                        cor_significado: p.cor_significado,
                                                        cor_tipo: p.cor_tipo,
                                                        cor_primaria: p.cor_primaria,
                                                        cor_secundaria: p.cor_secundaria
                                                    }}
                                                    showLabel={true}
                                                    size="sm"
                                                />
                                            ) : (
                                                <span className="text-gray-300 font-mono text-xs" title="Nenhuma cor vinculada (Padrão)">-</span>
                                            )}
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

                                                {/* Botão Formulário de Engenharia SINCO (Solid Edge) */}
                                                <Link
                                                    to={`/engenharia/sinco/formulario?codigo=${encodeURIComponent(p.codigo)}&arquivo=${encodeURIComponent(p.codigo)}&titulo=${encodeURIComponent(p.descricao || '')}&tipo=${encodeURIComponent(p.tipo || '')}&unidade=${encodeURIComponent(p.unidade_medida || 'UN')}&grupo=${encodeURIComponent(p.grupo || '01')}&rev=${encodeURIComponent(p.b1_xrevm || '00')}&peso=${encodeURIComponent(p.peso_liquido || '0')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 ring-1 ring-amber-200/80 rounded-lg transition inline-flex items-center justify-center cursor-pointer shadow-2xs"
                                                    title="Abrir Formulário de Engenharia SINCO (Solid Edge) com dados já carregados"
                                                >
                                                    <Box className="w-4 h-4" />
                                                </Link>

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

                                                {/* Botão Excluir Produto (Soft Delete Protheus D_E_L_E_T_ = '*') */}
                                                <button
                                                    type="button"
                                                    onClick={() => setProductToDelete(p)}
                                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition inline-flex items-center justify-center cursor-pointer"
                                                    title="Excluir Produto (Soft Delete Protheus D_E_L_E_T_ = '*')"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

            {/* Modal Unificado de Cadastro e Edição de Produto (Padrão Oficial Imagem 2) */}
            <ModalCadastroProduto
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingProduct(null);
                }}
                isEditing={isEditing}
                initialData={editingProduct}
                onSuccess={() => loadData()}
                isSinco={false}
            />

            {/* Modal de Confirmação de Exclusão (Soft Delete Protheus D_E_L_E_T_ = '*') */}
            {productToDelete && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="p-3 bg-red-100 text-red-600 rounded-xl shrink-0">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-gray-900">
                                    Confirmar Exclusão de Produto
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Esta ação realizará a exclusão lógica no padrão Protheus (<code className="font-mono text-red-600 bg-red-50 px-1 py-0.5 rounded font-bold">D_E_L_E_T_ = '*'</code>).
                                </p>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                                    {productToDelete.codigo}
                                </span>
                                <span className="text-xs font-mono text-gray-500">
                                    Tipo: {productToDelete.tipo || 'PA'}
                                </span>
                            </div>
                            <div className="text-xs font-medium text-gray-800 line-clamp-2">
                                {productToDelete.descricao}
                            </div>
                        </div>

                        <div className="text-[11px] text-gray-500 bg-amber-50 border border-amber-200 p-2.5 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                                O produto não será apagado definitivamente do banco de dados, permitindo rastreabilidade histórica.
                            </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setProductToDelete(null)}
                                disabled={deletingProduct}
                                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={deletingProduct}
                                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-98 transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {deletingProduct ? (
                                    <span>Excluindo...</span>
                                ) : (
                                    <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Confirmar Exclusão</span>
                                    </>
                                )}
                            </button>
                        </div>
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

            {/* Modal de Gestão de Cores de Aço (Placa de Codificação Industrial) */}
            {isColorManagerOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
                        {/* Header do Modal */}
                        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-gray-200 flex items-center justify-between gap-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                                    <Palette className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-bold text-gray-900">
                                            Placa de Codificação de Aço & Matérias-Primas
                                        </h2>
                                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800">
                                            Almoxarifado & Produção
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Identificação visual de barras de aço por cor sólida ou bicolor (dividida 50/50). Isolado por empresa.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsColorManagerOpen(false);
                                    setEditingColor(null);
                                }}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Corpo com scroll */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
                            {/* Alertas */}
                            {colorModalError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{colorModalError}</span>
                                </div>
                            )}
                            {colorModalSuccess && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>{colorModalSuccess}</span>
                                </div>
                            )}

                            {/* Formulário de Nova / Edição de Cor */}
                            <form onSubmit={handleSaveColor} className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-indigo-600" />
                                        {editingColor ? `Editar Cor (${colorFormData.codigo})` : 'Cadastrar Nova Cor de Aço'}
                                    </h3>
                                    {editingColor && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingColor(null);
                                                setColorFormData({
                                                    codigo: '',
                                                    significado: '',
                                                    tipo_cor: 'solida',
                                                    cor_primaria: '#FFFFFF',
                                                    cor_secundaria: '#DC2626',
                                                    descricao: ''
                                                });
                                                setColorModalError(null);
                                                setColorModalSuccess(null);
                                            }}
                                            className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                                        >
                                            Cancelar Edição
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Coluna 1 & 2: Campos de dados */}
                                    <div className="md:col-span-2 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                                    Código / Norma do Aço *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Ex: SAE 1020, SAE 4340, AISI 304"
                                                    value={colorFormData.codigo}
                                                    onChange={(e) => setColorFormData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                                    Significado / Descrição *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Ex: Aço SAE 1020, Inox AISI 304"
                                                    value={colorFormData.significado}
                                                    onChange={(e) => setColorFormData(prev => ({ ...prev, significado: e.target.value }))}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>

                                        {/* Tipo de Cor: Sólida vs Bicolor */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                                Padrão de Pintura
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setColorFormData(prev => ({ ...prev, tipo_cor: 'solida' }))}
                                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center justify-center gap-2 ${
                                                        colorFormData.tipo_cor === 'solida'
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                                            : 'bg-white text-slate-700 border-gray-300 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <span className="w-3 h-3 rounded-full bg-indigo-400 border border-white shrink-0"></span>
                                                    <span>Cor Sólida (1 Cor Única)</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setColorFormData(prev => ({ ...prev, tipo_cor: 'bicolor' }))}
                                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center justify-center gap-2 ${
                                                        colorFormData.tipo_cor === 'bicolor'
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                                            : 'bg-white text-slate-700 border-gray-300 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <span
                                                        className="w-3 h-3 rounded-full border border-white shrink-0"
                                                        style={{ background: 'linear-gradient(90deg, #16A34A 50%, #DC2626 50%)' }}
                                                    ></span>
                                                    <span>Bicolor (2 Cores - 50% Dividido)</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Seletores de Cor */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                            {/* Cor 1 */}
                                            <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-2">
                                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                    Cor Primária (Esquerda / Total)
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={colorFormData.cor_primaria}
                                                        onChange={(e) => setColorFormData(prev => ({ ...prev, cor_primaria: e.target.value.toUpperCase() }))}
                                                        className="w-9 h-9 p-0.5 rounded cursor-pointer border border-gray-300"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={colorFormData.cor_primaria}
                                                        onChange={(e) => setColorFormData(prev => ({ ...prev, cor_primaria: e.target.value.toUpperCase() }))}
                                                        className="w-24 bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs font-mono font-bold text-gray-900"
                                                    />
                                                </div>
                                                {/* Paleta rápida de aços */}
                                                <div className="flex flex-wrap gap-1 pt-1">
                                                    {[
                                                        { label: 'Branco', hex: '#FFFFFF' },
                                                        { label: 'Vermelho', hex: '#DC2626' },
                                                        { label: 'Verde', hex: '#16A34A' },
                                                        { label: 'Verde Escuro', hex: '#15803D' },
                                                        { label: 'Azul', hex: '#2563EB' },
                                                        { label: 'Amarelo', hex: '#EAB308' },
                                                        { label: 'Laranja', hex: '#EA580C' },
                                                        { label: 'Ciano', hex: '#06B6D4' },
                                                        { label: 'Preto', hex: '#1E293B' },
                                                    ].map(p => (
                                                        <button
                                                            key={p.hex}
                                                            type="button"
                                                            title={p.label}
                                                            onClick={() => setColorFormData(prev => ({ ...prev, cor_primaria: p.hex }))}
                                                            className="w-4 h-4 rounded-full border border-gray-400 shadow-2xs hover:scale-125 transition-transform cursor-pointer"
                                                            style={{ backgroundColor: p.hex }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Cor 2 (Se Bicolor) */}
                                            <div className={`p-3 rounded-lg border space-y-2 transition ${
                                                colorFormData.tipo_cor === 'bicolor'
                                                    ? 'bg-white border-gray-200'
                                                    : 'bg-gray-100/60 border-dashed border-gray-200 opacity-50 pointer-events-none'
                                            }`}>
                                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                    Cor Secundária (Direita)
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={colorFormData.cor_secundaria || '#DC2626'}
                                                        onChange={(e) => setColorFormData(prev => ({ ...prev, cor_secundaria: e.target.value.toUpperCase() }))}
                                                        className="w-9 h-9 p-0.5 rounded cursor-pointer border border-gray-300"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={colorFormData.cor_secundaria || '#DC2626'}
                                                        onChange={(e) => setColorFormData(prev => ({ ...prev, cor_secundaria: e.target.value.toUpperCase() }))}
                                                        className="w-24 bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs font-mono font-bold text-gray-900"
                                                    />
                                                </div>
                                                {/* Paleta rápida de aços */}
                                                <div className="flex flex-wrap gap-1 pt-1">
                                                    {[
                                                        { label: 'Branco', hex: '#FFFFFF' },
                                                        { label: 'Vermelho', hex: '#DC2626' },
                                                        { label: 'Verde', hex: '#16A34A' },
                                                        { label: 'Verde Escuro', hex: '#15803D' },
                                                        { label: 'Azul', hex: '#2563EB' },
                                                        { label: 'Amarelo', hex: '#EAB308' },
                                                        { label: 'Laranja', hex: '#EA580C' },
                                                        { label: 'Ciano', hex: '#06B6D4' },
                                                        { label: 'Preto', hex: '#1E293B' },
                                                    ].map(p => (
                                                        <button
                                                            key={p.hex}
                                                            type="button"
                                                            title={p.label}
                                                            onClick={() => setColorFormData(prev => ({ ...prev, cor_secundaria: p.hex }))}
                                                            className="w-4 h-4 rounded-full border border-gray-400 shadow-2xs hover:scale-125 transition-transform cursor-pointer"
                                                            style={{ backgroundColor: p.hex }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Coluna 3: Preview visual ao vivo do topo da barra de aço */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-center shadow-inner">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            Topo da Barra de Aço
                                        </span>

                                        <div
                                            className="w-20 h-20 rounded-full border-4 border-slate-700/80 shadow-lg relative overflow-hidden transition-all flex items-center justify-center"
                                            style={colorFormData.tipo_cor === 'bicolor' && colorFormData.cor_secundaria
                                                ? { background: `linear-gradient(90deg, ${colorFormData.cor_primaria} 50%, ${colorFormData.cor_secundaria} 50%)` }
                                                : { backgroundColor: colorFormData.cor_primaria }
                                            }
                                        >
                                            {/* Brilho metálico sutil */}
                                            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/30 pointer-events-none rounded-full" />
                                        </div>

                                        <div className="mt-3">
                                            <span className="font-mono font-bold text-sm text-gray-900 block">
                                                {colorFormData.codigo || 'SAE XXXX'}
                                            </span>
                                            <span className="text-xs text-gray-500 block truncate max-w-[160px]">
                                                {colorFormData.significado || 'Significado do Aço'}
                                            </span>
                                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                                                {colorFormData.tipo_cor === 'bicolor' ? 'Bicolor 50/50' : 'Sólida'}
                                            </span>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={colorSaving}
                                            className="mt-4 w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            {colorSaving ? (
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Check className="w-3.5 h-3.5" />
                                            )}
                                            <span>{editingColor ? 'Atualizar Cor' : 'Gravar Nova Cor'}</span>
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {/* Tabela de Cores Cadastradas */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                        <span>Cores Registradas nesta Empresa</span>
                                        <span className="px-2 py-0.2 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                                            {coresList.length}
                                        </span>
                                    </h3>
                                    <span className="text-xs text-gray-500">
                                        Dica: Por padrão nenhum material tem cor até ser explicitamente associado.
                                    </span>
                                </div>

                                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-gray-200 text-slate-600 font-bold uppercase tracking-wider">
                                            <tr>
                                                <th className="py-2.5 px-3 text-center">Amostra</th>
                                                <th className="py-2.5 px-3">Código</th>
                                                <th className="py-2.5 px-4">Significado / Aplicação</th>
                                                <th className="py-2.5 px-3 text-center">Tipo</th>
                                                <th className="py-2.5 px-3">Hex</th>
                                                <th className="py-2.5 px-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 font-sans">
                                            {coresList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="py-8 text-center text-gray-400">
                                                        Nenhuma cor cadastrada ainda para esta empresa.
                                                    </td>
                                                </tr>
                                            ) : (
                                                coresList.map(c => {
                                                    const isBi = c.tipo_cor === 'bicolor' && c.cor_secundaria;
                                                    return (
                                                        <tr key={c.id} className="hover:bg-slate-50 transition">
                                                            <td className="py-2.5 px-3 text-center">
                                                                <span
                                                                    className="inline-block w-6 h-6 rounded-full border border-gray-400 shadow-inner align-middle"
                                                                    style={isBi
                                                                        ? { background: `linear-gradient(90deg, ${c.cor_primaria} 50%, ${c.cor_secundaria} 50%)` }
                                                                        : { backgroundColor: c.cor_primaria }
                                                                    }
                                                                />
                                                            </td>
                                                            <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                                                                {c.codigo}
                                                            </td>
                                                            <td className="py-2.5 px-4 text-gray-800 font-medium">
                                                                {c.significado}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                    isBi
                                                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                }`}>
                                                                    {isBi ? 'Bicolor' : 'Sólida'}
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500">
                                                                {c.cor_primaria}{isBi ? ` / ${c.cor_secundaria}` : ''}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditingColor(c.id);
                                                                            setColorFormData({
                                                                                codigo: c.codigo,
                                                                                significado: c.significado,
                                                                                tipo_cor: c.tipo_cor || 'solida',
                                                                                cor_primaria: c.cor_primaria || '#FFFFFF',
                                                                                cor_secundaria: c.cor_secundaria || '#DC2626',
                                                                                descricao: c.descricao || ''
                                                                            });
                                                                            setColorModalError(null);
                                                                            setColorModalSuccess(null);
                                                                        }}
                                                                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition cursor-pointer"
                                                                        title="Editar cor"
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteColor(c.id, c.codigo)}
                                                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                                                                        title="Excluir cor"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Rodapé do Modal */}
                        <div className="p-4 bg-slate-50 border-t border-gray-200 flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                                Padrão visual alinhado com a norma e placa física de identificação industrial.
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsColorManagerOpen(false);
                                    setEditingColor(null);
                                }}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                                Fechar
                            </button>
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
