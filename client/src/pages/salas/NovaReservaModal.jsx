import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
    X, Calendar, Clock, Users, FileText, CheckCircle2, 
    AlertCircle, AlertTriangle, Coffee, Laptop, Video, Wifi, Tv 
} from 'lucide-react';

const RECURSOS_SUGESTOES = [
    'Café & Água',
    'Notebook Adicional',
    'Projetor / Cabo HDMI',
    'Videoconferência configurada',
    'Quadro branco e kit canetas',
    'Gravador / Transcrição de Áudio'
];

const NovaReservaModal = ({ salas = [], salaPreselecionada = null, reservaParaEditar = null, onClose, onReservaSalva }) => {
    const isEditing = Boolean(reservaParaEditar);

    const [salaId, setSalaId] = useState(
        reservaParaEditar?.sala_id || salaPreselecionada?.id || (salas[0]?.id || '')
    );
    const [titulo, setTitulo] = useState(reservaParaEditar?.titulo || '');
    const [pauta, setPauta] = useState(reservaParaEditar?.pauta || '');
    const [dataReserva, setDataReserva] = useState(
        reservaParaEditar?.data_reserva ? reservaParaEditar.data_reserva.slice(0, 10) : new Date().toISOString().slice(0, 10)
    );
    const [horaInicio, setHoraInicio] = useState(
        reservaParaEditar?.hora_inicio ? reservaParaEditar.hora_inicio.slice(0, 5) : '09:00'
    );
    const [horaFim, setHoraFim] = useState(
        reservaParaEditar?.hora_fim ? reservaParaEditar.hora_fim.slice(0, 5) : '10:00'
    );
    const [recursosSolicitados, setRecursosSolicitados] = useState(
        reservaParaEditar?.recursos_solicitados || ''
    );

    const [colaboradores, setColaboradores] = useState([]);
    const [buscaColaborador, setBuscaColaborador] = useState('');
    const [participantesSelecionados, setParticipantesSelecionados] = useState([]);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    // Carregar lista de colaboradores corporativos
    useEffect(() => {
        api.get('/salas-reuniao/colaboradores')
            .then(res => {
                if (Array.isArray(res.data?.colaboradores)) {
                    setColaboradores(res.data.colaboradores);
                }
            })
            .catch(() => {
                // Fallback para /users caso necessário
                api.get('/users')
                    .then(res => {
                        const lista = Array.isArray(res.data) ? res.data : (res.data?.users || []);
                        setColaboradores(lista);
                    })
                    .catch(() => {});
            });

        // Se for edição, carregar participantes da reserva existente
        if (reservaParaEditar?.id) {
            api.get(`/salas-reuniao/reservas/${reservaParaEditar.id}`)
                .then(res => {
                    if (res.data?.participantes) {
                        const ids = res.data.participantes.map(p => p.usuario_id);
                        setParticipantesSelecionados(ids);
                    }
                })
                .catch(() => {});
        }
    }, [reservaParaEditar]);

    const salaAtual = salas.find(s => String(s.id) === String(salaId)) || salaPreselecionada;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErro('');

        try {
            const payload = {
                sala_id: salaId,
                titulo: titulo.trim(),
                pauta: pauta.trim(),
                data_reserva: dataReserva,
                hora_inicio: horaInicio,
                hora_fim: horaFim,
                recursos_solicitados: recursosSolicitados.trim(),
                participantes: participantesSelecionados
            };

            if (isEditing) {
                await api.put(`/salas-reuniao/reservas/${reservaParaEditar.id}`, payload);
            } else {
                await api.post('/salas-reuniao/reservas', payload);
            }

            if (onReservaSalva) onReservaSalva();
            onClose();
        } catch (err) {
            setErro(err.response?.data?.error || 'Erro ao processar reserva. Verifique a disponibilidade de horário.');
        } finally {
            setLoading(false);
        }
    };

    const toggleParticipante = (userId) => {
        if (participantesSelecionados.includes(userId)) {
            setParticipantesSelecionados(participantesSelecionados.filter(id => id !== userId));
        } else {
            setParticipantesSelecionados([...participantesSelecionados, userId]);
        }
    };

    const toggleRecursoChip = (recurso) => {
        let lista = recursosSolicitados ? recursosSolicitados.split(',').map(r => r.trim()).filter(Boolean) : [];
        if (lista.includes(recurso)) {
            lista = lista.filter(r => r !== recurso);
        } else {
            lista.push(recurso);
        }
        setRecursosSolicitados(lista.join(', '));
    };

    const colaboradoresFiltrados = colaboradores.filter(c => {
        const nome = (c.NomeCompleto || c.nome || c.Login || '').toLowerCase();
        const setor = (c.Setor || '').toLowerCase();
        const termo = buscaColaborador.toLowerCase();
        return nome.includes(termo) || setor.includes(termo);
    });

    const excedeCapacidade = salaAtual && participantesSelecionados.length > salaAtual.capacidade;

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-base md:text-lg font-bold text-white">
                                {isEditing ? 'Editar Reserva de Sala' : 'Nova Reserva de Sala'}
                            </h2>
                            <p className="text-xs text-slate-400">
                                Validação anti-conflito em tempo real com isolamento multi-empresa.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
                    {erro && (
                        <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-300 flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <span>{erro}</span>
                        </div>
                    )}

                    {/* Seleção de Sala */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Sala de Reunião
                        </label>
                        <select
                            value={salaId}
                            onChange={(e) => setSalaId(e.target.value)}
                            required
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                            {salas.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.nome} (Capacidade: {s.capacidade} pessoas) - {s.localizacao || 'Sede'}
                                </option>
                            ))}
                        </select>
                        {salaAtual && (
                            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: salaAtual.cor_etiqueta || '#0284C7' }} />
                                <span>Capacidade: <strong>{salaAtual.capacidade} pessoas</strong></span>
                                <span>• {salaAtual.localizacao || 'Edifício Corporativo'}</span>
                            </div>
                        )}
                    </div>

                    {/* Título da Reunião */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Título da Reunião / Assunto Principal
                        </label>
                        <input
                            type="text"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            placeholder="Ex: Alinhamento de Metas de Produção & PCP"
                            required
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                        />
                    </div>

                    {/* Data e Horários */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Data</label>
                            <input
                                type="date"
                                value={dataReserva}
                                onChange={(e) => setDataReserva(e.target.value)}
                                required
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Hora Início</label>
                            <input
                                type="time"
                                value={horaInicio}
                                onChange={(e) => setHoraInicio(e.target.value)}
                                required
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Hora Término</label>
                            <input
                                type="time"
                                value={horaFim}
                                onChange={(e) => setHoraFim(e.target.value)}
                                required
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Recursos Solicitados */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Coffee className="w-3.5 h-3.5 text-amber-400" /> Recursos Extras / Apoio
                            </span>
                            <span className="text-[10px] text-slate-500">Clique para selecionar</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {RECURSOS_SUGESTOES.map(item => {
                                const active = recursosSolicitados.includes(item);
                                return (
                                    <button
                                        type="button"
                                        key={item}
                                        onClick={() => toggleRecursoChip(item)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                                            active 
                                                ? 'bg-blue-600 text-white border border-blue-500' 
                                                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                                        }`}
                                    >
                                        {item}
                                    </button>
                                );
                            })}
                        </div>
                        <input
                            type="text"
                            value={recursosSolicitados}
                            onChange={(e) => setRecursosSolicitados(e.target.value)}
                            placeholder="Outros recursos: ex: 2 notebooks extras, gravação..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                        />
                    </div>

                    {/* Pauta */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-400" /> Pauta / Tópicos da Reunião
                        </label>
                        <textarea
                            rows={3}
                            value={pauta}
                            onChange={(e) => setPauta(e.target.value)}
                            placeholder="Descreva os assuntos que serão abordados, objetivos e pautas de discussão..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-slate-500 leading-relaxed"
                        />
                    </div>

                    {/* Convocação de Participantes */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-purple-400" /> Convidar Participantes ({participantesSelecionados.length} selecionados)
                            </label>
                            {excedeCapacidade && (
                                <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                                    <AlertTriangle className="w-3 h-3" /> Excede a capacidade ({salaAtual.capacidade})
                                </span>
                            )}
                        </div>

                        <input
                            type="text"
                            value={buscaColaborador}
                            onChange={(e) => setBuscaColaborador(e.target.value)}
                            placeholder="Buscar colaborador por nome ou setor..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 mb-2 placeholder-slate-500"
                        />

                        <div className="max-h-36 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-1">
                            {colaboradoresFiltrados.length > 0 ? (
                                colaboradoresFiltrados.map(u => {
                                    const id = u.idUsuario || u.id;
                                    const isChecked = participantesSelecionados.includes(id);
                                    return (
                                        <div
                                            key={id}
                                            onClick={() => toggleParticipante(id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                                isChecked 
                                                    ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30' 
                                                    : 'hover:bg-slate-800 text-slate-300'
                                            }`}
                                        >
                                            <div className="truncate">
                                                <span className="font-semibold">{u.NomeCompleto || u.nome || u.Login}</span>
                                                <span className="text-[10px] text-slate-400 ml-1.5">({u.Setor || 'Geral'})</span>
                                            </div>
                                            {isChecked && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-xs text-slate-500 p-2 text-center">Nenhum colaborador encontrado.</div>
                            )}
                        </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                                    <span>Verificando Anti-conflito...</span>
                                </>
                            ) : (
                                <span>{isEditing ? 'Salvar Alterações' : 'Confirmar Reserva'}</span>
                            )}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};

export default NovaReservaModal;
