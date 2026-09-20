import React, { useState, useEffect, useRef } from 'react';
import { 
    Bot, Calendar, Play, AlertTriangle, X, CheckCircle, Clock, Loader2, 
    BrainCircuit, Database, Cpu, FileText, FileSpreadsheet,
    LayoutGrid, ListOrdered, ChevronDown, Activity, BookOpen, HelpCircle
} from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { toast } from 'react-toastify';
import SmartPlannerReport from './SmartPlannerReport';
import FcsExplanationModal from './FcsExplanationModal';

export default function PlanejamentoInteligenteModal({ isOpen, onClose, selectedOps, selectedPedidos, onPlanSuccess, hermesTaskId = null }) {
    const getTodayDate = () => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    };

    const [dataInicio, setDataInicio] = useState(getTodayDate());
    const [includeSaturday, setIncludeSaturday] = useState(false);
    const [clearExisting, setClearExisting] = useState(false);
    const [syncDataPcp, setSyncDataPcp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [missingTimes, setMissingTimes] = useState([]);
    const [successMessage, setSuccessMessage] = useState('');
    const [agentLogs, setAgentLogs] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [showReport, setShowReport] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    const [resourceChart, setResourceChart] = useState({});
    const [finalAnswer, setFinalAnswer] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [showExplanationModal, setShowExplanationModal] = useState(false);

    // Novos controles de visualização e live-streaming
    const [viewMode, setViewMode] = useState('recurso'); // 'recurso' | 'data'
    const [expandAll, setExpandAll] = useState(false);
    const [expandedRecursos, setExpandedRecursos] = useState({});
    const [liveStepInfo, setLiveStepInfo] = useState(null);

    const consoleContainerRef = useRef(null);
    const currentRunIdRef = useRef(null);
    const socketRef = useRef(null);
    const [autoScroll, setAutoScroll] = useState(true);

    // Auto-scroll direto para o fim do container sem enfileirar animações suaves (zero lag)
    useEffect(() => {
        if (autoScroll && consoleContainerRef.current) {
            consoleContainerRef.current.scrollTop = consoleContainerRef.current.scrollHeight;
        }
    }, [agentLogs, autoScroll]);

    useEffect(() => {
        if (isOpen) {
            setDataInicio(getTodayDate());
            setMissingTimes([]);
            setSuccessMessage('');
            setErrorMessage('');
            setFinalAnswer('');
            setAgentLogs([]);
            setReportData(null);
            setShowReport(false);
            setLoading(false);
            setAutoScroll(true);
            setResourceChart({});
            setLiveStepInfo(null);
            setExpandedRecursos({});
            setIncludeSaturday(false);
            setClearExisting(false);
            setSyncDataPcp(false);
        }
    }, [isOpen]);

    // Socket.io: Escuta eventos do motor FCS e do Hermes em tempo real
    useEffect(() => {
        if (!isOpen) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        const socket = io(window.location.origin, {
            transports: ['polling', 'websocket'],
            reconnectionAttempts: 5,
        });
        socketRef.current = socket;

        // 1. Escuta progresso do cálculo FCS em tempo real (para qualquer planejamento)
        socket.on('fcs_live_step', (data) => {
            if (currentRunIdRef.current && data.runId !== currentRunIdRef.current) return;
            setLiveStepInfo({
                op: data.op_num,
                produto: data.produto,
                descProduto: data.desc_produto,
                step: data.step,
                totalOps: data.total_ops,
                lastDate: data.last_date,
                foiSobrecarga: data.foi_sobrecarga
            });
            if (data.carga_diaria) {
                setResourceChart(data.carga_diaria);
            }
        });

        // 2. Se for acionado via Hermes com taskId
        if (hermesTaskId) {
            const isNumericId = /^\d+$/.test(String(hermesTaskId));
            socket.on('hermes_fcs_progress', (data) => {
                if (data.runId !== hermesTaskId && data.runId !== socket._currentFcsRunId) return;
                if (data.agent_logs?.length) {
                    setAgentLogs(prev => [
                        ...prev,
                        ...data.agent_logs.map(msg => ({ msg, icon: <Cpu className="w-3.5 h-3.5 text-slate-400" />, time: new Date() }))
                    ]);
                }
                if (data.carga_diaria) setResourceChart(data.carga_diaria);
                if (data.done) {
                    setLoading(false);
                    setSuccessMessage(data.message || 'Planejamento FCS concluído pelo Hermes.');
                    if (onPlanSuccess) onPlanSuccess();
                }
            });

            socket.on('hermes_fcs_started', ({ runId }) => {
                socket._currentFcsRunId = runId;
                currentRunIdRef.current = runId;
                setAgentLogs(prev => [
                    ...prev,
                    { msg: `🚀 Motor FCS Iniciado (ID: ${runId}). Rastreando progresso...`, icon: <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />, time: new Date() }
                ]);
            });

            if (isNumericId) {
                socket.on('connect', () => {
                    socket.emit('join_hermes_task', Number(hermesTaskId));
                });
                socket.on('hermes_task_step', (step) => {
                    setAgentLogs(prev => [
                        ...prev,
                        { msg: step.message, icon: <Cpu className="w-3.5 h-3.5 text-slate-400" />, time: new Date() }
                    ]);
                });
                socket.on('hermes_task_done', (payload) => {
                    if (!socket._currentFcsRunId) {
                        setLoading(false);
                        if (payload.status === 'error') {
                            setErrorMessage(payload.answer || payload.message || 'Erro durante a execução da tarefa.');
                        } else {
                            setSuccessMessage(payload.message || 'Tarefa concluída com sucesso.');
                            setFinalAnswer(payload.answer || '');
                            if (onPlanSuccess) onPlanSuccess();
                        }
                    }
                });

                api.post(`/hermes/tasks/${hermesTaskId}/execute`).catch(err => {
                    setLoading(false);
                    setErrorMessage(err.response?.data?.error || 'Falha ao acionar a execução da tarefa no servidor.');
                });
            }
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [isOpen, hermesTaskId]);

    if (!isOpen) return null;

    const addLog = (msg, icon) => {
        setAgentLogs(prev => [...prev, { msg, icon, time: new Date() }]);
    };

    // Exporta o relatório como Excel
    const handleExportExcel = async () => {
        if (!reportData) return;
        setExportingExcel(true);
        try {
            const response = await api.post(
                '/pcp-refinado/smart-plan/export-excel',
                { report: reportData },
                { responseType: 'blob' }
            );
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            const now = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
            link.href = url;
            link.setAttribute('download', `Planejamento-FCS-${now}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Excel gerado com sucesso!');
        } catch (err) {
            toast.error('Erro ao gerar Excel: ' + (err.response?.data?.error || err.message));
        } finally {
            setExportingExcel(false);
        }
    };

    const handlePlan = async () => {
        if (!dataInicio) {
            toast.warning('Por favor, informe a data de início.');
            return;
        }

        const todayStr = getTodayDate();
        if (dataInicio < todayStr) {
            toast.warning('A data de início não pode ser anterior à data de hoje.');
            return;
        }

        if ((!selectedOps || selectedOps.length === 0) && (!selectedPedidos || selectedPedidos.length === 0)) {
            toast.warning('Nenhuma OP ou Pedido selecionado para planejamento.');
            return;
        }

        const opList = selectedOps?.map(op => (typeof op === 'string' ? op : (op.op || op.op_num || op.visual_op))).filter(Boolean) || [];

        const runId = 'fcs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        currentRunIdRef.current = runId;

        setLoading(true);
        setMissingTimes([]);
        setSuccessMessage('');
        setErrorMessage('');
        setAgentLogs([]);
        setResourceChart({});
        setLiveStepInfo(null);

        const totalItemsCount = selectedPedidos?.length || opList.length;
        addLog(`[SISTEMA] Iniciando Inteligência de Planejamento FCS para ${selectedPedidos?.length ? selectedPedidos.length + ' Pedidos' : opList.length + ' OPs'} (ID: ${runId})...`, <Bot className="w-4 h-4 text-indigo-400" />);

        try {
            const BATCH_SIZE = 5;
            let totalPlans = 0;
            let finalReport = null;
            const isPedidoMode = selectedPedidos && selectedPedidos.length > 0;
            const itemsList = isPedidoMode ? selectedPedidos : opList;
            let totalLotes = Math.ceil(itemsList.length / BATCH_SIZE) || 1;

            for (let i = 0; i < (itemsList.length || 1); i += BATCH_SIZE) {
                const batch = itemsList.slice(i, i + BATCH_SIZE);
                const loteNum = Math.floor(i / BATCH_SIZE) + 1;

                addLog(`📦 Processando lote ${loteNum}/${totalLotes} (${batch.length} ${isPedidoMode ? 'pedidos' : 'OPs'})...`, <FileText className="w-4 h-4 text-indigo-400" />);

                let res;
                try {
                    if (isPedidoMode) {
                        res = await api.post('/pcp-refinado/smart-plan-pedidos', {
                            pedidos: batch,
                            data_inicio: dataInicio,
                            include_saturday: includeSaturday,
                            clear_existing: loteNum === 1 ? clearExisting : false,
                            preload_existing: loteNum > 1,
                            sync_data_pcp: syncDataPcp,
                            run_id: runId
                        }, { timeout: 300000 });
                    } else {
                        res = await api.post('/pcp-refinado/smart-plan', {
                            ops: batch,
                            data_inicio: dataInicio,
                            include_saturday: includeSaturday,
                            preload_existing: loteNum > 1,
                            clear_existing: loteNum === 1 ? clearExisting : false,
                            sync_data_pcp: syncDataPcp,
                            run_id: runId
                        }, {
                            timeout: 300000
                        });
                    }
                } catch (batchErr) {
                    console.error(`Erro no lote ${loteNum}:`, batchErr);
                    const errMsg = batchErr.response?.data?.error || batchErr.message;
                    addLog(`⚠️ Falha no lote ${loteNum}: ${errMsg}. Continuando próximos lotes...`, <AlertTriangle className="w-4 h-4 text-amber-500" />);
                    continue;
                }

                if (res.data.agent_logs && res.data.agent_logs.length > 0) {
                    const newLogs = res.data.agent_logs.map(log => {
                        let icon = <Cpu className="w-3.5 h-3.5 text-slate-400" />;
                        if (log.includes('Iniciando') || log.includes('ESTUDO')) icon = <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />;
                        else if (log.includes('Obtendo') || log.includes('Buscando') || log.includes('Salvando')) icon = <Database className="w-3.5 h-3.5 text-blue-400" />;
                        else if (log.includes('Alocação') || log.includes('Alocados')) icon = <Clock className="w-3.5 h-3.5 text-emerald-400" />;
                        else if (log.includes('Sem capacidade') || log.includes('Transição') || log.includes('SOBRECARGA')) icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
                        return { msg: log, icon, time: new Date() };
                    });
                    setAgentLogs(prev => [...prev, ...newLogs]);
                } else {
                    addLog(`Processamento do lote ${loteNum} concluído.`, <CheckCircle className="w-4 h-4 text-green-500" />);
                }

                totalPlans += res.data.plans || 0;
                
                if (res.data.report) {
                    finalReport = res.data.report;
                    if (res.data.report.carga_diaria) {
                        setResourceChart(res.data.report.carga_diaria);
                    }
                }
            }

            setReportData(finalReport);
            setLiveStepInfo(null);
            const modoLabel = selectedPedidos?.length
                ? `${selectedPedidos.length} pedido(s)`
                : `${totalPlans} operações`;
            setSuccessMessage(`✅ Planejamento concluído! ${modoLabel} sequenciados pelo Agente FCS. Use os botões abaixo para exportar o relatório.`);
            toast.success('Planejamento inteligente aplicado com sucesso!');
            if (onPlanSuccess) onPlanSuccess();

        } catch (error) {
            if (error.response?.data?.missing_times) {
                setMissingTimes(error.response.data.missing_times);
                addLog('Falha: Roteiros incompletos identificados no lote atual.', <AlertTriangle className="w-4 h-4 text-red-500" />);
                toast.error('Erro de validação: Faltam tempos de operação.');
            } else {
                addLog('Falha na execução do algoritmo FCS em um dos lotes.', <AlertTriangle className="w-4 h-4 text-red-500" />);
                toast.error(error.response?.data?.error || 'Erro ao executar planejamento inteligente.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePlanAll = async () => {
        if (!dataInicio) {
            toast.warning('Por favor, informe a data de início.');
            return;
        }

        const todayStr = getTodayDate();
        if (dataInicio < todayStr) {
            toast.warning('A data de início não pode ser anterior à data de hoje.');
            return;
        }

        setLoading(true);
        setMissingTimes([]);
        setSuccessMessage('');
        setAgentLogs([]);
        setResourceChart({});

        const BATCH_SIZE = 100;
        let totalPlans = 0;
        let totalOps   = 0;
        let loteNum    = 0;
        let totalLotes = '?';

        try {
            addLog('Consultando OPs abertas no Protheus (em lotes de SQL)...', <Database className="w-4 h-4 text-blue-500" />);

            let offset    = 0;
            let has_more  = true;

            // Cada página SQL vira um lote FCS — sem carregar tudo na memória
            while (has_more) {
                // 1. Buscar próxima página de OPs
                const pageRes = await api.get('/pcp-refinado/ops-abertas', {
                    params:  { limit: BATCH_SIZE, offset },
                    timeout: 30000,
                });
                const { ops: batch, total, has_more: more } = pageRes.data;

                if (loteNum === 0) {
                    totalLotes = Math.ceil(total / BATCH_SIZE);
                    totalOps   = total;
                    if (total === 0) {
                        addLog('Nenhuma OP aberta com saldo encontrada.', <CheckCircle className="w-4 h-4 text-emerald-500" />);
                        setSuccessMessage('Nenhuma OP aberta encontrada no Protheus.');
                        return;
                    }
                    addLog(`${total} OPs abertas encontradas → ${totalLotes} lote(s) de até ${BATCH_SIZE}. Iniciando...`,
                        <Cpu className="w-4 h-4 text-indigo-400" />);
                }

                has_more = more;
                offset  += batch.length;
                loteNum++;

                if (batch.length === 0) break;

                addLog(`📦 Lote ${loteNum}/${totalLotes} — ${batch.length} OPs (SQL offset ${offset - batch.length})...`,
                    <FileText className="w-4 h-4 text-indigo-400" />);

                // 2. Processar lote no FCS (usa preload_existing para não conflitar com lotes anteriores)
                try {
                    const res = await api.post('/pcp-refinado/smart-plan', {
                        ops:              batch,
                        data_inicio:      dataInicio,
                        include_saturday: includeSaturday,
                        preload_existing: true,
                        clear_existing:   loteNum === 1 ? clearExisting : false,
                        sync_data_pcp:    syncDataPcp
                    }, { timeout: 600000 });

                    totalPlans += res.data.plans || 0;

                    if (res.data.agent_logs?.length > 0) {
                        for (const log of res.data.agent_logs) {
                            let icon = <Cpu className="w-4 h-4 text-slate-400" />;
                            if (log.includes('ESTUDO') || log.includes('Iniciando')) icon = <BrainCircuit className="w-4 h-4 text-indigo-500" />;
                            else if (log.includes('Salvando') || log.includes('Obtendo') || log.includes('Buscando')) icon = <Database className="w-4 h-4 text-blue-500" />;
                            else if (log.includes('Alocados') || log.includes('fatia')) icon = <Clock className="w-4 h-4 text-emerald-500" />;
                            else if (log.includes('⚠️') || log.includes('Sem capacidade')) icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
                            addLog(log, icon);
                        }
                    }

                    if (res.data.report?.carga_diaria) {
                        const resumoRecursos = res.data.report.resumo_recursos || {};
                        setResourceChart(prev => {
                            const next = { ...prev };
                            for (const [rec, info] of Object.entries(res.data.report.carga_diaria)) {
                                const desc = resumoRecursos[rec]?.desc_recurso || next[rec]?.desc || '';
                                if (!next[rec]) next[rec] = { capDia: info.capDia, desc, dates: {} };
                                else next[rec].desc = next[rec].desc || desc;
                                for (const [d, min] of Object.entries(info.dates || {})) {
                                    next[rec].dates[d] = (next[rec].dates[d] || 0) + min;
                                }
                            }
                            return next;
                        });
                    }

                    addLog(`✅ Lote ${loteNum}/${totalLotes} concluído: ${res.data.plans || 0} plano(s).`,
                        <CheckCircle className="w-4 h-4 text-emerald-500" />);
                } catch (batchErr) {
                    const msg = batchErr.response?.data?.error || batchErr.message;
                    addLog(`❌ Lote ${loteNum} falhou: ${msg}`, <AlertTriangle className="w-4 h-4 text-red-500" />);
                }
            }

            setSuccessMessage(`Planejamento global concluído! ${totalOps} OPs | ${totalPlans} planos | ${loteNum} lotes.`);
            toast.success('Planejamento global aplicado com sucesso!');
            if (onPlanSuccess) onPlanSuccess();

        } catch (error) {
            addLog('Falha no planejamento global.', <AlertTriangle className="w-4 h-4 text-red-500" />);
            toast.error(error.response?.data?.error || 'Erro ao executar planejamento global.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
        <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
                
                {/* HEADER */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
                            <Bot className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                Agente: Planejamento Inteligente
                                {hermesTaskId && (
                                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full px-2 py-0.5 flex items-center gap-1">
                                        <Cpu className="w-3 h-3" /> Servidor (Hermes)
                                    </span>
                                )}
                            </h2>
                            <p className="text-sm text-indigo-600 font-medium">
                                {hermesTaskId
                                    ? 'Execução automática no servidor — recursos locais não utilizados'
                                    : 'Motor de Sequenciamento FCS (Capacidade Finita)'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowExplanationModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-xs"
                            title="Clique para ver toda a lógica e fórmulas de cálculo do motor FCS"
                        >
                            <BookOpen className="w-4 h-4 text-indigo-600" />
                            <span className="hidden sm:inline">Entenda a Lógica FCS</span>
                        </button>
                        {!loading && (
                            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* BODY */}
                <div className="p-4 flex-1 overflow-y-auto bg-slate-50 space-y-4">

                    {/* ── REGRAS SEMPRE VISÍVEIS ───────────────────────────────── */}
                    <div className="bg-indigo-950 rounded-xl border border-indigo-800 px-4 py-3 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <BrainCircuit className="w-4 h-4 text-indigo-400 shrink-0" />
                                <span className="text-indigo-300 text-xs font-bold uppercase tracking-wider">
                                    Regra Geral do Motor de Sequenciamento FCS (Capacidade Finita)
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowExplanationModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 rounded-lg text-xs font-bold transition-all border border-indigo-600 shadow-xs"
                                title="Clique para abrir o guia visual completo de funcionamento do Agente"
                            >
                                <HelpCircle className="w-3.5 h-3.5 text-indigo-300" />
                                <span>Ver Explicação Completa ➜</span>
                            </button>
                        </div>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-indigo-200 text-xs">
                            <li>🎯 <strong>Prioridade por entrega PCP:</strong> quem entrega mais cedo recebe capacidade primeiro.</li>
                            <li>🌳 <strong>Árvore do Produto (BOM):</strong> peças base (laser/corte) antes de dobra e solda.</li>
                            <li>⚙️ <strong>Carga = Qtd Pendente × Tempo</strong> unitário do roteiro de engenharia (SG2010).</li>
                            <li>🔁 <strong>Multi-dia:</strong> excesso de carga transborda para o próximo dia útil.</li>
                            <li>⚡ <strong>Sobreposição (180 min):</strong> próximo posto inicia sem esperar o lote todo.</li>
                            <li>🔥 <strong>Sobrecarga (+50%):</strong> libera horas extras automáticas se o prazo for estourar.</li>
                        </ul>
                    </div>

                    {/* ── CONTROLES (sempre visíveis) ──────────────────────────── */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" /> Data de Início
                            </label>
                            <input
                                type="date"
                                value={dataInicio}
                                min={getTodayDate()}
                                disabled={loading}
                                onChange={(e) => setDataInicio(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 disabled:opacity-50"
                            />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none pb-0.5">
                            <div
                                onClick={() => !loading && setIncludeSaturday(v => !v)}
                                className={`w-10 h-5 rounded-full relative transition-colors ${includeSaturday ? 'bg-indigo-600' : 'bg-slate-300'} ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${includeSaturday ? 'translate-x-5' : ''}`} />
                            </div>
                            <span className="text-sm text-slate-600 font-medium">Incluir Sábado</span>
                        </label>

                        {/* Toggle: Limpar carga existente */}
                        <label className="flex items-center gap-2 cursor-pointer select-none pb-0.5" title="Apaga toda a alocação futura dos recursos antes de recalcular. Use para replanejar do zero.">
                            <div
                                onClick={() => !loading && setClearExisting(v => !v)}
                                className={`w-10 h-5 rounded-full relative transition-colors ${clearExisting ? 'bg-red-500' : 'bg-slate-300'} ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${clearExisting ? 'translate-x-5' : ''}`} />
                            </div>
                            <span className={`text-sm font-medium ${clearExisting ? 'text-red-600' : 'text-slate-600'}`}>
                                {clearExisting ? '🗑️ Limpar carga existente' : 'Manter carga existente'}
                            </span>
                        </label>

                        {/* Toggle: Sincronizar Data PCP */}
                        <label className="flex items-center gap-2 cursor-pointer select-none pb-0.5" title="Quando a Data PCP for anterior à Data Início, sobrescreve a Data PCP com a Prev. Fat calculada.">
                            <div
                                onClick={() => !loading && setSyncDataPcp(v => !v)}
                                className={`w-10 h-5 rounded-full relative transition-colors ${syncDataPcp ? 'bg-amber-500' : 'bg-slate-300'} ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${syncDataPcp ? 'translate-x-5' : ''}`} />
                            </div>
                            <span className={`text-sm font-medium ${syncDataPcp ? 'text-amber-700' : 'text-slate-600'}`}>
                                {syncDataPcp ? '📅 Sync Prev. Fat → Data PCP' : 'Não sincronizar Data PCP'}
                            </span>
                        </label>

                        {/* Aviso explicativo do Sync — aparece apenas quando ativo */}
                        {syncDataPcp && (() => {
                            // Gera exemplo com datas 100% coerentes a partir da data de início selecionada
                            let dtInicioFmt = '17/09/2026';
                            let dtVencidaFmt = '15/08/2026';
                            let dtCalculadaFmt = '08/10/2026';
                            let dtFuturaFmt = '25/11/2026';

                            if (dataInicio && dataInicio.includes('-')) {
                                const [y, m, d] = dataInicio.split('-').map(Number);
                                const dObj = new Date(y, m - 1, d);
                                if (!isNaN(dObj.getTime())) {
                                    const pad = (n) => String(n).padStart(2, '0');
                                    const fmt = (dt) => `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
                                    
                                    dtInicioFmt = fmt(dObj);
                                    
                                    const dVencida = new Date(dObj);
                                    dVencida.setDate(dVencida.getDate() - 30);
                                    dtVencidaFmt = fmt(dVencida);
                                    
                                    const dCalc = new Date(dObj);
                                    dCalc.setDate(dCalc.getDate() + 21); // ~3 semanas de produção no futuro
                                    dtCalculadaFmt = fmt(dCalc);

                                    const dFut = new Date(dObj);
                                    dFut.setDate(dFut.getDate() + 60);
                                    dtFuturaFmt = fmt(dFut);
                                }
                            }

                            return (
                                <div className="w-full mt-1 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-2.5 animate-in fade-in duration-200 shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-amber-950 flex items-center gap-1.5 text-sm">
                                            <span>📅</span> Regra do Sync Prev. Fat → Data PCP
                                        </p>
                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-800">
                                            Exemplo Prático e Coerente
                                        </span>
                                    </div>
                                    <p className="text-slate-700">
                                        Ao concluir o cálculo da simulação com capacidade finita, o Agente determina a data real em que a fábrica conclui a última peça do pedido (<span className="font-semibold text-emerald-700">Prev. Fat</span>).
                                    </p>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                        {/* Exemplo 1: Data Vencida */}
                                        <div className="bg-white p-2.5 rounded-lg border border-amber-200 space-y-1 font-mono">
                                            <div className="font-bold text-slate-800 font-sans flex items-center gap-1">
                                                <span>🔄</span> Caso 1: Data PCP Vencida no Passado
                                            </div>
                                            <div className="text-slate-600">Data Início informada: <strong>{dtInicioFmt}</strong></div>
                                            <div className="text-red-600">Data PCP antiga no ERP: <span className="line-through">{dtVencidaFmt}</span> (vencida)</div>
                                            <div className="text-emerald-700">Agente calcula Prev. Fat: <strong>{dtCalculadaFmt}</strong> (no futuro)</div>
                                            <div className="text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                                                → Data PCP atualizada para: {dtCalculadaFmt} ✓
                                            </div>
                                        </div>

                                        {/* Exemplo 2: Data Futura Preservada */}
                                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1 font-mono">
                                            <div className="font-bold text-slate-800 font-sans flex items-center gap-1">
                                                <span>🛡️</span> Caso 2: Data PCP já no Futuro
                                            </div>
                                            <div className="text-slate-600">Data Início informada: <strong>{dtInicioFmt}</strong></div>
                                            <div className="text-emerald-700">Data PCP no ERP: <strong>{dtFuturaFmt}</strong> (prometida)</div>
                                            <div className="text-slate-500 text-[10px]">A data prometida é posterior à Data de Início.</div>
                                            <div className="text-slate-700 font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                                → Data PCP mantida intacta: {dtFuturaFmt} (não altera)
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-amber-800">
                                        ⚠️ <strong>Proteção de Datas:</strong> Apenas datas PCP que ficaram para trás no passado (anteriores à Data de Início {dtInicioFmt}) são sobrescritas. Datas futuras acordadas com clientes nunca são perdidas.
                                    </p>
                                </div>
                            );
                        })()}

                        <div className="text-xs text-slate-400 self-end pb-1">
                            {selectedPedidos?.length
                                ? `${selectedPedidos.length} Pedido(s) selecionado(s)`
                                : `${selectedOps?.length ?? 0} OP(s) selecionada(s)`}
                        </div>
                    </div>

                    {/* ── RESOURCE CHART (Cálculo em Tempo Real) ──────────── */}
                    {Object.keys(resourceChart).length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                    <span className="text-sm font-bold text-slate-800">Carga Diária Calculada — Tempo Real</span>
                                    {loading && (
                                        <span className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium animate-pulse">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            calculando...
                                        </span>
                                    )}
                                </div>

                                {/* Controles de Visualização para o Usuário */}
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                                        <button
                                            type="button"
                                            onClick={() => setViewMode('recurso')}
                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${viewMode === 'recurso' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                            title="Visualizar agrupado por Máquina/Recurso"
                                        >
                                            <LayoutGrid className="w-3 h-3" />
                                            Por Recurso
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setViewMode('data')}
                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${viewMode === 'data' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                            title="Visualizar cronograma cronológico por Data"
                                        >
                                            <ListOrdered className="w-3 h-3" />
                                            Por Data
                                        </button>
                                    </div>

                                    {viewMode === 'recurso' && (
                                        <button
                                            type="button"
                                            onClick={() => setExpandAll(v => !v)}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50 transition-colors"
                                        >
                                            {expandAll ? 'Modo Compacto' : 'Expandir Todos'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Banner de Live Streaming da OP sendo calculada */}
                            {loading && liveStepInfo && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/80 border border-indigo-200/70 rounded-lg text-xs text-indigo-900">
                                    <Activity className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 font-semibold truncate">
                                            <span>OP {liveStepInfo.op}</span>
                                            <span className="text-slate-400 font-normal">|</span>
                                            <span className="truncate text-slate-700">{liveStepInfo.descProduto || liveStepInfo.produto}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            Alocada até: <span className="font-mono font-medium text-indigo-700">{liveStepInfo.lastDate || 'em cálculo...'}</span>
                                            {liveStepInfo.foiSobrecarga && <span className="ml-2 text-amber-700 font-bold">(Modo Sobrecarga +50%)</span>}
                                        </div>
                                    </div>
                                    <span className="font-mono text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold shrink-0">
                                        {liveStepInfo.step} / {liveStepInfo.totalOps} OPs
                                    </span>
                                </div>
                            )}

                            {/* MODO 1: POR RECURSO */}
                            {viewMode === 'recurso' && (
                                <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                                    {Object.entries(resourceChart)
                                        .sort(([a, infoA], [b, infoB]) => (infoA.ordem ?? 9999) - (infoB.ordem ?? 9999) || a.localeCompare(b))
                                        .map(([recurso, info]) => {
                                            const sortedDates = Object.entries(info.dates || {})
                                                .sort(([a], [b]) => a.localeCompare(b));
                                            if (sortedDates.length === 0) return null;

                                            const isExpanded = expandAll || !!expandedRecursos[recurso];
                                            const visibleDates = isExpanded ? sortedDates : sortedDates.slice(0, 4);
                                            const hasMore = sortedDates.length > 4;

                                            return (
                                                <div key={recurso} className="bg-slate-50/50 rounded-lg p-2.5 border border-slate-100">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-xs font-bold text-slate-800 font-mono bg-white px-2 py-0.5 rounded border border-slate-250 shadow-2xs">
                                                            {recurso}
                                                        </span>
                                                        {info.desc && info.desc !== recurso && (
                                                            <span className="text-xs font-semibold text-indigo-700 truncate">
                                                                {info.desc}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-slate-400 ml-auto shrink-0">
                                                            cap. {info.capDia} min/dia
                                                        </span>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        {visibleDates.map(([date, allocated]) => {
                                                            const pct = (allocated / info.capDia) * 100;
                                                            const d = new Date(date + 'T12:00:00');
                                                            const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' });
                                                            const isOver = pct > 100;
                                                            const isFull = pct >= 80 && pct <= 100;
                                                            const barColor = isOver ? 'bg-red-500' : isFull ? 'bg-blue-600' : 'bg-emerald-500';
                                                            const textColor = isOver ? 'text-red-600' : isFull ? 'text-blue-700' : 'text-emerald-700';

                                                            return (
                                                                <div key={date} className="flex items-center gap-2">
                                                                    <span className="text-[11px] text-slate-600 w-24 shrink-0 font-mono font-medium">
                                                                        {label}
                                                                    </span>
                                                                    <div className="flex-1 bg-slate-200/80 rounded-full h-3.5 overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                                                            style={{ width: `${Math.min(pct, 100)}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className={`text-[11px] font-bold w-12 text-right shrink-0 ${textColor}`}>
                                                                        {Math.round(pct)}%
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-500 w-16 text-right shrink-0 font-mono">
                                                                        {Math.round(allocated)}m
                                                                    </span>
                                                                    {isOver && (
                                                                        <span className="text-[9px] font-bold bg-red-100 text-red-700 px-1 py-0.2 rounded shrink-0">
                                                                            +50%
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {hasMore && (
                                                        <div className="mt-1.5 pt-1 border-t border-slate-200/50 flex justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedRecursos(prev => ({ ...prev, [recurso]: !prev[recurso] }))}
                                                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                                                            >
                                                                {isExpanded ? (
                                                                    <>Recolher dias extras <ChevronDown className="w-3 h-3 rotate-180" /></>
                                                                ) : (
                                                                    <>+ Ver mais {sortedDates.length - 4} dia(s) <ChevronDown className="w-3 h-3" /></>
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            )}

                            {/* MODO 2: POR DATA (Linha do Tempo Cronológica) */}
                            {viewMode === 'data' && (
                                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                                    {(() => {
                                        const datesMap = {};
                                        Object.entries(resourceChart).forEach(([recurso, info]) => {
                                            Object.entries(info.dates || {}).forEach(([date, allocated]) => {
                                                if (!datesMap[date]) datesMap[date] = [];
                                                datesMap[date].push({
                                                    recurso,
                                                    desc: info.desc || recurso,
                                                    capDia: info.capDia,
                                                    allocated,
                                                    pct: (allocated / info.capDia) * 100
                                                });
                                            });
                                        });
                                        const sortedDays = Object.entries(datesMap).sort(([a], [b]) => a.localeCompare(b));

                                        if (sortedDays.length === 0) {
                                            return <div className="text-xs text-slate-400 p-2">Nenhuma alocação registrada.</div>;
                                        }

                                        return sortedDays.map(([date, items]) => {
                                            const d = new Date(date + 'T12:00:00');
                                            const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

                                            return (
                                                <div key={date} className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/70">
                                                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200/60">
                                                        <span className="text-xs font-bold text-slate-800 capitalize flex items-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                                            {label}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400">
                                                            {items.length} recurso(s) ativo(s)
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {items.map(it => {
                                                            const isOver = it.pct > 100;
                                                            const isFull = it.pct >= 80 && it.pct <= 100;
                                                            const barColor = isOver ? 'bg-red-500' : isFull ? 'bg-blue-600' : 'bg-emerald-500';
                                                            const textColor = isOver ? 'text-red-600' : isFull ? 'text-blue-700' : 'text-emerald-700';

                                                            return (
                                                                <div key={it.recurso} className="flex items-center gap-2">
                                                                    <span className="text-[11px] font-mono font-bold text-slate-700 w-24 shrink-0 truncate" title={it.desc}>
                                                                        {it.recurso}
                                                                    </span>
                                                                    <div className="flex-1 bg-slate-200/80 rounded-full h-3 overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                                                            style={{ width: `${Math.min(it.pct, 100)}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className={`text-[11px] font-bold w-12 text-right shrink-0 ${textColor}`}>
                                                                        {Math.round(it.pct)}%
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-500 w-16 text-right shrink-0 font-mono">
                                                                        {Math.round(it.allocated)}m
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            )}

                            {/* Legenda de Cores */}
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/> Normal (&lt;80%)
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"/> Plena (80–100%)
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"/> Sobrecarga (&gt;100%)
                                    </span>
                                </div>
                                <span className="text-slate-400 text-[10px]">Capacidade Finita (FCS)</span>
                            </div>
                        </div>
                    )}

                    {/* ── SUCESSO ──────────────────────────────────────────────── */}
                    {successMessage && (
                        <div className="flex flex-col items-center py-6 text-center animate-in fade-in zoom-in duration-300 bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 mb-4">
                            <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                            <h3 className="text-lg font-bold text-slate-800 mb-1">Planejamento Concluído</h3>
                            <p className="text-slate-600 text-sm font-medium">{successMessage}</p>
                            {reportData && (
                                <button onClick={() => setShowReport(true)}
                                    className="mt-4 flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm">
                                    <FileText className="w-4 h-4" /> Ver Relatório do Agente
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── ERRO ─────────────────────────────────────────────────── */}
                    {errorMessage && (
                        <div className="flex flex-col items-center py-6 text-center animate-in fade-in zoom-in duration-300 bg-red-50/50 border border-red-100 rounded-xl p-4 mb-4">
                            <AlertTriangle className="w-12 h-12 text-red-500 mb-3" />
                            <h3 className="text-lg font-bold text-slate-800 mb-1">Falha na Execução</h3>
                            <p className="text-red-700 text-sm font-medium">{errorMessage}</p>
                        </div>
                    )}

                    {/* ── RESPOSTA DO AGENTE ─────────────────────────────────────── */}
                    {finalAnswer && (
                        <div className="bg-slate-50 border border-slate-250/60 rounded-xl p-4 mb-4 max-h-64 overflow-y-auto shadow-inner">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Resposta do Agente</div>
                            <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">{finalAnswer}</div>
                        </div>
                    )}

                    {/* ── CONSOLE DE LOGS (Zero-Lag, Instant Scroll) ──────────── */}
                    {agentLogs.length > 0 && (
                        <div className="bg-slate-900 rounded-xl p-4 font-mono shadow-inner border border-slate-700">
                            <div className="flex items-center gap-2 mb-3 text-indigo-400 border-b border-slate-700 pb-2">
                                <BrainCircuit className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Console do Agente FCS</span>
                            </div>
                            <div
                                ref={consoleContainerRef}
                                className="max-h-56 overflow-y-auto space-y-1.5 pr-1"
                                onWheel={() => setAutoScroll(false)}
                                onScroll={(e) => {
                                    const { scrollTop, scrollHeight, clientHeight } = e.target;
                                    if (scrollHeight - scrollTop - clientHeight < 15) setAutoScroll(true);
                                }}
                            >
                                {agentLogs.map((log, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                        <span className="text-slate-500 shrink-0 text-[10px] mt-0.5">[{log.time.toLocaleTimeString([], { hour12: false })}]</span>
                                        <div className="shrink-0 mt-0.5">{log.icon}</div>
                                        <span className="text-slate-200 text-xs leading-relaxed">{log.msg}</span>
                                    </div>
                                ))}
                                {loading && (
                                    <div className="flex items-center gap-2 text-indigo-400 animate-pulse mt-1">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span className="text-xs">Processando alocação...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── ERROS DE TEMPO ───────────────────────────────────────── */}
                    {missingTimes.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
                                <AlertTriangle className="w-4 h-4" />
                                <h3 className="text-sm">Faltam Tempos de Operação</h3>
                            </div>
                            <p className="text-xs text-red-600 mb-3">Cadastre o Tempo Padrão em <strong>Configurações → PCP Refinado</strong> para os recursos abaixo:</p>
                            <div className="max-h-40 overflow-y-auto border border-red-100 rounded-lg bg-white">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-red-50 sticky top-0 text-red-800 uppercase shadow-sm">
                                        <tr>
                                            <th className="px-3 py-2 font-bold">Produto</th>
                                            <th className="px-3 py-2 font-bold">Recurso</th>
                                            <th className="px-3 py-2 font-bold">Operação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-red-50">
                                        {missingTimes.map((err, idx) => (
                                            <tr key={idx} className="hover:bg-red-50/50">
                                                <td className="px-3 py-1.5 font-mono font-semibold">{err.produto}</td>
                                                <td className="px-3 py-1.5 text-slate-700">{err.recurso}</td>
                                                <td className="px-3 py-1.5 text-slate-700">{err.operacao}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>

                {/* FOOTER */}
                {!successMessage && !errorMessage && !missingTimes.length && !loading && (
                    <div className="p-4 border-t border-slate-100 bg-white flex flex-wrap justify-between gap-3 shrink-0">
                        <button onClick={onClose} className="px-5 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors text-sm">Cancelar</button>
                        {!hermesTaskId && (
                            <div className="flex gap-2 flex-wrap">
                                {/* Só mostra 'Planejar Todas as OPs' no modo de OPs, nunca no modo de Pedidos */}
                                {!selectedPedidos?.length && (
                                    <button
                                        onClick={handlePlanAll}
                                        disabled={!dataInicio}
                                        title="Executa o FCS em TODAS as OPs abertas do Protheus, em lotes de 100"
                                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm"
                                    >
                                        <Play className="w-4 h-4" /> Planejar Todas as OPs
                                    </button>
                                )}
                                <button
                                    onClick={handlePlan}
                                    disabled={!dataInicio || (selectedPedidos?.length ? selectedPedidos.length === 0 : (selectedOps?.length ?? 0) === 0)}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm"
                                >
                                    <Play className="w-4 h-4" />
                                    {selectedPedidos?.length
                                        ? `Executar (${selectedPedidos.length} Pedido${selectedPedidos.length > 1 ? 's' : ''})`
                                        : `Executar (${selectedOps?.length ?? 0} OPs)`}
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {loading && (
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
                        {hermesTaskId ? (
                            <span className="text-sm text-emerald-700 font-medium flex items-center gap-2">
                                <Cpu className="w-4 h-4" /> Processando no servidor — recursos do browser liberados
                            </span>
                        ) : (
                            <span />
                        )}
                        <button onClick={onClose} className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors text-sm border border-slate-200">
                            {hermesTaskId ? 'Fechar (continua em background)' : 'Cancelar Processamento'}
                        </button>
                    </div>
                )}
                {missingTimes.length > 0 && !loading && (
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end shrink-0">
                        <button onClick={onClose} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 text-sm">Entendi, vou corrigir</button>
                    </div>
                )}
                {successMessage && !loading && (
                    <div className="p-4 border-t border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
                        {/* Botões de Exportação */}
                        {reportData && (
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={handleExportExcel}
                                    disabled={exportingExcel}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 text-sm flex items-center gap-2"
                                >
                                    {exportingExcel
                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                                        : <><FileSpreadsheet className="w-4 h-4" /> Exportar Excel</>
                                    }
                                </button>
                                <button
                                    onClick={() => setShowReport(true)}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 text-sm flex items-center gap-2"
                                >
                                    <FileText className="w-4 h-4" /> Ver Relatório PDF
                                </button>
                            </div>
                        )}
                        <button onClick={onClose} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 text-sm">Fechar</button>
                    </div>
                )}
                {errorMessage && !loading && (
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end shrink-0">
                        <button onClick={onClose} className="px-6 py-2 bg-red-650 hover:bg-red-750 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 text-sm">Fechar</button>
                    </div>
                )}
            </div>
        </div>

        {/* RELATÓRIO PDF */}
        {showReport && reportData && (
            <SmartPlannerReport
                report={reportData}
                onClose={() => setShowReport(false)}
            />
        )}

        {/* MODAL EXPLICATIVA DAS REGRAS E LÓGICA DO MOTOR FCS */}
        <FcsExplanationModal
            isOpen={showExplanationModal}
            onClose={() => setShowExplanationModal(false)}
        />
    </>
    );
}
