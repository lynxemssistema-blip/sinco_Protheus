import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { 
    Hash, Plus, Search, Edit2, Trash2, CheckCircle2, 
    AlertCircle, RefreshCw, X, RotateCcw, Sparkles
} from 'lucide-react';
import { toast } from 'react-toastify';

export default function PrefixosPage() {
    const [prefixos, setPrefixos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal de Cadastro/Edição
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [itemEditando, setItemEditando] = useState(null);
    const [formData, setFormData] = useState({
        sigla: '',
        descricao: '',
        padrao_sequencial: '0001',
        rapido: true,
        ativo: true
    });
    const [modalSaving, setModalSaving] = useState(false);

    // Modal de Exclusão
    const [itemParaExcluir, setItemParaExcluir] = useState(null);
    const [excluindo, setExcluindo] = useState(false);

    // Modal de Restauração de Padrões
    const [isRestaurarModalOpen, setIsRestaurarModalOpen] = useState(false);
    const [restaurando, setRestaurando] = useState(false);

    const carregarPrefixos = async () => {
        setLoading(true);
        try {
            const res = await api.get('/cadastros-basicos/prefixos');
            setPrefixos(res.data?.prefixos || []);
        } catch (err) {
            console.error('Erro ao carregar prefixos:', err);
            toast.error('Erro ao carregar lista de prefixos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarPrefixos();
    }, []);

    const prefixosFiltrados = useMemo(() => {
        const termo = searchTerm.toLowerCase().trim();
        if (!termo) return prefixos;
        return prefixos.filter(item => {
            const sigla = (item.sigla || '').toLowerCase();
            const desc = (item.descricao || '').toLowerCase();
            return sigla.includes(termo) || desc.includes(termo);
        });
    }, [prefixos, searchTerm]);

    const stats = useMemo(() => {
        const total = prefixos.length;
        const rapidos = prefixos.filter(p => p.rapido).length;
        const ativos = prefixos.filter(p => p.ativo).length;
        return { total, rapidos, ativos };
    }, [prefixos]);

    const abrirModalNovo = () => {
        setItemEditando(null);
        setFormData({
            sigla: '',
            descricao: '',
            padrao_sequencial: '0001',
            rapido: true,
            ativo: true
        });
        setIsModalOpen(true);
    };

    const abrirModalEditar = (item) => {
        setItemEditando(item);
        setFormData({
            sigla: item.sigla,
            descricao: item.descricao,
            padrao_sequencial: item.padrao_sequencial || '0001',
            rapido: Boolean(item.rapido),
            ativo: Boolean(item.ativo)
        });
        setIsModalOpen(true);
    };

    const handleSalvar = async (e) => {
        e.preventDefault();
        if (!formData.sigla.trim()) {
            toast.warn('A sigla do prefixo é obrigatória.');
            return;
        }

        setModalSaving(true);
        try {
            const payload = {
                sigla: formData.sigla.trim().toUpperCase(),
                descricao: formData.descricao.trim() || formData.sigla.trim().toUpperCase(),
                padrao_sequencial: formData.padrao_sequencial || '0001',
                rapido: formData.rapido ? 1 : 0,
                ativo: formData.ativo ? 1 : 0
            };

            if (itemEditando) {
                await api.put(`/cadastros-basicos/prefixos/${itemEditando.id}`, payload);
                toast.success(`Prefixo "${payload.sigla}" atualizado com sucesso!`);
            } else {
                await api.post('/cadastros-basicos/prefixos', payload);
                toast.success(`Prefixo "${payload.sigla}" cadastrado com sucesso!`);
            }

            setIsModalOpen(false);
            carregarPrefixos();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao salvar prefixo.');
        } finally {
            setModalSaving(false);
        }
    };

    const confirmarExclusao = async () => {
        if (!itemParaExcluir) return;
        setExcluindo(true);
        try {
            await api.delete(`/cadastros-basicos/prefixos/${itemParaExcluir.id}`);
            toast.success(`Prefixo "${itemParaExcluir.sigla}" removido com sucesso!`);
            setItemParaExcluir(null);
            carregarPrefixos();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao remover prefixo.');
        } finally {
            setExcluindo(false);
        }
    };

    const handleRestaurarPadroes = async () => {
        setRestaurando(true);
        try {
            await api.post('/cadastros-basicos/restaurar-padroes');
            toast.success('Padrões restaurados com sucesso!');
            setIsRestaurarModalOpen(false);
            carregarPrefixos();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao restaurar padrões.');
        } finally {
            setRestaurando(false);
        }
    };

    return (
        <div className="space-y-4 p-2 md:p-4 font-sans text-gray-900">
            {/* Top Bar Header */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-xs border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-600">
                        <Hash className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                                Prefixos e Famílias de Produtos
                            </h1>
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                B1_COD
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                            Controla a codificação inicial (<span className="text-amber-600 font-mono font-bold">B1_COD</span>) e a sequência automática de novos produtos no ERP.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => setIsRestaurarModalOpen(true)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition shadow-xs"
                        title="Restaurar padrões de fábrica do Protheus"
                    >
                        <RotateCcw className="w-4 h-4 text-gray-500" />
                        Restaurar Padrões
                    </button>

                    <button
                        onClick={abrirModalNovo}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-xs"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Prefixo
                    </button>

                    <button
                        onClick={carregarPrefixos}
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
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                        <Hash className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Famílias</span>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{stats.total}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Atalhos Rápidos</span>
                        <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.rapidos}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Prefixos Ativos</span>
                        <p className="text-xl font-bold text-blue-600 mt-0.5">{stats.ativos}</p>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-3 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por sigla ou descrição da família..."
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
                                <th className="py-3.5 px-4 w-36">Prefixo / Sigla</th>
                                <th className="py-3.5 px-4">Descrição da Família</th>
                                <th className="py-3.5 px-4 w-40">Sequencial Inicial</th>
                                <th className="py-3.5 px-4 w-36 text-center">Atalho Rápido</th>
                                <th className="py-3.5 px-4 w-28 text-center">Status</th>
                                <th className="py-3.5 px-4 w-28 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-gray-500">
                                        <div className="flex items-center justify-center gap-3">
                                            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                                            <span>Carregando prefixos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : prefixosFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-gray-500">
                                        Nenhum prefixo encontrado {searchTerm ? `para "${searchTerm}"` : ''}.
                                    </td>
                                </tr>
                            ) : (
                                prefixosFiltrados.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="py-3.5 px-4 font-mono font-bold text-amber-600 text-base">
                                            {item.sigla}
                                        </td>
                                        <td className="py-3.5 px-4 text-gray-900 font-medium">
                                            {item.descricao}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-gray-500">
                                            {item.padrao_sequencial || '0001'}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            {item.rapido ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <Sparkles className="w-3 h-3" /> Sim
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">Não</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                item.ativo 
                                                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                            }`}>
                                                {item.ativo ? 'Ativo' : 'Inativo'}
                                            </span>
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
                                <Hash className="w-5 h-5 text-amber-600" />
                                {itemEditando ? 'Editar Prefixo' : 'Novo Prefixo'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSalvar} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Sigla do Prefixo <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: MT2, GAB, PRD-1"
                                    value={formData.sigla}
                                    onChange={(e) => setFormData({ ...formData, sigla: e.target.value.toUpperCase() })}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3.5 py-2 text-sm font-mono text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Descrição da Família <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Lynx EMS Fabricação, Parafuso Sextavado"
                                    value={formData.descricao}
                                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Padrão Sequencial Inicial
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 0001 ou 000001"
                                    value={formData.padrao_sequencial}
                                    onChange={(e) => setFormData({ ...formData, padrao_sequencial: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3.5 py-2 text-sm font-mono text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-[11px] text-gray-500 mt-1">
                                    Formatação numérica após o prefixo (ex: PRD-000001).
                                </p>
                            </div>

                            <div className="pt-2 border-t border-gray-100 space-y-2.5">
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={formData.rapido}
                                        onChange={(e) => setFormData({ ...formData, rapido: e.target.checked })}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-0"
                                    />
                                    <span className="text-xs text-gray-700">
                                        Exibir no atalho rápido do modal de cadastro de produtos
                                    </span>
                                </label>

                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={formData.ativo}
                                        onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-0"
                                    />
                                    <span className="text-xs text-gray-700">
                                        Prefixo ativo para uso
                                    </span>
                                </label>
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
                                    {itemEditando ? 'Salvar Alterações' : 'Cadastrar Prefixo'}
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
                            <h3 className="text-base font-bold text-gray-900">Remover Prefixo?</h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Tem certeza que deseja remover o prefixo <span className="text-amber-600 font-mono font-bold">"{itemParaExcluir.sigla}"</span>?
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

            {/* Modal de Restauração de Padrões */}
            {isRestaurarModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
                        <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                            <RotateCcw className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-base font-bold text-gray-900">Restaurar Padrões?</h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Isso irá restabelecer os prefixos e padrões de fábrica da TOTVS/Protheus caso estejam ausentes.
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
                                className="flex-1 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition flex items-center justify-center gap-2"
                            >
                                {restaurando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Restaurar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
