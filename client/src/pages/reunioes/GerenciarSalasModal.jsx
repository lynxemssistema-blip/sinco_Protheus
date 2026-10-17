import React, { useState } from 'react';
import {
    X, Building2, Plus, Edit2, Trash2, Check, AlertCircle,
    Tv, Monitor, Wind, Wifi, Presentation
} from 'lucide-react';
import { cadastrarSala, atualizarSala, desativarSala } from '../../services/salasReuniaoService';

const RECURSOS_DISPONIVEIS = [
    { id: 'smart_tv', label: 'Smart TV', icon: Tv },
    { id: 'videoconferencia', label: 'Videoconferência', icon: Monitor },
    { id: 'ar_condicionado', label: 'Ar-Condicionado', icon: Wind },
    { id: 'quadro_branco', label: 'Quadro Branco', icon: Presentation },
    { id: 'projetor_laser', label: 'Projetor Laser', icon: Presentation },
    { id: 'wifi', label: 'Wi-Fi Corporativo', icon: Wifi }
];

const CORES_PALETA = [
    { cor: '#1E3A5F', label: 'Azul Navy' },
    { cor: '#B45309', label: 'Âmbar Escuro' },
    { cor: '#047857', label: 'Verde Esmeralda' },
    { cor: '#4338CA', label: 'Índigo' },
    { cor: '#0F766E', label: 'Ciano Petróleo' },
    { cor: '#334155', label: 'Ardósia' },
];

export default function GerenciarSalasModal({
    isOpen,
    onClose,
    salas = [],
    onSuccess
}) {
    const [modoForm, setModoForm] = useState(false); // false = listagem, true = form
    const [salaEditandoId, setSalaEditandoId] = useState(null);
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [localizacao, setLocalizacao] = useState('');
    const [capacidade, setCapacidade] = useState(8);
    const [recursos, setRecursos] = useState([]);
    const [corEtiqueta, setCorEtiqueta] = useState('#1E3A5F');

    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const iniciarCriacao = () => {
        setSalaEditandoId(null);
        setNome('');
        setDescricao('');
        setLocalizacao('');
        setCapacidade(8);
        setRecursos(['smart_tv', 'ar_condicionado', 'wifi']);
        setCorEtiqueta('#1E3A5F');
        setErro('');
        setModoForm(true);
    };

    const iniciarEdicao = (s) => {
        setSalaEditandoId(s.id);
        setNome(s.nome);
        setDescricao(s.descricao || '');
        setLocalizacao(s.localizacao || '');
        setCapacidade(s.capacidade || 6);
        setRecursos(Array.isArray(s.recursos) ? s.recursos : []);
        setCorEtiqueta(s.cor_etiqueta || '#1E3A5F');
        setErro('');
        setModoForm(true);
    };

    const handleToggleRecurso = (recId) => {
        setRecursos(prev => 
            prev.includes(recId) ? prev.filter(r => r !== recId) : [...prev, recId]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro('');

        if (!nome.trim()) {
            setErro('O nome da sala é obrigatório.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                nome: nome.trim(),
                descricao: descricao.trim(),
                localizacao: localizacao.trim(),
                capacidade: Number(capacidade) || 6,
                recursos,
                cor_etiqueta: corEtiqueta
            };

            if (salaEditandoId) {
                await atualizarSala(salaEditandoId, payload);
            } else {
                await cadastrarSala(payload);
            }

            setModoForm(false);
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Erro ao salvar sala:', err);
            setErro(err.response?.data?.error || err.message || 'Falha ao salvar sala.');
        } finally {
            setLoading(false);
        }
    };

    const handleDesativar = async (id, nomeSala) => {
        if (!window.confirm(`Deseja realmente desativar a sala "${nomeSala}"? Ela não poderá mais receber novas reservas.`)) {
            return;
        }

        setLoading(true);
        try {
            await desativarSala(id);
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Erro ao desativar sala:', err);
            alert('Falha ao desativar sala: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                {modoForm ? (salaEditandoId ? 'Editar Sala de Reunião' : 'Cadastrar Nova Sala') : 'Gestão de Salas de Reunião'}
                            </h2>
                            <p className="text-xs text-slate-500">
                                {modoForm ? 'Informe os detalhes físicos e equipamentos disponíveis.' : 'Configure as salas físicas, capacidade e equipamentos da Metalfisa.'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {erro && (
                        <div className="flex items-center gap-2 p-3 mb-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                            <span>{erro}</span>
                        </div>
                    )}

                    {!modoForm ? (
                        /* Lista de Salas */
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-700">
                                    Salas Ativas Cadastradas ({salas.length})
                                </span>
                                <button
                                    type="button"
                                    onClick={iniciarCriacao}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Adicionar Sala
                                </button>
                            </div>

                            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                                {salas.map((s) => (
                                    <div key={s.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.cor_etiqueta || '#1E3A5F' }} />
                                                <span className="text-xs font-bold text-slate-800">{s.nome}</span>
                                                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                    Capacidade: {s.capacidade} pessoas
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {s.localizacao} {s.descricao ? `• ${s.descricao}` : ''}
                                            </p>
                                            {s.recursos && s.recursos.length > 0 && (
                                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                                    {s.recursos.map(r => (
                                                        <span key={r} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded capitalize">
                                                            {r.replace('_', ' ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => iniciarEdicao(s)}
                                                className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                                                title="Editar sala"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDesativar(s.id, s.nome)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                                title="Desativar sala"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Formulário de Criação/Edição de Sala */
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Nome da Sala <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={nome}
                                        onChange={(e) => setNome(e.target.value)}
                                        placeholder="Ex: Sala de Reunião Principal, Sala Diretoria, etc."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Localização / Andar / Bloco
                                    </label>
                                    <input
                                        type="text"
                                        value={localizacao}
                                        onChange={(e) => setLocalizacao(e.target.value)}
                                        placeholder="Ex: Prédio Administrativo - Térreo"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Capacidade Máxima (Pessoas)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={capacidade}
                                        onChange={(e) => setCapacidade(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Descrição e Características
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={descricao}
                                        onChange={(e) => setDescricao(e.target.value)}
                                        placeholder="Ex: Mesa oval de 12 lugares, isolamento acústico e monitor interativo..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden resize-none"
                                    />
                                </div>
                            </div>

                            {/* Recursos Disponíveis */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-2">
                                    Equipamentos & Recursos Instalados
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {RECURSOS_DISPONIVEIS.map(rec => {
                                        const isSelected = recursos.includes(rec.id);
                                        const Icon = rec.icon;
                                        return (
                                            <div
                                                key={rec.id}
                                                onClick={() => handleToggleRecurso(rec.id)}
                                                className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                                                    isSelected 
                                                        ? 'bg-amber-50 border-amber-400 text-amber-900 font-semibold' 
                                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                                                    isSelected ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300'
                                                }`}>
                                                    {isSelected && <Check className="w-2.5 h-2.5" />}
                                                </div>
                                                <Icon className="w-3.5 h-3.5" />
                                                <span>{rec.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Cor da Etiqueta no Calendário */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Cor da Etiqueta no Calendário
                                </label>
                                <div className="flex items-center gap-3">
                                    {CORES_PALETA.map(c => (
                                        <button
                                            key={c.cor}
                                            type="button"
                                            onClick={() => setCorEtiqueta(c.cor)}
                                            style={{ backgroundColor: c.cor }}
                                            className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center text-white ${
                                                corEtiqueta === c.cor ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'hover:scale-105'
                                            }`}
                                            title={c.label}
                                        >
                                            {corEtiqueta === c.cor && <Check className="w-3.5 h-3.5" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Botões do Formulário */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setModoForm(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                                >
                                    Voltar para Lista
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all cursor-pointer"
                                >
                                    {loading ? 'Salvando...' : (salaEditandoId ? 'Atualizar Sala' : 'Cadastrar Sala')}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
