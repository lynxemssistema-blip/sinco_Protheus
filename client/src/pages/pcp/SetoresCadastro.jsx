import React, { useState, useEffect, useCallback } from 'react';
import {
    Landmark, Plus, Edit2, Trash2, Power, AlertCircle, Loader2,
    CheckCircle, X, Save, Tag, ChevronRight, Link as LinkIcon,
    ArrowUp, ArrowDown, Users, Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';

const PRESET_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#64748b'
];

// ─── Modal de Criação/Edição ─────────────────────────────────────────────────
function SetorModal({ setor, onClose, onSave }) {
    const [form, setForm] = useState({
        nome: setor?.nome || '',
        descricao: setor?.descricao || '',
        cor: setor?.cor || '#3b82f6'
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.nome.trim()) { toast.warning('Nome é obrigatório.'); return; }
        setSaving(true);
        try {
            const http = api;
            if (setor) {
                await http.put(`/pcp-setores/${setor.id}`, form);
                toast.success('Setor atualizado com sucesso!');
            } else {
                await http.post('/pcp-setores', form);
                toast.success('Setor criado com sucesso!');
            }
            onSave();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao salvar setor.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-lg font-black text-slate-800">
                        {setor ? 'Editar Setor' : 'Novo Setor'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Nome */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Nome do Setor *
                        </label>
                        <input
                            value={form.nome}
                            onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                            placeholder="Ex: Solda, Corte a Laser, Pintura..."
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            autoFocus
                        />
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Descrição (opcional)
                        </label>
                        <textarea
                            value={form.descricao}
                            onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                            placeholder="Descreva o setor e suas funções..."
                            rows={2}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        />
                    </div>

                    {/* Cor */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                            Cor do Setor
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                            {PRESET_COLORS.map(c => (
                                <button
                                    key={c} type="button"
                                    onClick={() => setForm(p => ({ ...p, cor: c }))}
                                    className={`w-7 h-7 rounded-full transition-transform ${form.cor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                            <input
                                type="color"
                                value={form.cor}
                                onChange={e => setForm(p => ({ ...p, cor: e.target.value }))}
                                className="w-7 h-7 rounded-full cursor-pointer border-0 p-0"
                                title="Cor personalizada"
                            />
                        </div>
                        {/* Preview */}
                        <div className="mt-3 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: form.cor }} />
                            <span className="text-sm font-semibold text-slate-700">{form.nome || 'Nome do Setor'}</span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-60">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {setor ? 'Atualizar' : 'Criar Setor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Modal de Responsáveis ───────────────────────────────────────────────────
function ResponsaveisModal({ setor, onClose, onUpdate }) {
    const [vinculos, setVinculos] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [busca, setBusca] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const resU = await api.get('/users');
            const validUsers = resU.data.filter(u => u.aprovado === 1 && u.email && u.telefone);
            setUsuarios(validUsers);

            const resR = await api.get(`/pcp-setores/${setor.id}/responsaveis`);
            setVinculos(resR.data);
        } catch (err) {
            toast.error('Erro ao carregar dados dos responsáveis.');
        } finally {
            setLoading(false);
        }
    }, [setor.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleAdd = async (userId) => {
        setSaving(true);
        try {
            await api.post(`/pcp-setores/${setor.id}/responsaveis`, { usuario_id: userId });
            toast.success('Responsável adicionado com sucesso!');
            loadData();
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao adicionar responsável.');
        } finally {
            setSaving(false);
            setBusca('');
        }
    };

    const handleRemove = async (vinculoId) => {
        try {
            await api.delete(`/pcp-setores/responsaveis/${vinculoId}`);
            toast.success('Responsável removido.');
            loadData();
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error('Erro ao remover responsável.');
        }
    };

    const vinculosIds = vinculos.map(v => v.usuario_id);
    const availableUsers = usuarios.filter(u => !vinculosIds.includes(u.idUsuario) && u.NomeCompleto.toLowerCase().includes(busca.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            Responsáveis: {setor.nome}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Usuários vinculados a este setor.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    {/* Lista Atual */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Responsáveis Atuais</h3>
                        {loading ? (
                            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>
                        ) : vinculos.length === 0 ? (
                            <div className="text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <p className="text-sm text-slate-500">Nenhum responsável vinculado a este setor.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {vinculos.map(v => (
                                    <div key={v.vinculo_id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{v.NomeCompleto}</p>
                                            <p className="text-xs text-slate-500">{v.email} • {v.telefone}</p>
                                        </div>
                                        <button onClick={() => handleRemove(v.vinculo_id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remover responsável">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Adicionar Novo */}
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Adicionar Responsável</h3>
                        <div className="relative mb-3">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                            <input
                                value={busca}
                                onChange={e => setBusca(e.target.value)}
                                placeholder="Pesquisar por nome..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                        {busca.trim() !== '' && (
                            <div className="max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                                {availableUsers.length === 0 ? (
                                    <div className="p-3 text-center text-xs text-slate-500">Nenhum usuário apto encontrado.</div>
                                ) : (
                                    availableUsers.map(u => (
                                        <div key={u.idUsuario} className="flex items-center justify-between p-2 hover:bg-slate-50">
                                            <div className="min-w-0 pr-2">
                                                <p className="text-sm font-semibold text-slate-800 truncate">{u.NomeCompleto}</p>
                                                <p className="text-[10px] text-slate-500 truncate">{u.email} • {u.telefone}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleAdd(u.idUsuario)}
                                                disabled={saving}
                                                className="shrink-0 text-xs font-bold text-blue-600 hover:text-white hover:bg-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
                                            >
                                                Adicionar
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                        <p className="text-[10px] text-slate-500 mt-2">
                            Apenas usuários com <strong>Celular</strong> e <strong>E-mail</strong> cadastrados no sistema podem ser vinculados.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Página Principal ────────────────────────────────────────────────────────
export default function SetoresCadastro() {
    const [setores, setSetores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | 'new' | setor (edição)
    const [modalResponsaveis, setModalResponsaveis] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const navigate = useNavigate();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/pcp-setores');
            setSetores(res.data);
        } catch (err) {
            toast.error('Erro ao carregar setores.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleReorder = async (index, direction) => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === setores.length - 1) return;

        const newSetores = [...setores];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        
        // Swap locally
        const temp = newSetores[index];
        newSetores[index] = newSetores[swapIndex];
        newSetores[swapIndex] = temp;
        
        setSetores(newSetores);

        // Save order to backend
        try {
            await api.post('/pcp-setores/reorder', { order: newSetores.map(s => s.id) });
            // toast.success('Ordem salva.');
        } catch (err) {
            toast.error('Erro ao reordenar setores.');
            load(); // reload on error
        }
    };

    const handleToggle = async (setor) => {
        try {
            await api.patch(`/pcp-setores/${setor.id}/toggle`);
            toast.success(`Setor ${setor.ativo ? 'desativado' : 'ativado'}.`);
            load();
        } catch (err) {
            toast.error('Erro ao alterar status.');
        }
    };

    const handleDelete = async (setor) => {
        setDeleting(setor.id);
        try {
            await api.delete(`/pcp-setores/${setor.id}`);
            toast.success('Setor excluído.');
            load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao excluir setor.');
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen p-4 md:p-6 font-sans">
            <div className="max-w-4xl mx-auto space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Landmark className="w-5 h-5 text-blue-600" />
                            Cadastro de Setores
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Crie e gerencie os setores produtivos da fábrica
                        </p>
                    </div>
                    <button
                        onClick={() => setModal('new')}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> Novo Setor
                    </button>
                </div>

                {/* Info Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-800">
                        Após criar os setores, utilize <strong>Recursos por Setor</strong> para associar as máquinas e centros de custo (MO0013, etc.) a cada setor.
                    </p>
                </div>

                {/* Lista */}
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    </div>
                ) : setores.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                        <Landmark className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="font-semibold text-slate-600">Nenhum setor cadastrado</p>
                        <p className="text-sm text-slate-400 mt-1">Clique em "Novo Setor" para começar.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {setores.map(setor => (
                            <div key={setor.id}
                                className={`bg-white rounded-2xl border shadow-sm transition-all ${setor.ativo ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}
                            >
                                <div className="p-4 flex items-center gap-4">
                                    {/* Cor */}
                                    <div className="w-4 h-12 rounded-full shrink-0" style={{ backgroundColor: setor.cor }} />

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-slate-800 text-base">{setor.nome}</span>
                                            {!setor.ativo && (
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Inativo</span>
                                            )}
                                            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                                                {setor.qtd_recursos} recurso{setor.qtd_recursos !== 1 ? 's' : ''}
                                            </span>
                                            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                {setor.qtd_responsaveis} resp.
                                            </span>
                                        </div>
                                        {setor.descricao && (
                                            <p className="text-xs text-slate-500 mt-0.5 truncate">{setor.descricao}</p>
                                        )}
                                    </div>

                                    {/* Ações */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <div className="flex flex-col gap-0.5 mr-2">
                                            <button
                                                onClick={() => handleReorder(setores.indexOf(setor), 'up')}
                                                disabled={setores.indexOf(setor) === 0}
                                                className="p-1 rounded bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Mover para cima"
                                            >
                                                <ArrowUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleReorder(setores.indexOf(setor), 'down')}
                                                disabled={setores.indexOf(setor) === setores.length - 1}
                                                className="p-1 rounded bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Mover para baixo"
                                            >
                                                <ArrowDown className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/pcp/setores/recursos?setor=${setor.id}`)}
                                            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                                            title="Ver/gerenciar recursos"
                                        >
                                            <LinkIcon className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Recursos</span>
                                            <ChevronRight className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => setModalResponsaveis(setor)}
                                            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors"
                                            title="Gerenciar responsáveis"
                                        >
                                            <Users className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Resp.</span>
                                        </button>
                                        <button
                                            onClick={() => setModal(setor)}
                                            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleToggle(setor)}
                                            className={`p-2 rounded-lg border transition-colors ${setor.ativo ? 'border-slate-200 text-green-600 hover:border-red-300 hover:text-red-500' : 'border-slate-200 text-slate-400 hover:text-green-600 hover:border-green-300'}`}
                                            title={setor.ativo ? 'Desativar setor' : 'Ativar setor'}
                                        >
                                            <Power className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(setor)}
                                            disabled={deleting === setor.id || setor.qtd_recursos > 0}
                                            className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            title={setor.qtd_recursos > 0 ? 'Remova os recursos antes de excluir' : 'Excluir setor'}
                                        >
                                            {deleting === setor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {modal && (
                <SetorModal
                    setor={modal === 'new' ? null : modal}
                    onClose={() => setModal(null)}
                    onSave={() => { setModal(null); load(); }}
                />
            )}
            
            {/* Modal de Responsáveis */}
            {modalResponsaveis && (
                <ResponsaveisModal
                    setor={modalResponsaveis}
                    onClose={() => setModalResponsaveis(null)}
                    onUpdate={load}
                />
            )}
        </div>
    );
}
