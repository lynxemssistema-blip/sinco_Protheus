import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    MessageSquare, Send, Inbox, PenTool, CheckCircle, Clock, Search, User,
    ChevronLeft, Users, Plus, Hash, Filter, ArrowLeft, Loader2, Info, MoreVertical,
    FileSearch, Calendar as CalendarIcon, Camera, Image as ImageIcon, Mic, MicOff,
    Paperclip, X, FileText, Download, Play, Pause
} from 'lucide-react';
import api from '../services/api';
import { io } from 'socket.io-client';
import { format, isToday, isYesterday, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// === Media helper: build full URL for media ===
const mediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const host = window.location.hostname;
    const port = window.location.port === '' || window.location.port === '80' || window.location.port === '443' ? '' : ':3001';
    return `${window.location.protocol}//${host}${port}${url}`;
};

// === Inline Media Renderer ===
const MediaBubble = ({ msg }) => {
    const [lightbox, setLightbox] = useState(false);

    if (msg.tipo_midia === 'image' && msg.midia_url) {
        return (
            <>
                <img
                    src={mediaUrl(msg.midia_url)}
                    alt={msg.midia_nome || 'Imagem'}
                    className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ maxHeight: 280 }}
                    onClick={() => setLightbox(true)}
                    loading="lazy"
                />
                {msg.mensagem && <p className="text-sm text-slate-800 break-words mt-1">{msg.mensagem}</p>}
                {lightbox && (
                    <div
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        onClick={() => setLightbox(false)}
                    >
                        <button className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/40" onClick={() => setLightbox(false)}>
                            <X className="w-6 h-6 text-white" />
                        </button>
                        <img
                            src={mediaUrl(msg.midia_url)}
                            alt={msg.midia_nome || 'Imagem'}
                            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
                        />
                    </div>
                )}
            </>
        );
    }

    if (msg.tipo_midia === 'audio' && msg.midia_url) {
        return (
            <div className="flex flex-col gap-1">
                <audio controls preload="metadata" className="max-w-[260px]">
                    <source src={mediaUrl(msg.midia_url)} />
                    Seu navegador não suporta áudio.
                </audio>
                {msg.mensagem && <p className="text-sm text-slate-800 break-words mt-1">{msg.mensagem}</p>}
            </div>
        );
    }

    if (msg.tipo_midia === 'file' && msg.midia_url) {
        return (
            <div className="flex flex-col gap-1">
                <a
                    href={mediaUrl(msg.midia_url)}
                    download={msg.midia_nome}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white/60 border border-slate-200 rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors"
                    onClick={e => e.stopPropagation()}
                >
                    <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                    <span className="text-xs font-medium text-slate-700 truncate flex-1">{msg.midia_nome || 'Arquivo'}</span>
                    <Download className="w-4 h-4 text-slate-400 shrink-0" />
                </a>
                {msg.mensagem && <p className="text-sm text-slate-800 break-words mt-1">{msg.mensagem}</p>}
            </div>
        );
    }

    // text only
    return <p className="text-sm text-slate-800 break-words leading-relaxed">{msg.mensagem}</p>;
};

// === Audio Recorder Hook ===
const useAudioRecorder = () => {
    const [recording, setRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const start = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            chunksRef.current = [];

            mr.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current = mr;
            mr.start();
            setRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
        } catch (err) {
            console.error('Erro ao acessar microfone:', err);
            alert('Não foi possível acessar o microfone. Verifique as permissões.');
        }
    }, []);

    const stop = useCallback(() => {
        return new Promise((resolve) => {
            const mr = mediaRecorderRef.current;
            if (!mr || mr.state === 'inactive') { resolve(null); return; }

            mr.onstop = () => {
                clearInterval(timerRef.current);
                setRecording(false);
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                // Stop all tracks
                mr.stream.getTracks().forEach(t => t.stop());
                resolve(blob);
            };
            mr.stop();
        });
    }, []);

    const cancel = useCallback(() => {
        const mr = mediaRecorderRef.current;
        if (mr && mr.state !== 'inactive') {
            mr.stream.getTracks().forEach(t => t.stop());
            mr.stop();
        }
        clearInterval(timerRef.current);
        setRecording(false);
        setRecordingTime(0);
        chunksRef.current = [];
    }, []);

    return { recording, recordingTime, start, stop, cancel };
};

// ========== MAIN COMPONENT ==========
const AvisosHistorico = () => {
    const { user } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [historico, setHistorico] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('chats');
    const [activeUserId, setActiveUserId] = useState(null);
    const [activeGroupId, setActiveGroupId] = useState(null);
    const [mensagem, setMensagem] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    const [groupSearch, setGroupSearch] = useState('');
    const [globalSearch, setGlobalSearch] = useState('');
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [socket, setSocket] = useState(null);

    // Attachment/Association State
    const [showAttachModal, setShowAttachModal] = useState(false);
    const [attachType, setAttachType] = useState('pedido');
    const [attachQuery, setAttachQuery] = useState('');
    const [attachResults, setAttachResults] = useState([]);
    const [loadingAttach, setLoadingAttach] = useState(false);

    // Group Modal State
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedMembros, setSelectedMembros] = useState([]);

    // Media State
    const [uploading, setUploading] = useState(false);
    const [mediaPreview, setMediaPreview] = useState(null); // { file, type, preview }

    // Hidden file inputs
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    const messagesEndRef = useRef(null);

    const audioRecorder = useAudioRecorder();

    // ---- Data Loading ----
    useEffect(() => {
        if (!user?.id) return;

        const loadInitialData = async () => {
            setLoading(true);
            try {
                try {
                    const resUsers = await api.get('/users');
                    const otherUsers = (resUsers.data || []).filter(u => parseInt(u.idUsuario) !== parseInt(user.id));
                    setUsuarios(otherUsers);
                } catch (e) { console.error('❌ Erro ao carregar usuários:', e); }

                try {
                    const resGrupos = await api.get(`/avisos/grupos/usuario/${user.id}`);
                    setGrupos(resGrupos.data || []);
                } catch (e) { console.error('❌ Erro ao carregar grupos:', e); }

                try {
                    const resHist = await api.get(`/avisos/historico/${user.id}`);
                    const histData = resHist.data || [];
                    setHistorico(Array.isArray(histData) ? [...histData].reverse() : []);
                } catch (e) { console.error('❌ Erro ao carregar histórico:', e); }
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();

        const isProd = window.location.port === '' || window.location.port === '80' || window.location.port === '443';
        const socketUrl = isProd
            ? `${window.location.protocol}//${window.location.host}`
            : `${window.location.protocol}//${window.location.hostname}:3001`;

        const newSocket = io(socketUrl);
        newSocket.on('connect', () => { newSocket.emit('join_user', user.id); });
        newSocket.on('novo_aviso', (novoData) => { setHistorico(prev => [...prev, novoData]); });
        setSocket(newSocket);

        return () => { if (newSocket) newSocket.disconnect(); };
    }, [user]);

    useEffect(() => {
        if (socket && grupos.length > 0) {
            grupos.forEach(g => socket.emit('join_group', g.idGrupo));
        }
    }, [socket, grupos]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [historico, activeUserId, activeGroupId]);

    // ---- Upload Helper ----
    const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        setUploading(true);
        try {
            const res = await api.post('/avisos/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return res.data; // { url, tipo_midia, nome_original, tamanho }
        } catch (err) {
            console.error('Upload falhou:', err);
            alert('Erro ao enviar arquivo. Tente novamente.');
            return null;
        } finally {
            setUploading(false);
        }
    };

    // ---- Send Message (text or media) ----
    const sendMessage = async (opts = {}) => {
        const { tipo_midia, midia_url, midia_nome } = opts;
        const text = mensagem.trim();

        if (!tipo_midia && !text) return;
        if (!activeUserId && !activeGroupId) return;

        setEnviando(true);
        try {
            const payload = {
                idRemetente: user.id,
                idDestinatario: activeUserId,
                idGrupo: activeGroupId,
                mensagem: text,
                tipo_midia: tipo_midia || 'text',
                midia_url: midia_url || null,
                midia_nome: midia_nome || null
            };

            const res = await api.post('/avisos', payload);

            const novaMensagemObj = {
                idAviso: res.data.idAviso,
                idRemetente: user.id,
                idDestinatario: activeUserId,
                idGrupo: activeGroupId,
                mensagem: text,
                tipo_midia: tipo_midia || 'text',
                midia_url: midia_url || null,
                midia_nome: midia_nome || null,
                data_envio: new Date().toISOString(),
                concluido: 0,
                lido: 0,
                remetenteNome: user.nome || 'Eu',
                destinatarioNome: activeUserId ? usuarios.find(u => u.idUsuario === activeUserId)?.NomeCompleto : null,
                grupoNome: activeGroupId ? grupos.find(g => g.idGrupo === activeGroupId)?.nome : null
            };

            setHistorico(prev => [...prev, novaMensagemObj]);
            setMensagem('');
            setMediaPreview(null);
        } catch (error) {
            console.error('Erro ao enviar aviso:', error);
        } finally {
            setEnviando(false);
        }
    };

    const handleEnviar = async (e) => {
        e.preventDefault();
        if (mediaPreview) {
            // Upload then send
            const result = await uploadFile(mediaPreview.file);
            if (result) {
                await sendMessage({
                    tipo_midia: result.tipo_midia,
                    midia_url: result.url,
                    midia_nome: result.nome_original
                });
            }
        } else {
            await sendMessage();
        }
    };

    // ---- File Input Handlers ----
    const handleFileSelected = (e, source) => {
        const file = e.target.files[0];
        if (!file) return;

        const isImage = file.type.startsWith('image/');
        const preview = isImage ? URL.createObjectURL(file) : null;

        setMediaPreview({
            file,
            type: isImage ? 'image' : 'file',
            preview,
            name: file.name
        });

        // Clear the input so same file can be re-selected
        e.target.value = '';
    };

    // ---- Audio Recording ----
    const handleAudioStop = async () => {
        const blob = await audioRecorder.stop();
        if (!blob) return;

        const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        const result = await uploadFile(file);
        if (result) {
            await sendMessage({
                tipo_midia: 'audio',
                midia_url: result.url,
                midia_nome: result.nome_original
            });
        }
    };

    // ---- Group / Search / Attach handlers (unchanged) ----
    const handleCreateGroup = async () => {
        if (!newGroupName.trim() || selectedMembros.length === 0) return;
        try {
            const res = await api.post('/avisos/grupos', {
                nome: newGroupName,
                idCriador: user.id,
                membros: selectedMembros
            });
            setGrupos(prev => [...prev, { ...res.data, totalMembros: selectedMembros.length + 1 }]);
            setShowGroupModal(false);
            setNewGroupName('');
            setSelectedMembros([]);
            if (socket) socket.emit('join_group', res.data.idGrupo);
        } catch (err) {
            alert('Erro ao criar grupo');
        }
    };

    const handleSearchGlobal = async (e) => {
        const query = e.target.value;
        setGlobalSearch(query);
        if (query.length < 3) { setIsSearchingGlobal(false); setSearchResults([]); return; }
        setIsSearchingGlobal(true);
        try {
            const res = await api.get('/avisos/search/conteudo', { params: { q: query, idUsuario: user.id } });
            setSearchResults(res.data);
        } catch (err) { console.error(err); }
        finally { setIsSearchingGlobal(false); }
    };

    const handleSearchAttach = async (query) => {
        setAttachQuery(query);
        if (query.length < 2) { setAttachResults([]); return; }
        setLoadingAttach(true);
        try {
            let res;
            if (attachType === 'pedido') res = await api.get('/pedidos/flat', { params: { pedido: query, limit: 10 } });
            else if (attachType === 'op') res = await api.get('/producao/op', { params: { op: query } });
            else if (attachType === 'os') res = await api.get('/sinco/os', { params: { id: query, cliente: query } });

            let finalData = [];
            if (res?.data) {
                if (Array.isArray(res.data)) finalData = res.data;
                else if (res.data.data && Array.isArray(res.data.data)) finalData = res.data.data;
            }
            setAttachResults(finalData);
        } catch (err) { setAttachResults([]); }
        finally { setLoadingAttach(false); }
    };

    const insertAttachIntoMessage = (item) => {
        let text = "";
        if (attachType === 'pedido') text = `[PEDIDO: ${item.pedido} | Item: ${item.item} | Cod: ${item.codigo} | Qtd: ${item.quantidade} | ${item.cliente}] `;
        else if (attachType === 'op') text = `[OP: ${item.op} | Produto: ${item.codnoarvore} | Qtd: ${item.qtd_op_raiz || item.qtd_op}] `;
        else if (attachType === 'os') text = `[OS: ${item.IdOrdemServico} | Projeto: ${item.Projeto} | Qtd: ${item.QtdeTotal || ''}] `;
        setMensagem(prev => prev + text);
        setShowAttachModal(false);
        setAttachQuery('');
        setAttachResults([]);
    };

    // ---- Computed ----
    const activeConversation = useMemo(() => {
        const currentId = parseInt(user?.id || user?.idUsuario);
        if (activeGroupId) return historico.filter(msg => parseInt(msg.idGrupo) === parseInt(activeGroupId));
        if (activeUserId) {
            const targetId = parseInt(activeUserId);
            return historico.filter(msg =>
                !msg.idGrupo && (
                    (parseInt(msg.idRemetente) === currentId && parseInt(msg.idDestinatario) === targetId) ||
                    (parseInt(msg.idDestinatario) === currentId && parseInt(msg.idRemetente) === targetId)
                )
            );
        }
        return [];
    }, [historico, activeUserId, activeGroupId, user]);

    const groupedMessages = useMemo(() => {
        const groups = [];
        if (!Array.isArray(activeConversation)) return groups;
        activeConversation.forEach((msg) => {
            if (!msg?.data_envio) return;
            const date = parseISO(msg.data_envio);
            if (isNaN(date.getTime())) return;
            let dateLabel = format(date, "d 'de' MMMM", { locale: ptBR });
            if (isToday(date)) dateLabel = 'Hoje';
            else if (isYesterday(date)) dateLabel = 'Ontem';
            else if (new Date().getFullYear() !== date.getFullYear()) dateLabel = format(date, "d 'de' MMM 'de' yyyy", { locale: ptBR });
            let lastGroup = groups[groups.length - 1];
            if (!lastGroup || lastGroup.label !== dateLabel) groups.push({ label: dateLabel, messages: [msg] });
            else lastGroup.messages.push(msg);
        });
        return groups;
    }, [activeConversation]);

    const getUltimaMsgInfo = (id, isGrupo) => {
        const currentId = parseInt(user?.id || user?.idUsuario);
        const targetId = parseInt(id);
        const msgs = historico.filter(msg =>
            isGrupo ? parseInt(msg.idGrupo) === targetId :
                (!msg.idGrupo && (
                    (parseInt(msg.idRemetente) === currentId && parseInt(msg.idDestinatario) === targetId) ||
                    (parseInt(msg.idDestinatario) === currentId && parseInt(msg.idRemetente) === targetId)
                ))
        );
        return msgs.length > 0 ? msgs[msgs.length - 1] : null;
    };

    const getLastPreview = (lastMsg) => {
        if (!lastMsg) return null;
        if (lastMsg.tipo_midia === 'image') return '📷 Foto';
        if (lastMsg.tipo_midia === 'audio') return '🎤 Áudio';
        if (lastMsg.tipo_midia === 'file') return '📎 Arquivo';
        return lastMsg.mensagem;
    };

    const sortedUsers = useMemo(() => {
        return usuarios
            .filter(u => u.NomeCompleto?.toLowerCase().includes(contactSearch.toLowerCase()))
            .sort((a, b) => {
                const la = getUltimaMsgInfo(a.idUsuario, false);
                const lb = getUltimaMsgInfo(b.idUsuario, false);
                if (la && lb) return new Date(lb.data_envio) - new Date(la.data_envio);
                return la ? -1 : 1;
            });
    }, [usuarios, historico, contactSearch]);

    const sortedGroups = useMemo(() => {
        return grupos
            .filter(g => g.nome?.toLowerCase().includes(groupSearch.toLowerCase()))
            .sort((a, b) => {
                const la = getUltimaMsgInfo(a.idGrupo, true);
                const lb = getUltimaMsgInfo(b.idGrupo, true);
                if (la && lb) return new Date(lb.data_envio) - new Date(la.data_envio);
                return la ? -1 : 1;
            });
    }, [grupos, historico, groupSearch]);

    const selectedTargetObj = activeGroupId
        ? grupos.find(g => g.idGrupo === activeGroupId)
        : usuarios.find(u => u.idUsuario === activeUserId);

    // ========== RENDER ==========
    return (
        <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] max-w-7xl mx-auto w-full px-2 md:px-4 mb-2">
            <div className="flex-1 flex bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mt-2">

                {/* ===== SIDEBAR ===== */}
                <div className={`w-full md:w-96 border-r border-slate-200 flex flex-col bg-slate-50 shrink-0 ${activeUserId || activeGroupId ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 bg-white space-y-3 shadow-sm z-20">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800">Mensagens</h2>
                            <button onClick={() => setShowGroupModal(true)} className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors" title="Novo Grupo">
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="relative">
                            <input type="text" placeholder="Buscar em conversas..." className="w-full text-sm pl-10 pr-4 py-2.5 rounded-xl border-0 bg-slate-100 focus:ring-2 focus:ring-blue-500 transition-all outline-none" value={globalSearch} onChange={handleSearchGlobal} />
                            <FileSearch className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        </div>
                        <div className="flex p-1 bg-slate-100 rounded-lg">
                            <button onClick={() => { setActiveTab('chats'); setGlobalSearch(''); setSearchResults([]); }} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'chats' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <User className="w-3.5 h-3.5" /> Contatos
                            </button>
                            <button onClick={() => { setActiveTab('grupos'); setGlobalSearch(''); setSearchResults([]); }} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'grupos' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Users className="w-3.5 h-3.5" /> Grupos
                            </button>
                        </div>
                        {!globalSearch && activeTab === 'chats' && (
                            <div className="relative">
                                <input type="text" placeholder="Filtrar contatos..." className="w-full text-sm pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none" value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
                                <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            </div>
                        )}
                        {!globalSearch && activeTab === 'grupos' && (
                            <div className="relative">
                                <input type="text" placeholder="Filtrar grupos..." className="w-full text-sm pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} />
                                <Users className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                        {globalSearch.length >= 3 ? (
                            <div className="p-2 space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1">Resultados da Busca Global</p>
                                {isSearchingGlobal ? (
                                    <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                                ) : (searchResults || []).length === 0 ? (
                                    <div className="p-4 text-center text-sm text-slate-500">Nenhum trecho encontrado.</div>
                                ) : (
                                    (searchResults || []).map(msg => (
                                        <div key={msg.idAviso} onClick={() => {
                                            if (msg.idGrupo) { setActiveGroupId(msg.idGrupo); setActiveUserId(null); }
                                            else { setActiveUserId(msg.idRemetente === user.id ? msg.idDestinatario : msg.idRemetente); setActiveGroupId(null); }
                                            setGlobalSearch('');
                                        }} className="p-3 bg-white rounded-xl border border-slate-100 cursor-pointer hover:bg-blue-50 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-500">{msg.grupoNome || 'Direta'}</span>
                                                <span className="text-[10px] text-slate-400">{format(parseISO(msg.data_envio), 'dd/MM HH:mm')}</span>
                                            </div>
                                            <p className="text-xs text-slate-700 font-semibold">{msg.remetenteNome}</p>
                                            <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 italic">"{msg.mensagem}"</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : activeTab === 'chats' ? (
                            (sortedUsers || []).map(u => {
                                const last = getUltimaMsgInfo(u.idUsuario, false);
                                return (
                                    <div key={u.idUsuario} onClick={() => { setActiveUserId(u.idUsuario); setActiveGroupId(null); }} className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-100 transition-all border-b border-slate-100/50 ${activeUserId === u.idUsuario ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'bg-white'}`}>
                                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0 shadow-sm overflow-hidden">
                                            {u.fotoUsuario ? <img src={u.fotoUsuario} alt="" className="w-full h-full object-cover" /> : <User className="w-6 h-6" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <h4 className="text-sm font-bold text-slate-800 truncate">{u.NomeCompleto}</h4>
                                                {last && <span className="text-[10px] text-slate-400 font-medium">{format(parseISO(last.data_envio), 'HH:mm')}</span>}
                                            </div>
                                            <p className="text-xs text-slate-500 truncate mt-1">
                                                {last ? (parseInt(last.idRemetente) === user.id ? 'Você: ' : '') + (getLastPreview(last)) : <span className="text-blue-400 italic">Diga oi!</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            (sortedGroups || []).map(g => {
                                const last = getUltimaMsgInfo(g.idGrupo, true);
                                return (
                                    <div key={g.idGrupo} onClick={() => { setActiveGroupId(g.idGrupo); setActiveUserId(null); }} className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-100 transition-all border-b border-slate-100/50 ${activeGroupId === g.idGrupo ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'bg-white'}`}>
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-500 shrink-0 shadow-sm overflow-hidden border-2 border-indigo-50">
                                            {g.fotoGrupo ? <img src={g.fotoGrupo} alt="" className="w-full h-full object-cover" /> : <Users className="w-6 h-6" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <h4 className="text-sm font-bold text-slate-800 truncate">{g.nome}</h4>
                                                {last && <span className="text-[10px] text-slate-400 font-medium">{format(parseISO(last.data_envio), 'HH:mm')}</span>}
                                            </div>
                                            <p className="text-xs text-slate-500 truncate mt-1">
                                                {last ? <><span className="font-semibold text-slate-600">{last.remetenteNome?.split(' ')[0]}:</span> {getLastPreview(last)}</> : <span className="text-indigo-400 italic">Grupo criado</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ===== CHAT AREA ===== */}
                <div className={`flex-1 flex flex-col bg-[#efeae2] relative ${!activeUserId && !activeGroupId ? 'hidden md:flex' : 'flex'}`}>
                    {(activeUserId || activeGroupId) ? (
                        <>
                            {/* HEADER */}
                            <div className="h-16 px-4 md:px-6 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-30 shrink-0">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => { setActiveUserId(null); setActiveGroupId(null); }} className="md:hidden p-2 text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                        {activeGroupId ? <Users className="w-5 h-5 text-indigo-500" /> : <User className="w-5 h-5 text-blue-500" />}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800">{selectedTargetObj?.nome || selectedTargetObj?.NomeCompleto}</h3>
                                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                            {activeGroupId ? `${selectedTargetObj?.totalMembros} participantes` : selectedTargetObj?.Setor}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button className="p-2 text-slate-400 hover:text-slate-600"><Search className="w-5 h-5" /></button>
                                    <button className="p-2 text-slate-400 hover:text-slate-600"><MoreVertical className="w-5 h-5" /></button>
                                </div>
                            </div>

                            {/* MESSAGES */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-thin scrollbar-thumb-slate-300">
                                {(groupedMessages || []).map((group, gIdx) => (
                                    <div key={gIdx} className="space-y-4">
                                        <div className="flex justify-center my-6">
                                            <span className="bg-white/90 text-[10px] font-bold text-slate-500 px-3 py-1 rounded-full shadow-sm uppercase tracking-wider border border-slate-100">
                                                {group.label}
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {(group.messages || []).map((msg) => {
                                                const currentUserId = parseInt(user?.idUsuario || user?.id);
                                                const isMine = parseInt(msg.idRemetente) === currentUserId;
                                                const showName = activeGroupId && !isMine;
                                                return (
                                                    <div key={msg.idAviso} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                                        <div className={`max-w-[85%] md:max-w-[70%] px-3 py-2 rounded-xl shadow-sm relative ${isMine ? 'bg-[#dcf8c6] rounded-tr-none' : 'bg-white rounded-tl-none border border-slate-100'}`}>
                                                            {showName && <p className="text-[10px] font-bold text-indigo-600 mb-1">{msg.remetenteNome}</p>}
                                                            <MediaBubble msg={msg} />
                                                            <div className="flex items-center justify-end gap-1.5 mt-1">
                                                                <span className="text-[9px] text-slate-400 font-medium">{format(parseISO(msg.data_envio), 'HH:mm')}</span>
                                                                {isMine && <CheckCircle className={`w-3 h-3 ${msg.lido ? 'text-blue-500' : 'text-slate-300'}`} />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* MEDIA PREVIEW BAR */}
                            {mediaPreview && (
                                <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-3">
                                    {mediaPreview.type === 'image' && mediaPreview.preview && (
                                        <img src={mediaPreview.preview} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
                                    )}
                                    {mediaPreview.type === 'file' && (
                                        <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                                            <FileText className="w-8 h-8 text-slate-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-700 truncate">{mediaPreview.name}</p>
                                        <p className="text-[10px] text-slate-400">{mediaPreview.type === 'image' ? 'Imagem' : 'Arquivo'}</p>
                                    </div>
                                    <button onClick={() => { setMediaPreview(null); }} className="p-1.5 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {/* INPUT BAR */}
                            <div className="p-4 bg-white border-t border-slate-200">
                                {/* Hidden file inputs */}
                                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileSelected(e, 'camera')} />
                                <input ref={galleryInputRef} type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" className="hidden" onChange={(e) => handleFileSelected(e, 'gallery')} />

                                {audioRecorder.recording ? (
                                    /* Audio Recording Mode */
                                    <div className="flex items-center gap-3 max-w-4xl mx-auto">
                                        <button onClick={audioRecorder.cancel} className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 hover:bg-red-200 transition-all active:scale-95" title="Cancelar gravação">
                                            <X className="w-6 h-6" />
                                        </button>
                                        <div className="flex-1 bg-red-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                            <span className="text-sm font-semibold text-red-600">
                                                Gravando... {Math.floor(audioRecorder.recordingTime / 60)}:{(audioRecorder.recordingTime % 60).toString().padStart(2, '0')}
                                            </span>
                                        </div>
                                        <button onClick={handleAudioStop} className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg hover:bg-emerald-600 transition-all active:scale-95" title="Enviar áudio">
                                            <Send className="w-5 h-5 ml-0.5" />
                                        </button>
                                    </div>
                                ) : (
                                    /* Normal Input Mode */
                                    <form onSubmit={handleEnviar} className="flex gap-2 items-end max-w-4xl mx-auto">
                                        {/* Attach/Association button */}
                                        <button type="button" onClick={() => setShowAttachModal(true)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-all shrink-0 active:scale-95" title="Associar Pedido/OP/OS">
                                            <Plus className="w-5 h-5" />
                                        </button>

                                        {/* Camera button (opens native camera on mobile) */}
                                        <button type="button" onClick={() => cameraInputRef.current?.click()} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-green-100 hover:text-green-600 transition-all shrink-0 active:scale-95" title="Câmera">
                                            <Camera className="w-5 h-5" />
                                        </button>

                                        {/* Gallery/File button */}
                                        <button type="button" onClick={() => galleryInputRef.current?.click()} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 transition-all shrink-0 active:scale-95" title="Galeria / Arquivo">
                                            <Paperclip className="w-5 h-5" />
                                        </button>

                                        {/* Text input */}
                                        <div className="flex-1 bg-slate-100 rounded-2xl px-4 py-2 flex items-center">
                                            <textarea
                                                className="w-full bg-transparent border-0 ring-0 focus:ring-0 text-sm py-2 resize-none min-h-[40px] max-h-32 outline-none"
                                                placeholder="Mensagem..."
                                                rows={1}
                                                value={mensagem}
                                                onChange={(e) => setMensagem(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar(e); } }}
                                            />
                                        </div>

                                        {/* Send or Mic */}
                                        {(mensagem.trim() || mediaPreview) ? (
                                            <button type="submit" disabled={enviando || uploading} className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50">
                                                {(enviando || uploading) ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                                            </button>
                                        ) : (
                                            <button type="button" onClick={audioRecorder.start} className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg hover:bg-emerald-600 transition-all active:scale-95" title="Gravar Áudio">
                                                <Mic className="w-5 h-5" />
                                            </button>
                                        )}
                                    </form>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                            <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-inner">
                                <MessageSquare className="w-14 h-14 text-slate-200" />
                            </div>
                            <div className="max-w-xs">
                                <h2 className="text-xl font-bold text-slate-700">Mantenha a equipe conectada</h2>
                                <p className="text-sm text-slate-400 mt-2">Envie avisos rápidos, fotos, áudios e arquivos para usuários individuais ou crie grupos de trabalho.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== MODAL GRUPOS ===== */}
            {showGroupModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold">Novo Grupo</h3>
                                <p className="text-xs opacity-75">Selecione membros e dê um nome</p>
                            </div>
                            <button onClick={() => setShowGroupModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nome do Grupo</label>
                                <input type="text" className="w-full px-4 py-2.5 bg-slate-100 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Equipe de Vendas" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Membros ({(selectedMembros || []).length})</label>
                                <div className="max-h-64 overflow-y-auto space-y-1 pr-2">
                                    {(usuarios || []).map(u => (
                                        <label key={u.idUsuario} className="flex items-center gap-3 p-2 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors">
                                            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={selectedMembros.includes(u.idUsuario)} onChange={() => setSelectedMembros(prev => prev.includes(u.idUsuario) ? prev.filter(id => id !== u.idUsuario) : [...prev, u.idUsuario])} />
                                            <span className="text-sm font-medium text-slate-700">{u.NomeCompleto}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleCreateGroup} disabled={!newGroupName.trim() || selectedMembros.length === 0} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-30 transition-all active:scale-[0.98]">
                                Criar Grupo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL ASSOCIAÇÃO ===== */}
            {showAttachModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
                        <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold">Associar Documento</h3>
                                <p className="text-xs opacity-75">Procure o recurso Protheus para inserir no chat</p>
                            </div>
                            <button onClick={() => setShowAttachModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
                        </div>
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-2">
                            {['pedido', 'op', 'os'].map((type) => (
                                <button key={type} onClick={() => { setAttachType(type); setAttachResults([]); setAttachQuery(''); }} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${attachType === type ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>
                                    {type}
                                </button>
                            ))}
                        </div>
                        <div className="p-4 border-b border-slate-200">
                            <div className="relative">
                                <input type="text" autoFocus className="w-full px-10 py-3 bg-slate-100 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder={`Pesquisar ${attachType.toUpperCase()}...`} value={attachQuery} onChange={e => handleSearchAttach(e.target.value)} />
                                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
                                {loadingAttach && <Loader2 className="w-5 h-5 text-blue-500 absolute right-3 top-3 animate-spin" />}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                            {(attachResults || []).length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 py-10">
                                    <Filter className="w-10 h-10 mb-2" />
                                    <p className="text-sm">Digite para buscar resultados</p>
                                </div>
                            ) : (
                                (attachResults || []).map((item, idx) => (
                                    <div key={idx} onClick={() => insertAttachIntoMessage(item)} className="p-3 bg-white hover:bg-blue-50 border border-slate-200 rounded-xl cursor-pointer transition-all hover:shadow-md flex justify-between items-center">
                                        <div className="min-w-0 flex-1">
                                            {attachType === 'pedido' ? (<><p className="text-xs font-bold text-slate-800">Pedido: {item.pedido} | Item: {item.item}</p><p className="text-[11px] text-blue-600 font-semibold">{item.codigo} - Qtd: {item.quantidade}</p><p className="text-[10px] text-slate-500 truncate">{item.cliente}</p></>) : attachType === 'op' ? (<><p className="text-xs font-bold text-slate-800">OP: {item.op}</p><p className="text-[11px] text-orange-600 font-semibold">{item.codnoarvore} - Qtd: {item.qtd_op_raiz || item.qtd_op}</p><p className="text-[10px] text-slate-500 truncate">{item.descnoarvore}</p></>) : (<><p className="text-xs font-bold text-slate-800">OS: {item.IdOrdemServico} | Projeto: {item.Projeto}</p><p className="text-[11px] text-emerald-600 font-semibold">Cod: {item.IdMaterial || 'N/A'} - Qtd: {item.QtdeTotal || ''}</p><p className="text-[10px] text-slate-500 truncate">{item.Descricao}</p></>)}
                                        </div>
                                        <Plus className="w-4 h-4 text-blue-500 shrink-0 ml-4" />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AvisosHistorico;
