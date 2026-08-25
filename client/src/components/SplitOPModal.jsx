import React, { useState, useEffect } from 'react';
import { X, Scissors, Plus, Trash2, Calendar, AlertCircle, CheckCircle, Layers, Save, Loader2, Info } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

const SplitOPModal = ({ isOpen, onClose, item, onSaveSuccess }) => {
    const { user } = useAuth();
    const [fractions, setFractions] = useState([]);
    const [saving, setSaving] = useState(false);

    const pedido = item ? String(item.pedido || '').trim() : '';
    const itemNum = item ? String(item.item || '').trim() : '';
    const codigo = item ? String(item.codigo || '').trim() : '';
    const descricao = item ? String(item.descricao || '').trim() : '';
    const opOriginal = item ? String(item.op_num_completa || item.op_num || '').trim() : '';
    
    // Calcula a quantidade total do item (soma das frações se já existirem ou saldo total)
    const totalQtd = React.useMemo(() => {
        if (!item) return 0;
        if (item.pcp_programacoes && item.pcp_programacoes.length > 1) {
            const sumPcp = item.pcp_programacoes.reduce((acc, p) => acc + (parseFloat(p.quantidade_pcp) || 0), 0);
            if (sumPcp > 0) return sumPcp;
        }
        return parseFloat(item.quantidade || item.c6_qtdven || item.qtd_faturar || item.visual_qtd || 0);
    }, [item]);

    const formatDateForInput = (d) => {
        if (!d) return '';
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
            return d.substring(0, 10);
        }
        try {
            const dateObj = new Date(d);
            if (!isNaN(dateObj.getTime())) {
                return dateObj.toISOString().split('T')[0];
            }
        } catch (_) {}
        return '';
    };

    const initialDate = formatDateForInput(item?.data_entrega_pcp || item?.pcp_delivery_forecast_date || item?.entrega);

    const getFractionLetter = (index) => {
        const firstChar = String.fromCharCode(65 + Math.floor(index / 26));
        const secondChar = String.fromCharCode(65 + (index % 26));
        return `${firstChar}${secondChar}`;
    };

    const getBaseOp = () => {
        if (!opOriginal || opOriginal === '-') {
            return `${pedido.padStart(6, '0')}${itemNum.padStart(2, '0')}`;
        }
        if (opOriginal.length === 11) {
            return opOriginal.substring(0, 8);
        }
        if (opOriginal.length === 6) {
            return `${opOriginal}${itemNum.padStart(2, '0')}`;
        }
        return opOriginal;
    };

    useEffect(() => {
        if (isOpen && item) {
            const baseOp = getBaseOp();

            // Se a OP já foi fracionada anteriormente (possui mais de 1 programação), carrega os dados exatos de cada fração!
            if (item.pcp_programacoes && item.pcp_programacoes.length > 1) {
                setFractions(item.pcp_programacoes.map((p, idx) => {
                    const letter = p.numero_lote && /^[A-Z]{2}$/i.test(String(p.numero_lote).trim())
                        ? String(p.numero_lote).trim().toUpperCase()
                        : getFractionLetter(idx);
                    
                    let opNum = p.op_protheus ? String(p.op_protheus).trim() : '';
                    if (!opNum || opNum === '-' || /00\d$/.test(opNum) || !opNum.endsWith(letter)) {
                        opNum = `${baseOp}${letter}`;
                    }

                    return {
                        id: p.id,
                        op_protheus: opNum,
                        quantidade_pcp: p.quantidade_pcp !== undefined && p.quantidade_pcp !== null ? String(p.quantidade_pcp) : '0',
                        data_entrega_pcp: formatDateForInput(p.data_entrega_pcp || p.data_prevista_faturamento),
                        observacao: p.observacao || `Fração ${letter} (Lote ${letter})`,
                        numero_lote: letter
                    };
                }));
            } else {
                // Primeira vez que parte a OP: divide a quantidade inicial em 2
                const metade = totalQtd > 1 ? Math.floor(totalQtd / 2) : parseFloat((totalQtd / 2).toFixed(2));
                const resto = parseFloat((totalQtd - metade).toFixed(2));

                const let1 = getFractionLetter(0); // 'AA'
                const let2 = getFractionLetter(1); // 'AB'

                setFractions([
                    {
                        op_protheus: `${baseOp}${let1}`,
                        quantidade_pcp: metade > 0 ? String(metade) : String(totalQtd),
                        data_entrega_pcp: initialDate || '',
                        observacao: `Fração ${let1} (Lote ${let1})`,
                        numero_lote: let1
                    },
                    {
                        op_protheus: `${baseOp}${let2}`,
                        quantidade_pcp: resto > 0 ? String(resto) : '0',
                        data_entrega_pcp: initialDate || '',
                        observacao: `Fração ${let2} (Lote ${let2})`,
                        numero_lote: let2
                    }
                ]);
            }
        }
    }, [isOpen, item]);

    if (!isOpen || !item) return null;

    const somaDistribuida = fractions.reduce((acc, f) => acc + (parseFloat(f.quantidade_pcp) || 0), 0);
    const diferenca = parseFloat((totalQtd - somaDistribuida).toFixed(2));
    const isTotalExato = Math.abs(diferenca) < 0.001;

    const handleAddFraction = () => {
        const baseOp = getBaseOp();
        const nextIdx = fractions.length;
        const letter = getFractionLetter(nextIdx); // 'AC', 'AD', etc.
        const sugeridaQtd = diferenca > 0 ? String(diferenca) : '0';
        const lastDate = fractions.length > 0 ? fractions[fractions.length - 1].data_entrega_pcp : initialDate;

        setFractions(prev => [
            ...prev,
            {
                op_protheus: `${baseOp}${letter}`,
                quantidade_pcp: sugeridaQtd,
                data_entrega_pcp: lastDate || initialDate || '',
                observacao: `Fração ${letter} (Lote ${letter})`,
                numero_lote: letter
            }
        ]);
    };

    const handleUnmerge = async () => {
        if (!window.confirm(`Deseja desfazer o fracionamento e unificar a OP de volta em um único lote de ${totalQtd.toLocaleString('pt-BR')} un.?`)) {
            return;
        }
        setSaving(true);
        try {
            await api.delete(`/pedidos/split-op/${pedido}/${itemNum}`);
            toast.success('Fracionamento desfeito! OP unificada em lote único.');
            if (onSaveSuccess) onSaveSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao unificar OP.');
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveFraction = (index) => {
        if (fractions.length <= 2) {
            if (window.confirm('Restam apenas 2 frações. Deseja excluir esta fração e unificar a OP de volta em um único lote original?')) {
                handleUnmerge();
            }
            return;
        }

        const removedFrac = fractions[index];
        const removedQtd = parseFloat(removedFrac.quantidade_pcp) || 0;
        const remaining = fractions.filter((_, i) => i !== index);

        // Transfere o saldo da fração excluída para a primeira fração restante (AA) para manter 100% balanceado
        if (removedQtd > 0 && remaining.length > 0) {
            const firstQtd = parseFloat(remaining[0].quantidade_pcp) || 0;
            remaining[0] = {
                ...remaining[0],
                quantidade_pcp: String(parseFloat((firstQtd + removedQtd).toFixed(2)))
            };
        }

        // Reorganiza letras e nomes sequenciais (AA, AB, AC...)
        const baseOp = getBaseOp();
        const reindexed = remaining.map((f, i) => {
            const letter = getFractionLetter(i);
            return {
                ...f,
                numero_lote: letter,
                op_protheus: `${baseOp}${letter}`,
                observacao: `Fração ${letter} (Lote ${letter})`
            };
        });

        setFractions(reindexed);
        toast.info(`Fração ${removedFrac.numero_lote} removida. O saldo de ${removedQtd.toLocaleString('pt-BR')} un foi transferido para a Fração #1 (AA).`);
    };

    const handleFractionChange = (index, field, value) => {
        setFractions(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (fractions.length < 2) {
            toast.error('Informe ao menos 2 frações para partir a OP.');
            return;
        }

        if (!isTotalExato) {
            toast.error(`A soma das quantidades (${somaDistribuida.toLocaleString('pt-BR')}) deve ser exatamente igual ao total da OP (${totalQtd.toLocaleString('pt-BR')}). Diferença: ${diferenca.toLocaleString('pt-BR')}`);
            return;
        }

        for (let i = 0; i < fractions.length; i++) {
            const f = fractions[i];
            const q = parseFloat(f.quantidade_pcp);
            if (isNaN(q) || q <= 0) {
                toast.error(`A Fração #${i + 1} possui quantidade inválida.`);
                return;
            }
            if (!f.data_entrega_pcp) {
                toast.error(`Informe a Data de Entrega PCP da Fração #${i + 1}.`);
                return;
            }
        }

        setSaving(true);
        try {
            const payload = {
                pedido,
                item: itemNum,
                original_op: opOriginal,
                qtd_total_item: totalQtd,
                usuario: user?.nome || user?.name || user?.login || 'Gestão de OPs',
                fractions
            };

            const response = await api.post('/pedidos/split-op', payload);
            toast.success(response.data?.message || 'OP partida em frações com sucesso!');
            if (onSaveSuccess) onSaveSuccess();
            onClose();
        } catch (err) {
            const errMsg = err.response?.data?.error || err.message || 'Erro ao partir OP.';
            toast.error(`Falha ao partir OP: ${errMsg}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-100 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
                            <Scissors className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                                Partir Ordem de Produção (OP)
                            </h3>
                            <p className="text-xs text-slate-300">
                                Divida a OP em 2 ou mais frações com suas respectivas datas e quantidades de entrega.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Context Bar */}
                <div className="px-6 py-3 bg-indigo-50/70 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4">
                        <div><span className="font-semibold text-slate-500">Pedido:</span> <strong className="text-slate-900">{pedido}</strong></div>
                        <div><span className="font-semibold text-slate-500">Item:</span> <strong className="text-slate-900">{itemNum}</strong></div>
                        <div><span className="font-semibold text-slate-500">Produto:</span> <strong className="text-indigo-700 font-mono">{codigo}</strong></div>
                        <div className="truncate max-w-xs" title={descricao}><span className="font-semibold text-slate-500">Descrição:</span> {descricao}</div>
                    </div>
                    <div className="flex items-center gap-3">
                        {opOriginal && opOriginal !== '-' && (
                            <span className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-800 rounded-md font-mono font-bold shadow-xs">
                                OP Atual: {opOriginal}
                            </span>
                        )}
                        <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-md font-bold shadow-xs">
                            Qtd Total: {totalQtd.toLocaleString('pt-BR')} un
                        </span>
                    </div>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                    {/* Informative banner */}
                    <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                        <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <strong>Regra de Produção:</strong> A OP original será substituída por frações independentes. Cada fração recebe um número de OP exclusivo e sua própria Data de Entrega PCP.
                        </div>
                    </div>

                    {/* Fractions list */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Layers className="h-4 w-4 text-indigo-600" />
                                Frações da OP ({fractions.length})
                            </h4>
                            <button
                                type="button"
                                onClick={handleAddFraction}
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            >
                                <Plus className="h-3.5 w-3.5" /> Adicionar Outra Fração
                            </button>
                        </div>

                        {fractions.map((frac, idx) => (
                            <div
                                key={idx}
                                className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col gap-3 relative transition-all hover:border-indigo-300 hover:bg-slate-50"
                            >
                                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-xs font-bold">
                                            #{idx + 1}
                                        </span>
                                        <span className="text-xs font-bold text-slate-800">
                                            {frac.observacao || `Fração ${idx + 1}`}
                                        </span>
                                    </div>
                                    {fractions.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFraction(idx)}
                                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                                            title="Remover esta fração"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                            Número da OP Fração *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={frac.op_protheus}
                                            onChange={e => handleFractionChange(idx, 'op_protheus', e.target.value)}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Ex: 00461845001"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                            Quantidade *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            required
                                            value={frac.quantidade_pcp}
                                            onChange={e => handleFractionChange(idx, 'quantidade_pcp', e.target.value)}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                                            <Calendar className="h-3 w-3 text-indigo-500" /> Data Entrega PCP *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={frac.data_entrega_pcp}
                                            onChange={e => handleFractionChange(idx, 'data_entrega_pcp', e.target.value)}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                            Identificação / Lote
                                        </label>
                                        <input
                                            type="text"
                                            value={frac.observacao}
                                            onChange={e => handleFractionChange(idx, 'observacao', e.target.value)}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Ex: Lote 1 - Entrega Parcial"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </form>

                {/* Footer Balance & Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Balance Status */}
                    <div className="flex items-center gap-3 text-xs w-full md:w-auto">
                        <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg flex items-center gap-2">
                            <span className="text-slate-500">Total Solicitado:</span>
                            <strong>{totalQtd.toLocaleString('pt-BR')} un</strong>
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 border ${isTotalExato ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold' : 'bg-rose-50 text-rose-800 border-rose-200 font-bold'}`}>
                            {isTotalExato ? (
                                <>
                                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                                    <span>Distribuído: {somaDistribuida.toLocaleString('pt-BR')} un (100% OK)</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="h-4 w-4 text-rose-600" />
                                    <span>Distribuído: {somaDistribuida.toLocaleString('pt-BR')} un ({diferenca > 0 ? `Faltam ${diferenca.toLocaleString('pt-BR')} un` : `Excede ${Math.abs(diferenca).toLocaleString('pt-BR')} un`})</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        {(item.is_fraction || (item.pcp_programacoes && item.pcp_programacoes.length > 1)) && (
                            <button
                                type="button"
                                onClick={handleUnmerge}
                                disabled={saving}
                                className="px-3 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 mr-auto md:mr-0"
                                title="Excluir frações e unificar OP em lote único"
                            >
                                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                Unificar OP (Excluir Frações)
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={saving || !isTotalExato}
                            className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Scissors className="h-4 w-4" />
                                    Confirmar e Partir OP
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SplitOPModal;
