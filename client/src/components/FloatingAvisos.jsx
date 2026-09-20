import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, CheckCircle, Reply, X, ExternalLink } from 'lucide-react';
import api from '../services/api';
import { useLocation, useNavigate } from 'react-router-dom';

const FloatingAvisos = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const isAvisosPage = location.pathname === '/avisos';
    const { user, signed } = useAuth();
    const [avisos, setAvisos] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [replying, setReplying] = useState(false);
    const [replyText, setReplyText] = useState('');
    const isFetchingRef = useRef(false);

    const fetchAvisos = async () => {
        if (!signed || !user?.id || isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            const token = localStorage.getItem('@MetalFisa:token');
            const res = await api.get(`/avisos/nao-concluidos/${user.id}`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 8000 // Timeout ágil de 8s para não prender o client
            });
            
            const saved = sessionStorage.getItem('@metalfisa:dismissedAvisos');
            const dismissed = saved ? new Set(JSON.parse(saved)) : new Set();
            
            const filtered = (res.data || []).filter(a => !dismissed.has(a.idAviso));
            setAvisos(filtered);
            
            if (currentIndex >= filtered.length && filtered.length > 0) {
                setCurrentIndex(filtered.length - 1);
            }
        } catch (error) {
            // Silencioso em caso de timeout/cancelamento de polling
            if (error.code !== 'ECONNABORTED') {
                console.warn('⚠️ [Avisos] Não foi possível verificar avisos no momento');
            }
        } finally {
            isFetchingRef.current = false;
        }
    };

    useEffect(() => {
        if (!signed || !user?.id) return;

        // Busca imediata ao carregar a página
        fetchAvisos();

        // Polling leve a cada 30s como fallback
        const intervalId = setInterval(fetchAvisos, 30000);

        // ==== TEMPO REAL (SOCKET.IO) - lazy import para evitar Illegal constructor ====
        let socket = null;
        import('socket.io-client').then(({ io }) => {
            const socketUrl = window.location.origin;
            socket = io(socketUrl, {
                // polling primeiro garante que a conexão sobe imediatamente através de
                // qualquer proxy (Vite dev ou Nginx prod), depois faz upgrade para WebSocket.
                transports: ['polling', 'websocket'],
                reconnectionAttempts: 3,
                reconnectionDelay: 5000,
                timeout: 10000,
            });

            socket.on('connect', () => {
                socket.emit('join_user', user.id);
            });

            socket.on('connect_error', () => { /* best-effort — silencioso */ });

            socket.on('novo_aviso', (novoData) => {
                if (window.location.pathname === '/avisos') return;
                
                const saved = sessionStorage.getItem('@metalfisa:dismissedAvisos');
                const dismissed = saved ? new Set(JSON.parse(saved)) : new Set();
                if (!dismissed.has(novoData.idAviso)) {
                    setAvisos(prev => [...prev, novoData]);
                }
            });
        }).catch(() => { /* socket.io indisponível — continua com polling */ });

        return () => {
            clearInterval(intervalId);
            if (socket) socket.disconnect();
        };
    }, [user?.id, signed]);

    // Limpa os avisos flutuantes se o usuário entrar na página de histórico/chat
    useEffect(() => {
        if (isAvisosPage && avisos.length > 0) {
            setAvisos([]);
        }
    }, [isAvisosPage, avisos.length]);

    const handleConcluir = async (idAviso) => {
        try {
            const token = localStorage.getItem('@MetalFisa:token');
            await api.put(`/avisos/${idAviso}/concluir`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Remove localmente p/ interface
            setAvisos(prev => prev.filter(a => a.idAviso !== idAviso));
            if (currentIndex > 0) setCurrentIndex(p => p - 1);
        } catch (error) {
            console.error('Erro ao concluir aviso', error);
        }
    };

    const handleDismiss = (idAviso) => {
        const saved = sessionStorage.getItem('@metalfisa:dismissedAvisos');
        const dismissed = saved ? new Set(JSON.parse(saved)) : new Set();
        dismissed.add(idAviso);
        sessionStorage.setItem('@metalfisa:dismissedAvisos', JSON.stringify([...dismissed]));
        
        setAvisos(prev => prev.filter(a => a.idAviso !== idAviso));
        if (currentIndex > 0) setCurrentIndex(p => p - 1);
    };

    const handleReply = async (aviso) => {
        if (!replyText.trim()) return;
        try {
            const token = localStorage.getItem('@MetalFisa:token');
            await api.post('/avisos', {
                idRemetente: user.id,
                idDestinatario: aviso.idRemetente,
                mensagem: replyText,
                idRespostaDe: aviso.idAviso
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            await handleConcluir(aviso.idAviso);
            setReplying(false);
            setReplyText('');
        } catch (error) {
            console.error('Erro ao responder aviso', error);
        }
    };

    if (!signed || avisos.length === 0 || isAvisosPage) return null;

    const avisoAtual = avisos[currentIndex];

    return (
        <div className="fixed bottom-24 right-6 z-50 animate-bounce-short">
            <div className="bg-white rounded-lg shadow-2xl border-l-4 border-blue-500 w-80 md:w-96 overflow-hidden flex flex-col pointer-events-auto">
                {/* Header do Aviso */}
                <div className="bg-slate-50 p-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-700">
                        {avisoAtual.fotoRemetente ? (
                            <img 
                                src={api.defaults.baseURL.replace('/api', '') + avisoAtual.fotoRemetente} 
                                alt={avisoAtual.nomeRemetente}
                                className="w-6 h-6 rounded-full object-cover shadow-sm"
                            />
                        ) : (
                            <MessageSquare className="w-5 h-5 text-blue-500" />
                        )}
                        <span className="font-bold text-sm">Novo Aviso de {avisoAtual.nomeRemetente}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => navigate('/avisos')}
                            className="text-blue-500 hover:text-blue-700 transition-colors p-1 rounded-full hover:bg-slate-200"
                            title="Abrir página completa de avisos"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => handleDismiss(avisoAtual.idAviso)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-200"
                            title="Fechar e ignorar temporariamente"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Corpo do Aviso */}
                <div className="p-4 bg-white min-h-[80px]">
                    <p className="text-sm text-slate-800 break-words whitespace-pre-wrap">
                        {avisoAtual.mensagem}
                    </p>
                    <div className="text-[10px] text-slate-400 mt-2 text-right">
                        Enviado em: {new Date(avisoAtual.data_envio).toLocaleString('pt-BR')}
                    </div>
                </div>

                {/* Resposta */}
                {replying && (
                    <div className="px-4 pb-2">
                        <textarea
                            className="w-full text-sm border p-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            rows={3}
                            placeholder="Escreva sua resposta..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                        />
                    </div>
                )}

                {/* Ações */}
                <div className="p-3 bg-slate-50 border-t flex items-center justify-between">
                    <div className="text-xs text-slate-500 font-medium">
                        {avisos.length > 1 && (
                            <span>{currentIndex + 1} de {avisos.length}</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {replying ? (
                            <>
                                <button
                                    onClick={() => setReplying(false)}
                                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleReply(avisoAtual)}
                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-500 rounded hover:bg-blue-600"
                                >
                                    Enviar
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setReplying(true)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                                >
                                    <Reply className="w-3 h-3" />
                                    Responder
                                </button>
                                <button
                                    onClick={() => handleConcluir(avisoAtual.idAviso)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded"
                                >
                                    <CheckCircle className="w-3 h-3" />
                                    Concluir
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Navegação entre múltiplos */}
                {avisos.length > 1 && !replying && (
                    <div className="flex bg-slate-100">
                        <button
                            disabled={currentIndex === 0}
                            onClick={() => setCurrentIndex(p => p - 1)}
                            className="flex-1 py-1 text-xs text-center border-r hover:bg-slate-200 disabled:opacity-50"
                        >
                            Anterior
                        </button>
                        <button
                            disabled={currentIndex === avisos.length - 1}
                            onClick={() => setCurrentIndex(p => p + 1)}
                            className="flex-1 py-1 text-xs text-center hover:bg-slate-200 disabled:opacity-50"
                        >
                            Próximo
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FloatingAvisos;
