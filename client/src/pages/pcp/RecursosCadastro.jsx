import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Cpu, Plus, Edit2, Trash2, Power, AlertCircle, Loader2,
    CheckCircle, X, Save, Search, Link as LinkIcon,
    Layers, Wrench, Clock, Filter, Eye, ChevronRight,
    Building2, Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { toast } from 'react-toastify';

const TIPO_CONFIG = {
    MA: { label: 'Máquina', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: Cpu },
    MO: { label: 'Mão de Obra', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Wrench },
    CT: { label: 'Centro de Trabalho', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Layers },
    OUTRO: { label: 'Outro', bg: 'bg-slate-100 text-slate-700 border-slate-200', icon: Cpu }
};

// ─── Modal de Criação / Edição de Recurso ──────────────────────────────────────
function RecursoModal({ recurso, onClose, onSave, isSuperAdmin, empresas }) {
    const isEdit = Boolean(recurso);
    const [form, setForm] = useState({
        codigo: recurso?.codigo || '',
        nome: recurso?.nome || '',
        tipo: recurso?.tipo || 'MA',
        descricao: recurso?.descricao || '',
        capacidade_padrao: recurso?.capacidade_padrao || '',
        ativo: recurso?.ativo !== undefined ? Boolean(recurso.ativo) : true,
        IdEmpresa: recurso?.IdEmpresa || (empresas?.length > 0 ? empresas[0].IdEmpresa : 1)
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const cod = form.codigo.trim().toUpperCase();
        const nome = form.nome.trim();

        if (!cod) {
            toast.warning('O código do recurso é obrigatório.');
            return;
        }
        if (!nome) {
            toast.warning('O nome/descrição é obrigatório.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                nome,
                tipo: form.tipo,
                descricao: form.descricao.trim(),
                capacidade_padrao: form.capacidade_padrao ? parseFloat(form.capacidade_padrao) : 0,
                ativo: form.ativo ? 1 : 0
            };
            if (isSuperAdmin && form.IdEmpresa) {
                payload.IdEmpresa = form.IdEmpresa;
            }

            if (isEdit) {
                await api.put(`/pcp-setores/catalogo-recursos/${recurso.id}`, payload);
                toast.success('Recurso atualizado com sucesso!');
            } else {
                payload.codigo = cod;
                await api.post('/pcp-setores/catalogo-recursos', payload);
                toast.success(`Recurso ${cod} cadastrado com sucesso!`);
            }
            onSave();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao salvar recurso.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800">
                                {isEdit ? 'Editar Recurso' : 'Novo Recurso no Catálogo'}
                            </h2>
                            <p className="text-xs text-slate-400">
                                {isEdit ? `Atualizando informações de ${recurso.codigo}` : 'Cadastre máquinas ou centros de trabalho por empresa'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Seletor de Empresa para SuperAdmin */}
                    {isSuperAdmin && empresas?.length > 0 && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                                Empresa (SuperAdmin Global)
                            </label>
                            <select
                                value={form.IdEmpresa}
                                onChange={e => setForm(f => ({ ...f, IdEmpresa: parseInt(e.target.value) }))}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {empresas.map(emp => (
                                    <option key={emp.IdEmpresa} value={emp.IdEmpresa}>
                                        {emp.NomeFantasia || emp.RazaoSocial || `Empresa ${emp.IdEmpresa}`} (ID: {emp.IdEmpresa})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Código e Tipo */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                Código do Recurso *
                            </label>
                            <input
                                value={form.codigo}
                                onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                                placeholder="Ex: MO0013, MA0001..."
                                disabled={isEdit}
                                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold transition-all ${
                                    isEdit
                                        ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                        : 'border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                                }`}
                                autoFocus={!isEdit}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                Tipo de Recurso
                            </label>
                            <select
                                value={form.tipo}
                                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            >
                                <option value="MA">Máquina (MA)</option>
                                <option value="MO">Mão de Obra (MO)</option>
                                <option value="CT">Centro de Trabalho (CT)</option>
                                <option value="OUTRO">Outro / Geral</option>
                            </select>
                        </div>
                    </div>

                    {/* Nome / Descrição Principal */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Nome / Descrição Principal *
                        </label>
                        <input
                            value={form.nome}
                            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                            placeholder="Ex: Solda MIG 01, Laser Fibra 4kW..."
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            autoFocus={isEdit}
                        />
                    </div>

                    {/* Capacidade Padrão */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Capacidade Diária Padrão (Horas/Dia)
                        </label>
                        <div className="relative">
                            <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="24"
                                value={form.capacidade_padrao}
                                onChange={e => setForm(f => ({ ...f, capacidade_padrao: e.target.value }))}
                                placeholder="Ex: 8.0, 16.0..."
                                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Descrição Detalhada */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Observações / Detalhes (opcional)
                        </label>
                        <textarea
                            value={form.descricao}
                            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                            rows={2}
                            placeholder="Especificações técnicas, restrições ou notas..."
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        />
                    </div>

                    {/* Ativo */}
                    <div className="flex items-center gap-3 pt-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.ativo}
                                onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                        <span className="text-sm font-semibold text-slate-700">
                            Recurso Ativo
                        </span>
                    </div>

                    {/* Botões */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isEdit ? 'Salvar Alterações' : 'Cadastrar Recurso'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Componente Principal: Cadastro de Recursos ───────────────────────────────
export default function RecursosCadastro() {
    const navigate = useNavigate();
    const { user, isSuperAdmin } = useAuth();

    const [recursos, setRecursos] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [filtroEmpresa, setFiltroEmpresa] = useState('todas');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos', 'ativos', 'inativos'

    const [modalRecurso, setModalRecurso] = useState(null); // null = fechado, {} = novo, objeto = editar
    const [deletandoId, setDeletandoId] = useState(null);

    // Se for SuperAdmin, carregar lista de empresas cadastradas
    useEffect(() => {
        if (!isSuperAdmin) return;
        api.get('/superadmin/empresas')
            .then(res => {
                if (Array.isArray(res.data?.empresas)) {
                    setEmpresas(res.data.empresas);
                }
            })
            .catch(() => {});
    }, [isSuperAdmin]);

    // Carregar catálogo de recursos (com suporte a filtro por empresa para SuperAdmin)
    const carregarRecursos = useCallback(async () => {
        setLoading(true);
        try {
            const url = filtroEmpresa !== 'todas'
                ? `/pcp-setores/catalogo-recursos?empresa_id=${filtroEmpresa}`
                : '/pcp-setores/catalogo-recursos';
            const res = await api.get(url);
            setRecursos(res.data || []);
        } catch (err) {
            toast.error('Erro ao carregar catálogo de recursos.');
        } finally {
            setLoading(false);
        }
    }, [filtroEmpresa]);

    useEffect(() => {
        carregarRecursos();
    }, [carregarRecursos]);

    // Alternar status ativo/inativo direto na linha
    const handleToggleAtivo = async (recurso) => {
        try {
            await api.put(`/pcp-setores/catalogo-recursos/${recurso.id}`, {
                ativo: !recurso.ativo
            });
            toast.success(`Recurso ${recurso.codigo} ${!recurso.ativo ? 'ativado' : 'inativado'}!`);
            carregarRecursos();
        } catch {
            toast.error('Erro ao atualizar status do recurso.');
        }
    };

    // Excluir recurso
    const handleExcluir = async (id, codigo) => {
        if (!window.confirm(`Tem certeza que deseja excluir o recurso "${codigo}" do catálogo central? Todos os vínculos com setores serão removidos.`)) {
            return;
        }
        setDeletandoId(id);
        try {
            await api.delete(`/pcp-setores/catalogo-recursos/${id}`);
            toast.success(`Recurso ${codigo} removido do catálogo com sucesso.`);
            carregarRecursos();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao excluir recurso.');
        } finally {
            setDeletandoId(null);
        }
    };

    // Estatísticas calculadas
    const stats = useMemo(() => {
        const total = recursos.length;
        const ativos = recursos.filter(r => r.ativo).length;
        const vinculados = recursos.filter(r => r.qtd_setores > 0).length;
        const livres = total - vinculados;
        return { total, ativos, vinculados, livres };
    }, [recursos]);

    // Filtragem local
    const recursosFiltrados = useMemo(() => {
        return recursos.filter(r => {
            const matchesSearch =
                !search.trim() ||
                r.codigo.toLowerCase().includes(search.toLowerCase()) ||
                (r.nome && r.nome.toLowerCase().includes(search.toLowerCase())) ||
                (r.setores_nomes && r.setores_nomes.toLowerCase().includes(search.toLowerCase()));

            const matchesTipo = filtroTipo === 'todos' || r.tipo === filtroTipo;
            const matchesStatus =
                filtroStatus === 'todos' ||
                (filtroStatus === 'ativos' && r.ativo) ||
                (filtroStatus === 'inativos' && !r.ativo);

            return matchesSearch && matchesTipo && matchesStatus;
        });
    }, [recursos, search, filtroTipo, filtroStatus]);

    return (
        <div className="bg-slate-50 min-h-screen p-4 md:p-6 font-sans">
            <div className="w-full max-w-[1920px] mx-auto space-y-6">

                {/* ─── Header & Top Actions ─── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
                            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
                                <Cpu className="w-5 h-5" />
                            </div>
                            Cadastro de Recursos
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">
                            Catálogo centralizado de máquinas e centros de trabalho. Cada recurso pode ser associado a qualquer setor produtivo.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        {isSuperAdmin && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-amber-50 text-amber-800 border border-amber-300 shadow-sm">
                                <Shield className="w-3.5 h-3.5 text-amber-600" />
                                SuperAdmin (Acesso Total)
                            </span>
                        )}

                        <button
                            onClick={() => navigate('/pcp/setores/recursos')}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm"
                        >
                            <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                            Vincular a Setores →
                        </button>

                        <button
                            onClick={() => setModalRecurso({})}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
                        >
                            <Plus className="w-4 h-4" />
                            Novo Recurso
                        </button>
                    </div>
                </div>

                {/* ─── Cards de Estatísticas ─── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</span>
                            <Cpu className="w-4 h-4 text-blue-500" />
                        </div>
                        <p className="text-2xl font-black text-slate-800 mt-1">{stats.total}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">recursos cadastrados</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Ativos</span>
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                        </div>
                        <p className="text-2xl font-black text-emerald-700 mt-1">{stats.ativos}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">disponíveis para alocação</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Em Setores</span>
                            <LinkIcon className="w-4 h-4 text-blue-500" />
                        </div>
                        <p className="text-2xl font-black text-blue-700 mt-1">{stats.vinculados}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">associados a 1+ setores</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Sem Setor</span>
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                        </div>
                        <p className="text-2xl font-black text-amber-600 mt-1">{stats.livres}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">aguardando vinculação</p>
                    </div>
                </div>

                {/* ─── Barra de Filtros & Busca ─── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                    {/* Input de Busca */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por código, nome ou setor vinculado..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Filtros de Tipo & Status & Empresa (SA) */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Seletor de Empresa para SuperAdmin */}
                        {isSuperAdmin && empresas.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                                <Building2 className="w-4 h-4 text-blue-600" />
                                <select
                                    value={filtroEmpresa}
                                    onChange={e => setFiltroEmpresa(e.target.value)}
                                    className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                                >
                                    <option value="todas">Todas as Empresas (Visão Global)</option>
                                    {empresas.map(emp => (
                                        <option key={emp.IdEmpresa} value={emp.IdEmpresa}>
                                            {emp.NomeFantasia || emp.RazaoSocial || `Empresa ${emp.IdEmpresa}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Tipo */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                            {[
                                { id: 'todos', label: 'Todos' },
                                { id: 'MA', label: 'Máquinas' },
                                { id: 'MO', label: 'Mão de Obra' },
                                { id: 'CT', label: 'Centros' }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setFiltroTipo(t.id)}
                                    className={`px-3 py-1.5 rounded-lg transition-all ${
                                        filtroTipo === t.id
                                            ? 'bg-white text-blue-700 shadow-sm'
                                            : 'hover:text-slate-900'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Status */}
                        <select
                            value={filtroStatus}
                            onChange={e => setFiltroStatus(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="todos">Status: Todos</option>
                            <option value="ativos">Apenas Ativos</option>
                            <option value="inativos">Apenas Inativos</option>
                        </select>
                    </div>
                </div>

                {/* ─── Tabela de Recursos ─── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <p className="text-sm font-semibold text-slate-500">Carregando catálogo de recursos...</p>
                        </div>
                    ) : recursosFiltrados.length === 0 ? (
                        <div className="py-16 text-center">
                            <Cpu className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="font-semibold text-slate-700">Nenhum recurso encontrado</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                {search || filtroTipo !== 'todos' || filtroStatus !== 'todos'
                                    ? 'Tente ajustar os filtros ou o termo de busca.'
                                    : 'Cadastre o primeiro recurso no catálogo central para começar a vincular aos setores.'}
                            </p>
                            {(!search && filtroTipo === 'todos' && filtroStatus === 'todos') && (
                                <button
                                    onClick={() => setModalRecurso({})}
                                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Cadastrar Recurso
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        <th className="py-3 px-4">Código</th>
                                        <th className="py-3 px-4">Nome / Descrição</th>
                                        <th className="py-3 px-4">Tipo</th>
                                        <th className="py-3 px-4">Setores Vinculados</th>
                                        <th className="py-3 px-4 text-center">Capacidade</th>
                                        <th className="py-3 px-4 text-center">Status</th>
                                        <th className="py-3 px-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {recursosFiltrados.map(r => {
                                        const tipoConf = TIPO_CONFIG[r.tipo] || TIPO_CONFIG.OUTRO;
                                        const TipoIcon = tipoConf.icon;
                                        return (
                                            <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                                                {/* Código */}
                                                <td className="py-3.5 px-4 font-mono font-black text-slate-800 text-sm">
                                                    {r.codigo}
                                                </td>

                                                {/* Nome e descrição */}
                                                <td className="py-3.5 px-4">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-slate-800">{r.nome}</span>
                                                        {r.empresa_nome && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                <Building2 className="w-3 h-3 text-slate-400" />
                                                                {r.empresa_nome}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {r.descricao && (
                                                        <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                                                            {r.descricao}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Tipo */}
                                                <td className="py-3.5 px-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${tipoConf.bg}`}>
                                                        <TipoIcon className="w-3 h-3" />
                                                        {tipoConf.label}
                                                    </span>
                                                </td>

                                                {/* Setores Vinculados */}
                                                <td className="py-3.5 px-4">
                                                    {r.setores_nomes ? (
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {r.setores_nomes.split(', ').map((setorNome, sIdx) => (
                                                                <span
                                                                    key={sIdx}
                                                                    className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-bold text-[11px] px-2 py-0.5 rounded-md"
                                                                >
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                                    {setorNome}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">
                                                            Nenhum setor vinculado
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Capacidade */}
                                                <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-600">
                                                    {r.capacidade_padrao > 0 ? `${r.capacidade_padrao}h/dia` : '—'}
                                                </td>

                                                {/* Status Ativo */}
                                                <td className="py-3.5 px-4 text-center">
                                                    <button
                                                        onClick={() => handleToggleAtivo(r)}
                                                        title="Clique para alternar status"
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black transition-all ${
                                                            r.ativo
                                                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                                        }`}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full ${r.ativo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                        {r.ativo ? 'Ativo' : 'Inativo'}
                                                    </button>
                                                </td>

                                                {/* Ações */}
                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => setModalRecurso(r)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                            title="Editar recurso"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>

                                                        <button
                                                            onClick={() => handleExcluir(r.id, r.codigo)}
                                                            disabled={deletandoId === r.id}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                                            title="Excluir do catálogo"
                                                        >
                                                            {deletandoId === r.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                                                            ) : (
                                                                <Trash2 className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ─── Modal ─── */}
                {modalRecurso && (
                    <RecursoModal
                        recurso={modalRecurso.id ? modalRecurso : null}
                        onClose={() => setModalRecurso(null)}
                        onSave={() => {
                            setModalRecurso(null);
                            carregarRecursos();
                        }}
                        isSuperAdmin={isSuperAdmin}
                        empresas={empresas}
                    />
                )}

            </div>
        </div>
    );
}
