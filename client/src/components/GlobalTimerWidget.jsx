import React, { useState } from 'react';
import { useTimer } from '../contexts/TimerContext';
import { Clock, Play, Pause, ChevronUp, ChevronDown, CheckSquare, X } from 'lucide-react';
import ProductionAppointmentModal from './ProductionAppointmentModal';
import { saveAppointment } from '../services/api';

export default function GlobalTimerWidget() {
    const { timers, startTimer, pauseTimer, removeTimer, getElapsedTime } = useTimer();
    const [isOpen, setIsOpen] = useState(true);
    const [modalData, setModalData] = useState(null);

    // No intervals — purely event-driven rendering

    // Filter: only show timers that are running or stopped with a startedAt
    const activeTimers = Object.values(timers).filter(t => t.startedAt);

    if (activeTimers.length === 0) return null;

    const formatStartTime = (isoStr) => {
        if (!isoStr) return '--:--';
        return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const handleStopTimer = (t) => {
        pauseTimer(t.id);

        const opMappedForModal = {
            op: t.op,
            item_op: t.item_op || '01',
            sequen: t.sequen || '001',
            operacao: t.operacao,
            operacao_coluna: t.operacao_coluna || t.recurso || t.operacao,
            recurso: t.recurso || t.operacao,
            cod_produto_op: t.cod_produto_op,
            desc_produto: t.desc_produto,
            desc_operacao: t.desc_operacao,
            next_desc_operacao: t.next_desc_operacao,
            prev_desc_operacao: t.prev_desc_operacao,
            qtd_planejada_op: t.qtd_planejada_op,
            qtd_produzida_real: t.qtd_produzida_real,
            next_op: t.next_op
        };

        setModalData({ timerContextProps: t, originalOp: opMappedForModal });
    };

    const handleDismiss = (timerId) => {
        if (window.confirm('Deseja remover este cronômetro? O tempo será perdido.')) {
            removeTimer(timerId);
        }
    };

    const handleAppointmentSave = async (data) => {
        try {
            await saveAppointment(data);
            if (modalData?.timerContextProps?.id) {
                removeTimer(modalData.timerContextProps.id);
            }
            setModalData(null);
        } catch (err) {
            console.error('Erro ao salvar apontamento:', err);
            alert('Erro ao registrar apontamento: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <>
            <div className="fixed bottom-4 right-4 z-40 bg-white border border-slate-200 shadow-xl rounded-lg w-80 transition-all flex flex-col overflow-hidden ring-1 ring-slate-900/5 print:hidden">
                <div
                    className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-semibold">Cronômetros ({activeTimers.length})</span>
                    </div>
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>

                {isOpen && (
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {activeTimers.map(t => (
                            <div key={t.id} className={`p-3 transition flex flex-col gap-2 ${t.isRunning ? 'bg-emerald-50' : 'bg-slate-50 hover:bg-white'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-xs font-bold text-slate-800" title={t.desc_produto}>OP: {t.op}</span>
                                        {t.cod_produto_op && (
                                            <span className="text-[10px] text-blue-600 font-mono font-semibold truncate" title={t.desc_produto}>
                                                Desenho: {t.cod_produto_op}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-slate-500 truncate" title={t.desc_operacao}>
                                            Proc: {t.operacao} - {t.desc_operacao}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            <span className={`text-xs font-semibold ${t.isRunning ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                {t.isRunning ? '▶' : '⏸'} {formatStartTime(t.startedAt)}
                                            </span>
                                        </div>
                                        {!t.isRunning && (
                                            <button
                                                onClick={() => handleDismiss(t.id)}
                                                className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded transition"
                                                title="Remover cronômetro"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                    <div className="flex gap-1">
                                        {!t.isRunning ? (
                                            <button onClick={() => startTimer(t)} className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition" title="Retomar">
                                                <Play className="w-3.5 h-3.5" />
                                            </button>
                                        ) : (
                                            <button onClick={() => pauseTimer(t.id)} className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded transition" title="Pausar">
                                                <Pause className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleStopTimer(t)}
                                        className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded text-xs font-semibold flex items-center gap-1 transition"
                                    >
                                        <CheckSquare className="w-3 h-3" />
                                        Apontar Peças
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Appointment Modal triggered from widget */}
            {modalData && (
                <ProductionAppointmentModal
                    op={modalData.originalOp}
                    onClose={() => setModalData(null)}
                    onSave={handleAppointmentSave}
                    contextTimer={modalData.timerContextProps}
                />
            )}
        </>
    );
}
