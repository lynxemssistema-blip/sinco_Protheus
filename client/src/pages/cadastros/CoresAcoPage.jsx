import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { 
    Palette, Plus, Search, Edit2, Trash2, CheckCircle2, 
    AlertCircle, RefreshCw, X, Sparkles, RotateCcw
} from 'lucide-react';
import { toast } from 'react-toastify';

const CORES_PALETA_PRESET = [
    { nome: 'Branco', hex: '#FFFFFF' },
    { nome: 'Preto', hex: '#1E293B' },
    { nome: 'Vermelho', hex: '#DC2626' },
    { nome: 'Azul', hex: '#2563EB' },
    { nome: 'Amarelo', hex: '#EAB308' },
    { nome: 'Verde', hex: '#16A34A' },
    { nome: 'Laranja', hex: '#EA580C' },
    { nome: 'Marrom', hex: '#78350F' },
    { nome: 'Cinza', hex: '#64748B' },
    { nome: 'Dourado', hex: '#CA8A04' }
];

export default function CoresAcoPage() {
    const [cores, setCores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal de Cadastro/Edição
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [itemEditando, setItemEditando] = useState(null);
    const [formData, setFormData] = useState({
        codigo: '',
        significado: '',
        tipo_cor: 'solida',
        cor_primaria: '#FFFFFF',
        cor_secundaria: '#DC2626',
        descricao: ''
    });
    const [modalSaving, setModalSaving] = useState(false);

    // Modal de Exclusão
    const [itemParaExcluir, setItemParaExcluir] = useState(null);
    const [excluindo, setExcluindo] = useState(false);

    // Modal de Restauração de Padrões
    const [isRestaurarModalOpen, setIsRestaurarModalOpen] = useState(false);
    const [restaurando, setRestaurando] = useState(false);

    const carregarCores = async () => {
        setLoading(true);
        try {
            const res = await api.get('/erp/produtos/cores');
            setCores(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Erro ao carregar cores de aço:', err);
            toast.error('Erro ao carregar codificação de cores de aço.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarCores();
    }, []);

    const coresFiltradas = useMemo(() => {
        const termo = searchTerm.toLowerCase().trim();
        if (!termo) return cores;
        return cores.filter(item => {
            const cod = (item.codigo || '').toLowerCase();
            const sign = (item.significado || '').toLowerCase();
            const desc = (item.descricao || '').toLowerCase();
            return cod.includes(termo) || sign.includes(termo) || desc.includes(termo);
        });
    }, [cores, searchTerm]);

    const stats = useMemo(() => {
        const total = cores.length;
        const solidas = cores.filter(c => c.tipo_cor === 'solida').length;
        const bicolores = cores.filter(c => c.tipo_cor === 'bicolor').length;
        return { total, solidas, bicolores };
    }, [cores]);

    const abrirModalNovo = () => {
        setItemEditando(null);
        setFormData({
            codigo: '',
            significado: '',
            tipo_cor: 'solida',
            cor_primaria: '#FFFFFF',
            cor_secundaria: '#DC2626',
            descricao: ''
        });
        setIsModalOpen(true);
    };

    const abrirModalEditar = (item) => {
        setItemEditando(item);
        setFormData({
            codigo: item.codigo,
            significado: item.significado || '',
            tipo_cor: item.tipo_cor || 'solida',
            cor_primaria: item.cor_primaria || '#FFFFFF',
            cor_secundaria: item.cor_secundaria || '#DC2626',
            descricao: item.descricao || ''
        });
        setIsModalOpen(true);
    };

    const handleSalvar = async (e) => {
        e.preventDefault();
        if (!formData.codigo.trim()) {
            toast.warn('O código do aço é obrigatório.');
            return;
        }

        setModalSaving(true);
        try {
            const payload = {
                codigo: formData.codigo.trim().toUpperCase(),
                significado: formData.significado.trim(),
                tipo_cor: formData.tipo_cor,
                cor_primaria: formData.cor_primaria,
                cor_secundaria: formData.tipo_cor === 'bicolor' ? formData.cor_secundaria : null,
                descricao: formData.descricao.trim()
            };

            if (itemEditando) {
                await api.put(`/erp/produtos/cores/${itemEditando.id}`, payload);
                toast.success(`Cor para "${payload.codigo}" atualizada com sucesso!`);
            } else {
                await api.post('/erp/produtos/cores', payload);
                toast.success(`Cor para "${payload.codigo}" cadastrada com sucesso!`);
            }

            setIsModalOpen(false);
            carregarCores();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao salvar cor de aço.');
        } finally {
            setModalSaving(false);
        }
    };

    const confirmarExclusao = async () => {
        if (!itemParaExcluir) return;
        setExcluindo(true);
        try {
            await api.delete(`/erp/produtos/cores/${itemParaExcluir.id}`);
            toast.success(`Padrão "${itemParaExcluir.codigo}" removido com sucesso!`);
            setItemParaExcluir(null);
            carregarCores();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao remover cor de aço.');
        } finally {
            setExcluindo(false);
        }
    };

    const handleRestaurarPadroes = async () => {
        setRestaurando(true);
        try {
            const res = await api.post('/erp/produtos/cores/restaurar-padroes');
            toast.success(res.data?.message || 'Padrão industrial de cores de aço restaurado com sucesso!');
            setIsRestaurarModalOpen(false);
            carregarCores();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao restaurar padrão de cores.');
        } finally {
            setRestaurando(false);
        }
    };

    const renderSwatch = (item, sizeClass = 'w-7 h-7') => {
        const isBicolor = item.tipo_cor === 'bicolor' && item.cor_secundaria;
        const style = isBicolor
            ? { background: `linear-gradient(135deg, ${item.cor_primaria} 50%, ${item.cor_secundaria} 50%)` }
            : { backgroundColor: item.cor_primaria || '#FFFFFF' };

        return (
            <div
                className={`${sizeClass} rounded-full border border-gray-300 shadow-xs flex-shrink-0`}
                style={style}
                title={isBicolor ? `${item.cor_primaria} / ${item.cor_secundaria}` : item.cor_primaria}
            />
        );
    };

    return (
        <div className="space-y-4 p-2 md:p-4 font-sans text-gray-900">
            {/* Top Bar Header */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-xs border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600">
                        <Palette className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                                Codificação de Aço por Cores
                            </h1>
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                Padrão Visual
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                            Identificação visual na extremidade de barras e tarugos para controle de ligas metálicas no estoque e produção.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => setIsRestaurarModalOpen(true)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition shadow-xs"
                        title="Restaurar padrão industrial de cores de aço (SAE 1020, 1045, 4140, 8620, INOX, etc.)"
                    >
                        <RotateCcw className="w-4 h-4 text-gray-500" />
                        Restaurar Padrões
                    </button>

                    <button
                        onClick={abrirModalNovo}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-xs"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Cor de Aço
                    </button>

                    <button
                        onClick={carregarCores}
                        disabled={loading}
                        className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition shadow-xs"
                        title="Atualizar lista"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
                        <Palette className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Ligas</span>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{stats.total}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cores Sólidas</span>
                        <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.solidas}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cores Bicolores</span>
                        <p className="text-xl font-bold text-amber-600 mt-0.5">{stats.bicolores}</p>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-3 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por código de aço (ex: 1020, 1045) ou especificação..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Tabela de Dados */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-700">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
                            <tr>
                                <th className="py-3.5 px-4 w-24 text-center">Amostra</th>
                                <th className="py-3.5 px-4 w-40">Código do Aço</th>
                                <th className="py-3.5 px-4">Significado / Liga</th>
                                <th className="py-3.5 px-4 w-32 text-center">Padrão de Cor</th>
                                <th className="py-3.5 px-4 w-44">Tonalidades (Hex)</th>
                                <th className="py-3.5 px-4 w-28 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-gray-500">
                                        <div className="flex items-center justify-center gap-3">
                                            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                                            <span>Carregando cores de aço...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : coresFiltradas.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-gray-500">
                                        <div className="max-w-md mx-auto space-y-3">
                                            <p className="text-gray-600 font-medium">
                                                Nenhuma cor de aço cadastrada {searchTerm ? `para "${searchTerm}"` : 'para esta empresa'}.
                                            </p>
                                            {!searchTerm && (
                                                <button
                                                    onClick={() => setIsRestaurarModalOpen(true)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                    Criar Padrão Industrial de Cores de Aço
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                coresFiltradas.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="py-3.5 px-4 text-center">
                                            <div className="flex items-center justify-center">
                                                {renderSwatch(item)}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                                            {item.codigo}
                                        </td>
                                        <td className="py-3.5 px-4 text-gray-800 font-medium">
                                            {item.significado || '—'}
                                            {item.descricao && (
                                                <p className="text-xs text-gray-500 mt-0.5">{item.descricao}</p>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                item.tipo_cor === 'bicolor'
                                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            }`}>
                                                {item.tipo_cor === 'bicolor' ? 'Bicolor' : 'Sólida'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-xs text-gray-500">
                                            {item.tipo_cor === 'bicolor' ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: item.cor_primaria }} />
                                                    <span>{item.cor_primaria}</span>
                                                    <span>/</span>
                                                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: item.cor_secundaria }} />
                                                    <span>{item.cor_secundaria}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: item.cor_primaria }} />
                                                    <span>{item.cor_primaria}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => abrirModalEditar(item)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setItemParaExcluir(item)}
                                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                                    title="Excluir"
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
            </div>

            {/* Modal de Criação / Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Palette className="w-5 h-5 text-rose-600" />
                                {itemEditando ? 'Editar Cor de Aço' : 'Nova Cor de Aço'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Amostra ao Vivo */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-center gap-4">
                            {renderSwatch(formData, 'w-12 h-12')}
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase">Preview da Extremidade da Barra</p>
                                <p className="text-sm font-bold text-gray-900 mt-0.5">
                                    {formData.codigo || 'Código do Aço'} {formData.significado ? `- ${formData.significado}` : ''}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSalvar} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Código da Liga / Aço <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: SAE 1020, SAE 1045, SAE 4140, INOX 304"
                                    value={formData.codigo}
                                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3.5 py-2 text-sm font-mono text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Significado / Especificação da Liga
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Aço Carbono Baixo, Aço Beneficiado"
                                    value={formData.significado}
                                    onChange={(e) => setFormData({ ...formData, significado: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Padrão da Pintura
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, tipo_cor: 'solida' })}
                                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                                            formData.tipo_cor === 'solida'
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        Cor Sólida (1 Cor)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, tipo_cor: 'bicolor' })}
                                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                                            formData.tipo_cor === 'bicolor'
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        Bicolor (2 Cores)
                                    </button>
                                </div>
                            </div>

                            {/* Seletor de Cores */}
                            <div className="space-y-3 pt-2 border-t border-gray-100">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Cor Primária
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            value={formData.cor_primaria}
                                            onChange={(e) => setFormData({ ...formData, cor_primaria: e.target.value })}
                                            className="w-10 h-10 rounded-lg bg-transparent border border-gray-300 cursor-pointer p-0.5"
                                        />
                                        <input
                                            type="text"
                                            value={formData.cor_primaria}
                                            onChange={(e) => setFormData({ ...formData, cor_primaria: e.target.value })}
                                            className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                {formData.tipo_cor === 'bicolor' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Cor Secundária
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="color"
                                                value={formData.cor_secundaria}
                                                onChange={(e) => setFormData({ ...formData, cor_secundaria: e.target.value })}
                                                className="w-10 h-10 rounded-lg bg-transparent border border-gray-300 cursor-pointer p-0.5"
                                            />
                                            <input
                                                type="text"
                                                value={formData.cor_secundaria}
                                                onChange={(e) => setFormData({ ...formData, cor_secundaria: e.target.value })}
                                                className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Paleta Rápida */}
                                <div>
                                    <span className="text-[11px] text-gray-500 mb-1.5 block">Cores Rápidas de Fábrica:</span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {CORES_PALETA_PRESET.map((p) => (
                                            <button
                                                key={p.hex}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, cor_primaria: p.hex })}
                                                className="w-6 h-6 rounded-full border border-gray-300 shadow-2xs transition-transform hover:scale-125"
                                                style={{ backgroundColor: p.hex }}
                                                title={p.nome}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={modalSaving}
                                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition flex items-center gap-2"
                                >
                                    {modalSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    {itemEditando ? 'Salvar Alterações' : 'Cadastrar Cor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {itemParaExcluir && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
                        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-base font-bold text-gray-900">Remover Padrão de Cor?</h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Tem certeza que deseja remover o código <span className="text-gray-900 font-mono font-bold">"{itemParaExcluir.codigo}"</span>?
                            </p>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                onClick={() => setItemParaExcluir(null)}
                                className="flex-1 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmarExclusao}
                                disabled={excluindo}
                                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition flex items-center justify-center gap-2"
                            >
                                {excluindo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Excluir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Restauração de Padrões Industriais */}
            {isRestaurarModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
                        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                            <RotateCcw className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-base font-bold text-gray-900">Criar / Restaurar Padrão de Cores?</h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Isso irá carregar as 12 ligas e cores industriais de aço padrão (SAE 1020, SAE 1045, SAE 4140, SAE 8620, SAE 4340, INOX 304, INOX 316, A36, VC 131, VND, etc.) para esta empresa.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                onClick={() => setIsRestaurarModalOpen(false)}
                                className="flex-1 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRestaurarPadroes}
                                disabled={restaurando}
                                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition flex items-center justify-center gap-2"
                            >
                                {restaurando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Restaurar Padrões'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
