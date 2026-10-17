import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { 
    Database, Hash, Tag, Scale, Building2, Plus, Search, 
    Edit2, Trash2, CheckCircle2, AlertCircle, RefreshCw, X,
    RotateCcw, Sparkles, Check, ArrowRight, Palette
} from 'lucide-react';

export default function CadastrosBasicosPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();

    const getInitialTab = () => {
        const tab = searchParams.get('tab');
        if (tab && ['prefixos', 'tipos', 'unidades', 'armazens', 'cores'].includes(tab)) return tab;
        if (location.pathname.includes('cores')) return 'cores';
        if (location.pathname.includes('prefixos')) return 'prefixos';
        if (location.pathname.includes('tipos')) return 'tipos';
        if (location.pathname.includes('unidades')) return 'unidades';
        if (location.pathname.includes('armazens')) return 'armazens';
        return 'prefixos';
    };

    const [activeTab, setActiveTab] = useState(getInitialTab);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['prefixos', 'tipos', 'unidades', 'armazens', 'cores'].includes(tab)) {
            setActiveTab(tab);
        } else if (location.pathname.includes('cores')) {
            setActiveTab('cores');
        }
    }, [searchParams, location.pathname]);

    const handleTabChange = (tabKey) => {
        setActiveTab(tabKey);
        setSearchParams({ tab: tabKey });
    };

    // Estados de dados
    const [prefixos, setPrefixos] = useState([]);
    const [tipos, setTipos] = useState([]);
    const [unidades, setUnidades] = useState([]);
    const [armazens, setArmazens] = useState([]);
    const [cores, setCores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Estado do formulário de Cores de Aço
    const [colorFormData, setColorFormData] = useState({
        codigo: '',
        significado: '',
        tipo_cor: 'solida',
        cor_primaria: '#FFFFFF',
        cor_secundaria: '#DC2626',
        descricao: ''
    });
    const [colorEditingId, setColorEditingId] = useState(null);
    const [colorSaving, setColorSaving] = useState(false);

    // Modal de Cadastro/Edição Geral
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [itemEditando, setItemEditando] = useState(null);
    const [formData, setFormData] = useState({
        sigla: '',
        codigo: '',
        descricao: '',
        padrao_sequencial: '0001',
        rapido: true,
        ativo: true
    });
    const [modalError, setModalError] = useState('');
    const [modalSaving, setModalSaving] = useState(false);

    // Modal de Confirmação de Exclusão
    const [itemParaExcluir, setItemParaExcluir] = useState(null);
    const [excluindo, setExcluindo] = useState(false);

    // Modal de Confirmação de Restauração de Padrões
    const [isRestaurarModalOpen, setIsRestaurarModalOpen] = useState(false);
    const [restaurando, setRestaurando] = useState(false);

    // Toast de notificação
    const [toast, setToast] = useState(null);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(timer);
    }, [toast]);

    const carregarTodos = async () => {
        setLoading(true);
        try {
            const [res, coresRes] = await Promise.all([
                api.get('/cadastros-basicos/todos'),
                api.get('/erp/produtos/cores')
            ]);
            setPrefixos(res.data?.prefixos || []);
            setTipos(res.data?.tipos || []);
            setUnidades(res.data?.unidades || []);
            setArmazens(res.data?.armazens || []);
            setCores(coresRes.data || []);
        } catch (err) {
            console.error('Erro ao carregar cadastros básicos:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarTodos();
    }, []);

    const abrirModalNovo = () => {
        setItemEditando(null);
        setFormData({
            sigla: '',
            codigo: '',
            descricao: '',
            padrao_sequencial: '0001',
            rapido: true,
            ativo: true
        });
        setModalError('');
        setIsModalOpen(true);
    };

    const abrirModalEditar = (item) => {
        setItemEditando(item);
        setFormData({
            sigla: item.sigla || '',
            codigo: item.codigo || '',
            descricao: item.descricao || '',
            padrao_sequencial: item.padrao_sequencial || '0001',
            rapido: item.rapido === 1 || item.rapido === true,
            ativo: item.ativo === 1 || item.ativo === true
        });
        setModalError('');
        setIsModalOpen(true);
    };

    const handleSalvar = async (e) => {
        e.preventDefault();
        setModalSaving(true);
        setModalError('');

        try {
            let endpoint = '';
            if (activeTab === 'prefixos') endpoint = '/cadastros-basicos/prefixos';
            if (activeTab === 'tipos') endpoint = '/cadastros-basicos/tipos';
            if (activeTab === 'unidades') endpoint = '/cadastros-basicos/unidades';
            if (activeTab === 'armazens') endpoint = '/cadastros-basicos/armazens';

            if (itemEditando) {
                await api.put(`${endpoint}/${itemEditando.id}`, formData);
                setToast({
                    type: 'success',
                    message: `Cadastro "${formData.sigla || formData.codigo}" atualizado com sucesso!`
                });
            } else {
                await api.post(endpoint, formData);
                setToast({
                    type: 'success',
                    message: `Cadastro "${formData.sigla || formData.codigo}" criado com sucesso!`
                });
            }

            setIsModalOpen(false);
            await carregarTodos();
        } catch (err) {
            setModalError(err.response?.data?.error || 'Erro ao salvar registro.');
        } finally {
            setModalSaving(false);
        }
    };

    const handleConfirmarExcluir = async () => {
        if (!itemParaExcluir) return;
        setExcluindo(true);
        try {
            let endpoint = '';
            if (activeTab === 'prefixos') endpoint = '/cadastros-basicos/prefixos';
            if (activeTab === 'tipos') endpoint = '/cadastros-basicos/tipos';
            if (activeTab === 'unidades') endpoint = '/cadastros-basicos/unidades';
            if (activeTab === 'armazens') endpoint = '/cadastros-basicos/armazens';

            const idOrCode = itemParaExcluir.id || itemParaExcluir.codigo || itemParaExcluir.sigla;
            await api.delete(`${endpoint}/${idOrCode}`);
            
            setToast({
                type: 'success',
                message: `Registro "${itemParaExcluir.sigla || itemParaExcluir.codigo}" excluído com sucesso!`
            });
            setItemParaExcluir(null);
            await carregarTodos();
        } catch (err) {
            console.error('Erro ao excluir:', err);
            setToast({
                type: 'error',
                message: err.response?.data?.error || 'Erro ao excluir cadastro.'
            });
        } finally {
            setExcluindo(false);
        }
    };

    const handleConfirmarRestauracao = async () => {
        setRestaurando(true);
        try {
            await api.post('/cadastros-basicos/restaurar-padroes');
            await carregarTodos();
            setIsRestaurarModalOpen(false);
            setToast({
                type: 'success',
                message: 'Cadastros básicos padrão restaurados com sucesso!'
            });
        } catch (err) {
            console.error('Erro ao restaurar padrões:', err);
            setToast({
                type: 'error',
                message: err.response?.data?.error || 'Erro ao restaurar padrões.'
            });
        } finally {
            setRestaurando(false);
        }
    };

    // Handlers para Cores de Aço (Placa de Codificação)
    const handleSalvarCor = async (e) => {
        e?.preventDefault();
        if (!colorFormData.codigo || !colorFormData.significado || !colorFormData.cor_primaria) {
            setToast({
                type: 'error',
                message: 'Código da norma, significado e cor primária são obrigatórios.'
            });
            return;
        }

        setColorSaving(true);
        try {
            if (colorEditingId) {
                await api.put(`/erp/produtos/cores/${colorEditingId}`, colorFormData);
                setToast({
                    type: 'success',
                    message: `Cor de aço "${colorFormData.codigo}" atualizada com sucesso!`
                });
            } else {
                await api.post('/erp/produtos/cores', colorFormData);
                setToast({
                    type: 'success',
                    message: `Cor de aço "${colorFormData.codigo}" cadastrada com sucesso!`
                });
            }

            setColorEditingId(null);
            setColorFormData({
                codigo: '',
                significado: '',
                tipo_cor: 'solida',
                cor_primaria: '#FFFFFF',
                cor_secundaria: '#DC2626',
                descricao: ''
            });
            await carregarTodos();
        } catch (err) {
            setToast({
                type: 'error',
                message: err.response?.data?.error || 'Erro ao salvar cor de aço.'
            });
        } finally {
            setColorSaving(false);
        }
    };

    const handleExcluirCor = async (id, codigo) => {
        if (!window.confirm(`Deseja realmente remover a cor de aço "${codigo}"?`)) return;
        try {
            await api.delete(`/erp/produtos/cores/${id}`);
            setToast({
                type: 'success',
                message: `Cor "${codigo}" removida com sucesso!`
            });
            await carregarTodos();
        } catch (err) {
            setToast({
                type: 'error',
                message: err.response?.data?.error || 'Erro ao remover cor.'
            });
        }
    };

    // Itens ativos conforme aba
    let itensAtuais = [];
    if (activeTab === 'prefixos') itensAtuais = prefixos;
    if (activeTab === 'tipos') itensAtuais = tipos;
    if (activeTab === 'unidades') itensAtuais = unidades;
    if (activeTab === 'armazens') itensAtuais = armazens;

    // Filtro por busca
    const itensFiltrados = itensAtuais.filter(item => {
        const termo = searchTerm.toLowerCase();
        const codigo = (item.sigla || item.codigo || '').toLowerCase();
        const desc = (item.descricao || '').toLowerCase();
        return codigo.includes(termo) || desc.includes(termo);
    });

    const coresFiltradas = cores.filter(item => {
        const termo = searchTerm.toLowerCase();
        const codigo = (item.codigo || '').toLowerCase();
        const sign = (item.significado || '').toLowerCase();
        return codigo.includes(termo) || sign.includes(termo);
    });

    const abasConfig = [
        { id: 'prefixos', label: 'Prefixos (Famílias)', icone: Hash, count: prefixos.length },
        { id: 'tipos', label: 'Tipos (B1_TIPO)', icone: Tag, count: tipos.length },
        { id: 'unidades', label: 'Unidades (B1_UM)', icone: Scale, count: unidades.length },
        { id: 'armazens', label: 'Armazéns (B1_LOCPAD)', icone: Building2, count: armazens.length },
        { id: 'cores', label: 'Codificação de Aço (Cores)', icone: Palette, count: cores.length },
    ];

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
            
            {/* Topo / Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Database className="w-8 h-8 text-blue-500" />
                        Cadastros Básicos (Protheus ERP)
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Gerenciamento multi-empresa de Prefixos/Famílias, Tipos de Produto, Unidades de Medida, Armazéns e Codificação de Cores de Aço.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {activeTab !== 'cores' && (
                        <button
                            onClick={() => setIsRestaurarModalOpen(true)}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors shadow"
                            title="Restaurar padrões de fábrica do Protheus"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                            Restaurar Padrões
                        </button>
                    )}

                    <button
                        onClick={() => {
                            if (activeTab === 'cores') {
                                setColorEditingId(null);
                                setColorFormData({
                                    codigo: '',
                                    significado: '',
                                    tipo_cor: 'solida',
                                    cor_primaria: '#FFFFFF',
                                    cor_secundaria: '#DC2626',
                                    descricao: ''
                                });
                                const formEl = document.getElementById('form-cor-aco');
                                if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                            } else {
                                abrirModalNovo();
                            }
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        {activeTab === 'cores' ? 'Nova Cor de Aço' : `Novo ${activeTab === 'prefixos' ? 'Prefixo' : activeTab === 'tipos' ? 'Tipo' : activeTab === 'unidades' ? 'Unidade' : 'Armazém'}`}
                    </button>
                </div>
            </div>

            {/* Abas e Barra de Pesquisa */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Abas de Navegação */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                    {abasConfig.map(tab => {
                        const Icon = tab.icone;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                                    isActive 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{tab.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                    isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Campo de Busca */}
                <div className="relative w-full md:w-72">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por código ou descrição..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Conteúdo da Aba: Cores de Aço vs Cadastros Gerais */}
            {activeTab === 'cores' ? (
                <div className="space-y-6">
                    {/* Card de Cadastro / Edição de Cores de Aço com Preview 3D */}
                    <div id="form-cor-aco" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-indigo-400" />
                                    {colorEditingId ? `Editar Cor de Aço (${colorFormData.codigo})` : 'Cadastrar Nova Cor de Aço na Placa'}
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Norma e identificação visual de topo de barra de aço para almoxarifado e chão de fábrica. Isolado por empresa.
                                </p>
                            </div>
                            {colorEditingId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setColorEditingId(null);
                                        setColorFormData({
                                            codigo: '',
                                            significado: '',
                                            tipo_cor: 'solida',
                                            cor_primaria: '#FFFFFF',
                                            cor_secundaria: '#DC2626',
                                            descricao: ''
                                        });
                                    }}
                                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                                >
                                    Cancelar Edição
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSalvarCor} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Coluna 1 & 2: Campos de dados */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                            Código / Norma do Aço *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ex: SAE 1020, SAE 4340, AISI 304"
                                            value={colorFormData.codigo}
                                            onChange={(e) => setColorFormData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                            Significado / Descrição *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ex: Aço SAE 1020, Inox AISI 304"
                                            value={colorFormData.significado}
                                            onChange={(e) => setColorFormData(prev => ({ ...prev, significado: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>

                                {/* Tipo de Pintura: Sólida vs Bicolor */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Padrão de Pintura Industrial
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setColorFormData(prev => ({ ...prev, tipo_cor: 'solida' }))}
                                            className={`py-2 px-4 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center justify-center gap-2.5 ${
                                                colorFormData.tipo_cor === 'solida'
                                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                                            }`}
                                        >
                                            <span className="w-3.5 h-3.5 rounded-full bg-indigo-300 border border-white shrink-0"></span>
                                            <span>Cor Sólida (1 Cor Única)</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setColorFormData(prev => ({ ...prev, tipo_cor: 'bicolor' }))}
                                            className={`py-2 px-4 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center justify-center gap-2.5 ${
                                                colorFormData.tipo_cor === 'bicolor'
                                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                                            }`}
                                        >
                                            <span
                                                className="w-3.5 h-3.5 rounded-full border border-white shrink-0"
                                                style={{ background: 'linear-gradient(90deg, #16A34A 50%, #DC2626 50%)' }}
                                            ></span>
                                            <span>Bicolor (2 Cores - 50% Dividido)</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Seletores de Cor */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                    {/* Cor 1 */}
                                    <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                                        <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                            Cor Primária (Esquerda / Total)
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="color"
                                                value={colorFormData.cor_primaria}
                                                onChange={(e) => setColorFormData(prev => ({ ...prev, cor_primaria: e.target.value.toUpperCase() }))}
                                                className="w-10 h-10 p-0.5 rounded-lg cursor-pointer border border-slate-700 bg-transparent"
                                            />
                                            <input
                                                type="text"
                                                value={colorFormData.cor_primaria}
                                                onChange={(e) => setColorFormData(prev => ({ ...prev, cor_primaria: e.target.value.toUpperCase() }))}
                                                className="w-28 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white"
                                            />
                                        </div>
                                        {/* Paleta rápida de aços */}
                                        <div className="flex flex-wrap gap-1.5 pt-1">
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
                                                    className="w-5 h-5 rounded-full border border-slate-600 shadow-sm hover:scale-125 transition-transform cursor-pointer"
                                                    style={{ backgroundColor: p.hex }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Cor 2 (Se Bicolor) */}
                                    <div className={`p-3.5 rounded-2xl border space-y-2.5 transition ${
                                        colorFormData.tipo_cor === 'bicolor'
                                            ? 'bg-slate-950/70 border-slate-800'
                                            : 'bg-slate-950/30 border-dashed border-slate-800/60 opacity-40 pointer-events-none'
                                    }`}>
                                        <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                            Cor Secundária (Direita)
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="color"
                                                value={colorFormData.cor_secundaria || '#DC2626'}
                                                onChange={(e) => setColorFormData(prev => ({ ...prev, cor_secundaria: e.target.value.toUpperCase() }))}
                                                className="w-10 h-10 p-0.5 rounded-lg cursor-pointer border border-slate-700 bg-transparent"
                                            />
                                            <input
                                                type="text"
                                                value={colorFormData.cor_secundaria || '#DC2626'}
                                                onChange={(e) => setColorFormData(prev => ({ ...prev, cor_secundaria: e.target.value.toUpperCase() }))}
                                                className="w-28 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white"
                                            />
                                        </div>
                                        {/* Paleta rápida de aços */}
                                        <div className="flex flex-wrap gap-1.5 pt-1">
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
                                                    className="w-5 h-5 rounded-full border border-slate-600 shadow-sm hover:scale-125 transition-transform cursor-pointer"
                                                    style={{ backgroundColor: p.hex }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Coluna 3: Preview visual ao vivo do topo da barra de aço */}
                            <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center shadow-inner">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                                    Simulação do Topo da Barra
                                </span>

                                <div
                                    className="w-24 h-24 rounded-full border-4 border-slate-700 shadow-2xl relative overflow-hidden transition-all flex items-center justify-center"
                                    style={colorFormData.tipo_cor === 'bicolor' && colorFormData.cor_secundaria
                                        ? { background: `linear-gradient(90deg, ${colorFormData.cor_primaria} 50%, ${colorFormData.cor_secundaria} 50%)` }
                                        : { backgroundColor: colorFormData.cor_primaria }
                                    }
                                >
                                    {/* Efeito de corte metálico e reflexo */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/30 pointer-events-none rounded-full" />
                                </div>

                                <div className="mt-4">
                                    <span className="font-mono font-black text-base text-white block tracking-wide">
                                        {colorFormData.codigo || 'SAE XXXX'}
                                    </span>
                                    <span className="text-xs text-slate-400 block truncate max-w-[200px] mt-0.5">
                                        {colorFormData.significado || 'Significado do Aço'}
                                    </span>
                                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                                        {colorFormData.tipo_cor === 'bicolor' ? 'Bicolor 50/50' : 'Cor Sólida'}
                                    </span>
                                </div>

                                <button
                                    type="submit"
                                    disabled={colorSaving}
                                    className="mt-5 w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {colorSaving ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                    <span>{colorEditingId ? 'Atualizar Cor na Placa' : 'Gravar Nova Cor na Placa'}</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Tabela de Cores Cadastradas da Empresa */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Palette className="w-4 h-4 text-indigo-400" />
                                <span>Placa de Cores de Aço Registradas nesta Empresa</span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                                    {cores.length}
                                </span>
                            </h3>
                            <span className="text-xs text-slate-400 hidden sm:inline">
                                Por padrão nenhum produto tem cor até ser explicitamente associado no Cadastro de Produtos.
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="py-3 px-4 text-center">Amostra Topo</th>
                                        <th className="py-3 px-4">Código / Norma</th>
                                        <th className="py-3 px-4">Significado / Aplicação</th>
                                        <th className="py-3 px-4 text-center">Padrão</th>
                                        <th className="py-3 px-4">Hex / Cores</th>
                                        <th className="py-3 px-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-slate-400">
                                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent mx-auto mb-2"></div>
                                                Carregando cores da placa...
                                            </td>
                                        </tr>
                                    ) : coresFiltradas.length > 0 ? (
                                        coresFiltradas.map((c) => {
                                            const isBi = c.tipo_cor === 'bicolor' && c.cor_secundaria;
                                            return (
                                                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                                                    <td className="py-3 px-4 text-center">
                                                        <span
                                                            className="inline-block w-7 h-7 rounded-full border-2 border-slate-700 shadow-md align-middle"
                                                            style={isBi
                                                                ? { background: `linear-gradient(90deg, ${c.cor_primaria} 50%, ${c.cor_secundaria} 50%)` }
                                                                : { backgroundColor: c.cor_primaria }
                                                            }
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 font-mono font-bold text-white text-sm">
                                                        {c.codigo}
                                                    </td>
                                                    <td className="py-3 px-4 font-semibold text-slate-200">
                                                        {c.significado}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                                            isBi
                                                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                                                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                                        }`}>
                                                            {isBi ? 'Bicolor 50/50' : 'Sólida'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                                                        {c.cor_primaria}{isBi ? ` / ${c.cor_secundaria}` : ''}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setColorEditingId(c.id);
                                                                    setColorFormData({
                                                                        codigo: c.codigo,
                                                                        significado: c.significado,
                                                                        tipo_cor: c.tipo_cor || 'solida',
                                                                        cor_primaria: c.cor_primaria || '#FFFFFF',
                                                                        cor_secundaria: c.cor_secundaria || '#DC2626',
                                                                        descricao: c.descricao || ''
                                                                    });
                                                                    const formEl = document.getElementById('form-cor-aco');
                                                                    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                                                                }}
                                                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                                                                title="Editar cor"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleExcluirCor(c.id, c.codigo)}
                                                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                                                title="Excluir cor"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-slate-500 italic">
                                                Nenhuma cor encontrada na placa.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                /* Tabela de Itens Padrão (Prefixos, Tipos, Unidades, Armazéns) */
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="py-3 px-4">
                                        {activeTab === 'prefixos' ? 'Sigla (Prefixo)' : 'Código'}
                                    </th>
                                    <th className="py-3 px-4">Descrição Completa</th>
                                    {activeTab === 'prefixos' && (
                                        <>
                                            <th className="py-3 px-4">Sequencial Padrão</th>
                                            <th className="py-3 px-4">Botão Rápido?</th>
                                        </>
                                    )}
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-slate-400">
                                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
                                            Carregando registros...
                                        </td>
                                    </tr>
                                ) : itensFiltrados.length > 0 ? (
                                    itensFiltrados.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                                            <td className="py-3 px-4 font-mono font-bold text-white text-sm">
                                                {item.sigla || item.codigo}
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-slate-200">
                                                {item.descricao}
                                            </td>
                                            {activeTab === 'prefixos' && (
                                                <>
                                                    <td className="py-3 px-4 font-mono text-slate-400">
                                                        {item.padrao_sequencial || '0001'}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {item.rapido === 1 || item.rapido === true ? (
                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                                                                Sim (Rápido)
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                                                                Padrão
                                                            </span>
                                                        )}
                                                    </td>
                                                </>
                                            )}
                                            <td className="py-3 px-4">
                                                {item.ativo === 1 || item.ativo === true ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                                                        Ativo
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold border border-red-500/30">
                                                        Inativo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => abrirModalEditar(item)}
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setItemParaExcluir(item)}
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-slate-500 italic">
                                            Nenhum registro encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Criação / Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md text-slate-100 shadow-2xl overflow-hidden flex flex-col">
                        
                        {/* Header do Modal */}
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <Plus className="w-4 h-4 text-blue-400" />
                                {itemEditando ? 'Editar Cadastro' : 'Novo Cadastro'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Formulário */}
                        <form onSubmit={handleSalvar} className="p-6 space-y-4">
                            {modalError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
                                    {modalError}
                                </div>
                            )}

                            {/* Campo de Código / Sigla */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">
                                    {activeTab === 'prefixos' ? 'Sigla do Prefixo (ex: MT2, GAB)' : 'Código (ex: PA, UN, 01)'} *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={activeTab === 'prefixos' ? formData.sigla : formData.codigo}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        if (activeTab === 'prefixos') setFormData({ ...formData, sigla: val });
                                        else setFormData({ ...formData, codigo: val });
                                    }}
                                    placeholder="Ex: MT2, PA, UN, 01"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-blue-500 uppercase"
                                />
                            </div>

                            {/* Descrição */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">
                                    Descrição Completa *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.descricao}
                                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                    placeholder="Ex: Componentes / Cabines; Produto Acabado..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* Opções específicas para Prefixos */}
                            {activeTab === 'prefixos' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                                            Sequencial Inicial Padrão
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.padrao_sequencial}
                                            onChange={(e) => setFormData({ ...formData, padrao_sequencial: e.target.value })}
                                            placeholder="Ex: 0001 ou 10001"
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                        <input
                                            type="checkbox"
                                            id="chkRapido"
                                            checked={formData.rapido}
                                            onChange={(e) => setFormData({ ...formData, rapido: e.target.checked })}
                                            className="rounded border-slate-700 text-blue-600 focus:ring-0 w-4 h-4 bg-slate-950 cursor-pointer"
                                        />
                                        <label htmlFor="chkRapido" className="text-xs text-slate-300 cursor-pointer font-medium">
                                            Exibir nos botões de "Prefixos Rápidos" do formulário de produto
                                        </label>
                                    </div>
                                </>
                            )}

                            {/* Ativo */}
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="chkAtivo"
                                    checked={formData.ativo}
                                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                                    className="rounded border-slate-700 text-blue-600 focus:ring-0 w-4 h-4 bg-slate-950 cursor-pointer"
                                />
                                <label htmlFor="chkAtivo" className="text-xs text-slate-300 cursor-pointer font-medium">
                                    Registro Ativo
                                </label>
                            </div>

                            {/* Botões do Modal */}
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={modalSaving}
                                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 disabled:opacity-50"
                                >
                                    {modalSaving ? 'Salvando...' : 'Salvar Registro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast de Notificação */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-xs font-semibold backdrop-blur-md transition-all ${
                    toast.type === 'success' 
                        ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50' 
                        : 'bg-rose-950/95 border-rose-500/40 text-rose-200 shadow-rose-950/50'
                }`}>
                    {toast.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{toast.message}</span>
                    <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-white p-0.5">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {itemParaExcluir && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-rose-500/30 rounded-3xl w-full max-w-md text-slate-100 shadow-2xl overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-rose-500/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Confirmar Exclusão</h3>
                                    <p className="text-xs text-rose-300/80">Esta ação não pode ser desfeita</p>
                                </div>
                            </div>
                            <button
                                onClick={() => !excluindo && setItemParaExcluir(null)}
                                disabled={excluindo}
                                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-300">
                                Deseja realmente remover o registro abaixo do sistema?
                            </p>
                            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center gap-3">
                                <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 font-mono font-bold text-xs rounded-lg border border-blue-500/30">
                                    {itemParaExcluir.sigla || itemParaExcluir.codigo}
                                </span>
                                <span className="text-sm font-medium text-white truncate">
                                    {itemParaExcluir.descricao}
                                </span>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setItemParaExcluir(null)}
                                disabled={excluindo}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmarExcluir}
                                disabled={excluindo}
                                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                            >
                                {excluindo ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Excluindo...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Sim, Excluir
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Restauração de Padrões */}
            {isRestaurarModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-blue-500/30 rounded-3xl w-full max-w-md text-slate-100 shadow-2xl overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-blue-500/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                                    <RotateCcw className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Restaurar Padrões Protheus</h3>
                                    <p className="text-xs text-blue-300/80">Recarregar cadastros padrão de fábrica</p>
                                </div>
                            </div>
                            <button
                                onClick={() => !restaurando && setIsRestaurarModalOpen(false)}
                                disabled={restaurando}
                                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-3">
                            <p className="text-sm text-slate-300">
                                Deseja restaurar a lista padrão de Prefixos, Tipos, Unidades e Armazéns baseados na metodologia padrão do Protheus ERP?
                            </p>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Registros padrão que estiverem ausentes serão recriados sem apagar cadastros customizados já existentes.
                            </p>
                        </div>

                        <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setIsRestaurarModalOpen(false)}
                                disabled={restaurando}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmarRestauracao}
                                disabled={restaurando}
                                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/30 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                            >
                                {restaurando ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Restaurando...
                                    </>
                                ) : (
                                    <>
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Sim, Restaurar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
