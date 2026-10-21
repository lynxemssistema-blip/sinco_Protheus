import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { 
    Layers, Plus, Search, Edit2, Trash2, CheckCircle2, 
    AlertCircle, RefreshCw, X, Sliders, FileText, ArrowRight,
    Tag, Sparkles, Hash
} from 'lucide-react';
import { toast } from 'react-toastify';

export default function TemplatesProdutoPage() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [tiposDisponiveis, setTiposDisponiveis] = useState([]);

    // Modal de Edição / Criação de Modelo
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [formData, setFormData] = useState({
        nome: '',
        tipo_produto: 'MP',
        descricao_mascara: '',
        ativo: true,
        campos: []
    });
    const [saving, setSaving] = useState(false);

    // Modal de Exclusão
    const [itemParaExcluir, setItemParaExcluir] = useState(null);
    const [excluindo, setExcluindo] = useState(false);

    const carregarDados = async () => {
        setLoading(true);
        try {
            const [resTemplates, resTipos] = await Promise.all([
                api.get('/cadastros-basicos/templates'),
                api.get('/cadastros-basicos/tipos')
            ]);
            setTemplates(resTemplates.data?.templates || []);
            setTiposDisponiveis(resTipos.data?.tipos || []);
        } catch (err) {
            console.error('Erro ao carregar templates:', err);
            toast.error('Erro ao carregar modelos de formulário.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDados();
    }, []);

    const templatesFiltrados = useMemo(() => {
        const termo = searchTerm.toLowerCase().trim();
        if (!termo) return templates;
        return templates.filter(t => 
            (t.nome || '').toLowerCase().includes(termo) ||
            (t.tipo_produto || '').toLowerCase().includes(termo) ||
            (t.descricao_mascara || '').toLowerCase().includes(termo)
        );
    }, [templates, searchTerm]);

    const abrirModalNovo = () => {
        setEditingTemplate(null);
        setFormData({
            nome: '',
            tipo_produto: tiposDisponiveis[0]?.codigo || 'MP',
            descricao_mascara: '',
            ativo: true,
            campos: [
                { campo_chave: 'medida', label: 'Dimensão / Medida', tipo_input: 'text', opcoes_select: '', unidade: 'mm', obrigatorio: true, ordem: 1 }
            ]
        });
        setIsModalOpen(true);
    };

    const abrirModalEditar = (tpl) => {
        setEditingTemplate(tpl);
        setFormData({
            nome: tpl.nome || '',
            tipo_produto: tpl.tipo_produto || 'MP',
            descricao_mascara: tpl.descricao_mascara || '',
            ativo: Boolean(tpl.ativo),
            campos: (tpl.campos || []).map(c => ({
                id: c.id,
                campo_chave: c.campo_chave || '',
                campo_destino: c.campo_destino || 'atributos_json',
                label: c.label || '',
                tipo_input: c.tipo_input || 'text',
                opcoes_select: c.opcoes_select || '',
                unidade: c.unidade || '',
                obrigatorio: Boolean(c.obrigatorio),
                ordem: c.ordem || 1
            }))
        });
        setIsModalOpen(true);
    };

    const adicionarCampo = () => {
        setFormData(prev => ({
            ...prev,
            campos: [
                ...prev.campos,
                {
                    campo_chave: `campo_${prev.campos.length + 1}`,
                    campo_destino: 'atributos_json',
                    label: '',
                    tipo_input: 'text',
                    opcoes_select: '',
                    unidade: '',
                    obrigatorio: false,
                    ordem: prev.campos.length + 1
                }
            ]
        }));
    };

    const removerCampo = (idx) => {
        setFormData(prev => ({
            ...prev,
            campos: prev.campos.filter((_, i) => i !== idx)
        }));
    };

    const atualizarCampo = (idx, key, value) => {
        setFormData(prev => {
            const novos = [...prev.campos];
            novos[idx] = { ...novos[idx], [key]: value };
            // Gera campo_chave amigável a partir do label se ainda não foi customizado
            if (key === 'label' && (!novos[idx].campo_chave || novos[idx].campo_chave.startsWith('campo_'))) {
                novos[idx].campo_chave = value
                    .toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]/g, '_')
                    .replace(/^_+|_+$/g, '');
            }
            return { ...prev, campos: novos };
        });
    };

    const handleSalvar = async (e) => {
        e.preventDefault();
        if (!formData.nome.trim()) {
            toast.warn('Informe o nome do modelo.');
            return;
        }
        if (!formData.tipo_produto) {
            toast.warn('Selecione o tipo de produto (B1_TIPO).');
            return;
        }

        setSaving(true);
        try {
            if (editingTemplate) {
                await api.put(`/cadastros-basicos/templates/${editingTemplate.id}`, formData);
                toast.success('Modelo atualizado com sucesso!');
            } else {
                await api.post('/cadastros-basicos/templates', formData);
                toast.success('Modelo criado com sucesso!');
            }
            setIsModalOpen(false);
            carregarDados();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao salvar modelo.');
        } finally {
            setSaving(false);
        }
    };

    const handleExcluir = async () => {
        if (!itemParaExcluir) return;
        setExcluindo(true);
        try {
            await api.delete(`/cadastros-basicos/templates/${itemParaExcluir.id}`);
            toast.success('Modelo excluído com sucesso!');
            setItemParaExcluir(null);
            carregarDados();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao excluir modelo.');
        } finally {
            setExcluindo(false);
        }
    };

    return (
        <div className="space-y-4 p-2 md:p-4 font-sans text-gray-900">
            {/* Top Bar Header */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-xs border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                        <Sliders className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                                Matriz de Formulários Específicos
                            </h1>
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Multi-Empresa
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                            Configure campos personalizados e caixas de entrada dinâmicas por família/tipo de produto (ex: Parafusos, Chapas, Motores).
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={carregarDados}
                        disabled={loading}
                        className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition shadow-xs"
                        title="Atualizar lista"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                        onClick={abrirModalNovo}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-xs"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Modelo de Formulário
                    </button>
                </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Modelos Criados</span>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{templates.length}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Modelos Ativos</span>
                        <p className="text-xl font-bold text-emerald-600 mt-0.5">
                            {templates.filter(t => t.ativo).length}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                        <Hash className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Campos Mapeados</span>
                        <p className="text-xl font-bold text-amber-600 mt-0.5">
                            {templates.reduce((acc, t) => acc + (t.campos?.length || 0), 0)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-3 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por nome do modelo, tipo ou máscara de descrição..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                </div>
            </div>

            {/* Cards Grid de Modelos */}
            {loading ? (
                <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Carregando modelos de formulário...</p>
                </div>
            ) : templatesFiltrados.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-xl border border-gray-200 space-y-3">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto">
                        <Layers className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Nenhum modelo de formulário encontrado</h3>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                        Crie perfis específicos para acelerar e padronizar o cadastro de itens industriais (Fixadores, Chapas, Motores, etc.).
                    </p>
                    <button
                        onClick={abrirModalNovo}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                    >
                        <Plus className="w-4 h-4" /> Criar Primeiro Modelo
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templatesFiltrados.map((tpl) => (
                        <div key={tpl.id} className="bg-white rounded-xl border border-gray-200 shadow-xs hover:shadow-md transition p-4 flex flex-col justify-between space-y-3">
                            <div>
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200 mb-1">
                                            Tipo: {tpl.tipo_produto}
                                        </span>
                                        <h3 className="text-base font-bold text-gray-900 leading-tight">
                                            {tpl.nome}
                                        </h3>
                                    </div>
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                        tpl.ativo 
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                            : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {tpl.ativo ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>

                                {tpl.descricao_mascara && (
                                    <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-mono text-slate-700">
                                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Fórmula de Descrição</span>
                                        {tpl.descricao_mascara}
                                    </div>
                                )}

                                <div className="mt-3">
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                                        Campos Configurados ({tpl.campos?.length || 0}):
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                        {(tpl.campos || []).map((c, i) => (
                                            <span 
                                                key={i} 
                                                className="px-2 py-0.5 text-[11px] bg-gray-100 text-gray-700 rounded-md border border-gray-200 flex items-center gap-1"
                                                title={`Chave: ${c.campo_chave} | Tipo: ${c.tipo_input} ${c.unidade ? `(${c.unidade})` : ''}`}
                                            >
                                                {c.label || c.campo_chave}
                                                {c.obrigatorio && <span className="text-red-500 font-bold">*</span>}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                                <button
                                    onClick={() => abrirModalEditar(tpl)}
                                    className="px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition flex items-center gap-1"
                                >
                                    <Edit2 className="w-3.5 h-3.5" /> Editar
                                </button>
                                <button
                                    onClick={() => setItemParaExcluir(tpl)}
                                    className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                                    title="Excluir modelo"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Criação / Edição de Modelo */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-fadeIn">
                        <div className="flex items-center justify-between py-3 px-5 border-b border-gray-200 bg-gray-50/90 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg shadow-2xs">
                                    <Sliders className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900 leading-tight">
                                        {editingTemplate ? `Editar Modelo: ${editingTemplate.nome}` : 'Novo Modelo de Formulário Específico'}
                                    </h2>
                                    <p className="text-[11px] text-gray-500">
                                        Defina as caixas de entrada e regras de descrição técnica para este perfil.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSalvar} className="p-5 overflow-y-auto flex-1 space-y-4">
                            {/* Identificação Geral */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <div className="sm:col-span-6">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Nome do Perfil / Modelo *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Fixadores & Parafusos, Chapas de Aço, Motores"
                                        value={formData.nome}
                                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                        className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                                    />
                                </div>

                                <div className="sm:col-span-3">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Tipo Produto (B1_TIPO) *
                                    </label>
                                    <select
                                        value={formData.tipo_produto}
                                        onChange={(e) => setFormData({ ...formData, tipo_produto: e.target.value })}
                                        className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                                    >
                                        {tiposDisponiveis.map(t => (
                                            <option key={t.codigo} value={t.codigo}>
                                                {t.codigo} - {t.descricao}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-3 flex items-center pt-5">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={formData.ativo}
                                            onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                                            className="w-4 h-4 text-indigo-600 rounded-sm border-gray-300 focus:ring-indigo-500"
                                        />
                                        Perfil Ativo
                                    </label>
                                </div>
                            </div>

                            {/* Fórmula da Descrição Automática */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Máscara / Fórmula de Descrição Automática (Opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: PARAFUSO {tipo_cabeca} {diametro} X {comprimento} {material}"
                                    value={formData.descricao_mascara}
                                    onChange={(e) => setFormData({ ...formData, descricao_mascara: e.target.value })}
                                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
                                />
                                <span className="text-[10px] text-gray-500 mt-0.5 block">
                                    Dica: Use as chaves entre chaves correspondentes ao nome da chave do campo (ex: <code className="bg-gray-100 px-1 rounded font-bold">{"{diametro}"}</code>).
                                </span>
                            </div>

                            {/* Seção de Campos da Matriz */}
                            <div className="pt-2 border-t border-gray-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                                            Campos & Caixas do Formulário ({formData.campos.length})
                                        </h3>
                                        <p className="text-[11px] text-gray-500">
                                            Estes campos aparecerão organizados para o usuário ao cadastrar itens desta família.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={adicionarCampo}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Adicionar Campo
                                    </button>
                                </div>

                                <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
                                    {formData.campos.map((campo, idx) => (
                                        <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-12 gap-2 items-center">
                                            {/* Rótulo / Label */}
                                            <div className="col-span-4">
                                                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">
                                                    Rótulo visível (Label) *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Ex: Diâmetro da Rosca"
                                                    value={campo.label}
                                                    onChange={(e) => atualizarCampo(idx, 'label', e.target.value)}
                                                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>

                                            {/* Tipo de Entrada */}
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">
                                                    Tipo Entrada
                                                </label>
                                                <select
                                                    value={campo.tipo_input}
                                                    onChange={(e) => atualizarCampo(idx, 'tipo_input', e.target.value)}
                                                    className="w-full text-xs px-2 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500"
                                                >
                                                    <option value="text">Texto</option>
                                                    <option value="number">Número</option>
                                                    <option value="select">Seleção (Lista)</option>
                                                    <option value="textarea">Área de Texto</option>
                                                </select>
                                            </div>

                                            {/* Opções de Seleção ou Unidade */}
                                            <div className="col-span-3">
                                                {campo.tipo_input === 'select' ? (
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-600 mb-0.5">
                                                            Opções (sep. por vírgula)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            placeholder="Ex: M4, M6, M8, M10"
                                                            value={campo.opcoes_select || ''}
                                                            onChange={(e) => atualizarCampo(idx, 'opcoes_select', e.target.value)}
                                                            className="w-full text-xs px-2 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-600 mb-0.5">
                                                            Unidade (Ex: mm, pol, kg)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            placeholder="mm, kg, V, etc"
                                                            value={campo.unidade || ''}
                                                            onChange={(e) => atualizarCampo(idx, 'unidade', e.target.value)}
                                                            className="w-full text-xs px-2 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Obrigatório */}
                                            <div className="col-span-2 flex items-center justify-center pt-3">
                                                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-700 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={campo.obrigatorio}
                                                        onChange={(e) => atualizarCampo(idx, 'obrigatorio', e.target.checked)}
                                                        className="w-3.5 h-3.5 text-indigo-600 rounded-sm border-gray-300"
                                                    />
                                                    Obrigatório
                                                </label>
                                            </div>

                                            {/* Botão Remover */}
                                            <div className="col-span-1 flex justify-end pt-3">
                                                <button
                                                    type="button"
                                                    onClick={() => removerCampo(idx)}
                                                    className="p-1 text-gray-400 hover:text-red-600 transition"
                                                    title="Remover campo"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition disabled:opacity-50"
                                >
                                    {saving ? 'Salvando...' : 'Salvar Modelo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {itemParaExcluir && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4">
                        <div className="flex items-center gap-3 text-red-600">
                            <AlertCircle className="w-6 h-6" />
                            <h3 className="font-bold text-base text-gray-900">Excluir Modelo?</h3>
                        </div>
                        <p className="text-xs text-gray-600">
                            Tem certeza que deseja excluir o modelo <strong>"{itemParaExcluir.nome}"</strong>? 
                            Produtos já cadastrados não perderão dados históricos.
                        </p>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => setItemParaExcluir(null)}
                                className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExcluir}
                                disabled={excluindo}
                                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                            >
                                {excluindo ? 'Excluindo...' : 'Excluir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
