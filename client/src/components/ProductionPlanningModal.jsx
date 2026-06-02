import React, { useState, useEffect } from 'react';
import { Save, Calendar, X, Layers, History, User, Clock, Zap, CheckCircle, RotateCcw } from 'lucide-react';
import { getPlanningHistory, previewCascade } from '../services/api';

export default function ProductionPlanningModal({ ops, onClose, onSave }) {
    const isBatch = Array.isArray(ops) && ops.length > 1;
    const opsArray = Array.isArray(ops) ? ops : [ops];
    const firstOp = opsArray[0];

    const today = new Date().toISOString().split('T')[0];

    const [formData, setFormData] = useState({
        data_inicio: firstOp?.data_planejada_inicio ? firstOp.data_planejada_inicio.split('T')[0] : today,
        hora_inicio: firstOp?.data_planejada_inicio ? firstOp.data_planejada_inicio.split('T')[1]?.slice(0, 5) : '08:00',
        data_fim: firstOp?.data_planejada_fim ? firstOp.data_planejada_fim.split('T')[0] : today,
        hora_fim: firstOp?.data_planejada_fim ? firstOp.data_planejada_fim.split('T')[1]?.slice(0, 5) : '17:00',
        observacao: ''
    });

    const isReplan = opsArray.some(op => !!op.data_planejada_inicio);

    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [cascadePreview, setCascadePreview] = useState(null); // array de ops com datas calculadas
    const [loadingCascade, setLoadingCascade] = useState(false);
    const [incluiSabado, setIncluiSabado] = useState(false);

    useEffect(() => {
        if (!isBatch && firstOp?.op) {
            setLoadingHistory(true);
            getPlanningHistory(firstOp.op)
                .then(data => setHistory(data || []))
                .catch(err => console.error('Error fetching planning history', err))
                .finally(() => setLoadingHistory(false));
        }
    }, [isBatch, firstOp?.op]);

    const handleGenerateCascade = async () => {
        setLoadingCascade(true);
        setCascadePreview(null);
        try {
            const start = `${formData.data_inicio}T${formData.hora_inicio}:00`;
            const result = await previewCascade({ ops: opsArray, start_date: start, incluiSabado });
            setCascadePreview(result.cascade);
        } catch (error) {
            alert('Erro ao gerar cascata: ' + error.message);
        } finally {
            setLoadingCascade(false);
        }
    };

    const handleClearCascade = () => setCascadePreview(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if ((isReplan || isBatch) && !formData.observacao.trim()) {
            alert('Informe a Observação / Justificativa antes de salvar.');
            return;
        }
        setLoading(true);
        try {
            const lote_id = `LOTE-${Date.now()}`;
            let plans = [];
            let modo_calculo = 'manual';

            if (cascadePreview && cascadePreview.length > 0) {
                modo_calculo = 'cascata';
                plans = cascadePreview.map(op => ({
                    op_numero:       op.op,
                    op_item:         op.item_op,
                    op_sequencia:    op.sequen || '',
                    operacao_codigo: op.operacao || '',
                    recurso_codigo:  op.recurso         || null,
                    produto_codigo:  op.cod_produto_op  || null,
                    recurso_code:    op.recurso         || null,
                    recurso_desc:    op.desc_recurso    || null,
                    pedido_venda:    op.pedido_venda    || op.pedido || null,
                    data_inicio:     op.data_inicio_calc.replace('T', ' ').substring(0, 19),
                    data_fim:        op.data_fim_calc.replace('T', ' ').substring(0, 19),
                    lote_id
                }));
            } else {
                const start = `${formData.data_inicio} ${formData.hora_inicio}:00`;
                const end   = `${formData.data_fim} ${formData.hora_fim}:00`;
                plans = opsArray.map(op => ({
                    op_numero:       op.op,
                    op_item:         op.item_op,
                    op_sequencia:    op.sequen || '',
                    operacao_codigo: op.operacao || '',
                    recurso_codigo:  op.recurso         || null,
                    produto_codigo:  op.cod_produto_op  || null,
                    recurso_code:    op.recurso         || null,
                    recurso_desc:    op.desc_recurso    || null,
                    pedido_venda:    op.pedido_venda    || op.pedido || null,
                    data_inicio:     start,
                    data_fim:        end,
                    lote_id
                }));
            }

            await onSave(plans, formData.observacao, modo_calculo);
            onClose();
        } catch (error) {
            alert('Erro ao salvar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b shrink-0">
                    <h3 className="font-bold text-base flex items-center gap-2 text-slate-800">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Planejamento {isBatch ? 'em Lote / Cascata' : 'da Ordem'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Info bar */}
                <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 shrink-0">
                    {isBatch ? (
                        <div>
                            <div className="font-bold text-blue-800 text-sm flex items-center gap-2 mb-0.5">
                                <Layers className="w-4 h-4" />
                                {opsArray.length} Ordens Selecionadas
                            </div>
                            <p className="text-xs text-slate-500">
                                Dica: Utilize a "Cascata Automática" para calcular as datas de fim considerando a capacidade dos recursos e dependências entre operações.
                            </p>
                        </div>
                    ) : (
                        <div className="text-sm text-slate-700 space-y-0.5">
                            <p><strong>OP:</strong> {firstOp?.op} — Item {firstOp?.item_op}</p>
                            <p><strong>Recurso:</strong> {firstOp?.recurso || firstOp?.operacao} — {firstOp?.desc_recurso || firstOp?.desc_operacao}</p>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

                        {/* Datas */}
                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Data Início Planejada</label>
                                <input type="date" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.data_inicio}
                                    onChange={e => { setFormData(p => ({ ...p, data_inicio: e.target.value })); setCascadePreview(null); }} />
                            </div>
                        </div>



                        {/* Botão cascata ou resultado */}
                        {!cascadePreview ? (
                            <div className="flex flex-col items-end gap-3">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 font-medium">
                                    <input type="checkbox" checked={incluiSabado} onChange={e => setIncluiSabado(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                                    Incluir sábados na cascata?
                                </label>
                                <button type="button" onClick={handleGenerateCascade}
                                    disabled={loadingCascade || !formData.data_inicio || !formData.hora_inicio}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold text-sm rounded-lg flex items-center gap-2 transition-colors">
                                    <Zap className="w-4 h-4" />
                                    {loadingCascade ? 'Calculando...' : 'Gerar Cascata Automática (Tempo Finito)'}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
                                <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
                                    <CheckCircle className="w-4 h-4" />
                                    Cascata calculada — {cascadePreview.length} operações sequenciadas
                                </div>
                                <button type="button" onClick={handleClearCascade}
                                    className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors">
                                    <RotateCcw className="w-3 h-3" /> Cancelar
                                </button>
                            </div>
                        )}

                        {/* Atenção replanejamento */}
                        {(isReplan || isBatch) && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg flex items-start gap-2">
                                <span className="font-bold shrink-0">Atenção:</span>
                                <span>Você está replanejando uma ou mais ordens. É obrigatório informar o motivo da alteração.</span>
                            </div>
                        )}

                        {/* Observação */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Observação / Justificativa {(isReplan || isBatch) && <span className="text-red-500">*</span>}
                            </label>
                            <textarea
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                rows="3"
                                placeholder={isReplan || isBatch ? 'Descreva o motivo do replanejamento...' : 'Observações adicionais (opcional)'}
                                value={formData.observacao}
                                onChange={e => setFormData(p => ({ ...p, observacao: e.target.value }))}
                            />
                        </div>

                        {/* Salvar */}
                        <button type="submit" disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg py-2.5 font-bold text-sm flex justify-center items-center gap-2 transition-colors">
                            <Save className="w-4 h-4" />
                            {loading ? 'Salvando...' : 'Salvar Planejamento'}
                        </button>
                    </form>

                    {/* Histórico (só para OP individual) */}
                    {!isBatch && (
                        <div className="px-5 pb-4 pt-0">
                            <div className="border-t pt-4">
                                <h4 className="text-xs font-bold text-slate-600 flex items-center gap-2 mb-3">
                                    <History className="w-4 h-4" /> Histórico de Planejamento
                                </h4>
                                {loadingHistory ? (
                                    <p className="text-xs text-slate-400 text-center py-3">Carregando...</p>
                                ) : history.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-3">Nenhum histórico para esta OP.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {history.map((lote, idx) => (
                                            <div key={idx} className="bg-slate-50 rounded-lg border border-slate-200 p-3 text-xs">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-semibold text-blue-700 flex items-center gap-1">
                                                        <User className="w-3 h-3" /> {lote.usuario_planejador}
                                                    </span>
                                                    <span className="text-slate-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> {new Date(lote.criado_em).toLocaleString('pt-BR')}
                                                    </span>
                                                </div>
                                                <div className="text-slate-600">
                                                    {new Date(lote.inicio_geral).toLocaleDateString('pt-BR')} → {new Date(lote.fim_geral).toLocaleDateString('pt-BR')}
                                                </div>
                                                {lote.observacao_lote && (
                                                    <p className="mt-1 text-slate-500 italic">"{lote.observacao_lote}"</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
