import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Bell, AlertTriangle, CheckCircle, Info, Hammer, Pin, PinOff } from 'lucide-react';
import io from 'socket.io-client';
import DOMPurify from 'dompurify';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

// Render markdown similar to LynxConfigTab for the feed
function renderInline(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono text-indigo-700">$1</code>');
}

export default function HermesFeed() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isPinned, setIsPinned] = useState(window.innerWidth >= 1024);
    const [messages, setMessages] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [urgentAlerts, setUrgentAlerts] = useState([]);
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);

    // Push layout content when pinned
    useEffect(() => {
        const mainEl = document.querySelector('main');
        if (!mainEl) return;
        
        // w-96 is 384px
        if (isOpen && isPinned) {
            mainEl.style.paddingRight = '384px';
            mainEl.style.transition = 'padding-right 300ms ease-in-out';
        } else {
            mainEl.style.paddingRight = '';
        }

        return () => {
            mainEl.style.paddingRight = '';
        };
    }, [isOpen, isPinned]);

    useEffect(() => {
        // Inicializa conexão socket
        const socket = io(window.location.origin);
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('🟢 [HermesFeed] Conectado ao servidor via Socket.io');
        });

        // Escuta mensagens do feed
        socket.on('hermes_feed_message', (payload) => {
            // payload: { id, text, type, criado_em, context_data }
            const newMessage = {
                id: payload.id || `feed-${Date.now()}`,
                text: payload.text,
                type: payload.type || 'info', // info, success, warning, error
                criado_em: payload.criado_em || new Date().toISOString()
            };
            
            setMessages(prev => [...prev, newMessage]);
            
            if (payload.context_data?.requires_ack) {
                // Se a janela estiver fechada ou se sempre quisermos forçar pop-up
                if (!isOpen) {
                    setUrgentAlerts(prev => [...prev, newMessage]);
                }
            }

            if (!isOpen) {
                setUnreadCount(prev => prev + 1);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Ao abrir, zera as não lidas
    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
        }
    }, [isOpen]);

    // Auto-scroll
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const getIconForType = (type) => {
        switch (type) {
            case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'production': return <Hammer className="w-4 h-4 text-indigo-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    const handleAcknowledge = async (alertMsg) => {
        try {
            await api.post('/hermes/acknowledgments', {
                message_id: alertMsg.id,
                message_text: alertMsg.text,
                user_id: user?.idUsuario,
                user_name: user?.nome
            });
            setUrgentAlerts(prev => prev.filter(m => m.id !== alertMsg.id));
        } catch (err) {
            console.error('Erro ao registrar confirmação de leitura:', err);
            // Mesmo com erro, fecha o modal localmente para não travar a tela do usuário
            setUrgentAlerts(prev => prev.filter(m => m.id !== alertMsg.id));
        }
    };

    return (
        <>
            {urgentAlerts.length > 0 && (
                <div className="fixed inset-0 bg-slate-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-200 bg-red-50 flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg text-red-600">
                                <AlertTriangle className="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 leading-tight">Alerta Urgente - Leitura Obrigatória</h2>
                                <p className="text-xs text-slate-500">Confirme a leitura para fechar</p>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50">
                            <div 
                                className="text-sm text-slate-700 whitespace-pre-wrap font-mono"
                                dangerouslySetInnerHTML={{ __html: renderInline(urgentAlerts[0].text) }}
                            />
                        </div>
                        <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => handleAcknowledge(urgentAlerts[0])}
                                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                            >
                                <CheckCircle className="w-5 h-5" />
                                Confirmar Leitura
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-[87px] right-6 w-12 h-12 rounded-full shadow-xl transition-all duration-300 z-[990] flex items-center justify-center ${
                    unreadCount > 0 ? 'bg-indigo-600 animate-bounce' : 'bg-slate-800 hover:bg-slate-700'
                }`}
                title="Feed do Hermes"
            >
                <div className="relative">
                    <Bot className="w-6 h-6 text-white" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-slate-900">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </div>
            </button>

            {/* Side Drawer */}
            <div className={`fixed inset-y-0 right-0 w-96 bg-slate-50 shadow-2xl transform transition-transform duration-300 ease-in-out z-[50] flex flex-col border-l border-slate-200 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="bg-slate-900 p-4 text-white flex items-center justify-between shrink-0 shadow-md relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                            <Bot className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm tracking-wide">Hermes Live Feed</h3>
                            <p className="text-[10px] text-indigo-200 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                                Analisando chão de fábrica
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 relative z-10">
                        <button 
                            onClick={() => setIsPinned(!isPinned)} 
                            title={isPinned ? "Desafixar" : "Fixar janela"}
                            className={`p-1 hover:bg-slate-800 rounded-md transition-colors ${isPinned ? 'bg-slate-800 text-indigo-400' : 'text-slate-400'}`}
                        >
                            {isPinned ? <PinOff className="w-5 h-5" /> : <Pin className="w-5 h-5" />}
                        </button>
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-800 rounded-md transition-colors">
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/50">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-70">
                            <Bot className="w-12 h-12" />
                            <p className="text-xs font-medium text-center px-6">
                                Aguardando eventos do sistema...<br/>
                                RNCs e apontamentos aparecerão aqui automaticamente.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 animate-fadeIn flex gap-3">
                                <div className="shrink-0 mt-1">
                                    {getIconForType(msg.type)}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hermes</span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {new Date(msg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div 
                                        className="text-xs text-slate-700 leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderInline(msg.text)) }}
                                    />
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
        </>
    );
}
