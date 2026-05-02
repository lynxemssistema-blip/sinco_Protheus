import React, { useState } from 'react';
import { Save, Calendar, X, Layers } from 'lucide-react';
// we need to generate a lote_id or just use a timestamp

export default function ProductionPlanningModal({ ops, onClose, onSave }) {
    const isBatch = Array.isArray(ops) && ops.length > 1;
    const opsArray = Array.isArray(ops) ? ops : [ops];
    const firstOp = opsArray[0];

    const [formData, setFormData] = useState({
        data_inicio: firstOp.data_planejada_inicio ? firstOp.data_planejada_inicio.split('T')[0] : '',
        hora_inicio: firstOp.data_planejada_inicio ? firstOp.data_planejada_inicio.split('T')[1].slice(0, 5) : '08:00',
        data_fim: firstOp.data_planejada_fim ? firstOp.data_planejada_fim.split('T')[0] : '',
        hora_fim: firstOp.data_planejada_fim ? firstOp.data_planejada_fim.split('T')[1].slice(0, 5) : '17:00'
    });
    
    const [loading, setLoading] = useState(false);

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
                data_inicio: start,
                data_fim: end,
                lote_id: lote_id
            }));

            await onSave(plans); // We'll modify onSave to handle array
            onClose();
        } catch (error) {
            alert('Erro ao salvar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Planejamento {isBatch ? 'em Lote' : 'da Ordem'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 bg-blue-50 text-sm border-b border-blue-100 max-h-[150px] overflow-y-auto">
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

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
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

                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white rounded-lg p-2 font-bold hover:bg-blue-700 flex justify-center items-center gap-2">
                        <Save className="w-4 h-4" />
                        {loading ? 'Salvando...' : 'Salvar Planejamento'}
                    </button>
                </form>
            </div>
        </div>
    );
}
