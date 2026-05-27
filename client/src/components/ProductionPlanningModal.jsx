import React, { useState, useEffect } from 'react';
import { Save, Calendar, X, Layers, History, User, Clock } from 'lucide-react';
import { getPlanningHistory } from '../services/api';

export default function ProductionPlanningModal({ ops, onClose, onSave }) {
    const isBatch = Array.isArray(ops) && ops.length > 1;
    const opsArray = Array.isArray(ops) ? ops : [ops];
    const firstOp = opsArray[0];

    const [formData, setFormData] = useState({
        data_inicio: firstOp.data_planejada_inicio ? firstOp.data_planejada_inicio.split('T')[0] : '',
        hora_inicio: firstOp.data_planejada_inicio ? firstOp.data_planejada_inicio.split('T')[1].slice(0, 5) : '08:00',
        data_fim: firstOp.data_planejada_fim ? firstOp.data_planejada_fim.split('T')[0] : '',
        hora_fim: firstOp.data_planejada_fim ? firstOp.data_planejada_fim.split('T')[1].slice(0, 5) : '17:00',
        observacao: ''
    });
    
    const isReplan = opsArray.some(op => !!op.data_planejada_inicio);
    
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        if (!isBatch && firstOp?.op) {
            setLoadingHistory(true);
            getPlanningHistory(firstOp.op)
                .then(data => setHistory(data || []))
                .catch(err => console.error("Error fetching planning history", err))
                .finally(() => setLoadingHistory(false));
        }
    }, [isBatch, firstOp?.op]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const start = `${formData.data_inicio} ${formData.hora_inicio}:00`;
            const end = `${formData.data_fim} ${formData.hora_fim}:00`;
            const lote_id = `LOTE-${new Date().getTime()}`; // Simple batch ID

            const plans = opsArray.map(op => ({
                op_numero: op.op,
                op_item: op.item_op,
                op_sequencia: op.sequen || '',
                operacao_codigo: op.operacao || '',
                recurso_code: op.recurso || null,
                recurso_desc: op.desc_recurso || null,
                pedido_venda: op.pedido_venda || op.pedido || null,
                data_inicio: start,
                data_fim: end,
                lote_id: lote_id
            }));

            await onSave(plans, formData.observacao); // We'll modify onSave to handle array
            onClose();
        } catch (error) {
            alert('Erro ao salvar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Planejamento {isBatch ? 'em Lote' : 'da Ordem'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 bg-blue-50 text-sm border-b border-blue-100 overflow-y-auto shrink-0 max-h-[150px]">
                    {isBatch ? (
                        <>
                            <div className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                <Layers className="w-4 h-4" />
                                {opsArray.length} Ordens Selecionadas
                            </div>
                            <ul className="list-disc pl-5 space-y-1 text-slate-700">
                                {opsArray.map((o, i) => (
                                    <li key={i}>{o.op} - Item {o.item_op} (Recurso: {o.recurso || o.operacao})</li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <>
                            <p><strong>OP:</strong> {firstOp.op} - Item {firstOp.item_op}</p>
                            <p><strong>Recurso:</strong> {firstOp.recurso || firstOp.operacao} - {firstOp.desc_recurso || firstOp.desc_operacao}</p>
                        </>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4 shrink-0">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Data Início Planejada</label>
                            <input type="date" required className="w-full border rounded p-2 text-sm"
                                value={formData.data_inicio} onChange={e => setFormData({ ...formData, data_inicio: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Hora Início</label>
                            <input type="time" required className="w-full border rounded p-2 text-sm"
                                value={formData.hora_inicio} onChange={e => setFormData({ ...formData, hora_inicio: e.target.value })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Data Fim Planejada</label>
                            <input type="date" required className="w-full border rounded p-2 text-sm"
                                value={formData.data_fim} onChange={e => setFormData({ ...formData, data_fim: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Hora Fim</label>
                            <input type="time" required className="w-full border rounded p-2 text-sm"
                                value={formData.hora_fim} onChange={e => setFormData({ ...formData, hora_fim: e.target.value })} />
                        </div>
                    </div>

                    {isReplan && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 rounded flex items-start gap-2">
                            <span className="font-bold">Atenção:</span> Você está replanejando uma ou mais ordens. É obrigatório informar o motivo da alteração.
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Observação / Justificativa {isReplan && <span className="text-red-500">*</span>}
                        </label>
                        <textarea 
                            required={isReplan}
                            className="w-full border rounded p-2 text-sm resize-none" 
                            rows="2"
                            placeholder={isReplan ? "Descreva o motivo do replanejamento..." : "Observações adicionais (opcional)"}
                            value={formData.observacao} 
                            onChange={e => setFormData({ ...formData, observacao: e.target.value })} 
                        />
                    </div>

                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white rounded-lg p-2 font-bold hover:bg-blue-700 flex justify-center items-center gap-2">
                        <Save className="w-4 h-4" />
                        {loading ? 'Salvando...' : 'Salvar Planejamento'}
                    </button>
                </form>

                {!isBatch && (
                    <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl overflow-y-auto min-h-[150px]">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                            <History className="w-4 h-4" />
                            Histórico de Planejamento
                        </h4>
                        
                        {loadingHistory ? (
                            <div className="text-center text-xs text-slate-500 py-4">Carregando histórico...</div>
                        ) : history.length === 0 ? (
                            <div className="text-center text-xs text-slate-500 py-4">Nenhum histórico encontrado para esta OP.</div>
                        ) : (
                            <div className="space-y-3">
                                {history.map((lote, idx) => (
                                    <div key={idx} className="bg-white p-3 rounded border border-slate-200 shadow-sm text-xs">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-1 font-semibold text-blue-700">
                                                <User className="w-3 h-3" />
                                                {lote.usuario_planejador}
                                            </div>
                                            <div className="flex items-center gap-1 text-slate-500">
                                                <Clock className="w-3 h-3" />
                                                {new Date(lote.criado_em).toLocaleString('pt-BR')}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mb-2 text-slate-600">
                                            <div><span className="font-semibold text-slate-700">Início:</span> {new Date(lote.inicio_geral).toLocaleDateString('pt-BR')}</div>
                                            <div><span className="font-semibold text-slate-700">Fim:</span> {new Date(lote.fim_geral).toLocaleDateString('pt-BR')}</div>
                                        </div>
                                        {lote.observacao_lote && (
                                            <div className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 italic mt-2">
                                                "{lote.observacao_lote}"
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

