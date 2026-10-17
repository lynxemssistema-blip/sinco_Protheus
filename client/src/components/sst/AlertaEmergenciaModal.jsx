import React, { useState, useEffect, useRef } from 'react';
import { 
    Siren, AlertTriangle, Phone, Flame, CheckCircle2, RefreshCw, X, 
    ShieldAlert, MapPin, Camera, Video, Image as ImageIcon, Film, Trash2 
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function AlertaEmergenciaModal({ isOpen, onClose, defaultLocal = '' }) {
    const { user } = useAuth();

    // Auto-detectar turno atual pelo horário de Brasília
    const getTurnoAtual = () => {
        const hora = new Date().getHours();
        if (hora >= 6 && hora < 15) return '1_turno';
        if (hora >= 15 && hora < 23) return '2_turno';
        return '3_turno';
    };

    const [form, setForm] = useState({
        local_incidente: defaultLocal || '',
        descricao_ocorrencia: '',
        nivel_urgencia: 'grave',
        turno_alvo: getTurnoAtual()
    });

    // Mídia (Foto ou Vídeo curto)
    const [midiaArquivo, setMidiaArquivo] = useState(null);
    const [midiaPreview, setMidiaPreview] = useState(null);
    const [tipoMidia, setTipoMidia] = useState(null); // 'foto' | 'video'

    const inputRefCameraFoto = useRef(null);
    const inputRefCameraVideo = useRef(null);
    const inputRefGaleria = useRef(null);

    const [disparando, setDisparando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [erro, setErro] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setForm({
                local_incidente: defaultLocal || '',
                descricao_ocorrencia: '',
                nivel_urgencia: 'grave',
                turno_alvo: getTurnoAtual()
            });
            setMidiaArquivo(null);
            setMidiaPreview(null);
            setTipoMidia(null);
            setResultado(null);
            setErro(null);
            setDisparando(false);
        }
    }, [isOpen, defaultLocal]);

    if (!isOpen) return null;

    const locaisSugeridos = [
        'Usinagem CNC',
        'Estamparia / Prensas',
        'Corte Laser / Dobra',
        'Caldeiraria & Solda',
        'Pintura / Cabine',
        'Almoxarifado Geral',
        'Pátio de Carga / Expedição',
        'Subestação Elétrica'
    ];

    const handleSelecionarMidia = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Limite de 50MB para garantir velocidade no upload de emergência
        const maxBytes = 50 * 1024 * 1024;
        if (file.size > maxBytes) {
            setErro(`O arquivo (${(file.size / (1024 * 1024)).toFixed(1)}MB) ultrapassa o limite de 50MB.`);
            return;
        }

        const isVideo = file.type.startsWith('video/');
        setTipoMidia(isVideo ? 'video' : 'foto');
        setMidiaArquivo(file);
        setMidiaPreview(URL.createObjectURL(file));
        setErro(null);
    };

    const handleRemoverMidia = () => {
        setMidiaArquivo(null);
        setMidiaPreview(null);
        setTipoMidia(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.local_incidente.trim() || !form.descricao_ocorrencia.trim()) {
            setErro('Por favor, informe o local exato e uma breve descrição do que está ocorrendo.');
            return;
        }

        try {
            setDisparando(true);
            setErro(null);

            const formData = new FormData();
            formData.append('local_incidente', form.local_incidente);
            formData.append('descricao_ocorrencia', form.descricao_ocorrencia);
            formData.append('nivel_urgencia', form.nivel_urgencia);
            formData.append('turno_alvo', form.turno_alvo);
            if (midiaArquivo) {
                formData.append('midia', midiaArquivo);
            }

            const res = await api.post('/sst/brigada/alerta-emergencia', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResultado(res.data);
        } catch (err) {
            console.error('Erro ao acionar emergência:', err);
            setErro(err.response?.data?.error || err.message || 'Falha na comunicação com o servidor de emergência.');
        } finally {
            setDisparando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border-4 border-red-600 relative overflow-hidden my-auto max-h-[95vh] flex flex-col">
                
                {/* Efeito visual superior de perigo/alerta */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

                {/* CABEÇALHO */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/30 shrink-0 animate-bounce-subtle">
                            <Siren className="w-7 h-7" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                Acionamento Imediato NR-23
                            </span>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight leading-tight mt-0.5">
                                ALERTA DE EMERGÊNCIA
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Brigada de Incêndio & Gestão de Crise MetalFisa
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                        title="Fechar modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto pr-1">

                    {/* TELA DE SUCESSO APÓS DISPARO */}
                    {resultado ? (
                        <div className="py-6 text-center space-y-4">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center shadow-md">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Alerta Enviado com Sucesso!</h3>
                                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                                    {resultado.message || 'A equipe de brigadistas e o SESMT foram acionados imediatamente via WhatsApp.'}
                                </p>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 max-w-sm mx-auto space-y-2 text-left">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Destinatários Notificados:</span>
                                    <strong className="text-slate-900">{resultado.telefones_disparados || 0} brigadistas</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Status da Transmissão:</span>
                                    <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 text-[10px]">
                                        DISPARO PROCESSADO
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Local Informado:</span>
                                    <strong className="text-slate-900 truncate max-w-[180px]">{form.local_incidente}</strong>
                                </div>
                                {resultado.midia_url && (
                                    <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                                        <span className="text-slate-500">Evidência Anexada:</span>
                                        <span className="font-bold text-emerald-700">
                                            {resultado.tipo_midia === 'video' ? '🎥 Vídeo curto transmitido' : '📸 Foto transmitida'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-900 font-semibold max-w-sm mx-auto flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                                <span>Mantenha a calma, não obstrua as rotas de fuga e oriente as pessoas ao redor a irem para o Ponto de Encontro.</span>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full py-3 bg-[#1F365C] hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-lg transition-colors cursor-pointer"
                                >
                                    Entendido / Fechar
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* FORMULÁRIO DE ACIONAMENTO */
                        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
                            
                            {erro && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                                    <span>{erro}</span>
                                </div>
                            )}

                            <div className="bg-red-50/70 border border-red-200 p-3 rounded-2xl text-xs text-red-900 flex items-start gap-2.5">
                                <Flame className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <p className="leading-snug">
                                    <strong>Atenção:</strong> Qualquer colaborador pode acionar a Brigada em caso de fumaça, chamas, vazamento ou princípio de sinistro. O alerta é enviado instantaneamente no WhatsApp dos brigadistas e supervisão.
                                </p>
                            </div>

                            {/* Local do Incidente */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5 text-red-600" />
                                        <span>Local Exato da Ocorrência *</span>
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-semibold">Onde está acontecendo?</span>
                                </div>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Usinagem CNC - Painel elétrico do Torno 02"
                                    value={form.local_incidente}
                                    onChange={e => setForm({ ...form, local_incidente: e.target.value })}
                                    className="w-full border-2 border-slate-300 focus:border-red-600 rounded-xl p-2.5 text-sm font-semibold text-slate-900 focus:outline-none transition-colors"
                                />
                                
                                {/* Sugestões rápidas de toque */}
                                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                    <span className="text-[10px] text-slate-400 font-semibold">Atalhos:</span>
                                    {locaisSugeridos.slice(0, 4).map(loc => (
                                        <button
                                            key={loc}
                                            type="button"
                                            onClick={() => setForm({ ...form, local_incidente: loc })}
                                            className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200 transition-colors"
                                        >
                                            {loc}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Gravidade & Turno */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 uppercase mb-1">
                                        Nível de Urgência *
                                    </label>
                                    <select
                                        value={form.nivel_urgencia}
                                        onChange={e => setForm({ ...form, nivel_urgencia: e.target.value })}
                                        className="w-full border border-slate-300 rounded-xl p-2 text-xs sm:text-sm font-bold text-red-700 bg-white focus:outline-none focus:border-red-600"
                                    >
                                        <option value="grave">🔴 Grave (Ação Imediata)</option>
                                        <option value="moderado">🟡 Moderado (Alerta de Atenção)</option>
                                        <option value="critico_evacuacao">🚨 Crítico (Evacuação Geral)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 uppercase mb-1">
                                        Turno Acionado
                                    </label>
                                    <select
                                        value={form.turno_alvo}
                                        onChange={e => setForm({ ...form, turno_alvo: e.target.value })}
                                        className="w-full border border-slate-300 rounded-xl p-2 text-xs sm:text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#1F365C]"
                                    >
                                        <option value="1_turno">1º Turno (Manhã)</option>
                                        <option value="2_turno">2º Turno (Tarde)</option>
                                        <option value="3_turno">3º Turno (Noite)</option>
                                        <option value="todos">Todos os Turnos (Geral)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Descrição */}
                            <div>
                                <label className="block text-xs font-bold text-slate-800 uppercase mb-1">
                                    O que está ocorrendo? (Breve relato) *
                                </label>
                                <textarea
                                    rows={2}
                                    required
                                    placeholder="Descreva brevemente o que foi avistado: fumaça densa, foco de fogo em máquina, cheiro de queimado..."
                                    value={form.descricao_ocorrencia}
                                    onChange={e => setForm({ ...form, descricao_ocorrencia: e.target.value })}
                                    className="w-full border border-slate-300 focus:border-red-600 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none"
                                />
                            </div>

                            {/* EVIDÊNCIA EM FOTO OU VÍDEO CURTO */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                                        <Camera className="w-3.5 h-3.5 text-red-600" />
                                        <span>Evidência em Foto ou Vídeo Curto</span>
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-semibold">Opcional</span>
                                </div>

                                {!midiaPreview ? (
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => inputRefCameraFoto.current?.click()}
                                            className="flex flex-col items-center justify-center p-2.5 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-700 border-2 border-dashed border-slate-200 hover:border-red-400 rounded-2xl transition-all cursor-pointer group"
                                        >
                                            <Camera className="w-5 h-5 text-slate-500 group-hover:text-red-600 group-hover:scale-110 transition-transform mb-1" />
                                            <span className="text-[11px] font-bold">Tirar Foto</span>
                                            <span className="text-[9px] text-slate-400 font-medium">Câmera Celular</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => inputRefCameraVideo.current?.click()}
                                            className="flex flex-col items-center justify-center p-2.5 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-700 border-2 border-dashed border-slate-200 hover:border-red-400 rounded-2xl transition-all cursor-pointer group"
                                        >
                                            <Video className="w-5 h-5 text-slate-500 group-hover:text-red-600 group-hover:scale-110 transition-transform mb-1" />
                                            <span className="text-[11px] font-bold">Gravar Vídeo</span>
                                            <span className="text-[9px] text-slate-400 font-medium">Câmera Celular</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => inputRefGaleria.current?.click()}
                                            className="flex flex-col items-center justify-center p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-2xl transition-all cursor-pointer group"
                                        >
                                            <ImageIcon className="w-5 h-5 text-slate-500 group-hover:text-slate-700 group-hover:scale-110 transition-transform mb-1" />
                                            <span className="text-[11px] font-bold">Galeria</span>
                                            <span className="text-[9px] text-slate-400 font-medium">Arquivo</span>
                                        </button>

                                        {/* Inputs Ocultos */}
                                        <input
                                            ref={inputRefCameraFoto}
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={handleSelecionarMidia}
                                        />
                                        <input
                                            ref={inputRefCameraVideo}
                                            type="file"
                                            accept="video/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={handleSelecionarMidia}
                                        />
                                        <input
                                            ref={inputRefGaleria}
                                            type="file"
                                            accept="image/*,video/*"
                                            className="hidden"
                                            onChange={handleSelecionarMidia}
                                        />
                                    </div>
                                ) : (
                                    /* Prévia da Mídia Anexada */
                                    <div className="p-3 bg-slate-900 text-white rounded-2xl border border-slate-700 flex items-center justify-between gap-3 shadow-md animate-fadeIn">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {tipoMidia === 'foto' ? (
                                                <img
                                                    src={midiaPreview}
                                                    alt="Evidência"
                                                    className="w-14 h-14 object-cover rounded-xl border border-white/20 shadow shrink-0"
                                                />
                                            ) : (
                                                <div className="w-14 h-14 rounded-xl bg-slate-800 border border-white/20 flex items-center justify-center shrink-0 overflow-hidden relative">
                                                    <video src={midiaPreview} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                                        <Film className="w-6 h-6 text-white" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                        tipoMidia === 'video' ? 'bg-amber-400 text-slate-950' : 'bg-red-500 text-white'
                                                    }`}>
                                                        {tipoMidia === 'video' ? '🎥 Vídeo Gravado' : '📸 Foto Capturada'}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-bold text-slate-200 truncate mt-0.5">
                                                    {midiaArquivo?.name}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {(midiaArquivo?.size / (1024 * 1024)).toFixed(2)} MB • Pronto para anexo
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleRemoverMidia}
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
                                            title="Remover evidência"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Telefones de Emergência Rápida */}
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                                <span className="font-bold flex items-center gap-1.5 text-slate-800">
                                    <Phone className="w-3.5 h-3.5 text-red-600" />
                                    <span>Discagem Direta:</span>
                                </span>
                                <div className="flex items-center gap-2">
                                    <a href="tel:193" className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 font-black rounded-lg text-xs">
                                        🚒 Bombeiros: 193
                                    </a>
                                    <a href="tel:192" className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 font-black rounded-lg text-xs">
                                        🚑 SAMU: 192
                                    </a>
                                </div>
                            </div>

                            {/* Botões de Ação */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 shrink-0">
                                <button
                                    type="button"
                                    disabled={disparando}
                                    onClick={onClose}
                                    className="px-4 py-2.5 text-xs sm:text-sm text-slate-600 hover:bg-slate-100 font-semibold rounded-xl transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={disparando}
                                    className="flex-1 sm:flex-initial px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg hover:shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                >
                                    {disparando ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Enviando & Disparando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Siren className="w-4 h-4 animate-pulse" />
                                            <span>DISPARAR ALERTA DE EMERGÊNCIA</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                </div>

            </div>
        </div>
    );
}
