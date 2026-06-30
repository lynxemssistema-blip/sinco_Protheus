import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Clock, Factory, AlertTriangle, Check, Settings, Loader2 } from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { toast } from 'react-toastify';
import logo from '../assets/metalfisa-logo.png';

// Auxiliar para formatação segura de data sem timezone offset (PCP)
const formatPcpDate = (dateVal) => {
    if (!dateVal) return '';
    try {
        const dateStr = typeof dateVal === 'string' ? dateVal.split('T')[0] : new Date(dateVal).toISOString().split('T')[0];
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    } catch (e) {
        return new Date(dateVal).toLocaleDateString('pt-BR');
    }
};

export default function TVDashboard() {
    const [tasks, setTasks] = useState([]); // Prioridades Ata Viva
    const [pcpTasks, setPcpTasks] = useState([]); // PCP Cronograma
    const [maquinas, setMaquinas] = useState([]); // Carga Maquinas
    const [activeRightPanel, setActiveRightPanel] = useState('pcp'); // 'pcp' ou 'carga'
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [lastUpdated, setLastUpdated] = useState(new Date());
    
    // Configurações de Rotação
    // Configurações de Rotação
    const [currentPage, setCurrentPage] = useState(0);
    const [currentPcpPage, setCurrentPcpPage] = useState(0);
    const [currentMaquinaPage, setCurrentMaquinaPage] = useState(0);
    const [rotationSpeed, setRotationSpeed] = useState(() => {
        const saved = localStorage.getItem('tv_rotation_speed');
        return saved ? parseInt(saved, 10) : 15000; // Padrão: 15s para TV
    });

    const itemsPerPage = 3; // 3 itens por página para visualização perfeita na TV

    // Atualização do Relógio
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Buscar prioridades e PCP da API
    const fetchPriorities = async () => {
        try {
            setLoading(true);
            const [res, resCarga] = await Promise.all([
                api.get('/ata-viva/prioridades-tv'),
                api.get('/ata-viva/carga-maquinas-tv').catch(() => ({ data: { success: false } }))
            ]);
            
            if (res.data?.success) {
                setTasks(res.data.prioridades || []);
                setPcpTasks(res.data.pcp || []);
                setLastUpdated(new Date());
            }
            if (resCarga.data?.success) {
                setMaquinas(resCarga.data.maquinas || []);
            }
        } catch (error) {
            console.error('Erro ao buscar dados do painel TV:', error);
        } finally {
            setLoading(false);
        }
    };

    // Inicialização e Sockets em tempo real
    useEffect(() => {
        fetchPriorities();

        // Refresh de backup a cada 5 minutos
        const interval = setInterval(fetchPriorities, 300000);

        // Inicializar socket em tempo real
        const socket = io(window.location.origin, {
            transports: ['websocket', 'polling']
        });

        // Ouvir atualizações de prioridades
        socket.on('tv:prioridades_atualizadas', () => {
            console.log('⚡ Sockets: Prioridades atualizadas');
            fetchPriorities();
        });

        // Ouvir alertas gerais do Hermes
        socket.on('hermes_feed_message', () => {
            console.log('⚡ Sockets: Mensagem Hermes recebida');
            fetchPriorities();
        });

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, []);

    // Total de páginas
    const totalPrioridadesPages = useMemo(() => {
        return Math.ceil(tasks.length / itemsPerPage);
    }, [tasks]);

    const totalPcpPages = useMemo(() => {
        return Math.ceil(pcpTasks.length / itemsPerPage);
    }, [pcpTasks]);

    const maquinasPerPage = 2;
    const totalMaquinaPages = useMemo(() => {
        return Math.ceil(maquinas.length / maquinasPerPage);
    }, [maquinas]);

    // Rotação independente de carrossel
    useEffect(() => {
        const timer = setInterval(() => {
            if (totalPrioridadesPages > 1) {
                setCurrentPage(prev => (prev + 1) % totalPrioridadesPages);
            } else {
                setCurrentPage(0);
            }

            // Alternância entre painéis
            setActiveRightPanel(prevPanel => {
                if (prevPanel === 'pcp') {
                    const nextPcpPage = currentPcpPage + 1;
                    if (nextPcpPage >= totalPcpPages) {
                        setCurrentPcpPage(0);
                        return maquinas.length > 0 ? 'carga' : 'pcp';
                    }
                    setCurrentPcpPage(nextPcpPage);
                    return 'pcp';
                } else {
                    const nextMaqPage = currentMaquinaPage + 1;
                    if (nextMaqPage >= totalMaquinaPages) {
                        setCurrentMaquinaPage(0);
                        return pcpTasks.length > 0 ? 'pcp' : 'carga';
                    }
                    setCurrentMaquinaPage(nextMaqPage);
                    return 'carga';
                }
            });

        }, rotationSpeed);

        return () => clearInterval(timer);
    }, [totalPrioridadesPages, totalPcpPages, totalMaquinaPages, rotationSpeed, currentPcpPage, currentMaquinaPage, pcpTasks.length, maquinas.length]);

    // Ajuste de páginas caso o array de tarefas encolha
    useEffect(() => {
        if (currentPage >= totalPrioridadesPages && totalPrioridadesPages > 0) {
            setCurrentPage(totalPrioridadesPages - 1);
        }
    }, [totalPrioridadesPages, currentPage]);

    useEffect(() => {
        if (currentPcpPage >= totalPcpPages && totalPcpPages > 0) {
            setCurrentPcpPage(totalPcpPages - 1);
        }
    }, [totalPcpPages, currentPcpPage]);

    // Itens fatiados para a página atual
    const currentTasks = useMemo(() => {
        const start = currentPage * itemsPerPage;
        return tasks.slice(start, start + itemsPerPage);
    }, [tasks, currentPage]);

    const currentPcpTasks = useMemo(() => {
        const start = currentPcpPage * itemsPerPage;
        return pcpTasks.slice(start, start + itemsPerPage);
    }, [pcpTasks, currentPcpPage]);

    const currentMaquinas = useMemo(() => {
        const start = currentMaquinaPage * maquinasPerPage;
        return maquinas.slice(start, start + maquinasPerPage);
    }, [maquinas, currentMaquinaPage]);

    // Manipular redefinição de velocidade de rotação
    const handleSpeedChange = (e) => {
        const newSpeed = parseInt(e.target.value, 10);
        setRotationSpeed(newSpeed);
        localStorage.setItem('tv_rotation_speed', String(newSpeed));
        setCurrentPage(0);
        setCurrentPcpPage(0);
        toast.info(`Rotação alterada para ${newSpeed / 1000}s.`);
    };

    // Concluir prioridade (Ata Viva apenas)
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
            
            {/* TV Header */}
            <header className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between shrink-0 shadow-2xl z-10">
                <div className="flex items-center gap-6">
                    <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800/80 flex flex-col items-center justify-center shadow-inner select-none">
                        <img src={logo} alt="Metalfisa Logo" className="h-10 w-auto object-contain" />
                        <span className="text-[8px] font-black tracking-widest text-slate-500 uppercase mt-0.5">
                            by Lynx
                        </span>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                            PAINEL DE PRODUÇÃO
                            <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm uppercase tracking-widest font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                Monitoramento Integrado
                            </span>
                        </h1>
                        <p className="text-slate-400 font-medium text-sm mt-0.5 flex items-center gap-2">
                            Ata Viva (Prioridades) & Cronograma Semanal PCP
                            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                        </p>
                    </div>
                </div>

                {/* Controles e Relógio */}
                <div className="flex items-center gap-6">
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
                            <option value="10000">10s</option>
                            <option value="15000">15s</option>
                            <option value="30000">30s</option>
                            <option value="60000">1 min</option>
                        </select>
                    </div>
                    
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

            {/* Main Content Area - Split 50/50 */}
            <main className="flex-1 p-6 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 flex gap-6">
                
                {/* Coluna Esquerda: Prioridades Ata Viva */}
                <div className="w-1/2 flex flex-col justify-start h-full space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                        <h2 className="text-lg font-black text-white flex items-center gap-2 tracking-tight uppercase">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            Prioridades Operacionais (Ata Viva)
                        </h2>
                        {totalPrioridadesPages > 1 && (
                            <span className="text-xs text-slate-400 font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                Pág. {currentPage + 1}/{totalPrioridadesPages}
                            </span>
                        )}
                    </div>

                    <div className="flex-1 flex flex-col gap-4 justify-start overflow-y-auto">
                        {loading ? (
                            <div className="flex-grow flex flex-col items-center justify-center text-slate-500">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
                                <span className="text-xs font-semibold">Carregando prioridades...</span>
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="flex-grow flex flex-col items-center justify-center text-slate-500">
                                <div className="w-16 h-16 mb-3 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                                    <CheckCircle2 className="w-8 h-8 text-slate-700" />
                                </div>
                                <h2 className="text-sm font-bold text-slate-400">Nenhuma prioridade registrada</h2>
                            </div>
                        ) : (
                            currentTasks.map((task, idx) => {
                                const evo = task.evolucao_op || 0;
                                const isComplete = evo >= 100;
                                return (
                                    <div 
                                        key={task.id}
                                        className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 shadow-lg flex flex-col justify-between hover:border-indigo-500/30 transition-all hover:bg-slate-900"
                                        style={{ animationDelay: `${idx * 80}ms` }}
                                    >
                                        <div>
                                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/50 pb-2 mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 rounded-lg text-xs font-black tracking-wider border border-indigo-500/25">
                                                        PEDIDO: {task.pedido || 'S/PED'}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-amber-950/40 text-amber-400 rounded-lg text-[10px] font-black border border-amber-500/20 truncate max-w-[150px]" title={task.cliente_nome}>
                                                        {task.cliente_nome ? task.cliente_nome.toUpperCase() : 'METALFISA'}
                                                    </span>
                                                    {task.op_numero && (
                                                        <span className="px-2 py-0.5 bg-slate-850 text-slate-300 rounded-lg text-[10px] font-bold border border-slate-700/40 font-mono">
                                                            OP: {task.op_numero}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-slate-500 text-[10px] font-bold">
                                                    {formatDate(task.criado_em)}
                                                </span>
                                            </div>
                                            
                                            <h3 className="text-base font-black text-white leading-tight truncate" title={task.produto}>
                                                {task.produto}
                                            </h3>
                                            
                                            {task.texto_tarefa && (
                                                <div className="mt-2 bg-red-500/5 border border-red-500/15 rounded-lg p-2 flex items-start gap-1.5">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-red-200/90 font-medium leading-relaxed">
                                                        {task.texto_tarefa.replace('[PRIORIDADE MÁXIMA]', '').replace('[PRIORIDADE]', '').trim()}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-4 pt-2 border-t border-slate-800/50">
                                            <div className="flex-1">
                                                <div className="flex justify-between items-end mb-1 text-[9px] font-bold text-slate-500 uppercase">
                                                    <span>Progresso</span>
                                                    <span className={isComplete ? 'text-emerald-400 font-extrabold' : 'text-white'}>{evo.toFixed(1)}%</span>
                                                </div>
                                                <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-850 relative">
                                                    <div 
                                                        className={`absolute top-0 left-0 h-full rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                        style={{ width: `${evo}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleConcluir(task.id, task.pedido, task.produto)}
                                                className="py-1 px-3 bg-slate-800 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 text-slate-300 text-[10px] font-bold uppercase rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all"
                                            >
                                                <Check size={12} />
                                                Concluir
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Coluna Direita: Cronograma PCP ou Carga Maquina */}
                <div className="w-1/2 flex flex-col justify-start h-full space-y-4 relative">
                    {/* Header dinamico */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                        {activeRightPanel === 'pcp' ? (
                            <>
                                <h2 className="text-lg font-black text-white flex items-center gap-2 tracking-tight uppercase">
                                    <Factory className="w-5 h-5 text-emerald-400" />
                                    Entregas da Semana e Atrasados (PCP)
                                </h2>
                                {totalPcpPages > 1 && (
                                    <span className="text-xs text-slate-400 font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                        Pág. {currentPcpPage + 1}/{totalPcpPages}
                                    </span>
                                )}
                            </>
                        ) : (
                            <>
                                <h2 className="text-lg font-black text-white flex items-center gap-2 tracking-tight uppercase">
                                    <Settings className="w-5 h-5 text-indigo-400" />
                                    Carga Máquina (Abertos / Executados)
                                </h2>
                                {totalMaquinaPages > 1 && (
                                    <span className="text-xs text-slate-400 font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                        Pág. {currentMaquinaPage + 1}/{totalMaquinaPages}
                                    </span>
                                )}
                            </>
                        )}
                    </div>

                    <div className="flex-1 flex flex-col gap-4 justify-start overflow-y-auto">
                        {loading ? (
                            <div className="flex-grow flex flex-col items-center justify-center text-slate-500">
                                <Loader2 className={`w-8 h-8 animate-spin mb-2 ${activeRightPanel === 'pcp' ? 'text-emerald-400' : 'text-indigo-400'}`} />
                                <span className="text-xs font-semibold">Carregando painel...</span>
                            </div>
                        ) : activeRightPanel === 'pcp' ? (
                            pcpTasks.length === 0 ? (
                                <div className="flex-grow flex flex-col items-center justify-center text-slate-500">
                                    <div className="w-16 h-16 mb-3 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8 text-slate-700" />
                                    </div>
                                    <h2 className="text-sm font-bold text-slate-400">Nenhuma entrega programada para esta semana</h2>
                                </div>
                            ) : (
                                currentPcpTasks.map((task, idx) => {
                                    const evo = task.evolucao_op || 0;
                                    const isComplete = evo >= 100;
                                    return (
                                        <div 
                                            key={task.id}
                                            className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 shadow-lg flex flex-col justify-between hover:border-emerald-500/30 transition-all hover:bg-slate-900"
                                            style={{ animationDelay: `${idx * 80}ms` }}
                                        >
                                            <div>
                                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/50 pb-2 mb-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 rounded-lg text-xs font-black tracking-wider border border-emerald-500/25 shadow-inner">
                                                            DATA PCP: {formatPcpDate(task.data_pcp)}
                                                        </span>
                                                        <span className="px-2 py-0.5 bg-amber-950/40 text-amber-400 rounded-lg text-[10px] font-black border border-amber-500/20 truncate max-w-[150px]" title={task.cliente_nome}>
                                                            {task.cliente_nome ? task.cliente_nome.toUpperCase() : 'METALFISA'}
                                                        </span>
                                                        {task.op_numero && (
                                                            <span className="px-2 py-0.5 bg-slate-850 text-slate-300 rounded-lg text-[10px] font-bold border border-slate-700/40 font-mono">
                                                                OP: {task.op_numero}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-slate-500 text-[10px] font-bold">
                                                        PED: {task.pedido}/{task.item_pedido}
                                                    </span>
                                                </div>
                                                
                                                <h3 className="text-base font-black text-white leading-tight truncate" title={task.produto}>
                                                    {task.produto}
                                                </h3>
                                                
                                                {task.texto_tarefa && (
                                                    <div className="mt-2 bg-slate-950 border border-slate-850 rounded-lg p-2">
                                                        <p className="text-xs text-slate-400 font-semibold italic">
                                                            Obs PCP: "{task.texto_tarefa}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-3 flex items-center justify-between gap-4 pt-2 border-t border-slate-800/50">
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-end mb-1 text-[9px] font-bold text-slate-500 uppercase">
                                                        <span>Op Qtd: {parseFloat(task.quantidade_pcp || 0).toLocaleString('pt-BR', { maxDecimals: 2 })} PC | Progresso</span>
                                                        <span className={isComplete ? 'text-emerald-400 font-extrabold' : 'text-white'}>{evo.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-850 relative">
                                                        <div 
                                                            className={`absolute top-0 left-0 h-full rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-emerald-600'}`}
                                                            style={{ width: `${evo}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="py-1 px-2 bg-slate-950 border border-slate-850 text-slate-500 text-[9px] font-bold uppercase rounded-lg flex items-center gap-1 cursor-default select-none">
                                                    <Clock size={11} />
                                                    Auto
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )
                        ) : (
                            maquinas.length === 0 ? (
                                <div className="flex-grow flex flex-col items-center justify-center text-slate-500">
                                    <div className="w-16 h-16 mb-3 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8 text-slate-700" />
                                    </div>
                                    <h2 className="text-sm font-bold text-slate-400">Nenhuma carga máquina no momento</h2>
                                </div>
                            ) : (
                                currentMaquinas.map((maq, idx) => (
                                    <div 
                                        key={maq.recurso}
                                        className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 shadow-lg flex flex-col hover:border-indigo-500/30 transition-all hover:bg-slate-900"
                                    >
                                        <div className="flex items-center gap-3 border-b border-slate-800/50 pb-2 mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                                                <Settings size={16} />
                                            </div>
                                            <h3 className="text-lg font-black text-white">{maq.recurso}</h3>
                                        </div>
                                        
                                        <div className="flex flex-col gap-2">
                                            {maq.ops.slice(0, 4).map((op, oidx) => {
                                                const pct = op.qtd_planejada > 0 ? (op.qtd_executada / op.qtd_planejada) * 100 : 0;
                                                const statusColor = op.status === 'EXECUTADO' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 
                                                                    (op.status === 'EM ANDAMENTO' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : 'text-slate-400 bg-slate-800 border-slate-700');
                                                return (
                                                    <div key={oidx} className="bg-slate-950 p-2 rounded-lg border border-slate-800/50 flex justify-between items-center gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[10px] font-mono font-bold text-slate-300">{op.op}</span>
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border truncate text-slate-400 border-slate-700">
                                                                    Data Fim: {formatPcpDate(op.fim)}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-white font-bold truncate" title={op.produto}>{op.produto}</p>
                                                        </div>
                                                        
                                                        <div className="shrink-0 flex flex-col items-end gap-1 w-24">
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusColor} text-center w-full`}>
                                                                {op.status}
                                                            </span>
                                                            <div className="flex justify-between items-center w-full text-[9px] text-slate-500 font-bold mt-0.5">
                                                                <span>{parseFloat(op.qtd_executada).toFixed(1)}</span>
                                                                <span>/ {parseFloat(op.qtd_planejada).toFixed(1)} PC</span>
                                                            </div>
                                                            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                                                                <div className={`h-full ${op.status === 'EXECUTADO' ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {maq.ops.length > 4 && (
                                                <div className="text-center mt-1">
                                                    <span className="text-[10px] text-slate-500 font-bold bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                                                        + {maq.ops.length - 4} operações na fila
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}
