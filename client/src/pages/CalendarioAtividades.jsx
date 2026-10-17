import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus,
    CheckCircle2, Clock, MessageSquare, FileText, CheckSquare,
    User, AlertCircle, Eye, RefreshCw, X, HelpCircle, Package, UserPlus, Sparkles, ListTodo, Edit, Trash2
} from 'lucide-react';
import { toast } from 'react-toastify';

// Calendar Helper: Get all days in the monthly grid
function getDaysInMonthGrid(date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    // First day of the month
    const firstDayOfMonth = new Date(year, month, 1);
    // Day of the week for first day (0 = Sunday, 1 = Monday, etc.)
    const startDayOfWeek = firstDayOfMonth.getDay();

    // Total days in the current month
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const grid = [];

    // Add padding days from the previous month
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    const totalDaysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        grid.push({
            date: new Date(prevMonthYear, prevMonth, totalDaysInPrevMonth - i),
            isCurrentMonth: false
        });
    }

    // Add current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
        grid.push({
            date: new Date(year, month, i),
            isCurrentMonth: true
        });
    }

    // Add padding days from the next month to complete the grid (usually 42 cells)
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const remainingCells = 42 - grid.length;

    for (let i = 1; i <= remainingCells; i++) {
        grid.push({
            date: new Date(nextMonthYear, nextMonth, i),
            isCurrentMonth: false
        });
    }

    return grid;
}

// Format local date to YYYY-MM-DD
function formatLocalDate(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function CalendarioAtividades() {
    const { user } = useAuth();
    
    // States
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [datesWithPcp, setDatesWithPcp] = useState([]);
    const [loading, setLoading] = useState(false);
    
    const [dayDetails, setDayDetails] = useState({ atividades: [], pcp: [] });
    const [detailsLoading, setDetailsLoading] = useState(false);
    
    const [users, setUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newActivity, setNewActivity] = useState({
        texto: '',
        data_atividade: formatLocalDate(new Date())
    });
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusConfirm, setStatusConfirm] = useState(null); // { id, concluido, grupoId }
    
    // Persistir preferência de exibir concluídos
    const [showCompleted, setShowCompleted] = useState(() => {
        try {
            const saved = localStorage.getItem('calendario_show_completed');
            return saved ? JSON.parse(saved) : false;
        } catch (e) {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('calendario_show_completed', JSON.stringify(showCompleted));
        } catch (e) {
            // Silencioso
        }
    }, [showCompleted]);

    // --- WhatsApp Monitored Groups States ---
    const [activeTab, setActiveTab] = useState('atividades'); // 'atividades' | 'whatsapp'
    const [waGroups, setWaGroups] = useState([]);
    const [waLoading, setWaLoading] = useState(false);
    const [selectedWaGroup, setSelectedWaGroup] = useState(null);
    const [waMessages, setWaMessages] = useState([]);
    const [waMessagesLoading, setWaMessagesLoading] = useState(false);
    const [newWaGroupName, setNewWaGroupName] = useState('');
    const [waGroupSearch, setWaGroupSearch] = useState('');
    const [registeringWaGroup, setRegisteringWaGroup] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [syncingWaHistory, setSyncingWaHistory] = useState(false);
    const waMessagesEndRef = useRef(null);
    
    // --- WhatsApp AI Agent States ---
    const [aiSummary, setAiSummary] = useState('');
    const [aiPendencies, setAiPendencies] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [showAiPanel, setShowAiPanel] = useState(false);
    const [forcingAiRecalc, setForcingAiRecalc] = useState(false);

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        const term = searchTerm.toLowerCase();
        return users.filter(u => 
            u.NomeCompleto?.toLowerCase().includes(term) ||
            u.Login?.toLowerCase().includes(term)
        );
    }, [users, searchTerm]);

    // --- WhatsApp API Helpers ---
    const fetchWaGroups = useCallback(async () => {
        try {
            setWaLoading(true);
            const res = await api.get('/whatsapp/grupos');
            setWaGroups(res.data || []);
        } catch (err) {
            console.error('Erro ao buscar grupos monitorados:', err);
            toast.error('Erro ao carregar grupos monitorados.');
        } finally {
            setWaLoading(false);
        }
    }, []);

    const fetchWaMessages = useCallback(async (grupoNome) => {
        try {
            setWaMessagesLoading(true);
            const res = await api.get(`/whatsapp/grupos/${encodeURIComponent(grupoNome)}/mensagens`);
            setWaMessages(res.data || []);
        } catch (err) {
            console.error('Erro ao buscar mensagens do grupo:', err);
            toast.error('Erro ao carregar mensagens.');
        } finally {
            setWaMessagesLoading(false);
        }
    }, []);

    const handleRegisterWaGroup = async (e) => {
        e.preventDefault();
        const nomeTrim = newWaGroupName.trim();
        if (!nomeTrim) {
            toast.warning('O nome do grupo é obrigatório.');
            return;
        }
        try {
            setRegisteringWaGroup(true);
            const res = await api.post('/whatsapp/grupos', { grupo_nome: nomeTrim });
            toast.success(res.data.message || 'Grupo cadastrado com sucesso!');
            setNewWaGroupName('');
            fetchWaGroups();
        } catch (err) {
            console.error('Erro ao cadastrar grupo:', err);
            toast.error(err.response?.data?.error || 'Erro ao cadastrar grupo.');
        } finally {
            setRegisteringWaGroup(false);
        }
    };

    const handleDeleteWaGroup = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Deseja realmente remover este grupo do monitoramento?')) return;
        try {
            await api.delete(`/whatsapp/grupos/${id}`);
            toast.success('Grupo removido do monitoramento.');
            fetchWaGroups();
            if (selectedWaGroup && selectedWaGroup.id === id) {
                setSelectedWaGroup(null);
                setWaMessages([]);
            }
        } catch (err) {
            console.error('Erro ao remover grupo:', err);
            toast.error('Erro ao remover grupo do monitoramento.');
        }
    };

    const handleSyncWaHistory = async (grupoNome) => {
        if (!grupoNome) return;
        try {
            setSyncingWaHistory(true);
            const res = await api.post(`/whatsapp/grupos/${encodeURIComponent(grupoNome)}/sync`);
            toast.success(res.data.message || 'Histórico sincronizado com sucesso!');
            fetchWaMessages(grupoNome);
        } catch (err) {
            console.error('Erro ao sincronizar mensagens:', err);
            toast.error(err.response?.data?.error || 'Erro ao sincronizar com a Evolution API.');
        } finally {
            setSyncingWaHistory(false);
        }
    };
    
    const fetchWaGroupAiSummary = useCallback(async (grupoJid) => {
        if (!grupoJid) return;
        try {
            setAiLoading(true);
            const res = await api.get(`/whatsapp/grupos/${encodeURIComponent(grupoJid)}/resumo`);
            setAiSummary(res.data?.resumo || '');
            const pendencies = res.data?.pendencias || [];
            setAiPendencies(pendencies.map(p => ({ text: p, completed: false })));
        } catch (err) {
            console.error('Erro ao buscar resumo da IA:', err);
            setAiSummary('Não foi possível carregar o resumo da IA para hoje.');
            setAiPendencies([]);
        } finally {
            setAiLoading(false);
        }
    }, []);

    const handleForceAiRecalc = async (grupoJid) => {
        if (!grupoJid) return;
        try {
            setForcingAiRecalc(true);
            toast.info('Recalculando resumo e pendências com IA...');
            const res = await api.post(`/whatsapp/grupos/${encodeURIComponent(grupoJid)}/resumo/force`);
            if (res.data?.success) {
                setAiSummary(res.data.resumo || '');
                const pendencies = res.data.pendencias || [];
                setAiPendencies(pendencies.map(p => ({ text: p, completed: false })));
                toast.success('Análise IA atualizada com sucesso!');
            }
        } catch (err) {
            console.error('Erro ao forçar recálculo da IA:', err);
            toast.error('Erro ao recalcular resumo com IA.');
        } finally {
            setForcingAiRecalc(false);
        }
    };

    // Load WhatsApp groups when tab active
    useEffect(() => {
        if (activeTab === 'whatsapp') {
            fetchWaGroups();
        }
    }, [activeTab, fetchWaGroups]);

    // Load messages and AI summary when group selected
    useEffect(() => {
        if (selectedWaGroup) {
            fetchWaMessages(selectedWaGroup.grupo_nome);
            if (selectedWaGroup.grupo_jid) {
                fetchWaGroupAiSummary(selectedWaGroup.grupo_jid);
            } else {
                setAiSummary('');
                setAiPendencies([]);
            }
        }
    }, [selectedWaGroup, fetchWaMessages, fetchWaGroupAiSummary]);

    // Dynamic scroll to bottom
    useEffect(() => {
        if (waMessagesEndRef.current) {
            waMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [waMessages]);

    // Socket.io connection for WhatsApp live updates
    useEffect(() => {
        if (activeTab !== 'whatsapp') return;

        let activeSocket = null;
        import('socket.io-client').then(({ io }) => {
            const socketUrl = window.location.origin;
                
            const newSocket = io(socketUrl, { transports: ['websocket', 'polling'] });
            activeSocket = newSocket;

            newSocket.on('connect', () => {
                console.log('🟢 [WhatsApp Monitor] Conectado ao socket do servidor.');
            });

            newSocket.on('whatsapp_nova_mensagem', (data) => {
                // If it is the selected group, append to message feed
                if (selectedWaGroup && selectedWaGroup.grupo_nome.toLowerCase() === data.grupo_nome.toLowerCase()) {
                    setWaMessages(prev => {
                        // Prevent duplicates
                        if (data.id_mensagem && prev.some(m => m.id_mensagem === data.id_mensagem)) {
                            return prev;
                        }
                        return [...prev, data];
                    });
                }
            });
        }).catch(err => {
            console.error('Erro ao conectar Socket.io para WhatsApp:', err);
        });

        return () => {
            if (activeSocket) {
                activeSocket.disconnect();
            }
        };
    }, [activeTab, selectedWaGroup]);

    // Group WhatsApp messages chronologically
    const groupedWaMessages = useMemo(() => {
        const groups = [];
        if (!Array.isArray(waMessages)) return groups;

        waMessages.forEach((msg) => {
            if (!msg.recebido_em) return;
            const date = new Date(msg.recebido_em);
            if (isNaN(date.getTime())) return;

            const todayStr = formatLocalDate(new Date());
            const msgDateStr = formatLocalDate(date);
            
            let dateLabel = '';
            if (todayStr === msgDateStr) {
                dateLabel = 'Hoje';
            } else {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                if (formatLocalDate(yesterday) === msgDateStr) {
                    dateLabel = 'Ontem';
                } else {
                    dateLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                }
            }

            let lastGroup = groups[groups.length - 1];
            if (!lastGroup || lastGroup.label !== dateLabel) {
                groups.push({ label: dateLabel, messages: [msg] });
            } else {
                lastGroup.messages.push(msg);
            }
        });
        return groups;
    }, [waMessages]);

    // Filter registered WhatsApp groups
    const filteredWaGroups = useMemo(() => {
        if (!waGroupSearch) return waGroups;
        const term = waGroupSearch.toLowerCase();
        return waGroups.filter(g => g.grupo_nome.toLowerCase().includes(term));
    }, [waGroups, waGroupSearch]);

    // Fetch unified monthly events
    const fetchMonthlyEvents = useCallback(async () => {
        try {
            setLoading(true);
            const gridDays = getDaysInMonthGrid(currentDate);
            const startStr = formatLocalDate(gridDays[0].date);
            const endStr = formatLocalDate(gridDays[gridDays.length - 1].date);
            
            const res = await api.get(`/calendario/eventos?start=${startStr}&end=${endStr}`);
            setEvents(res.data.eventos || []);
            setDatesWithPcp(res.data.datasComPcp || []);
        } catch (err) {
            console.error('Erro ao buscar eventos do mês:', err);
            toast.error('Erro ao carregar atividades do mês.');
        } finally {
            setLoading(false);
        }
    }, [currentDate]);

    // Fetch details of selected day
    const fetchDayDetails = useCallback(async (dateToFetch) => {
        try {
            setDetailsLoading(true);
            const dateStr = formatLocalDate(dateToFetch);
            const res = await api.get(`/calendario/dia?date=${dateStr}`);
            setDayDetails(res.data || { atividades: [], pcp: [] });
        } catch (err) {
            console.error('Erro ao buscar detalhes do dia:', err);
            toast.error('Erro ao carregar detalhes do dia selecionado.');
        } finally {
            setDetailsLoading(false);
        }
    }, []);

    // Fetch users list
    const fetchUsers = useCallback(async () => {
        try {
            const res = await api.get('/users?aprovado=1');
            setUsers(res.data || []);
        } catch (err) {
            console.error('Erro ao buscar usuários:', err);
        }
    }, []);

    // Load monthly events and users on mount/month change
    useEffect(() => {
        fetchMonthlyEvents();
    }, [fetchMonthlyEvents]);

    useEffect(() => {
        fetchDayDetails(selectedDate);
    }, [selectedDate, fetchDayDetails]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Pre-select current user when modal opens
    useEffect(() => {
        if (showModal && user?.id) {
            setSelectedUserIds([user.id]);
            setSearchTerm('');
        }
    }, [showModal, user?.id]);

    // Navigate months
    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleToday = () => {
        const today = new Date();
        setCurrentDate(today);
        setSelectedDate(today);
    };

    // Monthly grid computation
    const daysGrid = useMemo(() => getDaysInMonthGrid(currentDate), [currentDate]);

    // Maps events to date strings for quick lookup
    const eventsByDate = useMemo(() => {
        const map = {};
        events.forEach(event => {
            if (!map[event.data]) {
                map[event.data] = [];
            }
            map[event.data].push(event);
        });
        return map;
    }, [events]);

    // Toggle custom activity status
    // Toggle custom/ataviva activity status
    const handleToggleStatus = async (id, currentStatus, grupoId, tipo) => {
        const newStatus = !currentStatus;
        
        if (tipo === 'ataviva') {
            try {
                await api.put(`/ata-viva/tarefas/${id}/status`, { 
                    status: newStatus ? 'CONCLUIDO' : 'PENDENTE',
                    usuario: user?.nome || 'Sistema'
                });
                toast.success(newStatus ? 'Ata Viva concluída!' : 'Ata Viva marcada como pendente.');
                
                // Atualizar estado de eventos locais
                setEvents(prev => prev.map(ev => {
                    if (ev.tipo === 'ataviva' && ev.dbId === id) {
                        return { ...ev, concluido: newStatus };
                    }
                    return ev;
                }));

                // Atualizar dayDetails
                setDayDetails(prev => ({
                    ...prev,
                    atividades: prev.atividades.map(act => {
                        if (act.tipo === 'ataviva' && act.id === id) {
                            return { ...act, concluido: newStatus };
                        }
                        return act;
                    })
                }));
            } catch (err) {
                console.error('Erro ao atualizar status da Ata Viva:', err);
                toast.error('Erro ao atualizar status da tarefa da Ata Viva.');
            }
            return;
        }

        // If it is part of a group and is being completed, ask if we want to complete all
        if (grupoId && newStatus) {
            setStatusConfirm({ id, concluido: newStatus, grupoId });
            return;
        }

        try {
            await api.put(`/calendario/atividades/${id}/status`, { concluido: newStatus });
            toast.success(newStatus ? 'Atividade concluída!' : 'Atividade marcada como pendente.');
            
            // Local update of events list to avoid full refresh
            setEvents(prev => prev.map(ev => {
                if (ev.tipo === 'custom' && ev.dbId === id) {
                    return { ...ev, concluido: newStatus };
                }
                return ev;
            }));

            // Update local day details
            setDayDetails(prev => ({
                ...prev,
                atividades: prev.atividades.map(act => {
                    if (act.tipo === 'custom' && act.id === id) {
                        return { ...act, concluido: newStatus };
                    }
                    return act;
                })
            }));
        } catch (err) {
            console.error('Erro ao atualizar status:', err);
            toast.error('Erro ao atualizar status da atividade.');
        }
    };

    // Edit Ata Viva text
    const handleEditAtaViva = async (task) => {
        const novoTexto = window.prompt('Editar texto da tarefa da Ata Viva:', task.titulo || task.texto_tarefa);
        if (novoTexto === null) return;
        
        const textoTrim = novoTexto.trim();
        if (!textoTrim) {
            toast.warning('O texto da tarefa não pode ser vazio.');
            return;
        }

        try {
            await api.put(`/ata-viva/tarefas/${task.id}`, { texto_tarefa: textoTrim });
            toast.success('Tarefa da Ata Viva editada com sucesso!');

            // Atualizar localmente events
            setEvents(prev => prev.map(ev => {
                if (ev.tipo === 'ataviva' && ev.dbId === task.id) {
                    return { ...ev, titulo: textoTrim };
                }
                return ev;
            }));

            // Atualizar localmente dayDetails
            setDayDetails(prev => ({
                ...prev,
                atividades: prev.atividades.map(act => {
                    if (act.tipo === 'ataviva' && act.id === task.id) {
                        return { ...act, titulo: textoTrim, texto_tarefa: textoTrim };
                    }
                    return act;
                })
            }));
        } catch (err) {
            console.error('Erro ao editar tarefa da Ata Viva:', err);
            toast.error('Erro ao editar tarefa da Ata Viva.');
        }
    };

    // Delete Ata Viva task
    const handleDeleteAtaViva = async (id) => {
        if (!window.confirm('Deseja realmente excluir esta tarefa da Ata Viva?')) return;
        try {
            await api.delete(`/ata-viva/tarefas/${id}`);
            toast.success('Tarefa da Ata Viva excluída com sucesso!');
            
            // Remover localmente de events e dayDetails
            setEvents(prev => prev.filter(ev => !(ev.tipo === 'ataviva' && ev.dbId === id)));
            setDayDetails(prev => ({
                ...prev,
                atividades: prev.atividades.filter(act => !(act.tipo === 'ataviva' && act.id === id))
            }));
        } catch (err) {
            console.error('Erro ao excluir tarefa da Ata Viva:', err);
            toast.error('Erro ao excluir tarefa da Ata Viva.');
        }
    };


    const handleConfirmStatus = async (baixarTodos) => {
        if (!statusConfirm) return;
        const { id, concluido } = statusConfirm;
        try {
            await api.put(`/calendario/atividades/${id}/status`, { 
                concluido, 
                baixarTodos 
            });
            toast.success(baixarTodos ? 'Status atualizado para todos!' : 'Status atualizado para você!');
            setStatusConfirm(null);
            
            // Reload page data to reflect the changes (since multiple items might have changed)
            fetchMonthlyEvents();
            fetchDayDetails(selectedDate);
        } catch (err) {
            console.error('Erro ao atualizar status do grupo:', err);
            toast.error('Erro ao atualizar status.');
        }
    };

    // Handle new activity creation
    const handleCreateActivity = async (e) => {
        e.preventDefault();
        if (!newActivity.texto) {
            toast.warning('O texto da atividade é obrigatório.');
            return;
        }

        if (selectedUserIds.length === 0) {
            toast.warning('Selecione pelo menos um destinatário.');
            return;
        }

        try {
            setCreating(true);
            await api.post('/calendario/atividades', {
                idDestinatarios: selectedUserIds,
                texto: newActivity.texto,
                data_atividade: newActivity.data_atividade
            });

            toast.success('Atividade agendada com sucesso!');
            setShowModal(false);
            setNewActivity({
                texto: '',
                data_atividade: formatLocalDate(selectedDate)
            });
            setSelectedUserIds([user?.id]);

            // Reload month and day details
            fetchMonthlyEvents();
            if (newActivity.data_atividade === formatLocalDate(selectedDate)) {
                fetchDayDetails(selectedDate);
            }
        } catch (err) {
            console.error('Erro ao agendar atividade:', err);
            toast.error(err.response?.data?.error || 'Erro ao agendar atividade.');
        } finally {
            setCreating(false);
        }
    };

    // Filter activities list
    const sortedActivities = useMemo(() => {
        return [...dayDetails.atividades].sort((a, b) => {
            // Uncompleted first
            if (a.concluido !== b.concluido) {
                return a.concluido ? 1 : -1;
            }
            return new Date(b.criado_em) - new Date(a.criado_em);
        });
    }, [dayDetails.atividades]);

    const completedCount = useMemo(() => {
        return dayDetails.atividades.filter(act => act.concluido).length;
    }, [dayDetails.atividades]);

    const visibleActivities = useMemo(() => {
        if (showCompleted) return sortedActivities;
        return sortedActivities.filter(act => !act.concluido);
    }, [sortedActivities, showCompleted]);

    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-60px)] md:h-[calc(100vh-24px)] bg-slate-50 overflow-hidden">
            {/* Header Area */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-6 shadow-md border-b border-slate-700 shrink-0">
                <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-sky-500/20 border border-sky-400/30 rounded-xl flex items-center justify-center shadow-inner">
                            <CalendarIcon className="w-6 h-6 text-sky-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">Calendário de Atividades</h1>
                            <p className="text-slate-400 text-xs mt-0.5">Visão unificada de compromissos, notas, avisos e PCP</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleToday}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm font-semibold rounded-xl transition-all duration-300"
                        >
                            Hoje
                        </button>
                        <button
                            onClick={() => {
                                setNewActivity(prev => ({ ...prev, data_atividade: formatLocalDate(selectedDate) }));
                                setShowModal(true);
                            }}
                            className="flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-xl transition-all duration-300 shadow hover:shadow-lg active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            Criar Atividade
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs Selector */}
            <div className="bg-white border-b border-slate-200 px-6 flex gap-4 shrink-0 shadow-sm">
                <button
                    onClick={() => setActiveTab('atividades')}
                    className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all duration-300 flex items-center gap-2
                        ${activeTab === 'atividades'
                            ? 'border-orange-600 text-orange-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <CalendarIcon className="w-4 h-4" />
                    Atividades & PCP
                </button>
                <button
                    onClick={() => {
                        setActiveTab('whatsapp');
                        setSelectedWaGroup(null);
                        setWaMessages([]);
                    }}
                    className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all duration-300 flex items-center gap-2
                        ${activeTab === 'whatsapp'
                            ? 'border-orange-600 text-orange-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <MessageSquare className="w-4 h-4" />
                    Monitoramento WhatsApp
                </button>
            </div>

            {/* Dashboard Content */}
            {activeTab === 'atividades' ? (
                <div className="flex-1 w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
                    
                    {/* Monthly Calendar View (Left Side, span 2) */}
                    <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 overflow-hidden h-full">
                        {/* Navigation */}
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                {MONTHS[currentDate.getMonth()]} de {currentDate.getFullYear()}
                                {loading && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}
                            </h2>
                            
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={prevMonth}
                                    aria-label="Mês anterior"
                                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={nextMonth}
                                    aria-label="Próximo mês"
                                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Calendar Grid */}
                        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                            <div className="grid grid-cols-7 text-center shrink-0 border-b border-slate-100 pb-2">
                                {WEEKDAYS.map(day => (
                                    <span key={day} className="text-xs font-bold text-slate-400 uppercase tracking-wider py-1">
                                        {day}
                                    </span>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 grid-rows-6 flex-1 border-t border-l border-slate-100 mt-2" style={{ gridTemplateRows: 'repeat(6, 1fr)' }}>
                                {daysGrid.map(({ date, isCurrentMonth }, idx) => {
                                    const dateStr = formatLocalDate(date);
                                    const dayEvents = eventsByDate[dateStr] || [];
                                    const hasPcp = datesWithPcp.includes(dateStr);
                                    const isSelected = formatLocalDate(selectedDate) === dateStr;
                                    const isToday = formatLocalDate(new Date()) === dateStr;

                                    // Max 4 events shown in month cell, rest is count
                                    const visibleEvents = dayEvents.slice(0, 3);
                                    const hiddenCount = dayEvents.length - visibleEvents.length;

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedDate(date)}
                                            className={`flex flex-col min-h-0 h-full p-1.5 sm:p-2 border-r border-b border-slate-100 cursor-pointer transition-all duration-300 relative select-none hover:bg-slate-50/80
                                                ${isCurrentMonth ? 'text-slate-800' : 'text-slate-300 bg-slate-50/20'}
                                                ${isSelected ? 'ring-2 ring-orange-500 ring-inset bg-orange-50/10' : ''}
                                            `}
                                        >
                                            {/* Day Number Header */}
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center
                                                    ${isToday ? 'bg-orange-600 text-white shadow-sm' : ''}
                                                    ${isSelected && !isToday ? 'text-orange-600' : ''}
                                                `}>
                                                    {date.getDate()}
                                                </span>

                                                {/* PCP Delivery Indicator */}
                                                {hasPcp && (
                                                    <span 
                                                        title="Programação PCP agendada para este dia"
                                                        className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase scale-90 sm:scale-100 origin-right"
                                                    >
                                                        PCP
                                                    </span>
                                                )}
                                            </div>

                                            {/* Events Dots/Lines */}
                                            <div className="flex-1 flex flex-col justify-end gap-1 overflow-hidden">
                                                {visibleEvents.map((ev, eIdx) => {
                                                    let colorClass = 'bg-orange-500'; // Custom Activity (Orange)
                                                    if (ev.concluido) {
                                                        colorClass = 'bg-slate-400 line-through text-slate-400'; // Completed
                                                    } else if (ev.tipo === 'ataviva') {
                                                        colorClass = 'bg-emerald-500'; // Ata Viva
                                                    } else if (ev.tipo === 'aviso') {
                                                        colorClass = 'bg-cyan-500'; // Aviso/Message
                                                    }

                                                    return (
                                                        <div
                                                            key={eIdx}
                                                            className={`h-1.5 w-full rounded-full transition-all ${colorClass}`}
                                                            title={`${ev.tipo.toUpperCase()}: ${ev.titulo}`}
                                                        />
                                                    );
                                                })}

                                                {hiddenCount > 0 && (
                                                    <span className="text-[10px] font-bold text-slate-400 text-right mt-0.5 pr-1">
                                                        +{hiddenCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Day Details Drawer (Right Side, span 1) */}
                    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
                        {/* Header Details */}
                        <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 shrink-0 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-slate-800 text-base">Atividades do Dia</h3>
                                <p className="text-slate-500 text-xs mt-0.5">
                                    {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                </p>
                            </div>
                            {detailsLoading && <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />}
                        </div>

                        {/* Lists Container */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            
                            {/* Activities List */}
                            <div>
                                <div className="flex items-center justify-between mb-3 w-full">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                        <Clock className="w-4 h-4" />
                                        Lista de Atividades
                                    </h4>
                                    {completedCount > 0 && (
                                        <button
                                            onClick={() => setShowCompleted(!showCompleted)}
                                            className="text-[10px] font-bold text-slate-500 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 px-2 py-1 rounded-lg transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            {showCompleted ? 'Ocultar Concluídas' : `Mostrar Concluídas (${completedCount})`}
                                        </button>
                                    )}
                                </div>

                                {detailsLoading ? (
                                    <div className="py-8 text-center text-slate-400 text-sm">Carregando atividades...</div>
                                ) : sortedActivities.length > 0 ? (
                                    <div className="space-y-3">
                                        {visibleActivities.length > 0 ? (
                                            visibleActivities.map((act) => {
                                                const isCreator = act.idRemetente === user?.id;

                                                let icon = <CheckSquare className="w-4 h-4" />;
                                                let badgeColor = 'bg-orange-50 border-orange-100 text-orange-700'; // Custom Activity
                                                let label = 'Custom';

                                                if (act.tipo === 'ataviva') {
                                                    icon = <FileText className="w-4 h-4" />;
                                                    badgeColor = 'bg-emerald-50 border-emerald-100 text-emerald-700';
                                                    label = 'Ata Viva';
                                                } else if (act.tipo === 'aviso') {
                                                    icon = <MessageSquare className="w-4 h-4" />;
                                                    badgeColor = 'bg-cyan-50 border-cyan-100 text-cyan-700';
                                                    label = 'Aviso';
                                                }

                                                return (
                                                    <div
                                                        key={`${act.tipo}-${act.id}`}
                                                        className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 bg-white shadow-sm hover:shadow-md
                                                            ${act.concluido ? 'border-slate-100 opacity-60 bg-slate-50/50' : 'border-slate-200'}
                                                        `}
                                                    >
                                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                                            {/* Action check button for custom and ataviva tasks */}
                                                            {act.tipo === 'custom' || act.tipo === 'ataviva' ? (
                                                                <button
                                                                    onClick={() => handleToggleStatus(act.id, act.concluido, act.grupo_id, act.tipo)}
                                                                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 shrink-0
                                                                        ${act.concluido 
                                                                            ? 'bg-slate-400 border-slate-400 text-white' 
                                                                            : 'bg-white border-slate-300 hover:border-orange-500 text-transparent'
                                                                        }
                                                                    `}
                                                                >
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                </button>
                                                            ) : (
                                                                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${act.concluido ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                                    {icon}
                                                                </div>
                                                            )}

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                                                                        {label}
                                                                    </span>
                                                                    {act.concluido && (
                                                                        <span className="bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                            Concluído
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                
                                                                <p className={`text-slate-800 text-sm font-semibold break-words leading-relaxed ${act.concluido ? 'line-through text-slate-400' : ''}`}>
                                                                    {act.titulo}
                                                                </p>

                                                                {/* Meta information */}
                                                                {act.tipo === 'custom' && (
                                                                    <div className="mt-2 text-slate-400 text-[11px] font-medium flex flex-wrap gap-2 items-center">
                                                                        <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                                                            <User className="w-3.5 h-3.5 text-slate-400" />
                                                                            De: {act.idRemetente === user?.id ? 'Você' : act.remetenteNome || 'Usuário'}
                                                                        </span>
                                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                                                            Para: {act.idDestinatario === user?.id ? 'Você' : act.destinatarioNome || 'Usuário'}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {act.tipo === 'ataviva' && (
                                                                    <div className="mt-2 text-slate-400 text-[11px] font-medium flex flex-wrap gap-2">
                                                                        {act.pedido && <span>Pedido: {act.pedido}</span>}
                                                                        {act.produto && <span>• Produto: {act.produto}</span>}
                                                                        {act.op_numero && <span>• OP: {act.op_numero}</span>}
                                                                    </div>
                                                                )}

                                                                {act.tipo === 'aviso' && (
                                                                    <div className="mt-2 text-slate-400 text-[11px] font-medium flex flex-wrap gap-2">
                                                                        <span>Remetente: {act.remetenteNome}</span>
                                                                        {act.grupoNome && <span>• Grupo: {act.grupoNome}</span>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Actions for Ata Viva (Edit & Delete) */}
                                                        {act.tipo === 'ataviva' && (
                                                            <div className="flex items-center gap-1 shrink-0 self-start mt-0.5">
                                                                <button
                                                                    onClick={() => handleEditAtaViva(act)}
                                                                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                                                                    title="Editar tarefa da Ata Viva"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteAtaViva(act.id)}
                                                                    className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                                                    title="Excluir tarefa da Ata Viva"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center text-slate-400 text-sm">
                                                Todas as atividades de hoje foram concluídas.
                                                <button
                                                    onClick={() => setShowCompleted(true)}
                                                    className="block mx-auto mt-2 text-xs font-bold text-orange-600 hover:text-orange-500 underline"
                                                >
                                                    Visualizar atividades concluídas ({completedCount})
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center text-slate-400 text-sm">
                                        Nenhuma atividade agendada.
                                    </div>
                                )}
                            </div>

                            {/* PCP Deliveries List */}
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                    <Package className="w-4 h-4" />
                                    Entregas PCP Protheus
                                </h4>

                                {detailsLoading ? (
                                    <div className="py-8 text-center text-slate-400 text-sm">Carregando PCP...</div>
                                ) : dayDetails.pcp && dayDetails.pcp.length > 0 ? (
                                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                                                    <th className="p-3">Ped/Item</th>
                                                    <th className="p-3">Cliente</th>
                                                    <th className="p-3">Produto/Descrição</th>
                                                    <th className="p-3">OP</th>
                                                    <th className="p-3 text-right">Qtd</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                                {dayDetails.pcp.map((item) => {
                                                    const formattedQty = parseFloat(item.quantidade_pcp || 0).toLocaleString('pt-BR', { 
                                                        minimumFractionDigits: 0, 
                                                        maximumFractionDigits: 2 
                                                    });
                                                    return (
                                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-3 font-mono font-bold text-slate-800">
                                                                {item.pedido}/{item.item}
                                                            </td>
                                                            <td className="p-3 truncate max-w-[120px]" title={item.cliente_nome}>
                                                                {item.cliente_nome}
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="font-semibold text-slate-800 truncate max-w-[180px]" title={item.produto_descricao}>
                                                                    {item.produto_descricao}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 font-mono">
                                                                    {item.produto_codigo}
                                                                </div>
                                                                {item.observacao && (
                                                                    <div className="text-[10px] text-slate-500 italic mt-0.5" title={item.observacao}>
                                                                        Obs: {item.observacao}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-3 font-mono text-slate-500">
                                                                {item.op_protheus || '-'}
                                                            </td>
                                                            <td className="p-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                                                {formattedQty}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center text-slate-400 text-sm">
                                        Nenhuma previsão de PCP para este dia.
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                </div>
            ) : (
                /* WhatsApp Monitored Groups View */
                <div className="flex-1 w-full p-4 sm:p-6 flex flex-col lg:flex-row gap-6 overflow-hidden h-full">
                    {/* Left Panel: Register and Groups list */}
                    <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden h-full shrink-0">
                        <div className="shrink-0 space-y-4 mb-4">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                <MessageSquare className="w-5 h-5 text-orange-600" />
                                <h3 className="font-bold text-slate-800 text-base">Grupos Monitorados</h3>
                            </div>
                            
                            {/* Group Registration */}
                            <form onSubmit={handleRegisterWaGroup} className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Cadastrar Novo Grupo
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nome exato do grupo..."
                                        value={newWaGroupName}
                                        onChange={(e) => setNewWaGroupName(e.target.value)}
                                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-slate-50"
                                    />
                                    <button
                                        type="submit"
                                        disabled={registeringWaGroup}
                                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl transition-all duration-300 shadow hover:shadow-lg active:scale-95 disabled:bg-orange-400 shrink-0"
                                    >
                                        {registeringWaGroup ? '...' : 'Cadastrar'}
                                    </button>
                                </div>
                            </form>

                            {/* Group Search Filter */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Pesquisar grupo monitorado..."
                                    value={waGroupSearch}
                                    onChange={(e) => setWaGroupSearch(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs bg-slate-50 pl-8"
                                />
                                <ChevronRight className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 rotate-90" />
                            </div>
                        </div>

                        {/* Monitored Groups list */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                            {waLoading ? (
                                <div className="py-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                                    <RefreshCw className="w-5 h-5 animate-spin text-orange-600" />
                                    Carregando grupos...
                                </div>
                            ) : filteredWaGroups.length > 0 ? (
                                filteredWaGroups.map((g) => {
                                    const isSelected = selectedWaGroup && selectedWaGroup.id === g.id;
                                    return (
                                        <div
                                            key={g.id}
                                            onClick={() => setSelectedWaGroup(g)}
                                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group shadow-sm hover:shadow-md
                                                ${isSelected 
                                                    ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-200' 
                                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="flex-1 min-w-0 pr-2">
                                                <h4 className="font-bold text-slate-800 text-sm truncate">
                                                    {g.grupo_nome}
                                                </h4>
                                                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                                    {g.grupo_jid ? (
                                                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono text-[9px]">
                                                            {g.grupo_jid}
                                                        </span>
                                                    ) : (
                                                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold text-[8px] animate-pulse uppercase">
                                                            Aguardando JID
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteWaGroup(g.id, e)}
                                                className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 shrink-0"
                                                title="Remover do monitoramento"
                                            >
                                                <X className="w-4.5 h-4.5" />
                                            </button>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-8 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50 p-4">
                                    Nenhum grupo cadastrado para monitoramento.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel: WhatsApp Conversation Chat View */}
                    <div className="flex-1 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden h-full relative" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgb(31, 48, 59) 0%, rgb(20, 24, 30) 100%)' }}>
                        {selectedWaGroup ? (
                            <>
                                {/* Chat Header */}
                                <div className="bg-slate-800 border-b border-slate-700 px-5 py-3.5 shrink-0 flex items-center justify-between shadow-md z-10">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white text-base truncate">
                                            {selectedWaGroup.grupo_nome}
                                        </h3>
                                        <p className="text-slate-400 text-[10px] truncate mt-0.5 font-mono">
                                            JID: {selectedWaGroup.grupo_jid || 'Não resolvido'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {selectedWaGroup.grupo_jid && (
                                            <button
                                                onClick={() => setShowAiPanel(prev => !prev)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 ${showAiPanel ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'} rounded-lg text-xs font-bold transition-all shadow active:scale-95`}
                                                title="Mostrar painel do Agente de IA (Resumo e Pendências)"
                                            >
                                                <Sparkles className={`w-3.5 h-3.5 ${aiLoading || forcingAiRecalc ? 'animate-pulse text-sky-300' : ''}`} />
                                                Agente IA
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleSyncWaHistory(selectedWaGroup.grupo_nome)}
                                            disabled={syncingWaHistory || !selectedWaGroup.grupo_jid}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all shadow active:scale-95"
                                            title="Sincronizar histórico da Evolution API"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${syncingWaHistory ? 'animate-spin text-orange-500' : ''}`} />
                                            {syncingWaHistory ? 'Sincronizando...' : 'Sincronizar API'}
                                        </button>
                                    </div>
                                </div>

                                {/* AI Summary and Pendencies Panel */}
                                {selectedWaGroup.grupo_jid && showAiPanel && (
                                    <div className="bg-slate-800/95 border-b border-slate-700 p-4 md:p-5 text-slate-200 space-y-4 shrink-0 shadow-lg z-10 transition-all">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-sky-400" />
                                                <h4 className="font-bold text-sm text-white">Análise do Agente de IA (Hoje)</h4>
                                            </div>
                                            <button
                                                onClick={() => handleForceAiRecalc(selectedWaGroup.grupo_jid)}
                                                disabled={forcingAiRecalc || aiLoading}
                                                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-[11px] font-semibold transition-all"
                                                title="Forçar recálculo da análise com Gemini"
                                            >
                                                <Sparkles className={`w-3 h-3 ${forcingAiRecalc ? 'animate-spin text-sky-400' : ''}`} />
                                                {forcingAiRecalc ? 'Recalculando...' : 'Atualizar Análise'}
                                            </button>
                                        </div>

                                        {aiLoading ? (
                                            <div className="py-6 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                                                <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
                                                Analisando conversas do grupo hoje...
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Left Column: Summary */}
                                                <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-700/60">
                                                    <h5 className="text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">Resumo Executivo</h5>
                                                    <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                                                        {aiSummary || 'Sem conversas significativas analisadas hoje até o momento.'}
                                                    </p>
                                                </div>

                                                {/* Right Column: Pendencies */}
                                                <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-700/60 flex flex-col">
                                                    <div className="flex items-center gap-1.5 mb-2.5">
                                                        <ListTodo className="w-3.5 h-3.5 text-orange-400" />
                                                        <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Pendências Não Atendidas</h5>
                                                    </div>
                                                    {aiPendencies.length > 0 ? (
                                                        <div className="space-y-2 max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 pr-1">
                                                            {aiPendencies.map((p, idx) => (
                                                                <label key={idx} className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:bg-slate-800/80 transition-colors cursor-pointer group">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={p.completed}
                                                                        onChange={() => {
                                                                            setAiPendencies(prev => prev.map((item, i) => i === idx ? { ...item, completed: !item.completed } : item));
                                                                        }}
                                                                        className="mt-0.5 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-800 w-3.5 h-3.5 transition-colors"
                                                                    />
                                                                    <span className={`text-[11px] leading-tight select-none ${p.completed ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                                                        {p.text}
                                                                    </span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="my-auto py-4 text-center text-[11px] text-slate-400">
                                                            ✅ Nenhuma pendência não atendida identificada hoje!
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Chat Messages Feed */}
                                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 flex flex-col scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                    {waMessagesLoading ? (
                                        <div className="my-auto py-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
                                            Carregando mensagens do grupo...
                                        </div>
                                    ) : groupedWaMessages.length > 0 ? (
                                        groupedWaMessages.map((group, groupIdx) => (
                                            <div key={groupIdx} className="space-y-4">
                                                {/* Date divider */}
                                                <div className="flex justify-center">
                                                    <span className="bg-slate-800/90 text-slate-300 text-[9px] font-bold px-3 py-1 rounded-full shadow border border-slate-700/50 uppercase tracking-wider">
                                                        {group.label}
                                                    </span>
                                                </div>
                                                
                                                {/* Messages inside group */}
                                                <div className="space-y-3">
                                                    {group.messages.map((msg, msgIdx) => {
                                                        const phoneDigits = parseInt(msg.remetente_fone?.slice(-4)) || 0;
                                                        const colors = [
                                                            'bg-emerald-600', 'bg-sky-600', 'bg-blue-600', 
                                                            'bg-amber-600', 'bg-orange-600', 
                                                            'bg-rose-600', 'bg-teal-600', 'bg-slate-600'
                                                        ];
                                                        const avatarColor = colors[phoneDigits % colors.length];
                                                        const initials = msg.remetente_nome
                                                            ? msg.remetente_nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                                                            : 'U';
                                                        
                                                        const timestamp = msg.recebido_em
                                                            ? new Date(msg.recebido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                                            : '';

                                                        return (
                                                            <div key={msg.id || msgIdx} className="flex items-start gap-2.5 max-w-[85%] sm:max-w-[70%]">
                                                                {/* Sender Avatar */}
                                                                <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-[11px] font-black shadow shrink-0 select-none`}>
                                                                    {initials}
                                                                </div>

                                                                {/* Message Bubble */}
                                                                <div className="bg-slate-800 text-slate-100 rounded-2xl rounded-tl-none px-3.5 py-2 shadow-md border border-slate-700/40 relative flex flex-col min-w-[120px]">
                                                                    {/* Sender Name */}
                                                                    <span className="text-[10px] font-bold text-orange-400 mb-0.5">
                                                                        {msg.remetente_nome || 'Desconhecido'}{' '}
                                                                        <span className="text-slate-400 font-normal">
                                                                            ({msg.remetente_fone || 'S/N'})
                                                                        </span>
                                                                    </span>

                                                                    {/* Image or Text Content */}
                                                                    {msg.tipo_midia === 'image' && msg.midia_url ? (
                                                                        <div className="flex flex-col gap-1.5 mt-1">
                                                                            <img
                                                                                src={`/uploads/whatsapp/${msg.midia_url}${localStorage.getItem('token') || localStorage.getItem('@Lynx:token') ? `?token=${localStorage.getItem('token') || localStorage.getItem('@Lynx:token')}` : ''}`}
                                                                                alt="Mídia recebida"
                                                                                onClick={() => setLightboxImage(`/uploads/whatsapp/${msg.midia_url}${localStorage.getItem('token') || localStorage.getItem('@Lynx:token') ? `?token=${localStorage.getItem('token') || localStorage.getItem('@Lynx:token')}` : ''}`)}
                                                                                className="max-w-full max-h-60 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-all border border-slate-700 shadow"
                                                                            />
                                                                            {msg.mensagem && msg.mensagem !== '[Imagem]' && msg.mensagem !== '[Mídia ou Mensagem Vazia]' && (
                                                                                <p className="text-xs leading-relaxed text-slate-200 break-words font-medium mt-1">
                                                                                    {msg.mensagem}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs leading-relaxed text-slate-100 break-words whitespace-pre-wrap font-medium">
                                                                            {msg.mensagem}
                                                                        </p>
                                                                    )}

                                                                    {/* Time */}
                                                                    <span className="text-[8px] text-slate-400 font-medium text-right self-end mt-1.5">
                                                                        {timestamp}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="my-auto py-12 text-center text-slate-400 text-sm">
                                            Nenhuma mensagem recebida para este grupo ainda.
                                        </div>
                                    )}
                                    <div ref={waMessagesEndRef} />
                                </div>
                            </>
                        ) : (
                            /* Empty State when no group is selected */
                            <div className="m-auto flex flex-col items-center justify-center p-8 text-center max-w-sm select-none">
                                <div className="w-16 h-16 bg-slate-800/80 border border-slate-700/50 rounded-2xl flex items-center justify-center shadow-lg mb-4 text-slate-500">
                                    <MessageSquare className="w-8 h-8 text-orange-500 animate-pulse" />
                                </div>
                                <h4 className="text-white font-bold text-base">Selecione um Grupo</h4>
                                <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                                    Selecione um grupo da lista lateral para monitorar as mensagens e mídias recebidas em tempo real.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal for Creating Activity */}
            {showModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform scale-100 transition-all duration-300">
                        {/* Header */}
                        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-orange-400" />
                                Agendar Nova Atividade
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleCreateActivity} className="p-6 space-y-4">
                            {/* Target User */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Destinatários / Responsáveis
                                </label>
                                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                                    {/* Search filter */}
                                    <input
                                        type="text"
                                        placeholder="Filtrar usuários..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-xs text-slate-800"
                                    />
                                    
                                    {/* Quick select buttons */}
                                    <div className="flex gap-2 text-[11px] font-bold">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedUserIds([user?.id])}
                                            className="text-orange-600 hover:text-orange-700 transition-colors"
                                        >
                                            Apenas Eu
                                        </button>
                                        <span className="text-slate-300">|</span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedUserIds(users.map(u => u.idUsuario))}
                                            className="text-orange-600 hover:text-orange-700 transition-colors"
                                        >
                                            Selecionar Todos
                                        </button>
                                        <span className="text-slate-300">|</span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedUserIds([])}
                                            className="text-slate-500 hover:text-slate-600 transition-colors"
                                        >
                                            Limpar
                                        </button>
                                    </div>

                                    {/* Scrollable list */}
                                    <div className="max-h-40 overflow-y-auto border border-slate-200/65 rounded-lg bg-white divide-y divide-slate-100">
                                        {/* Show myself option first if it matches filter */}
                                        {(!searchTerm || 'para mim mesmo'.includes(searchTerm.toLowerCase()) || user?.nome?.toLowerCase().includes(searchTerm.toLowerCase())) && (
                                            <label className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer select-none text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUserIds.includes(user?.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedUserIds(prev => [...prev, user?.id]);
                                                        } else {
                                                            setSelectedUserIds(prev => prev.filter(id => id !== user?.id));
                                                        }
                                                    }}
                                                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                                                />
                                                <div className="font-semibold text-slate-800 flex justify-between w-full items-center">
                                                    <span>Para mim mesmo ({user?.nome})</span>
                                                    <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-bold uppercase">Autor</span>
                                                </div>
                                            </label>
                                        )}

                                        {filteredUsers
                                            .filter(u => u.idUsuario !== user?.id)
                                            .map(u => (
                                                <label key={u.idUsuario} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer select-none text-xs">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUserIds.includes(u.idUsuario)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedUserIds(prev => [...prev, u.idUsuario]);
                                                            } else {
                                                                setSelectedUserIds(prev => prev.filter(id => id !== u.idUsuario));
                                                            }
                                                        }}
                                                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                                                    />
                                                    <span className="font-medium text-slate-700">
                                                        {u.NomeCompleto} <span className="text-slate-400">({u.Login})</span>
                                                    </span>
                                                </label>
                                            ))
                                        }
                                    </div>
                                    
                                    {/* Selected count badge */}
                                    <div className="text-[10px] font-bold text-slate-400 text-right">
                                        {selectedUserIds.length} {selectedUserIds.length === 1 ? 'destinatário selecionado' : 'destinatários selecionados'}
                                    </div>
                                </div>
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Data da Atividade
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={newActivity.data_atividade}
                                    onChange={(e) => setNewActivity(prev => ({ ...prev, data_atividade: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Descrição da Atividade
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="Digite os detalhes da atividade..."
                                    value={newActivity.texto}
                                    onChange={(e) => setNewActivity(prev => ({ ...prev, texto: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm placeholder-slate-400 leading-relaxed"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="pt-2 flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 text-sm font-semibold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-400 text-white text-sm font-bold rounded-xl transition-all duration-300 shadow hover:shadow-lg active:scale-95 flex items-center gap-2"
                                >
                                    {creating ? 'Salvando...' : 'Salvar Atividade'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal for Group Status Confirmation */}
            {statusConfirm && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-orange-500 animate-pulse" />
                            Atualizar Status do Grupo
                        </h3>
                        <p className="text-slate-600 text-xs leading-relaxed">
                            Esta atividade está atribuída a outros usuários. Deseja marcar como concluída apenas para você ou para todos os participantes de uma vez?
                        </p>
                        <div className="flex flex-col gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => handleConfirmStatus(false)}
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                            >
                                Apenas para Mim
                            </button>
                            <button
                                type="button"
                                onClick={() => handleConfirmStatus(true)}
                                className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition-all shadow"
                            >
                                Para Todos os Usuários
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusConfirm(null)}
                                className="w-full py-2.5 border border-slate-200 text-slate-400 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Lightbox for WhatsApp images */}
            {lightboxImage && (
                <div 
                    className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in"
                    onClick={() => setLightboxImage(null)}
                >
                    <button 
                        className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition-all"
                        onClick={() => setLightboxImage(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img 
                        src={lightboxImage} 
                        alt="Visualização expandida" 
                        className="max-w-[95vw] max-h-[95vh] rounded-lg shadow-2xl object-contain border border-slate-800"
                    />
                </div>
            )}
        </div>
    );
}
