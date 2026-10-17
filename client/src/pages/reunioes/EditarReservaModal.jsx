import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Calendar, Clock, Building2, Users, FileText, CheckCircle2,
    AlertCircle, Trash2, ArrowRightLeft, DoorOpen, Check, AlertTriangle,
    Mail, MessageSquare, Share2, Send
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
    atualizarReserva,
    cancelarReserva,
    liberarSalaAntecipadamente,
    getParticipantesDisponiveis,
    enviarConviteEmail
} from '../../services/salasReuniaoService';

export default function EditarReservaModal({
    isOpen,
    onClose,
    reserva,
    salas = [],
    participantesDisponiveis: propsParticipantes = [],
    onSuccess
}) {
    const [salaId, setSalaId] = useState('');
    const [dataReserva, setDataReserva] = useState('');
    const [horaInicio, setHoraInicio] = useState('');
    const [horaFim, setHoraFim] = useState('');
    const [titulo, setTitulo] = useState('');
    const [pauta, setPauta] = useState('');
    const [recursosSolicitados, setRecursosSolicitados] = useState('');
    const [participantesSelecionados, setParticipantesSelecionados] = useState([]);
    const [buscaParticipante, setBuscaParticipante] = useState('');

    const [listaParticipantes, setListaParticipantes] = useState(propsParticipantes);
    const [loadingParticipantes, setLoadingParticipantes] = useState(false);
    const [enviandoEmail, setEnviandoEmail] = useState(false);

    const [mostrarCancelar, setMostrarCancelar] = useState(false);
    const [motivoCancelamento, setMotivoCancelamento] = useState('');

    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    // Carregar colaboradores se não fornecidos via props
    useEffect(() => {
        if (isOpen) {
            if (propsParticipantes && propsParticipantes.length > 0) {
                setListaParticipantes(propsParticipantes);
            } else {
                setLoadingParticipantes(true);
                getParticipantesDisponiveis()
                    .then(data => setListaParticipantes(data || []))
                    .catch(err => console.error('Erro ao carregar colaboradores no editar:', err))
                    .finally(() => setLoadingParticipantes(false));
            }
        }
    }, [isOpen, propsParticipantes]);

    useEffect(() => {
        if (isOpen && reserva) {
            setSalaId(reserva.sala_id || '');
            setDataReserva(reserva.data_reserva || '');
            setHoraInicio(reserva.hora_inicio || '');
            setHoraFim(reserva.hora_fim || '');
            setTitulo(reserva.titulo || '');
            setPauta(reserva.pauta || '');
            setRecursosSolicitados(reserva.recursos_solicitados || '');
            setParticipantesSelecionados(reserva.participantes ? reserva.participantes.map(p => p.usuario_id || p.idUsuario) : []);
            setMostrarCancelar(false);
            setMotivoCancelamento('');
            setErro('');
        }
    }, [isOpen, reserva]);

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

    // Gerar texto formatado para o WhatsApp com os detalhes da reunião
    const gerarTextoWhatsApp = () => {
        const nomesParticipantes = objetosParticipantesSelecionados.length > 0 
            ? objetosParticipantesSelecionados.map(p => p.NomeCompleto).join(', ')
            : 'Equipe convocada';

        let dataFmt = dataReserva;
        try {
            const [y, m, d] = dataReserva.split('-');
            dataFmt = `${d}/${m}/${y}`;
        } catch (e) {}

        const salaAtual = salas.find(s => String(s.id) === String(salaId));

        return `🔔 *CONVITE DE REUNIÃO - METALFISA*\n` +
               `--------------------------------------------------\n` +
               `📌 *Assunto:* ${titulo || 'Reunião de Alinhamento'}\n` +
               `🏢 *Sala:* ${salaAtual?.nome || 'Sala de Reunião'} (${salaAtual?.localizacao || 'Metalfisa'})\n` +
               `📅 *Data:* ${dataFmt}\n` +
               `⏰ *Horário:* ${horaInicio} às ${horaFim}\n` +
               `👤 *Organizador:* ${reserva?.organizador_nome || 'Metalfisa'}\n` +
               (pauta ? `📝 *Pauta:* ${pauta}\n` : '') +
               `👥 *Participantes:* ${nomesParticipantes}\n` +
               `--------------------------------------------------\n` +
               `_Favor confirmar sua presença e comparecer pontualmente._`;
    };

    // Abrir WhatsApp com a mensagem formatada
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

    // Disparar e-mail de convite
    const handleReenviarEmail = async () => {
        if (!reserva?.id) return;
        setEnviandoEmail(true);
        try {
            const res = await enviarConviteEmail(reserva.id);
            toast.success(res.mensagem || 'Convites enviados por e-mail com sucesso!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao enviar e-mails de convite.');
        } finally {
            setEnviandoEmail(false);
        }
    };

    const handleSalvarEdicao = async (e) => {
        e.preventDefault();
        setErro('');

        if (!salaId) {
            setErro('Selecione uma sala.');
            return;
        }
        if (!titulo.trim()) {
            setErro('O título da reunião é obrigatório.');
            return;
        }
        if (horaInicio >= horaFim) {
            setErro('O horário de término deve ser posterior ao horário de início.');
            return;
        }

        setLoading(true);
        try {
            await atualizarReserva(reserva.id, {
                sala_id: salaId,
                data_reserva: dataReserva,
                hora_inicio: horaInicio,
                hora_fim: horaFim,
                titulo: titulo.trim(),
                pauta: pauta.trim(),
                recursos_solicitados: recursosSolicitados.trim(),
                participantes: participantesSelecionados,
                notificar_email: true
            });

            toast.success('Reserva atualizada com sucesso!');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Erro ao atualizar reserva:', err);
            const msg = err.response?.data?.mensagem || err.response?.data?.error || err.message || 'Falha ao atualizar reserva.';
            setErro(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmarCancelamento = async () => {
        setLoading(true);
        try {
            await cancelarReserva(reserva.id, motivoCancelamento.trim());
            toast.success('Reserva cancelada e sala liberada no calendário!');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Erro ao cancelar reserva:', err);
            setErro(err.response?.data?.error || err.message || 'Falha ao cancelar reserva.');
        } finally {
            setLoading(false);
        }
    };

    const handleLiberarAntecipadamente = async () => {
        if (!window.confirm('Confirma que a reunião encerrou antes do horário? A sala ficará imediatamente disponível para os colegas.')) return;
        setLoading(true);
        try {
            await liberarSalaAntecipadamente(reserva.id);
            toast.success('Sala liberada antecipadamente com sucesso!');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Erro ao liberar sala:', err);
            setErro(err.response?.data?.error || err.message || 'Falha ao liberar sala.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !reserva) return null;

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
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-slate-800">
                                    Gerenciar Reunião: {reserva.codigo}
                                </h2>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    reserva.status === 'cancelada'
                                        ? 'bg-rose-100 text-rose-700'
                                        : reserva.liberada_antecipadamente
                                        ? 'bg-slate-200 text-slate-700'
                                        : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                    {reserva.liberada_antecipadamente ? 'Liberada Antecipadamente' : reserva.status.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">
                                Remarque horários, troque de sala, envie convites por WhatsApp/E-mail ou libere a sala.
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

                {/* Body com Scroll */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {erro && (
                        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium animate-in fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                            <div className="flex-1 leading-relaxed">
                                <strong className="font-bold block">Aviso:</strong>
                                <span>{erro}</span>
                            </div>
                        </div>
                    )}

                    {/* BARRA DE AÇÕES RÁPIDAS & DISPARO DE CONVITES */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            {/* Compartilhar WhatsApp */}
                            <button
                                type="button"
                                onClick={() => handleCompartilharWhatsApp()}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Abrir convite formatado no WhatsApp Web/App"
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Compartilhar no WhatsApp
                            </button>

                            {/* Reenviar E-mail */}
                            <button
                                type="button"
                                onClick={handleReenviarEmail}
                                disabled={enviandoEmail}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                title="Reenviar convite por e-mail para todos os participantes"
                            >
                                <Mail className="w-3.5 h-3.5" />
                                {enviandoEmail ? 'Enviando...' : 'Reenviar por E-mail'}
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Liberar Sala Agora */}
                            {reserva.status !== 'cancelada' && !reserva.liberada_antecipadamente && (
                                <button
                                    type="button"
                                    onClick={handleLiberarAntecipadamente}
                                    disabled={loading}
                                    className="px-3 py-1.5 bg-[#D97706] hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                    title="Libera o horário restante da sala imediatamente para os colegas"
                                >
                                    <DoorOpen className="w-3.5 h-3.5" /> Liberar Sala Agora
                                </button>
                            )}

                            {/* Cancelar Reserva */}
                            {reserva.status !== 'cancelada' && (
                                <button
                                    type="button"
                                    onClick={() => setMostrarCancelar(!mostrarCancelar)}
                                    className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Cancelar Reserva
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Formulário de Cancelamento se aberto */}
                    {mostrarCancelar && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 animate-in fade-in">
                            <label className="block text-xs font-bold text-rose-900 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                                Confirmação de Cancelamento de Reserva
                            </label>
                            <input
                                type="text"
                                value={motivoCancelamento}
                                onChange={(e) => setMotivoCancelamento(e.target.value)}
                                placeholder="Motivo do cancelamento (ex: Reunião desmarcada pelo cliente, alinhamento resolvido...)"
                                className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs text-slate-800 focus:outline-hidden"
                            />
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMostrarCancelar(false)}
                                    className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                                >
                                    Voltar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmarCancelamento}
                                    disabled={loading}
                                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                                >
                                    Confirmar Cancelamento & Liberar Sala
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Formulário de Alteração / Troca de Sala */}
                    <form onSubmit={handleSalvarEdicao} className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                            {/* Coluna 1: Troca de Sala e Horários (6 cols) */}
                            <div className="lg:col-span-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5 text-[#1E3A5F]" />
                                        Sala Atual / Trocar de Sala
                                    </label>
                                    <div className="space-y-2">
                                        {salas.map((s) => {
                                            const isSelected = String(s.id) === String(salaId);
                                            return (
                                                <div
                                                    key={s.id}
                                                    onClick={() => setSalaId(s.id)}
                                                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                                                        isSelected
                                                            ? 'border-[#1E3A5F] bg-blue-50/50 ring-2 ring-[#1E3A5F]/20 shadow-xs'
                                                            : 'border-slate-200 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.cor_hex || '#1E3A5F' }} />
                                                            <span className="text-xs font-bold text-slate-800">{s.nome}</span>
                                                            <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                                                                Até {s.capacidade}p
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500">
                                                            {s.localizacao}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 pl-2">
                                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                                            isSelected ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white' : 'border-slate-300'
                                                        }`}>
                                                            {isSelected && <Check className="w-2.5 h-2.5" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Data e Horários */}
                                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-[#D97706]" />
                                            Data da Reunião
                                        </label>
                                        <input
                                            type="date"
                                            value={dataReserva}
                                            onChange={(e) => setDataReserva(e.target.value)}
                                            required
                                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-[#D97706]" />
                                                Início
                                            </label>
                                            <input
                                                type="time"
                                                value={horaInicio}
                                                onChange={(e) => setHoraInicio(e.target.value)}
                                                required
                                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-[#D97706]" />
                                                Término
                                            </label>
                                            <input
                                                type="time"
                                                value={horaFim}
                                                onChange={(e) => setHoraFim(e.target.value)}
                                                required
                                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Coluna 2: Assunto, Pauta e Convocação de Usuários (6 cols) */}
                            <div className="lg:col-span-6 space-y-3.5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 mb-1">
                                        Título / Assunto da Reunião *
                                    </label>
                                    <input
                                        type="text"
                                        value={titulo}
                                        onChange={(e) => setTitulo(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A5F]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-800 mb-1">
                                        Pauta / Tópicos a Discutir
                                    </label>
                                    <textarea
                                        rows="2"
                                        value={pauta}
                                        onChange={(e) => setPauta(e.target.value)}
                                        placeholder="Pauta da reunião..."
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A5F] resize-none"
                                    />
                                </div>

                                {/* Convocação de Participantes */}
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5 text-[#1E3A5F]" />
                                            <span>Participantes Convocados ({participantesSelecionados.length})</span>
                                        </label>
                                        {participantesSelecionados.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setParticipantesSelecionados([])}
                                                className="text-[10px] text-rose-600 hover:underline cursor-pointer font-semibold"
                                            >
                                                Limpar seleção
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

                                    {/* Busca de Colaboradores */}
                                    <input
                                        type="text"
                                        value={buscaParticipante}
                                        onChange={(e) => setBuscaParticipante(e.target.value)}
                                        placeholder="Buscar por nome, setor ou e-mail..."
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden"
                                    />

                                    {/* Lista de Colaboradores */}
                                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg shadow-inner">
                                        {loadingParticipantes ? (
                                            <p className="text-[11px] text-slate-400 p-3 text-center">Carregando colaboradores...</p>
                                        ) : participantesFiltrados.length === 0 ? (
                                            <p className="text-[11px] text-slate-400 p-3 text-center">Nenhum colaborador encontrado.</p>
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
                                                                <div className="text-[10px] text-slate-500">
                                                                    {u.Setor || 'Metalfisa'} {u.email && `• ${u.email}`}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Canais */}
                                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                                            {u.email && (
                                                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold border border-blue-200">
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

                        {/* Footer de Ação de Salvar */}
                        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            >
                                Fechar
                            </button>

                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {loading ? 'Salvando Alterações...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
