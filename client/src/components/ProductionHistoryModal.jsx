import React, { useState, useEffect } from 'react';
import { X, ClipboardList, Clock, User } from 'lucide-react';
import { getAppointmentHistory } from '../services/api';

export default function ProductionHistoryModal({ opData, onClose }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (opData) fetchHistory();
    }, [opData]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await getAppointmentHistory(opData.op, opData.item_op, opData.sequen, opData.operacao);
            setHistory(data || []);
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!opData) return null;

    const fmtDate = (d) => {
        if (!d) return '-';
        const dt = new Date(d);
        return isNaN(dt) ? '-' : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    const fmtTime = (d) => {
        if (!d) return '-';
        const dt = new Date(d);
        return isNaN(dt) ? '-' : dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const calcDuration = (start, end) => {
        if (!start || !end) return '-';
        const ms = new Date(end).getTime() - new Date(start).getTime();
        if (isNaN(ms) || ms < 0) return '-';
        const totalMin = Math.floor(ms / 60000);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (h > 0) return `${h}h${String(m).padStart(2, '0')}min`;
        return `${m}min`;
    };

    const totalQty = history.reduce((acc, r) => acc + Number(r.quantidade || 0), 0);
    const totalMs = history.reduce((acc, r) => {
        if (!r.data_inicio || !r.data_fim) return acc;
        const ms = new Date(r.data_fim).getTime() - new Date(r.data_inicio).getTime();
        return acc + (isNaN(ms) ? 0 : Math.max(0, ms));
    }, 0);
    const totalH = Math.floor(totalMs / 3600000);
    const totalM = Math.floor((totalMs % 3600000) / 60000);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                            <ClipboardList className="w-5 h-5 text-blue-600" />
                            Histórico de Apontamentos
                        </h3>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                            <span>OP: <strong>{opData.op}</strong></span>
                            <span>Item: <strong>{opData.item_op}</strong></span>
                            <span>Seq: <strong>{opData.sequen}</strong></span>
                            <span>Oper: <strong>{opData.operacao}</strong> ({opData.desc_operacao})</span>
                            {opData.desc_produto && <span>Produto: <strong>{opData.desc_produto}</strong></span>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-red-100 rounded-full transition">
                        <X className="w-5 h-5 text-slate-400 hover:text-red-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-40">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            Nenhum apontamento registrado para esta operação.
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 shadow-sm text-xs">
                                <tr>
                                    <th className="px-4 py-3">#</th>
                                    <th className="px-4 py-3">Data</th>
                                    <th className="px-4 py-3">Início</th>
                                    <th className="px-4 py-3">Fim</th>
                                    <th className="px-4 py-3">Duração</th>
                                    <th className="px-4 py-3">Qtd</th>
                                    <th className="px-4 py-3">Usuário</th>
                                    <th className="px-4 py-3">Observação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {history.map((record, idx) => {
                                    const duration = calcDuration(record.data_inicio, record.data_fim);
                                    return (
                                        <tr key={record.id || idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                                            <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                                                {fmtDate(record.data_inicio || record.criado_em)}
                                            </td>
                                            <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-blue-400" />
                                                    {fmtTime(record.data_inicio)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                                                {fmtTime(record.data_fim)}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-semibold text-indigo-600">
                                                {duration}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold text-xs">
                                                    {Number(record.quantidade || 0).toFixed(0)} pc
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                                                        {(record.usuario || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-700">{record.usuario || 'Sistema'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[200px] truncate" title={record.observacao}>
                                                {record.observacao || '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold text-xs text-slate-700 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan="4" className="px-4 py-3 text-right">Totais:</td>
                                    <td className="px-4 py-3 text-indigo-600">
                                        {totalH > 0 ? `${totalH}h${String(totalM).padStart(2, '0')}min` : `${totalM}min`}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                            {totalQty.toFixed(0)} pc
                                        </span>
                                    </td>
                                    <td colSpan="2" className="px-4 py-3 text-slate-400">
                                        {history.length} apontamento{history.length !== 1 ? 's' : ''}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t bg-slate-50 rounded-b-xl flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium text-sm transition-colors">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
