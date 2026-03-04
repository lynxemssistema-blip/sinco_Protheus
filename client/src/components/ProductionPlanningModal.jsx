import React, { useState } from 'react';
import { Save, Calendar, X } from 'lucide-react';

export default function ProductionPlanningModal({ op, onClose, onSave }) {
    const [formData, setFormData] = useState({
        data_inicio: op.data_planejada_inicio ? op.data_planejada_inicio.split('T')[0] : '',
        hora_inicio: op.data_planejada_inicio ? op.data_planejada_inicio.split('T')[1].slice(0, 5) : '08:00',
        data_fim: op.data_planejada_fim ? op.data_planejada_fim.split('T')[0] : '',
        hora_fim: op.data_planejada_fim ? op.data_planejada_fim.split('T')[1].slice(0, 5) : '17:00',
        applyToSameOperation: false
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const start = `${formData.data_inicio} ${formData.hora_inicio}:00`;
            const end = `${formData.data_fim} ${formData.hora_fim}:00`;

            await onSave({
                op_numero: op.op,
                op_item: op.item_op,
                op_sequencia: op.sequen,
                operacao_codigo: op.operacao,
                data_inicio: start,
                data_fim: end,
                applyToBatch: formData.applyToSameOperation // Send this flag
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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Planejamento da Operação
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 bg-blue-50 text-sm">
                    <p><strong>OP:</strong> {op.op} - {op.desc_produto}</p>
                    <p><strong>Operação:</strong> {op.operacao} - {op.desc_operacao}</p>
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

                    <div className="bg-orange-50 p-3 rounded border border-orange-100 flex items-start gap-2">
                        <input
                            type="checkbox"
                            id="applyBatch"
                            className="mt-1"
                            checked={formData.applyToSameOperation}
                            onChange={e => setFormData({ ...formData, applyToSameOperation: e.target.checked })}
                        />
                        <label htmlFor="applyBatch" className="text-sm text-orange-800 cursor-pointer select-none">
                            <strong>Aplicar para todas as OPs nesta operação?</strong>
                            <p className="text-xs text-orange-600 mt-1">
                                Se marcado, todas as OPs listadas atualmente na tela com a operação <strong>{op.operacao}</strong> receberão este mesmo planejamento.
                            </p>
                        </label>
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
