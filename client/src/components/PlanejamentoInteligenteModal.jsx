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
    const [loading, setLoading] = useState(false);
    const [missingTimes, setMissingTimes] = useState([]);
    const [successMessage, setSuccessMessage] = useState('');
    const [agentLogs, setAgentLogs] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [showReport, setShowReport] = useState(false);
    const logsEndRef = useRef(null);

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
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const addLog = (msg, icon) => {
        setAgentLogs(prev => [...prev, { msg, icon, time: new Date() }]);
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
                data_inicio: dataInicio
            });

            // Se o backend retornou agent_logs, vamos iterá-los para exibir aos poucos (efeito "digitação")
            if (res.data.agent_logs && res.data.agent_logs.length > 0) {
                setAgentLogs([]); // Limpa o inicial
                
                // Exibe os logs do backend com um pequeno delay entre eles para o usuário ler o raciocínio
                for (let i = 0; i < res.data.agent_logs.length; i++) {
                    const log = res.data.agent_logs[i];
                    
                    let icon = <Cpu className="w-4 h-4 text-slate-400" />;
                    if (log.includes('Iniciando') || log.includes('ESTUDO')) icon = <BrainCircuit className="w-4 h-4 text-indigo-500" />;
                    else if (log.includes('Obtendo') || log.includes('Buscando') || log.includes('Salvando')) icon = <Database className="w-4 h-4 text-blue-500" />;
                    else if (log.includes('Alocados')) icon = <Clock className="w-4 h-4 text-emerald-500" />;
                    else if (log.includes('Sem capacidade') || log.includes('Transição')) icon = <Calendar className="w-4 h-4 text-amber-500" />;
                    
                    addLog(log, icon);
                    // Pausa rápida entre os logs reais. 
                    // Reduzido para 50ms para não travar o processamento, já que o scroll pode ser parado manualmente para leitura.
                    await new Promise(r => setTimeout(r, 50));
                }
            } else {
                addLog('Processamento concluído de forma instantânea.', <CheckCircle className="w-4 h-4 text-green-500" />);
            }

            setSuccessMessage(`Sucesso! ${res.data.plans} operações sequenciadas pelo agente de IA.`);
            toast.success('Planejamento inteligente aplicado com sucesso!');
            
            // Salva o relatório estruturado do backend
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
                <div className="p-6 flex-1 overflow-y-auto bg-slate-50">
                    
                    {successMessage ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in duration-300">
                            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Planejamento Concluído</h3>
                            <p className="text-slate-600 font-medium">{successMessage}</p>
                            {reportData && (
                                <button
                                    onClick={() => setShowReport(true)}
                                    className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
                                >
                                    <FileText className="w-4 h-4" />
                                    Ver Relatório do Agente
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            
                            {/* ESTADO INICIAL / ENTRADA DE DADOS */}
                            {agentLogs.length === 0 && !loading && (
                                <>
                                    <div className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm flex gap-4 items-start">
                                        <div className="p-2 bg-indigo-50 rounded-full text-indigo-600 shrink-0 mt-1">
                                            <Bot className="w-5 h-5" />
                                        </div>
                                        <div className="text-slate-700 text-sm leading-relaxed">
                                            <p className="font-semibold mb-1">Olá! Eu sou o especialista em PCP.</p>
                                            <p>Vou analisar <strong>{selectedOps.length}</strong> ordem(ns) de produção selecionada(s). Meu algoritmo irá respeitar a hierarquia do roteiro e a capacidade diária de cada recurso. Se o recurso atingir o limite, forçarei a transição para o próximo dia automaticamente.</p>
                                        </div>
                                    </div>

                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            Data de Início do Agendamento
                                        </label>
                                        <input 
                                            type="date" 
                                            value={dataInicio}
                                            onChange={(e) => setDataInicio(e.target.value)}
                                            className="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium text-slate-700"
                                        />
                                        <p className="text-xs text-slate-500 mt-2">A partir desta data, distribuirei a carga produtiva respeitando a capacidade finita.</p>
                                    </div>
                                </>
                            )}

                            {/* LOGS DO AGENTE (PROCESSAMENTO) */}
                            {agentLogs.length > 0 && (
                                <div className="bg-slate-900 rounded-xl p-5 font-mono text-sm shadow-inner border border-slate-700 text-slate-300">
                                    <div className="flex items-center gap-2 mb-4 text-indigo-400 border-b border-slate-700 pb-2">
                                        <BrainCircuit className="w-5 h-5" />
                                        <span className="font-bold uppercase tracking-wider">Console do Agente FCS</span>
                                    </div>
                                    <div 
                                        className="max-h-72 overflow-y-auto space-y-3 pr-1 scrollbar-thin"
                                        onWheel={() => setAutoScroll(false)}
                                        onTouchMove={() => setAutoScroll(false)}
                                        onScroll={(e) => {
                                            const { scrollTop, scrollHeight, clientHeight } = e.target;
                                            // Se chegou perto do final da div (margem de 10px), volta a rolar automaticamente
                                            if (scrollHeight - scrollTop - clientHeight < 10) {
                                                setAutoScroll(true);
                                            }
                                        }}
                                    >
                                        {agentLogs.map((log, idx) => (
                                            <div key={idx} className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <span className="text-slate-500 shrink-0 text-xs">
                                                    [{log.time.toLocaleTimeString([], { hour12: false })}]
                                                </span>
                                                <div className="shrink-0 mt-0.5">
                                                    {log.icon}
                                                </div>
                                                <span className="text-slate-200 text-xs leading-relaxed">{log.msg}</span>
                                            </div>
                                        ))}
                                        {loading && (
                                            <div className="flex items-center gap-3 text-indigo-400 animate-pulse mt-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span className="text-xs">Aguardando próximo pensamento...</span>
                                            </div>
                                        )}
                                        {/* Sentinel para auto-scroll */}
                                        <div ref={logsEndRef} />
                                    </div>
                                </div>
                            )}

                            {/* EXIBIÇÃO DE ERROS DE TEMPO */}
                            {missingTimes.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div className="flex items-center gap-2 text-red-700 font-bold mb-3">
                                        <AlertTriangle className="w-5 h-5" />
                                        <h3>Atenção! Faltam Tempos de Operação</h3>
                                    </div>
                                    <p className="text-sm text-red-600 mb-4">
                                        O algoritmo foi interrompido porque os seguintes itens não possuem tempo padrão cadastrado. <strong>O preenchimento é obrigatório para calcular a capacidade.</strong>
                                    </p>
                                    
                                    <div className="max-h-48 overflow-y-auto border border-red-100 rounded-lg bg-white">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-red-50 sticky top-0 text-red-800 text-xs uppercase shadow-sm">
                                                <tr>
                                                    <th className="px-3 py-2 font-bold">Produto</th>
                                                    <th className="px-3 py-2 font-bold">Recurso</th>
                                                    <th className="px-3 py-2 font-bold">Operação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-red-50">
                                                {missingTimes.map((err, idx) => (
                                                    <tr key={idx} className="hover:bg-red-50/50 transition-colors">
                                                        <td className="px-3 py-2 font-mono text-xs font-semibold">{err.produto}</td>
                                                        <td className="px-3 py-2 text-slate-700">{err.recurso}</td>
                                                        <td className="px-3 py-2 text-slate-700">{err.operacao}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="mt-3 text-xs text-red-600 italic font-medium bg-red-100/50 p-2 rounded">
                                        Dica: Vá até a aba "Configurações &gt; PCP Refinado" e defina o Tempo Padrão para estes recursos, ou atualize o roteiro no ERP.
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                </div>

                {/* FOOTER */}
                {!successMessage && !missingTimes.length && !loading && (
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                        <button 
                            onClick={onClose}
                            className="px-5 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handlePlan}
                            disabled={!dataInicio || selectedOps.length === 0}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        >
                            <Play className="w-4 h-4" />
                            Executar Planejamento
                        </button>
                    </div>
                )}
                
                {missingTimes.length > 0 && !loading && (
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                        <button 
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-all shadow-md active:scale-95"
                        >
                            Entendi, vou corrigir
                        </button>
                    </div>
                )}

                {successMessage && !loading && (
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                        <button 
                            onClick={onClose}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-md active:scale-95"
                        >
                            Fechar
                        </button>
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
