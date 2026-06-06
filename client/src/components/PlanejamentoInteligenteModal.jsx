import React, { useState, useEffect, useRef } from 'react';
import { Bot, Calendar, Play, AlertTriangle, X, CheckCircle, Clock, Loader2, BrainCircuit, Database, Cpu, FileText } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-toastify';
import SmartPlannerReport from './SmartPlannerReport';

export default function PlanejamentoInteligenteModal({ isOpen, onClose, selectedOps, onPlanSuccess }) {
    const getTodayDate = () => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    };

    const [dataInicio, setDataInicio] = useState(getTodayDate());
    const [includeSaturday, setIncludeSaturday] = useState(false);
    const [loading, setLoading] = useState(false);
    const [missingTimes, setMissingTimes] = useState([]);
    const [successMessage, setSuccessMessage] = useState('');
    const [agentLogs, setAgentLogs] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [showReport, setShowReport] = useState(false);
    const [resourceChart, setResourceChart] = useState({});
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
            setAgentLogs([]);
            setReportData(null);
            setShowReport(false);
            setLoading(false);
            setAutoScroll(true);
            setResourceChart({});
            pendingAlloc.current = null;
            setIncludeSaturday(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const addLog = (msg, icon) => {
        setAgentLogs(prev => [...prev, { msg, icon, time: new Date() }]);
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

        if (!selectedOps || selectedOps.length === 0) {
            toast.warning('Nenhuma OP selecionada para planejamento.');
            return;
        }

        const opList = selectedOps.map(op => op.op || op.op_num);

        setLoading(true);
        setMissingTimes([]);
        setSuccessMessage('');
        setAgentLogs([]);

        try {
            // Visualização de carregamento inicial
            addLog('Iniciando comunicação com motor de sequenciamento FCS...', <BrainCircuit className="w-4 h-4 text-indigo-500" />);
            
            // Faz a requisição de fato
            const res = await api.post('/pcp-refinado/smart-plan', {
                ops: opList,
                data_inicio: dataInicio,
                include_saturday: includeSaturday
            }, {
                timeout: 600000 // 10 minutos (600000ms) para acomodar processamento global do FCS
            });

            // Se o backend retornou agent_logs, itera com delay (efeito "digitação") e parseia carga
            if (res.data.agent_logs && res.data.agent_logs.length > 0) {
                setAgentLogs([]);
                pendingAlloc.current = null;

                for (let i = 0; i < res.data.agent_logs.length; i++) {
                    const log = res.data.agent_logs[i];

                    let icon = <Cpu className="w-4 h-4 text-slate-400" />;
                    if (log.includes('Iniciando') || log.includes('ESTUDO')) icon = <BrainCircuit className="w-4 h-4 text-indigo-500" />;
                    else if (log.includes('Obtendo') || log.includes('Buscando') || log.includes('Salvando')) icon = <Database className="w-4 h-4 text-blue-500" />;
                    else if (log.includes('Alocados')) icon = <Clock className="w-4 h-4 text-emerald-500" />;
                    else if (log.includes('Sem capacidade') || log.includes('Transição')) icon = <Calendar className="w-4 h-4 text-amber-500" />;

                    addLog(log, icon);

                    // ── PARSER DE CARGA EM TEMPO REAL ──────────────────────────────
                    // Padrão: "↳ Operação 010 (MEC01): Faltam 5 peças. Requer 250 min. Cap/dia = 480 min."
                    const opMatch = log.match(/Operação\s+\w+\s+\((\w+)\).*Requer\s+([\d.]+)\s+min.*Cap\/dia\s*=\s*([\d.]+)\s*min/);
                    if (opMatch) {
                        pendingAlloc.current = {
                            recurso: opMatch[1],
                            minNeeded: parseFloat(opMatch[2]),
                            capDia: parseFloat(opMatch[3])
                        };
                    }
                    // Padrão: "→ Alocação concluída: de 2026-06-06 até 2026-06-08"
                    const allocMatch = log.match(/Aloca[çc][aã]o conclu[íi]da: de (\d{4}-\d{2}-\d{2}) at[eé] (\d{4}-\d{2}-\d{2})/);
                    if (allocMatch && pendingAlloc.current) {
                        const { recurso, minNeeded, capDia } = pendingAlloc.current;
                        const d1 = allocMatch[1], d2 = allocMatch[2];
                        // Distribui pelos dias úteis do span em vez de empilhar tudo no d1
                        const dayMap = distributeLoad(d1, d2, minNeeded, capDia, includeSaturday);
                        setResourceChart(prev => {
                            const next = { ...prev };
                            if (!next[recurso]) next[recurso] = { capDia, dates: {} };
                            next[recurso].dates = { ...next[recurso].dates };
                            Object.entries(dayMap).forEach(([d, min]) => {
                                next[recurso].dates[d] = (next[recurso].dates[d] || 0) + min;
                            });
                            return next;
                        });
                        pendingAlloc.current = null;
                    }
                    // ───────────────────────────────────────────────────────────────

                    await new Promise(r => setTimeout(r, 50));
                }
            } else {
                addLog('Processamento concluído de forma instantânea.', <CheckCircle className="w-4 h-4 text-green-500" />);
            }

            // Após conclusão: usa carga_diaria do report (dado real do resource_buckets do FCS)
            if (res.data.report?.carga_diaria) {
                setResourceChart(res.data.report.carga_diaria);
            }

            setSuccessMessage(`Sucesso! ${res.data.plans} operações sequenciadas pelo agente de IA.`);
            toast.success('Planejamento inteligente aplicado com sucesso!');

            if (res.data.report) setReportData(res.data.report);
            
            if (onPlanSuccess) onPlanSuccess();

        } catch (error) {
            if (error.response?.data?.missing_times) {
                setMissingTimes(error.response.data.missing_times);
                addLog('Falha: Roteiros incompletos identificados.', <AlertTriangle className="w-4 h-4 text-red-500" />);
                toast.error('Erro de validação: Faltam tempos de operação.');
            } else {
                addLog('Falha na execução do algoritmo FCS.', <AlertTriangle className="w-4 h-4 text-red-500" />);
                toast.error(error.response?.data?.error || 'Erro ao executar planejamento inteligente.');
            }
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
                            <h2 className="text-xl font-bold text-slate-800">Agente: Planejamento Inteligente</h2>
                            <p className="text-sm text-indigo-600 font-medium">Motor de Sequenciamento FCS (Capacidade Finita)</p>
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
                        <div className="text-xs text-slate-400 self-end pb-1">
                            {selectedOps.length} OP(s) selecionada(s)
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
                                                    <span className="text-xs text-slate-400">cap. {info.capDia} min/dia</span>
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
                        <div className="flex flex-col items-center py-6 text-center animate-in fade-in zoom-in duration-300">
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

                    {/* ── CONSOLE DE LOGS ──────────────────────────────────────── */}
                    {agentLogs.length > 0 && !successMessage && (
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
                {!successMessage && !missingTimes.length && !loading && (
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                        <button onClick={onClose} className="px-5 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors text-sm">Cancelar</button>
                        <button
                            onClick={handlePlan}
                            disabled={!dataInicio || selectedOps.length === 0}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm"
                        >
                            <Play className="w-4 h-4" /> Executar Planejamento
                        </button>
                    </div>
                )}
                {loading && (
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end shrink-0">
                        <button onClick={onClose} className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors text-sm border border-slate-200">
                            Cancelar Processamento
                        </button>
                    </div>
                )}
                {missingTimes.length > 0 && !loading && (
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end shrink-0">
                        <button onClick={onClose} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 text-sm">Entendi, vou corrigir</button>
                    </div>
                )}
                {successMessage && !loading && (
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end shrink-0">
                        <button onClick={onClose} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 text-sm">Fechar</button>
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
