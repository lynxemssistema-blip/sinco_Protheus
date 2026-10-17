import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { 
    Database, Hash, Tag, Scale, Building2, Plus, Search, 
    Edit2, Trash2, CheckCircle2, AlertCircle, RefreshCw, X,
    RotateCcw, Sparkles, Check, ArrowRight
} from 'lucide-react';

export default function CadastrosBasicosPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab') || 'prefixos';
    const [activeTab, setActiveTab] = useState(tabFromUrl);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['prefixos', 'tipos', 'unidades', 'armazens'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const handleTabChange = (tabKey) => {
        setActiveTab(tabKey);
        setSearchParams({ tab: tabKey });
    };

    // Estados de dados
    const [prefixos, setPrefixos] = useState([]);
    const [tipos, setTipos] = useState([]);
    const [unidades, setUnidades] = useState([]);
    const [armazens, setArmazens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal de Cadastro/Edição
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
            const res = await api.get('/cadastros-basicos/todos');
            setPrefixos(res.data?.prefixos || []);
            setTipos(res.data?.tipos || []);
            setUnidades(res.data?.unidades || []);
            setArmazens(res.data?.armazens || []);
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

    const abasConfig = [
        { id: 'prefixos', label: 'Prefixos (Famílias)', icone: Hash, count: prefixos.length },
        { id: 'tipos', label: 'Tipos (B1_TIPO)', icone: Tag, count: tipos.length },
        { id: 'unidades', label: 'Unidades (B1_UM)', icone: Scale, count: unidades.length },
        { id: 'armazens', label: 'Armazéns (B1_LOCPAD)', icone: Building2, count: armazens.length },
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
                        Gerenciamento multi-empresa de Prefixos/Famílias, Tipos de Produto, Unidades de Medida e Armazéns.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => setIsRestaurarModalOpen(true)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors shadow"
                        title="Restaurar padrões de fábrica do Protheus"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                        Restaurar Padrões
                    </button>

                    <button
                        onClick={abrirModalNovo}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        Novo {activeTab === 'prefixos' ? 'Prefixo' : activeTab === 'tipos' ? 'Tipo' : activeTab === 'unidades' ? 'Unidade' : 'Armazém'}
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

            {/* Tabela de Itens */}
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
