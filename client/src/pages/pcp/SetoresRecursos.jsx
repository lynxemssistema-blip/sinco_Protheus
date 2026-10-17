import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Link as LinkIcon, Loader2, Trash2, ChevronRight, PlusCircle, Edit3,
    Cpu, Check, ArrowRight, Plus, Edit2, X, Save, AlertCircle, Landmark, CheckCircle2
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

const PRESET_COLORS = [
    '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#0d9488',
    '#0284c7', '#ea580c', '#e11d48', '#475569', '#15803d'
];

// ── Modal de Criação / Edição de Setor ─────────────────────────────────────────
function SetorModal({ setor, onClose, onSave }) {
    const [form, setForm] = useState({
        nome: setor?.nome || '',
        descricao: setor?.descricao || '',
        cor: setor?.cor || '#2563eb'
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.nome.trim()) {
            toast.warning('O nome do setor é obrigatório.');
            return;
        }
        setSaving(true);
        try {
            if (setor) {
                await api.put(`/pcp-setores/${setor.id}`, form);
                toast.success(`Setor "${form.nome.trim()}" atualizado com sucesso!`);
            } else {
                await api.post('/pcp-setores', form);
                toast.success(`Setor "${form.nome.trim()}" cadastrado com sucesso!`);
            }
            onSave(setor ? { ...setor, ...form } : form);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao salvar setor.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Landmark className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                {setor ? 'Editar Setor Produtivo' : 'Novo Setor Produtivo'}
                            </h2>
                            <p className="text-xs text-slate-500">
                                {setor ? 'Atualize as informações do setor' : 'Cadastre um novo setor para vincular recursos'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Nome */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Nome do Setor *
                        </label>
                        <input
                            type="text"
                            required
                            value={form.nome}
                            onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                            placeholder="Ex: CORTE, SOLDA, PINTURA, MONTAGEM..."
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase"
                            autoFocus
                        />
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Descrição do Setor (Opcional)
                        </label>
                        <textarea
                            value={form.descricao}
                            onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                            placeholder="Descreva as funções, atividades ou máquinas deste setor..."
                            rows={2}
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        />
                    </div>

                    {/* Cor do Setor */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Cor de Identificação
                        </label>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                            {PRESET_COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setForm(p => ({ ...p, cor: c }))}
                                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${form.cor === c ? 'ring-2 ring-offset-2 ring-slate-600 scale-110' : 'hover:scale-105'}`}
                                    style={{ backgroundColor: c }}
                                    title={c}
                                />
                            ))}
                            <div className="relative flex items-center">
                                <input
                                    type="color"
                                    value={form.cor}
                                    onChange={e => setForm(p => ({ ...p, cor: e.target.value }))}
                                    className="w-8 h-8 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                                    title="Escolher cor personalizada"
                                />
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
                            <div className="w-4 h-4 rounded-full shadow-xs shrink-0" style={{ backgroundColor: form.cor }} />
                            <span className="text-xs font-bold text-slate-800 uppercase">
                                {form.nome.trim() || 'Exemplo de Setor'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono ml-auto">
                                {form.cor}
                            </span>
                        </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !form.nome.trim()}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Salvando...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-3.5 h-3.5" />
                                    <span>{setor ? 'Atualizar Setor' : 'Cadastrar Setor'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Modal de Confirmação de Exclusão de Setor ───────────────────────────────────
function ModalConfirmarExclusaoSetor({ setor, onClose, onConfirm, deleting }) {
    if (!setor) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center border border-red-100">
                    <Trash2 className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-base font-bold text-slate-900">Excluir Setor?</h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Tem certeza que deseja excluir o setor <strong className="text-slate-800">{setor.nome}</strong>?
                    </p>
                    {setor.qtd_recursos > 0 && (
                        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                            <span>Este setor possui <strong>{setor.qtd_recursos}</strong> recurso(s) associado(s).</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={deleting}
                        className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={deleting}
                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        <span>Excluir</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SetoresRecursos() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [setores, setSetores]               = useState([]);
    const [selectedSetor, setSelectedSetor]   = useState(null);
    const [recursos, setRecursos]             = useState([]);
    const [catalogo, setCatalogo]             = useState([]);
    const [loadingSetores, setLoadingSetores] = useState(true);
    const [loadingRecursos, setLoadingRecursos] = useState(false);
    const [loadingCatalogo, setLoadingCatalogo] = useState(false);

    // Modais de Setor
    const [modalSetor, setModalSetor]                 = useState(null); // null | 'new' | setor (edição)
    const [setorParaExcluir, setSetorParaExcluir]     = useState(null);
    const [deletingSetor, setDeletingSetor]           = useState(false);

    // Entrada de recurso
    const [selectedFromCat, setSelectedFromCat] = useState('');
    const [manualCodigo, setManualCodigo]       = useState('');
    const [manualNome, setManualNome]           = useState('');
    const [addingManual, setAddingManual]       = useState(false);

    // ── Carrega setores ────────────────────────────────────────────────────────
    const loadSetores = useCallback(async (selectId = null) => {
        setLoadingSetores(true);
        try {
            const res = await api.get('/pcp-setores');
            const data = res.data || [];
            setSetores(data);

            if (selectId) {
                const found = data.find(s => s.id === selectId);
                if (found) setSelectedSetor(found);
            } else if (!selectedSetor && data.length > 0) {
                const paramId = searchParams.get('setor');
                if (paramId) {
                    const found = data.find(s => String(s.id) === paramId);
                    if (found) setSelectedSetor(found);
                    else setSelectedSetor(data[0]);
                } else {
                    setSelectedSetor(data[0]);
                }
            } else if (selectedSetor) {
                // Atualiza dados do setor selecionado caso tenha sido alterado
                const updated = data.find(s => s.id === selectedSetor.id);
                if (updated) setSelectedSetor(updated);
            }
        } catch {
            toast.error('Erro ao carregar setores.');
        } finally {
            setLoadingSetores(false);
        }
    }, [searchParams, selectedSetor]);

    // ── Carrega catálogo central de recursos ──────────────────────────────────
    const loadCatalogo = useCallback(async () => {
        setLoadingCatalogo(true);
        try {
            const res = await api.get('/pcp-setores/catalogo-recursos?status=ativos');
            setCatalogo(res.data || []);
        } catch {
            // Silencioso se catálogo falhar
        } finally {
            setLoadingCatalogo(false);
        }
    }, []);

    // ── Carrega recursos do setor ──────────────────────────────────────────────
    const loadRecursos = useCallback(async (setorId) => {
        setLoadingRecursos(true);
        try {
            const res = await api.get(`/pcp-setores/recursos/${setorId}`);
            setRecursos(res.data || []);
        } catch {
            toast.error('Erro ao carregar recursos.');
        } finally {
            setLoadingRecursos(false);
        }
    }, []);

    useEffect(() => { loadSetores(); loadCatalogo(); }, []);

    useEffect(() => {
        if (selectedSetor) {
            loadRecursos(selectedSetor.id);
            setManualCodigo('');
            setManualNome('');
            setSelectedFromCat('');
        }
    }, [selectedSetor?.id]);

    // Quando salva setor (novo ou edição)
    const handleSetorSaved = async () => {
        setModalSetor(null);
        await loadSetores();
    };

    // Confirmar exclusão de setor
    const handleConfirmExcluirSetor = async () => {
        if (!setorParaExcluir) return;
        setDeletingSetor(true);
        try {
            await api.delete(`/pcp-setores/${setorParaExcluir.id}`);
            toast.success(`Setor "${setorParaExcluir.nome}" excluído com sucesso.`);
            if (selectedSetor?.id === setorParaExcluir.id) {
                setSelectedSetor(null);
            }
            setSetorParaExcluir(null);
            await loadSetores();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao excluir setor.');
        } finally {
            setDeletingSetor(false);
        }
    };

    // Quando seleciona do catálogo central
    const handleSelectFromCat = (e) => {
        const val = e.target.value;
        setSelectedFromCat(val);
        if (val) {
            const rec = catalogo.find(c => c.codigo === val);
            if (rec) {
                setManualCodigo(rec.codigo);
                setManualNome(rec.nome || rec.codigo);
            }
        } else {
            setManualCodigo('');
            setManualNome('');
        }
    };

    // ── Adiciona recurso ao setor ──────────────────────────────────────────────
    const handleAddRecurso = async (e) => {
        e.preventDefault();
        const cod = manualCodigo.trim().toUpperCase();
        if (!cod) { toast.warning('Informe o código do recurso.'); return; }
        setAddingManual(true);
        try {
            await api.post('/pcp-setores/recursos', {
                setor_id:      selectedSetor.id,
                recurso_codigo: cod,
                recurso_nome:   manualNome.trim() || cod,
            });
            toast.success(`Recurso ${cod} vinculado ao setor "${selectedSetor.nome}".`);
            setManualCodigo('');
            setManualNome('');
            setSelectedFromCat('');
            loadRecursos(selectedSetor.id);
            loadSetores();
            loadCatalogo();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao vincular recurso.');
        } finally {
            setAddingManual(false);
        }
    };

    // ── Remove recurso ─────────────────────────────────────────────────────────
    const handleRemove = async (recursoId, recurso_codigo) => {
        try {
            await api.delete(`/pcp-setores/recursos/${recursoId}`);
            toast.success(`Recurso ${recurso_codigo} desvinculado deste setor.`);
            loadRecursos(selectedSetor.id);
            loadSetores();
            loadCatalogo();
        } catch {
            toast.error('Erro ao desvincular recurso.');
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="bg-slate-50 min-h-screen p-4 md:p-6 font-sans">
            <div className="w-full max-w-[1920px] mx-auto space-y-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2.5">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                                <LinkIcon className="w-5 h-5" />
                            </div>
                            <span>Recursos por Setor</span>
                        </h1>
                        <p className="text-xs md:text-sm text-slate-500 mt-1">
                            Associe máquinas e centros de custo do Protheus a cada setor produtivo, ou gerencie os setores da fábrica.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setModalSetor('new')}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs md:text-sm font-bold transition shadow-xs cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Novo Setor</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/pcp/setores')}
                            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs md:text-sm font-bold transition shadow-xs cursor-pointer"
                            title="Gerenciamento avançado de setores e ordens de prioridade"
                        >
                            <Landmark className="w-4 h-4 text-slate-500" />
                            <span>Gerenciar Setores</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* ── Lista de Setores ── */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest">Setores</h2>
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700 rounded-full">
                                    {setores.length}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalSetor('new')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                title="Cadastrar Novo Setor"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Novo</span>
                            </button>
                        </div>

                        {loadingSetores ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
                                {setores.map(s => {
                                    const isSelected = selectedSetor?.id === s.id;
                                    return (
                                        <div
                                            key={s.id}
                                            className={`w-full flex items-center justify-between px-3 py-3 transition-colors group ${isSelected ? 'bg-blue-50/80 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSetor(s)}
                                                className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                                            >
                                                <div
                                                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                                                    style={{ backgroundColor: s.cor || '#2563eb' }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className={`font-bold text-sm truncate ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                                                            {s.nome}
                                                        </span>
                                                        {s.empresa_nome && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                                {s.empresa_nome}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                                        {s.qtd_recursos || 0} recurso{(s.qtd_recursos || 0) !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                            </button>

                                            {/* Ações Rápidas: Editar e Excluir Setor */}
                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setModalSetor(s);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100/60 rounded-lg transition-colors cursor-pointer"
                                                    title={`Editar setor ${s.nome}`}
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSetorParaExcluir(s);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100/60 rounded-lg transition-colors cursor-pointer"
                                                    title={`Excluir setor ${s.nome}`}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                {isSelected && (
                                                    <ChevronRight className="w-4 h-4 text-blue-600 shrink-0 ml-0.5" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {setores.length === 0 && (
                                    <div className="py-12 px-4 text-center">
                                        <Landmark className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        <p className="text-sm font-semibold text-slate-600">Nenhum setor cadastrado.</p>
                                        <p className="text-xs text-slate-400 mt-1">Crie o primeiro setor para começar a organizar sua fábrica.</p>
                                        <button
                                            type="button"
                                            onClick={() => setModalSetor('new')}
                                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Criar Primeiro Setor
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Botão de Adição no Rodapé da Lista */}
                        {setores.length > 0 && (
                            <div className="p-3 bg-slate-50 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setModalSetor('new')}
                                    className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/60 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Adicionar Outro Setor</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Painel Direito ── */}
                    <div className="lg:col-span-2 space-y-4">
                        {!selectedSetor ? (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                                <LinkIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="font-semibold text-slate-600">Selecione ou Crie um Setor</p>
                                <p className="text-sm text-slate-400 mt-1">Clique em um setor à esquerda ou no botão "Novo Setor" para gerenciar seus recursos.</p>
                                <button
                                    type="button"
                                    onClick={() => setModalSetor('new')}
                                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                                >
                                    <Plus className="w-4 h-4" />
                                    Novo Setor
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Cabeçalho do setor com ações de Edição e Exclusão */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-5 h-5 rounded-full shadow-xs shrink-0"
                                            style={{ backgroundColor: selectedSetor.cor || '#2563eb' }}
                                        />
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="font-black text-lg text-slate-800">{selectedSetor.nome}</h2>
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                    {recursos.length} recurso{recursos.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            {selectedSetor.descricao && (
                                                <p className="text-xs text-slate-500 mt-0.5">{selectedSetor.descricao}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setModalSetor(selectedSetor)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                            title="Editar nome, descrição ou cor do setor"
                                        >
                                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                            <span>Editar Setor</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSetorParaExcluir(selectedSetor)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                            title="Excluir este setor"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* ── Adicionar Recurso ao Setor ── */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                            <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                                                Vincular Recurso a {selectedSetor.nome}
                                            </h3>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/pcp/recursos')}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                        >
                                            <Cpu className="w-3.5 h-3.5" />
                                            Catálogo Geral ({catalogo.length}) →
                                        </button>
                                    </div>

                                    <div className="p-4 space-y-4">
                                        {/* Seletor rápido do catálogo */}
                                        {catalogo.length > 0 && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                                    Selecionar do Catálogo Centralizado
                                                </label>
                                                <select
                                                    value={selectedFromCat}
                                                    onChange={handleSelectFromCat}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-slate-700"
                                                >
                                                    <option value="">-- Escolha um recurso cadastrado (ou digite abaixo) --</option>
                                                    {catalogo.map(c => {
                                                        const jaNesteSetor = recursos.some(r => r.recurso_codigo === c.codigo);
                                                        return (
                                                            <option key={c.id} value={c.codigo} disabled={jaNesteSetor}>
                                                                {c.codigo} — {c.nome} {jaNesteSetor ? '(Já neste setor)' : c.setores_nomes ? `(Presente em: ${c.setores_nomes})` : '(Livre)'}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                        )}

                                        <form onSubmit={handleAddRecurso} className="space-y-3 pt-1">
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <div className="sm:w-1/3">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                                        Código do Recurso *
                                                    </label>
                                                    <input
                                                        value={manualCodigo}
                                                        onChange={e => {
                                                            const val = e.target.value.toUpperCase();
                                                            setManualCodigo(val);
                                                            const match = catalogo.find(c => c.codigo === val);
                                                            if (match && !manualNome) {
                                                                setManualNome(match.nome || '');
                                                            }
                                                        }}
                                                        placeholder="Ex: MO0013"
                                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                                <div className="sm:w-2/3">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                                        Descrição do Recurso (opcional)
                                                    </label>
                                                    <input
                                                        value={manualNome}
                                                        onChange={e => setManualNome(e.target.value)}
                                                        placeholder="Ex: Solda MIG 01"
                                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-1">
                                                <p className="text-[11px] text-slate-400">
                                                    💡 Um mesmo recurso pode ser vinculado a qualquer setor.
                                                </p>
                                                <button
                                                    type="submit"
                                                    disabled={addingManual || !manualCodigo.trim()}
                                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                                                >
                                                    {addingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                                                    Vincular Recurso
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>

                                {/* ── Recursos Vinculados ── */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                                            Recursos Vinculados a {selectedSetor.nome}
                                        </h3>
                                        <span className="text-xs text-slate-400 font-bold">
                                            {recursos.length} recurso{recursos.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    {loadingRecursos ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                        </div>
                                    ) : recursos.length === 0 ? (
                                        <div className="py-10 text-center">
                                            <LinkIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                            <p className="text-sm text-slate-400 font-semibold">Nenhum recurso vinculado a este setor.</p>
                                            <p className="text-xs text-slate-400 mt-1">Selecione um recurso no catálogo acima para vinculá-lo.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {recursos.map(r => {
                                                const catItem = catalogo.find(c => c.codigo === r.recurso_codigo);
                                                const outrosSetores = catItem?.setores_nomes
                                                    ? catItem.setores_nomes.split(', ').filter(s => s !== selectedSetor.nome)
                                                    : [];

                                                return (
                                                    <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                                                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-mono font-black text-sm text-slate-800">{r.recurso_codigo}</span>
                                                                {r.recurso_nome && r.recurso_nome !== r.recurso_codigo && (
                                                                    <span className="text-xs text-slate-600 font-semibold truncate">{r.recurso_nome}</span>
                                                                )}
                                                                {outrosSetores.length > 0 && (
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                                                        Também em: {outrosSetores.join(', ')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemove(r.id, r.recurso_codigo)}
                                                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                                            title="Desvincular deste setor"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Cadastro / Edição de Setor */}
            {modalSetor && (
                <SetorModal
                    setor={modalSetor === 'new' ? null : modalSetor}
                    onClose={() => setModalSetor(null)}
                    onSave={handleSetorSaved}
                />
            )}

            {/* Modal de Confirmação de Exclusão de Setor */}
            {setorParaExcluir && (
                <ModalConfirmarExclusaoSetor
                    setor={setorParaExcluir}
                    onClose={() => setSetorParaExcluir(null)}
                    onConfirm={handleConfirmExcluirSetor}
                    deleting={deletingSetor}
                />
            )}
        </div>
    );
}
