import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
    Calendar as CalendarIcon, Clock, Users, Plus, Settings, 
    RefreshCw, Tablet, Search, Filter, CheckCircle2, AlertCircle, 
    ChevronLeft, ChevronRight, MoreHorizontal, ArrowLeftRight, 
    LogOut, Trash2, Edit3, Eye, Building2, MapPin, Tv, Video, Wind, Check, MessageSquare, Printer
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { salasReuniaoService } from '../../services/salasReuniaoService';

// Modais
import NovaReservaModal from './NovaReservaModal';
import EditarReservaModal from './EditarReservaModal';
import GerenciarSalasModal from './GerenciarSalasModal';
import TotemPortaModal from './TotemPortaModal';
import ImprimirFolhaPortaModal from './ImprimirFolhaPortaModal';

export default function SalasReuniaoCentral() {
    const { user } = useAuth();

    // Estados de dados
    const [salas, setSalas] = useState([]);
    const [reservas, setReservas] = useState([]);
    const [participantesDisponiveis, setParticipantesDisponiveis] = useState([]);
    const [loadingSalas, setLoadingSalas] = useState(true);
    const [loadingReservas, setLoadingReservas] = useState(false);

    // Estados de visualização e filtros
    const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'cards' | 'lista'
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [currentTime, setCurrentTime] = useState(new Date());
    const [filtroSalaId, setFiltroSalaId] = useState('');
    const [buscaTexto, setBuscaTexto] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [filtroPeriodoLista, setFiltroPeriodoLista] = useState('todas'); // 'todas' | 'dia'

    // Formatar data atual para YYYY-MM-DD
    const currentDateStr = useMemo(() => {
        const d = currentDate;
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }, [currentDate]);

    // Verificar se a data selecionada é o dia de hoje
    const isHoje = useMemo(() => {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const hojeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        return currentDateStr === hojeStr;
    }, [currentDateStr]);

    // Cálculo da linha vermelha do "Agora" (se hoje for o dia selecionado)
    const posicaoLinhaAgoraPercent = useMemo(() => {
        if (!isHoje) return null;
        const hora = currentTime.getHours();
        const min = currentTime.getMinutes();
        const totalMin = hora * 60 + min;
        const totalJanelaMin = 24 * 60; // 24 horas = 1440 minutos
        if (totalMin < 0 || totalMin > totalJanelaMin) return null;
        return (totalMin / totalJanelaMin) * 100;
    }, [isHoje, currentTime]);

    // Estados de modais
    const [isNovaReservaOpen, setIsNovaReservaOpen] = useState(false);
    const [slotInicialParaNova, setSlotInicialParaNova] = useState({ salaId: '', data: '', horaInicio: '', horaFim: '' });
    const [isEditarReservaOpen, setIsEditarReservaOpen] = useState(false);
    const [reservaSelecionada, setReservaSelecionada] = useState(null);
    const [isGerenciarSalasOpen, setIsGerenciarSalasOpen] = useState(false);
    const [isTotemOpen, setIsTotemOpen] = useState(false);
    const [isImprimirFolhaOpen, setIsImprimirFolhaOpen] = useState(false);
    const [salaParaImprimir, setSalaParaImprimir] = useState(null);

    const abrirModalImprimir = (sala = null) => {
        setSalaParaImprimir(sala);
        setIsImprimirFolhaOpen(true);
    };

    // Ref para controle de rolagem horizontal da Timeline de 24 horas
    const timelineScrollRef = useRef(null);

    // Função para centralizar a hora atual do dia sempre no meio da tela
    const centralizarHoraAtual = useCallback((smooth = true) => {
        if (!timelineScrollRef.current) return;
        const container = timelineScrollRef.current;
        const clientWidth = container.clientWidth;
        const scrollWidth = container.scrollWidth;
        if (!clientWidth || !scrollWidth) return;

        // Largura da coluna fixa de salas (w-64 = 256px)
        const leftColWidth = 256;
        const timelineWidth = Math.max(0, scrollWidth - leftColWidth);

        // Percentual do momento atual no dia (0 a 1)
        const now = new Date();
        const totalMin = now.getHours() * 60 + now.getMinutes();
        const percent = Math.min(1, Math.max(0, totalMin / 1440));

        // Posição absoluta em pixels do horário atual
        const nowPixelPosition = leftColWidth + (percent * timelineWidth);

        // Alinhamento exato: o pixel atual fica no centro da área visível da tela
        const targetScrollLeft = Math.max(0, nowPixelPosition - (clientWidth / 2));

        container.scrollTo({
            left: targetScrollLeft,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }, []);

    // Auto-scroll ao abrir a timeline, mudar data ou redimensionar a janela
    useEffect(() => {
        if (viewMode === 'timeline' && isHoje) {
            const t1 = setTimeout(() => centralizarHoraAtual(false), 60);
            const t2 = setTimeout(() => centralizarHoraAtual(false), 350);

            const handleResize = () => centralizarHoraAtual(false);
            window.addEventListener('resize', handleResize);

            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                window.removeEventListener('resize', handleResize);
            };
        }
    }, [viewMode, isHoje, centralizarHoraAtual]);

    // Relógio em tempo real para a linha vermelha do "Agora" na Timeline
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);



    // Carregar salas
    const carregarSalas = useCallback(async () => {
        setLoadingSalas(true);
        try {
            const data = await salasReuniaoService.listarSalas();
            setSalas(data || []);
        } catch (err) {
            console.error('Erro ao carregar salas:', err);
            toast.error('Erro ao carregar lista de salas de reunião.');
        } finally {
            setLoadingSalas(false);
        }
    }, []);

    // Carregar reservas
    const carregarReservas = useCallback(async () => {
        setLoadingReservas(true);
        try {
            const params = {};
            if (viewMode !== 'lista' || filtroPeriodoLista === 'dia') {
                params.data_inicio = currentDateStr;
                params.data_fim = currentDateStr;
            }
            if (filtroSalaId) params.sala_id = filtroSalaId;

            const data = await salasReuniaoService.listarReservas(params);
            setReservas(data || []);
        } catch (err) {
            console.error('Erro ao carregar reservas:', err);
            toast.error('Erro ao carregar reservas.');
        } finally {
            setLoadingReservas(false);
        }
    }, [currentDateStr, filtroSalaId, viewMode, filtroPeriodoLista]);

    // Carregar colaboradores ativos
    const carregarParticipantes = useCallback(async () => {
        try {
            const data = await salasReuniaoService.getParticipantesDisponiveis();
            setParticipantesDisponiveis(data || []);
        } catch (err) {
            console.error('Erro ao carregar colaboradores:', err);
        }
    }, []);

    // Carregar dados iniciais e ao mudar data
    useEffect(() => {
        carregarSalas();
        carregarParticipantes();
    }, [carregarSalas, carregarParticipantes]);

    useEffect(() => {
        carregarReservas();
    }, [carregarReservas]);

    // Navegação de dias
    const navegarDia = (dias) => {
        const novaData = new Date(currentDate);
        novaData.setDate(novaData.getDate() + dias);
        setCurrentDate(novaData);
    };

    const irParaHoje = () => {
        setCurrentDate(new Date());
        setTimeout(() => centralizarHoraAtual(true), 120);
    };

    // Abertura do modal de criação clicando num slot vazio da timeline (24 horas)
    const handleSlotClick = (salaId, hora) => {
        const horaNum = parseInt(hora.split(':')[0], 10);
        const horaFimNum = (horaNum + 1) % 24;
        const pad = (n) => String(n).padStart(2, '0');

        setSlotInicialParaNova({
            salaId: salaId,
            data: currentDateStr,
            horaInicio: `${pad(horaNum)}:00`,
            horaFim: `${pad(horaFimNum === 0 ? 23 : horaFimNum)}:${horaFimNum === 0 ? '59' : '00'}`
        });
        setIsNovaReservaOpen(true);
    };

    const abrirNovaReservaLivre = () => {
        setSlotInicialParaNova({
            salaId: filtroSalaId || (salas[0]?.id || ''),
            data: currentDateStr,
            horaInicio: '09:00',
            horaFim: '10:00'
        });
        setIsNovaReservaOpen(true);
    };

    // Abrir modal de edição/detalhes
    const handleAbrirEditar = (reserva) => {
        setReservaSelecionada(reserva);
        setIsEditarReservaOpen(true);
    };

    // Compartilhar convite da reunião no WhatsApp
    const handleCompartilharWhatsAppReserva = (r, e) => {
        if (e) e.stopPropagation();
        let dataFmt = r.data_reserva;
        try {
            const [y, m, d] = String(r.data_reserva).split('T')[0].split('-');
            dataFmt = `${d}/${m}/${y}`;
        } catch (err) {}

        const nomesPart = Array.isArray(r.participantes) && r.participantes.length > 0
            ? r.participantes.map(p => p.nome || p.NomeCompleto).join(', ')
            : 'Participantes convocados';

        const texto = `🔔 *CONVITE DE REUNIÃO - METALFISA*\n` +
                      `--------------------------------------------------\n` +
                      `📌 *Assunto:* ${r.titulo}\n` +
                      `🏢 *Sala:* ${r.sala_nome} (${r.sala_localizacao || 'Metalfisa'})\n` +
                      `📅 *Data:* ${dataFmt}\n` +
                      `⏰ *Horário:* ${r.hora_inicio} às ${r.hora_fim}\n` +
                      `👤 *Organizador:* ${r.organizador_nome || 'Metalfisa'}\n` +
                      (r.pauta ? `📝 *Pauta:* ${r.pauta}\n` : '') +
                      `👥 *Participantes:* ${nomesPart}\n` +
                      `--------------------------------------------------\n` +
                      `_Favor comparecer pontualmente à sala informada._`;

        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
    };

    // Liberar sala com 1 clique diretamente da lista
    const handleLiberarRapido = async (reservaId, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm('Deseja liberar esta sala antecipadamente agora?')) return;
        try {
            await salasReuniaoService.liberarSala(reservaId);
            toast.success('Sala liberada com sucesso!');
            carregarSalas();
            carregarReservas();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao liberar sala.');
        }
    };

    // Métricas para os Cards de Topo
    const metricas = useMemo(() => {
        const totalSalasAtivas = salas.filter(s => s.status === 'ativa').length;
        const salasOcupadasAgora = salas.filter(s => s.status_realtime?.ocupada_agora).length;
        const salasLivresAgora = Math.max(0, totalSalasAtivas - salasOcupadasAgora);
        
        // Apenas reuniões ativas do dia selecionado
        const reservasDoDia = reservas.filter(r => 
            r.status !== 'cancelada' &&
            (!r.data_reserva || String(r.data_reserva).substring(0, 10) === currentDateStr)
        );
        const totalReunioesHoje = reservasDoDia.length;

        // Horas totais agendadas vs 24h por sala ativa no dia
        let horasTotaisAgendadas = 0;
        reservasDoDia.forEach(r => {
            if (r.status === 'confirmada' || r.status === 'em_andamento') {
                const [hI, mI] = (r.hora_inicio || '00:00').split(':').map(Number);
                const [hF, mF] = (r.hora_fim || '00:00').split(':').map(Number);
                let duracaoHoras = (hF + (mF || 0) / 60) - (hI + (mI || 0) / 60);
                if (duracaoHoras < 0) duracaoHoras += 24; // caso passe da meia-noite
                horasTotaisAgendadas += Math.max(0, duracaoHoras);
            }
        });
        const capacidadeHorasDia = (totalSalasAtivas || 1) * 24; // 24 horas
        const taxaOcupacao = Math.min(100, Math.round((horasTotaisAgendadas / capacidadeHorasDia) * 100));

        return {
            totalSalasAtivas,
            salasLivresAgora,
            salasOcupadasAgora,
            totalReunioesHoje,
            taxaOcupacao
        };
    }, [salas, reservas, currentDateStr]);

    // Filtragem de reservas para a Visão Lista
    const reservasFiltradas = useMemo(() => {
        return reservas.filter(r => {
            if (filtroPeriodoLista === 'dia' && r.data_reserva && String(r.data_reserva).substring(0, 10) !== currentDateStr) return false;
            if (filtroSalaId && String(r.sala_id) !== String(filtroSalaId)) return false;
            if (filtroStatus !== 'todos') {
                if (filtroStatus === 'liberada' && !r.liberada_antecipadamente) return false;
                if (filtroStatus !== 'liberada' && r.status !== filtroStatus) return false;
            }
            if (buscaTexto.trim()) {
                const termo = buscaTexto.toLowerCase();
                const matchTitulo = r.titulo?.toLowerCase().includes(termo);
                const matchOrganizador = r.organizador_nome?.toLowerCase().includes(termo);
                const matchPauta = r.pauta?.toLowerCase().includes(termo);
                const matchSala = r.sala_nome?.toLowerCase().includes(termo);
                if (!matchTitulo && !matchOrganizador && !matchPauta && !matchSala) return false;
            }
            return true;
        });
    }, [reservas, filtroSalaId, filtroStatus, buscaTexto, currentDateStr, filtroPeriodoLista]);

    // Horários da Timeline: 24 horas ininterruptas (24 blocos de 1 hora de 00:00 até 23:00)
    const HORAS_TIMELINE = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);



    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* BARRA SUPERIOR PRINCIPAL / HEADER CORPORATIVO METALFISA */}
            <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
                <div className="w-full px-6 py-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                    {/* Identificação e Título */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[#1E3A5F] flex items-center justify-center text-white shadow-md shadow-[#1E3A5F]/20">
                            <Building2 className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight">
                                    Controle & Reserva de Salas
                                </h1>
                                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                                    Metalfisa
                                </span>
                            </div>
                            <p className="text-xs lg:text-sm text-slate-500">
                                Gestão inteligente de reuniões corporativas, sem sobreposição e com total flexibilidade
                            </p>
                        </div>
                    </div>

                    {/* Controles de Navegação de Data */}
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                        <button
                            onClick={() => navegarDia(-1)}
                            className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors shadow-none hover:shadow-sm"
                            title="Dia Anterior"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={irParaHoje}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                                isHoje 
                                    ? 'bg-[#1E3A5F] text-white shadow-sm' 
                                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                            }`}
                        >
                            Hoje
                        </button>
                        <button
                            onClick={() => navegarDia(1)}
                            className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors shadow-none hover:shadow-sm"
                            title="Próximo Dia"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>

                        <div className="h-4 w-px bg-slate-300 mx-1" />

                        <div className="relative flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-white/80 transition-colors cursor-pointer group" title="Clique para escolher uma data no calendário">
                            <CalendarIcon className="w-4 h-4 text-[#D97706] group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-bold text-slate-800 capitalize select-none">
                                {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">▼</span>
                            <input
                                type="date"
                                value={currentDateStr}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const [ano, mes, dia] = e.target.value.split('-').map(Number);
                                        setCurrentDate(new Date(ano, mes - 1, dia, 12, 0, 0));
                                    }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                title="Clique para escolher uma data no calendário"
                            />
                        </div>
                    </div>

                    {/* Ações Rápidas (Nova Reserva, Totem, Gerenciar, Imprimir) */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={carregarReservas}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shadow-sm"
                            title="Recarregar dados"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingReservas ? 'animate-spin text-[#1E3A5F]' : ''}`} />
                        </button>

                        <button
                            onClick={() => abrirModalImprimir(null)}
                            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-sm transition-all hover:border-[#1E3A5F]"
                            title="Imprimir Folha de Porta / Agenda Diária em formato A4 Paisagem MetalFisa"
                        >
                            <Printer className="w-4 h-4 text-[#1E3A5F]" />
                            <span className="hidden sm:inline">Folha de Porta (PDF)</span>
                        </button>

                        <button
                            onClick={() => setIsTotemOpen(true)}
                            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-amber-400 font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                            title="Abrir display de porta de sala para tablet"
                        >
                            <Tablet className="w-4 h-4" />
                            <span className="hidden sm:inline">Totem de Porta</span>
                        </button>

                        <button
                            onClick={() => setIsGerenciarSalasOpen(true)}
                            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                        >
                            <Settings className="w-4 h-4 text-slate-500" />
                            <span className="hidden sm:inline">Salas & Recursos</span>
                        </button>

                        <button
                            onClick={abrirNovaReservaLivre}
                            className="px-5 py-2.5 rounded-xl bg-[#1E3A5F] hover:bg-[#162A45] text-white font-extrabold text-sm flex items-center gap-2 shadow-md shadow-[#1E3A5F]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            <Plus className="w-5 h-5 text-amber-400" />
                            <span>Nova Reserva</span>
                        </button>
                    </div>
                </div>

                {/* CARDS DE MÉTRICAS RÁPIDAS (Widescreen) */}
                <div className="px-6 py-3 bg-slate-50/80 border-t border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Salas Disponíveis Agora</div>
                            <div className="text-xl font-extrabold text-emerald-700 flex items-center gap-2 mt-0.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                {metricas.salasLivresAgora} de {metricas.totalSalasAtivas}
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                            🟢
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Salas Ocupadas Agora</div>
                            <div className="text-xl font-extrabold text-red-700 flex items-center gap-2 mt-0.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                {metricas.salasOcupadasAgora}
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold">
                            🔴
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                                {isHoje ? 'Reuniões Agendadas Hoje' : 'Reuniões no Dia'}
                            </div>
                            <div className="text-xl font-extrabold text-[#1E3A5F] mt-0.5">
                                {metricas.totalReunioesHoje} reuniões
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#1E3A5F] flex items-center justify-center">
                            <CalendarIcon className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                                {isHoje ? 'Taxa de Ocupação Hoje' : 'Taxa de Ocupação no Dia'}
                            </div>
                            <div className="text-xl font-extrabold text-[#D97706] mt-0.5">
                                {metricas.taxaOcupacao}%
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* BARRA DE MODOS DE VISUALIZAÇÃO E FILTROS */}
                <div className="px-6 py-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    {/* Abas de Visualização */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${
                                viewMode === 'timeline'
                                    ? 'bg-[#1E3A5F] text-white shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Linha do Tempo (24 Horas)</span>
                        </button>

                        <button
                            onClick={() => setViewMode('cards')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${
                                viewMode === 'cards'
                                    ? 'bg-[#1E3A5F] text-white shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Building2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Grade de Salas</span>
                        </button>

                        <button
                            onClick={() => setViewMode('lista')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${
                                viewMode === 'lista'
                                    ? 'bg-[#1E3A5F] text-white shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <CalendarIcon className="w-3.5 h-3.5 text-amber-400" />
                            <span>Lista de Reuniões</span>
                        </button>
                    </div>

                    {/* Botão de Centralizar Hora Atual (quando na Linha do Tempo e Hoje) */}
                    {viewMode === 'timeline' && isHoje && (
                        <button
                            onClick={() => centralizarHoraAtual(true)}
                            className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
                            title="Centralizar a hora atual no meio da tela"
                        >
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                            <span>Centralizar Agora ({String(currentTime.getHours()).padStart(2, '0')}:{String(currentTime.getMinutes()).padStart(2, '0')})</span>
                        </button>
                    )}

                    {/* Filtro Rápido de Salas e Busca */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <select
                                value={filtroSalaId}
                                onChange={(e) => setFiltroSalaId(e.target.value)}
                                aria-label="Filtrar por Sala"
                                className="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                            >
                                <option value="">Todas as Salas ({salas.length})</option>
                                {salas.map(s => (
                                    <option key={s.id} value={s.id}>{s.nome}</option>
                                ))}
                            </select>
                        </div>

                        {viewMode === 'lista' && (
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar assunto, solicitante..."
                                    value={buscaTexto}
                                    onChange={(e) => setBuscaTexto(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] w-48 lg:w-64"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ÁREA DE CONTEÚDO PRINCIPAL (COM BASE NO MODO DE VISUALIZAÇÃO SELECIONADO) */}
            <div className="flex-1 p-6">
                {/* 1. VISÃO LINHA DO TEMPO (HORIZONTAL GANTT 24 HORAS) */}
                {viewMode === 'timeline' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        {/* Header da Timeline com Horários (24 Horas) */}
                        <div ref={timelineScrollRef} className="overflow-x-auto">
                            <div className="min-w-[2160px]">
                                <div className="flex border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-600">
                                    <div className="w-64 shrink-0 p-3.5 border-r border-slate-300 text-slate-700 uppercase tracking-wider font-extrabold flex items-center gap-2 sticky left-0 bg-slate-100 z-30 shadow-md">
                                        <Building2 className="w-4 h-4 text-[#1E3A5F]" />
                                        <span>Salas Físicas</span>
                                    </div>
                                    <div className="flex-1 grid text-center relative" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                                        {HORAS_TIMELINE.map((hora) => (
                                            <div key={hora} className="py-3.5 border-r border-slate-200 last:border-r-0 font-mono text-[11px] text-slate-600">
                                                {hora}
                                            </div>
                                        ))}
                                        {/* Marcador no Header com a hora exata */}
                                        {posicaoLinhaAgoraPercent !== null && (
                                            <div 
                                                style={{ left: `${posicaoLinhaAgoraPercent}%` }}
                                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-40 pointer-events-none"
                                            >
                                                <span className="bg-red-600 text-white font-mono text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg border border-white flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                                    {String(currentTime.getHours()).padStart(2, '0')}:{String(currentTime.getMinutes()).padStart(2, '0')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Linhas de cada Sala na Timeline */}
                                {salas.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400">
                                        Nenhuma sala cadastrada. Clique em "Salas & Recursos" para cadastrar.
                                    </div>
                                ) : (
                                    salas
                                        .filter(s => !filtroSalaId || String(s.id) === String(filtroSalaId))
                                        .map((sala) => {
                                            // Reservas ativas desta sala na data selecionada
                                            const reservasDestaSala = reservas.filter(
                                                r => String(r.sala_id) === String(sala.id) && 
                                                     r.status !== 'cancelada' &&
                                                     (!r.data_reserva || String(r.data_reserva).substring(0, 10) === currentDateStr)
                                            );

                                            return (
                                                <div 
                                                    key={sala.id} 
                                                    className="flex border-b border-slate-200 hover:bg-slate-50/50 transition-colors min-h-[90px] relative group"
                                                >
                                                    {/* Coluna de Informações da Sala (Sticky na esquerda) */}
                                                    <div className="w-64 shrink-0 p-3.5 border-r border-slate-300 flex flex-col justify-between bg-white sticky left-0 z-20 shadow-md">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span 
                                                                    className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                                                                    style={{ backgroundColor: sala.cor_hex || '#1E3A5F' }}
                                                                />
                                                                <span className="font-bold text-slate-800 text-sm truncate" title={sala.nome}>
                                                                    {sala.nome}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                                                <span>📍 {sala.localizacao}</span>
                                                                <span>•</span>
                                                                <span>👥 {sala.capacidade}p</span>
                                                            </div>
                                                        </div>

                                                        {/* Badge de Status Instantâneo */}
                                                        <div className="mt-2">
                                                            {sala.status_realtime?.ocupada_agora && isHoje ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                                                                    Ocupada até {sala.status_realtime?.reserva_atual?.hora_fim || 'breve'}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                                                    Livre Agora
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Coluna da Linha do Tempo (24 horas) */}
                                                    <div className="flex-1 relative grid" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                                                        {/* Slots clicáveis de 1 hora para reservar rápido */}
                                                        {HORAS_TIMELINE.map((hora) => (
                                                            <div 
                                                                key={hora}
                                                                onClick={() => handleSlotClick(sala.id, hora)}
                                                                className="border-r border-slate-100 last:border-r-0 hover:bg-amber-50/40 cursor-pointer transition-colors relative flex items-center justify-center group/slot"
                                                                title={`Clique para reservar a ${sala.nome} às ${hora}`}
                                                            >
                                                                <Plus className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover/slot:opacity-100 group-hover/slot:text-[#D97706] transition-opacity" />
                                                            </div>
                                                        ))}

                                                        {/* Renderizar Blocos de Reuniões Agendadas nesta sala */}
                                                        {reservasDestaSala.map((res) => {
                                                            const [hIni, mIni] = (res.hora_inicio || '00:00').split(':').map(Number);
                                                            const [hFim, mFim] = (res.hora_fim || '00:00').split(':').map(Number);

                                                            const iniHora = hIni + (mIni || 0) / 60;
                                                            let fimHora = hFim + (mFim || 0) / 60;
                                                            if (fimHora === 0 && iniHora > 0) fimHora = 24;

                                                            // Horário da timeline: 00:00 a 24:00 (24 horas = 100%)
                                                            const offsetHoras = iniHora;
                                                            const duracaoHoras = Math.max(0.25, fimHora - iniHora);

                                                            const leftPercent = Math.max(0, (offsetHoras / 24) * 100);
                                                            const widthPercent = Math.min(100 - leftPercent, (duracaoHoras / 24) * 100);

                                                            const isLiberada = res.liberada_antecipadamente;
                                                            const iniDate = new Date(`${res.data_reserva}T${res.hora_inicio}:00`);
                                                            const fimDate = new Date(`${res.data_reserva}T${res.hora_fim}:00`);
                                                            const isNow = isHoje && currentTime >= iniDate && currentTime < fimDate && !isLiberada;

                                                            return (
                                                                <div
                                                                    key={res.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleAbrirEditar(res);
                                                                    }}
                                                                    style={{
                                                                        left: `${leftPercent}%`,
                                                                        width: `${widthPercent}%`,
                                                                        backgroundColor: isLiberada 
                                                                            ? '#94A3B8' 
                                                                            : (res.cor_hex || '#1E3A5F')
                                                                    }}
                                                                    className={`absolute top-2 bottom-2 rounded-xl text-white px-3 py-1.5 cursor-pointer shadow-md transition-all hover:scale-[1.01] hover:z-20 overflow-hidden flex flex-col justify-between ${
                                                                        isNow 
                                                                            ? 'ring-2 ring-red-400 ring-offset-2 animate-pulse-subtle' 
                                                                            : ''
                                                                    } ${isLiberada ? 'opacity-60 line-through' : ''}`}
                                                                >
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        <span className="font-bold text-xs truncate leading-tight">
                                                                            {res.titulo}
                                                                        </span>
                                                                        {isNow && (
                                                                            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping flex-shrink-0" />
                                                                        )}
                                                                    </div>

                                                                    <div className="flex items-center justify-between text-[10px] text-white/90 font-mono mt-0.5">
                                                                        <span>
                                                                            {res.hora_inicio} - {res.hora_fim}
                                                                        </span>
                                                                        <span className="truncate max-w-[80px] font-sans font-medium text-white/80">
                                                                            {res.organizador_nome?.split(' ')[0]}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Linha Vermelha Vertical do "Agora" */}
                                                        {posicaoLinhaAgoraPercent !== null && (
                                                            <div 
                                                                style={{ left: `${posicaoLinhaAgoraPercent}%` }}
                                                                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                                                            >
                                                                <div className="w-2.5 h-2.5 rounded-full bg-red-600 -translate-x-[4px] -top-1 absolute" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        </div>

                        {/* Legenda da Linha do Tempo */}
                        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                    Linha Vermelha: Momento Atual (Horário de Brasília)
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                    Slot Vazio: Clique para reservar
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-slate-400" />
                                    Cinza / Riscado: Reunião Liberada Antecipadamente
                                </span>
                            </div>
                            <span className="font-semibold text-slate-600">
                                Janela Operacional: 24 Horas (Tempo Integral)
                            </span>
                        </div>
                    </div>
                )}

                {/* 2. VISÃO GRADE DE SALAS (CARDS MODERNOS DE CADA SALA) */}
                {viewMode === 'cards' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {salas
                            .filter(s => !filtroSalaId || String(s.id) === String(filtroSalaId))
                            .map((sala) => {
                                let recursosList = [];
                                try {
                                    recursosList = typeof sala.recursos === 'string' ? JSON.parse(sala.recursos) : (sala.recursos || []);
                                } catch {
                                    recursosList = [];
                                }

                                const reservasDestaSala = reservas.filter(
                                    r => String(r.sala_id) === String(sala.id) && 
                                         r.status !== 'cancelada' &&
                                         (!r.data_reserva || String(r.data_reserva).substring(0, 10) === currentDateStr)
                                );

                                const isOcupada = sala.status_realtime?.ocupada_agora && isHoje;

                                return (
                                    <div
                                        key={sala.id}
                                        className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                                    >
                                        <div>
                                            {/* Faixa Superior com Cor da Sala */}
                                            <div 
                                                className="h-3 w-full"
                                                style={{ backgroundColor: sala.cor_hex || '#1E3A5F' }}
                                            />

                                            <div className="p-5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h3 className="text-lg font-black text-slate-800 tracking-tight leading-snug">
                                                            {sala.nome}
                                                        </h3>
                                                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                                                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>{sala.localizacao}</span>
                                                        </div>
                                                    </div>

                                                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-1">
                                                        <Users className="w-3.5 h-3.5 text-slate-500" />
                                                        {sala.capacidade}p
                                                    </span>
                                                </div>

                                                {/* Status Live */}
                                                <div className="mt-4">
                                                    {isOcupada ? (
                                                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                                                            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                                                                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                                                                Ocupada Agora
                                                            </div>
                                                            <div className="font-semibold text-slate-800 text-sm mt-1 truncate">
                                                                {sala.status_realtime?.reserva_atual?.titulo}
                                                            </div>
                                                            <div className="text-slate-500 text-[11px] mt-0.5">
                                                                Até {sala.status_realtime?.reserva_atual?.hora_fim} • por {sala.status_realtime?.reserva_atual?.organizador}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                                                            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                                                                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                                                Livre para Uso
                                                            </div>
                                                            <div className="text-slate-600 text-[11px] mt-1">
                                                                Pronta para reuniões presenciais ou remotas.
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Recursos Multimídia */}
                                                {recursosList.length > 0 && (
                                                    <div className="mt-4 pt-3 border-t border-slate-100">
                                                        <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">Recursos Disponíveis:</div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {recursosList.map((rec, idx) => (
                                                                <span 
                                                                    key={idx}
                                                                    className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium"
                                                                >
                                                                    ✓ {rec}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Mini Lista das Próximas Reuniões */}
                                                <div className="mt-4 pt-3 border-t border-slate-100">
                                                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">
                                                        Agenda {isHoje ? 'Hoje' : 'no Dia'} ({reservasDestaSala.length}):
                                                    </div>
                                                    {reservasDestaSala.length === 0 ? (
                                                        <div className="text-xs text-slate-400 italic">Nenhuma reserva agendada para {isHoje ? 'hoje' : 'este dia'}.</div>
                                                    ) : (
                                                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                                            {reservasDestaSala.slice(0, 3).map(r => (
                                                                <div 
                                                                    key={r.id}
                                                                    onClick={() => handleAbrirEditar(r)}
                                                                    className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer border border-slate-200 text-xs transition-colors"
                                                                >
                                                                    <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                                                                        <span>
                                                                            {r.hora_inicio} - {r.hora_fim}
                                                                        </span>
                                                                        <span className="font-sans font-semibold text-slate-700">{r.organizador_nome?.split(' ')[0]}</span>
                                                                    </div>
                                                                    <div className="font-semibold text-slate-800 truncate mt-0.5">{r.titulo}</div>
                                                                </div>
                                                            ))}
                                                            {reservasDestaSala.length > 3 && (
                                                                <div className="text-[11px] text-center text-[#1E3A5F] font-bold">
                                                                    + {reservasDestaSala.length - 3} outra(s) reunião(ões)
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Botão de Agendamento Rápido e Impressão no Card */}
                                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    setSlotInicialParaNova({
                                                        salaId: sala.id,
                                                        data: currentDateStr,
                                                        horaInicio: '09:00',
                                                        horaFim: '10:00'
                                                    });
                                                    setIsNovaReservaOpen(true);
                                                }}
                                                className="flex-1 py-2 bg-white hover:bg-[#1E3A5F] text-[#1E3A5F] hover:text-white font-bold text-xs rounded-xl border border-slate-300 hover:border-[#1E3A5F] transition-all shadow-sm flex items-center justify-center gap-1.5"
                                            >
                                                <Plus className="w-4 h-4 text-amber-500" />
                                                Reservar Sala
                                            </button>

                                            <button
                                                onClick={() => abrirModalImprimir(sala)}
                                                className="p-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-[#1E3A5F] font-bold text-xs rounded-xl border border-slate-300 transition-all shadow-sm flex items-center justify-center"
                                                title={`Imprimir Folha de Porta da ${sala.nome} (A4 Deitado)`}
                                            >
                                                <Printer className="w-4 h-4 text-slate-600" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}

                {/* 3. VISÃO LISTA DE REUNIÕES (TABELA DETALHADA COM AÇÕES) */}
                {viewMode === 'lista' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        {/* Barra de Filtro de Período da Lista */}
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Visualizar:</span>
                                <div className="inline-flex rounded-xl bg-slate-200/80 p-1 border border-slate-300 shadow-inner">
                                    <button
                                        type="button"
                                        onClick={() => setFiltroPeriodoLista('todas')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                            filtroPeriodoLista === 'todas'
                                                ? 'bg-white text-[#1E3A5F] shadow-sm'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Todas as Reuniões Agendadas ({reservas.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFiltroPeriodoLista('dia')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                            filtroPeriodoLista === 'dia'
                                                ? 'bg-white text-[#1E3A5F] shadow-sm'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Apenas Data Selecionada
                                    </button>
                                </div>
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                                Encontradas: <strong className="text-slate-800 font-bold">{reservasFiltradas.length}</strong> reunião(ões)
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider">
                                    <tr>
                                        <th className="py-3.5 px-4">Data</th>
                                        <th className="py-3.5 px-4">Horário</th>
                                        <th className="py-3.5 px-4">Sala</th>
                                        <th className="py-3.5 px-4">Título & Pauta</th>
                                        <th className="py-3.5 px-4">Solicitante</th>
                                        <th className="py-3.5 px-4">Participantes</th>
                                        <th className="py-3.5 px-4">Status</th>
                                        <th className="py-3.5 px-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {loadingReservas ? (
                                        <tr>
                                            <td colSpan="8" className="p-8 text-center text-slate-400">
                                                Carregando reuniões...
                                            </td>
                                        </tr>
                                    ) : reservasFiltradas.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="p-8 text-center text-slate-400">
                                                Nenhuma reunião encontrada para esta data ou filtros.
                                            </td>
                                        </tr>
                                    ) : (
                                        reservasFiltradas.map((r) => {
                                            const iniDate = new Date(`${r.data_reserva}T${r.hora_inicio}:00`);
                                            const fimDate = new Date(`${r.data_reserva}T${r.hora_fim}:00`);
                                            const isNow = isHoje && currentTime >= iniDate && currentTime < fimDate && !r.liberada_antecipadamente;

                                            return (
                                                <tr 
                                                    key={r.id} 
                                                    onClick={() => handleAbrirEditar(r)}
                                                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                                                >
                                                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                                                        {(() => {
                                                            try {
                                                                const [y, m, d] = String(r.data_reserva).split('T')[0].split('-');
                                                                return `${d}/${m}/${y}`;
                                                            } catch {
                                                                return r.data_reserva;
                                                            }
                                                        })()}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                                                        {r.hora_inicio} - {r.hora_fim}
                                                    </td>

                                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <span 
                                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: r.cor_hex || '#1E3A5F' }}
                                                            />
                                                            <span className="font-bold text-slate-800">{r.sala_nome}</span>
                                                        </div>
                                                    </td>

                                                    <td className="py-3.5 px-4">
                                                        <div className="font-bold text-slate-800 text-sm">{r.titulo}</div>
                                                        {r.pauta && (
                                                            <div className="text-slate-500 text-xs truncate max-w-xs">{r.pauta}</div>
                                                        )}
                                                    </td>

                                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                                        <div className="font-medium text-slate-700">{r.organizador_nome}</div>
                                                        {r.departamento && (
                                                            <div className="text-[11px] text-slate-400">{r.departamento}</div>
                                                        )}
                                                    </td>

                                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                                        {r.participantes_count > 0 ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200">
                                                                <Users className="w-3.5 h-3.5 text-slate-500" />
                                                                {r.participantes_count} participante(s)
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">Apenas organizador</span>
                                                        )}
                                                    </td>

                                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                                        {r.liberada_antecipadamente ? (
                                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                                                                Liberada Antes
                                                            </span>
                                                        ) : isNow ? (
                                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1.5 w-fit">
                                                                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                                                                Em Andamento
                                                            </span>
                                                        ) : r.status === 'cancelada' ? (
                                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 line-through">
                                                                Cancelada
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                Confirmada
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={(e) => handleCompartilharWhatsAppReserva(r, e)}
                                                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                                                                title="Compartilhar Convite no WhatsApp"
                                                            >
                                                                <MessageSquare className="w-4 h-4" />
                                                            </button>
                                                            {isNow && !r.liberada_antecipadamente && (
                                                                <button
                                                                    onClick={(e) => handleLiberarRapido(r.id, e)}
                                                                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-colors"
                                                                    title="Liberar sala antecipadamente"
                                                                >
                                                                    Liberar Agora
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAbrirEditar(r);
                                                                }}
                                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                                                title="Editar ou Trocar de Sala"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAIS DO MÓDULO */}
            <NovaReservaModal
                isOpen={isNovaReservaOpen}
                onClose={() => setIsNovaReservaOpen(false)}
                salas={salas}
                participantesDisponiveis={participantesDisponiveis}
                slotInicial={slotInicialParaNova}
                onSuccess={() => {
                    carregarSalas();
                    carregarReservas();
                }}
            />

            <EditarReservaModal
                isOpen={isEditarReservaOpen}
                onClose={() => {
                    setIsEditarReservaOpen(false);
                    setReservaSelecionada(null);
                }}
                reserva={reservaSelecionada}
                salas={salas}
                participantesDisponiveis={participantesDisponiveis}
                onSuccess={() => {
                    carregarSalas();
                    carregarReservas();
                }}
            />

            <GerenciarSalasModal
                isOpen={isGerenciarSalasOpen}
                onClose={() => setIsGerenciarSalasOpen(false)}
                salas={salas}
                onSalasAtualizadas={() => {
                    carregarSalas();
                    carregarReservas();
                }}
            />

            <TotemPortaModal
                isOpen={isTotemOpen}
                onClose={() => setIsTotemOpen(false)}
                salas={salas}
                onReservaCriada={() => {
                    carregarSalas();
                    carregarReservas();
                }}
            />

            <ImprimirFolhaPortaModal
                isOpen={isImprimirFolhaOpen}
                onClose={() => {
                    setIsImprimirFolhaOpen(false);
                    setSalaParaImprimir(null);
                }}
                salas={salas}
                reservas={reservas}
                currentDateStr={currentDateStr}
                currentUser={user}
                salaPreSelecionada={salaParaImprimir}
            />
        </div>
    );
}
