import React, { useState, useEffect, useRef } from 'react';
import { Bot, Calendar, Play, AlertTriangle, X, CheckCircle, Clock, Loader2, BrainCircuit, Database, Cpu, FileText, FileSpreadsheet } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-toastify';
import SmartPlannerReport from './SmartPlannerReport';

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
    // { 'MEC01': { desc, capDia, dates: { '2026-06-06': allocatedMin } } }

    const logsEndRef = useRef(null);
    const pendingAlloc = useRef(null); // correlaciona log de operação com log de alocação

    const [autoScroll, setAutoScroll] = useState(true);

    // Auto-scroll para o último log sempre que um novo for adicionado
    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
            pendingAlloc.current = null;
            setIncludeSaturday(false);
            setClearExisting(false);
            setSyncDataPcp(false);
        }
    }, [isOpen]);

    // Modo Hermes: escuta progresso do FCS rodando no servidor via socket.io
    useEffect(() => {
        if (!isOpen || !hermesTaskId) return;

        setLoading(true);
        setAgentLogs([]);
        setSuccessMessage('');
        setErrorMessage('');
        setFinalAnswer('');
        setResourceChart({});

        let socket = null;
        const isNumericId = /^\d+$/.test(String(hermesTaskId));

        import('socket.io-client').then(({ io }) => {
            socket = io(window.location.origin, {
                transports: ['polling', 'websocket'],
                reconnectionAttempts: 5,
            });

            // 1. Escuta progresso do FCS
            socket.on('hermes_fcs_progress', (data) => {
                // Aceita progresso se for o runId direto ou se for o runId dinâmico capturado da task
                if (data.runId !== hermesTaskId && data.runId !== socket._currentFcsRunId) return;

                if (data.agent_logs?.length) {
                    setAgentLogs(prev => [
                        ...prev,
                        ...data.agent_logs.map(msg => ({ msg, icon: '⚙️', time: new Date() }))
                    ]);
                }

                if (data.carga_diaria) {
                    setResourceChart(data.carga_diaria);
                }

                if (data.done) {
                    setLoading(false);
                    setSuccessMessage(data.message || 'Planejamento FCS concluído pelo Hermes (Servidor).');
                    if (onPlanSuccess) onPlanSuccess();
                }
            });

            // 2. Escuta inicio global do FCS para capturar a runId dinâmica
            socket.on('hermes_fcs_started', ({ runId }) => {
                socket._currentFcsRunId = runId;
                setAgentLogs(prev => [
                    ...prev,
                    { msg: `🚀 Motor FCS Iniciado (ID: ${runId}). Rastreando progresso...`, icon: '🤖', time: new Date() }
                ]);
            });

            // 3. Escuta eventos genéricos de Task (caso hermesTaskId seja numérico)
            if (isNumericId) {
                socket.on('connect', () => {
                    socket.emit('join_hermes_task', Number(hermesTaskId));
                });

                socket.on('hermes_task_step', (step) => {
                    setAgentLogs(prev => [
                        ...prev,
                        { msg: step.message, icon: step.icon || '⚙️', time: new Date() }
                    ]);
                });

                socket.on('hermes_task_done', (payload) => {
                    // Se o FCS rodou, a conclusão vem pelo hermes_fcs_progress.
                    // Caso contrário, finaliza pela conclusão da tarefa hermes.
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

                // Dispara a execução no backend
                api.post(`/hermes/tasks/${hermesTaskId}/execute`).catch(err => {
                    setLoading(false);
                    setErrorMessage(err.response?.data?.error || 'Falha ao acionar a execução da tarefa no servidor.');
                });
            }
        }).catch(() => {
            setLoading(false);
            setErrorMessage('Erro ao conectar ao socket do servidor.');
        });

        return () => { if (socket) socket.disconnect(); };
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

    // Distribui `totalMin` pelos dias úteis entre dateStart e dateEnd,
    // respeitando o teto de `capDia` por dia e a opção de sábado.
    const distributeLoad = (dateStart, dateEnd, totalMin, capDia, includeSat = false) => {
        const days = [];
        const cur = new Date(dateStart + 'T12:00:00');
        const end = new Date(dateEnd + 'T12:00:00');
        while (cur <= end) {
            const dow = cur.getDay();
            if (dow !== 0 && (dow !== 6 || includeSat)) {
                days.push(cur.toISOString().split('T')[0]);
            }
            cur.setDate(cur.getDate() + 1);
        }
        // Fallback: ao menos o dia inicial
        if (days.length === 0) return { [dateStart]: Math.min(totalMin, capDia) };
        const result = {};
        let remaining = totalMin;
        for (const d of days) {
            if (remaining <= 0) break;
            const allocated = Math.min(remaining, capDia);
            result[d] = allocated;
            remaining -= allocated;
        }
        return result;
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

        const opList = selectedOps?.map(op => op.op || op.op_num) || [];

        setLoading(true);
        setMissingTimes([]);
        setSuccessMessage('');
        setAgentLogs([]);
        addLog(`[SISTEMA] Iniciando Inteligência de Planejamento para ${selectedPedidos?.length ? selectedPedidos.length + ' Pedidos' : (selectedOps?.length || 0) + ' OPs'}...`, <Bot className="w-4 h-4" />);

        try {
            const BATCH_SIZE = 50;
            let totalPlans = 0;
            let finalReport = null;
            let totalLotes = Math.ceil(opList.length / BATCH_SIZE) || 1;

            for (let i = 0; i < (opList.length || 1); i += BATCH_SIZE) {
                const batch = opList.slice(i, i + BATCH_SIZE);
                const loteNum = Math.floor(i / BATCH_SIZE) + 1;

                addLog(`📦 Processando lote ${loteNum}/${totalLotes}...`, <FileText className="w-4 h-4 text-indigo-400" />);

                let res;
                if (selectedPedidos && selectedPedidos.length > 0) {
                    res = await api.post('/pcp-refinado/smart-plan-pedidos', {
                        pedidos: selectedPedidos,
                        data_inicio: dataInicio,
                        include_saturday: includeSaturday,
                        clear_existing: clearExisting,
                        sync_data_pcp: syncDataPcp
                    });
                } else {
                    res = await api.post('/pcp-refinado/smart-plan', {
                        ops: batch,
                        data_inicio: dataInicio,
                        include_saturday: includeSaturday,
                        preload_existing: loteNum > 1,
                        clear_existing: loteNum === 1 ? clearExisting : false, // Só limpa no primeiro lote
                        sync_data_pcp: syncDataPcp
                    }, {
                        timeout: 600000
                    });
                }

                if (res.data.agent_logs && res.data.agent_logs.length > 0) {
                    pendingAlloc.current = null;
                    for (let j = 0; j < res.data.agent_logs.length; j++) {
                        const log = res.data.agent_logs[j];

                        let icon = <Cpu className="w-4 h-4 text-slate-400" />;
                        if (log.includes('Iniciando') || log.includes('ESTUDO')) icon = <BrainCircuit className="w-4 h-4 text-indigo-500" />;
                        else if (log.includes('Obtendo') || log.includes('Buscando') || log.includes('Salvando')) icon = <Database className="w-4 h-4 text-blue-500" />;
                        else if (log.includes('Alocados')) icon = <Clock className="w-4 h-4 text-emerald-500" />;
                        else if (log.includes('Sem capacidade') || log.includes('Transição')) icon = <Calendar className="w-4 h-4 text-amber-500" />;

                        addLog(log, icon);

                        // ── PARSER DE CARGA EM TEMPO REAL ──────────────────────────────
                        const opMatch = log.match(/Operação\s+\w+\s+\((\w+)\).*Requer\s+([\d.]+)\s+min.*Cap\/dia\s*=\s*([\d.]+)\s*min/);
                        if (opMatch) {
                            pendingAlloc.current = {
                                recurso: opMatch[1],
                                minNeeded: parseFloat(opMatch[2]),
                                capDia: parseFloat(opMatch[3])
                            };
                            // Tenta capturar descrição do log de capacidade anterior
                            // Formato: "  [MO0013] LASER: 1920 min/dia"
                            const descMatch = log.match(/\[(\w+)\]\s+(.+?):\s*[\d]+\s*min\/dia/);
                            if (descMatch && descMatch[1] === opMatch[1]) {
                                pendingAlloc.current.desc = descMatch[2].trim();
                            }
                        }
                        const allocMatch = log.match(/Aloca[çc][aã]o conclu[íi]da: de (\d{4}-\d{2}-\d{2}) at[eé] (\d{4}-\d{2}-\d{2})/);
                        if (allocMatch && pendingAlloc.current) {
                            const { recurso, minNeeded, capDia, desc = '' } = pendingAlloc.current;
                            const d1 = allocMatch[1], d2 = allocMatch[2];
                            const dayMap = distributeLoad(d1, d2, minNeeded, capDia, includeSaturday);
                            setResourceChart(prev => {
                                const next = { ...prev };
                                if (!next[recurso]) next[recurso] = { capDia, desc, dates: {} };
                                next[recurso].dates = { ...next[recurso].dates };
                                Object.entries(dayMap).forEach(([d, min]) => {
                                    next[recurso].dates[d] = (next[recurso].dates[d] || 0) + min;
                                });
                                return next;
                            });
                            pendingAlloc.current = null;
                        }
                        // ───────────────────────────────────────────────────────────────

                        await new Promise(r => setTimeout(r, 20)); // Delay reduzido p/ lotes
                    }
                } else {
                    addLog(`Processamento do lote ${loteNum} concluído.`, <CheckCircle className="w-4 h-4 text-green-500" />);
                }

                totalPlans += res.data.plans || 0;
                
                // O último lote sobrescreve com o report completo de carga finalizada (preloaded)
                if (res.data.report) {
                    finalReport = res.data.report;
                    if (res.data.report.carga_diaria) {
                        setResourceChart(res.data.report.carga_diaria);
                    }
                }
            }

            const modoLabel = selectedPedidos?.length
                ? `${selectedPedidos.length} pedido(s)`
                : `${totalPlans} operações`;
            setSuccessMessage(`✅ Planejamento concluído! ${modoLabel} sequenciados pelo Agente FCS. Use os botões abaixo para exportar o relatório.`);
            toast.success('Planejamento inteligente aplicado com sucesso!');

            if (finalReport) setReportData(finalReport);
            
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
                    {!loading && (
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* BODY */}
                <div className="p-4 flex-1 overflow-y-auto bg-slate-50 space-y-4">

                    {/* ── REGRAS SEMPRE VISÍVEIS ───────────────────────────────── */}
                    <div className="bg-indigo-950 rounded-xl border border-indigo-800 px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                            <BrainCircuit className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="text-indigo-300 text-xs font-bold uppercase tracking-wider">Regras do Motor FCS</span>
                        </div>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-indigo-200 text-xs">
                            <li>📋 <strong>Varredura do passado:</strong> OPs não executadas antes de hoje são incluídas automaticamente.</li>
                            <li>🎯 <strong>Prioridade por entrega PCP:</strong> quem entrega mais cedo recebe capacidade primeiro.</li>
                            <li>📅 <strong>Sem data PCP:</strong> vão para o final da fila.</li>
                            <li>🚫 <strong>Passado bloqueado:</strong> disponibilidade zero antes da data base.</li>
                            <li>⚙️ <strong>Carga = Qtd × Tempo unitário</strong> do roteiro (SG2010).</li>
                            <li>🔁 <strong>Multi-dia:</strong> excesso de carga transborda para o próximo dia útil.</li>
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
                        {syncDataPcp && (
                            <div className="w-full mt-1 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed space-y-1.5 animate-in fade-in duration-200">
                                <p className="font-bold text-amber-900 flex items-center gap-1.5">
                                    <span>📅</span> Regra do Sync Prev. Fat → Data PCP
                                </p>
                                <p>
                                    Após calcular a <span className="font-semibold">Prev. Fat</span> de cada pedido, o motor verifica se a <span className="font-semibold">Data PCP</span> está <span className="font-semibold text-red-700">vencida</span> (anterior à Data de Início).
                                </p>
                                <div className="bg-amber-100 rounded p-2 space-y-0.5 font-mono text-[11px]">
                                    <div className="text-slate-600">Data de Início informada: <span className="font-bold text-slate-800">{dataInicio || '—'}</span></div>
                                    <div className="text-red-700">Data PCP vencida (ex): <span className="line-through">05/07/2026</span></div>
                                    <div className="text-emerald-700">Motor calcula Prev. Fat: <span className="font-bold">28/08/2026</span></div>
                                    <div className="text-amber-700 font-bold">→ Data PCP atualizada para: 28/08/2026 ✓</div>
                                </div>
                                <p className="text-amber-700">
                                    ⚠️ Apenas datas PCP <span className="font-semibold">anteriores à Data de Início</span> são sobrescritas. Datas futuras válidas <span className="font-semibold">nunca são alteradas</span>.
                                </p>
                            </div>
                        )}

                        <div className="text-xs text-slate-400 self-end pb-1">
                            {selectedPedidos?.length
                                ? `${selectedPedidos.length} Pedido(s) selecionado(s)`
                                : `${selectedOps?.length ?? 0} OP(s) selecionada(s)`}
                        </div>
                    </div>

                    {/* ── RESOURCE CHART (aparece assim que há dados) ──────────── */}
                    {Object.keys(resourceChart).length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Clock className="w-4 h-4 text-indigo-500" />
                                <span className="text-sm font-bold text-slate-700">Carga por Recurso — Tempo Real</span>
                                {loading && <span className="ml-auto flex items-center gap-1 text-xs text-indigo-500 animate-pulse"><Loader2 className="w-3 h-3 animate-spin" />calculando...</span>}
                            </div>
                            <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
                                {Object.entries(resourceChart)
                                .sort(([a], [b]) => a.localeCompare(b))
                                    .map(([recurso, info]) => {
                                        // Normaliza: nunca deixa um dia exceder capDia visualmente.
                                        // Excesso transborda para o próximo dia útil como nova barra.
                                        const nextWorkingDay = (dateStr) => {
                                            const d = new Date(dateStr + 'T12:00:00');
                                            d.setDate(d.getDate() + 1);
                                            while (true) {
                                                const dow = d.getDay();
                                                if (dow !== 0 && (dow !== 6 || includeSaturday)) break;
                                                d.setDate(d.getDate() + 1);
                                            }
                                            return d.toISOString().split('T')[0];
                                        };

                                        const rawDates = Object.entries(info.dates).sort(([a], [b]) => a.localeCompare(b));
                                        const normalizedDates = {};
                                        for (const [date, allocated] of rawDates) {
                                            let remaining = allocated;
                                            let cur = date;
                                            let safety = 0;
                                            while (remaining > 0 && safety++ < 60) {
                                                const jaOcupado = normalizedDates[cur] || 0;
                                                const espaco = Math.max(0, info.capDia - jaOcupado);
                                                if (espaco > 0) {
                                                    const canFit = Math.min(remaining, espaco);
                                                    normalizedDates[cur] = jaOcupado + canFit;
                                                    remaining -= canFit;
                                                }
                                                if (remaining > 0) cur = nextWorkingDay(cur);
                                            }
                                        }
                                        const sortedDates = Object.entries(normalizedDates).sort(([a], [b]) => a.localeCompare(b));

                                        return (
                                            <div key={recurso}>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-xs font-bold text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded">{recurso}</span>
                                                    {info.desc && info.desc !== recurso && (
                                                        <span className="text-xs font-semibold text-indigo-600">{info.desc}</span>
                                                    )}
                                                    <span className="text-xs text-slate-400 ml-auto">cap. {info.capDia} min/dia</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {sortedDates.map(([date, allocated]) => {
                                                        const pct = (allocated / info.capDia) * 100;
                                                        const d = new Date(date + 'T12:00:00');
                                                        const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' });
                                                        const color = pct >= 100 ? 'bg-red-500' : pct > 79 ? 'bg-amber-400' : 'bg-emerald-500';
                                                        const textColor = pct >= 100 ? 'text-red-600' : pct > 79 ? 'text-amber-600' : 'text-emerald-600';
                                                        return (
                                                            <div key={date} className="flex items-center gap-2">
                                                                <span className="text-[10px] text-slate-500 w-24 shrink-0 font-mono">{label}</span>
                                                                <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                                                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                                                    />
                                                                </div>
                                                                <span className={`text-[10px] font-bold w-12 text-right shrink-0 ${textColor}`}>
                                                                    {Math.round(pct)}%
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 shrink-0">{Math.round(allocated)}m</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Normal (&lt;80%)</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Alto (80–100%)</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Sobrecarga (&gt;100%)</span>
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

                    {/* ── CONSOLE DE LOGS ──────────────────────────────────────── */}
                    {agentLogs.length > 0 && (
                        <div className="bg-slate-900 rounded-xl p-4 font-mono shadow-inner border border-slate-700">
                            <div className="flex items-center gap-2 mb-3 text-indigo-400 border-b border-slate-700 pb-2">
                                <BrainCircuit className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Console do Agente FCS</span>
                            </div>
                            <div
                                className="max-h-56 overflow-y-auto space-y-2 pr-1"
                                onWheel={() => setAutoScroll(false)}
                                onScroll={(e) => {
                                    const { scrollTop, scrollHeight, clientHeight } = e.target;
                                    if (scrollHeight - scrollTop - clientHeight < 10) setAutoScroll(true);
                                }}
                            >
                                {agentLogs.map((log, idx) => (
                                    <div key={idx} className="flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                        <span className="text-slate-500 shrink-0 text-[10px] mt-0.5">[{log.time.toLocaleTimeString([], { hour12: false })}]</span>
                                        <div className="shrink-0 mt-0.5">{log.icon}</div>
                                        <span className="text-slate-200 text-xs leading-relaxed">{log.msg}</span>
                                    </div>
                                ))}
                                {loading && (
                                    <div className="flex items-center gap-2 text-indigo-400 animate-pulse mt-1">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span className="text-xs">Processando...</span>
                                    </div>
                                )}
                                <div ref={logsEndRef} />
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
    </>
    );
}
