import React, { useState } from 'react';
import { api } from '../../services/api';
import { X, Shield, Package, Calendar, UserCheck, AlertCircle } from 'lucide-react';

const NovaEntregaEpiModal = ({ fichaId, colaboradorNome, epis = [], onClose, onEntregaRealizada }) => {
    const [epiId, setEpiId] = useState(epis[0]?.id || '');
    const [quantidade, setQuantidade] = useState(1);
    const [motivo, setMotivo] = useState('periodico');
    const [dataEntrega, setDataEntrega] = useState(new Date().toISOString().slice(0, 10));
    const [loteFabricante, setLoteFabricante] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const epiSelecionado = epis.find(e => String(e.id) === String(epiId)) || epis[0];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErro('');

        try {
            await api.post('/sst/entregas', {
                ficha_id: fichaId,
                epi_id: epiId,
                quantidade: parseFloat(quantidade) || 1,
                motivo,
                data_entrega: dataEntrega,
                lote_fabricante: loteFabricante,
                observacoes
            });
            onEntregaRealizada();
            onClose();
        } catch (err) {
            setErro(err.response?.data?.error || 'Erro ao registrar entrega de EPI.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg text-slate-100 shadow-2xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-400" />
                        <h2 className="text-lg font-bold text-white">Entrega de EPI (NR-06)</h2>
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

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                        <span className="text-slate-400">Colaborador:</span>{' '}
                        <strong className="text-white font-bold">{colaboradorNome}</strong>
                    </div>

                    {/* Seleção do EPI */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Selecione o EPI</label>
                        <select
                            value={epiId}
                            onChange={(e) => setEpiId(e.target.value)}
                            required
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                        >
                            {epis.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.descricao} (CA: {e.ca_numero}) - Saldo: {parseFloat(e.saldo_atual || 0)} {e.unidade}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Quantidade e Data */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                Quantidade ({epiSelecionado?.unidade || 'UN'})
                            </label>
                            <input
                                type="number"
                                step="1"
                                min="1"
                                max={parseFloat(epiSelecionado?.saldo_atual || 9999)}
                                value={quantidade}
                                onChange={(e) => setQuantidade(e.target.value)}
                                required
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Data da Entrega</label>
                            <input
                                type="date"
                                value={dataEntrega}
                                onChange={(e) => setDataEntrega(e.target.value)}
                                required
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Motivo da Entrega */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Motivo do Fornecimento</label>
                        <select
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                        >
                            <option value="periodico">Troca Periódica Programada</option>
                            <option value="admissional">Admissional (Primeira Entrega)</option>
                            <option value="danificado">Substituição por Dano / Desgaste</option>
                            <option value="extravio">Reposição por Extravio</option>
                        </select>
                    </div>

                    {/* Lote do Fabricante */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Lote do Fabricante (Opcional)</label>
                        <input
                            type="text"
                            value={loteFabricante}
                            onChange={(e) => setLoteFabricante(e.target.value)}
                            placeholder="Ex: LOTE-2026-X"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                    </div>

                    {/* Observações */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Observações</label>
                        <textarea
                            rows={2}
                            value={observacoes}
                            onChange={(e) => setObservacoes(e.target.value)}
                            placeholder="Anotações complementares..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                    </div>

                    <div className="bg-emerald-950/20 border border-emerald-900/40 p-3 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>O termo de compromisso e aceite digital será vinculado e o estoque baixado no Kardex.</span>
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
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                        >
                            {loading ? 'Processando...' : 'Confirmar Entrega'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NovaEntregaEpiModal;
