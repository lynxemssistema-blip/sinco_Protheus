import React, { useState } from 'react';
import { api } from '../../services/api';
import { 
    X, Plus, Trash2, Edit2, Check, Users, Building2, 
    Tv, Video, Wind, Wifi, Shield, Palette 
} from 'lucide-react';

const RECURSOS_DISPONIVEIS = [
    { id: 'smart_tv', label: 'Smart TV 4K', icone: Tv },
    { id: 'videoconferencia', label: 'Videoconferência', icone: Video },
    { id: 'ar_condicionado', label: 'Ar Condicionado', icone: Wind },
    { id: 'wifi', label: 'Wi-Fi 6', icone: Wifi },
    { id: 'quadro_branco', label: 'Quadro Branco' },
    { id: 'projetor', label: 'Projetor' },
    { id: 'sistema_som', label: 'Sistema de Som' }
];

const CORES_PALETA = [
    '#1E3A5F', '#0284C7', '#0D9488', '#059669', 
    '#D97706', '#DC2626', '#7C3AED', '#DB2777'
];

const GerenciarSalasModal = ({ salas = [], onClose, onAtualizado }) => {
    const [editandoId, setEditandoId] = useState(null);
    const [formData, setFormData] = useState({
        nome: '',
        localizacao: '',
        capacidade: 8,
        descricao: '',
        cor_etiqueta: '#0284C7',
        recursos: ['smart_tv', 'videoconferencia', 'ar_condicionado', 'wifi']
    });
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const iniciarEdicao = (sala) => {
        setEditandoId(sala.id);
        let recursosArray = [];
        try {
            recursosArray = typeof sala.recursos_json === 'string' ? JSON.parse(sala.recursos_json) : (sala.recursos || []);
        } catch (e) {
            recursosArray = [];
        }

        setFormData({
            nome: sala.nome || '',
            localizacao: sala.localizacao || '',
            capacidade: sala.capacidade || 8,
            descricao: sala.descricao || '',
            cor_etiqueta: sala.cor_etiqueta || '#0284C7',
            recursos: recursosArray
        });
    };

    const cancelarEdicao = () => {
        setEditandoId(null);
        setFormData({
            nome: '',
            localizacao: '',
            capacidade: 8,
            descricao: '',
            cor_etiqueta: '#0284C7',
            recursos: ['smart_tv', 'videoconferencia', 'ar_condicionado', 'wifi']
        });
        setErro('');
    };

    const toggleRecurso = (recId) => {
        if (formData.recursos.includes(recId)) {
            setFormData({ ...formData, recursos: formData.recursos.filter(r => r !== recId) });
        } else {
            setFormData({ ...formData, recursos: [...formData.recursos, recId] });
        }
    };

    const handleSalvar = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErro('');

        try {
            if (editandoId) {
                await api.put(`/salas-reuniao/salas/${editandoId}`, formData);
            } else {
                await api.post('/salas-reuniao/salas', formData);
            }
            cancelarEdicao();
            if (onAtualizado) onAtualizado();
        } catch (err) {
            setErro(err.response?.data?.error || 'Erro ao salvar sala de reunião.');
        } finally {
            setLoading(false);
        }
    };

    const handleInativar = async (salaId) => {
        if (!confirm('Deseja inativar esta sala de reunião? As reservas existentes serão mantidas no histórico.')) return;
        try {
            await api.delete(`/salas-reuniao/salas/${salaId}`);
            if (onAtualizado) onAtualizado();
        } catch (err) {
            alert('Erro ao inativar sala.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-base md:text-lg font-bold text-white">Gerenciar Salas Físicas</h2>
                            <p className="text-xs text-slate-400">Cadastro, edição de capacidade e recursos de infraestrutura.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    
                    {/* Formulário de Cadastro / Edição */}
                    <form onSubmit={handleSalvar} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                {editandoId ? (
                                    <>
                                        <Edit2 className="w-4 h-4 text-amber-400" /> Editando Sala
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 text-blue-400" /> Cadastrar Nova Sala
                                    </>
                                )}
                            </h3>
                            {editandoId && (
                                <button
                                    type="button"
                                    onClick={cancelarEdicao}
                                    className="text-xs text-slate-400 hover:text-white underline"
                                >
                                    Cancelar Edição
                                </button>
                            )}
                        </div>

                        {erro && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
                                {erro}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">Nome da Sala</label>
                                <input
                                    type="text"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    placeholder="Ex: Sala Executiva de Reuniões"
                                    required
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">Localização</label>
                                <input
                                    type="text"
                                    value={formData.localizacao}
                                    onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                                    placeholder="Ex: Bloco A - 2º Andar (Mezanino)"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">Capacidade (Pessoas)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="200"
                                    value={formData.capacidade}
                                    onChange={(e) => setFormData({ ...formData, capacidade: e.target.value })}
                                    required
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                                    <Palette className="w-3.5 h-3.5 text-blue-400" /> Cor da Etiqueta no Calendário
                                </label>
                                <div className="flex items-center gap-2">
                                    {CORES_PALETA.map(cor => (
                                        <button
                                            type="button"
                                            key={cor}
                                            onClick={() => setFormData({ ...formData, cor_etiqueta: cor })}
                                            className={`w-6 h-6 rounded-full transition-transform ${
                                                formData.cor_etiqueta === cor ? 'scale-125 ring-2 ring-white shadow-lg' : 'opacity-70 hover:opacity-100'
                                            }`}
                                            style={{ backgroundColor: cor }}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={formData.cor_etiqueta}
                                        onChange={(e) => setFormData({ ...formData, cor_etiqueta: e.target.value })}
                                        className="w-6 h-6 rounded-full cursor-pointer bg-transparent border-0 ml-2"
                                        title="Cor customizada"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Recursos de Infraestrutura */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-2">Recursos Disponíveis na Sala</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {RECURSOS_DISPONIVEIS.map(rec => {
                                    const ativo = formData.recursos.includes(rec.id);
                                    return (
                                        <button
                                            type="button"
                                            key={rec.id}
                                            onClick={() => toggleRecurso(rec.id)}
                                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-between border transition-all ${
                                                ativo 
                                                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-200' 
                                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                                            }`}
                                        >
                                            <span>{rec.label}</span>
                                            {ativo && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/80">
                            {editandoId && (
                                <button
                                    type="button"
                                    onClick={cancelarEdicao}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                            >
                                {loading ? 'Salvando...' : (editandoId ? 'Atualizar Sala' : 'Salvar Nova Sala')}
                            </button>
                        </div>
                    </form>

                    {/* Lista de Salas Existentes */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>Salas Ativas ({salas.length})</span>
                        </h3>

                        <div className="grid grid-cols-1 gap-2.5">
                            {salas.map((s) => (
                                <div
                                    key={s.id}
                                    className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-slate-700 transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-4 h-4 rounded-full shrink-0 shadow"
                                            style={{ backgroundColor: s.cor_etiqueta || '#0284C7' }}
                                        />
                                        <div>
                                            <div className="font-bold text-sm text-white flex items-center gap-2">
                                                {s.nome}
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                                    Máx: {s.capacidade} pessoas
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-400 mt-0.5">
                                                {s.localizacao || 'Edifício Corporativo'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => iniciarEdicao(s)}
                                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                            title="Editar Sala"
                                        >
                                            <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                                        </button>
                                        <button
                                            onClick={() => handleInativar(s.id)}
                                            className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors"
                                            title="Inativar Sala"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                        Fechar
                    </button>
                </div>

            </div>
        </div>
    );
};

export default GerenciarSalasModal;
