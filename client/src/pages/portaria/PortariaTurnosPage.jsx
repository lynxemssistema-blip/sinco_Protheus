import React, { useState, useEffect, useMemo } from 'react';
import {
    Clock, Plus, Edit2, Trash2, CheckCircle, X, AlertCircle,
    Calendar, Users, Shield, RefreshCw, Sun, Moon, Briefcase, Check, Power, HelpCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import portariaService from '../../services/portariaService';
import { useHelp } from '../../contexts/HelpContext';

export default function PortariaTurnosPage() {
    const { toggleHelp } = useHelp();
    const [turnos, setTurnos] = useState([]);
    const [porteiros, setPorteiros] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Modal de Cadastro/Edição
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedTurno, setSelectedTurno] = useState(null);
    const [formData, setFormData] = useState({
        nome: '',
        hora_inicio: '',
        hora_fim: '',
        descricao: '',
        ativo: 1
    });

    // Relógio para detecção do turno em andamento
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        setLoading(true);
        try {
            const [turnosData, porteirosData] = await Promise.all([
                portariaService.getTurnos(),
                portariaService.getPorteiros()
            ]);
            setTurnos(turnosData || []);
            setPorteiros(porteirosData || []);
        } catch (err) {
            console.error('Erro ao carregar turnos:', err);
            toast.error('Erro ao carregar turnos da portaria.');
        } finally {
            setLoading(false);
        }
    };

    // Helper: calcular se o turno está ativo agora
    const isTurnoAgora = (inicio, fim) => {
        if (!inicio || !fim) return false;
        const now = currentTime;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const [hI, mI] = inicio.split(':').map(Number);
        const [hF, mF] = fim.split(':').map(Number);
        const startMinutes = hI * 60 + mI;
        const endMinutes = hF * 60 + mF;

        if (startMinutes <= endMinutes) {
            return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        } else {
            // Turno noturno que cruza meia-noite (ex: 22:35 às 06:00)
            return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }
    };

    // Helper: calcular duração do turno em horas
    const calcularDuracao = (inicio, fim) => {
        if (!inicio || !fim) return '-';
        const [hI, mI] = inicio.split(':').map(Number);
        const [hF, mF] = fim.split(':').map(Number);
        let diff = (hF * 60 + mF) - (hI * 60 + mI);
        if (diff < 0) diff += 24 * 60; // cruza meia-noite
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        return `${h}h${m > 0 ? ` ${m}m` : ''}`;
    };

    const handleOpenNew = () => {
        setSelectedTurno(null);
        setFormData({
            nome: '',
            hora_inicio: '06:00',
            hora_fim: '14:20',
            descricao: '',
            ativo: 1
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (turno) => {
        setSelectedTurno(turno);
        setFormData({
            nome: turno.nome,
            hora_inicio: turno.hora_inicio.slice(0, 5),
            hora_fim: turno.hora_fim.slice(0, 5),
            descricao: turno.descricao || '',
            ativo: turno.ativo ? 1 : 0
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.nome.trim()) {
            toast.warning('O nome do turno é obrigatório.');
            return;
        }
        if (!formData.hora_inicio || !formData.hora_fim) {
            toast.warning('Horários de início e término são obrigatórios.');
            return;
        }

        setIsSaving(true);
        try {
            await portariaService.salvarTurno(formData, selectedTurno?.id);
            toast.success(selectedTurno ? 'Turno atualizado com sucesso!' : 'Turno cadastrado com sucesso!');
            setIsModalOpen(false);
            setSelectedTurno(null);
            carregarDados();
        } catch (err) {
            console.error('Erro ao salvar turno:', err);
            toast.error(err.response?.data?.error || 'Erro ao salvar turno.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleAtivo = async (turno) => {
        try {
            const novoStatus = turno.ativo ? 0 : 1;
            await portariaService.salvarTurno({
                ...turno,
                hora_inicio: turno.hora_inicio.slice(0, 5),
                hora_fim: turno.hora_fim.slice(0, 5),
                ativo: novoStatus
            }, turno.id);
            toast.info(`Turno ${novoStatus ? 'ativado' : 'desativado'} com sucesso.`);
            carregarDados();
        } catch (err) {
            console.error('Erro ao alterar status:', err);
            toast.error('Erro ao alterar status do turno.');
        }
    };

    const handleDelete = async (turno) => {
        const porteirosVinculados = porteiros.filter(p => p.turno_id === turno.id);
        let msg = `Deseja realmente excluir o turno "${turno.nome}"?`;
        if (porteirosVinculados.length > 0) {
            msg = `Existem ${porteirosVinculados.length} porteiro(s) vinculados a este turno. O turno será desativado em vez de apagado. Deseja continuar?`;
        }

        if (!window.confirm(msg)) return;

        try {
            const res = await portariaService.excluirTurno(turno.id);
            toast.success(res.message || 'Turno excluído com sucesso.');
            carregarDados();
        } catch (err) {
            console.error('Erro ao excluir turno:', err);
            toast.error('Erro ao excluir turno.');
        }
    };

    // Estatísticas
    const totalTurnos = turnos.length;
    const totalAtivos = turnos.filter(t => t.ativo).length;
    const turnoAtual = turnos.find(t => t.ativo && isTurnoAgora(t.hora_inicio, t.hora_fim));

    return (
        <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl w-full mx-auto space-y-6">
                {/* 1. CABEÇALHO */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                    Cadastro de Turnos • Portaria
                                </h1>
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                                    Escalas
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                                Gerencie horários de trabalho, escalas (12x36, 6x1) e intervalos para os porteiros e guarita
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={carregarDados}
                            title="Atualizar lista"
                            className="p-2.5 text-slate-500 hover:text-slate-900 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition shadow-xs"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>

                        <button
                            type="button"
                            onClick={toggleHelp}
                            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 border border-slate-200 hover:border-amber-300 hover:bg-amber-50 rounded-xl text-slate-700 hover:text-amber-700 active:scale-95 transition text-xs font-semibold shadow-xs"
                            title="Ajuda e Manual de Turnos"
                        >
                            <HelpCircle className="w-4 h-4 text-amber-500" />
                            <span className="hidden sm:inline">Ajuda</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleOpenNew}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            Cadastrar Novo Turno
                        </button>
                    </div>
                </div>

                {/* 2. CARDS DE RESUMO & TURNO EM VIGOR AGORA */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                        <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Turnos</span>
                            <div className="text-2xl font-black text-slate-900 mt-0.5">{totalTurnos}</div>
                            <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">{totalAtivos} turnos ativos</div>
                        </div>
                        <div className="p-3 bg-slate-100 rounded-xl text-slate-600 border border-slate-200">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                        <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hora Local (Guarita)</span>
                            <div className="text-2xl font-mono font-bold text-slate-800 mt-0.5">
                                {currentTime.toLocaleTimeString('pt-BR')}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                                {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                            </div>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                            <Calendar className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="bg-white border border-emerald-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                        <div>
                            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Turno Vigente Agora
                            </span>
                            <div className="text-lg font-bold text-slate-900 mt-1 truncate max-w-[200px]">
                                {turnoAtual?.nome || 'Nenhum turno ativo'}
                            </div>
                            <div className="text-xs font-mono text-slate-600 font-medium mt-0.5">
                                {turnoAtual ? `${turnoAtual.hora_inicio.slice(0, 5)} até ${turnoAtual.hora_fim.slice(0, 5)}` : '-'}
                            </div>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* 3. LISTAGEM DE TURNOS */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-2.5">
                            <Clock className="w-4 h-4 text-emerald-600" />
                            <h2 className="text-sm sm:text-base font-bold text-slate-900">
                                Turnos e Horários Configurados ({turnos.length})
                            </h2>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                            <span className="text-xs">Carregando turnos...</span>
                        </div>
                    ) : turnos.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 text-xs">
                            Nenhum turno configurado. Clique no botão "Cadastrar Novo Turno" acima para começar.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200 overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-4">Nome do Turno</th>
                                        <th className="py-3 px-4">Horário de Trabalho</th>
                                        <th className="py-3 px-4 text-center">Duração</th>
                                        <th className="py-3 px-4">Descrição / Observações</th>
                                        <th className="py-3 px-4 text-center">Porteiros</th>
                                        <th className="py-3 px-4 text-center">Status</th>
                                        <th className="py-3 px-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {turnos.map((t) => {
                                        const isVigente = t.ativo && isTurnoAgora(t.hora_inicio, t.hora_fim);
                                        const porteirosVinculados = porteiros.filter(p => p.turno_id === t.id);

                                        return (
                                            <tr
                                                key={t.id}
                                                className={`hover:bg-slate-50 transition group ${
                                                    isVigente ? 'bg-emerald-50/40' : ''
                                                }`}
                                            >
                                                {/* Nome do Turno */}
                                                <td className="py-3.5 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                                            {t.nome}
                                                            {isVigente && (
                                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                    Em vigor agora
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Horário */}
                                                <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                                                    <div className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                                                        <span className="text-emerald-700">{t.hora_inicio.slice(0, 5)}</span>
                                                        <span className="text-slate-400">às</span>
                                                        <span className="text-emerald-700">{t.hora_fim.slice(0, 5)}</span>
                                                    </div>
                                                </td>

                                                {/* Duração */}
                                                <td className="py-3.5 px-4 text-center font-medium text-slate-700">
                                                    {calcularDuracao(t.hora_inicio, t.hora_fim)}
                                                </td>

                                                {/* Descrição */}
                                                <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                                                    {t.descricao || '-'}
                                                </td>

                                                {/* Porteiros Vinculados */}
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-bold">
                                                        {porteirosVinculados.length}
                                                    </span>
                                                </td>

                                                {/* Status Ativo/Inativo */}
                                                <td className="py-3.5 px-4 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleAtivo(t)}
                                                        className={`px-2.5 py-1 text-[11px] font-bold rounded-full border transition ${
                                                            t.ativo
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                                        }`}
                                                    >
                                                        {t.ativo ? 'Ativo' : 'Inativo'}
                                                    </button>
                                                </td>

                                                {/* Ações */}
                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEdit(t)}
                                                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
                                                            title="Editar turno"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(t)}
                                                            className="p-1.5 text-rose-600 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition"
                                                            title="Excluir ou desativar turno"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
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
            </div>

            {/* MODAL CADASTRAR OU EDITAR TURNO */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
                    <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl p-6 text-slate-800">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-emerald-600" />
                                <h3 className="font-bold text-base text-slate-900">
                                    {selectedTurno ? 'Editar Turno da Portaria' : 'Cadastrar Novo Turno'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-700 font-semibold mb-1">
                                    Nome do Turno *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Turno 1 (Manhã) ou Escala 12x36 Diurna"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                                        Hora de Início *
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.hora_inicio}
                                        onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                                        <Moon className="w-3.5 h-3.5 text-blue-500" />
                                        Hora de Término *
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.hora_fim}
                                        onChange={(e) => setFormData({ ...formData, hora_fim: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-700 font-semibold mb-1">
                                    Descrição / Escala / Observações
                                </label>
                                <textarea
                                    rows="2"
                                    placeholder="Ex: Escala 6x1 com intervalo de 1h para almoço ou plantão vigia..."
                                    value={formData.descricao}
                                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-700 font-semibold mb-1">
                                    Status
                                </label>
                                <select
                                    value={formData.ativo}
                                    onChange={(e) => setFormData({ ...formData, ativo: Number(e.target.value) })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                                >
                                    <option value={1}>Ativo (Disponível para seleção nos porteiros)</option>
                                    <option value={0}>Inativo</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                                >
                                    {isSaving ? 'Salvando...' : 'Salvar Turno'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
