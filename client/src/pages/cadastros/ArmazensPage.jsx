import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { 
    Building2, Plus, Search, Edit2, Trash2, CheckCircle2, 
    AlertCircle, RefreshCw, X, RotateCcw, Box
} from 'lucide-react';
import { toast } from 'react-toastify';

export default function ArmazensPage() {
    const [armazens, setArmazens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal de Cadastro/Edição
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [itemEditando, setItemEditando] = useState(null);
    const [formData, setFormData] = useState({
        codigo: '',
        descricao: '',
        ativo: true
    });
    const [modalSaving, setModalSaving] = useState(false);

    // Modal de Exclusão
    const [itemParaExcluir, setItemParaExcluir] = useState(null);
    const [excluindo, setExcluindo] = useState(false);

    // Modal de Restauração de Padrões
    const [isRestaurarModalOpen, setIsRestaurarModalOpen] = useState(false);
    const [restaurando, setRestaurando] = useState(false);

    const carregarArmazens = async () => {
        setLoading(true);
        try {
            const res = await api.get('/cadastros-basicos/armazens');
            setArmazens(res.data?.armazens || []);
        } catch (err) {
            console.error('Erro ao carregar armazéns:', err);
            toast.error('Erro ao carregar lista de armazéns.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarArmazens();
    }, []);

    const armazensFiltrados = useMemo(() => {
        const termo = searchTerm.toLowerCase().trim();
        if (!termo) return armazens;
        return armazens.filter(item => {
            const cod = (item.codigo || '').toLowerCase();
            const desc = (item.descricao || '').toLowerCase();
            return cod.includes(termo) || desc.includes(termo);
        });
    }, [armazens, searchTerm]);

    const stats = useMemo(() => {
        const total = armazens.length;
        const ativos = armazens.filter(a => a.ativo).length;
        const padraoAlmox = armazens.find(a => a.codigo === '01');
        return { total, ativos, padraoAlmox: padraoAlmox?.descricao || '01 - Padrão' };
    }, [armazens]);

    const abrirModalNovo = () => {
        setItemEditando(null);
        setFormData({
            codigo: '',
            descricao: '',
            ativo: true
        });
        setIsModalOpen(true);
    };

    const abrirModalEditar = (item) => {
        setItemEditando(item);
        setFormData({
            codigo: item.codigo,
            descricao: item.descricao,
            ativo: Boolean(item.ativo)
        });
        setIsModalOpen(true);
    };

    const handleSalvar = async (e) => {
        e.preventDefault();
        if (!formData.codigo.trim()) {
            toast.warn('O código do armazém/local é obrigatório.');
            return;
        }

        setModalSaving(true);
        try {
            const payload = {
                codigo: formData.codigo.trim().toUpperCase(),
                descricao: formData.descricao.trim() || formData.codigo.trim().toUpperCase(),
                ativo: formData.ativo ? 1 : 0
            };

            if (itemEditando) {
                await api.put(`/cadastros-basicos/armazens/${itemEditando.id}`, payload);
                toast.success(`Armazém "${payload.codigo}" atualizado com sucesso!`);
            } else {
                await api.post('/cadastros-basicos/armazens', payload);
                toast.success(`Armazém "${payload.codigo}" cadastrado com sucesso!`);
            }

            setIsModalOpen(false);
            carregarArmazens();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao salvar armazém.');
        } finally {
            setModalSaving(false);
        }
    };

    const confirmarExclusao = async () => {
        if (!itemParaExcluir) return;
        setExcluindo(true);
        try {
            await api.delete(`/cadastros-basicos/armazens/${itemParaExcluir.id}`);
            toast.success(`Armazém "${itemParaExcluir.codigo}" removido com sucesso!`);
            setItemParaExcluir(null);
            carregarArmazens();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao remover armazém.');
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
            carregarArmazens();
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
                    <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-xl text-cyan-600">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                                Armazéns e Locais de Estoque (B1_LOCPAD)
                            </h1>
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                                B1_LOCPAD
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                            Locais físicos e contábeis de estocagem (Almoxarifado Central, Produção, Almoxarifado Secundário, etc.).
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
                        Novo Armazém
                    </button>

                    <button
                        onClick={carregarArmazens}
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
                    <div className="p-2.5 bg-cyan-50 text-cyan-600 rounded-lg">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Armazéns</span>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{stats.total}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Armazéns Ativos</span>
                        <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.ativos}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        <Box className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Local Principal (01)</span>
                        <p className="text-sm font-bold text-gray-800 mt-0.5 truncate max-w-[180px]">{stats.padraoAlmox}</p>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-3 rounded-xl shadow-xs border border-gray-200 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por código ou descrição do armazém..."
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
                                <th className="py-3.5 px-4 w-36">Código (LOCPAD)</th>
                                <th className="py-3.5 px-4">Descrição do Armazém / Local</th>
                                <th className="py-3.5 px-4 w-28 text-center">Status</th>
                                <th className="py-3.5 px-4 w-28 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center text-gray-500">
                                        <div className="flex items-center justify-center gap-3">
                                            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                                            <span>Carregando armazéns...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : armazensFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center text-gray-500">
                                        Nenhum armazém encontrado {searchTerm ? `para "${searchTerm}"` : ''}.
                                    </td>
                                </tr>
                            ) : (
                                armazensFiltrados.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="py-3.5 px-4 font-mono font-bold text-cyan-600 text-base">
                                            {item.codigo}
                                        </td>
                                        <td className="py-3.5 px-4 text-gray-900 font-medium">
                                            {item.descricao}
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
                                <Building2 className="w-5 h-5 text-cyan-600" />
                                {itemEditando ? 'Editar Armazém' : 'Novo Armazém'}
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
                                    Código do Armazém (B1_LOCPAD) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={10}
                                    placeholder="Ex: 01, 02, 99, EXP"
                                    value={formData.codigo}
                                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3.5 py-2 text-sm font-mono text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Descrição do Local / Almoxarifado <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Almoxarifado Central, Estoque de Matéria-Prima"
                                    value={formData.descricao}
                                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="pt-2 border-t border-gray-100">
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={formData.ativo}
                                        onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-0"
                                    />
                                    <span className="text-xs text-gray-700">
                                        Armazém ativo para movimentações
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
                                    {itemEditando ? 'Salvar Alterações' : 'Cadastrar Armazém'}
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
                            <h3 className="text-base font-bold text-gray-900">Remover Armazém?</h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Tem certeza que deseja remover o armazém <span className="text-cyan-600 font-mono font-bold">"{itemParaExcluir.codigo}"</span>?
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
                                Isso irá restabelecer os armazéns canônicos da TOTVS (01 - Almoxarifado Central, 02 - Produção, etc.) caso estejam ausentes.
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
