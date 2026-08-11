import React, { useState, useEffect, useRef } from 'react';
import { Save, Clock, X, CheckSquare, ChevronRight, CheckCircle, AlertTriangle, History, ChevronDown, ChevronUp, Play, Pause, Square, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAppointmentHistory, getCompanySettings, getOpRoteiroSaldo, saveAppointment } from '../services/api';
import { useTimer } from '../contexts/TimerContext';

export default function ProductionAppointmentModal({ op, onClose, onSave }) {
    const { user, hasPermission } = useAuth();
    const { timers, startTimer, pauseTimer, restartTimer, getElapsedTime } = useTimer();
    const timerId = `${op.op}_${op.item_op || '01'}_${op.sequen || '001'}_${op.operacao}`;
    const globalTimer = timers[timerId] || null;

    // Default to current time range
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const isRunning = globalTimer?.isRunning || false;
    const startedAtStr = globalTimer?.startedAt
        ? new Date(globalTimer.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : null;

    const [formData, setFormData] = useState({
        data_inicio: oneHourAgo.toISOString().split('T')[0],
        hora_inicio: oneHourAgo.toTimeString().slice(0, 5),
        data_fim: now.toISOString().split('T')[0],
        hora_fim: now.toTimeString().slice(0, 5),
        observacao: ''
    });

    const [routeOperations, setRouteOperations] = useState([]);
    const [quantities, setQuantities] = useState({});
    const isSubmittingRef = useRef(false);

    const [loadingOps, setLoadingOps] = useState(true);

    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [appointmentMode, setAppointmentMode] = useState(null);
    const [enableMultiOp, setEnableMultiOp] = useState(hasPermission('action_pcp_multi_appointment', 'view'));

    // Auto-focus logic
    const qtdInputRef = useRef(null);
    useEffect(() => {
        const timer = setTimeout(() => {
            if (qtdInputRef.current) {
                qtdInputRef.current.focus();
            }
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const handleStartStopwatch = () => {
        startTimer(op);
        onClose(); // Hide Modal when timer starts
    };

    const handlePauseStopwatch = () => {
        pauseTimer(timerId);
    };

    const handleStopStopwatch = () => {
        pauseTimer(timerId);
        // Fill form dates from timer timestamps
        const startDate = globalTimer?.startedAt ? new Date(globalTimer.startedAt) : oneHourAgo;
        const endDate = new Date();
        setFormData(prev => ({
            ...prev,
            data_inicio: startDate.toISOString().split('T')[0],
            hora_inicio: startDate.toTimeString().slice(0, 5),
            data_fim: endDate.toISOString().split('T')[0],
            hora_fim: endDate.toTimeString().slice(0, 5)
        }));
    };

    const handleRestartStopwatch = () => {
        restartTimer(timerId);
        onClose();
    };

    // Load operations and history
    useEffect(() => {
        loadHistory();
        loadRouteOps();
        getCompanySettings()
            .then(data => {
                setAppointmentMode(data?.general_config?.production_appointment_mode || 'free');
            })
            .catch(() => {
                setAppointmentMode('free');
            });
    }, []);

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const data = await getAppointmentHistory(
                op.op, op.item_op, op.sequen, op.operacao
            );
            setHistory(data || []);
        } catch (err) {
            console.error('Erro ao carregar histórico:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const loadRouteOps = async () => {
        setLoadingOps(true);
        try {
            const codProduto = op.cod_produto_op || op.produto; // Handle different property names from parent
            
            // Pre-fill the current operation with fallback balance initially
            const fallbackBalance = Math.max(0, (Number(op.qtd_planejada_op) || 0) - (Number(op.qtd_produzida_real) || 0));
            setQuantities({ [op.operacao]: fallbackBalance > 0 ? fallbackBalance : '' });

            if (!codProduto) {
                console.warn("Sem cod_produto_op, incapaz de buscar roteiro completo");
                setLoadingOps(false);
                return;
            }
            
            const ops = await getOpRoteiroSaldo(op.op, op.item_op, op.sequen, codProduto);
            
            // Find current operation index (op.operacao might be '01' or 'MO0010')
            const currentIndex = ops.findIndex(o => 
                String(o.operacao_codigo).trim() === String(op.operacao).trim() || 
                String(o.recurso_codigo).trim() === String(op.operacao).trim()
            );
            
            // Se encontrar, corta a lista até ela. Se não encontrar, mostra tudo.
            const visibleOps = currentIndex >= 0 ? ops.slice(0, currentIndex + 1) : ops;
            
            setRouteOperations(visibleOps);

            // Auto-fill all quantities with the available balance (saldo)
            const initialQuantities = {};
            visibleOps.forEach(row => {
                initialQuantities[row.operacao_codigo] = row.saldo > 0 ? row.saldo : '';
            });
            setQuantities(initialQuantities);
            
        } catch (err) {
            console.error('Erro ao buscar roteiro:', err);
        } finally {
            setLoadingOps(false);
        }
    };

    const handleQuantityChange = (opCode, value) => {
        setQuantities(prev => {
            const nextState = { ...prev, [opCode]: value };
            
            // Auto-preenchimento: Se a operação alterada for a ATUAL, 
            // propaga o valor para todas as operações anteriores
            if (Number(opCode) === Number(op.operacao)) {
                const numValue = Number(value);
                
                routeOperations.forEach(row => {
                    if (Number(row.operacao_codigo) !== Number(op.operacao)) {
                        // Respeita o limite do saldo da operação anterior
                        const maxAllowed = row.saldo;
                        
                        if (value === '') {
                            nextState[row.operacao_codigo] = '';
                        } else if (!isNaN(numValue) && maxAllowed > 0) {
                            nextState[row.operacao_codigo] = Math.min(numValue, maxAllowed);
                        }
                    }
                });
            }
            
            return nextState;
        });
    };

    const isExceedingBalance = () => {
        if (!enableMultiOp || routeOperations.length === 0) {
            const val = Number(quantities[op.operacao] || 0);
            return val > fallbackBalance;
        }

        for (const row of routeOperations) {
            const val = Number(quantities[row.operacao_codigo] || 0);
            if (val > row.saldo) return true;
        }
        return false;
    };

    const getTotalQuantity = () => {
        if (!enableMultiOp || routeOperations.length === 0) {
            return Number(quantities[op.operacao] || 0);
        }
        return Object.values(quantities).reduce((sum, val) => sum + Number(val || 0), 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (loading || isSubmittingRef.current) return;

        if (isExceedingBalance()) {
            return; // Validação visual já deve impedir
        }

        if (getTotalQuantity() <= 0) {
            alert("Preencha a quantidade em pelo menos uma operação.");
            return;
        }

        isSubmittingRef.current = true;
        
        // Sumir com o modal imediatamente da tela do usuário
        onClose();

        try {
            const start = `${formData.data_inicio} ${formData.hora_inicio}:00`;
            const end = `${formData.data_fim} ${formData.hora_fim}:00`;

            let opsToSave = [];
            if (enableMultiOp && routeOperations.length > 0) {
                opsToSave = routeOperations.filter(row => Number(quantities[row.operacao_codigo]) > 0);
            } else {
                if (Number(quantities[op.operacao]) > 0) {
                    opsToSave = [{ operacao_codigo: op.operacao }];
                }
            }
            
            const savedPayloads = [];

            // Dispara salvar para cada operacao escolhida sequencialmente no background
            for (const opRow of opsToSave) {
                const userName = user?.nome || user?.login || 'Desconhecido';
                const finalUserName = userName;

                const payload = {
                    op_numero: op.op,
                    op_item: op.item_op,
                    op_sequencia: op.sequen,
                    operacao_codigo: opRow.operacao_codigo,
                    usuario: finalUserName,
                    quantidade: quantities[opRow.operacao_codigo],
                    data_inicio: start,
                    data_fim: end,
                    observacao: formData.observacao,
                    skip_cascade: true
                };
                
                await saveAppointment(payload);
                savedPayloads.push(payload);
            }

            // Notifica o componente pai sobre a conclusão do salvamento para atualizar a listagem
            if (savedPayloads.length > 0) {
                onSave(savedPayloads);
            }
        } catch (error) {
            // Como o modal já sumiu, lidamos com erros em background
            if (error.response?.status === 409) {
                console.warn('Backend bloqueou submissão duplicada (Double Click).');
            } else {
                const errorMsg = 'Erro ao salvar apontamento no background: ' + (error.response?.data?.error || error.response?.data?.message || error.message);
                console.error(errorMsg);
                alert(errorMsg);
            }
        }
    };

    // If route ops loading fails or is missing, use current OP fallback for balances
    const fallbackBalance = Math.max(0, (Number(op.qtd_planejada_op) || 0) - (Number(op.qtd_produzida_real) || 0));

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <CheckSquare className="w-5 h-5 text-green-600" />
                        Apontamento Multi-Operação
                    </h3>
                    <div className="flex items-center gap-2">
                        {appointmentMode && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                appointmentMode === 'sequence' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                appointmentMode === 'balance'  ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                  'bg-slate-100 text-slate-500 border-slate-300'
                            }`}>
                                {appointmentMode === 'sequence' ? 'Modo: Sequencia' :
                                 appointmentMode === 'balance'  ? 'Modo: Saldo' :
                                                                   'Modo: Livre'}
                            </span>
                        )}
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {/* INFO BOX */}
                    <div className="bg-slate-50 p-2 rounded text-xs border border-slate-200 flex justify-between items-center">
                        <div>
                            <p><strong>OP:</strong> {op.op} - {op.item_op} - Seq: {op.sequen} <span className="text-slate-500">({op.desc_produto})</span></p>
                            <p><strong>Operação Atual:</strong> {op.operacao} <span className="text-slate-500">({op.desc_operacao})</span></p>
                            {op.produzido_mae > 0 && (
                                <p className="text-[10px] text-indigo-600 mt-1 font-semibold border border-indigo-200 bg-indigo-50 inline-block px-1 rounded">
                                    Herdado da OP Mãe: {op.produzido_mae} pçs apontadas.
                                </p>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="text-slate-500">Usuário:</p>
                            <p className="font-bold text-slate-700">{user?.nome || user?.login}</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* STOPWATCH MODULE — Static display, no live counter */}
                        <div className="bg-white border rounded-lg p-3 text-center shadow-sm">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Cronômetro de Operação ({op.operacao})</div>
                            <div className="font-mono text-2xl font-bold tracking-wider text-slate-800 mb-3">
                                {isRunning
                                    ? <span className="text-emerald-600">▶ Iniciado {startedAtStr}</span>
                                    : startedAtStr
                                        ? <span className="text-slate-600">⏸ Parado — Início: {startedAtStr}</span>
                                        : <span className="text-slate-400">Pronto para iniciar</span>
                                }
                            </div>
                            <div className="flex justify-center gap-2">
                                {!isRunning ? (
                                    <button
                                        type="button"
                                        onClick={handleStartStopwatch}
                                        className="flex items-center gap-1 bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-1.5 rounded-md font-semibold text-sm transition-colors"
                                    >
                                        <Play className="w-4 h-4" />
                                        {globalTimer ? 'Reiniciar' : 'Iniciar'}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handlePauseStopwatch}
                                        className="flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-700 px-4 py-1.5 rounded-md font-semibold text-sm transition-colors"
                                    >
                                        <Pause className="w-4 h-4" />
                                        Pausar
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleStopStopwatch}
                                    disabled={!globalTimer}
                                    className="flex items-center gap-1 bg-rose-100 hover:bg-rose-200 text-rose-700 px-4 py-1.5 rounded-md font-semibold text-sm transition-colors disabled:opacity-50"
                                >
                                    <Square className="w-4 h-4" />
                                    Cessar Tempo
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRestartStopwatch}
                                    disabled={!globalTimer}
                                    className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-1.5 rounded-md font-semibold text-sm transition-colors disabled:opacity-50"
                                    title="Zerar Cronômetro"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Zerar
                                </button>
                            </div>
                        </div>

                        {/* LISTA MULTI-OPERAÇÕES */}
                        <div className="bg-slate-50 rounded border overflow-hidden">
                            <div className="bg-slate-100 px-3 py-2 border-b">
                                <h4 className="text-xs font-bold text-slate-700">Operações do Roteiro (Até a atual)</h4>
                            </div>
                            
                            {loadingOps ? (
                                <div className="p-4 text-center text-sm text-slate-500 animate-pulse">
                                    Carregando roteiro e saldos...
                                </div>
                            ) : enableMultiOp && routeOperations.length > 0 ? (
                                <div className="divide-y divide-slate-200">
                                    {routeOperations.map((row, idx) => {
                                        const isCurrent = Number(row.operacao_codigo) === Number(op.operacao);
                                        const val = quantities[row.operacao_codigo] || '';
                                        const exceed = Number(val) > row.saldo;

                                        return (
                                            <div key={row.operacao_codigo} className={`p-3 flex items-center justify-between transition-colors ${isCurrent ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-bold ${isCurrent ? 'text-blue-700' : 'text-slate-600'}`}>
                                                            {row.operacao_codigo} - {row.operacao_desc}
                                                        </span>
                                                        {isCurrent && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">Atual</span>}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-1">
                                                        Planejado: {row.qtd_planejada_op} | Já Prod: {row.qtd_produzida_real} | <span className="font-bold">Saldo: {row.saldo}</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="w-32 flex flex-col items-end gap-1">
                                                    <div className="relative w-full">
                                                        <input 
                                                            type="number" 
                                                            step="0.01"
                                                            max={row.saldo}
                                                            ref={isCurrent ? qtdInputRef : null}
                                                            className={`w-full border rounded p-1.5 text-sm font-bold text-right outline-none transition-colors ${
                                                                exceed ? 'border-red-500 focus:border-red-600 text-red-600' : 
                                                                val ? 'border-blue-300 focus:border-blue-500 bg-blue-50/50' : 'border-slate-300 focus:border-blue-500'
                                                            }`}
                                                            value={val} 
                                                            onChange={e => handleQuantityChange(row.operacao_codigo, e.target.value)}
                                                            placeholder={`Max ${row.saldo}`} 
                                                        />
                                                    </div>
                                                    {exceed && (
                                                        <span className="text-[9px] text-red-600 font-bold flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            Excede saldo!
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-4 flex flex-col gap-3">
                                    {!enableMultiOp ? (
                                        <span className="text-xs text-slate-600 border border-amber-200 bg-amber-50 p-2 rounded">
                                            Modo Multi-Operação desativado. Apontamento restrito à operação atual.
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-600 border border-slate-200 bg-slate-50 p-2 rounded">
                                            Não foi possível carregar o roteiro múltiplo. Modo simples ativado.
                                        </span>
                                    )}
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-bold text-slate-700">Qtd. Produzida</label>
                                        <span className="text-xs font-bold text-slate-500">Saldo: {fallbackBalance}</span>
                                    </div>
                                    <input type="number" step="0.01" required
                                        ref={qtdInputRef}
                                        max={fallbackBalance}
                                        className="w-full border rounded p-2 text-lg text-slate-900 border-slate-300 focus:border-green-500 outline-none"
                                        value={quantities[op.operacao] || ''} 
                                        onChange={e => handleQuantityChange(op.operacao, e.target.value)}
                                        placeholder={`Máx: ${fallbackBalance}`} autoFocus />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 border rounded p-1.5 focus-within:border-green-500">
                                <div className="flex flex-col flex-1 pl-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Início Geral</label>
                                    <div className="flex gap-1">
                                        <input type="date" required className="w-[100px] text-xs outline-none bg-transparent"
                                            value={formData.data_inicio} onChange={e => setFormData({ ...formData, data_inicio: e.target.value })} />
                                        <input type="time" required className="flex-1 text-xs outline-none bg-transparent"
                                            value={formData.hora_inicio} onChange={e => setFormData({ ...formData, hora_inicio: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 border rounded p-1.5 focus-within:border-green-500">
                                <div className="flex flex-col flex-1 pl-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Fim Geral</label>
                                    <div className="flex gap-1">
                                        <input type="date" required className="w-[100px] text-xs outline-none bg-transparent"
                                            value={formData.data_fim} onChange={e => setFormData({ ...formData, data_fim: e.target.value })} />
                                        <input type="time" required className="flex-1 text-xs outline-none bg-transparent"
                                            value={formData.hora_fim} onChange={e => setFormData({ ...formData, hora_fim: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Observação</label>
                            <textarea className="w-full border rounded p-2 text-sm" rows="2"
                                value={formData.observacao} onChange={e => setFormData({ ...formData, observacao: e.target.value })}></textarea>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || isExceedingBalance() || getTotalQuantity() <= 0}
                            className="w-full bg-green-600 text-white rounded-lg p-3 font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-sm transition-colors text-sm"
                        >
                            <Save className="w-5 h-5" />
                            {loading ? 'Salvando...' : 'Confirmar Apontamentos'}
                        </button>
                    </form>

                    {/* HISTORY SECTION */}
                    {loadingHistory ? (
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded text-center text-sm text-slate-500 mt-4">
                            <History className="w-4 h-4 inline-block mr-2 animate-pulse" />
                            Carregando histórico...
                        </div>
                    ) : history.length > 0 ? (
                        <div className="bg-slate-50 border border-slate-200 rounded overflow-hidden mt-4">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-100 transition-colors"
                            >
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                    <History className="w-4 h-4 text-slate-500" />
                                    Histórico Atual ({history.length} apontamento{history.length !== 1 ? 's' : ''})
                                </span>
                                {showHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </button>

                            {showHistory && (
                                <div className="max-h-60 overflow-y-auto border-t border-slate-200">
                                    {history.slice(0, 10).map((item, idx) => {
                                        const dataFim = new Date(item.data_fim);
                                        const isToday = dataFim.toDateString() === new Date().toDateString();

                                        return (
                                            <div key={idx} className="p-3 border-b border-slate-100 last:border-b-0 hover:bg-white transition-colors">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold text-sm">
                                                            {parseFloat(item.quantidade).toFixed(2)} pc
                                                        </div>
                                                        <span className="text-xs text-slate-600 font-medium">{item.usuario}</span>
                                                    </div>
                                                    <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                                                        {isToday ? 'Hoje' : dataFim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                        {' '}{dataFim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {(item.conferencia_status || item.conferencia_obs) && (
                                                    <div className="flex flex-wrap items-center gap-2 mt-1.5 mb-1 text-[10px]">
                                                        {item.conferencia_status === 'OK' && <span className="text-green-600 font-bold border border-green-200 bg-green-50 px-1.5 py-0.5 rounded">Conf: OK</span>}
                                                        {item.conferencia_status === 'PENDENTE' && <span className="text-amber-600 font-bold border border-amber-200 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Conf: Pendente</span>}
                                                        {item.conferencia_status === 'DIVERGENTE' && <span className="text-red-600 font-bold border border-red-200 bg-red-50 px-1.5 py-0.5 rounded">Conf: Divergente</span>}
                                                        {item.conferido_por && <span className="text-slate-500 italic">por {item.conferido_por}</span>}
                                                    </div>
                                                )}

                                                {item.conferencia_obs && (
                                                    <div className="text-[10px] text-red-600 italic bg-red-50 border border-red-100 px-2 py-1 rounded mt-1">
                                                        <span className="font-bold">Nota do Conferente:</span> {item.conferencia_obs}
                                                    </div>
                                                )}
                                                {item.observacao && (
                                                    <div className="text-xs text-slate-500 italic bg-slate-50 px-2 py-1 rounded mt-1">
                                                        "{item.observacao}"
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded text-sm text-blue-700 flex items-center gap-2 mt-4">
                            <History className="w-4 h-4" />
                            <span>Nenhum apontamento anterior encontrado para esta operação.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
