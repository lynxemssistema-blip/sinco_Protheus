import React, { useState } from 'react';
import { api } from '../../services/api';
import { X, ArrowDownRight, ArrowUpRight, AlertCircle } from 'lucide-react';

const MovimentacaoEstoqueModal = ({ epis = [], epiPreselecionado = null, onClose, onMovimentacaoSalva }) => {
    const [epiId, setEpiId] = useState(epiPreselecionado?.id || (epis[0]?.id || ''));
    const [tipo, setTipo] = useState('entrada_compra');
    const [quantidade, setQuantidade] = useState('');
    const [custoUnitario, setCustoUnitario] = useState(epiPreselecionado?.custo_unitario || '');
    const [docRef, setDocRef] = useState('');
    const [motivo, setMotivo] = useState('');
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const epiSelecionado = epis.find(e => String(e.id) === String(epiId)) || epis[0];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErro('');

        try {
            await api.post('/sst/movimentacoes', {
                epi_id: epiId,
                tipo_movimentacao: tipo,
                quantidade: parseFloat(quantidade),
                custo_unitario: parseFloat(custoUnitario) || 0,
                documento_referencia: docRef,
                motivo_observacao: motivo
            });
            onMovimentacaoSalva();
            onClose();
        } catch (err) {
            setErro(err.response?.data?.error || 'Erro ao registrar movimentação.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md text-slate-100 shadow-2xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                    <div className="flex items-center gap-2">
                        <ArrowDownRight className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-bold text-white">Movimentação de Estoque Kardex</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {erro && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                            <span>{erro}</span>
                        </div>
                    )}

                    {/* EPI */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">EPI</label>
                        <select
                            value={epiId}
                            onChange={(e) => setEpiId(e.target.value)}
                            required
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                            {epis.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.descricao} (Saldo Atual: {parseFloat(e.saldo_atual || 0)} {e.unidade})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Tipo de Movimentação */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Movimentação</label>
                        <select
                            value={tipo}
                            onChange={(e) => setTipo(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value="entrada_compra">Entrada por Compra (+)</option>
                            <option value="descarte">Descarte por Danificação (-)</option>
                            <option value="ajuste_inventario">Ajuste de Balanço / Inventário (=)</option>
                        </select>
                    </div>

                    {/* Quantidade e Custo */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                {tipo === 'ajuste_inventario' ? 'Novo Saldo Real' : `Quantidade (${epiSelecionado?.unidade || 'UN'})`}
                            </label>
                            <input
                                type="number"
                                step="1"
                                min="0"
                                value={quantidade}
                                onChange={(e) => setQuantidade(e.target.value)}
                                required
                                placeholder="0"
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Custo Unitário (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={custoUnitario}
                                onChange={(e) => setCustoUnitario(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Documento / NF */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Documento / Nota Fiscal de Referência</label>
                        <input
                            type="text"
                            value={docRef}
                            onChange={(e) => setDocRef(e.target.value)}
                            placeholder="Ex: NF-e 123456 ou Lote 90"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Motivo */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Motivo / Observação</label>
                        <textarea
                            rows={2}
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Descreva a razão da movimentação..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 disabled:opacity-50"
                        >
                            {loading ? 'Processando...' : 'Lançar no Kardex'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MovimentacaoEstoqueModal;
