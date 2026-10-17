import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    X, Maximize2, Minimize2, Clock, Users, Calendar, 
    CheckCircle2, AlertCircle, Play, LogOut, Sparkles, Building2,
    Tv, Video, Wind, MonitorCheck, ChevronDown
} from 'lucide-react';
import { toast } from 'react-toastify';
import { salasReuniaoService } from '../../services/salasReuniaoService';

const NO_SALAS = [];

export default function TotemPortaModal({ isOpen, onClose, salas = NO_SALAS, onReservaCriada }) {
    const params = useParams();
    const navigate = useNavigate();
    const isStandalone = isOpen === undefined;
    const modalIsOpen = isStandalone ? true : isOpen;

    const [listaSalas, setListaSalas] = useState(salas);
    const [selectedSalaId, setSelectedSalaId] = useState(params.salaId || salas[0]?.id || '');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [reservasHoje, setReservasHoje] = useState([]);
    const [loading, setLoading] = useState(false);
    const [quickTitle, setQuickTitle] = useState('');
    const [isCreatingQuick, setIsCreatingQuick] = useState(false);

    // Carregar salas se for rota autônoma e salas vier vazio
    useEffect(() => {
        if (salas && salas.length > 0) {
            setListaSalas(salas);
            if (!selectedSalaId) setSelectedSalaId(params.salaId || salas[0].id);
        } else {
            salasReuniaoService.listarSalas().then(data => {
                const sList = Array.isArray(data) ? data : (data?.salas || []);
                setListaSalas(sList);
                if (!selectedSalaId && sList.length > 0) {
                    setSelectedSalaId(params.salaId || sList[0].id);
                }
            }).catch(e => console.error('Erro ao listar salas no totem:', e));
        }
    }, [salas, params.salaId]);

    // Atualizar relógio em tempo real a cada segundo
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Carregar reservas da sala selecionada para o dia atual
    const carregarReservasSala = async (salaId) => {
        if (!salaId) return;
        setLoading(true);
        try {
            const hojeStr = new Date().toISOString().split('T')[0];
            const data = await salasReuniaoService.listarReservas({
                sala_id: salaId,
                data_inicio: hojeStr,
                data_fim: hojeStr
            });
            const list = Array.isArray(data) ? data : (data?.reservas || []);
            setReservasHoje(list);
        } catch (err) {
            console.error('Erro ao carregar reservas para o totem:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (modalIsOpen && selectedSalaId) {
            carregarReservasSala(selectedSalaId);
            const interval = setInterval(() => carregarReservasSala(selectedSalaId), 15000);
            return () => clearInterval(interval);
        }
    }, [modalIsOpen, selectedSalaId]);

    if (!modalIsOpen) return null;

    const salaAtual = listaSalas.find(s => String(s.id) === String(selectedSalaId)) || listaSalas[0];

    // Helper para obter datas locais da reserva sem desvio UTC
    const getReservaDates = (r) => {
        if (!r) return { ini: new Date(), fim: new Date() };
        const dt = r.data_reserva || (typeof r.data_hora_inicio === 'string' ? r.data_hora_inicio.slice(0, 10) : new Date().toISOString().slice(0, 10));
        const hIni = r.hora_inicio ? r.hora_inicio.slice(0, 5) : '00:00';
        const hFim = r.hora_fim ? r.hora_fim.slice(0, 5) : '23:59';
        return {
            ini: new Date(`${dt}T${hIni}:00`),
            fim: new Date(`${dt}T${hFim}:00`)
        };
    };

    // Calcular estado atual da sala
    const agora = currentTime;
    const reservaEmAndamento = reservasHoje.find(r => {
        if (r.status !== 'confirmada' && r.status !== 'em_andamento') return false;
        if (r.liberada_antecipadamente) return false;
        const { ini, fim } = getReservaDates(r);
        return agora >= ini && agora < fim;
    });

    // Próxima reunião do dia após agora
    const proximasReservas = reservasHoje
        .filter(r => {
            if (r.status !== 'confirmada' && r.status !== 'em_andamento') return false;
            if (r.liberada_antecipadamente) return false;
            const { ini } = getReservaDates(r);
            return ini > agora;
        })
        .sort((a, b) => {
            const { ini: iniA } = getReservaDates(a);
            const { ini: iniB } = getReservaDates(b);
            return iniA - iniB;
        });

    const proximaReuniao = proximasReservas[0];

    // Alternar modo de tela cheia nativo do navegador
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
    };

    // Reserva Expressa (15, 30 ou 60 minutos a partir de agora)
    const handleReservaExpressa = async (minutos) => {
        if (!salaAtual) return;
        setIsCreatingQuick(true);
        try {
            const ini = new Date();
            const fim = new Date(ini.getTime() + minutos * 60000);
            const pad = (n) => String(n).padStart(2, '0');
            const data_reserva = `${ini.getFullYear()}-${pad(ini.getMonth() + 1)}-${pad(ini.getDate())}`;
            const hora_inicio = `${pad(ini.getHours())}:${pad(ini.getMinutes())}`;
            const hora_fim = `${pad(fim.getHours())}:${pad(fim.getMinutes())}`;

            const payload = {
                sala_id: salaAtual.id,
                titulo: quickTitle.trim() || `Reunião Rápida (${minutos} min)`,
                pauta: 'Reserva expressa via Totem de Porta',
                data_reserva,
                hora_inicio,
                hora_fim,
                duracao_minutos: minutos,
                participantes: [],
                notificar_email: false
            };

            await salasReuniaoService.reservaRapida(payload);
            toast.success(`Reserva expressa de ${minutos}m confirmada com sucesso!`);
            setQuickTitle('');
            await carregarReservasSala(salaAtual.id);
            if (onReservaCriada) onReservaCriada();
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Conflito ao criar reserva expressa.';
            toast.error(`Não foi possível reservar: ${msg}`);
        } finally {
            setIsCreatingQuick(false);
        }
    };

    // Liberar sala agora (check-out antecipado)
    const handleLiberarSalaAgora = async () => {
        if (!reservaEmAndamento) return;
        try {
            await salasReuniaoService.liberarSala(reservaEmAndamento.id);
            toast.success('Sala liberada antecipadamente com sucesso!');
            await carregarReservasSala(salaAtual.id);
            if (onReservaCriada) onReservaCriada();
        } catch (err) {
            toast.error('Erro ao liberar sala.');
        }
    };

    // Calcular tempo restante da reunião atual
    const calcularTempoRestante = () => {
        if (!reservaEmAndamento) return null;
        const { fim } = getReservaDates(reservaEmAndamento);
        const diffMs = fim - agora;
        if (diffMs <= 0) return 'Terminando agora';
        const mins = Math.floor(diffMs / 60000);
        if (mins < 60) return `${mins} min restantes`;
        const hrs = Math.floor(mins / 60);
        const rmins = mins % 60;
        return `${hrs}h ${rmins}m restantes`;
    };

    // Calcular tempo até a próxima reunião
    const calcularTempoAteProxima = () => {
        if (!proximaReuniao) return null;
        const { ini } = getReservaDates(proximaReuniao);
        const diffMs = ini - agora;
        const mins = Math.floor(diffMs / 60000);
        if (mins <= 0) return 'Iniciando a qualquer momento';
        if (mins < 60) return `em ${mins} min`;
        const hrs = Math.floor(mins / 60);
        const rmins = mins % 60;
        return `em ${hrs}h ${rmins}m`;
    };

    // Parse recursos da sala
    let recursosList = [];
    try {
        recursosList = typeof salaAtual?.recursos === 'string' ? JSON.parse(salaAtual.recursos) : (salaAtual?.recursos || []);
    } catch {
        recursosList = [];
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
            {/* Barra Superior Minimalista de Controle do Totem */}
            <header className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between backdrop-blur">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] flex items-center justify-center font-bold text-amber-400 border border-slate-700">
                            MF
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Metalfisa • Display de Porta</div>
                            <div className="font-bold text-slate-200 text-sm">Totem de Reuniões</div>
                        </div>
                    </div>

                    {/* Seletor de Sala para o Totem */}
                    <div className="relative ml-4">
                        <select
                            value={selectedSalaId}
                            onChange={(e) => setSelectedSalaId(e.target.value)}
                            aria-label="Selecionar Sala do Totem"
                            className="bg-slate-800 text-white text-base font-semibold px-4 py-2 pr-10 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#D97706] cursor-pointer appearance-none shadow-sm"
                        >
                            {salas.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.nome} ({s.localizacao})
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>

                {/* Relógio Digital Centralizado */}
                <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800 px-5 py-2 rounded-xl">
                    <Clock className="w-5 h-5 text-[#D97706]" />
                    <span className="text-2xl font-mono font-bold tracking-tight text-white">
                        {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="text-xs text-slate-400 border-l border-slate-800 pl-3 uppercase">
                        {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </span>
                </div>

                {/* Ações de Tela Cheia e Fechar */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleFullscreen}
                        className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                        title={isFullscreen ? 'Sair da Tela Cheia' : 'Modo Tela Cheia (Totem)'}
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={() => {
                            if (onClose) onClose();
                            else if (isStandalone) navigate('/salas');
                        }}
                        className="p-2.5 rounded-lg bg-slate-800 hover:bg-red-950/40 hover:text-red-400 text-slate-400 transition-colors border border-slate-700"
                        title="Fechar Totem"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Conteúdo Principal do Totem Dividido em 2 Colunas */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                {/* Coluna Esquerda: Status Gigante de Alta Visibilidade (7 cols) */}
                <div className="lg:col-span-7 p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/40 relative">
                    {/* Header da Sala */}
                    <div>
                        <div className="flex items-center gap-3">
                            <span 
                                className="w-4 h-4 rounded-full shadow-lg"
                                style={{ backgroundColor: salaAtual?.cor_hex || '#1E3A5F' }}
                            />
                            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                                {salaAtual?.nome || 'Sala de Reunião'}
                            </h1>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-slate-400 text-sm">
                            <span>📍 {salaAtual?.localizacao || 'Metalfisa'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-slate-400" />
                                Capacidade: <strong className="text-slate-200">{salaAtual?.capacidade || 10} pessoas</strong>
                            </span>
                        </div>

                        {/* Badges de Recursos */}
                        {recursosList.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4">
                                {recursosList.map((rec, idx) => (
                                    <span 
                                        key={idx}
                                        className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/60 font-medium"
                                    >
                                        ✓ {rec}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* STATUS CARD GIGANTE */}
                    <div className="my-auto py-6">
                        {reservaEmAndamento ? (
                            <div className="p-8 rounded-3xl bg-red-950/40 border-2 border-red-500/80 shadow-[0_0_50px_rgba(220,38,38,0.2)] animate-pulse-subtle">
                                <div className="flex items-center gap-3 text-red-400 font-bold uppercase tracking-wider text-sm lg:text-base">
                                    <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-ping" />
                                    <span>Sala Ocupada no Momento</span>
                                </div>

                                <div className="mt-4 text-3xl lg:text-5xl font-black text-white leading-tight">
                                    {reservaEmAndamento.titulo}
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-slate-300 text-base">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-red-400" />
                                        <span>
                                            {reservaEmAndamento.hora_inicio} às {reservaEmAndamento.hora_fim}
                                        </span>
                                    </div>
                                    <div className="bg-red-900/60 text-red-200 font-semibold px-3 py-1 rounded-full text-sm">
                                        ⏳ {calcularTempoRestante()}
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-red-800/40 flex items-center justify-between">
                                    <div className="text-sm text-slate-300">
                                        Organizador: <strong className="text-white">{reservaEmAndamento.organizador_nome}</strong>
                                        {reservaEmAndamento.departamento && ` (${reservaEmAndamento.departamento})`}
                                    </div>
                                    <button
                                        onClick={handleLiberarSalaAgora}
                                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Liberar Sala Agora
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 rounded-3xl bg-emerald-950/40 border-2 border-emerald-500/80 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                                <div className="flex items-center gap-3 text-emerald-400 font-bold uppercase tracking-wider text-sm lg:text-base">
                                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981]" />
                                    <span>Disponível Agora</span>
                                </div>

                                <div className="mt-4 text-3xl lg:text-5xl font-black text-white leading-tight">
                                    Sala Livre para Uso
                                </div>

                                {proximaReuniao ? (
                                    <div className="mt-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 text-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-amber-400 font-bold">Próxima Reunião:</span>{' '}
                                            <strong className="text-white">{proximaReuniao.titulo}</strong> às{' '}
                                            {proximaReuniao.hora_inicio}{' '}
                                            ({calcularTempoAteProxima()})
                                        </div>
                                        <span className="text-xs text-slate-400">Por {proximaReuniao.organizador_nome}</span>
                                    </div>
                                ) : (
                                    <p className="mt-3 text-slate-400 text-base">
                                        Nenhuma outra reunião agendada para hoje nesta sala.
                                    </p>
                                )}

                                {/* Ações Rápidas de Reserva no Totem */}
                                <div className="mt-6 pt-6 border-t border-emerald-800/40">
                                    <div className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-3">
                                        Reserva Instantânea de Porta:
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            disabled={isCreatingQuick}
                                            onClick={() => handleReservaExpressa(15)}
                                            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center gap-2 active:scale-95"
                                        >
                                            <Play className="w-4 h-4 fill-white" />
                                            Ocupar +15 minutos
                                        </button>
                                        <button
                                            disabled={isCreatingQuick}
                                            onClick={() => handleReservaExpressa(30)}
                                            className="px-5 py-3 rounded-xl bg-[#1E3A5F] hover:bg-[#254A78] text-white font-bold text-sm border border-slate-700 shadow-md transition-all flex items-center gap-2 active:scale-95"
                                        >
                                            <Play className="w-4 h-4 fill-white" />
                                            Ocupar +30 minutos
                                        </button>
                                        <button
                                            disabled={isCreatingQuick}
                                            onClick={() => handleReservaExpressa(60)}
                                            className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
                                        >
                                            <Play className="w-4 h-4 fill-white" />
                                            Ocupar +1 hora
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Rodapé Informativo */}
                    <div className="text-xs text-slate-500 flex items-center justify-between pt-4 border-t border-slate-800/80">
                        <span>Atualização automática a cada 30 segundos</span>
                        <span>Sistema Metalfisa Corporativo</span>
                    </div>
                </div>

                {/* Coluna Direita: Agenda do Dia e Próximos Horários (5 cols) */}
                <div className="lg:col-span-5 p-6 bg-slate-900/60 flex flex-col justify-between overflow-y-auto">
                    <div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-[#D97706]" />
                                <h3 className="font-bold text-white text-base">Agenda de Hoje</h3>
                            </div>
                            <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700 font-mono">
                                {reservasHoje.length} evento(s)
                            </span>
                        </div>

                        {/* Lista de Reuniões do Dia */}
                        <div className="mt-4 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                            {loading ? (
                                <div className="text-center py-10 text-slate-500">Atualizando agenda...</div>
                            ) : reservasHoje.length === 0 ? (
                                <div className="p-8 text-center bg-slate-800/30 rounded-2xl border border-dashed border-slate-800 text-slate-400">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                                    <p className="font-semibold text-slate-300">Sala 100% Livre Hoje</p>
                                    <p className="text-xs mt-1 text-slate-500">Nenhuma reserva agendada para o restante do dia.</p>
                                </div>
                            ) : (
                                reservasHoje.map((reserva) => {
                                    const { ini, fim } = getReservaDates(reserva);
                                    const isNow = agora >= ini && agora < fim && !reserva.liberada_antecipadamente;
                                    const isPast = fim <= agora || reserva.liberada_antecipadamente;

                                    return (
                                        <div
                                            key={reserva.id}
                                            className={`p-4 rounded-xl border transition-all ${
                                                isNow
                                                    ? 'bg-red-950/30 border-red-500/60 shadow-md'
                                                    : isPast
                                                    ? 'bg-slate-900/30 border-slate-800/60 opacity-50'
                                                    : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                                                <span className={`font-bold ${isNow ? 'text-red-400' : 'text-slate-300'}`}>
                                                    {reserva.hora_inicio} - {reserva.hora_fim}
                                                </span>
                                                {isNow && (
                                                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-sans font-bold text-[10px] animate-pulse">
                                                        EM ANDAMENTO
                                                    </span>
                                                )}
                                                {reserva.liberada_antecipadamente ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-sans text-[10px]">
                                                        LIBERADA ANTES
                                                    </span>
                                                ) : isPast ? (
                                                    <span className="text-slate-500 font-sans text-[10px]">CONCLUÍDA</span>
                                                ) : null}
                                            </div>

                                            <div className="font-semibold text-slate-100 text-sm leading-snug">
                                                {reserva.titulo}
                                            </div>

                                            <div className="mt-2 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                                                <span className="truncate max-w-[200px]">
                                                    👤 {reserva.organizador_nome}
                                                </span>
                                                {reserva.participantes_count > 0 && (
                                                    <span className="flex items-center gap-1 text-slate-400">
                                                        <Users className="w-3.5 h-3.5" />
                                                        {reserva.participantes_count}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Dica de Utilização */}
                    <div className="mt-4 p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-slate-400 text-xs text-center">
                        Para reuniões longas ou com convidados externos, agende pelo computador ou celular.
                    </div>
                </div>
            </div>
        </div>
    );
}
