import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Calendar, Clock, Building2, Users, FileText, CheckCircle2,
    AlertCircle, Sparkles, Check, Mail, MessageSquare, Send,
    ExternalLink, Share2, Phone
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { criarReserva, getParticipantesDisponiveis } from '../../services/salasReuniaoService';

export default function NovaReservaModal({
    isOpen,
    onClose,
    salas = [],
    participantesDisponiveis: propsParticipantes = [],
    slotInicial = null,
    initialSalaId = null,
    initialData = null,
    initialHoraInicio = '09:00',
    initialHoraFim = '10:00',
    onSuccess
}) {
    const { user } = useAuth();

    // Dados do formulário
    const [salaId, setSalaId] = useState('');
    const [dataReserva, setDataReserva] = useState('');
    const [horaInicio, setHoraInicio] = useState('09:00');
    const [horaFim, setHoraFim] = useState('10:00');
    const [titulo, setTitulo] = useState('');
    const [pauta, setPauta] = useState('');
    const [recursosSolicitados, setRecursosSolicitados] = useState('');

    // Participantes
    const [listaParticipantes, setListaParticipantes] = useState(propsParticipantes);
    const [loadingParticipantes, setLoadingParticipantes] = useState(false);
    const [participantesSelecionados, setParticipantesSelecionados] = useState([]);
    const [buscaParticipante, setBuscaParticipante] = useState('');

    // Notificações (E-mail e WhatsApp)
    const [enviarEmail, setEnviarEmail] = useState(true);
    const [notificarWhatsApp, setNotificarWhatsApp] = useState(false);

    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    // Carregar colaboradores ativos se não vieram por props
    useEffect(() => {
        if (isOpen) {
            if (propsParticipantes && propsParticipantes.length > 0) {
                setListaParticipantes(propsParticipantes);
            } else {
                setLoadingParticipantes(true);
                getParticipantesDisponiveis()
                    .then(data => setListaParticipantes(data || []))
                    .catch(err => console.error('Erro ao carregar colaboradores:', err))
                    .finally(() => setLoadingParticipantes(false));
            }
        }
    }, [isOpen, propsParticipantes]);

    // Inicializar campos quando o modal abre
    useEffect(() => {
        if (isOpen) {
            const sId = slotInicial?.salaId || initialSalaId || (salas[0]?.id || '');
            const dt = slotInicial?.data || initialData || new Date().toISOString().slice(0, 10);
            const hIni = slotInicial?.horaInicio || initialHoraInicio || '09:00';
            const hFim = slotInicial?.horaFim || initialHoraFim || '10:00';

            setSalaId(sId);
            setDataReserva(dt);
            setHoraInicio(hIni);
            setHoraFim(hFim);
            setTitulo('');
            setPauta('');
            setRecursosSolicitados('');
            setParticipantesSelecionados([]);
            setBuscaParticipante('');
            setEnviarEmail(true);
            setNotificarWhatsApp(false);
            setErro('');
        }
    }, [isOpen, slotInicial, initialSalaId, initialData, initialHoraInicio, initialHoraFim, salas]);

    const salaEscolhida = useMemo(() => {
        return salas.find(s => String(s.id) === String(salaId));
    }, [salas, salaId]);

    // Participantes filtrados pela busca
    const participantesFiltrados = useMemo(() => {
        if (!buscaParticipante.trim()) return listaParticipantes.slice(0, 40);
        const termo = buscaParticipante.toLowerCase();
        return listaParticipantes.filter(p => 
            p.NomeCompleto?.toLowerCase().includes(termo) ||
            p.Setor?.toLowerCase().includes(termo) ||
            p.email?.toLowerCase().includes(termo) ||
            p.login?.toLowerCase().includes(termo)
        ).slice(0, 50);
    }, [listaParticipantes, buscaParticipante]);

    // Lista de objetos dos participantes selecionados
    const objetosParticipantesSelecionados = useMemo(() => {
        return listaParticipantes.filter(u => participantesSelecionados.includes(u.idUsuario));
    }, [listaParticipantes, participantesSelecionados]);

    const handleToggleParticipante = (userId) => {
        setParticipantesSelecionados(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId) 
                : [...prev, userId]
        );
    };

    const handleDefinirDuracao = (minutos) => {
        if (!horaInicio) return;
        const [h, m] = horaInicio.split(':').map(Number);
        const data = new Date();
        data.setHours(h, m + minutos, 0);
        const novoFim = `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
        setHoraFim(novoFim);
    };

    // Gerar texto formatado para o WhatsApp com todos os detalhes da sala e reunião
    const gerarTextoWhatsApp = () => {
        const nomesParticipantes = objetosParticipantesSelecionados.length > 0 
            ? objetosParticipantesSelecionados.map(p => p.NomeCompleto).join(', ')
            : 'Equipe convocada';

        let dataFmt = dataReserva;
        try {
            const [y, m, d] = dataReserva.split('-');
            dataFmt = `${d}/${m}/${y}`;
        } catch (e) {}

        const orgNome = user?.nome || 'Metalfisa';

        return `🔔 *CONVITE DE REUNIÃO - METALFISA*\n` +
               `--------------------------------------------------\n` +
               `📌 *Assunto:* ${titulo || 'Reunião de Alinhamento'}\n` +
               `🏢 *Sala:* ${salaEscolhida?.nome || 'Sala de Reunião'} (${salaEscolhida?.localizacao || 'Metalfisa'})\n` +
               `📅 *Data:* ${dataFmt}\n` +
               `⏰ *Horário:* ${horaInicio} às ${horaFim}\n` +
               `👤 *Organizador:* ${orgNome}\n` +
               (pauta ? `📝 *Pauta:* ${pauta}\n` : '') +
               `👥 *Participantes:* ${nomesParticipantes}\n` +
               `--------------------------------------------------\n` +
               `_Favor confirmar sua presença e comparecer pontualmente._`;
    };

    // Abrir WhatsApp com a mensagem pronta para grupo ou contato
    const handleCompartilharWhatsApp = (telefoneDestino = '') => {
        const texto = encodeURIComponent(gerarTextoWhatsApp());
        let url = `https://api.whatsapp.com/send?text=${texto}`;
        if (telefoneDestino) {
            const numeroLimpo = String(telefoneDestino).replace(/\D/g, '');
            const ddi = numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;
            url = `https://wa.me/${ddi}?text=${texto}`;
        }
        window.open(url, '_blank');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro('');

        if (!salaId) {
            setErro('Por favor, selecione uma sala de reunião.');
            return;
        }
        if (!titulo.trim()) {
            setErro('Informe o título ou assunto principal da reunião.');
            return;
        }
        if (horaInicio >= horaFim) {
            setErro('O horário de término deve ser posterior ao horário de início.');
            return;
        }

        setLoading(true);
        try {
            await criarReserva({
                sala_id: salaId,
                data_reserva: dataReserva,
                hora_inicio: horaInicio,
                hora_fim: horaFim,
                titulo: titulo.trim(),
                pauta: pauta.trim(),
                recursos_solicitados: recursosSolicitados.trim(),
                participantes: participantesSelecionados,
                notificar_email: enviarEmail
            });

            toast.success(
                enviarEmail && participantesSelecionados.length > 0
                    ? 'Reserva criada e convites por e-mail enviados!'
                    : 'Reserva confirmada com sucesso!'
            );

            // Se o usuário optou por enviar via WhatsApp, abrir imediatamente
            if (notificarWhatsApp) {
                handleCompartilharWhatsApp();
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Erro ao criar reserva:', err);
            const msg = err.response?.data?.mensagem || err.response?.data?.error || err.message || 'Falha ao reservar sala.';
            setErro(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-4xl max-h-[94vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#1E3A5F] text-amber-400 flex items-center justify-center shrink-0 shadow-sm">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                Agendar Reunião / Reservar Sala
                            </h2>
                            <p className="text-xs text-slate-500">
                                Preencha os detalhes da reunião, convoque os colaboradores e dispare convites por E-mail ou WhatsApp.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                    {erro && (
                        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium animate-in fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                            <div className="flex-1 leading-relaxed">
                                <strong className="font-bold block">Conflito ou Validação:</strong>
                                <span>{erro}</span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Coluna Esquerda: Sala, Horários e Notificações (6 cols) */}
                        <div className="lg:col-span-6 space-y-4">
                            {/* Seleção de Sala */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Sala de Reunião Físico *
                                </label>
                                <select
                                    value={salaId}
                                    onChange={(e) => setSalaId(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A5F] cursor-pointer shadow-xs"
                                >
                                    {salas.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.nome} — Cap: {s.capacidade}p ({s.localizacao})
                                        </option>
                                    ))}
                                </select>

                                {salaEscolhida && (
                                    <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <span 
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: salaEscolhida.cor_hex || '#1E3A5F' }}
                                            />
                                            <span className="font-medium text-slate-800">{salaEscolhida.localizacao}</span>
                                        </div>
                                        <span className="text-[11px] font-bold text-[#1E3A5F] bg-blue-50 px-2 py-0.5 rounded-md">
                                            👥 Até {salaEscolhida.capacidade} pessoas
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Data e Horários */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-[#D97706]" />
                                        Data da Reunião *
                                    </label>
                                    <input
                                        type="date"
                                        value={dataReserva}
                                        onChange={(e) => setDataReserva(e.target.value)}
                                        required
                                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-[#1E3A5F]"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-[#D97706]" />
                                            Início *
                                        </label>
                                        <input
                                            type="time"
                                            value={horaInicio}
                                            onChange={(e) => setHoraInicio(e.target.value)}
                                            required
                                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#1E3A5F]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-[#D97706]" />
                                            Término *
                                        </label>
                                        <input
                                            type="time"
                                            value={horaFim}
                                            onChange={(e) => setHoraFim(e.target.value)}
                                            required
                                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#1E3A5F]"
                                        />
                                    </div>
                                </div>

                                {/* Presets Rápidos de Duração */}
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                        Duração Rápida:
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {[
                                            { label: '+30m', mins: 30 },
                                            { label: '+45m', mins: 45 },
                                            { label: '+1h', mins: 60 },
                                            { label: '+1h30', mins: 90 },
                                            { label: '+2h', mins: 120 }
                                        ].map((p) => (
                                            <button
                                                key={p.mins}
                                                type="button"
                                                onClick={() => handleDefinirDuracao(p.mins)}
                                                className="px-2 py-0.5 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 text-[10px] font-bold rounded-md transition-colors cursor-pointer"
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* CANAIS DE CONVITE & NOTIFICAÇÕES (E-mail & WhatsApp) */}
                            <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2.5">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                                    <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                                    <span>Envio de Convites aos Participantes</span>
                                </div>

                                {/* Checkbox E-mail */}
                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={enviarEmail}
                                        onChange={(e) => setEnviarEmail(e.target.checked)}
                                        className="rounded border-slate-300 text-[#1E3A5F] focus:ring-[#1E3A5F] w-4 h-4 cursor-pointer"
                                    />
                                    <span className="flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5 text-blue-600" />
                                        Disparar convite por E-mail corporativo
                                    </span>
                                </label>

                                {/* Checkbox WhatsApp */}
                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={notificarWhatsApp}
                                        onChange={(e) => setNotificarWhatsApp(e.target.checked)}
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span className="flex items-center gap-1.5">
                                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                        Abrir WhatsApp ao confirmar para enviar convite
                                    </span>
                                </label>

                                {/* Botão Rápido de Compartilhar Agora no WhatsApp */}
                                <button
                                    type="button"
                                    onClick={() => handleCompartilharWhatsApp()}
                                    className="w-full mt-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                                >
                                    <Share2 className="w-3.5 h-3.5" />
                                    Compartilhar Convite no WhatsApp Agora
                                </button>
                            </div>
                        </div>

                        {/* Coluna Direita: Assunto, Pauta e Convocação de Usuários (6 cols) */}
                        <div className="lg:col-span-6 space-y-3.5">
                            {/* Assunto / Título */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Título / Assunto da Reunião *
                                </label>
                                <input
                                    type="text"
                                    value={titulo}
                                    onChange={(e) => setTitulo(e.target.value)}
                                    placeholder="Ex: Alinhamento de Projeto Wabtec, Reunião de Diretoria..."
                                    required
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A5F] shadow-xs"
                                />
                            </div>

                            {/* Pauta */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Pauta / Tópicos a Discutir
                                </label>
                                <textarea
                                    rows="2"
                                    value={pauta}
                                    onChange={(e) => setPauta(e.target.value)}
                                    placeholder="Descreva os tópicos a serem discutidos, links de preparação ou ata prévia..."
                                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A5F] resize-none"
                                />
                            </div>

                            {/* CONVOCAÇÃO DE PARTICIPANTES (Usuários do Sistema Metalfisa) */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5 text-[#1E3A5F]" />
                                        <span>Convocar Colaboradores ({participantesSelecionados.length})</span>
                                    </label>
                                    {participantesSelecionados.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setParticipantesSelecionados([])}
                                            className="text-[10px] text-rose-600 hover:underline cursor-pointer font-semibold"
                                        >
                                            Limpar ({participantesSelecionados.length})
                                        </button>
                                    )}
                                </div>

                                {/* Chips dos Participantes já Selecionados */}
                                {objetosParticipantesSelecionados.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white border border-slate-200 rounded-lg">
                                        {objetosParticipantesSelecionados.map(p => (
                                            <span 
                                                key={p.idUsuario}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#1E3A5F] border border-blue-200 text-[11px] font-medium"
                                            >
                                                <span>{p.NomeCompleto.split(' ')[0]}</span>
                                                {p.email && <Mail className="w-2.5 h-2.5 text-blue-500" title={p.email} />}
                                                {p.whatsapp && (
                                                    <span 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCompartilharWhatsApp(p.whatsapp);
                                                        }}
                                                        className="cursor-pointer hover:text-emerald-600"
                                                        title={`Enviar WhatsApp para ${p.NomeCompleto}`}
                                                    >
                                                        <MessageSquare className="w-2.5 h-2.5 text-emerald-600" />
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleParticipante(p.idUsuario)}
                                                    className="ml-0.5 hover:text-rose-600 font-bold"
                                                >
                                                    ✕
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Campo de Busca */}
                                <input
                                    type="text"
                                    value={buscaParticipante}
                                    onChange={(e) => setBuscaParticipante(e.target.value)}
                                    placeholder="Buscar colega por nome, setor ou e-mail..."
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#1E3A5F]"
                                />

                                {/* Lista de Colaboradores Disponíveis */}
                                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg shadow-inner">
                                    {loadingParticipantes ? (
                                        <p className="text-[11px] text-slate-400 p-3 text-center">Carregando colaboradores...</p>
                                    ) : participantesFiltrados.length === 0 ? (
                                        <p className="text-[11px] text-slate-400 p-3 text-center">Nenhum colaborador encontrado com este termo.</p>
                                    ) : (
                                        participantesFiltrados.map((u) => {
                                            const isSelected = participantesSelecionados.includes(u.idUsuario);
                                            return (
                                                <div
                                                    key={u.idUsuario}
                                                    onClick={() => handleToggleParticipante(u.idUsuario)}
                                                    className={`flex items-center justify-between p-2 text-xs cursor-pointer transition-colors ${
                                                        isSelected ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 truncate">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                            isSelected ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white' : 'border-slate-300 bg-white'
                                                        }`}>
                                                            {isSelected && <Check className="w-3 h-3" />}
                                                        </div>
                                                        <div className="truncate">
                                                            <div className="font-semibold text-slate-800 truncate leading-snug">
                                                                {u.NomeCompleto}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                                                <span>{u.Setor || 'Metalfisa'}</span>
                                                                {u.email && (
                                                                    <span className="text-blue-600 truncate max-w-[140px]" title={u.email}>
                                                                        • {u.email}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Ícones de canais do colaborador */}
                                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                                        {u.email && (
                                                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold border border-blue-200" title={u.email}>
                                                                ✉️ E-mail
                                                            </span>
                                                        )}
                                                        {u.whatsapp && (
                                                            <span 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCompartilharWhatsApp(u.whatsapp);
                                                                }}
                                                                className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200 hover:bg-emerald-100"
                                                                title={`WhatsApp: ${u.whatsapp}`}
                                                            >
                                                                💬 Zap
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                        <div className="text-xs text-slate-500">
                            {salaEscolhida ? (
                                <span>Sala: <strong className="text-slate-800">{salaEscolhida.nome}</strong> • {dataReserva} ({horaInicio} às {horaFim})</span>
                            ) : (
                                <span>Selecione uma sala</span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-[#D97706] hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {loading ? (
                                    <>Gravando Reserva...</>
                                ) : (
                                    <>Confirmar Reserva</>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
