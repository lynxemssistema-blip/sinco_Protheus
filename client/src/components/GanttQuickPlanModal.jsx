import React, { useState } from 'react';
import { Calendar, Save, X } from 'lucide-react';

export default function GanttQuickPlanModal({ processo, onClose, onSave }) {
    const [formData, setFormData] = useState({
        data_inicio: processo.data_planejada_inicio ? processo.data_planejada_inicio.split('T')[0] : '',
        hora_inicio: processo.data_planejada_inicio ? processo.data_planejada_inicio.split('T')[1]?.slice(0, 5) || '08:00' : '08:00',
        data_fim: processo.data_planejada_fim ? processo.data_planejada_fim.split('T')[0] : '',
        hora_fim: processo.data_planejada_fim ? processo.data_planejada_fim.split('T')[1]?.slice(0, 5) || '17:00' : '17:00'
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const planejado_inicio = `${formData.data_inicio}T${formData.hora_inicio}:00`;
            const planejado_fim = `${formData.data_fim}T${formData.hora_fim}:00`;

            await onSave({
                ...processo,
                data_planejada_inicio: planejado_inicio,
                data_planejada_fim: planejado_fim
            });

            onClose();
        } catch (error) {
            alert('Erro ao salvar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Planejar Operação
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 bg-blue-50 text-sm border-b">
                    <p><strong>OP:</strong> {processo.op}/{processo.item_op}/{processo.sequen}</p>
                    <p><strong>Operação:</strong> {processo.operacao} - {processo.desc_operacao}</p>
                    <p><strong>Produto:</strong> {processo.cod_produto_op} - {processo.desc_produto}</p>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Data Início</label>
                            <input
                                type="date"
                                required
                                className="w-full border rounded p-2 text-sm"
                                value={formData.data_inicio}
                                onChange={e => setFormData({ ...formData, data_inicio: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Hora Início</label>
                            <input
                                type="time"
                                required
                                className="w-full border rounded p-2 text-sm"
                                value={formData.hora_inicio}
                                onChange={e => setFormData({ ...formData, hora_inicio: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Data Fim</label>
                            <input
                                type="date"
                                required
                                className="w-full border rounded p-2 text-sm"
                                value={formData.data_fim}
                                onChange={e => setFormData({ ...formData, data_fim: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Hora Fim</label>
                            <input
                                type="time"
                                required
                                className="w-full border rounded p-2 text-sm"
                                value={formData.hora_fim}
                                onChange={e => setFormData({ ...formData, hora_fim: e.target.value })}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white rounded-lg p-2 font-bold hover:bg-blue-700 flex justify-center items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {loading ? 'Salvando...' : 'Salvar Planejamento'}
                    </button>
                </form>
            </div>
        </div>
    );
}
