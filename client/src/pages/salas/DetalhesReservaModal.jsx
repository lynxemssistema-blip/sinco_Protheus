import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
    X, Calendar, Clock, Users, Building2, FileText, CheckCircle2, 
    AlertTriangle, LogOut, Edit2, Trash2, Printer, Shield, Coffee, History
} from 'lucide-react';

const DetalhesReservaModal = ({ reservaId, onClose, onReservaAtualizada, onAbrirEdicao }) => {
    const [detalhes, setDetalhes] = useState(null);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState('');
    const [motivoCancelamento, setMotivoCancelamento] = useState('');
    const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState('detalhes'); // 'detalhes' | 'historico'

    const carregarDetalhes = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/salas-reuniao/reservas/${reservaId}`);
            setDetalhes(res.data);
        } catch (err) {
            console.error('Erro ao carregar detalhes da reserva:', err);
            setErro('Não foi possível carregar os dados da reserva.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (reservaId) carregarDetalhes();
    }, [reservaId]);

    const handleCheckin = async () => {
        setActionLoading(true);
        try {
            await api.post(`/salas-reuniao/reservas/${reservaId}/checkin`);
            await carregarDetalhes();
            if (onReservaAtualizada) onReservaAtualizada();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao realizar check-in.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCheckout = async () => {
        if (!confirm('Deseja liberar a sala agora antecipadamente?')) return;
        setActionLoading(true);
        try {
            await api.post(`/salas-reuniao/reservas/${reservaId}/checkout`);
            await carregarDetalhes();
            if (onReservaAtualizada) onReservaAtualizada();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao liberar sala.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancelar = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            await api.post(`/salas-reuniao/reservas/${reservaId}/cancelar`, {
                motivo: motivoCancelamento
            });
            setModalCancelarAberto(false);
            await carregarDetalhes();
            if (onReservaAtualizada) onReservaAtualizada();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao cancelar reserva.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleImprimirAta = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-300">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3"></div>
                    <p className="text-sm font-semibold">Carregando detalhes da reserva...</p>
                </div>
            </div>
        );
    }

    if (erro || !detalhes) {
        return (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-slate-100 text-center">
                    <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-red-300 mb-4">{erro || 'Reserva não encontrada.'}</p>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-white">
                        Fechar
                    </button>
                </div>
            </div>
        );
    }

    const { reserva, participantes = [], historico = [] } = detalhes;

    const statusBadge = {
        confirmada: { label: 'Confirmada', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
        em_andamento: { label: 'Em Andamento', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
        concluida: { label: 'Concluída', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
        cancelada: { label: 'Cancelada', bg: 'bg-red-500/20 text-red-300 border-red-500/30' }
    }[reserva.status] || { label: reserva.status, bg: 'bg-slate-800 text-slate-300 border-slate-700' };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto print:p-0 print:bg-white">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:text-black print:bg-white">
                
                {/* Header Superior */}
                <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 print:bg-white print:border-b-2 print:border-black">
                    <div className="flex items-center gap-3">
                        <div 
                            className="w-4 h-4 rounded-full shadow shrink-0" 
                            style={{ backgroundColor: reserva.cor_etiqueta || '#0284C7' }} 
                        />
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg md:text-xl font-bold text-white print:text-black">
                                    {reserva.titulo}
                                </h2>
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadge.bg}`}>
                                    {statusBadge.label}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 print:text-slate-600 font-mono">
                                Código: <strong className="text-slate-200 print:text-black">{reserva.codigo}</strong> • Sala: {reserva.sala_nome}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 print:hidden">
                        <button
                            onClick={handleImprimirAta}
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Imprimir Pauta/Ata"
                        >
                            <Printer className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Abas de Navegação (Detalhes vs Auditoria) */}
                <div className="px-6 border-b border-slate-800 flex items-center gap-4 bg-slate-950/30 print:hidden">
                    <button
                        onClick={() => setAbaAtiva('detalhes')}
                        className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                            abaAtiva === 'detalhes' 
                                ? 'border-blue-500 text-blue-400' 
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <FileText className="w-4 h-4" /> Dados da Reunião
                    </button>
                    <button
                        onClick={() => setAbaAtiva('historico')}
                        className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                            abaAtiva === 'historico' 
                                ? 'border-blue-500 text-blue-400' 
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <History className="w-4 h-4" /> Histórico e Auditoria ({historico.length})
                    </button>
                </div>

                {/* Conteúdo Principal */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 print:p-2">
                    
                    {abaAtiva === 'detalhes' ? (
                        <>
                            {/* Grid Informativo Principal */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 print:bg-white print:border-gray-300">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
                                        <Calendar className="w-4 h-4 text-blue-400" /> Data e Horário
                                    </div>
                                    <div className="text-sm font-bold text-white print:text-black">
                                        {new Date(reserva.data_reserva + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    </div>
                                    <div className="text-xs font-mono font-semibold text-blue-400 mt-0.5">
                                        {reserva.hora_inicio.slice(0, 5)} às {reserva.hora_fim.slice(0, 5)}
                                    </div>
                                </div>

                                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 print:bg-white print:border-gray-300">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
                                        <Building2 className="w-4 h-4 text-emerald-400" /> Local & Capacidade
                                    </div>
                                    <div className="text-sm font-bold text-white print:text-black">
                                        {reserva.sala_nome}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                        {reserva.sala_localizacao || 'Sede'} • Máx: {reserva.sala_capacidade} pessoas
                                    </div>
                                </div>

                                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 print:bg-white print:border-gray-300">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
                                        <Users className="w-4 h-4 text-purple-400" /> Organizador
                                    </div>
                                    <div className="text-sm font-bold text-white print:text-black truncate">
                                        {reserva.organizador_nome}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                                        {reserva.organizador_email || reserva.organizador_setor || 'Colaborador'}
                                    </div>
                                </div>
                            </div>

                            {/* Recursos Solicitados */}
                            {reserva.recursos_solicitados && (
                                <div className="bg-blue-950/30 border border-blue-900/40 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 text-xs font-bold text-blue-300 uppercase tracking-wider mb-2">
                                        <Coffee className="w-4 h-4" /> Recursos Extras Solicitados
                                    </div>
                                    <div className="text-sm text-slate-200">
                                        {reserva.recursos_solicitados}
                                    </div>
                                </div>
                            )}

                            {/* Pauta da Reunião */}
                            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-400" /> Pauta & Tópicos da Reunião
                                </h3>
                                <div className="text-sm text-slate-200 whitespace-pre-line leading-relaxed font-sans">
                                    {reserva.pauta || <span className="text-slate-500 italic">Nenhuma pauta específica informada.</span>}
                                </div>
                            </div>

                            {/* Participantes Convocados */}
                            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-blue-400" /> Participantes Convocados ({participantes.length})
                                    </span>
                                </h3>
                                
                                {participantes.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        {participantes.map(p => (
                                            <div 
                                                key={p.usuario_id}
                                                className="flex items-center justify-between bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5"
                                            >
                                                <div className="flex items-center gap-2.5 truncate">
                                                    <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0">
                                                        {p.NomeCompleto ? p.NomeCompleto.charAt(0).toUpperCase() : 'U'}
                                                    </div>
                                                    <div className="truncate">
                                                        <div className="text-xs font-bold text-slate-200 truncate">{p.NomeCompleto}</div>
                                                        <div className="text-[10px] text-slate-400 truncate">{p.Setor || p.email}</div>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
                                                    p.confirmou_presenca 
                                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                                        : 'bg-slate-800 text-slate-400 border-slate-700'
                                                }`}>
                                                    {p.confirmou_presenca ? 'Presença Confirmada' : 'Pendente'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">Nenhum participante adicional registrado nesta reserva.</p>
                                )}
                            </div>

                            {/* Informações de Cancelamento (se houver) */}
                            {reserva.status === 'cancelada' && (
                                <div className="bg-red-950/40 border border-red-900/50 rounded-2xl p-4 text-xs text-red-200">
                                    <div className="font-bold text-red-300 mb-1 flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4" /> Motivo do Cancelamento:
                                    </div>
                                    <p className="mb-2 italic">"{reserva.motivo_cancelamento || 'Não informado'}"</p>
                                    <div className="text-[11px] text-red-400">
                                        Cancelado por: <strong>{reserva.cancelado_por_nome || 'Usuário'}</strong> em {new Date(reserva.cancelado_em).toLocaleString('pt-BR')}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Aba de Histórico de Auditoria */
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <History className="w-4 h-4 text-blue-400" /> Trilha de Auditoria e Modificações
                            </h3>
                            <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                                {historico.map(h => (
                                    <div key={h.id} className="relative pl-8 text-xs">
                                        <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-blue-500"></div>
                                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className="font-bold text-white capitalize">{h.acao.replace('_', ' ')}</span>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    {new Date(h.created_at).toLocaleString('pt-BR')}
                                                </span>
                                            </div>
                                            <p className="text-slate-300">{h.descricao}</p>
                                            {h.usuario_nome && (
                                                <div className="text-[10px] text-slate-400 mt-1">
                                                    Executado por: <span className="text-slate-200 font-semibold">{h.usuario_nome}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer com Botões de Ação */}
                <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 flex-wrap print:hidden">
                    <div className="flex items-center gap-2">
                        {reserva.status === 'confirmada' && (
                            <button
                                onClick={handleCheckin}
                                disabled={actionLoading}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Realizar Check-in
                            </button>
                        )}

                        {reserva.status === 'em_andamento' && (
                            <button
                                onClick={handleCheckout}
                                disabled={actionLoading}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <LogOut className="w-4 h-4" /> Liberar Sala Antecipada
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {reserva.status !== 'cancelada' && reserva.status !== 'concluida' && (
                            <>
                                <button
                                    onClick={() => {
                                        onClose();
                                        if (onAbrirEdicao) onAbrirEdicao(reserva);
                                    }}
                                    className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5"
                                >
                                    <Edit2 className="w-3.5 h-3.5 text-blue-400" /> Editar
                                </button>
                                <button
                                    onClick={() => setModalCancelarAberto(true)}
                                    className="px-3.5 py-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-300 transition-colors flex items-center gap-1.5"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Cancelar Reserva
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </div>

                {/* Sub-modal: Motivo do Cancelamento */}
                {modalCancelarAberto && (
                    <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-400" /> Cancelar Reserva
                            </h3>
                            <p className="text-xs text-slate-400">
                                Por favor, informe o motivo do cancelamento para registrar no histórico corporativo:
                            </p>
                            <form onSubmit={handleCancelar} className="space-y-4">
                                <textarea
                                    value={motivoCancelamento}
                                    onChange={(e) => setMotivoCancelamento(e.target.value)}
                                    required
                                    rows={3}
                                    placeholder="Ex: Reunião reagendada pelo cliente; Imprevisto de diretoria..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
                                />
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setModalCancelarAberto(false)}
                                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/20 disabled:opacity-50"
                                    >
                                        {actionLoading ? 'Cancelando...' : 'Confirmar Cancelamento'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default DetalhesReservaModal;
