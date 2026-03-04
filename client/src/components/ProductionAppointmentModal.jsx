import React, { useState, useEffect } from 'react';
import { Save, Clock, X, CheckSquare, ChevronRight, CheckCircle, AlertTriangle, History, ChevronDown, ChevronUp, Play, Pause, Square, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAppointmentHistory } from '../services/api';
import { useTimer } from '../contexts/TimerContext';

export default function ProductionAppointmentModal({ op, onClose, onSave }) {
    const { user } = useAuth();
    const { timers, startTimer, pauseTimer, restartTimer, getElapsedTime } = useTimer();
    const timerId = `${op.op}_${op.item_op || '01'}_${op.sequen || '001'}_${op.operacao}`;
    const globalTimer = timers[timerId] || null;

    // Default to current time range
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const planned = Number(op.qtd_planejada_op) || 0;
    const produced = Number(op.qtd_produzida_real) || 0;
    const balance = Math.max(0, planned - produced);

    const isRunning = globalTimer?.isRunning || false;
    const startedAtStr = globalTimer?.startedAt
        ? new Date(globalTimer.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : null;
    const [formData, setFormData] = useState({
        data_inicio: oneHourAgo.toISOString().split('T')[0],
        hora_inicio: oneHourAgo.toTimeString().slice(0, 5),
        data_fim: now.toISOString().split('T')[0],
        hora_fim: now.toTimeString().slice(0, 5),
        quantidade: '',
        observacao: ''
    });
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [showHistory, setShowHistory] = useState(false);

    // No tick interval — purely event-driven

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

    // Load history on mount
    useEffect(() => {
        loadHistory();
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        const qty = Number(formData.quantidade);
        if (qty > balance) {
            // Validação visual já deve impedir, mas duplo check
            return;
        }

        setLoading(true);
        try {
            const start = `${formData.data_inicio} ${formData.hora_inicio}:00`;
            const end = `${formData.data_fim} ${formData.hora_fim}:00`;

            await onSave({
                op_numero: op.op,
                op_item: op.item_op,
                op_sequencia: op.sequen,
                operacao_codigo: op.operacao,
                usuario: user?.nome || user?.login || 'Desconhecido',
                quantidade: formData.quantidade,
                data_inicio: start,
                data_fim: end,
                observacao: formData.observacao
            });
            onClose();
        } catch (error) {
            alert('Erro ao salvar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <CheckSquare className="w-5 h-5 text-green-600" />
                        Apontar Produção
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4">

                    {/* INFO BOX - Compacto */}
                    <div className="bg-slate-50 p-2 rounded text-xs border border-slate-200 flex justify-between items-center">
                        <div>
                            <p><strong>OP:</strong> {op.op} <span className="text-slate-500">({op.desc_produto})</span></p>
                            <p><strong>Proc:</strong> {op.operacao} <span className="text-slate-500">({op.desc_operacao})</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-slate-500">Usuário:</p>
                            <p className="font-bold text-slate-700">{user?.nome || user?.login}</p>
                        </div>
                    </div>

                    {/* FLOW GUIDANCE - Compacto */}
                    {op.next_desc_operacao ? (
                        <div className="bg-blue-50 border border-blue-100 px-3 py-1.5 rounded flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-blue-800">
                                <ChevronRight className="w-3 h-3 text-blue-600" />
                                <span className="font-semibold">Destino:</span>
                                <span>{op.next_desc_operacao}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-green-50 border border-green-100 px-3 py-1.5 rounded flex items-center gap-2 text-xs text-green-800">
                            <CheckCircle className="w-3 h-3" />
                            <span className="font-semibold">Processo Final</span> - Enviar p/ Estoque/Expedição
                        </div>
                    )}

                    {/* HISTORY SECTION */}
                    {loadingHistory ? (
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded text-center text-sm text-slate-500">
                            <History className="w-4 h-4 inline-block mr-2 animate-pulse" />
                            Carregando histórico...
                        </div>
                    ) : history.length > 0 ? (
                        <div className="bg-slate-50 border border-slate-200 rounded overflow-hidden">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-100 transition-colors"
                            >
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                    <History className="w-4 h-4 text-slate-500" />
                                    Histórico ({history.length} apontamento{history.length !== 1 ? 's' : ''})
                                </span>
                                {showHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </button>

                            {showHistory && (
                                <div className="max-h-60 overflow-y-auto border-t border-slate-200">
                                    {history.slice(0, 10).map((item, idx) => {
                                        const dataInicio = new Date(item.data_inicio);
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
                                                    <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-500'
                                                        }`}>
                                                        {isToday ? 'Hoje' : dataFim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                        {' '}{dataFim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
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
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded text-sm text-blue-700 flex items-center gap-2">
                            <History className="w-4 h-4" />
                            <span>Nenhum apontamento anterior encontrado</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3">
                        {/* STOPWATCH MODULE — Static display, no live counter */}
                        <div className="bg-white border rounded-lg p-3 text-center shadow-sm">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Cronômetro de Operação</div>
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

                        <div className="bg-slate-50 p-2.5 rounded border">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-slate-700">Qtd. Produzida neste tempo</label>
                                <span className="text-xs font-bold text-slate-500">Saldo: {balance}</span>
                            </div>
                            <input type="number" step="0.01" required
                                max={balance}
                                className="w-full border rounded p-2 text-lg text-slate-900 border-slate-300 focus:border-green-500 outline-none"
                                value={formData.quantidade} onChange={e => setFormData({ ...formData, quantidade: e.target.value })}
                                placeholder={`Máx: ${balance}`} autoFocus={false} />

                            <div className="mt-1 flex justify-between text-[11px]">
                                <span className="text-slate-400">Pedido: {planned} | Já Prod: {produced}</span>
                                {Number(formData.quantidade) > balance && (
                                    <span className="text-red-600 font-bold flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        Excede saldo!
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 border rounded p-1.5 focus-within:border-green-500">
                                <div className="flex flex-col flex-1 pl-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Início</label>
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
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Fim</label>
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
                            disabled={loading || Number(formData.quantidade) > balance || Number(formData.quantidade) <= 0}
                            className="w-full bg-green-600 text-white rounded-lg p-2 font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-sm"
                        >
                            <Save className="w-4 h-4" />
                            {loading ? 'Salvando...' : 'Confirmar Apontamento'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
