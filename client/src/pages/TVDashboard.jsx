import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Clock, Factory, AlertTriangle, ArrowRight, Loader2, Check, Settings } from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { toast } from 'react-toastify';
import logo from '../assets/metalfisa-logo.png';

// Auxiliares de conversão de tempo
function hhmmssToSeconds(str) {
    if (!str) return 0;
    const parts = str.split(':');
    const hrs = parseInt(parts[0]) || 0;
    const mins = parseInt(parts[1]) || 0;
    const secs = parseInt(parts[2]) || 0;
    return (hrs * 3600) + (mins * 60) + secs;
}

function formatHoursMinutes(totalSecs) {
    if (isNaN(totalSecs) || totalSecs <= 0) return '0 min';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (hrs > 0) {
        return `${hrs}h ${mins}m`;
    }
    return `${mins} min`;
}

const getFotoUrl = (pathObj) => {
    if (!pathObj) return null;
    const path = typeof pathObj === 'object' ? (pathObj.data || pathObj.url || '') : pathObj;
    if (!path || typeof path !== 'string') return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = api.defaults.baseURL ? api.defaults.baseURL.replace('/api', '') : '';
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
};

export default function TVDashboard() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [lastUpdated, setLastUpdated] = useState(new Date());
    
     // Estados para Carga de Corte
    const [maquinasCorte, setMaquinasCorte] = useState([]);
    const [programasCorte, setProgramasCorte] = useState([]);
    const [loadingCorte, setLoadingCorte] = useState(true);
    const [cortePage, setCortePage] = useState(0);

    // Configurações do Carrossel / Rotação
    const [currentPage, setCurrentPage] = useState(0);
    const [rotationSpeed, setRotationSpeed] = useState(() => {
        const saved = localStorage.getItem('tv_rotation_speed');
        return saved ? parseInt(saved, 10) : 900000;
    });

    const itemsPerPage = 3; // 3 itens por página para caber perfeitamente

    // Atualização do Relógio (segundo a segundo)
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Buscar prioridades da API
    const fetchPriorities = async () => {
        try {
            setLoading(true);
            const res = await api.get('/ata-viva/prioridades-tv');
            if (res.data?.data) {
                const pendingTasks = res.data.data.filter(t => t.status === 'PENDENTE');
                setTasks(pendingTasks);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error('Erro ao buscar prioridades:', error);
        } finally {
            setLoading(false);
        }
    };

    // Buscar dados de corte das máquinas
    const fetchCorteData = async () => {
        try {
            setLoadingCorte(true);
            const resMaquinas = await api.get('/manutencao/maquinas');
            const resProgramas = await api.get('/pcp/programas/maquina/all');

            if (resMaquinas.data && resProgramas.data) {
                // Filtrar apenas máquinas ativas cujo nome contenha "laser" ou "corte"
                const lasers = resMaquinas.data.filter(m => 
                    m.status === 'ATIVO' && 
                    (m.nome.toLowerCase().includes('laser') || m.nome.toLowerCase().includes('corte'))
                );
                
                setMaquinasCorte(lasers);
                setProgramasCorte(resProgramas.data);
            }
        } catch (error) {
            console.error('Erro ao buscar dados de carga de corte:', error);
        } finally {
            setLoadingCorte(false);
        }
    };

    // Inicialização e Sockets em tempo real
    useEffect(() => {
        fetchPriorities();
        fetchCorteData();

        // Refresh de backup a cada 15 minutos
        const interval = setInterval(() => {
            fetchPriorities();
            fetchCorteData();
        }, 900000);

        // Inicializar socket em tempo real
        const socket = io(window.location.origin, {
            transports: ['websocket', 'polling']
        });

        // Ouvir atualizações de prioridades
        socket.on('tv:prioridades_atualizadas', () => {
            console.log('⚡ Sockets: Prioridades atualizadas no painel');
            fetchPriorities();
        });

        // Ouvir alertas gerais do Hermes
        socket.on('hermes_feed_message', () => {
            console.log('⚡ Sockets: Mensagem Hermes recebida, atualizando painel');
            fetchPriorities();
        });

        // Ouvir atualizações de programas CNC
        socket.on('tv:programas_atualizados', () => {
            console.log('⚡ Sockets: Programas CNC atualizados no painel');
            fetchCorteData();
        });

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, []);

    // Total de páginas no carrossel
    const totalPages = useMemo(() => {
        return Math.ceil(tasks.length / itemsPerPage);
    }, [tasks]);

    // Rotação automática de página (Prioridades e Fila de Corte)
    useEffect(() => {
        const timer = setInterval(() => {
            if (totalPages > 1) {
                setCurrentPage(prev => (prev + 1) % totalPages);
            } else {
                setCurrentPage(0);
            }
            // Rotaciona a página da fila de corte a cada tick
            setCortePage(prev => prev + 1);
        }, rotationSpeed);

        return () => clearInterval(timer);
    }, [totalPages, rotationSpeed]);

    // Ajustar página atual caso o número total de páginas reduza
    useEffect(() => {
        if (currentPage >= totalPages && totalPages > 0) {
            setCurrentPage(totalPages - 1);
        }
    }, [totalPages, currentPage]);

    // Fatiar itens da página atual
    const currentTasks = useMemo(() => {
        const start = currentPage * itemsPerPage;
        return tasks.slice(start, start + itemsPerPage);
    }, [tasks, currentPage]);

    // Estrutura Flat de Páginas para Máquinas de Corte (Opção 1)
    const flatPages = useMemo(() => {
        const pages = [];
        const LIMIT = 5; // Limite de 5 programas por página para evitar scroll na TV

        maquinasCorte.forEach(maquina => {
            // Filtrar programas pendentes da máquina
            const progsDaMaquina = programasCorte
                .filter(p => p.maquina_id === maquina.id && p.status !== 'CONCLUIDO')
                .sort((a, b) => {
                    const ordA = !a.ordem_execucao ? 999999 : parseInt(a.ordem_execucao, 10);
                    const ordB = !b.ordem_execucao ? 999999 : parseInt(b.ordem_execucao, 10);
                    if (ordA !== ordB) {
                        return ordA - ordB;
                    }
                    return b.id - a.id;
                });

            let cumulativeTimeSecs = 0;
            const progsWithAccumulatedTime = progsDaMaquina.map((prog) => {
                const concluidas = parseInt(prog.chapas_concluidas) || 0;
                const total = parseInt(prog.quantidade_vezes) || 1;
                const restante = Math.max(0, total - concluidas);
                const tempoChapaSecs = hhmmssToSeconds(prog.tempo_previsto);
                const progRestanteSecs = restante * tempoChapaSecs;
                
                cumulativeTimeSecs += progRestanteSecs;
                return {
                    ...prog,
                    restante,
                    progRestanteSecs,
                    tempoAcumuladoSegundos: cumulativeTimeSecs
                };
            });

            const totalTempoSegundos = cumulativeTimeSecs;
            const totalChapasTotal = progsDaMaquina.reduce((sum, p) => sum + (parseInt(p.quantidade_vezes) || 1), 0);
            const totalChapasConcluidas = progsDaMaquina.reduce((sum, p) => sum + (parseInt(p.chapas_concluidas) || 0), 0);
            const totalChapasRestantes = Math.max(0, totalChapasTotal - totalChapasConcluidas);

            const numPages = Math.max(1, Math.ceil(progsDaMaquina.length / LIMIT));
            for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
                const start = pageIndex * LIMIT;
                const paginatedProgs = progsWithAccumulatedTime.slice(start, start + LIMIT);
                
                pages.push({
                    maquina,
                    pageIndex,
                    totalPages: numPages,
                    programas: paginatedProgs,
                    todosProgramas: progsWithAccumulatedTime,
                    totalProgramas: progsDaMaquina.length,
                    totalChapasTotal,
                    totalChapasConcluidas,
                    totalChapasRestantes,
                    totalTempoSegundos
                });
            }
        });

        return pages;
    }, [maquinasCorte, programasCorte]);

    const activePageIndex = flatPages.length > 0 ? cortePage % flatPages.length : 0;
    const activePage = flatPages[activePageIndex];

    // Manipular redefinição de velocidade de rotação
    const handleSpeedChange = (e) => {
        const newSpeed = parseInt(e.target.value, 10);
        setRotationSpeed(newSpeed);
        localStorage.setItem('tv_rotation_speed', String(newSpeed));
        setCurrentPage(0);
        toast.info(`Velocidade de rotação alterada para ${newSpeed === 900000 ? '15 minutos' : newSpeed / 1000 + ' segundos'}.`);
    };

    // Concluir prioridade (faz sumir da tela instantaneamente)
    const handleConcluir = async (id, pedido, produto) => {
        if (!window.confirm(`Confirma a conclusão da prioridade para o pedido ${pedido} - ${produto}?`)) {
            return;
        }

        try {
            const payload = {
                status: 'CONCLUIDO',
                usuario: 'Painel TV'
            };
            
            await api.put(`/ata-viva/tarefas/${id}/status`, payload);
            toast.success('Prioridade concluída com sucesso!');
            setTasks(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            console.error('Erro ao atualizar status:', err);
            toast.error('Erro ao concluir tarefa.');
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden flex flex-col selection:bg-indigo-500/30">
            
            {/* TV Header - Mantendo cores padrão Metalfisa */}
            <header className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between shrink-0 shadow-2xl z-10">
                <div className="flex items-center gap-6">
                    <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800/80 flex flex-col items-center justify-center shadow-inner relative group">
                        <img src={logo} alt="Metalfisa Logo" className="h-10 w-auto object-contain" />
                        <span className="text-[8px] font-black tracking-widest text-slate-500 uppercase mt-0.5 select-none">
                            by Lynx
                        </span>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                            PAINEL DE PRODUÇÃO
                            <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm uppercase tracking-widest font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                Prioridades PCP
                            </span>
                        </h1>
                        <p className="text-slate-400 font-medium text-sm mt-0.5 flex items-center gap-2">
                            Monitoramento em Tempo Real do Chão de Fábrica
                            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                        </p>
                    </div>
                </div>

                {/* Controles de Rotação do Carrossel e Relógio */}
                <div className="flex items-center gap-6">
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
                            <span className="text-slate-500 font-bold flex items-center gap-1">
                                <Settings size={12} /> Rotação:
                            </span>
                            <select
                                aria-label="Velocidade de Rotação"
                                value={rotationSpeed}
                                onChange={handleSpeedChange}
                                className="bg-transparent text-slate-300 font-bold border-none outline-none cursor-pointer"
                            >
                                <option value="15000">15 seg</option>
                                <option value="30000">30 seg</option>
                                <option value="60000">1 min</option>
                                <option value="300000">5 min</option>
                                <option value="900000">15 min</option>
                            </select>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex gap-1.5 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                            {Array.from({ length: totalPages }).map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentPage(i)}
                                    className={`w-3.5 h-2 rounded-full transition-all duration-300 ${
                                        i === currentPage 
                                        ? 'bg-indigo-500 w-6' 
                                        : 'bg-slate-700 hover:bg-slate-500'
                                    }`}
                                />
                            ))}
                        </div>
                    )}
                    
                    {/* Horário da Fábrica */}
                    <div className="flex flex-col items-end shrink-0">
                        <div className="text-3xl font-black text-indigo-400 tracking-tighter tabular-nums drop-shadow-md leading-none">
                            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold mt-1">
                            <Clock className="w-3 h-3" />
                            Atualizado: {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area - Layout Dividido (2/3 e 1/3) */}
            <main className="flex-1 p-6 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 flex gap-6">
                
                {/* Lado Esquerdo - Prioridades PCP (2/3 da largura) */}
                <div className="w-2/3 flex flex-col justify-center h-full">
                    {tasks.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 animate-in fade-in duration-700">
                            <div className="w-20 h-20 mb-4 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
                                <CheckCircle2 className="w-10 h-10 text-slate-700" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-400">Nenhuma prioridade na fila</h2>
                            <p className="text-sm mt-1 text-slate-600">A produção está operando dentro da normalidade.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 flex-1 justify-center py-2">
                            {currentTasks.map((task, idx) => {
                                const evo = task.evolucao_op || 0;
                                const isComplete = evo >= 100;
                                
                                return (
                                    <div 
                                        key={task.id} 
                                        className="bg-slate-900/95 border border-slate-800/80 rounded-xl p-5 shadow-lg flex items-stretch gap-6 animate-in slide-in-from-bottom-6 fade-in duration-500 hover:border-indigo-500/30 transition-all hover:bg-slate-900"
                                        style={{ animationFillMode: 'both', animationDelay: `${idx * 80}ms` }}
                                    >
                                        {/* Left Info Column */}
                                        <div className="flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/50 pb-3 mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <span className="px-3 py-1 bg-indigo-950 text-indigo-300 rounded-lg text-base font-black tracking-wider border border-indigo-500/25 shadow-inner">
                                                            PEDIDO: {task.pedido || 'S/PED'}
                                                        </span>
                                                        <span className="px-3 py-1 bg-amber-950/40 text-amber-400 rounded-lg text-sm font-black tracking-wide border border-amber-500/20">
                                                            CLIENTE: {task.cliente_nome ? task.cliente_nome.toUpperCase() : 'METALFISA'}
                                                        </span>
                                                        {task.op_numero && (
                                                            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold border border-slate-700/40">
                                                                OP: {task.op_numero}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-slate-500 text-[10px] font-bold flex items-center gap-1">
                                                        Solicitado: {formatDate(task.criado_em)}
                                                    </span>
                                                </div>
                                                
                                                <h3 className="text-xl font-black text-white mt-1 mb-2 tracking-tight leading-none">
                                                    {task.produto}
                                                </h3>
                                                
                                                {task.texto_tarefa && (
                                                    <div className="mt-2 flex items-start gap-2 bg-red-500/5 border border-red-500/15 rounded-lg p-2.5">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                                        <p className="text-xs text-red-200/90 font-semibold leading-snug">
                                                            {task.texto_tarefa.replace('[PRIORIDADE MÁXIMA]', '').replace('[PRIORIDADE]', '').trim()}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Status Column */}
                                        <div className="w-[300px] shrink-0 flex flex-col justify-between pl-6 border-l border-slate-800/60 relative">
                                            <div className="flex-1 flex flex-col justify-center">
                                                <div className="flex justify-between items-end mb-1">
                                                    <span className="text-slate-400 font-bold tracking-wide uppercase text-[9px]">
                                                        Evolução da Produção
                                                    </span>
                                                    <span className={`text-2xl font-black tabular-nums tracking-tighter drop-shadow-lg ${isComplete ? 'text-emerald-400' : 'text-white'}`}>
                                                        {evo.toFixed(1)}%
                                                    </span>
                                                </div>
                                                
                                                {/* Progress Bar Container */}
                                                <div className="h-5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner relative">
                                                    <div 
                                                        className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out flex items-center justify-end pr-2 ${
                                                            isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-600 to-indigo-500'
                                                        }`}
                                                        style={{ width: `${evo}%` }}
                                                    >
                                                        <div className="w-full h-full absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.15)_50%,transparent_75%)] bg-[length:15px_15px] animate-[slide_1s_linear_infinite]" />
                                                    </div>
                                                </div>
                                                
                                                <div className="flex justify-between items-center mt-1 text-slate-500 text-[10px] font-semibold">
                                                    <span>{parseFloat(task.saldo_produzido || 0).toFixed(2)} Und</span>
                                                    <ArrowRight className="w-3 h-3 opacity-30" />
                                                    <span>{parseFloat(task.op_qtd || 0).toFixed(2)} Und Total</span>
                                                </div>
                                            </div>

                                            {/* Action Button */}
                                            <button 
                                                onClick={() => handleConcluir(task.id, task.pedido, task.produto)}
                                                className="mt-3 w-full py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-300 border active:scale-[0.98] focus:outline-none bg-slate-800 border-slate-700 text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 group"
                                            >
                                                <Check className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                                Marcar como Concluído
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Lado Direito - Carga/Sequência Corte (1/3 da largura) */}
                <div className="w-1/3 flex flex-col bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 shadow-lg overflow-hidden h-full">
                    {/* Header da Seção */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 tracking-tight uppercase">
                            <Factory className="w-5 h-5 text-indigo-400" />
                            Carga/Sequencia
                        </h2>
                    </div>

                    <div className="flex-1 overflow-hidden h-full flex flex-col">
                        {loadingCorte ? (
                            <div className="flex-grow flex flex-col items-center justify-center text-slate-500 py-10">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
                                <span className="text-xs font-semibold">Carregando fila de corte...</span>
                            </div>
                        ) : flatPages.length === 0 ? (
                            <div className="flex-grow flex flex-col items-center justify-center text-slate-600 py-10">
                                <span className="text-xs font-semibold">Nenhuma máquina de corte ativa.</span>
                            </div>
                        ) : (
                            (() => {
                                const {
                                    maquina,
                                    pageIndex,
                                    totalPages: totalMachinePages,
                                    programas,
                                    totalProgramas,
                                    totalChapasTotal,
                                    totalChapasConcluidas,
                                    totalChapasRestantes,
                                    totalTempoSegundos
                                } = activePage;

                                const LIMIT = 5;

                                // Mapeamento de Status Operacional
                                let statusText = 'OPERANDO';
                                let statusColorClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                                let pulseBg = 'bg-emerald-500';

                                if (maquina.status_operacional === 'EM_MANUTENCAO') {
                                    statusText = 'MANUTENÇÃO';
                                    statusColorClass = 'bg-red-500/20 text-red-400 border-red-500/30';
                                    pulseBg = 'bg-red-500';
                                } else if (maquina.status_operacional === 'AGUARDANDO_MANUTENCAO') {
                                    statusText = 'AG. MANUTENÇÃO';
                                    statusColorClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                                    pulseBg = 'bg-amber-500';
                                }

                                const hasPhoto = maquina.fotos && maquina.fotos.length > 0;

                                return (
                                    <div className="flex-grow flex flex-col overflow-hidden h-full animate-in fade-in duration-300">
                                        {/* Detalhes da Máquina Ativa */}
                                        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800/60 shrink-0">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2.5">
                                                    <h3 className="text-xl font-black text-white leading-tight uppercase tracking-tight truncate" title={maquina.nome}>
                                                        {maquina.nome.replace('Laser - ', '').replace('Corte - ', '')}
                                                    </h3>
                                                    {totalMachinePages > 1 && (
                                                        <span className="text-[10px] text-indigo-300 font-black bg-indigo-950/65 px-2 py-0.5 rounded border border-indigo-500/25 shrink-0 uppercase tracking-wider">
                                                            Pág. {pageIndex + 1}/{totalMachinePages}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border flex items-center gap-1.5 shrink-0 ${statusColorClass}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${pulseBg} animate-pulse`} />
                                                        {statusText}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Foto da Máquina ou Fallback */}
                                            <div className="shrink-0">
                                                {hasPhoto ? (
                                                    <img 
                                                        src={getFotoUrl(maquina.fotos[0])} 
                                                        alt={maquina.nome} 
                                                        className="w-24 h-16 object-cover rounded-xl border border-slate-800 shadow-md"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div 
                                                    className="w-24 h-16 bg-slate-950 flex items-center justify-center rounded-xl border border-slate-800 text-slate-500 shadow-inner"
                                                    style={{ display: hasPhoto ? 'none' : 'flex' }}
                                                >
                                                    <Factory className="w-7 h-7 text-slate-600" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Alerta de Máquina Parada com Motivo */}
                                        {(maquina.status_operacional === 'EM_MANUTENCAO' || maquina.status_operacional === 'AGUARDANDO_MANUTENCAO') && (
                                            <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2.5 shrink-0 animate-in slide-in-from-top-3 duration-300">
                                                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none">Equipamento Parado</h4>
                                                    <p className="text-xs text-red-200/90 font-semibold leading-relaxed mt-1 truncate" title={maquina.motivo_parada}>
                                                        Motivo: {maquina.motivo_parada || 'Manutenção Corretiva'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Barra de Progresso Geral da Máquina */}
                                        {totalChapasTotal > 0 && (
                                            <div className="mt-4 shrink-0">
                                                <div className="flex justify-between items-end mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <span>Progresso da Fila</span>
                                                    <span className="text-white font-black">{Math.round((totalChapasConcluidas / totalChapasTotal) * 100)}%</span>
                                                </div>
                                                <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80 shadow-inner relative">
                                                    <div 
                                                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-1000 ease-out rounded-full"
                                                        style={{ width: `${(totalChapasConcluidas / totalChapasTotal) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* KPIs Rápidos (Métricas) */}
                                        <div className="grid grid-cols-3 gap-2.5 mt-4 shrink-0">
                                            <div className="bg-slate-950/60 border border-slate-800/40 rounded-xl p-2.5 flex flex-col justify-center shadow-inner">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Fila</span>
                                                <span className="text-sm font-black text-white leading-none mt-1">{totalProgramas} prog.</span>
                                            </div>
                                            <div className="bg-slate-950/60 border border-slate-800/40 rounded-xl p-2.5 flex flex-col justify-center shadow-inner">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Pendente</span>
                                                <span className="text-sm font-black text-white leading-none mt-1">{totalChapasRestantes} ch.</span>
                                            </div>
                                            <div className="bg-slate-950/60 border border-slate-800/40 rounded-xl p-2.5 flex flex-col justify-center shadow-inner">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Tempo Fila</span>
                                                <span className="text-sm font-black text-amber-400 leading-none mt-1">{formatHoursMinutes(totalTempoSegundos)}</span>
                                            </div>
                                        </div>

                                        {/* Lista de Programas CNC da Página */}
                                        <div className="flex-1 overflow-hidden space-y-2 mt-4 pb-2">
                                            {programas.length === 0 ? (
                                                <div className="text-xs text-slate-500 italic py-8 text-center bg-slate-950/20 border border-dashed border-slate-800 rounded-xl">
                                                    Sem fila de programas cadastrada
                                                </div>
                                            ) : (
                                                programas.map((prog, idx) => {
                                                    const concluidas = prog.chapas_concluidas || 0;
                                                    const totalChapas = prog.quantidade_vezes || 1;
                                                    const emAndamento = prog.chapas_em_andamento || 0;
                                                    const isExec = prog.status === 'EM_EXECUCAO' || emAndamento > 0;
                                                    const isMontagem = prog.status === 'EM_MONTAGEM';
                                                    const globalIdx = (pageIndex * LIMIT) + idx + 1;

                                                    return (
                                                        <div 
                                                            key={prog.id}
                                                            className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-2 relative overflow-hidden ${
                                                                isExec 
                                                                ? 'bg-indigo-950/25 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.04)] ring-1 ring-indigo-500/20'
                                                                : isMontagem
                                                                    ? 'bg-orange-950/15 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,_0.04)] ring-1 ring-orange-500/20'
                                                                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700/80'
                                                            }`}
                                                        >
                                                            {/* Topo do Card */}
                                                            <div className="flex justify-between items-start gap-1.5">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className="w-5 h-5 bg-slate-800 text-[10px] font-black text-slate-300 flex items-center justify-center rounded-lg border border-slate-700/85 shrink-0 shadow-inner">
                                                                        {globalIdx}
                                                                    </span>
                                                                    <span className="font-black text-sm text-slate-200 tracking-tight truncate" title={prog.nome_programa}>
                                                                        {prog.nome_programa}
                                                                    </span>
                                                                </div>
                                                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border shrink-0 ${
                                                                    isExec ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' :
                                                                    isMontagem ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                                                    'bg-slate-800/60 text-slate-400 border-slate-700/50'
                                                                }`}>
                                                                    {isExec ? 'CORTE' : isMontagem ? 'MONT' : 'FILA'}
                                                                </span>
                                                            </div>

                                                            {/* Detalhes de Progresso Interno */}
                                                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                                                                <span className="truncate text-slate-400 font-semibold">{prog.tipo_material}</span>
                                                                <span className="font-extrabold text-slate-200 shrink-0">{concluidas}/{totalChapas} ch</span>
                                                            </div>
                                                            <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                                                                <div 
                                                                    className={`h-full rounded-full ${isExec ? 'bg-indigo-500' : isMontagem ? 'bg-orange-500' : 'bg-slate-700'}`}
                                                                    style={{ width: `${(concluidas / totalChapas) * 100}%` }}
                                                                />
                                                            </div>

                                                            {/* Acumulado e Operador */}
                                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-900/60 mt-1">
                                                                <span className="text-[10px] font-bold text-slate-500">
                                                                    Acumulado: <span className="text-amber-400 font-extrabold">{formatHoursMinutes(prog.tempoAcumuladoSegundos)}</span>
                                                                </span>

                                                                {isExec && prog.usuario_execucao && (
                                                                    <div className="flex items-center gap-1.5 shrink-0 bg-indigo-950/40 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                                                                        <div className="relative w-4 h-4 rounded-full overflow-hidden border border-indigo-500/30 flex items-center justify-center bg-indigo-950 shrink-0">
                                                                            {prog.usuario_foto ? (
                                                                                <img 
                                                                                    src={getFotoUrl(prog.usuario_foto)} 
                                                                                    alt={prog.usuario_execucao} 
                                                                                    className="w-full h-full object-cover absolute inset-0"
                                                                                    onError={(e) => {
                                                                                        e.target.style.display = 'none';
                                                                                    }}
                                                                                />
                                                                            ) : null}
                                                                            <span className="text-[7px] font-black text-indigo-300 select-none">
                                                                                {prog.usuario_execucao.substring(0, 2).toUpperCase()}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-[9px] font-bold text-indigo-300 truncate max-w-[80px]" title={prog.usuario_execucao}>
                                                                            {prog.usuario_execucao.split(' ')[0]}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                );
                            })()
                        )}
                    </div>
                </div>
            </main>

            {/* Rodapé do Painel */}
            {totalPages > 1 && (
                <footer className="bg-slate-900 border-t border-slate-800 px-8 py-2 flex justify-between items-center text-xs text-slate-500 shrink-0 select-none">
                    <div>
                        Mostrando página <strong>{currentPage + 1}</strong> de <strong>{totalPages}</strong> (Exibindo {currentTasks.length} de {tasks.length} prioridades pendentes)
                    </div>
                    <div className="italic font-medium">
                        * Pressione "F11" para colocar o painel em Tela Cheia no monitor da fábrica.
                    </div>
                </footer>
            )}

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes slide {
                    from { background-position: 0 0; }
                    to { background-position: 30px 0; }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(15, 23, 42, 0.05);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(148, 163, 184, 0.2);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(99, 102, 241, 0.4);
                }
            `}} />
        </div>
    );
}
